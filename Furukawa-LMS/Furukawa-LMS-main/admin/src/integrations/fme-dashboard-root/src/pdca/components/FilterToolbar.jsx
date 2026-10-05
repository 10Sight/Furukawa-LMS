import React from 'react';
import { 
  Search, 
  FileSpreadsheet, 
  Plus, 
  ChevronDown,
  MapPin
} from 'lucide-react';

export default function FilterToolbar({
  selectedPlant,
  setSelectedPlant,
  searchQuery,
  setSearchQuery,
  onExport,
  onOpenAddModal
}) {
  const plants = [
    { value: 'Unit', label: 'Unit' },
    { value: 'Bawal', label: 'Bawal' },
    { value: 'Gujrat', label: 'Gujrat' }
  ];

  return (
    <div className="space-y-4">
      {/* 1. Unit Filter Row (On Top) */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <select
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            className="appearance-none bg-white border border-[#D1D5DB] text-slate-700 text-sm font-semibold rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 cursor-pointer shadow-sm hover:border-slate-400 transition-colors"
            id="plant-filter-select"
          >
            {plants.map((plant) => (
              <option key={plant.value} value={plant.value}>
                {plant.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

export function TableActionBar({
  searchQuery,
  setSearchQuery,
  onExport,
  onOpenAddModal,
  activeTab = 'Company'
}) {
  const isCFT = activeTab === 'CFT';

  return (
    <div className="w-full min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-[#ECEFF3] shadow-[0_2px_6px_rgba(0,0,0,0.02)]">
      {/* Search Bar */}
      <div className="relative flex-1 min-w-0">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isCFT ? "Search by topic, member, description..." : "Search by topic, description, created by, or PDCA ID..."}
          className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl pl-11 pr-14 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white shadow-2xs transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded bg-slate-200 cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Buttons above Table */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold border border-blue-200 transition-colors shadow-2xs cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          <span>Export Excel</span>
        </button>

        <button
          onClick={onOpenAddModal}
          className={`flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer ${
            isCFT 
              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' 
              : 'bg-[#2563EB] hover:bg-blue-700 shadow-blue-500/20'
          }`}
          id={isCFT ? "add-cft-button" : "add-pdca-button"}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{isCFT ? 'Add CFT' : 'Add PDCA'}</span>
        </button>
      </div>
    </div>
  );
}
