import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, Plus, X } from 'lucide-react';

import { DEFAULT_LINE_AREAS } from '../../pages/pdca/data/pdcaConstants.js';
export { DEFAULT_LINE_AREAS };

export default function SearchableLineAreaSelect({
  value = '',
  onChange,
  placeholder = 'Select Line/Area...',
  className = '',
  disabled = false,
  apiLines = []
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Combine default, API, and currently saved value
  const allOptions = useMemo(() => {
    const set = new Set();
    if (value && value.trim()) set.add(value.trim());
    (Array.isArray(apiLines) ? apiLines : []).forEach((item) => {
      const name = typeof item === 'string' ? item : item?.name;
      if (name && name.trim()) set.add(name.trim());
    });
    DEFAULT_LINE_AREAS.forEach((opt) => set.add(opt));
    return Array.from(set);
  }, [value, apiLines]);

  // Filter options by search term
  const filteredOptions = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return allOptions;
    return allOptions.filter((opt) => opt.toLowerCase().includes(q));
  }, [allOptions, searchTerm]);

  const handleSelect = (selected) => {
    onChange?.(selected);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleCreateCustom = () => {
    const trimmed = searchTerm.trim();
    if (trimmed) {
      handleSelect(trimmed);
    }
  };

  const isExactMatch = allOptions.some(
    (opt) => opt.toLowerCase() === searchTerm.toLowerCase().trim()
  );

  return (
    <div ref={containerRef} className={`relative inline-block w-full text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchTerm('');
          }
        }}
        className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 text-xs text-slate-800 bg-white border border-slate-400 rounded-md shadow-2xs hover:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
        }`}
        title={value || placeholder}
      >
        <span className={`truncate text-left ${value ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
          {value || placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-[9999] top-full left-0 mt-1 w-64 max-w-[90vw] bg-white border-2 border-slate-500 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Bar */}
          <div className="p-2 border-b border-slate-300 bg-slate-50 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredOptions.length > 0) {
                    handleSelect(filteredOptions[0]);
                  } else if (searchTerm.trim()) {
                    handleCreateCustom();
                  }
                } else if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
              placeholder="Search or enter Line/Area..."
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 py-1 text-xs">
            {/* Custom Add Option if not matching */}
            {searchTerm.trim() && !isExactMatch && (
              <button
                type="button"
                onClick={handleCreateCustom}
                className="w-full text-left px-3 py-1.5 flex items-center gap-1.5 text-blue-700 bg-blue-50/70 hover:bg-blue-100 transition-colors font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Use &quot;{searchTerm.trim()}&quot;</span>
              </button>
            )}

            {filteredOptions.length === 0 && !searchTerm.trim() ? (
              <div className="p-3 text-center text-slate-400 text-xs">
                No Line/Area options available
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt === value;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between text-xs hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/80 font-bold text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">{opt}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer with Clear option */}
          {value && (
            <div className="p-1.5 border-t border-slate-200 bg-slate-50 text-right">
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="text-[11px] text-slate-500 hover:text-rose-600 font-medium px-2 py-0.5 rounded cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
