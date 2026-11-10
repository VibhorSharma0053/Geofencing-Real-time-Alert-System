import { useState, useEffect, useRef } from 'react';
import { getWebSocketUrl } from '../api/client';

/**
 * WebSocket client hook for receiving real-time geofence alert events.
 * Handles automatic reconnects with exponential backoff and React 18 StrictMode mount cycles.
 *
 * @param {Function} onAlert - Callback invoked whenever an alert message is received.
 */
export function useAlertsSocket(onAlert) {
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  const retryTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const retryDelayRef = useRef(1000);
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    isUnmountedRef.current = false;

    function connect() {
      if (isUnmountedRef.current) return;

      // Close existing socket if any before recreating
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      const wsUrl = getWebSocketUrl();
      setStatus((prev) => (prev === 'connected' ? 'reconnecting' : 'connecting'));

      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isUnmountedRef.current) {
            ws.close();
            return;
          }
          setStatus('connected');
          retryDelayRef.current = 1000; // Reset backoff on successful connect
        };

        ws.onmessage = (event) => {
          if (!event.data) return;
          try {
            const data = JSON.parse(event.data);
            // Strict event contract validation: ignore non-alert messages
            if (data && data.event_id && onAlertRef.current) {
              onAlertRef.current(data);
            }
          } catch {
            // Ignore malformed messages safely
          }
        };

        ws.onerror = () => {
          // Trigger close handling
        };

        ws.onclose = () => {
          if (isUnmountedRef.current) {
            setStatus('disconnected');
            return;
          }

          setStatus('reconnecting');
          socketRef.current = null;

          const delay = retryDelayRef.current;
          retryDelayRef.current = Math.min(delay * 2, 30000); // Exponential backoff up to 30s

          retryTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        };
      } catch {
        setStatus('reconnecting');
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(delay * 2, 30000);
        retryTimeoutRef.current = setTimeout(connect, delay);
      }
    }

    connect();

    return () => {
      isUnmountedRef.current = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setStatus('disconnected');
    };
  }, []);

  return { status };
}
