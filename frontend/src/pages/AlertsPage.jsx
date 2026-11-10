import React, { useEffect } from 'react';
import { Bell, Plus, RefreshCw, Trash2, ShieldAlert } from 'lucide-react';
import { getAlerts, deleteAlert } from '../api/alerts';
import { useAsync } from '../hooks/useAsync';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { EVENT_TYPES } from '../constants';
import toast from 'react-hot-toast';

export function AlertsPage() {
  const { data, loading, error, execute } = useAsync(() => getAlerts({ limit: 50 }), true);

  const rules = data?.rules || [];

  const handleDelete = async (alertId) => {
    try {
      await deleteAlert(alertId);
      toast.success('Alert rule deleted');
      execute();
    } catch (err) {
      toast.error(err.message || 'Failed to delete alert rule');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-indigo-400" />
            Configured Alert Rules
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Rules that evaluate incoming vehicle location pings against geofence boundaries.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={execute}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh rules"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Alert Rule</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="mt-6">
        {loading && (
          <div className="py-20">
            <LoadingSpinner message="Loading alert rules..." />
          </div>
        )}

        {error && (
          <ErrorMessage
            title="Failed to load alert rules"
            message={error.message || 'Check if the backend API is running.'}
            onRetry={execute}
          />
        )}

        {!loading && !error && rules.length === 0 && (
          <EmptyState
            icon={Bell}
            title="No Alert Rules Configured"
            description="Configure triggers to receive instant notifications via WebSockets whenever a vehicle enters or exits a geofence."
          />
        )}

        {!loading && !error && rules.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Rule ID</th>
                    <th className="px-5 py-3">Geofence</th>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Event Type</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {rules.map((rule) => {
                    const ev = EVENT_TYPES[rule.event_type] || {
                      label: rule.event_type,
                      badgeClass: 'bg-slate-800 text-slate-300',
                    };
                    return (
                      <tr key={rule.alert_id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs text-slate-400">
                          {rule.alert_id}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-indigo-300">
                          {rule.geofence_id}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-300">
                          {rule.vehicle_id ? rule.vehicle_id : <span className="text-slate-500 italic">All Vehicles</span>}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ev.badgeClass}`}>
                            {ev.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500 font-mono">
                          {rule.created_at ? new Date(rule.created_at).toLocaleString() : ''}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleDelete(rule.alert_id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Delete rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
export default AlertsPage;
