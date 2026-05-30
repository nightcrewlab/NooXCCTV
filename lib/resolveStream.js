// Shared stream resolver — used by Vercel api/resolve.js and Vite dev middleware.

const ALLOWED_DOMAINS = [
  'skylinewebcams.com',
  'earthtv.com',
  'webcamtaxi.com',
  'insecam.org',
  'windy.com',
];

const YT_PATTERNS = [
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/,
  /videoId\s*:\s*['"]([a-zA-Z0-9_-]{11})['"]/,
  /videoId\s*=\s*['"]([a-zA-Z0-9_-]{11})['"]/,
  /ytId\s*[=:]\s*["']([a-zA-Z0-9_-]{11})["']/,
  /data-video-id=["']([a-zA-Z0-9_-]{11})["']/,
  /live_id\s*=\s*["']([a-zA-Z0-9_-]{11})["']/,
  /yt_video_id\s*[=:]\s*["']?([a-zA-Z0-9_-]{11})["']?/,
  /player\.src\([^)]*youtu[^)]*\/([a-zA-Z0-9_-]{11})/,
  /"url"\s*:\s*"https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/,
  /src=["']https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/,
];

const SKYLINE_HD_AUTH = 'https://hd-auth.skylinewebcams.com/';
// Clappr player: source:'livee.m3u8?a=TOKEN' → hd-auth.skylinewebcams.com/live.m3u8?a=TOKEN
const SKYLINE_CLAPPR_RE = /(?:url|source)\s*:\s*['"](livee\.m3u8\?a=[^'"]+)['"]/i;

const HLS_PATTERNS = [
  /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/,
  /source\s*:\s*["'](https?:\/\/[^\s"']+\.m3u8[^"']*)/,
  /file\s*:\s*["'](https?:\/\/[^\s"']+\.m3u8[^"']*)/,
  /"hls"\s*:\s*"(https?:\/\/[^\s"']+)"/,
  /streamUrl\s*[=:]\s*["'](https?:\/\/[^\s"']+\.m3u8[^"']*)/,
];

function isAllowedUrl(url) {
  let hostname;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return false;
  }
  return ALLOWED_DOMAINS.some(d => hostname.endsWith(d));
}

function extractYouTubeId(html) {
  for (const pat of YT_PATTERNS) {
    const m = html.match(pat);
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractSkylineClapprHls(html) {
  const m = html.match(SKYLINE_CLAPPR_RE);
  if (!m?.[1]) return null;
  const path = m[1].replace(/^livee\./, 'live.');
  return `${SKYLINE_HD_AUTH}${path}`;
}

function extractHlsUrl(html) {
  const skyline = extractSkylineClapprHls(html);
  if (skyline) return skyline;

  for (const pat of HLS_PATTERNS) {
    const m = html.match(pat);
    if (m?.[1]) return m[1];
  }
  return null;
}

/**
 * @param {string} pageUrl
 * @returns {Promise<{ embedType: string, url?: string, ytId?: string, reason?: string }>}
 */
export async function resolveWebcamUrl(pageUrl) {
  if (!pageUrl) {
    return { embedType: 'unavailable', reason: 'missing_url' };
  }
  if (!isAllowedUrl(pageUrl)) {
    return { embedType: 'unavailable', reason: 'domain_not_allowed' };
  }

  const pageRes = await fetch(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NooXCCTV/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://www.skylinewebcams.com/',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!pageRes.ok) {
    throw new Error(`Upstream ${pageRes.status}`);
  }

  const html = await pageRes.text();

  const ytId = extractYouTubeId(html);
  if (ytId) {
    return {
      embedType: 'youtube',
      ytId,
      url: `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1`,
    };
  }

  const hlsUrl = extractHlsUrl(html);
  if (hlsUrl) {
    return { embedType: 'hls', url: hlsUrl };
  }

  if (html.match(/(rtmp[s]?:\/\/[^\s"'<>]+)/)) {
    return { embedType: 'unavailable', reason: 'rtmp' };
  }

  return { embedType: 'unavailable', reason: 'no_stream_found' };
}
