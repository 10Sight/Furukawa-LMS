import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ManualInputBox, { ManualInputOptionsContext } from './ManualInputBox';
import SearchableManualTextInput from './SearchableManualTextInput';
import CalendarDateInput from './CalendarDateInput';
import { 
  Plus, 
  Trash2, 
  Copy, 
  ChevronDown, 
  Check, 
  Square, 
  CheckSquare, 
  Eye,
  EyeOff
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

const DEFAULT_ACTION_COLUMN_WIDTH = 144;
const MIN_ACTION_COLUMN_WIDTH = 130;
const STATUS_COLUMN_WIDTH = 150;
const PHASE_NAME_COLUMN_WIDTH = 180;
const DEFAULT_ROW_HEIGHT = 34;
const MIN_ROW_HEIGHT = 34;
const KEYBOARD_RESIZE_STEP = 10;

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
        className="w-[58px] rounded border border-[#64748B] bg-white px-1 py-1 text-center text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
      className="inline-flex min-h-7 min-w-[34px] items-center justify-center rounded px-1 hover:bg-slate-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
    >
      {isYes
        ? <span className="text-[22px] font-bold leading-none text-slate-900">♦</span>
        : <span className="text-[11px] font-medium text-slate-500">No</span>}
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
}) {
  const tableRef = useRef(null);
  const activeResizeRef = useRef(null);
  const [actionColumnWidth, setActionColumnWidth] = useState(DEFAULT_ACTION_COLUMN_WIDTH);
  const [rowHeights, setRowHeights] = useState({});

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
    return Object.fromEntries(columns.map((column) => [
      column,
      [...new Set(rows.map((row) => String(row[column] ?? '').trim()).filter(Boolean))],
    ]));
  }, [rows]);

  const startColumnResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    activeResizeRef.current = {
      type: 'column',
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: actionColumnWidth,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

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

    if (activeResize.type === 'column') {
      const nextWidth = clampDimension(
        activeResize.startWidth + event.clientX - activeResize.startX,
        MIN_ACTION_COLUMN_WIDTH
      );
      setActionColumnWidth(nextWidth);
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

    if (type === 'column') {
      setActionColumnWidth((currentWidth) =>
        clampDimension(
          event.key === 'Home' ? MIN_ACTION_COLUMN_WIDTH : currentWidth + direction,
          MIN_ACTION_COLUMN_WIDTH
        )
      );
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
    setRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[rowIndex], [field]: val };
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
    if (selectedUnit && r.unit && r.unit !== 'Both' && r.unit !== selectedUnit) return false;
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
            <col span={32} />
            <col
              style={{
                width: `${actionColumnWidth}px`,
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
            <tr className="divide-x divide-[#64748B] text-[10px] font-bold text-center border-b-2 border-slate-400">
              {/* Group 1 Columns (Ice Blue tint) */}
              <th className="py-2 px-1.5 w-14 bg-[#EEF4FA] text-[#2C5282] whitespace-nowrap">
                S.No
              </th>
              <th className="py-2 px-1.5 w-24 bg-[#EEF4FA] text-[#2C5282] whitespace-nowrap">
                Phase No.
              </th>
              <th
                className="py-2 px-2.5 bg-[#EEF4FA] text-[#2C5282] text-left whitespace-nowrap"
                style={{
                  width: `${PHASE_NAME_COLUMN_WIDTH}px`,
                  minWidth: `${PHASE_NAME_COLUMN_WIDTH}px`,
                }}
              >
                Phase Name
              </th>
              <th className="py-2 px-2.5 min-w-[320px] w-44 bg-[#EEF4FA] text-[#2C5282] text-left whitespace-nowrap">
                AIAG APQP Requirements
              </th>
              <th className="py-2 px-2 w-32 bg-[#EEF4FA] text-[#2C5282] text-left whitespace-nowrap">
                Custom Event Name
              </th>

              {/* Group 2 Columns (Pale Yellow tint) */}
              <th className="py-2 px-1.5 w-14 bg-[#FFF9E6] text-[#975A16] whitespace-nowrap">
                Rank A
              </th>
              <th className="py-2 px-1.5 w-14 bg-[#FFF9E6] text-[#975A16] whitespace-nowrap">
                Rank B
              </th>
              <th className="py-2 px-1.5 w-16 bg-[#FFF9E6] text-[#975A16] whitespace-nowrap">
                Rank C1 & C2
              </th>

              {/* Group 3 Columns (Slate tint) */}
              <th className="py-2 px-1.5 w-20 bg-[#F8F9FA] text-[#4A5568] whitespace-nowrap">
                Critical Activity
              </th>
              <th className="py-2 px-3 min-w-[320px] max-w-[480px] bg-[#F8F9FA] text-[#4A5568] text-left whitespace-nowrap">
                Activity (New)
              </th>

              {/* Group 4 Columns: Depts (Mint Green tint) */}
              {DEPARTMENTS.map((dept) => (
                <th
                  key={dept.key}
                  className="py-2 px-1 w-12 bg-[#EAF5EC] text-[#276749] text-center whitespace-nowrap"
                >
                  {dept.label}
                </th>
              ))}

              {/* Group 5 Columns (Lavender tint) */}
              <th className="py-2 px-2.5 min-w-[170px] bg-[#F1F5F9] text-[#2D3748] text-left whitespace-nowrap">
                Deliverable Required Yes / No (if yes than put Format no.)
              </th>
              <th className="py-2 px-1.5 w-20 bg-[#F1F5F9] text-[#2D3748] whitespace-nowrap">
                Std. Duration in days
              </th>

              {/* Group 6 Columns (Ice Blue tint) */}
              <th className="py-2 px-1.5 w-28 bg-[#EFF3FA] text-[#2B6CB0] whitespace-nowrap">
                Start Date (Plan)
              </th>
              <th className="py-2 px-1.5 w-28 bg-[#EFF3FA] text-[#2B6CB0] whitespace-nowrap">
                Start Date (Actual)
              </th>
              <th className="py-2 px-1.5 w-28 bg-[#EFF3FA] text-[#2B6CB0] whitespace-nowrap">
                End Date (Plan)
              </th>
              <th className="py-2 px-1.5 w-28 bg-[#EFF3FA] text-[#2B6CB0] whitespace-nowrap">
                End Date (Actual)
              </th>

              {/* Group 7 Columns (Mint Green tint) */}
              <th className="py-2 px-1.5 w-28 min-w-[112px] bg-[#EAF5EC] text-[#276749] whitespace-nowrap">
                HIT/MISS
              </th>
              <th className="py-2 px-1.5 w-24 bg-[#EAF5EC] text-[#276749] whitespace-nowrap">
                Revised Date (If MISS)
              </th>

              {/* Group 8 Columns (Pastel Rose tint) */}
              <th className="py-2 px-1.5 w-18 bg-[#FDF2F2] text-[#9B1C1C] whitespace-nowrap">
                No. of Times Revised
              </th>
              <th className="py-2 px-2.5 min-w-[130px] bg-[#FDF2F2] text-[#9B1C1C] text-left whitespace-nowrap">
                Reason of Failure
              </th>
              <th className="py-2 px-2.5 min-w-[140px] bg-[#FDF2F2] text-[#9B1C1C] text-left whitespace-nowrap">
                Action Taken Against Failure
              </th>

              {/* Group 9 Columns (Slate tint) */}
              <th
                className="py-2 px-1.5 bg-[#F8F9FA] text-[#4A5568] whitespace-nowrap"
                style={{
                  width: `${STATUS_COLUMN_WIDTH}px`,
                  minWidth: `${STATUS_COLUMN_WIDTH}px`,
                }}
              >
                Status
              </th>
              <th className="py-2 px-2.5 min-w-[150px] bg-[#F8F9FA] text-[#4A5568] text-left whitespace-nowrap">
                Remarks
              </th>
              <th
                className="relative overflow-visible py-2 px-1.5 w-20 bg-[#F8F9FA] text-slate-500 whitespace-nowrap sticky right-0 z-20 shadow-[-2px_0_4px_rgba(0,0,0,0.03)]"
                style={{
                  width: `${actionColumnWidth}px`,
                  minWidth: `${MIN_ACTION_COLUMN_WIDTH}px`,
                }}
              >
                Actions
                <span
                  role="separator"
                  aria-label="Resize Actions column"
                  aria-orientation="vertical"
                  aria-valuemin={MIN_ACTION_COLUMN_WIDTH}
                  aria-valuenow={actionColumnWidth}
                  tabIndex={0}
                  title="Drag horizontally to resize the Actions column"
                  onPointerDown={startColumnResize}
                  onPointerMove={continueResize}
                  onPointerUp={finishResize}
                  onPointerCancel={finishResize}
                  onLostPointerCapture={finishResize}
                  onKeyDown={(event) => handleResizeKeyDown(event, 'column')}
                  className="group absolute inset-y-0 left-0 z-20 flex w-2 cursor-col-resize touch-none items-center justify-center focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500"
                >
                  <span className="h-4 w-0.5 rounded-full bg-slate-300 transition-colors group-hover:bg-blue-500" />
                </span>
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
                  colSpan={24 + DEPARTMENTS.length}
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
                        <td className="py-2 px-1 text-center font-semibold text-slate-500 text-xs bg-slate-50/40">
                          {getRowSerial(row, originalIndex)}
                        </td>

                        {/* 1. Phase No. — DROPDOWN with chevron */}
                        <td className="p-0 text-center relative bg-slate-50/20">
                          <div className="relative flex items-center justify-center">
                            <select
                              value={row.addedFrom === 'filters' && !row.phaseNo ? '' : row.phaseNo || '1'}
                              onChange={(e) => handleCellChange(originalIndex, 'phaseNo', e.target.value)}
                              className="appearance-none w-full bg-transparent text-center font-bold text-slate-800 pr-5 pl-2 py-2 text-xs outline-none cursor-pointer hover:bg-blue-50/50 transition-colors"
                            >
                              {row.addedFrom === 'filters' && !row.phaseNo && <option value="">—</option>}
                              {Array.from({ length: 25 }, (_, phaseIndex) => {
                                const phaseNumber = String(phaseIndex + 1);
                                return <option key={phaseNumber} value={phaseNumber}>{phaseNumber}</option>;
                              })}
                            </select>
                            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
                          </div>
                        </td>

                        {/* 2. Phase Name — manual input */}
                        <td
                          className="p-0 relative"
                          style={{
                            width: `${PHASE_NAME_COLUMN_WIDTH}px`,
                            minWidth: `${PHASE_NAME_COLUMN_WIDTH}px`,
                          }}
                        >
                          <ManualInputBox
                            value={row.phaseName || ''}
                            onChange={(event) => handleCellChange(originalIndex, 'phaseName', event.target.value)}
                            onKeyDown={(event) => handleKeyDown(event, originalIndex, 'phaseName')}
                            data-row={originalIndex}
                            data-col="phaseName"
                            placeholder="Phase Name..."
                            className="w-full py-2 px-2 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs"
                          />
                        </td>
                      </>
                    )}

                    {/* 3. AIAG APQP Requirements — Requirement dropdown */}
                    <td className="relative h-full min-w-[320px] p-0 align-top">
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-12 z-[1] border-l border-[#64748B]"
                      />
                      <div className="flex h-full min-h-full min-w-0 items-stretch">
                        <div className="h-full w-12 shrink-0">
                          {isChildRow(row) ? (
                            <ManualInputBox
                              value={getRowSerial(row, originalIndex)}
                              onKeyDown={(e) => handleKeyDown(e, originalIndex, 'reqNo')}
                              data-row={originalIndex}
                              data-col="reqNo"
                              readOnly
                              aria-label={`Child row number ${getRowSerial(row, originalIndex)}`}
                              className="w-full text-center py-2 px-1 text-slate-700 font-mono bg-transparent outline-none focus:bg-slate-50 text-xs cursor-default"
                            />
                          ) : (
                            <ManualInputBox
                              value={row.reqNo || ''}
                              onChange={(e) => handleCellChange(originalIndex, 'reqNo', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, originalIndex, 'reqNo')}
                              data-row={originalIndex}
                              data-col="reqNo"
                              placeholder="No."
                              className="w-full text-center py-2 px-1 text-slate-700 font-mono bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs"
                            />
                          )}
                        </div>
                        <div className="h-full min-w-0 flex-1">
                          <select
                            value={row.reqName || ''}
                            onChange={(event) => handleCellChange(originalIndex, 'reqName', event.target.value)}
                            onKeyDown={(event) => handleKeyDown(event, originalIndex, 'reqName')}
                            data-row={originalIndex}
                            data-col="reqName"
                            aria-label="AIAG APQP Requirement"
                            title={row.reqName || 'Select an AIAG APQP requirement'}
                            className="w-full min-h-[34px] appearance-none py-2 px-2 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-inset focus:ring-blue-500 text-xs"
                          >
                            <option value="">Select requirement...</option>
                            {requirementOptions.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </td>

                    {/* 4. Custom Event Name — Manual input */}
                    <td className="p-0">
                      <ManualInputBox
                        value={row.customerEvent || ''}
                        onChange={(e) => handleCellChange(originalIndex, 'customerEvent', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, originalIndex, 'customerEvent')}
                        data-row={originalIndex}
                        data-col="customerEvent"
                        placeholder="Event name..."
                        className="w-full py-2 px-2 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs"
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
                        {!row.rankA && <span className="text-slate-300 text-xs">—</span>}
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
                        {!row.rankB && <span className="text-slate-300 text-xs">—</span>}
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
                        {!row.rankC && <span className="text-slate-300 text-xs">—</span>}
                      </div>
                    </td>

                    {/* 8. Critical Activity — Yes/No dropdown with automatic symbol */}
                    <td className="p-1 text-center">
                      <CriticalActivityCell
                        value={row.critical}
                        onChange={(value) => handleCellChange(originalIndex, 'critical', value)}
                      />
                    </td>

                    {/* 9. Activity (New) — Multiline manual input box with auto-resize */}
                    <td className="p-0">
                      <ManualInputBox
                        value={row.activity || ''}
                        onChange={(e) => handleCellChange(originalIndex, 'activity', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, originalIndex, 'activity')}
                        data-row={originalIndex}
                        data-col="activity"
                        placeholder="Type activity description..."
                        className="w-full py-2 px-2.5 text-slate-900 text-xs font-normal leading-relaxed bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500"
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
                          className={`py-1.5 px-1 text-center cursor-pointer select-none transition-colors ${
                            isHighlighted
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

                    {/* 19. Deliverable Required — Yes/No selector and manual format number */}
                    <td className="p-0">
                      <div className="flex min-w-0 items-center gap-1 px-1">
                        <select
                          value={row.deliverableRequired || (row.deliverable ? 'Yes' : 'No')}
                          onChange={(e) => handleCellChange(originalIndex, 'deliverableRequired', e.target.value)}
                          aria-label="Deliverable required"
                          className="w-[58px] shrink-0 rounded border border-[#64748B] bg-white px-1 py-1.5 text-center text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                        <SearchableManualTextInput
                          type="text"
                          value={row.deliverable || ''}
                          onChange={(e) => handleCellChange(originalIndex, 'deliverable', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, originalIndex, 'deliverable')}
                          data-row={originalIndex}
                          data-col="deliverable"
                          dataCol="deliverable"
                          placeholder="Format No."
                          disabled={(row.deliverableRequired || (row.deliverable ? 'Yes' : 'No')) === 'No'}
                          className={`min-w-0 flex-1 py-2 px-1.5 text-slate-800 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs truncate ${(row.deliverableRequired || (row.deliverable ? 'Yes' : 'No')) === 'No' ? 'cursor-not-allowed opacity-50' : ''}`}
                        />
                      </div>
                    </td>

                    {/* 20. Std. Duration in days — Manual input */}
                    <td className="p-0 text-center">
                      <ManualInputBox
                        value={row.duration || ''}
                        onChange={(e) => handleCellChange(originalIndex, 'duration', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, originalIndex, 'duration')}
                        data-row={originalIndex}
                        data-col="duration"
                        placeholder="—"
                        className="w-full text-center py-2 px-1 text-slate-800 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs"
                      />
                    </td>

                    {/* 21. Start Date (Plan) */}
                    <td className="p-0 text-center">
                      <CalendarDateInput
                        value={row.startDatePlan || ''}
                        onChange={(e) => handleCellChange(originalIndex, 'startDatePlan', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, originalIndex, 'startDatePlan')}
                        data-row={originalIndex}
                        data-col="startDatePlan"
                        placeholder="N/A"
                        className="w-full text-center py-2 px-1 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                      />
                    </td>

                    {/* 22. Start Date (Actual) */}
                    <td className="p-0 text-center">
                      <CalendarDateInput
                        value={row.startDateActual || ''}
                        onChange={(e) => handleCellChange(originalIndex, 'startDateActual', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, originalIndex, 'startDateActual')}
                        data-row={originalIndex}
                        data-col="startDateActual"
                        placeholder="N/A"
                        className="w-full text-center py-2 px-1 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                      />
                    </td>

                    {/* 23. End Date (Plan) */}
                    <td className="p-0 text-center">
                      <CalendarDateInput
                        value={row.endDatePlan || ''}
                        onChange={(e) => handleCellChange(originalIndex, 'endDatePlan', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, originalIndex, 'endDatePlan')}
                        data-row={originalIndex}
                        data-col="endDatePlan"
                        placeholder="N/A"
                        className="w-full text-center py-2 px-1 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                      />
                    </td>

                    {/* 24. End Date (Actual) */}
                    <td className="p-0 text-center">
                      <CalendarDateInput
                        value={row.endDateActual || ''}
                        onChange={(e) => handleCellChange(originalIndex, 'endDateActual', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, originalIndex, 'endDateActual')}
                        data-row={originalIndex}
                        data-col="endDateActual"
                        placeholder="N/A"
                        className="w-full text-center py-2 px-1 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                      />
                    </td>

                    {/* 25. HIT/MISS — DROPDOWN with vibrant green for HIT and red for MISS */}
                    <td className="p-1 text-center relative">
                      <div className="relative flex items-center justify-center">
                        <select
                          value={row.hitMiss || ''}
                          onChange={(e) => handleCellChange(originalIndex, 'hitMiss', e.target.value)}
                          className={`appearance-none w-full py-1 pr-4 pl-1.5 rounded text-center text-xs font-bold transition-all cursor-pointer outline-none ${
                            row.hitMiss === 'HIT'
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
                        <ChevronDown className={`w-3 h-3 absolute right-1 pointer-events-none ${
                          row.hitMiss === 'HIT' || row.hitMiss === 'MISS' ? 'text-white' : 'text-slate-400'
                        }`} />
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
                        className="w-full text-center py-2 px-1 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs"
                      />
                    </td>

                    {/* 27. No. of Times Revised */}
                    <td className="p-0 text-center">
                      <ManualInputBox
                        value={row.noOfTimesRevised || ''}
                        onChange={(e) => handleCellChange(originalIndex, 'noOfTimesRevised', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, originalIndex, 'noOfTimesRevised')}
                        data-row={originalIndex}
                        data-col="noOfTimesRevised"
                        placeholder="0"
                        className="w-full text-center py-2 px-1 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs"
                      />
                    </td>

                    {/* 28. Reason of Failure */}
                    <td className="p-0">
                      <ManualInputBox
                        value={row.reasonOfFailure || ''}
                        onChange={(e) => handleCellChange(originalIndex, 'reasonOfFailure', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, originalIndex, 'reasonOfFailure')}
                        data-row={originalIndex}
                        data-col="reasonOfFailure"
                        placeholder="Reason..."
                        className="w-full py-2 px-2 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs"
                      />
                    </td>

                    {/* 29. Action Taken Against Failure */}
                    <td className="p-0">
                      <ManualInputBox
                        value={row.actionTaken || ''}
                        onChange={(e) => handleCellChange(originalIndex, 'actionTaken', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, originalIndex, 'actionTaken')}
                        data-row={originalIndex}
                        data-col="actionTaken"
                        placeholder="Action taken..."
                        className="w-full py-2 px-2 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs"
                      />
                    </td>

                    {/* 30. Status (Open/Closed) — DROPDOWN with color badge and chevron */}
                    <td
                      className="p-1 text-center relative"
                      style={{
                        width: `${STATUS_COLUMN_WIDTH}px`,
                        minWidth: `${STATUS_COLUMN_WIDTH}px`,
                      }}
                    >
                      <div className="relative flex items-center justify-center">
                        <select
                          value={row.addedFrom === 'filters' && !row.status ? '' : row.status || 'Open'}
                          onChange={(e) => handleCellChange(originalIndex, 'status', e.target.value)}
                          className={`appearance-none w-full py-1 pr-4 pl-2 rounded text-center text-xs font-semibold cursor-pointer outline-none transition-colors ${
                            row.addedFrom === 'filters' && !row.status
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
                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1 pointer-events-none" />
                      </div>
                    </td>

                    {/* 31. Remarks */}
                    <td className="p-0">
                      <ManualInputBox
                        value={row.remarks || ''}
                        onChange={(e) => handleCellChange(originalIndex, 'remarks', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, originalIndex, 'remarks')}
                        data-row={originalIndex}
                        data-col="remarks"
                        placeholder="Remarks..."
                        className="w-full py-2 px-2 text-slate-700 bg-transparent outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-xs"
                      />
                    </td>

                    {/* Actions: Insert below (+), Duplicate, Delete */}
                    <td
                      className={`relative overflow-visible py-1 px-1 text-center sticky right-0 ${isChildRow(row) ? 'bg-slate-50' : 'bg-white'} group-hover:bg-[#F8FAFC] z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.06)]`}
                      style={{
                        width: `${actionColumnWidth}px`,
                        minWidth: `${MIN_ACTION_COLUMN_WIDTH}px`,
                      }}
                    >
                      <div className="flex w-full flex-nowrap items-center justify-center gap-1">
                        <button
                          onClick={() => addNewRow(originalIndex + 1, 'activity')}
                          title="Insert row below"
                          aria-label="Insert child row below"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => duplicateRow(originalIndex)}
                          title="Duplicate this row"
                          aria-label="Duplicate row"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteRow(originalIndex)}
                          title="Delete this row"
                          aria-label="Delete row"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {isParentRow(row) && (
                          <button
                            onClick={() => toggleRowHidden(originalIndex)}
                            title={`${childrenHidden ? 'Unhide' : 'Hide'} child rows for this parent`}
                            aria-label={`${childrenHidden ? 'Unhide' : 'Hide'} child rows`}
                            className="inline-flex h-6 shrink-0 items-center justify-center gap-0.5 whitespace-nowrap rounded px-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            {childrenHidden
                              ? <Eye className="h-3.5 w-3.5" />
                              : <EyeOff className="h-3.5 w-3.5" />}
                            {childrenHidden ? 'Unhide' : 'Hide'}
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
                        className="group absolute bottom-0 right-0 z-20 flex h-3 w-5 cursor-row-resize touch-none items-center justify-center focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500"
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
