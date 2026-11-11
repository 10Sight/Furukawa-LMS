import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Target, Save, RotateCcw, Check, Calendar, CheckSquare, Square } from 'lucide-react';

export const TARGET_DEPARTMENTS = [
  'PE',
  'IT',
  'Quality',
  'Assembly',
  'SRC',
  'Store',
  'HR',
  'Safety',
  'FG',
  'PPC',
  'Maintenance',
  'D&D',
  'C&C'
];

export const MONTHS = [
  { num: 1, name: 'January', short: 'Jan' },
  { num: 2, name: 'February', short: 'Feb' },
  { num: 3, name: 'March', short: 'Mar' },
  { num: 4, name: 'April', short: 'Apr' },
  { num: 5, name: 'May', short: 'May' },
  { num: 6, name: 'June', short: 'Jun' },
  { num: 7, name: 'July', short: 'Jul' },
  { num: 8, name: 'August', short: 'Aug' },
  { num: 9, name: 'September', short: 'Sep' },
  { num: 10, name: 'October', short: 'Oct' },
  { num: 11, name: 'November', short: 'Nov' },
  { num: 12, name: 'December', short: 'Dec' }
];

export const YEARS_LIST = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

export const STORAGE_KEY_SUGGESTION_TARGETS = 'fme_suggestion_dept_targets';
export const STORAGE_KEY_SUGGESTION_TARGETS_V2 = 'fme_suggestion_dept_targets_v2';

export const DEFAULT_DEPARTMENT_TARGETS = {
  PE: 10,
  IT: 10,
  Quality: 15,
  Assembly: 20,
  SRC: 10,
  Store: 10,
  HR: 8,
  Safety: 12,
  FG: 10,
  PPC: 10,
  Maintenance: 12,
  'D&D': 10,
  'C&C': 15
};

export function getStoredDepartmentTargets() {
  if (typeof window === 'undefined') return DEFAULT_DEPARTMENT_TARGETS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUGGESTION_TARGETS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_DEPARTMENT_TARGETS, ...parsed };
      }
    }
  } catch (err) {
    console.warn('Could not read suggestion department targets from storage:', err);
  }
  return DEFAULT_DEPARTMENT_TARGETS;
}

export function saveStoredDepartmentTargets(targets) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SUGGESTION_TARGETS, JSON.stringify(targets));
  } catch (err) {
    console.warn('Could not save suggestion department targets to storage:', err);
  }
}

export function getStoredDepartmentTargetsV2() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUGGESTION_TARGETS_V2);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (err) {
    console.warn('Could not read suggestion department targets v2 from storage:', err);
  }
  return {};
}

export function saveStoredDepartmentTargetsV2(targetsByYearMonth) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SUGGESTION_TARGETS_V2, JSON.stringify(targetsByYearMonth));
  } catch (err) {
    console.warn('Could not save suggestion department targets v2 to storage:', err);
  }
}

/**
 * Returns target number for a specific department, year, and month.
 * If user unselects any month, target returns 0 so it will not appear in graph.
 */
export function getTargetForDeptAndMonth(dept, year = 2026, monthNum = 11, v2Data = null, fallbackTargets = null) {
  const v2 = v2Data || getStoredDepartmentTargetsV2();
  const yStr = String(year);
  const mStr = String(monthNum);

  // If year has configuration in v2
  if (v2[yStr]) {
    if (v2[yStr][mStr] !== undefined) {
      if (!v2[yStr][mStr] || v2[yStr][mStr].unselected || v2[yStr][mStr][dept] === 0) {
        return 0; // Unselected month -> target does not appear!
      }
      return Number(v2[yStr][mStr][dept]) || 0;
    }
    // If month is omitted in a configured year, it was unselected by user
    return 0;
  }

  const defaults = fallbackTargets || getStoredDepartmentTargets();
  return Number(defaults[dept]) || 0;
}

