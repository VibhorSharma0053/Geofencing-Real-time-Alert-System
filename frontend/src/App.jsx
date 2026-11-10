import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { MapPage } from './pages/MapPage';
import { GeofencesPage } from './pages/GeofencesPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { AlertsPage } from './pages/AlertsPage';
import { HistoryPage } from './pages/HistoryPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<MapPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="geofences" element={<GeofencesPage />} />
          <Route path="vehicles" element={<VehiclesPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="violations" element={<HistoryPage />} />
          <Route path="history" element={<Navigate to="/violations" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
