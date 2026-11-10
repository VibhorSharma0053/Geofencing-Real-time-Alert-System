import React from 'react';
import { Truck, RefreshCw, Navigation, Phone, User, Calendar, MapPin } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import { EmptyState } from './EmptyState';

export function formatTimeAgo(isoTimestamp) {
  if (!isoTimestamp) return '';
  const date = new Date(isoTimestamp);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function VehicleTable({
  vehicles = [],
  vehicleLocations = {},
  locationsLoading = false,
  loading = false,
  error = null,
  onRefresh,
  onSelectVehicle,
  selectedVehicleId = null,
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">Registered Fleet</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {vehicles.length}
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 text-xs"
          title="Refresh vehicles and telemetry"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading || locationsLoading ? 'animate-spin' : ''}`}
          />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-[300px]">
        {loading && (
          <div className="py-12">
            <LoadingSpinner message="Loading fleet vehicles..." />
          </div>
        )}

        {error && !loading && (
          <ErrorMessage
            title="Failed to load vehicles"
            message={error.message || 'Check if the backend is running.'}
            onRetry={onRefresh}
          />
        )}

        {!loading && !error && vehicles.length === 0 && (
          <EmptyState
            icon={Truck}
            title="No Vehicles Registered"
            description="Use the registration form to add vehicles to your tracking roster."
          />
        )}

        {!loading && !error && vehicles.length > 0 && (
          <div className="space-y-2.5">
            {vehicles.map((v) => {
              const isSelected = selectedVehicleId === v.vehicle_id;
              const locData = vehicleLocations[v.vehicle_id];
              const hasLocation = !!locData?.latitude && !!locData?.longitude;
              const geofences = locData?.current_geofences || [];

              return (
                <div
                  key={v.vehicle_id}
                  onClick={() => onSelectVehicle && onSelectVehicle(v)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  {/* Top line: Plate, Type badge, Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-base tracking-wide">
                        {v.vehicle_number}
                      </span>
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {v.vehicle_type || 'truck'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasLocation ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Tracking
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                          No GPS Signal
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Driver & Phone */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mb-2">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-300">{v.driver_name || 'No driver assigned'}</span>
                    </span>
                    {v.phone && (
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{v.phone}</span>
                      </span>
                    )}
                  </div>

                  {/* Current Status: Coordinates & Active Geofences */}
                  <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        Zone Status:
                      </span>
                      {hasLocation ? (
                        geofences.length > 0 ? (
                          geofences.map((g) => (
                            <CategoryBadge
                              key={g.geofence_id}
                              category={g.category}
                              size="xs"
                              className="font-medium"
                            />
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Outside all geofences
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">
                          No location received yet
                        </span>
                      )}
                    </div>

                    {hasLocation && (
                      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                        <span className="flex items-center gap-1 text-indigo-300">
                          <Navigation className="w-3 h-3" />
                          {locData.latitude.toFixed(4)}, {locData.longitude.toFixed(4)}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-500">
                          {formatTimeAgo(locData.timestamp)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
export default VehicleTable;
