# Setup, Architecture & Operational Guide

Comprehensive guide for local setup, architecture rationale, API testing, frontend workflows, and edge-case handling for the **Geofencing & Real-Time Alert System**.

---

## 1. Project Overview & Architecture

The system tracks vehicle telemetry, evaluates spatial containment against polygonal geofences using PostGIS spatial indexing (`ST_Covers`), detects boundary transitions (entry and exit events), persists historical audit records, and broadcasts alerts asynchronously over WebSockets to connected operators in real time.

```mermaid
flowchart TD
    subgraph Client["Client Tier (Frontend)"]
        UI["React 18 SPA (Vite + Tailwind)"]
        Map["Leaflet + Geoman Map Canvas"]
        WSClient["WebSocket Alert Listener (Reconnecting)"]
    end

    subgraph Server["Application Tier (Go 1.22+)"]
        Router["net/http ServeMux (Go 1.22 Method+Path Routing)"]
        MW["Middleware Chain (Recovery, RequestID, Logger, CORS, Auth, RateLimiter)"]
        
        subgraph Layers["Layered Architecture"]
            Handler["HTTP Handlers (time_ns tracking)"]
            Service["Domain Services (Containment Diff Engine)"]
            Store["PostgreSQL / PostGIS Storage (pgxpool)"]
        end
        
        WSHub["Gorilla WebSocket Hub (Heartbeat + Broadcast)"]
        Dispatcher["Alert Dispatcher (Async Notification Engine)"]
    end

    subgraph Database["Data Tier (PostgreSQL 16 + PostGIS 3.4)"]
        PG[("PostgreSQL 16 + PostGIS")]
        GeomIndex["GiST Spatial Index on geography(Polygon, 4326)"]
        Tables["Tables: geofences, vehicles, vehicle_locations, alert_rules, violation_events, alert_events"]
    end

    UI -->|"HTTP REST API (JSON + time_ns)"| Router
    Map -->|"Spatial Draw / Update Ping"| Router
    Router --> MW --> Handler --> Service --> Store --> PG
    Service -->|"Detected Entry/Exit Events"| Dispatcher
    Dispatcher -.->|"Asynchronous Goroutine"| WSHub
    WSHub -->|"WebSocket Stream (JSON)"| WSClient
    Store -.->|"ST_Covers Spatial Containment"| GeomIndex
```

### Key Architectural Tenets
1. **Layered Decoupling**: Strict `handler -> service -> store` boundaries with dependency injection across all packages (`geofence`, `vehicle`, `location`, `alert`, `violation`).
2. **Deterministic Response Timing**: Every JSON response, whether HTTP 200 or HTTP 400/500, includes `"time_ns"` as a string containing handler execution time in nanoseconds.
3. **Non-Blocking Telemetry**: Ingesting vehicle locations (`POST /vehicles/location`) persists spatial states and triggers alert evaluation, but WebSocket broadcasting is dispatched asynchronously in a non-blocking goroutine so the client HTTP response is never delayed by network I/O or slow clients.
4. **Spatial Correctness**: API endpoints accept `[latitude, longitude]`. PostGIS storage and queries convert these to `(longitude, latitude)` (`POINT(lng lat)` and `POLYGON((lng lat, ...))`).

---

## 2. Prerequisites

| Tool | Minimum Version | Required For |
|---|---|---|
| **Docker & Docker Compose** | v24.0+ / Compose v2.20+ | Recommended full-stack containerization & PostGIS |
| **Go** | 1.22+ | Backend server development & running tests |
| **Node.js & npm** | Node 20+ / npm 10+ | Frontend development and Vite production bundling |
| **Make** | GNU Make 4.0+ | Convenience development tasks |
| **curl & jq** | Any modern version | CLI testing and automation scripts |
| **wscat / websocat** | Any modern version | CLI WebSocket real-time verification |

---

## 3. Local Setup Instructions

### Option A: Complete Full Stack via Docker Compose (Recommended)
Runs PostgreSQL/PostGIS, the compiled Go backend, and the Nginx-hosted React frontend with one command:
```bash
# 1. Clone repository and navigate to root
git clone <repo-url>
cd mapup-ai-assessment

# 2. Launch full-stack environment
docker compose up --build
```
- **Frontend UI**: `http://localhost:5173`
- **Backend API**: `http://localhost:8080/health`
- **WebSocket Broadcast**: `ws://localhost:8080/ws/alerts`