export default function SuggestionTargetModal({
  isOpen,
  onClose,
  targets: initialTargets,
  onSaveTargets
}) {
  const currentYear = new Date().getFullYear() || 2026;
  const currentMonthNum = (new Date().getMonth() + 1) || 11;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonths, setSelectedMonths] = useState([3, 4, 5, 6]); // March, April, May, June by default or current
  const [formTargets, setFormTargets] = useState(() => initialTargets || getStoredDepartmentTargets());
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync targets when opened or when year selection changes
  useEffect(() => {
    if (isOpen) {
      const v2 = getStoredDepartmentTargetsV2();
      const yStr = String(selectedYear);
      if (v2[yStr]) {
        const active = Object.keys(v2[yStr])
          .map(Number)
          .filter((n) => n >= 1 && n <= 12 && v2[yStr][String(n)] && !v2[yStr][String(n)].unselected);
        setSelectedMonths(active);
        const firstMonth = active[0] || currentMonthNum;
        if (v2[yStr][String(firstMonth)] && !v2[yStr][String(firstMonth)].unselected) {
          setFormTargets({ ...DEFAULT_DEPARTMENT_TARGETS, ...v2[yStr][String(firstMonth)] });
        } else {
          setFormTargets(initialTargets || getStoredDepartmentTargets());
        }
      } else {
        setSelectedMonths([currentMonthNum]);
        setFormTargets(initialTargets || getStoredDepartmentTargets());
      }
      setSaveSuccess(false);
    }
  }, [isOpen, selectedYear]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMonthToggle = (monthNum) => {
    setSelectedMonths((prev) => {
      if (prev.includes(monthNum)) {
        return prev.filter((m) => m !== monthNum);
      }
      return [...prev, monthNum].sort((a, b) => a - b);
    });
  };

  const handleSelectAllMonths = () => {
    setSelectedMonths(MONTHS.map((m) => m.num));
  };

  const handleClearMonths = () => {
    setSelectedMonths([]);
  };

  const handleChange = (dept, val) => {
    const num = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
    setFormTargets((prev) => ({
      ...prev,
      [dept]: num
    }));
  };

  const handleReset = () => {
    setFormTargets(DEFAULT_DEPARTMENT_TARGETS);
  };

  const handleSave = (e) => {
    e?.preventDefault?.();
    const cleanTargets = {};
    TARGET_DEPARTMENTS.forEach((dept) => {
      cleanTargets[dept] = formTargets[dept] === '' ? 0 : Number(formTargets[dept]) || 0;
    });

    // Save to general storage for fallback
    saveStoredDepartmentTargets(cleanTargets);

    // Save into V2 storage for all 12 months:
    // Selected months get configured targets; unselected months marked as unselected
    const v2 = getStoredDepartmentTargetsV2();
    const yStr = String(selectedYear);
    if (!v2[yStr]) v2[yStr] = {};

    for (let m = 1; m <= 12; m++) {
      if (selectedMonths.includes(m)) {
        v2[yStr][String(m)] = { ...cleanTargets, unselected: false };
      } else {
        v2[yStr][String(m)] = { unselected: true };
      }
    }
    saveStoredDepartmentTargetsV2(v2);

    if (typeof onSaveTargets === 'function') {
      onSaveTargets(cleanTargets, {
        year: selectedYear,
        months: selectedMonths,
        targetsByYearMonth: v2
      });
    }
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 450);
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999
      }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-auto max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">
                Department Target Lines Configuration
              </h3>
              <p className="text-xs text-slate-500">
                Select Year & Months (checkboxes) to assign monthly targets for departments
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar: Year Dropdown & Months Checkboxes */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-col gap-3 text-xs">
          {/* Year Dropdown */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-slate-700">Target Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value) || currentYear)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-bold focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
              >
                {YEARS_LIST.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllMonths}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 cursor-pointer"
              >
                Select All Months
              </button>
              <button
                type="button"
                onClick={handleClearMonths}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Reset to Current Month
              </button>
            </div>
          </div>

          {/* Months in Multiple Checkboxes */}
          <div>
            <div className="font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Select Months (multiple checkboxes):</span>
              <span className="text-[11px] font-normal text-slate-500">
                {selectedMonths.length} {selectedMonths.length === 1 ? 'month' : 'months'} selected
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
              {MONTHS.map((m) => {
                const isChecked = selectedMonths.includes(m.num);
                return (
                  <label
                    key={m.num}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all select-none ${
                      isChecked
                        ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleMonthToggle(m.num)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>{m.short}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Body / Department Target Inputs */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">
              Department Target Range ({selectedYear} · {selectedMonths.map((mn) => MONTHS.find((m) => m.num === mn)?.short).join(', ')}):
            </span>
            <span className="text-[11px] text-slate-500">
              Setting will apply to all {selectedMonths.length} selected months
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {TARGET_DEPARTMENTS.map((dept) => {
              const val = formTargets[dept] !== undefined ? formTargets[dept] : '';
              return (
                <div
                  key={dept}
                  className="bg-slate-50/70 p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors flex flex-col gap-1.5"
                >
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span>{dept}</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 10"
                      value={val}
                      onChange={(e) => handleChange(dept, e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium pointer-events-none">
                      sheets
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset to default targets"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
                  saveSuccess
                    ? 'bg-emerald-600 shadow-emerald-500/20'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                }`}
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Targets</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}


