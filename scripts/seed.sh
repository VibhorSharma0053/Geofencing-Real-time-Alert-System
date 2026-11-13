#!/usr/bin/env bash
# ==============================================================================
# scripts/seed.sh
# Populates demo geofences, fleet vehicles, and alert rules.
# Idempotent-friendly: Safe to run multiple times against local or remote environments.
# ==============================================================================

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
API_KEY="${API_KEY:-}"

AUTH_HEADER=()
if [[ -n "${API_KEY}" ]]; then
  AUTH_HEADER=(-H "X-API-Key: ${API_KEY}")
fi

echo "=========================================================="
echo "🌱 Seeding Geofencing Platform at: ${BASE_URL}"
echo "=========================================================="

# Check health before proceeding
if ! curl -s -f "${BASE_URL}/health" > /dev/null; then
  echo "❌ Error: Backend server at ${BASE_URL} is unreachable."
  echo "   Ensure backend is running (e.g., 'docker compose up' or 'make run')."
  exit 1
fi

echo "✅ Backend is healthy."
echo ""

# ------------------------------------------------------------------------------
# 1. Create Geofences (1 per category in San Francisco)
# ------------------------------------------------------------------------------
echo "📍 Creating Geofences..."

create_geofence() {
  local payload="$1"
  local name
  name=$(echo "${payload}" | jq -r '.name')

  echo -n "   - Creating '${name}'... "
  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/geofences" \
    -H "Content-Type: application/json" \
    "${AUTH_HEADER[@]}" \
    -d "${payload}")

  local body
  local code
  body=$(echo "${response}" | head -n -1)
  code=$(echo "${response}" | tail -n 1)

  if [[ "${code}" == "201" ]]; then
    local id
    id=$(echo "${body}" | jq -r '.geofence_id')
    echo "Created (${id})"
  else
    echo "Notice: HTTP ${code} (${body})"
  fi
}

# 1. Delivery Zone (Downtown SF)
create_geofence '{
  "name": "Downtown Delivery Hub",
  "category": "delivery_zone",
  "description": "High-priority retail and commercial fulfillment perimeter",
  "coordinates": [
    [37.7850, -122.4100],
    [37.7950, -122.4100],
    [37.7950, -122.3950],
    [37.7850, -122.3950],
    [37.7850, -122.4100]
  ]
}'

# 2. Restricted Zone (Civic Center Security Zone)
create_geofence '{
  "name": "Civic Center Security Perimeter",
  "category": "restricted_zone",
  "description": "Government building perimeter - strict access restriction",
  "coordinates": [
    [37.7760, -122.4220],
    [37.7830, -122.4220],
    [37.7830, -122.4140],
    [37.7760, -122.4140],
    [37.7760, -122.4220]
  ]
}'

# 3. Toll Zone (Bay Bridge Approach)
create_geofence '{
  "name": "Bay Bridge Approach Toll Zone",
  "category": "toll_zone",
  "description": "Monitored toll threshold on bridge westbound transit",
  "coordinates": [
    [37.7830, -122.3950],
    [37.7920, -122.3950],
    [37.7920, -122.3850],
    [37.7830, -122.3850],
    [37.7830, -122.3950]
  ]
}'

# 4. Customer Area (Mission Commercial District)
create_geofence '{
  "name": "Mission District Commercial Area",
  "category": "customer_area",
  "description": "Designated customer order drop-off and pickup zone",
  "coordinates": [
    [37.7550, -122.4250],
    [37.7650, -122.4250],
    [37.7650, -122.4120],
    [37.7550, -122.4120],
    [37.7550, -122.4250]
  ]
}'

echo ""

# ------------------------------------------------------------------------------
# 2. Register Fleet Vehicles (3 vehicles)
# ------------------------------------------------------------------------------
echo "🚚 Registering Fleet Vehicles..."

