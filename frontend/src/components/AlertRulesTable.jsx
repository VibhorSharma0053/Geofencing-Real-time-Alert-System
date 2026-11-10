import React, { useState } from 'react';
import { EVENT_TYPES } from '../constants';
import { CategoryBadge } from './CategoryBadge';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import { EmptyState } from './EmptyState';
import { Bell, Trash2, Shield, Truck, RefreshCw, Filter, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export function AlertRulesTable({
  rules = [],
  geofences = [],
  vehicles = [],
  selectedGeofenceFilter,
  onGeofenceFilterChange,
  selectedVehicleFilter,
  onVehicleFilterChange,
  loading = false,
  error = null,
  onRefresh,
  onDeleteRule,
}) {
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Map helper lookups for geofence names and vehicle numbers
  const geofenceMap = React.useMemo(() => {
    const map = {};
    geofences.forEach((g) => {
      map[g.geofence_id] = g;
    });
    return map;
  }, [geofences]);

  const vehicleMap = React.useMemo(() => {
    const map = {};
    vehicles.forEach((v) => {
      map[v.vehicle_id] = v;
    });
    return map;
  }, [vehicles]);

  const handleConfirmDelete = async (alertId) => {
    try {
      await onDeleteRule(alertId);
      setDeleteConfirmId(null);
    } catch {
      // Handled in parent
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl flex flex-col h-full">
      {/* Header & Filters */}
      <div className="space-y-3 pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Active Alert Rules</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {rules.length}
            </span>
          </div>
          <button
            onClick={onRefresh}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 text-xs"
            title="Refresh rules list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {/* Geofence Filter */}
          <div className="relative">
            <select
              value={selectedGeofenceFilter}
              onChange={(e) => onGeofenceFilterChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Filter by Geofence (All)</option>
              {geofences.map((g) => (
                <option key={g.geofence_id} value={g.geofence_id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle Filter */}
          <div className="relative">
            <select
              value={selectedVehicleFilter}
              onChange={(e) => onVehicleFilterChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Filter by Vehicle (All)</option>
              {vehicles.map((v) => (
                <option key={v.vehicle_id} value={v.vehicle_id}>
                  {v.vehicle_number} {v.driver_name ? `(${v.driver_name})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-y-auto min-h-[300px]">
        {loading && (
          <div className="py-12">
            <LoadingSpinner message="Loading alert rules..." />
          </div>
        )}

        {error && !loading && (
          <ErrorMessage
            title="Failed to load rules"
            message={error.message || 'Check if the backend is running.'}
            onRetry={onRefresh}
          />
        )}

        {!loading && !error && rules.length === 0 && (
          <EmptyState
            icon={Bell}
            title="No Matching Alert Rules"
            description="Configure your first rule to trigger real-time notifications on geofence entry and exit events."
          />
        )}

        {!loading && !error && rules.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-3.5 py-3">Geofence</th>
                  <th className="px-3.5 py-3">Vehicle</th>
                  <th className="px-3.5 py-3">Event Type</th>
                  <th className="px-3.5 py-3">Status</th>
                  <th className="px-3.5 py-3">Created</th>
                  <th className="px-3.5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {rules.map((rule) => {
                  const ev = EVENT_TYPES[rule.event_type] || {
                    label: rule.event_type,
                    badgeClass: 'bg-slate-800 text-slate-300',
                  };
                  const geo = geofenceMap[rule.geofence_id];
                  const veh = rule.vehicle_id ? vehicleMap[rule.vehicle_id] : null;

                  return (
                    <tr
                      key={rule.alert_id}
                      className="hover:bg-slate-950/40 transition-colors"
                    >
                      {/* Geofence column */}
                      <td className="px-3.5 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white truncate max-w-[150px]">
                            {geo?.name || rule.geofence_id}
                          </span>
                          {geo && (
                            <div className="mt-0.5">
                              <CategoryBadge category={geo.category} size="xs" />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Vehicle column */}
                      <td className="px-3.5 py-3 font-mono">
                        {rule.vehicle_id ? (
                          <div className="flex flex-col">
                            <span className="text-white font-medium">
                              {veh?.vehicle_number || rule.vehicle_id}
                            </span>
                            {veh?.driver_name && (
                              <span className="text-[10px] text-slate-500 font-sans">
                                {veh.driver_name}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">All vehicles</span>
                        )}
                      </td>

                      {/* Event Type column */}
                      <td className="px-3.5 py-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ev.badgeClass}`}
                        >
                          {ev.label}
                        </span>
                      </td>

                      {/* Status column */}
                      <td className="px-3.5 py-3">
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active
                        </span>
                      </td>

                      {/* Created column */}
                      <td className="px-3.5 py-3 font-mono text-[11px] text-slate-500">
                        {rule.created_at
                          ? new Date(rule.created_at).toLocaleDateString()
                          : '—'}
                      </td>

                      {/* Action column */}
                      <td className="px-3.5 py-3 text-right">
                        {deleteConfirmId === rule.alert_id ? (
                          <div className="flex items-center justify-end gap-1.5 animate-in fade-in">
                            <span className="text-[11px] text-red-400 font-medium">Delete?</span>
                            <button
                              onClick={() => handleConfirmDelete(rule.alert_id)}
                              className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-0.5 bg-slate-800 text-slate-300 hover:text-white rounded text-[10px]"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(rule.alert_id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Delete alert rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
export default AlertRulesTable;
