import { usePDCAAutosave as useFormAutosave } from '@hooks/pdca/usePDCAAutosave.js';
import FormZoomControls from '@components/shared/FormZoomControls';
import React, { useState, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
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
  Users
} from 'lucide-react';
import ImageEditorModal from '../pdca/ImageEditorModal';
import FileUploadSelectionModal from '../pdca/FileUploadSelectionModal';
import AddStaffEmployeeModal from '../pdca/AddStaffEmployeeModal';
import { usePDCA } from '@hooks/pdca/usePDCA.js';

// Department to Employees mapping
const departmentEmployeesData = {
  'SRC Quality': [
    'Yogesh Kumar (AS081213)',
    'Ramesh Patel (GJ021944)',
    'Vikram Singh (GJ034112)'
  ],
  'Die Casting': [
    'Rahul Sharma (BW041920)',
    'Dinesh Rao (BW028371)',
    'Mukesh Verma (BW051289)'
  ],
  'EHS Safety': [
    'Amit Patel (GJ092311)',
    'Kavita Joshi (GJ019283)'
  ],
  'Plant Maintenance': [
    'Sandeep Verma (BW071562)',
    'Rajesh Kumar (BW081290)',
    'Pooja Nair (BW039182)'
  ],
  'Wiring Harness': [
    'Priya Nair (GJ018442)',
    'Suresh Yadav (GJ047219)'
  ],
  'Press & Stamping': [
    'Manish Joshi (BW092301)',
    'Ajay Verma (BW012398)'
  ],
  'IQC Quality': [
    'Deepak Mehta (GJ045819)',
    'Sunil Kumar (GJ082711)'
  ],
  'Robotics': [
    'Anil Gupta (BW038291)',
    'Karan Malhotra (BW091823)'
  ],
  'Logistics': [
    'Yogesh Kumar (AS081213)',
    'Naveen Yadav (GJ019482)'
  ],
  'Tool Room': [
    'Yogesh Kumar (AS081213)',
    'Brijesh Sharma (BW029384)'
  ],
  'Production': [
    'Arun Sharma (PR019283)',
    'Mahesh Rao (PR029381)',
    'Sanjay Gupta (PR039182)'
  ]
};

const createEmptyRow = (customDefaults = {}) => ({
  date: customDefaults.date || '',
  shift: customDefaults.shift || '',
  lineArea: customDefaults.lineArea || '',
  status: customDefaults.status || 'Open',
  observation: customDefaults.observation || '',
  imageBefore: customDefaults.imageBefore || null,
  imageBeforeName: customDefaults.imageBeforeName || '',
  fileTypeBefore: customDefaults.fileTypeBefore || 'image',
  rootCause: customDefaults.rootCause || '',
  counterMeasure: customDefaults.counterMeasure || '',
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
function CompactDateCell({ value, onChange }) {
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
        <div className="flex flex-col items-center leading-none text-center pointer-events-none">
          <span className="text-[11px] font-bold text-slate-800 tracking-tight">
            {display.line1}
          </span>
          {display.line2 && (
            <span className="text-[9.5px] font-semibold text-slate-500 mt-0.5">
              /{display.line2}
            </span>
          )}
        </div>
      ) : (
        <div className="w-full flex items-center justify-center text-center pointer-events-none">
          <Calendar className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors mx-auto" />
        </div>
      )}
    </div>
  );
}

