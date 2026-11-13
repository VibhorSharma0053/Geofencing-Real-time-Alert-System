#!/usr/bin/env bash
# ==============================================================================
# scripts/simulate.sh
# Simulates a vehicle driving along a straight trajectory that enters and exits
# a restricted geofence perimeter, sending sequential pings every 2 seconds with
# increasing timestamps to trigger real-time WebSocket entry and exit alerts.
# ==============================================================================

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
VEHICLE_PLATE="${VEHICLE_PLATE:-SF-TRK-101}"
API_KEY="${API_KEY:-}"

AUTH_HEADER=()
if [[ -n "${API_KEY}" ]]; then
  AUTH_HEADER=(-H "X-API-Key: ${API_KEY}")
fi

echo "=========================================================="
echo "🚗 Starting Vehicle Movement Simulation at: ${BASE_URL}"
echo "=========================================================="

# Trap Ctrl+C cleanly
trap 'echo -e "\n🛑 Simulation stopped by user."; exit 0' INT

# Look up vehicle_id for vehicle plate
VEHICLES_JSON=$(curl -s "${AUTH_HEADER[@]}" "${BASE_URL}/vehicles")
VEHICLE_ID=$(echo "${VEHICLES_JSON}" | jq -r --arg plate "${VEHICLE_PLATE}" '.vehicles[]? | select(.vehicle_number==$plate) | .vehicle_id' | head -n 1)

if [[ -z "${VEHICLE_ID}" || "${VEHICLE_ID}" == "null" ]]; then
  echo "⚠️  Vehicle '${VEHICLE_PLATE}' not found. Registering a temporary test vehicle..."
  CREATE_RESP=$(curl -s -X POST "${BASE_URL}/vehicles" \
    -H "Content-Type: application/json" \
    "${AUTH_HEADER[@]}" \
    -d "{\"vehicle_number\":\"${VEHICLE_PLATE}\",\"driver_name\":\"Demo Driver\",\"vehicle_type\":\"truck\",\"phone\":\"+1 555-0100\"}")
  VEHICLE_ID=$(echo "${CREATE_RESP}" | jq -r '.vehicle_id')
fi

echo "🎯 Tracking Vehicle: ${VEHICLE_PLATE} (ID: ${VEHICLE_ID})"
echo "📡 Trajectory crosses the Civic Center Security Perimeter (restricted_zone)."
echo "👀 Watch your Live Map Dashboard or WebSocket terminal (wscat) for real-time alerts!"
echo ""

# Trajectory waypoints [lat, lng, expected_state]
WAYPOINTS=(
  "37.7795,-122.4300,Outside"
  "37.7795,-122.4240,Approaching boundary (Outside)"
  "37.7795,-122.4200,ENTERED Civic Center Security Zone (INSIDE)"
  "37.7795,-122.4170,Driving through Civic Center (INSIDE)"
  "37.7795,-122.4120,EXITED Civic Center Security Zone (OUTSIDE)"
  "37.7795,-122.4060,Outside perimeter (Moving East)"
  "37.7795,-122.4000,Arrived at Market Street East (Outside)"
)

TOTAL_STEPS=${#WAYPOINTS[@]}
BASE_TIMESTAMP=$(date +%s)

for i in "${!WAYPOINTS[@]}"; do
  STEP=$((i + 1))
  IFS="," read -r LAT LNG DESC <<< "${WAYPOINTS[$i]}"

  # Ensure strictly increasing UTC timestamps
  OFFSET_SEC=$((i * 3))
  TIMESTAMP=$(date -u -d "@$((BASE_TIMESTAMP + OFFSET_SEC))" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || \
              date -u -r "$((BASE_TIMESTAMP + OFFSET_SEC))" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || \
              python3 -c "import datetime; print(datetime.datetime.fromtimestamp($((BASE_TIMESTAMP + OFFSET_SEC)), datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))" 2>/dev/null || \
              date -u +"%Y-%m-%dT%H:%M:%SZ")

  echo -n "📍 Step [${STEP}/${TOTAL_STEPS}]: (${LAT}, ${LNG}) - ${DESC}... "

  PAYLOAD=$(jq -n \
    --arg vid "${VEHICLE_ID}" \
    --arg lat "${LAT}" \
    --arg lng "${LNG}" \
    --arg ts "${TIMESTAMP}" \
    '{vehicle_id: $vid, latitude: ($lat | tonumber), longitude: ($lng | tonumber), timestamp: $ts}')

  RESPONSE=$(curl -s -X POST "${BASE_URL}/vehicles/location" \
    -H "Content-Type: application/json" \
    "${AUTH_HEADER[@]}" \
    -d "${PAYLOAD}")

  ZONES_COUNT=$(echo "${RESPONSE}" | jq '.current_geofences | length' 2>/dev/null || echo "0")
  TIME_NS=$(echo "${RESPONSE}" | jq -r '.time_ns // "0"')
  LATENCY_MS=$(awk "BEGIN {printf \"%.2f\", ${TIME_NS} / 1000000}" 2>/dev/null || echo "N/A")

  if [[ "${ZONES_COUNT}" -gt 0 ]]; then
    ZONE_NAMES=$(echo "${RESPONSE}" | jq -r '[.current_geofences[].geofence_name] | join(", ")')
    echo "INSIDE: [${ZONE_NAMES}] (${LATENCY_MS} ms)"
  else
    echo "OUTSIDE ALL ZONES (${LATENCY_MS} ms)"
  fi

  if [[ ${STEP} -lt ${TOTAL_STEPS} ]]; then
    sleep 2
  fi
done

echo ""
echo "=========================================================="
echo "🏁 Trajectory simulation completed successfully."
echo "=========================================================="
