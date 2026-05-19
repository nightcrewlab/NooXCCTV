// src/components/CCTVPopup.jsx
// Handles 3 embed types: 'youtube' | 'hls' | 'webpage'
// Supports multi-camera listings. If unavailable, suggests opening in new tab.

import { useEffect, useRef, useState, useCallback } from 'react';

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

function getOpenUrl(props, ytId) {
  if (props.embedType === 'youtube' && ytId) return `https://www.youtube.com/watch?v=${ytId}`;
  return props.url;
}

function getTypeBadge(embedType) {
  if (embedType === 'youtube') return 'YOUTUBE';
  if (embedType === 'hls') return 'HLS';
  if (embedType === 'webpage') return 'WEBCAM';
  if (embedType === 'multi') return 'MULTI-CAM';
  return 'STREAM';
}

// YouTube embed
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

// SkylineWebcams / generic webpage embed (fallback)
function WebpageEmbed({ url, onLoad }) {
  return (
    <div className="popup-media-area">
      <iframe
        src={url}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        allow="autoplay; fullscreen"
        onLoad={onLoad}
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none', background:'#000' }}
      />
    </div>
  );
}

// HLS stream
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

// Resolver
function useResolvedStream(originalUrl, originalEmbedType) {
  const [resolved, setResolved] = useState(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (originalEmbedType !== 'webpage' && originalEmbedType !== 'multi') {
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
        setResolved(data);
      } catch (err) {
        console.warn('[CCTVPopup] resolve failed:', err.message);
        if (!cancelled) setResolved({ embedType: 'unavailable', url: originalUrl });
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();

    return () => { cancelled = true; };
  }, [originalUrl, originalEmbedType]);

  return { resolved, resolving };
}

