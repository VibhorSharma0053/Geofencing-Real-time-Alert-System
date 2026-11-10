import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export function ConnectionBadge({ status }) {
  const config = {
    connected: {
      label: 'Live',
      bgClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-400 animate-pulse',
      icon: Wifi,
    },
    reconnecting: {
      label: 'Reconnecting...',
      bgClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      dotClass: 'bg-amber-400 animate-ping',
      icon: Wifi,
    },
    connecting: {
      label: 'Connecting...',
      bgClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      dotClass: 'bg-amber-400 animate-pulse',
      icon: Wifi,
    },
    disconnected: {
      label: 'Offline',
      bgClass: 'bg-red-500/10 text-red-400 border-red-500/30',
      dotClass: 'bg-red-400',
      icon: WifiOff,
    },
  }[status] || {
    label: 'Disconnected',
    bgClass: 'bg-slate-700 text-slate-300 border-slate-600',
    dotClass: 'bg-slate-400',
    icon: WifiOff,
  };

  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgClass}`}
      title={`Real-time WebSocket feed: ${config.label}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
      <Icon className="w-3.5 h-3.5 opacity-80" />
      <span>{config.label}</span>
    </div>
  );
}
