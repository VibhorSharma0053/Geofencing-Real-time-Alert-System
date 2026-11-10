import React, { useState, useEffect, useCallback } from 'react';
import { getAlerts, deleteAlert } from '../api/alerts';
import { getGeofences } from '../api/geofences';
import { getVehicles } from '../api/vehicles';
import { AlertRuleForm } from '../components/AlertRuleForm';
import { AlertRulesTable } from '../components/AlertRulesTable';
import { LiveAlertsFeed } from '../components/LiveAlertsFeed';
import { Bell, Plus, List, Radio } from 'lucide-react';
import toast from 'react-hot-toast';

export function AlertsPage() {
  const [rules, setRules] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [geofenceFilter, setGeofenceFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [activeSideTab, setActiveSideTab] = useState('list'); // 'list' | 'create'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load support resources (geofences, vehicles)
  const loadResources = useCallback(async () => {
    try {
      const [geoRes, vehRes] = await Promise.allSettled([
        getGeofences(),
        getVehicles(),
      ]);
      if (geoRes.status === 'fulfilled') {
        setGeofences(geoRes.value.geofences || []);
      }
      if (vehRes.status === 'fulfilled') {
        setVehicles(vehRes.value.vehicles || []);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  // Load configured alert rules with query params
  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (geofenceFilter) params.geofence_id = geofenceFilter;
      if (vehicleFilter) params.vehicle_id = vehicleFilter;

      const res = await getAlerts(params);
      setRules(res.rules || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [geofenceFilter, vehicleFilter]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleDeleteRule = async (alertId) => {
    try {
      await deleteAlert(alertId);
      toast.success('Alert rule deleted');
      loadRules();
    } catch (err) {
      toast.error(err.message || 'Failed to delete alert rule');
      throw err;
    }
  };

  const handleCreateSuccess = () => {
    loadRules();
    setActiveSideTab('list');
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Mobile top navigation switch */}
      <div className="lg:hidden bg-slate-900 border-b border-slate-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-white text-sm">Alert Rules</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveSideTab('list')}
            className={`px-3 py-1 rounded text-xs font-semibold ${
              activeSideTab === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Rules ({rules.length})
          </button>
          <button
            onClick={() => setActiveSideTab('create')}
            className={`px-3 py-1 rounded text-xs font-semibold ${
              activeSideTab === 'create' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Configure
          </button>
        </div>
      </div>

      {/* Main Split Layout: Rules & Form on Left, Live Alerts on Right */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 h-full overflow-hidden">
        {/* Left Side: Rules Table & Configure Form */}
        <div className="lg:col-span-7 xl:col-span-8 h-full flex flex-col bg-slate-950 border-r border-slate-800 overflow-y-auto p-4 space-y-4">
          {/* Tab switcher */}
          <div className="hidden lg:flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 w-full max-w-sm">
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
                <span>Active Rules ({rules.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSideTab('create')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeSideTab === 'create'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Configure Rule</span>
              </button>
            </div>
          </div>

          <div className="flex-1">
            {activeSideTab === 'list' ? (
              <AlertRulesTable
                rules={rules}
                geofences={geofences}
                vehicles={vehicles}
                selectedGeofenceFilter={geofenceFilter}
                onGeofenceFilterChange={setGeofenceFilter}
                selectedVehicleFilter={vehicleFilter}
                onVehicleFilterChange={setVehicleFilter}
                loading={loading}
                error={error}
                onRefresh={loadRules}
                onDeleteRule={handleDeleteRule}
              />
            ) : (
              <AlertRuleForm
                geofences={geofences}
                vehicles={vehicles}
                onSuccess={handleCreateSuccess}
              />
            )}
          </div>
        </div>

        {/* Right Side: Live Alerts Feed */}
        <div className="lg:col-span-5 xl:col-span-4 h-full flex flex-col bg-slate-950 overflow-y-auto p-4">
          <LiveAlertsFeed variant="inline" isOpen={true} />
        </div>
      </div>
    </div>
  );
}
export default AlertsPage;
