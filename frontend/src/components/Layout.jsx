import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Navbar } from './Navbar';
import { LiveAlertsFeed } from './LiveAlertsFeed';

export function Layout() {
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Toast notifications container */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #1e293b',
            borderRadius: '0.75rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          },
        }}
      />

      {/* Global Navbar */}
      <Navbar onOpenAlerts={() => setIsAlertsOpen(true)} />

      {/* Slide-over live alerts panel */}
      <LiveAlertsFeed isOpen={isAlertsOpen} onClose={() => setIsAlertsOpen(false)} />

      {/* Main page content */}
      <main className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
