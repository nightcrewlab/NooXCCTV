// src/components/CCTVPopup.jsx
// Handles 3 embed types: 'youtube' | 'hls' | 'webpage'
// For 'webpage' type, auto-calls /api/resolve to extract the real stream URL.

import { useEffect, useRef, useState } from 'react';

const FLAG_MAP = {
  US:'🇺🇸',GB:'🇬🇧',FR:'🇫🇷',DE:'🇩🇪',JP:'🇯🇵',CN:'🇨🇳',AU:'🇦🇺',CA:'🇨🇦',
  BR:'🇧🇷',IN:'🇮🇳',TR:'🇹🇷',IT:'🇮🇹',ES:'🇪🇸',NL:'🇳🇱',PL:'🇵🇱',GR:'🇬🇷',
  PT:'🇵🇹',CZ:'🇨🇿',AT:'🇦🇹',SE:'🇸🇪',NO:'🇳🇴',SG:'🇸🇬',KR:'🇰🇷',TH:'🇹🇭',
  ZA:'🇿🇦',NZ:'🇳🇿',AR:'🇦🇷',MX:'🇲🇽',EG:'🇪🇬',MA:'🇲🇦',RU:'🇷🇺',UA:'🇺🇦',
  AE:'🇦🇪',IL:'🇮🇱',CH:'🇨🇭',BE:'🇧🇪',DK:'🇩🇰',FI:'🇫🇮',HU:'🇭🇺',RO:'🇷🇴',
  ID:'🇮🇩',PH:'🇵🇭',VN:'🇻🇳',TW:'🇹🇼',MY:'🇲🇾',HK:'🇭🇰',TZ:'🇹🇿',KE:'🇰🇪',
  CO:'🇨🇴',PE:'🇵🇪',CL:'🇨🇱',LU:'🇱🇺',HR:'🇭🇷',SI:'🇸🇮',SK:'🇸🇰',BG:'🇧🇬',
};

function getFlag(code) { return FLAG_MAP[code] || '🌐'; }

function formatCoords(lng, lat) {
  const la = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`;
  const lo = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`;
  return `${la} ${lo}`;
}

function getOpenUrl(props) {
  if (props.embedType === 'youtube' && props.ytId) return `https://www.youtube.com/watch?v=${props.ytId}`;
  return props.url;
}

function getTypeBadge(embedType) {
  if (embedType === 'youtube') return 'YOUTUBE';
  if (embedType === 'hls') return 'HLS';
  if (embedType === 'webpage') return 'WEBCAM';
  return 'STREAM';
}

// ─── YouTube embed ─────────────────────────────────────────
function YouTubeEmbed({ url, onLoad }) {
  return (
    <div className="popup-media-area">
      <iframe
        src={url}
        title="YouTube stream"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={onLoad}
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none' }}
      />
    </div>
  );
}

// ─── SkylineWebcams / generic webpage embed ────────────────
function WebpageEmbed({ url, onLoad }) {
  return (
    <div className="popup-media-area">
      <iframe
        src={url}
        sandbox="allow-scripts allow-same-origin allow-popups"
        allow="autoplay"
        onLoad={onLoad}
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none', background:'#000' }}
      />
    </div>
  );
}

// ─── HLS stream with Video.js ───────────────────────────────
function HLSEmbed({ url, onStatus }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    let player;
    (async () => {
      try {
        const videojs = (await import('video.js')).default;
        await import('@videojs/http-streaming');
        player = videojs(videoRef.current, {
          autoplay: true, muted: true, controls: true, fluid: true,
          sources: [{ src: url, type: 'application/x-mpegURL' }],
          html5: { vhs: { overrideNative: true }, nativeAudioTracks: false, nativeVideoTracks: false }
        });
        player.on('playing', () => onStatus('live'));
        player.on('error', () => onStatus('offline'));
        playerRef.current = player;
        onStatus('live');
      } catch { onStatus('offline'); }
    })();
    return () => {
      try { playerRef.current?.dispose(); } catch {}
    };
  }, [url]);

  return (
    <div className="popup-media-area">
      <video ref={videoRef} className="video-js vjs-default-skin vjs-big-play-centered" preload="auto" />
    </div>
  );
}

