# Geofencing & Real-Time Alert System

A high-performance full-stack geofencing and real-time fleet monitoring system built with Go, PostgreSQL/PostGIS, WebSockets, and React Leaflet. The platform tracks vehicle locations, evaluates spatial containment against polygonal geofences using PostGIS spatial indexing (`ST_Covers`), detects boundary transitions (entry and exit events), persists audit violation histories, and asynchronously broadcasts targeted alert events to connected operator clients in real time.

---

## Deployment & Demonstration Links

- **Walkthrough Video:** `[Pending - Video URL placeholder]`
- **Live Frontend App:** `[Pending - Frontend URL placeholder]`
- **Live Backend API:** `[Pending - Backend API URL placeholder]`
- **Docker Hub Images:**
  - Backend: `[Pending - docker.io/username/geofence-backend:latest placeholder]`
  - Frontend: `[Pending - docker.io/username/geofence-frontend:latest placeholder]`

---

## Project Status Checklist

- [x] **Phase 0: Repository Skeleton & Architecture Specification**
- [x] **Phase 1: Database Schema & PostGIS Migrations (pgxpool + golang-migrate)**
- [ ] **Phase 2: Domain Models & Storage Layer Implementation**
- [ ] **Phase 3: Core Geofencing Engine & Event Detection Logic**
- [ ] **Phase 4: REST API Endpoints (Geofences, Vehicles, Locations, Alerts, Violations)**
- [ ] **Phase 5: WebSocket Real-Time Alert Broadcast Hub**
- [ ] **Phase 6: Frontend Setup & Shell Architecture (Vite + React + Tailwind CSS)**
- [ ] **Phase 7: Interactive Geofence Editor & Map Canvas (Leaflet + Geoman)**
- [ ] **Phase 8: Real-Time Fleet Tracking & Alert Dashboard**
- [ ] **Phase 9: End-to-End Testing, Spatial Edge Cases & Load Validation**
- [ ] **Phase 10: Docker Compose Containerization, Production Hardening & Final Documentation**

---

## Architecture Overview

- **Backend:** Go 1.22+ (`net/http` ServeMux routing), `pgx/v5`, PostgreSQL 16 + PostGIS 3.4 (`postgis/postgis:16-3.4`), `gorilla/websocket`, `log/slog`.
- **Frontend:** React 18 (Vite), Tailwind CSS, `react-router-dom`, `react-leaflet` v4 + Leaflet, `@geoman-io/leaflet-geoman-free`, `react-hot-toast`.
- **Spatial Engine:** PostGIS `ST_Covers` with GiST spatial indexing for low-latency boundary and containment calculations.
