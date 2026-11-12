import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function PTMTabNavigation({
  activeTab,
  setActiveTab,
  selectedUnit = 'Bawal',
  setSelectedUnit = () => {}
}) {
  const [isPlantDropdownOpen, setIsPlantDropdownOpen] = useState(false);
  const plantDropdownRef = useRef(null);

  const plantOptions = ['Bawal', 'Gujrat', 'All'];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (plantDropdownRef.current && !plantDropdownRef.current.contains(e.target)) {
        setIsPlantDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedCurrentPlant = !selectedUnit || selectedUnit === 'All Units' || selectedUnit === 'All Unit' || selectedUnit === 'All'
    ? 'All'
    : selectedUnit;

  const tabs = [
    { id: 'Company', label: 'Plant', isDropdown: true },
    { id: 'Department', label: 'Department' },
    { id: 'Self PTM', label: 'Self PTM' },
  ];

  return (
    <div className="bg-white rounded-2xl p-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ECEFF3] inline-flex flex-wrap items-center gap-1.5 max-w-full relative z-30">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        if (tab.isDropdown) {
          return (
            <div key={tab.id} className="relative inline-block" ref={plantDropdownRef}>
              <button
                type="button"
                id="ptm-plant-tab-button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsPlantDropdownOpen(!isPlantDropdownOpen);
                }}
                className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 ring-1 ring-black/5 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
                title="Select Plant"
              >
                <span>
                  {isActive
                    ? `Plant: ${normalizedCurrentPlant}`
                    : 'Plant'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isPlantDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPlantDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-44 bg-white rounded-2xl shadow-2xl border border-slate-200/80 py-2 z-50 text-xs font-semibold animate-in fade-in zoom-in-95">
                  <div className="px-3.5 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100 mb-1">
                    Select Plant
                  </div>
                  {plantOptions.map((p) => {
                    const isSelected = p === 'All'
                      ? normalizedCurrentPlant === 'All'
                      : selectedUnit === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setSelectedUnit(p);
                          setActiveTab('Company');
                          setIsPlantDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected ? 'font-bold text-blue-600 bg-blue-50/60' : 'text-slate-700'
                        }`}
                      >
                        <span>{p === 'Bawal' ? 'Bawal (Default Plant)' : p}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setIsPlantDropdownOpen(false);
            }}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 ring-1 ring-black/5 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
