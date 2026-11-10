import React from 'react';
import { CategoryBadge } from './CategoryBadge';
import { ShieldCheck, MapPin, Clock, Compass } from 'lucide-react';

export function ResultCard({ result }) {
  if (!result) return null;

  const geofences = result.current_geofences || [];
  const isInside = geofences.length > 0;
  const timeNs = result.time_ns ? Number(result.time_ns) : null;
  const latencyMs = timeNs ? (timeNs / 1_000_000).toFixed(2) : null;

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Location Update Processed
          </span>
        </div>
        {latencyMs && (
          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            {latencyMs} ms
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-300">
        <span className="font-mono text-slate-400">{result.vehicle_id}</span>
        <span className="flex items-center gap-1 font-mono text-[11px] text-indigo-300">
          <MapPin className="w-3 h-3" />
          {result.latitude?.toFixed(5)}, {result.longitude?.toFixed(5)}
        </span>
      </div>

      <div className="pt-2 border-t border-slate-800/80">
        <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
          <Compass className="w-3.5 h-3.5 text-slate-400" />
          <span>Spatial Containment:</span>
        </div>

        {isInside ? (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-slate-300 font-medium mr-1">Currently inside:</span>
            {geofences.map((g) => (
              <div key={g.geofence_id} className="inline-flex items-center gap-1.5">
                <CategoryBadge category={g.category} size="xs" />
                <span className="text-xs text-slate-200 font-medium">{g.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span>Outside all geofences</span>
          </div>
        )}
      </div>
    </div>
  );
}
export default ResultCard;
