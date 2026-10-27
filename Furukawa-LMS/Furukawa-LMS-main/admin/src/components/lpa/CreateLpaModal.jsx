import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Layers, Calendar, Clock, Building2, Check, Plus, AlertCircle, ChevronDown } from 'lucide-react';
import { PDCA_DEPARTMENTS, DEFAULT_LINE_AREAS } from '@pages/pdca/data/pdcaConstants';
import { fetchPdcaSections } from '@components/pdca/CascadingLineAreaSelect.jsx';
import { VERIFIED_SECTION_MASTER } from '@pages/pdca/data/pdcaSections';

export const LPA_LEVEL_OPTIONS = [
  {
    id: 'L3',
    key: 'L3',
    name: 'Level 3',
    title: 'Level 3',
    badge: 'L3',
    freqText: 'Level 3',
    levelsIncluded: ['L3']
  },
  {
    id: 'L2',
    key: 'L2',
    name: 'Level 2',
    title: 'Level 2',
    badge: 'L2',
    freqText: 'Level 2',
    levelsIncluded: ['L2']
  },
  {
    id: 'L1',
    key: 'L1',
    name: 'Level 1',
    title: 'Level 1',
    badge: 'L1',
    freqText: 'Level 1',
    levelsIncluded: ['L1']
  }
];

