import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, User, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export default function SearchableEmployeeSelect({
  employees = [],
  value = null, // Can be employee object, or code/ID string
  onChange,
  placeholder = 'Search by name or employee ID...',
  className = '',
  disabled = false,
  excludeCodes = [],
  id = 'searchable-employee-select',
  required = false,
  isLoading = false,
  error = null,
  onRetry = null,
  clearOnSelect = false
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

  // Find currently selected employee object
  const selectedEmployee = useMemo(() => {
    if (clearOnSelect || !value) return null;
    if (typeof value === 'object' && (value.name || value.code)) return value;
    const searchVal = String(value).trim().toUpperCase();
    return (employees || []).find((emp) => {
      const code = String(emp.code || emp.empId || emp.id || '').toUpperCase();
      const name = String(emp.name || emp.fullName || '').toUpperCase();
      return code === searchVal || name === searchVal;
    }) || null;
  }, [value, employees, clearOnSelect]);

  // Filter options by search term
  const filteredEmployees = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    const q = searchTerm.toLowerCase().trim();
    if (!q) return list;
    return list.filter((emp) => {
      const name = String(emp.name || emp.fullName || '').toLowerCase();
      const code = String(emp.code || emp.empId || emp.id || '').toLowerCase();
      const dept = String(emp.department || '').toLowerCase();
      return name.includes(q) || code.includes(q) || dept.includes(q);
    });
  }, [employees, searchTerm]);

  const handleSelect = (emp) => {
    onChange?.(emp);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e?.stopPropagation();
    onChange?.(null);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className={`relative w-full text-left ${className}`}>
      {/* Trigger Button */}
      <div
        id={id}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchTerm('');
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs border rounded-xl shadow-2xs transition-all ${
          isOpen ? 'ring-2 ring-emerald-500/20 border-emerald-600 bg-white' : 'border-slate-300 bg-white hover:border-slate-400'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {selectedEmployee ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-slate-800 truncate">
                {selectedEmployee.name || selectedEmployee.fullName}
              </span>
              {(selectedEmployee.code || selectedEmployee.empId) && (
                <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded shrink-0">
                  {selectedEmployee.code || selectedEmployee.empId}
                </span>
              )}
              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded shrink-0">
                {selectedEmployee.department || 'Department not assigned'}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isLoading && <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />}
          {selectedEmployee && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>

      {/* Hidden input for HTML form validation if required */}
      {required && (
        <input
          type="text"
          value={selectedEmployee ? (selectedEmployee.code || selectedEmployee.name || '') : ''}
          required
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-[9999] top-full left-0 mt-1 w-full min-w-[280px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredEmployees.length > 0) {
                    const firstAvailable = filteredEmployees.find(
                      (emp) => !excludeCodes.includes(emp.code || emp.empId || emp.id)
                    ) || filteredEmployees[0];
                    handleSelect(firstAvailable);
                  }
                } else if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
              placeholder="Type name, ID, or department..."
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-50 py-1 text-xs">
            {isLoading ? (
              <div className="p-4 flex items-center justify-center gap-2 text-slate-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Loading employee records from database...</span>
              </div>
            ) : error ? (
              <div className="p-3 text-center space-y-1.5">
                <div className="flex items-center justify-center gap-1.5 text-rose-600 text-xs font-medium">
                  <AlertCircle className="w-4 h-4" />
                  <span>Failed to load employee directory</span>
                </div>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                {employees.length === 0
                  ? 'No employee records found in database.'
                  : `No matching employees found for "${searchTerm}"`}
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const empCode = emp.code || emp.empId || emp.id || '';
                const empName = emp.name || emp.fullName || '';
                const isSelected = selectedEmployee && (
                  (empCode && (selectedEmployee.code === empCode || selectedEmployee.empId === empCode)) ||
                  (empName && selectedEmployee.name === empName)
                );
                const isExcluded = excludeCodes.includes(empCode) && !isSelected;

                return (
                  <button
                    key={empCode || empName}
                    type="button"
                    disabled={isExcluded}
                    onClick={() => handleSelect(emp)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-900 font-semibold'
                        : isExcluded
                        ? 'opacity-40 cursor-not-allowed bg-slate-50'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800 truncate">{empName}</span>
                        {empCode && (
                          <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50/80 border border-emerald-200 px-1.5 py-0.2 rounded shrink-0">
                            {empCode}
                          </span>
                        )}
                        {isExcluded && (
                          <span className="text-[10px] text-slate-400 italic">Already assigned</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                        <span>
                          Dept:{' '}
                          <span className="font-medium text-slate-700">
                            {emp.department || 'Department not assigned'}
                          </span>
                        </span>
                        {emp.email && <span className="text-slate-400 truncate text-[10px]">· {emp.email}</span>}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
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
