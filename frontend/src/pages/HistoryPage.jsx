import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getViolationsHistory } from '../api/violations';
import { getGeofences } from '../api/geofences';
import { getVehicles } from '../api/vehicles';
import { HistoryFilters } from '../components/HistoryFilters';
import { Pagination } from '../components/Pagination';
import { EventBadge } from '../components/EventBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { History, Download, RefreshCw, Navigation } from 'lucide-react';

export function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query parameters into initial filter state
  const currentFilters = useMemo(() => {
    return {
      vehicle_id: searchParams.get('vehicle_id') || '',
      geofence_id: searchParams.get('geofence_id') || '',
      start_time: searchParams.get('start_time') || '',
      end_time: searchParams.get('end_time') || '',
      limit: Number(searchParams.get('limit')) || 50,
      offset: Number(searchParams.get('offset')) || 0,
    };
  }, [searchParams]);

  const [violations, setViolations] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [geofences, setGeofences] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Lookups
  const geofenceMap = useMemo(() => {
    const map = {};
    geofences.forEach((g) => {
      map[g.geofence_id] = g;
    });
    return map;
  }, [geofences]);

  const vehicleMap = useMemo(() => {
    const map = {};
    vehicles.forEach((v) => {
      map[v.vehicle_id] = v;
    });
    return map;
  }, [vehicles]);

  // Load auxiliary reference resources
  useEffect(() => {
    Promise.allSettled([getGeofences(), getVehicles()]).then(([gRes, vRes]) => {
      if (gRes.status === 'fulfilled') {
        setGeofences(gRes.value.geofences || []);
      }
      if (vRes.status === 'fulfilled') {
        setVehicles(vRes.value.vehicles || []);
      }
    });
  }, []);

  // Fetch violation events from backend
  const loadViolations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit: currentFilters.limit,
        offset: currentFilters.offset,
      };
      if (currentFilters.vehicle_id) params.vehicle_id = currentFilters.vehicle_id;
      if (currentFilters.geofence_id) params.geofence_id = currentFilters.geofence_id;
      if (currentFilters.start_time) params.start_time = currentFilters.start_time;
      if (currentFilters.end_time) params.end_time = currentFilters.end_time;

      const res = await getViolationsHistory(params);
      const list = res.violations || [];
      setViolations(list);
      setTotalCount(res.total_count ?? list.length);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [currentFilters]);

  useEffect(() => {
    loadViolations();
  }, [loadViolations]);

  // Apply filters and persist to URL
  const handleApplyFilters = (newFilters) => {
    const params = new URLSearchParams();
    if (newFilters.vehicle_id) params.set('vehicle_id', newFilters.vehicle_id);
    if (newFilters.geofence_id) params.set('geofence_id', newFilters.geofence_id);
    if (newFilters.start_time) params.set('start_time', newFilters.start_time);
    if (newFilters.end_time) params.set('end_time', newFilters.end_time);
    if (newFilters.limit) params.set('limit', newFilters.limit.toString());
    params.set('offset', '0'); // reset offset
    setSearchParams(params);
  };

  const handleResetFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const handlePageChange = (newOffset) => {
    const params = new URLSearchParams(searchParams);
    params.set('offset', newOffset.toString());
    setSearchParams(params);
  };

  // CSV Export for current filtered dataset
  const handleExportCSV = () => {
    if (violations.length === 0) return;

    const headers = ['Violation ID', 'Timestamp', 'Vehicle ID', 'Vehicle Plate', 'Geofence ID', 'Geofence Name', 'Event Type', 'Latitude', 'Longitude'];
    const rows = violations.map((v) => {
      const veh = vehicleMap[v.vehicle_id];
      const geo = geofenceMap[v.geofence_id];
      const lat = v.location?.latitude ?? v.latitude;
      const lon = v.location?.longitude ?? v.longitude;

      return [
        `"${v.violation_id}"`,
        `"${v.timestamp || ''}"`,
        `"${v.vehicle_id}"`,
        `"${veh?.vehicle_number || ''}"`,
        `"${v.geofence_id}"`,
        `"${geo?.name || ''}"`,
        `"${v.event_type}"`,
        lat !== undefined ? lat : '',
        lon !== undefined ? lon : '',
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `violations_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <History className="w-6 h-6 text-indigo-400" />
            Violations & Event History
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Historical log of all vehicle boundary crossings, unauthorized entries, and zone exits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {violations.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold rounded-lg shadow-sm transition-colors"
              title="Download CSV of current page"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export CSV</span>
            </button>
          )}

          <button
            onClick={loadViolations}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <HistoryFilters
        vehicles={vehicles}
        geofences={geofences}
        filters={currentFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      {/* Main Table / State View */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
        {loading && (
          <div className="py-20">
            <LoadingSpinner message="Querying event history..." />
          </div>
        )}

        {error && !loading && (
          <div className="p-6">
            <ErrorMessage
              title="Failed to query violation history"
              message={error.message || 'Check if the backend is running.'}
              onRetry={loadViolations}
            />
          </div>
        )}

        {!loading && !error && violations.length === 0 && (
          <div className="p-8">
            <EmptyState
              icon={History}
              title="No Events Match Your Filters"
              description="Try adjusting your vehicle, geofence, or date/time range filters above."
            />
          </div>
        )}

        {!loading && !error && violations.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Geofence</th>
                    <th className="px-5 py-3">Event</th>
                    <th className="px-5 py-3">Coordinates</th>
                    <th className="px-5 py-3 font-mono">Violation ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {violations.map((viol) => {
                    const veh = vehicleMap[viol.vehicle_id];
                    const geo = geofenceMap[viol.geofence_id];
                    const lat = viol.location?.latitude ?? viol.latitude;
                    const lon = viol.location?.longitude ?? viol.longitude;

                    return (
                      <tr
                        key={viol.violation_id}
                        className="hover:bg-slate-950/40 transition-colors"
                      >
                        {/* Timestamp */}
                        <td className="px-5 py-3.5 font-mono text-slate-400 whitespace-nowrap">
                          {viol.timestamp
                            ? new Date(viol.timestamp).toLocaleString()
                            : '—'}
                        </td>

                        {/* Vehicle */}
                        <td className="px-5 py-3.5 font-mono">
                          <span className="font-bold text-white">
                            {veh?.vehicle_number || viol.vehicle_id}
                          </span>
                          {veh?.driver_name && (
                            <span className="text-[10px] text-slate-500 block font-sans">
                              {veh.driver_name}
                            </span>
                          )}
                        </td>

                        {/* Geofence */}
                        <td className="px-5 py-3.5">
                          <span className="font-medium text-indigo-300 block">
                            {geo?.name || viol.geofence_id}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {viol.geofence_id}
                          </span>
                        </td>

                        {/* Event Badge */}
                        <td className="px-5 py-3.5">
                          <EventBadge eventType={viol.event_type} size="xs" />
                        </td>

                        {/* Coordinates */}
                        <td className="px-5 py-3.5 font-mono text-slate-400">
                          {lat !== undefined && lon !== undefined ? (
                            <span className="flex items-center gap-1">
                              <Navigation className="w-3 h-3 text-slate-500" />
                              {lat.toFixed(4)}, {lon.toFixed(4)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* Violation ID */}
                        <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">
                          {viol.violation_id}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <Pagination
              totalCount={totalCount}
              limit={currentFilters.limit}
              offset={currentFilters.offset}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
export default HistoryPage;
