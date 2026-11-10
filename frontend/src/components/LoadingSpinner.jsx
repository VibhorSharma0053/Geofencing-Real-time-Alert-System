import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 'md', message = 'Loading...' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }[size] || 'w-6 h-6';

  return (
    <div className="flex flex-col items-center justify-center p-6 text-slate-400 gap-2">
      <Loader2 className={`${sizeClasses} animate-spin text-indigo-500`} />
      {message && <p className="text-xs font-medium tracking-wide">{message}</p>}
    </div>
  );
}
