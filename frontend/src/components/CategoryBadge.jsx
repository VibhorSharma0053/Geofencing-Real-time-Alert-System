import React from 'react';
import { CATEGORIES } from '../constants';

export function CategoryBadge({ category, size = 'sm', showDot = true, className = '' }) {
  const cat = CATEGORIES[category] || {
    id: category,
    label: category || 'Unknown',
    color: '#94a3b8',
    badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
  };

  const sizeClasses =
    size === 'xs'
      ? 'text-[10px] px-1.5 py-0.5'
      : size === 'md'
      ? 'text-xs px-2.5 py-1'
      : 'text-[11px] px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${cat.badgeClass} ${sizeClasses} ${className}`}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: cat.color }}
        />
      )}
      <span>{cat.label}</span>
    </span>
  );
}
export default CategoryBadge;
