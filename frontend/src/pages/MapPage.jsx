import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapView } from '../components/MapView';
import { UpdateLocationForm } from '../components/UpdateLocationForm';
import { MovementSimulator } from '../components/MovementSimulator';
import { LiveAlertsFeed } from '../components/LiveAlertsFeed';
import { getGeofences } from '../api/geofences';
import { getVehicles } from '../api/vehicles';
import { getVehicleLocation } from '../api/locations';
import { useAlerts } from '../context/AlertsContext';
import { Radio, Shield, Truck, Bell, Navigation, Play, MapPin } from 'lucide-react';

export function MapPage() {
  const [geofences, setGeofences] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleLocations, setVehicleLocations] = useState({});
  const [pickedPoint, setPickedPoint] = useState(null);
  const [focusPoint, setFocusPoint] = useState(null);
  const [activeRightTab, setActiveRightTab] = useState('update'); // 'update' | 'simulate'

  const { alerts } = useAlerts();

  // Load telemetry for all registered vehicles
  const fetchVehicleTelemetry = useCallback(async (vList) => {
    if (!vList || vList.length === 0) return;
    const results = await Promise.allSettled(
      vList.map((v) => getVehicleLocation(v.vehicle_id))
    );

    const locMap = {};
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value) {
        locMap[vList[idx].vehicle_id] = r.value;
      }
    });
    setVehicleLocations(locMap);
  }, []);

  // Fetch geofences and vehicles roster
  const loadData = useCallback(async () => {
    try {
      const [geoRes, vehRes] = await Promise.allSettled([
        getGeofences(),
        getVehicles(),
      ]);

      if (geoRes.status === 'fulfilled') {
        setGeofences(geoRes.value.geofences || []);
      }

      if (vehRes.status === 'fulfilled') {
        const vList = vehRes.value.vehicles || [];
        setVehicles(vList);
        await fetchVehicleTelemetry(vList);
      }
    } catch {
      // Non-blocking
    }
  }, [fetchVehicleTelemetry]);

  // Initial fetch
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh telemetry whenever a real-time alert is broadcast
  useEffect(() => {
    if (alerts.length > 0 && vehicles.length > 0) {
      fetchVehicleTelemetry(vehicles);
    }
  }, [alerts.length, vehicles, fetchVehicleTelemetry]);

  // Assemble vehicles with their latest coordinates and containment status
  const vehiclesWithLocations = useMemo(() => {
    return vehicles
      .map((v) => {
        const loc = vehicleLocations[v.vehicle_id];
        if (loc?.latitude !== undefined && loc?.longitude !== undefined) {
          const isRestricted = loc.current_geofences?.some(
            (g) => g.category === 'restricted_zone'
          );
          return {
            ...v,
            location: {
              latitude: loc.latitude,
              longitude: loc.longitude,
            },
            current_geofences: loc.current_geofences || [],
            isRestricted,
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [vehicles, vehicleLocations]);

  // When user clicks anywhere on the MapView canvas
  const handleMapClick = useCallback((latlng) => {
    setPickedPoint(latlng);
  }, []);

  // When an update or simulation ping succeeds
  const handleLocationUpdated = useCallback(
    (res, coords) => {
      if (res?.vehicle_id) {
        setVehicleLocations((prev) => ({
          ...prev,
          [res.vehicle_id]: res,
        }));
      }
      if (coords) {
        setPickedPoint(coords);
      }
    },
    []
  );

  // When user clicks an alert in LiveAlertsFeed, pan to that location
  const handleAlertClick = useCallback((alert) => {
    if (alert.location?.latitude && alert.location?.longitude) {
      setFocusPoint([alert.location.latitude, alert.location.longitude]);
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Top Banner on Mobile */}
      <div className="lg:hidden bg-slate-900 border-b border-slate-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-white text-sm">Live Fleet Map</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveRightTab('update')}
            className={`px-3 py-1 rounded text-xs font-semibold ${
              activeRightTab === 'update' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Update Location
          </button>
          <button
            onClick={() => setActiveRightTab('simulate')}
            className={`px-3 py-1 rounded text-xs font-semibold ${
              activeRightTab === 'simulate' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Simulate
          </button>
        </div>
      </div>

      {/* Main Split Layout: Map on left, panels on right */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 h-full overflow-hidden">
        {/* Left Side: Map Canvas */}
        <div className="lg:col-span-7 xl:col-span-8 h-full relative min-h-[400px]">
          {/* Top Floating Control Bar */}
          <div className="absolute top-4 left-4 right-4 z-[1000] flex items-center justify-between pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl px-4 py-2 shadow-xl flex items-center gap-3 pointer-events-auto">
              <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xs font-bold text-white flex items-center gap-2">
                  Fleet Tracking & Geofence Map
                </h1>
                <p className="text-[10px] text-slate-400">
                  Click anywhere on map to select coordinates
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-3 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl px-3 py-2 shadow-xl pointer-events-auto text-xs text-slate-300">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Zones: {geofences.length}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tracking: {vehiclesWithLocations.length}/{vehicles.length}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span>Alerts: {alerts.length}</span>
              </span>
            </div>
          </div>

          <MapView
            geofences={geofences}
            vehicles={vehiclesWithLocations}
            pickedPoint={pickedPoint}
            focusPoint={focusPoint}
            onMapClick={handleMapClick}
            fitToData={geofences.length > 0 && !pickedPoint && !focusPoint}
            className="w-full h-full"
            showLegend={true}
          />
        </div>

        {/* Right Side: Dual Panels (Update Location & Live Alerts) */}
        <div className="lg:col-span-5 xl:col-span-4 h-full flex flex-col bg-slate-950 border-l border-slate-800 overflow-y-auto p-4 space-y-4">
          {/* Controls switcher tabs */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveRightTab('update')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeRightTab === 'update'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Update Location</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRightTab('simulate')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeRightTab === 'simulate'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Simulate Movement</span>
            </button>
          </div>

          {/* Section 1: Form / Simulator */}
          <div>
            {activeRightTab === 'update' ? (
              <UpdateLocationForm
                vehicles={vehicles}
                pickedPoint={pickedPoint}
                onPickedPointChange={setPickedPoint}
                onSuccess={(res) => handleLocationUpdated(res, pickedPoint)}
              />
            ) : (
              <MovementSimulator
                vehicles={vehicles}
                geofences={geofences}
                onStepPing={(res, coords) => handleLocationUpdated(res, coords)}
              />
            )}
          </div>

          {/* Section 2: Live Alerts Feed (Embedded) */}
          <div className="flex-1 min-h-[300px] flex flex-col">
            <LiveAlertsFeed
              variant="inline"
              isOpen={true}
              onAlertClick={handleAlertClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
export default MapPage;
