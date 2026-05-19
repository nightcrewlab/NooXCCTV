// src/components/HUD.jsx
import { useState, useEffect } from 'react';

function Clock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toUTCString().slice(17, 25) + ' UTC');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="hud-time">{time}</span>;
}

export function HUDHeader({ cameraCount, countryCount }) {
  return (
    <header className="hud-header">
      <div className="hud-logo">
        <div className="hud-logo-icon">
          <div className="hud-logo-dot" />
        </div>
        <span className="hud-logo-text">
          NOOX<span>CCTV</span>
        </span>
      </div>

      <div className="hud-stats">
        <div className="hud-stat">
          <span className="hud-stat-value">{cameraCount}</span>
          <span className="hud-stat-label">CAMERAS</span>
        </div>
        <div className="hud-stat">
          <span className="hud-stat-value">{countryCount || '—'}</span>
          <span className="hud-stat-label">COUNTRIES</span>
        </div>
        <div className="hud-stat">
          <span className="hud-stat-value" style={{ color: '#00ff88' }}>LIVE</span>
          <span className="hud-stat-label">STATUS</span>
        </div>
        <Clock />
      </div>
    </header>
  );
}

export function SidePanel() {
  return (
    <aside className="side-panel">
      <div className="panel-block">
        <div className="panel-title">// LEGEND</div>
        <div className="legend-item">
          <div className="legend-dot live" />
          <span>HLS Stream</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot youtube" />
          <span>YouTube Live</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot cluster" />
          <span>Cluster</span>
        </div>
      </div>

      <div className="panel-block">
        <div className="panel-title">// SYSTEM</div>
        <div className="status-line">
          <span className="status-label">GLOBE ENGINE</span>
          <span className="status-value green">ONLINE</span>
        </div>
        <div className="status-line">
          <span className="status-label">DATA FEED</span>
          <span className="status-value green">ACTIVE</span>
        </div>
        <div className="status-line">
          <span className="status-label">CLUSTER MODE</span>
          <span className="status-value">ENABLED</span>
        </div>
        <div className="status-line">
          <span className="status-label">PROJECTION</span>
          <span className="status-value">GLOBE</span>
        </div>
      </div>

      <div className="panel-block">
        <div className="panel-title">// CONTROLS</div>
        <div className="status-line">
          <span className="status-label">ROTATE</span>
          <span className="status-value">DRAG</span>
        </div>
        <div className="status-line">
          <span className="status-label">ZOOM</span>
          <span className="status-value">SCROLL</span>
        </div>
        <div className="status-line">
          <span className="status-label">SELECT CAM</span>
          <span className="status-value">CLICK PIN</span>
        </div>
      </div>
    </aside>
  );
}

export function BottomBar() {
  return (
    <div className="bottom-bar">
      <span className="bottom-text">
        NooXCCTV v1.0 — Global Surveillance Globe — Real-Time CCTV Streams
      </span>
      <span className="bottom-text">
        MAPBOX GL JS v3 · GLOBE PROJECTION
      </span>
    </div>
  );
}

export function LoadingScreen() {
  const [step, setStep] = useState(0);
  const steps = [
    'INITIALIZING GLOBE ENGINE...',
    'FETCHING CAMERA COORDINATES...',
    'ESTABLISHING STREAM LINKS...',
    'SYSTEM READY'
  ];

  useEffect(() => {
    const intervals = steps.map((_, i) =>
      setTimeout(() => setStep(i), i * 750)
    );
    return () => intervals.forEach(clearTimeout);
  }, []);

  return (
    <div className="loading-screen">
      <div className="loading-title">NOOX<span>CCTV</span></div>
      <div className="loading-bar-wrap">
        <div className="loading-bar" />
      </div>
      <div className="loading-text">{steps[step]}</div>
    </div>
  );
}
