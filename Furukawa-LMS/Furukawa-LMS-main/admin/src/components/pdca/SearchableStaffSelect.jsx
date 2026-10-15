import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, ChevronDown, Check, X, User, IdCard, Building2, RefreshCw, AlertCircle } from 'lucide-react';
import pdcaApi from '@/services/api/pdcaApi.js';
import { VERIFIED_EMPLOYEE_MASTER } from '../../pages/pdca/data/pdcaEmployees.js';

// Cache database employees across dropdown instances to avoid redundant API requests
let cachedDbEmployees = null;
let pendingEmployeesFetch = null;

export const fetchPdcaEmployees = async (forceRefresh = false) => {
  if (cachedDbEmployees && !forceRefresh) {
    return cachedDbEmployees;
  }
  if (pendingEmployeesFetch && !forceRefresh) {
    return pendingEmployeesFetch;
  }

  pendingEmployeesFetch = (async () => {
    try {
      const res = await pdcaApi.getEmployees();
      const list = Array.isArray(res) ? res : (res?.data || []);
      if (Array.isArray(list) && list.length > 0) {
        cachedDbEmployees = list;
        return list;
      }
    } catch (err) {
      console.warn('[SearchableStaffSelect] Failed fetching employees from DB:', err);
    } finally {
      pendingEmployeesFetch = null;
    }

    return cachedDbEmployees || VERIFIED_EMPLOYEE_MASTER;
  })();

  return pendingEmployeesFetch;
};

/**
 * SearchableStaffSelect Component
 * - Searchable dropdown for selecting employees from the database
 * - Automatically provides employee name and employee ID (code)
 * - Highlights matches, displays ID and department badges
 * - Keyboard accessible (Arrows, Enter, Escape)
 * - Viewport-aware positioning (opens upward if close to screen bottom)
 */
export default function SearchableStaffSelect({
  value = '',
  onChange,
  onSelectEmployee,
  placeholder = 'Search or select employee...',
  className = '',
  disabled = false,
  required = false,
  id = undefined
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState(cachedDbEmployees || []);
  const [isLoading, setIsLoading] = useState(!cachedDbEmployees || cachedDbEmployees.length === 0);
  const [fetchError, setFetchError] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Load employee list from DB on mount
  const loadEmployees = useCallback(async (force = false) => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const data = await fetchPdcaEmployees(force);
      setEmployees(data);
    } catch (err) {
      setFetchError('Failed to load employee list');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Check positioning relative to viewport when opened
  useEffect(() => {
    if (isOpen && containerRef.current) {
      try {
        const rect = containerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        if (spaceBelow < 280 && spaceAbove > spaceBelow) {
          setOpenUpward(true);
        } else {
          setOpenUpward(false);
        }
      } catch {}
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Filter employees based on search query (by name, code/id, or department)
  const filteredEmployees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return employees;

    return employees.filter((emp) => {
      const name = (emp.name || emp.fullName || '').toLowerCase();
      const code = (emp.code || emp.empId || emp.userName || '').toLowerCase();
      const dept = (emp.department || '').toLowerCase();
      return name.includes(q) || code.includes(q) || dept.includes(q);
    });
  }, [employees, searchTerm]);

  // Reset highlighted index when filter results change
  useEffect(() => {
    setHighlightedIndex(filteredEmployees.length > 0 ? 0 : -1);
  }, [filteredEmployees]);

  // Handle employee selection
  const handleSelect = (emp) => {
    const empName = emp.name || emp.fullName || '';
    const empCode = emp.code || emp.empId || emp.userName || '';
    const empDept = emp.department || '';

    onChange?.(empName);
    onSelectEmployee?.({
      name: empName,
      code: empCode,
      department: empDept,
      id: emp.id
    });

    setIsOpen(false);
    setSearchTerm('');
  };

  // Handle manual custom entry when user presses Enter on search term not in list
  const handleUseCustomName = () => {
    if (!searchTerm.trim()) return;
    const customName = searchTerm.trim();
    onChange?.(customName);
    onSelectEmployee?.({
      name: customName,
      code: '',
      department: '',
      id: null
    });
    setIsOpen(false);
    setSearchTerm('');
  };

  // Handle clear selection
  const handleClear = (e) => {
    e?.stopPropagation();
    onChange?.('');
    onSelectEmployee?.({
      name: '',
      code: '',
      department: '',
      id: null
    });
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredEmployees.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredEmployees.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredEmployees.length) {
        handleSelect(filteredEmployees[highlightedIndex]);
      } else if (searchTerm.trim()) {
        handleUseCustomName();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Auto-scroll highlighted option into view
  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const items = listRef.current.children;
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full text-left select-none ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <div
        id={id}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchTerm('');
          }
        }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg shadow-2xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all ${
          disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer'
        } ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-600' : ''}`}
        title={value || placeholder}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          {value ? (
            <span className="font-semibold text-slate-800 truncate">
              {value}
            </span>
          ) : (
            <span className="text-slate-400 font-normal truncate">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
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
              title="Clear employee"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-600' : ''
            }`}
          />
        </div>
      </div>


      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className={`absolute z-[9999] left-0 w-full min-w-[280px] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${
            openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
          style={{ maxHeight: '310px' }}
        >
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/90 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type name, emp ID or department..."
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => loadEmployees(true)}
              className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh database employees"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>

          {/* Employee Count / Subtitle */}
          <div className="px-3 py-1 bg-slate-100/60 border-b border-slate-100 flex items-center justify-between text-[10.5px] text-slate-500 font-medium">
            <span>Select Employee (Auto-fills ID)</span>
            <span>{filteredEmployees.length} Available</span>
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            role="listbox"
            className="overflow-y-auto max-h-[200px] p-1.5 space-y-0.5 text-xs"
          >
            {isLoading && employees.length === 0 ? (
              <div className="p-4 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-xs">Loading database employees...</span>
              </div>
            ) : fetchError && employees.length === 0 ? (
              <div className="p-4 text-center text-rose-600 flex flex-col items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold">{fetchError}</span>
                <button
                  type="button"
                  onClick={() => loadEmployees(true)}
                  className="text-xs text-blue-600 underline font-medium cursor-pointer"
                >
                  Retry loading
                </button>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-3 text-center text-slate-400 text-xs space-y-2">
                <div>No employees found matching &ldquo;{searchTerm}&rdquo;</div>
                {searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={handleUseCustomName}
                    className="w-full text-center px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Use custom name: &ldquo;{searchTerm.trim()}&rdquo;
                  </button>
                )}
              </div>
            ) : (
              filteredEmployees.map((emp, idx) => {
                const empName = emp.name || emp.fullName || '';
                const empCode = emp.code || emp.empId || emp.userName || '';
                const empDept = emp.department || '';
                const isSelected = value?.toLowerCase() === empName.toLowerCase();
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={emp.id || `${empName}_${empCode}_${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(emp)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-2xs'
                        : isHighlighted
                        ? 'bg-slate-100 text-slate-900 font-medium'
                        : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2 truncate">
                      <User className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                      <div className="truncate">
                        <div className="truncate font-semibold text-slate-800">
                          {empName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {empCode && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono font-medium">
                          <IdCard className="w-2.5 h-2.5 text-slate-400" />
                          <span>{empCode}</span>
                        </span>
                      )}
                      {empDept && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[9.5px] font-medium">
                          <Building2 className="w-2.5 h-2.5 text-blue-500" />
                          <span>{empDept}</span>
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
