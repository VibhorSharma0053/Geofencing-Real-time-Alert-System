# Comprehensive Quality Assurance (QA) Checklist

Interactive checklist for validating all backend endpoints, WebSocket streams, spatial edge cases, frontend views, and containerized deployments for the **Geofencing & Real-Time Alert System**.

---

## 1. REST API Endpoints & Response Contracts

### Global Response Contract
- [ ] **`time_ns` String Verification**: EVERY JSON response (200, 201, 400, 404, 409, 429, 500) contains `"time_ns"` as a non-empty string of nanoseconds.
- [ ] **Prefix ID Formatting**:
  - Geofences: `geo_[0-9a-f]{12}`
  - Vehicles: `veh_[0-9a-f]{12}`
  - Alert Rules: `alert_[0-9a-f]{12}`
  - Violations: `viol_[0-9a-f]{12}`
  - Events: `evt_[0-9a-f]{12}`
- [ ] **Standard Error Envelope**: Failed requests return `{"error": "message", "time_ns": "..."}` with correct HTTP status codes.

---

### Endpoint Verification Matrix

#### 1. `GET /health`
- [ ] Returns HTTP `200 OK` with `{"status": "ok", "db": "ok", "ws_clients": <int>, "time_ns": "..."}`.
- [ ] Returns HTTP `200 OK` even when `API_KEY` is configured (bypasses auth).
- [ ] If DB is down, reports `db: "down"` without server crash.

#### 2. `POST /geofences`
- [ ] **Success**: Valid closed polygon ring ($\ge 4$ points, first == last) returns `201 Created` with `geofence_id` and `coordinates`.
- [ ] **Validation - Open Ring**: Coordinates where first $\neq$ last returns `400 Bad Request`.
- [ ] **Validation - Too Few Points**: Ring with $<4$ points returns `400 Bad Request`.
- [ ] **Validation - Coordinate Range**: Latitude outside $[-90, 90]$ or Longitude outside $[-180, 180]$ returns `400 Bad Request`.
- [ ] **Validation - Invalid Category**: Category not in `[delivery_zone, restricted_zone, toll_zone, customer_area]` returns `400 Bad Request`.
- [ ] **Validation - Missing Name**: Blank or missing name returns `400 Bad Request`.

#### 3. `GET /geofences`
- [ ] **All Geofences**: Returns array of all active geofences.
- [ ] **Category Filter**: `?category=restricted_zone` returns only matching category items.
- [ ] **Empty Result**: Returns `{"geofences": [], "time_ns": "..."}` when no records match filter.

#### 4. `POST /vehicles`
- [ ] **Success**: Valid `vehicle_number`, `driver_name`, `vehicle_type`, `phone` returns `201 Created` with `vehicle_id`.
- [ ] **Validation - Missing Number**: Omitted `vehicle_number` returns `400 Bad Request`.
- [ ] **Conflict - Duplicate Plate**: Registering an identical vehicle plate (case-insensitive e.g. `trk-101` vs `TRK-101`) returns `409 Conflict` with `{"error": "vehicle already exists", "time_ns": "..."}`.

#### 5. `GET /vehicles`
- [ ] Returns array of all active fleet vehicles with status `active`.

#### 6. `POST /alerts/configure`
- [ ] **Success - Specific Vehicle**: Valid `geofence_id`, `vehicle_id`, `event_type` (`entry`, `exit`, `both`) returns `201 Created`.
- [ ] **Success - Wildcard Vehicle**: Omitting `vehicle_id` creates a wildcard rule applying to all vehicles.
- [ ] **Validation - Invalid Geofence**: Non-existent `geofence_id` returns `404 Not Found`.
- [ ] **Validation - Invalid Vehicle**: Non-existent `vehicle_id` returns `404 Not Found`.
- [ ] **Validation - Invalid Event Type**: Event type other than `entry`, `exit`, `both` returns `400 Bad Request`.
- [ ] **Conflict - Duplicate Rule**: Re-configuring identical `(geofence_id, vehicle_id, event_type)` returns `409 Conflict`.

#### 7. `GET /alerts`
- [ ] **List**: Returns all configured rules.
- [ ] **Filter by Geofence**: `?geofence_id=geo_...` filters by target geofence.
- [ ] **Filter by Vehicle**: `?vehicle_id=veh_...` filters by target vehicle.

#### 8. `DELETE /alerts/{alert_id}`
- [ ] **Success**: Deleting an existing alert rule returns `200 OK` with `{"alert_id": "...", "status": "deleted", "time_ns": "..."}`.
- [ ] **Not Found**: Deleting non-existent `alert_id` returns `404 Not Found`.

#### 9. `POST /vehicles/location`
- [ ] **Success - Inside Zone**: Coordinates inside a geofence return `200 OK` with `current_geofences` populated.
- [ ] **Success - Outside Zone**: Coordinates outside all zones return `200 OK` with `current_geofences: []`.
- [ ] **Asynchronous Broadcast**: Location update returns immediately in $<10$ ms without waiting for WebSocket transmissions.
- [ ] **Validation - Non-existent Vehicle**: Unknown `vehicle_id` returns `404 Not Found`.
- [ ] **Validation - Invalid ISO Timestamp**: Malformed timestamp returns `400 Bad Request`.

#### 10. `GET /vehicles/location/{vehicle_id}`
- [ ] **Success**: Returns current coordinates, timestamp, and active geofences.
- [ ] **Not Found**: Vehicle without reported location pings returns `404 Not Found`.

#### 11. `GET /violations/history`
- [ ] **Success**: Returns recorded entry and exit violation events.
- [ ] **Pagination**: `?limit=25&offset=25` returns the second page and includes `"total_count": <int>`.
- [ ] **Filters**: `?vehicle_id=...&geofence_id=...&start_time=...&end_time=...` correctly limits historical scope.

