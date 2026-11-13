# Deployment & Production Operations Guide

This guide provides end-to-end instructions for containerizing, provisioning, and deploying the **Geofencing & Real-Time Alert System** to cloud environments.

---

## Architecture Overview

```
                      ┌───────────────────────────────────────────────┐
                      │              Client Web Browser               │
                      │   React 18 SPA (Vercel / Netlify / CDN)      │
                      └──────────────┬─────────────────▲──────────────┘
                                     │                 │
                HTTPS REST API       │                 │  WSS WebSocket
             (Payloads + time_ns)    │                 │  (Real-Time Alerts)
                                     ▼                 │
                      ┌────────────────────────────────┴──────────────┐
                      │          Backend Web Service (Render)         │
                      │       Go 1.22+ Binary (Docker Container)       │
                      │  - ServeMux Router     - WebSocket Hub        │
                      │  - PostGIS Spatial Diff - Alert Dispatcher     │
                      └──────────────────────┬────────────────────────┘
                                             │
                                             │ PostgreSQL Wire Protocol
                                             │ (pgxpool + SSL Mode Require)
                                             ▼
                      ┌───────────────────────────────────────────────┐
                      │           Managed PostGIS Database            │
                      │       (Neon Serverless / Supabase PG16)       │
                      │  - ST_Covers Spatial Indexing                 │
                      │  - Embedded golang-migrate Schema             │
                      └───────────────────────────────────────────────┘
```

---

## 1. Local Full-Stack Deployment (Docker Compose)

The entire full-stack application (PostGIS, Go backend, and Nginx frontend) runs locally via Docker Compose.

### Start the Full Stack
```bash
docker compose up --build
```
This single command executes the following flow:
1. Provisions PostGIS 16-3.4 and runs health checks via `pg_isready`.
2. Compiles the Go 1.22 backend into a stripped static binary, applies embedded SQL migrations, and starts on port `8080`.
3. Compiles the React SPA using Vite, bundles it into a lightweight Nginx container, and serves it on port `5173`.

### Verify Running Services
```bash
# Check container statuses and health probes
docker compose ps

# Access points
# Frontend UI:    http://localhost:5173
# Backend API:    http://localhost:8080/health
# WebSocket:      ws://localhost:8080/ws/alerts
```

### Reset & Teardown
To stop all containers and erase the PostgreSQL volume:
```bash
docker compose down -v
```

---

## 2. Docker Image Creation & Docker Hub Publishing

### Step 2.1: Authenticate with Docker Hub
```bash
docker login
```

### Step 2.2: Standard Single-Architecture Build & Push
```bash
# Define your Docker Hub username and version
DOCKER_USER="vibhorsharma" # Replace with your Docker Hub handle
VERSION="v1.0.0"

# Build backend image
docker build -t ${DOCKER_USER}/geofence-backend:${VERSION} \
             -t ${DOCKER_USER}/geofence-backend:latest \
             ./backend

# Push images to Docker Hub
docker push ${DOCKER_USER}/geofence-backend:${VERSION}
docker push ${DOCKER_USER}/geofence-backend:latest
```

### Step 2.3: Multi-Architecture Build with Docker Buildx (AMD64 & ARM64)
For cloud platforms running Graviton/ARM or Intel/AMD servers:
```bash
# Create and activate a buildx builder instance
docker buildx create --name geofence-builder --use
docker buildx inspect --bootstrap

# Build and push multi-platform images simultaneously
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ${DOCKER_USER}/geofence-backend:${VERSION} \
  -t ${DOCKER_USER}/geofence-backend:latest \
  --push \
  ./backend
```

---

## 3. Managed PostGIS Database Provisioning

The system requires PostgreSQL 15+ with the PostGIS 3.3+ spatial extension enabled.

