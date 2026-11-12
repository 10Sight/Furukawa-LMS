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
  VERIFIED_EMPLOYEE_MASTER
} from '../../../pages/pdca/data/pdcaEmployees.js';
import {
  PDCA_UNITS,
  getDepartmentsForUnit
} from '../../../pages/pdca/data/pdcaConstants.js';
import { apqpApi } from '../../services/api';
import {
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  Check,
  Square,
  CheckSquare,
  Eye,
  EyeOff,
  Clock,
  X,
  Search,
  User
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

const COMMON_APQP_REQUIREMENTS = [
  'Business Plans and Marketing Strategy',
  'Product/Process Benchmark Data',
  'Product Reliability Studies',
  'Preliminary Process Flow Chart',
  'Preliminary Special Product and Process Characteristics',
  'Product Assurance Plan',
  'Design FMEA',
  'Design Verification Plan',
  'Prototype Build Control Plan',
  'Process Flow Diagram',
  'Process FMEA',
  'Pre-Launch Control Plan',
  'Production Control Plan',
  'Measurement Systems Analysis Plan',
  'Preliminary Process Capability Study',
  'Production Trial Run',
  'Production Part Approval Process (PPAP)',
  'Production Validation Testing',
  'Packaging Evaluation',
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

const DEFAULT_ACTION_COLUMN_WIDTH = 120;
const MIN_ACTION_COLUMN_WIDTH = 100;
const STATUS_COLUMN_WIDTH = 80;
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
}) {
  const tableRef = useRef(null);
  const activeResizeRef = useRef(null);
  const [colWidths, setColWidths] = useState({
    phaseName: 140,
    customerEvent: 120,
    activity: 260,
    deliverable: 180,
    actionTaken: 140,
    remarks: 140,
    actions: DEFAULT_ACTION_COLUMN_WIDTH,
  });
  const [watchModal, setWatchModal] = useState({
    isOpen: false,
    rowIndex: null,
    value: '',
  });
  const [rowHeights, setRowHeights] = useState({});
  const [openStaffDropdown, setOpenStaffDropdown] = useState(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffEmployeeModal, setStaffEmployeeModal] = useState({
    isOpen: false,
    rowIndex: null,
    unit: null,
    department: null,
    initialValue: '',
    initialEmployees: []
  });
  const [dbEmployees] = useState(VERIFIED_EMPLOYEE_MASTER);

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

  const handleSelectStaffForUnitDept = (rowIndex, unit, department, empObj) => {
    setRows((prev) => {
      const updated = [...prev];
      const currentRow = updated[rowIndex];
      if (!currentRow) return prev;

      let targetDept = department;
      let targetUnit = unit;

      if (empObj && empObj.name) {
        const cleanName = stripEmployeeId(empObj.name);
        const code = (empObj.code || '').toUpperCase();
        const autoDept = empObj.department || findEmployeeDepartment(`${cleanName} (${code})`, dbEmployees) || findEmployeeDepartment(`${cleanName} (${code})`, VERIFIED_EMPLOYEE_MASTER) || '';
        targetDept = targetDept || autoDept;
        if (!targetUnit) {
          targetUnit = empObj.unit || (code.startsWith('GJ') ? 'Gujrat' : (code.startsWith('BW') ? 'Bawal' : (currentRow.respUnit || currentRow.unit || 'Bawal')));
        }
      }

      const currentList = Array.isArray(currentRow.staffEmployees) ? [...currentRow.staffEmployees] : [];
      const filtered = currentList.filter(
        (emp) => !(targetUnit && emp.unit === targetUnit && (targetDept ? emp.department === targetDept : true))
      );

      if (empObj && empObj.name) {
        const cleanName = stripEmployeeId(empObj.name);
        const code = (empObj.code || '').toUpperCase();
        filtered.push({
          id: empObj.id || undefined,
          name: cleanName,
          code,
          department: targetDept,
          unit: targetUnit
        });
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
      return { ...row, staffEmployees, staffEmployee, staffName: primary.name || '', staffId: primary.code || '', employeeId: primary.code || '', responsiblePersonDept: staffEmployees.map(e => e.department).filter(Boolean).join(', ') };
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
            department: findEmployeeDepartment(p, dbEmployees) || ''
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
      const additions = employees
        .filter((employee) => employee.name)
        .map((employee) => ({ ...employee, ...(department ? { department } : {}), ...(unit ? { unit } : {}) }));
      const staffEmployees = [...retained, ...additions];
      const primary = staffEmployees[0] || {};
      const staffEmployee = staffEmployees.map((employee) => employee.code ? `${employee.name} (${employee.code})` : employee.name).join(', ');
      return { ...row, staffEmployees, staffEmployee, staffName: primary.name || '', staffId: primary.code || '', employeeId: primary.code || '', responsiblePersonDept: staffEmployees.map(e => e.department).filter(Boolean).join(', ') };
    }));
  };

  const handleSaveStaffEmployee = (rowIndex, formattedValue, employeeList = []) => {
    if (rowIndex == null) return;
    setRows((prev) => prev.map((row, index) => {
      if (index !== rowIndex) return row;
      const additions = employeeList
        .filter((employee) => employee.name)
        .map((employee) => ({ ...employee }));
      const primary = additions[0] || {};
      return { ...row, staffEmployees: additions, staffEmployee: formattedValue, staffName: primary.name || '', staffId: primary.code || '', employeeId: primary.code || '' };
    }));
  };

  const handleToggleStaffDropdownForDept = (rowIndex, unit, department, e) => {
    e.stopPropagation();
    if (
      openStaffDropdown?.rowIndex === rowIndex &&
      openStaffDropdown?.unit === unit &&
      openStaffDropdown?.department === department
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
      top: topPos,
      left: Math.max(12, leftPos),
      width: dropdownWidth
    });
  };

  const employeeOptionList = useMemo(() => {
    const map = new Map();
    dbEmployees.forEach((emp) => {
      const cleanName = stripEmployeeId(emp.name);
      if (!cleanName) return;
      map.set(cleanName, {
        label: cleanName,
        name: cleanName,
        code: emp.code || '',
        department: emp.department || '',
        unit: emp.unit || (emp.code?.toUpperCase().startsWith('GJ') ? 'Gujrat' : (emp.code?.toUpperCase().startsWith('BW') ? 'Bawal' : ''))
      });
    });

    rows.forEach((r) => {
      if (r.staffEmployee?.trim()) {
        const cleanName = stripEmployeeId(r.staffEmployee);
        if (cleanName && !map.has(cleanName)) {
          const dept = findEmployeeDepartment(r.staffEmployee, dbEmployees);
          map.set(cleanName, {
            label: cleanName,
            name: cleanName,
            code: '',
            department: dept || r.responsiblePersonDept || '',
            unit: r.respUnit || (Array.isArray(r.respUnits) ? r.respUnits[0] : '') || ''
          });
        }
      }
    });

    return Array.from(map.values());
  }, [dbEmployees, rows]);

  const getStaffOptionsForRow = (rowIndex, targetUnit = null, targetDept = null) => {
    const unitToUse = targetUnit || '';
    const deptToUse = targetDept || '';
    const currentUnit = unitToUse.trim().toLowerCase();
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

    if (currentUnit || currentDept) {
      const deptMatches = list.filter((item) => {
        const itemDept = (item.department || '').toLowerCase();
        const itemUnit = (item.unit || '').toLowerCase();
        const itemCode = (item.code || '').toUpperCase();

        let matchesUnit = true;
        if (currentUnit && itemUnit) {
          if (currentUnit === 'bawal') {
            matchesUnit = itemUnit === 'bawal' || itemCode.startsWith('BW');
          } else if (currentUnit === 'gujrat' || currentUnit === 'gujarat') {
            matchesUnit = itemUnit === 'gujrat' || itemUnit === 'gujarat' || itemCode.startsWith('GJ');
          }
        }

        let matchesDept = true;
        if (currentDept) {
          matchesDept = itemDept === currentDept;
        }

        return matchesUnit && matchesDept;
      });

      if (deptMatches.length > 0) {
        return deptMatches;
      }

      if (currentDept) {
        const deptOnlyMatches = list.filter((item) => (item.department || '').toLowerCase() === currentDept);
        if (deptOnlyMatches.length > 0) {
          return deptOnlyMatches;
        }
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
  }, [rows]);

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
      const row = { ...updated[rowIndex], [field]: val };
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
      updated[rowIndex] = row;
      return updated;
    });
  };

  const clearRevision = (rowIndex) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        noOfTimesRevised: '',
        reasonOfFailure: '',
      };
      return updated;
    });
    if (showToast) showToast('No. of Times Revised removed');
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
      reqNo: childReqNo,
      reqName: '',
      customerEvent: '',
      rankA: 'applicable',
      rankB: '',
      rankC: '',
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
      deliverable: 'Evidence Doc.',
      duration: '',
      startDatePlan: 'N/A',
      startDateActual: 'N/A',
      endDatePlan: 'N/A',
      endDateActual: 'N/A',
      hitMiss: '',
      revisedDate: '',
      noOfTimesRevised: '0',
      reasonOfFailure: '',
      actionTaken: '',
      respUnits: [selectedUnit && ['Bawal', 'Gujrat'].includes(selectedUnit) ? selectedUnit : 'Bawal'],
      respUnit: selectedUnit && ['Bawal', 'Gujrat'].includes(selectedUnit) ? selectedUnit : 'Bawal',
      respDeptsByUnit: {},
      staffEmployees: [],
      staffEmployee: '',
      staffName: '',
      staffId: '',
      responsiblePersonDept: '',
      status: 'Open',
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

  /* ── Duplicate Row ── */
  const duplicateRow = (rowIndex) => {
    const target = rows[rowIndex];
    const copy = {
      ...target,
      id: 'row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      addedFrom: 'duplicate',
      rowType: 'parent',
      parentRowId: undefined,
      childrenHidden: false,
      formGroupId: undefined,
      formGroupRole: undefined,
      isHidden: false,
      activity: target.activity ? `${target.activity} (Copy)` : '',
      departments: { ...(target.departments || {}) },
    };
    const newRows = [...rows];
    newRows.splice(rowIndex + 1, 0, copy);
    setRows(newRows);
    setRowHeights((currentHeights) => {
      if (!Object.prototype.hasOwnProperty.call(currentHeights, target.id)) return currentHeights;
      return { ...currentHeights, [copy.id]: currentHeights[target.id] };
    });
    if (showToast) showToast('✓ Row duplicated');
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
    const newRows = rows.filter((_, idx) => idx !== rowIndex);
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
    if (phaseFilter && phaseFilter !== 'all' && r.phaseNo !== phaseFilter) return false;
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
  const requirementOptions = [...new Set([
    ...COMMON_APQP_REQUIREMENTS,
    ...rows.map((row) => row.reqName).filter(Boolean),
  ])];
  return (
    <div className={`ptm-data-table bg-white select-none ${isMerged ? '' : 'rounded-xl border border-[#64748B] shadow-sm overflow-hidden'}`}>
      <div className={isMerged ? 'w-full' : 'overflow-x-auto max-h-[calc(100vh-140px)]'} ref={tableRef} onInput={handleTableInput}>
        <ManualInputOptionsContext.Provider value={manualOptionsByColumn}>
          <table className="w-full border-collapse text-xs">
            <colgroup>
              <col span={35} />
              <col
                style={{
                  width: `${colWidths.actions}px`,
                  minWidth: `${MIN_ACTION_COLUMN_WIDTH}px`,
                }}
              />
            </colgroup>
            {/* ══════════════════════════════════════════════════════════════════
              HEADER ROW: INDIVIDUAL COLUMN TITLES WITH MATCHING TINTS
              ══════════════════════════════════════════════════════════════════ */}
            <thead className="sticky top-0 z-20 shadow-xs border-b border-[#64748B]">
              {/* ══════════════════════════════════════════════════════════════════
                COLUMN TITLES
                ══════════════════════════════════════════════════════════════════ */}
              <tr className="divide-x divide-[#64748B] text-xs sm:text-[12.5px] font-bold text-center border-b border-slate-300">
                {/* Group 1 Columns (Ice Blue tint) */}
                <th rowSpan={2} className="py-2 px-1 w-10 min-w-[36px] max-w-[42px] bg-[#EEF4FA] text-[#2C5282] whitespace-normal leading-tight text-center">
                  S.No
                </th>
                <th rowSpan={2} className="py-2 px-1 w-16 min-w-[58px] max-w-[64px] bg-[#EEF4FA] text-[#2C5282] whitespace-normal leading-tight text-center">
                  Phase No.
                </th>
                <th
                  rowSpan={2}
                  className="relative py-2 px-2 bg-[#EEF4FA] text-[#2C5282] text-left whitespace-normal leading-tight"
                  style={{
                    width: `${colWidths.phaseName}px`,
                    minWidth: `${colWidths.phaseName}px`,
                  }}
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Phase Name</span>
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
                <th rowSpan={2} className="py-2 px-1 w-9 min-w-[34px] max-w-[38px] bg-[#FFF9E6] text-[#975A16] whitespace-normal leading-tight text-center">
                  Rank A
                </th>
                <th rowSpan={2} className="py-2 px-1 w-9 min-w-[34px] max-w-[38px] bg-[#FFF9E6] text-[#975A16] whitespace-normal leading-tight text-center">
                  Rank B
                </th>
                <th rowSpan={2} className="py-2 px-1 w-11 min-w-[42px] max-w-[48px] bg-[#FFF9E6] text-[#975A16] whitespace-normal leading-tight text-center">
                  Rank C1 & C2
                </th>

                {/* Group 3 Columns (Slate tint) */}
                <th rowSpan={2} className="py-2 px-1 w-14 min-w-[50px] max-w-[56px] bg-[#F8F9FA] text-[#4A5568] whitespace-normal leading-tight text-center">
                  Critical Activity
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

                {/* Group 4 Columns: Depts (Mint Green tint) - compact */}
                {DEPARTMENTS.map((dept) => (
                  <th
                    key={dept.key}
                    rowSpan={2}
                    className="py-2 px-0.5 w-8 min-w-[30px] max-w-[34px] bg-[#EAF5EC] text-[#276749] text-center whitespace-nowrap text-xs sm:text-[12px]"
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
                <th rowSpan={2} className="py-2 px-1.5 w-20 min-w-[76px] bg-[#F1F5F9] text-[#2D3748] whitespace-normal leading-tight text-center">
                  Std. Duration in Hours
                </th>

                {/* Group 6 Columns (Ice Blue tint) */}
                <th rowSpan={2} className="py-2 px-1 w-20 min-w-[78px] max-w-[84px] bg-[#EFF3FA] text-[#2B6CB0] whitespace-normal leading-tight text-center text-xs sm:text-[12px]">
                  Start Date (Plan)
                </th>
                <th rowSpan={2} className="py-2 px-1 w-20 min-w-[78px] max-w-[84px] bg-[#EFF3FA] text-[#2B6CB0] whitespace-normal leading-tight text-center text-xs sm:text-[12px]">
                  Start Date (Actual)
                </th>
                <th rowSpan={2} className="py-2 px-1 w-20 min-w-[78px] max-w-[84px] bg-[#EFF3FA] text-[#2B6CB0] whitespace-normal leading-tight text-center text-xs sm:text-[12px]">
                  End Date (Plan)
                </th>
                <th rowSpan={2} className="py-2 px-1 w-20 min-w-[78px] max-w-[84px] bg-[#EFF3FA] text-[#2B6CB0] whitespace-normal leading-tight text-center text-xs sm:text-[12px]">
                  End Date (Actual)
                </th>

                {/* Group 7 Columns (Mint Green tint) */}
                <th rowSpan={2} className="py-2 px-1 w-16 min-w-[64px] max-w-[70px] bg-[#EAF5EC] text-[#276749] whitespace-normal leading-tight text-center">
                  HIT/MISS
                </th>
                <th rowSpan={2} className="py-2 px-1 w-20 min-w-[78px] bg-[#EAF5EC] text-[#276749] whitespace-normal leading-tight text-center">
                  Revised Date (If MISS)
                </th>

                {/* Group 8 Columns (Pastel Rose tint) */}
                <th rowSpan={2} className="py-2 px-1 w-14 min-w-[50px] bg-[#FDF2F2] text-[#9B1C1C] whitespace-normal leading-tight text-center">
                  No. of Times Revised
                </th>
                <th rowSpan={2} className="py-2 px-2 w-48 min-w-[140px] max-w-[200px] bg-[#FDF2F2] text-[#9B1C1C] text-left whitespace-normal leading-tight">
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
                  className="py-2 px-1 bg-[#F8F9FA] text-[#4A5568] whitespace-normal leading-tight text-center"
                  style={{
                    width: `${STATUS_COLUMN_WIDTH}px`,
                    minWidth: `${STATUS_COLUMN_WIDTH}px`,
                  }}
                >
                  Status
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

                {/* Actions Column: Visually separated section at the end of the sheet */}
                <th
                  rowSpan={2}
                  className="relative overflow-visible py-2 px-2 bg-slate-200 text-slate-800 font-extrabold uppercase text-xs sm:text-[12px] tracking-wider text-center border-l-4 border-slate-300"
                  style={{
                    width: `${colWidths.actions}px`,
                    minWidth: `${MIN_ACTION_COLUMN_WIDTH}px`,
                  }}
                >
                  <div className="flex items-center justify-center">
                    <span>Actions</span>
                  </div>
                  <span
                    role="separator"
                    aria-label="Resize Actions column"
                    title="Drag horizontally to resize the Actions column"
                    onPointerDown={(event) => startColResize(event, 'actions')}
                    onPointerMove={continueResize}
                    onPointerUp={finishResize}
                    onPointerCancel={finishResize}
                    className="group absolute inset-y-0 left-0 z-20 flex w-2 cursor-col-resize touch-none items-center justify-center focus:outline-none"
                  >
                    <span className="h-4 w-0.5 rounded-full bg-slate-400 group-hover:bg-blue-500" />
                  </span>
                </th>
              </tr>

              {/* Row 2: Sub-columns for Responsible Person */}
              <tr className="divide-x divide-[#64748B] text-xs sm:text-[12.5px] font-bold text-center border-b-2 border-slate-400 bg-[#ECEFF1] text-slate-800">
                <th className="py-1 px-1 text-center w-[110px] min-w-[100px]">
                  Unit
                </th>
                <th className="py-1 px-1 text-center w-[145px] min-w-[135px]">
                  Dept
                </th>
                <th className="py-1 px-1 text-center w-[160px] min-w-[150px]">
                  <span>Staff Name</span> <span className="text-red-500 font-bold">*</span>
                </th>
              </tr>
            </thead>

            {/* ══════════════════════════════════════════════════════════════════
              TABLE BODY: EVERY CELL HAS DROPDOWN / MANUAL INPUT AS SHOWN IN IMAGE
              ══════════════════════════════════════════════════════════════════ */}
            <tbody className="divide-y divide-[#64748B] bg-white">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={27 + DEPARTMENTS.length}
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
                        className={`divide-x divide-[#64748B] hover:bg-[#F8FAFC] transition-colors group ${isChildRow(row) ? 'bg-slate-50/60' : ''}`}
                        style={Math.max(rowHeights[row.id] || 0, row.manualRowHeight || 0) > 0
                          ? { height: `${Math.max(rowHeights[row.id] || 0, row.manualRowHeight || 0)}px` }
                          : undefined}
                      >
                        {isChildRow(row) ? (
                          <td
                            colSpan={3}
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

                            {/* 1. Phase No. — DROPDOWN with chevron */}
                            <td className="p-0 text-center relative bg-slate-50/20">
                              <div className="relative flex items-center justify-center">
                                <select
                                  value={row.addedFrom === 'filters' && !row.phaseNo ? '' : row.phaseNo || '1'}
                                  onChange={(e) => handleCellChange(originalIndex, 'phaseNo', e.target.value)}
                                  className="appearance-none w-full bg-transparent text-center font-bold text-slate-800 pr-5 pl-2 py-2 text-sm outline-none cursor-pointer hover:bg-blue-50/50 transition-colors"
                                >
                                  {row.addedFrom === 'filters' && !row.phaseNo && <option value="">—</option>}
                                  {Array.from({ length: 25 }, (_, phaseIndex) => {
                                    const phaseNumber = String(phaseIndex + 1);
                                    return <option key={phaseNumber} value={phaseNumber}>{phaseNumber}</option>;
                                  })}
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 pointer-events-none" />
                              </div>
                            </td>

                            {/* 2. Phase Name — manual input (no search dropdown, resizable width) */}
                            <td
                              className="p-0 relative"
                              style={{
                                width: `${colWidths.phaseName}px`,
                                minWidth: `${colWidths.phaseName}px`,
                              }}
                            >
                              <ManualInputBox
                                value={row.phaseName || ''}
                                noDropdown={true}
                                onChange={(event) => handleCellChange(originalIndex, 'phaseName', event.target.value)}
                                onKeyDown={(event) => handleKeyDown(event, originalIndex, 'phaseName')}
                                data-row={originalIndex}
                                data-col="phaseName"
                                placeholder="Phase Name..."
                                className="w-full py-2 px-2 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm"
                              />
                            </td>
                          </>
                        )}

                        {/* 3. AIAG APQP Requirements — Searchable dropdown with suggestion history */}
                        <td className="relative h-full min-w-[190px] w-48 p-0 align-top">
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

                        {/* 4. Custom Event Name — Manual input (no search dropdown, resizable width) */}
                        <td
                          className="p-0"
                          style={{
                            width: `${colWidths.customerEvent}px`,
                            minWidth: `${colWidths.customerEvent}px`,
                          }}
                        >
                          <ManualInputBox
                            value={row.customerEvent || ''}
                            noDropdown={true}
                            onChange={(e) => handleCellChange(originalIndex, 'customerEvent', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, originalIndex, 'customerEvent')}
                            data-row={originalIndex}
                            data-col="customerEvent"
                            placeholder="Event name..."
                            className="w-full py-2 px-2 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm"
                          />
                        </td>

                        {/* 5. Rank A — Interactive checkbox */}
                        <td
                          onClick={() => cycleRank(originalIndex, 'rankA')}
                          className="py-1 px-1 text-center cursor-pointer hover:bg-amber-50/50 transition-colors select-none"
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
                          className="py-1 px-1 text-center cursor-pointer hover:bg-amber-50/50 transition-colors select-none"
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
                          className="py-1 px-1 text-center cursor-pointer hover:bg-amber-50/50 transition-colors select-none"
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

                        {/* 8. Critical Activity — Yes/No dropdown with automatic symbol */}
                        <td className="p-1 text-center">
                          <CriticalActivityCell
                            value={row.critical}
                            onChange={(value) => handleCellChange(originalIndex, 'critical', value)}
                          />
                        </td>

                        {/* 9. Activity (New) — Manual input (no search dropdown, resizable width) */}
                        <td
                          className="p-0"
                          style={{
                            width: `${colWidths.activity}px`,
                            minWidth: `${colWidths.activity}px`,
                          }}
                        >
                          <ManualInputBox
                            value={row.activity || ''}
                            noDropdown={true}
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
                              className={`py-1.5 px-1 text-center cursor-pointer select-none transition-colors ${isHighlighted
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

                        {/* 19. Deliverable Required — Yes/No selector & manual format number without search dropdown */}
                        <td
                          className="p-0"
                          style={{
                            width: `${colWidths.deliverable}px`,
                            minWidth: `${colWidths.deliverable}px`,
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-1 px-1">
                            <select
                              value={row.deliverableRequired || (row.deliverable ? 'Yes' : 'No')}
                              onChange={(e) => handleCellChange(originalIndex, 'deliverableRequired', e.target.value)}
                              aria-label="Deliverable required"
                              className="w-[58px] shrink-0 rounded border border-[#64748B] bg-white px-1 py-1 text-center text-xs sm:text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                            <ManualInputBox
                              value={row.deliverable || ''}
                              noDropdown={true}
                              onChange={(e) => handleCellChange(originalIndex, 'deliverable', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, originalIndex, 'deliverable')}
                              data-row={originalIndex}
                              data-col="deliverable"
                              placeholder="Format No."
                              disabled={(row.deliverableRequired || (row.deliverable ? 'Yes' : 'No')) === 'No'}
                              className={`min-w-0 flex-1 py-1.5 px-1.5 text-slate-800 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm truncate ${(row.deliverableRequired || (row.deliverable ? 'Yes' : 'No')) === 'No' ? 'cursor-not-allowed opacity-50' : ''}`}
                            />
                          </div>
                        </td>

                        {/* 20. Std. Duration in Hours — Watch popup modal trigger matching screenshot */}
                        <td
                          className="p-0 text-center cursor-pointer hover:bg-blue-50/50 transition-colors group/duration"
                          onClick={() => setWatchModal({ isOpen: true, rowIndex: originalIndex, value: row.duration || '' })}
                          title="Click to open Std. Duration Watch"
                        >
                          <div className="flex items-center justify-center gap-1.5 py-1.5 px-2">
                            <Clock className="w-3.5 h-3.5 text-blue-500 group-hover/duration:text-blue-600 shrink-0" />
                            <span className="font-mono text-sm font-semibold text-slate-800">
                              {row.duration || '—'}
                            </span>
                          </div>
                        </td>

                        {/* 21. Start Date (Plan) */}
                        <td className="p-0 text-center w-20 min-w-[78px] max-w-[84px]">
                          <CalendarDateInput
                            value={row.startDatePlan || ''}
                            onChange={(e) => handleCellChange(originalIndex, 'startDatePlan', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, originalIndex, 'startDatePlan')}
                            data-row={originalIndex}
                            data-col="startDatePlan"
                            placeholder="N/A"
                            className="w-full text-center py-2 px-1 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm font-mono"
                          />
                        </td>

                        {/* 22. Start Date (Actual) */}
                        <td className="p-0 text-center w-20 min-w-[78px] max-w-[84px]">
                          <CalendarDateInput
                            value={row.startDateActual || ''}
                            onChange={(e) => handleCellChange(originalIndex, 'startDateActual', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, originalIndex, 'startDateActual')}
                            data-row={originalIndex}
                            data-col="startDateActual"
                            placeholder="N/A"
                            className="w-full text-center py-2 px-1 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm font-mono"
                          />
                        </td>

                        {/* 23. End Date (Plan) */}
                        <td className="p-0 text-center w-20 min-w-[78px] max-w-[84px]">
                          <CalendarDateInput
                            value={row.endDatePlan || ''}
                            onChange={(e) => handleCellChange(originalIndex, 'endDatePlan', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, originalIndex, 'endDatePlan')}
                            data-row={originalIndex}
                            data-col="endDatePlan"
                            placeholder="N/A"
                            className="w-full text-center py-2 px-1 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm font-mono"
                          />
                        </td>

                        {/* 24. End Date (Actual) */}
                        <td className="p-0 text-center w-20 min-w-[78px] max-w-[84px]">
                          <CalendarDateInput
                            value={row.endDateActual || ''}
                            onChange={(e) => handleCellChange(originalIndex, 'endDateActual', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, originalIndex, 'endDateActual')}
                            data-row={originalIndex}
                            data-col="endDateActual"
                            placeholder="N/A"
                            className="w-full text-center py-2 px-1 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm font-mono"
                          />
                        </td>

                        {/* 25. HIT/MISS — Compact width dropdown */}
                        <td className="p-0.5 text-center relative w-16 min-w-[64px] max-w-[70px]">
                          <div className="relative flex items-center justify-center">
                            <select
                              value={row.hitMiss || ''}
                              onChange={(e) => handleCellChange(originalIndex, 'hitMiss', e.target.value)}
                              className={`appearance-none w-full py-1 pr-3.5 pl-1 rounded text-center text-xs sm:text-sm font-bold transition-all cursor-pointer outline-none ${row.hitMiss === 'HIT'
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
                            <ChevronDown className="w-2.5 h-2.5 absolute right-0.5 pointer-events-none text-slate-500" />
                          </div>
                        </td>

                        {/* 26. Revised Date (If MISS) */}
                        <td className="p-0 text-center">
                          <CalendarDateInput
                            value={row.revisedDate || ''}
                            onChange={(e) => handleCellChange(originalIndex, 'revisedDate', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, originalIndex, 'revisedDate')}
                            data-row={originalIndex}
                            data-col="revisedDate"
                            placeholder="—"
                            className="w-full text-center py-2 px-1 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm font-mono"
                          />
                        </td>

                        {/* 27. No. of Times Revised */}
                        <td className="p-0 text-center relative">
                          <div className="relative flex items-center">
                            <div className="min-w-0 flex-1">
                              <ManualInputBox
                                value={row.noOfTimesRevised || ''}
                                onChange={(e) => handleCellChange(originalIndex, 'noOfTimesRevised', e.target.value)}
                                onOptionSelect={(selectedVal) => {
                                  if (isRevisedTaken(selectedVal)) {
                                    setTimeout(() => {
                                      const reasonEl = document.querySelector(
                                        `[data-row="${originalIndex}"][data-col="reasonOfFailure"]`
                                      );
                                      reasonEl?.focus();
                                    }, 50);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (
                                    e.key === 'Enter' &&
                                    !e.shiftKey &&
                                    isRevisedTaken(row.noOfTimesRevised) &&
                                    !String(row.reasonOfFailure || '').trim()
                                  ) {
                                    e.preventDefault();
                                    const reasonEl = document.querySelector(
                                      `[data-row="${originalIndex}"][data-col="reasonOfFailure"]`
                                    );
                                    reasonEl?.focus();
                                    return;
                                  }
                                  handleKeyDown(e, originalIndex, 'noOfTimesRevised');
                                }}
                                data-row={originalIndex}
                                data-col="noOfTimesRevised"
                                placeholder="0"
                                className={`w-full text-center py-2 ${isRevisedTaken(row.noOfTimesRevised) ? 'pl-1 pr-5 font-semibold text-rose-800' : 'px-1 text-slate-700'} bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm`}
                              />
                            </div>
                            {isRevisedTaken(row.noOfTimesRevised) && (
                              <button
                                type="button"
                                onClick={() => clearRevision(originalIndex)}
                                title="Remove No. of Times Revised"
                                aria-label="Remove No. of Times Revised"
                                className="absolute right-0.5 top-1/2 -translate-y-1/2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-rose-100 text-rose-700 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                              >
                                <X className="h-3 w-3 stroke-[2.5]" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 28. Reason of Failure */}
                        <td className="p-0">
                          <ManualInputBox
                            value={row.reasonOfFailure || ''}
                            onChange={(e) => handleCellChange(originalIndex, 'reasonOfFailure', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, originalIndex, 'reasonOfFailure')}
                            readOnly={!isRevisedTaken(row.noOfTimesRevised)}
                            onDisabledClick={() => {
                              if (showToast) {
                                showToast('⚠️ Reason of Failure can only be selected when No. of Times Revised is taken');
                              }
                            }}
                            data-row={originalIndex}
                            data-col="reasonOfFailure"
                            placeholder={
                              isRevisedTaken(row.noOfTimesRevised)
                                ? 'Enter Reason of Failure *'
                                : 'Select No. of Times Revised first'
                            }
                            title={
                              isRevisedTaken(row.noOfTimesRevised)
                                ? 'Select or enter Reason of Failure'
                                : 'Select No. of Times Revised first to enable Reason of Failure'
                            }
                            className={`w-full py-2 px-2 text-sm outline-none ${!isRevisedTaken(row.noOfTimesRevised)
                              ? 'bg-slate-50/70 text-slate-400 cursor-not-allowed placeholder:text-slate-400'
                              : !String(row.reasonOfFailure || '').trim()
                                ? 'bg-rose-50/70 text-slate-800 ring-1 ring-inset ring-rose-400 placeholder:text-rose-600 placeholder:font-semibold focus:bg-amber-50 focus:ring-blue-500'
                                : 'bg-transparent text-slate-700 focus:bg-amber-50 focus:ring-1 focus:ring-blue-500'
                              }`}
                          />
                        </td>

                        {/* 29. Action Taken Against Failure — Manual input (no search dropdown, resizable width) */}
                        <td
                          className="p-0"
                          style={{
                            width: `${colWidths.actionTaken}px`,
                            minWidth: `${colWidths.actionTaken}px`,
                          }}
                        >
                          <ManualInputBox
                            value={row.actionTaken || ''}
                            noDropdown={true}
                            onChange={(e) => handleCellChange(originalIndex, 'actionTaken', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, originalIndex, 'actionTaken')}
                            data-row={originalIndex}
                            data-col="actionTaken"
                            placeholder="Action taken..."
                            className="w-full py-2 px-2 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-sm"
                          />
                        </td>

                        {/* Responsible Person: When both units chosen, parent cell divided horizontally into Bawal and Gujrat parts */}
                        {(() => {
                          const { units, deptsByUnit } = getResponsiblePersonStructure(row);
                          if (units.length > 1) {
                            return (
                              <td
                                colSpan={3}
                                className="p-0 align-middle text-center bg-white group-hover/row:bg-[#F8FAFC]"
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
                                        <div className="w-[160px] min-w-[150px] shrink-0 flex items-center justify-center">
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
                                                    <button type="button" onClick={() => handleOpenAddStaffModal(originalIndex, unitName, '')} className="flex items-center justify-center gap-1 rounded py-0.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer"><Plus className="h-3.5 w-3.5" /> Add Employee</button>
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
                                            <div className="flex flex-col h-full w-full divide-y divide-[#CBD5E1] justify-center">
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
                                                      <button type="button" onClick={() => handleOpenAddStaffModal(originalIndex, unitName, deptName)} className="flex items-center justify-center gap-1 rounded py-0.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer"><Plus className="h-3.5 w-3.5" /> Add Employee</button>
                                                    </div>
                                                  );
                                                }

                                                return (
                                                  <div
                                                    key={deptName}
                                                    className="flex-1 w-full min-h-[30px] flex items-center justify-center px-1"
                                                  >
                                                    <div className="flex w-full flex-col items-center">
                                                      <button type="button" onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, unitName, deptName, e)} className="w-full py-1 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 rounded group cursor-pointer" title={`Select staff for ${unitName} - ${deptName}`}><div className="flex items-center gap-1 text-sm"><Search className="h-3.5 w-3.5" /><span>Staff...</span><ChevronDown className="h-3 w-3" /></div></button>
                                                      <button type="button" onClick={() => handleOpenAddStaffModal(originalIndex, unitName, deptName)} className="flex items-center gap-1 py-0.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded cursor-pointer"><Plus className="h-3.5 w-3.5" /> Add Employee</button>
                                                    </div>
                                                  </div>
                                                );
                                              })}
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
                              <td className="p-0 align-middle text-center bg-white group-hover/row:bg-[#F8FAFC] w-[110px] min-w-[100px]">
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
                              <td className="p-0 align-middle text-center bg-white group-hover/row:bg-[#F8FAFC] w-[145px] min-w-[135px]">
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
                              <td className="p-0 align-middle text-center bg-white group-hover/row:bg-[#F8FAFC] w-[160px] min-w-[150px]">
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

                                  return (
                                    <div className="flex flex-col h-full w-full divide-y divide-[#CBD5E1] justify-center">
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
                                              <button type="button" onClick={() => handleOpenAddStaffModal(originalIndex, unitName, deptName)} className="flex items-center justify-center gap-1 rounded py-0.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer"><Plus className="h-3.5 w-3.5" /> Add Employee</button>
                                            </div>
                                          );
                                        }

                                        return (
                                          <div
                                            key={deptName}
                                            className="flex-1 w-full min-h-[30px] flex items-center justify-center px-1"
                                          >
                                            <div className="flex w-full flex-col items-center">
                                              <button type="button" onClick={(e) => handleToggleStaffDropdownForDept(originalIndex, unitName, deptName, e)} className="w-full py-1 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 rounded group cursor-pointer" title={`Select staff for ${unitName} - ${deptName}`}><div className="flex items-center gap-1 text-sm"><Search className="h-3.5 w-3.5" /><span>Staff...</span><ChevronDown className="h-3 w-3" /></div></button>
                                              <button type="button" onClick={() => handleOpenAddStaffModal(originalIndex, unitName, deptName)} className="flex items-center gap-1 py-0.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded cursor-pointer"><Plus className="h-3.5 w-3.5" /> Add Employee</button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </td>
                            </>
                          );
                        })()}

                        {/* 30. Status (Open/Closed) — Compact width */}
                        <td
                          className="p-0.5 text-center relative"
                          style={{
                            width: `${STATUS_COLUMN_WIDTH}px`,
                            minWidth: `${STATUS_COLUMN_WIDTH}px`,
                          }}
                        >
                          <div className="relative flex items-center justify-center">
                            <select
                              value={row.addedFrom === 'filters' && !row.status ? '' : row.status || 'Open'}
                              onChange={(e) => handleCellChange(originalIndex, 'status', e.target.value)}
                              className={`appearance-none w-full py-1 pr-3.5 pl-1 rounded text-center text-xs sm:text-sm font-semibold cursor-pointer outline-none transition-colors ${row.addedFrom === 'filters' && !row.status
                                ? 'bg-transparent text-slate-500 border border-transparent'
                                : row.status === 'Closed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : row.status === 'In Progress'
                                    ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                                    : row.status === 'Delay'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-blue-50 text-blue-800 border border-blue-300'
                                }`}
                            >
                              {row.addedFrom === 'filters' && !row.status && <option value="">—</option>}
                              <option value="Open">Open</option>
                              <option value="In Progress" className="bg-yellow-50 text-yellow-800">In Progress</option>
                              <option value="Closed">Closed</option>
                              <option value="Delay" className="bg-rose-50 text-rose-700">Delay</option>
                            </select>
                            <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-0.5 pointer-events-none" />
                          </div>
                        </td>

                        {/* 31. Remarks — Manual input (no search dropdown, resizable width) */}
                        <td
                          className="p-0"
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

                        {/* Actions: Visually separated section at the end of the sheet */}
                        <td
                          className="relative overflow-visible py-1.5 px-2 text-center bg-[#F1F5F9] border-l-4 border-slate-300 z-10"
                          style={{
                            width: `${colWidths.actions}px`,
                            minWidth: `${MIN_ACTION_COLUMN_WIDTH}px`,
                          }}
                        >
                          <div className="inline-flex items-center justify-center gap-1 p-1 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                            <button
                              onClick={() => addNewRow(originalIndex + 1, 'activity')}
                              title="Insert row below"
                              aria-label="Insert child row below"
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                            <button
                              onClick={() => duplicateRow(originalIndex)}
                              title="Duplicate this row"
                              aria-label="Duplicate row"
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 stroke-[2]" />
                            </button>
                            {isAdmin && (
                              <button
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
                                onClick={() => toggleRowHidden(originalIndex)}
                                title={`${childrenHidden ? 'Unhide' : 'Hide'} child rows for this parent`}
                                aria-label={`${childrenHidden ? 'Unhide' : 'Hide'} child rows`}
                                className="inline-flex h-6 shrink-0 items-center justify-center gap-0.5 whitespace-nowrap rounded px-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              >
                                {childrenHidden
                                  ? <Eye className="h-3.5 w-3.5" />
                                  : <EyeOff className="h-3.5 w-3.5" />}
                              </button>
                            )}
                          </div>
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
                      handleSelectStaffForUnitDept(openStaffDropdown.rowIndex, openStaffDropdown.unit, openStaffDropdown.department, empObj);
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

      {/* Table Footer: Total Rows & Add Row button */}
      <div className="bg-[#FAFBFD] border-t border-[#64748B] p-2 px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-800">
            Total Rows: {rows.length} {filteredRows.length !== rows.length && `(Filtered: ${filteredRows.length})`}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 text-[11px]">
            Tip: Press <kbd className="px-1.5 py-0.5 bg-white border border-[#64748B] rounded font-mono font-bold text-slate-800">Enter</kbd> in any cell to advance downwards (auto-creates infinite rows at bottom).
          </span>
        </div>

        <button
          onClick={() => addNewRow()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ Add New Row</span>
        </button>
      </div>
    </div>
  );
}
