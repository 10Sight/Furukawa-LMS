import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ManualInputBox, { ManualInputOptionsContext } from './ManualInputBox';
import SearchableManualTextInput from './SearchableManualTextInput';
import CalendarDateInput from './CalendarDateInput';
import StdDurationWatchModal from './StdDurationWatchModal';
import SearchableApqpDropdown from './SearchableApqpDropdown';
import CheckboxMultiSelect from './CheckboxMultiSelect';
import AddStaffEmployeeModal from '../../pdca/AddStaffEmployeeModal';
import {
  stripEmployeeId,
  parseStaffEmployee,
  findEmployeeDepartment,
  VERIFIED_EMPLOYEE_MASTER,
} from '../../../pages/pdca/data/pdcaEmployees.js';
import {
  PDCA_UNITS,
  getDepartmentsForUnit
} from '../../../pages/pdca/data/pdcaConstants.js';
import { apqpApi, employeeApi } from '../../services/api';
import PTMDeliverableUploadModal from './PTMDeliverableUploadModal';
import {
  PTM_STATUS_OPTIONS,
  PTM_PHASE_OPTIONS,
  normalizePtmStatus,
  normalizeDateToYMD,
  getFormattedCurrentDate,
  getTodayYMD,
  getRowRevisions,
  evaluatePtmRowStatus,
  canUserEditPtmRowColumn,
} from '../../../pages/ptm/data/ptmRecordFilters.js';
import {
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Square,
  CheckSquare,
  Eye,
  EyeOff,
  Clock,
  CalendarDays,
  X,
  Search,
  User,
  Upload,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Filter
} from 'lucide-react';

const DEPARTMENTS = [
  { key: 'FA', label: 'F&A' },
  { key: 'HR', label: 'HR' },
  { key: 'MKT', label: 'MKT' },
  { key: 'DD', label: 'D&D' },
  { key: 'PE', label: 'PE' },
  { key: 'PPC', label: 'PPC' },
  { key: 'PROD', label: 'PROD' },
  { key: 'SCM', label: 'SCM' },
  { key: 'Quality', label: 'Quality' },
];

const parseDateForDuration = (value) => {
  const text = String(value || '').trim();
  let year;
  let month;
  let day;
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmy = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2}|\d{4})$/);
  if (iso) {
    [, year, month, day] = iso;
  } else if (dmy) {
    [, day, month, year] = dmy;
    if (year.length === 2) year = `20${year}`;
  } else {
    return null;
  }
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
  return date;
};

