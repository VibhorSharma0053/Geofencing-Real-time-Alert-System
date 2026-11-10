import React, { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { CATEGORIES, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '../constants';
import { CategoryBadge } from './CategoryBadge';
import { Truck, Navigation, MapPin } from 'lucide-react';

// Vehicle custom marker icon generator
function createVehicleIcon(isSelected = false) {
  return L.divIcon({
    className: 'custom-vehicle-div-icon',
    html: `
      <div class="relative flex items-center justify-center w-8 h-8 rounded-full transition-transform ${
        isSelected
          ? 'bg-indigo-600 ring-4 ring-indigo-400/40 scale-110 shadow-indigo-500/50'
          : 'bg-slate-900 border-2 border-indigo-400 shadow-lg hover:scale-105'
      } text-white">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18" r="2"/>
          <circle cx="7" cy="18" r="2"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

// Click-to-set / picked point marker icon
const pickedPointIcon = L.divIcon({
  className: 'custom-picked-div-icon',
  html: `
    <div class="relative flex items-center justify-center w-7 h-7">
      <div class="absolute w-7 h-7 rounded-full bg-rose-500/30 animate-ping"></div>
      <div class="w-6 h-6 rounded-full bg-rose-500 border-2 border-white shadow-xl flex items-center justify-center">
        <div class="w-2 h-2 rounded-full bg-white"></div>
      </div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

// Helper component for map click events
function MapEventsHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick([Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))]);
      }
    },
  });
  return null;
}

// Helper component for Geoman drawing interaction
function GeomanHandler({ drawEnabled, onPolygonDrawn }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !map.pm) return;

    // Apply global path options for drawn polygon
    map.pm.setPathOptions({
      color: '#6366f1',
      fillColor: '#818cf8',
      fillOpacity: 0.3,
      weight: 2,
      dashArray: '4, 4',
    });

    const handleCreate = (e) => {
      if (e.shape === 'Polygon' || e.layer instanceof L.Polygon) {
        const rawLatLngs = e.layer.getLatLngs();
        const ring = Array.isArray(rawLatLngs[0]) ? rawLatLngs[0] : rawLatLngs;
        const coords = ring.map((pt) => [
          Number(pt.lat.toFixed(6)),
          Number(pt.lng.toFixed(6)),
        ]);

        // Auto-close ring if not closed
        if (coords.length > 0) {
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            coords.push([first[0], first[1]]);
          }
        }

        // Remove the temporary layer geoman created
        map.removeLayer(e.layer);

        // Turn off drawing mode
        if (map.pm.Draw?.Polygon?.active()) {
          map.pm.disableDraw();
        }

        if (onPolygonDrawn) {
          onPolygonDrawn(coords);
        }
      }
    };

    map.on('pm:create', handleCreate);

    return () => {
      map.off('pm:create', handleCreate);
      if (map.pm.Draw?.Polygon?.active()) {
        map.pm.disableDraw();
      }
    };
  }, [map, onPolygonDrawn]);

  useEffect(() => {
    if (!map || !map.pm) return;

    if (drawEnabled) {
      map.pm.enableDraw('Polygon', {
        snappable: true,
        snapDistance: 20,
        finishOn: 'dblclick',
        allowSelfIntersection: false,
      });
    } else {
      if (map.pm.Draw?.Polygon?.active()) {
        map.pm.disableDraw();
      }
    }
  }, [map, drawEnabled]);

  return null;
}

// Helper component for focusing / bounds fitting
function MapFocusHandler({
  geofences,
  vehicles,
  fitToData,
  focusGeofenceId,
  focusVehicleId,
}) {
  const map = useMap();
  const prevFocusGeoRef = useRef(null);
  const prevFocusVehRef = useRef(null);

  // Focus specific geofence
  useEffect(() => {
    if (focusGeofenceId && focusGeofenceId !== prevFocusGeoRef.current && geofences?.length) {
      const geo = geofences.find((g) => g.geofence_id === focusGeofenceId);
      if (geo?.coordinates?.length) {
        const bounds = L.latLngBounds(geo.coordinates);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
          prevFocusGeoRef.current = focusGeofenceId;
        }
      }
    }
  }, [focusGeofenceId, geofences, map]);

  // Focus specific vehicle
  useEffect(() => {
    if (focusVehicleId && focusVehicleId !== prevFocusVehRef.current && vehicles?.length) {
      const v = vehicles.find((veh) => veh.vehicle_id === focusVehicleId);
      const lat = v?.location?.latitude ?? v?.latitude;
      const lon = v?.location?.longitude ?? v?.longitude;
      if (lat !== undefined && lon !== undefined) {
        map.flyTo([lat, lon], 16, { duration: 1.2 });
        prevFocusVehRef.current = focusVehicleId;
      }
    }
  }, [focusVehicleId, vehicles, map]);

  // Auto-fit to all visible data
  useEffect(() => {
    if (!fitToData) return;
    const allCoords = [];
    geofences?.forEach((g) => {
      if (g.coordinates?.length) {
        allCoords.push(...g.coordinates);
      }
    });
    vehicles?.forEach((v) => {
      const lat = v.location?.latitude ?? v.latitude;
      const lon = v.location?.longitude ?? v.longitude;
      if (lat !== undefined && lon !== undefined) {
        allCoords.push([lat, lon]);
      }
    });

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [fitToData, geofences, vehicles, map]);

  return null;
}

