// src/hooks/useStreams.js
// Fetches master streams.geojson directly from GitHub.
// Placeholder coords → country centroid + jitter. No external geocoding API needed.

import { useState, useEffect } from 'react';

// Custom cameras (user added via Settings) — read directly from localStorage
const CUSTOM_STORAGE_KEY = 'nooxcctv_custom_cameras_v1';

function loadCustomCamerasAsFeatures() {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];

    return list.map((cam, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(cam.lng), Number(cam.lat)] },
      properties: {
        id: cam.id || `custom-${i}`,
        name: cam.name || 'Custom Camera',
        fullName: cam.name || '',
        url: cam.embedUrl || cam.url,
        embedType: 'youtube',
        ytId: cam.ytId || null,
        country: cam.country || 'XX',
        environment: 'custom',
        sceneType: 'user-added',
        sourceFamily: 'user-custom',
        status: 'custom',
        qualityTier: 'user',
        addedAt: cam.addedAt
      }
    }));
  } catch {
    return [];
  }
}

const MASTER_URL =
  'https://raw.githubusercontent.com/willytop8/Live-Environment-Streams/main/streams.geojson';

// Country centroids [lng, lat]
const CENTROIDS = {
  AL:[20.17,41.15],AR:[-63.62,-38.42],AT:[14.55,47.52],AU:[133.78,-25.27],
  BA:[17.68,43.92],BB:[-59.59,13.19],BG:[25.49,42.73],BM:[-64.75,32.30],
  BO:[-64.67,-16.29],BQ:[-68.26,12.18],BR:[-51.93,-14.24],BZ:[-88.49,17.19],
  CA:[-96.80,56.13],CH:[8.23,46.82],CL:[-71.54,-35.68],CN:[104.19,35.86],
  CO:[-74.30,4.57],CR:[-83.75,9.75],CV:[-24.01,16.00],CY:[33.43,35.13],
  CZ:[15.47,49.82],DE:[10.45,51.17],DO:[-70.16,18.74],EC:[-77.80,1.83],
  EG:[30.80,26.82],ES:[-3.75,40.46],FO:[-6.91,61.89],FR:[2.21,46.23],
  GB:[-3.44,55.38],GD:[-61.68,12.11],GP:[-62.07,16.99],GR:[21.82,39.07],
  HN:[-86.24,15.20],HR:[15.20,45.10],HU:[19.50,47.16],ID:[113.92,-0.79],
  IE:[-8.24,53.41],IL:[34.85,31.05],IN:[78.96,20.59],IS:[-18.86,64.96],
  IT:[12.57,41.87],JO:[36.24,30.59],JP:[138.25,36.20],KE:[37.91,-0.02],
  KR:[127.77,35.91],LK:[80.77,7.87],LU:[6.13,49.82],MA:[-7.09,31.79],
  MQ:[-61.02,14.64],MT:[14.38,35.94],MU:[57.55,-20.35],MV:[73.54,3.20],
  MX:[-102.55,23.63],NL:[5.29,52.13],NO:[8.47,60.47],NZ:[172.47,-40.90],
  PA:[-80.78,8.54],PE:[-75.02,-9.19],PH:[121.77,12.88],PL:[19.15,51.92],
  PT:[-8.22,39.40],RO:[24.97,45.94],SC:[55.49,-4.68],SG:[103.82,1.35],
  SI:[14.99,46.15],SM:[12.46,43.94],SN:[-14.45,14.50],SV:[-88.90,13.79],
  SX:[-63.06,18.03],TH:[100.99,15.87],TR:[35.24,38.96],TW:[120.96,23.70],
  TZ:[34.89,-6.37],US:[-95.71,37.09],UY:[-55.77,-32.52],VE:[-66.59,6.42],
  VI:[-64.90,18.34],VN:[108.28,14.06],ZA:[22.94,-30.56],ZM:[27.85,-13.13]
};

