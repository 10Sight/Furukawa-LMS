import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, X, Check, Building2, AlertCircle } from 'lucide-react';
import { fetchPdcaSections } from './CascadingLineAreaSelect.jsx';

import { VERIFIED_SECTION_MASTER, isSectionRelatedToDepartment } from '../../pages/pdca/data/pdcaSections.js';
export { VERIFIED_SECTION_MASTER, isSectionRelatedToDepartment };

const POPOVER_WIDTH = 300;
const POPOVER_MAX_HEIGHT = 340;

export default function SearchableSectionSelect({
  value = '',
  sectionId = null,
  sectionCode = '',
  department = '',
  onChange,
  placeholder = 'Section...',
  className = '',
  disabled = false,
  compact = true
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sections, setSections] = useState(VERIFIED_SECTION_MASTER);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef(null);
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);

  // Fetch live database sections on mount
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetchPdcaSections()
      .then((data) => {
        if (active && Array.isArray(data) && data.length > 0) {
          setSections(data);
        }
      })
      .catch((err) => {
        console.warn('Could not load sections from API, using verified master:', err);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Update floating popover position via portal
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const width = Math.max(POPOVER_WIDTH, rect.width);
    let left = rect.left;
    if (left + width > vw - 12) left = Math.max(12, vw - width - 12);
    const spaceBelow = vh - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(POPOVER_MAX_HEIGHT, Math.max(160, openUp ? spaceAbove : spaceBelow));
    setPopoverPos({
      left,
      width,
      maxHeight,
      ...(openUp ? { bottom: vh - rect.top + 4 } : { top: rect.bottom + 4 })
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    updatePosition();
    const onOutside = (e) => {
      if (containerRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      setIsOpen(false);
    };
    const onScrollOrResize = (e) => {
      if (popoverRef.current && e?.target && popoverRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    const t = setTimeout(() => searchInputRef.current?.focus(), 40);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Current display label
  const currentSection = useMemo(() => {
    if (sectionId != null) {
      const match = sections.find((s) => String(s.id) === String(sectionId));
      if (match) return match;
    }
    if (value && typeof value === 'string') {
      const matchByName = sections.find(
        (s) => s.name?.toLowerCase() === value.trim().toLowerCase()
      );
      if (matchByName) return matchByName;
    }
    return null;
  }, [sectionId, value, sections]);

  const displayLabel = currentSection ? currentSection.name : (value || '');

  // Filter sections by search and department relationship
  const filteredSections = useMemo(() => {
    let list = sections;

    // If department is selected, strictly filter to only related sections
    if (department && department.trim()) {
      list = list.filter((s) => isSectionRelatedToDepartment(s, department));
    }

    const q = searchTerm.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (s) =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.uniCode || '').toLowerCase().includes(q) ||
          (s.category && s.category.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [sections, searchTerm, department]);

  const handleSelect = (sec) => {
    onChange?.(sec.name, {
      sectionId: sec.id,
      sectionCode: sec.uniCode || '',
      category: sec.category || '',
      section: sec
    });
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.('', {
      sectionId: null,
      sectionCode: '',
      category: '',
      section: null
    });
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center ${className}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`w-full h-full min-h-[28px] px-1 py-0.5 flex items-center justify-between text-left cursor-pointer transition-colors group focus:outline-none focus:bg-blue-50/40 ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-50/70'
        }`}
        title={displayLabel ? `${displayLabel} ${currentSection?.uniCode ? `(${currentSection.uniCode})` : ''}` : 'Click to select Section'}
      >
        <span
          className={`truncate text-[14px] leading-tight block w-full text-center whitespace-nowrap ${
            displayLabel ? 'font-medium text-slate-800' : 'text-slate-400 italic'
          }`}
        >
          {displayLabel || placeholder}
        </span>

        {displayLabel && !disabled ? (
          <span
            onClick={handleClear}
            className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded transition-all cursor-pointer flex-shrink-0"
            title="Clear section"
          >
            <X className="w-2.5 h-2.5 stroke-[2.5]" />
          </span>
        ) : (
          <ChevronDown className="w-2.5 h-2.5 text-slate-400 flex-shrink-0 ml-0.5" />
        )}
      </button>

      {/* Floating Popover via Portal */}
      {isOpen &&
        popoverPos &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: popoverPos.top,
              bottom: popoverPos.bottom,
              left: popoverPos.left,
              width: popoverPos.width,
              maxHeight: popoverPos.maxHeight,
              zIndex: 9999
            }}
            className="bg-white rounded-lg shadow-xl border border-slate-200 flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Search Header */}
            <div className="p-2 border-b border-slate-100 bg-slate-50/80">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search Section Name or Code..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              {department && (
                <div className="flex items-center gap-1.5 mt-1.5 px-0.5 text-[10px] text-slate-500">
                  <span>Filtered for:</span>
                  <span className="font-semibold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {department}
                  </span>
                </div>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[260px]">
              {filteredSections.length > 0 ? (
                filteredSections.map((sec) => {
                  const isSelected =
                    (sectionId != null && String(sec.id) === String(sectionId)) ||
                    (!sectionId && value && sec.name?.toLowerCase() === value.trim().toLowerCase());

                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => handleSelect(sec)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-blue-50/60 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs leading-tight font-medium truncate group-hover:text-blue-700">
                          {sec.name}
                        </div>
                        {sec.category && sec.category !== 'Not Applicable' && (
                          <div className="text-[9.5px] text-slate-400 truncate mt-0.5">
                            Category: {sec.category}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {sec.uniCode && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                            {sec.uniCode}
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-slate-300" />
                  <span>No matching sections found</span>
                </div>
              )}
            </div>

            {/* Footer Summary */}
            <div className="px-2.5 py-1.5 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500 flex justify-between items-center">
              <span>{filteredSections.length} sections</span>
              {currentSection && (
                <span className="truncate max-w-[150px] font-mono text-[9px] text-slate-600">
                  ID: {currentSection.id}
                </span>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
