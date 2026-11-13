# Geofencing & Real-Time Alert System

[![Go 1.22+](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat&logo=go)](https://golang.org)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://react.dev)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql)](https://www.postgresql.org)
[![PostGIS 3.4](https://img.shields.io/badge/PostGIS-3.4-5B8C3E?style=flat&logo=postgis)](https://postgis.net)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?style=flat&logo=docker)](https://www.docker.com)

A high-performance, full-stack fleet geofencing and real-time alert monitoring platform built with Go, PostgreSQL/PostGIS, WebSockets, and React Leaflet. The system tracks fleet telemetry, evaluates spatial containment against polygonal boundaries via PostGIS spatial indexing (`ST_Covers`), detects transitions (entry and exit events), persists immutable audit histories, and asynchronously broadcasts targeted alerts to connected operator dashboards over WebSockets.

---

## Deployment & Demonstration Links

- **Walkthrough Video:** `[Pending - Video URL placeholder]`
- **Live Frontend App:** `[Pending - https://geofence-demo.vercel.app]`
- **Live Backend API:** `[Pending - https://geofence-api.onrender.com]`
- **Docker Hub Repository:** [docker.io/vibhorsharma/geofence-backend](https://hub.docker.com/r/vibhorsharma/geofence-backend)
- **Detailed Guides:**
  - 📖 **[SETUP.md](SETUP.md)**: Local developer setup, API specification, schema summary, edge cases, and testing.
  - 🚀 **[DEPLOY.md](DEPLOY.md)**: Cloud deployment to Render, Neon, Vercel, Netlify, and Docker Hub pushing.
  - ✅ **[docs/QA.md](docs/QA.md)**: Full verification checklist across endpoints, WebSockets, and UI.
  - 🎬 **[docs/VIDEO_SCRIPT.md](docs/VIDEO_SCRIPT.md)**: 30–45 minute walkthrough video outline and script.

---

## Application Screenshots

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           [ SCREENSHOT PLACEHOLDER ]                        │
│                                                                             │
│                     Interactive Leaflet Map & Live Fleet                    │
│      - Real-Time Fleet Markers with Restricted Zone Pulsing Alerts         │
│      - Geoman Polygon Geofence Drawing Canvas                               │
│      - Real-Time WebSocket Alerts Feed with Slide-Out Panel                 │
│      - Bi-Directional Click-to-Set Coordinate Telemetry Updates             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Status Checklist

- [x] **Phase 0: Repository Skeleton & Architecture Specification**
- [x] **Phase 1: Database Schema & PostGIS Migrations (pgxpool + golang-migrate)**
- [x] **Phase 2: Domain Models & Storage Layer Implementation**
- [x] **Phase 3: Core Geofencing Engine & Event Detection Logic**
- [x] **Phase 4: REST API Endpoints (Geofences, Vehicles, Locations, Alerts, Violations)**
- [x] **Phase 5: WebSocket Real-Time Alert Broadcast Hub**
- [x] **Phase 6: Frontend Setup & Shell Architecture (Vite + React + Tailwind CSS)**
- [x] **Phase 7: Interactive Geofence Editor & Map Canvas (Leaflet + Geoman)**
- [x] **Phase 8: Real-Time Fleet Tracking & Alert Dashboard**
- [x] **Phase 9: Docker Containerization, Multi-Stage Builds & Deployment Strategy**
- [x] **Phase 10: Final Documentation, Demo Tooling, QA & Walkthrough Outline**

---

## Quickstart (Full Stack in 60 Seconds)

### Run with Docker Compose
```bash
# Clone the repository
git clone <repo-url>
cd mapup-ai-assessment

# Start PostGIS, Go backend, and Nginx frontend
docker compose up --build
```

Access points:
- **Frontend Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8080/health](http://localhost:8080/health)
- **WebSocket Endpoint**: `ws://localhost:8080/ws/alerts`

### Seed Demo Data & Trigger Simulated Movement
In another terminal:
```bash
# Populate geofences, vehicles, and active alert rules
bash scripts/seed.sh

# Simulate vehicle driving through a restricted zone to trigger live alerts
bash scripts/simulate.sh
```

---

## Architecture At A Glance

- **Backend**: Go 1.22+ (`net/http` ServeMux routing), `pgx/v5` (`pgxpool`), PostgreSQL 16 + PostGIS 3.4 (`postgis/postgis:16-3.4`), embedded migrations via `golang-migrate`, `gorilla/websocket`, structured JSON logging with `log/slog`.
- **Frontend**: Vite + React 18 (JavaScript), Tailwind CSS, `react-router-dom`, `react-leaflet` v4 + Leaflet, `@geoman-io/leaflet-geoman-free`, `react-hot-toast`.
- **Spatial Engine**: PostGIS `ST_Covers` with GiST spatial indexing for boundary and containment calculations.
- **Contract Rules**:
  - Every single JSON response includes `"time_ns"` as a string containing execution duration in nanoseconds.
  - IDs are typed with prefixes: `geo_`, `veh_`, `alert_`, `viol_`, `evt_`.
  - Coordinates are API `[latitude, longitude]` and PostGIS `(longitude, latitude)`.
