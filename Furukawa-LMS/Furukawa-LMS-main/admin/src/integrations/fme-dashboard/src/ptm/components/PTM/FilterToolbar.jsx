import React from 'react';
import { 
  Search, 
  FileSpreadsheet, 
  Plus 
} from 'lucide-react';

export default function FilterToolbar({
  searchQuery,
  setSearchQuery,
  onExport,
  onOpenAddModal
}) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      {/* Search Bar - wide rounded-xl input */}
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by topic, description, created by, or PTM ID..."
          className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-11 pr-4 py-2.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded bg-slate-100"
          >
            Clear
          </button>
        )}
      </div>

      {/* Action Buttons: Export Excel and + Add PTM */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Export Excel Button */}
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-600 hover:bg-slate-50 rounded-xl text-xs font-bold border border-slate-200/80 transition-colors shadow-sm cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          <span>Export Excel</span>
        </button>

        {/* Add PTM Button */}
        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add PTM</span>
        </button>
      </div>
    </div>
  );
}
