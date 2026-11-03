import React, { useState } from 'react';
import { BarChart3, Eye } from 'lucide-react';
import PDCAMonthlyGraph from './PDCAMonthlyGraph';

/**
 * PDCA status graph shown above the PDCA sheet,
 * with a Hide / Show toggle.
 */
export default function PDCAGraphSection({ rows = [], currentDate = '', topic = null }) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return (
      <div className="w-full shrink-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-xs">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          PDCA Status Graph
          <span className="text-xs font-normal text-slate-400">(hidden)</span>
        </span>
        <button
          type="button"
          onClick={() => setIsVisible(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
          title="Show graph"
        >
          <Eye className="w-3.5 h-3.5" />
          Show Graph
        </button>
      </div>
    );
  }

  return (
    <PDCAMonthlyGraph
      rows={rows}
      currentDate={currentDate}
      topic={topic}
      onHide={() => setIsVisible(false)}
    />
  );
}
