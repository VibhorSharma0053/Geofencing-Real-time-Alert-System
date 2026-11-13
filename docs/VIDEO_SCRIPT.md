# Video Demonstration & Technical Walkthrough Script

A minute-by-minute presentation plan for a **35 to 45-minute comprehensive video demonstration and engineering deep dive** of the Geofencing & Real-Time Alert System.

---

## Part A: Executive Overview & Live Application Demo (12 Minutes)
**Target Timestamp: 00:00 – 12:00**

### 00:00 – 02:00 | Introduction & Architectural Vision
- **Visual**: Title slide with project name, system architecture diagram, and tech stack badges.
- **Talking Points**:
  - Welcome and brief introduction.
  - The business problem: Fleet logistics companies require real-time visibility into vehicle location, automatic detection when delivery trucks enter or exit restricted perimeters, and zero-latency notification of security or policy violations.
  - High-level architecture: High-performance Go 1.22+ backend, PostgreSQL 16 with PostGIS 3.4 spatial indexing, bi-directional WebSocket hub, and React 18 frontend with Leaflet & Geoman.
  - Global performance guarantee: Every JSON response incorporates deterministic `"time_ns"` handler execution timing.

---

### 02:00 – 04:30 | Geofences Creation & Spatial Boundaries (`/geofences`)
- **Visual**: Browser on `http://localhost:5173/geofences`.
- **Actions & Talking Points**:
  - Show the responsive split-screen layout (Geofences list on the left, Leaflet map canvas on the right).
  - **Drawing on Map**: Click *"Create Geofence"*, enter name `"Downtown Delivery Hub"`, select `"delivery_zone"`. Click *"Start Drawing on Map"*. Place 4 vertices over downtown San Francisco and double-click to close. Explain that the Geoman handler auto-closes the polygon ring and converts coordinates to `[[lat, lng], ...]`.
  - **Manual Entry Tab**: Switch to *"Enter coordinates"* tab. Demonstrate pasting line-by-line coordinates. Intentionally leave off the closing vertex and click *"Auto-Close Polygon Ring"* to demonstrate intelligent client-side validation.
  - Submit the form and verify the instant toast notification.
  - Click through the category filter chips (*All*, *Delivery*, *Restricted*, *Toll*, *Customer*) to show map bounds auto-fitting and smooth zooming.

---

### 04:30 – 06:30 | Fleet Vehicle Registration & Telemetry Roster (`/vehicles`)
- **Visual**: Navigate to `/vehicles`.
- **Actions & Talking Points**:
  - Register a new truck: `SF-TRK-901`, driver `"Jordan Vance"`, type `"truck"`, phone `"+1 415-555-0144"`.
  - Submit and observe instant inclusion in the fleet roster.
  - **Conflict Handling**: Immediately attempt to register `sf-trk-901` again. Demonstrate how the backend responds with HTTP 409 Conflict, and the frontend displays a dedicated inline warning: *"Vehicle number is already registered"*.
  - Explain the parallel telemetry loading (`Promise.allSettled` across `GET /vehicles/location/{id}`) which displays live zone occupancy chips (*"Outside all geofences"* or active category badges).

---

### 06:30 – 08:30 | Alert Rules Configuration (`/alerts`)
- **Visual**: Navigate to `/alerts`.
- **Actions & Talking Points**:
  - Explain rule configuration semantics: Alert rules bind a geofence to either a specific vehicle OR all vehicles (*Wildcard*), triggering on `entry`, `exit`, or `both`.
  - Configure Rule 1: Select the Civic Center `restricted_zone`, leave vehicle as *"All vehicles"*, and select event type `"both"`.
  - Configure Rule 2: Select the Bay Bridge `toll_zone`, select `SF-TRK-901`, and select event type `"entry"`.
  - Highlight the table showing active rules and demonstrate the inline deletion confirmation modal.

---