// Curated high-quality YouTube live cameras we ALWAYS want visible on the globe
// (especially the new US + Japan ones you requested). Injected on top of main data.
const CURATED_LIVE_CAMERAS = [
  // America (US)
  { name:'Las Vegas Strip',            lat:36.1147, lng:-115.1728, url:'https://www.youtube.com/embed/XX7Gpd9T8Zo?autoplay=1&mute=1',  country:'US' },
  { name:'Hollywood Walk of Fame',     lat:34.1016, lng:-118.3267, url:'https://www.youtube.com/embed/lqZvHM9mYEo?autoplay=1&mute=1',  country:'US' },
  { name:'Chicago Skydeck (Willis)',   lat:41.8789, lng:-87.6359,  url:'https://www.youtube.com/embed/O0UGT7AT3aw?autoplay=1&mute=1',  country:'US' },
  { name:'Miami South Beach',          lat:25.7907, lng:-80.1300,  url:'https://www.youtube.com/embed/lVkJlng3nSs?autoplay=1&mute=1',  country:'US' },
  { name:'New Orleans Bourbon Street', lat:29.9580, lng:-90.0650,  url:'https://www.youtube.com/embed/Ksrleaxxxhw?autoplay=1&mute=1',  country:'US' },
  { name:'Nashville Lower Broadway',   lat:36.1627, lng:-86.7762,  url:'https://www.youtube.com/embed/h5Grd2w7HQM?autoplay=1&mute=1',  country:'US' },
  // Japan
  { name:'Tokyo Shinjuku Kabukicho',   lat:35.6938, lng:139.7035,  url:'https://www.youtube.com/embed/ErHJBXTmm2Q?autoplay=1&mute=1',  country:'JP' },
  { name:'Tokyo Shinjuku Street 24H',  lat:35.6896, lng:139.7006,  url:'https://www.youtube.com/embed/DjdUEyjx8GM?autoplay=1&mute=1',  country:'JP' },
  { name:'Tokyo Shibuya ANN Live',     lat:35.6590, lng:139.7008,  url:'https://www.youtube.com/embed/8H3nRCFVR6Y?autoplay=1&mute=1',  country:'JP' },
  { name:'Tokyo Shibuya Sky View',     lat:35.6580, lng:139.7015,  url:'https://www.youtube.com/embed/3Q5wZeTuttw?autoplay=1&mute=1',  country:'JP' },
  { name:'Osaka Dotonbori 24H',        lat:34.6687, lng:135.5013,  url:'https://www.youtube.com/embed/2HyOMbgYgEQ?autoplay=1&mute=1',  country:'JP' },
];

function injectCuratedCameras(base) {
  if (!base?.features) return base;

  const seen = new Set(
    base.features.map(f => {
      const [lng, lat] = f.geometry?.coordinates || [];
      return `${f.properties?.name || ''}|${(+lng).toFixed(2)}|${(+lat).toFixed(2)}`;
    })
  );

  const additions = [];
  CURATED_LIVE_CAMERAS.forEach((cam, idx) => {
    const key = `${cam.name}|${cam.lng.toFixed(2)}|${cam.lat.toFixed(2)}`;
    if (seen.has(key)) return;

    additions.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [cam.lng, cam.lat] },
      properties: {
        id: `curated-${idx}`,
        name: cam.name,
        fullName: cam.name,
        url: cam.url,
        embedType: 'youtube',
        ytId: null,
        country: cam.country,
        environment: 'urban',
        sceneType: 'street',
        sourceFamily: 'youtube-curated',
        status: 'curated',
        qualityTier: 'good'
      }
    });
    seen.add(key);
  });

  if (additions.length === 0) return base;

  return {
    ...base,
    features: [...base.features, ...additions],
    meta: {
      ...(base.meta || {}),
      curatedAdded: additions.length,
      totalWithCurated: base.features.length + additions.length
    }
  };
}

function injectCustomCameras(base) {
  const customs = loadCustomCamerasAsFeatures();
  if (!customs.length || !base?.features) return base;

  const seen = new Set(
    base.features.map(f => {
      const [lng, lat] = f.geometry?.coordinates || [];
      return `${f.properties?.name || ''}|${(+lng).toFixed(2)}|${(+lat).toFixed(2)}`;
    })
  );

  const additions = customs.filter(cam => {
    const [lng, lat] = cam.geometry.coordinates;
    const key = `${cam.properties.name}|${(+lng).toFixed(2)}|${(+lat).toFixed(2)}`;
    return !seen.has(key);
  });

  if (!additions.length) return base;

  return {
    ...base,
    features: [...base.features, ...additions],
    meta: {
      ...(base.meta || {}),
      customAdded: additions.length,
      totalWithCustom: base.features.length + additions.length
    }
  };
}

function filterYouTubeOnly(geojson) {
  if (!geojson?.features) return geojson;
  const youtubeOnly = geojson.features.filter(f => {
    const et = f.properties?.embedType;
    const url = f.properties?.url || '';
    return et === 'youtube' || url.includes('youtube.com/embed/');
  });
  return {
    ...geojson,
    features: youtubeOnly,
    meta: {
      ...(geojson.meta || {}),
      filteredToYouTube: true,
      originalCount: geojson.features.length,
      youtubeCount: youtubeOnly.length
    }
  };
}

