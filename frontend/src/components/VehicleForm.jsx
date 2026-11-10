import React, { useState } from 'react';
import { VEHICLE_TYPES } from '../constants';
import { createVehicle } from '../api/vehicles';
import { Truck, Plus, Loader2, AlertCircle, Phone, User, Hash } from 'lucide-react';
import toast from 'react-hot-toast';

export function VehicleForm({ onSuccess }) {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleType, setVehicleType] = useState('truck');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [conflictError, setConflictError] = useState(null);

  const validate = () => {
    const errs = {};
    const trimmedNum = vehicleNumber.trim();
    if (!trimmedNum) {
      errs.vehicleNumber = 'Vehicle number / license plate is required';
    } else if (trimmedNum.length < 2 || trimmedNum.length > 32) {
      errs.vehicleNumber = 'Vehicle number must be between 2 and 32 characters';
    }

    if (!vehicleType) {
      errs.vehicleType = 'Vehicle type is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setConflictError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        vehicle_number: vehicleNumber.trim().toUpperCase(),
        vehicle_type: vehicleType,
      };
      if (driverName.trim()) {
        payload.driver_name = driverName.trim();
      }
      if (phone.trim()) {
        payload.phone = phone.trim();
      }

      await createVehicle(payload);
      toast.success(`Vehicle ${payload.vehicle_number} registered successfully`);

      // Reset form
      setVehicleNumber('');
      setDriverName('');
      setVehicleType('truck');
      setPhone('');
      setErrors({});

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      if (err.status === 409 || err.message?.toLowerCase().includes('already exists')) {
        setConflictError(
          `Vehicle number "${vehicleNumber.trim().toUpperCase()}" is already registered. Vehicle numbers must be unique.`
        );
      } else {
        toast.error(err.message || 'Failed to register vehicle');
      }
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
        <Truck className="w-5 h-5 text-indigo-400" />
        <h2 className="text-base font-bold text-white">Register Fleet Vehicle</h2>
      </div>

      {conflictError && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
          <span>{conflictError}</span>
        </div>
      )}

      {/* Vehicle Number */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Vehicle Number / Plate <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <Hash className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={vehicleNumber}
            onChange={(e) => {
              setVehicleNumber(e.target.value);
              if (errors.vehicleNumber) setErrors((prev) => ({ ...prev, vehicleNumber: null }));
              if (conflictError) setConflictError(null);
            }}
            placeholder="e.g. TRK-1049"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 uppercase font-mono placeholder:normal-case placeholder:font-sans placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {errors.vehicleNumber && (
          <p className="text-xs text-red-400 mt-1 font-medium">{errors.vehicleNumber}</p>
        )}
      </div>

      {/* Driver Name */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Assigned Driver <span className="text-slate-500 normal-case font-normal">(optional)</span>
        </label>
        <div className="relative">
          <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="e.g. Alex Morgan"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Vehicle Type Select */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Vehicle Type <span className="text-red-400">*</span>
        </label>
        <select
          value={vehicleType}
          onChange={(e) => {
            setVehicleType(e.target.value);
            if (errors.vehicleType) setErrors((prev) => ({ ...prev, vehicleType: null }));
          }}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {VEHICLE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {errors.vehicleType && (
          <p className="text-xs text-red-400 mt-1 font-medium">{errors.vehicleType}</p>
        )}
      </div>

      {/* Driver Phone */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Phone Number <span className="text-slate-500 normal-case font-normal">(optional)</span>
        </label>
        <div className="relative">
          <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +1 555-019-2834"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 font-mono placeholder:font-sans placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

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
              <span>Registering Vehicle...</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Register Vehicle</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
export default VehicleForm;
