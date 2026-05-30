// src/App.jsx
import { useState } from 'react';
import { useStreams } from './hooks/useStreams';
import Globe from './components/Globe';
import { HUDHeader, SidePanel, BottomBar, LoadingScreen } from './components/HUD';
import SettingsModal from './components/SettingsModal';
import './styles/main.css';

export default function App() {
  const { geojson, loading, count, meta } = useStreams();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <div className="bottom-scan-line" />
      {loading && <LoadingScreen />}
      <Globe geojson={geojson} />
      <HUDHeader 
        cameraCount={count} 
        countryCount={meta?.countries} 
        onOpenSettings={() => setSettingsOpen(true)} 
      />
      <SidePanel />
      <BottomBar />
      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
      />
    </>
  );
}
