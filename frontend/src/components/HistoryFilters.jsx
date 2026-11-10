import React, { useState, useEffect } from 'react';
import { Filter, RotateCcw, Calendar, Truck, Shield } from 'lucide-react';

export function HistoryFilters({
  vehicles = [],
  geofences = [],
  filters,
  onApply,
  onReset,
}) {
  const [vehicleId, setVehicleId] = useState(filters.vehicle_id || '');
  const [geofenceId, setGeofenceId] = useState(filters.geofence_id || '');
  const [startTime, setStartTime] = useState(filters.start_time || '');
  const [endTime, setEndTime] = useState(filters.end_time || '');
  const [limit, setLimit] = useState(filters.limit || 50);
  const [dateError, setDateError] = useState(null);

  // Sync with prop changes (e.g. from URL search params)
  useEffect(() => {
    setVehicleId(filters.vehicle_id || '');
    setGeofenceId(filters.geofence_id || '');
    setStartTime(filters.start_time || '');
    setEndTime(filters.end_time || '');
    setLimit(filters.limit || 50);
  }, [filters]);

  const handleApply = (e) => {
    e.preventDefault();
    setDateError(null);

    if (startTime && endTime) {
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      if (start > end) {
        setDateError('Start date/time cannot be after End date/time.');
        return;
      }
    }

    onApply({
      vehicle_id: vehicleId || undefined,
      geofence_id: geofenceId || undefined,
      start_time: startTime ? new Date(startTime).toISOString() : undefined,
      end_time: endTime ? new Date(endTime).toISOString() : undefined,
      limit: Number(limit),
      offset: 0, // Reset to page 1
    });
  };

  const handleReset = () => {
    setDateError(null);
    setVehicleId('');
    setGeofenceId('');
    setStartTime('');
    setEndTime('');
    setLimit(50);
    onReset();
  };

  return (
    <form
      onSubmit={handleApply}
      className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3"
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Filter Violation Events
          </h3>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Filters</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Vehicle */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Vehicle
          </label>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Vehicles</option>
            {vehicles.map((v) => (
              <option key={v.vehicle_id} value={v.vehicle_id}>
                {v.vehicle_number} {v.driver_name ? `(${v.driver_name})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Geofence */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Geofence
          </label>
          <select
            value={geofenceId}
            onChange={(e) => setGeofenceId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Geofences</option>
            {geofences.map((g) => (
              <option key={g.geofence_id} value={g.geofence_id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Start Time */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            From Date/Time
          </label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              setDateError(null);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* End Time */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            To Date/Time
          </label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => {
              setEndTime(e.target.value);
              setDateError(null);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Page Size & Apply */}
        <div className="flex items-end gap-2">
          <div className="w-1/2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Page Size
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-1/2 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors shadow shadow-indigo-600/30"
          >
            Apply
          </button>
        </div>
      </div>

      {dateError && (
        <p className="text-xs text-red-400 font-medium pt-1">{dateError}</p>
      )}
    </form>
  );
}
export default HistoryFilters;
