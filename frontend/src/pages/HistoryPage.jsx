import React, { useState } from 'react';
import { History, RefreshCw, AlertTriangle, ShieldAlert, LogIn, LogOut } from 'lucide-react';
import { getViolationsHistory } from '../api/violations';
import { useAsync } from '../hooks/useAsync';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { EVENT_TYPES } from '../constants';

export function HistoryPage() {
  const [limit] = useState(50);
  const { data, loading, error, execute } = useAsync(() => getViolationsHistory({ limit }), true);

  const violations = data?.violations || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <History className="w-6 h-6 text-indigo-400" />
            Violations & Event History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Historical log of all geofence entry, exit, and unauthorized zone events.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={execute}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="mt-6">
        {loading && (
          <div className="py-20">
            <LoadingSpinner message="Loading violation history..." />
          </div>
        )}

        {error && (
          <ErrorMessage
            title="Failed to load violation history"
            message={error.message || 'Check if the backend API is running.'}
            onRetry={execute}
          />
        )}

        {!loading && !error && violations.length === 0 && (
          <EmptyState
            icon={History}
            title="No Violations Recorded"
            description="When vehicles cross geofence boundaries, detected events and policy violations will appear here."
          />
        )}

        {!loading && !error && violations.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Violation ID</th>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Geofence</th>
                    <th className="px-5 py-3">Event Type</th>
                    <th className="px-5 py-3">Coordinates</th>
                    <th className="px-5 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {violations.map((viol) => {
                    const isEntry = viol.event_type === 'entry';
                    const ev = isEntry ? EVENT_TYPES.entry : EVENT_TYPES.exit;
                    const lat = viol.location?.latitude ?? viol.latitude;
                    const lon = viol.location?.longitude ?? viol.longitude;

                    return (
                      <tr key={viol.violation_id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs text-slate-400">
                          {viol.violation_id}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-white font-medium">
                          {viol.vehicle_id}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-indigo-300">
                          {viol.geofence_id}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ev.badgeClass}`}>
                            {isEntry ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                            {isEntry ? 'Entry' : 'Exit'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-slate-400">
                          {lat !== undefined && lon !== undefined ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : '—'}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500 font-mono">
                          {viol.timestamp ? new Date(viol.timestamp).toLocaleString() : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default HistoryPage;