function jitter(v, amt = 1.5) {
  return v + (Math.random() - 0.5) * amt;
}

function resolveStreamUrl(p) {
  const { url, url_type, source_family } = p;
  if (!url) return { streamUrl: '', embedType: 'unknown' };

  if (url.includes('.m3u8') || url.includes('.ts') || url_type === 'direct_stream')
    return { streamUrl: url, embedType: 'hls' };

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/);
    if (m?.[1]) return {
      streamUrl: `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1`,
      embedType: 'youtube', ytId: m[1]
    };
  }

  if (source_family === 'skylinewebcams' || url.includes('skylinewebcams.com'))
    return { streamUrl: url, embedType: 'webpage' };

  if (url_type === 'html_page' || url.includes('windy.com') || url.includes('earthtv.com'))
    return { streamUrl: url, embedType: 'webpage' };

  return { streamUrl: url, embedType: 'unknown' };
}

// Find which coordinate values are "placeholder" per country
// (shared by 3+ features at the exact same rounded position)
function buildPlaceholderSet(features) {
  const freq = {};
  for (const f of features) {
    const [lng, lat] = f.geometry?.coordinates || [];
    const cc = f.properties?.country_code || '';
    if (!cc) continue;
    const key = `${cc}:${(+lng).toFixed(2)},${(+lat).toFixed(2)}`;
    freq[key] = (freq[key] || 0) + 1;
  }
  return new Set(Object.entries(freq).filter(([, n]) => n >= 3).map(([k]) => k));
}

function processRaw(raw) {
  const features = (raw.features || []).filter(f => {
    const [lng, lat] = f.geometry?.coordinates || [];
    return typeof lng === 'number' && typeof lat === 'number'
      && !isNaN(lng) && !isNaN(lat)
      && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  });

  const placeholders = buildPlaceholderSet(features);
  const seen = new Set();
  const out = [];

  features.forEach((f, i) => {
    const p = f.properties || {};
    const cc = p.country_code || '';
    const [lng, lat] = f.geometry.coordinates;
    const placeholderKey = `${cc}:${(+lng).toFixed(2)},${(+lat).toFixed(2)}`;
    const isPlaceholder = placeholders.has(placeholderKey);

    let finalLng = lng;
    let finalLat = lat;

    if (isPlaceholder) {
      // Use country centroid + large jitter to spread cameras across the country
      const c = CENTROIDS[cc];
      if (c) {
        finalLng = jitter(c[0], 2.0);
        finalLat = jitter(c[1], 1.5);
      }
    }

    const { streamUrl, embedType, ytId } = resolveStreamUrl(p);

    // Dedupe by name + approx coords
    const key = `${finalLng.toFixed(2)},${finalLat.toFixed(2)},${p.display_name || p.name}`;
    if (seen.has(key)) return;
    seen.add(key);

    out.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [finalLng, finalLat] },
      properties: {
        id: `cam-${i}`,
        name: p.display_name || p.name || `Camera ${i}`,
        fullName: p.name || '',
        url: streamUrl,
        embedType,
        ytId: ytId || null,
        country: cc,
        environment: p.environment || '',
        sceneType: p.scene_type || '',
        sourceFamily: p.source_family || '',
        status: p.status || 'unverified',
        qualityTier: p.quality_tier || 'unknown'
      }
    });
  });

  return {
    type: 'FeatureCollection',
    features: out,
    meta: { total: out.length, generated: new Date().toISOString() }
  };
}

