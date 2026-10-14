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
  Image as ImageIcon,
  Images,
  AlertCircle
} from 'lucide-react';
import ImageEditorModal from './ImageEditorModal';
import FileUploadSelectionModal from './FileUploadSelectionModal';
import EvidenceViewerModal from './EvidenceViewerModal';
import AddStaffEmployeeModal from './AddStaffEmployeeModal';
import { usePDCA } from '@hooks/pdca/usePDCA.js';
import pdcaApi from '@/services/api/pdcaApi.js';
import { PDCA_DEPARTMENTS } from '../../pages/pdca/data/pdcaConstants.js';
import {
  findEmployeeDepartment,
  VERIFIED_EMPLOYEE_MASTER
} from '../../pages/pdca/data/pdcaEmployees.js';
import SearchableLineAreaSelect from './SearchableLineAreaSelect';
import { getMediaUrl } from '@/utils/mediaUtils.js';

export const DEFAULT_OBSERVATION_WIDTH = 260;
export const MIN_OBSERVATION_WIDTH = 180;
export const MAX_OBSERVATION_WIDTH = 650;

const createEmptyRow = (customDefaults = {}) => ({
  date: customDefaults.date || '',
  shift: customDefaults.shift || '',
  lineArea: customDefaults.lineArea || '',
  status: customDefaults.status || 'Open',
  observation: customDefaults.observation || '',
  imagesBefore: Array.isArray(customDefaults.imagesBefore)
    ? customDefaults.imagesBefore
    : (customDefaults.imageBefore ? [{ id: 'legacy-before-0', url: customDefaults.imageBefore, name: customDefaults.imageBeforeName || 'Before Image', type: customDefaults.fileTypeBefore || 'image' }] : []),
  imageBefore: customDefaults.imageBefore || null,
  imageBeforeName: customDefaults.imageBeforeName || '',
  fileTypeBefore: customDefaults.fileTypeBefore || 'image',
  rootCause: customDefaults.rootCause || '',
  counterMeasure: customDefaults.counterMeasure || '',
  imagesAfter: Array.isArray(customDefaults.imagesAfter)
    ? customDefaults.imagesAfter
    : (customDefaults.imageAfter ? [{ id: 'legacy-after-0', url: customDefaults.imageAfter, name: customDefaults.imageAfterName || 'After Image', type: customDefaults.fileTypeAfter || 'image' }] : []),
  imageAfter: customDefaults.imageAfter || null,
  imageAfterName: customDefaults.imageAfterName || '',
  fileTypeAfter: customDefaults.fileTypeAfter || 'image',
  responseDate: customDefaults.responseDate || '',
  department: customDefaults.department || '',
  staffEmployee: customDefaults.staffEmployee || '',
  assignedEmployee: customDefaults.assignedEmployee || '',
  cftTopic: customDefaults.cftTopic || '',
  cftTopicId: customDefaults.cftTopicId || '',
  cftSelectedType: customDefaults.cftSelectedType || '',
  cftSelectedName: customDefaults.cftSelectedName || '',
  cftSelectedCode: customDefaults.cftSelectedCode || '',
  responsiblePersonConfirmation: customDefaults.responsiblePersonConfirmation || ''
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
      onChange={(e) => {
        onChange(e);
        resize();
      }}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
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

// Compact Date Cell (Shows only calendar icon when empty; once date is selected, icon is removed and date is displayed)
function CompactDateCell({ value, onChange }) {
  const inputRef = useRef(null);

  const formatDisplayDate = (isoStr) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year.slice(-2)}`;
    }
    return isoStr;
  };

  const handleOpenPicker = () => {
    if (inputRef.current) {
      if (typeof inputRef.current.showPicker === 'function') {
        try {
          inputRef.current.showPicker();
          return;
        } catch (err) {}
      }
      inputRef.current.focus();
    }
  };

  const display = formatDisplayDate(value);

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
            } catch (err) {}
          }
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        tabIndex={0}
      />

      {display ? (
        // When date is selected: Date is shown perfectly center-aligned, calendar icon is removed
        <div className="relative w-full flex items-center justify-center text-center pointer-events-none px-1">
          <span className="text-[10.5px] font-semibold text-slate-800 text-center tracking-tight truncate">
            {display}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-auto z-20 opacity-0 group-hover:opacity-100 hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 transition-opacity rounded cursor-pointer"
            title="Clear date"
          >
            <X className="w-2.5 h-2.5 stroke-[2.5]" />
          </button>
        </div>
      ) : (
        // When empty: Only calendar icon is shown, centered
        <div className="w-full flex items-center justify-center text-center pointer-events-none">
          <Calendar className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors mx-auto" />
        </div>
      )}
    </div>
  );
}

export default function PDCASheet({ topic, onBack, onSave, currentDate, onDateChange }) {
  const { data, setData, showToast } = usePDCA();
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

  // Helper to ensure row has normalized imagesBefore and imagesAfter arrays
  const normalizeRow = (row) => {
    if (!row) return createEmptyRow();
    const imagesBefore = Array.isArray(row.imagesBefore)
      ? row.imagesBefore
      : (row.imageBefore ? [{ id: 'legacy-before-0', url: row.imageBefore, name: row.imageBeforeName || 'Before Image', type: row.fileTypeBefore || 'image' }] : []);
    const imagesAfter = Array.isArray(row.imagesAfter)
      ? row.imagesAfter
      : (row.imageAfter ? [{ id: 'legacy-after-0', url: row.imageAfter, name: row.imageAfterName || 'After Image', type: row.fileTypeAfter || 'image' }] : []);
    return {
      ...row,
      imagesBefore,
      imagesAfter,
      imageBefore: imagesBefore[0]?.url || row.imageBefore || null,
      imageBeforeName: imagesBefore[0]?.name || row.imageBeforeName || '',
      imageAfter: imagesAfter[0]?.url || row.imageAfter || null,
      imageAfterName: imagesAfter[0]?.name || row.imageAfterName || ''
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
    return topic?.sheet?.headerInfo || {
      topicName: '',
      preparedBy: '',
      auditNo: '',
      attendees: ''
    };
  }, []);

  // Initialize rows with 10 empty items by default
  const [rows, setRows] = useState(initialRows);

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

  // Baseline snapshot ref to detect unsaved edits during the current editing session
  const initialSnapshotRef = useRef(serializeSheet(initialRows, initialHeaderInfo));
  const initialStateRef = useRef({
    rows: initialRows.map((r) => ({ ...r })),
    headerInfo: { ...initialHeaderInfo }
  });
  const [showDiscardModal, setShowDiscardModal] = useState(false);

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
    } catch {}
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
    } catch {}
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
    } catch {}
    activeColResizeRef.current = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('pdca_observation_col_width', String(observationWidth));
      }
    } catch {}
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
    } catch {}
  }, [observationWidth]);

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

  // Load saved sheet from backend on mount or when topic changes
  useEffect(() => {
    if (!topic?.id) return;
    let active = true;
    pdcaApi.getSheet(topic.id).then(savedSheet => {
      if (!active || !savedSheet) return;
      let finalHeader = headerInfo;
      if (savedSheet.headerInfo && Object.keys(savedSheet.headerInfo).length > 0) {
        finalHeader = { ...headerInfo, ...savedSheet.headerInfo };
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
    if (isSaving) return false;
    // Validate mandatory fields (Date, Shift, Status, Line/Area, Observation) for active rows
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const hasContent = Boolean(
        r.date?.trim() ||
        r.shift?.trim() ||
        r.lineArea?.trim() ||
        r.observation?.trim() ||
        r.imageBefore ||
        (Array.isArray(r.imagesBefore) && r.imagesBefore.length > 0) ||
        r.rootCause?.trim() ||
        r.counterMeasure?.trim() ||
        r.imageAfter ||
        (Array.isArray(r.imagesAfter) && r.imagesAfter.length > 0) ||
        r.responseDate?.trim() ||
        r.department?.trim() ||
        r.staffEmployee?.trim() ||
        r.cftTopic?.trim() ||
        r.responsiblePersonConfirmation?.trim()
      );
      if (hasContent) {
        const missing = [];
        if (!r.date?.trim()) missing.push('Date');
        if (!r.shift?.trim()) missing.push('Shift');
        if (!r.status?.trim()) missing.push('Status');
        if (!r.lineArea?.trim()) missing.push('Line/Area');
        if (!r.observation?.trim()) missing.push('Observation');

        if (missing.length > 0) {
          showToast(`Row ${i + 1}: Mandatory field${missing.length > 1 ? 's' : ''} (${missing.join(', ')}) required.`);
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
      showToast('PDCA saved successfully.');
      onSave?.(sheetSnapshot);
      setTimeout(() => {
        onBack?.();
      }, 500);
      return true;
    } catch (error) {
      persistSheet(sheetSnapshot);
      showToast(error.message || 'Could not save PDCA. Keep the form open and try again.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Determine if user has made unsaved changes in the current editing session
  const hasUnsavedChanges = () => {
    if (!initialSnapshotRef.current) return false;
    return serializeSheet(rows, headerInfo) !== initialSnapshotRef.current;
  };

  // Navigation Back: Separated strictly from save and mandatory validation
  const handleBack = () => {
    if (hasUnsavedChanges()) {
      setShowDiscardModal(true);
    } else {
      onBack?.();
    }
  };

  // Discard all unsaved edits made during the session and navigate back immediately
  const handleDiscardAndGoBack = () => {
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
        members: selectedRowForCFT.cftSelectedName
          ? [
              {
                name: selectedRowForCFT.cftSelectedName,
                code: selectedRowForCFT.cftSelectedCode || '',
                role: 'Member'
              }
            ]
          : [],
        assignedEmployees: selectedRowForCFT.assignedEmployee
          ? [{ name: selectedRowForCFT.assignedEmployee, code: '' }]
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
      const label = emp.code ? `${emp.name} (${emp.code})` : emp.name;
      map.set(label, {
        label,
        name: emp.name,
        code: emp.code || '',
        department: emp.department || ''
      });
    });

    // 2. From CFT topic assigned members if any
    (topic?.assignedMembers || []).forEach((m) => {
      if (m.name) {
        const label = m.code ? `${m.name} (${m.code})` : m.name;
        if (!map.has(label)) {
          const dept = findEmployeeDepartment(label, dbEmployees);
          map.set(label, {
            label,
            name: m.name,
            code: m.code || '',
            department: dept || ''
          });
        }
      }
    });

    // 3. From any existing rows loaded from saved sheet (so historical entries remain visible)
    rows.forEach((r) => {
      if (r.staffEmployee?.trim()) {
        const label = r.staffEmployee.trim();
        if (!map.has(label)) {
          const dept = findEmployeeDepartment(label, dbEmployees);
          map.set(label, {
            label,
            name: label,
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

  const handleSelectTopic = (rowIndex, topicItem) => {
    // 1. Topic appears on row!
    setRows((prev) => {
      const updated = [...prev];
      const isSwitchingTopic = updated[rowIndex]?.cftTopic !== topicItem.name;
      updated[rowIndex] = {
        ...updated[rowIndex],
        cftTopic: topicItem.name,
        cftTopicId: topicItem.id,
        ...(isSwitchingTopic
          ? {
              cftSelectedType: '',
              cftSelectedName: '',
              cftSelectedCode: '',
              assignedEmployee: ''
            }
          : {})
      };
      return updated;
    });
    // Close topic dropdown so topic name is now visible on row
    setOpenCFTDropdown(null);
  };

  const handleSelectCFTMember = (rowIndex, memberObj, type) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        cftSelectedType: type,
        cftSelectedName: memberObj.name,
        cftSelectedCode: memberObj.code || '',
        assignedEmployee: `${memberObj.name}${memberObj.code ? ` (${memberObj.code})` : ''}`
      };
      return updated;
    });
    setOpenCFTDropdown(null);
  };

  const handleClearMemberOnly = (rowIndex) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        cftSelectedType: '',
        cftSelectedName: '',
        cftSelectedCode: '',
        assignedEmployee: ''
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

  // Add Staff Employee Modal: { isOpen, rowIndex, initialValue }
  const [staffEmployeeModal, setStaffEmployeeModal] = useState({
    isOpen: false,
    rowIndex: null,
    initialValue: ''
  });

  const handleOpenAddStaffModal = (rowIndex) => {
    setStaffEmployeeModal({
      isOpen: true,
      rowIndex,
      initialValue: rows[rowIndex]?.staffEmployee || ''
    });
  };

  const handleSaveStaffEmployee = (rowIndex, formattedValue) => {
    handleSelectStaffMember(rowIndex, formattedValue);
  };

  // Focus navigation refs grid: cellRefs.current[`${rowIndex}_${colName}`]
  const cellRefs = useRef({});
  // Measure both header sections so the separate Actions rail starts its rows at the exact table boundary.
  const theadRef = useRef(null);
  const [theadHeight, setTheadHeight] = useState(0);
  const actionsHeaderRef = useRef(null);
  const [actionsHeaderHeight, setActionsHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      if (theadRef.current) {
        setTheadHeight(theadRef.current.getBoundingClientRect().height);
      }
      if (actionsHeaderRef.current) {
        setActionsHeaderHeight(actionsHeaderRef.current.getBoundingClientRect().height);
      }
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(measure)
      : null;
    if (ro && theadRef.current) ro.observe(theadRef.current);
    if (ro && actionsHeaderRef.current) ro.observe(actionsHeaderRef.current);
    return () => ro?.disconnect();
  }, []);

  // Per-row height sync: measure each <tr> so the Actions panel cards match exactly
  const trRowRefs = useRef({});       // index -> <tr> DOM element
  const [rowHeights, setRowHeights] = useState({});   // index -> px height

  // Single ResizeObserver that watches all registered <tr> elements
  const rowObserverRef = useRef(null);
  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const updates = {};
      entries.forEach((entry) => {
        const idx = entry.target.__rowIdx;
        // Preserve fractional CSS pixels so the side rail follows the table row edge exactly.
        if (idx !== undefined) updates[idx] = entry.target.getBoundingClientRect().height;
      });
      if (Object.keys(updates).length > 0) {
        setRowHeights((prev) => ({ ...prev, ...updates }));
      }
    });
    rowObserverRef.current = observer;
    // Observe any already-registered rows
    Object.entries(trRowRefs.current).forEach(([, el]) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  // Callback ref attached to each <tr> – only register/observe, never call setState here
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

  // Seed row heights after render (safe: useEffect runs after commit, not during)
  useEffect(() => {
    const snapshot = {};
    Object.entries(trRowRefs.current).forEach(([i, el]) => {
      if (el) snapshot[Number(i)] = el.getBoundingClientRect().height;
    });
    if (Object.keys(snapshot).length > 0) setRowHeights(snapshot);
  }, [rows.length]); // re-seed whenever rows are added/deleted

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
      updated[rowIndex] = { ...updated[rowIndex], [field]: value };
      return updated;
    });
  };

  // Scenario B & D: When department is manually changed or selected
  const handleDepartmentChange = (rowIndex, dept) => {
    setRows((prev) => {
      const updated = [...prev];
      const prevDept = updated[rowIndex]?.department || '';
      // If department changed: clear staffEmployee so previous employee is not retained (Scenario D)
      // If selecting department first: staffEmployee remains blank (Scenario B)
      const shouldClearStaff = prevDept !== dept;
      updated[rowIndex] = {
        ...updated[rowIndex],
        department: dept,
        staffEmployee: shouldClearStaff ? '' : (updated[rowIndex]?.staffEmployee || '')
      };
      return updated;
    });
  };

  // Scenarios A, C & E: When staff member is selected
  const handleSelectStaffMember = (rowIndex, staffValue) => {
    if (!staffValue || !staffValue.trim()) {
      setRows((prev) => {
        const updated = [...prev];
        updated[rowIndex] = {
          ...updated[rowIndex],
          staffEmployee: ''
        };
        return updated;
      });
      return;
    }

    const trimmedStaff = staffValue.trim();
    // Match against verified employee records in database using Staff ID and Staff Name
    const matchedDept = findEmployeeDepartment(trimmedStaff, dbEmployees);

    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex] || {};

      if (matchedDept) {
        // Scenarios A & C: Auto-populate employee's verified database department
        updated[rowIndex] = {
          ...currentRow,
          staffEmployee: trimmedStaff,
          department: matchedDept
        };
      } else {
        // Scenario E: Missing or ambiguous employee record in DB.
        // Do not guess or assign an arbitrary department. Keep existing department or empty.
        updated[rowIndex] = {
          ...currentRow,
          staffEmployee: trimmedStaff
        };
      }
      return updated;
    });

    if (!matchedDept) {
      showToast(
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

  // Upload file selected from the 4-box modal
  const handleFileUploadFromModal = async (uploadTypeId, file) => {
    const { rowIndex, field, nameField, typeField } = uploadSelectionModal;
    if (rowIndex === null || !file) return;

    const MAX_SIZE = 15 * 1024 * 1024; // 15 MB limit
    if (file.size > MAX_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      window.alert(`The selected file is ${sizeMB} MB, which exceeds the maximum allowed limit of 15 MB. Please select a smaller file.`);
      return;
    }

    // Detect file type
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

      setRows((prev) => {
        const updated = [...prev];
        updated[rowIndex] = {
          ...updated[rowIndex],
          [field]: fileSrc,
          [nameField]: file.name,
          [typeField]: finalType
        };
        return updated;
      });

      // Close selection modal
      setUploadSelectionModal((prev) => ({ ...prev, isOpen: false }));

      // Directly open the View modal after uploading (with Image Name, Edit, and Delete options)
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

  // Remove individual evidence image
  const handleRemoveEvidenceImage = (imageId) => {
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
    setRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        [field]: null,
        [nameField]: '',
        [typeField]: 'image'
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
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleInsertRowAbove = (rowIndex) => {
    setRows((prev) => {
      const updated = [...prev];
      updated.splice(rowIndex, 0, createEmptyRow());
      return updated;
    });
  };

  const handleDeleteRow = (rowIndex) => {
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

  return (
    <div className="pdca-form-root w-full min-w-0 space-y-4 animate-in fade-in duration-150 overflow-x-hidden">
      {/* Control Bar: Back Button, PDCA Audit Matrix, Search & Add Row */}
      <div className="w-full min-w-0 bg-white rounded-xl border border-[#D5DCE5] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* Control Toolbar (Back, PDCA Audit Matrix, Search & Add Row) */}
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
            <button
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-3.5 py-1 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Row</span>
            </button>
            <FormZoomControls rootSelector=".pdca-form-root" />
          </div>
        </div>
      </div>

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
                  colSpan={15}
                  className="py-2.5 px-4 text-center font-bold text-slate-900 text-sm md:text-base tracking-wide select-none"
                >
                  {topic?.topic || 'PDCA - M Tanaka San Audit'}
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
                  colSpan={7}
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
                    value={headerInfo.preparedBy}
                    onChange={(e) => setHeaderInfo({ ...headerInfo, preparedBy: e.target.value })}
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
                  colSpan={7}
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

                {/* P: Plan - Above Status, Line/Area, Observation, Image Before, Root Cause */}
                <th
                  colSpan={5}
                  className="bg-white text-slate-900 font-bold border-r border-[#94A3B8] py-1 px-2 text-center text-xs tracking-widest"
                  title="Plan (P)"
                >
                  P
                </th>

                {/* D: Do - Above Counter Measure, Image After, Response Date */}
                <th
                  colSpan={3}
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

              <tr className="bg-[#ECEFF1] text-slate-800 border-b border-[#475569] text-[11px] font-semibold select-none text-center">
                <th rowSpan={2} className="py-1.5 px-0.5 w-[56px] min-w-[52px] text-center border-r border-[#475569]">
                  <span>Date</span> <span className="text-red-500 font-bold">*</span>
                </th>
                <th rowSpan={2} className="py-1.5 px-0.5 w-[36px] min-w-[34px] text-center border-r border-[#475569]">
                  <span>Shift</span> <span className="text-red-500 font-bold">*</span>
                </th>
                <th rowSpan={2} className="py-1.5 px-0.5 w-[34px] min-w-[30px] text-center border-r border-[#475569]">
                  S.No
                </th>
                <th rowSpan={2} className="py-1.5 px-1 w-[78px] min-w-[78px] text-center border-r border-[#475569] text-[10.5px]">
                  <span>Status</span> <span className="text-red-500 font-bold">*</span>
                </th>
                <th rowSpan={2} className="py-1.5 px-1 w-[130px] min-w-[120px] text-center border-r border-[#475569] text-[10.5px]">
                  <span>Line/Area</span> <span className="text-red-500 font-bold">*</span>
                </th>
                {/* 5. Observation Column Header with Visible, Draggable Width Controller */}
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

                  {/* Visible Draggable Resize Handle */}
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
                    className="group absolute inset-y-0 right-0 z-20 flex w-3.5 cursor-col-resize touch-none items-center justify-center hover:bg-blue-100/70 active:bg-blue-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500 transition-colors"
                  >
                    <span className="h-4 w-1 rounded-full bg-slate-400 group-hover:bg-blue-600 group-active:bg-blue-700 transition-colors shadow-2xs" />
                  </span>
                </th>
                <th rowSpan={2} className="py-1.5 px-1 w-[150px] min-w-[140px] text-center border-r border-[#475569] text-[10.5px]">
                  Image Before
                </th>
                <th rowSpan={2} className="py-1.5 px-1 w-[105px] min-w-[95px] text-center border-r border-[#475569] text-[10.5px]">
                  Root Cause
                </th>
                <th rowSpan={2} className="py-1.5 px-1 w-[105px] min-w-[95px] text-center border-r border-[#475569] leading-tight text-[10.5px]">
                  Counter Measure
                </th>
                <th rowSpan={2} className="py-1.5 px-1 w-[150px] min-w-[140px] text-center border-r border-[#475569] text-[10.5px]">
                  Image After
                </th>
                <th rowSpan={2} className="py-1 px-0.5 w-[56px] min-w-[52px] text-center border-r border-[#475569] leading-tight">
                  <div className="text-[10px] leading-tight font-semibold">Response</div>
                  <div className="text-[10px] leading-tight font-semibold">Date</div>
                </th>
                <th colSpan={3} className="py-1 px-0 border-r border-[#475569] text-center">
                  <div className="text-center font-bold text-[9.5px] text-slate-700 px-1">
                    Responsible Person Confirmation
                  </div>
                </th>
                <th rowSpan={2} className="py-1.5 px-1 w-[100px] min-w-[90px] text-center border-r border-[#475569] leading-tight text-[9.5px]">
                  (Responsible person instructions, etc.)
                </th>
              </tr>

              <tr className="bg-[#ECEFF1] text-slate-600 font-semibold text-[9.5px] border-b-2 border-[#475569] select-none text-center">
                <th className="py-0.5 px-1 text-center border-r border-[#475569] w-[82px] min-w-[75px]">
                  Dept
                </th>
                <th className="py-0.5 px-1 text-center border-r border-[#475569] w-[88px] min-w-[80px]">
                  Staff Name
                </th>
                <th className="py-0.5 px-1 text-center border-r border-[#475569] w-[70px] min-w-[65px]">
                  CFT
                </th>
              </tr>
            </thead>

            {/* Table Rows with thin bordered cells matching reference style */}
            <tbody className="bg-white">
              {rows.map((row, idx) => {
                const sNo = idx + 1;

                return (
                  <tr
                    key={idx}
                    ref={(el) => registerTrRef(idx, el)}
                    className="border-b border-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                  >
                    {/* 1. Date (Stacked: Format on top, Calendar icon below) */}
                    <td className="p-1 align-middle text-center border-r border-[#64748B] w-[56px] min-w-[52px]">
                      <div className="w-full flex items-center justify-center">
                        <CompactDateCell
                          value={row.date}
                          onChange={(val) => handleCellChange(idx, 'date', val)}
                        />
                      </div>
                    </td>

                    {/* 2. Shift (Single letter A/B/C/G, centered in cell) */}
                    <td className="p-1 align-middle text-center border-r border-[#64748B] w-[38px] min-w-[34px] focus-within:bg-blue-50/30">
                      <div className="relative w-full flex items-center justify-center">
                        <select
                          value={row.shift === 'General' ? 'G' : (row.shift || '')}
                          onChange={(e) => handleCellChange(idx, 'shift', e.target.value)}
                          className="w-full bg-transparent border-0 outline-none px-1 py-1 text-xs text-slate-800 font-semibold text-center focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 cursor-pointer transition-colors appearance-none"
                        >
                          <option value="">-</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="G">G</option>
                        </select>
                        <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </td>

                    {/* 3. S.No (Clean uneditable number, centered) */}
                    <td className="p-1 align-middle text-center border-r border-[#64748B] font-semibold text-slate-600 bg-[#FAFAFA] select-none w-[34px] min-w-[30px] text-xs">
                      {sNo}
                    </td>

                    {/* 4. Status (Centered in cell) */}
                    <td className="p-1 align-middle text-center border-r border-[#64748B] w-[82px] min-w-[78px]">
                      <div className="w-full flex items-center justify-center">
                        <select
                          aria-label={`Status for row ${sNo}`}
                          value={row.status || 'Open'}
                          onChange={event => handleCellChange(idx, 'status', event.target.value)}
                          className={`w-full rounded-md border px-1 py-1 text-[11px] font-medium outline-none cursor-pointer text-center focus:ring-2 focus:ring-blue-300 ${
                            row.status === 'Closed' ? 'bg-green-50 text-green-700 border-green-200' :
                            row.status === 'In Progress' ? 'bg-yellow-50 text-yellow-800 border-yellow-300' :
                            row.status === 'Delay' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          <option value="Open" style={{color:'#1d4ed8',backgroundColor:'#eff6ff'}}>Open</option>
                          <option value="Closed" style={{color:'#15803d',backgroundColor:'#f0fdf4'}}>Closed</option>
                          <option value="In Progress" style={{color:'#854d0e',backgroundColor:'#fefce8'}}>In Progress</option>
                          <option value="Delay" style={{color:'#b91c1c',backgroundColor:'#fef2f2'}}>Delay</option>
                        </select>
                      </div>
                    </td>

                    {/* 5. Line/Area (Searchable Dropdown with search bar, centered) */}
                    <td className="p-1 align-middle text-center border-r border-[#64748B] w-[130px] min-w-[120px]">
                      <div className="w-full flex items-center justify-center">
                        <SearchableLineAreaSelect
                          value={row.lineArea}
                          onChange={(val) => handleCellChange(idx, 'lineArea', val)}
                          placeholder="Line/Area..."
                        />
                      </div>
                    </td>

                    {/* 6. Observation (Auto-expanding, resizable width, wrapped multiline text) */}
                    <td
                      style={{
                        width: `${observationWidth}px`,
                        minWidth: `${observationWidth}px`,
                        maxWidth: `${observationWidth}px`
                      }}
                      className="p-1 align-top border-r border-[#64748B] focus-within:bg-blue-50/30 text-left overflow-hidden"
                    >
                      <AutoResizeTextarea
                        inputRef={(el) => registerRef(idx, 'observation', el)}
                        value={row.observation}
                        onChange={(e) => handleCellChange(idx, 'observation', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'observation')}
                        placeholder="Observation details..."
                        className="w-full bg-transparent border-0 outline-none p-1.5 text-xs text-slate-800 text-left leading-relaxed focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 whitespace-pre-wrap break-words"
                      />
                    </td>

                    {/* 7. Image (Before) - Compact when empty; expands only when evidence is uploaded */}
                    <td className="p-1 align-middle border-r border-[#64748B] w-[150px] min-w-[140px] text-center">
                      {(() => {
                        const beforeImages = Array.isArray(row.imagesBefore)
                          ? row.imagesBefore
                          : (row.imageBefore ? [{ id: 'legacy-before-0', url: row.imageBefore, name: row.imageBeforeName || 'Before Image', type: 'image' }] : []);
                        const hasImages = beforeImages.length > 0;

                        if (hasImages) {
                          return (
                            <div className="flex items-center justify-center w-full py-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEvidenceViewer(idx, 'imageBefore')}
                                className="group relative inline-flex flex-col items-center justify-center p-1.5 rounded-xl border border-slate-300 hover:border-blue-500 hover:ring-2 hover:ring-blue-100 transition-all cursor-pointer bg-slate-50/80 shadow-2xs overflow-hidden w-full"
                                title={`Click to view all ${beforeImages.length} evidence photo(s), add more, edit or remove`}
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

                        // Compact default icon button when empty
                        return (
                          <div className="flex items-center justify-center w-full py-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEvidenceViewer(idx, 'imageBefore')}
                              className="group flex items-center justify-center w-9 h-9 rounded-lg border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/80 hover:bg-blue-50/50 transition-all cursor-pointer shadow-2xs hover:scale-105"
                              title="Click to add evidence images"
                            >
                              <ImageIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                            </button>
                          </div>
                        );
                      })()}
                    </td>

                    {/* 8. Root Cause (Auto-expanding, vertically and horizontally centered) */}
                    <td className="p-1 align-middle border-r border-[#64748B] w-[105px] min-w-[95px] focus-within:bg-blue-50/30 text-center">
                      <div className="w-full flex items-center justify-center">
                        <AutoResizeTextarea
                          inputRef={(el) => registerRef(idx, 'rootCause', el)}
                          value={row.rootCause}
                          onChange={(e) => handleCellChange(idx, 'rootCause', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 'rootCause')}
                          placeholder="Root cause..."
                          className="w-full bg-transparent border-0 outline-none p-1.5 text-xs text-slate-800 text-center leading-snug focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center"
                        />
                      </div>
                    </td>

                    {/* 9. Counter Measure (Auto-expanding, vertically and horizontally centered) */}
                    <td className="p-1 align-middle border-r border-[#64748B] w-[105px] min-w-[95px] focus-within:bg-blue-50/30 text-center">
                      <div className="w-full flex items-center justify-center">
                        <AutoResizeTextarea
                          inputRef={(el) => registerRef(idx, 'counterMeasure', el)}
                          value={row.counterMeasure}
                          onChange={(e) => handleCellChange(idx, 'counterMeasure', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 'counterMeasure')}
                          placeholder="Counter measure..."
                          className="w-full bg-transparent border-0 outline-none p-1.5 text-xs text-slate-800 text-center leading-snug focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center"
                        />
                      </div>
                    </td>

                    {/* 10. Image After - Compact when empty; expands only when evidence is uploaded */}
                    <td className="p-1 align-middle border-r border-[#64748B] w-[150px] min-w-[140px] text-center">
                      {(() => {
                        const afterImages = Array.isArray(row.imagesAfter)
                          ? row.imagesAfter
                          : (row.imageAfter ? [{ id: 'legacy-after-0', url: row.imageAfter, name: row.imageAfterName || 'After Image', type: 'image' }] : []);
                        const hasImages = afterImages.length > 0;

                        if (hasImages) {
                          return (
                            <div className="flex items-center justify-center w-full py-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEvidenceViewer(idx, 'imageAfter')}
                                className="group relative inline-flex flex-col items-center justify-center p-1.5 rounded-xl border border-slate-300 hover:border-blue-500 hover:ring-2 hover:ring-blue-100 transition-all cursor-pointer bg-slate-50/80 shadow-2xs overflow-hidden w-full"
                                title={`Click to view all ${afterImages.length} evidence photo(s), add more, edit or remove`}
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

                        // Compact default icon button when empty
                        return (
                          <div className="flex items-center justify-center w-full py-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEvidenceViewer(idx, 'imageAfter')}
                              className="group flex items-center justify-center w-9 h-9 rounded-lg border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/80 hover:bg-blue-50/50 transition-all cursor-pointer shadow-2xs hover:scale-105"
                              title="Click to add evidence images"
                            >
                              <ImageIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                            </button>
                          </div>
                        );
                      })()}
                    </td>

                    {/* 11. Response Date (Stacked: Format on top, Calendar icon below, centered) */}
                    <td className="p-1 align-middle text-center border-r border-[#64748B] w-[56px] min-w-[52px]">
                      <div className="w-full flex items-center justify-center">
                        <CompactDateCell
                          value={row.responseDate}
                          onChange={(val) => handleCellChange(idx, 'responseDate', val)}
                        />
                      </div>
                    </td>

                    {/* 12. Department Dropdown (Centered in cell) */}
                    <td className="p-1 align-middle text-center border-r border-[#64748B] w-[82px] min-w-[75px]">
                      <div className="relative w-full flex items-center justify-center focus-within:bg-blue-50/30">
                        <select
                          value={row.department || ''}
                          onChange={(e) => handleDepartmentChange(idx, e.target.value)}
                          className="w-full bg-transparent border-0 outline-none pl-1 pr-3 py-1.5 text-[10.5px] text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 cursor-pointer appearance-none truncate"
                          title={row.department || 'Select Department'}
                        >
                          <option value="">Dept...</option>
                          {row.department && !departmentsList.includes(row.department) && (
                            <option value={row.department}>{row.department}</option>
                          )}
                          {departmentsList.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </td>

                    {/* 13. Staff Name (Centered in cell) */}
                    <td className="p-1 align-middle text-center border-r border-[#64748B] w-[88px] min-w-[80px]">
                      <div className="relative w-full flex items-center justify-center">
                        {row.staffEmployee ? (
                          <div className="relative w-full pl-1 pr-4 py-1 flex items-center justify-between gap-0.5 group">
                            <button
                              type="button"
                              onClick={(e) => handleToggleStaffDropdown(idx, e)}
                              className="staff-trigger-btn flex-1 min-w-0 flex flex-col items-center justify-center text-center cursor-pointer hover:opacity-85 transition-opacity"
                              title={`Click to search/change staff: ${row.staffEmployee}`}
                            >
                              <span className="text-[10px] font-semibold text-slate-800 truncate w-full text-center hover:text-blue-600 transition-colors">
                                {row.staffEmployee}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectStaffMember(idx, '');
                              }}
                              className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded transition-all cursor-pointer flex-shrink-0"
                              title="Clear staff employee"
                            >
                              <X className="w-3 h-3 stroke-[2.5]" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleToggleStaffDropdown(idx, e)}
                            className="staff-trigger-btn w-full py-1.5 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors cursor-pointer pl-1 pr-4 group"
                            title="Click to search and select staff employee"
                          >
                            <div className="flex items-center gap-0.5 text-[9.5px] text-slate-400 group-hover:text-blue-600">
                              <Search className="w-2.5 h-2.5" />
                              <span className="truncate">Staff...</span>
                              <ChevronDown className="w-2.5 h-2.5" />
                            </div>
                          </button>
                        )}

                        {/* Down right side '+' option button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAddStaffModal(idx);
                          }}
                          className="absolute bottom-0.5 right-0.5 z-10 w-4 h-4 rounded-full bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 border border-blue-200/80 flex items-center justify-center cursor-pointer transition-all shadow-2xs hover:shadow-xs"
                          title="Add custom staff manually (+)"
                        >
                          <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                        </button>
                      </div>
                    </td>

                    {/* 14. CFT (Centered in cell) */}
                    <td className="p-1 align-middle text-center border-r border-[#64748B] w-[70px] min-w-[65px]">
                      <div className="relative w-full flex items-center justify-center">
                        {row.cftTopic ? (
                          <div className="w-full px-1 py-0.5 flex items-center justify-between gap-0.5 group/cft-cell">
                            {/* Left: Topic Name & Optional Member Name (clickable to open Members dropdown) */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleCFTDropdown(idx, e, 'members')}
                              className="cft-trigger-btn flex-1 min-w-0 text-left cursor-pointer flex flex-col justify-center py-0.5 hover:opacity-85 transition-opacity"
                              title="Click to view and select Members / Assigned Employees for this topic"
                            >
                              <span
                                className="text-[10px] font-semibold truncate max-w-[65px] leading-tight text-blue-900 hover:text-blue-700 transition-colors"
                                title={row.cftTopic}
                              >
                                {row.cftTopic}
                              </span>
                              {row.cftSelectedName && (
                                <div className="flex items-center gap-0.5 mt-0.5">
                                  <span
                                    className={`text-[8.5px] font-medium truncate max-w-[60px] px-0.5 py-0.2 rounded leading-tight ${
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

                            {/* Right: Edit & Delete buttons */}
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
                          </div>
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

                    {/* 15. (Responsible person instructions, etc.) (Auto-expanding, centered) */}
                    <td className="p-1 align-middle border-r border-[#64748B] w-[100px] min-w-[90px] focus-within:bg-blue-50/30 text-center">
                      <div className="w-full flex items-center justify-center">
                        <AutoResizeTextarea
                          inputRef={(el) => registerRef(idx, 'responsiblePersonConfirmation', el)}
                          value={row.responsiblePersonConfirmation}
                          onChange={(e) => handleCellChange(idx, 'responsiblePersonConfirmation', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 'responsiblePersonConfirmation')}
                          placeholder="Instructions, remarks..."
                          className="w-full bg-transparent border-0 outline-none p-1.5 text-xs text-slate-800 text-center leading-snug focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center"
                        />
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>{/* end main table wrapper */}

          {/* ── ACTIONS Side Panel ── */}
          <div className="flex-shrink-0 w-[40px] bg-[#F8FAFC] flex flex-col">
            {/* Panel Header */}
            <div ref={actionsHeaderRef} className="sticky top-0 z-10 bg-white px-2 py-[9px] flex items-center justify-center gap-1.5 select-none">


            </div>

            {/* Spacer that matches the remaining thead rows below the panel header */}
            <div style={{ height: Math.max(0, theadHeight - actionsHeaderHeight), boxSizing: 'border-box' }} aria-hidden="true" />

            {/* Per-row action icons – one pair per row, stacked vertically */}
            {rows.map((_, idx) => (
              <div
                key={idx}
                style={{ height: rowHeights[idx] ? `${rowHeights[idx]}px` : '43px', boxSizing: 'border-box' }}
                className="flex flex-col items-center justify-center gap-0.5 px-2 border-b border-[#64748B] group hover:bg-blue-50/20 transition-colors"
              >
                {/* Insert Row Above – icon only */}
                <button
                  type="button"
                  onClick={() => handleInsertRowAbove(idx)}
                  className="flex items-center justify-center w-5 h-5 shrink-0 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all shadow-2xs cursor-pointer"
                  title="Insert row above"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>

                {/* Delete Row – icon only */}
                <button
                  type="button"
                  onClick={() => handleDeleteRow(idx)}
                  className="flex items-center justify-center w-5 h-5 shrink-0 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-all shadow-2xs cursor-pointer"
                  title="Delete this row"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            ))}
          </div>{/* end actions panel */}

        </div>{/* end flex wrapper */}

        {/* Footer info matching reference screenshot bottom strip */}
        <div className="bg-[#F8FAFC] border-t border-[#B0BEC5] px-4 py-2 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Infinite rows active</span>
          </div>

          <button
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-300 rounded shadow-2xs cursor-pointer text-xs"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>Add Row</span>
          </button>
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
                {/* Replace Button */}
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

                {/* Edit Button (visible for images) */}
                {selectedImageAction.fileType === 'image' && (
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

                {/* Download Button */}
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

                {/* Delete Button */}
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
                  cftTopics.map((topicItem) => {
                    const currentRow = rows[openCFTDropdown.rowIndex];
                    const isSelected =
                      currentRow?.cftTopicId === topicItem.id ||
                      (!currentRow?.cftTopicId && currentRow?.cftTopic === topicItem.name);

                    return (
                      <button
                        key={topicItem.id}
                        type="button"
                        onClick={() => handleSelectTopic(openCFTDropdown.rowIndex, topicItem)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between cursor-pointer group ${
                          isSelected
                            ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200'
                            : 'hover:bg-slate-100/80 text-slate-800 border border-transparent'
                        }`}
                        title={`Select "${topicItem.name}" (${topicItem.id})`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isSelected ? 'bg-blue-600 ring-2 ring-blue-200' : 'bg-slate-400 group-hover:bg-blue-500'
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
                  })
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
                            className={`w-full text-left px-2.5 py-1.5 rounded-md transition-colors flex items-center justify-between cursor-pointer ${
                              isSelected
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
                            className={`w-full text-left px-2.5 py-1.5 rounded-md transition-colors flex items-center justify-between cursor-pointer ${
                              isSelected
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
                      handleSelectStaffMember(openStaffDropdown.rowIndex, empName);
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
                      <span className="truncate">{empName}</span>
                    </div>
                    {empDept && (
                      <span
                        className={`text-[9.5px] font-medium px-1.5 py-0.5 rounded shrink-0 border ${
                          isDeptMatch
                            ? 'bg-blue-100/80 text-blue-800 border-blue-300 font-semibold'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {empDept}
                      </span>
                    )}
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
        onSave={handleSaveStaffEmployee}
        onClose={() => setStaffEmployeeModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Discard Unsaved Changes Confirmation Modal */}
      {showDiscardModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 mx-auto sm:mx-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800 text-center sm:text-left">
                Discard unsaved changes?
              </h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed text-center sm:text-left">
                You have unsaved changes in this PDCA form. If you leave now, all unsaved edits will be discarded.
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row-reverse items-center gap-2.5">
              <button
                type="button"
                onClick={handleDiscardAndGoBack}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-xs cursor-pointer transition-colors"
              >
                Discard Changes &amp; Go Back
              </button>
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 shadow-2xs cursor-pointer transition-colors"
              >
                Stay on Page
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
