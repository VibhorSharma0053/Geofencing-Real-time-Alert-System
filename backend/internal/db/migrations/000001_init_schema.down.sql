-- Drop tables in reverse order of creation
DROP TABLE IF EXISTS alert_events CASCADE;
DROP TABLE IF EXISTS violation_events CASCADE;
DROP TABLE IF EXISTS alert_rules CASCADE;
DROP TABLE IF EXISTS vehicle_geofence_state CASCADE;
DROP TABLE IF EXISTS vehicle_locations CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS geofences CASCADE;

-- Drop PostGIS extension
DROP EXTENSION IF EXISTS postgis;
