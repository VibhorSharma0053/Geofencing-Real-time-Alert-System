import React from 'react';
import { CATEGORIES } from '../constants';
import { CategoryBadge } from './CategoryBadge';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import { EmptyState } from './EmptyState';
import { Shield, ChevronRight, RefreshCw, Calendar, MapPin } from 'lucide-react';

export function GeofenceList({
  geofences = [],
  selectedCategory,
  onSelectCategory,
  onSelectGeofence,
  selectedGeofenceId,
  loading = false,
  error = null,
  onRetry,
}) {
  const categoriesList = [
    { id: 'all', label: 'All Zones' },
    ...Object.values(CATEGORIES),
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl flex flex-col h-full">
      {/* Header & Filter chips */}
      <div className="space-y-3 pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Configured Geofences</h2>
          </div>
          <button
            onClick={onRetry}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categoriesList.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[300px]">
        {loading && (
          <div className="py-12">
            <LoadingSpinner message="Loading geofences..." />
          </div>
        )}

        {error && !loading && (
          <ErrorMessage
            title="Unable to load geofences"
            message={error.message || 'Check if the backend is running.'}
            onRetry={onRetry}
          />
        )}

        {!loading && !error && geofences.length === 0 && (
          <EmptyState
            icon={Shield}
            title="No Geofences in Category"
            description="No geofences match your selected filter. Switch filters or draw a new boundary."
          />
        )}

        {!loading && !error && geofences.length > 0 && (
          <div className="space-y-2">
            {geofences.map((geo) => {
              const isSelected = selectedGeofenceId === geo.geofence_id;
              return (
                <div
                  key={geo.geofence_id}
                  onClick={() => onSelectGeofence && onSelectGeofence(geo)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CategoryBadge category={geo.category} size="xs" />
                        <span className="text-[10px] font-mono text-slate-500">
                          {geo.geofence_id}
                        </span>
                      </div>
                      <h3 className="font-semibold text-white text-sm truncate">
                        {geo.name}
                      </h3>
                      {geo.description && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {geo.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 mt-1 transition-transform ${
                        isSelected ? 'text-indigo-400 translate-x-0.5' : 'text-slate-600'
                      }`}
                    />
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {geo.coordinates?.length || 0} vertices
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {geo.created_at ? new Date(geo.created_at).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
export default GeofenceList;