export function useStreams() {
  const [geojson, setGeojson]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);
  const [count,   setCount]     = useState(0);
  const [meta,    setMeta]      = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1. Try master geojson directly from GitHub
      try {
        console.log('[useStreams] Fetching', MASTER_URL);
        const res = await fetch(MASTER_URL, {
          signal: AbortSignal.timeout(15000),
          headers: { 'Accept': 'application/json' }
        });
        console.log('[useStreams] master status:', res.status, res.headers.get('content-type'));
        if (res.ok) {
          const text = await res.text();
          console.log('[useStreams] master response first 100 chars:', text.slice(0, 100));
          const raw = JSON.parse(text);
          if (raw?.features?.length && !cancelled) {
            let processed = processRaw(raw);
            processed = injectCuratedCameras(processed);
            processed = injectCustomCameras(processed);
            processed = filterYouTubeOnly(processed);
            const curated = processed.meta?.curatedAdded || 0;
            const custom = processed.meta?.customAdded || 0;
            console.log('[useStreams] processed:', processed.features.length, 'YouTube features', 
              (curated || custom) ? `(+${curated} curated, +${custom} custom)` : '');
            setGeojson(processed);
            setCount(processed.features.length);
            setMeta(processed.meta);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('[useStreams] master geojson failed:', e.message);
      }

      // 2. Try Vercel /api/streams
      try {
        const res = await fetch('/api/streams', { signal: AbortSignal.timeout(15000) });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const raw = await res.json();
          if (raw?.features?.length && !cancelled) {
            let withCurated = injectCuratedCameras(raw);
            withCurated = injectCustomCameras(withCurated);
            withCurated = filterYouTubeOnly(withCurated);
            const curated = withCurated.meta?.curatedAdded || 0;
            const custom = withCurated.meta?.customAdded || 0;
            setGeojson(withCurated);
            setCount(withCurated.features.length);
            setMeta(withCurated.meta || null);
            if (curated || custom) console.log('[useStreams] /api +', curated, 'curated,', custom, 'custom');
            setLoading(false);
            return;
          }
        } else {
          console.warn('[useStreams] /api/streams returned non-JSON:', contentType);
        }
      } catch (e) {
        console.warn('[useStreams] /api/streams failed:', e.message);
      }

      // 3. Hardcoded fallback (YouTube only)
      if (!cancelled) {
        console.warn('[useStreams] Using hardcoded fallback (YouTube only)');
        let fb = buildFallback();
        fb = injectCustomCameras(fb);
        fb = filterYouTubeOnly(fb);
        setGeojson(fb);
        setCount(fb.features.length);
        setLoading(false);
      }
    }

    load();

    // Live update when user adds/removes custom cameras from Settings
    const onCustomChange = () => {
      if (!cancelled) {
        console.log('[useStreams] Custom cameras changed — refreshing map data');
        load();
      }
    };
    window.addEventListener('custom-cameras-changed', onCustomChange);

    return () => {
      cancelled = true;
      window.removeEventListener('custom-cameras-changed', onCustomChange);
    };
  }, []);

  return { geojson, loading, error, count, meta };
}

