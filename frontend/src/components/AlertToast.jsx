import React from 'react';
import toast from 'react-hot-toast';
import { CATEGORIES, EVENT_TYPES } from '../constants';
import { ShieldAlert, LogIn, LogOut, X, Navigation } from 'lucide-react';

export function AlertToast({ t, alert }) {
  const isRestricted = alert.geofence?.category === 'restricted_zone';
  const categoryInfo = CATEGORIES[alert.geofence?.category] || {
    label: alert.geofence?.category || 'Zone',
    color: '#64748b',
    badgeClass: 'bg-slate-700 text-slate-300',
  };

  const isEntry = alert.event_type === 'entry';
  const eventInfo = isEntry ? EVENT_TYPES.entry : EVENT_TYPES.exit;

  return (
    <div
      className={`max-w-md w-full bg-slate-900 border rounded-xl shadow-2xl p-4 transition-all duration-300 pointer-events-auto ${
        isRestricted
          ? 'border-red-500/80 shadow-red-500/20 ring-1 ring-red-500/40 animate-pulse'
          : 'border-slate-700 shadow-slate-950/50'
      } ${t.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Leading Icon */}
        <div
          className={`p-2 rounded-lg flex-shrink-0 ${
            isRestricted
              ? 'bg-red-500/20 text-red-400'
              : isEntry
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/20 text-amber-400'
          }`}
        >
          {isRestricted ? (
            <ShieldAlert className="w-5 h-5 text-red-400" />
          ) : isEntry ? (
            <LogIn className="w-5 h-5 text-emerald-400" />
          ) : (
            <LogOut className="w-5 h-5 text-amber-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${eventInfo.badgeClass}`}
            >
              {isEntry ? 'ENTERED' : 'EXITED'}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${categoryInfo.badgeClass}`}
            >
              {categoryInfo.label}
            </span>
          </div>

          <h4 className="font-semibold text-slate-100 text-sm truncate">
            {alert.geofence?.geofence_name || 'Geofence Area'}
          </h4>

          <div className="mt-1 text-xs text-slate-300 space-y-0.5">
            <p className="flex items-center gap-1.5 font-medium">
              <span className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                {alert.vehicle?.vehicle_number || alert.vehicle?.vehicle_id}
              </span>
              {alert.vehicle?.driver_name && (
                <span className="text-slate-400">({alert.vehicle.driver_name})</span>
              )}
            </p>

            <p className="text-slate-400 flex items-center gap-1 text-[11px] pt-0.5">
              <Navigation className="w-3 h-3 text-slate-500" />
              {alert.location?.latitude?.toFixed(4)}, {alert.location?.longitude?.toFixed(4)}
              <span className="mx-1">•</span>
              {new Date(alert.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => toast.dismiss(t.id)}
          className="text-slate-500 hover:text-slate-300 p-1 rounded-md transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
