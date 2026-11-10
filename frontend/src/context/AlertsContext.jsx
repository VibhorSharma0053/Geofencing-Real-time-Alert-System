import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAlertsSocket } from '../hooks/useAlertsSocket';
import { AlertToast } from '../components/AlertToast';

const AlertsContext = createContext(null);

export function AlertsProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Keep track of received event_ids to prevent duplicate toasts under strict React renders
  const seenEventIdsRef = useRef(new Set());

  const handleIncomingAlert = useCallback((incomingAlert) => {
    if (!incomingAlert?.event_id) return;

    if (seenEventIdsRef.current.has(incomingAlert.event_id)) {
      return;
    }
    seenEventIdsRef.current.add(incomingAlert.event_id);
    if (seenEventIdsRef.current.size > 500) {
      seenEventIdsRef.current.clear();
    }

    setAlerts((prev) => [incomingAlert, ...prev].slice(0, 100)); // Keep newest 100
    setUnreadCount((prev) => prev + 1);

    // Trigger customized toast
    toast.custom((t) => <AlertToast t={t} alert={incomingAlert} />, {
      duration: 6000,
      position: 'top-right',
    });
  }, []);

  const { status } = useAlertsSocket(handleIncomingAlert);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setUnreadCount(0);
  }, []);

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return (
    <AlertsContext.Provider
      value={{
        alerts,
        status,
        clearAlerts,
        unreadCount,
        markAllRead,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertsProvider');
  }
  return context;
}