To reset database state and volumes:
```bash
docker compose down -v
```

---

### Option B: Local Development Setup (Without Docker for Apps)

#### Step 1: Start PostGIS Database Container
```bash
make db-up
# Alternatively: docker compose up -d db
```
Verify the database is healthy:
```bash
docker compose ps db
```

#### Step 2: Run Backend Server
```bash
cd backend
go mod download
go run ./cmd/server
```
*The backend connects to PostgreSQL, automatically applies all embedded SQL migrations (`000001_init_schema.up.sql`), and listens on port `8080`.*

#### Step 3: Run Frontend Development Server
In a separate terminal window:
```bash
cd frontend
npm install
npm run dev
```
*The Vite development server will open at `http://localhost:5173` with hot module replacement (HMR).*

---

## 4. Environment Variables Reference

### Backend (`backend/.env` or Docker Compose Environment)
| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `8080` | HTTP listen port |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/geofence_db?sslmode=disable` | PostgreSQL PostGIS connection string |
| `TEST_DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/geofence_db?sslmode=disable` | Optional test database for PostGIS integration suite |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated CORS allowed origins, or `*` |
| `RATE_LIMIT_RPS` | `50` | Maximum sustained requests per second per IP (`POST /vehicles/location`) |
| `RATE_LIMIT_BURST` | `100` | Token bucket burst capacity before HTTP 429 is returned |
| `API_KEY` | *(Empty)* | Optional static token for `X-API-Key` or `?api_key=` authentication |

### Frontend (`frontend/.env`)
| Variable | Default Value | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | Backend REST API base URL |
| `VITE_WS_URL` | *(Derived)* | WebSocket endpoint (auto-derived from `VITE_API_URL` if empty) |
| `VITE_API_KEY` | *(Empty)* | Optional API token matching backend `API_KEY` |

---

## 5. API Testing & Specification Guide

All JSON responses (success and error) include `"time_ns"` as a string containing execution duration in nanoseconds.

### 1. `POST /geofences` - Create Geofence
#### Success (201 Created)
```bash
curl -i -X POST http://localhost:8080/geofences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Market Street Delivery Zone",
    "category": "delivery_zone",
    "description": "High-density retail delivery perimeter",
    "coordinates": [
      [37.7749, -122.4194],
      [37.7849, -122.4194],
      [37.7849, -122.4094],
      [37.7749, -122.4094],
      [37.7749, -122.4194]
    ]
  }'
```
Response:
```json
{
  "category": "delivery_zone",
  "coordinates": [[37.7749,-122.4194],[37.7849,-122.4194],[37.7849,-122.4094],[37.7749,-122.4094],[37.7749,-122.4194]],
  "created_at": "2026-11-13T09:00:00Z",
  "description": "High-density retail delivery perimeter",
  "geofence_id": "geo_a1b2c3d4e5f6",
  "name": "Market Street Delivery Zone",
  "status": "active",
  "time_ns": "2450800"
}
```
#### Common Failure (400 Bad Request - Open Polygon Ring)
```bash
curl -i -X POST http://localhost:8080/geofences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Invalid Ring",
    "category": "delivery_zone",
    "coordinates": [
      [37.7749, -122.4194],
      [37.7849, -122.4194],
      [37.7849, -122.4094]
    ]
  }'
```
Response:
```json
{
  "error": "polygon ring must be closed: first and last coordinates must match",
  "time_ns": "342100"
}
```

---

### 2. `GET /geofences` - List Geofences
#### Success (200 OK)
```bash
curl -i "http://localhost:8080/geofences?category=delivery_zone"
```
Response:
```json
{
  "geofences": [
    {
      "category": "delivery_zone",
      "coordinates": [[37.7749,-122.4194],[37.7849,-122.4194],[37.7849,-122.4094],[37.7749,-122.4094],[37.7749,-122.4194]],
      "created_at": "2026-11-13T09:00:00Z",
      "description": "High-density retail delivery perimeter",
      "geofence_id": "geo_a1b2c3d4e5f6",
      "name": "Market Street Delivery Zone",
      "status": "active"
    }
  ],
  "time_ns": "1284500"
}
```

---

### 3. `POST /vehicles` - Register Vehicle
#### Success (201 Created)
```bash
curl -i -X POST http://localhost:8080/vehicles \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_number": "SF-TRK-901",
    "driver_name": "Marcus Kane",
    "vehicle_type": "truck",
    "phone": "+1 415-555-0144"
  }'
