// src/App.jsx
import { useStreams } from './hooks/useStreams';
import Globe from './components/Globe';
import { HUDHeader, SidePanel, BottomBar, LoadingScreen } from './components/HUD';
import './styles/main.css';

export default function App() {
  const { geojson, loading, count, meta } = useStreams();

  return (
    <>
      <div className="bottom-scan-line" />
      {loading && <LoadingScreen />}
      <Globe geojson={geojson} />
      <HUDHeader cameraCount={count} countryCount={meta?.countries} />
      <SidePanel />
      <BottomBar />
    </>
  );
}