// Main popup
export default function CCTVPopup({ feature, onClose }) {
  const [status, setStatus] = useState('loading');
  const [camId] = useState(() => `CAM-${Math.random().toString(36).substr(2,6).toUpperCase()}`);
  const [activeStream, setActiveStream] = useState(null);
  const [activeStreamName, setActiveStreamName] = useState(null);
  const [subResolving, setSubResolving] = useState(false);

  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const coords = formatCoords(lng, lat);
  const flag = getFlag(p.country);

  const { resolved, resolving } = useResolvedStream(p.url, p.embedType);

  const handleLoad = () => setStatus('live');

  useEffect(() => {
    setActiveStream(null);
    setActiveStreamName(null);
    setSubResolving(false);
  }, [resolved]);

  const loadSubCamera = useCallback(async (camUrl, camName) => {
    let absoluteUrl = camUrl;
    if (!camUrl.startsWith('http')) {
      try {
        const base = new URL(p.url);
        absoluteUrl = new URL(camUrl, base).href;
      } catch (e) {
        absoluteUrl = camUrl;
      }
    }
    setSubResolving(true);
    setActiveStreamName(camName);
    try {
      const endpoint = `/api/resolve?url=${encodeURIComponent(absoluteUrl)}`;
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`resolve sub ${res.status}`);
      const data = await res.json();
      setActiveStream(data);
    } catch (err) {
      console.warn('[CCTVPopup] sub resolve failed:', err.message);
      setActiveStream({ embedType: 'unavailable', url: absoluteUrl });
    } finally {
      setSubResolving(false);
    }
  }, [p.url]);

  const effectiveStream = activeStream || resolved;
  const effectiveEmbedType = effectiveStream?.embedType ?? p.embedType;
  const effectiveUrl = effectiveStream?.url ?? p.url;
  const effectiveYtId = effectiveStream?.ytId ?? p.ytId;
  const badge = getTypeBadge(effectiveEmbedType);
  const openUrl = getOpenUrl(p, effectiveYtId);

  const isMultiMode = resolved?.embedType === 'multi' && !activeStream;
  const hasMultiStreams = resolved?.multiStreams && resolved.multiStreams.length > 0;
  const showMultiList = (isMultiMode || (hasMultiStreams && !activeStream)) && !subResolving;

  const statusLabel =
    resolving || subResolving    ? 'RESOLVING STREAM...' :
    status === 'loading'   ? 'CONNECTING...' :
    status === 'live'      ? 'SIGNAL ACTIVE' :
                             'STREAM OFFLINE';
  const dotClass =
    resolving || subResolving   ? 'loading' :
    status === 'loading'   ? 'loading' :
    status === 'live'      ? ''        : 'offline';

  return (
    <div className="cctv-popup" onClick={e => e.stopPropagation()}>
      <div className="popup-header">
        <div className="popup-cam-info">
          <div className="popup-cam-id">⬡ {camId}</div>
          <div className="popup-cam-name" title={activeStreamName || p.fullName || p.name}>
            {flag} {activeStreamName || p.name}
          </div>
          {!activeStreamName && p.fullName && p.fullName !== p.name && (
            <div className="popup-cam-location" style={{ fontSize:'10px', opacity:.7 }}>{p.fullName}</div>
          )}
          <div className="popup-cam-location">
            {[p.environment, p.country].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="popup-actions">
          {/* Open in new tab (direct) */}
          {/*<a href={openUrl} target="_blank" rel="noopener noreferrer" className="popup-btn" title="Open in new tab">↗</a>*/}
          <button className="popup-btn close" onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      <div className="popup-signal">
        <div className={`signal-dot ${dotClass}`} />
        <span className="signal-label">{statusLabel}</span>
        <span className="signal-type-badge">{badge}</span>
      </div>

      {(resolving || subResolving) && (
        <div className="popup-media-area" style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:24, opacity:.5, animation:'spin 1.5s linear infinite' }}>⬡</div>
          <div className="popup-offline-text">RESOLVING STREAM...</div>
        </div>
      )}

      {!resolving && !subResolving && effectiveEmbedType === 'youtube' && (
        <YouTubeEmbed url={effectiveUrl} onLoad={handleLoad} />
      )}
      {!resolving && !subResolving && effectiveEmbedType === 'hls' && (
        <HLSEmbed url={effectiveUrl} onStatus={s => setStatus(s)} />
      )}
      {!resolving && !subResolving && effectiveEmbedType === 'webpage' && (
        <WebpageEmbed url={effectiveUrl} onLoad={handleLoad} />
      )}
      {!resolving && !subResolving && effectiveEmbedType === 'multi' && !activeStream && (
        <div className="popup-media-area" style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, minHeight:'180px' }}>
          <div style={{ fontSize:32, opacity:.25 }}>🎥</div>
          <div className="popup-offline-text">MULTIPLE CAMERAS AVAILABLE</div>
          <div style={{ fontSize:10, opacity:.4, textAlign:'center' }}>Select one from the list below</div>
        </div>
      )}
      {!resolving && !subResolving && (effectiveEmbedType === 'unavailable' || effectiveEmbedType === 'unknown') && !showMultiList && (
        <div className="popup-media-area" style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10 }}>
          <div style={{ fontSize:32, opacity:.25 }}>📡</div>
          <div className="popup-offline-text">STREAM NOT PLAYABLE IN EMBED</div>
          <div style={{ fontSize:10, opacity:.4, textAlign:'center', padding:'0 12px' }}>
            This website blocks embedded playback.<br/>
            Please click the button below to open in a new tab.
          </div>
        </div>
      )}

      {(showMultiList || (hasMultiStreams && !activeStream)) && (
        <div className="popup-multi-list" style={{ padding: '8px 12px', borderTop: '1px solid rgba(0,200,255,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', marginBottom: '8px', letterSpacing: '1px' }}>
            ⬡ AVAILABLE CAMERAS
          </div>
          {resolved?.multiStreams?.map((cam, idx) => (
            <button
              key={idx}
              onClick={() => loadSubCamera(cam.url, cam.name)}
              className="popup-multi-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                background: 'rgba(0,200,255,0.05)',
                border: '1px solid rgba(0,200,255,0.15)',
                padding: '6px 10px',
                marginBottom: '6px',
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.1s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,200,255,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,200,255,0.05)'}
            >
              <span style={{ fontSize: '14px' }}>🎥</span>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cam.name}</span>
              <span style={{ fontSize: '10px', opacity: 0.6 }}>↗</span>
            </button>
          ))}
          {activeStream && (
            <button
              onClick={() => { setActiveStream(null); setActiveStreamName(null); }}
              className="popup-multi-item"
              style={{
                marginTop: '6px',
                background: 'rgba(255,45,85,0.1)',
                borderColor: 'rgba(255,45,85,0.3)',
                color: 'var(--accent-red)',
              }}
            >
              ← BACK TO LIST
            </button>
          )}
        </div>
      )}

      <div className="popup-footer">
        <span className="popup-coords">{coords}</span>
        <button 
          className="popup-open-btn" 
          onClick={() => window.open(openUrl, '_blank')}
        >
          ↗ YENİ SEKME
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}