# PROJECT CONTEXT: Geofencing & Real-time Alert System

I am building a full-stack assessment project. Monorepo layout:
  /backend   -> Go API + WebSocket server
  /frontend  -> React app (Vite)
  /scripts   -> helper scripts
  docker-compose.yml, SETUP.md, README.md at the root

## Tech decisions (do not deviate)
Backend: Go 1.22+, standard net/http ServeMux (Go 1.22 method+path patterns such as
"GET /vehicles/location/{vehicle_id}"), pgx/v5 (pgxpool), PostgreSQL 16 + PostGIS 3.4
(image postgis/postgis:16-3.4), golang-migrate with embedded SQL migrations,
gorilla/websocket, log/slog for logging. Layered design: handler -> service -> store.
Frontend: Vite + React 18 (JavaScript), Tailwind CSS, react-router-dom, react-leaflet v4 + Leaflet,
@geoman-io/leaflet-geoman-free for drawing, react-hot-toast.

## Global rules
1. EVERY JSON response, success AND error, must include "time_ns" as a STRING containing
   the handler execution time in nanoseconds (measured with time.Now() at handler start
   and time.Since at the end). Use one shared helper, e.g. writeJSON(w, status, payload, start).
2. Endpoint paths, HTTP methods and field names must match the spec EXACTLY. Never rename them.
3. API coordinates are [latitude, longitude]. PostGIS uses (longitude, latitude). Convert
   carefully, since this is the most common bug.
4. IDs are a prefix + 12 random hex chars: geo_, veh_, alert_, viol_, evt_.
5. Error format: {"error": "human readable message", "time_ns": "..."}; add "details" when
   there are multiple validation errors. Status codes: 201 create, 200 ok, 400 bad input,
   404 not found, 409 conflict, 429 rate limited, 500 internal.
6. Timestamps are ISO 8601 / RFC3339 UTC.

## API CONTRACT
1. POST /geofences
   req: {name (req), description (opt), coordinates (req, [[lat,lng],...]), category (req: 
delivery_zone|restricted_zone|toll_zone|customer_area)}
   rules: first point == last point, >= 4 points, lat in [-90,90], lng in [-180,180]
   res 201: {id:"geo_x", name, status:"active", time_ns}
2. GET /geofences?category=
   res: {geofences:[{id,name,description,coordinates,category,created_at}], time_ns}
3. POST /vehicles
   req: {vehicle_number, driver_name, vehicle_type, phone} all required, vehicle_number unique (409 on 
duplicate)
   res 201: {id:"veh_x", vehicle_number, status:"active", time_ns}
4. GET /vehicles
   res: {vehicles:[{id,vehicle_number,driver_name,vehicle_type,phone,status,created_at}], time_ns}
5. POST /vehicles/location
   req: {vehicle_id, latitude, longitude, timestamp(ISO8601)} all required
   res: {vehicle_id, location_updated:true, current_geofences:[{geofence_id,geofence_name,status:
"inside"}], time_ns}
   logic: store location; find containing geofences; diff with previous state to detect entry/exit;
   save events; match alert rules; broadcast alerts ASYNCHRONOUSLY (never block the HTTP response).
6. GET /vehicles/location/{vehicle_id}
   res: {vehicle_id, vehicle_number, current_location:{latitude,longitude,timestamp},
         current_geofences:[{geofence_id,geofence_name,category}], time_ns}
7. POST /alerts/configure
   req: {geofence_id (req), vehicle_id (opt; omitted = all vehicles), event_type (req: entry|exit|both)}
   res 201: {alert_id:"alert_x", geofence_id, vehicle_id, event_type, status:"active", time_ns}
8. GET /alerts?geofence_id=&vehicle_id=
   res: {alerts:[{alert_id,geofence_id,geofence_name,vehicle_id,vehicle_number,event_type,status,
created_at}], time_ns}
9. GET /violations/history?vehicle_id=&geofence_id=&start_date=&end_date=&limit=   (default 50, max 500)
   res: {violations:[{id,vehicle_id,vehicle_number,geofence_id,geofence_name,event_type,latitude,
longitude,timestamp}], total_count, time_ns}
   (I additionally support an optional "offset" param for pagination.)
WebSocket: GET /ws/alerts. Server pushes JSON messages (exact format):
   {event_id:"evt_x", event_type:"entry"|"exit", timestamp, 
    vehicle:{vehicle_id,vehicle_number,driver_name},
    geofence:{geofence_id,geofence_name,category},
    location:{latitude,longitude}}

## Design decisions
- Every entry/exit event is ALWAYS stored in violation_events (full history).
- Only events matching an active alert rule are broadcast over WebSocket and stored in alert_events.
- Point-in-polygon uses PostGIS ST_Covers (boundary points count as inside) with a GiST index.
- Entry/exit = diff between previous stored geofence set and current geofence set.
- Code must be clean, idiomatic, with proper error handling and meaningful names.