### 08:30 – 10:30 | Main Live Tracking Dashboard (`/` or `/map`)
- **Visual**: Navigate to `/` (Live Map Dashboard).
- **Actions & Talking Points**:
  - Show the unified operational view: Full-screen Leaflet canvas with polygons on the left, dual control panel (Update Location / Simulate Movement) and embedded Real-Time Alerts Feed on the right.
  - **Click-to-Set Telemetry**: Click a location on the map just outside the restricted zone. Show that latitude and longitude inputs populate immediately (`pickedPoint` marker drops).
  - Click *"Transmit Location Ping"*. Show the `ResultCard` indicating *"Spatial Containment: Outside all geofences"* with latency in milliseconds.
  - **Movement Simulator**: Switch tab to *"Simulate Movement"*. Select `SF-TRK-901` and click *"Drive Through Zone"*.
  - Explain that the simulator sequentially interpolates 8 waypoints every 1.5 seconds across the restricted perimeter with strictly increasing timestamps.

---

### 10:30 – 12:00 | Real-Time WebSocket Alerts & Violation History (`/violations`)
- **Visual**: Watch the simulator progress while observing the Alerts Feed and Map.
- **Actions & Talking Points**:
  - **Visual Alert**: As the vehicle crosses into the Civic Center restricted zone, point out:
    1. Real-time toast notification pops up in top-right corner.
    2. Incoming card appears in the Live Alerts Feed with timestamp and driver name.
    3. The vehicle marker on the map turns into an **animated, pulsing red marker** indicating an unauthorized restricted-zone occupant.
  - Click the incoming alert card to demonstrate smooth map panning directly to the event coordinates.
  - Navigate to `/violations`: Show the immutable audit trail of all boundary crossings.
  - Filter by vehicle and date range. Demonstrate server-side pagination with URL query string persistence.
  - Click *"Export CSV"* and open the downloaded spreadsheet file.

---

## Part B: Codebase Implementation Deep Dive (18 Minutes)
**Target Timestamp: 12:00 – 30:00**

### 12:00 – 14:00 | Project Architecture & Layered Decoupling
- **Files to Open**:
  - `backend/cmd/server/main.go`
  - `backend/internal/api/routes.go`
  - `backend/internal/httpx/response.go`
- **Talking Points**:
  - Monorepo layout: Go backend in `/backend`, React SPA in `/frontend`, operational scripts in `/scripts`.
  - In `main.go`, highlight dependency injection: store $\rightarrow$ service $\rightarrow$ handler $\rightarrow$ router.
  - In `routes.go`, show Go 1.22+ method+path routing patterns (`POST /vehicles/location`, `GET /vehicles/location/{vehicle_id}`).
  - In `response.go`, show `writeJSON`: Explain how every single handler tracks `start := time.Now()` and outputs `"time_ns": strconv.FormatInt(time.Since(start).Nanoseconds(), 10)` to fulfill the core assessment requirement.

---

### 14:00 – 16:30 | Spatial Containment Engine & PostGIS `ST_Covers`
- **Files to Open**:
  - `backend/internal/location/store.go`
  - `backend/migrations/000001_init_schema.up.sql`
- **Talking Points**:
  - Point to the spatial SQL query in `FindCoveringGeofences`:
    ```sql
    SELECT geofence_id, name, category, description, created_at
    FROM geofences
    WHERE status = 'active'
      AND ST_Covers(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography);
    ```
  - **The Lat/Lng Swap Trap**: Emphasize that API coordinates are `[latitude, longitude]`, but PostGIS requires `ST_MakePoint(longitude, latitude)`. Explain how the store carefully unpacks `$1 = lon, $2 = lat`.
  - **Why `ST_Covers` over `ST_Contains`**: `ST_Contains` excludes boundary coordinates; `ST_Covers` includes vertices and perimeter edges, ensuring boundary-riding vehicles are not erroneously dropped.
  - Show the GiST spatial index on `geography(Polygon, 4326)` providing $O(\log N)$ spatial indexing.

---

### 16:30 – 19:00 | Concurrency Control & Pure State Diffing
- **Files to Open**:
  - `backend/internal/location/service.go`
  - `backend/internal/location/diff.go`
  - `backend/internal/location/diff_test.go`
