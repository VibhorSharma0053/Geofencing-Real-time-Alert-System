import React, { useState } from 'react';
import { CATEGORIES } from '../constants';
import { createGeofence } from '../api/geofences';
import { CoordinateInput, isRingClosed, countUniquePoints } from './CoordinateInput';
import { Shield, Plus, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function GeofenceForm({
  coordinates = [],
  setCoordinates,
  drawEnabled,
  setDrawEnabled,
  onSuccess,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('delivery_zone');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  const validate = () => {
    const errs = {};
    if (!name.trim()) {
      errs.name = 'Geofence name is required';
    } else if (name.trim().length > 100) {
      errs.name = 'Name must be 100 characters or less';
    }

    if (!category || !CATEGORIES[category]) {
      errs.category = 'A valid category must be selected';
    }

    if (!coordinates || coordinates.length === 0) {
      errs.coordinates = 'Coordinates are required. Draw a polygon or enter points.';
    } else {
      const unique = countUniquePoints(coordinates);
      if (unique < 3) {
        errs.coordinates = `A valid polygon requires at least 3 unique points (current: ${unique})`;
      } else if (!isRingClosed(coordinates)) {
        errs.coordinates = 'The polygon boundary must be closed (first point must equal last point).';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        coordinates,
      };
      if (description.trim()) {
        payload.description = description.trim();
      }

      await createGeofence(payload);
      toast.success('Geofence created successfully');

      // Reset form
      setName('');
      setDescription('');
      setCategory('delivery_zone');
      setCoordinates([]);
      setErrors({});
      if (setDrawEnabled) setDrawEnabled(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const msg = err.message || 'Failed to create geofence';
      setApiError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl"
    >
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
        <Shield className="w-5 h-5 text-indigo-400" />
        <h2 className="text-base font-bold text-white">Create New Geofence</h2>
      </div>

      {apiError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Geofence Name */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
          }}
          placeholder="e.g. Downtown Delivery Hub"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.name && (
          <p className="text-xs text-red-400 mt-1 font-medium">{errors.name}</p>
        )}
      </div>

      {/* Category Select */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Category <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(CATEGORIES).map((cat) => {
            const isSelected = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setCategory(cat.id);
                  if (errors.category) setErrors((prev) => ({ ...prev, category: null }));
                }}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium text-left transition-all ${
                  isSelected
                    ? 'bg-slate-800 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="truncate">{cat.label}</span>
              </button>
            );
          })}
        </div>
        {errors.category && (
          <p className="text-xs text-red-400 mt-1 font-medium">{errors.category}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Description <span className="text-slate-500 normal-case font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. High priority delivery hub zone"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Coordinates component */}
      <CoordinateInput
        value={coordinates}
        onChange={(coords) => {
          setCoordinates(coords);
          if (errors.coordinates) setErrors((prev) => ({ ...prev, coordinates: null }));
        }}
        drawEnabled={drawEnabled}
        setDrawEnabled={setDrawEnabled}
        error={errors.coordinates}
      />

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-lg shadow-indigo-600/30 transition-all"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creating Geofence...</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Create Geofence</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
export default GeofenceForm;