export function MapView({
  geofences = [],
  vehicles = [],
  pickedPoint = null,
  onMapClick,
  drawEnabled = false,
  onPolygonDrawn,
  previewPolygon = null,
  fitToData = false,
  focusGeofenceId = null,
  focusVehicleId = null,
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  className = 'w-full h-full min-h-[400px]',
  showLegend = true,
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Handlers */}
        {onMapClick && <MapEventsHandler onMapClick={onMapClick} />}
        <GeomanHandler drawEnabled={drawEnabled} onPolygonDrawn={onPolygonDrawn} />
        <MapFocusHandler
          geofences={geofences}
          vehicles={vehicles}
          fitToData={fitToData}
          focusGeofenceId={focusGeofenceId}
          focusVehicleId={focusVehicleId}
        />

        {/* Render Active Geofences */}
        {geofences.map((geo) => {
          const cat = CATEGORIES[geo.category] || {
            color: '#6366f1',
            fillColor: '#818cf8',
            label: geo.category,
          };
          const isFocused = focusGeofenceId === geo.geofence_id;

          return (
            <Polygon
              key={geo.geofence_id}
              positions={geo.coordinates}
              pathOptions={{
                color: cat.color,
                fillColor: cat.fillColor || cat.color,
                fillOpacity: isFocused ? 0.4 : 0.2,
                weight: isFocused ? 3 : 2,
              }}
            >
              <Popup className="custom-leaflet-popup">
                <div className="p-1 min-w-[180px]">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <CategoryBadge category={geo.category} size="xs" />
                    <span className="font-mono text-[10px] text-slate-400">
                      {geo.coordinates?.length} pts
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{geo.name}</h4>
                  {geo.description && (
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                      {geo.description}
                    </p>
                  )}
                  <div className="mt-2 pt-1.5 border-t border-slate-200 text-[10px] font-mono text-slate-400">
                    ID: {geo.geofence_id}
                  </div>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {/* Render Preview Polygon (dashed outline) */}
        {previewPolygon && previewPolygon.length >= 2 && (
          <Polygon
            positions={previewPolygon}
            pathOptions={{
              color: '#38bdf8', // sky-400
              fillColor: '#0284c7',
              fillOpacity: 0.15,
              weight: 2,
              dashArray: '6, 6',
            }}
          />
        )}

        {/* Render Picked Point Marker */}
        {pickedPoint && (
          <Marker position={pickedPoint} icon={pickedPointIcon}>
            <Popup>
              <div className="text-xs font-mono p-1">
                <p className="font-semibold text-slate-800">Picked Location</p>
                <p className="text-slate-600">
                  {pickedPoint[0]?.toFixed(5)}, {pickedPoint[1]?.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Render Vehicles with Known Locations */}
        {vehicles.map((v) => {
          const lat = v.location?.latitude ?? v.latitude;
          const lon = v.location?.longitude ?? v.longitude;
          if (lat === undefined || lon === undefined || lat === null || lon === null) {
            return null;
          }

          const isFocused = focusVehicleId === v.vehicle_id;

          return (
            <Marker
              key={v.vehicle_id}
              position={[lat, lon]}
              icon={createVehicleIcon(isFocused)}
            >
              <Popup className="custom-leaflet-popup">
                <div className="p-1 min-w-[190px]">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {v.vehicle_number}
                    </span>
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {v.vehicle_type || 'Vehicle'}
                    </span>
                  </div>
                  {v.driver_name && (
                    <p className="text-xs text-slate-600">
                      Driver: <span className="font-medium text-slate-800">{v.driver_name}</span>
                    </p>
                  )}
                  {v.phone && (
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Tel: {v.phone}
                    </p>
                  )}
                  <div className="mt-2 pt-1.5 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Navigation className="w-2.5 h-2.5" />
                      {lat.toFixed(4)}, {lon.toFixed(4)}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Legend Overlay */}
      {showLegend && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-2.5 shadow-xl flex flex-wrap gap-3 items-center pointer-events-auto">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Zones
          </span>
          {Object.values(CATEGORIES).map((cat) => (
            <div key={cat.id} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shadow-sm"
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-xs text-slate-300 font-medium">{cat.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default MapView;
