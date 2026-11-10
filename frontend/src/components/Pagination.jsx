import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ totalCount = 0, limit = 50, offset = 0, onPageChange }) {
  if (totalCount === 0) return null;

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const startItem = offset + 1;
  const endItem = Math.min(offset + limit, totalCount);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-t border-slate-800 text-xs text-slate-400">
      <div>
        Showing <span className="font-semibold text-white">{startItem}</span> to{' '}
        <span className="font-semibold text-white">{endItem}</span> of{' '}
        <span className="font-semibold text-white">{totalCount}</span> events
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          disabled={offset === 0}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>

        <span className="px-2 font-mono text-slate-300">
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() => onPageChange(offset + limit)}
          disabled={offset + limit >= totalCount}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
export default Pagination;
