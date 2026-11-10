import React from 'react';
import ReactDOM from 'react-dom/client';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

import { AlertsProvider } from './context/AlertsContext';
import App from './App';
import './index.css';

// Fix Leaflet marker icon asset resolution in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AlertsProvider>
      <App />
    </AlertsProvider>
  </React.StrictMode>
);
