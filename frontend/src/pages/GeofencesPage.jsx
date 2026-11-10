import React, { useState, useEffect, useCallback } from 'react';
import { getGeofences } from '../api/geofences';
import { MapView } from '../components/MapView';
import { GeofenceForm } from '../components/GeofenceForm';
import { GeofenceList } from '../components/GeofenceList';
import { useAsync } from '../hooks/useAsync';
import { Shield, Plus, List } from 'lucide-react';

export function GeofencesPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedGeofenceId, setSelectedGeofenceId] = useState(null);
  const [formCoordinates, setFormCoordinates] = useState([]);
  const [drawEnabled, setDrawEnabled] = useState(false);
  const [activeSideTab, setActiveSideTab] = useState('create'); // 'create' | 'list'

  // Fetch geofences with category filter
  const fetchGeofences = useCallback(async () => {
    const params = {};
    if (selectedCategory && selectedCategory !== 'all') {
      params.category = selectedCategory;
    }
    const res = await getGeofences(params);
    return res.geofences || [];
  }, [selectedCategory]);

  const { data: geofences = [], loading, error, execute: reloadGeofences } = useAsync(
    fetchGeofences,
    true
  );

  // When polygon is drawn via MapView Geoman handler
  const handlePolygonDrawn = useCallback((coords) => {
    setFormCoordinates(coords);
    setDrawEnabled(false);
    setActiveSideTab('create');
  }, []);

  const handleSelectGeofence = useCallback((geo) => {
    setSelectedGeofenceId(geo.geofence_id);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setFormCoordinates([]);
    setDrawEnabled(false);
    reloadGeofences();
    setActiveSideTab('list');
  }, [reloadGeofences]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Top Banner on Mobile / Quick switch */}
      <div className="lg:hidden bg-slate-900 border-b border-slate-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-white text-sm">Geofences</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveSideTab('create')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold ${
              activeSideTab === 'create'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>
          <button
            onClick={() => setActiveSideTab('list')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold ${
              activeSideTab === 'list'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List ({geofences.length})</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Form/List on one side, Map on the other */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 h-full overflow-hidden">
        {/* Left Side: Form and List Tabs/Panels */}
        <div className="lg:col-span-5 xl:col-span-4 h-full flex flex-col bg-slate-950 border-r border-slate-800 overflow-y-auto p-4 space-y-4">
          {/* Desktop tab toggle */}
          <div className="hidden lg:flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 w-full">
              <button
                type="button"
                onClick={() => setActiveSideTab('create')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeSideTab === 'create'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Create Geofence</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSideTab('list')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeSideTab === 'list'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <List className="w-4 h-4" />
                <span>Geofences List ({geofences.length})</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1">
            {activeSideTab === 'create' ? (
              <GeofenceForm
                coordinates={formCoordinates}
                setCoordinates={setFormCoordinates}
                drawEnabled={drawEnabled}
                setDrawEnabled={setDrawEnabled}
                onSuccess={handleCreateSuccess}
              />
            ) : (
              <GeofenceList
                geofences={geofences}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onSelectGeofence={handleSelectGeofence}
                selectedGeofenceId={selectedGeofenceId}
                loading={loading}
                error={error}
                onRetry={reloadGeofences}
              />
            )}
          </div>
        </div>

        {/* Right Side: Map Canvas */}
        <div className="lg:col-span-7 xl:col-span-8 h-full relative min-h-[400px]">
          <MapView
            geofences={geofences}
            previewPolygon={formCoordinates}
            drawEnabled={drawEnabled}
            onPolygonDrawn={handlePolygonDrawn}
            focusGeofenceId={selectedGeofenceId}
            fitToData={geofences.length > 0 && !selectedGeofenceId}
            className="w-full h-full"
            showLegend={true}
          />
        </div>
      </div>
    </div>
  );
}
export default GeofencesPage;
