import React, { useState, useEffect } from 'react';
import { useAlerts } from '../context/AlertsContext';
import { CATEGORIES, EVENT_TYPES } from '../constants';
import { X, Trash2, CheckCheck, Bell, ShieldAlert, LogIn, LogOut, Navigation, Radio } from 'lucide-react';

export function LiveAlertsFeed({
  isOpen = true,
  onClose,
  variant = 'drawer', // 'drawer' | 'inline'
  onAlertClick,
}) {
  const { alerts, clearAlerts, markAllRead, unreadCount } = useAlerts();
  const [highlightedId, setHighlightedId] = useState(null);

  // Briefly highlight newest alert when one arrives
  useEffect(() => {
    if (alerts.length > 0) {
      const newestId = alerts[0].event_id;
      setHighlightedId(newestId);
      const timer = setTimeout(() => {
        setHighlightedId(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [alerts]);

  if (!isOpen) return null;

  const content = (
    <div className={`flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl ${
      variant === 'drawer' ? 'rounded-none border-t-0 border-b-0 border-r-0' : ''
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="w-5 h-5 text-indigo-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          </div>
          <h2 className="font-bold text-slate-100 text-sm">Real-Time Alerts Feed</h2>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
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
                <CheckCheck className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={clearAlerts}
                title="Clear feed"
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors text-xs flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors ml-1"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content list */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
        {alerts.length === 0 ? (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="p-3 rounded-full bg-slate-800/50 mb-3 animate-pulse">
              <Radio className="w-6 h-6 text-indigo-400 opacity-60" />
            </div>
            <p className="text-sm font-semibold text-slate-400">Waiting for alerts...</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
              When vehicles enter or exit monitored zones, live WebSocket notifications will stream here.
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
            const isHighlighted = highlightedId === al.event_id;

            return (
              <div
                key={al.event_id}
                onClick={() => onAlertClick && onAlertClick(al)}
                className={`p-3 rounded-xl transition-all border cursor-pointer ${
                  isHighlighted
                    ? 'ring-2 ring-indigo-500 bg-indigo-950/40 border-indigo-400'
                    : isRestricted
                    ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/50'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
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
                        {al.timestamp ? new Date(al.timestamp).toLocaleTimeString() : ''}
                      </span>
                    </div>

                    <p className="font-semibold text-slate-200 text-xs mt-1.5 truncate">
                      {al.geofence?.geofence_name || al.geofence_id || 'Geofence'}
                    </p>

                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-mono text-slate-300 font-medium">
                        {al.vehicle?.vehicle_number || al.vehicle_id}
                        {al.vehicle?.driver_name && (
                          <span className="text-slate-500 ml-1 font-sans">
                            ({al.vehicle.driver_name})
                          </span>
                        )}
                      </span>

                      {al.location && (
                        <span className="flex items-center gap-0.5 text-slate-500 text-[10px] font-mono">
                          <Navigation className="w-2.5 h-2.5 text-indigo-400" />
                          {al.location.latitude?.toFixed(4)}, {al.location.longitude?.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (variant === 'drawer') {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end">
        <div className="w-full max-w-md h-full shadow-2xl animate-in slide-in-from-right duration-300">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
export default LiveAlertsFeed;