export default function LpaPdcaSheet({ topic, onBack, onSave, currentDate, onDateChange }) {
  const { data, setData, showToast } = usePDCA();
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

  // Local rows state
  const [rows, setRows] = useState(() => {
    return topic?.sheet?.rows || Array.from({ length: 10 }, () => createEmptyRow());
  });

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

  // Editable Sheet Header Details
  const [headerInfo, setHeaderInfo] = useState(topic?.sheet?.headerInfo || {
    topicName: '',
    preparedBy: '',
    auditNo: '',
    attendees: ''
  });

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

  useFormAutosave(sheetSnapshot, persistSheet, Boolean(topic?.id), (msg) => notify(msg, 'info'));

  // Save handler with validation and user feedback
  const saveSheet = async () => {
    if (isSaving) return false;

    // Validate mandatory fields for rows that have observations/findings
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
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
      persistSheet(sheetSnapshot);
      notify('PDCA form saved successfully.', 'success');
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

  const topicName = headerInfo.topicName || topic?.topic || 'Quality Inspection & Line Audit';
  const createdByName = topic?.createdBy?.name || (topic?.createdBy?.code ? 'Member' : 'Pooja Verma');
  const createdByCode = topic?.createdBy?.code || (topic?.createdBy?.name ? '' : 'BW082319');

  // Available CFT topics
  const availableCFTTopics = useMemo(() => {
    const currentObj = {
      id: topic?.id || 'current_topic',
      name: topicName,
      members: [
        {
          name: createdByName,
          code: createdByCode,
          role: 'Lead Member'
        }
      ],
      assignedEmployees: (topic?.assignedMembers && topic.assignedMembers.length > 0)
        ? topic.assignedMembers
        : [
            { name: 'Rahul Sharma', code: 'BW041920' },
            { name: 'Dinesh Rao', code: 'BW028371' },
            { name: 'Mukesh Verma', code: 'BW051289' }
          ]
    };

    const otherCFTs = (data || [])
      .filter((d) => d.scope === 'CFT' && d.id !== topic?.id && d.topic !== topicName)
      .map((d) => ({
        id: d.id,
        name: d.topic,
        members: [
          {
            name: d.createdBy?.name || 'Member',
            code: d.createdBy?.code || '',
            role: 'Lead Member'
          }
        ],
        assignedEmployees: (d.assignedMembers && d.assignedMembers.length > 0)
          ? d.assignedMembers
          : [
              { name: 'Deepak Mehta', code: 'GJ045819' },
              { name: 'Priya Nair', code: 'GJ018442' }
            ]
      }));

    const defaultTopics = [
      {
        id: 'cft-team-comp',
        name: 'Team Composition & Role',
        members: [{ name: 'Yogesh Kumar', code: 'AS081213', role: 'Lead Member' }],
        assignedEmployees: [
          { name: 'Vikram Singh', code: 'GJ034112' },
          { name: 'Ramesh Patel', code: 'GJ021944' }
        ]
      },
      {
        id: 'cft-align-goal',
        name: 'Alignment & Goal Setting',
        members: [{ name: 'Amit Patel', code: 'GJ092311', role: 'Lead Member' }],
        assignedEmployees: [
          { name: 'Kavita Joshi', code: 'GJ019283' },
          { name: 'Pooja Nair', code: 'BW039182' }
        ]
      },
      {
        id: 'cft-comm-proto',
        name: 'Communication Protocols',
        members: [{ name: 'Priya Nair', code: 'GJ018442', role: 'Lead Member' }],
        assignedEmployees: [
          { name: 'Deepak Mehta', code: 'GJ045819' },
          { name: 'Suresh Yadav', code: 'GJ047219' }
        ]
      },
      {
        id: 'cft-risk-mgmt',
        name: 'Risk Management',
        members: [{ name: 'Rahul Sharma', code: 'BW041920', role: 'Lead Member' }],
        assignedEmployees: [
          { name: 'Dinesh Rao', code: 'BW028371' },
          { name: 'Mukesh Verma', code: 'BW051289' }
        ]
      },
      {
        id: 'cft-perf-metrics',
        name: 'Performance Metrics',
        members: [{ name: 'Sandeep Verma', code: 'BW071562', role: 'Lead Member' }],
        assignedEmployees: [
          { name: 'Rajesh Kumar', code: 'BW081290' },
          { name: 'Anil Gupta', code: 'BW038291' }
        ]
      }
    ];

    const map = new Map();
    [currentObj, ...otherCFTs, ...defaultTopics].forEach(item => {
      if (item && item.id && !map.has(item.id)) {
        map.set(item.id, item);
      }
    });
    return Array.from(map.values());
  }, [topic, data, topicName, createdByName, createdByCode]);

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

  const getStaffOptionsForRow = (rowIndex) => {
    const row = rows[rowIndex];
    const deptEmployees = row?.department ? (departmentEmployeesData[row.department] || []) : [];
    const query = staffSearchQuery.trim().toLowerCase();

    if (query) {
      const allEmps = new Set();
      Object.values(departmentEmployeesData).forEach(list => list.forEach(name => allEmps.add(name)));
      return Array.from(allEmps).filter(emp => emp.toLowerCase().includes(query));
    }

    if (deptEmployees.length > 0) {
      return deptEmployees;
    }

    const allEmps = new Set();
    Object.values(departmentEmployeesData).forEach(list => list.forEach(name => allEmps.add(name)));
    return Array.from(allEmps);
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

      updated[rowIndex] = {
        ...updated[rowIndex],
        cftTopic: topicObj.name,
        cftTopicId: topicObj.id,
        cftSelectedType: selectedType,
        cftSelectedName: personObj ? personObj.name : '',
        cftSelectedCode: personObj ? personObj.code : '',
        assignedEmployee: assignedStr
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
    initialValue: ''
  });

  const handleOpenAddStaffModal = (rowIndex) => {
    const row = rows[rowIndex];
    setStaffEmployeeModal({
      isOpen: true,
      rowIndex,
      initialValue: row?.staffEmployee || ''
    });
  };

  const handleSaveStaffEmployee = (rowIndex, fullStaffString) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        staffEmployee: fullStaffString
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
      updated[rowIndex] = { ...updated[rowIndex], [field]: value };
      return updated;
    });
  };

  const handleDepartmentChange = (rowIndex, dept) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        department: dept
      };
      return updated;
    });
  };

  // Add Row
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      createEmptyRow({
        date: currentDate || new Date().toISOString().slice(0, 10),
        status: 'Open'
      })
    ]);
  };

  // Insert Row Above
  const handleInsertRowAbove = (idx) => {
    setRows((prev) => {
      const updated = [...prev];
      updated.splice(
        idx,
        0,
        createEmptyRow({
          date: currentDate || new Date().toISOString().slice(0, 10),
          status: 'Open'
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

  const departmentsList = Object.keys(departmentEmployeesData);

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
                  <th rowSpan={2} className="py-1.5 px-1 w-[78px] min-w-[78px] text-center border-r border-[#B0BEC5]">
                    <span>Status</span> <span className="text-red-500 font-bold">*</span>
                  </th>

                  {/* 5. Line/Area */}
                  <th rowSpan={2} className="py-1.5 px-1 w-[110px] min-w-[100px] text-center border-r border-[#B0BEC5]">
                    <span>Line/Area</span> <span className="text-red-500 font-bold">*</span>
                  </th>

                  {/* 6. Observation */}
                  <th rowSpan={2} className="py-1.5 px-1 w-[210px] min-w-[180px] text-center border-r border-[#B0BEC5]">
                    <span>Observation</span> <span className="text-red-500 font-bold">*</span>
                  </th>

                  {/* 7. Image Before */}
                  <th rowSpan={2} className="py-1.5 px-1 w-[85px] min-w-[80px] text-center border-r border-[#B0BEC5] text-[10.5px]">
                    Image Before
                  </th>

                  {/* 8. Root Cause */}
                  <th rowSpan={2} className="py-1.5 px-1 w-[125px] min-w-[110px] text-center border-r border-[#B0BEC5]">
                    Root Cause
                  </th>

                  {/* 9. Counter Measure */}
                  <th rowSpan={2} className="py-1.5 px-1 w-[140px] min-w-[120px] text-center border-r border-[#B0BEC5]">
                    Counter Measure
                  </th>

                  {/* 10. Image After */}
                  <th rowSpan={2} className="py-1.5 px-1 w-[85px] min-w-[80px] text-center border-r border-[#B0BEC5] text-[10.5px]">
                    Image After
                  </th>

                  {/* 11. Response Date */}
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

                  {/* 15. Instructions */}
                  <th rowSpan={2} className="py-1.5 px-1 w-[100px] min-w-[90px] text-center border-r border-[#B0BEC5] leading-tight text-[9.5px]">
                    (Responsible person instructions, etc.)
                  </th>
                </tr>

                {/* Row 5: Column Subheaders for Dept, Staff Name, CFT */}
                <tr className="bg-white border-b border-[#B0BEC5] text-slate-600 font-semibold text-[9.5px] select-none">
                  <th className="py-0.5 px-1 text-center border-r border-[#B0BEC5] w-[82px] min-w-[75px]">
                    Dept
                  </th>
                  <th className="py-0.5 px-1 text-center border-r border-[#B0BEC5] w-[88px] min-w-[80px]">
                    Staff Name
                  </th>
                  <th className="py-0.5 px-1 text-center border-r border-[#B0BEC5] w-[70px] min-w-[65px]">
                    CFT
                  </th>
                </tr>
              </thead>

              {/* Table Rows */}
              <tbody className="bg-white">
                {filteredRows.map((row) => {
                  const idx = row.originalIndex;
                  const sNo = idx + 1;

                  return (
                    <tr
                      key={idx}
                      ref={(el) => registerTrRef(idx, el)}
                      className="border-b border-[#CFD8DC] hover:bg-[#F8FAFC] transition-colors"
                    >
                      {/* 1. Date */}
                      <td className="p-0 align-middle text-center border-r border-[#CFD8DC] w-[56px] min-w-[52px]">
                        <CompactDateCell
                          value={row.date}
                          onChange={(val) => handleCellChange(idx, 'date', val)}
                        />
                      </td>

                      {/* 2. Shift */}
                      <td className="p-0 align-middle border-r border-[#CFD8DC] w-[36px] min-w-[34px] focus-within:bg-blue-50/30">
                        <div className="relative w-full h-full flex items-center justify-center">
                          <select
                            value={row.shift === 'General' ? 'G' : (row.shift || '')}
                            onChange={(e) => handleCellChange(idx, 'shift', e.target.value)}
                            className="w-full bg-transparent border-0 outline-none pl-1 pr-3 py-1.5 text-xs text-slate-800 font-semibold text-center focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 cursor-pointer transition-colors appearance-none"
                          >
                            <option value="">-</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="G">G</option>
                          </select>
                          <ChevronDown className="w-2 h-2 text-slate-400 absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </td>

                      {/* 3. S.No */}
                      <td className="p-0.5 align-middle text-center border-r border-[#CFD8DC] font-semibold text-slate-600 bg-[#FAFAFA] select-none w-[34px] min-w-[30px] text-xs">
                        {sNo}
                      </td>

                      {/* 4. Status */}
                      <td className="px-0.5 py-1 align-middle text-center border-r border-[#CFD8DC] w-[78px] min-w-[78px]">
                        <select
                          aria-label={`Status for row ${sNo}`}
                          value={row.status || 'Open'}
                          onChange={(event) => handleCellChange(idx, 'status', event.target.value)}
                          className={`w-full rounded-md border pl-0.5 pr-0 py-1.5 text-[11px] font-medium outline-none cursor-pointer focus:ring-2 focus:ring-blue-300 ${
                            row.status === 'Closed' ? 'bg-green-50 text-green-700 border-green-200' :
                            row.status === 'In Progress' ? 'bg-yellow-50 text-yellow-800 border-yellow-300' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>

                      {/* 5. Line/Area */}
                      <td className="p-0.5 align-middle border-r border-[#CFD8DC] w-[110px] min-w-[100px] focus-within:bg-blue-50/30 text-center">
                        <AutoResizeTextarea
                          inputRef={(el) => registerRef(idx, 'lineArea', el)}
                          value={row.lineArea}
                          onChange={(e) => handleCellChange(idx, 'lineArea', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 'lineArea')}
                          placeholder=""
                          className="w-full bg-transparent border-0 outline-none p-1 text-xs text-slate-800 text-center leading-normal focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block whitespace-pre-wrap break-words"
                        />
                      </td>

                      {/* 6. Observation */}
                      <td className="p-0.5 align-middle border-r border-[#CFD8DC] w-[210px] min-w-[180px] focus-within:bg-blue-50/30 text-center">
                        <AutoResizeTextarea
                          inputRef={(el) => registerRef(idx, 'observation', el)}
                          value={row.observation}
                          onChange={(e) => handleCellChange(idx, 'observation', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 'observation')}
                          placeholder=""
                          className="w-full bg-transparent border-0 outline-none p-1 text-xs text-slate-800 text-center leading-normal focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block whitespace-pre-wrap break-words"
                        />
                      </td>

                      {/* 7. Image Before */}
                      <td className="p-1 align-middle text-center border-r border-[#CFD8DC] w-[85px] min-w-[80px]">
                        {row.imageBefore ? (
                          <div className="relative group mx-auto w-12 h-12 rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                            {row.fileTypeBefore === 'excel' ? (
                              <div
                                onClick={() => setSelectedImageAction({
                                  type: 'before',
                                  rowIndex: idx,
                                  preview: row.imageBefore,
                                  fileType: row.fileTypeBefore,
                                  fileName: row.imageBeforeName
                                })}
                                className="w-full h-full bg-emerald-50 flex flex-col items-center justify-center p-0.5 cursor-pointer hover:bg-emerald-100 transition-colors"
                              >
                                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                                <span className="text-[7.5px] font-bold text-emerald-800 truncate w-full text-center px-0.5 mt-0.5">
                                  {row.imageBeforeName || 'Excel'}
                                </span>
                              </div>
                            ) : row.fileTypeBefore === 'pdf' ? (
                              <div
                                onClick={() => setSelectedImageAction({
                                  type: 'before',
                                  rowIndex: idx,
                                  preview: row.imageBefore,
                                  fileType: row.fileTypeBefore,
                                  fileName: row.imageBeforeName
                                })}
                                className="w-full h-full bg-rose-50 flex flex-col items-center justify-center p-0.5 cursor-pointer hover:bg-rose-100 transition-colors"
                              >
                                <FileText className="w-5 h-5 text-rose-600" />
                                <span className="text-[7.5px] font-bold text-rose-800 truncate w-full text-center px-0.5 mt-0.5">
                                  {row.imageBeforeName || 'PDF'}
                                </span>
                              </div>
                            ) : row.fileTypeBefore === 'ppt' ? (
                              <div
                                onClick={() => setSelectedImageAction({
                                  type: 'before',
                                  rowIndex: idx,
                                  preview: row.imageBefore,
                                  fileType: row.fileTypeBefore,
                                  fileName: row.imageBeforeName
                                })}
                                className="w-full h-full bg-orange-50 flex flex-col items-center justify-center p-0.5 cursor-pointer hover:bg-orange-100 transition-colors"
                              >
                                <Presentation className="w-5 h-5 text-orange-600" />
                                <span className="text-[7.5px] font-bold text-orange-800 truncate w-full text-center px-0.5 mt-0.5">
                                  {row.imageBeforeName || 'PPT'}
                                </span>
                              </div>
                            ) : (
                              <img
                                src={row.imageBefore}
                                alt="Before"
                                onClick={() => setSelectedImageAction({
                                  type: 'before',
                                  rowIndex: idx,
                                  preview: row.imageBefore,
                                  fileType: 'image'
                                })}
                                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center">
                            <button
                              type="button"
                              onClick={() => setSelectedImageAction({ type: 'before', rowIndex: idx, isNew: true })}
                              className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 rounded text-[10px] font-medium transition-colors flex items-center gap-1 shadow-2xs cursor-pointer border-dashed"
                            >
                              <Upload className="w-2.5 h-2.5" />
                              <span>Upload</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 8. Root Cause */}
                      <td className="p-0 align-middle border-r border-[#CFD8DC] w-[125px] min-w-[110px] focus-within:bg-blue-50/30 text-center">
                        <AutoResizeTextarea
                          inputRef={(el) => registerRef(idx, 'rootCause', el)}
                          value={row.rootCause}
                          onChange={(e) => handleCellChange(idx, 'rootCause', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 'rootCause')}
                          placeholder="Root cause..."
                          className="w-full bg-transparent border-0 outline-none p-1 text-xs text-slate-800 text-center leading-normal focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center whitespace-pre-wrap break-words"
                        />
                      </td>

                      {/* 9. Counter Measure */}
                      <td className="p-0.5 align-middle border-r border-[#CFD8DC] w-[140px] min-w-[120px] focus-within:bg-blue-50/30 text-center">
                        <AutoResizeTextarea
                          inputRef={(el) => registerRef(idx, 'counterMeasure', el)}
                          value={row.counterMeasure}
                          onChange={(e) => handleCellChange(idx, 'counterMeasure', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 'counterMeasure')}
                          placeholder="Counter measure..."
                          className="w-full bg-transparent border-0 outline-none p-1 text-xs text-slate-800 text-center leading-normal focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center whitespace-pre-wrap break-words"
                        />
                      </td>

                      {/* 10. Image After */}
                      <td className="p-1 align-middle text-center border-r border-[#CFD8DC] w-[85px] min-w-[80px]">
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
                        ) : (
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
                        )}
                      </td>

                      {/* 11. Response Date */}
                      <td className="p-0 align-middle text-center border-r border-[#CFD8DC] w-[56px] min-w-[52px]">
                        <CompactDateCell
                          value={row.responseDate}
                          onChange={(val) => handleCellChange(idx, 'responseDate', val)}
                        />
                      </td>

                      {/* 12. Dept (Native Table Cell - Fully responsive height) */}
                      <td className="p-0 align-middle text-center border-r border-[#CFD8DC] w-[82px] min-w-[75px]">
                        <div className="relative w-full h-full min-h-[42px] flex items-center justify-center focus-within:bg-blue-50/30">
                          <select
                            value={row.department || ''}
                            onChange={(e) => handleDepartmentChange(idx, e.target.value)}
                            className="w-full bg-transparent border-0 outline-none pl-1 pr-3 py-1.5 text-[10.5px] text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 cursor-pointer appearance-none truncate"
                            title={row.department || 'Select Department'}
                          >
                            <option value="">Dept...</option>
                            {departmentsList.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </td>

                      {/* 13. Staff Name (Native Table Cell - Fully responsive height) */}
                      <td className="p-0 align-middle text-center border-r border-[#CFD8DC] w-[88px] min-w-[80px]">
                        <div className="relative w-full h-full min-h-[42px] flex items-center justify-center">
                          {row.staffEmployee ? (
                            <div className="relative w-full h-full min-h-[42px] pl-1 pr-4 py-1 flex items-center justify-between gap-0.5 group">
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
                                  handleCellChange(idx, 'staffEmployee', '');
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
                              className="staff-trigger-btn w-full h-full min-h-[42px] flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors cursor-pointer pl-1 pr-4 group"
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

                      {/* 14. CFT (Native Table Cell - Fully responsive height) */}
                      <td className="p-0 align-middle text-center border-r border-[#CFD8DC] w-[70px] min-w-[65px]">
                        <div className="relative w-full h-full min-h-[42px] flex items-center justify-center">
                          {row.cftTopic ? (
                            <div className="w-full h-full min-h-[42px] px-1 py-0.5 flex items-center justify-between gap-0.5 group/cft-cell">
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
                              className="cft-trigger-btn w-full h-full min-h-[42px] flex items-center justify-center text-slate-300 hover:text-blue-600 hover:bg-blue-50/40 transition-colors cursor-pointer group"
                              title="Click to select CFT Topic"
                            >
                              <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity stroke-[2]" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 15. Instructions */}
                      <td className="p-0.5 align-middle border-r border-[#CFD8DC] w-[100px] min-w-[90px] focus-within:bg-blue-50/30 text-center">
                        <AutoResizeTextarea
                          inputRef={(el) => registerRef(idx, 'responsiblePersonConfirmation', el)}
                          value={row.responsiblePersonConfirmation}
                          onChange={(e) => handleCellChange(idx, 'responsiblePersonConfirmation', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 'responsiblePersonConfirmation')}
                          placeholder="Instructions, remarks..."
                          className="w-full bg-transparent border-0 outline-none p-1 text-xs text-slate-800 text-center leading-normal focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center whitespace-pre-wrap break-words"
                        />
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
                  className="flex flex-col items-center justify-center gap-0.5 px-2 border-b border-[#CFD8DC] group hover:bg-blue-50/20 transition-colors"
                >
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
            {availableCFTTopics.map((topObj) => {
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
            })}
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
              getStaffOptionsForRow(openStaffDropdown.rowIndex).map((empName, i) => {
                const isSelected = rows[openStaffDropdown.rowIndex]?.staffEmployee === empName;
                const isDeptMatch = rows[openStaffDropdown.rowIndex]?.department &&
                  (departmentEmployeesData[rows[openStaffDropdown.rowIndex].department] || []).includes(empName);

                return (
                  <button
                    key={`${empName}_${i}`}
                    type="button"
                    onClick={() => {
                      handleCellChange(openStaffDropdown.rowIndex, 'staffEmployee', empName);
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
                    {isDeptMatch && (
                      <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1 py-0.2 shrink-0">
                        Dept
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
    </div>
  );
}
