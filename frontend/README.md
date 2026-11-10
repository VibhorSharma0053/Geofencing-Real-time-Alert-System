# Geofencing & Real-Time Alert System - Frontend

Single-page application for real-time fleet geofencing, vehicle tracking, and automated alert dispatching.

## Tech Stack
- **Framework**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Routing**: [react-router-dom v6](https://reactrouter.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **Map & Spatial Editing**: [Leaflet](https://leafletjs.com/) + [react-leaflet v4](https://react-leaflet.js.org/) + [@geoman-io/leaflet-geoman-free](https://geoman.io/)
- **Real-Time Telemetry**: Native WebSockets with auto-reconnect backoff (1s–30s) + [react-hot-toast](https://react-hot-toast.com/)

---

## Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | Backend REST API base URL |
| `VITE_WS_URL` | (Auto-derived from `VITE_API_URL`) | WebSocket alert broadcast endpoint |
| `VITE_API_KEY` | (Empty) | Optional `X-API-Key` sent in headers / WS query |

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
The application will be accessible at `http://localhost:5173`.

### 3. Production Build
```bash
npm run build
npm run preview
```

---

## Project Structure

```
frontend/
├── src/
│   ├── api/             # Typed API client & backend endpoint wrappers
│   │   ├── alerts.js
│   │   ├── client.js
│   │   ├── geofences.js
│   │   ├── locations.js
│   │   ├── vehicles.js
│   │   └── violations.js
│   ├── components/      # Shared UI elements
│   │   ├── AlertToast.jsx
│   │   ├── ConnectionBadge.jsx
│   │   ├── EmptyState.jsx
│   │   ├── ErrorMessage.jsx
│   │   ├── Layout.jsx
│   │   ├── LiveAlertsFeed.jsx
│   │   ├── LoadingSpinner.jsx
│   │   └── Navbar.jsx
│   ├── context/         # React Context (WebSocket, live alerts feed)
│   │   └── AlertsContext.jsx
│   ├── hooks/           # Custom hooks
│   │   ├── useAlertsSocket.js
│   │   ├── useAsync.js
│   │   ├── useGeofences.js
│   │   └── useVehicles.js
│   ├── pages/           # Application views
│   │   ├── AlertsPage.jsx
│   │   ├── GeofencesPage.jsx
│   │   ├── HistoryPage.jsx
│   │   ├── MapPage.jsx
│   │   ├── NotFoundPage.jsx
│   │   └── VehiclesPage.jsx
│   ├── constants.js     # Categories, event types, default coordinates
│   ├── index.css        # Tailwind & Leaflet styles
│   ├── main.jsx         # Entry point & Leaflet icon asset resolution
│   └── App.jsx          # Route declarations
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```
