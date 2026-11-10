import React from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({ icon: Icon = Inbox, title = 'No records found', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900/50 border border-slate-800 rounded-xl my-4">
      <div className="p-3 bg-slate-800/80 rounded-full text-slate-400 mb-3">
        <Icon className="w-8 h-8 opacity-70" />
      </div>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {description && <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">{description}</p>}
      {action}
    </div>
  );
}
