import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, Plus, X } from 'lucide-react';

export default function SearchableApqpDropdown({
  value = '',
  onChange,
  onKeyDown,
  suggestions = [],
  onAddNewSuggestion,
  placeholder = 'Select requirement...',
  dataRow,
  dataCol,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Combine and deduplicate suggestions
  const allOptions = useMemo(() => {
    const set = new Set();
    if (value && value.trim()) set.add(value.trim());
    suggestions.forEach((s) => {
      if (s && String(s).trim()) set.add(String(s).trim());
    });
    return Array.from(set);
  }, [suggestions, value]);

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((opt) => opt.toLowerCase().includes(q));
  }, [allOptions, searchTerm]);

  const isExactMatch = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allOptions.some((opt) => opt.toLowerCase() === q);
  }, [allOptions, searchTerm]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (selectedVal) => {
    onChange?.({ target: { value: selectedVal } });
    if (onAddNewSuggestion && selectedVal && !allOptions.includes(selectedVal)) {
      onAddNewSuggestion(selectedVal);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleAddCustom = () => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    handleSelect(trimmed);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.({ target: { value: '' } });
  };

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[32px] flex items-center select-none">
      {/* Display button */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(true);
          } else {
            onKeyDown?.(e);
          }
        }}
        data-row={dataRow}
        data-col={dataCol}
        title={value || placeholder}
        className="w-full h-full min-h-[32px] px-2 py-1.5 flex items-center justify-between gap-1 text-xs cursor-pointer hover:bg-amber-50/60 focus:bg-amber-50 focus:ring-1 focus:ring-inset focus:ring-blue-500 rounded transition-colors"
      >
        <span className={`truncate text-left flex-1 ${value ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>

      {/* Searchable Dropdown Popup */}
      {isOpen && (
        <div className="absolute left-0 top-full z-[80] mt-1 w-[320px] max-w-[90vw] rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Box Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsOpen(false);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredOptions.length > 0) {
                    handleSelect(filteredOptions[0]);
                  } else if (searchTerm.trim()) {
                    handleAddCustom();
                  }
                }
              }}
              placeholder="Search or enter requirement..."
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
            />
          </div>

          {/* Add custom value option if typed query is not an existing exact match */}
          {searchTerm.trim() && !isExactMatch && (
            <div className="p-1.5 border-b border-slate-100 bg-blue-50/50">
              <button
                type="button"
                onClick={handleAddCustom}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-blue-700 hover:bg-blue-100/70 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">Use &quot;{searchTerm.trim()}&quot;</span>
              </button>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-50">
            {filteredOptions.length === 0 && !searchTerm.trim() ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                No requirements available
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-slate-500">
                Press Enter to use &quot;<span className="font-semibold text-slate-700">{searchTerm}</span>&quot;
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option === value;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{option}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

