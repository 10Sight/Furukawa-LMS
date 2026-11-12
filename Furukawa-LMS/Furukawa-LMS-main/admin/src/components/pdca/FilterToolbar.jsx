import { PDCA_DEPARTMENTS } from '../../pages/pdca/data/pdcaConstants.js';
import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  FileSpreadsheet, 
  Plus, 
  ChevronDown,
  MapPin,
  Check
} from 'lucide-react';

export default function FilterToolbar({
  selectedPlant = 'Bawal',
  setSelectedPlant,
  searchQuery,
  setSearchQuery,
  onExport,
  onOpenAddModal,
  onExportAll
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const plantOptions = ['Bawal', 'Gujrat', 'All'];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedCurrent = !selectedPlant || selectedPlant === 'All Unit' || selectedPlant === 'All Units' || selectedPlant === 'All Plants' || selectedPlant === 'All'
    ? 'All'
    : selectedPlant;

  const displayLabel = normalizedCurrent === 'All' ? 'All' : normalizedCurrent;

  return (
    <div className="w-full">
      {/* 1. Plant Filter Dropdown (Positioned in Top-Left Corner) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative inline-block" ref={dropdownRef}>
            <button
              type="button"
              id="plant-dropdown-button"
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2.5 bg-white border border-[#D1D5DB] text-slate-800 text-sm font-semibold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 cursor-pointer shadow-xs hover:border-slate-400 transition-colors"
              title="Select Plant"
            >
              <span className="text-slate-500 font-medium">Plant:</span>
              <span className="font-bold text-slate-900">{displayLabel}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="absolute left-0 mt-1.5 w-36 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 text-xs font-semibold animate-in fade-in">
                {plantOptions.map((p) => {
                  const isSelected = p === 'All'
                    ? normalizedCurrent === 'All'
                    : selectedPlant === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setSelectedPlant(p);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected ? 'font-bold text-blue-600 bg-blue-50/60' : 'text-slate-700'
                      }`}
                    >
                      <span>{p}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top-Right Action Button */}
        {onExportAll && (
          <button
            type="button"
            onClick={onExportAll}
            title="Download all PDCA records"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            Export All Records
          </button>
        )}
      </div>
    </div>
  );
}

export function TableActionBar({
  searchQuery,
  setSearchQuery,
  onExport,
  onOpenAddModal,
  activeTab = 'Company',
  selectedDepartment = '',
  setSelectedDepartment = () => {}
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

      {/* Department Dropdown (shown only on Department tab) */}
      {activeTab === 'Department' && (
        <div className="relative flex-shrink-0">
          <select
            value={selectedDepartment || ''}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="appearance-none bg-[#F8FAFC] border border-[#E5E7EB] text-slate-700 text-xs font-semibold rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white shadow-2xs transition-all cursor-pointer"
            id="department-filter-select"
          >
            <option value="">All Departments</option>
            {PDCA_DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      )}

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
