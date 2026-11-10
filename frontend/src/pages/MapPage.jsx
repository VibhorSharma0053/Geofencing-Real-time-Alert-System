import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapView } from '../components/MapView';
import { getGeofences } from '../api/geofences';
import { getVehicles } from '../api/vehicles';
import { getVehicleLocation } from '../api/locations';
import { useAlerts } from '../context/AlertsContext';
import { Radio, Layers, MapPin, Truck, Shield } from 'lucide-react';

export function MapPage() {
  const [geofences, setGeofences] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleLocations, setVehicleLocations] = useState({});
  const { status, alerts } = useAlerts();

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

        if (vList.length > 0) {
          const locResults = await Promise.allSettled(
            vList.map((v) => getVehicleLocation(v.vehicle_id))
          );
          const locMap = {};
          locResults.forEach((r, idx) => {
            if (r.status === 'fulfilled' && r.value) {
              locMap[vList[idx].vehicle_id] = r.value;
            }
          });
          setVehicleLocations(locMap);
        }
      }
    } catch {
      // Best effort on live map
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh locations whenever an alert comes in
  useEffect(() => {
    if (alerts.length > 0) {
      loadData();
    }
  }, [alerts.length, loadData]);

  const vehiclesWithLocations = useMemo(() => {
    return vehicles
      .map((v) => {
        const loc = vehicleLocations[v.vehicle_id];
        if (loc?.latitude !== undefined && loc?.longitude !== undefined) {
          return {
            ...v,
            location: {
              latitude: loc.latitude,
              longitude: loc.longitude,
            },
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [vehicles, vehicleLocations]);

  return (
    <div className="relative flex-1 h-[calc(100vh-4rem)] w-full overflow-hidden flex flex-col">
      {/* Top Banner / Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-3 pointer-events-auto">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              Fleet Tracking & Geofence Map
            </h1>
            <p className="text-[11px] text-slate-400">
              Interactive Leaflet canvas • Real-time event telemetry
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl px-3 py-2 shadow-xl pointer-events-auto text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span>Zones: {geofences.length}</span>
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-emerald-400" />
            <span>Active: {vehiclesWithLocations.length}/{vehicles.length}</span>
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>Alerts: {alerts.length}</span>
          </span>
        </div>
      </div>

      {/* MapView Canvas */}
      <MapView
        geofences={geofences}
        vehicles={vehiclesWithLocations}
        fitToData={geofences.length > 0 || vehiclesWithLocations.length > 0}
        className="w-full h-full z-0"
        showLegend={true}
      />
    </div>
  );
}
export default MapPage;
