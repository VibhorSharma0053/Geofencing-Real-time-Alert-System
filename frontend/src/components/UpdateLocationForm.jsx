import React, { useState, useEffect } from 'react';
import { postLocation } from '../api/locations';
import { ResultCard } from './ResultCard';
import { Navigation, Clock, Loader2, Send, MapPin, Truck } from 'lucide-react';
import toast from 'react-hot-toast';

function getLocalDateTimeString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function UpdateLocationForm({
  vehicles = [],
  pickedPoint = null,
  onPickedPointChange,
  onSuccess,
}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [timestamp, setTimestamp] = useState(getLocalDateTimeString());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});

  // Select first vehicle by default when vehicles load
  useEffect(() => {
    if (!selectedVehicleId && vehicles.length > 0) {
      setSelectedVehicleId(vehicles[0].vehicle_id);
    }
  }, [vehicles, selectedVehicleId]);

  // Synchronize inputs when map is clicked (pickedPoint changes from outside)
  useEffect(() => {
    if (pickedPoint && pickedPoint.length === 2) {
      setLatitude(pickedPoint[0].toString());
      setLongitude(pickedPoint[1].toString());
      if (errors.lat || errors.lon) {
        setErrors((prev) => ({ ...prev, lat: null, lon: null }));
      }
    }
  }, [pickedPoint]);

  // When user types lat/lon, update pickedPoint
  const handleLatChange = (e) => {
    const val = e.target.value;
    setLatitude(val);
    const numLat = parseFloat(val);
    const numLon = parseFloat(longitude);
    if (!isNaN(numLat) && !isNaN(numLon) && onPickedPointChange) {
      onPickedPointChange([numLat, numLon]);
    }
  };

  const handleLonChange = (e) => {
    const val = e.target.value;
    setLongitude(val);
    const numLat = parseFloat(latitude);
    const numLon = parseFloat(val);
    if (!isNaN(numLat) && !isNaN(numLon) && onPickedPointChange) {
      onPickedPointChange([numLat, numLon]);
    }
  };

  const handleUseCurrentTime = () => {
    setTimestamp(getLocalDateTimeString(new Date()));
  };

  const validate = () => {
    const errs = {};
    if (!selectedVehicleId) {
      errs.vehicle = 'Please select a vehicle';
    }

    const latNum = parseFloat(latitude);
    if (latitude === '' || isNaN(latNum)) {
      errs.lat = 'Latitude is required';
    } else if (latNum < -90 || latNum > 90) {
      errs.lat = 'Latitude must be between -90 and 90';
    }

    const lonNum = parseFloat(longitude);
    if (longitude === '' || isNaN(lonNum)) {
      errs.lon = 'Longitude is required';
    } else if (lonNum < -180 || lonNum > 180) {
      errs.lon = 'Longitude must be between -180 and 180';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const isoUtcTimestamp = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
      const payload = {
        vehicle_id: selectedVehicleId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: isoUtcTimestamp,
      };

      const res = await postLocation(payload);
      setResult(res);
      toast.success('Vehicle location updated');

      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update location');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">Update Location Ping</h2>
        </div>
        <span className="text-[11px] text-slate-400 font-medium">Click map to set point</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Vehicle Select */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
            Vehicle <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <select
              value={selectedVehicleId}
              onChange={(e) => {
                setSelectedVehicleId(e.target.value);
                if (errors.vehicle) setErrors((prev) => ({ ...prev, vehicle: null }));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {vehicles.length === 0 ? (
                <option value="">No vehicles registered</option>
              ) : (
                vehicles.map((v) => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>
                    {v.vehicle_number} {v.driver_name ? `(${v.driver_name})` : ''} - {v.vehicle_type || 'truck'}
                  </option>
                ))
              )}
            </select>
          </div>
          {errors.vehicle && (
            <p className="text-xs text-red-400 mt-1">{errors.vehicle}</p>
          )}
        </div>

        {/* Coordinates Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Latitude <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={handleLatChange}
              placeholder="37.7749"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.lat && <p className="text-[11px] text-red-400 mt-1">{errors.lat}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Longitude <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={handleLonChange}
              placeholder="-122.4194"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.lon && <p className="text-[11px] text-red-400 mt-1">{errors.lon}</p>}
          </div>
        </div>

        {/* Timestamp */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Timestamp (UTC)
            </label>
            <button
              type="button"
              onClick={handleUseCurrentTime}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <Clock className="w-3 h-3" />
              <span>Use current time</span>
            </button>
          </div>
          <input
            type="datetime-local"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || vehicles.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-600/30 transition-all uppercase tracking-wider"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Transmitting Ping...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Transmit Location Ping</span>
            </>
          )}
        </button>
      </form>

      {/* Result Card */}
      {result && <ResultCard result={result} />}
    </div>
  );
}
export default UpdateLocationForm;
