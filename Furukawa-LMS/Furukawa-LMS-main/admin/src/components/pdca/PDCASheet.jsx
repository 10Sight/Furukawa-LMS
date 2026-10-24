import FormZoomControls from '@components/shared/FormZoomControls';
import React, { useState, useRef, useLayoutEffect, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Upload,
  Trash2,
  X,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Presentation,
  File,
  Download,
  Edit3,
  Check,
  User,
  Users,
  Image as ImageIcon,
  Images,
  AlertCircle,
  Mail,
  BarChart3,
  Lock
} from 'lucide-react';
import ImageEditorModal from './ImageEditorModal';
import FileUploadSelectionModal from './FileUploadSelectionModal';
import EvidenceViewerModal from './EvidenceViewerModal';
import AddStaffEmployeeModal from './AddStaffEmployeeModal';
import SendMailModal from '../common/SendMailModal';
import PDCAAlertModal from './PDCAAlertModal';
import PDCAMonthlyGraph from './PDCAMonthlyGraph';
import ResponsiblePersonInstructionCell from './ResponsiblePersonInstructionCell';
import { usePDCA } from '@hooks/pdca/usePDCA.js';
import pdcaApi from '@/services/api/pdcaApi.js';
import { PDCA_DEPARTMENTS, PDCA_UNITS, PDCA_STATUS_OPTIONS, normalizePDCAStatus, computePDCAStatus } from '../../pages/pdca/data/pdcaConstants.js';
import {
  isRecordCreator,
  isUserResponsibleForRow,
  isUserInResponsibleDepartment,
  isUserResponsibleForAnyRow,
  EDITABLE_RESPONSIBLE_COLUMNS
} from '../../pages/pdca/data/recordFilters.js';
import {
  parseStaffEmployee,
  findEmployeeDepartment,
  stripEmployeeId,
  VERIFIED_EMPLOYEE_MASTER
} from '../../pages/pdca/data/pdcaEmployees.js';
import SearchableLineAreaSelect, { getCachedDbSections } from './SearchableLineAreaSelect';
import { getDefaultSectionsWithLines } from './CascadingLineAreaSelect.jsx';
import SearchableSectionSelect, { VERIFIED_SECTION_MASTER, isSectionRelatedToDepartment } from './SearchableSectionSelect';
import { getMediaUrl } from '@/utils/mediaUtils.js';

function CheckboxMultiSelect({ value = [], options = [], onChange, disabled = false, placeholder }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const selected = Array.isArray(value) ? value.map(String) : (value ? [String(value)] : []);
  const label = selected.length
    ? selected.map(item => options.find(option => String(option.value) === item)?.label || item).join(', ')
    : placeholder;
  const updateMenuPosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportPadding = 8;
    const width = Math.min(Math.max(rect.width, 176), window.innerWidth - viewportPadding * 2);
    const left = Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - width - viewportPadding));
    const expectedHeight = Math.min(208, Math.max(48, options.length * 32 + 12));
    const viewportHeight = Math.max(
      window.innerHeight || 0,
      document.documentElement.clientHeight || 0,
      window.visualViewport?.height || 0
    );
    const spaceBelow = viewportHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openAbove = spaceBelow < expectedHeight && spaceAbove >= expectedHeight;
    const maxHeight = Math.max(32, Math.min(208, openAbove ? spaceAbove : spaceBelow));
    const renderedHeight = Math.min(expectedHeight, maxHeight);
    const requestedTop = openAbove ? rect.top - renderedHeight - 4 : rect.bottom + 4;
    const top = Math.max(viewportPadding, Math.min(requestedTop, viewportHeight - renderedHeight - viewportPadding));
    setMenuPosition({ left, width, maxHeight, top });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const closeOnOutsideClick = event => {
      if (!buttonRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = event => { if (event.key === 'Escape') setOpen(false); };
    const closeOnScroll = () => setOpen(false);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', closeOnScroll, true);
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', closeOnScroll, true);
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, options.length]);
// that is the code of toodays cass 
  return (
    <div className="w-full min-w-0">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        title={label}
        className={`flex w-full min-h-[30px] items-center justify-between gap-1 rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight transition-colors ${selected.length ? 'border-blue-200 bg-blue-50/60 text-slate-800' : 'border-slate-200 bg-white text-slate-500'} ${open ? 'border-blue-400 ring-1 ring-blue-100' : 'hover:border-blue-300 hover:bg-blue-50/40'} disabled:cursor-default disabled:opacity-60`}
      >
        <span className="min-w-0 flex-1 truncate font-medium">{label || placeholder}</span>
        {selected.length > 1 && <span className="shrink-0 rounded-full bg-blue-100 px-1 py-0.2 text-[9px] font-semibold text-blue-700">({selected.length})</span>}
        <ChevronDown className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180 text-blue-600' : ''}`} />
      </button>
      {open && menuPosition && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-multiselectable="true"
          className="overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 text-left shadow-[0_12px_32px_rgba(15,23,42,0.2)] ring-1 ring-slate-900/5"
          style={{ position: 'fixed', zIndex: 10000, top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, maxHeight: menuPosition.maxHeight }}
        >
          {options.map(option => {
            const optionValue = String(option.value);
            const checked = selected.includes(optionValue);
            return <label key={optionValue} className={`flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${checked ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'}`}>
              <input className="h-3.5 w-3.5 shrink-0 accent-blue-600" type="checkbox" checked={checked} onChange={() => onChange(checked ? selected.filter(item => item !== optionValue) : [...selected, optionValue])} />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
            </label>;
          })}
          {options.length === 0 && <div className="px-2 py-2 text-[10px] text-slate-400">No options available</div>}
        </div>,
        document.body
      )}
    </div>
  );
}

export const DEFAULT_OBSERVATION_WIDTH = 260;
export const MIN_OBSERVATION_WIDTH = 180;
export const MAX_OBSERVATION_WIDTH = 650;

export const DEFAULT_ROOT_CAUSE_WIDTH = 135;
export const MIN_ROOT_CAUSE_WIDTH = 95;
export const MAX_ROOT_CAUSE_WIDTH = 550;

export const DEFAULT_ACTION_TAKEN_WIDTH = 135;
export const MIN_ACTION_TAKEN_WIDTH = 95;
export const MAX_ACTION_TAKEN_WIDTH = 550;

export const DEFAULT_COUNTER_MEASURE_WIDTH = 145;
export const MIN_COUNTER_MEASURE_WIDTH = 95;
export const MAX_COUNTER_MEASURE_WIDTH = 550;

const createEmptyRow = (customDefaults = {}) => ({
  date: customDefaults.date || '',
  shift: customDefaults.shift || '',
  status: customDefaults.status ? normalizePDCAStatus(customDefaults.status) : '',
  department: customDefaults.department || '',
  departments: Array.isArray(customDefaults.departments) ? customDefaults.departments : (customDefaults.department ? [customDefaults.department] : []),
  unit: customDefaults.unit || '',
  units: Array.isArray(customDefaults.units) ? customDefaults.units : (customDefaults.unit ? [customDefaults.unit] : []),
  section: customDefaults.section || '',
  sections: Array.isArray(customDefaults.sections) ? customDefaults.sections : (customDefaults.section ? [{ section: customDefaults.section, sectionId: customDefaults.sectionId ?? null, sectionCode: customDefaults.sectionCode || '' }] : []),
  sectionId: customDefaults.sectionId ?? customDefaults.lineAreaSectionId ?? null,
  sectionCode: customDefaults.sectionCode || '',
  lineArea: customDefaults.lineArea || '',
  lineAreas: Array.isArray(customDefaults.lineAreas) ? customDefaults.lineAreas : (customDefaults.lineArea ? [{ lineArea: customDefaults.lineArea, lineAreaId: customDefaults.lineAreaId ?? null, lineAreaCode: customDefaults.lineAreaCode || '', sectionId: customDefaults.lineAreaSectionId ?? customDefaults.sectionId ?? null }] : []),
  lineAreaSectionId: customDefaults.lineAreaSectionId ?? customDefaults.sectionId ?? null,
  lineAreaId: customDefaults.lineAreaId ?? null,
  lineAreaCode: customDefaults.lineAreaCode || '',
  observation: customDefaults.observation || '',
  imagesBefore: Array.isArray(customDefaults.imagesBefore)
    ? customDefaults.imagesBefore
    : (customDefaults.imageBefore ? [{ id: 'legacy-before-0', url: customDefaults.imageBefore, name: customDefaults.imageBeforeName || 'Before Image', type: customDefaults.fileTypeBefore || 'image' }] : []),
  imageBefore: customDefaults.imageBefore || null,
  imageBeforeName: customDefaults.imageBeforeName || '',
  fileTypeBefore: customDefaults.fileTypeBefore || 'image',
  rootCause: customDefaults.rootCause || '',
  actionTaken: customDefaults.actionTaken || '',
  counterMeasure: customDefaults.counterMeasure || '',
  imagesAfter: Array.isArray(customDefaults.imagesAfter)
    ? customDefaults.imagesAfter
    : (customDefaults.imageAfter ? [{ id: 'legacy-after-0', url: customDefaults.imageAfter, name: customDefaults.imageAfterName || 'After Image', type: customDefaults.fileTypeAfter || 'image' }] : []),
  imageAfter: customDefaults.imageAfter || null,
  imageAfterName: customDefaults.imageAfterName || '',
  fileTypeAfter: customDefaults.fileTypeAfter || 'image',
  stdDurationMin: customDefaults.stdDurationMin !== undefined ? customDefaults.stdDurationMin : (customDefaults.stdDuration !== undefined ? customDefaults.stdDuration : ''),
  initialResponseDate: customDefaults.initialResponseDate || customDefaults.responseDate || '',
  responseDate: customDefaults.responseDate || '',
  revisedDates: Array.isArray(customDefaults.revisedDates) ? customDefaults.revisedDates : [],
  noOfTimeRevised: customDefaults.noOfTimeRevised !== undefined ? customDefaults.noOfTimeRevised : 0,
  respUnit: customDefaults.respUnit || customDefaults.responsiblePersonUnit || '',
  respUnits: Array.isArray(customDefaults.respUnits) ? customDefaults.respUnits : (customDefaults.respUnit || customDefaults.responsiblePersonUnit ? [customDefaults.respUnit || customDefaults.responsiblePersonUnit] : []),
  responsiblePersonUnit: customDefaults.responsiblePersonUnit || customDefaults.respUnit || '',
  responsiblePersonDept: customDefaults.responsiblePersonDept || customDefaults.department || '',
  staffEmployee: customDefaults.staffEmployee || '',
  staffEmployees: Array.isArray(customDefaults.staffEmployees) ? customDefaults.staffEmployees : [],
  staffName: customDefaults.staffName || '',
  staffId: customDefaults.staffId || '',
  employeeId: customDefaults.employeeId || customDefaults.staffId || '',
  assignedEmployee: customDefaults.assignedEmployee || '',
  cftTopic: customDefaults.cftTopic || '',
  cftTopicId: customDefaults.cftTopicId || '',
  cftSelectedType: customDefaults.cftSelectedType || '',
  cftSelectedName: customDefaults.cftSelectedName || '',
  cftSelectedCode: customDefaults.cftSelectedCode || '',
  confirmation: customDefaults.confirmation || '',
  confirmedBy: customDefaults.confirmedBy || '',
  instruction: customDefaults.instruction || '',
  responsiblePersonConfirmation: customDefaults.responsiblePersonConfirmation || customDefaults.staffEmployee || ''
});

// Auto-expanding textarea that dynamically expands row height when lines are added (e.g. via Shift+Enter or text wrapping)
function AutoResizeTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  inputRef,
  minHeight = 44,
  readOnly = false,
}) {
  const localRef = useRef(null);

  const resize = () => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lines = (value || '').split('\n').length;
    const estimatedHeight = 16 + (lines * 18);
    const targetHeight = Math.max(minHeight, el.scrollHeight, estimatedHeight);
    el.style.height = `${targetHeight}px`;
  };

  useLayoutEffect(() => {
    resize();
  }, [value]);

  // Dynamically recompute height if column width changes (e.g. user drags Observation width handle)
  useLayoutEffect(() => {
    const el = localRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let prevWidth = el.offsetWidth;
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth !== prevWidth) {
        prevWidth = el.offsetWidth;
        resize();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <textarea
      ref={(el) => {
        localRef.current = el;
        if (typeof inputRef === 'function') {
          inputRef(el);
        } else if (inputRef) {
          inputRef.current = el;
        }
      }}
      rows={Math.max(2, (value || '').split('\n').length)}
      value={value}
      readOnly={readOnly}
      onChange={(e) => {
        if (readOnly) return;
        onChange(e);
        resize();
      }}
      onKeyDown={readOnly ? undefined : onKeyDown}
      placeholder={readOnly ? '' : placeholder}
      className={className}
      style={{
        overflow: 'hidden',
        resize: 'none',
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
      }}
    />
  );
}

