import React, { useState, useEffect } from 'react';
import { Pencil, Code, Check, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';

export function parseCoordinatesText(text) {
  if (!text || !text.trim()) return { coords: [], error: null };
  const trimmed = text.trim();

  // Try JSON first: [[lat, lng], [lat, lng], ...]
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        return { coords: [], error: 'JSON must be an array of [latitude, longitude] pairs.' };
      }
      for (let i = 0; i < parsed.length; i++) {
        const pt = parsed[i];
        if (!Array.isArray(pt) || pt.length !== 2) {
          return { coords: [], error: `Point ${i + 1} must be an array of [lat, lng].` };
        }
        const lat = Number(pt[0]);
        const lon = Number(pt[1]);
        if (isNaN(lat) || isNaN(lon)) {
          return { coords: [], error: `Point ${i + 1} contains invalid numeric coordinates.` };
        }
        if (lat < -90 || lat > 90) {
          return { coords: [], error: `Point ${i + 1} latitude (${lat}) out of range [-90, 90].` };
        }
        if (lon < -180 || lon > 180) {
          return { coords: [], error: `Point ${i + 1} longitude (${lon}) out of range [-180, 180].` };
        }
      }
      return { coords: parsed.map((p) => [Number(p[0]), Number(p[1])]), error: null };
    } catch (e) {
      return { coords: [], error: `Invalid JSON format: ${e.message}` };
    }
  }

  // Line-by-line format: "37.77, -122.41"
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const coords = [];
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(/[,\s]+/).filter(Boolean);
    if (parts.length < 2) {
      return { coords: [], error: `Line ${i + 1} ("${lines[i]}") must have latitude and longitude.` };
    }
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    if (isNaN(lat) || isNaN(lon)) {
      return { coords: [], error: `Line ${i + 1} coordinates must be numbers.` };
    }
    if (lat < -90 || lat > 90) {
      return { coords: [], error: `Line ${i + 1} latitude (${lat}) out of range [-90, 90].` };
    }
    if (lon < -180 || lon > 180) {
      return { coords: [], error: `Line ${i + 1} longitude (${lon}) out of range [-180, 180].` };
    }
    coords.push([lat, lon]);
  }
  return { coords, error: null };
}

export function isRingClosed(coords) {
  if (!coords || coords.length < 2) return false;
  const first = coords[0];
  const last = coords[coords.length - 1];
  return Math.abs(first[0] - last[0]) < 1e-7 && Math.abs(first[1] - last[1]) < 1e-7;
}

export function closeRing(coords) {
  if (!coords || coords.length === 0) return [];
  if (isRingClosed(coords)) return [...coords];
  return [...coords, [coords[0][0], coords[0][1]]];
}

export function countUniquePoints(coords) {
  if (!coords || coords.length === 0) return 0;
  const set = new Set();
  coords.forEach(([lat, lng]) => {
    set.add(`${lat.toFixed(6)},${lng.toFixed(6)}`);
  });
  return set.size;
}

export function CoordinateInput({
  value = [],
  onChange,
  drawEnabled,
  setDrawEnabled,
  error,
}) {
  const [activeTab, setActiveTab] = useState('draw'); // 'draw' | 'manual'
  const [textInput, setTextInput] = useState('');
  const [parseError, setParseError] = useState(null);

  // Synchronize text representation when value changes externally (e.g., from drawing or reset)
  useEffect(() => {
    if (value && value.length > 0) {
      setTextInput(JSON.stringify(value));
    } else if (!value || value.length === 0) {
      setTextInput('');
      setParseError(null);
    }
  }, [value]);

  const handleTextChange = (e) => {
    const text = e.target.value;
    setTextInput(text);
    if (!text.trim()) {
      setParseError(null);
      onChange([]);
      return;
    }

    const { coords, error: pErr } = parseCoordinatesText(text);
    if (pErr) {
      setParseError(pErr);
    } else {
      setParseError(null);
      onChange(coords);
    }
  };

  const handleAutoClose = () => {
    if (value && value.length >= 3) {
      const closed = closeRing(value);
      onChange(closed);
      setTextInput(JSON.stringify(closed));
      setParseError(null);
    }
  };

  const handleClear = () => {
    onChange([]);
    setTextInput('');
    setParseError(null);
    if (setDrawEnabled) setDrawEnabled(false);
  };

  const closed = isRingClosed(value);
  const uniqueCount = countUniquePoints(value);

  return (
    <div className="space-y-3">
      {/* Mode selection tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Geofence Boundary Coordinates <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveTab('draw');
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'draw'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Draw on Map</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('manual');
              if (setDrawEnabled) setDrawEnabled(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'manual'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Enter Coordinates</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Draw on map */}
      {activeTab === 'draw' && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawEnabled(!drawEnabled)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                  drawEnabled
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{drawEnabled ? 'Cancel Drawing' : 'Start Drawing on Map'}</span>
              </button>

              {value.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:text-red-400 hover:bg-slate-700 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Point counters */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">
                Points: <strong className="text-slate-200">{value.length}</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">
                Unique: <strong className="text-slate-200">{uniqueCount}</strong>
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            {drawEnabled ? (
              <span className="text-indigo-400 font-medium">
                Click points on the map to create polygon vertices. Double-click or click the first point to finish.
              </span>
            ) : value.length > 0 ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Polygon captured successfully with closed boundary.
              </span>
            ) : (
              'Click "Start Drawing on Map" to sketch your geofence boundary visually.'
            )}
          </p>
        </div>
      )}

      {/* Tab 2: Manual Text Input */}
      {activeTab === 'manual' && (
        <div className="space-y-2">
          <textarea
            rows={5}
            value={textInput}
            onChange={handleTextChange}
            placeholder={`Enter JSON: [[37.77, -122.42], [37.78, -122.42], [37.78, -122.41], [37.77, -122.42]]\nOr lines:\n37.7749, -122.4194\n37.7849, -122.4194\n37.7849, -122.4094`}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-y"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Points: <strong className="text-slate-200">{value.length}</strong></span>
              <span>•</span>
              <span>Unique: <strong className="text-slate-200">{uniqueCount}</strong></span>
            </div>

            {value.length >= 3 && !closed && (
              <button
                type="button"
                onClick={handleAutoClose}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Auto-Close Polygon Ring</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Parse Error or General Validation Errors */}
      {parseError && (
        <p className="text-xs text-red-400 flex items-center gap-1.5 mt-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{parseError}</span>
        </p>
      )}

      {error && !parseError && (
        <p className="text-xs text-red-400 flex items-center gap-1.5 mt-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
export default CoordinateInput;
