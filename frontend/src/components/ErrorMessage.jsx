import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function ErrorMessage({ error, onRetry }) {
  const message = error?.message || (typeof error === 'string' ? error : 'An unexpected error occurred.');
  const details = error?.details;

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-200">{message}</p>
          {Array.isArray(details) && details.length > 0 && (
            <ul className="mt-2 list-disc list-inside space-y-0.5 text-xs text-red-300/80">
              {details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
