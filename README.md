# 🌍 NooXCCTV — Global Surveillance Globe
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
pk.eyJ1Ijoibm9veHJpaSIsImEiOiJjbXBidGdubnEwMTNrMnJzYjFqc2ltOTg2In0.8N9W8DrKzdOgX6Om9DFLFQ
Real-time CCTV & live stream viewer on an interactive 3D globe powered by Mapbox GL JS.

## ✨ Features

- 🌐 **3D Globe** — Mapbox GL JS v3 Globe projection with atmosphere & stars
- 📍 **Smart Clustering** — Thousands of camera pins with zoom-based clustering
- 📺 **YouTube + HLS** — Embeds YouTube live streams & plays HLS `.m3u8` feeds
- 🎨 **Dark Cyberpunk UI** — Tactical surveillance HUD aesthetic
- ⚡ **Vercel Serverless** — CORS-safe data fetching via Edge Functions
- 🔄 **Auto-rotate** — Globe slowly spins until user interacts

## 🚀 Quick Start

```bash
git clone https://github.com/YOUR_USER/nooXCCTV
cd nooXCCTV
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## 📁 Project Structure

```
nooXCCTV/
├── api/
│   └── streams.js          # Vercel Serverless — fetches & converts stream data
├── src/
│   ├── components/
│   │   ├── Globe.jsx       # Mapbox 3D globe, clustering, markers, popups
│   │   ├── CCTVPopup.jsx   # Video player popup (YouTube iframe + HLS Video.js)
│   │   └── HUD.jsx         # Header, side panel, bottom bar, loading screen
│   ├── hooks/
│   │   └── useStreams.js   # Fetches GeoJSON from /api/streams
│   ├── styles/
│   │   └── main.css        # Dark cyberpunk theme
│   ├── App.jsx
│   └── main.jsx
├── public/
│   └── favicon.svg
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

## 🌐 Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login & deploy
vercel login
vercel

# Or connect GitHub repo at vercel.com/new
```

The `vercel.json` config automatically handles:
- Serverless API routing (`/api/streams`)
- SPA fallback (all routes → `index.html`)
- CORS headers for API endpoints

## 📡 Data Sources

1. **willytop8/Live-Environment-Streams** — GitHub repo with curated HLS streams
2. **Embedded fallback** — 25+ hardcoded YouTube live cams from major world cities

## 🎮 Controls

| Action | Control |
|--------|---------|
| Rotate globe | Click + Drag |
| Zoom | Scroll / Pinch |
| Select camera | Click red pin |
| Expand cluster | Click blue cluster |
| Close popup | ✕ button |
| Open in new tab | ↗ button |

## 🛠 Tech Stack

- **Frontend**: React 18 + Vite
- **Map**: Mapbox GL JS v3 (Globe mode)
- **Video**: Video.js + @videojs/http-streaming (HLS)
- **Styling**: Pure CSS (no framework)
- **API**: Vercel Serverless Functions
- **Deployment**: Vercel + GitHub

## ⚙️ Environment Variables

No environment variables needed — Mapbox token is embedded in the client (public token).

For production, you can move it to `VITE_MAPBOX_TOKEN` in `.env`:
```env
VITE_MAPBOX_TOKEN=pk.eyJ1Ijoibm9veHJpaSIs...
```

And update `Globe.jsx`:
```js
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
```
