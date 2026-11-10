import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Map,
  Shield,
  Truck,
  Bell,
  History,
  Menu,
  X,
  Radio,
} from 'lucide-react';
import { ConnectionBadge } from './ConnectionBadge';
import { useAlerts } from '../context/AlertsContext';

const NAV_ITEMS = [
  { to: '/', label: 'Live Map', icon: Map, end: true },
  { to: '/geofences', label: 'Geofences', icon: Shield },
  { to: '/vehicles', label: 'Vehicles', icon: Truck },
  { to: '/alerts', label: 'Alert Rules', icon: Bell },
  { to: '/violations', label: 'Violations History', icon: History },
];

export function Navbar({ onOpenAlerts }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { unreadCount } = useAlerts();

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-white text-base leading-tight group-hover:text-indigo-300 transition-colors">
                  GeoPulse
                </span>
                <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                  Fleet Geofencing
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Right utility items */}
          <div className="flex items-center gap-3">
            {/* WebSocket connection status */}
            <div className="hidden sm:block">
              <ConnectionBadge />
            </div>

            {/* Bell button for Live Alerts feed */}
            <button
              onClick={onOpenAlerts}
              className="relative p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Open real-time alerts feed"
              aria-label="Real-time alerts"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 pt-2 pb-4 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="pb-2 pt-1 sm:hidden">
            <ConnectionBadge />
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </header>
  );
}