```
Response:
```json
{
  "created_at": "2026-11-13T09:05:00Z",
  "driver_name": "Marcus Kane",
  "phone": "+1 415-555-0144",
  "status": "active",
  "time_ns": "1894200",
  "vehicle_id": "veh_b2c3d4e5f6a1",
  "vehicle_number": "SF-TRK-901",
  "vehicle_type": "truck"
}
```
#### Common Failure (409 Conflict - Duplicate Vehicle Plate)
```bash
curl -i -X POST http://localhost:8080/vehicles \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_number": "sf-trk-901",
    "driver_name": "Marcus Kane",
    "vehicle_type": "truck"
  }'
```
Response:
```json
{
  "error": "vehicle already exists",
  "time_ns": "890100"
}
```

---

### 4. `GET /vehicles` - List Vehicles
```bash
curl -i http://localhost:8080/vehicles
```

---

### 5. `POST /alerts/configure` - Configure Alert Rule
#### Success (201 Created)
```bash
curl -i -X POST http://localhost:8080/alerts/configure \
  -H "Content-Type: application/json" \
  -d '{
    "geofence_id": "geo_a1b2c3d4e5f6",
    "vehicle_id": "veh_b2c3d4e5f6a1",
    "event_type": "both"
  }'
```
Response:
```json
{
  "alert_id": "alert_c3d4e5f6a1b2",
  "created_at": "2026-11-13T09:10:00Z",
  "event_type": "both",
  "geofence_id": "geo_a1b2c3d4e5f6",
  "status": "active",
  "time_ns": "2104500",
  "vehicle_id": "veh_b2c3d4e5f6a1"
}
```

---

### 6. `POST /vehicles/location` - Transmit Location Ping
#### Success (200 OK)
```bash
curl -i -X POST http://localhost:8080/vehicles/location \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "veh_b2c3d4e5f6a1",
    "latitude": 37.7780,
    "longitude": -122.4140,
    "timestamp": "2026-11-13T09:15:00Z"
  }'