- **Talking Points**:
  - Walk through `UpdateLocation`:
    1. Transaction begins.
    2. Acquires row lock: `SELECT ... FROM vehicle_locations WHERE vehicle_id = $1 FOR UPDATE`. This guarantees that rapid concurrent location transmissions for the same truck are serialized without race conditions.
    3. Reads previous geofence set.
    4. Evaluates `FindCoveringGeofences` to get current geofence set.
    5. Calls `DiffGeofences(prev, curr)`: Show the pure Go function. Explain how it compares ID sets:
       - In `curr` but not in `prev` $\rightarrow$ `entry` event.
       - In `prev` but not in `curr` $\rightarrow$ `exit` event.
    6. **First Location Edge Case**: If `prev` is empty, entering a zone triggers an immediate `entry` event.
    7. **Out-of-Order Timestamp Protection**: Show the check ensuring older timestamps don't overwrite newer spatial state.

---

### 19:00 – 21:30 | Asynchronous Alert Dispatcher & Non-Blocking Pipeline
- **Files to Open**:
  - `backend/internal/alert/dispatcher.go`
  - `backend/internal/alert/store.go`
- **Talking Points**:
  - Show how `location.Service` accepts an `EventNotifier` interface.
  - Open `dispatcher.go`: Explain that when events occur, `dispatcher.Dispatch(...)` is executed in an **asynchronous goroutine** (`go d.processEvents(...)`).
  - Emphasize: Telemetry ingestion must be lightning-fast ($<5$ ms). The HTTP response returns immediately to the GPS tracker; alert rule evaluation and WebSocket broadcasting happen in the background.
  - Walk through rule matching: Checks active rules matching `geofence_id` and (`vehicle_id` OR wildcard `NULL`), and checks whether `event_type` matches (`both` or exact `entry`/`exit`).
  - Persists to `alert_events` and broadcasts to the WebSocket hub.

---

### 21:30 – 24:00 | Gorilla WebSocket Hub & Resilient Connection Lifecycle
- **Files to Open**:
  - `backend/internal/ws/hub.go`
  - `backend/internal/ws/client.go`
- **Talking Points**:
  - Open `hub.go`: Show the non-blocking broadcast loop with mutex-protected client map.
  - Open `client.go`:
    - **Read Pump**: Listens for client disconnects and sets read deadlines.
    - **Write Pump & Heartbeat**: Shows ticker sending `websocket.PingMessage` every 30 seconds. Read deadline is 60 seconds. Explain why this is critical for cloud proxies (AWS ALB, Cloudflare, Render) which drop idle TCP connections after 60 seconds.
    - **Slow-Client Protection**: Each client has a buffered channel of 256 messages. If a slow client stalls and buffer fills, the client is cleanly disconnected and closed to prevent memory leaks.

---

### 24:00 – 26:30 | Hardened Middleware Chain & Resilience
- **Files to Open**:
  - `backend/internal/middleware/recovery.go`
  - `backend/internal/middleware/ratelimit.go`
  - `backend/internal/middleware/auth.go`
  - `backend/internal/middleware/cors.go`
- **Talking Points**:
  - Show the execution order in `main.go`:
    `Recovery -> RequestID -> Logger -> CORS -> Auth -> RateLimit -> Router`.
  - **Recovery**: Traps panics and guarantees an HTTP 500 JSON response with `"time_ns"`.
  - **Rate Limiting**: Token-bucket algorithm (`x/time/rate`) per client IP applied specifically to `POST /vehicles/location` (50 RPS, burst 100).
  - **Auth**: Constant-time comparison (`subtle.ConstantTimeCompare`) for optional `X-API-Key`. Bypasses `/health` and `OPTIONS`.

---

### 26:30 – 30:00 | Frontend Architecture & Real-Time React Patterns
- **Files to Open**:
  - `frontend/src/hooks/useAlertsSocket.js`
  - `frontend/src/context/AlertsContext.jsx`
  - `frontend/src/components/MapView.jsx`
- **Talking Points**:
  - Open `useAlertsSocket.js`: Explain exponential backoff reconnection (1s to 30s max), cleanup on unmount, and React 18 `StrictMode` double-mount protection using `isMounted` ref.
  - Open `AlertsContext.jsx`: Maintains rolling buffer of latest 100 alerts, deduplicates by `event_id`, updates unread badge counter, and triggers `react-hot-toast`.
  - Open `MapView.jsx`: Explain how `@geoman-io/leaflet-geoman-free` attaches to the Leaflet map instance, captures custom DivIcons, and conditionally renders **pulsing red icons** for restricted zone occupants.

---

