// api/streams.js - Vercel Serverless Function v4
// Primary: proxies master streams.geojson from GitHub repo (has correct coords)
// Fallback: fetches per-country JSON files

const MASTER_URL =
  'https://raw.githubusercontent.com/willytop8/Live-Environment-Streams/main/streams.geojson';

const BASE_RAW =
  'https://raw.githubusercontent.com/willytop8/Live-Environment-Streams/main/data';

const COUNTRY_CODES = [
  'AL','AR','AT','AU','BA','BB','BG','BM','BO','BQ','BR','BZ',
  'CA','CH','CL','CN','CO','CR','CV','CY','CZ','DE','DO','EC',
  'EG','ES','FO','FR','GB','GD','GP','GR','HN','HR','HU','ID',
  'IE','IL','IN','IS','IT','JO','JP','KE','KR','LK','LU','MA',
  'MQ','MT','MU','MV','MX','NL','NO','NZ','PA','PE','PH','PL',
  'PT','RO','SC','SG','SI','SM','SN','SV','SX','TH','TR','TW',
  'TZ','US','UY','VE','VI','VN','ZA','ZM'
];

function resolveStreamUrl(props) {
  const { url, url_type, source_family } = props;
  if (!url) return { streamUrl: '', embedType: 'unknown' };

  if (url.includes('.m3u8') || url.includes('.ts') || url_type === 'direct_stream') {
    return { streamUrl: url, embedType: 'hls' };
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/);
    const id = match?.[1];
    if (id) return {
      streamUrl: `https://www.youtube.com/embed/${id}?autoplay=1&mute=1`,
      embedType: 'youtube', ytId: id
    };
  }
  if (source_family === 'skylinewebcams' || url.includes('skylinewebcams.com')) {
    return { streamUrl: url, embedType: 'webpage' };
  }
  if (url_type === 'html_page' || url.includes('windy.com') || url.includes('earthtv.com')) {
    return { streamUrl: url, embedType: 'webpage' };
  }
  return { streamUrl: url, embedType: 'unknown' };
}

async function fetchCountry(code) {
  try {
    const res = await fetch(`${BASE_RAW}/${code}.json`, {
      headers: { 'User-Agent': 'NooXCCTV/1.0' },
      signal: AbortSignal.timeout(7000)
    });
    if (!res.ok) return [];
    const geojson = await res.json();
    return (geojson.features || []).map(f => ({ ...f, _cc: code }));
  } catch { return []; }
}

function normalizeFeatures(features) {
  const seen = new Set();
  return features
    .filter(f => {
      const [lng, lat] = f.geometry?.coordinates || [];
      return typeof lat === 'number' && typeof lng === 'number'
        && !isNaN(lat) && !isNaN(lng)
        && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    })
    .map((f, i) => {
      const p = f.properties || {};
      const { streamUrl, embedType, ytId } = resolveStreamUrl(p);
      return {
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: `cam-${i}`,
          name: p.display_name || p.name || `Camera ${i}`,
          fullName: p.name || '',
          url: streamUrl,
          embedType,
          ytId: ytId || null,
          country: p.country_code || f._cc || '',
          environment: p.environment || '',
          sceneType: p.scene_type || '',
          sourceFamily: p.source_family || '',
          status: p.status || 'unverified',
          qualityTier: p.quality_tier || 'unknown'
        }
      };
    })
    .filter(f => {
      const [lng, lat] = f.geometry.coordinates;
      const key = `${lng.toFixed(3)},${lat.toFixed(3)},${f.properties.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Strategy 1: Proxy the master streams.geojson ──────────────────────────
  try {
    const masterRes = await fetch(MASTER_URL, {
      headers: { 'User-Agent': 'NooXCCTV/1.0' },
      signal: AbortSignal.timeout(10000)
    });

    if (masterRes.ok) {
      const raw = await masterRes.json();
      const features = normalizeFeatures(raw.features || []);
      return res.status(200).json({
        type: 'FeatureCollection',
        features,
        meta: {
          total: features.length,
          source: 'master-geojson',
          generated: new Date().toISOString()
        }
      });
    }
  } catch (e) {
    console.warn('Master geojson fetch failed:', e.message);
  }

  // ── Strategy 2: Fetch per-country JSONs ────────────────────────────────────
  const BATCH = 15;
  let allFeatures = [];
  for (let i = 0; i < COUNTRY_CODES.length; i += BATCH) {
    const batch = COUNTRY_CODES.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(fetchCountry));
    results.forEach(arr => allFeatures.push(...arr));
  }

  const features = normalizeFeatures(allFeatures);
  return res.status(200).json({
    type: 'FeatureCollection',
    features,
    meta: {
      total: features.length,
      countries: COUNTRY_CODES.length,
      source: 'per-country',
      generated: new Date().toISOString()
    }
  });
}