import React from 'react';
import { Search, ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/common/ui/button.jsx';
import { PDCA_DEPARTMENTS, DEFAULT_LINE_AREAS } from '../../pages/pdca/data/pdcaConstants.js';

export default function CalibrationFilterBar({
  searchQuery,
  setSearchQuery,
  selectedDepartment,
  setSelectedDepartment,
  selectedSection,
  setSelectedSection,
  selectedExtraFilter,
  setSelectedExtraFilter,
  activeTabId = '',
  onAddChecksheet
}) {
  return (
    <div className="w-full min-w-0 flex flex-col md:flex-row items-center gap-2.5 bg-card text-card-foreground p-3 rounded-xl border border-border shadow-xs">
      {/* 1. Search Bar */}
      <div className="relative flex-1 min-w-0 w-full">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by topic, description, created by, or Calibration ID..."
          className="w-full h-9 bg-background border border-input rounded-lg pl-9 pr-14 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring shadow-xs transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 cursor-pointer font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {/* 2. Department Filter Dropdown */}
      <div className="relative flex-shrink-0 w-full md:w-auto">
        <select
          value={selectedDepartment || ''}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="w-full md:w-auto h-9 appearance-none bg-background border border-input text-foreground text-xs font-semibold rounded-lg pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-ring shadow-xs transition-all cursor-pointer"
        >
          <option value="">All Departments</option>
          {PDCA_DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* 3. Section Filter Dropdown */}
      <div className="relative flex-shrink-0 w-full md:w-auto">
        <select
          value={selectedSection || ''}
          onChange={(e) => setSelectedSection(e.target.value)}
          className="w-full md:w-auto h-9 appearance-none bg-background border border-input text-foreground text-xs font-semibold rounded-lg pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-ring shadow-xs transition-all cursor-pointer"
        >
          <option value="">All Sections</option>
          {DEFAULT_LINE_AREAS.map((sec) => (
            <option key={sec} value={sec}>
              {sec}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* 4. Extra Customizable Filter Dropdown (To be named per checksheet later) */}
      <div className="relative flex-shrink-0 w-full md:w-auto">
        <select
          value={selectedExtraFilter || ''}
          onChange={(e) => setSelectedExtraFilter(e.target.value)}
          className="w-full md:w-auto h-9 appearance-none bg-background border border-input text-foreground text-xs font-semibold rounded-lg pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-ring shadow-xs transition-all cursor-pointer"
        >
          <option value="">All Status / Filter</option>
          <option value="option-1">Option 1</option>
          <option value="option-2">Option 2</option>
          <option value="option-3">Option 3</option>
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* 5. Add Checksheet Button (Right Side) - hidden on procedure tab */}
      {activeTabId !== 'procedure' && onAddChecksheet && (
        <Button
          type="button"
          id="calibration-add-checksheet-btn"
          onClick={onAddChecksheet}
          className="w-full md:w-auto h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer"
          title="Add Checksheet"
        >
          <Plus className="w-4 h-4" />
          <span>Add Checksheet</span>
        </Button>
      )}
    </div>
  );
}
