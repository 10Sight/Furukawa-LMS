import { useFormAutosave } from '@components/shared/formPersistence';
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
import ImageEditorModal from './ImageEditorModal';
import FileUploadSelectionModal from './FileUploadSelectionModal';
import AddStaffEmployeeModal from './AddStaffEmployeeModal';
import { usePDCA } from '@pages/pdca/context/PDCAContext';

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
  shift: customDefaults.shift || 'G',
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

export default function PDCASheet({ topic, onBack }) {
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

  // Initialize rows with 10 empty items
  const [rows, setRows] = useState(() => {
    return topic?.sheet?.rows || Array.from({ length: 10 }, () => createEmptyRow());
  });

  const [activePreviewImage, setActivePreviewImage] = useState(null);
  const [selectedImageAction, setSelectedImageAction] = useState(null);
  const [sheetSearch, setSheetSearch] = useState('');

  // Editable Sheet Header Details: Topic name, Prepared By, Audit No, Attendees (kept empty by default for manual entry)
  const [headerInfo, setHeaderInfo] = useState(topic?.sheet?.headerInfo || {
    topicName: '',
    preparedBy: '',
    auditNo: '',
    attendees: ''
  });

  const sheetSnapshot = useMemo(() => ({ rows, headerInfo }), [rows, headerInfo]);
  const persistSheet = (sheet) => {
    if (!topic?.id) throw new Error('This PDCA could not be found. Return to the list and open it again.');
    setData(items => {
      if (!items.some(item => item.id === topic.id)) throw new Error('This PDCA no longer exists.');
      return items.map(item => item.id === topic.id ? { ...item, sheet } : item);
    });
  };
  useFormAutosave(sheetSnapshot, persistSheet, Boolean(topic?.id), showToast);
  const saveSheet = () => {
    try {
      persistSheet(sheetSnapshot);
      showToast('PDCA saved successfully.');
      return true;
    } catch (error) {
      showToast(error.message || 'Could not save PDCA. Keep the form open and try again.');
      return false;
    }
  };
  const handleBack = () => {
    // Flush the current snapshot before navigation, including the last focused cell.
    if (saveSheet()) onBack?.();
  };

  const topicName = headerInfo.topicName || topic?.topic || 'Quality Inspection & Line Audit';
  const createdByName = topic?.createdBy?.name || (topic?.createdBy?.code ? 'Member' : 'Pooja Verma');
  const createdByCode = topic?.createdBy?.code || (topic?.createdBy?.name ? '' : 'BW082319');

  // Build the list of available CFT topics (starting with current topic + mock CFTs + default standard topics)
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
          { name: 'Suresh Yadav', code: 'GJ047219' },
          { name: 'Deepak Mehta', code: 'GJ045819' }
        ]
      },
      {
        id: 'cft-conflict-res',
        name: 'Conflict Resolution',
        members: [{ name: 'Manish Joshi', code: 'BW092301', role: 'Lead Member' }],
        assignedEmployees: [
          { name: 'Ajay Verma', code: 'BW012398' },
          { name: 'Rahul Sharma', code: 'BW041920' }
        ]
      },
      {
        id: 'cft-decision-model',
        name: 'Decision- Making Models',
        members: [{ name: 'Sandeep Verma', code: 'BW071562', role: 'Lead Member' }],
        assignedEmployees: [
          { name: 'Rajesh Kumar', code: 'BW081290' },
          { name: 'Dinesh Rao', code: 'BW028371' }
        ]
      }
    ];

    const all = [currentObj, ...otherCFTs];
    defaultTopics.forEach((dt) => {
      if (!all.some((t) => t.name.toLowerCase() === dt.name.toLowerCase())) {
        all.push(dt);
      }
    });

    return all;
  }, [data, topic, topicName, createdByName, createdByCode]);

  // Selected CFT Topic object for current row when in members mode
  const selectedRowForCFT = openCFTDropdown ? rows[openCFTDropdown.rowIndex] : null;
  const currentCFTTopicObj = useMemo(() => {
    if (!selectedRowForCFT?.cftTopic) return null;
    return (
      availableCFTTopics.find(
        (t) => t.name.toLowerCase() === selectedRowForCFT.cftTopic.toLowerCase()
      ) || {
        id: 'custom_topic',
        name: selectedRowForCFT.cftTopic,
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
      }
    );
  }, [selectedRowForCFT?.cftTopic, availableCFTTopics, createdByName, createdByCode, topic]);

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

  const handleToggleCFTDropdown = (rowIndex, e, mode = 'auto') => {
    e.stopPropagation();
    const row = rows[rowIndex];
    const targetMode = mode === 'auto' ? (row?.cftTopic ? 'members' : 'topics') : mode;

    if (openCFTDropdown?.rowIndex === rowIndex && openCFTDropdown?.mode === targetMode) {
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
    handleCellChange(rowIndex, 'staffEmployee', formattedValue);
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
  const handleFileUploadFromModal = (uploadTypeId, file) => {
    const { rowIndex, field, nameField, typeField } = uploadSelectionModal;
    if (rowIndex === null || !file) return;

    // Detect file type
    const detectedType = getFileType(file.name, file.type) || uploadTypeId;
    const finalType = ['image', 'pdf', 'excel', 'ppt'].includes(uploadTypeId) ? uploadTypeId : detectedType;
    const reader = new FileReader();

    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setRows((prev) => {
        const updated = [...prev];
        updated[rowIndex] = {
          ...updated[rowIndex],
          [field]: dataUrl,
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
        imageSrc: dataUrl,
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
      imageSrc: targetFile,
      title: `Edit Image - Row ${rowIndex + 1}`
    });
  };

  // Save changes from image editor modal back to the specific row
  const handleSaveEditedImage = (newImageSrc) => {
    if (editorModal.rowIndex === null || !editorModal.field) return;

    setRows((prev) => {
      const updated = [...prev];
      updated[editorModal.rowIndex] = {
        ...updated[editorModal.rowIndex],
        [editorModal.field]: newImageSrc
      };
      return updated;
    });

    // Reopen View modal with the newly edited image
    const isBefore = editorModal.field === 'imageBefore';
    const nameField = isBefore ? 'imageBeforeName' : 'imageAfterName';
    const typeField = isBefore ? 'fileTypeBefore' : 'fileTypeAfter';
    setSelectedImageAction({
      rowIndex: editorModal.rowIndex,
      field: editorModal.field,
      nameField,
      typeField,
      title: isBefore ? 'Image (Before)' : 'Image (After)',
      imageSrc: newImageSrc,
      imageName: rows[editorModal.rowIndex]?.[nameField] || (isBefore ? 'Before Image' : 'After Image'),
      fileType: 'image'
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
    if (fileType === 'image') {
      setActivePreviewImage(fileData);
    } else {
      // For PDF, Excel, PPT: trigger download or open
      const link = document.createElement('a');
      link.href = fileData;
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
      imageSrc: row[field],
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

  const departmentsList = Object.keys(departmentEmployeesData);

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
            <button type="button" onClick={saveSheet} title="Save all PDCA form changes" className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs cursor-pointer">
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
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
                  colSpan={13}
                  className="py-2.5 px-4 text-center font-bold text-slate-900 text-sm md:text-base tracking-wide select-none"
                >
                  PDCA - M Tanaka San Audit
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
                  colSpan={6}
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
                  colSpan={3}
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
                  colSpan={6}
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
                  colSpan={3}
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
                  colSpan={1}
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

              <tr className="bg-[#ECEFF1] text-slate-800 border-b border-[#B0BEC5] text-[11px] font-semibold select-none text-center">
                <th className="py-1.5 px-0.5 w-[56px] min-w-[52px] text-center border-r border-[#B0BEC5]">
                  Date
                </th>
                <th className="py-1.5 px-0.5 w-[36px] min-w-[34px] text-center border-r border-[#B0BEC5]">
                  Shift
                </th>
                <th className="py-1.5 px-0.5 w-[34px] min-w-[30px] text-center border-r border-[#B0BEC5]">
                  S.No
                </th>
                <th className="py-1.5 px-1 w-[78px] min-w-[78px] text-center border-r border-[#B0BEC5] text-[10.5px]">
                  Status
                </th>
                <th className="py-1.5 px-1 w-[85px] min-w-[75px] text-center border-r border-[#B0BEC5] text-[10.5px]">
                  Line/Area
                </th>
                <th className="py-1.5 px-1 w-[105px] min-w-[95px] text-center border-r border-[#B0BEC5] text-[10.5px]">
                  Observation
                </th>
                <th className="py-1.5 px-1 w-[85px] min-w-[80px] text-center border-r border-[#B0BEC5] text-[10.5px]">
                  Image Before
                </th>
                <th className="py-1.5 px-1 w-[105px] min-w-[95px] text-center border-r border-[#B0BEC5] text-[10.5px]">
                  Root Cause
                </th>
                <th className="py-1.5 px-1 w-[105px] min-w-[95px] text-center border-r border-[#B0BEC5] leading-tight text-[10.5px]">
                  Counter Measure
                </th>
                <th className="py-1.5 px-1 w-[85px] min-w-[80px] text-center border-r border-[#B0BEC5] text-[10.5px]">
                  Image After
                </th>
                <th className="py-1 px-0.5 w-[56px] min-w-[52px] text-center border-r border-[#B0BEC5] leading-tight">
                  <div className="text-[10px] leading-tight font-semibold">Response</div>
                  <div className="text-[10px] leading-tight font-semibold">Date</div>
                </th>
                <th className="py-1 px-0 border-r border-[#B0BEC5] text-center w-[240px] min-w-[240px]">
                  <div className="text-center font-bold text-[9.5px] pb-0.5 border-b border-[#CFD8DC] text-slate-700 px-1">
                    Responsible Person Confirmation
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-[#CFD8DC] text-[9.5px] text-slate-600 pt-0.5 font-semibold">
                    <span className="text-center px-0.5 flex items-center justify-center">Dept</span>
                    <span className="text-center px-0.5 flex items-center justify-center">Staff Name</span>
                    <span className="text-center px-0.5 flex items-center justify-center">CFT</span>
                  </div>
                </th>
                <th className="py-1.5 px-1 w-[100px] min-w-[90px] text-center border-r border-[#B0BEC5] leading-tight text-[9.5px]">
                  (Responsible person instructions, etc.)
                </th>
              </tr>
            </thead>

            {/* Table Rows with thin bordered cells matching reference style */}
            <tbody className="bg-white">
              {rows.map((row, idx) => {
                const sNo = idx + 1;
                const availableEmployees = row.department ? (departmentEmployeesData[row.department] || []) : [];

                return (
                  <tr
                    key={idx}
                    ref={(el) => registerTrRef(idx, el)}
                    className="border-b border-[#CFD8DC] hover:bg-[#F8FAFC] transition-colors"
                  >
                    {/* 1. Date (Stacked: Format on top, Calendar icon below) */}
                    <td className="p-0 align-middle text-center border-r border-[#CFD8DC] w-[56px] min-w-[52px]">
                      <CompactDateCell
                        value={row.date}
                        onChange={(val) => handleCellChange(idx, 'date', val)}
                      />
                    </td>

                    {/* 2. Shift (Decreased width for single letter A/B/C/G) */}
                    <td className="p-0 align-middle border-r border-[#CFD8DC] w-[36px] min-w-[34px] focus-within:bg-blue-50/30">
                      <div className="relative w-full h-full flex items-center justify-center">
                        <select
                          value={row.shift === 'General' ? 'G' : row.shift}
                          onChange={(e) => handleCellChange(idx, 'shift', e.target.value)}
                          className="w-full bg-transparent border-0 outline-none pl-1 pr-3 py-1.5 text-xs text-slate-800 font-semibold text-center focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 cursor-pointer transition-colors appearance-none"
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="G">G</option>
                        </select>
                        <ChevronDown className="w-2 h-2 text-slate-400 absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </td>

                    {/* 3. S.No (Clean uneditable number) */}
                    <td className="p-0.5 align-middle text-center border-r border-[#CFD8DC] font-semibold text-slate-600 bg-[#FAFAFA] select-none w-[34px] min-w-[30px] text-xs">
                      {sNo}
                    </td>

                    <td className="px-0.5 py-1 align-middle text-center border-r border-[#CFD8DC] w-[78px] min-w-[78px]">
                      <select
                        aria-label={`Status for row ${sNo}`}
                        value={row.status || 'Open'}
                        onChange={event => handleCellChange(idx, 'status', event.target.value)}
                        className={`w-full rounded-md border pl-0.5 pr-0 py-1.5 text-[11px] font-medium outline-none cursor-pointer focus:ring-2 focus:ring-blue-300 ${
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
                    </td>

                    {/* 4. Line/Area (Auto-expanding on Shift+Enter / multiline, center aligned, editable like observation) */}
                    <td className="p-0 align-top border-r border-[#CFD8DC] w-[85px] min-w-[75px] focus-within:bg-blue-50/30 text-center">
                      <AutoResizeTextarea
                        inputRef={(el) => registerRef(idx, 'lineArea', el)}
                        value={row.lineArea}
                        onChange={(e) => handleCellChange(idx, 'lineArea', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'lineArea')}
                        placeholder="Line/Area..."
                        className="w-full bg-transparent border-0 outline-none p-1.5 text-xs text-slate-800 text-center leading-snug focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center"
                      />
                    </td>

                    {/* 5. Observation (Auto-expanding on Shift+Enter / multiline, center aligned) */}
                    <td className="p-0 align-top border-r border-[#CFD8DC] w-[105px] min-w-[95px] focus-within:bg-blue-50/30 text-center">
                      <AutoResizeTextarea
                        inputRef={(el) => registerRef(idx, 'observation', el)}
                        value={row.observation}
                        onChange={(e) => handleCellChange(idx, 'observation', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'observation')}
                        placeholder="Observation..."
                        className="w-full bg-transparent border-0 outline-none p-1.5 text-xs text-slate-800 text-center leading-snug focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center"
                      />
                    </td>

                    {/* 5. Image (Before) - Clean image-only preview */}
                    <td className="p-1 align-middle border-r border-[#CFD8DC] w-[85px] min-w-[80px]">
                      {row.imageBefore ? (
                        <div className="flex items-center justify-center w-full">
                          <button
                            type="button"
                            onClick={() => handleOpenImageActions(idx, 'imageBefore')}
                            className="group relative inline-flex items-center justify-center p-0.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:ring-2 hover:ring-blue-100 transition-all cursor-pointer bg-slate-50 shadow-2xs overflow-hidden max-w-full"
                            title={`Click to view ${row.imageBeforeName || 'file'}, edit or delete`}
                          >
                            {row.fileTypeBefore === 'image' ? (
                              <div className="relative">
                                <img
                                  src={row.imageBefore}
                                  alt={row.imageBeforeName || `Row ${sNo} Before`}
                                  className="h-8 w-auto max-w-[70px] object-cover rounded transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded transition-opacity text-white">
                                  <Eye className="w-3.5 h-3.5 drop-shadow" />
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`h-8 px-1.5 rounded flex items-center gap-1 cursor-pointer ${
                                  row.fileTypeBefore === 'pdf'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : row.fileTypeBefore === 'excel'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : row.fileTypeBefore === 'ppt'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                {row.fileTypeBefore === 'pdf' && <FileText className="w-3.5 h-3.5 text-rose-600" />}
                                {row.fileTypeBefore === 'excel' && <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
                                {row.fileTypeBefore === 'ppt' && <Presentation className="w-3.5 h-3.5 text-amber-600" />}
                                {row.fileTypeBefore === 'document' && <File className="w-3.5 h-3.5 text-blue-600" />}
                                <span className="text-[9.5px] font-bold uppercase tracking-tight">
                                  {row.fileTypeBefore}
                                </span>
                              </div>
                            )}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenUploadModal(idx, 'imageBefore', 'imageBeforeName', 'fileTypeBefore', 'Image (Before)')}
                          className="flex items-center justify-center gap-1 border border-dashed border-[#94A3B8] hover:border-blue-600 bg-white hover:bg-blue-50/40 rounded px-1 py-1 cursor-pointer text-slate-600 hover:text-blue-700 transition-colors w-full"
                          title="Click to choose: Upload Image, PDF, PPT, or Excel"
                        >
                          <Upload className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] font-medium whitespace-nowrap">Upload</span>
                        </button>
                      )}
                    </td>

                    {/* 6. Root Cause (Auto-expanding on Shift+Enter, center aligned) */}
                    <td className="p-0 align-top border-r border-[#CFD8DC] w-[105px] min-w-[95px] focus-within:bg-blue-50/30 text-center">
                      <AutoResizeTextarea
                        inputRef={(el) => registerRef(idx, 'rootCause', el)}
                        value={row.rootCause}
                        onChange={(e) => handleCellChange(idx, 'rootCause', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'rootCause')}
                        placeholder="Root cause..."
                        className="w-full bg-transparent border-0 outline-none p-1.5 text-xs text-slate-800 text-center leading-snug focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center"
                      />
                    </td>

                    {/* 7. Counter Measure (Auto-expanding on Shift+Enter, center aligned) */}
                    <td className="p-0 align-top border-r border-[#CFD8DC] w-[105px] min-w-[95px] focus-within:bg-blue-50/30 text-center">
                      <AutoResizeTextarea
                        inputRef={(el) => registerRef(idx, 'counterMeasure', el)}
                        value={row.counterMeasure}
                        onChange={(e) => handleCellChange(idx, 'counterMeasure', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'counterMeasure')}
                        placeholder="Counter measure..."
                        className="w-full bg-transparent border-0 outline-none p-1.5 text-xs text-slate-800 text-center leading-snug focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center"
                      />
                    </td>

                    {/* 8. Image After - Clean image-only preview */}
                    <td className="p-1 align-middle border-r border-[#CFD8DC] w-[85px] min-w-[80px]">
                      {row.imageAfter ? (
                        <div className="flex items-center justify-center w-full">
                          <button
                            type="button"
                            onClick={() => handleOpenImageActions(idx, 'imageAfter')}
                            className="group relative inline-flex items-center justify-center p-0.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:ring-2 hover:ring-blue-100 transition-all cursor-pointer bg-slate-50 shadow-2xs overflow-hidden max-w-full"
                            title={`Click to view ${row.imageAfterName || 'file'}, edit or delete`}
                          >
                            {row.fileTypeAfter === 'image' ? (
                              <div className="relative">
                                <img
                                  src={row.imageAfter}
                                  alt={row.imageAfterName || `Row ${sNo} After`}
                                  className="h-8 w-auto max-w-[70px] object-cover rounded transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded transition-opacity text-white">
                                  <Eye className="w-3.5 h-3.5 drop-shadow" />
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`h-8 px-1.5 rounded flex items-center gap-1 cursor-pointer ${
                                  row.fileTypeAfter === 'pdf'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : row.fileTypeAfter === 'excel'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : row.fileTypeAfter === 'ppt'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                {row.fileTypeAfter === 'pdf' && <FileText className="w-3.5 h-3.5 text-rose-600" />}
                                {row.fileTypeAfter === 'excel' && <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
                                {row.fileTypeAfter === 'ppt' && <Presentation className="w-3.5 h-3.5 text-amber-600" />}
                                {row.fileTypeAfter === 'document' && <File className="w-3.5 h-3.5 text-blue-600" />}
                                <span className="text-[9.5px] font-bold uppercase tracking-tight">
                                  {row.fileTypeAfter}
                                </span>
                              </div>
                            )}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenUploadModal(idx, 'imageAfter', 'imageAfterName', 'fileTypeAfter', 'Image (After)')}
                          className="flex items-center justify-center gap-1 border border-dashed border-[#94A3B8] hover:border-blue-600 bg-white hover:bg-blue-50/40 rounded px-1 py-1 cursor-pointer text-slate-600 hover:text-blue-700 transition-colors w-full"
                          title="Click to choose: Upload Image, PDF, PPT, or Excel"
                        >
                          <Upload className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] font-medium whitespace-nowrap">Upload</span>
                        </button>
                      )}
                    </td>

                    {/* 9. Response Date (Stacked: Format on top, Calendar icon below) */}
                    <td className="p-0 align-middle text-center border-r border-[#CFD8DC] w-[56px] min-w-[52px]">
                      <CompactDateCell
                        value={row.responseDate}
                        onChange={(val) => handleCellChange(idx, 'responseDate', val)}
                      />
                    </td>

                    {/* 10. Responsible Person Confirmation (Department, Staff Employee & CFT Topic Dropdown) */}
                    <td className="p-0 align-top border-r border-[#CFD8DC] w-[240px] min-w-[240px]">
                      <div className="grid grid-cols-3 divide-x divide-[#CFD8DC] min-h-[42px] h-full items-stretch">
                        {/* Department Dropdown */}
                        <div className="relative w-full h-full flex items-center justify-center focus-within:bg-blue-50/30">
                          <select
                            value={row.department}
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

                        {/* 2nd Sub-column: Staff Employee Name (Empty by default, + button to add manually) */}
                        <div className="relative w-full h-full flex items-center justify-center">
                          {row.staffEmployee ? (
                            <div className="relative w-full h-full min-h-[42px] px-1 py-1 flex items-center justify-between gap-0.5 group">
                              <button
                                type="button"
                                onClick={() => handleOpenAddStaffModal(idx)}
                                className="flex-1 min-w-0 flex flex-col items-center justify-center text-center cursor-pointer hover:opacity-85 transition-opacity"
                                title={`Click to edit staff employee: ${row.staffEmployee}`}
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
                                title="Remove staff employee"
                              >
                                <X className="w-3 h-3 stroke-[2.5]" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenAddStaffModal(idx)}
                              className="w-full h-full min-h-[42px] flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors cursor-pointer group"
                              title="Click + to add employee manually"
                            >
                              <span className="w-5 h-5 rounded-full border border-dashed border-slate-300 group-hover:border-blue-500 group-hover:bg-blue-50 flex items-center justify-center transition-all">
                                <Plus className="w-3 h-3 stroke-[2.5]" />
                              </span>
                            </button>
                          )}
                        </div>

                        {/* 3rd Sub-column: CFT */}
                        <div className="relative w-full h-full flex items-center justify-center">
                          {row.cftTopic ? (
                            <div className="w-full h-full min-h-[42px] px-1 py-0.5 flex items-center justify-between gap-0.5 group/cft-cell">
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
                              className="cft-trigger-btn w-full h-full min-h-[42px] flex items-center justify-center text-slate-300 hover:text-blue-600 hover:bg-blue-50/40 transition-colors cursor-pointer group"
                              title="Click to select CFT Topic"
                            >
                              <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity stroke-[2]" />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 11. (Responsible person instructions, etc.) (Auto-expanding on Shift+Enter, center aligned) */}
                    <td className="p-0 align-top border-r border-[#CFD8DC] w-[100px] min-w-[90px] focus-within:bg-blue-50/30 text-center">
                      <AutoResizeTextarea
                        inputRef={(el) => registerRef(idx, 'responsiblePersonConfirmation', el)}
                        value={row.responsiblePersonConfirmation}
                        onChange={(e) => handleCellChange(idx, 'responsiblePersonConfirmation', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'responsiblePersonConfirmation')}
                        placeholder="Instructions, remarks..."
                        className="w-full bg-transparent border-0 outline-none p-1.5 text-xs text-slate-800 text-center leading-snug focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-600 transition-colors block placeholder:text-slate-400 placeholder:text-center"
                      />
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
                className="flex flex-col items-center justify-center gap-0.5 px-2 border-b border-[#CFD8DC] group hover:bg-blue-50/20 transition-colors"
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
              src={activePreviewImage}
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

              {/* Right: Actions (Edit, Delete, Download, Close) */}
              <div className="flex items-center gap-2 flex-shrink-0">
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
                    link.href = selectedImageAction.imageSrc;
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

            {/* Main View Area: High-Res Image View */}
            <div className="flex-1 min-h-[320px] max-h-[75vh] bg-slate-900/95 flex items-center justify-center p-3 sm:p-5 overflow-auto">
              {selectedImageAction.fileType === 'image' ? (
                <img
                  src={selectedImageAction.imageSrc}
                  alt={selectedImageAction.imageName}
                  className="max-h-[70vh] max-w-full w-auto h-auto rounded-lg object-contain shadow-2xl mx-auto"
                />
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
                {availableCFTTopics.map((topicItem) => {
                  const isSelected = rows[openCFTDropdown.rowIndex]?.cftTopic === topicItem.name;

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
                      title={`Select "${topicItem.name}"`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isSelected ? 'bg-blue-600 ring-2 ring-blue-200' : 'bg-slate-400 group-hover:bg-blue-500'
                          }`}
                        />
                        <span className="text-xs font-semibold leading-snug line-clamp-2">
                          {topicItem.name}
                        </span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                    </button>
                  );
                })}
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
                      onClick={() => setOpenCFTDropdown((prev) => ({ ...prev, mode: 'topics' }))}
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

      {/* Add Staff Employee Modal */}
      <AddStaffEmployeeModal
        isOpen={staffEmployeeModal.isOpen}
        rowIndex={staffEmployeeModal.rowIndex}
        initialValue={staffEmployeeModal.initialValue}
        onSave={handleSaveStaffEmployee}
        onClose={() => setStaffEmployeeModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
