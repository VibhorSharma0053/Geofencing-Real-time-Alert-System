-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Geofences
CREATE TABLE IF NOT EXISTS geofences (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL CHECK (category IN ('delivery_zone', 'restricted_zone', 'toll_zone', 'customer_area')),
    coordinates JSONB NOT NULL,
    boundary geometry(Polygon, 4326) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofences_boundary ON geofences USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_geofences_category ON geofences (category);

-- 2. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    vehicle_number TEXT NOT NULL UNIQUE,
    driver_name TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Vehicle Locations
CREATE TABLE IF NOT EXISTS vehicle_locations (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_locations_vehicle_recorded ON vehicle_locations (vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_geom ON vehicle_locations USING GIST (geom);

-- 4. Vehicle Geofence State (current containment per vehicle)
CREATE TABLE IF NOT EXISTS vehicle_geofence_state (
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    geofence_id TEXT NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (vehicle_id, geofence_id)
);

-- 5. Alert Rules
CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY,
    geofence_id TEXT NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    vehicle_id TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('entry', 'exit', 'both')),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_rules_unique ON alert_rules (geofence_id, COALESCE(vehicle_id, ''), event_type);

-- 6. Violation Events (All historical entry/exit events)
CREATE TABLE IF NOT EXISTS violation_events (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    geofence_id TEXT NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('entry', 'exit')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_violation_events_vehicle_id ON violation_events (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_violation_events_geofence_id ON violation_events (geofence_id);
CREATE INDEX IF NOT EXISTS idx_violation_events_timestamp ON violation_events (timestamp DESC);

-- 7. Alert Events (Alerts matched against active rules and broadcast)
CREATE TABLE IF NOT EXISTS alert_events (
    id TEXT PRIMARY KEY,
    violation_id TEXT UNIQUE NOT NULL REFERENCES violation_events(id) ON DELETE CASCADE,
    rule_ids TEXT[] NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_created_at ON alert_events (created_at DESC);
