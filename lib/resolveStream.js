// lib/resolveStream.js
// Shared stream resolver — used by Vercel api/resolve.js and Vite dev middleware.

const ALLOWED_DOMAINS = [
  'skylinewebcams.com',
  'earthtv.com',
  'webcamtaxi.com',
  'insecam.org',
  'windy.com',
  'youtube.com',
  'youtu.be',
];

// Kapsamlı YouTube ID desenleri
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
  // Skyline özel
  /videoId["']?\s*:\s*["']([a-zA-Z0-9_-]{11})["']/,
  /VIDEO_ID["']?\s*:\s*["']([a-zA-Z0-9_-]{11})["']/,
  /watch\?v=([a-zA-Z0-9_-]{11})/,
  // HTML5 video etiketi içinde olabilir
  /https?:\/\/img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})\//,
];

const SKYLINE_HD_AUTH = 'https://hd-auth.skylinewebcams.com/';
const SKYLINE_CLAPPR_RE = /(?:url|source)\s*:\s*['"](livee\.m3u8\?a=[^'"]+)['"]/i;

const HLS_PATTERNS = [
  /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/,
  /source\s*:\s*["'](https?:\/\/[^\s"']+\.m3u8[^"']*)/,
  /file\s*:\s*["'](https?:\/\/[^\s"']+\.m3u8[^"']*)/,
  /"hls"\s*:\s*"(https?:\/\/[^\s"']+)"/,
  /streamUrl\s*[=:]\s*["'](https?:\/\/[^\s"']+\.m3u8[^"']*)/,
  /hlsUrl["']?\s*:\s*["']([^"']+\.m3u8[^"']*)["']/,
  /source["']?\s*:\s*["']([^"']+\.m3u8[^"']*)["']/,
];

function isAllowedUrl(url) {
  let hostname;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return false;
  }
  return ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
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

function extractMultiStreams(html, baseUrl) {
  const results = [];
  // Sadece gerçek listing sayfalarını hedefle (en az 2 cam-light)
  const camLightCount = (html.match(/<div\s+class="cam-light">/gi) || []).length;
  if (camLightCount < 2) return results;

  const camRegex = /<a\s+href="([^"]+)"[^>]*>[\s\S]*?<div\s+class="cam-light">[\s\S]*?<p\s+class="tcam">([^<]+)<\/p>[\s\S]*?<\/a>/gi;
  let match;
  while ((match = camRegex.exec(html)) !== null) {
    let href = match[1];
    const name = match[2].trim();
    // **DÜZELTME**: new URL ile doğru birleştirme
    try {
      const absoluteUrl = new URL(href, baseUrl).href;
      if (absoluteUrl !== baseUrl && !absoluteUrl.includes('#') && !results.some(c => c.url === absoluteUrl)) {
        results.push({ name, url: absoluteUrl });
      }
    } catch (e) {
      console.warn('URL parse hatası:', href, baseUrl);
    }
  }
  return results;
}

export async function resolveWebcamUrl(pageUrl) {
  if (!pageUrl) return { embedType: 'unavailable', reason: 'missing_url' };
  if (!isAllowedUrl(pageUrl)) return { embedType: 'unavailable', reason: 'domain_not_allowed' };

  // Direkt YouTube linki
  if (pageUrl.includes('youtube.com/watch') || pageUrl.includes('youtu.be/')) {
    const ytId = extractYouTubeId(pageUrl);
    if (ytId) return { embedType: 'youtube', ytId, url: `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1` };
  }

  const pageRes = await fetch(pageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NooXCCTV/1.0)', 'Accept': 'text/html', 'Referer': 'https://www.skylinewebcams.com/' },
    signal: AbortSignal.timeout(10000),
  });
  if (!pageRes.ok) throw new Error(`Upstream ${pageRes.status}`);
  const html = await pageRes.text();

  // 1. YouTube ara (gelişmiş desenlerle)
  const ytId = extractYouTubeId(html);
  if (ytId) {
    const multi = extractMultiStreams(html, pageUrl);
    return { embedType: 'youtube', ytId, url: `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1`, multiStreams: multi.length ? multi : undefined };
  }

  // 2. HLS ara
  const hlsUrl = extractHlsUrl(html);
  const multiStreams = extractMultiStreams(html, pageUrl);
  if (hlsUrl) {
    return { embedType: 'hls', url: hlsUrl, multiStreams: multiStreams.length ? multiStreams : undefined };
  }

  // 3. Çoklu kamera listing sayfası mı?
  if (multiStreams.length > 0) {
    return { embedType: 'multi', multiStreams };
  }

  // 4. Hiçbir şey yok
  return { embedType: 'unavailable', reason: 'no_stream_found' };
}