// ─── Resolver: turns a webpage URL into a real stream ──────
// Calls /api/resolve on Vercel (or falls back gracefully in dev).
function useResolvedStream(originalUrl, originalEmbedType) {
  const [resolved, setResolved] = useState(null); // { embedType, url, ytId? }
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    // Only resolve webpage type — youtube and hls are already usable
    if (originalEmbedType !== 'webpage') {
      setResolved({ embedType: originalEmbedType, url: originalUrl });
      return;
    }

    let cancelled = false;
    setResolving(true);

    (async () => {
      try {
        const endpoint = `/api/resolve?url=${encodeURIComponent(originalUrl)}`;
        const res = await fetch(endpoint, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) throw new Error(`resolve API ${res.status}`);
        const data = await res.json();

        if (cancelled) return;

        if (data.embedType === 'youtube' || data.embedType === 'hls') {
          setResolved(data);
        } else {
          // Unavailable or unknown — keep original so we can show the fallback UI
          setResolved({ embedType: 'unavailable', url: originalUrl });
        }
      } catch (err) {
        console.warn('[CCTVPopup] resolve failed:', err.message);
        if (!cancelled) {
          setResolved({ embedType: 'unavailable', url: originalUrl });
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();

    return () => { cancelled = true; };
  }, [originalUrl, originalEmbedType]);

  return { resolved, resolving };
}

// ─── Main popup ─────────────────────────────────────────────
export default function CCTVPopup({ feature, onClose }) {
  const [status, setStatus] = useState('loading');
  const [camId] = useState(() => `CAM-${Math.random().toString(36).substr(2,6).toUpperCase()}`);

  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const coords = formatCoords(lng, lat);
  const flag = getFlag(p.country);

  // Resolve webpage URLs to real streams via /api/resolve
  const { resolved, resolving } = useResolvedStream(p.url, p.embedType);

  // Effective values to render
  const effectiveEmbedType = resolved?.embedType ?? p.embedType;
  const effectiveUrl = resolved?.url ?? p.url;
  const effectiveYtId = resolved?.ytId ?? p.ytId;
  const badge = getTypeBadge(effectiveEmbedType);

  // Build the "open in new tab" URL
  const openUrl = effectiveEmbedType === 'youtube' && effectiveYtId
    ? `https://www.youtube.com/watch?v=${effectiveYtId}`
    : p.url; // always point to original page for non-youtube

  const handleLoad = () => setStatus('live');

  const statusLabel =
    resolving              ? 'RESOLVING STREAM...' :
    status === 'loading'   ? 'CONNECTING...' :
    status === 'live'      ? 'SIGNAL ACTIVE' :
                             'STREAM OFFLINE';
  const dotClass =
    resolving              ? 'loading' :
    status === 'loading'   ? 'loading' :
    status === 'live'      ? ''        : 'offline';

  return (
    <div className="cctv-popup" onClick={e => e.stopPropagation()}>

      {/* ── Header ── */}
      <div className="popup-header">
        <div className="popup-cam-info">
          <div className="popup-cam-id">⬡ {camId}</div>
          <div className="popup-cam-name" title={p.fullName || p.name}>
            {flag} {p.name}
          </div>
          {p.fullName && p.fullName !== p.name && (
            <div className="popup-cam-location" style={{ fontSize:'10px', opacity:.7 }}>{p.fullName}</div>
          )}
          <div className="popup-cam-location">
            {[p.environment, p.country].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="popup-actions">
          <a href={openUrl} target="_blank" rel="noopener noreferrer" className="popup-btn" title="Open in new tab">↗</a>
          <button className="popup-btn close" onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      {/* ── Signal bar ── */}
      <div className="popup-signal">
        <div className={`signal-dot ${dotClass}`} />
        <span className="signal-label">{statusLabel}</span>
        <span className="signal-type-badge">{badge}</span>
      </div>

      {/* ── Media ── */}
      {resolving && (
        <div className="popup-media-area" style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:24, opacity:.5, animation:'spin 1.5s linear infinite' }}>⬡</div>
          <div className="popup-offline-text">RESOLVING STREAM...</div>
        </div>
      )}

      {!resolving && effectiveEmbedType === 'youtube' && (
        <YouTubeEmbed url={effectiveUrl} onLoad={handleLoad} />
      )}
      {!resolving && effectiveEmbedType === 'hls' && (
        <HLSEmbed url={effectiveUrl} onStatus={s => setStatus(s)} />
      )}
      {!resolving && effectiveEmbedType === 'webpage' && (
        <WebpageEmbed url={effectiveUrl} onLoad={handleLoad} />
      )}
      {!resolving && (effectiveEmbedType === 'unavailable' || effectiveEmbedType === 'unknown' || !effectiveEmbedType) && (
        <div className="popup-media-area" style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10 }}>
          <div style={{ fontSize:32, opacity:.25 }}>📡</div>
          <div className="popup-offline-text">STREAM UNAVAILABLE IN BROWSER</div>
          <div style={{ fontSize:10, opacity:.4, textAlign:'center', padding:'0 12px' }}>
            This provider blocks embedded playback.<br/>Open the link below to watch externally.
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="popup-footer">
        <span className="popup-coords">{coords}</span>
        <a href={openUrl} target="_blank" rel="noopener noreferrer" className="popup-open-btn">
          ↗ OPEN STREAM
        </a>
      </div>

    </div>
  );
}