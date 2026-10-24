import { usePDCAAutosave as useFormAutosave } from '@hooks/pdca/usePDCAAutosave.js';
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
  FileSpreadsheet,
  FileText,
  Presentation,
  File,
  Download,
  Edit3,
  Check,
  User,
  Users,
  RefreshCw,
  Layers,
  Mail,
  BarChart3,
  Lock
} from 'lucide-react';
import ImageEditorModal from '../pdca/ImageEditorModal';
import FileUploadSelectionModal from '../pdca/FileUploadSelectionModal';
import AddStaffEmployeeModal from '../pdca/AddStaffEmployeeModal';
import SendMailModal from '../common/SendMailModal';
import PDCAMonthlyGraph from '../pdca/PDCAMonthlyGraph';
import ResponsiblePersonInstructionCell from '../pdca/ResponsiblePersonInstructionCell';
import { usePDCA } from '@hooks/pdca/usePDCA.js';
import pdcaApi from '@/services/api/pdcaApi.js';
import { PDCA_DEPARTMENTS, PDCA_STATUS_OPTIONS, normalizePDCAStatus, computePDCAStatus } from '../../pages/pdca/data/pdcaConstants.js';
import {
  isRecordCreator,
  isUserResponsibleForRow,
  isUserInResponsibleDepartment
} from '../../pages/pdca/data/recordFilters.js';
import { parseStaffEmployee, findEmployeeDepartment, stripEmployeeId, VERIFIED_EMPLOYEE_MASTER } from '../../pages/pdca/data/pdcaEmployees.js';
import SearchableLineAreaSelect, { getCachedDbSections } from '../pdca/SearchableLineAreaSelect';
import SearchableSectionSelect, { VERIFIED_SECTION_MASTER, isSectionRelatedToDepartment } from '../pdca/SearchableSectionSelect';

const createEmptyRow = (customDefaults = {}) => ({
  date: customDefaults.date || '',
  shift: customDefaults.shift || '',
  status: customDefaults.status ? normalizePDCAStatus(customDefaults.status) : 'Not-Started',
  department: customDefaults.department || '',
  section: customDefaults.section || '',
  sectionId: customDefaults.sectionId ?? customDefaults.lineAreaSectionId ?? null,
  sectionCode: customDefaults.sectionCode || '',
  lineArea: customDefaults.lineArea || '',
  lineAreaSectionId: customDefaults.lineAreaSectionId ?? customDefaults.sectionId ?? null,
  lineAreaId: customDefaults.lineAreaId ?? null,
  lineAreaCode: customDefaults.lineAreaCode || '',
  observation: customDefaults.observation || '',
  imageBefore: customDefaults.imageBefore || null,
  imageBeforeName: customDefaults.imageBeforeName || '',
  fileTypeBefore: customDefaults.fileTypeBefore || 'image',
  rootCause: customDefaults.rootCause || '',
  counterMeasure: customDefaults.counterMeasure || '',
  imageAfter: customDefaults.imageAfter || null,
  imageAfterName: customDefaults.imageAfterName || '',
  fileTypeAfter: customDefaults.fileTypeAfter || 'image',
  stdDurationMin: customDefaults.stdDurationMin ?? customDefaults.stdDuration ?? '',
  responseDate: customDefaults.responseDate || '',
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
  responsiblePersonConfirmation: customDefaults.responsiblePersonConfirmation || ''
});

// Auto-expanding textarea that dynamically expands row height when lines are added
function AutoResizeTextarea({ value, onChange, onKeyDown, placeholder, className, inputRef }) {
  const textareaRef = useRef(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const computedHeight = Math.max(el.scrollHeight, 28);
    el.style.height = `${computedHeight}px`;
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value]);

  useEffect(() => {
    adjustHeight();
  }, [value]);

  const handleRef = (el) => {
    textareaRef.current = el;
    if (typeof inputRef === 'function') {
      inputRef(el);
    } else if (inputRef && typeof inputRef === 'object') {
      inputRef.current = el;
    }
  };

  return (
    <textarea
      ref={handleRef}
      rows={1}
      value={value || ''}
      onChange={(e) => {
        onChange(e);
        adjustHeight();
      }}
      onInput={adjustHeight}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.shiftKey) {
          // Allow default line break insertion, then immediately re-measure height
          requestAnimationFrame(adjustHeight);
        }
        if (onKeyDown) onKeyDown(e);
      }}
      onPaste={() => {
        requestAnimationFrame(adjustHeight);
      }}
      placeholder={placeholder}
      className={`resize-none ${className || ''}`}
      style={{ minHeight: '28px', height: 'auto', boxSizing: 'border-box' }}
    />
  );
}

// Compact Date Picker Cell
function CompactDateCell({ value, onChange, smallText = false }) {
  const hiddenInputRef = useRef(null);

  const formatDisplay = (val) => {
    if (!val) return null;
    const parts = val.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      const shortYear = year.slice(-2);
      return {
        line1: `${day}/${month}`,
        line2: shortYear
      };
    }
    return { line1: val, line2: '' };
  };

  const display = formatDisplay(value);

  const handleClick = () => {
    if (hiddenInputRef.current) {
      if (typeof hiddenInputRef.current.showPicker === 'function') {
        hiddenInputRef.current.showPicker();
      } else {
        hiddenInputRef.current.click();
      }
    }
  };

  return (
    <div
      onClick={handleClick}
      className="relative w-full h-full min-h-[38px] flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50/50 transition-colors py-1 group select-none px-0.5"
      title={value ? `Date: ${value} (Click to change)` : 'Click to select date'}
    >
      <input
        ref={hiddenInputRef}
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />

      {display ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="absolute right-0.5 top-0.5 z-20 opacity-0 group-hover:opacity-100 hover:opacity-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-0.5 transition-all rounded cursor-pointer shadow-2xs"
            title="Clear date"
          >
            <X className="w-2.5 h-2.5 stroke-[2.5]" />
          </button>
          <div className="flex flex-col items-center leading-none text-center pointer-events-none">
            <span className={`${smallText ? 'text-[12px]' : 'text-[15px]'} font-bold text-slate-800 tracking-tight`}>
              {display.line1}
            </span>
            {display.line2 && (
              <span className={`${smallText ? 'text-[10px]' : 'text-[13px]'} font-semibold text-slate-500 mt-0.5`}>
                /{display.line2}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="w-full flex items-center justify-center text-center pointer-events-none">
          <Calendar className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors mx-auto" />
        </div>
      )}
    </div>
  );
}