const revisedDateFromDuration = (startDate, duration) => {
  const start = parseDateForDuration(startDate);
  const days = Number(duration);
  if (!start || !String(duration ?? '').trim() || !Number.isFinite(days)) return '';
  start.setUTCDate(start.getUTCDate() + days);
  const day = String(start.getUTCDate()).padStart(2, '0');
  const month = String(start.getUTCMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${start.getUTCFullYear()}`;
};

const DEFAULT_ACTION_COLUMN_WIDTH = 132;
const MIN_ACTION_COLUMN_WIDTH = 110;
const COLLAPSED_ACTION_COLUMN_WIDTH = 38;
const STATUS_COLUMN_MIN_WIDTH = 128;
const PHASE_NAME_COLUMN_WIDTH = 180;
const DEFAULT_ROW_HEIGHT = 34;
const MIN_ROW_HEIGHT = 34;
const KEYBOARD_RESIZE_STEP = 10;

const DEFAULT_REVISION_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const DEFAULT_FAILURE_REASONS = [
  'Customer input / drawing delay',
  'Design change / revision from customer',
  'Tooling / fixture readiness delay',
  'Supplier material / sample delay',
  'Testing / validation failure',
  'Resource / capacity constraint',
];

const isRevisedTaken = (value) => {
  const text = String(value ?? '').trim();
  return text !== '' && text !== '0';
};

const toTimePickerValue = (value) => {
  const text = String(value ?? '').trim();
  if (/^\d{2}:\d{2}$/.test(text)) return text;
  const shortMatch = text.match(/^(\d{1}):(\d{2})$/);
  if (shortMatch) return `0${shortMatch[1]}:${shortMatch[2]}`;
  const num = Number(text);
  if (text && Number.isInteger(num) && num >= 0 && num <= 23) {
    return `${String(num).padStart(2, '0')}:00`;
  }
  return '';
};

function WatchTimeInput({
  value = '',
  onChange,
  className = '',
  containerClassName = '',
  ...props
}) {
  const pickerRef = useRef(null);

  return (
    <div className={`relative min-w-0 ${containerClassName || 'flex-1'}`}>
      <input
        type="text"
        value={value}
        onChange={onChange}
        className={`${className} pr-6`}
        {...props}
      />
      <Clock
        aria-hidden="true"
        className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
      />
      <input
        ref={pickerRef}
        type="time"
        value={toTimePickerValue(value)}
        onClick={(event) => event.currentTarget.showPicker?.()}
        onChange={(event) =>
          onChange({ target: { value: event.target.value } })
        }
        aria-label="Choose duration time in hours"
        title="Select time in hours"
        className="absolute right-0 top-1/2 h-6 w-6 -translate-y-1/2 cursor-pointer opacity-0"
        tabIndex={-1}
      />
    </div>
  );
}

function CriticalActivityCell({ value, onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const isYes = value === true || value === 'Yes';

  if (isEditing) {
    return (
      <select
        autoFocus
        value={isYes ? 'Yes' : 'No'}
        onChange={(event) => {
          onChange(event.target.value === 'Yes');
          setIsEditing(false);
        }}
        onBlur={() => setIsEditing(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsEditing(false);
        }}
        aria-label="Critical Activity"
        className="w-[62px] rounded border border-[#64748B] bg-white px-1 py-1 text-center text-xs sm:text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      >
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      aria-label={`Critical Activity: ${isYes ? 'Yes' : 'No'}. Click to change`}
      title="Click to change Critical Activity"
      className="inline-flex min-h-7 min-w-[34px] items-center justify-center rounded px-1 hover:bg-slate-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 cursor-pointer"
    >
      {isYes
        ? <span className="text-[22px] font-bold leading-none text-slate-900">♦</span>
        : <span className="text-xs sm:text-sm font-medium text-slate-500">No</span>}
    </button>
  );
}

const clampDimension = (value, minimum) => Math.max(minimum, Math.round(value));

const getEndDatePlanHistory = (row) => {
  if (!row) return [];
  if (Array.isArray(row.endDatePlanHistory) && row.endDatePlanHistory.length > 0) {
    return row.endDatePlanHistory
      .map((d) => String(d || '').trim())
      .filter((d) => d && d.toUpperCase() !== 'N/A' && d !== '—' && d !== '-');
  }
  const raw = String(row.endDatePlan || '').trim();
  if (!raw || raw.toUpperCase() === 'N/A' || raw === '—' || raw === '-') return [];
  return raw
    .split(/\r?\n/)
    .map((d) => d.trim())
    .filter((d) => d && d.toUpperCase() !== 'N/A' && d !== '—' && d !== '-');
};

const formatIsoToShortDMY = (isoDate) => {
  if (!isoDate) return '';
  const match = String(isoDate).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${day}-${month}-${year.slice(-2)}`;
};

const CALENDAR_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const CALENDAR_WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function EndDatePlanCell({ row, onSelectDate, onRemoveBeforeDate, isAdmin = false, disabled = false, rowIndex }) {
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const history = getEndDatePlanHistory(row);
  const previousDates = history.length > 1 ? history.slice(0, -1) : [];
  const latestDate = history.length > 0 ? history[history.length - 1] : '';
  const pickerIsoValue = latestDate ? normalizeDateToYMD(latestDate) : '';

  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const openCalendarPopover = () => {
    const baseIso = pickerIsoValue || getTodayYMD();
    const parts = baseIso.split('-').map(Number);
    if (parts.length === 3 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      setViewYear(parts[0]);
      setViewMonth(parts[1] - 1);
    } else {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const popoverWidth = 264;
      const popoverHeight = 296;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow >= popoverHeight + 8 ? rect.bottom + 4 : Math.max(8, rect.top - popoverHeight - 4);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - popoverWidth - 8);
      setCoords({ top, left });
    }
    setIsOpen(true);
  };

  const openCalendar = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (history.length > 0) {
      setShowConfirmModal(true);
      return;
    }
    openCalendarPopover();
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (
        popoverRef.current?.contains(event.target) ||
        triggerRef.current?.contains(event.target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setViewMonth((prev) => {
      if (prev === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setViewMonth((prev) => {
      if (prev === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const handleDayClick = (dayNum) => {
    if (disabled) return;
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const formatted = formatIsoToShortDMY(iso);
    if (formatted) {
      onSelectDate(formatted);
    }
    setIsOpen(false);
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayIso = getTodayYMD();

  return (
    <div
      ref={triggerRef}
      data-row={rowIndex}
      data-col="endDatePlan"
      onClick={openCalendar}
      className={`relative flex items-center justify-center min-w-[112px] w-full min-h-[34px] py-1 pl-2 pr-6 ${disabled ? 'pointer-events-none opacity-75' : 'cursor-pointer hover:bg-blue-50/40'
        }`}
      title={
        history.length > 0
          ? `End Date (Plan): ${history.join(' → ')} (Click calendar to select new End Date Plan)`
          : 'Click to select End Date (Plan)'
      }
    >
      {history.length === 0 ? (
        <span className="text-sm font-mono text-slate-400 select-none">N/A</span>
      ) : (
        <div className="flex flex-col items-center justify-center gap-0.5 py-0.5">
          {previousDates.map((prevDate, idx) => (
            <span
              key={`${prevDate}-${idx}`}
              className="inline-flex items-center gap-1 text-[11px] leading-tight text-slate-400 font-mono select-none"
            >
              <span className="line-through decoration-slate-500 decoration-1">
                {prevDate}
              </span>
              {isAdmin && !disabled && onRemoveBeforeDate && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveBeforeDate(idx);
                  }}
                  title={`Remove previous date ${prevDate}`}
                  aria-label={`Remove previous date ${prevDate}`}
                  className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer leading-none"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          ))}
          <span className="text-sm font-bold leading-snug text-slate-900 font-mono">
            {latestDate}
          </span>
        </div>
      )}

      <CalendarDays
        aria-hidden="true"
        className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
      />

      {isOpen && createPortal(
        <div
          ref={popoverRef}
          style={{ top: coords.top, left: coords.left }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[100] w-[264px] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl select-none"
          role="dialog"
          aria-label="Choose End Date (Plan)"
        >
          {/* Month / Year Navigation — only changes calendar view, never selects a date */}
          <div className="mb-2 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded-md p-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                aria-label="Month"
              >
                {CALENDAR_MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>{name.slice(0, 3)}</option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                aria-label="Year"
              >
                {Array.from({ length: 21 }, (_, idx) => new Date().getFullYear() - 10 + idx).map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded-md p-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold text-slate-400">
            {CALENDAR_WEEKDAYS.map((day) => (
              <div key={day} className="py-1">{day}</div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
            {Array.from({ length: firstDayOfMonth }, (_, idx) => (
              <div key={`empty-${idx}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, idx) => {
              const dayNum = idx + 1;
              const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isSelected = iso === pickerIsoValue;
              const isToday = iso === todayIso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => handleDayClick(dayNum)}
                  className={`h-7 w-full rounded-md font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 font-bold text-white'
                      : isToday
                      ? 'border border-blue-400 bg-blue-50 font-semibold text-blue-700 hover:bg-blue-100'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
            <button
              type="button"
              onClick={() => {
                const formatted = formatIsoToShortDMY(todayIso);
                if (formatted) onSelectDate(formatted);
                setIsOpen(false);
              }}
              className="font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}

      {showConfirmModal && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirmModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm End Date (Plan) re-selection"
        >
          <div
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-900">
              End Date (Plan)
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Sure want to select again the End Date (Plan)?
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  openCalendarPopover();
                }}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                Yes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const getRequirementInputHeight = (value) => {
  const text = String(value || '');
  if (!text) return DEFAULT_ROW_HEIGHT;
  const lineCount = text
    .split(/\r?\n/)
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 34)), 0);
  return Math.max(DEFAULT_ROW_HEIGHT, lineCount * 14 + 18);
};

export default function PTMTable({
  rows,
  setRows,
  searchQuery,
  phaseFilter,
  showToast,
  onAddNewRow,
  selectedUnit,
  isMerged = false,
  isAdmin = false,
  dbEmployees: externalDbEmployees = [],
  currentUser = null,
  hasFullSheetAccess = true,
  savedColumnSuggestions = null,
  isHeaderComplete = true,
  selectedHeaderRank = '',
  selectedHeaderPhase = '',
  onRequestAddPhaseAtRow,
  templateMode = false,
}) {
  const tableRef = useRef(null);
  const activeResizeRef = useRef(null);
  const [actionsCollapsed, setActionsCollapsed] = useState(false);
  const [ranksCollapsed, setRanksCollapsed] = useState(false);
  const [phaseCollapsed, setPhaseCollapsed] = useState(false);

  const isHeaderRankNotApplicable =
    String(selectedHeaderRank || '').trim().toLowerCase() === 'not - applicable';
  const isHeaderPhaseNotApplicable =
    String(selectedHeaderPhase || '').trim().toLowerCase() === 'not - applicable';

  const isRanksCollapsed = isHeaderRankNotApplicable && ranksCollapsed;
  const isPhaseCollapsed = isHeaderPhaseNotApplicable && phaseCollapsed;

  useEffect(() => {
    if (!isHeaderRankNotApplicable && ranksCollapsed) {
      setRanksCollapsed(false);
    }
  }, [isHeaderRankNotApplicable, ranksCollapsed]);

  useEffect(() => {
    if (!isHeaderPhaseNotApplicable && phaseCollapsed) {
      setPhaseCollapsed(false);
    }
  }, [isHeaderPhaseNotApplicable, phaseCollapsed]);
  const [colWidths, setColWidths] = useState({
    phaseName: 240,
    customerEvent: 120,
    activity: 260,
    deliverable: 220,
    actionTaken: 140,
    remarks: 140,
    actions: DEFAULT_ACTION_COLUMN_WIDTH,
  });
  const [deliverableModal, setDeliverableModal] = useState({
    isOpen: false,
    rowIndex: null,
  });
  const [watchModal, setWatchModal] = useState({
    isOpen: false,
    rowIndex: null,
    value: '',
  });
  const [rowHeights, setRowHeights] = useState({});
  const [openStaffDropdown, setOpenStaffDropdown] = useState(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [openHeaderFilter, setOpenHeaderFilter] = useState(null);
  const [headerFilterSearch, setHeaderFilterSearch] = useState('');
  const [staffEmployeeModal, setStaffEmployeeModal] = useState({
    isOpen: false,
    rowIndex: null,
    unit: null,
    department: null,
    initialValue: '',
    initialEmployees: []
  });
  const [fetchedEmployees, setFetchedEmployees] = useState([]);

  useEffect(() => {
    if (Array.isArray(externalDbEmployees) && externalDbEmployees.length > 0) return;
    let isMounted = true;
    employeeApi.getAll().then((list) => {
      if (isMounted && Array.isArray(list)) {
        setFetchedEmployees(list);
      }
    }).catch((err) => {
      console.warn('Could not fetch employees in PTMTable', err);
    });
    return () => {
      isMounted = false;
    };
  }, [externalDbEmployees]);

  const dbEmployees = useMemo(
    () => (Array.isArray(externalDbEmployees) && externalDbEmployees.length > 0 ? externalDbEmployees : fetchedEmployees),
    [externalDbEmployees, fetchedEmployees]
  );

  const activeRankKeys = useMemo(() => {
    const tokens = String(selectedHeaderRank || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (tokens.length === 0) return null;
    const keys = new Set();
    tokens.forEach((t) => {
      if (t === 'A') keys.add('rankA');
      else if (t === 'B') keys.add('rankB');
      else if (t === 'C1 & C2' || t === 'C1' || t === 'C2') keys.add('rankC');
      else if (t === 'S') keys.add('rankS');
    });
    return keys;
  }, [selectedHeaderRank]);

  const isRankColumnActive = useCallback(
    (rankKey) => !activeRankKeys || activeRankKeys.has(rankKey),
    [activeRankKeys]
  );

  const canEditCell = useCallback(
    (row, colKey) => canUserEditPtmRowColumn(row, colKey, currentUser, hasFullSheetAccess),
    [currentUser, hasFullSheetAccess]
  );

  useEffect(() => {
    if (!openStaffDropdown) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.staff-dropdown-menu')) {
        setOpenStaffDropdown(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [openStaffDropdown]);

  useEffect(() => {
    if (!openHeaderFilter) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.ptm-header-filter-popover') && !e.target.closest('.ptm-header-filter-trigger')) {
        setOpenHeaderFilter(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [openHeaderFilter]);

  const getResponsiblePersonStructure = (row) => {
    if (!row) return { units: [], deptsByUnit: {} };
    const units = (Array.isArray(row.respUnits) && row.respUnits.length > 0)
      ? row.respUnits.filter((u) => PDCA_UNITS.includes(u))
      : (row.respUnit && PDCA_UNITS.includes(row.respUnit) ? [row.respUnit] : []);

    const deptsByUnit = {};
    units.forEach((u) => {
      if (Array.isArray(row.respDeptsByUnit?.[u])) {
        deptsByUnit[u] = row.respDeptsByUnit[u];
      } else {
        const staffDepts = (row.staffEmployees || [])
          .filter((e) => (e.unit === u || (!e.unit && units.length === 1)))
          .map((e) => e.department)
          .filter(Boolean);
        if (staffDepts.length > 0) {
          deptsByUnit[u] = [...new Set(staffDepts)];
        } else if (units.length === 1 && row.responsiblePersonDept) {
          deptsByUnit[u] = row.responsiblePersonDept.split(/[,;]/).map((d) => d.trim()).filter(Boolean);
        } else {
          deptsByUnit[u] = [];
        }
      }
    });

    return { units, deptsByUnit };
  };

  const handleResponsibleUnitsChange = (rowIndex, newUnits) => {
    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex];
      if (!currentRow) return prev;

      const prevDeptsByUnit = currentRow.respDeptsByUnit || {};
      const updatedDeptsByUnit = {};
      newUnits.forEach((u) => {
        updatedDeptsByUnit[u] = prevDeptsByUnit[u] || [];
      });

      const currentList = Array.isArray(currentRow.staffEmployees) ? [...currentRow.staffEmployees] : [];
      const updatedStaffList = currentList.filter((emp) => {
        return !emp.unit || newUnits.includes(emp.unit);
      });

      const formattedStaff = updatedStaffList
        .map((e) => (e.code ? `${e.name} (${e.code})` : e.name))
        .join(', ');

      const primary = updatedStaffList[0] || {};
      const activeDepts = Object.values(updatedDeptsByUnit).flat();

      updated[rowIndex] = {
        ...currentRow,
        respUnits: newUnits,
        respUnit: newUnits[0] || '',
        responsiblePersonUnit: newUnits[0] || '',
        respDeptsByUnit: updatedDeptsByUnit,
        staffEmployees: updatedStaffList,
        staffEmployee: formattedStaff,
        staffName: primary.name || '',
        staffId: primary.code || '',
        employeeId: primary.code || '',
        responsiblePersonDept: activeDepts.join(', ') || ''
      };
      return updated;
    });
  };

  const handleUnitDepartmentsChange = (rowIndex, unit, newDepts) => {
    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex];
      if (!currentRow) return prev;

      const prevDeptsByUnit = currentRow.respDeptsByUnit || {};
      const updatedDeptsByUnit = {
        ...prevDeptsByUnit,
        [unit]: newDepts
      };

      const currentList = Array.isArray(currentRow.staffEmployees) ? [...currentRow.staffEmployees] : [];
      const updatedStaffList = currentList.filter((emp) => {
        if (emp.unit && emp.unit !== unit) return true;
        return newDepts.includes(emp.department);
      });

      const formattedStaff = updatedStaffList
        .map((e) => (e.code ? `${e.name} (${e.code})` : e.name))
        .join(', ');

      const primary = updatedStaffList[0] || {};
      const activeDepts = Object.values(updatedDeptsByUnit).flat();

      updated[rowIndex] = {
        ...currentRow,
        respDeptsByUnit: updatedDeptsByUnit,
        staffEmployees: updatedStaffList,
        staffEmployee: formattedStaff,
        staffName: primary.name || '',
        staffId: primary.code || '',
        employeeId: primary.code || '',
        responsiblePersonDept: activeDepts.join(', ') || (newDepts[0] || '')
      };
      return updated;
    });
  };

  const resolveEmployeeDept = (empOrStr) => {
    if (!empOrStr) return '';
    if (typeof empOrStr === 'object') {
      const cleanName = stripEmployeeId(empOrStr.name || empOrStr.fullName || '');
      const code = (empOrStr.code || empOrStr.empId || '').toUpperCase();
      const query = code ? `${cleanName} (${code})` : cleanName;
      return (
        findEmployeeDepartment(query, dbEmployees) ||
        findEmployeeDepartment(query, VERIFIED_EMPLOYEE_MASTER) ||
        (empOrStr.department && empOrStr.department !== 'CFT' ? empOrStr.department : '') ||
        ''
      );
    }
    return (
      findEmployeeDepartment(empOrStr, dbEmployees) ||
      findEmployeeDepartment(empOrStr, VERIFIED_EMPLOYEE_MASTER) ||
      ''
    );
  };

  const handleSelectStaffForUnitDept = (rowIndex, unit, department, empObj, appendMode = false) => {
    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex];
      if (!currentRow) return prev;

      let targetDept = department;
      let targetUnit = unit;

      if (empObj && empObj.name) {
        const cleanName = stripEmployeeId(empObj.name);
        const code = (empObj.code || '').toUpperCase();
        const autoDept = resolveEmployeeDept({ ...empObj, name: cleanName, code });
        targetDept = targetDept || autoDept;
        if (!targetUnit) {
          targetUnit = empObj.unit || (code.startsWith('GJ') ? 'Gujrat' : (code.startsWith('BW') ? 'Bawal' : (currentRow.respUnit || currentRow.unit || 'Bawal')));
        }
      }

      const currentList = Array.isArray(currentRow.staffEmployees) ? [...currentRow.staffEmployees] : [];
      const filtered = appendMode
        ? currentList
        : currentList.filter(
          (emp) => !(targetUnit && emp.unit === targetUnit && (targetDept ? emp.department === targetDept : true))
        );

      if (empObj && empObj.name) {
        const cleanName = stripEmployeeId(empObj.name);
        const code = (empObj.code || '').toUpperCase();
        const alreadyExists = filtered.some(
          (e) =>
            (e.unit || '') === (targetUnit || '') &&
            (e.department || '') === (targetDept || '') &&
            (code ? (e.code || '').toUpperCase() === code : (e.name || '').toLowerCase() === cleanName.toLowerCase())
        );
        if (!alreadyExists) {
          filtered.push({
            id: empObj.id || undefined,
            name: cleanName,
            code,
            department: targetDept,
            unit: targetUnit
          });
        }
      }

      const formattedStaff = filtered
        .map((e) => (e.code ? `${e.name} (${e.code})` : e.name))
        .join(', ');

      const primary = filtered[0] || {};
      const allDepts = [...new Set(filtered.map((e) => e.department).filter(Boolean))];
      const finalUnit = targetUnit || primary.unit || currentRow.respUnit || 'Bawal';
      const prevDeptsByUnit = currentRow.respDeptsByUnit || {};
      const updatedDeptsByUnit = {
        ...prevDeptsByUnit,
        [finalUnit]: allDepts.length > 0 ? allDepts : (prevDeptsByUnit[finalUnit] || [])
      };

      updated[rowIndex] = {
        ...currentRow,
        staffEmployees: filtered,
        staffEmployee: formattedStaff,
        staffName: primary.name || '',
        staffId: primary.code || '',
        employeeId: primary.code || '',
        respUnit: finalUnit,
        respUnits: (currentRow.respUnits && currentRow.respUnits.length > 0) ? currentRow.respUnits : [finalUnit],
        responsiblePersonUnit: finalUnit,
        respDeptsByUnit: updatedDeptsByUnit,
        responsiblePersonDept: allDepts.join(', ') || currentRow.responsiblePersonDept || ''
      };
      return updated;
    });
  };

  const handleRemoveDepartmentEmployee = (rowIndex, unit, department, employee) => {
    setRows((prev) => prev.map((row, index) => {
      if (index !== rowIndex) return row;
      const staffEmployees = (Array.isArray(row.staffEmployees) ? row.staffEmployees : []).filter((entry) => {
        const sameDepartment = entry.department === department && (entry.unit === unit || !entry.unit);
        const sameEmployee = employee.code ? entry.code === employee.code : entry.name === employee.name;
        return !(sameDepartment && sameEmployee);
      });
      const primary = staffEmployees[0] || {};
      const staffEmployee = staffEmployees.map((entry) => entry.code ? `${entry.name} (${entry.code})` : entry.name).join(', ');
      const targetUnit = unit || row.respUnit || 'Bawal';
      const remainingUnitDepts = [...new Set(
        staffEmployees
          .filter((e) => !e.unit || e.unit === targetUnit)
          .map((e) => e.department)
          .filter(Boolean)
      )];
      const prevDeptsByUnit = row.respDeptsByUnit || {};
      const updatedDeptsByUnit = {
        ...prevDeptsByUnit,
        [targetUnit]: remainingUnitDepts
      };
      const allDepts = [...new Set(Object.values(updatedDeptsByUnit).flat().concat(staffEmployees.map((e) => e.department)).filter(Boolean))];
      return {
        ...row,
        staffEmployees,
        staffEmployee,
        staffName: primary.name || '',
        staffId: primary.code || '',
        employeeId: primary.code || '',
        respDeptsByUnit: updatedDeptsByUnit,
        responsiblePersonDept: allDepts.join(', ')
      };
    }));
  };

  const handleOpenAddStaffModal = (rowIndex, unit = null, department = null) => {
    const row = rows[rowIndex];
    const allExisting = Array.isArray(row?.staffEmployees) && row.staffEmployees.length > 0
      ? row.staffEmployees
      : (row?.staffEmployee
        ? row.staffEmployee.split(/[,;]/).map((s) => s.trim()).filter(Boolean).map((p) => {
          const parsed = parseStaffEmployee(p);
          return {
            name: parsed.name,
            code: parsed.code,
            department: resolveEmployeeDept(p)
          };
        })
        : []);
    const existing = unit && department
      ? allExisting.filter((employee) => employee.department === department && (employee.unit === unit || !employee.unit))
      : allExisting;

    const initialEmployees = existing.length > 0
      ? [...existing, { name: '', code: '', department: '' }]
      : [{ name: '', code: '', department: '' }];

    setStaffEmployeeModal({
      isOpen: true,
      rowIndex,
      unit,
      department,
      initialValue: row?.staffEmployee || '',
      initialEmployees
    });
  };

  const handleSaveDepartmentStaff = (_rowIndex, _formattedValue, employees) => {
    const { rowIndex, unit, department } = staffEmployeeModal;
    if (rowIndex == null) return;
    setRows((prev) => prev.map((row, index) => {
      if (index !== rowIndex) return row;
      const current = Array.isArray(row.staffEmployees) ? row.staffEmployees : [];
      const retained = department
        ? current.filter((employee) => !(employee.department === department && (employee.unit === unit || !employee.unit)))
        : current.filter((employee) => (unit ? employee.unit !== unit : false));
      const targetUnit = unit || row.respUnit || (Array.isArray(row.respUnits) && row.respUnits[0]) || 'Bawal';
      const additions = employees
        .filter((employee) => employee.name)
        .map((employee) => {
          const cleanName = stripEmployeeId(employee.name);
          const code = (employee.code || '').toUpperCase();
          const resolvedDept = resolveEmployeeDept({ ...employee, name: cleanName, code }) || department || '';
          return {
            ...employee,
            name: cleanName,
            code,
            department: resolvedDept,
            unit: targetUnit
          };
        });
      const staffEmployees = [...retained, ...additions];
      const primary = staffEmployees[0] || {};
      const staffEmployee = staffEmployees.map((employee) => employee.code ? `${employee.name} (${employee.code})` : employee.name).join(', ');
      const unitStaffDepts = staffEmployees
        .filter((e) => !e.unit || e.unit === targetUnit)
        .map((e) => e.department)
        .filter(Boolean);
      const prevUnitDepts = Array.isArray(row.respDeptsByUnit?.[targetUnit]) ? row.respDeptsByUnit[targetUnit] : [];
      const mergedUnitDepts = [...new Set([...prevUnitDepts.filter((d) => d !== department || unitStaffDepts.includes(d)), ...unitStaffDepts])];
      const updatedDeptsByUnit = {
        ...(row.respDeptsByUnit || {}),
        [targetUnit]: mergedUnitDepts
      };
      const allDepts = [...new Set(Object.values(updatedDeptsByUnit).flat().concat(staffEmployees.map((e) => e.department)).filter(Boolean))];
      return {
        ...row,
        staffEmployees,
        staffEmployee,
        staffName: primary.name || '',
        staffId: primary.code || '',
        employeeId: primary.code || '',
        respUnit: row.respUnit || targetUnit,
        respUnits: (Array.isArray(row.respUnits) && row.respUnits.length > 0) ? row.respUnits : [targetUnit],
        respDeptsByUnit: updatedDeptsByUnit,
        responsiblePersonDept: allDepts.join(', ')
      };
    }));
  };

  const handleSaveStaffEmployee = (rowIndex, formattedValue, employeeList = []) => {
    if (rowIndex == null) return;
    setRows((prev) => prev.map((row, index) => {
      if (index !== rowIndex) return row;
      const targetUnit = staffEmployeeModal.unit || row.respUnit || (Array.isArray(row.respUnits) && row.respUnits[0]) || 'Bawal';
      const additions = employeeList
        .filter((employee) => employee.name)
        .map((employee) => {
          const cleanName = stripEmployeeId(employee.name);
          const code = (employee.code || '').toUpperCase();
          const resolvedDept = resolveEmployeeDept({ ...employee, name: cleanName, code }) || '';
          return {
            ...employee,
            name: cleanName,
            code,
            department: resolvedDept,
            unit: employee.unit || targetUnit
          };
        });
      const primary = additions[0] || {};
      const staffEmployee = additions.map((employee) => employee.code ? `${employee.name} (${employee.code})` : employee.name).join(', ') || formattedValue;
      const unitStaffDepts = additions
        .filter((e) => !e.unit || e.unit === targetUnit)
        .map((e) => e.department)
        .filter(Boolean);
      const prevUnitDepts = Array.isArray(row.respDeptsByUnit?.[targetUnit]) ? row.respDeptsByUnit[targetUnit] : [];
      const mergedUnitDepts = [...new Set([...prevUnitDepts, ...unitStaffDepts])];
      const updatedDeptsByUnit = {
        ...(row.respDeptsByUnit || {}),
        [targetUnit]: mergedUnitDepts
      };
      const allDepts = [...new Set(Object.values(updatedDeptsByUnit).flat().concat(additions.map((e) => e.department)).filter(Boolean))];
      return {
        ...row,
        staffEmployees: additions,
        staffEmployee,
        staffName: primary.name || '',
        staffId: primary.code || '',
        employeeId: primary.code || '',
        respUnit: row.respUnit || targetUnit,
        respUnits: (Array.isArray(row.respUnits) && row.respUnits.length > 0) ? row.respUnits : [targetUnit],
        respDeptsByUnit: updatedDeptsByUnit,
        responsiblePersonDept: allDepts.join(', ') || row.responsiblePersonDept || ''
      };
    }));
  };

  const handleToggleStaffDropdownForDept = (rowIndex, unit, department, e, appendMode = false) => {
    e.stopPropagation();
    if (
      openStaffDropdown?.rowIndex === rowIndex &&
      openStaffDropdown?.unit === unit &&
      openStaffDropdown?.department === department &&
      Boolean(openStaffDropdown?.appendMode) === Boolean(appendMode)
    ) {
      setOpenStaffDropdown(null);
      return;
    }
    setStaffSearchQuery('');
    const rect = e.currentTarget.getBoundingClientRect();
    const dropdownWidth = 280;
    let leftPos = rect.left + (rect.width / 2) - (dropdownWidth / 2);
    if (leftPos + dropdownWidth > window.innerWidth - 12) {
      leftPos = window.innerWidth - dropdownWidth - 12;
    }
    if (leftPos < 12) {
      leftPos = 12;
    }

    let topPos = rect.bottom + 4;
    const estimatedHeight = 320;
    if (topPos + estimatedHeight > window.innerHeight - 12 && rect.top - estimatedHeight > 12) {
      topPos = rect.top - estimatedHeight - 4;
    }

    setOpenStaffDropdown({
      rowIndex,
      unit,
      department,
      appendMode: Boolean(appendMode),
      top: topPos,
      left: Math.max(12, leftPos),
      width: dropdownWidth
    });
  };

  const employeeOptionList = useMemo(() => {
    const map = new Map();
    dbEmployees.forEach((emp, idx) => {
      const cleanName = stripEmployeeId(emp.name || emp.fullName || '');
      if (!cleanName) return;
      const code = String(emp.code || emp.empId || '').trim();
      const key = `${cleanName.toLowerCase()}__${code.toLowerCase() || emp.id || idx}`;
      map.set(key, {
        id: emp.id,
        label: cleanName,
        name: cleanName,
        code,
        department: emp.department || '',
        unit: emp.unit || (code.toUpperCase().startsWith('GJ') ? 'Gujrat' : (code.toUpperCase().startsWith('BW') ? 'Bawal' : ''))
      });
    });

    return Array.from(map.values());
  }, [dbEmployees]);

  const getStaffOptionsForRow = (_rowIndex, _targetUnit = null, targetDept = null) => {
    const deptToUse = targetDept || '';
    const currentDept = deptToUse.trim().toLowerCase();
    const query = staffSearchQuery.trim().toLowerCase();

    let list = employeeOptionList;
    if (query) {
      list = list.filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          (item.department && item.department.toLowerCase().includes(query)) ||
          (item.code && item.code.toLowerCase().includes(query))
      );
    }

    if (currentDept && !openStaffDropdown?.appendMode) {
      const deptOnlyMatches = list.filter((item) => (item.department || '').toLowerCase() === currentDept);
      if (deptOnlyMatches.length > 0) {
        return deptOnlyMatches;
      }
    }

    return list;
  };

  const recordManualRowHeight = useCallback((rowIndex, measuredHeight) => {
    const row = rows[rowIndex];
    if (!row?.id || !Number.isFinite(measuredHeight)) return;
    const nextHeight = Math.max(DEFAULT_ROW_HEIGHT, Math.ceil(measuredHeight));
    const targetHeight = nextHeight > DEFAULT_ROW_HEIGHT + 2 ? nextHeight : null;
    setRowHeights((current) => {
      if (targetHeight === null) {
        if (!(row.id in current)) return current;
        const { [row.id]: ignored, ...remaining } = current;
        return remaining;
      }
      return current[row.id] === targetHeight ? current : { ...current, [row.id]: targetHeight };
    });
    setRows((currentRows) => {
      const currentRow = currentRows.find((item) => item.id === row.id);
      if (!currentRow) return currentRows;
      if (targetHeight === null) {
        if (!currentRow.manualRowHeight) return currentRows;
        return currentRows.map((item) => {
          if (item.id !== row.id) return item;
          const { manualRowHeight, ...rest } = item;
          return rest;
        });
      }
      if (currentRow.manualRowHeight === targetHeight) return currentRows;
      return currentRows.map((item) => item.id === row.id ? { ...item, manualRowHeight: targetHeight } : item);
    });
  }, [rows, setRows]);

  const handleTableInput = useCallback((event) => {
    const input = event.target;
    if (!(input instanceof HTMLTextAreaElement) || !input.classList.contains('manual-input-box')) return;
    const rowIndex = Number(input.dataset.row);
    const tr = input.closest('tr');
    if (!Number.isInteger(rowIndex) || !tr) return;
    const measuredHeight = [...tr.querySelectorAll('textarea.manual-input-box')].reduce((height, cell) => {
      const inlineHeight = Number.parseFloat(cell.style.height) || DEFAULT_ROW_HEIGHT;
      return Math.max(height, inlineHeight, cell.scrollHeight);
    }, DEFAULT_ROW_HEIGHT);
    recordManualRowHeight(rowIndex, measuredHeight + 2);
  }, [recordManualRowHeight]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      tableRef.current?.querySelectorAll('tbody tr').forEach((tr) => {
        const input = tr.querySelector('textarea.manual-input-box');
        const rowIndex = Number(input?.dataset.row);
        if (!input || !Number.isInteger(rowIndex)) return;
        const measuredHeight = [...tr.querySelectorAll('textarea.manual-input-box')].reduce((height, cell) => {
          const inlineHeight = Number.parseFloat(cell.style.height) || DEFAULT_ROW_HEIGHT;
          return Math.max(height, inlineHeight, cell.scrollHeight);
        }, DEFAULT_ROW_HEIGHT);
        recordManualRowHeight(rowIndex, measuredHeight + 2);
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [rows, recordManualRowHeight]);

  const manualOptionsByColumn = useMemo(() => {
    const columns = ['phaseName', 'reqNo', 'customerEvent', 'activity', 'deliverable', 'duration', 'noOfTimesRevised', 'reasonOfFailure', 'actionTaken', 'remarks'];
    const baseOptions = Object.fromEntries(columns.map((column) => [
      column,
      [...new Set(rows.map((row) => String(row[column] ?? '').trim()).filter(Boolean))],
    ]));
    baseOptions.customerEvent = Array.isArray(savedColumnSuggestions?.customerEvent)
      ? [...new Set(savedColumnSuggestions.customerEvent.map((v) => String(v || '').trim()).filter(Boolean))]
      : [];
    baseOptions.activity = Array.isArray(savedColumnSuggestions?.activity)
      ? [...new Set(savedColumnSuggestions.activity.map((v) => String(v || '').trim()).filter(Boolean))]
      : [];
    baseOptions.noOfTimesRevised = [
      ...new Set([
        ...DEFAULT_REVISION_OPTIONS,
        ...baseOptions.noOfTimesRevised.filter((v) => v !== '0'),
      ]),
    ];
    baseOptions.reasonOfFailure = [
      ...new Set([
        ...DEFAULT_FAILURE_REASONS,
        ...baseOptions.reasonOfFailure,
      ]),
    ];
    return baseOptions;
  }, [rows, savedColumnSuggestions]);

  const startColResize = (event, colKey) => {
    event.preventDefault();
    event.stopPropagation();
    activeResizeRef.current = {
      type: 'col',
      colKey,
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: colWidths[colKey] || 120,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const startColumnResize = (event) => startColResize(event, 'actions');

  const startRowResize = (event, rowId) => {
    if (!rowId) return;
    event.preventDefault();
    event.stopPropagation();
    const rowElement = event.currentTarget.closest('tr');
    activeResizeRef.current = {
      type: 'row',
      rowId,
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: rowElement?.getBoundingClientRect().height ?? DEFAULT_ROW_HEIGHT,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const continueResize = (event) => {
    const activeResize = activeResizeRef.current;
    if (!activeResize || activeResize.pointerId !== event.pointerId) return;
    event.preventDefault();

    if (activeResize.type === 'col') {
      const minW = activeResize.colKey === 'actions' ? MIN_ACTION_COLUMN_WIDTH : 60;
      const nextWidth = Math.max(
        minW,
        activeResize.startWidth + (event.clientX - activeResize.startX)
      );
      setColWidths((prev) => ({
        ...prev,
        [activeResize.colKey]: nextWidth,
      }));
      return;
    }
    if (activeResize.type === 'column') {
      const nextWidth = clampDimension(
        activeResize.startWidth + event.clientX - activeResize.startX,
        MIN_ACTION_COLUMN_WIDTH
      );
      setColWidths((prev) => ({ ...prev, actions: nextWidth }));
      return;
    }

    const nextHeight = clampDimension(
      activeResize.startHeight + event.clientY - activeResize.startY,
      MIN_ROW_HEIGHT
    );
    setRowHeights((currentHeights) => {
      if (currentHeights[activeResize.rowId] === nextHeight) return currentHeights;
      return { ...currentHeights, [activeResize.rowId]: nextHeight };
    });
  };

  const finishResize = (event) => {
    const activeResize = activeResizeRef.current;
    if (!activeResize || activeResize.pointerId !== event.pointerId) return;
    activeResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleResizeKeyDown = (event, type, rowId) => {
    const decreaseKey = type === 'column' ? 'ArrowLeft' : 'ArrowUp';
    const increaseKey = type === 'column' ? 'ArrowRight' : 'ArrowDown';
    if (![decreaseKey, increaseKey, 'Home'].includes(event.key)) return;

    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? KEYBOARD_RESIZE_STEP * 3 : KEYBOARD_RESIZE_STEP;
    const direction = event.key === decreaseKey ? -step : event.key === increaseKey ? step : 0;

    if (type === 'col' && rowId) {
      const minW = rowId === 'actions' ? MIN_ACTION_COLUMN_WIDTH : 60;
      setColWidths((prev) => ({
        ...prev,
        [rowId]: Math.max(minW, (prev[rowId] || 120) + direction),
      }));
      return;
    }
    if (type === 'column') {
      setColWidths((prev) => ({
        ...prev,
        actions: clampDimension(
          event.key === 'Home' ? MIN_ACTION_COLUMN_WIDTH : (prev.actions || DEFAULT_ACTION_COLUMN_WIDTH) + direction,
          MIN_ACTION_COLUMN_WIDTH
        ),
      }));
      return;
    }

    setRowHeights((currentHeights) => {
      const rowElement = event.currentTarget.closest('tr');
      const currentHeight =
        currentHeights[rowId] ?? rowElement?.getBoundingClientRect().height ?? DEFAULT_ROW_HEIGHT;
      return {
        ...currentHeights,
        [rowId]: clampDimension(
          event.key === 'Home' ? MIN_ROW_HEIGHT : currentHeight + direction,
          MIN_ROW_HEIGHT
        ),
      };
    });
  };

  /* ── Cycle Rank: ■ (applicable) -> □ (if_required) -> '' (none) ── */
  const cycleRank = (rowIndex, rankKey) => {
    if (!isRankColumnActive(rankKey)) return;
    if (!canEditCell(rows[rowIndex], rankKey)) return;
    setRows((prev) => {
      const updated = [...prev];
      const current = updated[rowIndex][rankKey];
      let nextVal = '';
      if (!current || current === '') {
        nextVal = 'applicable';
      } else if (current === 'applicable') {
        nextVal = 'if_required';
      } else {
        nextVal = '';
      }
      updated[rowIndex] = { ...updated[rowIndex], [rankKey]: nextVal };
      return updated;
    });
  };

  /* ── Cycle Dept: ● (owner) -> ○ (support) -> '' (none) ── */
  const cycleDept = (rowIndex, deptKey) => {
    if (!canEditCell(rows[rowIndex], 'departments')) return;
    setRows((prev) => {
      const updated = [...prev];
      const currentDepts = { ...(updated[rowIndex].departments || {}) };
      const currentVal = currentDepts[deptKey] || '';
      let nextVal = '';
      if (!currentVal) {
        nextVal = 'owner';
      } else if (currentVal === 'owner') {
        nextVal = 'support';
      } else {
        nextVal = '';
      }
      currentDepts[deptKey] = nextVal;
      updated[rowIndex] = { ...updated[rowIndex], departments: currentDepts };
      return updated;
    });
  };

  /* ── Cell text/value update ── */
  const handleCellChange = (rowIndex, field, val) => {
    const prevRow = rows[rowIndex];
    if (!canEditCell(prevRow, field)) {
      if (showToast) showToast('⚠️ You only have permission to edit assigned responsible columns on your row');
      return;
    }
    // Status column: Only sheet creator / admin can select 'Done' or edit status
    if (field === 'status' && !hasFullSheetAccess) {
      if (showToast) showToast('⚠️ Only the sheet creator or admin can update Status');
      return;
    }
    if (field === 'reasonOfFailure' && !isRevisedTaken(prevRow?.noOfTimesRevised)) {
      if (showToast) showToast('⚠️ Please select No. of Times Revised first');
      return;
    }

    if (field === 'noOfTimesRevised') {
      const wasTaken = isRevisedTaken(prevRow?.noOfTimesRevised);
      const nowTaken = isRevisedTaken(val);
      if (nowTaken && !wasTaken && !String(prevRow?.reasonOfFailure || '').trim()) {
        if (showToast) showToast('⚠️ Please provide Reason of Failure');
      }
    }

    setRows((prev) => {
      const updated = [...prev];
      let row = { ...updated[rowIndex], [field]: val };
      if (field === 'noOfTimesRevised' && !isRevisedTaken(val)) {
        row.reasonOfFailure = '';
      }
      if (field === 'duration' || field === 'startDatePlan') {
        const calculatedDate = revisedDateFromDuration(
          field === 'startDatePlan' ? val : row.startDatePlan,
          field === 'duration' ? val : row.duration,
        );
        if (calculatedDate || row.revisedDateAuto) {
          row.revisedDate = calculatedDate;
          row.revisedDateAuto = Boolean(calculatedDate);
        }
      } else if (field === 'revisedDate') {
        row.revisedDateAuto = false;
      }

      // Automated Status and HIT/MISS lifecycle evaluation
      if (
        field === 'startDateActual' ||
        field === 'endDatePlan' ||
        field === 'endDateActual' ||
        field === 'revisedDate' ||
        field === 'hitMiss'
      ) {
        if (field === 'hitMiss') {
          // Once filled for the first time, HIT/MISS cannot be changed
          if (prevRow?.hitMiss === 'HIT' || prevRow?.hitMiss === 'MISS') {
            return prev;
          }
          // Note: Status is NOT automatically set to 'Done' when HIT is selected; Done can only be selected manually by creator/admin
          if (val === 'MISS' && row.status !== 'Done') row.status = 'Delay';
          else if (!val && row.status !== 'Done') row.status = row.revisedDate ? 'In-Progress' : 'Not-Started';
        } else {
          const evalRes = evaluatePtmRowStatus(row);
          // Preserve Done status if manually set by creator/admin, otherwise use evaluated status (which never auto-sets to Done)
          if (row.status !== 'Done') {
            row.status = evalRes.status;
          }
          // Preserve HIT/MISS if already filled
          if (prevRow?.hitMiss === 'HIT' || prevRow?.hitMiss === 'MISS') {
            row.hitMiss = prevRow.hitMiss;
          } else {
            row.hitMiss = evalRes.hitMiss;
          }
        }

        // When row enters Delay or MISS, initialize 1) current date revision if none exists
        if (row.status === 'Delay' || row.hitMiss === 'MISS') {
          const revs = getRowRevisions(row);
          if (revs.length === 0) {
            const firstRev = {
              revisionNo: 1,
              tag: `1) ${getFormattedCurrentDate()}`,
              date: getFormattedCurrentDate(),
              reasonOfFailure: row.reasonOfFailure || '',
              actionTaken: row.actionTaken || ''
            };
            row.revisions = [firstRev];
            row.noOfTimesRevised = firstRev.tag;
          }
        }
      }

      updated[rowIndex] = row;
      return updated;
    });
  };

  const handleSelectEndDatePlan = (rowIndex, selectedDate) => {
    const prevRow = rows[rowIndex];
    if (!canEditCell(prevRow, 'endDatePlan')) {
      if (showToast) showToast('⚠️ You only have permission to edit your assigned row');
      return;
    }

    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex];
      if (!currentRow) return prev;

      const prevHistory = getEndDatePlanHistory(currentRow);
      const cleanDate = String(selectedDate || '').trim();
      if (!cleanDate) return prev;

      const isNewSelection = prevHistory[prevHistory.length - 1] !== cleanDate;
      const nextHistory = isNewSelection ? [...prevHistory, cleanDate] : prevHistory;

      const row = {
        ...currentRow,
        endDatePlanHistory: nextHistory,
        endDatePlan: nextHistory.join('\n'),
      };

      const evalRes = evaluatePtmRowStatus(row);
      row.status = evalRes.status;
      // Preserve HIT/MISS if already filled
      if (currentRow.hitMiss === 'HIT' || currentRow.hitMiss === 'MISS') {
        row.hitMiss = currentRow.hitMiss;
      } else {
        row.hitMiss = evalRes.hitMiss;
      }

      // Auto-fetch No. of Times Revised when End Date (Plan) is re-selected or enters Delay/MISS
      const existingRevs = getRowRevisions(row);
      if ((isNewSelection && prevHistory.length >= 1) || ((row.status === 'Delay' || row.hitMiss === 'MISS') && existingRevs.length === 0)) {
        const nextNum = existingRevs.length + 1;
        // Show current date when the revision is taken, not the target deadline
        const revDateStr = getFormattedCurrentDate();
        const newRev = {
          revisionNo: nextNum,
          tag: `${nextNum}) ${revDateStr}`,
          date: revDateStr,
          reasonOfFailure: existingRevs.length === 0 ? (row.reasonOfFailure || '') : '',
          actionTaken: existingRevs.length === 0 ? (row.actionTaken || '') : '',
        };
        const nextRevs = [...existingRevs, newRev];
        row.revisions = nextRevs;
        row.noOfTimesRevised = nextRevs.map((r) => r.tag).join('\n');
        row.reasonOfFailure = nextRevs.map((r) => r.reasonOfFailure || '').join('\n');
        row.actionTaken = nextRevs.map((r) => r.actionTaken || '').join('\n');
      }

      updated[rowIndex] = row;
      return updated;
    });
  };

  const handleRemoveBeforeDate = (rowIndex, prevIdx) => {
    if (!isAdmin) return;
    const prevRow = rows[rowIndex];
    if (!canEditCell(prevRow, 'endDatePlan')) {
      if (showToast) showToast('⚠️ You only have permission to edit your assigned row');
      return;
    }

    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex];
      if (!currentRow) return prev;

      const prevHistory = getEndDatePlanHistory(currentRow);
      if (prevHistory.length <= 1 || prevIdx < 0 || prevIdx >= prevHistory.length - 1) {
        return prev;
      }

      const nextHistory = prevHistory.filter((_, idx) => idx !== prevIdx);
      const row = {
        ...currentRow,
        endDatePlanHistory: nextHistory,
        endDatePlan: nextHistory.join('\n'),
        revisions: [],
        noOfTimesRevised: '',
        reasonOfFailure: '',
      };

      const evalRes = evaluatePtmRowStatus(row);
      row.status = evalRes.status;
      if (currentRow.hitMiss === 'HIT' || currentRow.hitMiss === 'MISS') {
        row.hitMiss = currentRow.hitMiss;
      } else {
        row.hitMiss = evalRes.hitMiss;
      }

      updated[rowIndex] = row;
      return updated;
    });

    if (showToast) showToast('Previous End Date (Plan) removed');
  };

  const handleAddRevision = (rowIndex) => {
    if (!canEditCell(rows[rowIndex], 'noOfTimesRevised')) return;
    setRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[rowIndex] };
      const currentRevs = getRowRevisions(row);
      const nextNum = currentRevs.length + 1;
      const todayTag = `${nextNum}) ${getFormattedCurrentDate()}`;
      const newRev = {
        revisionNo: nextNum,
        tag: todayTag,
        date: getFormattedCurrentDate(),
        reasonOfFailure: '',
        actionTaken: ''
      };
      const nextRevs = [...currentRevs, newRev];
      row.revisions = nextRevs;
      row.noOfTimesRevised = nextRevs.map(r => r.tag).join('\n');
      row.reasonOfFailure = nextRevs.map(r => r.reasonOfFailure || '').join('\n');
      row.actionTaken = nextRevs.map(r => r.actionTaken || '').join('\n');
      updated[rowIndex] = row;
      return updated;
    });
    if (showToast) showToast('✓ Added revision');
  };

  const handleRemoveRevision = (rowIndex, revIdx) => {
    if (!canEditCell(rows[rowIndex], 'noOfTimesRevised')) return;
    setRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[rowIndex] };
      const currentRevs = getRowRevisions(row);
      const nextRevs = currentRevs.filter((_, idx) => idx !== revIdx).map((r, i) => ({
        ...r,
        revisionNo: i + 1,
        tag: `${i + 1}) ${r.date || getFormattedCurrentDate()}`
      }));
      row.revisions = nextRevs;
      row.noOfTimesRevised = nextRevs.map(r => r.tag).join('\n');
      row.reasonOfFailure = nextRevs.map(r => r.reasonOfFailure || '').join('\n');
      row.actionTaken = nextRevs.map(r => r.actionTaken || '').join('\n');
      updated[rowIndex] = row;
      return updated;
    });
  };

  const handleRevisionCellChange = (rowIndex, revIdx, subField, val) => {
    if (!canEditCell(rows[rowIndex], subField)) return;
    setRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[rowIndex] };
      const currentRevs = getRowRevisions(row);
      const nextRevs = currentRevs.map((r, idx) => {
        if (idx === revIdx) {
          return { ...r, [subField]: val };
        }
        return r;
      });
      row.revisions = nextRevs;
      row.noOfTimesRevised = nextRevs.map(r => r.tag).join('\n');
      row.reasonOfFailure = nextRevs.map(r => r.reasonOfFailure || '').join('\n');
      row.actionTaken = nextRevs.map(r => r.actionTaken || '').join('\n');
      updated[rowIndex] = row;
      return updated;
    });
  };

  const clearRevision = (rowIndex) => {
    if (!canEditCell(rows[rowIndex], 'noOfTimesRevised')) return;
    setRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        revisions: [],
        noOfTimesRevised: '',
        reasonOfFailure: '',
      };
      return updated;
    });
    if (showToast) showToast('No. of Times Revised removed');
  };

  const handleDeliverableUploadSuccess = (rowIndex, fileData) => {
    if (!canEditCell(rows[rowIndex], 'deliverableRequired')) return;
    setRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        deliverableFile: fileData,
        deliverable: fileData?.name || 'Attached',
        deliverableRequired: 'Yes'
      };
      return updated;
    });
    if (showToast) showToast(`✓ Attached ${fileData.name}`);
  };

  const handleRemoveDeliverableFile = (rowIndex) => {
    if (!canEditCell(rows[rowIndex], 'deliverableRequired')) return;
    setRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        deliverableFile: null,
        deliverable: ''
      };
      return updated;
    });
    if (showToast) showToast('Attachment removed');
  };

  const isChildRow = (row) => row.rowType === 'child' || (
    row.addedFrom === 'form' && row.formGroupRole === 'child'
  );
  const getParentRowId = (row) => row.parentRowId || (
    row.addedFrom === 'form' && row.formGroupRole === 'child' ? row.formGroupId : null
  );
  const isParentRow = (row) => !isChildRow(row);
  const getParentSerial = (parent, parentIndex) => {
    const storedSerial = Number(parent.parentSerialNo);
    return Number.isInteger(storedSerial) && storedSerial > 0
      ? storedSerial
      : rows.slice(0, parentIndex + 1).filter(isParentRow).length;
  };
  const getChildSerial = (child, parentId) => {
    const storedSerial = Number(child.childSerialNo);
    if (Number.isInteger(storedSerial) && storedSerial > 0) return storedSerial;
    const siblings = rows.filter((row) => getParentRowId(row) === parentId);
    return siblings.findIndex((row) => row.id === child.id) + 1;
  };
  const getRowSerial = (row, rowIndex) => {
    if (!isChildRow(row)) return getParentSerial(row, rowIndex);
    const parentId = getParentRowId(row);
    const parentIndex = rows.findIndex((candidate) => candidate.id === parentId);
    const parent = rows[parentIndex];
    const phaseNumber = Number(parent?.phaseNo);
    if (!parent || !Number.isInteger(phaseNumber) || phaseNumber <= 0) return '';

    return `${phaseNumber}.${getChildSerial(row, parentId)}`;
  };
  const areChildrenHidden = (parent, currentRows = rows) => Boolean(
    parent.childrenHidden || currentRows.some((row) => (
      getParentRowId(row) === parent.id && row.isHidden
    ))
  );

  /* ── Add New Row (Infinite Rows capability) ── */
  const addNewRow = (insertIndex = null, focusCol = 'activity') => {
    const newId = 'row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    let targetIndex = insertIndex ?? rows.length;
    const anchorRow = rows[Math.max(0, targetIndex - 1)] || rows[rows.length - 1];
    const parentRow = anchorRow
      ? (isChildRow(anchorRow) ? rows.find((row) => row.id === getParentRowId(anchorRow)) : anchorRow)
      : null;

    if (!parentRow || !isParentRow(parentRow)) {
      if (showToast) showToast('⚠️ Add a parent row from Filters before adding a child row');
      return;
    }

    const siblingRows = rows.filter((row) => getParentRowId(row) === parentRow.id);
    const usedChildSerials = new Set(siblingRows.map((row, index) => {
      const storedSerial = Number(row.childSerialNo);
      return Number.isInteger(storedSerial) && storedSerial > 0 ? storedSerial : index + 1;
    }));
    const childSerialNo = Array.from({ length: 9 }, (_, index) => index + 1)
      .find((serial) => !usedChildSerials.has(serial));
    if (!childSerialNo) {
      if (showToast) showToast('⚠️ This parent already has 9 child rows. Add a new parent row.');
      return;
    }
    const parentIndex = rows.findIndex((row) => row.id === parentRow.id);
    const phaseNumber = Number(parentRow.phaseNo);
    const childReqNo = Number.isInteger(phaseNumber) && phaseNumber > 0
      ? `${phaseNumber}.${childSerialNo}`
      : '';

    // A child added from a parent is appended after that parent's existing children.
    if (anchorRow && isParentRow(anchorRow)) {
      while (targetIndex < rows.length && getParentRowId(rows[targetIndex]) === parentRow.id) {
        targetIndex += 1;
      }
    }

    const newRow = {
      id: newId,
      addedFrom: 'form',
      rowType: 'child',
      parentRowId: parentRow.id,
      childSerialNo,
      unit: selectedUnit || 'Both',
      phaseNo: '',
      phaseName: '',
      reqNo: '',
      reqName: '',
      customerEvent: '',
      rankA: '',
      rankB: '',
      rankC: '',
      rankS: '',
      critical: false,
      activity: '',
      departments: {
        FA: '',
        HR: '',
        MKT: '',
        DD: '',
        PE: '',
        PPC: '',
        PROD: '',
        SCM: '',
        Quality: '',
      },
      deliverable: '',
      duration: '',
      startDatePlan: '',
      startDateActual: '',
      endDatePlan: '',
      endDateActual: '',
      hitMiss: '',
      revisedDate: '',
      noOfTimesRevised: '',
      reasonOfFailure: '',
      actionTaken: '',
      respUnits: [],
      respUnit: '',
      respDeptsByUnit: {},
      staffEmployees: [],
      staffEmployee: '',
      staffName: '',
      staffId: '',
      responsiblePersonDept: '',
      status: 'Not-Started',
      remarks: '',
    };

    const copy = [...rows];
    copy.splice(targetIndex, 0, newRow);
    setRows(copy);

    if (showToast) showToast('✓ New row added');

    // Auto-focus the new row's cell after render
    setTimeout(() => {
      const el = document.querySelector(`[data-row="${targetIndex}"][data-col="${focusCol}"]`);
      if (el) el.focus();
    }, 60);
  };

  /* ── Add Parent Row After Current Group ── */
  const addParentRowAfter = (rowIndex) => {
    const anchorRow = rows[rowIndex];
    const parentId = anchorRow ? getParentRowId(anchorRow) : null;
    let insertAt = rowIndex + 1;
    if (parentId) {
      while (insertAt < rows.length && getParentRowId(rows[insertAt]) === parentId) {
        insertAt += 1;
      }
    }

    const newRow = {
      id: 'row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      addedFrom: 'filters',
      rowType: 'parent',
      childrenHidden: false,
      phaseNo: anchorRow?.phaseNo || '',
      phaseName: anchorRow?.phaseName || '',
      reqNo: '',
      reqName: '',
      customerEvent: '',
      rankA: '',
      rankB: '',
      rankC: '',
      rankS: '',
      critical: false,
      activity: '',
      departments: {
        FA: '',
        HR: '',
        MKT: '',
        DD: '',
        PE: '',
        PPC: '',
        PROD: '',
        SCM: '',
        Quality: '',
      },
      deliverableRequired: 'Yes',
      deliverable: '',
      duration: '',
      startDatePlan: '',
      startDateActual: '',
      endDatePlan: '',
      endDateActual: '',
      hitMiss: '',
      revisedDate: '',
      noOfTimesRevised: '',
      reasonOfFailure: '',
      actionTaken: '',
      respUnits: [],
      respUnit: '',
      respDeptsByUnit: {},
      staffEmployees: [],
      staffEmployee: '',
      staffName: '',
      staffId: '',
      responsiblePersonDept: '',
      status: 'Not-Started',
      remarks: '',
      unit: selectedUnit || 'Both',
    };

    const nextRows = [...rows];
    nextRows.splice(insertAt, 0, newRow);
    let parentSerial = 0;
    const renumbered = nextRows.map((r) => {
      if (!isParentRow(r)) return r;
      parentSerial += 1;
      return { ...r, parentSerialNo: parentSerial };
    });
    setRows(renumbered);
    if (showToast) showToast('✓ Parent row added');
  };

  const parseDurationHours = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = parseFloat(String(val).trim());
    return Number.isFinite(num) ? num : null;
  };

  const getParentTotalDurationDisplay = (parentRow, allRows = rows) => {
    const baseHours = parseDurationHours(parentRow?.duration);
    const childRows = allRows.filter(
      (r) => isChildRow(r) && getParentRowId(r) === parentRow.id
    );
    const childHoursList = childRows
      .map((c) => parseDurationHours(c.duration))
      .filter((n) => n !== null);

    if (childHoursList.length === 0) {
      return parentRow?.duration || '—';
    }

    const total = (baseHours || 0) + childHoursList.reduce((sum, n) => sum + n, 0);
    return Number.isInteger(total) ? String(total) : String(Number(total.toFixed(2)));
  };

  const toggleRowHidden = (rowIndex) => {
    setRows((currentRows) => {
      const parentRow = currentRows[rowIndex];
      if (!parentRow || !isParentRow(parentRow)) return currentRows;
      const shouldHideChildren = !areChildrenHidden(parentRow, currentRows);
      return currentRows.map((row) => {
        if (row.id === parentRow.id) {
          return { ...row, rowType: 'parent', childrenHidden: shouldHideChildren, isHidden: false };
        }
        return getParentRowId(row) === parentRow.id
          ? { ...row, isHidden: shouldHideChildren }
          : row;
      });
    });
  };

  /* ── Delete Row ── */
  const deleteRow = (rowIndex) => {
    if (!isAdmin) {
      if (showToast) showToast('❌ Only Admin can delete rows');
      return;
    }
    if (rows.length <= 1) {
      if (showToast) showToast('⚠️ Cannot delete the only remaining row');
      return;
    }
    const deletedRowId = rows[rowIndex]?.id;
    let nextParentSerial = 0;
    const newRows = rows
      .filter((_, idx) => idx !== rowIndex)
      .map((row) => {
        if (!isParentRow(row)) return row;
        nextParentSerial += 1;
        return { ...row, parentSerialNo: nextParentSerial };
      });
    setRows(newRows);
    if (deletedRowId) {
      setRowHeights((currentHeights) => {
        if (!Object.prototype.hasOwnProperty.call(currentHeights, deletedRowId)) return currentHeights;
        const updatedHeights = { ...currentHeights };
        delete updatedHeights[deletedRowId];
        return updatedHeights;
      });
    }
    if (showToast) showToast('Row deleted');
  };

  /* ── Requirement: Keyboard Navigation & Infinite Rows
     - Enter -> move down to same col in row + 1 (if last row, create new row automatically!)
     - Shift + Enter -> newline in cell!
  */
  const handleKeyDown = (e, rowIndex, colKey) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter: allow default textarea behavior (insert newline)
        return;
      }

      // Enter alone:
      e.preventDefault();
      const nextRow = rowIndex + 1;
      const target = document.querySelector(`[data-row="${nextRow}"][data-col="${colKey}"]`);

      if (target) {
        target.focus();
      } else {
        // If at the end of the table, create a new row and focus it! Infinite rows!
        addNewRow(rows.length, colKey);
      }
    }
  };

  /* ── Column Header Filters ── */
  const BLANK_FILTER_VAL = '__BLANK__';

  const getRowFilterValues = useCallback((row, colKey) => {
    switch (colKey) {
      case 'phaseName': {
        const val = String(row.phaseName || '').trim();
        return val ? [val] : [BLANK_FILTER_VAL];
      }
      case 'rankA':
      case 'rankB':
      case 'rankC':
      case 'rankS': {
        const val = String(row[colKey] || '').trim();
        return val ? [val] : [BLANK_FILTER_VAL];
      }
      case 'critical': {
        const val = String(row.critical || '').trim().toLowerCase();
        return val === 'yes' ? ['Yes'] : ['No'];
      }
      case 'hitMiss': {
        const val = String(row.hitMiss || '').trim().toUpperCase();
        return val === 'HIT' || val === 'MISS' ? [val] : [BLANK_FILTER_VAL];
      }
      case 'respUnit': {
        const { units } = getResponsiblePersonStructure(row);
        return units.length > 0 ? units : [BLANK_FILTER_VAL];
      }
      case 'respDept': {
        const { deptsByUnit } = getResponsiblePersonStructure(row);
        const depts = new Set(Object.values(deptsByUnit).flat().filter(Boolean));
        if (row.responsiblePersonDept) {
          String(row.responsiblePersonDept).split(/[,;]/).map((d) => d.trim()).filter(Boolean).forEach((d) => depts.add(d));
        }
        return depts.size > 0 ? Array.from(depts) : [BLANK_FILTER_VAL];
      }
      case 'respStaff': {
        const names = new Set();
        (row.staffEmployees || []).forEach((e) => {
          const n = stripEmployeeId(e?.name || e?.label || '').trim();
          if (n) names.add(n);
        });
        if (names.size === 0 && row.staffEmployee) {
          String(row.staffEmployee).split(/[,;]/).map((s) => stripEmployeeId(s).trim()).filter(Boolean).forEach((n) => names.add(n));
        }
        return names.size > 0 ? Array.from(names) : [BLANK_FILTER_VAL];
      }
      case 'status': {
        return [normalizePtmStatus(row.status || 'Not-Started')];
      }
      default:
        return [];
    }
  }, []);

  const headerFilterOptionsMap = useMemo(() => {
    const rankOptions = [
      { value: 'applicable', label: 'Applicable', symbol: 'applicable' },
      { value: 'if_required', label: 'If Required', symbol: 'if_required' },
      { value: BLANK_FILTER_VAL, label: 'Blank (—)' },
    ];

    const phaseSet = new Set(PTM_PHASE_OPTIONS.map((p) => String(p.label || p.value || p).trim()).filter(Boolean));
    rows.forEach((r) => {
      const p = String(r.phaseName || '').trim();
      if (p) phaseSet.add(p);
    });

    const deptSet = new Set();
    const staffSet = new Set();
    rows.forEach((r) => {
      getRowFilterValues(r, 'respDept').forEach((d) => { if (d !== BLANK_FILTER_VAL) deptSet.add(d); });
      getRowFilterValues(r, 'respStaff').forEach((s) => { if (s !== BLANK_FILTER_VAL) staffSet.add(s); });
    });

    return {
      phaseName: [
        ...Array.from(phaseSet).map((p) => ({ value: p, label: p })),
        { value: BLANK_FILTER_VAL, label: 'Blank' },
      ],
      rankA: rankOptions,
      rankB: rankOptions,
      rankC: rankOptions,
      rankS: rankOptions,
      critical: [
        { value: 'Yes', label: 'Yes (◆)' },
        { value: 'No', label: 'No' },
      ],
      hitMiss: [
        { value: 'HIT', label: 'HIT' },
        { value: 'MISS', label: 'MISS' },
        { value: BLANK_FILTER_VAL, label: 'Blank (—)' },
      ],
      respUnit: [
        ...PDCA_UNITS.map((u) => ({ value: u, label: u })),
        { value: BLANK_FILTER_VAL, label: 'Blank' },
      ],
      respDept: [
        ...Array.from(deptSet).sort().map((d) => ({ value: d, label: d })),
        { value: BLANK_FILTER_VAL, label: 'Blank' },
      ],
      respStaff: [
        ...Array.from(staffSet).sort().map((s) => ({ value: s, label: s })),
        { value: BLANK_FILTER_VAL, label: 'Blank' },
      ],
      status: PTM_STATUS_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
    };
  }, [rows, getRowFilterValues]);

  const handleOpenHeaderFilter = (colKey, title, event) => {
    event.stopPropagation();
    if (openHeaderFilter?.colKey === colKey) {
      setOpenHeaderFilter(null);
      return;
    }
    setHeaderFilterSearch('');
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 230;
    let left = rect.left + rect.width / 2 - width / 2;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
    if (left < 12) left = 12;
    const top = Math.min(rect.bottom + 6, window.innerHeight - 320);
    setOpenHeaderFilter({ colKey, title, top, left, width });
  };

  const toggleHeaderFilterOption = (colKey, value) => {
    setColumnFilters((prev) => {
      const current = prev[colKey] || [];
      const exists = current.includes(value);
      const next = exists ? current.filter((v) => v !== value) : [...current, value];
      if (next.length === 0) {
        const { [colKey]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [colKey]: next };
    });
  };

  const clearHeaderFilter = (colKey) => {
    setColumnFilters((prev) => {
      const { [colKey]: _, ...rest } = prev;
      return rest;
    });
  };

  const renderHeaderFilterButton = (colKey, title) => {
    const activeCount = (columnFilters[colKey] || []).length;
    const isOpen = openHeaderFilter?.colKey === colKey;
    return (
      <button
        type="button"
        onClick={(e) => handleOpenHeaderFilter(colKey, title, e)}
        title={activeCount > 0 ? `Filtered (${activeCount}) — click to edit` : `Filter ${title}`}
        aria-label={`Filter ${title}`}
        className={`ptm-header-filter-trigger inline-flex items-center justify-center rounded p-0.5 transition-colors cursor-pointer shrink-0 ${activeCount > 0 || isOpen
          ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
          : 'text-slate-400 hover:text-slate-700 hover:bg-black/5'
          }`}
      >
        <Filter className="w-3 h-3" />
      </button>
    );
  };

  /* ── Filtered Rows ── */
  const hiddenParentIds = new Set(
    rows.filter(isParentRow).filter((row) => areChildrenHidden(row)).map((row) => row.id)
  );
  const filteredRows = rows.filter((r) => {
    const parentId = getParentRowId(r);
    if (isChildRow(r) && (r.isHidden || hiddenParentIds.has(parentId))) return false;
    if (selectedUnit && selectedUnit !== 'All Units' && r.unit && r.unit !== 'Both' && r.unit !== selectedUnit) return false;
    // Keep the parent's Unhide control reachable even when the hidden group's values don't match filters.
    if (isParentRow(r) && areChildrenHidden(r)) return true;
    if (phaseFilter && phaseFilter !== 'all') {
      const match = String(r.phaseName || '').startsWith(phaseFilter) || String(r.phaseNo || '') === phaseFilter;
      if (!match) return false;
    }
    for (const [colKey, selectedVals] of Object.entries(columnFilters)) {
      if (!Array.isArray(selectedVals) || selectedVals.length === 0) continue;
      const rowVals = getRowFilterValues(r, colKey);
      if (!rowVals.some((v) => selectedVals.includes(v))) return false;
    }
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        r.activity?.toLowerCase().includes(q) ||
        r.reqName?.toLowerCase().includes(q) ||
        r.reqNo?.toLowerCase().includes(q) ||
        r.customerEvent?.toLowerCase().includes(q) ||
        r.phaseName?.toLowerCase().includes(q) ||
        r.remarks?.toLowerCase().includes(q) ||
        r.deliverable?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
  const requirementOptions = Array.isArray(savedColumnSuggestions?.reqName)
    ? [...new Set(savedColumnSuggestions.reqName.map((v) => String(v || '').trim()).filter(Boolean))]
    : [];
  return (
    <div className={`ptm-data-table min-w-max w-full bg-white select-none ${isMerged ? '' : 'rounded-xl border border-[#64748B] shadow-sm overflow-hidden'}`}>
      <div className={isMerged ? 'w-full' : 'overflow-x-auto max-h-[calc(100vh-140px)]'} ref={tableRef} onInput={handleTableInput}>
        <ManualInputOptionsContext.Provider value={manualOptionsByColumn}>
          <table className="w-full border-collapse border-b border-[#64748B] text-xs">
            <colgroup>
              <col
                style={{
                  width: `${actionsCollapsed ? COLLAPSED_ACTION_COLUMN_WIDTH : colWidths.actions}px`,
                  minWidth: `${actionsCollapsed ? COLLAPSED_ACTION_COLUMN_WIDTH : MIN_ACTION_COLUMN_WIDTH}px`,
                }}
              />
              <col span={34} />
            </colgroup>
            {/* ══════════════════════════════════════════════════════════════════
              HEADER ROW: INDIVIDUAL COLUMN TITLES WITH MATCHING TINTS
              ══════════════════════════════════════════════════════════════════ */}
            <thead className="sticky top-0 z-20 shadow-xs border-t border-b border-[#64748B]">
              {/* ══════════════════════════════════════════════════════════════════
                COLUMN TITLES
                ══════════════════════════════════════════════════════════════════ */}
              <tr className="divide-x divide-[#64748B] text-xs sm:text-[12.5px] font-bold text-center border-b border-slate-300">
                {/* Actions Column: At the start of the sheet with collapse toggle */}
                <th
                  rowSpan={2}
                  className="relative overflow-visible py-2 px-1.5 bg-[#F4F6F9] text-slate-600 font-extrabold uppercase text-xs sm:text-[11px] tracking-wider text-center align-middle"
                  style={{
                    width: `${actionsCollapsed ? COLLAPSED_ACTION_COLUMN_WIDTH : colWidths.actions}px`,
                    minWidth: `${actionsCollapsed ? COLLAPSED_ACTION_COLUMN_WIDTH : MIN_ACTION_COLUMN_WIDTH}px`,
                  }}
                >
                  {actionsCollapsed ? (
                    <button
                      type="button"
                      onClick={() => setActionsCollapsed(false)}
                      title="Expand Actions column"
                      aria-label="Expand Actions column"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-slate-300 shadow-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <>
                      <div className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200/90 shadow-xs text-slate-600">
                        <span>Actions</span>
                        <button
                          type="button"
                          onClick={() => setActionsCollapsed(true)}
                          title="Collapse Actions column"
                          aria-label="Collapse Actions column"
                          className="p-0.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span
                        role="separator"
                        aria-label="Resize Actions column"
                        title="Drag horizontally to resize the Actions column"
                        onPointerDown={(event) => startColResize(event, 'actions')}
                        onPointerMove={continueResize}
                        onPointerUp={finishResize}
                        onPointerCancel={finishResize}
                        className="group absolute inset-y-0 right-0 z-20 flex w-2 cursor-col-resize touch-none items-center justify-center focus:outline-none"
                      >
                        <span className="h-4 w-0.5 rounded-full bg-slate-400 group-hover:bg-blue-500" />
                      </span>
                    </>
                  )}
                </th>

                {/* Group 1 Columns (Ice Blue tint) */}
                <th rowSpan={2} className="py-2 px-1 w-10 min-w-[36px] max-w-[42px] bg-[#EEF4FA] text-[#2C5282] whitespace-normal leading-tight text-center">
                  S.No
                </th>
                <th
                  rowSpan={2}
                  className="relative py-2 px-2 bg-[#EEF4FA] text-[#2C5282] text-left whitespace-normal leading-tight"
                  style={{
                    width: `${isPhaseCollapsed ? 38 : colWidths.phaseName}px`,
                    minWidth: `${isPhaseCollapsed ? 38 : colWidths.phaseName}px`,
                  }}
                >
                  {isPhaseCollapsed ? (
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setPhaseCollapsed(false)}
                        title="Expand Phase No. / Name column"
                        aria-label="Expand Phase No. / Name column"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white border border-slate-300 shadow-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-1 pr-2">
                        <span>Phase No. / Name</span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {isHeaderPhaseNotApplicable && (
                            <button
                              type="button"
                              onClick={() => setPhaseCollapsed(true)}
                              title="Collapse Phase No. / Name column"
                              aria-label="Collapse Phase No. / Name column"
                              className="p-0.5 rounded text-slate-500 hover:text-blue-600 hover:bg-white/80 cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {renderHeaderFilterButton('phaseName', 'Phase No. / Name')}
                        </div>
                      </div>

                      <span
                        role="separator"
                        aria-label="Resize Phase Name column"
                        title="Drag to resize Phase Name column"
                        onPointerDown={(event) => startColResize(event, 'phaseName')}
                        onPointerMove={continueResize}
                        onPointerUp={finishResize}
                        onPointerCancel={finishResize}
                        className="group absolute inset-y-0 right-0 z-20 flex w-2 cursor-col-resize touch-none items-center justify-center focus:outline-none"
                      >
                        <span className="h-4 w-0.5 rounded-full bg-slate-300 group-hover:bg-blue-500" />
                      </span>
                    </>
                  )}
                </th>
                <th rowSpan={2} className="py-2 px-2 min-w-[190px] w-48 bg-[#EEF4FA] text-[#2C5282] text-left whitespace-normal leading-tight">
                  AIAG APQP Requirements
                </th>
                <th
                  rowSpan={2}
                  className="relative py-2 px-2 bg-[#EEF4FA] text-[#2C5282] text-left whitespace-normal leading-tight"
                  style={{
                    width: `${colWidths.customerEvent}px`,
                    minWidth: `${colWidths.customerEvent}px`,
                  }}
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Custom Event Name</span>
                  </div>

                  <span
                    role="separator"
                    aria-label="Resize Custom Event Name column"
                    title="Drag to resize Custom Event Name column"
                    onPointerDown={(event) => startColResize(event, 'customerEvent')}
                    onPointerMove={continueResize}
                    onPointerUp={finishResize}
                    onPointerCancel={finishResize}
                    className="group absolute inset-y-0 right-0 z-20 flex w-2 cursor-col-resize touch-none items-center justify-center focus:outline-none"
                  >
                    <span className="h-4 w-0.5 rounded-full bg-slate-300 group-hover:bg-blue-500" />
                  </span>
                </th>

                {/* Group 2 Columns (Pale Yellow tint) - compact */}
                {isRanksCollapsed ? (
                  <th rowSpan={2} className="py-2 px-1 w-9 min-w-[34px] max-w-[38px] bg-[#FFF9E6] text-[#975A16] text-center align-middle">
                    <button
                      type="button"
                      onClick={() => setRanksCollapsed(false)}
                      title="Expand Rank columns"
                      aria-label="Expand Rank columns"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white border border-amber-300 shadow-xs text-[#975A16] hover:bg-amber-50 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </th>
                ) : (
                  <>
                <th rowSpan={2} className={`py-2 px-1 w-9 min-w-[34px] max-w-[38px] bg-[#FFF9E6] text-[#975A16] whitespace-normal leading-tight text-center transition-all ${!isRankColumnActive('rankA') ? 'opacity-75 blur-[0.4px] bg-slate-100/50 pointer-events-none select-none' : ''}`}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span>Rank A</span>
                    {renderHeaderFilterButton('rankA', 'Rank A')}
                  </div>
                </th>
                <th rowSpan={2} className={`py-2 px-1 w-9 min-w-[34px] max-w-[38px] bg-[#FFF9E6] text-[#975A16] whitespace-normal leading-tight text-center transition-all ${!isRankColumnActive('rankB') ? 'opacity-75 blur-[0.4px] bg-slate-100/50 pointer-events-none select-none' : ''}`}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span>Rank B</span>
                    {renderHeaderFilterButton('rankB', 'Rank B')}
                  </div>
                </th>
                <th rowSpan={2} className={`py-2 px-1 w-11 min-w-[42px] max-w-[48px] bg-[#FFF9E6] text-[#975A16] whitespace-normal leading-tight text-center transition-all ${!isRankColumnActive('rankC') ? 'opacity-75 blur-[0.4px] bg-slate-100/50 pointer-events-none select-none' : ''}`}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span>Rank C1 & C2</span>
                    {renderHeaderFilterButton('rankC', 'Rank C1 & C2')}
                  </div>
                </th>
                <th rowSpan={2} className={`relative py-2 px-1 w-9 min-w-[34px] max-w-[38px] bg-[#FFF9E6] text-[#975A16] whitespace-normal leading-tight text-center transition-all ${!isRankColumnActive('rankS') ? 'opacity-75 blur-[0.4px] bg-slate-100/50 select-none' : ''}`}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span>Rank S</span>
                    <div className="flex items-center justify-center gap-0.5">
                      {renderHeaderFilterButton('rankS', 'Rank S')}
                      {isHeaderRankNotApplicable && (
                        <button
                          type="button"
                          onClick={() => setRanksCollapsed(true)}
                          title="Collapse Rank columns"
                          aria-label="Collapse Rank columns"
                          className="p-0.5 rounded bg-white/90 border border-amber-300 text-[#975A16] hover:bg-amber-100 cursor-pointer pointer-events-auto"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </th>
                  </>
                )}

                {/* Group 3 Columns (Slate tint) */}
                <th rowSpan={2} className="py-2 px-1 w-14 min-w-[50px] max-w-[56px] bg-[#F8F9FA] text-[#4A5568] whitespace-normal leading-tight text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>Critical Activity</span>
                    {renderHeaderFilterButton('critical', 'Critical Activity')}
                  </div>
                </th>
                <th
                  rowSpan={2}
                  className="relative py-2 px-2.5 bg-[#F8F9FA] text-[#4A5568] text-left whitespace-normal leading-tight"
                  style={{
                    width: `${colWidths.activity}px`,
                    minWidth: `${colWidths.activity}px`,
                  }}
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Activity (New)</span>
                  </div>

                  <span
                    role="separator"
                    aria-label="Resize Activity (New) column"
                    title="Drag to resize Activity (New) column"
                    onPointerDown={(event) => startColResize(event, 'activity')}
                    onPointerMove={continueResize}
                    onPointerUp={finishResize}
                    onPointerCancel={finishResize}
                    className="group absolute inset-y-0 right-0 z-20 flex w-2 cursor-col-resize touch-none items-center justify-center focus:outline-none"
                  >
                    <span className="h-4 w-0.5 rounded-full bg-slate-300 group-hover:bg-blue-500" />
                  </span>
                </th>

                {/* Group 4 Columns: Depts (Mint Green tint) - auto-adjusting width */}
                {DEPARTMENTS.map((dept) => (
                  <th
                    key={dept.key}
                    rowSpan={2}
                    className={`py-2 px-1.5 w-auto ${dept.key === 'Quality' ? 'min-w-[54px]' : 'min-w-[42px]'} bg-[#EAF5EC] text-[#276749] text-center whitespace-nowrap text-xs sm:text-[12px]`}
                  >
                    {dept.label}
                  </th>
                ))}

                {/* Group 5 Columns (Lavender tint) */}
                <th
                  rowSpan={2}
                  className="relative py-2 px-2 bg-[#F1F5F9] text-[#2D3748] text-left whitespace-normal leading-tight"
                  style={{
                    width: `${colWidths.deliverable}px`,
                    minWidth: `${colWidths.deliverable}px`,
                  }}
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Deliverable Required Yes / No (if yes than put Format no.)</span>
                  </div>

                  <span
                    role="separator"
                    aria-label="Resize Deliverable column"
                    title="Drag to resize Deliverable column"
                    onPointerDown={(event) => startColResize(event, 'deliverable')}
                    onPointerMove={continueResize}
                    onPointerUp={finishResize}
                    onPointerCancel={finishResize}
                    className="group absolute inset-y-0 right-0 z-20 flex w-2 cursor-col-resize touch-none items-center justify-center focus:outline-none"
                  >
                    <span className="h-4 w-0.5 rounded-full bg-slate-300 group-hover:bg-blue-500" />
                  </span>
                </th>
                {!templateMode && (
                  <>
                <th rowSpan={2} className="py-2 px-1.5 w-20 min-w-[76px] bg-[#F1F5F9] text-[#2D3748] whitespace-normal leading-tight text-center">
                  Std. Duration in Hours
                </th>

                {/* Group 6 Columns (Ice Blue tint) */}
                <th rowSpan={2} className="py-2 px-1.5 w-auto min-w-[116px] bg-[#EFF3FA] text-[#2B6CB0] whitespace-normal leading-tight text-center text-xs sm:text-[12px]">
                  Start Date (Plan)
                </th>
                <th rowSpan={2} className="py-2 px-1.5 w-auto min-w-[116px] bg-[#EFF3FA] text-[#2B6CB0] whitespace-normal leading-tight text-center text-xs sm:text-[12px]">
                  Start Date (Actual)
                </th>
                <th rowSpan={2} className="py-2 px-1.5 w-auto min-w-[116px] bg-[#EFF3FA] text-[#2B6CB0] whitespace-normal leading-tight text-center text-xs sm:text-[12px]">
                  End Date (Plan) <span className="text-red-500 font-bold">*</span>
                </th>
                <th rowSpan={2} className="py-2 px-1.5 w-auto min-w-[116px] bg-[#EFF3FA] text-[#2B6CB0] whitespace-normal leading-tight text-center text-xs sm:text-[12px]">
                  End Date (Actual)
                </th>

                {/* Group 7 Columns (Mint Green tint) */}
                <th rowSpan={2} className="py-2 px-1.5 w-auto min-w-[78px] bg-[#EAF5EC] text-[#276749] whitespace-nowrap leading-tight text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>HIT/MISS</span>
                    {renderHeaderFilterButton('hitMiss', 'HIT/MISS')}
                  </div>
                </th>

                {/* Group 8 Columns (Pastel Rose tint) */}
                <th rowSpan={2} className="py-2 px-1.5 w-auto min-w-[148px] bg-[#FDF2F2] text-[#9B1C1C] whitespace-normal leading-tight text-center">
                  No. of Times Revised
                </th>
                <th rowSpan={2} className="py-2 px-2 w-auto min-w-[180px] bg-[#FDF2F2] text-[#9B1C1C] text-left whitespace-normal leading-tight">
                  Reason of Failure
                </th>
                <th
                  rowSpan={2}
                  className="relative py-2 px-2 bg-[#FDF2F2] text-[#9B1C1C] text-left whitespace-normal leading-tight"
                  style={{
                    width: `${colWidths.actionTaken}px`,
                    minWidth: `${colWidths.actionTaken}px`,
                  }}
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Action Taken Against Failure</span>
                  </div>

                  <span
                    role="separator"
                    aria-label="Resize Action Taken Against Failure column"
                    title="Drag to resize Action Taken Against Failure column"
                    onPointerDown={(event) => startColResize(event, 'actionTaken')}
                    onPointerMove={continueResize}
                    onPointerUp={finishResize}
                    onPointerCancel={finishResize}
                    className="group absolute inset-y-0 right-0 z-20 flex w-2 cursor-col-resize touch-none items-center justify-center focus:outline-none"
                  >
                    <span className="h-4 w-0.5 rounded-full bg-slate-300 group-hover:bg-blue-500" />
                  </span>
                </th>

                {/* Responsible Person Section Header */}
                <th
                  colSpan={3}
                  className="py-1 px-1 border-r border-b border-[#64748B] bg-[#ECEFF1] text-center select-none text-slate-800 font-bold text-xs sm:text-[13px] leading-tight"
                >
                  Responsible Person
                </th>

                {/* Group 9 Columns (Slate tint) */}
                <th
                  rowSpan={2}
                  className="py-2 px-1.5 w-auto bg-[#F8F9FA] text-[#4A5568] whitespace-nowrap leading-tight text-center"
                  style={{
                    minWidth: `${STATUS_COLUMN_MIN_WIDTH}px`,
                  }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    {renderHeaderFilterButton('status', 'Status')}
                  </div>
                </th>
                <th
                  rowSpan={2}
                  className="relative py-2 px-2 bg-[#F8F9FA] text-[#4A5568] text-left whitespace-normal leading-tight"
                  style={{
                    width: `${colWidths.remarks}px`,
                    minWidth: `${colWidths.remarks}px`,
                  }}
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Remarks</span>
                  </div>

                  <span
                    role="separator"
                    aria-label="Resize Remarks column"
                    title="Drag to resize Remarks column"
                    onPointerDown={(event) => startColResize(event, 'remarks')}
                    onPointerMove={continueResize}
                    onPointerUp={finishResize}
                    onPointerCancel={finishResize}
                    className="group absolute inset-y-0 right-0 z-20 flex w-2 cursor-col-resize touch-none items-center justify-center focus:outline-none"
                  >
                    <span className="h-4 w-0.5 rounded-full bg-slate-300 group-hover:bg-blue-500" />
                  </span>
                </th>
                  </>
                )}
              </tr>

              {/* Row 2: Sub-columns for Responsible Person */}
              {!templateMode && (
              <tr className="divide-x divide-[#64748B] text-xs sm:text-[12.5px] font-bold text-center border-b-2 border-slate-400 bg-[#ECEFF1] text-slate-800">
                <th className="py-1 px-1 text-center w-[110px] min-w-[100px] border-l border-[#64748B]">
                  <div className="flex items-center justify-center gap-1">
                    <span>Unit</span>
                    {renderHeaderFilterButton('respUnit', 'Responsible Unit')}
                  </div>
                </th>
                <th className="py-1 px-1 text-center w-[145px] min-w-[135px]">
                  <div className="flex items-center justify-center gap-1">
                    <span>Dept</span>
                    {renderHeaderFilterButton('respDept', 'Responsible Dept')}
                  </div>
                </th>
                <th className="py-1 px-1 text-center w-[160px] min-w-[150px]">
                  <div className="flex items-center justify-center gap-1">
                    <span>Staff Name</span> <span className="text-red-500 font-bold">*</span>
                    {renderHeaderFilterButton('respStaff', 'Staff Name')}
                  </div>
                </th>
              </tr>
              )}
            </thead>

            {/* ══════════════════════════════════════════════════════════════════
              TABLE BODY: EVERY CELL HAS DROPDOWN / MANUAL INPUT AS SHOWN IN IMAGE
              ══════════════════════════════════════════════════════════════════ */}
            <tbody className="divide-y divide-[#64748B] border-b border-[#64748B] bg-white">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={(templateMode ? 11 : 26) + DEPARTMENTS.length - (isRanksCollapsed ? 3 : 0)}
                    className="py-12 text-center text-slate-400 font-medium"
                  >
                    No matching rows found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const originalIndex = rows.findIndex((r) => r.id === row.id);
                  const childrenHidden = areChildrenHidden(row);
                  const previousRow = filteredRows[idx - 1];
                  const nextRow = filteredRows[idx + 1];
                  const sameParentChild = (candidate) =>
                    Boolean(candidate) && isChildRow(row) && isChildRow(candidate) && getParentRowId(row) === getParentRowId(candidate);
                  const hideChildTopLine = sameParentChild(previousRow);
                  const hideChildBottomLine = sameParentChild(nextRow);

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        onContextMenu={(e) => {
                          if (!hasFullSheetAccess || !onRequestAddPhaseAtRow) return;
                          e.preventDefault();
                          onRequestAddPhaseAtRow(originalIndex);
                        }}
                        className={`divide-x divide-[#64748B] hover:bg-[#F8FAFC] transition-colors group ${isChildRow(row) ? 'bg-slate-50/60' : ''}`}
                        style={Math.max(rowHeights[row.id] || 0, row.manualRowHeight || 0) > 0
                          ? { height: `${Math.max(rowHeights[row.id] || 0, row.manualRowHeight || 0)}px` }
                          : undefined}
                      >
                        {/* Actions Column at start of row */}
                        <td
                          className={`relative overflow-visible py-1.5 px-1 text-center bg-[#F4F6F9] z-10 ${!canEditCell(row, 'actions') ? 'pointer-events-none opacity-50' : ''}`}
                          style={{
                            width: `${actionsCollapsed ? COLLAPSED_ACTION_COLUMN_WIDTH : colWidths.actions}px`,
                            minWidth: `${actionsCollapsed ? COLLAPSED_ACTION_COLUMN_WIDTH : MIN_ACTION_COLUMN_WIDTH}px`,
                          }}
                        >
                          {actionsCollapsed ? (
                            <span className="text-slate-300 text-xs select-none">•</span>
                          ) : (
                            <div className="inline-flex items-center justify-center gap-0.5 p-1 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                              <button
                                type="button"
                                onClick={() => addParentRowAfter(originalIndex)}
                                title="Add Row (Parent row)"
                                aria-label="Add Parent Row"
                                className="flex h-6 px-1.5 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-blue-700 bg-blue-50/70 hover:bg-blue-100 transition-colors cursor-pointer"
                              >
                                +R
                              </button>
                              <button
                                type="button"
                                onClick={() => addNewRow(originalIndex + 1, 'activity')}
                                title="Add Sub Row (Child row)"
                                aria-label="Add Sub Row"
                                className="flex h-6 px-1.5 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100 transition-colors cursor-pointer"
                              >
                                +S
                              </button>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => deleteRow(originalIndex)}
                                  title="Delete this row"
                                  aria-label="Delete row"
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
                                </button>
                              )}
                              {isParentRow(row) && (
                                <button
                                  type="button"
                                  onClick={() => toggleRowHidden(originalIndex)}
                                  title={`${childrenHidden ? 'Unhide' : 'Hide'} child rows for this parent`}
                                  aria-label={`${childrenHidden ? 'Unhide' : 'Hide'} child rows`}
                                  className="inline-flex h-6 shrink-0 items-center justify-center gap-0.5 whitespace-nowrap rounded px-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                                >
                                  {childrenHidden
                                    ? <Eye className="h-3.5 w-3.5" />
                                    : <EyeOff className="h-3.5 w-3.5" />}
                                </button>
                              )}
                            </div>
                          )}
                          <span
                            role="separator"
                            aria-label={`Resize row ${idx + 1}`}
                            aria-orientation="horizontal"
                            aria-valuemin={MIN_ROW_HEIGHT}
                            aria-valuenow={rowHeights[row.id] ?? DEFAULT_ROW_HEIGHT}
                            tabIndex={0}
                            title="Drag vertically to resize the entire row"
                            onPointerDown={(event) => startRowResize(event, row.id)}
                            onPointerMove={continueResize}
                            onPointerUp={finishResize}
                            onPointerCancel={finishResize}
                            onLostPointerCapture={finishResize}
                            onKeyDown={(event) => handleResizeKeyDown(event, 'row', row.id)}
                            className="group absolute bottom-0 right-0 z-20 flex h-3 w-5 cursor-row-resize touch-none items-center justify-center focus:outline-none"
                          >
                            <span className="h-0.5 w-3 rounded-full bg-slate-300 transition-colors group-hover:bg-blue-500" />
                          </span>
                        </td>

                        {isChildRow(row) ? (
                          <td
                            colSpan={2}
                            className="bg-slate-50/60"
                            style={{
                              borderTopStyle: hideChildTopLine ? 'hidden' : undefined,
                              borderBottomStyle: hideChildBottomLine ? 'hidden' : undefined,
                            }}
                            aria-label="Child row; parent and phase fields are shown above"
                          />
                        ) : (
                          <>
                            {/* S.No */}
                            <td className="py-2 px-1 text-center font-semibold text-slate-600 text-sm bg-slate-50/40">
                              {getRowSerial(row, originalIndex)}
                            </td>

                            {/* Phase No. / Name — DROPDOWN (1-5 & Other Manual Input) */}
                            <td
                              className={`p-0 relative ${!canEditCell(row, 'phaseName') ? 'pointer-events-none opacity-75' : ''}`}
                              style={{
                                width: `${isPhaseCollapsed ? 38 : colWidths.phaseName}px`,
                                minWidth: `${isPhaseCollapsed ? 38 : colWidths.phaseName}px`,
                              }}
                            >
                              {isPhaseCollapsed ? (
                                <div className="py-2 px-1 text-center text-slate-300 text-xs select-none">•</div>
                              ) : (() => {
                                const PRESET_PHASES = [
                                  '1: Plan & Define',
                                  '2: Product & Process Design',
                                  '3: Product & Process Development',
                                  '4: Product & Process Validation',
                                  '5: Feedback & Corrective Action'
                                ];
                                const curVal = row.phaseName || '';
                                const isPreset = PRESET_PHASES.includes(curVal) || curVal === '5: Feedback % Corrective Action';
                                const isCustomMode = row._customPhase || (!isPreset && Boolean(curVal));

                                if (isCustomMode) {
                                  return (
                                    <div className="flex items-center gap-1 w-full h-full px-1">
                                      <ManualInputBox
                                        value={curVal}
                                        noDropdown={true}
                                        onChange={(event) => handleCellChange(originalIndex, 'phaseName', event.target.value)}
                                        onKeyDown={(event) => handleKeyDown(event, originalIndex, 'phaseName')}
                                        data-row={originalIndex}
                                        data-col="phaseName"
                                        placeholder="Enter custom phase..."
                                        className="w-full py-1.5 px-2 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleCellChange(originalIndex, '_customPhase', false);
                                          handleCellChange(originalIndex, 'phaseName', PRESET_PHASES[0]);
                                        }}
                                        className="shrink-0 p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                        title="Switch back to predefined phase dropdown"
                                      >
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="relative flex items-center justify-between w-full h-full px-1">
                                    <select
                                      value={isPreset ? curVal : (curVal ? 'Other' : '')}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'Other') {
                                          handleCellChange(originalIndex, '_customPhase', true);
                                          handleCellChange(originalIndex, 'phaseName', '');
                                        } else {
                                          handleCellChange(originalIndex, '_customPhase', false);
                                          handleCellChange(originalIndex, 'phaseName', val);
                                        }
                                      }}
                                      className="appearance-none w-full bg-transparent text-left font-semibold text-slate-800 pr-6 pl-1 py-2 text-xs sm:text-sm outline-none cursor-pointer hover:bg-blue-50/50 transition-colors"
                                    >
                                      <option value="">Select Phase...</option>
                                      {PRESET_PHASES.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                      ))}
                                      <option value="Other">Other ..... (Manual input)</option>
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
                                  </div>
                                );
                              })()}
                            </td>
                          </>
                        )}

                        {/* 3. AIAG APQP Requirements — Searchable dropdown with suggestion history */}
                        <td className={`relative h-full min-w-[190px] w-48 p-0 align-top ${!canEditCell(row, 'reqName') ? 'pointer-events-none opacity-75' : ''}`}>
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 left-10 z-[1] border-l border-[#64748B]"
                          />
                          <div className="flex h-full min-h-full min-w-0 items-stretch">
                            <div className="h-full w-10 shrink-0">
                              {isChildRow(row) ? (
                                <ManualInputBox
                                  value={getRowSerial(row, originalIndex)}
                                  onKeyDown={(e) => handleKeyDown(e, originalIndex, 'reqNo')}
                                  data-row={originalIndex}
                                  data-col="reqNo"
                                  readOnly
                                  noDropdown={true}
                                  aria-label={`Child row number ${getRowSerial(row, originalIndex)}`}
                                  className="w-full text-center py-2 px-1 text-slate-700 font-mono bg-transparent outline-none focus:bg-slate-50 text-sm cursor-default"
                                />
                              ) : (
                                <ManualInputBox
                                  value={row.reqNo || ''}
                                  noDropdown={true}
                                  onChange={(e) => handleCellChange(originalIndex, 'reqNo', e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, originalIndex, 'reqNo')}
                                  data-row={originalIndex}
                                  data-col="reqNo"
                                  placeholder="No."
                                  className="w-full text-center py-2 px-1 text-slate-700 font-mono bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm"
                                />
                              )}
                            </div>
                            <div className="h-full min-w-0 flex-1">
                              <SearchableApqpDropdown
                                value={row.reqName || ''}
                                suggestions={requirementOptions}
                                onAddNewSuggestion={(newReq) => {
                                  apqpApi.addSuggestion(newReq).catch(console.warn);
                                }}
                                onChange={(event) => handleCellChange(originalIndex, 'reqName', event.target.value)}
                                onKeyDown={(event) => handleKeyDown(event, originalIndex, 'reqName')}
                                dataRow={originalIndex}
                                dataCol="reqName"
                              />
                            </div>
                          </div>
                        </td>

                        {/* 4. Custom Event Name — Per-sheet suggestion dropdown & resizable width */}
                        <td
                          className={`p-0 ${!canEditCell(row, 'customerEvent') ? 'pointer-events-none opacity-75' : ''}`}
                          style={{
                            width: `${colWidths.customerEvent}px`,
                            minWidth: `${colWidths.customerEvent}px`,
                          }}
                        >
                          <ManualInputBox
                            value={row.customerEvent || ''}
                            noDropdown={false}
                            onChange={(e) => handleCellChange(originalIndex, 'customerEvent', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, originalIndex, 'customerEvent')}
                            data-row={originalIndex}
                            data-col="customerEvent"
                            placeholder="Event name..."
                            className="w-full py-2 px-2 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm"
                          />
                        </td>

                        {/* 5. Rank A..S — Interactive checkboxes or collapsed */}
                        {isRanksCollapsed ? (
                          <td className="py-1 px-1 text-center bg-slate-50/40 text-slate-300 text-xs select-none">
                            •
                          </td>
                        ) : (
                          <>
                        {/* 5. Rank A — Interactive checkbox */}
                        <td
                          onClick={() => cycleRank(originalIndex, 'rankA')}
                          className={`py-1 px-1 text-center transition-all select-none ${
                            !isRankColumnActive('rankA')
                              ? 'opacity-75 blur-[0.4px] bg-slate-100/50 pointer-events-none'
                              : !canEditCell(row, 'rankA')
                                ? 'pointer-events-none opacity-75'
                                : 'cursor-pointer hover:bg-amber-50/50'
                          }`}
                          title="Click: ■ Applicable / □ If Required / Clear"
                        >
                          <div className="flex items-center justify-center">
                            {row.rankA === 'applicable' && (
                              <div className="w-5 h-5 bg-black rounded-xs flex items-center justify-center"></div>
                            )}
                            {row.rankA === 'if_required' && (
                              <div className="w-5 h-5 border-[2.5px] border-black bg-white rounded-xs flex items-center justify-center"></div>
                            )}
                            {!row.rankA && <span className="text-slate-300 text-sm">—</span>}
                          </div>
                        </td>

                        {/* 6. Rank B — Interactive checkbox */}
                        <td
                          onClick={() => cycleRank(originalIndex, 'rankB')}
                          className={`py-1 px-1 text-center transition-all select-none ${
                            !isRankColumnActive('rankB')
                              ? 'opacity-75 blur-[0.4px] bg-slate-100/50 pointer-events-none'
                              : !canEditCell(row, 'rankB')
                                ? 'pointer-events-none opacity-75'
                                : 'cursor-pointer hover:bg-amber-50/50'
                          }`}
                          title="Click: ■ Applicable / □ If Required / Clear"
                        >
                          <div className="flex items-center justify-center">
                            {row.rankB === 'applicable' && (
                              <div className="w-5 h-5 bg-black rounded-xs flex items-center justify-center"></div>
                            )}
                            {row.rankB === 'if_required' && (
                              <div className="w-5 h-5 border-[2.5px] border-black bg-white rounded-xs flex items-center justify-center"></div>
                            )}
                            {!row.rankB && <span className="text-slate-300 text-sm">—</span>}
                          </div>
                        </td>

                        {/* 7. Rank C1 & C2 — Interactive checkbox */}
                        <td
                          onClick={() => cycleRank(originalIndex, 'rankC')}
                          className={`py-1 px-1 text-center transition-all select-none ${
                            !isRankColumnActive('rankC')
                              ? 'opacity-75 blur-[0.4px] bg-slate-100/50 pointer-events-none'
                              : !canEditCell(row, 'rankC')
                                ? 'pointer-events-none opacity-75'
                                : 'cursor-pointer hover:bg-amber-50/50'
                          }`}
                          title="Click: ■ Applicable / □ If Required / Clear"
                        >
                          <div className="flex items-center justify-center">
                            {row.rankC === 'applicable' && (
                              <div className="w-5 h-5 bg-black rounded-xs flex items-center justify-center"></div>
                            )}
                            {row.rankC === 'if_required' && (
                              <div className="w-5 h-5 border-[2.5px] border-black bg-white rounded-xs flex items-center justify-center"></div>
                            )}
                            {!row.rankC && <span className="text-slate-300 text-sm">—</span>}
                          </div>
                        </td>

                        {/* 7b. Rank S — Interactive checkbox */}
                        <td
                          onClick={() => cycleRank(originalIndex, 'rankS')}
                          className={`py-1 px-1 text-center transition-all select-none ${
                            !isRankColumnActive('rankS')
                              ? 'opacity-75 blur-[0.4px] bg-slate-100/50 pointer-events-none'
                              : !canEditCell(row, 'rankS')
                                ? 'pointer-events-none opacity-75'
                                : 'cursor-pointer hover:bg-amber-50/50'
                          }`}
                          title="Click: ■ Applicable / □ If Required / Clear"
                        >
                          <div className="flex items-center justify-center">
                            {row.rankS === 'applicable' && (
                              <div className="w-5 h-5 bg-black rounded-xs flex items-center justify-center"></div>
                            )}
                            {row.rankS === 'if_required' && (
                              <div className="w-5 h-5 border-[2.5px] border-black bg-white rounded-xs flex items-center justify-center"></div>
                            )}
                            {!row.rankS && <span className="text-slate-300 text-sm">—</span>}
                          </div>
                        </td>
                          </>
                        )}

                        {/* 8. Critical Activity — Yes/No dropdown with automatic symbol */}
                        <td className={`p-1 text-center ${!canEditCell(row, 'critical') ? 'pointer-events-none opacity-75' : ''}`}>
                          <CriticalActivityCell
                            value={row.critical}
                            onChange={(value) => handleCellChange(originalIndex, 'critical', value)}
                          />
                        </td>

                        {/* 9. Activity (New) — Per-sheet suggestion dropdown & resizable width */}
                        <td
                          className={`p-0 ${!canEditCell(row, 'activity') ? 'pointer-events-none opacity-75' : ''}`}
                          style={{
                            width: `${colWidths.activity}px`,
                            minWidth: `${colWidths.activity}px`,
                          }}
                        >
                          <ManualInputBox
                            value={row.activity || ''}
                            noDropdown={false}
                            onChange={(e) => handleCellChange(originalIndex, 'activity', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, originalIndex, 'activity')}
                            data-row={originalIndex}
                            data-col="activity"
                            placeholder="Type activity description..."
                            className="w-full py-2 px-2.5 text-slate-900 text-sm font-normal leading-relaxed bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        {/* 10–18. Departments: F&A, HR, MKT, D&D, PE, PPC, PROD, SCM, Quality */}
                        {DEPARTMENTS.map((dept) => {
                          const val = row.departments?.[dept.key];
                          const isHighlighted = row.highlight && row.highlight[dept.key];
                          return (
                            <td
                              key={dept.key}
                              onClick={() => cycleDept(originalIndex, dept.key)}
                              className={`py-1.5 px-1.5 w-auto ${dept.key === 'Quality' ? 'min-w-[54px]' : 'min-w-[42px]'} text-center whitespace-nowrap cursor-pointer select-none transition-colors ${!canEditCell(row, 'departments') ? 'pointer-events-none opacity-75' : ''} ${isHighlighted
                                ? 'bg-[#FFFF00] hover:bg-[#FACC15]'
                                : 'hover:bg-emerald-50/50'
                                }`}
                              title={`${dept.label}: Click to toggle ● Owner / ○ Support / Clear`}
                            >
                              <span className="text-[26px] font-bold text-slate-900 leading-none inline-flex items-center justify-center">
                                {val === 'owner' && <span className="w-4 h-4 rounded-full bg-slate-950 inline-block shadow-xs"></span>}
                                {val === 'support' && <span className="w-4 h-4 rounded-full border-[2px] border-slate-950 bg-transparent inline-block"></span>}
                                {!val && <span className="text-transparent">·</span>}
                              </span>
                            </td>
                          );
                        })}

                        {/* 19. Deliverable Required — Yes/No selector & Manual Format No. Input & Upload File Section with 3-Option Popup */}
                        <td
                          className={`p-0 ${!canEditCell(row, 'deliverableRequired') ? 'pointer-events-none opacity-75' : ''}`}
                          style={{
                            width: `${colWidths.deliverable}px`,
                            minWidth: `${colWidths.deliverable}px`,
                          }}
                        >
                          <div className="flex min-w-0 items-center justify-between gap-1.5 px-2 py-1">
                            <select
                              value={row.deliverableRequired || 'Yes'}
                              onChange={(e) => handleCellChange(originalIndex, 'deliverableRequired', e.target.value)}
                              aria-label="Deliverable required"
                              className="w-[54px] shrink-0 rounded border border-[#64748B] bg-white px-1 py-1 text-center text-xs sm:text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>

                            {(row.deliverableRequired || 'Yes') === 'Yes' ? (
                              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                <input
                                  type="text"
                                  autoComplete="off"
                                  autoCorrect="off"
                                  autoCapitalize="off"
                                  spellCheck="false"
                                  value={row.deliverable || ''}
                                  onChange={(e) => handleCellChange(originalIndex, 'deliverable', e.target.value)}
                                  placeholder="Put Format no."
                                  title="Deliverable format number (manual entry)"
                                  className="min-w-0 flex-1 rounded border border-[#64748B] bg-white px-2 py-1 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />

                                {row.deliverableFile ? (
                                  <div className="flex min-w-0 items-center gap-1 rounded bg-blue-50/90 border border-blue-200 px-1.5 py-0.5" title={row.deliverableFile.name}>
                                    <div className="flex items-center gap-1 min-w-0 max-w-[80px] truncate">
                                      {row.deliverableFile.type === 'pdf' ? (
                                        <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                      ) : row.deliverableFile.type === 'excel' ? (
                                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      ) : (
                                        <ImageIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                      )}
                                      <span className="text-[11px] font-semibold text-blue-700 truncate">
                                        {row.deliverableFile.name}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveDeliverableFile(originalIndex)}
                                      title="Remove attachment"
                                      className="p-0.5 rounded text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                                    >
                                      <X className="w-3 h-3 stroke-[2.5]" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeliverableModal({ isOpen: true, rowIndex: originalIndex })}
                                    className="flex items-center gap-1 px-1.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs shrink-0"
                                    title="Upload Deliverable (Image, PDF, Excel)"
                                  >
                                    <Upload className="w-3 h-3" />
                                    <span>Upload</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic px-1 flex-1 text-center">Not required</span>
                            )}
                          </div>
                        </td>

                        {!templateMode && (
                          <>
                        {/* 20. Std. Duration in Hours — Watch popup modal trigger matching screenshot */}
                        <td
                          className={`p-0 text-center cursor-pointer hover:bg-blue-50/50 transition-colors group/duration ${!canEditCell(row, 'duration') ? 'pointer-events-none opacity-75' : ''}`}
                          onClick={() => {
                            if (canEditCell(row, 'duration')) {
                              setWatchModal({ isOpen: true, rowIndex: originalIndex, value: row.duration || '' });
                            }
                          }}
                          title="Click to open Std. Duration Watch"
                        >
                          <div className="flex items-center justify-center gap-1.5 py-1.5 px-2">
                            <Clock className="w-3.5 h-3.5 text-blue-500 group-hover/duration:text-blue-600 shrink-0" />
                            <span className="font-mono text-sm font-semibold text-slate-800">
                              {isParentRow(row) ? getParentTotalDurationDisplay(row, rows) : (row.duration || '—')}
                            </span>
                          </div>
                        </td>

                        {/* 21. Start Date (Plan) */}
                        <td className={`p-0 text-center w-auto min-w-[116px] whitespace-nowrap ${!canEditCell(row, 'startDatePlan') ? 'pointer-events-none opacity-75' : ''}`}>
                          <CalendarDateInput
                            value={row.startDatePlan || ''}
                            onChange={(e) => handleCellChange(originalIndex, 'startDatePlan', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, originalIndex, 'startDatePlan')}
                            data-row={originalIndex}
                            data-col="startDatePlan"
                            placeholder="N/A"
                            className="w-full text-center py-2 px-1.5 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm font-mono"
                          />
                        </td>

                        {/* 22. Start Date (Actual) */}
                        <td className={`p-0 text-center w-auto min-w-[116px] whitespace-nowrap ${!canEditCell(row, 'startDateActual') ? 'pointer-events-none opacity-75' : ''}`}>
                          <CalendarDateInput
                            value={row.startDateActual || ''}
                            onChange={(e) => handleCellChange(originalIndex, 'startDateActual', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, originalIndex, 'startDateActual')}
                            data-row={originalIndex}
                            data-col="startDateActual"
                            placeholder="N/A"
                            className="w-full text-center py-2 px-1.5 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm font-mono"
                          />
                        </td>

                        {/* 23. End Date (Plan) — Vertical stacked date history with strikethrough on previous dates */}
                        {(() => {
                          const hasRowContent = Boolean(
                            row.phaseName || row.reqNo || row.customerEvent || row.activity || row.deliverable ||
                            row.startDatePlan || row.endDatePlan || row.startDateActual || row.endDateActual
                          );
                          const endPlanVal = String(row.endDatePlan ?? '').trim();
                          const isMissingEndPlan = hasRowContent && (!endPlanVal || endPlanVal === '—' || endPlanVal === '-' || endPlanVal === 'N/A');
                          return (
                            <td className={`p-0 text-center w-auto min-w-[116px] whitespace-nowrap align-middle ${isMissingEndPlan ? 'bg-red-50/70 ring-1 ring-inset ring-red-400' : ''}`}>
                              <EndDatePlanCell
                                row={row}
                                rowIndex={originalIndex}
                                isAdmin={isAdmin}
                                disabled={!canEditCell(row, 'endDatePlan')}
                                onSelectDate={(newDate) => handleSelectEndDatePlan(originalIndex, newDate)}
                                onRemoveBeforeDate={(prevIdx) => handleRemoveBeforeDate(originalIndex, prevIdx)}
                              />
                            </td>
                          );
                        })()}

                        {/* 24. End Date (Actual) */}
                        <td className={`p-0 text-center w-auto min-w-[116px] whitespace-nowrap ${!canEditCell(row, 'endDateActual') ? 'pointer-events-none opacity-75' : ''}`}>
                          <CalendarDateInput
                            value={row.endDateActual || ''}
                            onChange={(e) => handleCellChange(originalIndex, 'endDateActual', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, originalIndex, 'endDateActual')}
                            data-row={originalIndex}
                            data-col="endDateActual"
                            placeholder="N/A"
                            disabled={!canEditCell(row, 'endDateActual')}
                            className="w-full text-center py-2 px-1.5 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm font-mono"
                          />
                        </td>

                        {/* 25. HIT/MISS — Auto-adjusting width (automatically fetched, immutable once filled) */}
                        <td className={`p-0.5 text-center relative w-auto min-w-[78px] whitespace-nowrap ${(!canEditCell(row, 'hitMiss') || Boolean(row.hitMiss)) ? 'pointer-events-none opacity-90' : ''}`}>
                          <div className="relative flex items-center justify-center">
                            <select
                              disabled={!hasFullSheetAccess || Boolean(row.hitMiss)}
                              value={row.hitMiss || ''}
                              onChange={(e) => handleCellChange(originalIndex, 'hitMiss', e.target.value)}
                              title={row.hitMiss ? `HIT/MISS is set to ${row.hitMiss} and cannot be changed` : 'Select HIT/MISS'}
                              className={`appearance-none w-full py-1 pr-3.5 pl-1 rounded text-center text-xs sm:text-sm font-bold transition-all outline-none ${(!hasFullSheetAccess || Boolean(row.hitMiss)) ? 'pointer-events-none cursor-default' : 'cursor-pointer'} ${row.hitMiss === 'HIT'
                                ? 'bg-[#86EFAC] text-[#14532D] shadow-xs'
                                : row.hitMiss === 'MISS'
                                  ? 'bg-[#FCA5A5] text-[#7F1D1D] shadow-xs'
                                  : 'bg-transparent text-slate-500 hover:bg-slate-100'
                                }`}
                            >
                              <option value="" className="bg-white text-slate-700 font-normal">—</option>
                              <option value="HIT" className="bg-[#86EFAC] text-[#14532D] font-bold">HIT</option>
                              <option value="MISS" className="bg-[#FCA5A5] text-[#7F1D1D] font-bold">MISS</option>
                            </select>
                            {!row.hitMiss && <ChevronDown className="w-2.5 h-2.5 absolute right-0.5 pointer-events-none text-slate-500" />}
                          </div>
                        </td>

                        {/* 27, 28, 29: No. of Times Revised, Reason of Failure, Action Taken Against Failure */}
                        {(() => {
                          const revisions = getRowRevisions(row);
                          const isDelayOrMiss = row.status === 'Delay' || row.hitMiss === 'MISS';

                          // If multiple revisions taken, subdivide into multiple horizontal cells
                          if (revisions.length > 1) {
                            return (
                              <td
                                colSpan={3}
                                className={`p-0 align-middle text-center bg-white group-hover/row:bg-[#F8FAFC] ${!canEditCell(row, 'reasonOfFailure') ? 'pointer-events-none opacity-75' : ''}`}
                              >
                                <div className="flex flex-col w-full h-full divide-y divide-[#CBD5E1]">
                                  {revisions.map((rev, revIdx) => (
                                    <div
                                      key={`rev-${rev.revisionNo || revIdx}-${revIdx}`}
                                      className="flex w-full items-stretch divide-x divide-[#CBD5E1] min-h-[34px]"
                                    >
                                      {/* 27. No. of Times Revised child cell */}
                                      <div className="w-auto min-w-[148px] whitespace-nowrap shrink-0 flex items-center justify-between gap-1.5 px-2 py-1 bg-white hover:bg-slate-50 transition-colors">
                                        <span className="text-xs font-semibold text-rose-800 font-mono whitespace-nowrap">
                                          {rev.tag || `${revIdx + 1}) ${rev.date || getFormattedCurrentDate()}`}
                                        </span>
                                        <div className="flex items-center gap-0.5">
                                          {revIdx === revisions.length - 1 && (
                                            <button
                                              type="button"
                                              onClick={() => handleAddRevision(originalIndex)}
                                              title="Add another revision"
                                              className="p-0.5 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                            >
                                              <Plus className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveRevision(originalIndex, revIdx)}
                                            title="Remove revision"
                                            className="p-0.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* 28. Reason of Failure child cell */}
                                      <div className="w-auto min-w-[180px] flex-1 flex items-center p-0">
                                        <ManualInputBox
                                          value={rev.reasonOfFailure || ''}
                                          onChange={(e) => handleRevisionCellChange(originalIndex, revIdx, 'reasonOfFailure', e.target.value)}
                                          placeholder={`Reason of failure ${rev.revisionNo || revIdx + 1} *`}
                                          className={`w-full py-1.5 px-2 text-xs sm:text-sm outline-none ${!String(rev.reasonOfFailure || '').trim()
                                            ? 'bg-rose-50/70 text-slate-800 ring-1 ring-inset ring-rose-400 placeholder:text-rose-600 placeholder:font-semibold focus:bg-amber-50 focus:ring-blue-500'
                                            : 'bg-transparent text-slate-700 focus:bg-amber-50 focus:ring-1 focus:ring-blue-500'
                                            }`}
                                        />
                                      </div>

                                      {/* 29. Action Taken Against Failure child cell */}
                                      <div
                                        style={{
                                          width: `${colWidths.actionTaken}px`,
                                          minWidth: `${colWidths.actionTaken}px`,
                                        }}
                                        className="shrink-0 flex items-center p-0"
                                      >
                                        <ManualInputBox
                                          value={rev.actionTaken || ''}
                                          noDropdown={true}
                                          onChange={(e) => handleRevisionCellChange(originalIndex, revIdx, 'actionTaken', e.target.value)}
                                          data-row={originalIndex}
                                          data-col="actionTaken"
                                          placeholder={`Action taken ${rev.revisionNo || revIdx + 1}...`}
                                          className="w-full py-1.5 px-2 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs sm:text-sm"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            );
                          }

                          // Single or zero revisions case
                          const singleRev = revisions[0] || null;
                          const revText = singleRev ? singleRev.tag : (row.noOfTimesRevised || '');

                          return (
                            <>
                              {/* 27. No. of Times Revised */}
                              <td className={`p-0 text-center relative w-auto min-w-[148px] whitespace-nowrap ${!canEditCell(row, 'noOfTimesRevised') ? 'pointer-events-none opacity-75' : ''}`}>
                                <div className="relative flex items-center justify-between gap-1 px-1.5">
                                  <div className="min-w-[102px] flex-1">
                                    <ManualInputBox
                                      value={revText || ''}
                                      onChange={(e) => handleCellChange(originalIndex, 'noOfTimesRevised', e.target.value)}
                                      placeholder={isDelayOrMiss ? '1) DD-MM-YY *' : '0'}
                                      className={`w-full text-center py-2 px-1 text-xs sm:text-sm whitespace-nowrap ${revText
                                        ? 'font-semibold text-rose-800'
                                        : isDelayOrMiss
                                          ? 'bg-rose-50/70 ring-1 ring-inset ring-rose-400 placeholder:text-rose-600 font-semibold'
                                          : 'text-slate-700'
                                        } bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500`}
                                    />
                                  </div>
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    {revText ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleAddRevision(originalIndex)}
                                          title="Add 2nd revision"
                                          className="p-0.5 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => clearRevision(originalIndex)}
                                          title="Remove revision"
                                          className="p-0.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleAddRevision(originalIndex)}
                                        title="Add revision"
                                        className="p-0.5 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* 28. Reason of Failure */}
                              <td className={`p-0 w-auto min-w-[180px] ${!canEditCell(row, 'reasonOfFailure') ? 'pointer-events-none opacity-75' : ''}`}>
                                <ManualInputBox
                                  value={row.reasonOfFailure || ''}
                                  onChange={(e) => handleCellChange(originalIndex, 'reasonOfFailure', e.target.value)}
                                  placeholder={
                                    isDelayOrMiss || revText
                                      ? 'Enter Reason of Failure *'
                                      : 'Reason of failure...'
                                  }
                                  className={`w-full py-2 px-2 text-xs sm:text-sm outline-none ${(isDelayOrMiss || revText) && !String(row.reasonOfFailure || '').trim()
                                    ? 'bg-rose-50/70 text-slate-800 ring-1 ring-inset ring-rose-400 placeholder:text-rose-600 placeholder:font-semibold focus:bg-amber-50 focus:ring-blue-500'
                                    : 'bg-transparent text-slate-700 focus:bg-amber-50 focus:ring-1 focus:ring-blue-500'
                                    }`}
                                />
                              </td>

                              {/* 29. Action Taken Against Failure */}
                              <td
                                className={`p-0 ${!canEditCell(row, 'actionTaken') ? 'pointer-events-none opacity-75' : ''}`}
                                style={{
                                  width: `${colWidths.actionTaken}px`,
                                  minWidth: `${colWidths.actionTaken}px`,
                                }}
                              >
                                <ManualInputBox
                                  value={row.actionTaken || ''}
                                  noDropdown={true}
                                  onChange={(e) => handleCellChange(originalIndex, 'actionTaken', e.target.value)}
                                  data-row={originalIndex}
                                  data-col="actionTaken"
                                  placeholder="Action taken..."
                                  className="w-full py-2 px-2 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs sm:text-sm"
                                />
                              </td>
                            </>
                          );
                        })()}

                        {/* Responsible Person: When both units chosen, parent cell divided horizontally into Bawal and Gujrat parts */}
                        {(() => {
                          const { units, deptsByUnit } = getResponsiblePersonStructure(row);
                          const respDisabledClass = !canEditCell(row, 'staffName') ? 'pointer-events-none opacity-75' : '';
                          if (units.length > 1) {
                            return (
                              <td
                                colSpan={3}
                                className={`p-0 align-middle text-center bg-white group-hover/row:bg-[#F8FAFC] ${respDisabledClass}`}
                              >
                                <div className="flex flex-col w-full h-full divide-y divide-[#CBD5E1]">
                                  {units.map((unitName) => {
                                    const unitDepts = deptsByUnit[unitName] || [];
                                    const unitOptions = getDepartmentsForUnit(unitName).map((d) => ({ value: d, label: d }));
                                    const flexGrow = Math.max(1, unitDepts.length);

                                    return (
                                      <div
                                        key={unitName}
                                        style={{ flex: flexGrow }}
                                        className="flex w-full items-stretch divide-x divide-[#CBD5E1]"
                                      >
                                        {/* 1. Unit Child */}
                                        <div className="w-[110px] min-w-[100px] shrink-0 relative min-h-[30px] flex items-center justify-between px-2 py-1 bg-white hover:bg-slate-50 transition-colors">
                                          <span className="text-sm font-bold text-slate-800">{unitName}</span>
                                          <CheckboxMultiSelect
                                            value={units}
                                            options={PDCA_UNITS.map((u) => ({ value: u, label: u }))}
                                            onChange={(newUnits) => handleResponsibleUnitsChange(originalIndex, newUnits)}
                                            renderTrigger={({ open, setOpen, buttonRef }) => (
                                              <button
                                                ref={buttonRef}
                                                type="button"
                                                onClick={() => setOpen(!open)}
                                                className="text-slate-400 hover:text-blue-600 p-0.5 rounded cursor-pointer"
                                                title={`Change units (currently: ${units.join(', ')})`}
                                              >
                                                <ChevronDown className="w-3 h-3" />
                                              </button>
                                            )}
                                          />
                                        </div>

                                        {/* 2. Dept Child */}
                                        <div className="w-[145px] min-w-[135px] shrink-0 flex items-center justify-center">
                                          {unitDepts.length === 0 ? (
                                            <div className="w-full p-1 min-h-[30px] flex items-center justify-center">
                                              <CheckboxMultiSelect
                                                value={[]}
                                                options={unitOptions}
                                                placeholder="Dept..."
                                                onChange={(newDepts) => handleUnitDepartmentsChange(originalIndex, unitName, newDepts)}
                                              />
                                            </div>
                                          ) : unitDepts.length === 1 ? (
                                            <div className="flex-1 w-full min-h-[30px] flex items-center justify-between px-2 py-1 gap-1 hover:bg-blue-50/40 transition-colors">
                                              <span className="text-sm font-semibold text-slate-800 whitespace-nowrap text-left" title={unitDepts[0]}>
                                                {unitDepts[0]}
                                              </span>
                                              <CheckboxMultiSelect
                                                value={unitDepts}
                                                options={unitOptions}
                                                onChange={(newDepts) => handleUnitDepartmentsChange(originalIndex, unitName, newDepts)}
                                                renderTrigger={({ open, setOpen, buttonRef }) => (
                                                  <button
                                                    ref={buttonRef}
                                                    type="button"
                                                    onClick={() => setOpen(!open)}
                                                    className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer ml-1 shrink-0"
                                                    title={`Edit ${unitName} departments`}
                                                  >
                                                    <ChevronDown className="w-3 h-3" />
                                                  </button>
                                                )}
                                              />
                                            </div>
                                          ) : (
                                            <div className="flex flex-col h-full w-full divide-y divide-[#CBD5E1] justify-center">
                                              {unitDepts.map((deptName) => (
                                                <div
                                                  key={deptName}
                                                  className="flex-1 min-h-[30px] flex items-center justify-between px-2 py-1 gap-1 hover:bg-blue-50/40 transition-colors"
                                                >
                                                  <span className="text-sm font-semibold text-slate-800 whitespace-nowrap text-left" title={deptName}>
                                                    {deptName}
                                                  </span>
                                                  <CheckboxMultiSelect
                                                    value={unitDepts}
                                                    options={unitOptions}
                                                    onChange={(newDepts) => handleUnitDepartmentsChange(originalIndex, unitName, newDepts)}
                                                    renderTrigger={({ open, setOpen, buttonRef }) => (
                                                      <button
                                                        ref={buttonRef}
                                                        type="button"
                                                        onClick={() => setOpen(!open)}
                                                        className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer ml-1 shrink-0"
                                                        title={`Edit ${unitName} departments`}
                                                      >
                                                        <ChevronDown className="w-3 h-3" />
                                                      </button>
                                                    )}
                                                  />
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        {/* 3. Staff Name Child */}
                                        <div className="w-[160px] min-w-[150px] shrink-0 flex flex-col justify-center">
                                          {unitDepts.length === 0 ? (
                                            (() => {
                                              const assignedEmps = (row.staffEmployees || []).filter(
                                                (e) => e.unit === unitName || (!e.unit && units.length === 1)
                                              );
                                              const legacyDisplay = units.length === 1 && !assignedEmps.length ? (row.staffEmployee ? stripEmployeeId(row.staffEmployee) : '') : '';

                                              if (assignedEmps.length || legacyDisplay) {
                                                return (
                                                  <div className="relative flex-1 w-full min-h-[30px] px-1 py-1 flex flex-col gap-1 group/emp hover:bg-slate-50 transition-colors justify-center">
                                                    {(assignedEmps.length ? assignedEmps : [{ name: legacyDisplay, legacy: true }]).map((employee, employeeIndex) => (
                                                      <div key={`${employee.code || employee.name}-${employeeIndex}`} className="flex w-full items-center gap-1">
                                                        <button type="button" onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, unitName, '', e)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600" title={`${unitName}: ${employee.name}`}>
                                                          {stripEmployeeId(employee.name || employee.label || '')}
                                                        </button>
                                                        <button type="button" onClick={() => employee.legacy ? handleSelectStaffForUnitDept(originalIndex, unitName, '', null) : handleRemoveDepartmentEmployee(originalIndex, unitName, '', employee)} className="shrink-0 rounded p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer" title="Remove employee"><X className="h-3.5 w-3.5 stroke-[2.5]" /></button>
                                                      </div>
                                                    ))}
                                                    <div className="flex justify-end w-full">
                                                      <button type="button" onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, unitName, '', e, true)} className="rounded p-0.5 text-blue-600 hover:bg-blue-50 cursor-pointer" title="Add staff name"><Plus className="h-3.5 w-3.5 stroke-[2.5]" /></button>
                                                    </div>
                                                  </div>
                                                );
                                              }

                                              return (
                                                <div className="flex-1 w-full min-h-[30px] flex items-center justify-center px-1">
                                                  <button
                                                    type="button"
                                                    onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, unitName, '', e)}
                                                    className="w-full py-1 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 rounded group cursor-pointer"
                                                    title={`Select staff for ${unitName} (Department will auto-fetch)`}
                                                  >
                                                    <div className="flex items-center gap-1 text-sm">
                                                      <Search className="h-3.5 w-3.5" />
                                                      <span>Staff...</span>
                                                      <ChevronDown className="h-3 w-3" />
                                                    </div>
                                                  </button>
                                                </div>
                                              );
                                            })()
                                          ) : (
                                            <div className="flex flex-col h-full w-full justify-center">
                                              <div className="flex flex-col flex-1 w-full divide-y divide-[#CBD5E1] justify-center">
                                                {unitDepts.map((deptName) => {
                                                  const assignedEmps = (row.staffEmployees || []).filter(
                                                    (e) => e.department === deptName && (e.unit === unitName || (!e.unit && units.length === 1))
                                                  );
                                                  const legacyDisplay = units.length === 1 && unitDepts.length === 1 && !(row.staffEmployees || []).length ? row.staffEmployee : '';

                                                  if (assignedEmps.length || legacyDisplay) {
                                                    return (
                                                      <div
                                                        key={deptName}
                                                        className="relative flex-1 w-full min-h-[30px] px-1 py-1 flex flex-col gap-1 group/emp hover:bg-slate-50 transition-colors justify-center"
                                                      >
                                                        {(assignedEmps.length ? assignedEmps : (legacyDisplay ? [{ name: legacyDisplay, department: deptName, unit: unitName, legacy: true }] : [])).map((employee, employeeIndex) => (
                                                          <div key={`${employee.code || employee.name}-${employeeIndex}`} className="flex w-full items-center gap-1">
                                                            <button type="button" onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, unitName, deptName, e)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600" title={`${unitName} - ${deptName}: ${employee.name}`}>
                                                              {stripEmployeeId(employee.name || employee.label || '')}
                                                            </button>
                                                            <button type="button" onClick={() => employee.legacy ? handleSelectStaffForUnitDept(originalIndex, unitName, deptName, null) : handleRemoveDepartmentEmployee(originalIndex, unitName, deptName, employee)} className="shrink-0 rounded p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer" title="Remove employee"><X className="h-3.5 w-3.5 stroke-[2.5]" /></button>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    );
                                                  }

                                                  return (
                                                    <div
                                                      key={deptName}
                                                      className="flex-1 w-full min-h-[30px] flex items-center justify-center px-1"
                                                    >
                                                      <button type="button" onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, unitName, deptName, e)} className="w-full py-1 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 rounded group cursor-pointer" title={`Select staff for ${unitName} - ${deptName}`}>
                                                        <div className="flex items-center gap-1 text-sm">
                                                          <Search className="h-3.5 w-3.5" />
                                                          <span>Staff...</span>
                                                          <ChevronDown className="h-3 w-3" />
                                                        </div>
                                                      </button>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                              {(row.staffEmployees || []).some((e) => (e.unit === unitName || (!e.unit && units.length === 1))) && (
                                                <div className="flex justify-end w-full px-1 pb-0.5">
                                                  <button type="button" onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, unitName, '', e, true)} className="rounded p-0.5 text-blue-600 hover:bg-blue-50 cursor-pointer" title="Add staff name">
                                                    <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            );
                          }

                          // Single unit or none selected: 3 separate <td> elements
                          return (
                            <>
                              {/* Unit */}
                              <td className={`p-0 align-middle text-center bg-white group-hover/row:bg-[#F8FAFC] w-[110px] min-w-[100px] ${respDisabledClass}`}>
                                <div className="p-1 w-full">
                                  <CheckboxMultiSelect
                                    value={units}
                                    options={PDCA_UNITS.map((u) => ({ value: u, label: u }))}
                                    placeholder="Unit..."
                                    onChange={(newUnits) => handleResponsibleUnitsChange(originalIndex, newUnits)}
                                  />
                                </div>
                              </td>

                              {/* Department Dropdown in Responsible Person */}
                              <td className={`p-0 align-middle text-center bg-white group-hover/row:bg-[#F8FAFC] w-[145px] min-w-[135px] ${respDisabledClass}`}>
                                {units.length === 0 ? (
                                  <div className="w-full py-1 text-center text-slate-300 text-sm select-none" title="Select Staff Name to auto-fetch Department">
                                    -
                                  </div>
                                ) : (() => {
                                  const unitName = units[0];
                                  const unitDepts = deptsByUnit[unitName] || [];
                                  const unitOptions = getDepartmentsForUnit(unitName).map((d) => ({ value: d, label: d }));

                                  if (unitDepts.length === 0) {
                                    return (
                                      <div className="p-1 min-h-[30px] flex items-center justify-center">
                                        <CheckboxMultiSelect
                                          value={[]}
                                          options={unitOptions}
                                          placeholder="Dept..."
                                          onChange={(newDepts) => handleUnitDepartmentsChange(originalIndex, unitName, newDepts)}
                                        />
                                      </div>
                                    );
                                  }

                                  if (unitDepts.length === 1) {
                                    return (
                                      <div className="flex-1 min-h-[30px] flex items-center justify-between px-2 py-1 gap-1 hover:bg-blue-50/40 transition-colors">
                                        <span className="text-sm font-semibold text-slate-800 whitespace-nowrap text-left" title={unitDepts[0]}>
                                          {unitDepts[0]}
                                        </span>
                                        <CheckboxMultiSelect
                                          value={unitDepts}
                                          options={unitOptions}
                                          onChange={(newDepts) => handleUnitDepartmentsChange(originalIndex, unitName, newDepts)}
                                          renderTrigger={({ open, setOpen, buttonRef }) => (
                                            <button
                                              ref={buttonRef}
                                              type="button"
                                              onClick={() => setOpen(!open)}
                                              className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer ml-1 shrink-0"
                                              title={`Edit ${unitName} departments`}
                                            >
                                              <ChevronDown className="w-3 h-3" />
                                            </button>
                                          )}
                                        />
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="flex flex-col h-full w-full divide-y divide-[#CBD5E1] justify-center">
                                      {unitDepts.map((deptName) => (
                                        <div
                                          key={deptName}
                                          className="flex-1 min-h-[30px] flex items-center justify-between px-2 py-1 gap-1 hover:bg-blue-50/40 transition-colors"
                                        >
                                          <span className="text-sm font-semibold text-slate-800 whitespace-nowrap text-left" title={deptName}>
                                            {deptName}
                                          </span>
                                          <CheckboxMultiSelect
                                            value={unitDepts}
                                            options={unitOptions}
                                            onChange={(newDepts) => handleUnitDepartmentsChange(originalIndex, unitName, newDepts)}
                                            renderTrigger={({ open, setOpen, buttonRef }) => (
                                              <button
                                                ref={buttonRef}
                                                type="button"
                                                onClick={() => setOpen(!open)}
                                                className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer ml-1 shrink-0"
                                                title={`Edit ${unitName} departments`}
                                              >
                                                <ChevronDown className="w-3 h-3" />
                                              </button>
                                            )}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </td>

                              {/* Staff Name in Responsible Person */}
                              {(() => {
                                const hasRowContent = Boolean(
                                  row.phaseName || row.reqNo || row.customerEvent || row.activity || row.deliverable ||
                                  row.startDatePlan || row.endDatePlan || row.startDateActual || row.endDateActual
                                );
                                const hasStaff = Boolean(
                                  String(row.staffName ?? '').trim() ||
                                  String(row.staffEmployee ?? '').trim() ||
                                  (Array.isArray(row.staffEmployees) && row.staffEmployees.length > 0)
                                );
                                const isMissingStaff = hasRowContent && !hasStaff;
                                return (
                                  <td className={`p-0 align-middle text-center group-hover/row:bg-[#F8FAFC] w-[160px] min-w-[150px] ${isMissingStaff ? 'bg-red-50/70 ring-1 ring-inset ring-red-400' : 'bg-white'} ${respDisabledClass}`}>
                                {units.length === 0 ? (
                                  (() => {
                                    const assignedEmps = row.staffEmployees || [];
                                    const legacyDisplay = !assignedEmps.length ? (row.staffEmployee ? stripEmployeeId(row.staffEmployee) : '') : '';
                                    if (assignedEmps.length || legacyDisplay) {
                                      return (
                                        <div className="relative flex-1 w-full min-h-[30px] px-1 py-1 flex flex-col gap-1 group/emp hover:bg-slate-50 transition-colors">
                                          {(assignedEmps.length ? assignedEmps : [{ name: legacyDisplay, legacy: true }]).map((employee, employeeIndex) => (
                                            <div key={`${employee.code || employee.name}-${employeeIndex}`} className="flex w-full items-center gap-1">
                                              <button type="button" onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, '', '', e)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600" title={`Staff: ${employee.name}`}>
                                                {stripEmployeeId(employee.name || employee.label || '')}
                                              </button>
                                              <button type="button" onClick={() => handleSelectStaffForUnitDept(originalIndex, '', '', null)} className="shrink-0 rounded p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer" title="Remove employee"><X className="h-3.5 w-3.5 stroke-[2.5]" /></button>
                                            </div>
                                          ))}
                                          <div className="flex justify-end w-full">
                                            <button type="button" onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, '', '', e, true)} className="rounded p-0.5 text-blue-600 hover:bg-blue-50 cursor-pointer" title="Add staff name"><Plus className="h-3.5 w-3.5 stroke-[2.5]" /></button>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="flex-1 w-full min-h-[30px] flex items-center justify-center px-1">
                                        <button
                                          type="button"
                                          onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, '', '', e)}
                                          className="w-full py-1 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 rounded group cursor-pointer"
                                          title="Select staff name (Department will auto-fetch)"
                                        >
                                          <div className="flex items-center gap-1 text-sm">
                                            <Search className="h-3.5 w-3.5" />
                                            <span>Staff...</span>
                                            <ChevronDown className="h-3 w-3" />
                                          </div>
                                        </button>
                                      </div>
                                    );
                                  })()
                                ) : (() => {
                                  const unitName = units[0];
                                  const unitDepts = deptsByUnit[unitName] || [];

                                  if (unitDepts.length === 0) {
                                    const assignedEmps = (row.staffEmployees || []).filter(
                                      (e) => e.unit === unitName || (!e.unit && units.length === 1)
                                    );
                                    const legacyDisplay = units.length === 1 && !assignedEmps.length ? (row.staffEmployee ? stripEmployeeId(row.staffEmployee) : '') : '';

                                    if (assignedEmps.length || legacyDisplay) {
                                      return (
                                        <div className="relative flex-1 w-full min-h-[30px] px-1 py-1 flex flex-col gap-1 group/emp hover:bg-slate-50 transition-colors">
                                          {(assignedEmps.length ? assignedEmps : [{ name: legacyDisplay, legacy: true }]).map((employee, employeeIndex) => (
                                            <div key={`${employee.code || employee.name}-${employeeIndex}`} className="flex w-full items-center gap-1">
                                              <button type="button" onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, unitName, '', e)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600" title={`${unitName}: ${employee.name}`}>
                                                {stripEmployeeId(employee.name || employee.label || '')}
                                              </button>
                                              <button type="button" onClick={() => employee.legacy ? handleSelectStaffForUnitDept(originalIndex, unitName, '', null) : handleRemoveDepartmentEmployee(originalIndex, unitName, '', employee)} className="shrink-0 rounded p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer" title="Remove employee"><X className="h-3.5 w-3.5 stroke-[2.5]" /></button>
                                            </div>
                                          ))}
                                          <div className="flex justify-end w-full">
                                            <button type="button" onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, unitName, '', e, true)} className="rounded p-0.5 text-blue-600 hover:bg-blue-50 cursor-pointer" title="Add staff name"><Plus className="h-3.5 w-3.5 stroke-[2.5]" /></button>
                                          </div>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div className="flex-1 w-full min-h-[30px] flex items-center justify-center px-1">
                                        <button
                                          type="button"
                                          onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, unitName, '', e)}
                                          className="w-full py-1 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 rounded group cursor-pointer"
                                          title={`Select staff for ${unitName} (Department will auto-fetch)`}
                                        >
                                          <div className="flex items-center gap-1 text-sm">
                                            <Search className="h-3.5 w-3.5" />
                                            <span>Staff...</span>
                                            <ChevronDown className="h-3 w-3" />
                                          </div>
                                        </button>
                                      </div>
                                    );
                                  }

                                  const hasAnyAssignedInUnit = (row.staffEmployees || []).some(
                                    (e) => e.unit === unitName || (!e.unit && units.length === 1)
                                  ) || Boolean(units.length === 1 && unitDepts.length === 1 && row.staffEmployee);

                                  return (
                                    <div className="flex flex-col h-full w-full justify-center">
                                      <div className="flex flex-col flex-1 w-full divide-y divide-[#CBD5E1] justify-center">
                                        {unitDepts.map((deptName) => {
                                          const assignedEmps = (row.staffEmployees || []).filter(
                                            (e) => e.department === deptName && (e.unit === unitName || (!e.unit && units.length === 1))
                                          );
                                          const legacyDisplay = units.length === 1 && unitDepts.length === 1 && !(row.staffEmployees || []).length ? row.staffEmployee : '';

                                          if (assignedEmps.length || legacyDisplay) {
                                            return (
                                              <div
                                                key={deptName}
                                                className="relative flex-1 w-full min-h-[30px] px-1 py-1 flex flex-col gap-1 group/emp hover:bg-slate-50 transition-colors"
                                              >
                                                {(assignedEmps.length ? assignedEmps : (legacyDisplay ? [{ name: legacyDisplay, department: deptName, unit: unitName, legacy: true }] : [])).map((employee, employeeIndex) => (
                                                  <div key={`${employee.code || employee.name}-${employeeIndex}`} className="flex w-full items-center gap-1">
                                                    <button type="button" onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, unitName, deptName, e)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600" title={`${unitName} - ${deptName}: ${employee.name}`}>
                                                      {stripEmployeeId(employee.name || employee.label || '')}
                                                    </button>
                                                    <button type="button" onClick={() => employee.legacy ? handleSelectStaffForUnitDept(originalIndex, unitName, deptName, null) : handleRemoveDepartmentEmployee(originalIndex, unitName, deptName, employee)} className="shrink-0 rounded p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer" title="Remove employee"><X className="h-3.5 w-3.5 stroke-[2.5]" /></button>
                                                  </div>
                                                ))}
                                              </div>
                                            );
                                          }

                                          return (
                                            <div
                                              key={deptName}
                                              className="flex-1 w-full min-h-[30px] flex items-center justify-center px-1"
                                            >
                                              <button type="button" onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, unitName, deptName, e)} className="w-full py-1 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 rounded group cursor-pointer" title={`Select staff for ${unitName} - ${deptName}`}>
                                                <div className="flex items-center gap-1 text-sm">
                                                  <Search className="h-3.5 w-3.5" />
                                                  <span>Staff...</span>
                                                  <ChevronDown className="h-3 w-3" />
                                                </div>
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {hasAnyAssignedInUnit && (
                                        <div className="flex justify-end w-full px-1 pb-0.5">
                                          <button type="button" onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, unitName, '', e, true)} className="rounded p-0.5 text-blue-600 hover:bg-blue-50 cursor-pointer" title="Add staff name">
                                            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                                );
                              })()}
                            </>
                          );
                        })()}

                        {/* 30. Status (Not-Started / In-Progress / Done / Delay) — Done is selectable only manually by sheet creator / admin */}
                        <td
                          className="p-0.5 text-center relative w-auto"
                          style={{
                            minWidth: `${STATUS_COLUMN_MIN_WIDTH}px`,
                          }}
                        >
                          <div className="relative flex items-center justify-center">
                            {(() => {
                              const currentStatus = normalizePtmStatus(row.status || 'Not-Started');
                              return (
                                <select
                                  disabled={!hasFullSheetAccess}
                                  value={currentStatus}
                                  onChange={(e) => handleCellChange(originalIndex, 'status', e.target.value)}
                                  className={`appearance-none w-full whitespace-nowrap py-1 pr-5 pl-2 rounded text-center text-xs sm:text-sm font-semibold outline-none border transition-colors ${!hasFullSheetAccess ? 'pointer-events-none cursor-default select-none' : 'cursor-pointer hover:opacity-90'
                                    } ${currentStatus === 'Done'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                      : currentStatus === 'In-Progress'
                                        ? 'bg-yellow-50 text-yellow-800 border-yellow-300'
                                        : currentStatus === 'Delay'
                                          ? 'bg-rose-50 text-rose-700 border-rose-300'
                                          : 'bg-blue-50 text-blue-800 border-blue-300'
                                    }`}
                                  title={
                                    hasFullSheetAccess
                                      ? 'Change Status (Done can be marked manually by sheet creator/admin)'
                                      : 'Status can only be marked as Done by the sheet creator or admin'
                                  }
                                >
                                  {PTM_STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value} className={opt.color}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              );
                            })()}
                            {hasFullSheetAccess && (
                              <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-0.5 pointer-events-none" />
                            )}
                          </div>
                        </td>

                        {/* 31. Remarks — Manual input (no search dropdown, resizable width) */}
                        <td
                          className={`p-0 ${!canEditCell(row, 'remarks') ? 'pointer-events-none opacity-75' : ''}`}
                          style={{
                            width: `${colWidths.remarks}px`,
                            minWidth: `${colWidths.remarks}px`,
                          }}
                        >
                          <ManualInputBox
                            value={row.remarks || ''}
                            noDropdown={true}
                            onChange={(e) => handleCellChange(originalIndex, 'remarks', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, originalIndex, 'remarks')}
                            data-row={originalIndex}
                            data-col="remarks"
                            placeholder="Remarks..."
                            className="w-full py-2 px-2 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm"
                          />
                        </td>
                          </>
                        )}
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </ManualInputOptionsContext.Provider>
      </div>

      {/* Std Duration Watch Modal */}
      <StdDurationWatchModal
        isOpen={watchModal.isOpen}
        initialValue={watchModal.value}
        onClose={() => setWatchModal({ isOpen: false, rowIndex: null, value: '' })}
        onSave={(newTime) => {
          if (watchModal.rowIndex !== null) {
            handleCellChange(watchModal.rowIndex, 'duration', newTime);
          }
        }}
      />

      {/* Column Header Filter Popover Portal */}
      {openHeaderFilter && createPortal(
        (() => {
          const allOptions = headerFilterOptionsMap[openHeaderFilter.colKey] || [];
          const q = headerFilterSearch.trim().toLowerCase();
          const visibleOptions = q
            ? allOptions.filter((o) => String(o.label || '').toLowerCase().includes(q))
            : allOptions;
          const selectedValues = columnFilters[openHeaderFilter.colKey] || [];
          const showSearch = allOptions.length > 6 || ['phaseName', 'respDept', 'respStaff'].includes(openHeaderFilter.colKey);

          return (
            <div
              style={{
                position: 'fixed',
                top: `${openHeaderFilter.top}px`,
                left: `${openHeaderFilter.left}px`,
                width: `${openHeaderFilter.width}px`,
                zIndex: 9999,
              }}
              className="ptm-header-filter-popover bg-white rounded-xl shadow-2xl border border-slate-200 p-2.5 select-none flex flex-col max-h-[310px]"
            >
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider truncate">
                  Filter: {openHeaderFilter.title}
                </span>
                <button
                  type="button"
                  onClick={() => setOpenHeaderFilter(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {showSearch && (
                <div className="relative mb-1.5">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={headerFilterSearch}
                    onChange={(e) => setHeaderFilterSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-md pl-6 pr-6 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                  {headerFilterSearch && (
                    <button
                      type="button"
                      onClick={() => setHeaderFilterSearch('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              <div className="overflow-y-auto flex-1 space-y-0.5 pr-0.5 max-h-[185px]">
                {visibleOptions.length > 0 ? (
                  visibleOptions.map((opt) => {
                    const checked = selectedValues.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors ${checked ? 'bg-blue-50 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleHeaderFilterOption(openHeaderFilter.colKey, opt.value)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        {opt.symbol === 'applicable' && (
                          <span className="inline-block w-3.5 h-3.5 bg-black rounded-xs shrink-0" title="Applicable (■)" />
                        )}
                        {opt.symbol === 'if_required' && (
                          <span className="inline-block w-3.5 h-3.5 border-2 border-black bg-white rounded-xs shrink-0" title="If Required (□)" />
                        )}
                        <span className="truncate">{opt.label}</span>
                      </label>
                    );
                  })
                ) : (
                  <div className="py-3 text-center text-xs text-slate-400">No options found</div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-slate-100 text-[11px]">
                <button
                  type="button"
                  onClick={() => clearHeaderFilter(openHeaderFilter.colKey)}
                  disabled={selectedValues.length === 0}
                  className="text-rose-600 hover:text-rose-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Clear Filter
                </button>
                <button
                  type="button"
                  onClick={() => setOpenHeaderFilter(null)}
                  className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* Staff Dropdown Popover Portal */}
      {openStaffDropdown && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${openStaffDropdown.top}px`,
            left: `${openStaffDropdown.left}px`,
            width: `${openStaffDropdown.width}px`,
            zIndex: 9999
          }}
          className="staff-dropdown-menu bg-white rounded-xl shadow-2xl border border-slate-200 p-2.5 animate-in fade-in zoom-in-95 duration-100 select-none max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="px-2 py-1 pb-2 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {openStaffDropdown.department ? `${openStaffDropdown.unit ? `${openStaffDropdown.unit} - ` : ''}${openStaffDropdown.department} Staff` : 'Select Staff Name'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpenStaffDropdown(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search bar */}
          <div className="pt-2 pb-1.5 px-0.5 shrink-0">
            <div className="relative w-full">
              <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
                placeholder="Search staff name or ID..."
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg pl-7 pr-7 py-1 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
              {staffSearchQuery && (
                <button
                  type="button"
                  onClick={() => setStaffSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Staff Options List */}
          <div className="py-1 space-y-1 overflow-y-auto flex-1 pr-0.5 max-h-[240px]">
            {getStaffOptionsForRow(openStaffDropdown.rowIndex, openStaffDropdown.unit, openStaffDropdown.department).length > 0 ? (
              getStaffOptionsForRow(openStaffDropdown.rowIndex, openStaffDropdown.unit, openStaffDropdown.department).map((empItem, i) => {
                const empName = empItem.label;
                const empDept = empItem.department;
                const currentRow = rows[openStaffDropdown.rowIndex];
                const isSelected = openStaffDropdown.unit && openStaffDropdown.department
                  ? (currentRow?.staffEmployees || []).some(
                    (e) => e.department === openStaffDropdown.department && (e.unit === openStaffDropdown.unit || (!e.unit && (!currentRow?.respUnits || currentRow?.respUnits?.length <= 1))) && (e.name === empItem.label || e.name === empItem.name)
                  )
                  : currentRow?.staffEmployee === empName;
                const isDeptMatch = currentRow?.department &&
                  empDept &&
                  empDept.toLowerCase() === currentRow.department.toLowerCase();

                return (
                  <button
                    key={`${empName}_${i}`}
                    type="button"
                    onClick={() => {
                      const empObj = {
                        id: empItem.id,
                        name: empItem.name || empItem.label,
                        code: empItem.code || '',
                        department: openStaffDropdown.department || empItem.department || '',
                        unit: openStaffDropdown.unit || empItem.unit || ''
                      };
                      handleSelectStaffForUnitDept(
                        openStaffDropdown.rowIndex,
                        openStaffDropdown.unit,
                        openStaffDropdown.department,
                        empObj,
                        Boolean(openStaffDropdown.appendMode)
                      );
                      setOpenStaffDropdown(null);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer group text-xs ${isSelected
                      ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200'
                      : 'hover:bg-slate-100/80 text-slate-800 border border-transparent'
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-1 truncate">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-blue-600' : 'bg-slate-300 group-hover:bg-blue-500'
                          }`}
                      />
                      <span className="truncate font-medium">{empItem.name || empName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {empItem.code && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                          {empItem.code}
                        </span>
                      )}
                      {empDept && (
                        <span
                          className={`text-[9.5px] font-medium px-1.5 py-0.5 rounded border ${isDeptMatch
                            ? 'bg-blue-100/80 text-blue-800 border-blue-300 font-semibold'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                        >
                          {empDept}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-4 text-center text-xs text-slate-400">
                No matching staff found
              </div>
            )}
          </div>

          {/* Add custom staff button at bottom */}
          <button
            type="button"
            onClick={() => {
              const idx = openStaffDropdown.rowIndex;
              const unit = openStaffDropdown.unit;
              const dept = openStaffDropdown.department;
              setOpenStaffDropdown(null);
              handleOpenAddStaffModal(idx, unit, dept);
            }}
            className="w-full mt-2 pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Add / Enter Custom Staff Details</span>
          </button>
        </div>,
        document.body
      )}

      {/* Add Staff Employee Modal */}
      <AddStaffEmployeeModal
        isOpen={staffEmployeeModal.isOpen}
        rowIndex={staffEmployeeModal.rowIndex}
        initialValue={staffEmployeeModal.initialValue}
        initialEmployees={staffEmployeeModal.initialEmployees}
        onSave={staffEmployeeModal.department ? handleSaveDepartmentStaff : handleSaveStaffEmployee}
        onClose={() => setStaffEmployeeModal({ isOpen: false, rowIndex: null, unit: null, department: null, initialValue: '', initialEmployees: [] })}
      />

      {/* Deliverable File Upload Modal (3 options: Image, PDF, Excel) */}
      <PTMDeliverableUploadModal
        isOpen={deliverableModal.isOpen}
        rowIndex={deliverableModal.rowIndex}
        onClose={() => setDeliverableModal({ isOpen: false, rowIndex: null })}
        onUploadSuccess={(fileData) => {
          if (deliverableModal.rowIndex !== null) {
            handleDeliverableUploadSuccess(deliverableModal.rowIndex, fileData);
          }
        }}
      />

      {/* Table Footer: Total Rows */}
      <div className="bg-[#FAFBFD] border-t border-[#64748B] p-2 px-4 flex flex-wrap items-center justify-start gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-800">
            Total Rows: {rows.length} {filteredRows.length !== rows.length && `(Filtered: ${filteredRows.length})`}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 text-[11px]">
            Tip: Press <kbd className="px-1.5 py-0.5 bg-white border border-[#64748B] rounded font-mono font-bold text-slate-800">Enter</kbd> in any cell to advance downwards (auto-creates infinite rows at bottom).
          </span>
        </div>
      </div>
    </div>
  );
}
