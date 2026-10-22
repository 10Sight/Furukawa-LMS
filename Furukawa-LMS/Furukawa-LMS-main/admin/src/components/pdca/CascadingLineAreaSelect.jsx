import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Layers,
  Folder,
  FolderOpen,
  GitBranch,
  Building2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import pdcaApi from '@/services/api/pdcaApi.js';
import { VERIFIED_SECTION_MASTER } from '../../pages/pdca/data/pdcaSections.js';
import { DEFAULT_LINE_AREAS } from '../../pages/pdca/data/pdcaConstants.js';

export const getDefaultSectionsWithLines = () => {
  return VERIFIED_SECTION_MASTER.map((sec) => {
    let lineNames = [];
    const cat = (sec.category || '').toLowerCase();
    if (cat.includes('assembly')) {
      lineNames = ['Assembly Line 1', 'Assembly Line 2', 'Assembly Line 3', 'Assembly Area'];
    } else if (cat.includes('quality')) {
      lineNames = ['Quality Lab', 'Final Inspection Area', 'Pre-Inspection Rework'];
    } else if (cat.includes('crimping') || cat.includes('c&c')) {
      lineNames = ['C&C Area', 'Line 1', 'Line 2', 'Line 3'];
    } else if (cat.includes('maintenance')) {
      lineNames = ['Maintenance Area', 'Utility'];
    } else if (cat.includes('store') || cat.includes('fg') || cat.includes('logistics')) {
      lineNames = ['Stores / Warehouse', 'Packaging Area'];
    } else {
      lineNames = ['Line 1', 'Line 2', 'Line A', 'Line B'];
    }
    const lines = lineNames.map((name, lIdx) => ({
      id: Number(`${sec.id}0${lIdx + 1}`),
      name,
      uniCode: `L${lIdx + 1}`,
      sectionId: sec.id
    }));
    return {
      ...sec,
      lines
    };
  });
};

// Cache the database hierarchy across dropdown instances to avoid redundant API calls.
let cachedDbSections = null;
let pendingFetchPromise = null;

export const fetchPdcaSections = async (forceRefresh = false) => {
  if (cachedDbSections && cachedDbSections.length > 0 && !forceRefresh) return cachedDbSections;
  if (pendingFetchPromise && !forceRefresh) return pendingFetchPromise;

  pendingFetchPromise = (async () => {
    try {
      const res = await pdcaApi.getSections();
      const list = Array.isArray(res) ? res : res?.data;
      if (Array.isArray(list) && list.length > 0) {
        cachedDbSections = list;
        return list;
      }
    } catch {
      // fallback below
    } finally {
      pendingFetchPromise = null;
    }

    const fallback = getDefaultSectionsWithLines();
    cachedDbSections = fallback;
    return fallback;
  })();

  return pendingFetchPromise;
};

export const getCachedDbSections = () => cachedDbSections;

/** True only when the line really belongs to the section (by database relationship). */
export const isLineInSection = (sections, sectionId, lineId) => {
  const sec = (sections || []).find((s) => String(s.id) === String(sectionId));
  return !!sec && (sec.lines || []).some((l) => String(l.id) === String(lineId));
};

const withCode = (name, code) => (code ? `${name} (${code})` : name);

const POPOVER_WIDTH = 340;
const POPOVER_MAX_HEIGHT = 380;

/**
 * Single cascading dropdown for Line / Area / Section.
 * - Sections and their Lines/Areas come from the database (lines.sectionId -> sections.id).
 * - Sections expand/collapse inline; only the Section's own Lines/Areas are shown.
 * - Searchable by name or code. Selection is identified by IDs (names can repeat).
 * - onChange(label, { section, sectionId, sectionCode, line, lineId, lineCode })
 */
