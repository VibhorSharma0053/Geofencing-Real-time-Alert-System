import React, { useState } from 'react';
import { configureAlert } from '../api/alerts';
import { EVENT_TYPES } from '../constants';
import { Bell, Plus, Loader2, AlertCircle, Shield, Truck } from 'lucide-react';
import toast from 'react-hot-toast';

export function AlertRuleForm({ geofences = [], vehicles = [], onSuccess }) {
  const [geofenceId, setGeofenceId] = useState('');
  const [vehicleId, setVehicleId] = useState(''); // empty = all vehicles
  const [eventType, setEventType] = useState('both');
  const [submitting, setSubmitting] = useState(false);
  const [duplicateError, setDuplicateError] = useState(null);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!geofenceId) {
      errs.geofence = 'Please select a geofence';
    }
    if (!eventType) {
      errs.eventType = 'Please select an event type';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setDuplicateError(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        geofence_id: geofenceId,
        event_type: eventType,
      };
      if (vehicleId) {
        payload.vehicle_id = vehicleId;
      }

      await configureAlert(payload);
      toast.success('Alert rule configured successfully');

      // Reset
      setVehicleId('');
      setEventType('both');
      setErrors({});

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      if (err.status === 409 || err.message?.toLowerCase().includes('already exists')) {
        setDuplicateError('This alert rule already exists.');
      } else {
        toast.error(err.message || 'Failed to configure alert rule');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl"
    >
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
        <Bell className="w-5 h-5 text-indigo-400" />
        <h2 className="text-base font-bold text-white">Configure Alert Rule</h2>
      </div>

      {duplicateError && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
          <span>{duplicateError}</span>
        </div>
      )}

      {/* Geofence Select */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Target Geofence <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <select
            value={geofenceId}
            onChange={(e) => {
              setGeofenceId(e.target.value);
              if (errors.geofence) setErrors((prev) => ({ ...prev, geofence: null }));
              if (duplicateError) setDuplicateError(null);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select a geofence...</option>
            {geofences.map((g) => (
              <option key={g.geofence_id} value={g.geofence_id}>
                {g.name} ({g.category})
              </option>
            ))}
          </select>
        </div>
        {errors.geofence && (
          <p className="text-xs text-red-400 mt-1 font-medium">{errors.geofence}</p>
        )}
      </div>

      {/* Vehicle Select */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Vehicle Filter <span className="text-slate-500 normal-case font-normal">(optional)</span>
        </label>
        <div className="relative">
          <select
            value={vehicleId}
            onChange={(e) => {
              setVehicleId(e.target.value);
              if (duplicateError) setDuplicateError(null);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All vehicles (Wildcard)</option>
            {vehicles.map((v) => (
              <option key={v.vehicle_id} value={v.vehicle_id}>
                {v.vehicle_number} {v.driver_name ? `(${v.driver_name})` : ''}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Select a specific vehicle, or leave as "All vehicles" to monitor entire fleet.
        </p>
      </div>

      {/* Event Type Radio/Segmented Control */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Trigger Event Type <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {Object.values(EVENT_TYPES).map((ev) => {
            const isSelected = eventType === ev.id;
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => {
                  setEventType(ev.id);
                  if (duplicateError) setDuplicateError(null);
                }}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all text-center ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow ring-1 ring-indigo-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {ev.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-600/30 transition-all uppercase tracking-wider"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Configuring Rule...</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Configure Rule</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
export default AlertRuleForm;
