import React, { useState, useRef, useEffect } from 'react';
import { postLocation } from '../api/locations';
import { Play, Square, Loader2, Navigation, Compass, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function MovementSimulator({
  vehicles = [],
  geofences = [],
  onStepPing,
  onPickStart,
  onPickEnd,
}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 8;

  // Default trajectory across SF Downtown (crosses zones)
  const [startPoint, setStartPoint] = useState([37.7700, -122.4300]);
  const [endPoint, setEndPoint] = useState([37.7850, -122.4050]);

  const timerRef = useRef(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!selectedVehicleId && vehicles.length > 0) {
      setSelectedVehicleId(vehicles[0].vehicle_id);
    }
  }, [vehicles, selectedVehicleId]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const stopSimulation = () => {
    runningRef.current = false;
    setIsRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startSimulation = () => {
    if (!selectedVehicleId) {
      toast.error('Select a vehicle first');
      return;
    }

    setIsRunning(true);
    runningRef.current = true;
    setCurrentStep(0);

    let step = 0;
    const baseTime = Date.now();

    const executeStep = async (stepIndex) => {
      if (!runningRef.current) return;

      const factor = stepIndex / totalSteps;
      const lat = Number((startPoint[0] + (endPoint[0] - startPoint[0]) * factor).toFixed(6));
      const lon = Number((startPoint[1] + (endPoint[1] - startPoint[1]) * factor).toFixed(6));
      const stepTimestamp = new Date(baseTime + stepIndex * 2000).toISOString();

      try {
        const res = await postLocation({
          vehicle_id: selectedVehicleId,
          latitude: lat,
          longitude: lon,
          timestamp: stepTimestamp,
        });

        setCurrentStep(stepIndex + 1);
        if (onStepPing) {
          onStepPing(res, [lat, lon]);
        }
      } catch (err) {
        toast.error(`Step ping error: ${err.message}`);
      }

      if (stepIndex >= totalSteps) {
        stopSimulation();
        toast.success('Simulation path completed');
      }
    };

    // First ping immediately
    executeStep(0);

    timerRef.current = setInterval(() => {
      step++;
      if (step > totalSteps || !runningRef.current) {
        stopSimulation();
      } else {
        executeStep(step);
      }
    }, 1500);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">Drive Simulation Tool</h2>
        </div>
        {isRunning && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Simulating Drive
          </span>
        )}
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Interpolates sequential coordinates across geofence perimeters every 1.5s to trigger
        real-time boundary entry and exit alerts.
      </p>

      {/* Vehicle select */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
          Target Vehicle
        </label>
        <select
          value={selectedVehicleId}
          disabled={isRunning}
          onChange={(e) => setSelectedVehicleId(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
        >
          {vehicles.map((v) => (
            <option key={v.vehicle_id} value={v.vehicle_id}>
              {v.vehicle_number} {v.driver_name ? `(${v.driver_name})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Path preview */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-400">
        <div>
          <span className="text-slate-500 block uppercase font-sans text-[10px]">Start Point</span>
          <span>{startPoint[0].toFixed(4)}, {startPoint[1].toFixed(4)}</span>
        </div>
        <div>
          <span className="text-slate-500 block uppercase font-sans text-[10px]">End Point</span>
          <span>{endPoint[0].toFixed(4)}, {endPoint[1].toFixed(4)}</span>
        </div>
      </div>

      {/* Progress */}
      {isRunning && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400 font-mono">
            <span>Progress: Step {currentStep} of {totalSteps}</span>
            <span>{Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="bg-indigo-500 h-2 transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="pt-1">
        {isRunning ? (
          <button
            type="button"
            onClick={stopSimulation}
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-red-600/30 transition-all uppercase tracking-wider"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Stop Simulation</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startSimulation}
            disabled={vehicles.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-600/30 transition-all uppercase tracking-wider"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Drive Through Zone</span>
          </button>
        )}
      </div>
    </div>
  );
}
export default MovementSimulator;