// Auto-adjusting input for revision reason with dynamic width based on content
function AutoWidthInput({
  value = '',
  onChange,
  inputRef,
  required = false,
  dataRequiredActionAllowed = false,
  placeholder = 'Why revised...',
  readOnly = false,
  className = '',
  title = '',
  minChars = 8,
  maxChars = 40,
}) {
  const currentLen = (value || '').length;
  const placeholderLen = (placeholder || '').length;
  const chLen = Math.min(maxChars, Math.max(minChars, currentLen, placeholderLen));

  if (readOnly) {
    return (
      <span
        className="text-[10px] text-slate-700 italic px-1 py-0.5 truncate block max-w-full select-text text-center"
        title={title || value || '-'}
      >
        {value || '-'}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      title={title || value || placeholder}
      required={required}
      aria-required={required || undefined}
      data-required-action-allowed={dataRequiredActionAllowed ? 'true' : undefined}
      style={{
        fieldSizing: 'content',
        width: `${chLen + 2}ch`,
        maxWidth: '100%',
        minWidth: '65px',
      }}
      className={className}
    />
  );
}

// Format ISO date (YYYY-MM-DD) into display string (DD/MM/YY)
export const formatDisplayDate = (isoStr) => {
  if (!isoStr) return '';
  const parts = String(isoStr).split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year.slice(-2)}`;
  }
  return String(isoStr);
};

const hasValidStdDuration = (value) => {
  const normalized = String(value ?? '').replace(/\s*min$/i, '').trim();
  return normalized !== '' && Number.isFinite(Number(normalized)) && Number(normalized) >= 0;
};

// Compact Date Cell (Shows only calendar icon when empty; once date is selected, icon is removed and date is fully displayed without truncation)
function CompactDateCell({ value, onChange, readOnly = false, smallText = false }) {
  const inputRef = useRef(null);

  const handleOpenPicker = () => {
    if (readOnly) return;
    if (inputRef.current) {
      if (typeof inputRef.current.showPicker === 'function') {
        try {
          inputRef.current.showPicker();
          return;
        } catch (err) { }
      }
      inputRef.current.focus();
    }
  };

  const display = formatDisplayDate(value);

  if (readOnly) {
    return (
      <div className="relative w-full h-full min-h-[42px] flex items-center justify-center p-1 select-none whitespace-nowrap">
        <span className={`${smallText ? 'text-[12px]' : 'text-[15px]'} font-semibold text-slate-800 text-center tracking-tight whitespace-nowrap`}>
          {display || '-'}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={handleOpenPicker}
      className="relative w-full h-full min-h-[42px] flex items-center justify-center p-1 cursor-pointer hover:bg-blue-50/50 group transition-colors select-none"
      title={display ? `Date: ${display} (Click to change)` : 'Click to select date'}
    >
      {/* Underlying HTML5 Date Input */}
      <input
        ref={inputRef}
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          if (typeof e.target.showPicker === 'function') {
            try {
              e.target.showPicker();
            } catch (err) { }
          }
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        tabIndex={0}
      />

      {display ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="absolute right-0.5 top-0.5 pointer-events-auto z-20 opacity-0 group-hover:opacity-100 hover:opacity-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-0.5 transition-all rounded cursor-pointer shadow-2xs"
            title="Clear date"
          >
            <X className="w-2.5 h-2.5 stroke-[2.5]" />
          </button>
          <div className="w-full flex items-center justify-center text-center pointer-events-none px-0.5 whitespace-nowrap">
            <span className={`${smallText ? 'text-[12px]' : 'text-[15px]'} font-semibold text-slate-800 text-center tracking-tight whitespace-nowrap`}>
              {display}
            </span>
          </div>
        </>
      ) : (
        // When empty: Only calendar icon is shown, centered
        <div className="w-full flex items-center justify-center text-center pointer-events-none">
          <Calendar className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors mx-auto" />
        </div>
      )}
    </div>
  );
}

// Std. Duration in min cell with automatic 'min' suffix
function DurationMinCell({ value, readOnly, onChange, cellRef, requiredActionAllowed = false, hasResponseDate = true, onDisabledClick }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState('');

  const numStr = value !== undefined && value !== null ? String(value).replace(/[^0-9.]/g, '') : '';
  const displayVal = numStr ? `${numStr} min` : '';

  if (readOnly || !hasResponseDate) {
    return (
      <div
        ref={cellRef}
        onClick={() => {
          if (!hasResponseDate && typeof onDisabledClick === 'function') {
            onDisabledClick();
          }
        }}
        title={!hasResponseDate ? "Select Response Date first to enter duration (min)" : undefined}
        className={`w-full py-1 text-base text-center font-medium whitespace-nowrap ${!hasResponseDate ? 'cursor-not-allowed opacity-50 select-none' : ''}`}
      >
        <span className={`text-base font-medium whitespace-nowrap ${requiredActionAllowed ? 'text-red-700' : 'text-slate-800'}`}>
          {displayVal || '-'}
        </span>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div
        ref={cellRef}
        data-required-action-allowed={requiredActionAllowed ? 'true' : undefined}
        tabIndex={requiredActionAllowed ? 0 : undefined}
        className={`w-full rounded ${requiredActionAllowed ? 'border border-red-500 bg-red-50' : ''}`}
      >
        <input
          type="text"
          autoFocus
          aria-invalid={requiredActionAllowed ? 'true' : undefined}
          value={editVal}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9.]/g, '');
            setEditVal(cleaned);
            onChange(cleaned ? `${cleaned} min` : '');
          }}
          onBlur={() => {
            setIsEditing(false);
            const finalVal = editVal.trim();
            onChange(finalVal ? `${finalVal} min` : '');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setIsEditing(false);
              const finalVal = editVal.trim();
              onChange(finalVal ? `${finalVal} min` : '');
            }
          }}
          placeholder="0"
          className={`w-full rounded px-1 py-0.5 text-base text-center font-semibold outline-none ${requiredActionAllowed ? 'bg-red-50 border border-red-500 text-red-800 focus:border-red-600' : 'bg-white border border-blue-500 text-slate-800'}`}
        />
      </div>
    );
  }

  return (
    <div
      ref={cellRef}
      data-required-action-allowed={requiredActionAllowed ? 'true' : undefined}
      aria-invalid={requiredActionAllowed ? 'true' : undefined}
      tabIndex={requiredActionAllowed ? 0 : undefined}
      onClick={() => {
        setEditVal(numStr);
        setIsEditing(true);
      }}
      onKeyDown={(e) => {
        if (requiredActionAllowed && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          setEditVal(numStr);
          setIsEditing(true);
        }
      }}
      className={`w-full py-1 text-base text-center font-medium cursor-text rounded transition-colors whitespace-nowrap ${requiredActionAllowed ? 'border border-red-500 bg-red-50 text-red-700' : 'text-slate-800 hover:bg-blue-50/50'}`}
      title="Click to enter duration (min)"
    >
      {displayVal ? (
        <span className="font-semibold text-slate-800">{displayVal}</span>
      ) : (
        <span className={requiredActionAllowed ? 'text-red-500' : 'text-slate-300'}>-</span>
      )}
    </div>
  );
}




export default function PDCASheet({
  topic,
  onBack,
  onSave,
  currentDate,
  onDateChange,
  readOnly = false,
  isCreator: propIsCreator = undefined,
  currentUser = null,
  emailPdcaSheets = undefined
}) {
  const { data, setData, showToast, userContext } = usePDCA();
  const lpaSheetIdentity = [
    topic?.id,
    topic?.recordId,
    topic?.topic,
    topic?.sheet?.headerInfo?.topicName
  ].filter(Boolean).join(' ').toLowerCase();
  const lpaSheetTitle = String(topic?.topic || topic?.sheet?.headerInfo?.topicName || '').trim().toLowerCase();
  const isLpaObservationSheet = String(topic?.id || topic?.recordId || '').startsWith('PDCA-LPA') ||
    Boolean(topic?.lpaSource) ||
    /lpa\s*observation/.test(lpaSheetIdentity) ||
    ['assembly', 'c&c', 'c & c'].includes(lpaSheetTitle);
  const usesCheckboxMultiSelects = true;
  const effectiveUser = currentUser || userContext?.user;

  // Determine if the current user has Administrator privileges
  const isAdmin = useMemo(() => {
    const u = effectiveUser || userContext?.user;
    if (u) {
      if (
        u.isAdmin === true ||
        u.isAdmin === 1 ||
        String(u.role || '').toUpperCase() === 'ADMIN' ||
        String(u.role || '').toUpperCase() === 'SUPERADMIN'
      ) {
        return true;
      }
    }
    try {
      const stored = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null) ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed?.isAdmin === true ||
          parsed?.isAdmin === 1 ||
          String(parsed?.role || '').toUpperCase() === 'ADMIN' ||
          String(parsed?.role || '').toUpperCase() === 'SUPERADMIN'
        ) {
          return true;
        }
      }
    } catch { }
    return false;
  }, [effectiveUser, userContext?.user]);

  const isCreator = propIsCreator !== undefined
    ? Boolean(propIsCreator)
    : Boolean(topic?.id ? isRecordCreator(topic, effectiveUser) : true);
  const isCreatorOrAdmin = Boolean(isAdmin || !topic?.id || isCreator);
  const canEditEntireSheet = Boolean(!readOnly && isCreatorOrAdmin);
  const cftAssignedMembers = topic?.assignedMembers || [];
  const defaultAssignedStr = cftAssignedMembers.length > 0
    ? (cftAssignedMembers.length === 1
      ? `${cftAssignedMembers[0].name} (${cftAssignedMembers[0].code})`
      : cftAssignedMembers.map(e => `${e.name} (${e.code})`).join(', '))
    : '';

  // Dropdown state for CFT column (opened by clicking on row)
  const [openCFTDropdown, setOpenCFTDropdown] = useState(null); // { rowIndex, top, left, width }
  const [expandedTopicId, setExpandedTopicId] = useState(null); // Which topic accordion is expanded in the dropdown

  // Dropdown state for Staff column (search bar / dropdown)
  const [openStaffDropdown, setOpenStaffDropdown] = useState(null); // { rowIndex, top, left, width }
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // Database-backed employee master records
  const [dbEmployees, setDbEmployees] = useState(VERIFIED_EMPLOYEE_MASTER);

  // Fetch verified employee records from database via metadata API
  useEffect(() => {
    let active = true;
    pdcaApi.getMetadata().then(meta => {
      if (!active || !meta) return;
      if (Array.isArray(meta.employees) && meta.employees.length > 0) {
        setDbEmployees(meta.employees);
      }
    }).catch(err => {
      console.warn('Could not fetch employee metadata from database:', err);
    });
    return () => { active = false; };
  }, []);

  // Helper to ensure row has normalized imagesBefore and imagesAfter arrays
  const normalizeRow = (row) => {
    if (!row) return createEmptyRow();
    const isDocBefore = row.fileTypeBefore && ['pdf', 'excel', 'ppt', 'document'].includes(row.fileTypeBefore);
    const imagesBefore = Array.isArray(row.imagesBefore) && !isDocBefore
      ? row.imagesBefore
      : (!isDocBefore && row.imageBefore ? [{ id: 'legacy-before-0', url: row.imageBefore, name: row.imageBeforeName || 'Before Image', type: row.fileTypeBefore || 'image' }] : []);
    const isDocAfter = row.fileTypeAfter && ['pdf', 'excel', 'ppt', 'document'].includes(row.fileTypeAfter);
    const imagesAfter = Array.isArray(row.imagesAfter) && !isDocAfter
      ? row.imagesAfter
      : (!isDocAfter && row.imageAfter ? [{ id: 'legacy-after-0', url: row.imageAfter, name: row.imageAfterName || 'After Image', type: row.fileTypeAfter || 'image' }] : []);
    let staffEmployee = stripEmployeeId(row.staffEmployee || row.responsiblePersonConfirmation || '');
    let staffEmployees = Array.isArray(row.staffEmployees) ? row.staffEmployees : [];
    let staffId = (row.staffId || row.employeeId || '').trim();
    let staffName = stripEmployeeId(row.staffName || '');

    if (staffEmployees.length > 0) {
      staffEmployees = staffEmployees.map((emp) => {
        const p = parseStaffEmployee(emp.name ? (emp.code ? `${emp.name} (${emp.code})` : emp.name) : emp);
        const name = stripEmployeeId(emp.name || p.name || '');
        const code = (emp.code || emp.empId || p.code || '').toUpperCase();
        const dbDept = findEmployeeDepartment(`${name} (${code})`, dbEmployees) ||
          findEmployeeDepartment(`${name} (${code})`, VERIFIED_EMPLOYEE_MASTER);
        const department = dbDept || (emp.department && emp.department !== 'CFT' ? emp.department : '') || (row.department && row.department !== 'CFT' ? row.department : '');
        return {
          id: emp.id || undefined,
          name,
          code,
          department
        };
      });

      if (!staffEmployee) {
        staffEmployee = staffEmployees
          .map((e) => stripEmployeeId(e.name || e.fullName))
          .join(', ');
      }
      if (!staffName) staffName = staffEmployees[0].name || staffEmployees[0].fullName || '';
      if (!staffId) staffId = staffEmployees[0].code || staffEmployees[0].empId || '';
    } else if (staffEmployee) {
      const parts = staffEmployee.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      staffEmployees = parts.map((part) => {
        const { name, code } = parseStaffEmployee(part);
        const cleanName = stripEmployeeId(name);
        const dbDept = findEmployeeDepartment(part, dbEmployees) ||
          findEmployeeDepartment(part, VERIFIED_EMPLOYEE_MASTER);
        const dept = dbDept || (row.department && row.department !== 'CFT' ? row.department : '');
        return { name: cleanName, code, department: dept };
      });
      if (!staffName || !staffId) {
        const primary = parseStaffEmployee(staffEmployee);
        if (!staffName) staffName = stripEmployeeId(primary.name || '');
        if (!staffId) staffId = primary.code || '';
      }
    } else if (staffName) {
      const dbDept = findEmployeeDepartment(`${staffName} (${staffId})`, dbEmployees) ||
        findEmployeeDepartment(`${staffName} (${staffId})`, VERIFIED_EMPLOYEE_MASTER);
      const dept = dbDept || (row.department && row.department !== 'CFT' ? row.department : '');
      staffEmployee = stripEmployeeId(staffName);
      staffEmployees = [{ name: staffName, code: staffId, department: dept }];
    }

    const departments = Array.isArray(row.departments) && row.departments.length > 0
      ? row.departments
      : (row.department ? [row.department] : []);
    const department = departments[0] || row.department || '';

    const section = row.section || '';
    const sectionId = row.sectionId ?? row.lineAreaSectionId ?? null;
    const sectionCode = row.sectionCode || '';
    const sections = Array.isArray(row.sections) && row.sections.length > 0
      ? row.sections
      : (section ? [{ section, sectionId, sectionCode }] : []);

    const lineArea = row.lineArea || '';
    const lineAreaId = row.lineAreaId ?? null;
    const lineAreaCode = row.lineAreaCode || '';
    const lineAreaSectionId = row.lineAreaSectionId ?? sectionId;
    const lineAreas = Array.isArray(row.lineAreas) && row.lineAreas.length > 0
      ? row.lineAreas
      : (lineArea ? [{ lineArea, lineAreaId, lineAreaCode, sectionId: lineAreaSectionId }] : []);

    const responseDate = row.responseDate || '';
    let normalizedRevisedDates = [];
    if (Array.isArray(row.revisedDates) && row.revisedDates.length > 0) {
      if (row.revisedDates.length === 1 && typeof row.revisedDates[0] === 'string' && row.revisedDates[0] === responseDate) {
        normalizedRevisedDates = [];
      } else {
        normalizedRevisedDates = row.revisedDates.map((item) => {
          if (typeof item === 'string') return { date: item, reason: '', previousDate: '' };
          return { date: item?.date || '', reason: item?.reason || '', previousDate: item?.previousDate || '' };
        }).filter((r) => r.date);
      }
    }

    const resolvedDbDept = staffEmployees[0]?.department || (staffEmployee ? (findEmployeeDepartment(staffEmployee, dbEmployees) || findEmployeeDepartment(staffEmployee, VERIFIED_EMPLOYEE_MASTER)) : '') || '';
    const responsiblePersonDept = (row.responsiblePersonDept && row.responsiblePersonDept !== 'CFT')
      ? row.responsiblePersonDept
      : (resolvedDbDept !== 'CFT' ? resolvedDbDept : '');

    // Confirmation & Status conditional synchronization
    let confirmation = (row.confirmation || '').trim();
    if (!confirmation && (row.responsiblePersonConfirmation === 'Confirmed' || row.responsiblePersonConfirmation === 'Not - Confirmed' || row.responsiblePersonConfirmation === 'Not-Confirmed')) {
      confirmation = row.responsiblePersonConfirmation.trim();
    }
    if (confirmation === 'Not-Confirmed') confirmation = 'Not - Confirmed';
    const confirmedBy = (row.confirmedBy || '').trim();
    const instruction = (row.instruction || '').trim();

    let status = row.status ? computePDCAStatus({
      ...row,
      responseDate,
      confirmation,
      status: row.status
    }, currentDate) : '';

    // Section P Unit
    const units = usesCheckboxMultiSelects
      ? (Array.isArray(row.units) && row.units.length ? [...new Set(row.units.map(String).filter(Boolean))] : (row.unit ? [row.unit] : []))
      : (row.unit ? [row.unit] : []);
    const unit = units[0] || '';
    const stdDurationMin = (row.stdDurationMin !== undefined && row.stdDurationMin !== null)
      ? row.stdDurationMin
      : (row.stdDuration !== undefined && row.stdDuration !== null ? row.stdDuration : '');
    const noOfTimeRevised = normalizedRevisedDates.length;
    const respUnit = (row.respUnit === 'Bawal' || row.respUnit === 'Gujrat')
      ? row.respUnit
      : (row.responsiblePersonUnit || row.respUnit || '');
    const respUnits = usesCheckboxMultiSelects
      ? (Array.isArray(row.respUnits) && row.respUnits.length ? [...new Set(row.respUnits.map(String).filter(Boolean))] : (respUnit ? [respUnit] : []))
      : (respUnit ? [respUnit] : []);

    return {
      ...row,
      initialResponseDate: row.initialResponseDate || responseDate || '',
      department,
      departments,
      unit,
      units,
      stdDurationMin,
      responseDate,
      revisedDates: normalizedRevisedDates,
      noOfTimeRevised,
      respUnit,
      respUnits,
      responsiblePersonUnit: respUnit,
      confirmation,
      confirmedBy,
      instruction,
      status,
      section: sections[0]?.section || section,
      sectionId: sections[0]?.sectionId ?? sectionId,
      sectionCode: sections[0]?.sectionCode || sectionCode,
      sections,
      lineArea: lineAreas[0]?.lineArea || lineArea,
      lineAreaId: lineAreas[0]?.lineAreaId ?? lineAreaId,
      lineAreaCode: lineAreas[0]?.lineAreaCode || lineAreaCode,
      lineAreaSectionId: lineAreas[0]?.sectionId ?? lineAreaSectionId,
      lineAreas,
      responsiblePersonDept,
      imagesBefore,
      imagesAfter,
      imageBefore: isDocBefore ? row.imageBefore : (imagesBefore[0]?.url || row.imageBefore || null),
      imageBeforeName: isDocBefore ? row.imageBeforeName : (imagesBefore[0]?.name || row.imageBeforeName || ''),
      fileTypeBefore: row.fileTypeBefore || (imagesBefore.length > 0 ? 'image' : ''),
      imageAfter: isDocAfter ? row.imageAfter : (imagesAfter[0]?.url || row.imageAfter || null),
      imageAfterName: isDocAfter ? row.imageAfterName : (imagesAfter[0]?.name || row.imageAfterName || ''),
      fileTypeAfter: row.fileTypeAfter || (imagesAfter.length > 0 ? 'image' : ''),
      actionTaken: row.actionTaken || '',
      staffEmployee,
      staffEmployees,
      staffName,
      staffId,
      employeeId: staffId,
      responsiblePersonConfirmation: confirmation || row.responsiblePersonConfirmation || staffEmployee || ''
    };
  };

  // Serialize sheet state helper for deep equality comparison
  const serializeSheet = (r, h) => {
    try {
      return JSON.stringify({ rows: r, headerInfo: h });
    } catch {
      return '';
    }
  };

  const initialRows = useMemo(() => {
    if (Array.isArray(topic?.sheet?.rows) && topic.sheet.rows.length > 0) {
      return topic.sheet.rows.map(normalizeRow);
    }
    return Array.from({ length: 10 }, () => createEmptyRow());
  }, []);

  const initialHeaderInfo = useMemo(() => {
    const raw = topic?.sheet?.headerInfo || {};
    const fallback = topic?.topic || (topic?.section === 'cc' ? 'C&C - LPA Observation (PDCA)' : 'Assembly - LPA Observation (PDCA)');
    return {
      topicName: raw.topicName && raw.topicName !== 'PDCA - M Tanaka San Audit' ? raw.topicName : fallback,
      preparedBy: stripEmployeeId(raw.preparedBy || ''),
      auditNo: raw.auditNo || '',
      attendees: raw.attendees || ''
    };
  }, [topic?.sheet?.headerInfo, topic?.topic, topic?.section]);

  // Initialize rows with 10 empty items by default
  const [rows, setRows] = useState(initialRows);

  const hasAnyRowResponsible = useMemo(() => isUserResponsibleForAnyRow(rows, effectiveUser), [rows, effectiveUser]);
  const hasEditAccess = Boolean(!readOnly && (isCreatorOrAdmin || hasAnyRowResponsible));
  const effectiveReadOnly = Boolean(readOnly || !hasEditAccess);
  const missingRequiredInputs = rows.flatMap((row, rowIndex) => {
    const missing = [];
    if (['Not - Confirmed', 'Not-Confirmed'].includes((row.confirmation || '').trim()) && !row.instruction?.trim()) {
      missing.push({ type: 'confirmation', rowIndex, key: `confirmation:${rowIndex}` });
    }
    if (row.responseDate?.trim() && !hasValidStdDuration(row.stdDurationMin ?? row.stdDuration)) {
      missing.push({ type: 'duration', rowIndex, key: `duration:${rowIndex}` });
    }
    (Array.isArray(row.revisedDates) ? row.revisedDates : []).forEach((item, revisionIndex) => {
      const reason = typeof item === 'object' && item !== null ? (item.reason || '') : '';
      if (!reason.trim()) missing.push({ type: 'revision', rowIndex, revisionIndex, key: `revision:${rowIndex}:${revisionIndex}` });
    });
    return missing;
  });
  const mustCompleteRequiredInput = missingRequiredInputs.length > 0;
  const requiredInputKey = missingRequiredInputs.map((item) => item.key).join('|');

  const [activePreviewImage, setActivePreviewImage] = useState(null);
  const [selectedImageAction, setSelectedImageAction] = useState(null);
  const [sheetSearch, setSheetSearch] = useState('');

  // Evidence Viewer Modal state (Multiple Images for Before / After): { isOpen, rowIndex, field }
  const [evidenceModal, setEvidenceModal] = useState({
    isOpen: false,
    rowIndex: null,
    field: null
  });

  // Editable Sheet Header Details: Topic name, Prepared By, Audit No, Attendees (kept empty by default for manual entry)
  const [headerInfo, setHeaderInfo] = useState(initialHeaderInfo);

  const [isSaving, setIsSaving] = useState(false);

  // Form-level calendar date (defaulting to topic date or today)
  const [formDate, setFormDate] = useState(() => {
    if (currentDate) return currentDate;
    if (topic?.date) {
      const d = new Date(topic.date);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
    return new Date().toISOString().split('T')[0];
  });

  // Baseline snapshot ref to detect unsaved edits during the current editing session
  const initialSnapshotRef = useRef(serializeSheet(initialRows, initialHeaderInfo));
  const initialStateRef = useRef({
    rows: initialRows.map((r) => ({ ...r })),
    headerInfo: { ...initialHeaderInfo }
  });
  const responsibleConfirmationReasonRefs = useRef({});
  const responsibleConfirmationSelectRefs = useRef({});
  const revisionReasonRefs = useRef({});
  const revisionDeleteRefs = useRef({});
  const durationCellRefs = useRef({});
  const lastAllowedUrlRef = useRef(typeof window !== 'undefined' ? window.location.href : '');
  const lastRequiredNoticeAtRef = useRef(0);
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const requiredInputMessage = (requiredInput) => requiredInput.type === 'confirmation'
    ? `Complete the Responsible Person Confirmation reason in row ${requiredInput.rowIndex + 1} before continuing.`
    : requiredInput.type === 'duration'
      ? `Enter a valid Std. Duration in min for row ${requiredInput.rowIndex + 1} before continuing.`
      : `Enter a reason for revision ${requiredInput.revisionIndex + 1} in row ${requiredInput.rowIndex + 1} before continuing.`;
  const requiredInputElement = (requiredInput) => requiredInput.type === 'confirmation'
    ? responsibleConfirmationReasonRefs.current[requiredInput.rowIndex]
    : requiredInput.type === 'duration'
      ? durationCellRefs.current[requiredInput.rowIndex]
      : revisionReasonRefs.current[`${requiredInput.rowIndex}:${requiredInput.revisionIndex}`];
  const requiredInputAllowedElements = (requiredInput) => requiredInput.type === 'confirmation'
    ? [responsibleConfirmationReasonRefs.current[requiredInput.rowIndex], responsibleConfirmationSelectRefs.current[requiredInput.rowIndex]]
    : requiredInput.type === 'duration'
      ? [durationCellRefs.current[requiredInput.rowIndex]]
      : [
        revisionReasonRefs.current[`${requiredInput.rowIndex}:${requiredInput.revisionIndex}`],
        revisionDeleteRefs.current[`${requiredInput.rowIndex}:${requiredInput.revisionIndex}`]
      ];
  const requireConfirmationReasonBeforeContinuing = () => {
    const requiredInput = missingRequiredInputs[0];
    if (!requiredInput) return false;
    const message = requiredInputMessage(requiredInput);
    const input = requiredInputElement(requiredInput);
    input?.focus();
    input?.reportValidity();
    showToastRef.current?.(message);
    return true;
  };
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isSendMailOpen, setIsSendMailOpen] = useState(false);
  const [showMonthlyGraph, setShowMonthlyGraph] = useState(false);
  const [showDoneRows, setShowDoneRows] = useState(false);
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    type: 'mandatory', // 'mandatory' | 'unsaved-changes' | 'send-mail-warning' | 'warning'
    title: '',
    message: '',
    rowNumber: null,
    missingFields: [],
    confirmText: '',
    cancelText: '',
    onConfirm: null
  });

  useEffect(() => {
    if (!mustCompleteRequiredInput || typeof document === 'undefined') return undefined;

    const allowedInputs = new Set(missingRequiredInputs.flatMap(requiredInputAllowedElements).filter(Boolean));
    lastAllowedUrlRef.current = window.location.href;
    const firstRequiredInput = missingRequiredInputs[0];
    const message = requiredInputMessage(firstRequiredInput);
    requiredInputElement(firstRequiredInput)?.focus();
    showToastRef.current?.(message);

    const isReasonInput = (target) => target instanceof Element && Boolean(target.closest('[data-required-action-allowed="true"]'));
    const notifyAndFocus = () => {
      const now = Date.now();
      if (now - lastRequiredNoticeAtRef.current > 800) {
        showToastRef.current?.(message);
        lastRequiredNoticeAtRef.current = now;
      }
      const currentInput = requiredInputElement(missingRequiredInputs[0]);
      currentInput?.focus();
      currentInput?.reportValidity();
    };
    const blockOutsideReason = (event) => {
      if (isReasonInput(event.target) && allowedInputs.has(event.target.closest('[data-required-action-allowed="true"]'))) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      notifyAndFocus();
    };
    const blockKeyboardOutsideReason = (event) => {
      const navigationKey = event.key === 'Tab' || event.key === 'Escape' || event.altKey ||
        ((event.ctrlKey || event.metaKey) && ['r', 'w', 'l'].includes(event.key.toLowerCase()));
      if (isReasonInput(event.target) && !navigationKey) return;
      blockOutsideReason(event);
    };
    const restoreLocation = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      window.history.pushState({ ...(window.history.state || {}), requiredConfirmationGate: true }, '', lastAllowedUrlRef.current);
      notifyAndFocus();
    };
    const warnBeforeLeaving = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    document.addEventListener('pointerdown', blockOutsideReason, true);
    document.addEventListener('click', blockOutsideReason, true);
    document.addEventListener('keydown', blockKeyboardOutsideReason, true);
    document.addEventListener('focusin', blockOutsideReason, true);
    document.addEventListener('submit', blockOutsideReason, true);
    window.addEventListener('popstate', restoreLocation, true);
    window.addEventListener('hashchange', restoreLocation, true);
    window.addEventListener('beforeunload', warnBeforeLeaving);

    return () => {
      document.removeEventListener('pointerdown', blockOutsideReason, true);
      document.removeEventListener('click', blockOutsideReason, true);
      document.removeEventListener('keydown', blockKeyboardOutsideReason, true);
      document.removeEventListener('focusin', blockOutsideReason, true);
      document.removeEventListener('submit', blockOutsideReason, true);
      window.removeEventListener('popstate', restoreLocation, true);
      window.removeEventListener('hashchange', restoreLocation, true);
      window.removeEventListener('beforeunload', warnBeforeLeaving);
    };
  }, [mustCompleteRequiredInput, requiredInputKey]);

  // Observation Column Resizable Width (default 260px, min 180px, max 650px, persisted in localStorage)
  const [observationWidth, setObservationWidth] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('pdca_observation_col_width');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= MIN_OBSERVATION_WIDTH && parsed <= MAX_OBSERVATION_WIDTH) {
            return parsed;
          }
        }
      }
    } catch { }
    return DEFAULT_OBSERVATION_WIDTH;
  });

  const activeColResizeRef = useRef(null);

  const startColResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    activeColResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: observationWidth,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch { }
  };

  const continueColResize = (event) => {
    const active = activeColResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - active.startX;
    const newWidth = Math.min(
      MAX_OBSERVATION_WIDTH,
      Math.max(MIN_OBSERVATION_WIDTH, active.startWidth + deltaX)
    );
    setObservationWidth(newWidth);
  };

  const finishColResize = (event) => {
    const active = activeColResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { }
    activeColResizeRef.current = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('pdca_observation_col_width', String(observationWidth));
      }
    } catch { }
  };

  const handleResizeKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setObservationWidth((prev) => Math.max(MIN_OBSERVATION_WIDTH, prev - 15));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setObservationWidth((prev) => Math.min(MAX_OBSERVATION_WIDTH, prev + 15));
    }
  };

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('pdca_observation_col_width', String(observationWidth));
      }
    } catch { }
  }, [observationWidth]);

  // Root Cause Column Resizable Width (default 135px, min 95px, max 550px, persisted in localStorage)
  const [rootCauseWidth, setRootCauseWidth] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('pdca_root_cause_col_width');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= MIN_ROOT_CAUSE_WIDTH && parsed <= MAX_ROOT_CAUSE_WIDTH) {
            return parsed;
          }
        }
      }
    } catch { }
    return DEFAULT_ROOT_CAUSE_WIDTH;
  });

  const activeRootCauseResizeRef = useRef(null);

  const startRootCauseResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    activeRootCauseResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: rootCauseWidth,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch { }
  };

  const continueRootCauseResize = (event) => {
    const active = activeRootCauseResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - active.startX;
    const newWidth = Math.min(
      MAX_ROOT_CAUSE_WIDTH,
      Math.max(MIN_ROOT_CAUSE_WIDTH, active.startWidth + deltaX)
    );
    setRootCauseWidth(newWidth);
  };

  const finishRootCauseResize = (event) => {
    const active = activeRootCauseResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { }
    activeRootCauseResizeRef.current = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('pdca_root_cause_col_width', String(rootCauseWidth));
      }
    } catch { }
  };

  const handleRootCauseResizeKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setRootCauseWidth((prev) => Math.max(MIN_ROOT_CAUSE_WIDTH, prev - 15));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setRootCauseWidth((prev) => Math.min(MAX_ROOT_CAUSE_WIDTH, prev + 15));
    }
  };

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('pdca_root_cause_col_width', String(rootCauseWidth));
      }
    } catch { }
  }, [rootCauseWidth]);

  // Action Taken Column Resizable Width (default 135px, min 95px, max 550px, persisted in localStorage)
  const [actionTakenWidth, setActionTakenWidth] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('pdca_action_taken_col_width');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= MIN_ACTION_TAKEN_WIDTH && parsed <= MAX_ACTION_TAKEN_WIDTH) {
            return parsed;
          }
        }
      }
    } catch { }
    return DEFAULT_ACTION_TAKEN_WIDTH;
  });

  const activeActionTakenResizeRef = useRef(null);

  const startActionTakenResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    activeActionTakenResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: actionTakenWidth,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch { }
  };

  const continueActionTakenResize = (event) => {
    const active = activeActionTakenResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - active.startX;
    const newWidth = Math.min(
      MAX_ACTION_TAKEN_WIDTH,
      Math.max(MIN_ACTION_TAKEN_WIDTH, active.startWidth + deltaX)
    );
    setActionTakenWidth(newWidth);
  };

  const finishActionTakenResize = (event) => {
    const active = activeActionTakenResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { }
    activeActionTakenResizeRef.current = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('pdca_action_taken_col_width', String(actionTakenWidth));
      }
    } catch { }
  };

  const handleActionTakenResizeKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setActionTakenWidth((prev) => Math.max(MIN_ACTION_TAKEN_WIDTH, prev - 15));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setActionTakenWidth((prev) => Math.min(MAX_ACTION_TAKEN_WIDTH, prev + 15));
    }
  };

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('pdca_action_taken_col_width', String(actionTakenWidth));
      }
    } catch { }
  }, [actionTakenWidth]);

  // Counter Measure Column Resizable Width (default 145px, min 95px, max 550px, persisted in localStorage)
  const [counterMeasureWidth, setCounterMeasureWidth] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('pdca_counter_measure_col_width');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= MIN_COUNTER_MEASURE_WIDTH && parsed <= MAX_COUNTER_MEASURE_WIDTH) {
            return parsed;
          }
        }
      }
    } catch { }
    return DEFAULT_COUNTER_MEASURE_WIDTH;
  });

  const activeCounterMeasureResizeRef = useRef(null);

  const startCounterMeasureResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    activeCounterMeasureResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: counterMeasureWidth,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch { }
  };

  const continueCounterMeasureResize = (event) => {
    const active = activeCounterMeasureResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - active.startX;
    const newWidth = Math.min(
      MAX_COUNTER_MEASURE_WIDTH,
      Math.max(MIN_COUNTER_MEASURE_WIDTH, active.startWidth + deltaX)
    );
    setCounterMeasureWidth(newWidth);
  };

  const finishCounterMeasureResize = (event) => {
    const active = activeCounterMeasureResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { }
    activeCounterMeasureResizeRef.current = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('pdca_counter_measure_col_width', String(counterMeasureWidth));
      }
    } catch { }
  };

  const handleCounterMeasureResizeKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setCounterMeasureWidth((prev) => Math.max(MIN_COUNTER_MEASURE_WIDTH, prev - 15));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setCounterMeasureWidth((prev) => Math.min(MAX_COUNTER_MEASURE_WIDTH, prev + 15));
    }
  };

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('pdca_counter_measure_col_width', String(counterMeasureWidth));
      }
    } catch { }
  }, [counterMeasureWidth]);

  // Load saved sheet from backend on mount or when topic changes
  useEffect(() => {
    if (!topic?.id) return;
    let active = true;
    pdcaApi.getSheet(topic.id).then(savedSheet => {
      if (!active || !savedSheet) return;
      let finalHeader = headerInfo;
      if (savedSheet.headerInfo && Object.keys(savedSheet.headerInfo).length > 0) {
        const loadedTopicName = savedSheet.headerInfo.topicName;
        const normalizedTopicName = (!loadedTopicName || loadedTopicName === 'PDCA - M Tanaka San Audit')
          ? (topic?.topic || (topic?.section === 'cc' ? 'C&C - LPA Observation (PDCA)' : 'Assembly - LPA Observation (PDCA)'))
          : loadedTopicName;
        finalHeader = { ...headerInfo, ...savedSheet.headerInfo, topicName: normalizedTopicName };
        setHeaderInfo(finalHeader);
      }
      let finalRows = rows;
      if (Array.isArray(savedSheet.rows) && savedSheet.rows.length > 0) {
        finalRows = savedSheet.rows.map(normalizeRow);
        setRows(finalRows);
      } else {
        finalRows = Array.isArray(rows) && rows.length > 0 ? rows.map(normalizeRow) : Array.from({ length: 10 }, () => createEmptyRow());
        setRows(finalRows);
      }
      // Update baseline after successful backend load
      initialStateRef.current = {
        rows: finalRows.map((r) => ({ ...r })),
        headerInfo: { ...finalHeader }
      };
      initialSnapshotRef.current = serializeSheet(finalRows, finalHeader);
    }).catch(err => {
      console.warn('Could not fetch sheet from backend:', err);
    });
    return () => { active = false; };
  }, [topic?.id]);

  const sheetSnapshot = useMemo(() => ({ rows, headerInfo }), [rows, headerInfo]);
  const persistSheet = (sheet) => {
    if (onSave) {
      try { onSave(sheet); } catch (e) { console.error(e); }
    }
    if (topic?.id) {
      setData(items => {
        if (!items || !items.some(item => item.id === topic.id)) {
          return [{ ...topic, sheet }, ...(items || [])];
        }
        return items.map(item => item.id === topic.id ? { ...item, sheet } : item);
      });
    }
  };

  const saveSheet = async () => {
    if (effectiveReadOnly) {
      showToast('You are in view-only mode. Only the record creator or assigned responsible staff can save changes.');
      return false;
    }
    if (isSaving) return false;
    if (requireConfirmationReasonBeforeContinuing()) return false;
    // Validate mandatory fields (Date, Shift, Status, Line/Area, Observation) for active rows
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const notConfirmed = ['Not - Confirmed', 'Not-Confirmed'].includes((r.confirmation || '').trim());
      if (notConfirmed && !r.instruction?.trim()) {
        const reasonInput = responsibleConfirmationReasonRefs.current[i];
        reasonInput?.focus();
        reasonInput?.reportValidity();
        showToast(`Row ${i + 1}: Please enter the required Responsible Person Confirmation reason.`);
        return false;
      }
      if (r.responseDate?.trim() && !hasValidStdDuration(r.stdDurationMin ?? r.stdDuration)) {
        durationCellRefs.current[i]?.focus();
        showToast(`Row ${i + 1}: Enter a valid Std. Duration in min when Response Date is filled.`);
        return false;
      }
      if (Array.isArray(r.revisedDates)) {
        for (let revisionIndex = 0; revisionIndex < r.revisedDates.length; revisionIndex++) {
          const revision = r.revisedDates[revisionIndex];
          const reason = typeof revision === 'object' && revision !== null ? (revision.reason || '') : '';
          if (!reason.trim()) {
            const reasonInput = revisionReasonRefs.current[`${i}:${revisionIndex}`];
            reasonInput?.focus();
            reasonInput?.reportValidity();
            showToast(`Row ${i + 1}: Please enter a reason for revision ${revisionIndex + 1}.`);
            return false;
          }
        }
      }
      if (Array.isArray(r.revisedDates) && r.revisedDates.length > 0 && !r.responseDate?.trim()) {
        showToast(`Row ${i + 1}: Response Date is required when revisions exist.`);
        return false;
      }
      const hasContent = Boolean(
        r.date?.trim() ||
        r.shift?.trim() ||
        r.lineArea?.trim() ||
        (Array.isArray(r.lineAreas) && r.lineAreas.some(l => l?.lineArea?.trim())) ||
        r.observation?.trim() ||
        r.imageBefore ||
        (Array.isArray(r.imagesBefore) && r.imagesBefore.length > 0) ||
        r.rootCause?.trim() ||
        r.actionTaken?.trim() ||
        r.counterMeasure?.trim() ||
        r.imageAfter ||
        (Array.isArray(r.imagesAfter) && r.imagesAfter.length > 0) ||
        r.responseDate?.trim() ||
        r.unit?.trim() ||
        (r.respUnit || r.responsiblePersonUnit || '').trim() ||
        r.department?.trim() ||
        (Array.isArray(r.departments) && r.departments.some(d => d?.trim())) ||
        (Array.isArray(r.sections) && r.sections.some(s => s?.section?.trim())) ||
        r.staffEmployee?.trim() ||
        r.staffName?.trim() ||
        r.cftTopic?.trim() ||
        r.responsiblePersonConfirmation?.trim()
      );
      if (hasContent) {
        const hasPrimaryDepartment = Boolean(
          r.department?.trim() || (Array.isArray(r.departments) && r.departments.some(d => d?.trim()))
        );
        const hasResponsibleDepartmentWithoutUnit = Boolean(
          ((r.responsiblePersonDept && r.responsiblePersonDept !== 'CFT') && !['Bawal', 'Gujrat'].includes(r.respUnit || r.responsiblePersonUnit)) ||
          (Array.isArray(r.staffEmployees) && r.staffEmployees.some(emp =>
            emp.department && emp.department !== 'CFT' && !['Bawal', 'Gujrat'].includes(emp.unit || r.respUnit || r.responsiblePersonUnit)
          ))
        );
        if (hasPrimaryDepartment && !['Bawal', 'Gujrat'].includes(r.unit)) {
          showToast(`Row ${i + 1}: Select a Unit before selecting the Department.`);
          return false;
        }
        if (hasResponsibleDepartmentWithoutUnit) {
          showToast(`Row ${i + 1}: Select the Responsible Confirmation Unit before selecting its Department.`);
          return false;
        }
        const missing = [];
        if (!r.date?.trim()) missing.push('Date');
        if (!r.shift?.trim()) missing.push('Shift');
        if (!r.status?.trim()) missing.push('Status');
        const unitVal = (r.unit || (Array.isArray(r.units) && r.units[0]) || '').trim();
        if (!unitVal) missing.push('Unit');
        const deptVal = (r.department || (Array.isArray(r.departments) && r.departments[0]) || '').trim();
        if (!deptVal) missing.push('Department');
        if (!r.observation?.trim()) missing.push('Observation');
        const staffVal = (r.staffName || r.staffEmployee || (Array.isArray(r.staffEmployees) && (r.staffEmployees[0]?.name || r.staffEmployees[0]?.fullName)) || '').trim();
        if (!staffVal) missing.push('Staff name');

        if (missing.length > 0) {
          setAlertModal({
            isOpen: true,
            type: 'mandatory',
            title: 'Mandatory Columns Required',
            rowNumber: i + 1,
            missingFields: missing,
            message: `Row ${i + 1} has missing mandatory columns. The sheet cannot be saved until all required fields are filled.`,
            confirmText: "I'll fill them"
          });
          showToast(`Row ${i + 1}: Mandatory column${missing.length > 1 ? 's' : ''} (${missing.join(', ')}) required.`);
          return false;
        }
      }
    }

    try {
      setIsSaving(true);
      const targetId = topic?.id || topic?.recordId || (headerInfo.topicName?.trim() ? encodeURIComponent(headerInfo.topicName.trim()) : 'current_topic');
      if (targetId) {
        await pdcaApi.saveSheet(targetId, sheetSnapshot);
      }
      persistSheet(sheetSnapshot);
      // Update baseline after successful save so subsequent navigation knows all edits are saved
      initialStateRef.current = {
        rows: rows.map((r) => ({ ...r })),
        headerInfo: { ...headerInfo }
      };
      initialSnapshotRef.current = serializeSheet(rows, headerInfo);
      showToast('PDCA is saved successfully');
      onSave?.(sheetSnapshot);
      return true;
    } catch (error) {
      persistSheet(sheetSnapshot);
      showToast(error.message || 'Could not save PDCA. Keep the form open and try again.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportToExcel = async () => {
    if (requireConfirmationReasonBeforeContinuing()) return;
    try {
      showToast('Generating complete Excel workbook with images...');
      const { exportPDCASheetToExcel } = await import('../../pages/pdca/data/pdcaExcelExport.js');
      await exportPDCASheetToExcel({
        topic,
        sheet: {
          rows,
          headerInfo
        }
      });
      showToast('✓ Complete PDCA sheet exported to Excel');
    } catch (err) {
      console.error('Failed to export PDCA sheet to Excel:', err);
      showToast('Export failed. Please try again.');
    }
  };

  // Determine if user has made unsaved changes in the current editing session
  const hasUnsavedChanges = () => {
    if (effectiveReadOnly) return false;
    if (!initialSnapshotRef.current) return false;
    return serializeSheet(rows, headerInfo) !== initialSnapshotRef.current;
  };

  // Navigation Back: Prompt if unsaved changes exist
  const handleBack = () => {
    if (requireConfirmationReasonBeforeContinuing()) return;
    if (hasUnsavedChanges()) {
      setAlertModal({
        isOpen: true,
        type: 'unsaved-changes',
        title: 'Unsaved Changes',
        message: 'Changes are not saved yet. Are you sure you want to go back? Unsaved edits will be lost.',
        confirmText: 'Discard & Go Back',
        cancelText: 'Stay & Keep Editing',
        onConfirm: () => handleDiscardAndGoBack()
      });
    } else {
      onBack?.();
    }
  };

  // Send Mail handler: Block if unsaved changes or missing mandatory fields
  const handleSendMailClick = () => {
    if (hasUnsavedChanges()) {
      setAlertModal({
        isOpen: true,
        type: 'send-mail-warning',
        title: 'Save Sheet Before Sending Mail',
        message: 'You have unsaved changes in this sheet. Please save the sheet before sending email.',
        confirmText: 'Understood'
      });
      showToast('Please save changes before sending mail.');
      return;
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const hasContent = Boolean(
        r.date?.trim() ||
        r.shift?.trim() ||
        r.lineArea?.trim() ||
        (Array.isArray(r.lineAreas) && r.lineAreas.some(l => l?.lineArea?.trim())) ||
        r.observation?.trim() ||
        r.imageBefore ||
        (Array.isArray(r.imagesBefore) && r.imagesBefore.length > 0) ||
        r.rootCause?.trim() ||
        r.actionTaken?.trim() ||
        r.counterMeasure?.trim() ||
        r.imageAfter ||
        (Array.isArray(r.imagesAfter) && r.imagesAfter.length > 0) ||
        r.responseDate?.trim() ||
        r.unit?.trim() ||
        (r.respUnit || r.responsiblePersonUnit || '').trim() ||
        r.department?.trim() ||
        (Array.isArray(r.departments) && r.departments.some(d => d?.trim())) ||
        (Array.isArray(r.sections) && r.sections.some(s => s?.section?.trim())) ||
        r.staffEmployee?.trim() ||
        r.staffName?.trim() ||
        r.cftTopic?.trim() ||
        r.responsiblePersonConfirmation?.trim()
      );
      if (hasContent) {
        const missing = [];
        if (!r.date?.trim()) missing.push('Date');
        if (!r.shift?.trim()) missing.push('Shift');
        if (!r.status?.trim()) missing.push('Status');
        const unitVal = (r.unit || (Array.isArray(r.units) && r.units[0]) || '').trim();
        if (!unitVal) missing.push('Unit');
        const deptVal = (r.department || (Array.isArray(r.departments) && r.departments[0]) || '').trim();
        if (!deptVal) missing.push('Department');
        if (!r.observation?.trim()) missing.push('Observation');
        const staffVal = (r.staffName || r.staffEmployee || (Array.isArray(r.staffEmployees) && (r.staffEmployees[0]?.name || r.staffEmployees[0]?.fullName)) || '').trim();
        if (!staffVal) missing.push('Staff name');

        if (missing.length > 0) {
          setAlertModal({
            isOpen: true,
            type: 'send-mail-warning',
            title: 'Cannot Send Email',
            rowNumber: i + 1,
            missingFields: missing,
            message: `Cannot send mail because Row ${i + 1} has mandatory column(s) that are not filled. Please fill all mandatory columns and save before sending email.`,
            confirmText: 'Understood'
          });
          showToast(`Row ${i + 1}: Mandatory columns (${missing.join(', ')}) required before sending mail.`);
          return;
        }
      }
    }
    setIsSendMailOpen(true);
  };

  // Discard all unsaved edits made during the session and navigate back immediately
  const handleDiscardAndGoBack = () => {
    if (requireConfirmationReasonBeforeContinuing()) return;
    setShowDiscardModal(false);
    if (topic?.id && initialStateRef.current) {
      setData((items) => {
        if (!items) return items;
        return items.map((item) =>
          item.id === topic.id ? { ...item, sheet: initialStateRef.current } : item
        );
      });
    }
    if (initialStateRef.current) {
      setRows(initialStateRef.current.rows);
      setHeaderInfo(initialStateRef.current.headerInfo);
    }
    onBack?.();
  };

  const topicName = headerInfo.topicName || topic?.topic || '';
  const createdByName = topic?.createdBy?.name || userContext?.user?.name || '';
  const createdByCode = topic?.createdBy?.code || userContext?.user?.code || '';

  // Live CFT Topics fetched directly from backend
  const [cftTopics, setCftTopics] = useState([]);
  const [cftLoading, setCftLoading] = useState(false);
  const [cftError, setCftError] = useState(null);

  const loadCFTTopics = useCallback(async () => {
    setCftLoading(true);
    setCftError(null);
    try {
      const res = await pdcaApi.getCftTopics({
        plant: topic?.plant && !['Unit', 'All Plants'].includes(topic.plant) ? topic.plant : undefined
      });
      const list = Array.isArray(res) ? res : (res?.records || []);
      const map = new Map();
      list.forEach((item) => {
        if (item && item.id && !item.isDeleted) {
          const itemDept = item.department || item.memberDepartment || item.createdBy?.department || '';
          const members = [];
          if (item.createdBy && item.createdBy.name) {
            members.push({
              name: item.createdBy.name,
              code: item.createdBy.code || '',
              role: 'Lead Member',
              department: item.createdBy.department || itemDept
            });
          }
          const assignedEmployees = Array.isArray(item.assignedMembers)
            ? item.assignedMembers
              .map((m) => (typeof m === 'object' ? { name: m.name || '', code: m.code || '', department: m.department || itemDept } : { name: String(m), code: '', department: itemDept }))
              .filter((m) => m.name)
            : [];

          map.set(item.id, {
            id: item.id,
            name: item.topic || item.name || '',
            plant: item.plant || '',
            department: itemDept,
            members,
            assignedEmployees,
            rawItem: item
          });
        }
      });

      // Also merge any CFT records available in local context
      if (Array.isArray(data)) {
        data.forEach((item) => {
          if (item && item.id && item.scope === 'CFT' && !item.isDeleted && !map.has(item.id)) {
            const itemDept = item.department || item.memberDepartment || item.createdBy?.department || '';
            const members = [];
            if (item.createdBy && item.createdBy.name) {
              members.push({
                name: item.createdBy.name,
                code: item.createdBy.code || '',
                role: 'Lead Member',
                department: item.createdBy.department || itemDept
              });
            }
            const assignedEmployees = Array.isArray(item.assignedMembers)
              ? item.assignedMembers
                .map((m) => (typeof m === 'object' ? { name: m.name || '', code: m.code || '', department: m.department || itemDept } : { name: String(m), code: '', department: itemDept }))
                .filter((m) => m.name)
              : [];

            map.set(item.id, {
              id: item.id,
              name: item.topic || item.name || '',
              plant: item.plant || '',
              department: itemDept,
              members,
              assignedEmployees,
              rawItem: item
            });
          }
        });
      }

      setCftTopics(Array.from(map.values()));
    } catch (err) {
      console.error('Failed to load CFT topics:', err);
      setCftError(err?.message || 'Failed to load CFT records');
    } finally {
      setCftLoading(false);
    }
  }, [topic?.plant, data]);

  useEffect(() => {
    loadCFTTopics();
  }, [loadCFTTopics]);

  // Selected CFT Topic object for current row when in members mode
  const selectedRowForCFT = openCFTDropdown ? rows[openCFTDropdown.rowIndex] : null;
  const currentCFTTopicObj = useMemo(() => {
    if (!selectedRowForCFT) return null;
    const targetId = selectedRowForCFT.cftTopicId;
    const targetName = (selectedRowForCFT.cftTopic || '').toLowerCase();

    let found = targetId ? cftTopics.find((t) => t.id === targetId) : null;
    if (!found && targetName) {
      found = cftTopics.find((t) => t.name.toLowerCase() === targetName);
    }
    if (found) return found;

    if (selectedRowForCFT.cftTopic) {
      return {
        id: selectedRowForCFT.cftTopicId || 'cft_custom',
        name: selectedRowForCFT.cftTopic,
        department: selectedRowForCFT.responsiblePersonDept || selectedRowForCFT.department || '',
        members: selectedRowForCFT.cftSelectedName
          ? [
            {
              name: selectedRowForCFT.cftSelectedName,
              code: selectedRowForCFT.cftSelectedCode || '',
              role: 'Member',
              department: selectedRowForCFT.responsiblePersonDept || selectedRowForCFT.department || ''
            }
          ]
          : [],
        assignedEmployees: selectedRowForCFT.assignedEmployee
          ? [{ name: selectedRowForCFT.assignedEmployee, code: '', department: selectedRowForCFT.responsiblePersonDept || selectedRowForCFT.department || '' }]
          : []
      };
    }
    return null;
  }, [selectedRowForCFT, cftTopics]);

  // Close CFT dropdown on outside click or scroll/resize
  useEffect(() => {
    if (!openCFTDropdown) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.cft-dropdown-menu') && !e.target.closest('.cft-trigger-btn')) {
        setOpenCFTDropdown(null);
      }
    };
    const handleScroll = (e) => {
      if (!e.target.closest?.('.cft-dropdown-menu')) {
        setOpenCFTDropdown(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [openCFTDropdown]);

  // Close Staff dropdown on outside click or scroll/resize
  useEffect(() => {
    if (!openStaffDropdown) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.staff-dropdown-menu') && !e.target.closest('.staff-trigger-btn')) {
        setOpenStaffDropdown(null);
      }
    };
    const handleScroll = (e) => {
      if (!e.target.closest?.('.staff-dropdown-menu')) {
        setOpenStaffDropdown(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [openStaffDropdown]);

  const handleToggleStaffDropdown = (rowIndex, e) => {
    e.stopPropagation();
    if (openStaffDropdown?.rowIndex === rowIndex) {
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
      top: topPos,
      left: Math.max(12, leftPos),
      width: dropdownWidth
    });
  };

  // Formatted employee options derived from verified database employee records
  const employeeOptionList = useMemo(() => {
    const map = new Map();
    // 1. From database employee records
    dbEmployees.forEach((emp) => {
      const cleanName = stripEmployeeId(emp.name);
      if (!cleanName) return;
      map.set(cleanName, {
        label: cleanName,
        name: cleanName,
        code: emp.code || '',
        department: emp.department || ''
      });
    });

    // 2. From CFT topic assigned members if any
    (topic?.assignedMembers || []).forEach((m) => {
      if (m.name) {
        const cleanName = stripEmployeeId(m.name);
        if (cleanName && !map.has(cleanName)) {
          const dept = findEmployeeDepartment(m.name, dbEmployees);
          map.set(cleanName, {
            label: cleanName,
            name: cleanName,
            code: m.code || '',
            department: dept || ''
          });
        }
      }
    });

    // 3. From any existing rows loaded from saved sheet (so historical entries remain visible)
    rows.forEach((r) => {
      if (r.staffEmployee?.trim()) {
        const cleanName = stripEmployeeId(r.staffEmployee);
        if (cleanName && !map.has(cleanName)) {
          const dept = findEmployeeDepartment(r.staffEmployee, dbEmployees);
          map.set(cleanName, {
            label: cleanName,
            name: cleanName,
            code: '',
            department: dept || r.department || ''
          });
        }
      }
    });

    return Array.from(map.values());
  }, [dbEmployees, topic?.assignedMembers, rows]);

  const getStaffOptionsForRow = (rowIndex) => {
    const row = rows[rowIndex];
    const currentDept = row?.department?.trim().toLowerCase();
    const query = staffSearchQuery.trim().toLowerCase();

    let list = employeeOptionList;
    if (query) {
      list = list.filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          (item.department && item.department.toLowerCase().includes(query))
      );
    }

    if (currentDept) {
      // Prioritize staff belonging to the selected department at the top
      const deptMatches = list.filter(
        (item) => item.department && item.department.toLowerCase() === currentDept
      );
      const others = list.filter(
        (item) => !item.department || item.department.toLowerCase() !== currentDept
      );
      return [...deptMatches, ...others];
    }

    return list;
  };

  const handleToggleCFTDropdown = (rowIndex, e, mode = 'auto') => {
    e.stopPropagation();
    const row = rows[rowIndex];
    const targetMode = mode === 'auto' ? (row?.cftTopic ? 'members' : 'topics') : mode;

    if (openCFTDropdown?.rowIndex === rowIndex && openCFTDropdown?.mode === targetMode) {
      setOpenCFTDropdown(null);
      return;
    }
    if (targetMode === 'topics') {
      loadCFTTopics();
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const dropdownWidth = 320;
    let leftPos = rect.left + (rect.width / 2) - (dropdownWidth / 2);
    if (leftPos + dropdownWidth > window.innerWidth - 12) {
      leftPos = window.innerWidth - dropdownWidth - 12;
    }
    if (leftPos < 12) {
      leftPos = 12;
    }

    let topPos = rect.bottom + 4;
    const estimatedHeight = 350;
    if (topPos + estimatedHeight > window.innerHeight - 12 && rect.top - estimatedHeight > 12) {
      topPos = rect.top - estimatedHeight - 4;
    }

    setOpenCFTDropdown({
      rowIndex,
      mode: targetMode,
      top: topPos,
      left: Math.max(12, leftPos),
      width: dropdownWidth
    });
  };

  // Track async request tokens per row to prevent stale responses from overwriting newer selections
  const cftRequestRef = useRef({});

  const handleSelectTopic = (rowIndex, topicItem) => {
    if (!topicItem || !topicItem.name) {
      handleDeleteCFT(rowIndex);
      return;
    }

    const requestId = Date.now();
    cftRequestRef.current[rowIndex] = requestId;

    // Always fetch employees fresh from the selected CFT, discarding old CFT data
    const candidateList = (Array.isArray(topicItem.assignedEmployees) && topicItem.assignedEmployees.length > 0)
      ? topicItem.assignedEmployees
      : (Array.isArray(topicItem.members) && topicItem.members.length > 0 ? topicItem.members : []);

    const newStaffEmployees = candidateList.map((emp) => {
      const p = parseStaffEmployee(emp.name ? (emp.code ? `${emp.name} (${emp.code})` : emp.name) : emp);
      const name = emp.name || p.name || '';
      const code = (emp.code || emp.empId || p.code || '').toUpperCase();
      const dbDept = findEmployeeDepartment(`${name} (${code})`, dbEmployees) ||
        findEmployeeDepartment(`${name} (${code})`, VERIFIED_EMPLOYEE_MASTER);
      const department = dbDept ||
        (emp.department && emp.department !== 'CFT' ? emp.department : '') ||
        (topicItem.department && topicItem.department !== 'CFT' ? topicItem.department : '') ||
        '';
      return { id: emp.id || undefined, name, code, department };
    });

    const formattedStaff = newStaffEmployees
      .map((e) => (e.code ? `${e.name} (${e.code})` : e.name))
      .join(', ');

    const targetDept = newStaffEmployees[0]?.department || (topicItem.department && topicItem.department !== 'CFT' ? topicItem.department : '') || '';

    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex] || {};

      // Case A & B: Update CFT and dependent Department and Staff Name immediately
      // Remove previously fetched values and do not retain stale data from prior CFT
      updated[rowIndex] = {
        ...currentRow,
        cftTopic: topicItem.name,
        cftTopicId: topicItem.id,
        cftSelectedType: '',
        cftSelectedName: '',
        cftSelectedCode: '',
        assignedEmployee: '',
        department: targetDept,
        responsiblePersonDept: targetDept,
        staffEmployees: newStaffEmployees,
        staffEmployee: formattedStaff,
        staffName: newStaffEmployees[0]?.name || '',
        staffId: newStaffEmployees[0]?.code || '',
        employeeId: newStaffEmployees[0]?.code || '',
        responsiblePersonConfirmation: formattedStaff
      };
      return updated;
    });

    // Close topic dropdown so topic name is now visible on row
    setOpenCFTDropdown(null);

    // Asynchronous check for fresh member assignments from API
    if (topicItem.id) {
      pdcaApi.getCftMembers(topicItem.id).then((freshMembers) => {
        // Prevent older responses from overwriting newer selections
        if (cftRequestRef.current[rowIndex] !== requestId) return;
        if (!Array.isArray(freshMembers) || freshMembers.length === 0) return;

        setRows((prev) => {
          const curr = prev[rowIndex];
          if (!curr || curr.cftTopicId !== topicItem.id) return prev;

          const resolvedFresh = freshMembers.map((emp) => {
            const p = parseStaffEmployee(emp.name ? (emp.code ? `${emp.name} (${emp.code})` : emp.name) : emp);
            const name = emp.name || p.name || '';
            const code = (emp.code || emp.empId || p.code || '').toUpperCase();
            const dbDept = findEmployeeDepartment(`${name} (${code})`, dbEmployees) ||
              findEmployeeDepartment(`${name} (${code})`, VERIFIED_EMPLOYEE_MASTER);
            const department = dbDept ||
              (emp.department && emp.department !== 'CFT' ? emp.department : '') ||
              (topicItem.department && topicItem.department !== 'CFT' ? topicItem.department : '') ||
              '';
            return { id: emp.id || undefined, name, code, department };
          });

          const freshFormatted = resolvedFresh
            .map((e) => (e.code ? `${e.name} (${e.code})` : e.name))
            .join(', ');
          const freshDept = resolvedFresh[0]?.department || (topicItem.department && topicItem.department !== 'CFT' ? topicItem.department : '') || (curr.responsiblePersonDept !== 'CFT' ? curr.responsiblePersonDept : '');

          return prev.map((r, i) => {
            if (i !== rowIndex) return r;
            return {
              ...r,
              department: freshDept,
              responsiblePersonDept: freshDept,
              staffEmployees: resolvedFresh,
              staffEmployee: freshFormatted,
              staffName: resolvedFresh[0]?.name || '',
              staffId: resolvedFresh[0]?.code || '',
              employeeId: resolvedFresh[0]?.code || '',
              responsiblePersonConfirmation: freshFormatted
            };
          });
        });
      }).catch((err) => {
        console.warn('Could not fetch fresh CFT members:', err);
      });
    }
  };

  const handleSelectCFTMember = (rowIndex, memberObj, type) => {
    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex] || {};
      const p = parseStaffEmployee(memberObj.name ? (memberObj.code ? `${memberObj.name} (${memberObj.code})` : memberObj.name) : memberObj);
      const name = memberObj.name || p.name || '';
      const code = (memberObj.code || p.code || '').toUpperCase();
      const dbDept = findEmployeeDepartment(`${name} (${code})`, dbEmployees) ||
        findEmployeeDepartment(`${name} (${code})`, VERIFIED_EMPLOYEE_MASTER);
      const dept = dbDept ||
        (memberObj.department && memberObj.department !== 'CFT' ? memberObj.department : '') ||
        (currentCFTTopicObj?.department && currentCFTTopicObj?.department !== 'CFT' ? currentCFTTopicObj?.department : '') ||
        (currentRow.responsiblePersonDept && currentRow.responsiblePersonDept !== 'CFT' ? currentRow.responsiblePersonDept : '') ||
        '';

      const empEntry = {
        id: memberObj.id || undefined,
        name,
        code,
        department: dept
      };

      const formattedStaff = code ? `${name} (${code})` : name;

      updated[rowIndex] = {
        ...currentRow,
        cftSelectedType: type,
        cftSelectedName: name,
        cftSelectedCode: code,
        assignedEmployee: formattedStaff,
        department: dept || currentRow.department,
        responsiblePersonDept: dept || currentRow.responsiblePersonDept,
        staffEmployees: [empEntry],
        staffEmployee: formattedStaff,
        staffName: name,
        staffId: code,
        employeeId: code,
        responsiblePersonConfirmation: formattedStaff
      };
      return updated;
    });
    setOpenCFTDropdown(null);
  };

  const handleClearMemberOnly = (rowIndex) => {
    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex] || {};
      const topicObj = cftTopics.find((t) => t.id === currentRow.cftTopicId || t.name === currentRow.cftTopic);
      const candidateList = topicObj ? ((Array.isArray(topicObj.assignedEmployees) && topicObj.assignedEmployees.length > 0)
        ? topicObj.assignedEmployees
        : (Array.isArray(topicObj.members) && topicObj.members.length > 0 ? topicObj.members : [])) : [];

      const restoredStaff = candidateList.map((emp) => {
        const p = parseStaffEmployee(emp.name ? (emp.code ? `${emp.name} (${emp.code})` : emp.name) : emp);
        const name = emp.name || p.name || '';
        const code = (emp.code || emp.empId || p.code || '').toUpperCase();
        const dbDept = findEmployeeDepartment(`${name} (${code})`, dbEmployees) ||
          findEmployeeDepartment(`${name} (${code})`, VERIFIED_EMPLOYEE_MASTER);
        const department = dbDept || (emp.department && emp.department !== 'CFT' ? emp.department : '') || (topicObj?.department && topicObj?.department !== 'CFT' ? topicObj?.department : '') || '';
        return { id: emp.id || undefined, name, code, department };
      });

      const formattedStaff = restoredStaff.map((e) => (e.code ? `${e.name} (${e.code})` : e.name)).join(', ');
      const targetDept = restoredStaff[0]?.department || (topicObj?.department && topicObj?.department !== 'CFT' ? topicObj?.department : '') || '';

      updated[rowIndex] = {
        ...currentRow,
        cftSelectedType: '',
        cftSelectedName: '',
        cftSelectedCode: '',
        assignedEmployee: '',
        department: targetDept,
        responsiblePersonDept: targetDept,
        staffEmployees: restoredStaff,
        staffEmployee: formattedStaff,
        staffName: restoredStaff[0]?.name || '',
        staffId: restoredStaff[0]?.code || '',
        employeeId: restoredStaff[0]?.code || '',
        responsiblePersonConfirmation: formattedStaff
      };
      return updated;
    });
    setOpenCFTDropdown(null);
  };

  const handleEditCFTTopic = (rowIndex, e) => {
    e.stopPropagation();
    handleToggleCFTDropdown(rowIndex, e, 'topics');
  };

  const handleDeleteCFT = (rowIndex, e) => {
    if (e?.stopPropagation) e.stopPropagation();
    // Cancel in-flight async response
    cftRequestRef.current[rowIndex] = Date.now();

    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex] || {};
      // Case C: Clear CFT and clear dependent Department and Staff Name fields
      updated[rowIndex] = {
        ...currentRow,
        cftTopic: '',
        cftTopicId: '',
        cftSelectedType: '',
        cftSelectedName: '',
        cftSelectedCode: '',
        assignedEmployee: '',
        department: '',
        responsiblePersonDept: '',
        staffEmployees: [],
        staffEmployee: '',
        staffName: '',
        staffId: '',
        employeeId: '',
        responsiblePersonConfirmation:
          currentRow.responsiblePersonConfirmation === currentRow.staffEmployee
            ? ''
            : (currentRow.responsiblePersonConfirmation || '')
      };
      return updated;
    });
    setOpenCFTDropdown(null);
  };

  // The page keys this sheet by PDCA ID. Do not reset headers when autosave
  // publishes a new record object for the same form.

  // Image Editor Modal state: { isOpen, rowIndex, field, nameField, imageSrc, title }
  const [editorModal, setEditorModal] = useState({
    isOpen: false,
    rowIndex: null,
    field: null,
    nameField: null,
    imageSrc: null,
    title: ''
  });

  // 4-Box Upload Type Selection Modal: { isOpen, rowIndex, field, nameField, typeField, columnTitle }
  const [uploadSelectionModal, setUploadSelectionModal] = useState({
    isOpen: false,
    rowIndex: null,
    field: null,
    nameField: null,
    typeField: null,
    columnTitle: ''
  });

  // Add Staff Employee Modal: { isOpen, rowIndex, initialValue, initialEmployees }
  const [staffEmployeeModal, setStaffEmployeeModal] = useState({
    isOpen: false,
    rowIndex: null,
    initialValue: '',
    initialEmployees: null
  });

  const handleOpenAddStaffModal = (rowIndex) => {
    const row = rows[rowIndex];
    const existing = Array.isArray(row?.staffEmployees) && row.staffEmployees.length > 0
      ? row.staffEmployees
      : (row?.staffEmployee
        ? row.staffEmployee.split(/[,;]/).map((s) => s.trim()).filter(Boolean).map((p) => {
          const parsed = parseStaffEmployee(p);
          return {
            name: parsed.name,
            code: parsed.code,
            department: findEmployeeDepartment(p, dbEmployees) || ''
          };
        })
        : []);

    // When clicking (+) on an existing group, append an empty row for immediate entry
    const initialEmployees = existing.length > 0
      ? [...existing, { name: '', code: '', department: '' }]
      : [{ name: '', code: '', department: '' }];

    setStaffEmployeeModal({
      isOpen: true,
      rowIndex,
      initialValue: row?.staffEmployee || '',
      initialEmployees
    });
  };

  const handleRemoveStaffEmployee = (rowIndex, empIndex) => {
    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex];
      if (!currentRow) return prev;
      const currentList = Array.isArray(currentRow.staffEmployees) ? [...currentRow.staffEmployees] : [];
      if (empIndex >= 0 && empIndex < currentList.length) {
        currentList.splice(empIndex, 1);
      }

      if (currentList.length === 0) {
        updated[rowIndex] = {
          ...currentRow,
          staffEmployee: '',
          staffEmployees: [],
          staffName: '',
          staffId: '',
          employeeId: '',
          responsiblePersonConfirmation: ''
        };
      } else {
        const formatted = currentList
          .map((e) => (e.code ? `${e.name} (${e.code})` : e.name))
          .join(', ');
        const primary = currentList[0];
        updated[rowIndex] = {
          ...currentRow,
          staffEmployee: formatted,
          staffEmployees: currentList,
          staffName: primary.name || '',
          staffId: primary.code || '',
          employeeId: primary.code || '',
          department: primary.department || currentRow.department,
          responsiblePersonConfirmation: formatted
        };
      }
      return updated;
    });
  };

  const handleSaveStaffEmployee = (rowIndex, formattedValue, employeeList = []) => {
    handleSelectStaffMember(rowIndex, formattedValue, employeeList);
  };

  // Focus navigation refs grid: cellRefs.current[`${rowIndex}_${colName}`]
  const cellRefs = useRef({});


  const registerRef = (rowIndex, colName, el) => {
    if (el) {
      cellRefs.current[`${rowIndex}_${colName}`] = el;
    } else {
      delete cellRefs.current[`${rowIndex}_${colName}`];
    }
  };

  const handleCellChange = (rowIndex, field, value) => {
    setRows((prev) => {
      const updated = [...prev];
      const current = updated[rowIndex];
      if (!current) return prev;
      if (!canEditEntireSheet) {
        if (!EDITABLE_RESPONSIBLE_COLUMNS.includes(field)) return prev;
        if (!isUserInResponsibleDepartment(current, effectiveUser)) return prev;
      }
      if (field === 'stdDurationMin' && !current.responseDate?.trim() && value) {
        if (typeof showToast === 'function') {
          showToast(`Row ${rowIndex + 1}: Select Response Date first before entering Std. Duration.`);
        }
        return prev;
      }
      if (field === 'unit' && current.unit !== value) {
        updated[rowIndex] = {
          ...current,
          unit: value,
          departments: [], department: '',
          sections: [], section: '', sectionId: null, sectionCode: '',
          lineAreas: [], lineArea: '', lineAreaId: null, lineAreaCode: '', lineAreaSectionId: null,
        };
      } else {
        updated[rowIndex] = { ...current, [field]: value };
      }
      return updated;
    });
  };

  const handleResponsiblePersonUnitChange = (rowIndex, value, employeeIndex = null) => {
    setRows((prev) => {
      const updated = [...prev];
      const current = updated[rowIndex];
      if (!current) return prev;
      const staffEmployees = Array.isArray(current.staffEmployees)
        ? current.staffEmployees.map((employee, index) => ({
          ...employee,
          ...(index === employeeIndex ? { unit: value } : {}),
          department: ''
        }))
        : [];
      updated[rowIndex] = {
        ...current,
        respUnit: employeeIndex === null || employeeIndex === 0 ? value : current.respUnit,
        responsiblePersonUnit: employeeIndex === null || employeeIndex === 0 ? value : current.responsiblePersonUnit,
        responsiblePersonDept: '', staffEmployees,
        staffEmployee: '', staffName: '', staffId: '', employeeId: ''
      };
      return updated;
    });
  };

  // Column 5: Department change handler (Plan phase - before Section)
  const handleDepartmentChange = (rowIndex, dept) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;

      let nextSection = curr.section;
      let nextSectionId = curr.sectionId;
      let nextSectionCode = curr.sectionCode;
      let nextLineArea = curr.lineArea;
      let nextLineAreaId = curr.lineAreaId;
      let nextLineAreaCode = curr.lineAreaCode;
      let nextLineAreaSectionId = curr.lineAreaSectionId;

      // Dependent Unit logic:
      // - If Department selection is cleared, clear the dependent Unit selection as well.
      // - If the user changes the Department, revalidate the Unit selection and clear it if necessary.
      let nextUnit = curr.unit || '';
      if (!dept) {
        nextUnit = '';
      } else if (curr.unit && curr.unit !== 'Bawal' && curr.unit !== 'Gujrat') {
        nextUnit = '';
      }

      // Changing the Department must clear the Section only when the previously selected Section is no longer valid for that Department
      if (dept && (curr.sectionId || curr.section)) {
        const secMatch = VERIFIED_SECTION_MASTER.find((s) => String(s.id) === String(curr.sectionId)) || { id: curr.sectionId, name: curr.section };
        if (!isSectionRelatedToDepartment(secMatch, dept)) {
          nextSection = '';
          nextSectionId = null;
          nextSectionCode = '';
          nextLineArea = '';
          nextLineAreaId = null;
          nextLineAreaCode = '';
          nextLineAreaSectionId = null;
        }
      }

      updated[rowIndex] = {
        ...curr,
        department: dept,
        unit: nextUnit,
        section: nextSection,
        sectionId: nextSectionId,
        sectionCode: nextSectionCode,
        lineArea: nextLineArea,
        lineAreaId: nextLineAreaId,
        lineAreaCode: nextLineAreaCode,
        lineAreaSectionId: nextLineAreaSectionId
      };
      return updated;
    });
  };

  const handleAddDepartment = (rowIndex) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;
      const depts = Array.isArray(curr.departments) && curr.departments.length > 0
        ? [...curr.departments]
        : (curr.department ? [curr.department] : ['']);
      depts.push('');
      updated[rowIndex] = {
        ...curr,
        departments: depts,
        department: depts[0] || ''
      };
      return updated;
    });
  };

  const handleRemoveDepartment = (rowIndex, dIdx) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;
      let depts = Array.isArray(curr.departments) ? [...curr.departments] : (curr.department ? [curr.department] : []);
      depts.splice(dIdx, 1);
      if (depts.length === 0) depts = [''];
      updated[rowIndex] = {
        ...curr,
        departments: depts,
        department: depts[0] || ''
      };
      return updated;
    });
  };

  const handleUpdateDepartment = (rowIndex, dIdx, val) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;
      let depts = Array.isArray(curr.departments) ? [...curr.departments] : (curr.department ? [curr.department] : []);
      if (depts.length === 0) depts = [''];
      depts[dIdx] = val;
      const primary = depts[0] || '';

      // If user selected a department and existing section for this slot is no longer valid, clear it
      let secs = Array.isArray(curr.sections) ? [...curr.sections] : (curr.section ? [{ section: curr.section, sectionId: curr.sectionId, sectionCode: curr.sectionCode }] : []);
      const targetSecIdx = dIdx < secs.length ? dIdx : 0;
      if (val && secs[targetSecIdx]?.section) {
        const secObj = VERIFIED_SECTION_MASTER.find(
          (s) => String(s.id) === String(secs[targetSecIdx].sectionId) || s.name?.toLowerCase() === secs[targetSecIdx].section?.toLowerCase()
        ) || { name: secs[targetSecIdx].section, id: secs[targetSecIdx].sectionId };
        if (!isSectionRelatedToDepartment(secObj, val)) {
          secs[targetSecIdx] = { section: '', sectionId: null, sectionCode: '' };
        }
      }

      updated[rowIndex] = {
        ...curr,
        departments: depts,
        department: primary,
        ...(secs.length > 0 ? {
          sections: secs,
          section: secs[0]?.section || '',
          sectionId: secs[0]?.sectionId ?? null,
          sectionCode: secs[0]?.sectionCode || ''
        } : {})
      };
      return updated;
    });
  };

  const handleAddSection = (rowIndex) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;
      const secs = Array.isArray(curr.sections) && curr.sections.length > 0
        ? [...curr.sections]
        : (curr.section ? [{ section: curr.section, sectionId: curr.sectionId, sectionCode: curr.sectionCode }] : [{ section: '', sectionId: null, sectionCode: '' }]);
      secs.push({ section: '', sectionId: null, sectionCode: '' });
      updated[rowIndex] = {
        ...curr,
        sections: secs,
        section: secs[0]?.section || '',
        sectionId: secs[0]?.sectionId ?? null,
        sectionCode: secs[0]?.sectionCode || ''
      };
      return updated;
    });
  };

  const handleRemoveSection = (rowIndex, sIdx) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;
      let secs = Array.isArray(curr.sections) ? [...curr.sections] : (curr.section ? [{ section: curr.section, sectionId: curr.sectionId, sectionCode: curr.sectionCode }] : []);
      secs.splice(sIdx, 1);
      if (secs.length === 0) secs = [{ section: '', sectionId: null, sectionCode: '' }];
      updated[rowIndex] = {
        ...curr,
        sections: secs,
        section: secs[0]?.section || '',
        sectionId: secs[0]?.sectionId ?? null,
        sectionCode: secs[0]?.sectionCode || ''
      };
      return updated;
    });
  };

  const handleUpdateSection = (rowIndex, sIdx, sectionName, meta = {}) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;
      let secs = Array.isArray(curr.sections) ? [...curr.sections] : (curr.section ? [{ section: curr.section, sectionId: curr.sectionId, sectionCode: curr.sectionCode }] : []);
      if (secs.length === 0) secs = [{ section: '', sectionId: null, sectionCode: '' }];
      secs[sIdx] = {
        section: sectionName,
        sectionId: meta?.sectionId ?? null,
        sectionCode: meta?.sectionCode || ''
      };
      const primary = secs[0] || { section: '', sectionId: null, sectionCode: '' };
      updated[rowIndex] = {
        ...curr,
        sections: secs,
        section: primary.section || '',
        sectionId: primary.sectionId ?? null,
        sectionCode: primary.sectionCode || '',
        lineAreaSectionId: primary.sectionId ?? null
      };
      return updated;
    });
  };

  const handleAddLineArea = (rowIndex) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;
      const las = Array.isArray(curr.lineAreas) && curr.lineAreas.length > 0
        ? [...curr.lineAreas]
        : (curr.lineArea ? [{ lineArea: curr.lineArea, lineAreaId: curr.lineAreaId, lineAreaCode: curr.lineAreaCode, sectionId: curr.lineAreaSectionId }] : [{ lineArea: '', lineAreaId: null, lineAreaCode: '', sectionId: null }]);
      las.push({ lineArea: '', lineAreaId: null, lineAreaCode: '', sectionId: null });
      updated[rowIndex] = {
        ...curr,
        lineAreas: las,
        lineArea: las[0]?.lineArea || '',
        lineAreaId: las[0]?.lineAreaId ?? null,
        lineAreaCode: las[0]?.lineAreaCode || '',
        lineAreaSectionId: las[0]?.sectionId ?? null
      };
      return updated;
    });
  };

  const handleRemoveLineArea = (rowIndex, laIdx) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;
      let las = Array.isArray(curr.lineAreas) ? [...curr.lineAreas] : (curr.lineArea ? [{ lineArea: curr.lineArea, lineAreaId: curr.lineAreaId, lineAreaCode: curr.lineAreaCode, sectionId: curr.lineAreaSectionId }] : []);
      las.splice(laIdx, 1);
      if (las.length === 0) las = [{ lineArea: '', lineAreaId: null, lineAreaCode: '', sectionId: null }];
      updated[rowIndex] = {
        ...curr,
        lineAreas: las,
        lineArea: las[0]?.lineArea || '',
        lineAreaId: las[0]?.lineAreaId ?? null,
        lineAreaCode: las[0]?.lineAreaCode || '',
        lineAreaSectionId: las[0]?.sectionId ?? null
      };
      return updated;
    });
  };

  const handleUpdateLineArea = (rowIndex, laIdx, val, meta = {}) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;
      let las = Array.isArray(curr.lineAreas) ? [...curr.lineAreas] : (curr.lineArea ? [{ lineArea: curr.lineArea, lineAreaId: curr.lineAreaId, lineAreaCode: curr.lineAreaCode, sectionId: curr.lineAreaSectionId }] : []);
      if (las.length === 0) las = [{ lineArea: '', lineAreaId: null, lineAreaCode: '', sectionId: null }];
      const lineSectionId = meta?.sectionId ?? curr.sections?.[laIdx]?.sectionId ?? curr.sectionId ?? null;
      las[laIdx] = {
        lineArea: val,
        lineAreaId: meta?.lineAreaId ?? meta?.lineId ?? null,
        lineAreaCode: meta?.lineAreaCode || '',
        sectionId: lineSectionId
      };
      const primary = las[0] || { lineArea: '', lineAreaId: null, lineAreaCode: '', sectionId: null };
      updated[rowIndex] = {
        ...curr,
        lineAreas: las,
        lineArea: primary.lineArea || '',
        lineAreaId: primary.lineAreaId ?? null,
        lineAreaCode: primary.lineAreaCode || '',
        lineAreaSectionId: primary.sectionId ?? null
      };
      return updated;
    });
  };

  const handleResponseDateChange = (rowIndex, newDate) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;

      const oldDate = curr.responseDate || '';
      let revisions = [];
      if (Array.isArray(curr.revisedDates) && curr.revisedDates.length > 0) {
        if (curr.revisedDates.length === 1 && typeof curr.revisedDates[0] === 'string' && curr.revisedDates[0] === oldDate) {
          revisions = [];
        } else {
          revisions = curr.revisedDates.map((item) => {
            if (typeof item === 'string') return { date: item, reason: '', previousDate: '' };
            return { date: item?.date || '', reason: item?.reason || '', previousDate: item?.previousDate || '' };
          }).filter((r) => r.date);
        }
      }

      if (!newDate) {
        const hasRevisionHistory = revisions.length > 0;
        const restoredDate = hasRevisionHistory
          ? (curr.initialResponseDate || '')
          : '';
        updated[rowIndex] = {
          ...curr,
          initialResponseDate: hasRevisionHistory ? (curr.initialResponseDate || oldDate || '') : '',
          responseDate: restoredDate,
          stdDurationMin: restoredDate ? curr.stdDurationMin : '',
          revisedDates: [],
          noOfTimeRevised: 0,
          status: restoredDate ? computePDCAStatus({ ...curr, responseDate: restoredDate }, currentDate) : ''
        };
        return updated;
      }

      // Check if this is the first time selecting a response date
      const isFirstTime = !curr.initialResponseDate && !oldDate && revisions.length === 0;

      let nextRevisions = revisions;
      if (!isFirstTime && oldDate && oldDate !== newDate) {
        // User selected response date for second or subsequent time: record revision with current date
        const currentDateIso = new Date().toISOString().split('T')[0];
        nextRevisions = [...revisions, { date: currentDateIso, reason: '', previousDate: oldDate, responseDate: newDate }];
      }

      const tempRow = {
        ...curr,
        initialResponseDate: curr.initialResponseDate || oldDate || newDate,
        responseDate: newDate,
        revisedDates: nextRevisions,
        noOfTimeRevised: nextRevisions.length
      };

      const nextStatus = computePDCAStatus(tempRow, currentDate);

      updated[rowIndex] = {
        ...tempRow,
        status: nextStatus
      };
      return updated;
    });
  };

  // Update why revised input reason
  const handleRevisionReasonChange = (rowIndex, revIndex, reason) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;

      const revisions = Array.isArray(curr.revisedDates) ? [...curr.revisedDates] : [];
      if (!revisions[revIndex]) return prev;

      const target = revisions[revIndex];
      revisions[revIndex] = typeof target === 'string'
        ? { date: target, reason }
        : { ...target, reason };

      updated[rowIndex] = {
        ...curr,
        revisedDates: revisions
      };
      return updated;
    });
  };

  // Number of revisions for a row in the last saved/loaded baseline. Revisions at or
  // beyond this index were added in the current session and are not yet saved.
  const getSavedRevisionCount = (rowIndex) => {
    const savedRow = initialStateRef.current?.rows?.[rowIndex];
    return Array.isArray(savedRow?.revisedDates) ? savedRow.revisedDates.length : 0;
  };

  // Delete and persist a revision date (Administrators only). This action is
  // intentionally independent of the normal sheet edit permission/save flow.
  // A revision that has not been saved yet can also be cancelled by the editor;
  // in that case the Response Date reverts to its previous value locally.
  const handleDeleteRevisedDate = async (rowIndex, dateIndex) => {
    if (!isAdmin) {
      if (typeof showToast === 'function') {
        showToast('Access Denied: Only administrators have access to delete revised dates.');
      }
      return;
    }

    const curr = rows[rowIndex];
    if (!curr || !Array.isArray(curr.revisedDates)) return;

    const revisions = curr.revisedDates.map(item => typeof item === 'string'
      ? { date: item, reason: '', previousDate: '' }
      : { ...item, date: item?.date || '', reason: item?.reason || '', previousDate: item?.previousDate || '' });
    const removed = revisions[dateIndex];
    if (!removed) return;
    const priorDate = removed.previousDate || (dateIndex > 0
      ? revisions[dateIndex - 1]?.date || ''
      : curr.initialResponseDate || '');
    const remaining = revisions.filter((_, i) => i !== dateIndex);
    // If a middle revision is removed, connect the next revision to the date
    // that preceded the removed entry so later removals still restore correctly.
    if (remaining[dateIndex]) remaining[dateIndex] = { ...remaining[dateIndex], previousDate: priorDate };
    const removedLatestRevision = dateIndex === revisions.length - 1;
    const latestDate = removedLatestRevision
      ? priorDate
      : (curr.responseDate || revisions[revisions.length - 1]?.date || curr.initialResponseDate || '');
    const tempRow = {
      ...curr,
      revisedDates: remaining,
      responseDate: latestDate,
      noOfTimeRevised: remaining.length
    };
    const nextRows = rows.map((row, index) => index === rowIndex
      ? { ...tempRow, status: computePDCAStatus(tempRow, currentDate) }
      : row);
    if (!isAdmin) {
      // Cancel an unsaved revision: revert locally, the normal Save persists it.
      setRows(nextRows);
      return;
    }
    const nextSnapshot = { rows: nextRows, headerInfo };
    const targetId = topic?.id || topic?.recordId || (headerInfo.topicName?.trim() ? encodeURIComponent(headerInfo.topicName.trim()) : 'current_topic');

    try {
      setIsSaving(true);
      if (targetId) await pdcaApi.saveSheet(targetId, nextSnapshot);
      setRows(nextRows);
      persistSheet(nextSnapshot);
      initialStateRef.current = {
        rows: nextRows.map((row) => ({ ...row })),
        headerInfo: { ...headerInfo }
      };
      initialSnapshotRef.current = serializeSheet(nextRows, headerInfo);
      if (typeof showToast === 'function') showToast('Revised date deleted successfully.');
    } catch (error) {
      if (typeof showToast === 'function') {
        showToast(error?.response?.data?.message || error.message || 'Could not delete the revised date. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Section A: Responsible Person Instruction, etc. Confirmation change handler
  const handleConfirmationChange = (rowIndex, value, userName = '') => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;

      const resolvedUser = userName || effectiveUser?.fullName || effectiveUser?.name || 'Administrator';
      let nextConfirmedBy = curr.confirmedBy || '';

      const isConf = value === 'Confirmed' || value === 'Confirm';
      const isNotConf = value === 'Not - Confirmed' || value === 'Not-Confirmed' || value === 'Not-Confirm';

      if (isConf) {
        nextConfirmedBy = resolvedUser;
      } else if (isNotConf) {
        nextConfirmedBy = resolvedUser;
      } else {
        nextConfirmedBy = '';
      }

      const tempRow = {
        ...curr,
        confirmation: value,
        confirmedBy: nextConfirmedBy
      };

      let nextStatus = '';
      if (isConf) {
        nextStatus = 'Done';
      } else if (isNotConf) {
        nextStatus = 'In- Progress';
      } else {
        nextStatus = computePDCAStatus(tempRow, currentDate);
      }

      updated[rowIndex] = {
        ...tempRow,
        status: nextStatus,
        responsiblePersonConfirmation: value || ''
      };
      return updated;
    });
  };

  // Instruction change handler for Responsible Person Instruction, etc. column
  const handleInstructionChange = (rowIndex, text) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;
      updated[rowIndex] = {
        ...curr,
        instruction: text,
        responsiblePersonConfirmation: curr.confirmation === 'Confirmed' ? 'Confirmed' : text
      };
      return updated;
    });
  };

  // Column 4: Status change handler
  const handleStatusChange = (rowIndex, value) => {
    if (!value) {
      setRows(prev => prev.map((row, index) => index === rowIndex ? { ...row, status: '' } : row));
      return;
    }
    const normalizedStatus = normalizePDCAStatus(value);
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;

      let actualStatus = normalizedStatus;
      if (!curr.responseDate && normalizedStatus !== 'Not-Started') {
        actualStatus = 'Not-Started';
        if (typeof showToast === 'function') {
          showToast('Response date is required before updating status.');
        }
      }

      let nextConfirmation = curr.confirmation;
      let nextConfirmedBy = curr.confirmedBy;
      if (actualStatus === 'Done') {
        nextConfirmation = 'Confirmed';
        if (!nextConfirmedBy) {
          nextConfirmedBy = effectiveUser?.fullName || effectiveUser?.name || 'Administrator';
        }
      } else if (actualStatus === 'In- Progress') {
        nextConfirmation = 'Not - Confirmed';
        if (!nextConfirmedBy) {
          nextConfirmedBy = effectiveUser?.fullName || effectiveUser?.name || 'Administrator';
        }
      } else if (actualStatus === 'Not-Started') {
        nextConfirmation = '';
        nextConfirmedBy = '';
      }

      updated[rowIndex] = {
        ...curr,
        status: actualStatus,
        confirmation: nextConfirmation,
        confirmedBy: nextConfirmedBy,
        responsiblePersonConfirmation: nextConfirmation || curr.responsiblePersonConfirmation || ''
      };
      return updated;
    });
  };

  // Column 6: Section change handler (Plan phase - before Line/Area)
  const handleSectionChange = (rowIndex, sectionName, meta = {}) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;

      const newSectionId = meta?.sectionId ?? null;
      const newSectionCode = meta?.sectionCode ?? '';

      // Check if existing Line/Area belongs to this section
      let nextLineArea = curr.lineArea;
      let nextLineAreaId = curr.lineAreaId;
      let nextLineAreaCode = curr.lineAreaCode;

      if (curr.lineAreaId && newSectionId != null) {
        const dbSections = getCachedDbSections() || [];
        const secMatch = dbSections.find((s) => String(s.id) === String(newSectionId));
        if (secMatch && Array.isArray(secMatch.lines) && secMatch.lines.length > 0) {
          const lineBelongs = secMatch.lines.some((l) => String(l.id) === String(curr.lineAreaId));
          if (!lineBelongs) {
            nextLineArea = '';
            nextLineAreaId = null;
            nextLineAreaCode = '';
          }
        }
      } else if (!sectionName) {
        nextLineArea = '';
        nextLineAreaId = null;
        nextLineAreaCode = '';
      }

      updated[rowIndex] = {
        ...curr,
        section: sectionName,
        sectionId: newSectionId,
        sectionCode: newSectionCode,
        lineAreaSectionId: newSectionId,
        lineArea: nextLineArea,
        lineAreaId: nextLineAreaId,
        lineAreaCode: nextLineAreaCode
      };
      return updated;
    });
  };

  // Column 14: Responsible Person Confirmation Dept handler (Check phase)
  const handleResponsiblePersonDeptChange = (rowIndex, dept) => {
    setRows((prev) => {
      const updated = [...prev];
      const prevDept = updated[rowIndex]?.responsiblePersonDept || updated[rowIndex]?.department || '';
      const shouldClearStaff = prevDept !== dept;

      const currentEmps = Array.isArray(updated[rowIndex]?.staffEmployees) ? [...updated[rowIndex].staffEmployees] : [];
      if (currentEmps.length > 0) {
        currentEmps[0] = { ...currentEmps[0], department: dept };
      }

      updated[rowIndex] = {
        ...updated[rowIndex],
        responsiblePersonDept: dept,
        staffEmployees: shouldClearStaff ? [] : currentEmps,
        staffEmployee: shouldClearStaff ? '' : (updated[rowIndex]?.staffEmployee || ''),
        staffName: shouldClearStaff ? '' : (updated[rowIndex]?.staffName || ''),
        staffId: shouldClearStaff ? '' : (updated[rowIndex]?.staffId || ''),
        employeeId: shouldClearStaff ? '' : (updated[rowIndex]?.employeeId || '')
      };
      return updated;
    });
  };

  // Scenarios A, C & E: When staff member is selected
  const handleSelectStaffMember = (rowIndex, staffValue, employeeList = []) => {
    if (typeof rowIndex !== 'number' || rowIndex < 0) return;

    if (!staffValue || !staffValue.trim()) {
      setRows((prev) => {
        const updated = [...prev];
        updated[rowIndex] = {
          ...updated[rowIndex],
          staffEmployee: '',
          staffEmployees: [],
          staffName: '',
          staffId: '',
          employeeId: '',
          responsiblePersonConfirmation: ''
        };
        return updated;
      });
      return;
    }

    const trimmedStaff = staffValue.trim();
    const { name: parsedStaffName, code: staffCode } = parseStaffEmployee(trimmedStaff);
    const cleanStaffName = stripEmployeeId(parsedStaffName || trimmedStaff);

    let rawList = Array.isArray(employeeList) && employeeList.length > 0
      ? employeeList
      : trimmedStaff.split(/[,;]/).map((s) => s.trim()).filter(Boolean).map((part) => {
        const p = parseStaffEmployee(part);
        return { name: stripEmployeeId(p.name), code: p.code };
      });

    const employeesArray = rawList.map((emp) => {
      const p = parseStaffEmployee(emp.name ? (emp.code ? `${emp.name} (${emp.code})` : emp.name) : emp);
      const name = stripEmployeeId(emp.name || p.name || '');
      const code = (emp.code || emp.empId || p.code || '').toUpperCase();
      const dbDept = findEmployeeDepartment(`${name} (${code})`, dbEmployees) ||
        findEmployeeDepartment(`${name} (${code})`, VERIFIED_EMPLOYEE_MASTER);
      const department = dbDept || (emp.department && emp.department !== 'CFT' ? emp.department : '') || '';
      return {
        id: emp.id || undefined,
        name,
        code,
        department
      };
    });

    // Match against verified employee records in database using Staff ID and Staff Name
    const primaryDept = employeesArray[0]?.department || findEmployeeDepartment(trimmedStaff, dbEmployees) || findEmployeeDepartment(trimmedStaff, VERIFIED_EMPLOYEE_MASTER);

    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex] || {};

      const newRow = {
        ...currentRow,
        staffEmployee: cleanStaffName,
        staffEmployees: employeesArray,
        staffName: cleanStaffName || currentRow.staffName || employeesArray[0]?.name || '',
        staffId: staffCode || currentRow.staffId || employeesArray[0]?.code || '',
        employeeId: staffCode || currentRow.employeeId || employeesArray[0]?.code || '',
        responsiblePersonConfirmation: cleanStaffName
      };

      if (primaryDept && primaryDept !== 'CFT') {
        newRow.department = primaryDept;
        newRow.responsiblePersonDept = primaryDept;
      }

      updated[rowIndex] = newRow;
      return updated;
    });

    if (!primaryDept && employeesArray.every((e) => !e.department)) {
      showToast?.(
        `Staff member "${trimmedStaff}" could not be matched to a verified database department. Please select department manually.`
      );
    }
  };

  // Detect file category from file extension or mime type
  const getFileType = (fileName = '', mimeType = '') => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext) || mimeType.startsWith('image/')) {
      return 'image';
    }
    if (['pdf'].includes(ext) || mimeType.includes('pdf')) {
      return 'pdf';
    }
    if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      return 'excel';
    }
    if (['ppt', 'pptx'].includes(ext) || mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      return 'ppt';
    }
    return 'document';
  };

  // Open 4-box Upload Selection Modal
  const handleOpenUploadModal = (rowIndex, field, nameField, typeField, columnTitle) => {
    setUploadSelectionModal({
      isOpen: true,
      rowIndex,
      field,
      nameField,
      typeField,
      columnTitle
    });
  };

  // Upload file(s) selected from the 4-box modal
  const handleFileUploadFromModal = async (uploadTypeId, fileOrFiles) => {
    const { rowIndex, field, nameField, typeField } = uploadSelectionModal;
    if (rowIndex === null || !fileOrFiles) return;

    const MAX_SIZE = 15 * 1024 * 1024; // 15 MB limit

    // Multiple uploads permitted strictly for Images
    if (uploadTypeId === 'image') {
      const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
      if (files.length === 0) return;

      const oversized = files.filter((f) => f.size > MAX_SIZE);
      if (oversized.length > 0) {
        const sizeMB = (oversized[0].size / (1024 * 1024)).toFixed(1);
        setAlertModal({
          isOpen: true,
          type: 'warning',
          title: 'File Too Large',
          message: `File "${oversized[0].name}" is ${sizeMB} MB, which exceeds the maximum allowed limit of 15 MB. Please select smaller files.`,
          confirmText: 'Understood'
        });
        return;
      }

      const newImages = [];
      for (const file of files) {
        let serverUrl = null;
        if (topic?.id) {
          try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('fieldName', field);
            fd.append('rowId', `row-${rowIndex + 1}`);
            const uploadRes = await pdcaApi.uploadAttachment(topic.id, fd);
            if (uploadRes?.url) {
              serverUrl = uploadRes.url;
            }
          } catch (err) {
            console.warn('Backend attachment upload failed, using local fallback:', err);
          }
        }

        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });

        newImages.push({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url: serverUrl || dataUrl,
          name: file.name,
          size: file.size,
          type: 'image',
          createdAt: new Date().toISOString()
        });
      }

      setRows((prev) => {
        const updated = [...prev];
        const currentRow = updated[rowIndex] || {};
        const imagesField = field === 'imageBefore' ? 'imagesBefore' : 'imagesAfter';
        const currentList = Array.isArray(currentRow[imagesField])
          ? currentRow[imagesField]
          : (currentRow[field] && (!currentRow[typeField] || currentRow[typeField] === 'image')
            ? [{ id: 'legacy-0', url: currentRow[field], name: currentRow[nameField] || 'Image', type: 'image' }]
            : []);
        const updatedList = [...currentList, ...newImages];

        updated[rowIndex] = {
          ...currentRow,
          [imagesField]: updatedList,
          [field]: updatedList[0]?.url || null,
          [nameField]: updatedList[0]?.name || '',
          [typeField]: 'image'
        };
        return updated;
      });

      // Close selection modal
      setUploadSelectionModal((prev) => ({ ...prev, isOpen: false }));
      return;
    }

    // Single upload for PDF, PPT, Excel documents
    const file = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
    if (!file) return;

    if (file.size > MAX_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setAlertModal({
        isOpen: true,
        type: 'warning',
        title: 'File Too Large',
        message: `The selected file is ${sizeMB} MB, which exceeds the maximum allowed limit of 15 MB. Please select a smaller file.`,
        confirmText: 'Understood'
      });
      return;
    }

    const detectedType = getFileType(file.name, file.type) || uploadTypeId;
    const finalType = ['image', 'pdf', 'excel', 'ppt'].includes(uploadTypeId) ? uploadTypeId : detectedType;

    let serverUrl = null;
    if (topic?.id) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('fieldName', field);
        fd.append('rowId', `row-${rowIndex + 1}`);
        const uploadRes = await pdcaApi.uploadAttachment(topic.id, fd);
        if (uploadRes?.url) {
          serverUrl = uploadRes.url;
        }
      } catch (err) {
        console.warn('Backend attachment upload failed, using local fallback:', err);
      }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const fileSrc = serverUrl || dataUrl;
      const imagesField = field === 'imageBefore' ? 'imagesBefore' : 'imagesAfter';

      setRows((prev) => {
        const updated = [...prev];
        updated[rowIndex] = {
          ...updated[rowIndex],
          [field]: fileSrc,
          [nameField]: file.name,
          [typeField]: finalType,
          [imagesField]: []
        };
        return updated;
      });

      // Close selection modal
      setUploadSelectionModal((prev) => ({ ...prev, isOpen: false }));

      // Directly open the View modal for the uploaded document
      setSelectedImageAction({
        rowIndex,
        field,
        nameField,
        typeField,
        title: field === 'imageBefore' ? 'Image (Before)' : 'Image (After)',
        imageSrc: dataUrl || getMediaUrl(fileSrc),
        imageName: file.name,
        fileType: finalType
      });
    };

    reader.readAsDataURL(file);
  };

  // Open editor screen (applicable for Images only with Pen, Crop, and Add Text)
  const handleOpenEditor = (rowIndex, field, nameField) => {
    const targetFile = rows[rowIndex]?.[field];
    if (!targetFile) return;

    setEditorModal({
      isOpen: true,
      rowIndex,
      field,
      nameField,
      imageSrc: getMediaUrl(targetFile),
      title: `Edit Image - Row ${rowIndex + 1}`
    });
  };

  // Save changes from image editor modal back to the specific row
  const handleSaveEditedImage = (newImageSrc) => {
    if (editorModal.rowIndex === null || !editorModal.field) return;

    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[editorModal.rowIndex] || {};
      const imagesField = editorModal.field === 'imageBefore' ? 'imagesBefore' : 'imagesAfter';
      const nameField = editorModal.field === 'imageBefore' ? 'imageBeforeName' : 'imageAfterName';
      const currentList = Array.isArray(currentRow[imagesField]) ? currentRow[imagesField] : [];

      let updatedList;
      if (editorModal.evidenceImageId) {
        updatedList = currentList.map((img) =>
          img.id === editorModal.evidenceImageId ? { ...img, url: newImageSrc } : img
        );
      } else if (currentList.length > 0) {
        updatedList = [{ ...currentList[0], url: newImageSrc }, ...currentList.slice(1)];
      } else {
        updatedList = [{ id: `img-${Date.now()}`, url: newImageSrc, name: 'Edited Image', type: 'image' }];
      }

      updated[editorModal.rowIndex] = {
        ...currentRow,
        [imagesField]: updatedList,
        [editorModal.field]: updatedList[0]?.url || newImageSrc,
        [nameField]: updatedList[0]?.name || (editorModal.field === 'imageBefore' ? 'Before Image' : 'After Image')
      };
      return updated;
    });

    setEditorModal((prev) => ({ ...prev, isOpen: false }));
  };

  // Open Evidence Viewer Modal for multiple evidence images
  const handleOpenEvidenceViewer = (rowIndex, field) => {
    setEvidenceModal({
      isOpen: true,
      rowIndex,
      field
    });
  };

  // Add multiple images as evidence
  const handleAddEvidenceImages = async (files) => {
    const { rowIndex, field } = evidenceModal;
    if (rowIndex === null || !field) return;

    const newImages = [];
    for (const file of files) {
      let serverUrl = null;
      if (topic?.id) {
        try {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('fieldName', field);
          fd.append('rowId', `row-${rowIndex + 1}`);
          const uploadRes = await pdcaApi.uploadAttachment(topic.id, fd);
          if (uploadRes?.url) {
            serverUrl = uploadRes.url;
          }
        } catch (err) {
          console.warn('Backend upload failed, using data URL fallback:', err);
        }
      }

      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });

      newImages.push({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url: serverUrl || dataUrl,
        name: file.name,
        size: file.size,
        type: 'image',
        createdAt: new Date().toISOString()
      });
    }

    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex] || {};
      const imagesField = field === 'imageBefore' ? 'imagesBefore' : 'imagesAfter';
      const nameField = field === 'imageBefore' ? 'imageBeforeName' : 'imageAfterName';
      const currentList = Array.isArray(currentRow[imagesField])
        ? currentRow[imagesField]
        : (currentRow[field] ? [{ id: 'legacy-0', url: currentRow[field], name: currentRow[nameField] || 'Image', type: 'image' }] : []);
      const updatedList = [...currentList, ...newImages];

      updated[rowIndex] = {
        ...currentRow,
        [imagesField]: updatedList,
        [field]: updatedList[0]?.url || null,
        [nameField]: updatedList[0]?.name || ''
      };
      return updated;
    });
  };

  // Remove individual evidence image (Admin only)
  const handleRemoveEvidenceImage = (imageId) => {
    if (!isAdmin) return;
    const { rowIndex, field } = evidenceModal;
    if (rowIndex === null || !field) return;

    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex] || {};
      const imagesField = field === 'imageBefore' ? 'imagesBefore' : 'imagesAfter';
      const nameField = field === 'imageBefore' ? 'imageBeforeName' : 'imageAfterName';
      const currentList = Array.isArray(currentRow[imagesField])
        ? currentRow[imagesField]
        : (currentRow[field] ? [{ id: 'legacy-0', url: currentRow[field], name: currentRow[nameField] || 'Image', type: 'image' }] : []);
      const updatedList = currentList.filter((img) => img.id !== imageId);

      updated[rowIndex] = {
        ...currentRow,
        [imagesField]: updatedList,
        [field]: updatedList[0]?.url || null,
        [nameField]: updatedList[0]?.name || ''
      };
      return updated;
    });
  };

  // Replace individual evidence image
  const handleReplaceEvidenceImage = async (imageId, file) => {
    const { rowIndex, field } = evidenceModal;
    if (rowIndex === null || !field) return;

    let serverUrl = null;
    if (topic?.id) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('fieldName', field);
        fd.append('rowId', `row-${rowIndex + 1}`);
        const uploadRes = await pdcaApi.uploadAttachment(topic.id, fd);
        if (uploadRes?.url) {
          serverUrl = uploadRes.url;
        }
      } catch (err) {
        console.warn('Backend replace upload failed, using data URL fallback:', err);
      }
    }

    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });

    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex] || {};
      const imagesField = field === 'imageBefore' ? 'imagesBefore' : 'imagesAfter';
      const nameField = field === 'imageBefore' ? 'imageBeforeName' : 'imageAfterName';
      const currentList = Array.isArray(currentRow[imagesField])
        ? currentRow[imagesField]
        : (currentRow[field] ? [{ id: 'legacy-0', url: currentRow[field], name: currentRow[nameField] || 'Image', type: 'image' }] : []);
      const updatedList = currentList.map((img) => {
        if (img.id === imageId) {
          return {
            ...img,
            url: serverUrl || dataUrl,
            name: file.name,
            size: file.size,
            updatedAt: new Date().toISOString()
          };
        }
        return img;
      });

      updated[rowIndex] = {
        ...currentRow,
        [imagesField]: updatedList,
        [field]: updatedList[0]?.url || null,
        [nameField]: updatedList[0]?.name || ''
      };
      return updated;
    });
  };

  // Open editor for a specific evidence image
  const handleOpenEditorForEvidence = (img) => {
    const { rowIndex, field } = evidenceModal;
    setEditorModal({
      isOpen: true,
      rowIndex,
      field,
      evidenceImageId: img.id,
      imageSrc: getMediaUrl(img.url),
      title: `Edit Evidence Photo - Row ${rowIndex + 1} (${field === 'imageBefore' ? 'Before' : 'After'})`
    });
  };

  const handleRemoveFile = (rowIndex, field, nameField, typeField) => {
    if (!isAdmin) return;
    setRows((prev) => {
      const updated = [...prev];
      const imagesField = field === 'imageBefore' ? 'imagesBefore' : 'imagesAfter';
      updated[rowIndex] = {
        ...updated[rowIndex],
        [field]: null,
        [nameField]: '',
        [typeField]: 'image',
        [imagesField]: []
      };
      return updated;
    });
  };

  // Open/view/download uploaded file (image in lightbox, doc in new tab or download)
  const handleViewFile = (fileData, fileName, fileType) => {
    if (!fileData) return;
    const resolvedUrl = getMediaUrl(fileData);
    if (fileType === 'image') {
      setActivePreviewImage(resolvedUrl);
    } else {
      // For PDF, Excel, PPT: trigger download or open
      const link = document.createElement('a');
      link.href = resolvedUrl;
      link.download = fileName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenImageActions = (rowIndex, field) => {
    const row = rows[rowIndex];
    if (!row || !row[field]) return;
    const isBefore = field === 'imageBefore';
    const nameField = isBefore ? 'imageBeforeName' : 'imageAfterName';
    const typeField = isBefore ? 'fileTypeBefore' : 'fileTypeAfter';
    setSelectedImageAction({
      rowIndex,
      field,
      nameField,
      typeField,
      title: isBefore ? 'Image (Before)' : 'Image (After)',
      imageSrc: getMediaUrl(row[field]),
      imageName: row[nameField] || (isBefore ? 'Before Image' : 'After Image'),
      fileType: row[typeField] || 'image',
    });
  };

  const handleAddRow = () => {
    if (!canEditEntireSheet) return;
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleInsertRowAbove = (rowIndex) => {
    if (!canEditEntireSheet) return;
    setRows((prev) => {
      const updated = [...prev];
      updated.splice(rowIndex, 0, createEmptyRow());
      return updated;
    });
  };

  const handleDeleteRow = (rowIndex) => {
    if (!isAdmin) return;
    if (rows.length <= 1) {
      setRows([createEmptyRow()]);
      return;
    }
    setRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
  };

  // Excel-like Enter key down-navigation
  const handleKeyDown = (e, rowIndex, colName) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const nextRowIndex = rowIndex + 1;

      if (nextRowIndex < rows.length) {
        const nextEl = cellRefs.current[`${nextRowIndex}_${colName}`];
        if (nextEl) {
          nextEl.focus();
          if (typeof nextEl.select === 'function') nextEl.select();
        }
      } else {
        setRows((prev) => [...prev, createEmptyRow()]);
        setTimeout(() => {
          const nextEl = cellRefs.current[`${nextRowIndex}_${colName}`];
          if (nextEl) {
            nextEl.focus();
            if (typeof nextEl.select === 'function') nextEl.select();
          }
        }, 50);
      }
    }
  };

  const departmentsList = PDCA_DEPARTMENTS;

  // Auto-adjusting widths for Section and Line/Area columns:
  // Decreased base width when empty or short, expands automatically if a selected option is bigger.
  const { sectionColWidth, lineAreaColWidth } = useMemo(() => {
    let maxSectionLen = 0;
    let maxLineAreaLen = 0;

    for (const r of rows) {
      const secText = (r.section || r.sectionCode || '').trim();
      if (secText.length > maxSectionLen) {
        maxSectionLen = secText.length;
      }
      const lineText = (r.lineArea || r.lineAreaCode || '').trim();
      if (lineText.length > maxLineAreaLen) {
        maxLineAreaLen = lineText.length;
      }
    }

    // Base widths:
    // Section: when empty/placeholder ("Section..."), base width is ~80px (previously 130px).
    // If selected option is bigger, auto-adjusts smoothly to fit without wrapping.
    const secWidth = maxSectionLen === 0
      ? 80
      : Math.min(220, Math.max(80, Math.round(maxSectionLen * 7.2 + 34)));

    // Line/Area: when empty/placeholder ("Line/Area..."), base width is ~90px (previously 130px).
    // If selected option is bigger, auto-adjusts smoothly to fit without wrapping.
    const lineAreaWidth = maxLineAreaLen === 0
      ? 90
      : Math.min(220, Math.max(90, Math.round(maxLineAreaLen * 7.2 + 38)));

    return { sectionColWidth: secWidth, lineAreaColWidth: lineAreaWidth };
  }, [rows]);

  // Live Cumulative Points calculation across this sheet
  const liveCumulativeStats = useMemo(() => {
    let total = 0;
    let inProgress = 0;
    let done = 0;
    let delay = 0;
    let notStarted = 0;

    (rows || []).forEach(r => {
      const hasContent = Boolean(
        r.observation || r.counterMeasure || r.rootCause ||
        r.lineArea || r.department || r.staffEmployee ||
        r.date || r.responseDate || r.status
      );
      if (!hasContent) return;
      total += 1;
      const rawStatus = normalizePDCAStatus(r.status);
      if (rawStatus === 'Done') done += 1;
      else if (rawStatus === 'In- Progress') inProgress += 1;
      else if (rawStatus === 'Delay') delay += 1;
      else notStarted += 1;
    });

    return { total, inProgress, done, delay, notStarted };
  }, [rows]);

  const totalCols = canEditEntireSheet ? 23 : 22;

  const canUserEditActionColsForModalRow = Boolean(
    !readOnly && (
      canEditEntireSheet ||
      (evidenceModal.rowIndex !== null && rows[evidenceModal.rowIndex] && isUserInResponsibleDepartment(rows[evidenceModal.rowIndex], effectiveUser))
    )
  );

  const canUserEditActionColsForSelectedImage = Boolean(
    !readOnly && (
      canEditEntireSheet ||
      (selectedImageAction?.rowIndex !== undefined && rows[selectedImageAction.rowIndex] && isUserResponsibleForRow(rows[selectedImageAction.rowIndex], effectiveUser))
    )
  );

  return (
    <div className="pdca-form-root w-full min-w-0 flex-1 flex flex-col min-h-0 space-y-2 animate-in fade-in duration-150 overflow-hidden">
      {/* Control Bar: Back Button, Save, Calendar Date, Excel Export, Search & Add Row */}
      <div className="sticky top-0 z-30 w-full min-w-0 bg-white rounded-xl border border-[#D5DCE5] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* Control Toolbar */}
        <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs bg-white">
          <div className="flex flex-wrap items-center gap-2 text-slate-500 font-medium">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-slate-700 bg-white hover:bg-slate-100 hover:text-blue-600 transition-colors font-medium text-xs border border-slate-300 shadow-2xs cursor-pointer flex-shrink-0"
              title="Return to PDCA list"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            {!effectiveReadOnly && (
              <button
                type="button"
                disabled={isSaving}
                onClick={saveSheet}
                title="Save all PDCA form changes"
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs cursor-pointer transition-opacity ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            )}
            {!canEditEntireSheet && !effectiveReadOnly && hasAnyRowResponsible && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-300 text-blue-800 text-xs font-bold shadow-2xs">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Responsible Staff Mode</span>
              </span>
            )}
            {effectiveReadOnly && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold shadow-2xs">
                <Eye className="w-3.5 h-3.5 text-amber-600" />
                <span>View-Only Mode</span>
              </span>
            )}
            {/* Calendar Date Picker on PDCA Form Page */}
            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs font-medium text-slate-700 cursor-pointer shadow-2xs hover:bg-slate-100 transition-colors">
              <Calendar className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span className="font-semibold text-slate-600">Date:</span>
              <input
                type="date"
                value={formDate || ''}
                disabled={!canEditEntireSheet}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormDate(val);
                  if (onDateChange) onDateChange(val);
                }}
                className="bg-transparent border-0 outline-none text-xs font-semibold text-slate-800 cursor-pointer p-0"
                title="Select date for this PDCA sheet"
              />
            </label>
            {/* Complete Excel Workbook Export Button */}
            <button
              type="button"
              onClick={handleExportToExcel}
              title="Download complete PDCA sheet with images and dropdown options as Excel (.xlsx)"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs cursor-pointer transition-colors flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
            {/* Send Mail Button */}
            <button
              type="button"
              onClick={handleSendMailClick}
              title="Send PDCA report by email (Requires sheet to be saved and mandatory columns filled)"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-blue-600 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs shadow-2xs cursor-pointer transition-colors flex-shrink-0"
            >
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              <span>Send Mail</span>
            </button>
            {/* PDCA Graph Button */}
            <button
              type="button"
              onClick={() => setShowMonthlyGraph(prev => !prev)}
              title="Toggle PDCA Status Graph (Daily & Monthly analytics for In-Progress, Done, Delay, Not-Started)"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold shadow-2xs cursor-pointer transition-colors flex-shrink-0 ${showMonthlyGraph
                ? 'border-indigo-600 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold'
                : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>PDCA Graph</span>
            </button>
            {/* Done Rows Visibility Toggle Button */}
            {liveCumulativeStats.done > 0 && (
              <button
                type="button"
                onClick={() => setShowDoneRows(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer flex-shrink-0 ${showDoneRows
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                  }`}
                title={showDoneRows ? "Click to hide rows with Done status from sheet" : "Click to view rows with Done status in sheet"}
              >
                {showDoneRows ? <EyeOff className="w-3.5 h-3.5 text-emerald-600" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                <span>{showDoneRows ? 'Hide Done Rows' : `Done Rows Hidden (${liveCumulativeStats.done})`}</span>
              </button>
            )}
            {headerInfo.auditNo ? (
              <span className="text-slate-500 text-xs">
                Audit No: <span className="font-semibold text-slate-700 font-mono">{headerInfo.auditNo}</span>
              </span>
            ) : null}
          </div>

          {/* Right: Search & Add Row */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end min-w-0">
            {/* Search Box */}
            <div className="relative flex-1 sm:w-56 min-w-[150px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sheetSearch}
                onChange={(e) => setSheetSearch(e.target.value)}
                placeholder="Search activities..."
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            {/* Add Row Button (Only for creator/admin) */}
            {canEditEntireSheet && (
              <button
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-3.5 py-1 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add Row</span>
              </button>
            )}
            <FormZoomControls rootSelector=".pdca-form-root" />
          </div>
        </div>
      </div>

      {/* Monthly PDCA Status Analytics Graph */}
      {showMonthlyGraph && (
        <PDCAMonthlyGraph
          rows={rows}
          allPDCARecords={data}
          currentDate={formDate}
          topic={topic}
          onToggleCollapse={() => setShowMonthlyGraph(false)}
        />
      )}

      {/* Spreadsheet Matrix Table Grid */}
      <div className="w-full min-w-0 flex-1 min-h-0 bg-white border border-[#B0BEC5] shadow-xs overflow-auto max-h-[calc(100vh-62px)]">
        <table className="w-full min-w-max text-left table-fixed border-separate border-spacing-0 border-t border-l border-[#B0BEC5] text-[11px]">
          <colgroup>
            <col style={{ width: '56px', minWidth: '52px' }} />
            <col style={{ width: '38px', minWidth: '34px' }} />
            <col style={{ width: '34px', minWidth: '30px' }} />
            <col style={{ width: '124px', minWidth: '118px' }} />
            <col style={{ width: '115px', minWidth: '100px' }} />
            <col style={{ width: '95px', minWidth: '90px' }} />
            <col style={{ width: `${sectionColWidth}px`, minWidth: `${sectionColWidth}px` }} />
            <col style={{ width: `${lineAreaColWidth}px`, minWidth: `${lineAreaColWidth}px` }} />
            <col style={{ width: `${observationWidth}px`, minWidth: `${observationWidth}px` }} />
            <col style={{ width: '150px', minWidth: '140px' }} />
            <col style={{ width: `${rootCauseWidth}px`, minWidth: `${rootCauseWidth}px` }} />
            <col style={{ width: `${actionTakenWidth}px`, minWidth: `${actionTakenWidth}px` }} />
            <col style={{ width: `${counterMeasureWidth}px`, minWidth: `${counterMeasureWidth}px` }} />
            <col style={{ width: '150px', minWidth: '140px' }} />
            <col style={{ width: '80px', minWidth: '75px' }} />
            <col style={{ width: '56px', minWidth: '52px' }} />
            <col style={{ width: '120px', minWidth: '110px' }} />
            <col style={{ width: '120px', minWidth: '105px' }} />
            <col style={{ width: '85px', minWidth: '75px' }} />
            <col style={{ width: '155px', minWidth: '140px' }} />
            <col style={{ width: '95px', minWidth: '85px' }} />
            <col style={{ width: '120px', minWidth: '110px' }} />
            {canEditEntireSheet && <col style={{ width: '44px', minWidth: '40px' }} />}
          </colgroup>

          {/* Table Column Headers - Frozen on vertical scroll */}
          <thead className="sticky top-0 z-20 bg-white shadow-xs">
            {/* Row 1: 会議名 (Meeting Name) [Left] & 作成者 : (Prepared By) [Right] */}
            <tr className="bg-white text-[15px]">
              <th
                colSpan={2}
                className="text-slate-900 font-bold text-center border-r border-b border-[#94A3B8] py-1.5 px-2 select-none whitespace-nowrap text-[16px] tracking-wider"
                style={{ backgroundColor: '#FFFF99' }}
                title="Meeting Name (会議名)"
              >
                会議名
              </th>
              <th
                colSpan={11}
                className="bg-white border-r border-b border-[#94A3B8] p-0 font-normal align-middle"
              >
                <input
                  type="text"
                  value={headerInfo.topicName}
                  readOnly={!canEditEntireSheet}
                  disabled={!canEditEntireSheet}
                  onChange={(e) => setHeaderInfo({ ...headerInfo, topicName: e.target.value })}
                  className={`w-full h-full px-3 py-1.5 bg-transparent border-0 outline-none text-slate-900 font-semibold text-base ${!canEditEntireSheet ? 'cursor-default' : 'focus:bg-blue-50/20'}`}
                />
              </th>
              <th
                colSpan={2}
                className="text-slate-900 font-bold text-center border-r border-b border-[#94A3B8] py-1.5 px-2 select-none whitespace-nowrap text-[16px] tracking-wider"
                style={{ backgroundColor: '#FFFF99' }}
                title="Prepared By (作成者 :)"
              >
                作成者 :
              </th>
              <th
                colSpan={totalCols - 15}
                className="bg-white border-r border-b border-[#94A3B8] p-0 font-normal align-middle"
              >
                <input
                  type="text"
                  value={stripEmployeeId(headerInfo.preparedBy)}
                  readOnly={!canEditEntireSheet}
                  disabled={!canEditEntireSheet}
                  onChange={(e) => setHeaderInfo({ ...headerInfo, preparedBy: stripEmployeeId(e.target.value) })}
                  className={`w-full h-full px-3 py-1.5 bg-transparent border-0 outline-none text-slate-900 font-medium text-base ${!canEditEntireSheet ? 'cursor-default' : 'focus:bg-blue-50/20'}`}
                />
              </th>
            </tr>

            {/* Row 2: 出席者 (Attendees) [Left] & 議事録No (Minutes / Audit No) [Right] */}
            <tr className="bg-white text-[15px]">
              <th
                colSpan={2}
                className="text-slate-900 font-bold text-center border-r border-b border-[#94A3B8] py-1.5 px-2 select-none whitespace-nowrap text-[16px] tracking-wider"
                style={{ backgroundColor: '#FFFF99' }}
                title="Attendees (出席者)"
              >
                出席者
              </th>
              <th
                colSpan={11}
                className="bg-white border-r border-b border-[#94A3B8] p-0 font-normal align-middle"
              >
                <input
                  type="text"
                  value={headerInfo.attendees}
                  readOnly={!canEditEntireSheet}
                  disabled={!canEditEntireSheet}
                  onChange={(e) => setHeaderInfo({ ...headerInfo, attendees: e.target.value })}
                  className={`w-full h-full px-3 py-1.5 bg-transparent border-0 outline-none text-slate-800 font-normal text-xs ${!canEditEntireSheet ? 'cursor-default' : 'focus:bg-blue-50/20'}`}
                />
              </th>
              <th
                colSpan={2}
                className="text-slate-900 font-bold text-center border-r border-b border-[#94A3B8] py-1.5 px-2 select-none whitespace-nowrap text-[12px] tracking-wider"
                style={{ backgroundColor: '#FFFF99' }}
                title="Audit / Minutes No (議事録No)"
              >
                議事録No
              </th>
              <th
                colSpan={totalCols - 15}
                className="bg-white border-r border-b border-[#94A3B8] p-0 font-normal align-middle"
              >
                <input
                  type="text"
                  value={headerInfo.auditNo}
                  readOnly={!canEditEntireSheet}
                  disabled={!canEditEntireSheet}
                  onChange={(e) => setHeaderInfo({ ...headerInfo, auditNo: e.target.value })}
                  className={`w-full h-full px-3 py-1.5 bg-transparent border-0 outline-none text-slate-900 font-medium text-xs ${!canEditEntireSheet ? 'cursor-default' : 'focus:bg-blue-50/20'}`}
                />
              </th>
            </tr>

            {/* Row 3: P D C A Phase Labels Row */}
            <tr className="bg-white text-center select-none text-xs">
              {/* Empty cell above Date, Shift, S.No */}
              <th
                colSpan={3}
                className="bg-white border-r border-b-2 border-[#475569] py-1 px-1"
              />

              {/* P: Plan */}
              <th
                colSpan={8}
                className="bg-white text-slate-900 font-bold border-r border-b-2 border-slate-700 py-1 px-2 text-center text-xs tracking-widest"
                title="Plan (P)"
              >
                P
              </th>

              {/* D: Do */}
              <th
                colSpan={6}
                className="bg-white text-slate-900 font-bold border-r border-b-2 border-slate-700 py-1 px-2 text-center text-xs tracking-widest"
                title="Do (D)"
              >
                D
              </th>

              {/* C: Check */}
              <th
                colSpan={4}
                className="bg-white text-slate-900 font-bold border-r border-b-2 border-slate-700 py-1 px-2 text-center text-xs tracking-widest"
                title="Check (C)"
              >
                C
              </th>

              {/* A: Act */}
              <th
                colSpan={totalCols - 21}
                className="bg-white text-slate-900 font-bold border-r border-b-2 border-slate-700 py-1 px-2 text-center text-xs tracking-widest"
                title="Act (A)"
              >
                A
              </th>
            </tr>

            <tr className="bg-[#ECEFF1] text-slate-800 text-[15px] font-semibold select-none text-center">
              <th rowSpan={2} className="py-1.5 px-0.5 w-[82px] min-w-[78px] text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1]">
                <span>Date</span> <span className="text-red-500 font-bold">*</span>
              </th>
              <th rowSpan={2} className="py-1.5 px-0.5 w-[38px] min-w-[34px] text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] text-[11px]">
                <span>Shift</span> <span className="text-red-500 font-bold">*</span>
              </th>
              <th rowSpan={2} className="py-1.5 px-0.5 w-[34px] min-w-[30px] text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] text-[11px]">
                S.No
              </th>
              <th rowSpan={2} className="py-1.5 px-1 w-[124px] min-w-[118px] text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] text-[14px] whitespace-nowrap">
                <span>Status</span> <span className="text-red-500 font-bold">*</span>
              </th>
              <th rowSpan={2} className="py-1.5 px-1 w-[115px] min-w-[100px] text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] text-[14px]">
                <span>Unit</span> <span className="text-red-500 font-bold">*</span>
              </th>
              <th rowSpan={2} className="py-1.5 px-1 w-[95px] min-w-[90px] text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] text-[14px]">
                <span>Department</span> <span className="text-red-500 font-bold">*</span>
              </th>
              <th
                rowSpan={2}
                style={{
                  width: `${sectionColWidth}px`,
                  minWidth: `${sectionColWidth}px`
                }}
                className="py-1.5 px-1 text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] text-[14px] whitespace-nowrap transition-[width] duration-150"
              >
                <span>Section</span>
              </th>
              <th
                rowSpan={2}
                style={{
                  width: `${lineAreaColWidth}px`,
                  minWidth: `${lineAreaColWidth}px`
                }}
                className="py-1.5 px-1 text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] text-[14px] whitespace-nowrap transition-[width] duration-150"
              >
                <span>Line/Area</span>
              </th>
              <th
                rowSpan={2}
                style={{
                  width: `${observationWidth}px`,
                  minWidth: `${observationWidth}px`,
                  maxWidth: `${observationWidth}px`
                }}
                className="relative py-1.5 px-2 text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] text-[14px] select-none"
              >
                <div className="flex items-center justify-center gap-1 font-bold text-slate-800 pr-2">
                  <span>Observation</span> <span className="text-red-500 font-bold">*</span>
                </div>

                {/* Draggable Resize Handle */}
                <span
                  role="separator"
                  aria-label="Resize Observation column width"
                  aria-orientation="vertical"
                  aria-valuemin={MIN_OBSERVATION_WIDTH}
                  aria-valuemax={MAX_OBSERVATION_WIDTH}
                  aria-valuenow={observationWidth}
                  tabIndex={0}
                  title={`Drag horizontally or use arrow keys to adjust Observation column width (${observationWidth}px)`}
                  onPointerDown={startColResize}
                  onPointerMove={continueColResize}
                  onPointerUp={finishColResize}
                  onPointerCancel={finishColResize}
                  onLostPointerCapture={finishColResize}
                  onKeyDown={handleResizeKeyDown}
                  className="group absolute inset-y-0 right-0 z-20 flex w-3 cursor-col-resize touch-none items-center justify-center hover:bg-blue-100/70 active:bg-blue-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500 transition-colors"
                >
                  <span className="h-4 w-0.5 rounded-full bg-slate-400 opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-active:opacity-100 transition-opacity" />
                </span>
              </th>
              <th rowSpan={2} className="py-1.5 px-1 w-[150px] min-w-[140px] text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] text-[14px]">
                Image Before
              </th>
              <th
                rowSpan={2}
                style={{
                  width: `${rootCauseWidth}px`,
                  minWidth: `${rootCauseWidth}px`,
                  maxWidth: `${rootCauseWidth}px`
                }}
                className="relative py-1.5 px-2 text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] text-[14px] select-none"
              >
                <div className="flex items-center justify-center gap-1 font-bold text-slate-800 pr-2">
                  <span>Root Cause</span>
                </div>

                {/* Draggable Resize Handle */}
                <span
                  role="separator"
                  aria-label="Resize Root Cause column width"
                  aria-orientation="vertical"
                  aria-valuemin={MIN_ROOT_CAUSE_WIDTH}
                  aria-valuemax={MAX_ROOT_CAUSE_WIDTH}
                  aria-valuenow={rootCauseWidth}
                  tabIndex={0}
                  title={`Drag horizontally or use arrow keys to adjust Root Cause column width (${rootCauseWidth}px)`}
                  onPointerDown={startRootCauseResize}
                  onPointerMove={continueRootCauseResize}
                  onPointerUp={finishRootCauseResize}
                  onPointerCancel={finishRootCauseResize}
                  onLostPointerCapture={finishRootCauseResize}
                  onKeyDown={handleRootCauseResizeKeyDown}
                  className="group absolute inset-y-0 right-0 z-20 flex w-3 cursor-col-resize touch-none items-center justify-center hover:bg-blue-100/70 active:bg-blue-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500 transition-colors"
                >
                  <span className="h-4 w-0.5 rounded-full bg-slate-400 opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-active:opacity-100 transition-opacity" />
                </span>
              </th>

              <th
                rowSpan={2}
                style={{
                  width: `${actionTakenWidth}px`,
                  minWidth: `${actionTakenWidth}px`,
                  maxWidth: `${actionTakenWidth}px`
                }}
                className="relative py-1.5 px-2 text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] text-[14px] select-none"
              >
                <div className="flex items-center justify-center gap-1 font-bold text-slate-800 pr-2">
                  <span>Action taken</span>
                </div>

                {/* Draggable Resize Handle */}
                <span
                  role="separator"
                  aria-label="Resize Action taken column width"
                  aria-orientation="vertical"
                  aria-valuemin={MIN_ACTION_TAKEN_WIDTH}
                  aria-valuemax={MAX_ACTION_TAKEN_WIDTH}
                  aria-valuenow={actionTakenWidth}
                  tabIndex={0}
                  title={`Drag horizontally or use arrow keys to adjust Action taken column width (${actionTakenWidth}px)`}
                  onPointerDown={startActionTakenResize}
                  onPointerMove={continueActionTakenResize}
                  onPointerUp={finishActionTakenResize}
                  onPointerCancel={finishActionTakenResize}
                  onLostPointerCapture={finishActionTakenResize}
                  onKeyDown={handleActionTakenResizeKeyDown}
                  className="group absolute inset-y-0 right-0 z-20 flex w-3 cursor-col-resize touch-none items-center justify-center hover:bg-blue-100/70 active:bg-blue-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500 transition-colors"
                >
                  <span className="h-4 w-0.5 rounded-full bg-slate-400 opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-active:opacity-100 transition-opacity" />
                </span>
              </th>

              <th
                rowSpan={2}
                style={{
                  width: `${counterMeasureWidth}px`,
                  minWidth: `${counterMeasureWidth}px`,
                  maxWidth: `${counterMeasureWidth}px`
                }}
                className="relative py-1.5 px-2 text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] leading-tight text-[14px] select-none"
              >
                <div className="flex items-center justify-center gap-1 font-bold text-slate-800 pr-2">
                  <span>Counter Measure</span>
                </div>

                {/* Draggable Resize Handle */}
                <span
                  role="separator"
                  aria-label="Resize Counter Measure column width"
                  aria-orientation="vertical"
                  aria-valuemin={MIN_COUNTER_MEASURE_WIDTH}
                  aria-valuemax={MAX_COUNTER_MEASURE_WIDTH}
                  aria-valuenow={counterMeasureWidth}
                  tabIndex={0}
                  title={`Drag horizontally or use arrow keys to adjust Counter Measure column width (${counterMeasureWidth}px)`}
                  onPointerDown={startCounterMeasureResize}
                  onPointerMove={continueCounterMeasureResize}
                  onPointerUp={finishCounterMeasureResize}
                  onPointerCancel={finishCounterMeasureResize}
                  onLostPointerCapture={finishCounterMeasureResize}
                  onKeyDown={handleCounterMeasureResizeKeyDown}
                  className="group absolute inset-y-0 right-0 z-20 flex w-3 cursor-col-resize touch-none items-center justify-center hover:bg-blue-100/70 active:bg-blue-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500 transition-colors"
                >
                  <span className="h-4 w-0.5 rounded-full bg-slate-400 opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-active:opacity-100 transition-opacity" />
                </span>
              </th>
              <th rowSpan={2} className="py-1.5 px-1 w-[150px] min-w-[140px] text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] text-[14px]">
                Image After
              </th>
              <th rowSpan={2} className="py-1 px-1 w-[80px] min-w-[75px] text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] leading-tight text-[10px]">
                <div className="font-semibold text-slate-800">Std. Duration</div>
                <div className="font-semibold text-[9.5px] text-slate-600">in min</div>
              </th>
              <th rowSpan={2} className="py-1 px-0.5 w-[82px] min-w-[78px] text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] leading-tight">
                <div className="text-[10px] leading-tight font-semibold">Response</div>
                <div className="text-[10px] leading-tight font-semibold">Date</div>
              </th>
              <th
                rowSpan={2}
                className="py-1 px-1 w-[120px] min-w-[110px] text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] leading-tight text-[10px]"
                title="Past revisions of Response Date. Only administrators have permission to delete revised dates."
              >
                <div className="font-semibold text-slate-800">No. of time</div>
                <div className="font-semibold text-slate-800 flex items-center justify-center gap-1">
                  <span>Revised</span>
                  {isAdmin && (
                    <span className="text-[8px] font-bold text-amber-700 bg-amber-100/90 px-1 py-0.2 rounded border border-amber-300" title="Administrator access: you can delete revised dates">
                      Admin
                    </span>
                  )}
                </div>
              </th>
              <th colSpan={4} className="py-1 px-0 border-r border-b border-[#475569] bg-[#ECEFF1] text-center">
                <div className="text-center font-bold text-[9.5px] text-slate-700 px-1">
                  Responsible Person
                </div>
              </th>
              <th rowSpan={2} className="py-2 px-1 w-[185px] min-w-[175px] text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] leading-tight select-none">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-800 leading-tight">
                  <Lock className="w-3 h-3 text-slate-600 flex-shrink-0" />
                  <span>Confirmation</span>
                </div>
              </th>
              {canEditEntireSheet && (
                <th rowSpan={2} className="py-1.5 px-1 w-[44px] min-w-[40px] text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] text-[14px] font-semibold select-none">
                  Actions
                </th>
              )}
            </tr>

            <tr className="bg-[#ECEFF1] text-slate-600 font-semibold text-[13px] select-none text-center">
              <th className="py-0.5 px-1 text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] w-[120px] min-w-[105px]">
                Unit
              </th>
              <th className="py-0.5 px-1 text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] w-[85px] min-w-[75px]">
                Dept
              </th>
              <th className="py-0.5 px-1 text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] w-[155px] min-w-[140px]">
                <span>Staff Name</span> <span className="text-red-500 font-bold">*</span>
              </th>
              <th className="py-0.5 px-1 text-center border-r border-b-2 border-[#475569] bg-[#ECEFF1] w-[95px] min-w-[85px]">
                CFT
              </th>
            </tr>
          </thead>

          {/* Table Rows with thin bordered cells matching reference style */}
          <tbody className="bg-white">
            {(() => {
              let visibleCounter = 0;
              const renderedRows = rows.map((row, idx) => {
                const isDone = normalizePDCAStatus(row.status) === 'Done';
                if (!showDoneRows && isDone) return null;
                visibleCounter += 1;
                const sNo = visibleCounter;
              const canEditEntireRow = canEditEntireSheet;
              const unitSelected = usesCheckboxMultiSelects
                ? (row.units || (row.unit ? [row.unit] : [])).some(unit => PDCA_UNITS.includes(unit))
                : ['Bawal', 'Gujrat'].includes(row.unit);
              const responsibleUnitSelected = usesCheckboxMultiSelects
                ? (row.respUnits || (row.respUnit || row.responsiblePersonUnit ? [row.respUnit || row.responsiblePersonUnit] : [])).some(unit => PDCA_UNITS.includes(unit))
                : ['Bawal', 'Gujrat'].includes(row.respUnit || row.responsiblePersonUnit);
              const isDeptMember = isUserInResponsibleDepartment(row, effectiveUser);
              const canEditActionCols = Boolean(!readOnly && (isCreatorOrAdmin || isDeptMember));

              return (
                <tr
                  key={idx}
                  className="group/row transition-colors"
                >
                  {/* 1. Date (Stacked: Format on top, Calendar icon below) */}
                  <td className="p-1 align-middle text-center border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] w-[82px] min-w-[78px]">
                    <div className="w-full flex items-center justify-center">
                      <CompactDateCell
                        value={row.date}
                        readOnly={!canEditEntireRow}
                        onChange={(val) => handleCellChange(idx, 'date', val)}
                      />
                    </div>
                  </td>

                  {/* 2. Shift (Single letter A/B/C/G, centered in cell) */}
                  <td className="p-1 align-middle text-center border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] w-[38px] min-w-[34px] focus-within:bg-blue-50/30">
                    <div className="relative w-full flex items-center justify-center">
                      <select
                        disabled={!canEditEntireRow}
                        value={row.shift === 'General' ? 'G' : (row.shift || '')}
                        onChange={(e) => handleCellChange(idx, 'shift', e.target.value)}
                        className={`w-full bg-transparent border-0 outline-none px-1 py-1 text-base text-slate-800 font-semibold text-center focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 ${!canEditEntireRow ? 'cursor-default appearance-none' : 'cursor-pointer'} transition-colors appearance-none`}
                      >
                        <option value="">-</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="G">G</option>
                      </select>
                      {canEditEntireRow && (
                        <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      )}
                    </div>
                  </td>

                  {/* 3. S.No (Clean uneditable number, centered) */}
                  <td className="p-1 align-middle text-center border-r border-b border-[#64748B] font-semibold text-slate-600 bg-[#FAFAFA] group-hover/row:bg-[#F1F5F9] select-none w-[34px] min-w-[30px] text-base">
                    {sNo}
                  </td>

                  {/* 4. Status (Centered in cell) */}
                  <td className="p-1 align-middle text-center border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] w-[124px] min-w-[118px]">
                    <div className="w-full flex items-center justify-center">
                      <select
                        disabled={!canEditEntireRow}
                        aria-label={`Status for row ${sNo}`}
                        value={row.status ? normalizePDCAStatus(row.status) : ''}
                        onChange={event => handleStatusChange(idx, event.target.value)}
                        className={`w-full min-w-full rounded-md border px-1.5 py-1 text-[15px] font-medium outline-none whitespace-nowrap ${!canEditEntireRow ? 'cursor-default' : 'cursor-pointer focus:ring-2 focus:ring-blue-300'} text-center ${normalizePDCAStatus(row.status) === 'Done' ? 'bg-green-50 text-green-700 border-green-200' :
                          normalizePDCAStatus(row.status) === 'In- Progress' ? 'bg-yellow-50 text-yellow-800 border-yellow-300' :
                            normalizePDCAStatus(row.status) === 'Delay' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                      >
                        <option value="">Select...</option>
                        <option value="Not-Started" style={{ color: '#1d4ed8', backgroundColor: '#eff6ff' }}>Not-Started</option>
                        <option value="Done" style={{ color: '#15803d', backgroundColor: '#f0fdf4' }}>Done</option>
                        <option value="In- Progress" style={{ color: '#854d0e', backgroundColor: '#fefce8' }}>In- Progress</option>
                        <option value="Delay" style={{ color: '#b91c1c', backgroundColor: '#fef2f2' }}>Delay</option>
                      </select>
                    </div>
                  </td>

                  {/* 5. Unit (Section P) - Immediately before Department */}
                  <td className="p-0.5 align-middle text-center border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] w-[115px] min-w-[100px] focus-within:bg-blue-50/30">
                    {usesCheckboxMultiSelects ? <CheckboxMultiSelect
                      disabled={!canEditEntireRow}
                      value={row.units || (row.unit ? [row.unit] : [])}
                      options={PDCA_UNITS.map(unit => ({ value: unit, label: unit }))}
                      placeholder="Unit..."
                      onChange={values => setRows(prev => prev.map((item, rowIndex) => rowIndex === idx ? { ...item, units: values, unit: values[0] || '' } : item))}
                    /> : <div className="relative w-full flex items-center justify-center">
                      <select disabled={!canEditEntireRow} value={row.unit || ''} onChange={event => handleCellChange(idx, 'unit', event.target.value)} className={`w-full bg-transparent border-0 outline-none pl-1 pr-3 py-1 text-[14px] text-slate-800 text-center font-medium focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 ${!canEditEntireRow ? 'cursor-default' : 'cursor-pointer'} appearance-none truncate`} title={row.unit || 'Select Unit'}>
                        <option value="">Unit...</option><option value="Bawal">Bawal</option><option value="Gujrat">Gujrat</option>
                      </select>
                      {canEditEntireRow && <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none" />}
                    </div>}
                  </td>

                  {/* 6. Department */}
                  <td className="p-0.5 align-middle text-center border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] w-[95px] min-w-[90px]">
                    {usesCheckboxMultiSelects ? <CheckboxMultiSelect
                      disabled={!canEditEntireRow || !unitSelected}
                      value={row.departments || (row.department ? [row.department] : [])}
                      options={departmentsList.map(department => ({ value: department, label: department }))}
                      placeholder="Dept..."
                      onChange={values => setRows(prev => prev.map((item, rowIndex) => {
                        if (rowIndex !== idx) return item;
                        const sections = (item.sections || []).filter(section => !values.length || values.some(department => {
                          const master = VERIFIED_SECTION_MASTER.find(option => String(option.id) === String(section.sectionId)) || { id: section.sectionId, name: section.section };
                          return isSectionRelatedToDepartment(master, department);
                        }));
                        const sectionIds = new Set(sections.map(section => String(section.sectionId)));
                        const lineAreas = (item.lineAreas || []).filter(line => !sections.length ? false : (!line.sectionId || sectionIds.has(String(line.sectionId))));
                        const firstSection = sections[0] || {};
                        const firstLine = lineAreas[0] || {};
                        return { ...item, departments: values, department: values[0] || '', sections, section: firstSection.section || '', sectionId: firstSection.sectionId ?? null, sectionCode: firstSection.sectionCode || '', lineAreas, lineArea: firstLine.lineArea || '', lineAreaId: firstLine.lineAreaId ?? null, lineAreaCode: firstLine.lineAreaCode || '', lineAreaSectionId: firstLine.sectionId ?? null };
                      }))}
                    /> : <div className="flex flex-col h-full justify-between">
                      <div className="flex flex-col divide-y divide-[#CBD5E1]">
                        {((row.departments?.length ? row.departments : (row.department ? [row.department] : ['']))).map((department, deptIndex, all) => <div key={deptIndex} className="relative min-h-[30px] p-0.5">
                          <select disabled={!canEditEntireRow || !unitSelected} value={department || ''} onChange={event => handleUpdateDepartment(idx, deptIndex, event.target.value)} className="w-full bg-transparent px-1 py-1 text-center text-[14px]">
                            <option value="">Dept...</option>{departmentsList.map(value => <option key={value} value={value}>{value}</option>)}
                          </select>
                          {all.length > 1 && canEditEntireRow && <button type="button" onClick={() => handleRemoveDepartment(idx, deptIndex)} className="absolute right-0 top-1 text-slate-400 hover:text-rose-600" title="Remove Department"><X className="h-2.5 w-2.5" /></button>}
                        </div>)}
                      </div>
                      {canEditEntireRow && <button type="button" disabled={!unitSelected} onClick={() => handleAddDepartment(idx)} className="border-t border-slate-100 bg-slate-50/50 px-1 py-0.5 text-[9px] text-blue-600 disabled:opacity-40"><Plus className="inline h-2.5 w-2.5" /> Add</button>}
                    </div>}
                  </td>

                  {/* 7. Section */}
                  <td style={{ width: `${sectionColWidth}px`, minWidth: `${sectionColWidth}px` }} className="p-0.5 align-middle text-center border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] transition-[width] duration-150">
                    {usesCheckboxMultiSelects ? <CheckboxMultiSelect
                      disabled={!canEditEntireRow}
                      value={row.sections?.length ? row.sections.map(section => section.sectionId ?? section.section) : (row.sectionId || row.section ? [row.sectionId || row.section] : [])}
                      options={VERIFIED_SECTION_MASTER
                        .filter(section => !row.departments?.length || row.departments.some(department => isSectionRelatedToDepartment(section, department)))
                        .map(section => ({ value: section.id, label: section.name }))}
                      placeholder="Section..."
                      onChange={values => setRows(prev => prev.map((item, rowIndex) => {
                        if (rowIndex !== idx) return item;
                        const sections = values.map(value => {
                          const master = VERIFIED_SECTION_MASTER.find(section => String(section.id) === String(value));
                          const existing = item.sections?.find(section => String(section.sectionId) === String(value) || section.section === value);
                          return master ? { section: master.name, sectionId: master.id, sectionCode: master.uniCode || '' } : existing;
                        }).filter(Boolean);
                        const first = sections[0] || {};
                        const sectionIds = new Set(sections.map(section => String(section.sectionId)));
                        const lineAreas = (item.lineAreas || []).filter(line => !line.sectionId || sectionIds.has(String(line.sectionId)));
                        const firstLine = lineAreas[0] || {};
                        return { ...item, sections, section: first.section || '', sectionId: first.sectionId ?? null, sectionCode: first.sectionCode || '', lineAreas, lineArea: firstLine.lineArea || '', lineAreaId: firstLine.lineAreaId ?? null, lineAreaCode: firstLine.lineAreaCode || '', lineAreaSectionId: firstLine.sectionId ?? null };
                      }))}
                    /> : <div className="flex flex-col h-full justify-between">
                      {((row.sections?.length ? row.sections : (row.section ? [{ section: row.section, sectionId: row.sectionId, sectionCode: row.sectionCode }] : [{ section: '', sectionId: null, sectionCode: '' }]))).map((section, sectionIndex, all) => <div key={sectionIndex} className="relative min-h-[30px] p-0.5">
                        <SearchableSectionSelect disabled={!canEditEntireRow} value={section.section} sectionId={section.sectionId} sectionCode={section.sectionCode} department={row.departments?.[sectionIndex] || row.departments?.[0] || row.department} onChange={(name, meta) => handleUpdateSection(idx, sectionIndex, name, meta)} placeholder="Section..." />
                        {all.length > 1 && canEditEntireRow && <button type="button" onClick={() => handleRemoveSection(idx, sectionIndex)} className="absolute right-0 top-1 text-slate-400 hover:text-rose-600" title="Remove Section"><X className="h-2.5 w-2.5" /></button>}
                      </div>)}
                      {canEditEntireRow && <button type="button" onClick={() => handleAddSection(idx)} className="border-t border-slate-100 bg-slate-50/50 px-1 py-0.5 text-[9px] text-blue-600"><Plus className="inline h-2.5 w-2.5" /> Add</button>}
                    </div>}
                  </td>

                  {/* 8. Line/Area */}
                  <td style={{ width: `${lineAreaColWidth}px`, minWidth: `${lineAreaColWidth}px` }} className="p-0.5 align-middle text-center border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] transition-[width] duration-150">
                    {usesCheckboxMultiSelects ? <CheckboxMultiSelect
                      disabled={!canEditEntireRow || !(row.sections?.length || row.section)}
                      value={row.lineAreas?.length ? row.lineAreas.map(line => line.lineArea) : (row.lineArea ? [row.lineArea] : [])}
                      options={[...new Set([
                        ...(() => {
                          const cachedSections = getCachedDbSections() || [];
                          const fallbackSections = getDefaultSectionsWithLines();
                          const selectedSections = cachedSections.length ? cachedSections : fallbackSections;
                          return selectedSections
                            .filter(section => (row.sections || []).some(selected => String(selected.sectionId) === String(section.id) || selected.section === section.name) || String(row.sectionId) === String(section.id) || row.section === section.name)
                            .flatMap(section => {
                              const lines = section.lines?.length
                                ? section.lines
                                : (fallbackSections.find(fallback => String(fallback.id) === String(section.id))?.lines || []);
                              return lines.map(line => line?.name || line);
                            });
                        })(),
                        ...(row.lineAreas || []).map(line => line.lineArea)
                      ].filter(Boolean))].map(line => ({ value: line, label: line }))}
                      placeholder="Line/Area..."
                      onChange={values => setRows(prev => prev.map((item, rowIndex) => {
                        if (rowIndex !== idx) return item;
                        const hierarchy = getCachedDbSections() || getDefaultSectionsWithLines();
                        const selectedSections = (item.sections?.length ? item.sections : [{ section: item.section, sectionId: item.sectionId }]).filter(section => section.section || section.sectionId);
                        const lineAreas = values.map(lineArea => {
                          const existing = item.lineAreas?.find(line => line.lineArea === lineArea);
                          const owner = hierarchy.find(section => selectedSections.some(selected => String(selected.sectionId) === String(section.id) || selected.section === section.name) && (section.lines || []).some(line => (line?.name || line) === lineArea));
                          const lineRecord = owner?.lines?.find(line => (line?.name || line) === lineArea);
                          return existing || { lineArea, lineAreaId: lineRecord?.id ?? null, lineAreaCode: lineRecord?.uniCode || '', sectionId: owner?.id ?? selectedSections[0]?.sectionId ?? item.sectionId ?? null };
                        });
                        const first = lineAreas[0] || {};
                        return { ...item, lineAreas, lineArea: first.lineArea || '', lineAreaId: first.lineAreaId ?? null, lineAreaCode: first.lineAreaCode || '', lineAreaSectionId: first.sectionId ?? null };
                      }))}
                    /> : <div className="flex flex-col h-full justify-between">
                      {((row.lineAreas?.length ? row.lineAreas : (row.lineArea ? [{ lineArea: row.lineArea, lineAreaId: row.lineAreaId, lineAreaCode: row.lineAreaCode, sectionId: row.lineAreaSectionId }] : [{ lineArea: '', lineAreaId: null, lineAreaCode: '', sectionId: null }]))).map((line, lineIndex, all) => <div key={lineIndex} className="relative min-h-[30px] p-0.5">
                        <SearchableLineAreaSelect disabled={!canEditEntireRow} value={line.lineArea} sectionId={line.sectionId ?? row.sections?.[lineIndex]?.sectionId ?? row.sectionId} lineId={line.lineAreaId} onChange={(value, meta) => handleUpdateLineArea(idx, lineIndex, value, meta)} />
                        {all.length > 1 && canEditEntireRow && <button type="button" onClick={() => handleRemoveLineArea(idx, lineIndex)} className="absolute right-0 top-1 text-slate-400 hover:text-rose-600" title="Remove Line/Area"><X className="h-2.5 w-2.5" /></button>}
                      </div>)}
                      {canEditEntireRow && <button type="button" onClick={() => handleAddLineArea(idx)} className="border-t border-slate-100 bg-slate-50/50 px-1 py-0.5 text-[9px] text-blue-600"><Plus className="inline h-2.5 w-2.5" /> Add</button>}
                    </div>}
                  </td>

                  {/* 6. Observation (Auto-expanding, resizable width, wrapped multiline text) */}
                  <td
                    style={{
                      width: `${observationWidth}px`,
                      minWidth: `${observationWidth}px`,
                      maxWidth: `${observationWidth}px`
                    }}
                    className="p-1 align-top border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] focus-within:bg-blue-50/30 text-left overflow-hidden"
                  >
                    <AutoResizeTextarea
                      inputRef={(el) => registerRef(idx, 'observation', el)}
                      value={row.observation}
                      readOnly={!canEditEntireRow}
                      onChange={(e) => handleCellChange(idx, 'observation', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'observation')}
                      placeholder="Observation details..."
                      className="w-full bg-transparent border-0 outline-none p-1.5 text-base text-slate-800 text-left leading-relaxed focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 whitespace-pre-wrap break-words"
                    />
                  </td>

                  {/* 7. Image (Before) - Compact when empty; expands only when evidence is uploaded */}
                  <td className="p-1 align-middle border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] w-[150px] min-w-[140px] text-center">
                    {(() => {
                      const isDoc = row.fileTypeBefore && ['pdf', 'excel', 'ppt', 'document'].includes(row.fileTypeBefore);

                      if (isDoc && row.imageBefore) {
                        return (
                          <div className="flex items-center justify-center w-full py-1">
                            <button
                              type="button"
                              onClick={() => setSelectedImageAction({
                                rowIndex: idx,
                                field: 'imageBefore',
                                nameField: 'imageBeforeName',
                                typeField: 'fileTypeBefore',
                                title: 'Image (Before)',
                                imageSrc: row.imageBefore,
                                imageName: row.imageBeforeName || 'Document',
                                fileType: row.fileTypeBefore
                              })}
                              className="group relative inline-flex flex-col items-center justify-center p-2 rounded-xl border border-slate-300 hover:border-blue-500 hover:ring-2 hover:ring-blue-100 transition-all cursor-pointer bg-slate-50/80 shadow-2xs overflow-hidden w-full"
                              title={`Click to view, download, edit, or replace ${row.imageBeforeName || 'file'}`}
                            >
                              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white shadow-2xs border border-slate-200 mb-1">
                                {row.fileTypeBefore === 'pdf' ? (
                                  <FileText className="w-5 h-5 text-rose-600" />
                                ) : row.fileTypeBefore === 'excel' ? (
                                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                                ) : (
                                  <Presentation className="w-5 h-5 text-amber-600" />
                                )}
                              </div>
                              <span className="text-[10px] font-semibold text-slate-700 truncate max-w-[120px] block">
                                {row.imageBeforeName || row.fileTypeBefore?.toUpperCase()}
                              </span>
                              <span className="text-[9px] uppercase font-bold text-slate-400 mt-0.5">
                                {row.fileTypeBefore}
                              </span>
                            </button>
                          </div>
                        );
                      }

                      const beforeImages = Array.isArray(row.imagesBefore)
                        ? row.imagesBefore
                        : (row.imageBefore && (!row.fileTypeBefore || row.fileTypeBefore === 'image')
                          ? [{ id: 'legacy-before-0', url: row.imageBefore, name: row.imageBeforeName || 'Before Image', type: 'image' }]
                          : []);
                      const hasImages = beforeImages.length > 0;

                      if (hasImages) {
                        return (
                          <div className="flex items-center justify-center w-full py-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEvidenceViewer(idx, 'imageBefore')}
                              className="group relative inline-flex flex-col items-center justify-center p-1.5 rounded-xl border border-slate-300 hover:border-blue-500 hover:ring-2 hover:ring-blue-100 transition-all cursor-pointer bg-slate-50/80 shadow-2xs overflow-hidden w-full"
                              title={`Click to view all ${beforeImages.length} evidence photo(s)`}
                            >
                              <div className="relative flex items-center justify-center w-full min-h-[64px] max-h-[85px]">
                                <img
                                  src={getMediaUrl(beforeImages[0].url)}
                                  alt={beforeImages[0].name || `Row ${sNo} Before`}
                                  className="h-16 max-h-[80px] w-auto max-w-[130px] object-contain rounded transition-transform duration-200 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded transition-opacity text-white">
                                  <span className="flex items-center gap-1 bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] font-medium text-white shadow">
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View ({beforeImages.length})</span>
                                  </span>
                                </div>
                              </div>
                              <div className="mt-1 flex items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                                  <Images className="w-3 h-3" />
                                  <span>{beforeImages.length} {beforeImages.length === 1 ? 'Photo' : 'Photos'}</span>
                                </span>
                              </div>
                            </button>
                          </div>
                        );
                      }

                      if (!canEditEntireRow) {
                        return (
                          <div className="flex items-center justify-center w-full py-1 text-slate-300 text-xs select-none">
                            -
                          </div>
                        );
                      }

                      // Compact default icon button when empty - opens 4-box upload selection modal
                      return (
                        <div className="flex items-center justify-center w-full py-1">
                          <button
                            type="button"
                            onClick={() => handleOpenUploadModal(idx, 'imageBefore', 'imageBeforeName', 'fileTypeBefore', 'Image (Before)')}
                            className="group flex items-center justify-center w-9 h-9 rounded-lg border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/80 hover:bg-blue-50/50 transition-all cursor-pointer shadow-2xs hover:scale-105"
                            title="Click to choose upload type"
                          >
                            <ImageIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                          </button>
                        </div>
                      );
                    })()}
                  </td>

                  {/* 8. Root Cause (Auto-expanding, resizable width, vertically and horizontally centered) */}
                  <td
                    style={{
                      width: `${rootCauseWidth}px`,
                      minWidth: `${rootCauseWidth}px`,
                      maxWidth: `${rootCauseWidth}px`
                    }}
                    className="p-1 align-middle border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] focus-within:bg-blue-50/30 text-center overflow-hidden"
                  >
                    <div className="w-full flex items-center justify-center">
                      <AutoResizeTextarea
                        inputRef={(el) => registerRef(idx, 'rootCause', el)}
                        value={row.rootCause}
                        readOnly={!canEditActionCols}
                        onChange={(e) => handleCellChange(idx, 'rootCause', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'rootCause')}
                        placeholder="Root cause..."
                        className="w-full bg-transparent border-0 outline-none p-1.5 text-base text-slate-800 text-center leading-snug whitespace-pre-wrap break-words [overflow-wrap:anywhere] focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center"
                      />
                    </div>
                  </td>

                  {/* 8b. Action taken (Auto-expanding, resizable width, vertically and horizontally centered) */}
                  <td
                    style={{
                      width: `${actionTakenWidth}px`,
                      minWidth: `${actionTakenWidth}px`,
                      maxWidth: `${actionTakenWidth}px`
                    }}
                    className="p-1 align-middle border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] focus-within:bg-blue-50/30 text-center overflow-hidden"
                  >
                    <div className="w-full flex items-center justify-center">
                      <AutoResizeTextarea
                        inputRef={(el) => registerRef(idx, 'actionTaken', el)}
                        value={row.actionTaken || ''}
                        readOnly={!canEditActionCols}
                        onChange={(e) => handleCellChange(idx, 'actionTaken', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'actionTaken')}
                        placeholder={canEditActionCols ? "Action taken..." : ""}
                        className="w-full bg-transparent border-0 outline-none p-1.5 text-base text-slate-800 text-center leading-snug whitespace-pre-wrap break-words [overflow-wrap:anywhere] focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center"
                      />
                    </div>
                  </td>

                  {/* 9. Counter Measure (Auto-expanding, resizable width, vertically and horizontally centered) */}
                  <td
                    style={{
                      width: `${counterMeasureWidth}px`,
                      minWidth: `${counterMeasureWidth}px`,
                      maxWidth: `${counterMeasureWidth}px`
                    }}
                    className="p-1 align-middle border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] focus-within:bg-blue-50/30 text-center overflow-hidden"
                  >
                    <div className="w-full flex items-center justify-center">
                      <AutoResizeTextarea
                        inputRef={(el) => registerRef(idx, 'counterMeasure', el)}
                        value={row.counterMeasure}
                        readOnly={!canEditActionCols}
                        onChange={(e) => handleCellChange(idx, 'counterMeasure', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'counterMeasure')}
                        placeholder="Counter measure..."
                        className="w-full bg-transparent border-0 outline-none p-1.5 text-base text-slate-800 text-center leading-snug whitespace-pre-wrap break-words [overflow-wrap:anywhere] focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center"
                      />
                    </div>
                  </td>

                  {/* 10. Image After - Compact when empty; expands only when evidence is uploaded */}
                  <td className="p-1 align-middle border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] w-[150px] min-w-[140px] text-center">
                    {(() => {
                      const isDoc = row.fileTypeAfter && ['pdf', 'excel', 'ppt', 'document'].includes(row.fileTypeAfter);

                      if (isDoc && row.imageAfter) {
                        return (
                          <div className="flex items-center justify-center w-full py-1">
                            <button
                              type="button"
                              onClick={() => setSelectedImageAction({
                                rowIndex: idx,
                                field: 'imageAfter',
                                nameField: 'imageAfterName',
                                typeField: 'fileTypeAfter',
                                title: 'Image (After)',
                                imageSrc: row.imageAfter,
                                imageName: row.imageAfterName || 'Document',
                                fileType: row.fileTypeAfter
                              })}
                              className="group relative inline-flex flex-col items-center justify-center p-2 rounded-xl border border-slate-300 hover:border-blue-500 hover:ring-2 hover:ring-blue-100 transition-all cursor-pointer bg-slate-50/80 shadow-2xs overflow-hidden w-full"
                              title={`Click to view, download, edit, or replace ${row.imageAfterName || 'file'}`}
                            >
                              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white shadow-2xs border border-slate-200 mb-1">
                                {row.fileTypeAfter === 'pdf' ? (
                                  <FileText className="w-5 h-5 text-rose-600" />
                                ) : row.fileTypeAfter === 'excel' ? (
                                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                                ) : (
                                  <Presentation className="w-5 h-5 text-amber-600" />
                                )}
                              </div>
                              <span className="text-[10px] font-semibold text-slate-700 truncate max-w-[120px] block">
                                {row.imageAfterName || row.fileTypeAfter?.toUpperCase()}
                              </span>
                              <span className="text-[9px] uppercase font-bold text-slate-400 mt-0.5">
                                {row.fileTypeAfter}
                              </span>
                            </button>
                          </div>
                        );
                      }

                      const afterImages = Array.isArray(row.imagesAfter)
                        ? row.imagesAfter
                        : (row.imageAfter && (!row.fileTypeAfter || row.fileTypeAfter === 'image')
                          ? [{ id: 'legacy-after-0', url: row.imageAfter, name: row.imageAfterName || 'After Image', type: 'image' }]
                          : []);
                      const hasImages = afterImages.length > 0;

                      if (hasImages) {
                        return (
                          <div className="flex items-center justify-center w-full py-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEvidenceViewer(idx, 'imageAfter')}
                              className="group relative inline-flex flex-col items-center justify-center p-1.5 rounded-xl border border-slate-300 hover:border-blue-500 hover:ring-2 hover:ring-blue-100 transition-all cursor-pointer bg-slate-50/80 shadow-2xs overflow-hidden w-full"
                              title={`Click to view all ${afterImages.length} evidence photo(s)`}
                            >
                              <div className="relative flex items-center justify-center w-full min-h-[64px] max-h-[85px]">
                                <img
                                  src={getMediaUrl(afterImages[0].url)}
                                  alt={afterImages[0].name || `Row ${sNo} After`}
                                  className="h-16 max-h-[80px] w-auto max-w-[130px] object-contain rounded transition-transform duration-200 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded transition-opacity text-white">
                                  <span className="flex items-center gap-1 bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] font-medium text-white shadow">
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View ({afterImages.length})</span>
                                  </span>
                                </div>
                              </div>
                              <div className="mt-1 flex items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                  <Images className="w-3 h-3" />
                                  <span>{afterImages.length} {afterImages.length === 1 ? 'Photo' : 'Photos'}</span>
                                </span>
                              </div>
                            </button>
                          </div>
                        );
                      }

                      if (!canEditActionCols) {
                        return (
                          <div className="flex items-center justify-center w-full py-1 text-slate-300 text-xs select-none">
                            -
                          </div>
                        );
                      }

                      // Compact default icon button when empty - opens 4-box upload selection modal
                      return (
                        <div className="flex items-center justify-center w-full py-1">
                          <button
                            type="button"
                            onClick={() => handleOpenUploadModal(idx, 'imageAfter', 'imageAfterName', 'fileTypeAfter', 'Image (After)')}
                            className="group flex items-center justify-center w-9 h-9 rounded-lg border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/80 hover:bg-blue-50/50 transition-all cursor-pointer shadow-2xs hover:scale-105"
                            title="Click to choose upload type"
                          >
                            <ImageIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                          </button>
                        </div>
                      );
                    })()}
                  </td>

                  {/* Std. Duration in min - Automatically formats with 'min' suffix */}
                  <td className="p-1 align-middle text-center border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] w-[80px] min-w-[75px] focus-within:bg-blue-50/30">
                    <div className="w-full flex items-center justify-center">
                      <DurationMinCell
                        value={row.stdDurationMin}
                        readOnly={!canEditActionCols}
                        hasResponseDate={Boolean(row.responseDate?.trim())}
                        onDisabledClick={() => {
                          showToast(`Row ${idx + 1}: Select Response Date first before entering Std. Duration.`);
                        }}
                        cellRef={(element) => {
                          if (element) durationCellRefs.current[idx] = element;
                          else delete durationCellRefs.current[idx];
                        }}
                        requiredActionAllowed={Boolean(row.responseDate?.trim() && !hasValidStdDuration(row.stdDurationMin ?? row.stdDuration))}
                        onChange={(val) => handleCellChange(idx, 'stdDurationMin', val)}
                      />
                    </div>
                  </td>

                  {/* Response Date (Stacked: Format on top, Calendar icon below, centered) */}
                  <td className="p-1 align-middle text-center border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] w-[82px] min-w-[78px]">
                    <div className="w-full flex items-center justify-center">
                      <CompactDateCell
                        value={row.responseDate}
                        readOnly={!canEditActionCols}
                        smallText
                        onChange={(val) => handleResponseDateChange(idx, val)}
                      />
                    </div>
                  </td>

                  {/* No. of time Revised - Stacked past and current response dates */}
                  <td className="p-0.5 align-middle text-center border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] w-[120px] min-w-[110px]">
                    {Array.isArray(row.revisedDates) && row.revisedDates.length > 0 ? (
                      <div className="flex flex-col h-full divide-y divide-[#CBD5E1] justify-center">
                        {row.revisedDates.map((rItem, rIdx) => {
                          const revDate = typeof rItem === 'object' && rItem !== null ? rItem.date : rItem;
                          const revReason = typeof rItem === 'object' && rItem !== null ? (rItem.reason || '') : '';
                          return (
                            <div
                              key={rIdx}
                              className="group/rev w-full py-1 px-1 flex flex-col items-center justify-center text-center gap-1 hover:bg-slate-50 transition-colors"
                            >
                              <div className="w-full flex items-center justify-between gap-1">
                                <span className="flex-1 text-[11px] font-semibold text-slate-800 whitespace-nowrap text-center">
                                  {rIdx + 1}) {formatDisplayDate(revDate)}
                                </span>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    ref={(element) => {
                                      const key = `${idx}:${rIdx}`;
                                      if (element) revisionDeleteRefs.current[key] = element;
                                      else delete revisionDeleteRefs.current[key];
                                    }}
                                    data-required-action-allowed="true"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteRevisedDate(idx, rIdx);
                                    }}
                                    title={`Delete Revision ${rIdx + 1} (${formatDisplayDate(revDate)}) - Admin only`}
                                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded transition-colors cursor-pointer shrink-0 opacity-70 group-hover/rev:opacity-100"
                                  >
                                    <X className="w-3 h-3 stroke-[2.5]" />
                                  </button>
                                )}
                              </div>
                              <AutoWidthInput
                                value={revReason}
                                readOnly={!canEditActionCols}
                                inputRef={(element) => {
                                  const key = `${idx}:${rIdx}`;
                                  if (element) revisionReasonRefs.current[key] = element;
                                  else delete revisionReasonRefs.current[key];
                                }}
                                required
                                dataRequiredActionAllowed={!revReason.trim()}
                                onChange={(e) => handleRevisionReasonChange(idx, rIdx, e.target.value)}
                                placeholder="Why revised..."
                                className="text-[10px] text-slate-700 bg-white border border-slate-200 focus:border-blue-500 rounded px-1 py-0.5"
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="w-full py-1 flex items-center justify-center text-slate-300 text-xs select-none">
                        -
                      </div>
                    )}
                  </td>

                  {/* Unit in Responsible Person Confirmation */}
                  <td className="p-0.5 align-middle text-center border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] w-[120px] min-w-[105px]">
                    {usesCheckboxMultiSelects ? <CheckboxMultiSelect
                      disabled={!canEditEntireRow}
                      value={row.respUnits || (row.respUnit ? [row.respUnit] : [])}
                      options={PDCA_UNITS.map(unit => ({ value: unit, label: unit }))}
                      placeholder="Unit..."
                      onChange={values => setRows(prev => prev.map((item, rowIndex) => rowIndex === idx ? { ...item, respUnits: values, respUnit: values[0] || '', responsiblePersonUnit: values[0] || '' } : item))}
                    /> : row.staffEmployees && row.staffEmployees.length > 1 ? <div className="flex flex-col h-full divide-y divide-[#CBD5E1] justify-center">
                      {row.staffEmployees.map((employee, employeeIndex) => <div key={employeeIndex} className="relative min-h-[30px] px-1 py-1">
                        <select disabled={!canEditEntireRow} value={employee.unit || row.respUnit || ''} onChange={event => handleResponsiblePersonUnitChange(idx, event.target.value, employeeIndex)} className="w-full bg-transparent px-1 py-1 text-center text-[10px]">
                          <option value="">Unit...</option><option value="Bawal">Bawal</option><option value="Gujrat">Gujrat</option>
                        </select>
                      </div>)}
                    </div> : <div className="relative w-full flex items-center justify-center">
                      <select disabled={!canEditEntireRow} value={row.respUnit || row.responsiblePersonUnit || ''} onChange={event => handleResponsiblePersonUnitChange(idx, event.target.value)} className="w-full bg-transparent border-0 outline-none pl-1 pr-3 py-1.5 text-[10.5px] text-slate-800 text-center font-medium focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 appearance-none truncate">
                        <option value="">Unit...</option><option value="Bawal">Bawal</option><option value="Gujrat">Gujrat</option>
                      </select>
                      {canEditEntireRow && <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none" />}
                    </div>}
                  </td>

                  {/* Department Dropdown in Responsible Person Confirmation */}
                  <td className="p-0 align-middle text-center border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] w-[85px] min-w-[75px]">
                    {row.staffEmployees && row.staffEmployees.length > 1 ? (
                      <div className="flex flex-col h-full divide-y divide-[#CBD5E1] justify-center">
                        {row.staffEmployees.map((emp, empIdx) => (
                          <div
                            key={empIdx}
                            className="relative w-full py-1 px-1 flex items-center justify-center min-h-[30px] focus-within:bg-blue-50/30"
                          >
                            <select
                              disabled={!canEditEntireRow || !['Bawal', 'Gujrat'].includes(emp.unit || row.respUnit || row.responsiblePersonUnit)}
                              value={
                                (emp.department && emp.department !== 'CFT')
                                  ? emp.department
                                  : (findEmployeeDepartment(emp.code ? `${emp.name} (${emp.code})` : emp.name, dbEmployees) ||
                                    findEmployeeDepartment(emp.code ? `${emp.name} (${emp.code})` : emp.name, VERIFIED_EMPLOYEE_MASTER) ||
                                    (row.responsiblePersonDept !== 'CFT' ? row.responsiblePersonDept : '') ||
                                    '')
                              }
                              onChange={(e) => {
                                const newDept = e.target.value;
                                setRows((prev) => {
                                  const updated = [...prev];
                                  const curr = updated[idx];
                                  const newEmps = [...curr.staffEmployees];
                                  newEmps[empIdx] = { ...newEmps[empIdx], department: newDept };
                                  updated[idx] = {
                                    ...curr,
                                    staffEmployees: newEmps,
                                    responsiblePersonDept: empIdx === 0 ? newDept : curr.responsiblePersonDept
                                  };
                                  return updated;
                                });
                              }}
                              className={`w-full bg-transparent border-0 outline-none text-[10px] font-semibold text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 ${!canEditEntireRow || !['Bawal', 'Gujrat'].includes(emp.unit || row.respUnit || row.responsiblePersonUnit) ? 'cursor-default opacity-50' : 'cursor-pointer'} appearance-none truncate`}
                              title={['Bawal', 'Gujrat'].includes(emp.unit || row.respUnit || row.responsiblePersonUnit)
                                ? (((emp.department && emp.department !== 'CFT') ? emp.department : (findEmployeeDepartment(emp.code ? `${emp.name} (${emp.code})` : emp.name, dbEmployees) || row.responsiblePersonDept)) || 'Select Department')
                                : 'Select the Responsible Confirmation Unit first to choose a Department'}
                            >
                              <option value="">Dept...</option>
                              {emp.department && emp.department !== 'CFT' && !departmentsList.includes(emp.department) && (
                                <option value={emp.department}>{emp.department}</option>
                              )}
                              {departmentsList.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="relative w-full flex items-center justify-center focus-within:bg-blue-50/30">
                        <select
                          disabled={!canEditEntireRow || !responsibleUnitSelected}
                          value={
                            (row.responsiblePersonDept && row.responsiblePersonDept !== 'CFT')
                              ? row.responsiblePersonDept
                              : (row.staffEmployees?.[0]?.department && row.staffEmployees[0].department !== 'CFT'
                                ? row.staffEmployees[0].department
                                : (findEmployeeDepartment(row.staffEmployee, dbEmployees) ||
                                  findEmployeeDepartment(row.staffEmployee, VERIFIED_EMPLOYEE_MASTER) ||
                                  ''))
                          }
                          onChange={(e) => handleResponsiblePersonDeptChange(idx, e.target.value)}
                          className={`w-full bg-transparent border-0 outline-none pl-1 pr-3 py-1.5 text-[10.5px] text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 ${!canEditEntireRow || !responsibleUnitSelected ? 'cursor-default opacity-50' : 'cursor-pointer'} appearance-none truncate`}
                          title={responsibleUnitSelected ? (row.responsiblePersonDept || 'Select Department') : 'Select the Responsible Confirmation Unit first to choose a Department'}
                        >
                          <option value="">Dept...</option>
                          {row.responsiblePersonDept && row.responsiblePersonDept !== 'CFT' && !departmentsList.includes(row.responsiblePersonDept) && (
                            <option value={row.responsiblePersonDept}>{row.responsiblePersonDept}</option>
                          )}
                          {departmentsList.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        {canEditEntireRow && (
                          <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        )}
                      </div>
                    )}
                  </td>

                  {/* 13. Staff Name (Centered in cell, supports multiple employees in a single cell) */}
                  <td className="p-0 align-middle text-center border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] w-[155px] min-w-[140px]">
                    <div className="relative w-full h-full min-h-[34px] flex flex-col justify-center">
                      {row.staffEmployees && row.staffEmployees.length > 1 ? (
                        <div className="flex flex-col h-full divide-y divide-[#CBD5E1] justify-center">
                          {row.staffEmployees.map((emp, empIdx) => {
                            const empDisplay = stripEmployeeId(emp.name);
                            return (
                              <div
                                key={empIdx}
                                className="relative w-full py-1 pl-2 pr-6 flex items-center justify-between gap-1 group/emp min-h-[30px] hover:bg-slate-50/80 transition-colors"
                              >
                                <button
                                  type="button"
                                  onClick={canEditEntireRow ? () => handleOpenAddStaffModal(idx) : undefined}
                                  className={`text-[10px] font-semibold text-slate-800 truncate text-left w-full ${!canEditEntireRow ? 'cursor-default' : 'hover:text-blue-600 cursor-pointer'} transition-colors`}
                                  title={`Group: ${empDisplay}`}
                                >
                                  {empDisplay}
                                </button>
                                {canEditEntireRow && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveStaffEmployee(idx, empIdx);
                                    }}
                                    className="opacity-0 group-hover/emp:opacity-100 hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded transition-all cursor-pointer flex-shrink-0 absolute right-1 top-1/2 -translate-y-1/2"
                                    title={`Remove ${empDisplay} from group`}
                                  >
                                    <X className="w-2.5 h-2.5 stroke-[2.5]" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : row.staffEmployee ? (
                        <div className="relative w-full pl-1.5 pr-6 py-1 flex items-center justify-between gap-0.5 group">
                          {!canEditEntireRow ? (
                            <span className="text-[10px] font-semibold text-slate-800 truncate w-full text-center select-text">
                              {stripEmployeeId(row.staffEmployee)}
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(e) => handleToggleStaffDropdown(idx, e)}
                                className="staff-trigger-btn flex-1 min-w-0 flex flex-col items-center justify-center text-center cursor-pointer hover:opacity-85 transition-opacity"
                                title={`Click to search/change staff: ${stripEmployeeId(row.staffEmployee)}`}
                              >
                                <span className="text-[10px] font-semibold text-slate-800 truncate w-full text-center hover:text-blue-600 transition-colors">
                                  {stripEmployeeId(row.staffEmployee)}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectStaffMember(idx, '');
                                }}
                                className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded transition-all cursor-pointer flex-shrink-0 absolute right-4 top-1/2 -translate-y-1/2"
                                title="Clear staff employee"
                              >
                                <X className="w-3 h-3 stroke-[2.5]" />
                              </button>
                            </>
                          )}
                        </div>
                      ) : !canEditEntireRow ? (
                        <div className="w-full py-1.5 flex items-center justify-center text-slate-300 text-[10px] select-none">
                          -
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleToggleStaffDropdown(idx, e)}
                          className="staff-trigger-btn w-full py-1.5 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors cursor-pointer pl-1 pr-6 group"
                          title="Click to search and select staff employee"
                        >
                          <div className="flex items-center gap-0.5 text-[9.5px] text-slate-400 group-hover:text-blue-600">
                            <Search className="w-2.5 h-2.5" />
                            <span className="truncate">Staff...</span>
                            <ChevronDown className="w-2.5 h-2.5" />
                          </div>
                        </button>
                      )}

                      {/* Down right side '+' option button (Only if creator/admin) */}
                      {canEditEntireRow && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAddStaffModal(idx);
                          }}
                          className="absolute bottom-1 right-1 z-10 w-4 h-4 rounded-full bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 border border-blue-200/80 flex items-center justify-center cursor-pointer transition-all shadow-2xs hover:shadow-xs"
                          title="Add employee to this CFT group (+)"
                        >
                          <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* 14. CFT (Centered in cell) */}
                  <td className="p-1 align-middle text-center border-r border-b border-[#64748B] bg-white group-hover/row:bg-[#F8FAFC] w-[95px] min-w-[85px]">
                    <div className="relative w-full h-full flex items-center justify-center">
                      {row.cftTopic ? (
                        <div className="w-full px-1 py-0.5 flex items-center justify-between gap-0.5 group/cft-cell">
                          {/* Left: Topic Name & Optional Member Name (clickable to open Members dropdown) */}
                          <button
                            type="button"
                            onClick={canEditEntireRow ? (e) => handleToggleCFTDropdown(idx, e, 'members') : undefined}
                            className={`cft-trigger-btn flex-1 min-w-0 text-left ${canEditEntireRow ? 'cursor-pointer hover:opacity-85' : 'cursor-default'} flex flex-col justify-center py-0.5 transition-opacity`}
                            title={`CFT Topic: ${row.cftTopic} (Click to view members)`}
                          >
                            <span
                              className="text-[10px] font-semibold truncate max-w-[85px] leading-tight text-blue-900 hover:text-blue-700 transition-colors"
                              title={row.cftTopic}
                            >
                              {row.cftTopic}
                            </span>
                            {row.cftSelectedName && (
                              <div className="flex items-center gap-0.5 mt-0.5">
                                <span
                                  className={`text-[8.5px] font-medium truncate max-w-[80px] px-0.5 py-0.2 rounded leading-tight ${row.cftSelectedType === 'member'
                                    ? 'text-blue-700 bg-blue-50 border border-blue-200'
                                    : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                    }`}
                                  title={row.cftSelectedName}
                                >
                                  {row.cftSelectedName}
                                </span>
                              </div>
                            )}
                          </button>

                          {/* Right: Edit & Delete buttons (Only when creator/admin) */}
                          {canEditEntireRow && (
                            <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover/cft-cell:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => handleEditCFTTopic(idx, e)}
                                className="p-0.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Change CFT Topic"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteCFT(idx, e)}
                                className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete CFT Topic & Member"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : !canEditEntireRow ? (
                        <span className="text-slate-300 text-[10px] select-none">-</span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleToggleCFTDropdown(idx, e, 'topics')}
                          className="cft-trigger-btn w-full py-1.5 flex items-center justify-center text-slate-300 hover:text-blue-600 hover:bg-blue-50/40 transition-colors cursor-pointer group"
                          title="Click to select CFT Topic"
                        >
                          <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity stroke-[2]" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* 15. Responsible Person Instruction, etc. Column: Upside Name, Middle Confirmed/Not-Confirmed dropdown, Downside Mandatory Input */}
                  <td className="p-1.5 align-top border-r border-b border-[#64748B] w-[185px] min-w-[175px] bg-white group-hover/row:bg-[#F8FAFC] focus-within:bg-blue-50/30 text-left">
                    <div className="w-full flex flex-col items-start justify-start">
                      <ResponsiblePersonInstructionCell
                        row={row}
                        rowIndex={idx}
                        reasonRef={(element) => {
                          if (element) responsibleConfirmationReasonRefs.current[idx] = element;
                          else delete responsibleConfirmationReasonRefs.current[idx];
                        }}
                        confirmationRef={(element) => {
                          if (element) responsibleConfirmationSelectRefs.current[idx] = element;
                          else delete responsibleConfirmationSelectRefs.current[idx];
                        }}
                        reasonRequired={missingRequiredInputs.some((item) => item.type === 'confirmation' && item.rowIndex === idx)}
                        currentUser={effectiveUser}
                        readOnly={!canEditEntireRow}
                        onConfirmationChange={(val, uName) => handleConfirmationChange(idx, val, uName)}
                        onInstructionChange={(text) => handleInstructionChange(idx, text)}
                        sNo={sNo}
                      />
                    </div>
                  </td>

                  {/* 16. Actions Column (Insert Row Above / Delete Row) */}
                  {canEditEntireSheet && (
                    <td className="p-1 align-middle text-center border-r border-b border-[#64748B] w-[44px] min-w-[40px] bg-white group-hover/row:bg-[#F8FAFC]">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleInsertRowAbove(idx)}
                          className="flex items-center justify-center w-5 h-5 shrink-0 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all shadow-2xs cursor-pointer"
                          title="Insert row above"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(idx)}
                            className="flex items-center justify-center w-5 h-5 shrink-0 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-400 hover:bg-rose-50 transition-all shadow-2xs cursor-pointer"
                            title="Delete this row"
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}

                </tr>
              );
            });

            if (renderedRows.filter(Boolean).length === 0) {
              return (
                <tr>
                  <td colSpan={totalCols} className="py-8 text-center text-slate-500 bg-slate-50/50">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Check className="w-8 h-8 text-emerald-600" />
                      <span className="font-semibold text-slate-700">All rows are marked as Done and currently hidden from sheet view.</span>
                      <span className="text-xs text-slate-500">Done status records are fully preserved in graph calculations and Excel exports.</span>
                      <button
                        type="button"
                        onClick={() => setShowDoneRows(true)}
                        className="mt-1 px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer"
                      >
                        Show Hidden Done Rows ({rows.filter(r => normalizePDCAStatus(r.status) === 'Done').length})
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }
            return renderedRows;
          })()}
        </tbody>
        </table>

        {/* Compact bottom strip */}
        <div className="bg-[#F8FAFC] border-t border-[#CBD5E1] px-3 py-1 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>{rows.length} rows</span>
          </div>

          {canEditEntireSheet && (
            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 font-medium border border-slate-300 rounded shadow-2xs cursor-pointer text-[11px]"
            >
              <Plus className="w-3 h-3 text-blue-600" />
              <span>Add Row</span>
            </button>
          )}
        </div>
      </div>

      {/* Image Preview Lightbox Modal */}
      {activePreviewImage && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-150"
          onClick={() => setActivePreviewImage(null)}
        >
          <div
            className="relative bg-white rounded-xl max-w-3xl max-h-[85vh] overflow-hidden p-2 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActivePreviewImage(null)}
              className="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-full transition-colors cursor-pointer shadow-md"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={getMediaUrl(activePreviewImage)}
              alt="Enlarged preview"
              className="max-h-[80vh] w-auto rounded-lg object-contain mx-auto"
            />
          </div>
        </div>,
        document.body
      )}

      {/* Image Editor Screen Modal (Pen, Crop, Add Text) */}
      <ImageEditorModal
        isOpen={editorModal.isOpen}
        imageSrc={editorModal.imageSrc}
        title={editorModal.title}
        onSave={handleSaveEditedImage}
        onClose={() => setEditorModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* 4-Box File Upload Type Selection Modal (Upload Image, Upload PDF, Upload PPT, Upload Excel) */}
      <FileUploadSelectionModal
        isOpen={uploadSelectionModal.isOpen}
        columnTitle={uploadSelectionModal.columnTitle}
        onSelectType={handleFileUploadFromModal}
        onClose={() => setUploadSelectionModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Evidence Viewer Modal (Multiple Evidence Images for Before / After) */}
      <EvidenceViewerModal
        isOpen={evidenceModal.isOpen}
        onClose={() => setEvidenceModal({ isOpen: false, rowIndex: null, field: null })}
        field={evidenceModal.field}
        readOnly={evidenceModal.field === 'imageAfter' ? !canUserEditActionColsForModalRow : !canEditEntireSheet}
        canDelete={isAdmin}
        rowIndex={evidenceModal.rowIndex ?? 0}
        images={
          evidenceModal.rowIndex !== null && evidenceModal.field
            ? (Array.isArray(rows[evidenceModal.rowIndex]?.[evidenceModal.field === 'imageBefore' ? 'imagesBefore' : 'imagesAfter'])
              ? rows[evidenceModal.rowIndex][evidenceModal.field === 'imageBefore' ? 'imagesBefore' : 'imagesAfter']
              : (rows[evidenceModal.rowIndex]?.[evidenceModal.field] ? [{ id: 'legacy-0', url: rows[evidenceModal.rowIndex][evidenceModal.field], name: rows[evidenceModal.rowIndex][evidenceModal.field === 'imageBefore' ? 'imageBeforeName' : 'imageAfterName'] || 'Image', type: 'image' }] : []))
            : []
        }
        onAddImages={handleAddEvidenceImages}
        onRemoveImage={handleRemoveEvidenceImage}
        onReplaceImage={handleReplaceEvidenceImage}
        onOpenEditor={handleOpenEditorForEvidence}
        onViewEnlarged={(url) => setActivePreviewImage(url)}
      />

      {/* Full-view Image & Attachment Modal (Image Name, Edit, Download, Delete actions + Full View) */}
      {selectedImageAction && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setSelectedImageAction(null)}
        >
          <div
            className="relative bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header: Image Name on Left, Actions (Edit, Delete, Download, Close) on Right */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 bg-white z-10 flex-shrink-0">
              {/* Left: File Icon + Image Name + Column Tag */}
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  {selectedImageAction.fileType === 'pdf' ? (
                    <FileText className="w-4 h-4 text-rose-600" />
                  ) : selectedImageAction.fileType === 'excel' ? (
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  ) : selectedImageAction.fileType === 'ppt' ? (
                    <Presentation className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Eye className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 truncate" title={selectedImageAction.imageName}>
                    {selectedImageAction.imageName}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                    <span className="text-blue-600 font-semibold">{selectedImageAction.title}</span>
                    <span>•</span>
                    <span className="uppercase text-[10px] font-bold tracking-wider text-slate-400">{selectedImageAction.fileType}</span>
                  </div>
                </div>
              </div>

              {/* Right: Actions (Replace, Edit, Download, Delete, Close) */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Replace Button (Only if user has edit permission for this field) */}
                {canUserEditActionColsForSelectedImage && (
                  <button
                    type="button"
                    onClick={() => {
                      const { rowIndex, field, nameField, typeField, title } = selectedImageAction;
                      setSelectedImageAction(null);
                      handleOpenUploadModal(rowIndex, field, nameField, typeField, title);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-blue-200"
                    title="Replace this file with a new upload"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Replace</span>
                  </button>
                )}

                {/* Edit Button (visible for images and only if user has edit permission for this field) */}
                {canUserEditActionColsForSelectedImage && selectedImageAction.fileType === 'image' && (
                  <button
                    type="button"
                    onClick={() => {
                      const { rowIndex, field, nameField } = selectedImageAction;
                      setSelectedImageAction(null);
                      handleOpenEditor(rowIndex, field, nameField);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-indigo-200"
                    title="Edit image with pen, crop & text"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}

                {/* Download Button - available for everyone */}
                <button
                  type="button"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = getMediaUrl(selectedImageAction.imageSrc);
                    link.download = selectedImageAction.imageName || 'download';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-slate-200"
                  title="Download file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>

                {/* Delete Button (Only administrators) */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const { rowIndex, field, nameField, typeField } = selectedImageAction;
                      handleRemoveFile(rowIndex, field, nameField, typeField);
                      setSelectedImageAction(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-rose-200"
                    title="Delete this file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}

                <div className="h-5 w-px bg-slate-200 mx-0.5" />

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setSelectedImageAction(null)}
                  className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                  title="Close viewer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main View Area: High-Res Image View with Click to Enlarge */}
            <div className="flex-1 min-h-[320px] max-h-[75vh] bg-slate-900/95 flex items-center justify-center p-3 sm:p-5 overflow-auto relative group">
              {selectedImageAction.fileType === 'image' ? (
                <div className="relative inline-flex items-center justify-center max-w-full max-h-full">
                  <img
                    src={getMediaUrl(selectedImageAction.imageSrc)}
                    alt={selectedImageAction.imageName}
                    onClick={() => setActivePreviewImage(selectedImageAction.imageSrc)}
                    className="max-h-[70vh] max-w-full w-auto h-auto rounded-lg object-contain shadow-2xl mx-auto cursor-zoom-in transition-transform hover:scale-[1.01]"
                    title="Click for full-screen preview"
                  />
                  <button
                    type="button"
                    onClick={() => setActivePreviewImage(selectedImageAction.imageSrc)}
                    className="absolute bottom-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-md backdrop-blur-xs transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Enlarge to full screen"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Click to Enlarge</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl shadow-lg border border-slate-200 max-w-sm">
                  {selectedImageAction.fileType === 'pdf' && <FileText className="w-16 h-16 text-rose-500 mb-2" />}
                  {selectedImageAction.fileType === 'excel' && <FileSpreadsheet className="w-16 h-16 text-emerald-500 mb-2" />}
                  {selectedImageAction.fileType === 'ppt' && <Presentation className="w-16 h-16 text-amber-500 mb-2" />}
                  {selectedImageAction.fileType === 'document' && <File className="w-16 h-16 text-blue-500 mb-2" />}
                  <span className="text-sm font-bold text-slate-800 max-w-[260px] truncate">{selectedImageAction.imageName}</span>
                  <span className="text-xs text-slate-400 uppercase mt-0.5 font-bold tracking-wider">{selectedImageAction.fileType} Document</span>
                  <button
                    type="button"
                    onClick={() => handleViewFile(selectedImageAction.imageSrc, selectedImageAction.imageName, selectedImageAction.fileType)}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm"
                  >
                    Open Document
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CFT Dropdown Popover Portal */}
      {openCFTDropdown && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${openCFTDropdown.top}px`,
            left: `${openCFTDropdown.left}px`,
            width: `${openCFTDropdown.width}px`,
            zIndex: 9999
          }}
          className="cft-dropdown-menu bg-white rounded-xl shadow-2xl border border-slate-200 p-2.5 animate-in fade-in zoom-in-95 duration-100 select-none max-h-[85vh] flex flex-col"
        >
          {openCFTDropdown.mode === 'topics' ? (
            /* ========================================================= */
            /* MODE 1: Show Topic Names ONLY                              */
            /* ========================================================= */
            <>
              {/* Header */}
              <div className="px-2 py-1 pb-2 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Select CFT Topic
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenCFTDropdown(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-colors"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Body: List of Topic Names ONLY */}
              <div className="py-1.5 space-y-1 overflow-y-auto flex-1 pr-0.5 max-h-[350px]">
                {cftLoading ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-medium">Loading CFT records...</span>
                  </div>
                ) : cftError ? (
                  <div className="py-6 px-3 text-center space-y-2">
                    <p className="text-xs text-rose-600 font-medium">{cftError}</p>
                    <button
                      type="button"
                      onClick={loadCFTTopics}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                ) : cftTopics.length === 0 ? (
                  <div className="py-8 px-3 text-center text-slate-500 space-y-1.5">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                    <p className="text-xs font-semibold text-slate-700">No CFT records available. Create a CFT first.</p>
                    <p className="text-[11px] text-slate-400">Genuinely saved CFT records will appear here.</p>
                  </div>
                ) : (
                  <>
                    {/* Clear CFT option when a CFT is currently selected on this row */}
                    {rows[openCFTDropdown.rowIndex]?.cftTopic && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCFT(openCFTDropdown.rowIndex)}
                        className="w-full text-left px-2.5 py-1.5 mb-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center justify-between text-xs font-semibold cursor-pointer"
                        title="Clear CFT and dependent Department and Staff Name"
                      >
                        <div className="flex items-center gap-2">
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Clear CFT Selection</span>
                        </div>
                      </button>
                    )}
                    {cftTopics.map((topicItem) => {
                      const currentRow = rows[openCFTDropdown.rowIndex];
                      const isSelected =
                        currentRow?.cftTopicId === topicItem.id ||
                        (!currentRow?.cftTopicId && currentRow?.cftTopic === topicItem.name);

                      return (
                        <button
                          key={topicItem.id}
                          type="button"
                          onClick={() => handleSelectTopic(openCFTDropdown.rowIndex, topicItem)}
                          className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between cursor-pointer group ${isSelected
                            ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200'
                            : 'hover:bg-slate-100/80 text-slate-800 border border-transparent'
                            }`}
                          title={`Select "${topicItem.name}" (${topicItem.id})`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-blue-600 ring-2 ring-blue-200' : 'bg-slate-400 group-hover:bg-blue-500'
                                }`}
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-semibold leading-snug line-clamp-2 block">
                                {topicItem.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {topicItem.plant ? `${topicItem.plant} • ` : ''}{topicItem.id}
                              </span>
                            </div>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </>
          ) : (
            /* ========================================================= */
            /* MODE 2: Topic Clicked on Row -> Show Members & Employees  */
            /* ========================================================= */
            <>
              {/* Header: Displays selected topic name and Change Topic button */}
              <div className="px-2 py-1.5 pb-2 border-b border-slate-100 flex items-start justify-between shrink-0">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                    <span
                      className="text-xs font-bold text-slate-800 truncate block leading-snug"
                      title={currentCFTTopicObj?.name}
                    >
                      {currentCFTTopicObj?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-500 font-medium">
                      Select Member / Assigned Employee
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        loadCFTTopics();
                        setOpenCFTDropdown((prev) => ({ ...prev, mode: 'topics' }));
                      }}
                      className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                      title="Change to another CFT Topic"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                      <span>Change Topic</span>
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenCFTDropdown(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-colors shrink-0"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Body: Members Name and Assigned Employee Name of this specific topic */}
              <div className="py-2 space-y-3 overflow-y-auto flex-1 pr-0.5 max-h-[350px]">
                {/* 1. Members Name */}
                <div>
                  <div className="px-1 pb-1 text-[9.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3 h-3 text-blue-600" />
                    <span>Members Name</span>
                  </div>
                  {currentCFTTopicObj?.members && currentCFTTopicObj.members.length > 0 ? (
                    <div className="space-y-1">
                      {currentCFTTopicObj.members.map((member, mIdx) => {
                        const isSelected =
                          rows[openCFTDropdown.rowIndex]?.cftSelectedType === 'member' &&
                          rows[openCFTDropdown.rowIndex]?.cftSelectedName === member.name;

                        return (
                          <button
                            key={mIdx}
                            type="button"
                            onClick={() =>
                              handleSelectCFTMember(openCFTDropdown.rowIndex, member, 'member')
                            }
                            className={`w-full text-left px-2.5 py-1.5 rounded-md transition-colors flex items-center justify-between cursor-pointer ${isSelected
                              ? 'bg-blue-50 text-blue-900 border border-blue-200 font-medium'
                              : 'hover:bg-slate-50 text-slate-800'
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[9px] flex items-center justify-center shrink-0">
                                {member.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold leading-tight truncate">
                                  {member.name}
                                </div>
                                {member.code && (
                                  <div className="text-[9.5px] text-slate-500 font-mono leading-tight truncate">
                                    {member.code}
                                  </div>
                                )}
                              </div>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-2 py-1 text-[11px] text-slate-400 italic">No members in this topic</div>
                  )}
                </div>

                {/* 2. Assigned Employee Name */}
                <div className="border-t border-slate-100 pt-2">
                  <div className="px-1 pb-1 text-[9.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-3 h-3 text-emerald-600" />
                    <span>Assigned Employee Name</span>
                  </div>
                  {currentCFTTopicObj?.assignedEmployees && currentCFTTopicObj.assignedEmployees.length > 0 ? (
                    <div className="space-y-1">
                      {currentCFTTopicObj.assignedEmployees.map((emp, eIdx) => {
                        const isSelected =
                          rows[openCFTDropdown.rowIndex]?.cftSelectedType === 'assigned' &&
                          rows[openCFTDropdown.rowIndex]?.cftSelectedName === emp.name;

                        return (
                          <button
                            key={eIdx}
                            type="button"
                            onClick={() =>
                              handleSelectCFTMember(openCFTDropdown.rowIndex, emp, 'assigned')
                            }
                            className={`w-full text-left px-2.5 py-1.5 rounded-md transition-colors flex items-center justify-between cursor-pointer ${isSelected
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-medium'
                              : 'hover:bg-slate-50 text-slate-800'
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[9px] flex items-center justify-center shrink-0">
                                {emp.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold leading-tight truncate">
                                  {emp.name}
                                </div>
                                {emp.code && (
                                  <div className="text-[9.5px] text-slate-500 font-mono leading-tight truncate">
                                    {emp.code}
                                  </div>
                                )}
                              </div>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-2 py-1 text-[11px] text-slate-400 italic">No assigned employees in this topic</div>
                  )}
                </div>

                {/* Optional Clear Member (keep topic only) */}
                {rows[openCFTDropdown.rowIndex]?.cftSelectedName && (
                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleClearMemberOnly(openCFTDropdown.rowIndex)}
                      className="w-full text-center py-1 text-[10.5px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors font-medium border border-rose-200 cursor-pointer"
                    >
                      Clear Member (Keep Topic Only)
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>,
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
                Select Staff Name
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
            {getStaffOptionsForRow(openStaffDropdown.rowIndex).length > 0 ? (
              getStaffOptionsForRow(openStaffDropdown.rowIndex).map((empItem, i) => {
                const empName = empItem.label;
                const empDept = empItem.department;
                const isSelected = rows[openStaffDropdown.rowIndex]?.staffEmployee === empName;
                const isDeptMatch = rows[openStaffDropdown.rowIndex]?.department &&
                  empDept &&
                  empDept.toLowerCase() === rows[openStaffDropdown.rowIndex].department.toLowerCase();

                return (
                  <button
                    key={`${empName}_${i}`}
                    type="button"
                    onClick={() => {
                      const empObj = {
                        id: empItem.id,
                        name: empItem.name || empItem.label,
                        code: empItem.code || '',
                        department: empItem.department || ''
                      };
                      handleSelectStaffMember(openStaffDropdown.rowIndex, empName, [empObj]);
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
              setOpenStaffDropdown(null);
              handleOpenAddStaffModal(idx);
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
        onSave={handleSaveStaffEmployee}
        onClose={() => setStaffEmployeeModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Upgraded PDCA Alert & Confirmation Modal */}
      <PDCAAlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        rowNumber={alertModal.rowNumber}
        missingFields={alertModal.missingFields}
        confirmText={alertModal.confirmText}
        cancelText={alertModal.cancelText}
        onConfirm={alertModal.onConfirm}
      />

      {/* Send Mail Modal */}
      {(() => {
        const currentPdcaSheet = {
          id: topic?.id || topic?.recordId || `PDCA-${Date.now()}`,
          source: isLpaObservationSheet ? 'lpa' : (topic?.source || 'pdca'),
          topic: headerInfo?.topicName || topic?.topic || (isLpaObservationSheet ? (topic?.section === 'cc' ? 'C&C - LPA Observation (PDCA)' : 'Assembly - LPA Observation (PDCA)') : 'PDCA Sheet'),
          title: headerInfo?.topicName || topic?.topic || (isLpaObservationSheet ? (topic?.section === 'cc' ? 'C&C - LPA Observation (PDCA)' : 'Assembly - LPA Observation (PDCA)') : 'PDCA Sheet'),
          section: isLpaObservationSheet ? (topic?.section || (String(headerInfo?.topicName || topic?.topic || '').toLowerCase().includes('c&c') ? 'cc' : 'assembly')) : '',
          plant: topic?.plant || topic?.unit || 'Bawal',
          unit: topic?.plant || topic?.unit || 'Bawal',
          date: formDate,
          sheet: sheetSnapshot
        };
        return (
          <SendMailModal
            isOpen={isSendMailOpen}
            onClose={() => setIsSendMailOpen(false)}
            formType="pdca"
            pdcaOnly={true}
            currentPdcaSheet={currentPdcaSheet}
            pdcaLabel={isLpaObservationSheet ? 'LPA Observation PDCA' : 'PDCA'}
            title={currentPdcaSheet.title}
            metadata={{
              date: formDate,
              auditDate: formDate,
              unit: currentPdcaSheet.unit,
              section: currentPdcaSheet.section,
              sectionName: isLpaObservationSheet ? (currentPdcaSheet.section === 'cc' ? 'C&C' : 'Assembly') : '',
              topicName: currentPdcaSheet.title,
              auditNo: headerInfo?.auditNo
            }}
            pdcaSheets={[currentPdcaSheet]}
          />
        );
      })()}
    </div>
  );
}