export default function CascadingLineAreaSelect({
  value = '',
  sectionId: selectedSectionId = null,
  lineId: selectedLineId = null,
  onChange,
  placeholder = 'Select Section / Line / Area...',
  className = '',
  disabled = false,
  compact = false,
  id = 'pdca-cascading-select',
  initialSections = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sections, setSections] = useState(() => (initialSections && initialSections.length > 0) ? initialSections : (cachedDbSections || getDefaultSectionsWithLines()));
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [expandedSectionIds, setExpandedSectionIds] = useState(new Set());

  const containerRef = useRef(null);
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);

  const loadSections = useCallback(async (force = false) => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const data = await fetchPdcaSections(force);
      setSections(data);
    } catch (err) {
      setFetchError(err?.message ? `Failed to load sections and lines: ${err.message}` : 'Failed to load sections and lines');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialSections || initialSections.length === 0) loadSections();
  }, [loadSections, initialSections]);

  // Resolve the current selection. Stored IDs are authoritative; the label is a fallback
  // for older records that only saved text.
  const selection = useMemo(() => {
    const result = (sec, line, isLegacy = false) => ({
      sectionName: sec?.name || '',
      sectionCode: sec?.uniCode || '',
      sectionId: sec?.id ?? null,
      lineName: line?.name || '',
      lineCode: line?.uniCode || '',
      lineId: line?.id ?? null,
      isLegacy
    });
    const val = typeof value === 'string' ? value.trim() : '';

    if (selectedSectionId != null && selectedSectionId !== '') {
      const sec = sections.find((s) => String(s.id) === String(selectedSectionId));
      if (sec) {
        if (selectedLineId != null && selectedLineId !== '') {
          const line = (sec.lines || []).find((l) => String(l.id) === String(selectedLineId));
          if (line) return result(sec, line);
        } else if (val && sec.name?.trim().toLowerCase() === val.toLowerCase()) {
          return result(sec, null);
        }
      }
    }

    if (!val) return result(null, null);

    const sep = val.includes(' / ') ? ' / ' : val.includes(' → ') ? ' → ' : null;
    if (sep) {
      const [secName, ...rest] = val.split(sep);
      const lineName = rest.join(sep).trim();
      const sec = sections.find((s) => s.name?.trim().toLowerCase() === secName.trim().toLowerCase());
      if (sec) {
        const line = (sec.lines || []).find((l) => l.name?.trim().toLowerCase() === lineName.toLowerCase());
        return line ? result(sec, line) : { ...result(sec, null), lineName };
      }
      return { ...result(null, null), sectionName: secName.trim(), lineName };
    }

    const sec = sections.find((s) => s.name?.trim().toLowerCase() === val.toLowerCase());
    if (sec) return result(sec, null);

    for (const s of sections) {
      const line = (s.lines || []).find((l) => l.name?.trim().toLowerCase() === val.toLowerCase());
      if (line) return result(s, line, true);
    }
    return { ...result(null, null, true), lineName: val };
  }, [value, sections, selectedSectionId, selectedLineId]);

  // Auto-expand the section holding the current selection or the selectedSectionId
  useEffect(() => {
    if (selection.sectionId != null) {
      setExpandedSectionIds((prev) => new Set([...prev, selection.sectionId]));
    }
    if (selectedSectionId != null && selectedSectionId !== '') {
      setExpandedSectionIds((prev) => new Set([...prev, Number(selectedSectionId), String(selectedSectionId)]));
    }
  }, [selection.sectionId, selectedSectionId]);

  // Position the popover (fixed, so the table's scroll container cannot clip it)
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
    const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(POPOVER_MAX_HEIGHT, Math.max(180, openUp ? spaceAbove : spaceBelow));
    setPopoverPos({
      left,
      width,
      maxHeight,
      ...(openUp ? { bottom: vh - rect.top + 6 } : { top: rect.bottom + 6 })
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
    const t = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  const toggleSection = (sectionId, e) => {
    e?.stopPropagation();
    setExpandedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const emit = (section, line) => {
    const label = line ? `${section.name} / ${line.name}` : section.name;
    onChange?.(label, {
      section: section.name,
      sectionId: section.id,
      sectionCode: section.uniCode || '',
      line: line?.name || '',
      lineId: line?.id ?? null,
      lineCode: line?.uniCode || ''
    });
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e?.stopPropagation();
    onChange?.('', {
      section: '',
      sectionId: null,
      sectionCode: '',
      line: '',
      lineId: null,
      lineCode: ''
    });
  };

  // Search by section/line name or code
  const filteredSections = useMemo(() => {
    let list = sections;
    if (selectedSectionId != null && selectedSectionId !== '') {
      const match = sections.filter((s) => String(s.id) === String(selectedSectionId));
      if (match.length > 0) {
        list = match;
      }
    }
    const q = searchTerm.toLowerCase().trim();
    if (!q) return list;
    const hit = (item) =>
      (item.name || '').toLowerCase().includes(q) || (item.uniCode || '').toLowerCase().includes(q);
    return list
      .map((sec) => {
        const lines = sec.lines || [];
        if (hit(sec)) return { ...sec, lines };
        const matching = lines.filter(hit);
        return matching.length > 0 ? { ...sec, lines: matching } : null;
      })
      .filter(Boolean);
  }, [sections, searchTerm, selectedSectionId]);

  const isSearching = searchTerm.trim().length > 0;

  const displayLabel = useMemo(() => {
    if (!value && selection.sectionId == null) return null;
    const { sectionName, sectionCode, lineName, lineCode } = selection;
    if (sectionName && lineName) {
      if (compact) {
        return (
          <span
            className="font-medium text-slate-800 text-[12.5px] truncate block text-center whitespace-nowrap"
            title={`${sectionName} / ${withCode(lineName, lineCode)}`}
          >
            {lineName}
            {lineCode && <span className="ml-0.5 font-mono text-[10px] font-normal text-slate-400">({lineCode})</span>}
          </span>
        );
      }
      return (
        <span className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200 shrink-0 max-w-[45%]"
            title={withCode(sectionName, sectionCode)}
          >
            <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
            <span className="truncate">{sectionName}</span>
          </span>
          <span className="text-slate-300 font-bold text-xs shrink-0">/</span>
          <span className="font-semibold text-slate-800 text-xs truncate" title={withCode(lineName, lineCode)}>
            {lineName}
            {lineCode && <span className="ml-1 font-mono text-[10px] font-normal text-slate-400">{lineCode}</span>}
          </span>
        </span>
      );
    }
    if (sectionName) {
      return (
        <span className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200 shrink-0 max-w-full"
            title={withCode(sectionName, sectionCode)}
          >
            <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
            <span className="truncate">{sectionName}</span>
          </span>
          <span className="text-[10px] text-slate-400 italic shrink-0">(Section)</span>
        </span>
      );
    }
    return <span className="font-semibold text-slate-800 text-xs truncate">{value}</span>;
  }, [value, selection]);

  const hasValue = !!value || selection.sectionId != null;

  return (
    <div ref={containerRef} className={`relative w-full text-left select-none ${className}`}>
      {/* Trigger */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((o) => !o);
            setSearchTerm('');
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={
          compact
            ? `w-full min-h-[28px] flex items-center justify-between gap-1 px-1.5 py-0.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-md shadow-2xs hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer'
              }`
            : `w-full min-h-[42px] flex items-center justify-between gap-2 px-3.5 py-2 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-xl shadow-2xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all ${
                disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer'
              } ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-600' : ''}`
        }
        title={hasValue ? withCode(selection.sectionName || value, selection.sectionCode) : placeholder}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1 justify-center">
          <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          {hasValue && displayLabel ? (
            displayLabel
          ) : (
            <span className="text-slate-400 font-normal text-[12px] italic truncate whitespace-nowrap">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasValue && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClear(e);
                }
              }}
              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
          />
        </div>
      </button>

      {isOpen && popoverPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          role="listbox"
          style={{
            position: 'fixed',
            left: popoverPos.left,
            width: popoverPos.width,
            maxHeight: popoverPos.maxHeight,
            top: popoverPos.top,
            bottom: popoverPos.bottom,
            zIndex: 10000
          }}
          className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Search */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2 shrink-0">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsOpen(false);
                }}
                placeholder="Search section, line or area (name or code)..."
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => loadSections(true)}
              className="text-slate-400 hover:text-blue-600 p-1.5 rounded hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Refresh from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>

          <div className="px-3 py-1.5 bg-slate-100/60 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium shrink-0">
            <span>Select a Line/Area under a Section</span>
            <span>{filteredSections.length} Sections</span>
          </div>

          {/* List */}
          <div className="overflow-y-auto min-h-0 flex-1 p-1.5 text-xs">
            {isLoading && sections.length === 0 ? (
              <div className="p-5 text-center text-slate-500 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                <span>Loading sections &amp; lines...</span>
              </div>
            ) : fetchError && sections.length === 0 ? (
              <div className="p-5 text-center text-rose-600 flex flex-col items-center gap-1.5">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <span className="font-semibold">{fetchError}</span>
                <button
                  type="button"
                  onClick={() => loadSections(true)}
                  className="mt-1 text-blue-600 underline font-medium cursor-pointer"
                >
                  Retry loading
                </button>
              </div>
            ) : sections.length === 0 ? (
              <div className="p-5 text-center text-slate-400">No sections are available in the database.</div>
            ) : filteredSections.length === 0 ? (
              <div className="p-5 text-center text-slate-400">No section, line or area matching &ldquo;{searchTerm}&rdquo;</div>
            ) : (
              filteredSections.map((section) => {
                const lines = Array.isArray(section.lines) ? section.lines : [];
                const hasLines = lines.length > 0;
                const isExpanded = isSearching || expandedSectionIds.has(section.id);
                const isSectionSelected = selection.sectionId === section.id;
                const isEntireSectionSelected = isSectionSelected && selection.lineId == null && !selection.lineName;

                return (
                  <div key={section.id} className="mb-0.5">
                    <div
                      className={`group flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        isEntireSectionSelected
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : isSectionSelected
                          ? 'bg-slate-50 text-slate-900 border border-slate-200'
                          : 'text-slate-800 border border-transparent hover:bg-slate-100/70'
                      }`}
                      onClick={(e) => (hasLines ? toggleSection(section.id, e) : emit(section, null))}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {hasLines ? (
                          <span className="p-0.5 text-slate-400 shrink-0" aria-hidden="true">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-blue-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 group-hover:text-slate-700" />
                            )}
                          </span>
                        ) : (
                          <span className="w-5 shrink-0" />
                        )}
                        {isExpanded ? (
                          <FolderOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate" title={section.name}>{section.name}</span>
                        {section.uniCode && (
                          <span className="font-mono text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded px-1 py-px shrink-0">
                            {section.uniCode}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasLines ? (
                          <span className="text-[10px] font-normal text-slate-400 px-1.5 py-0.5 rounded bg-slate-100">
                            {lines.length} {lines.length === 1 ? 'line' : 'lines'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            {isEntireSectionSelected ? '' : 'No lines · select section'}
                          </span>
                        )}
                        {!hasLines && isEntireSectionSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                    </div>

                    {hasLines && isExpanded && (
                      <div className="ml-6 pl-2 border-l-2 border-blue-100 space-y-0.5 my-1">
                        {lines.map((line) => {
                          const isLineSelected = isSectionSelected && selection.lineId === line.id;
                          return (
                            <button
                              key={line.id}
                              type="button"
                              role="option"
                              aria-selected={isLineSelected}
                              onClick={() => emit(section, line)}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                                isLineSelected
                                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                                  : 'text-slate-700 border border-transparent hover:bg-slate-50 hover:text-slate-900'
                              }`}
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                <GitBranch className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate" title={line.name}>{line.name}</span>
                              </span>
                              <span className="flex items-center gap-1.5 shrink-0">
                                {line.uniCode && (
                                  <span className="font-mono text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded px-1 py-px max-w-[120px] truncate">
                                    {line.uniCode}
                                  </span>
                                )}
                                {isLineSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {hasValue && (
            <div className="p-2 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2 shrink-0">
              <span className="text-[11px] text-slate-500 truncate">
                Current: <strong className="text-slate-700">{value || selection.sectionName}</strong>
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer shrink-0"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