### Option A: Neon (Recommended Serverless Postgres)
1. Sign up at [neon.tech](https://neon.tech) and create a new project.
2. Under **Project Settings**, verify PostgreSQL version is 16.
3. Open the **SQL Editor** in the Neon console and ensure PostGIS is enabled:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   SELECT PostGIS_Full_Version();
   ```
   *(Note: Migration `000001_init_schema.up.sql` includes `CREATE EXTENSION IF NOT EXISTS postgis;`, but executing it once via console guarantees database superuser grant).*
4. Copy the pooled connection string:
   ```
   postgres://username:password@ep-cool-sample.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### Option B: Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. In the sidebar, navigate to **Database** $\rightarrow$ **Extensions**.
3. Search for `postgis` and toggle it to **Enabled**.
4. Navigate to **Project Settings** $\rightarrow$ **Database** and copy the **URI** connection string with `sslmode=require`.

---

## 4. Deploying the Backend on Render (Web Service)

### Step 4.1: Create Render Web Service
1. Log in to [render.com](https://render.com) and click **New +** $\rightarrow$ **Web Service**.
2. Select **Deploy an existing image** and specify:
   ```
   docker.io/<your-username>/geofence-backend:latest
   ```
   *(Or connect your GitHub repository with Root Directory set to `backend` and Environment set to `Docker`).*

### Step 4.2: Configure Environment Variables
Set the following environment variables in the Render dashboard:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgres://user:pass@host/db?sslmode=require` | Managed PostGIS URI |
| `PORT` | `8080` | Render assigns `$PORT`, Go server automatically listens |
| `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` | Comma-separated allowed frontend origins |
| `RATE_LIMIT_RPS` | `50` | Maximum sustained location pings/sec per client IP |
| `RATE_LIMIT_BURST` | `100` | Burst buffer before returning `429 Too Many Requests` |
| `API_KEY` | *(Optional)* | Header `X-API-Key` or WS query `?api_key=...` |

### Step 4.3: Health Check & WebSockets
- **Health Check Path**: Set to `/health`. Render probes this path before routing traffic.
- **WebSocket Support**: Render natively supports persistent HTTP/1.1 WebSocket connections. The backend's 30s heartbeat ping / 60s read deadline prevents load balancer connection drops.
- **Free-Tier Sleep**: On Render Free tier, instances spin down after 15 minutes of inactivity. Initial wake-up takes ~30-50 seconds.

---

## 5. Deploying the Frontend (Vercel & Netlify)

### Option A: Vercel Deployment
1. Import your GitHub repository into [vercel.com](https://vercel.com).
2. Configure project settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Environment Variable:
   - `VITE_API_URL`: `https://your-backend.onrender.com`
4. The included [frontend/vercel.json](file:///d:/AI%20Engineering/mapup-ai-assessment/frontend/vercel.json) handles client-side SPA routing (`/geofences`, `/vehicles`, `/alerts`, `/violations`):
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```
5. Deploy. Copy the assigned URL (e.g., `https://geofence-demo.vercel.app`).
6. **Update Backend CORS**: Return to Render and update `ALLOWED_ORIGINS` to match your Vercel URL.

### Option B: Netlify Deployment
1. Connect repository on [netlify.com](https://netlify.com).
2. Set **Base directory** to `frontend`, **Build command** to `npm run build`, and **Publish directory** to `frontend/dist`.
3. Set environment variable: `VITE_API_URL=https://your-backend.onrender.com`.
4. The included [frontend/public/_redirects](file:///d:/AI%20Engineering/mapup-ai-assessment/frontend/public/_redirects) ensures SPA fallbacks (`/* /index.html 200`).

---

## 6. Post-Deployment Smoke Test Checklist

Execute these verification commands against your live production endpoints.

### 1. Health Probe
```bash
curl -i https://your-backend.onrender.com/health
```
*Expected Status*: `200 OK`
```json
{
  "db": "ok",
  "status": "ok",
  "time_ns": "1234567",
  "ws_clients": 0
}
```

### 2. Create Geofence
```bash
curl -i -X POST https://your-backend.onrender.com/geofences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Downtown Delivery Hub",
    "category": "delivery_zone",
    "description": "Primary high-priority fulfillment perimeter",
    "coordinates": [
      [37.7749, -122.4194],
      [37.7849, -122.4194],
      [37.7849, -122.4094],
      [37.7749, -122.4094],
      [37.7749, -122.4194]
    ]
  }'
```
*Expected*: `201 Created` with `geofence_id` (prefixed with `geo_`).

### 3. Register Vehicle
```bash
curl -i -X POST https://your-backend.onrender.com/vehicles \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_number": "TRK-PROD-01",
    "driver_name": "Jordan Vance",
    "vehicle_type": "truck",
    "phone": "+1 555-019-2834"
  }'
```
*Expected*: `201 Created` with `vehicle_id` (prefixed with `veh_`).

### 4. Configure Alert Rule
```bash
curl -i -X POST https://your-backend.onrender.com/alerts/configure \
  -H "Content-Type: application/json" \
  -d '{
    "geofence_id": "<PASTE_GEOFENCE_ID>",
    "event_type": "both"
  }'
```
*Expected*: `201 Created` with `alert_id` (prefixed with `alert_`).

### 5. Test Live WebSocket Stream
In a separate terminal, connect using `wscat`:
```bash
# Install wscat globally if needed: npm install -g wscat
wscat -c wss://your-backend.onrender.com/ws/alerts
```
*Expected*: Connected. Client receives server ping heartbeats every 30 seconds.

### 6. Transmit Vehicle Location (Inside Geofence)
```bash
curl -i -X POST https://your-backend.onrender.com/vehicles/location \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "<PASTE_VEHICLE_ID>",
    "latitude": 37.7790,
    "longitude": -122.4140,
    "timestamp": "2026-11-13T14:30:00Z"
  }'
```
*Expected*:
1. HTTP Response `200 OK` showing `current_geofences` array containing the geofence.
2. In the `wscat` terminal, an instant JSON broadcast event arrives:
   ```json
   {
     "event_id": "evt_...",
     "event_type": "entry",
     "timestamp": "2026-11-13T14:30:00Z",
     "vehicle": { ... },
     "geofence": { ... }
   }
   ```

### 7. Query Violation History
```bash
curl -i "https://your-backend.onrender.com/violations/history?limit=10"
```
*Expected*: `200 OK` with JSON array of violation records and `"total_count": 1`.

---

## 7. Production Troubleshooting & Edge Cases

### Mixed Content (HTTP vs HTTPS / WS vs WSS)
- **Problem**: When the frontend is hosted on HTTPS (`https://my-app.vercel.app`), modern browsers block insecure `ws://` connections (*Blocked Mixed Active Content*).
- **Resolution**: The frontend's `api/client.js` automatically converts `https:` to `wss:`. Verify that `VITE_API_URL` begins with `https://`.

### Cross-Origin Resource Sharing (CORS)
- **Problem**: Browser console outputs `Access to fetch at ... from origin ... has been blocked by CORS policy`.
- **Resolution**:
  1. Inspect the exact origin in the browser header (`https://my-app.vercel.app` - note: no trailing slash).
  2. In your backend environment, set `ALLOWED_ORIGINS=https://my-app.vercel.app`.
  3. Preflight `OPTIONS` requests are handled automatically by `middleware.CORS` without requiring authentication.

### Database SSL Handshake (`sslmode=require`)
- **Problem**: `x509: certificate signed by unknown authority` or `server does not support SSL`.
- **Resolution**: Managed providers (Neon, Supabase) require TLS. Always ensure `?sslmode=require` is appended to `DATABASE_URL`. The backend Docker image installs `ca-certificates` in Stage 2 to validate public cloud root certificates.

### Cloudflare / Reverse Proxy Idle WebSocket Drop
- **Problem**: WebSocket connection unexpectedly closes with code 1006 after 60–100 seconds of fleet inactivity.
- **Resolution**: The backend `internal/ws/hub.go` actively sends a WebSocket `PingMessage` every 30 seconds (`pingPeriod = 30 * time.Second`). Proxies recognize this active bidirectional frame and maintain the TCP socket.

### Cold-Start Latency on Free Cloud Tiers
- **Problem**: First API request takes 40+ seconds.
- **Resolution**: Free-tier containers on Render or Fly.io go to sleep after periods of inactivity. Use an uptime monitor (e.g., UptimeRobot) targeting `GET /health` every 10 minutes to keep the container warm during demonstration windows.