function MultiSelectCheckboxDropdown({
  placeholder,
  options = [],
  selectedValues = [],
  onChange,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 200 });

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const width = Math.max(rect.width, 280);
    let left = rect.left;
    if (left + width > vw - 12) {
      left = Math.max(12, vw - width - 12);
    }
    const spaceBelow = vh - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(240, Math.max(160, openUp ? spaceAbove : spaceBelow));

    setMenuPos({
      left,
      width,
      maxHeight,
      ...(openUp ? { bottom: vh - rect.top + 4 } : { top: rect.bottom + 4 })
    });
  }, []);

  const handleToggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      updateMenuPosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (
        containerRef.current?.contains(e.target) ||
        dropdownRef.current?.contains(e.target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = (e) => {
      if (dropdownRef.current && e?.target && dropdownRef.current.contains(e.target)) {
        return;
      }
      updateMenuPosition();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updateMenuPosition]);

  const handleItemToggle = (val) => {
    const isSelected = selectedValues.includes(val);
    if (isSelected) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleSelectAll = (e) => {
    e.stopPropagation();
    onChange(options.map(o => o.value));
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  const getLabel = (val) => {
    const found = options.find(o => o.value === val);
    return found ? found.label : val;
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggleOpen}
        className={`w-full h-9 px-2 text-xs bg-white border rounded-lg shadow-2xs flex items-center justify-between text-left transition-all cursor-pointer ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-100'
            : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
      >
        <span className="truncate pr-1">
          {selectedValues.length === 0 ? (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          ) : selectedValues.length === 1 ? (
            <span className="text-slate-800 font-medium" title={getLabel(selectedValues[0])}>
              {getLabel(selectedValues[0])}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 min-w-0" title={selectedValues.map(getLabel).join(', ')}>
              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                {selectedValues.length}
              </span>
              <span className="text-slate-800 font-medium truncate">
                {selectedValues.map(getLabel).join(', ')}
              </span>
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: menuPos.top,
              bottom: menuPos.bottom,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight || 240,
              zIndex: 99999
            }}
            className="bg-white border border-slate-200 rounded-lg shadow-xl flex flex-col text-xs animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Header: count + Select All / Clear */}
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border-b border-slate-100 shrink-0 text-[11px] font-medium text-slate-600">
              <span>
                {selectedValues.length} of {options.length} selected
              </span>
              <div className="flex items-center gap-2">
                {selectedValues.length < options.length && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                )}
                {selectedValues.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-red-600 hover:text-red-800 font-semibold hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable list with overflow-auto */}
            <div className="overflow-auto py-1 flex-1">
              {options.map((opt) => {
                const isChecked = selectedValues.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none transition-colors ${
                      isChecked
                        ? 'bg-blue-50/70 text-blue-900 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleItemToggle(opt.value)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <span className="truncate" title={opt.label}>
                      {opt.label}
                    </span>
                  </label>
                );
              })}
              {options.length === 0 && (
                <div className="px-3 py-3 text-center text-slate-400 text-xs">
                  No options available
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default function CreateLpaModal({
  isOpen,
  onClose,
  onCreate,
  initialSection = 'assembly',
  initialUnit = 'Bawal',
  initialDate = new Date().toISOString().slice(0, 10)
}) {
  const [section, setSection] = useState(initialSection);
  const [targetLevel, setTargetLevel] = useState('L3');
  const [selectedLevels, setSelectedLevels] = useState(['L3']);
  const [date, setDate] = useState(initialDate);
  const [shift, setShift] = useState('A');
  const [department, setDepartment] = useState(initialSection === 'cc' ? 'C&C' : 'Assembly');
  const [selectedSections, setSelectedSections] = useState([]);
  const [selectedLines, setSelectedLines] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sectionName = selectedSections.join(', ');
  const line = selectedLines.join(', ');

  // Master data
  const [sectionsMaster, setSectionsMaster] = useState(VERIFIED_SECTION_MASTER);

  useEffect(() => {
    if (isOpen) {
      const sec = initialSection || 'assembly';
      setSection(sec);
      setTargetLevel('L3');
      setSelectedLevels(['L3']);
      setDate(initialDate || new Date().toISOString().slice(0, 10));
      setShift('A');
      setDepartment(sec === 'cc' ? 'C&C' : 'Assembly');
      setSelectedSections([]);
      setSelectedLines([]);
      setErrorMsg('');
      setSubmitting(false);
    }
  }, [isOpen, initialSection, initialDate]);

  useEffect(() => {
    let active = true;
    fetchPdcaSections()
      .then(data => {
        if (active && Array.isArray(data) && data.length > 0) {
          setSectionsMaster(data);
        }
      })
      .catch(() => { });

    return () => { active = false; };
  }, []);

  // Available shifts based on target level:
  // L3 -> Shifts A, B, C
  // L2, L1 -> Shift G (default), also allows A, B, C
  const availableShifts = useMemo(() => {
    if (targetLevel === 'L3') {
      return ['A', 'B', 'C'];
    }
    return ['G', 'A', 'B', 'C'];
  }, [targetLevel]);

  const handleSelectLevel = (lvlId) => {
    setTargetLevel(lvlId);
    if (lvlId === 'L1') {
      setSelectedLevels(['L3', 'L2', 'L1']);
      setShift('G');
    } else if (lvlId === 'L2') {
      setSelectedLevels(['L3', 'L2']);
      setShift('G');
    } else {
      setSelectedLevels(['L3']);
      setShift('A');
    }
    setErrorMsg('');
  };

  // Cascading Sections based on Department
  const availableSections = useMemo(() => {
    if (!department) return sectionsMaster;
    const deptNorm = department.trim().toLowerCase();
    const isCrimping = deptNorm === 'c&c';
    const matches = sectionsMaster.filter(s => {
      const cat = (s.category || '').toLowerCase();
      return cat === deptNorm || (isCrimping && cat === 'crimping');
    });
    return matches.length > 0 ? matches : sectionsMaster;
  }, [sectionsMaster, department]);

  // Cascading Lines based on Section & Department
  const availableLines = useMemo(() => {
    if (selectedSections.length > 0) {
      const matchedSecs = availableSections.filter(s =>
        selectedSections.includes(s.name) || selectedSections.includes(String(s.id))
      );
      const linesFromSecs = matchedSecs.flatMap(s =>
        Array.isArray(s.lines) ? s.lines.map(l => l.name || l) : []
      );
      const uniqueSecLines = Array.from(new Set(linesFromSecs.filter(Boolean)));
      if (uniqueSecLines.length > 0) {
        return uniqueSecLines;
      }
    }

    const deptNorm = (department || '').trim().toLowerCase();
    if (deptNorm === 'assembly') {
      return ['Assembly Line 1', 'Assembly Line 2', 'Assembly Line 3', 'Assembly Area', 'Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'];
    }
    if (deptNorm === 'quality') {
      return ['Quality Lab', 'Final Inspection Area', 'Pre-Inspection Rework'];
    }
    if (deptNorm === 'c&c') {
      return ['C&C Area', 'Line 1', 'Line 2', 'Line 3'];
    }
    if (deptNorm === 'maintenance') {
      return ['Maintenance Area', 'Utility'];
    }
    if (deptNorm === 'store' || deptNorm === 'fg') {
      return ['Stores / Warehouse', 'Packaging Area'];
    }
    return DEFAULT_LINE_AREAS;
  }, [availableSections, selectedSections, department]);

  const sectionOptions = useMemo(() => {
    return availableSections.map((sec) => ({
      value: sec.name,
      label: `${sec.name}${sec.uniCode ? ` (${sec.uniCode})` : ''}`
    }));
  }, [availableSections]);

  const lineOptions = useMemo(() => {
    return availableLines.map((ln) => ({
      value: ln,
      label: ln
    }));
  }, [availableLines]);

  if (!isOpen) return null;

  const handleDepartmentChange = (val) => {
    setDepartment(val);
    setSelectedSections([]);
    setSelectedLines([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // 1. Levels validation (Mandatory)
    if (!selectedLevels || selectedLevels.length === 0) {
      setErrorMsg('Levels is mandatory. Please select at least one level (L1, L2, or L3).');
      return;
    }

    // 2. Date & Shift validation (Mandatory)
    if (!date) {
      setErrorMsg('Date is mandatory. Please select an audit date.');
      return;
    }
    if (!shift) {
      setErrorMsg('Shift is mandatory. Please select a shift.');
      return;
    }

    // 3. Department validation (Mandatory)
    if (!department) {
      setErrorMsg('Department is mandatory. Please select a department.');
      return;
    }

    setSubmitting(true);
    onCreate({
      section,
      unit: initialUnit || 'Bawal',
      targetLevel,
      levels: selectedLevels,
      date,
      shift,
      department,
      sectionName,
      sections: selectedSections,
      line,
      lines: selectedLines,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-lpa-modal-title"
    >
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header - Compact & Clean */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 via-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/20">
              <Layers size={18} />
            </div>
            <div>
              <h3 id="create-lpa-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                Create {section === 'cc' ? 'C&C' : 'Assembly'} LPA Check Sheet
              </h3>
              <p className="text-[11px] text-slate-500">
                Configure audit level, shift, date, and line specifications
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Body - Compact, No Vertical Scroll */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5">
          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg animate-in fade-in duration-150">
              <AlertCircle size={15} className="shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Audit Levels (Mandatory) - Clean Horizontal Cards */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              1. Audit Level <span className="text-red-600 font-black">*</span>
            </label>

            <div className="grid grid-cols-3 gap-2.5">
              {LPA_LEVEL_OPTIONS.map((lvl) => {
                const isSelected = targetLevel === lvl.id;
                return (
                  <div
                    key={lvl.id}
                    onClick={() => handleSelectLevel(lvl.id)}
                    className={`relative px-3 py-2.5 rounded-xl border-2 transition-all cursor-pointer select-none flex items-center justify-between ${isSelected
                        ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-500/25'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                      }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 bg-white'
                          }`}
                      >
                        {isSelected && <Check size={10} strokeWidth={3} />}
                      </div>
                      <span className="font-extrabold text-xs text-slate-900">
                        {lvl.title}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${lvl.id === 'L3'
                          ? 'bg-emerald-100 text-emerald-800'
                          : lvl.id === 'L2'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                    >
                      {lvl.badge}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Date & Shift (Mandatory) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              2. Audit Date & Shift <span className="text-red-600 font-black">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Audit Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Shift <span className="text-red-600">*</span>
                  <span className="text-slate-400 font-normal ml-1">
                    ({targetLevel === 'L3' ? 'Shift A, B, C for Level 3' : 'Shift G default for Level 2/Level 1'})
                  </span>
                </label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  required
                  className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 font-bold"
                >
                  {availableShifts.map((s) => (
                    <option key={s} value={s}>
                      Shift {s} {s === 'G' ? '(General)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3. Department (Mandatory), Section, Line */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              3. Department <span className="text-red-600 font-black">*</span>, Section & Line
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Department <span className="text-red-600">*</span>
                </label>
                {section === 'assembly' ? (
                  <input value="Assembly" readOnly className="w-full h-9 px-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium" />
                ) : (
                  <select
                    value={department}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    required
                    className="w-full h-9 px-2 text-xs bg-white border border-slate-300 rounded-lg shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 font-medium truncate"
                  >
                    {PDCA_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Section <span className="text-slate-400 font-normal">(Opt)</span>
                </label>
                <MultiSelectCheckboxDropdown
                  placeholder="-- Section --"
                  options={sectionOptions}
                  selectedValues={selectedSections}
                  onChange={(newSecs) => {
                    setSelectedSections(newSecs);
                    if (newSecs.length === 0) {
                      setSelectedLines([]);
                    }
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Line <span className="text-slate-400 font-normal">(Opt)</span>
                </label>
                <MultiSelectCheckboxDropdown
                  placeholder="-- Line --"
                  options={lineOptions}
                  selectedValues={selectedLines}
                  onChange={(newLines) => {
                    setSelectedLines(newLines);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <Plus size={15} />
              <span>Create LPA Form</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