## Part C: Architectural Gaps, Production Hardening & Future Roadmap (15 Minutes)
**Target Timestamp: 30:00 – 45:00**

Provide an honest, expert engineering critique of the system with concrete implementation strategies and realistic engineering estimates:

---

### 30:00 – 32:30 | 1. Horizontal WebSocket Scaling with Redis Pub/Sub
- **Current Limitation**: The WebSocket hub is an in-memory Go struct. If we run multiple backend container replicas behind a load balancer, clients connected to Instance A won't receive alerts dispatched by Instance B.
- **Production Solution**:
  - Integrate Redis Pub/Sub or Dragonfly as a distributed message broker.
  - When an alert event is dispatched, publish to channel `fleet:alerts`.
  - Each backend instance subscribes to `fleet:alerts` on startup and forwards messages to its local WebSocket clients.
- **Estimated Engineering Effort**: 4 – 6 hours.

---

### 32:30 – 35:00 | 2. In-Memory Spatial Caching (R-Tree / Google S2)
- **Current Limitation**: Every single vehicle location ping executes `ST_Covers` against PostGIS. For fleets of 50,000+ trucks sending pings every 5 seconds (10,000 requests/sec), database CPU will saturate.
- **Production Solution**:
  - Maintain an in-memory spatial index (e.g., using `tidwall/rtree` or Go bindings for Google S2 geometry) inside the service layer.
  - Cache active geofence geometries in memory.
  - Evaluate spatial containment in Go RAM in under $10\ \mu\text{s}$, using PostGIS strictly for persistent auditing and fallback.
  - Invalidate in-memory polygons via database change data capture (CDC) or Redis pub/sub.
- **Estimated Engineering Effort**: 8 – 12 hours.

---

### 35:00 – 37:30 | 3. High-Throughput Batch Ingestion & Streaming (Kafka)
- **Current Limitation**: Telemetry arrives via synchronous HTTP `POST /vehicles/location`.
- **Production Solution**:
  - Introduce Apache Kafka, AWS Kinesis, or NATS JetStream as a streaming buffer.
  - Edge IoT devices stream telemetry to an ingestion proxy which batches pings into Kafka topic `telemetry.raw`.
  - Go worker consumer groups process batches in parallel, performing bulk inserts into PostgreSQL using `pgx.CopyFrom`.
- **Estimated Engineering Effort**: 12 – 16 hours.

---

### 37:30 – 39:30 | 4. TimescaleDB / Table Partitioning for Location Audits
- **Current Limitation**: `vehicle_locations` only stores the latest point, and `violation_events` grows linearly without partitioning.
- **Production Solution**:
  - Implement PostgreSQL declarative table partitioning by range (`timestamp`) on monthly boundaries.
  - Alternatively, convert history tables to **TimescaleDB hypertables** with automated compression and data retention policies (e.g., drop raw points older than 90 days, retain hourly rollups).
- **Estimated Engineering Effort**: 4 – 6 hours.

---

### 39:30 – 42:00 | 5. Advanced Alerting Policies (Dwell Time & Speed Limits)
- **Current Limitation**: Only instantaneous boundary entry and exit transitions are evaluated.
- **Production Solution**:
  - **Dwell Time Violation**: Trigger alerts only if a vehicle remains inside a customer area for $>30$ minutes or inside a restricted zone for $>2$ minutes.
  - **Corridor / Route Deviation**: Evaluate proximity to polyline delivery routes using `ST_DWithin`.
  - **Notification Channels**: Webhook dispatch, SMS via Twilio, and push notifications via Firebase Cloud Messaging (FCM).
- **Estimated Engineering Effort**: 10 – 14 hours.

---

### 42:00 – 45:00 | 6. Observability, Multi-Tenancy & Conclusion
- **Observability**: Add OpenTelemetry distributed tracing spans across HTTP $\rightarrow$ Service $\rightarrow$ PostGIS, and export Prometheus metrics (`http_request_duration_seconds`, `websocket_connected_clients`, `spatial_diff_duration_seconds`).
- **Multi-Tenancy**: Add `organization_id` column with PostgreSQL Row-Level Security (RLS) to support multi-tenant fleet isolation.
- **Closing Remarks**: Summary of achievements, adherence to all MapUp assessment criteria, clean production containerization, and final sign-off.