```
Response:
```json
{
  "current_geofences": [
    {
      "category": "delivery_zone",
      "created_at": "2026-11-13T09:00:00Z",
      "description": "High-density retail delivery perimeter",
      "geofence_id": "geo_a1b2c3d4e5f6",
      "name": "Market Street Delivery Zone",
      "status": "inside"
    }
  ],
  "latitude": 37.778,
  "location_updated": true,
  "longitude": -122.414,
  "time_ns": "4125800",
  "timestamp": "2026-11-13T09:15:00Z",
  "vehicle_id": "veh_b2c3d4e5f6a1"
}
```

---

### 7. `GET /vehicles/location/{vehicle_id}` - Get Current Location
```bash
curl -i http://localhost:8080/vehicles/location/veh_b2c3d4e5f6a1
```

---

### 8. `GET /violations/history` - Query Violation History
```bash
curl -i "http://localhost:8080/violations/history?vehicle_id=veh_b2c3d4e5f6a1&limit=20"
```
Response:
```json
{
  "time_ns": "1542100",
  "total_count": 1,
  "violations": [
    {
      "event_type": "entry",
      "geofence_id": "geo_a1b2c3d4e5f6",
      "geofence_name": "Market Street Delivery Zone",
      "latitude": 37.778,
      "longitude": -122.414,
      "timestamp": "2026-11-13T09:15:00Z",
      "vehicle_id": "veh_b2c3d4e5f6a1",
      "vehicle_number": "SF-TRK-901",
      "violation_id": "viol_d4e5f6a1b2c3"
    }
  ]
}
```

---

### 9. Real-Time WebSocket Alerts (`GET /ws/alerts`)
Connect with `wscat`:
```bash
wscat -c ws://localhost:8080/ws/alerts
```
When `POST /vehicles/location` triggers an alert matching an active rule, the server pushes JSON to all connected clients:
```json
{
  "event_id": "evt_e5f6a1b2c3d4",
  "event_type": "entry",
  "geofence": {
    "category": "delivery_zone",
    "geofence_id": "geo_a1b2c3d4e5f6",
    "geofence_name": "Market Street Delivery Zone"
  },
  "location": {
    "latitude": 37.778,
    "longitude": -122.414
  },
  "timestamp": "2026-11-13T09:15:00Z",
  "vehicle": {
    "driver_name": "Marcus Kane",
    "vehicle_id": "veh_b2c3d4e5f6a1",
    "vehicle_number": "SF-TRK-901"
  }
}
```

---

## 6. Frontend Usage Guide

1. **Live Map Dashboard (`/` or `/map`)**:
   - **Interactive Canvas**: Renders all geofences (color-coded) and active vehicles. **Restricted-zone occupants pulse in red**.
   - **Click-to-Set Coordinates**: Click anywhere on the map to set a target point. Coordinates automatically populate the *Update Location* form.
   - **Update Location Form**: Select a vehicle, input or click coordinates, set timestamp, and click *Transmit Location Ping*. The returned containment state renders in `ResultCard`.
   - **Movement Simulator**: Pick a vehicle and click *"Drive Through Zone"* to interpolate 8 sequential coordinates every 1.5s across a geofence. Includes an instant *Stop* button.
   - **Live Alerts Feed**: Displays real-time entries and exits. Clicking any alert pans the map canvas directly to its coordinate location.

2. **Geofences Page (`/geofences`)**:
   - **Draw Mode**: Click *"Start Drawing on Map"*, place vertices on the Leaflet canvas, and double-click or click the first vertex to close the boundary.
   - **Manual Mode**: Paste JSON coordinates `[[lat, lng], ...]` or `lat, lng` pairs per line. Auto-close button repairs unclosed rings.
   - **Category Filter**: Filter zones by *Delivery Zone*, *Restricted Zone*, *Toll Zone*, or *Customer Area*. Clicking an item zooms the map to its bounds.

3. **Vehicles Page (`/vehicles`)**:
   - Register vehicles with license plate, driver name, vehicle type, and phone number.
   - Fleet roster loads real-time telemetry in parallel via `Promise.allSettled`, showing live zone containment chips or *"Outside all geofences"*.

4. **Alert Rules Page (`/alerts`)**:
   - Configure alert triggers for specific vehicles or the entire fleet (*Wildcard*).
   - Rules table with inline deletion confirmation modal.

5. **Violations History Page (`/violations` or `/history`)**:
   - Filter by vehicle, geofence, and datetime range.
   - Server-side pagination with URL query string persistence.
   - One-click *"Export CSV"* download.

---

## 7. Database Schema & Index Rationale

Applied via `golang-migrate` (`000001_init_schema.up.sql`):

```sql
-- 1. Geofences: Stores spatial boundaries as PostGIS GEOGRAPHY polygons
CREATE TABLE geofences (
    geofence_id   VARCHAR(32) PRIMARY KEY,
    name          VARCHAR(128) NOT NULL,
    category      VARCHAR(32) NOT NULL,
    description   TEXT,
    geom          geography(Polygon, 4326) NOT NULL,
    status        VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- GiST Spatial Index: Essential for O(log N) bounding-box spatial containment queries
CREATE INDEX idx_geofences_geom ON geofences USING GIST(geom);
CREATE INDEX idx_geofences_category ON geofences(category);

-- 2. Vehicles: Registered fleet entities
CREATE TABLE vehicles (
    vehicle_id     VARCHAR(32) PRIMARY KEY,
    vehicle_number VARCHAR(64) NOT NULL,
    driver_name    VARCHAR(128),
    vehicle_type   VARCHAR(32),
    phone          VARCHAR(32),
    status         VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_vehicles_number_lower ON vehicles (LOWER(TRIM(vehicle_number)));

-- 3. Vehicle Locations: Latest known spatial point and containment snapshot
CREATE TABLE vehicle_locations (
    vehicle_id        VARCHAR(32) PRIMARY KEY REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    latitude          DOUBLE PRECISION NOT NULL,
    longitude         DOUBLE PRECISION NOT NULL,
    point             geography(Point, 4326) NOT NULL,
    current_geofences JSONB NOT NULL DEFAULT '[]'::jsonb,
    timestamp         TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_vehicle_locations_point ON vehicle_locations USING GIST(point);

-- 4. Alert Rules: Triggers linking geofences and vehicles
CREATE TABLE alert_rules (
    alert_id    VARCHAR(32) PRIMARY KEY,
    geofence_id VARCHAR(32) NOT NULL REFERENCES geofences(geofence_id) ON DELETE CASCADE,
    vehicle_id  VARCHAR(32) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    event_type  VARCHAR(32) NOT NULL,
    status      VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_alert_rules_unique ON alert_rules (geofence_id, COALESCE(vehicle_id, ''), event_type);

-- 5. Violation Events: Immutable audit log of every boundary crossing
CREATE TABLE violation_events (
    violation_id   VARCHAR(32) PRIMARY KEY,
    vehicle_id     VARCHAR(32) NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    geofence_id    VARCHAR(32) NOT NULL REFERENCES geofences(geofence_id) ON DELETE CASCADE,
    event_type     VARCHAR(32) NOT NULL,
    latitude       DOUBLE PRECISION NOT NULL,
    longitude      DOUBLE PRECISION NOT NULL,
    timestamp      TIMESTAMPTZ NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_violation_events_vehicle ON violation_events(vehicle_id);
CREATE INDEX idx_violation_events_geofence ON violation_events(geofence_id);
CREATE INDEX idx_violation_events_timestamp ON violation_events(timestamp DESC);
```

---

## 8. Design Decisions & Edge Cases Handled

1. **`ST_Covers` vs `ST_Contains` for Boundary Inclusivity**:
   `ST_Contains` excludes points that lie precisely on the polygon boundary. `ST_Covers(geofence.geom, point)` includes boundary coordinates, ensuring vehicles driving on perimeter roads are correctly recognized as inside.
2. **First Location Ping as Entry**:
   When a vehicle reports its first coordinate inside a geofence, the system evaluates the previous geofence set as empty (`[]`). The diff engine correctly emits an `entry` event immediately.
3. **Out-of-Order Timestamp Protection**:
   If an incoming telemetry ping has a timestamp older than the vehicle's currently stored location in `vehicle_locations`, the system records the historical point without overriding the latest spatial snapshot or emitting erroneous retroactive alerts.
4. **Overlapping Geofences**:
   A vehicle can occupy multiple overlapping zones simultaneously (e.g., inside both a `customer_area` and a `toll_zone`). The engine handles multi-zone diffing independently for each polygon.
5. **Concurrent Updates via Row Locks (`FOR UPDATE`)**:
   To prevent race conditions when a single vehicle sends concurrent location pings, the database update executes inside a transaction acquiring a `SELECT ... FOR UPDATE` row lock on `vehicle_locations`.
6. **Slow-Client Protection in WebSocket Hub**:
   Each WebSocket client has a buffered channel (256 messages). If a client network stalls and the buffer fills, the hub unregisters and terminates that client to prevent memory leaks or blocking other operators.
7. **Heartbeat Pings & Proxy Survival**:
   The WebSocket hub sends a `PingMessage` frame every 30 seconds, with client read deadline set to 60 seconds. This keeps connections alive across reverse proxies, Cloudflare, and AWS ALB.

---

## 9. Running Tests

### Unit Tests
Executes pure business logic tests (including geometry validation, coordinate parsing, diffing engine, and middleware):
```bash
cd backend
go test -v ./internal/geofence ./internal/location ./internal/middleware
```

### Full Integration Tests (Requires PostGIS)
Runs tests against a live PostgreSQL 16 / PostGIS instance:
```bash
# With database running:
make test
```

---

## 10. Known Limitations & Roadmap

1. **Single-Node WebSocket Hub**: The current in-memory hub runs inside a single Go process. Scaling across multiple backend replicas will require a Redis Pub/Sub backplane.
2. **Spatial Memory Caching**: Currently, every location ping evaluates `ST_Covers` against PostGIS. For fleets $>10,000$ vehicles, an in-memory R-Tree or S2 spatial cache will reduce database CPU load.
3. **Partitioning on Historical Violations**: For high-volume production deployments, `violation_events` and location audit tables should use PostgreSQL declarative table partitioning by month.
