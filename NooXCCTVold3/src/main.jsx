import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// StrictMode kaldırıldı — Mapbox GL JS, React StrictMode'un çift useEffect
// davranışıyla (mount → cleanup → remount) uyumlu değil; harita iki kez
// oluşturulup biri hemen kaldırılınca pin/layer sync sorunları çıkıyor.
createRoot(document.getElementById('root')).render(<App />)