---

## 2. Real-Time WebSocket Alerts (`GET /ws/alerts`)

- [ ] **Connection Handshake**: Returns HTTP `101 Switching Protocols` and maintains socket.
- [ ] **Message Shape**: Pushed alert event matches the required schema verbatim:
  ```json
  {
    "event_id": "evt_...",
    "event_type": "entry",
    "timestamp": "2026-11-13T12:00:00Z",
    "vehicle": {
      "vehicle_id": "veh_...",
      "vehicle_number": "TRK-101",
      "driver_name": "Marcus Kane"
    },
    "geofence": {
      "geofence_id": "geo_...",
      "geofence_name": "Downtown Delivery Hub",
      "category": "delivery_zone"
    },
    "location": {
      "latitude": 37.7780,
      "longitude": -122.4140
    }
  }
  ```
- [ ] **Heartbeat Keep-Alive**: Server dispatches `PingMessage` frames every 30 seconds to prevent reverse proxy idle disconnections.
- [ ] **Slow-Client Protection**: Stalled client buffer exhaustion triggers clean disconnection without blocking the hub.
- [ ] **Client Auto-Reconnect**: Frontend WebSocket client reconnects automatically with exponential backoff (1s–30s) upon server restart.

---

## 3. Spatial & Business Logic Edge Cases

- [ ] **Boundary Coordinates (`ST_Covers`)**: Coordinates situated exactly on a geofence's perimeter road are evaluated as `inside`.
- [ ] **First Location Ping as Entry**: When an uninitialized vehicle sends its first ping inside a geofence, an `entry` event is detected and broadcast immediately.
- [ ] **Out-of-Order Timestamps**: A ping with a historical timestamp older than the vehicle's last recorded timestamp does not overwrite the vehicle's latest state.
- [ ] **Overlapping Geofences**: A vehicle inside two overlapping zones receives simultaneous entries, exits, or mixed states independently.
- [ ] **Concurrent Vehicle Updates**: Rapid concurrent location transmissions for the same vehicle are serialized safely using `SELECT ... FOR UPDATE` row locking.

---

## 4. Frontend Application & User Experience

### Navigation & Layout
- [ ] Responsive navigation bar displays brand icon, route links, WebSocket connection badge, and real-time alert bell.
- [ ] Slide-out live alerts panel opens on bell click and shows unread badge counter.
- [ ] Mobile viewport renders clean collapsible menu drawer.

### Live Tracking Map (`/` and `/map`)
- [ ] **Leaflet Canvas**: Displays all active geofences (color-coded) and fleet vehicles.
- [ ] **Restricted Zone Occupants**: Vehicles currently inside a `restricted_zone` render as **pulsing red vehicle markers**.
- [ ] **Click-to-Set Coordinates**: Clicking anywhere on the canvas drops a pin (`pickedPoint`) and synchronizes latitude/longitude into the update form.
- [ ] **Update Form**: Bi-directional typing moves the pin on the map. Transmitting a ping shows the containment result card.
- [ ] **Movement Simulator**: Clicking *"Drive Through Zone"* moves the vehicle step-by-step along an interpolated path, triggering real-time alerts.
- [ ] **Live Feed**: Clicking an incoming alert card smoothly pans the map canvas directly to its coordinate location.

### Geofences Management (`/geofences`)
- [ ] **Geoman Drawing Canvas**: *"Start Drawing on Map"* enables Leaflet Geoman polygon sketching. Double-clicking closes the ring and converts to `[[lat, lng], ...]`.
- [ ] **Manual Coordinate Entry**: Accepts JSON and line-by-line format. Auto-close button repairs unclosed rings.
- [ ] **Category Filtering**: Filter chips (*All*, *Delivery*, *Restricted*, *Toll*, *Customer*) update the list and map highlighting.

### Vehicles Management (`/vehicles`)
- [ ] **Registration**: Validates plate, driver, type, and phone. Shows clear error on duplicate plate conflict.
- [ ] **Roster & Telemetry**: Fetches latest positions in parallel via `Promise.allSettled`. Displays zone containment chips or *"Outside all geofences"*.

### Alert Rules (`/alerts`)
- [ ] Form supports specific vehicle or wildcard (*All vehicles*).
- [ ] Table displays configured rules with inline deletion confirmation modal.
- [ ] Embedded live feed allows operators to monitor alerts alongside configuration.

### Violations History (`/violations`)
- [ ] Filters by vehicle, geofence, and datetime range.
- [ ] Filters persist in URL search parameters (`?vehicle_id=...&offset=...`).
- [ ] Server-driven pagination controls (Previous / Next / Page Indicator).
- [ ] *"Export CSV"* generates and downloads a `.csv` file of filtered events.

---

## 5. Deployment & Containerization

- [ ] **Local Docker Compose**: `docker compose up --build` boots PostGIS, Backend, and Frontend without errors.
- [ ] **Database Health Check**: `backend` container waits until `db` passes `pg_isready` before starting migrations.
- [ ] **Clean Reset**: `docker compose down -v` completely removes containers and database volumes.
- [ ] **Backend Multi-Stage Build**: Resulting binary runs in minimal Alpine image as non-root `appuser`.
- [ ] **Frontend Static Nginx**: Multi-stage build compiles with Vite and serves through Nginx with SPA routing fallback (`try_files $uri $uri/ /index.html;`).
- [ ] **Cloud Production Handshake**: Deployed frontend (Vercel) communicates with deployed backend (Render) using HTTPS and WSS with zero mixed-content or CORS errors.
