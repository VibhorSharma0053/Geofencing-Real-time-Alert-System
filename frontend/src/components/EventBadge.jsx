import React from 'react';
import { EVENT_TYPES } from '../constants';
import { LogIn, LogOut } from 'lucide-react';

export function EventBadge({ eventType, size = 'sm' }) {
  const isEntry = eventType === 'entry';
  const ev = isEntry ? EVENT_TYPES.entry : EVENT_TYPES.exit;

  const sizeClasses =
    size === 'xs'
      ? 'text-[10px] px-1.5 py-0.5'
      : size === 'md'
      ? 'text-xs px-2.5 py-1'
      : 'text-[11px] px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full border uppercase tracking-wider ${ev.badgeClass} ${sizeClasses}`}
    >
      {isEntry ? (
        <LogIn className="w-3 h-3 text-emerald-400" />
      ) : (
        <LogOut className="w-3 h-3 text-amber-400" />
      )}
      <span>{isEntry ? 'Entry' : 'Exit'}</span>
    </span>
  );
}
export default EventBadge;
