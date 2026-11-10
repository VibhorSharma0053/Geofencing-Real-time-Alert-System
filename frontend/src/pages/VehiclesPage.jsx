import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getVehicles } from '../api/vehicles';
import { getVehicleLocation } from '../api/locations';
import { getGeofences } from '../api/geofences';
import { MapView } from '../components/MapView';
import { VehicleForm } from '../components/VehicleForm';
import { VehicleTable } from '../components/VehicleTable';
import { useAlerts } from '../context/AlertsContext';
import { Truck, Plus, List } from 'lucide-react';

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [vehicleLocations, setVehicleLocations] = useState({});
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [activeSideTab, setActiveSideTab] = useState('list'); // 'list' | 'register'
  const [loading, setLoading] = useState(false);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { alerts } = useAlerts();

  // Fetch geofences to render on the map alongside vehicles
  const loadGeofences = useCallback(async () => {
    try {
      const res = await getGeofences();
      setGeofences(res.geofences || []);
    } catch {
      // Non-blocking for vehicles page
    }
  }, []);

  // Fetch telemetry for all vehicles in parallel
  const fetchLocationsForVehicles = useCallback(async (vehList) => {
    if (!vehList || vehList.length === 0) return;
    setLocationsLoading(true);

    try {
      const results = await Promise.allSettled(
        vehList.map((v) => getVehicleLocation(v.vehicle_id))
      );

      const locMap = {};
      results.forEach((res, index) => {
        const vId = vehList[index].vehicle_id;
        if (res.status === 'fulfilled' && res.value) {
          locMap[vId] = res.value;
        } else {
          locMap[vId] = null; // No location reported yet (404)
        }
      });

      setVehicleLocations(locMap);
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  // Fetch vehicles roster
  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getVehicles();
      const list = res.vehicles || [];
      setVehicles(list);
      // Fetch telemetry for all vehicles in parallel
      await fetchLocationsForVehicles(list);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchLocationsForVehicles]);

  // Initial load
  useEffect(() => {
    loadVehicles();
    loadGeofences();
  }, [loadVehicles, loadGeofences]);

  // Auto-refresh vehicle locations when a real-time alert arrives
  useEffect(() => {
    if (alerts.length > 0 && vehicles.length > 0) {
      fetchLocationsForVehicles(vehicles);
    }
  }, [alerts.length, vehicles, fetchLocationsForVehicles]);

  // Prepare vehicle objects for MapView by attaching latest coordinates
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

  const handleSelectVehicle = useCallback((v) => {
    setSelectedVehicleId(v.vehicle_id);
  }, []);

  const handleRegisterSuccess = useCallback(() => {
    loadVehicles();
    setActiveSideTab('list');
  }, [loadVehicles]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Mobile top navigation switch */}
      <div className="lg:hidden bg-slate-900 border-b border-slate-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-white text-sm">Fleet</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveSideTab('list')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold ${
              activeSideTab === 'list'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Vehicles ({vehicles.length})</span>
          </button>
          <button
            onClick={() => setActiveSideTab('register')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold ${
              activeSideTab === 'register'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 h-full overflow-hidden">
        {/* Left Side: Table & Register Form */}
        <div className="lg:col-span-5 xl:col-span-5 h-full flex flex-col bg-slate-950 border-r border-slate-800 overflow-y-auto p-4 space-y-4">
          {/* Desktop tab toggle */}
          <div className="hidden lg:flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 w-full">
              <button
                type="button"
                onClick={() => setActiveSideTab('list')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeSideTab === 'list'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <List className="w-4 h-4" />
                <span>Fleet Roster ({vehicles.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSideTab('register')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeSideTab === 'register'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Register Vehicle</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1">
            {activeSideTab === 'list' ? (
              <VehicleTable
                vehicles={vehicles}
                vehicleLocations={vehicleLocations}
                locationsLoading={locationsLoading}
                loading={loading}
                error={error}
                onRefresh={loadVehicles}
                onSelectVehicle={handleSelectVehicle}
                selectedVehicleId={selectedVehicleId}
              />
            ) : (
              <VehicleForm onSuccess={handleRegisterSuccess} />
            )}
          </div>
        </div>

        {/* Right Side: Map Canvas */}
        <div className="lg:col-span-7 xl:col-span-7 h-full relative min-h-[400px]">
          <MapView
            geofences={geofences}
            vehicles={vehiclesWithLocations}
            focusVehicleId={selectedVehicleId}
            fitToData={vehiclesWithLocations.length > 0 && !selectedVehicleId}
            className="w-full h-full"
            showLegend={true}
          />
        </div>
      </div>
    </div>
  );
}
export default VehiclesPage;
