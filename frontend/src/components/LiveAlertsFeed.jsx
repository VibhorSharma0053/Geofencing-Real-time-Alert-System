import React from 'react';
import { useAlerts } from '../context/AlertsContext';
import { CATEGORIES, EVENT_TYPES } from '../constants';
import { X, Trash2, CheckCheck, Bell, ShieldAlert, LogIn, LogOut, Navigation } from 'lucide-react';

export function LiveAlertsFeed({ isOpen, onClose }) {
  const { alerts, clearAlerts, markAllRead, unreadCount } = useAlerts();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-slate-100 text-base">Real-Time Alerts</h2>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {alerts.length > 0 && (
              <>
                <button
                  onClick={markAllRead}
                  title="Mark all as read"
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors text-xs flex items-center gap-1"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
                <button
                  onClick={clearAlerts}
                  title="Clear feed"
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2">
          {alerts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <Bell className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No alerts received yet</p>
              <p className="text-xs text-slate-600 mt-1">
                Triggered geofence events will stream here live over WebSockets.
              </p>
            </div>
          ) : (
            alerts.map((al) => {
              const isRestricted = al.geofence?.category === 'restricted_zone';
              const cat = CATEGORIES[al.geofence?.category] || {
                label: al.geofence?.category || 'Zone',
                badgeClass: 'bg-slate-800 text-slate-400',
              };
              const isEntry = al.event_type === 'entry';
              const ev = isEntry ? EVENT_TYPES.entry : EVENT_TYPES.exit;

              return (
                <div
                  key={al.event_id}
                  className={`p-3 rounded-xl transition-all my-1 border ${
                    isRestricted
                      ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/50'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${
                        isRestricted
                          ? 'bg-red-500/20 text-red-400'
                          : isEntry
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {isRestricted ? (
                        <ShieldAlert className="w-4 h-4 text-red-400" />
                      ) : isEntry ? (
                        <LogIn className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <LogOut className="w-4 h-4 text-amber-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${ev.badgeClass}`}
                        >
                          {isEntry ? 'ENTERED' : 'EXITED'}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cat.badgeClass}`}
                        >
                          {cat.label}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-auto font-mono">
                          {new Date(al.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="font-semibold text-slate-200 text-xs mt-1 truncate">
                        {al.geofence?.geofence_name || 'Geofence'}
                      </p>

                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-mono text-slate-300 font-medium">
                          {al.vehicle?.vehicle_number}
                          {al.vehicle?.driver_name && (
                            <span className="text-slate-500 ml-1 font-sans">
                              ({al.vehicle.driver_name})
                            </span>
                          )}
                        </span>

                        <span className="flex items-center gap-0.5 text-slate-500 text-[10px]">
                          <Navigation className="w-2.5 h-2.5" />
                          {al.location?.latitude?.toFixed(4)}, {al.location?.longitude?.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