create_vehicle() {
  local payload="$1"
  local plate
  plate=$(echo "${payload}" | jq -r '.vehicle_number')

  echo -n "   - Registering vehicle '${plate}'... "
  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/vehicles" \
    -H "Content-Type: application/json" \
    "${AUTH_HEADER[@]}" \
    -d "${payload}")

  local body
  local code
  body=$(echo "${response}" | head -n -1)
  code=$(echo "${response}" | tail -n 1)

  if [[ "${code}" == "201" ]]; then
    local id
    id=$(echo "${body}" | jq -r '.vehicle_id')
    echo "Registered (${id})"
  elif [[ "${code}" == "409" ]]; then
    echo "Already registered (HTTP 409)"
  else
    echo "Notice: HTTP ${code} (${body})"
  fi
}

create_vehicle '{
  "vehicle_number": "SF-TRK-101",
  "driver_name": "Alex Morgan",
  "vehicle_type": "truck",
  "phone": "+1 415-555-0101"
}'

create_vehicle '{
  "vehicle_number": "SF-VAN-202",
  "driver_name": "Carlos Ruiz",
  "vehicle_type": "van",
  "phone": "+1 415-555-0102"
}'

create_vehicle '{
  "vehicle_number": "SF-CAR-303",
  "driver_name": "Sarah Chen",
  "vehicle_type": "car",
  "phone": "+1 415-555-0103"
}'

echo ""

# ------------------------------------------------------------------------------
# 3. Configure Alert Rules
# ------------------------------------------------------------------------------
echo "🔔 Configuring Alert Rules..."

# Query existing geofence IDs
GEOFENCES_JSON=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/geofences")
RESTRICTED_ID=$(echo "${GEOFENCES_JSON}" | jq -r '.geofences[] | select(.category=="restricted_zone") | .geofence_id' | head -n 1)
TOLL_ID=$(echo "${GEOFENCES_JSON}" | jq -r '.geofences[] | select(.category=="toll_zone") | .geofence_id' | head -n 1)

# Query existing vehicle IDs
VEHICLES_JSON=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/vehicles")
TRUCK_ID=$(echo "${VEHICLES_JSON}" | jq -r '.vehicles[] | select(.vehicle_number=="SF-TRK-101") | .vehicle_id' | head -n 1)

# Rule 1: Restricted zone "both" (entry & exit) for ALL vehicles (omit vehicle_id)
if [[ -n "${RESTRICTED_ID}" && "${RESTRICTED_ID}" != "null" ]]; then
  echo -n "   - Rule 1: Restricted Zone '${RESTRICTED_ID}' (both / all vehicles)... "
  RULE1_RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/alerts/configure" \
    -H "Content-Type: application/json" \
    "${AUTH_HEADER[@]}" \
    -d "{\"geofence_id\":\"${RESTRICTED_ID}\",\"event_type\":\"both\"}")
  CODE1=$(echo "${RULE1_RESP}" | tail -n 1)
  if [[ "${CODE1}" == "201" ]]; then
    echo "Configured"
  elif [[ "${CODE1}" == "409" ]]; then
    echo "Already exists"
  else
    echo "Notice: HTTP ${CODE1}"
  fi
fi

# Rule 2: Toll zone "entry" for SF-TRK-101
if [[ -n "${TOLL_ID}" && "${TOLL_ID}" != "null" && -n "${TRUCK_ID}" && "${TRUCK_ID}" != "null" ]]; then
  echo -n "   - Rule 2: Toll Zone '${TOLL_ID}' (entry / vehicle ${TRUCK_ID})... "
  RULE2_RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/alerts/configure" \
    -H "Content-Type: application/json" \
    "${AUTH_HEADER[@]}" \
    -d "{\"geofence_id\":\"${TOLL_ID}\",\"vehicle_id\":\"${TRUCK_ID}\",\"event_type\":\"entry\"}")
  CODE2=$(echo "${RULE2_RESP}" | tail -n 1)
  if [[ "${CODE2}" == "201" ]]; then
    echo "Configured"
  elif [[ "${CODE2}" == "409" ]]; then
    echo "Already exists"
  else
    echo "Notice: HTTP ${CODE2}"
  fi
fi

echo ""
echo "=========================================================="
echo "🎉 Seed complete! Environment ready for demo."
echo "=========================================================="