export default function LpaPdcaSheet({
  topic,
  onBack,
  onSave,
  currentDate,
  onDateChange,
  readOnly = false,
  isCreator: propIsCreator = undefined,
  currentUser = null
}) {
  const { data, setData, showToast, userContext } = usePDCA();
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
    } catch {}
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

  // Dropdown state for CFT column
  const [openCFTDropdown, setOpenCFTDropdown] = useState(null);
  const [expandedTopicId, setExpandedTopicId] = useState(null);

  // Dropdown state for Staff column
  const [openStaffDropdown, setOpenStaffDropdown] = useState(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // Database-backed employee master records
  const [dbEmployees, setDbEmployees] = useState(VERIFIED_EMPLOYEE_MASTER);
  const [isSendMailOpen, setIsSendMailOpen] = useState(false);
  const [showMonthlyGraph, setShowMonthlyGraph] = useState(false);

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
    let staffEmployee = (row.staffEmployee || row.responsiblePersonConfirmation || '').trim();
    let staffEmployees = Array.isArray(row.staffEmployees) ? row.staffEmployees : [];
    let staffId = (row.staffId || row.employeeId || '').trim();
    let staffName = (row.staffName || '').trim();

    if (staffEmployees.length > 0) {
      staffEmployees = staffEmployees.map((emp) => {
        const p = parseStaffEmployee(emp.name ? (emp.code ? `${emp.name} (${emp.code})` : emp.name) : emp);
        const name = emp.name || p.name || '';
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
          .map((e) => (e.name || e.fullName || ''))
          .join(', ');
      } else {
        // Strip any (CODE) suffixes from stored staffEmployee display string
        staffEmployee = staffEmployees
          .map((e) => stripEmployeeId(e.name || e.fullName || ''))
          .join(', ');
      }
      if (!staffName) staffName = staffEmployees[0].name || staffEmployees[0].fullName || '';
      if (!staffId) staffId = staffEmployees[0].code || staffEmployees[0].empId || '';
    } else if (staffEmployee) {
      // Strip IDs from stored string before re-parsing
      const cleanedEmployee = stripEmployeeId(staffEmployee);
      const parts = cleanedEmployee.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      staffEmployees = parts.map((part) => {
        const { name, code } = parseStaffEmployee(part);
        const dbDept = findEmployeeDepartment(part, dbEmployees) ||
          findEmployeeDepartment(part, VERIFIED_EMPLOYEE_MASTER);
        const dept = dbDept || (row.department && row.department !== 'CFT' ? row.department : '');
        return { name, code, department: dept };
      });
      staffEmployee = cleanedEmployee;
      if (!staffName || !staffId) {
        const primary = parseStaffEmployee(staffEmployee);
        if (!staffName) staffName = primary.name || '';
        if (!staffId) staffId = primary.code || '';
      }
    } else if (staffName) {
      const dbDept = findEmployeeDepartment(`${staffName} (${staffId})`, dbEmployees) ||
        findEmployeeDepartment(`${staffName} (${staffId})`, VERIFIED_EMPLOYEE_MASTER);
      const dept = dbDept || (row.department && row.department !== 'CFT' ? row.department : '');
      staffEmployee = stripEmployeeId(staffName);
      staffEmployees = [{ name: stripEmployeeId(staffName), code: staffId, department: dept }];
    }

    let confirmation = (row.confirmation || '').trim();
    if (!confirmation && (row.responsiblePersonConfirmation === 'Confirmed' || row.responsiblePersonConfirmation === 'Not - Confirmed' || row.responsiblePersonConfirmation === 'Not-Confirmed')) {
      confirmation = row.responsiblePersonConfirmation.trim();
    }
    if (confirmation === 'Not-Confirmed') confirmation = 'Not - Confirmed';
    const confirmedBy = (row.confirmedBy || '').trim();
    const instruction = (row.instruction || '').trim();

    const computedStatus = computePDCAStatus({
      ...row,
      responseDate: row.responseDate,
      confirmation,
      status: row.status
    }, currentDate);

    return {
      ...row,
      status: computedStatus,
      confirmation,
      confirmedBy,
      instruction,
      imagesBefore,
      imagesAfter,
      imageBefore: isDocBefore ? row.imageBefore : (imagesBefore[0]?.url || row.imageBefore || null),
      imageBeforeName: isDocBefore ? row.imageBeforeName : (imagesBefore[0]?.name || row.imageBeforeName || ''),
      fileTypeBefore: row.fileTypeBefore || (imagesBefore.length > 0 ? 'image' : ''),
      imageAfter: isDocAfter ? row.imageAfter : (imagesAfter[0]?.url || row.imageAfter || null),
      imageAfterName: isDocAfter ? row.imageAfterName : (imagesAfter[0]?.name || row.imageAfterName || ''),
      fileTypeAfter: row.fileTypeAfter || (imagesAfter.length > 0 ? 'image' : ''),
      staffEmployee,
      staffEmployees,
      staffName,
      staffId,
      employeeId: staffId,
      stdDurationMin: row.stdDurationMin ?? row.stdDuration ?? '',
      responsiblePersonConfirmation: confirmation || row.responsiblePersonConfirmation || staffEmployee || ''
    };
  };

  // Local rows state
  const [rows, setRows] = useState(() => {
    if (Array.isArray(topic?.sheet?.rows) && topic.sheet.rows.length > 0) {
      return topic.sheet.rows.map(normalizeRow);
    }
    return Array.from({ length: 10 }, () => createEmptyRow());
  });
  const hasValidStdDuration = (value) => {
    const normalized = String(value ?? '').replace(/\s*min$/i, '').trim();
    return normalized !== '' && Number.isFinite(Number(normalized)) && Number(normalized) >= 0;
  };
  const missingRequiredInputs = rows.flatMap((row, rowIndex) => {
    const missing = [];
    if (['Not - Confirmed', 'Not-Confirmed'].includes((row.confirmation || '').trim()) && !row.instruction?.trim()) {
      missing.push({ type: 'confirmation', rowIndex, key: `confirmation:${rowIndex}` });
    }
    if (row.responseDate?.trim() && !hasValidStdDuration(row.stdDurationMin ?? row.stdDuration)) {
      missing.push({ type: 'duration', rowIndex, key: `duration:${rowIndex}` });
    }
    return missing;
  });
  const missingConfirmationReasonIndices = missingRequiredInputs.filter((item) => item.type === 'confirmation').map((item) => item.rowIndex);
  const requiredConfirmationKey = missingRequiredInputs.map((item) => item.key).join('|');
  const confirmationReasonRefs = useRef({});
  const confirmationSelectRefs = useRef({});
  const durationRefs = useRef({});
  const lastAllowedUrlRef = useRef(typeof window !== 'undefined' ? window.location.href : '');
  const lastRequiredNoticeAtRef = useRef(0);

  const [activePreviewImage, setActivePreviewImage] = useState(null);
  const [selectedImageAction, setSelectedImageAction] = useState(null);
  const [sheetSearch, setSheetSearch] = useState('');

  // Save in-progress state to prevent duplicate submissions
  const [isSaving, setIsSaving] = useState(false);

  // Local Toast notification state
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' | 'info' }

  const notify = (message, type = 'info') => {
    setToast({ message, type });
    try { showToast?.(message); } catch {}
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const requireConfirmationReasonBeforeContinuing = () => {
    const requiredInput = missingRequiredInputs[0];
    if (!requiredInput) return false;
    const rowIndex = requiredInput.rowIndex;
    const message = requiredInput.type === 'confirmation'
      ? `Complete the Responsible Person Confirmation reason in row ${rowIndex + 1} before continuing.`
      : `Enter a valid Std. Duration in min for row ${rowIndex + 1} before continuing.`;
    const input = requiredInput.type === 'confirmation' ? confirmationReasonRefs.current[rowIndex] : durationRefs.current[rowIndex];
    input?.focus();
    input?.reportValidity();
    notifyRef.current(message, 'error');
    return true;
  };

  useEffect(() => {
    if (missingRequiredInputs.length === 0 || typeof document === 'undefined') return undefined;
    const allowedControls = new Set(missingRequiredInputs.flatMap((requiredInput) => requiredInput.type === 'confirmation'
      ? [confirmationReasonRefs.current[requiredInput.rowIndex], confirmationSelectRefs.current[requiredInput.rowIndex]]
      : [durationRefs.current[requiredInput.rowIndex]]).filter(Boolean));
    lastAllowedUrlRef.current = window.location.href;
    const firstRequiredInput = missingRequiredInputs[0];
    const firstRowIndex = firstRequiredInput.rowIndex;
    const message = firstRequiredInput.type === 'confirmation'
      ? `Complete the Responsible Person Confirmation reason in row ${firstRowIndex + 1} before continuing.`
      : `Enter a valid Std. Duration in min for row ${firstRowIndex + 1} before continuing.`;
    const firstInput = firstRequiredInput.type === 'confirmation' ? confirmationReasonRefs.current[firstRowIndex] : durationRefs.current[firstRowIndex];
    firstInput?.focus();
    notifyRef.current(message, 'error');

    const isAllowedControl = (target) => target instanceof Element && Boolean(target.closest('[data-required-action-allowed="true"]'));
    const notifyAndFocus = () => {
      const now = Date.now();
      if (now - lastRequiredNoticeAtRef.current > 800) {
        notifyRef.current(message, 'error');
        lastRequiredNoticeAtRef.current = now;
      }
      const currentRequiredInput = missingRequiredInputs[0];
      const currentInput = currentRequiredInput.type === 'confirmation'
        ? confirmationReasonRefs.current[currentRequiredInput.rowIndex]
        : durationRefs.current[currentRequiredInput.rowIndex];
      currentInput?.focus();
      currentInput?.reportValidity();
    };
    const blockOutsideRequiredCell = (event) => {
      const control = isAllowedControl(event.target) ? event.target.closest('[data-required-action-allowed="true"]') : null;
      if (control && allowedControls.has(control)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      notifyAndFocus();
    };
    const blockKeyboardOutsideRequiredCell = (event) => {
      const navigationKey = event.key === 'Tab' || event.key === 'Escape' || event.altKey ||
        ((event.ctrlKey || event.metaKey) && ['r', 'w', 'l'].includes(event.key.toLowerCase()));
      if (isAllowedControl(event.target) && !navigationKey) return;
      blockOutsideRequiredCell(event);
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

    document.addEventListener('pointerdown', blockOutsideRequiredCell, true);
    document.addEventListener('click', blockOutsideRequiredCell, true);
    document.addEventListener('keydown', blockKeyboardOutsideRequiredCell, true);
    document.addEventListener('focusin', blockOutsideRequiredCell, true);
    document.addEventListener('submit', blockOutsideRequiredCell, true);
    window.addEventListener('popstate', restoreLocation, true);
    window.addEventListener('hashchange', restoreLocation, true);
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => {
      document.removeEventListener('pointerdown', blockOutsideRequiredCell, true);
      document.removeEventListener('click', blockOutsideRequiredCell, true);
      document.removeEventListener('keydown', blockKeyboardOutsideRequiredCell, true);
      document.removeEventListener('focusin', blockOutsideRequiredCell, true);
      document.removeEventListener('submit', blockOutsideRequiredCell, true);
      window.removeEventListener('popstate', restoreLocation, true);
      window.removeEventListener('hashchange', restoreLocation, true);
      window.removeEventListener('beforeunload', warnBeforeLeaving);
    };
  }, [requiredConfirmationKey]);

  // Resizable column widths for Observation, Root Cause, and Counter Measure
  const [observationWidth, setObservationWidth] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('pdca_observation_col_width');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 180 && parsed <= 650) return parsed;
        }
      }
    } catch {}
    return 260;
  });

  const activeObsResizeRef = useRef(null);
  const startObservationResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    activeObsResizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: observationWidth };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
  };
  const continueObservationResize = (event) => {
    const active = activeObsResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    const newWidth = Math.min(650, Math.max(180, active.startWidth + (event.clientX - active.startX)));
    setObservationWidth(newWidth);
  };
  const finishObservationResize = (event) => {
    const active = activeObsResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    activeObsResizeRef.current = null;
    try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('pdca_observation_col_width', String(observationWidth)); } catch {}
  };
  const handleObservationResizeKeyDown = (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); setObservationWidth(prev => Math.max(180, prev - 15)); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); setObservationWidth(prev => Math.min(650, prev + 15)); }
  };
  useEffect(() => {
    try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('pdca_observation_col_width', String(observationWidth)); } catch {}
  }, [observationWidth]);

  const [rootCauseWidth, setRootCauseWidth] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('pdca_root_cause_col_width');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 95 && parsed <= 550) return parsed;
        }
      }
    } catch {}
    return 135;
  });

  const activeRootCauseResizeRef = useRef(null);
  const startRootCauseResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    activeRootCauseResizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: rootCauseWidth };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
  };
  const continueRootCauseResize = (event) => {
    const active = activeRootCauseResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    const newWidth = Math.min(550, Math.max(95, active.startWidth + (event.clientX - active.startX)));
    setRootCauseWidth(newWidth);
  };
  const finishRootCauseResize = (event) => {
    const active = activeRootCauseResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    activeRootCauseResizeRef.current = null;
    try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('pdca_root_cause_col_width', String(rootCauseWidth)); } catch {}
  };
  const handleRootCauseResizeKeyDown = (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); setRootCauseWidth(prev => Math.max(95, prev - 15)); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); setRootCauseWidth(prev => Math.min(550, prev + 15)); }
  };
  useEffect(() => {
    try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('pdca_root_cause_col_width', String(rootCauseWidth)); } catch {}
  }, [rootCauseWidth]);

  const [counterMeasureWidth, setCounterMeasureWidth] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('pdca_counter_measure_col_width');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 95 && parsed <= 550) return parsed;
        }
      }
    } catch {}
    return 145;
  });

  const activeCounterMeasureResizeRef = useRef(null);
  const startCounterMeasureResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    activeCounterMeasureResizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: counterMeasureWidth };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
  };
  const continueCounterMeasureResize = (event) => {
    const active = activeCounterMeasureResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    const newWidth = Math.min(550, Math.max(95, active.startWidth + (event.clientX - active.startX)));
    setCounterMeasureWidth(newWidth);
  };
  const finishCounterMeasureResize = (event) => {
    const active = activeCounterMeasureResizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    activeCounterMeasureResizeRef.current = null;
    try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('pdca_counter_measure_col_width', String(counterMeasureWidth)); } catch {}
  };
  const handleCounterMeasureResizeKeyDown = (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); setCounterMeasureWidth(prev => Math.max(95, prev - 15)); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); setCounterMeasureWidth(prev => Math.min(550, prev + 15)); }
  };
  useEffect(() => {
    try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('pdca_counter_measure_col_width', String(counterMeasureWidth)); } catch {}
  }, [counterMeasureWidth]);

  // Editable Sheet Header Details
  const defaultLpaTopic = topic?.topic || (topic?.section === 'cc' ? 'C&C - LPA Observation (PDCA)' : 'Assembly - LPA Observation (PDCA)');
  const [headerInfo, setHeaderInfo] = useState(() => {
    const raw = topic?.sheet?.headerInfo || {};
    return {
      topicName: raw.topicName && raw.topicName !== 'PDCA - M Tanaka San Audit' ? raw.topicName : defaultLpaTopic,
      preparedBy: stripEmployeeId(raw.preparedBy || ''),
      auditNo: raw.auditNo || '',
      attendees: raw.attendees || ''
    };
  });

  // Load saved sheet from backend on mount or when topic changes
  useEffect(() => {
    if (!topic?.id) return;
    let active = true;
    pdcaApi.getSheet(topic.id).then(savedSheet => {
      if (!active || !savedSheet) return;
      if (savedSheet.headerInfo && Object.keys(savedSheet.headerInfo).length > 0) {
        setHeaderInfo(prev => ({ ...prev, ...savedSheet.headerInfo }));
      }
      if (Array.isArray(savedSheet.rows) && savedSheet.rows.length > 0) {
        setRows(savedSheet.rows.map(normalizeRow));
      } else {
        setRows(prev => (Array.isArray(prev) && prev.length > 0) ? prev.map(normalizeRow) : Array.from({ length: 10 }, () => createEmptyRow()));
      }
    }).catch(err => {
      console.warn('Could not fetch sheet from backend:', err);
    });
    return () => { active = false; };
  }, [topic?.id]);

  const sheetSnapshot = useMemo(() => ({ rows, headerInfo }), [rows, headerInfo]);

  const persistSheet = (sheet) => {
    if (onSave) {
      try { onSave(sheet); } catch (e) { console.error('onSave error:', e); }
    }
    if (topic?.id && setData) {
      try {
        setData(items => {
          if (!items || !items.some(item => item.id === topic.id)) {
            return [{ ...topic, sheet }, ...(items || [])];
          }
          return items.map(item => item.id === topic.id ? { ...item, sheet } : item);
        });
      } catch (e) {
        console.error('setData error:', e);
      }
    }
  };

  useFormAutosave(sheetSnapshot, persistSheet, Boolean(topic?.id) && missingRequiredInputs.length === 0, (msg) => notify(msg, 'info'));

  // Save handler with validation and user feedback
  const saveSheet = async () => {
    if (isSaving) return false;
    if (requireConfirmationReasonBeforeContinuing()) return false;

    // Validate mandatory fields for rows that have observations/findings
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.responseDate?.trim() && !hasValidStdDuration(r.stdDurationMin ?? r.stdDuration)) {
        durationRefs.current[i]?.focus();
        notify(`Row ${i + 1}: Enter a valid Std. Duration in min when Response Date is filled.`, 'error');
        return false;
      }
      const hasContent = Boolean(
        r.observation?.trim() ||
        r.rootCause?.trim() ||
        r.counterMeasure?.trim() ||
        r.department?.trim() ||
        r.staffEmployee?.trim() ||
        r.cftTopic?.trim() ||
        r.imageBefore ||
        r.imageAfter ||
        r.responseDate?.trim() ||
        r.responsiblePersonConfirmation?.trim()
      );

      if (hasContent) {
        const missing = [];
        if (!r.date?.trim()) missing.push('Date');
        if (!r.status?.trim()) missing.push('Status');
        if (!r.lineArea?.trim()) missing.push('Line/Area');
        if (!r.observation?.trim()) missing.push('Observation');

        if (missing.length > 0) {
          notify(`Row ${i + 1}: Required field${missing.length > 1 ? 's' : ''} (${missing.join(', ')}) missing.`, 'error');
          return false;
        }
      }
    }

    setIsSaving(true);
    try {
      if (topic?.id) {
        await pdcaApi.saveSheet(topic.id, sheetSnapshot);
      }
      persistSheet(sheetSnapshot);
      notify('PDCA form saved successfully.', 'success');
      onSave?.(sheetSnapshot);
      return true;
    } catch (error) {
      notify(error.message || 'Could not save PDCA form. Please try again.', 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Back button handler
  const handleBack = () => {
    if (requireConfirmationReasonBeforeContinuing()) return;
    // Silently persist any current snapshot draft before navigating
    try {
      persistSheet(sheetSnapshot);
    } catch (e) {
      console.warn('Draft auto-persist on back:', e);
    }
    // Navigate back to LPA
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  const topicName = headerInfo.topicName || topic?.topic || '';
  const createdByName = topic?.createdBy?.name || '';
  const createdByCode = topic?.createdBy?.code || '';

  // Fetch verified employee records from database via metadata API
  useEffect(() => {
    let active = true;
    pdcaApi.getMetadata().then((meta) => {
      if (!active || !meta) return;
      if (Array.isArray(meta.employees) && meta.employees.length > 0) {
        setDbEmployees(meta.employees);
      }
    }).catch((err) => {
      console.warn('Could not fetch employee metadata from database:', err);
    });
    return () => { active = false; };
  }, []);

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
          const members = [];
          if (item.createdBy && item.createdBy.name) {
            members.push({
              name: item.createdBy.name,
              code: item.createdBy.code || '',
              role: 'Lead Member'
            });
          }
          const assignedEmployees = Array.isArray(item.assignedMembers)
            ? item.assignedMembers
                .map((m) => (typeof m === 'object' ? { name: m.name || '', code: m.code || '' } : { name: String(m), code: '' }))
                .filter((m) => m.name)
            : [];

          map.set(item.id, {
            id: item.id,
            name: item.topic || item.name || '',
            plant: item.plant || '',
            members,
            assignedEmployees
          });
        }
      });
      setCftTopics(Array.from(map.values()));
    } catch (err) {
      console.error('Failed to load CFT topics:', err);
      setCftError(err?.message || 'Failed to load CFT records');
    } finally {
      setCftLoading(false);
    }
  }, [topic?.plant]);

  useEffect(() => {
    loadCFTTopics();
  }, [loadCFTTopics]);

  // Available CFT topics
  const availableCFTTopics = useMemo(() => {
    const map = new Map();
    if (topic?.scope === 'CFT' && topic?.id) {
      map.set(topic.id, {
        id: topic.id,
        name: topicName,
        members: [{ name: createdByName, code: createdByCode, role: 'Lead Member' }],
        assignedEmployees: Array.isArray(topic.assignedMembers) ? topic.assignedMembers : []
      });
    }
    cftTopics.forEach((item) => {
      if (item && item.id && !map.has(item.id)) {
        map.set(item.id, item);
      }
    });
    return Array.from(map.values());
  }, [cftTopics, topic, topicName, createdByName, createdByCode]);

  // Close CFT dropdown on outside click or scroll
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

  // Close Staff dropdown on outside click or scroll
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

  const employeeOptionList = useMemo(() => {
    const map = new Map();
    dbEmployees.forEach((emp) => {
      const label = emp.name;
      if (!map.has(label)) {
        map.set(label, {
          label,
          name: emp.name,
          code: emp.code || '',
          department: emp.department || ''
        });
      }
    });

    (topic?.assignedMembers || []).forEach((m) => {
      if (m?.name) {
        const label = m.name;
        if (!map.has(label)) {
          map.set(label, {
            label,
            name: m.name,
            code: m.code || '',
            department: ''
          });
        }
      }
    });

    rows.forEach((r) => {
      if (r.staffEmployee?.trim()) {
        const label = r.staffEmployee.trim();
        if (!map.has(label)) {
          map.set(label, {
            label,
            name: label,
            code: '',
            department: r.department || ''
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
      list = employeeOptionList.filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          item.name.toLowerCase().includes(query) ||
          item.code.toLowerCase().includes(query) ||
          (item.department && item.department.toLowerCase().includes(query))
      );
    }

    if (currentDept) {
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

  const handleToggleCFTDropdown = (rowIndex, e, initialTab = 'topics') => {
    e.stopPropagation();
    if (openCFTDropdown?.rowIndex === rowIndex) {
      setOpenCFTDropdown(null);
      return;
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
    const estimatedHeight = 340;
    if (topPos + estimatedHeight > window.innerHeight - 12 && rect.top - estimatedHeight > 12) {
      topPos = rect.top - estimatedHeight - 4;
    }

    const row = rows[rowIndex];
    const targetTopicId = row?.cftTopicId || availableCFTTopics[0]?.id || null;

    setOpenCFTDropdown({
      rowIndex,
      top: topPos,
      left: Math.max(12, leftPos),
      width: dropdownWidth,
      tab: initialTab
    });
    setExpandedTopicId(targetTopicId);
  };

  const handleSelectCFT = (rowIndex, topicObj, selectedType = 'topic', personObj = null) => {
    setRows((prev) => {
      const updated = [...prev];
      let assignedStr = '';
      if (selectedType === 'member' && personObj) {
        assignedStr = `${personObj.name} (${personObj.code})`;
      } else if (selectedType === 'assigned' && personObj) {
        assignedStr = `${personObj.name} (${personObj.code})`;
      } else {
        const list = topicObj.assignedEmployees || [];
        assignedStr = list.length > 0
          ? (list.length === 1 ? `${list[0].name} (${list[0].code})` : list.map(e => `${e.name} (${e.code})`).join(', '))
          : '';
      }

      // Automatically link CFT assigned employees or selected member into staffEmployees if not set
      let newStaffEmployees = updated[rowIndex].staffEmployees || [];
      let newStaffEmployee = updated[rowIndex].staffEmployee || '';
      let newDept = updated[rowIndex].department;

      if (!newStaffEmployee || newStaffEmployees.length === 0) {
        if (personObj) {
          const personDept = personObj.department || findEmployeeDepartment(personObj.code ? `${personObj.name} (${personObj.code})` : personObj.name, dbEmployees) || '';
          newStaffEmployees = [{
            name: stripEmployeeId(personObj.name),
            code: personObj.code || '',
            department: personDept
          }];
          newStaffEmployee = stripEmployeeId(personObj.name);
          if (personDept && !newDept) newDept = personDept;
        } else if (Array.isArray(topicObj.assignedEmployees) && topicObj.assignedEmployees.length > 0) {
          newStaffEmployees = topicObj.assignedEmployees.map((ae) => {
            const aeDept = ae.department || findEmployeeDepartment(ae.code ? `${ae.name} (${ae.code})` : ae.name, dbEmployees) || '';
            return {
              name: stripEmployeeId(ae.name),
              code: ae.code || '',
              department: aeDept
            };
          });
          newStaffEmployee = newStaffEmployees.map(e => e.name).join(', ');
          if (newStaffEmployees[0]?.department && !newDept) {
            newDept = newStaffEmployees[0].department;
          }
        }
      }

      updated[rowIndex] = {
        ...updated[rowIndex],
        cftTopic: topicObj.name,
        cftTopicId: topicObj.id,
        cftSelectedType: selectedType,
        cftSelectedName: personObj ? personObj.name : '',
        cftSelectedCode: personObj ? personObj.code : '',
        assignedEmployee: assignedStr,
        staffEmployee: newStaffEmployee,
        staffEmployees: newStaffEmployees,
        department: newDept,
        responsiblePersonConfirmation: newStaffEmployee
      };
      return updated;
    });
    setOpenCFTDropdown(null);
  };

  const handleDeleteCFT = (rowIndex, e) => {
    e.stopPropagation();
    setRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        cftTopic: '',
        cftTopicId: '',
        cftSelectedType: '',
        cftSelectedName: '',
        cftSelectedCode: '',
        assignedEmployee: ''
      };
      return updated;
    });
  };

  const handleEditCFTTopic = (rowIndex, e) => {
    handleToggleCFTDropdown(rowIndex, e, 'topics');
  };

  // Staff Employee Modal state
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
          .map((e) => stripEmployeeId(e.name || ''))
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
    const { name: staffName, code: staffCode } = parseStaffEmployee(trimmedStaff);

    let employeesArray = Array.isArray(employeeList) && employeeList.length > 0
      ? employeeList.map((e) => ({
          ...e,
          department: e.department || findEmployeeDepartment(e.code ? `${e.name} (${e.code})` : e.name, dbEmployees) || ''
        }))
      : trimmedStaff.split(/[,;]/).map((s) => s.trim()).filter(Boolean).map((part) => {
          const p = parseStaffEmployee(part);
          return {
            name: p.name,
            code: p.code,
            department: findEmployeeDepartment(part, dbEmployees) || ''
          };
        });

    const matchedDept = findEmployeeDepartment(trimmedStaff, dbEmployees);

    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex] || {};

      const cleanStaff = stripEmployeeId(trimmedStaff);
      const newRow = {
        ...currentRow,
        staffEmployee: cleanStaff,
        staffEmployees: employeesArray.map((e) => ({ ...e, name: stripEmployeeId(e.name || '') })),
        staffName: stripEmployeeId(staffName || currentRow.staffName || ''),
        staffId: staffCode || currentRow.staffId || '',
        employeeId: staffCode || currentRow.employeeId || '',
        responsiblePersonConfirmation: cleanStaff
      };

      if (matchedDept) {
        newRow.department = matchedDept;
      }

      updated[rowIndex] = newRow;
      return updated;
    });

    if (!matchedDept) {
      notify?.(`Staff member "${trimmedStaff}" could not be matched to a verified database department. Please select department manually.`, 'info');
    }
  };

  const handleSaveStaffEmployee = (rowIndex, fullStaffString, employeeList = []) => {
    handleSelectStaffMember(rowIndex, fullStaffString, employeeList);
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

  // Column 6: Section change handler (Plan phase - before Line/Area)
  const handleSectionChange = (rowIndex, sectionName, meta = {}) => {
    setRows((prev) => {
      const updated = [...prev];
      const curr = updated[rowIndex];
      if (!curr) return prev;

      const newSectionId = meta?.sectionId ?? null;
      const newSectionCode = meta?.sectionCode ?? '';

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

  // Row heights tracking for side panel
  const theadRef = useRef(null);
  const actionsHeaderRef = useRef(null);
  const [theadHeight, setTheadHeight] = useState(0);
  const [actionsHeaderHeight, setActionsHeaderHeight] = useState(0);
  const [rowHeights, setRowHeights] = useState({});
  const trRowRefs = useRef({});
  const rowObserverRef = useRef(null);
  const cellRefs = useRef({});

  useLayoutEffect(() => {
    if (theadRef.current) {
      setTheadHeight(theadRef.current.getBoundingClientRect().height);
    }
    if (actionsHeaderRef.current) {
      setActionsHeaderHeight(actionsHeaderRef.current.getBoundingClientRect().height);
    }
  });

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      setRowHeights((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const entry of entries) {
          const idx = entry.target.__rowIdx;
          if (idx !== undefined) {
            const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
            if (next[idx] !== h) {
              next[idx] = h;
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
    });
    rowObserverRef.current = observer;
    Object.entries(trRowRefs.current).forEach(([, el]) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const registerTrRef = (idx, el) => {
    const prev = trRowRefs.current[idx];
    if (prev && rowObserverRef.current) rowObserverRef.current.unobserve(prev);
    if (el) {
      el.__rowIdx = idx;
      trRowRefs.current[idx] = el;
      if (rowObserverRef.current) rowObserverRef.current.observe(el);
    } else {
      delete trRowRefs.current[idx];
    }
  };

  useEffect(() => {
    const snapshot = {};
    Object.entries(trRowRefs.current).forEach(([i, el]) => {
      if (el) snapshot[Number(i)] = el.getBoundingClientRect().height;
    });
    if (Object.keys(snapshot).length > 0) setRowHeights(snapshot);
  }, [rows.length]);

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
      const curr = updated[rowIndex];
      if (!curr) return prev;

      let updatedRow = { ...curr, [field]: value };

      if (field === 'responseDate') {
        const nextStatus = computePDCAStatus(updatedRow, currentDate);
        updatedRow.status = nextStatus;
      } else if (field === 'status') {
        const normStatus = normalizePDCAStatus(value);
        if (!curr.responseDate && normStatus !== 'Not-Started') {
          updatedRow.status = 'Not-Started';
          if (typeof showToast === 'function') {
            showToast('Response date is required before updating status.');
          }
        } else {
          updatedRow.status = normStatus;
        }
      }

      updated[rowIndex] = updatedRow;
      return updated;
    });
  };

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

  // Add Row
  const handleAddRow = () => {
    const defaultDept = topic?.section === 'cc' ? 'C&C' : (topic?.section === 'assembly' ? 'Assembly' : '');
    setRows((prev) => [
      ...prev,
      createEmptyRow({
        date: currentDate || new Date().toISOString().slice(0, 10),
        status: 'Open',
        department: defaultDept
      })
    ]);
  };

  // Insert Row Above
  const handleInsertRowAbove = (idx) => {
    const defaultDept = topic?.section === 'cc' ? 'C&C' : (topic?.section === 'assembly' ? 'Assembly' : '');
    setRows((prev) => {
      const updated = [...prev];
      updated.splice(
        idx,
        0,
        createEmptyRow({
          date: currentDate || new Date().toISOString().slice(0, 10),
          status: 'Open',
          department: defaultDept
        })
      );
      return updated;
    });
  };

  // Delete Row
  const handleDeleteRow = (idx) => {
    if (rows.length <= 1) {
      setRows([createEmptyRow()]);
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // Keyboard navigation
  const handleKeyDown = (e, rowIndex, colName) => {
    const cols = ['lineArea', 'observation', 'rootCause', 'counterMeasure', 'responsiblePersonConfirmation'];
    const colIndex = cols.indexOf(colName);
    if (colIndex === -1) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (rowIndex < rows.length - 1) {
        cellRefs.current[`${rowIndex + 1}_${colName}`]?.focus();
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      if (colIndex < cols.length - 1) {
        e.preventDefault();
        cellRefs.current[`${rowIndex}_${cols[colIndex + 1]}`]?.focus();
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      if (colIndex > 0) {
        e.preventDefault();
        cellRefs.current[`${rowIndex}_${cols[colIndex - 1]}`]?.focus();
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

  // Filter rows by search
  const filteredRows = useMemo(() => {
    if (!sheetSearch.trim()) return rows.map((r, i) => ({ ...r, originalIndex: i }));
    const query = sheetSearch.toLowerCase();
    return rows
      .map((r, i) => ({ ...r, originalIndex: i }))
      .filter((r) =>
        r.observation?.toLowerCase().includes(query) ||
        r.lineArea?.toLowerCase().includes(query) ||
        r.rootCause?.toLowerCase().includes(query) ||
        r.counterMeasure?.toLowerCase().includes(query) ||
        r.department?.toLowerCase().includes(query) ||
        r.staffEmployee?.toLowerCase().includes(query) ||
        r.cftTopic?.toLowerCase().includes(query)
      );
  }, [rows, sheetSearch]);

  return (
    <div className="w-full flex flex-col font-sans text-slate-800 bg-[#F4F6F8] pdca-form-root">
      {/* ── TOP ACTION HEADER BAR ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#CBD5E1] shadow-xs">
        <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs bg-white">
          <div className="flex flex-wrap items-center gap-2 text-slate-500 font-medium">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-slate-700 bg-white hover:bg-slate-100 hover:text-blue-600 transition-colors font-medium text-xs border border-slate-300 shadow-2xs cursor-pointer flex-shrink-0"
              title="Return to LPA records"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={saveSheet}
              disabled={isSaving}
              title="Save all PDCA form changes"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs shadow-xs cursor-pointer transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
            {onDateChange && (
              <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs font-medium text-slate-700 cursor-pointer shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span className="font-semibold text-slate-600">Date:</span>
                <input
                  type="date"
                  value={currentDate || ''}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="bg-transparent border-0 outline-none text-xs font-semibold text-slate-800 cursor-pointer p-0"
                  title="Choose date of data to view"
                />
              </label>
            )}
            {headerInfo.auditNo ? (
              <span className="text-slate-500 text-xs">
                Audit No: <span className="font-semibold text-slate-700 font-mono">{headerInfo.auditNo}</span>
              </span>
            ) : null}
            {/* Send Mail Button */}
            <button
              type="button"
              onClick={() => setIsSendMailOpen(true)}
              title="Send PDCA report by email"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-blue-600 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs shadow-2xs cursor-pointer transition-colors flex-shrink-0"
            >
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              <span>Send Mail</span>
            </button>
            {/* PDCA Graph Button */}
            <button
              type="button"
              onClick={() => setShowMonthlyGraph(prev => !prev)}
              title="Toggle PDCA Graph (In-Progress, Done, Delay, Not-Started)"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold shadow-2xs cursor-pointer transition-colors flex-shrink-0 ${
                showMonthlyGraph
                  ? 'border-indigo-600 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold'
                  : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>PDCA Graph</span>
            </button>
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

            {/* Add Row Button */}
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
      <div className="w-full min-w-0 bg-white border border-[#B0BEC5] shadow-xs overflow-auto">
        <div className="flex items-stretch w-full overflow-x-auto max-w-full">
          {/* ── Main Table ── */}
          <div className="flex-1 min-w-0 overflow-x-auto">
            <table className="w-full text-left border-collapse border border-[#B0BEC5] text-[11px]">
              {/* Table Column Headers */}
              <thead ref={theadRef}>
                {/* Title Row: Centered Page Title */}
                <tr className="bg-white border-b border-[#94A3B8]">
                  <th
                    colSpan={17}
                    className="py-2.5 px-4 text-center font-bold text-slate-900 text-sm md:text-base tracking-wide select-none"
                  >
                    {headerInfo.topicName || topic?.topic || defaultLpaTopic}
                  </th>
                </tr>

                {/* Row 1: 会議名 (Meeting Name) [Left] & 作成者 : (Prepared By) [Right] */}
                <tr className="bg-white border-b border-[#94A3B8] text-[11px]">
                  <th
                    colSpan={2}
                    className="text-slate-900 font-bold text-center border-r border-[#94A3B8] py-1.5 px-2 select-none whitespace-nowrap text-[12px] tracking-wider"
                    style={{ backgroundColor: '#FFFF99' }}
                    title="Meeting Name (会議名)"
                  >
                    会議名
                  </th>
                  <th
                    colSpan={9}
                    className="bg-white border-r border-[#94A3B8] p-0 font-normal align-middle"
                  >
                    <input
                      type="text"
                      value={headerInfo.topicName}
                      onChange={(e) => setHeaderInfo({ ...headerInfo, topicName: e.target.value })}
                      className="w-full h-full px-3 py-1.5 bg-transparent border-0 outline-none text-slate-900 font-semibold text-xs focus:bg-blue-50/20"
                    />
                  </th>
                  <th
                    colSpan={2}
                    className="text-slate-900 font-bold text-center border-r border-[#94A3B8] py-1.5 px-2 select-none whitespace-nowrap text-[12px] tracking-wider"
                    style={{ backgroundColor: '#FFFF99' }}
                    title="Prepared By (作成者 :)"
                  >
                    作成者 :
                  </th>
                  <th
                    colSpan={4}
                    className="bg-white border-r border-[#94A3B8] p-0 font-normal align-middle"
                  >
                    <input
                      type="text"
                      value={stripEmployeeId(headerInfo.preparedBy)}
                      onChange={(e) => setHeaderInfo({ ...headerInfo, preparedBy: stripEmployeeId(e.target.value) })}
                      className="w-full h-full px-3 py-1.5 bg-transparent border-0 outline-none text-slate-900 font-medium text-xs focus:bg-blue-50/20"
                    />
                  </th>
                </tr>

                {/* Row 2: 出席者 (Attendees) [Left] & 議事録No (Minutes / Audit No) [Right] */}
                <tr className="bg-white border-b border-[#94A3B8] text-[11px]">
                  <th
                    colSpan={2}
                    className="text-slate-900 font-bold text-center border-r border-[#94A3B8] py-1.5 px-2 select-none whitespace-nowrap text-[12px] tracking-wider"
                    style={{ backgroundColor: '#FFFF99' }}
                    title="Attendees (出席者)"
                  >
                    出席者
                  </th>
                  <th
                    colSpan={9}
                    className="bg-white border-r border-[#94A3B8] p-0 font-normal align-middle"
                  >
                    <input
                      type="text"
                      value={headerInfo.attendees}
                      onChange={(e) => setHeaderInfo({ ...headerInfo, attendees: e.target.value })}
                      className="w-full h-full px-3 py-1.5 bg-transparent border-0 outline-none text-slate-800 font-normal text-xs focus:bg-blue-50/20"
                    />
                  </th>
                  <th
                    colSpan={2}
                    className="text-slate-900 font-bold text-center border-r border-[#94A3B8] py-1.5 px-2 select-none whitespace-nowrap text-[12px] tracking-wider"
                    style={{ backgroundColor: '#FFFF99' }}
                    title="Audit / Minutes No (議事録No)"
                  >
                    議事録No
                  </th>
                  <th
                    colSpan={4}
                    className="bg-white border-r border-[#94A3B8] p-0 font-normal align-middle"
                  >
                    <input
                      type="text"
                      value={headerInfo.auditNo}
                      onChange={(e) => setHeaderInfo({ ...headerInfo, auditNo: e.target.value })}
                      className="w-full h-full px-3 py-1.5 bg-transparent border-0 outline-none text-slate-900 font-medium text-xs focus:bg-blue-50/20"
                    />
                  </th>
                </tr>

                {/* Row 3: P D C A Phase Labels Row */}
                <tr className="bg-white border-b-2 border-slate-700 text-center select-none text-xs">
                  {/* Empty cell above Date, Shift, S.No */}
                  <th
                    colSpan={3}
                    className="bg-white border-r border-[#94A3B8] py-1 px-1"
                  />

                  {/* P: Plan - Above Status, Department, Section, Line/Area, Observation, Image Before, Root Cause */}
                  <th
                    colSpan={7}
                    className="bg-white text-slate-900 font-bold border-r border-[#94A3B8] py-1 px-2 text-center text-xs tracking-widest"
                    title="Plan (P)"
                  >
                    P
                  </th>

                  {/* D: Do - Above Counter Measure, Image After, Duration, Response Date */}
                  <th
                    colSpan={4}
                    className="bg-white text-slate-900 font-bold border-r border-[#94A3B8] py-1 px-2 text-center text-xs tracking-widest"
                    title="Do (D)"
                  >
                    D
                  </th>

                  {/* C: Check - Above Responsible Person Confirmation (Dept / Staff / CFT) */}
                  <th
                    colSpan={3}
                    className="bg-white text-slate-900 font-bold border-r border-[#94A3B8] py-1 px-2 text-center text-xs tracking-widest"
                    title="Check (C)"
                  >
                    C
                  </th>

                  {/* A: Act - Above (Responsible person instructions, etc.) */}
                  <th
                    colSpan={1}
                    className="bg-white text-slate-900 font-bold border-r border-[#94A3B8] py-1 px-2 text-center text-xs tracking-widest"
                    title="Act (A)"
                  >
                    A
                  </th>
                </tr>

                {/* Row 4: Column Headers - Main Group */}
                <tr className="bg-white border-b border-[#B0BEC5] text-slate-700 font-bold text-[10px] select-none">
                  {/* 1. Date */}
                  <th rowSpan={2} className="py-1 px-0.5 w-[56px] min-w-[52px] text-center border-r border-[#B0BEC5]">
                    <span>Date</span> <span className="text-red-500 font-bold">*</span>
                  </th>

                  {/* 2. Shift */}
                  <th rowSpan={2} className="py-1 px-0.5 w-[36px] min-w-[34px] text-center border-r border-[#B0BEC5]">
                    <span>Shift</span> <span className="text-red-500 font-bold">*</span>
                  </th>

                  {/* 3. S.No */}
                  <th rowSpan={2} className="py-1 px-0.5 w-[34px] min-w-[30px] text-center border-r border-[#B0BEC5]">
                    S.No
                  </th>

                  {/* 4. Status */}
                  <th rowSpan={2} className="py-1.5 px-1 w-[124px] min-w-[118px] text-center border-r border-[#475569] whitespace-nowrap">
                    <span>Status</span> <span className="text-red-500 font-bold">*</span>
                  </th>

                  {/* 5. Department */}
                  <th rowSpan={2} className="py-1.5 px-1 w-[90px] min-w-[85px] text-center border-r border-[#475569] text-[10.5px]">
                    <span>Department</span>
                  </th>

                  {/* 6. Section */}
                  <th
                    rowSpan={2}
                    style={{
                      width: `${sectionColWidth}px`,
                      minWidth: `${sectionColWidth}px`
                    }}
                    className="py-1.5 px-1 text-center border-r border-[#475569] text-[10.5px] whitespace-nowrap transition-[width] duration-150"
                  >
                    <span>Section</span>
                  </th>

                  {/* 7. Line/Area */}
                  <th
                    rowSpan={2}
                    style={{
                      width: `${lineAreaColWidth}px`,
                      minWidth: `${lineAreaColWidth}px`
                    }}
                    className="py-1.5 px-1 text-center border-r border-[#475569] text-[10.5px] whitespace-nowrap transition-[width] duration-150"
                  >
                    <span>Line/Area</span> <span className="text-red-500 font-bold">*</span>
                  </th>

                  {/* 6. Observation */}
                  <th
                    rowSpan={2}
                    style={{
                      width: `${observationWidth}px`,
                      minWidth: `${observationWidth}px`,
                      maxWidth: `${observationWidth}px`
                    }}
                    className="relative py-1.5 px-2 text-center border-r border-[#475569] text-[10.5px] select-none"
                  >
                    <div className="flex items-center justify-center gap-1 font-bold text-slate-800 pr-2">
                      <span>Observation</span> <span className="text-red-500 font-bold">*</span>
                    </div>

                    <span
                      role="separator"
                      aria-label="Resize Observation column width"
                      aria-orientation="vertical"
                      aria-valuemin={180}
                      aria-valuemax={650}
                      aria-valuenow={observationWidth}
                      tabIndex={0}
                      title={`Drag horizontally or use arrow keys to adjust Observation column width (${observationWidth}px)`}
                      onPointerDown={startObservationResize}
                      onPointerMove={continueObservationResize}
                      onPointerUp={finishObservationResize}
                      onPointerCancel={finishObservationResize}
                      onLostPointerCapture={finishObservationResize}
                      onKeyDown={handleObservationResizeKeyDown}
                      className="group absolute inset-y-0 right-0 z-20 flex w-3.5 cursor-col-resize touch-none items-center justify-center hover:bg-blue-100/70 active:bg-blue-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500 transition-colors"
                    >
                      <span className="h-4 w-1 rounded-full bg-slate-400 group-hover:bg-blue-600 group-active:bg-blue-700 transition-colors shadow-2xs" />
                    </span>
                  </th>

                  {/* 7. Image Before */}
                  <th rowSpan={2} className="py-1.5 px-1 w-[130px] min-w-[120px] text-center border-r border-[#475569] text-[10.5px]">
                    Image Before
                  </th>

                  {/* 8. Root Cause */}
                  <th
                    rowSpan={2}
                    style={{
                      width: `${rootCauseWidth}px`,
                      minWidth: `${rootCauseWidth}px`,
                      maxWidth: `${rootCauseWidth}px`
                    }}
                    className="relative py-1.5 px-2 text-center border-r border-[#475569] text-[10.5px] select-none"
                  >
                    <div className="flex items-center justify-center gap-1 font-bold text-slate-800 pr-2">
                      <span>Root Cause</span>
                    </div>

                    <span
                      role="separator"
                      aria-label="Resize Root Cause column width"
                      aria-orientation="vertical"
                      aria-valuemin={95}
                      aria-valuemax={550}
                      aria-valuenow={rootCauseWidth}
                      tabIndex={0}
                      title={`Drag horizontally or use arrow keys to adjust Root Cause column width (${rootCauseWidth}px)`}
                      onPointerDown={startRootCauseResize}
                      onPointerMove={continueRootCauseResize}
                      onPointerUp={finishRootCauseResize}
                      onPointerCancel={finishRootCauseResize}
                      onLostPointerCapture={finishRootCauseResize}
                      onKeyDown={handleRootCauseResizeKeyDown}
                      className="group absolute inset-y-0 right-0 z-20 flex w-3.5 cursor-col-resize touch-none items-center justify-center hover:bg-blue-100/70 active:bg-blue-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500 transition-colors"
                    >
                      <span className="h-4 w-1 rounded-full bg-slate-400 group-hover:bg-blue-600 group-active:bg-blue-700 transition-colors shadow-2xs" />
                    </span>
                  </th>

                  {/* 9. Counter Measure */}
                  <th
                    rowSpan={2}
                    style={{
                      width: `${counterMeasureWidth}px`,
                      minWidth: `${counterMeasureWidth}px`,
                      maxWidth: `${counterMeasureWidth}px`
                    }}
                    className="relative py-1.5 px-2 text-center border-r border-[#475569] leading-tight text-[10.5px] select-none"
                  >
                    <div className="flex items-center justify-center gap-1 font-bold text-slate-800 pr-2">
                      <span>Counter Measure</span>
                    </div>

                    <span
                      role="separator"
                      aria-label="Resize Counter Measure column width"
                      aria-orientation="vertical"
                      aria-valuemin={95}
                      aria-valuemax={550}
                      aria-valuenow={counterMeasureWidth}
                      tabIndex={0}
                      title={`Drag horizontally or use arrow keys to adjust Counter Measure column width (${counterMeasureWidth}px)`}
                      onPointerDown={startCounterMeasureResize}
                      onPointerMove={continueCounterMeasureResize}
                      onPointerUp={finishCounterMeasureResize}
                      onPointerCancel={finishCounterMeasureResize}
                      onLostPointerCapture={finishCounterMeasureResize}
                      onKeyDown={handleCounterMeasureResizeKeyDown}
                      className="group absolute inset-y-0 right-0 z-20 flex w-3.5 cursor-col-resize touch-none items-center justify-center hover:bg-blue-100/70 active:bg-blue-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500 transition-colors"
                    >
                      <span className="h-4 w-1 rounded-full bg-slate-400 group-hover:bg-blue-600 group-active:bg-blue-700 transition-colors shadow-2xs" />
                    </span>
                  </th>

                  {/* 10. Image After */}
                  <th rowSpan={2} className="py-1.5 px-1 w-[115px] min-w-[105px] text-center border-r border-[#475569] text-[10.5px]">
                    Image After
                  </th>

                  <th rowSpan={2} className="py-1 px-1 w-[80px] min-w-[75px] text-center border-r border-[#B0BEC5] leading-tight">
                    <div className="text-[9px] leading-tight font-semibold">Std. Duration</div>
                    <div className="text-[9px] leading-tight font-semibold">in min</div>
                  </th>

                  {/* 12. Response Date */}
                  <th rowSpan={2} className="py-1 px-0.5 w-[56px] min-w-[52px] text-center border-r border-[#B0BEC5] leading-tight">
                    <div className="text-[10px] leading-tight font-semibold">Response</div>
                    <div className="text-[10px] leading-tight font-semibold">Date</div>
                  </th>

                  {/* 12, 13, 14: Responsible Person Confirmation header spanning 3 columns */}
                  <th colSpan={3} className="py-1 px-1 border-r border-[#B0BEC5] text-center">
                    <div className="text-center font-bold text-[9.5px] text-slate-700">
                      Responsible Person Confirmation
                    </div>
                  </th>

                  {/* 15. Responsible Person Confirmation */}
                  <th rowSpan={2} className="py-2 px-1 w-[185px] min-w-[175px] text-center border-r border-[#B0BEC5] leading-tight select-none">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-800 leading-tight">
                        <Lock className="w-3 h-3 text-slate-600 flex-shrink-0" />
                        <span>Responsible Person Confirmation</span>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[8.5px] font-semibold text-slate-500 leading-tight">
                        <Lock className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
                        <span>Admin / Sheet Creator only</span>
                      </div>
                    </div>
                  </th>
                </tr>

                {/* Row 5: Column Subheaders for Dept, Staff Name, CFT */}
                <tr className="bg-white border-b border-[#B0BEC5] text-slate-600 font-semibold text-[9.5px] select-none">
                  <th className="py-0.5 px-1 text-center border-r border-[#B0BEC5] w-[85px] min-w-[75px]">
                    Dept
                  </th>
                  <th className="py-0.5 px-1 text-center border-r border-[#B0BEC5] w-[155px] min-w-[140px]">
                    Staff Name
                  </th>
                  <th className="py-0.5 px-1 text-center border-r border-[#B0BEC5] w-[95px] min-w-[85px]">
                    CFT
                  </th>
                </tr>
              </thead>

              {/* Table Rows */}
              <tbody className="bg-white">
                {filteredRows.map((row) => {
                  const idx = row.originalIndex;
                  const sNo = idx + 1;
                  const canEditEntireRow = canEditEntireSheet;
                  const isDeptMember = isUserInResponsibleDepartment(row, effectiveUser);
                  const canEditActionCols = Boolean(!readOnly && (isCreatorOrAdmin || isDeptMember));

                  return (
                    <tr
                      key={idx}
                      ref={(el) => registerTrRef(idx, el)}
                      className="border-b border-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                    >
                      {/* 1. Date */}
                      <td className="p-0 align-middle text-center border-r border-[#64748B] w-[56px] min-w-[52px]">
                        <CompactDateCell
                          value={row.date}
                          readOnly={!canEditEntireRow}
                          onChange={(val) => handleCellChange(idx, 'date', val)}
                        />
                      </td>

                      {/* 2. Shift */}
                      <td className="p-0 align-middle border-r border-[#64748B] w-[36px] min-w-[34px] focus-within:bg-blue-50/30">
                        <div className="relative w-full h-full flex items-center justify-center">
                          <select
                            disabled={!canEditEntireRow}
                            value={row.shift === 'General' ? 'G' : (row.shift || '')}
                            onChange={(e) => handleCellChange(idx, 'shift', e.target.value)}
                            className={`w-full bg-transparent border-0 outline-none pl-1 pr-3 py-1.5 text-base text-slate-800 font-semibold text-center focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors appearance-none ${!canEditEntireRow ? 'cursor-default' : 'cursor-pointer'}`}
                          >
                            <option value="">-</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="G">G</option>
                          </select>
                          {canEditEntireRow && (
                            <ChevronDown className="w-2 h-2 text-slate-400 absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          )}
                        </div>
                      </td>

                      {/* 3. S.No */}
                      <td className="p-0.5 align-middle text-center border-r border-[#64748B] font-semibold text-slate-600 bg-[#FAFAFA] select-none w-[34px] min-w-[30px] text-base">
                        {sNo}
                      </td>

                      {/* 4. Status */}
                      <td className="px-0.5 py-1 align-middle text-center border-r border-[#64748B] w-[124px] min-w-[118px]">
                        <select
                          disabled={!canEditEntireRow}
                          aria-label={`Status for row ${sNo}`}
                          value={normalizePDCAStatus(row.status)}
                          onChange={(event) => handleCellChange(idx, 'status', event.target.value)}
                          className={`w-full min-w-full rounded-md border px-1.5 py-1.5 text-[15px] font-medium outline-none text-center whitespace-nowrap ${!canEditEntireRow ? 'cursor-default' : 'cursor-pointer focus:ring-2 focus:ring-blue-300'} ${
                            normalizePDCAStatus(row.status) === 'Done' ? 'bg-green-50 text-green-700 border-green-200' :
                            normalizePDCAStatus(row.status) === 'In- Progress' ? 'bg-yellow-50 text-yellow-800 border-yellow-300' :
                            normalizePDCAStatus(row.status) === 'Delay' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          <option value="Not-Started" style={{color:'#1d4ed8',backgroundColor:'#eff6ff'}}>Not-Started</option>
                          <option value="Done" style={{color:'#15803d',backgroundColor:'#f0fdf4'}}>Done</option>
                          <option value="In- Progress" style={{color:'#854d0e',backgroundColor:'#fefce8'}}>In- Progress</option>
                          <option value="Delay" style={{color:'#b91c1c',backgroundColor:'#fef2f2'}}>Delay</option>
                        </select>
                      </td>

                      {/* 5. Department */}
                      <td className="p-0.5 align-middle text-center border-r border-[#64748B] w-[90px] min-w-[85px] focus-within:bg-blue-50/30">
                        <div className="relative w-full flex items-center justify-center">
                          <select
                            disabled={!canEditEntireRow}
                            value={row.department || ''}
                            onChange={(e) => handleDepartmentChange(idx, e.target.value)}
                            className={`w-full bg-transparent border-0 outline-none pl-1 pr-3 py-1.5 text-[14px] text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 appearance-none truncate font-medium ${!canEditEntireRow ? 'cursor-default' : 'cursor-pointer'}`}
                            title={row.department || 'Select Department'}
                          >
                            <option value="">Dept...</option>
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
                      </td>

                      {/* 6. Section */}
                      <td
                        style={{
                          width: `${sectionColWidth}px`,
                          minWidth: `${sectionColWidth}px`
                        }}
                        className="p-0.5 align-middle text-center border-r border-[#64748B] transition-[width] duration-150"
                      >
                        <div className="w-full flex items-center justify-center">
                          <SearchableSectionSelect
                            disabled={!canEditEntireRow}
                            value={row.section}
                            sectionId={row.sectionId ?? row.lineAreaSectionId}
                            sectionCode={row.sectionCode}
                            department={row.department}
                            onChange={(sectionName, meta) => handleSectionChange(idx, sectionName, meta)}
                            placeholder="Section..."
                          />
                        </div>
                      </td>

                      {/* 7. Line/Area */}
                      <td
                        style={{
                          width: `${lineAreaColWidth}px`,
                          minWidth: `${lineAreaColWidth}px`
                        }}
                        className="p-0.5 align-middle border-r border-[#64748B] text-center transition-[width] duration-150"
                      >
                        <SearchableLineAreaSelect
                          disabled={!canEditEntireRow}
                          value={row.lineArea}
                          sectionId={row.sectionId ?? row.lineAreaSectionId}
                          lineId={row.lineAreaId}
                          onChange={(val, meta) =>
                            setRows((prev) => {
                              const updated = [...prev];
                              const curr = updated[idx];
                              const newSectionId = meta?.sectionId ?? curr.sectionId;
                              const newSection = meta?.section || curr.section;
                              const newSectionCode = meta?.sectionCode || curr.sectionCode;

                              updated[idx] = {
                                ...curr,
                                lineArea: val,
                                lineAreaSectionId: newSectionId,
                                lineAreaId: meta?.lineId ?? null,
                                lineAreaCode: meta?.lineCode ?? '',
                                section: newSection,
                                sectionId: newSectionId,
                                sectionCode: newSectionCode
                              };
                              return updated;
                            })
                          }
                          placeholder="Line/Area..."
                        />
                      </td>

                      {/* 6. Observation */}
                      <td
                        className="p-0.5 align-middle border-r border-[#64748B] focus-within:bg-blue-50/30 text-center"
                        style={{
                          width: `${observationWidth}px`,
                          minWidth: `${observationWidth}px`,
                          maxWidth: `${observationWidth}px`,
                        }}
                      >
                        <AutoResizeTextarea
                          readOnly={!canEditEntireRow}
                          inputRef={(el) => registerRef(idx, 'observation', el)}
                          value={row.observation}
                          onChange={(e) => handleCellChange(idx, 'observation', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 'observation')}
                          placeholder=""
                          className="w-full bg-transparent border-0 outline-none p-1 text-base text-slate-800 text-center leading-normal focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block whitespace-pre-wrap break-words"
                        />
                      </td>

                      {/* 7. Image Before - High visibility preview with preserved aspect ratio */}
                      <td className="p-1.5 align-middle text-center border-r border-[#64748B] w-[130px] min-w-[120px]">
                        {row.imageBefore ? (
                          <div className="flex items-center justify-center w-full min-h-[90px] py-1">
                            <button
                              type="button"
                              onClick={() => setSelectedImageAction({
                                type: 'before',
                                rowIndex: idx,
                                preview: row.imageBefore,
                                fileType: row.fileTypeBefore,
                                fileName: row.imageBeforeName
                              })}
                              className="group relative inline-flex items-center justify-center p-1 rounded-lg border-2 border-slate-400 hover:border-blue-500 hover:ring-2 hover:ring-blue-100 transition-all cursor-pointer bg-slate-50 shadow-sm overflow-hidden max-w-full"
                              title={`Click to view ${row.imageBeforeName || 'file'}, edit or delete`}
                            >
                              {row.fileTypeBefore === 'excel' ? (
                                <div className="h-12 px-2 rounded flex flex-col items-center justify-center gap-1 cursor-pointer bg-emerald-50 text-emerald-800 border border-emerald-300">
                                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                  <span className="text-[10px] font-bold truncate max-w-[100px]">
                                    {row.imageBeforeName || 'Excel'}
                                  </span>
                                </div>
                              ) : row.fileTypeBefore === 'pdf' ? (
                                <div className="h-12 px-2 rounded flex flex-col items-center justify-center gap-1 cursor-pointer bg-rose-50 text-rose-800 border border-rose-300">
                                  <FileText className="w-4 h-4 text-rose-600" />
                                  <span className="text-[10px] font-bold truncate max-w-[100px]">
                                    {row.imageBeforeName || 'PDF'}
                                  </span>
                                </div>
                              ) : row.fileTypeBefore === 'ppt' ? (
                                <div className="h-12 px-2 rounded flex flex-col items-center justify-center gap-1 cursor-pointer bg-amber-50 text-amber-800 border border-amber-300">
                                  <Presentation className="w-4 h-4 text-amber-600" />
                                  <span className="text-[10px] font-bold truncate max-w-[100px]">
                                    {row.imageBeforeName || 'PPT'}
                                  </span>
                                </div>
                              ) : (
                                <div className="relative flex items-center justify-center">
                                  <img
                                    src={row.imageBefore}
                                    alt="Before"
                                    className="h-20 w-auto max-w-[110px] max-h-[85px] object-contain rounded transition-transform group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded transition-opacity text-white">
                                    <Eye className="w-4 h-4 drop-shadow" />
                                  </div>
                                </div>
                              )}
                            </button>
                          </div>
                        ) : canEditEntireRow ? (
                          <div className="flex flex-col items-center justify-center">
                            <button
                              type="button"
                              onClick={() => setSelectedImageAction({ type: 'before', rowIndex: idx, isNew: true })}
                              className="px-2 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-dashed border-[#64748B] hover:border-blue-600 rounded text-[10.5px] font-semibold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer w-full justify-center"
                            >
                              <Upload className="w-3.5 h-3.5 text-slate-500" />
                              <span>Upload</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[10px] select-none">-</span>
                        )}
                      </td>

                      {/* 8. Root Cause */}
                      <td
                        className="p-0 align-middle border-r border-[#64748B] focus-within:bg-blue-50/30 text-center"
                        style={{
                          width: `${rootCauseWidth}px`,
                          minWidth: `${rootCauseWidth}px`,
                          maxWidth: `${rootCauseWidth}px`,
                        }}
                      >
                        <AutoResizeTextarea
                          readOnly={!canEditActionCols}
                          inputRef={(el) => registerRef(idx, 'rootCause', el)}
                          value={row.rootCause}
                          onChange={(e) => handleCellChange(idx, 'rootCause', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 'rootCause')}
                          placeholder={canEditActionCols ? "Root cause..." : ""}
                          className="w-full bg-transparent border-0 outline-none p-1 text-base text-slate-800 text-center leading-normal focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center whitespace-pre-wrap break-words"
                        />
                      </td>

                      {/* 9. Counter Measure */}
                      <td
                        className="p-0.5 align-middle border-r border-[#64748B] focus-within:bg-blue-50/30 text-center"
                        style={{
                          width: `${counterMeasureWidth}px`,
                          minWidth: `${counterMeasureWidth}px`,
                          maxWidth: `${counterMeasureWidth}px`,
                        }}
                      >
                        <AutoResizeTextarea
                          readOnly={!canEditActionCols}
                          inputRef={(el) => registerRef(idx, 'counterMeasure', el)}
                          value={row.counterMeasure}
                          onChange={(e) => handleCellChange(idx, 'counterMeasure', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 'counterMeasure')}
                          placeholder={canEditActionCols ? "Counter measure..." : ""}
                          className="w-full bg-transparent border-0 outline-none p-1 text-base text-slate-800 text-center leading-normal focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center whitespace-pre-wrap break-words"
                        />
                      </td>

                      {/* 10. Image After */}
                      <td className="p-1 align-middle text-center border-r border-[#64748B] w-[85px] min-w-[80px]">
                        {row.imageAfter ? (
                          <div className="relative group mx-auto w-12 h-12 rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                            {row.fileTypeAfter === 'excel' ? (
                              <div
                                onClick={() => setSelectedImageAction({
                                  type: 'after',
                                  rowIndex: idx,
                                  preview: row.imageAfter,
                                  fileType: row.fileTypeAfter,
                                  fileName: row.imageAfterName
                                })}
                                className="w-full h-full bg-emerald-50 flex flex-col items-center justify-center p-0.5 cursor-pointer hover:bg-emerald-100 transition-colors"
                              >
                                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                                <span className="text-[7.5px] font-bold text-emerald-800 truncate w-full text-center px-0.5 mt-0.5">
                                  {row.imageAfterName || 'Excel'}
                                </span>
                              </div>
                            ) : row.fileTypeAfter === 'pdf' ? (
                              <div
                                onClick={() => setSelectedImageAction({
                                  type: 'after',
                                  rowIndex: idx,
                                  preview: row.imageAfter,
                                  fileType: row.fileTypeAfter,
                                  fileName: row.imageAfterName
                                })}
                                className="w-full h-full bg-rose-50 flex flex-col items-center justify-center p-0.5 cursor-pointer hover:bg-rose-100 transition-colors"
                              >
                                <FileText className="w-5 h-5 text-rose-600" />
                                <span className="text-[7.5px] font-bold text-rose-800 truncate w-full text-center px-0.5 mt-0.5">
                                  {row.imageAfterName || 'PDF'}
                                </span>
                              </div>
                            ) : row.fileTypeAfter === 'ppt' ? (
                              <div
                                onClick={() => setSelectedImageAction({
                                  type: 'after',
                                  rowIndex: idx,
                                  preview: row.imageAfter,
                                  fileType: row.fileTypeAfter,
                                  fileName: row.imageAfterName
                                })}
                                className="w-full h-full bg-orange-50 flex flex-col items-center justify-center p-0.5 cursor-pointer hover:bg-orange-100 transition-colors"
                              >
                                <Presentation className="w-5 h-5 text-orange-600" />
                                <span className="text-[7.5px] font-bold text-orange-800 truncate w-full text-center px-0.5 mt-0.5">
                                  {row.imageAfterName || 'PPT'}
                                </span>
                              </div>
                            ) : (
                              <img
                                src={row.imageAfter}
                                alt="After"
                                onClick={() => setSelectedImageAction({
                                  type: 'after',
                                  rowIndex: idx,
                                  preview: row.imageAfter,
                                  fileType: 'image'
                                })}
                                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              />
                            )}
                          </div>
                        ) : canEditActionCols ? (
                          <div className="flex flex-col items-center justify-center">
                            <button
                              type="button"
                              onClick={() => setSelectedImageAction({ type: 'after', rowIndex: idx, isNew: true })}
                              className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 rounded text-[10px] font-medium transition-colors flex items-center gap-1 shadow-2xs cursor-pointer border-dashed"
                            >
                              <Upload className="w-2.5 h-2.5" />
                              <span>Upload</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[10px] select-none">-</span>
                        )}
                      </td>

                      <td className="p-0.5 align-middle text-center border-r border-[#64748B] w-[80px] min-w-[75px]">
                        <input
                          ref={(element) => {
                            if (element) durationRefs.current[idx] = element;
                            else delete durationRefs.current[idx];
                          }}
                          type="number"
                          min="0"
                          step="any"
                          value={String(row.stdDurationMin ?? '').replace(/\s*min$/i, '')}
                          disabled={!canEditActionCols || !row.responseDate?.trim()}
                          required={Boolean(row.responseDate?.trim())}
                          aria-required={row.responseDate?.trim() ? 'true' : undefined}
                          aria-invalid={row.responseDate?.trim() && !hasValidStdDuration(row.stdDurationMin ?? row.stdDuration) ? 'true' : undefined}
                          data-required-action-allowed={row.responseDate?.trim() && !hasValidStdDuration(row.stdDurationMin ?? row.stdDuration) ? 'true' : undefined}
                          onChange={(event) => handleCellChange(idx, 'stdDurationMin', event.target.value)}
                          placeholder="-"
                          className={`w-full outline-none px-0.5 py-1 text-[11px] text-center ${row.responseDate?.trim() && !hasValidStdDuration(row.stdDurationMin ?? row.stdDuration) ? 'border border-red-500 bg-red-50 text-red-800 rounded' : 'border-0 bg-transparent'} ${!canEditActionCols ? 'cursor-default' : 'focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600'}`}
                          title="Std. Duration in minutes"
                        />
                      </td>

                      {/* 12. Response Date */}
                      <td className="p-0 align-middle text-center border-r border-[#64748B] w-[56px] min-w-[52px]">
                        <CompactDateCell
                          value={row.responseDate}
                          readOnly={!canEditActionCols}
                          smallText
                          onChange={(val) => handleCellChange(idx, 'responseDate', val)}
                        />
                      </td>

                      {/* 12. Dept (Native Table Cell - Fully responsive height) */}
                      <td className="p-0 align-middle text-center border-r border-[#64748B] w-[85px] min-w-[75px]">
                        {row.staffEmployees && row.staffEmployees.length > 1 ? (
                          <div className="flex flex-col h-full divide-y divide-[#CBD5E1] justify-center">
                            {row.staffEmployees.map((emp, empIdx) => (
                              <div
                                key={empIdx}
                                className="relative w-full py-1 px-1 flex items-center justify-center min-h-[30px] focus-within:bg-blue-50/30"
                              >
                                <select
                                  disabled={!canEditEntireRow}
                                  value={emp.department || row.department || ''}
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
                                        department: empIdx === 0 ? newDept : curr.department
                                      };
                                      return updated;
                                    });
                                  }}
                                  className={`w-full bg-transparent border-0 outline-none text-[14px] font-semibold text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 appearance-none truncate ${!canEditEntireRow ? 'cursor-default' : 'cursor-pointer'}`}
                                  title={emp.department || row.department || 'Select Department'}
                                >
                                  <option value="">Dept...</option>
                                  {emp.department && !departmentsList.includes(emp.department) && (
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
                          <div className="relative w-full h-full min-h-[42px] flex items-center justify-center focus-within:bg-blue-50/30">
                            <select
                              disabled={!canEditEntireRow}
                              value={
                                (row.responsiblePersonDept && row.responsiblePersonDept !== 'CFT')
                                  ? row.responsiblePersonDept
                                  : (row.staffEmployees?.[0]?.department && row.staffEmployees[0].department !== 'CFT'
                                      ? row.staffEmployees[0].department
                                      : (findEmployeeDepartment(row.staffEmployee, dbEmployees) ||
                                         findEmployeeDepartment(row.staffEmployee, VERIFIED_EMPLOYEE_MASTER) ||
                                         (row.department !== 'CFT' ? row.department : '') ||
                                         ''))
                              }
                              onChange={(e) => handleResponsiblePersonDeptChange(idx, e.target.value)}
                              className={`w-full bg-transparent border-0 outline-none pl-1 pr-3 py-1.5 text-[10.5px] text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 appearance-none truncate ${!canEditEntireRow ? 'cursor-default' : 'cursor-pointer'}`}
                              title={row.responsiblePersonDept || 'Select Department'}
                            >
                              <option value="">Dept...</option>
                              {(row.responsiblePersonDept || row.department) && (row.responsiblePersonDept || row.department) !== 'CFT' && !departmentsList.includes(row.responsiblePersonDept || row.department) && (
                                <option value={row.responsiblePersonDept || row.department}>{row.responsiblePersonDept || row.department}</option>
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

                      {/* 13. Staff Name (Native Table Cell - Fully responsive height, supports multiple employees) */}
                      <td className="p-0 align-middle text-center border-r border-[#64748B] w-[155px] min-w-[140px]">
                        <div className="relative w-full h-full min-h-[42px] flex flex-col justify-center">
                          {row.staffEmployees && row.staffEmployees.length > 1 ? (
                            <div className="flex flex-col h-full divide-y divide-[#CBD5E1] justify-center">
                              {row.staffEmployees.map((emp, empIdx) => {
                                const empDisplay = stripEmployeeId(emp.name || '');
                                return (
                                  <div
                                    key={empIdx}
                                    className="relative w-full py-1 pl-2 pr-6 flex items-center justify-between gap-1 group/emp min-h-[30px] hover:bg-slate-50/80 transition-colors"
                                  >
                                    <button
                                      type="button"
                                      disabled={!canEditEntireRow}
                                      onClick={() => handleOpenAddStaffModal(idx)}
                                      className={`text-[10px] font-semibold text-slate-800 truncate text-left w-full hover:text-blue-600 transition-colors ${!canEditEntireRow ? 'cursor-default' : 'cursor-pointer'}`}
                                      title={canEditEntireRow ? `Click to view/manage group: ${empDisplay}` : empDisplay}
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
                                        title={`Remove ${emp.name} from group`}
                                      >
                                        <X className="w-2.5 h-2.5 stroke-[2.5]" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : row.staffEmployee ? (
                            <div className="relative w-full h-full min-h-[42px] pl-1.5 pr-6 py-1 flex items-center justify-between gap-0.5 group">
                              <button
                                type="button"
                                disabled={!canEditEntireRow}
                                onClick={(e) => canEditEntireRow && handleToggleStaffDropdown(idx, e)}
                                className={`staff-trigger-btn flex-1 min-w-0 flex flex-col items-center justify-center text-center ${!canEditEntireRow ? 'cursor-default' : 'cursor-pointer hover:opacity-85'} transition-opacity`}
                                title={canEditEntireRow ? `Click to search/change staff: ${stripEmployeeId(row.staffEmployee)}` : stripEmployeeId(row.staffEmployee)}
                              >
                                <span className={`text-[10px] font-semibold text-slate-800 truncate w-full text-center ${canEditEntireRow ? 'hover:text-blue-600' : ''} transition-colors`}>
                                  {stripEmployeeId(row.staffEmployee)}
                                </span>
                              </button>
                              {canEditEntireRow && (
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
                              )}
                            </div>
                          ) : canEditEntireRow ? (
                            <button
                              type="button"
                              onClick={(e) => handleToggleStaffDropdown(idx, e)}
                              className="staff-trigger-btn w-full h-full min-h-[42px] flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors cursor-pointer pl-1 pr-6 group"
                              title="Click to search and select staff employee"
                            >
                              <div className="flex items-center gap-0.5 text-[9.5px] text-slate-400 group-hover:text-blue-600">
                                <Search className="w-2.5 h-2.5" />
                                <span className="truncate">Staff...</span>
                                <ChevronDown className="w-2.5 h-2.5" />
                              </div>
                            </button>
                          ) : (
                            <span className="text-slate-300 text-[10px] select-none">-</span>
                          )}

                          {/* Down right side '+' option button */}
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

                      {/* 14. CFT (Native Table Cell - Fully responsive height) */}
                      <td className="p-0 align-middle text-center border-r border-[#64748B] w-[95px] min-w-[85px]">
                        <div className="relative w-full h-full min-h-[42px] flex items-center justify-center">
                          {row.cftTopic ? (
                            <div className="w-full h-full min-h-[42px] px-1 py-0.5 flex items-center justify-between gap-0.5 group/cft-cell">
                              <button
                                type="button"
                                disabled={!canEditEntireRow}
                                onClick={(e) => canEditEntireRow && handleToggleCFTDropdown(idx, e, 'members')}
                                className={`cft-trigger-btn flex-1 min-w-0 text-left ${!canEditEntireRow ? 'cursor-default' : 'cursor-pointer hover:opacity-85'} flex flex-col justify-center py-0.5 transition-opacity`}
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
                                      className={`text-[8.5px] font-medium truncate max-w-[80px] px-0.5 py-0.2 rounded leading-tight ${
                                        row.cftSelectedType === 'member'
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
                          ) : canEditEntireRow ? (
                            <button
                              type="button"
                              onClick={(e) => handleToggleCFTDropdown(idx, e, 'topics')}
                              className="cft-trigger-btn w-full h-full min-h-[42px] flex items-center justify-center text-slate-300 hover:text-blue-600 hover:bg-blue-50/40 transition-colors cursor-pointer group"
                              title="Click to select CFT Topic"
                            >
                              <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity stroke-[2]" />
                            </button>
                          ) : (
                            <span className="text-slate-300 text-[10px] select-none">-</span>
                          )}
                        </div>
                      </td>

                      {/* 15. Responsible Person Instruction, etc. Column: Upside Name, Middle Confirmed/Not-Confirmed dropdown, Downside Mandatory Input */}
                      <td className="p-1.5 align-top border-r border-[#64748B] w-[185px] min-w-[175px] focus-within:bg-blue-50/30 text-left">
                        <div className="w-full flex flex-col items-start justify-start">
                          <ResponsiblePersonInstructionCell
                            row={row}
                            rowIndex={idx}
                            reasonRef={(element) => {
                              if (element) confirmationReasonRefs.current[idx] = element;
                              else delete confirmationReasonRefs.current[idx];
                            }}
                            confirmationRef={(element) => {
                              if (element) confirmationSelectRefs.current[idx] = element;
                              else delete confirmationSelectRefs.current[idx];
                            }}
                            reasonRequired={missingConfirmationReasonIndices.includes(idx)}
                            currentUser={effectiveUser}
                            readOnly={!canEditEntireRow}
                            onConfirmationChange={(val, uName) => handleConfirmationChange(idx, val, uName)}
                            onInstructionChange={(text) => handleInstructionChange(idx, text)}
                            sNo={sNo}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── ACTIONS Side Panel ── */}
          <div className="flex-shrink-0 w-[40px] bg-[#F8FAFC] flex flex-col">
            <div ref={actionsHeaderRef} className="sticky top-0 z-10 bg-white px-2 py-[9px] flex items-center justify-center gap-1.5 select-none" />

            <div style={{ height: Math.max(0, theadHeight - actionsHeaderHeight), boxSizing: 'border-box' }} aria-hidden="true" />

            {filteredRows.map((row) => {
              const idx = row.originalIndex;
              return (
                <div
                  key={idx}
                  style={{ height: rowHeights[idx] ? `${rowHeights[idx]}px` : '43px', boxSizing: 'border-box' }}
                  className="flex flex-col items-center justify-center gap-0.5 px-2 border-b border-[#64748B] group hover:bg-blue-50/20 transition-colors"
                >
                  {canEditEntireSheet && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleInsertRowAbove(idx)}
                        className="flex items-center justify-center w-5 h-5 shrink-0 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all shadow-2xs cursor-pointer"
                        title="Insert row above"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(idx)}
                        className="flex items-center justify-center w-5 h-5 shrink-0 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-400 hover:bg-rose-50 transition-all shadow-2xs cursor-pointer"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Image / File Upload Selection Modal */}
      {selectedImageAction?.isNew && (
        <FileUploadSelectionModal
          isOpen={true}
          onClose={() => setSelectedImageAction(null)}
          onUploadSuccess={(fileData) => {
            const fieldImg = selectedImageAction.type === 'before' ? 'imageBefore' : 'imageAfter';
            const fieldName = selectedImageAction.type === 'before' ? 'imageBeforeName' : 'imageAfterName';
            const fieldType = selectedImageAction.type === 'before' ? 'fileTypeBefore' : 'fileTypeAfter';

            setRows((prev) => {
              const updated = [...prev];
              updated[selectedImageAction.rowIndex] = {
                ...updated[selectedImageAction.rowIndex],
                [fieldImg]: fileData.url,
                [fieldName]: fileData.name,
                [fieldType]: fileData.type
              };
              return updated;
            });
            setSelectedImageAction(null);
          }}
        />
      )}

      {/* Image Preview & Actions Modal */}
      {selectedImageAction && !selectedImageAction.isNew && (
        <ImageEditorModal
          isOpen={true}
          type={selectedImageAction.type}
          previewUrl={selectedImageAction.preview}
          fileType={selectedImageAction.fileType}
          fileName={selectedImageAction.fileName}
          onClose={() => setSelectedImageAction(null)}
          onViewOriginal={() => {
            if (selectedImageAction.fileType === 'excel' || selectedImageAction.fileType === 'ppt') {
              const link = document.createElement('a');
              link.href = selectedImageAction.preview;
              link.download = selectedImageAction.fileName || 'file';
              link.click();
            } else {
              setActivePreviewImage(selectedImageAction.preview);
            }
            setSelectedImageAction(null);
          }}
          onChange={() => {
            setSelectedImageAction({
              ...selectedImageAction,
              isNew: true
            });
          }}
          onDelete={() => {
            const fieldImg = selectedImageAction.type === 'before' ? 'imageBefore' : 'imageAfter';
            const fieldName = selectedImageAction.type === 'before' ? 'imageBeforeName' : 'imageAfterName';
            const fieldType = selectedImageAction.type === 'before' ? 'fileTypeBefore' : 'fileTypeAfter';

            setRows((prev) => {
              const updated = [...prev];
              updated[selectedImageAction.rowIndex] = {
                ...updated[selectedImageAction.rowIndex],
                [fieldImg]: null,
                [fieldName]: '',
                [fieldType]: 'image'
              };
              return updated;
            });
            setSelectedImageAction(null);
          }}
        />
      )}

      {/* Lightbox Modal */}
      {activePreviewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setActivePreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <img
              src={activePreviewImage}
              alt="Enlarged view"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setActivePreviewImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 transition-colors p-1"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
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
          <div className="px-2 py-1 pb-2 border-b border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              {openCFTDropdown.tab === 'members' ? 'Select CFT Member' : 'Select CFT Topic'}
            </span>
            <button
              type="button"
              onClick={() => setOpenCFTDropdown(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="py-1 space-y-1 overflow-y-auto flex-1 pr-0.5 max-h-[260px]">
            {cftLoading ? (
              <div className="py-6 px-3 text-center">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
                <p className="text-xs text-slate-500">Loading CFT records...</p>
              </div>
            ) : cftError ? (
              <div className="py-6 px-3 text-center">
                <p className="text-xs text-rose-600 font-semibold mb-2">{cftError}</p>
                <button
                  type="button"
                  onClick={loadCFTTopics}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : availableCFTTopics.length === 0 ? (
              <div className="py-6 px-3 text-center">
                <Layers className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No CFT records available</p>
                <p className="text-[11px] text-slate-400 mt-1">Create a CFT first.</p>
              </div>
            ) : (
              availableCFTTopics.map((topObj) => {
              const isSelectedTopic = rows[openCFTDropdown.rowIndex]?.cftTopicId === topObj.id ||
                rows[openCFTDropdown.rowIndex]?.cftTopic === topObj.name;
              const isExpanded = expandedTopicId === topObj.id;

              return (
                <div key={topObj.id} className="rounded-lg border border-slate-100 overflow-hidden bg-slate-50/50">
                  <div
                    onClick={() => {
                      if (openCFTDropdown.tab === 'members') {
                        setExpandedTopicId(isExpanded ? null : topObj.id);
                      } else {
                        handleSelectCFT(openCFTDropdown.rowIndex, topObj, 'topic');
                      }
                    }}
                    className={`w-full px-2.5 py-1.5 text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      isSelectedTopic ? 'bg-blue-50 text-blue-900 border-l-2 border-blue-600' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="truncate flex-1">{topObj.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedTopicId(isExpanded ? null : topObj.id);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="bg-white p-2 border-t border-slate-100 space-y-1 text-xs">
                      {topObj.assignedEmployees?.map((emp, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSelectCFT(openCFTDropdown.rowIndex, topObj, 'assigned', emp)}
                          className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors flex items-center justify-between"
                        >
                          <span>{emp.name} ({emp.code})</span>
                          <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded">CFT Member</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }))}
          </div>
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
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer group text-xs ${
                      isSelected
                        ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200'
                        : 'hover:bg-slate-100/80 text-slate-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-1 truncate">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isSelected ? 'bg-blue-600' : 'bg-slate-300 group-hover:bg-blue-500'
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
                          className={`text-[9.5px] font-medium px-1.5 py-0.5 rounded border ${
                            isDeptMatch
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

      {/* Visual Toast Notification Overlay */}
      {toast && (
        <div
          role="alert"
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2.5 border animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            toast.type === 'error'
              ? 'bg-rose-950 text-rose-100 border-rose-800'
              : toast.type === 'success'
              ? 'bg-slate-900 text-white border-slate-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              toast.type === 'error'
                ? 'bg-rose-400'
                : toast.type === 'success'
                ? 'bg-emerald-400'
                : 'bg-blue-400'
            }`}
          />
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Send Mail Modal */}
      {(() => {
        const currentPdcaSheet = {
          id: topic?.id || topic?.recordId || `PDCA-${Date.now()}`,
          source: 'lpa',
          topic: topic?.topic || headerInfo?.topicName || 'Assembly - LPA Observation (PDCA)',
          title: topic?.topic || headerInfo?.topicName || 'Assembly - LPA Observation (PDCA)',
          section: topic?.section || 'Assembly',
          plant: topic?.plant || 'Bawal',
          unit: topic?.plant || 'Bawal',
          date: currentDate,
          sheet: sheetSnapshot
        };
        return (
          <SendMailModal
            isOpen={isSendMailOpen}
            onClose={() => setIsSendMailOpen(false)}
            formType="pdca"
            pdcaOnly={true}
            currentPdcaSheet={currentPdcaSheet}
            title={currentPdcaSheet.title}
            metadata={{
              date: currentDate,
              auditDate: currentDate,
              unit: currentPdcaSheet.unit,
              section: currentPdcaSheet.section,
              sectionName: currentPdcaSheet.section === 'cc' ? 'C&C' : 'Assembly',
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