function buildFallback() {
  // Hardcoded high-quality YouTube + Skyline fallbacks (exact coords, grouped by country)
  const streams = [
    { name:'Times Square NYC',      lat:40.7580,  lng:-73.9855, url:'https://www.youtube.com/embed/5rnlWnQEQ6Y?autoplay=1&mute=1',  country:'US' },
    { name:'Tokyo Shibuya',         lat:35.6595,  lng:139.7004, url:'https://www.youtube.com/embed/zQNHiNsFVdg?autoplay=1&mute=1',  country:'JP' },
    { name:'Eiffel Tower',          lat:48.8584,  lng:2.2945,   url:'https://www.youtube.com/embed/JzDlsiYBGvw?autoplay=1&mute=1',  country:'FR' },
    { name:'London Piccadilly',     lat:51.5099,  lng:-0.1337,  url:'https://www.youtube.com/embed/O5HJYEKV8Mk?autoplay=1&mute=1',  country:'GB' },
    { name:'Sydney Harbour',        lat:-33.8523, lng:151.2108, url:'https://www.youtube.com/embed/WpT2s3Oa1QU?autoplay=1&mute=1',  country:'AU' },
    { name:'Dubai Burj Khalifa',    lat:25.1972,  lng:55.2744,  url:'https://www.youtube.com/embed/4_Lr4k42t8o?autoplay=1&mute=1',  country:'AE' },
    { name:'Berlin Gate',           lat:52.5163,  lng:13.3777,  url:'https://www.youtube.com/embed/hEY0wOlyrRk?autoplay=1&mute=1',  country:'DE' },
    { name:'Venice Canal',          lat:45.4341,  lng:12.3388,  url:'https://www.youtube.com/embed/v3r7rEWIGGk?autoplay=1&mute=1',  country:'IT' },
    { name:'Istanbul Bosphorus',    lat:41.0082,  lng:28.9784,  url:'https://www.youtube.com/embed/4HGBiJEalSU?autoplay=1&mute=1',  country:'TR' },
    { name:'Singapore Marina Bay',  lat:1.2789,   lng:103.8536, url:'https://www.youtube.com/embed/YRJRBEuvhiE?autoplay=1&mute=1',  country:'SG' },
    { name:'Seoul Gangnam',         lat:37.4979,  lng:127.0276, url:'https://www.youtube.com/embed/lz2S0OkZ1EM?autoplay=1&mute=1',  country:'KR' },
    { name:'Amsterdam Canals',      lat:52.3676,  lng:4.9041,   url:'https://www.youtube.com/embed/BjrV8fCkZ4g?autoplay=1&mute=1',  country:'NL' },
    { name:'Prague Old Town',       lat:50.0874,  lng:14.4213,  url:'https://www.youtube.com/embed/IVEoMPWFkMQ?autoplay=1&mute=1',  country:'CZ' },
    { name:'Athens Acropolis',      lat:37.9715,  lng:23.7257,  url:'https://www.youtube.com/embed/lsB3fEFLKog?autoplay=1&mute=1',  country:'GR' },
    { name:'Mumbai Marine Drive',   lat:18.9442,  lng:72.8235,  url:'https://www.youtube.com/embed/E8yCJVo5KJ0?autoplay=1&mute=1',  country:'IN' },
    { name:'Cape Town Waterfront',  lat:-33.9040, lng:18.4196,  url:'https://www.youtube.com/embed/PbqNl_4IkEw?autoplay=1&mute=1',  country:'ZA' },
    { name:'Niagara Falls',         lat:43.0799,  lng:-79.0747, url:'https://www.youtube.com/embed/tnxGp8Y9HG8?autoplay=1&mute=1',  country:'CA' },
    // Skyline entries removed - only pure YouTube live streams kept per user request

    // ── NEW ADDITIONS: United States (America) major live spots ──────────────
    { name:'Las Vegas Strip',            lat:36.1147, lng:-115.1728, url:'https://www.youtube.com/embed/XX7Gpd9T8Zo?autoplay=1&mute=1',  country:'US' },
    { name:'Hollywood Walk of Fame',     lat:34.1016, lng:-118.3267, url:'https://www.youtube.com/embed/lqZvHM9mYEo?autoplay=1&mute=1',  country:'US' },
    { name:'Chicago Skydeck (Willis)',   lat:41.8789, lng:-87.6359,  url:'https://www.youtube.com/embed/O0UGT7AT3aw?autoplay=1&mute=1',  country:'US' },
    { name:'Miami South Beach',          lat:25.7907, lng:-80.1300,  url:'https://www.youtube.com/embed/lVkJlng3nSs?autoplay=1&mute=1',  country:'US' },
    { name:'New Orleans Bourbon Street', lat:29.9580, lng:-90.0650,  url:'https://www.youtube.com/embed/Ksrleaxxxhw?autoplay=1&mute=1',  country:'US' },
    { name:'Nashville Lower Broadway',   lat:36.1627, lng:-86.7762,  url:'https://www.youtube.com/embed/h5Grd2w7HQM?autoplay=1&mute=1',  country:'US' },

    // ── NEW ADDITIONS: Japan (Tokyo + Osaka iconic live cams) ────────────────
    { name:'Tokyo Shinjuku Kabukicho',   lat:35.6938, lng:139.7035,  url:'https://www.youtube.com/embed/ErHJBXTmm2Q?autoplay=1&mute=1',  country:'JP' },
    { name:'Tokyo Shinjuku Street 24H',  lat:35.6896, lng:139.7006,  url:'https://www.youtube.com/embed/DjdUEyjx8GM?autoplay=1&mute=1',  country:'JP' },
    { name:'Tokyo Shibuya ANN Live',     lat:35.6590, lng:139.7008,  url:'https://www.youtube.com/embed/8H3nRCFVR6Y?autoplay=1&mute=1',  country:'JP' },
    { name:'Tokyo Shibuya Sky View',     lat:35.6580, lng:139.7015,  url:'https://www.youtube.com/embed/3Q5wZeTuttw?autoplay=1&mute=1',  country:'JP' },
    { name:'Osaka Dotonbori 24H',        lat:34.6687, lng:135.5013,  url:'https://www.youtube.com/embed/2HyOMbgYgEQ?autoplay=1&mute=1',  country:'JP' },
  ];
  return {
    type: 'FeatureCollection',
    features: streams.map((s, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        id: `fb-${i}`, name: s.name, fullName: s.name,
        url: s.url, embedType: s.url.includes('skyline') ? 'webpage' : 'youtube',
        ytId: null, country: s.country, environment: '', sceneType: '',
        sourceFamily: s.url.includes('skyline') ? 'skylinewebcams' : 'youtube',
        status: 'fallback', qualityTier: 'unknown'
      }
    }))
  };
}