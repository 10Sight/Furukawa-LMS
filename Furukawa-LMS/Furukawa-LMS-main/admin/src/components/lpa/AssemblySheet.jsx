import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, X, Trash2, Search, ChevronDown, Check, User } from 'lucide-react';
import { columnName } from '@pages/lpa/lpaWorkbook';
import { OBSERVATION_OPTIONS, normalizeObservationSymbol, calculateAssemblyScore } from '@pages/lpa/lpaPdcaUtils';
import { normalizeAssemblySheet, getActiveLevels, LPA_LEVEL_DEFS, getActiveAuditColumns } from './assemblySheetUtils';
import { PDCA_DEPARTMENTS, DEFAULT_LINE_AREAS } from '@pages/pdca/data/pdcaConstants';
import { fetchPdcaSections } from '@components/pdca/CascadingLineAreaSelect.jsx';
import { VERIFIED_SECTION_MASTER } from '@pages/pdca/data/pdcaSections';
import { VERIFIED_EMPLOYEE_MASTER } from '@pages/pdca/data/pdcaEmployees';
import pdcaApi from '@/services/api/pdcaApi';
import './assemblySheet.css';

function AuditorSearchDropdown({ value, onChange, employeeMaster = [], disabled, placeholder = 'Search auditor...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const filteredEmployees = useMemo(() => {
    const list = Array.isArray(employeeMaster) ? employeeMaster : [];
    const q = searchTerm.toLowerCase().trim();
    if (!q) return list;
    return list.filter((emp) => {
      const name = String(emp.name || emp.fullName || '').toLowerCase();
      const code = String(emp.code || emp.empId || emp.id || '').toLowerCase();
      const dept = String(emp.department || '').toLowerCase();
      return name.includes(q) || code.includes(q) || dept.includes(q);
    });
  }, [employeeMaster, searchTerm]);

  const handleSelect = (emp) => {
    const text = emp.code ? `${emp.name} (${emp.code})` : emp.name;
    onChange(text);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleCustomText = () => {
    if (searchTerm.trim()) {
      onChange(searchTerm.trim());
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div ref={containerRef} className="relative w-full text-left">
      <div
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchTerm('');
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full h-[34px] min-h-[34px] flex items-center justify-between gap-1.5 px-2.5 text-xs border rounded-md shadow-2xs transition-all ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-600 bg-white' : 'border-slate-300 bg-white hover:border-slate-400'
          } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <User size={13} className="text-slate-400 shrink-0" />
          <span className={`truncate text-xs font-semibold ${value ? 'text-slate-800' : 'text-slate-400'}`}>
            {value || placeholder}
          </span>
        </div>
        <ChevronDown size={13} className="text-slate-400 shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[260px] max-w-[340px] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
            <Search size={14} className="text-slate-400 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredEmployees.length > 0) {
                    handleSelect(filteredEmployees[0]);
                  } else {
                    handleCustomText();
                  }
                }
              }}
              placeholder="Search by name, ID or dept..."
              className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100/60 p-1">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp) => {
                const label = emp.code ? `${emp.name} (${emp.code})` : emp.name;
                const isSelected = value === label;
                return (
                  <button
                    key={emp.id || emp.code || emp.name}
                    type="button"
                    onClick={() => handleSelect(emp)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-left rounded-md transition-colors cursor-pointer ${isSelected ? 'bg-blue-50 text-blue-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 truncate">{emp.name}</div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                        {emp.code && <span className="font-mono bg-slate-100 px-1 py-0.2 rounded text-slate-700">{emp.code}</span>}
                        {emp.department && <span className="truncate">{emp.department}</span>}
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-blue-600 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-slate-500">
                <p>No matching employees</p>
                {searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={handleCustomText}
                    className="mt-1.5 inline-block text-blue-600 font-semibold hover:underline cursor-pointer"
                  >
                    Use "{searchTerm.trim()}"
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const SHIFT_OPTIONS = ['A', 'B', 'C', 'G'];

export default function AssemblySheet({
  sheet: rawSheet,
  editor,
  disabled,
  onChange,
  onSave,
  onMetadataChange,
  isAdmin: propIsAdmin
}) {
  const sheetRef = useRef(null);
  const sheet = useMemo(() => normalizeAssemblySheet(rawSheet), [rawSheet]);

  // Dynamic Active Audit Levels and Audit Column Groups (handles multi-shift L3 and multi-levels)
  const activeLevels = useMemo(() => getActiveLevels(sheet, editor), [sheet, editor]);
  const auditColumns = useMemo(() => getActiveAuditColumns(sheet, editor, false), [sheet, editor]);

  // Authentication & Permissions
  const authUser = useSelector(state => state.auth?.user);
  const isUserAdmin = Boolean(
    authUser?.isAdmin ||
    authUser?.role === 'ADMIN' ||
    authUser?.role === 'SUPERADMIN' ||
    authUser?.role === 'superadmin' ||
    authUser?.role === 'admin'
  );
  const isAdmin = propIsAdmin !== undefined ? propIsAdmin : isUserAdmin;

  // Header State
  const initialDate = rawSheet?.date || editor?.date || editor?.auditDate || new Date().toISOString().slice(0, 10);
  const [formDate, setFormDate] = useState(initialDate);
  const [formShift, setFormShift] = useState(rawSheet?.shift || editor?.shift || '');
  const [formDepartment, setFormDepartment] = useState(rawSheet?.department || editor?.department || '');
  const [formSection, setFormSection] = useState(rawSheet?.sectionName || rawSheet?.section || editor?.sectionName || '');
  const [formLine, setFormLine] = useState(rawSheet?.line || rawSheet?.lineArea || editor?.line || editor?.lineArea || '');

  // Auditors State (multiple auditors)
  const initialAuditors = useMemo(() => {
    if (Array.isArray(rawSheet?.auditors) && rawSheet.auditors.length > 0 && rawSheet.auditors.some(Boolean)) return rawSheet.auditors;
    if (Array.isArray(editor?.auditors) && editor.auditors.length > 0 && editor.auditors.some(Boolean)) return editor.auditors;
    if (rawSheet?.auditor && typeof rawSheet.auditor === 'string' && rawSheet.auditor.trim()) return [rawSheet.auditor.trim()];
    if (editor?.auditor && typeof editor.auditor === 'string' && editor.auditor.trim()) return [editor.auditor.trim()];
    return [''];
  }, [rawSheet?.auditors, editor?.auditors, rawSheet?.auditor, editor?.auditor]);

  const [auditorList, setAuditorList] = useState(initialAuditors);

  // Sync internal state if sheet/editor changes
  useEffect(() => {
    if (rawSheet?.date || editor?.date || editor?.auditDate) {
      setFormDate(rawSheet?.date || editor?.date || editor?.auditDate);
    }
    if (rawSheet?.shift || editor?.shift) {
      setFormShift(rawSheet?.shift || editor?.shift);
    }
    if (rawSheet?.department || editor?.department) {
      setFormDepartment(rawSheet?.department || editor?.department);
    }
    if (rawSheet?.sectionName || rawSheet?.section || editor?.sectionName) {
      setFormSection(rawSheet?.sectionName || rawSheet?.section || editor?.sectionName);
    }
    if (rawSheet?.line || editor?.line) {
      setFormLine(rawSheet?.line || editor?.line);
    }
    const incomingAuditors = (Array.isArray(rawSheet?.auditors) && rawSheet.auditors.length > 0 && rawSheet.auditors.some(Boolean))
      ? rawSheet.auditors
      : (Array.isArray(editor?.auditors) && editor.auditors.length > 0 && editor.auditors.some(Boolean))
        ? editor.auditors
        : (rawSheet?.auditor?.trim?.() ? [rawSheet.auditor.trim()] : (editor?.auditor?.trim?.() ? [editor.auditor.trim()] : ['']));
    setAuditorList(incomingAuditors);
  }, [rawSheet?.date, rawSheet?.shift, rawSheet?.department, rawSheet?.sectionName, rawSheet?.line, rawSheet?.auditors, rawSheet?.auditor, editor?.date, editor?.shift, editor?.department, editor?.sectionName, editor?.line, editor?.auditors, editor?.auditor]);

  // Master Data: Sections and Employees
  const [sectionsMaster, setSectionsMaster] = useState(VERIFIED_SECTION_MASTER);
  const [employeeMaster, setEmployeeMaster] = useState(VERIFIED_EMPLOYEE_MASTER);

  useEffect(() => {
    let active = true;
    fetchPdcaSections()
      .then(data => {
        if (active && Array.isArray(data) && data.length > 0) {
          setSectionsMaster(data);
        }
      })
      .catch(() => { });

    pdcaApi.getEmployees()
      .then(res => {
        const list = Array.isArray(res) ? res : res?.data;
        if (active && Array.isArray(list) && list.length > 0) {
          setEmployeeMaster(list);
        }
      })
      .catch(() => { });

    return () => { active = false; };
  }, []);

  // Cascading Sections based on Department
  const availableSections = useMemo(() => {
    if (!formDepartment) return sectionsMaster;
    const deptNorm = formDepartment.trim().toLowerCase();
    const isCrimping = deptNorm === 'c&c';
    const matches = sectionsMaster.filter(s => {
      const cat = (s.category || '').toLowerCase();
      return cat === deptNorm || (isCrimping && cat === 'crimping');
    });
    return matches.length > 0 ? matches : sectionsMaster;
  }, [sectionsMaster, formDepartment]);

  // Cascading Lines based on Section & Department
  const availableLines = useMemo(() => {
    const currentSec = availableSections.find(s => s.name === formSection || String(s.id) === String(formSection));
    if (currentSec && Array.isArray(currentSec.lines) && currentSec.lines.length > 0) {
      return currentSec.lines.map(l => l.name || l);
    }
    const deptNorm = (formDepartment || '').trim().toLowerCase();
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
  }, [availableSections, formSection, formDepartment]);

  // Sync metadata helper
  const notifyMetadataChange = useCallback((updates) => {
    onMetadataChange?.({
      date: formDate,
      shift: formShift,
      department: formDepartment,
      sectionName: formSection,
      line: formLine,
      auditors: auditorList,
      ...updates
    });
  }, [formDate, formShift, formDepartment, formSection, formLine, auditorList, onMetadataChange]);

  const handleDateChange = (e) => {
    const val = e.target.value;
    setFormDate(val);
    notifyMetadataChange({ date: val });
  };

  const handleShiftChange = (e) => {
    const val = e.target.value;
    setFormShift(val);
    notifyMetadataChange({ shift: val });
  };

  const handleDepartmentChange = (e) => {
    const val = e.target.value;
    setFormDepartment(val);
    setFormSection('');
    setFormLine('');
    notifyMetadataChange({ department: val, sectionName: '', line: '' });
  };

  const handleSectionChange = (e) => {
    const val = e.target.value;
    setFormSection(val);
    setFormLine('');
    notifyMetadataChange({ sectionName: val, line: '' });
  };

  const handleLineChange = (e) => {
    const val = e.target.value;
    setFormLine(val);
    notifyMetadataChange({ line: val });
  };

  const handleAuditorChange = (index, value) => {
    const next = [...auditorList];
    next[index] = value;
    setAuditorList(next);
    notifyMetadataChange({ auditors: next });
  };

  const handleAddAuditor = () => {
    const next = [...auditorList, ''];
    setAuditorList(next);
    notifyMetadataChange({ auditors: next });
  };

  const handleRemoveAuditor = (index) => {
    if (auditorList.length <= 1) return;
    const next = auditorList.filter((_, i) => i !== index);
    setAuditorList(next);
    notifyMetadataChange({ auditors: next });
  };

  // Dynamic Column Widths based on Active Audit Columns
  const baseWidths = [35, 50, 440, 40, 45];
  const widths = useMemo(() => {
    const list = [...baseWidths];
    auditColumns.forEach(() => {
      list.push(75, 50); // Observation (75px), Score (50px)
    });
    return list;
  }, [auditColumns]);
  const totalWidth = useMemo(() => widths.reduce((sum, w) => sum + w, 0), [widths]);

  // Table row heights
  const rowCount = sheet.rows.length;
  const baseRowHeights = useMemo(() => Array.from({ length: rowCount }, (_, rowIndex) => {
    if (rowIndex >= 3 && rowIndex <= 36) {
      return Math.max(26, (sheet.rowSizes?.[rowIndex]?.hpt || 54) * 0.44);
    }
    return Math.max(12, (sheet.rowSizes?.[rowIndex]?.hpt || 54) * 0.39);
  }), [rowCount, sheet.rowSizes]);
  const [rowHeights, setRowHeights] = useState(baseRowHeights);

  const pdcaStart = sheet.merges?.find(merge => merge.s.c === 0 && merge.e.c >= 6 && merge.s.r === merge.e.r && merge.s.r > 40)?.s.r ?? -1;
  const legendStart = sheet.merges?.find(merge => merge.s.c === 0 && merge.e.c === 2 && merge.s.r > 30)?.s.r ?? -1;

  // Merges mapping with dynamic levels support
  const merges = useMemo(() => {
    const anchors = new Map();
    const hidden = new Set();
    for (const merge of sheet.merges || []) {
      if (merge.s.r === 37 || merge.s.r === 38) continue;
      anchors.set(`${merge.s.r}:${merge.s.c}`, merge);
      for (let r = merge.s.r; r <= merge.e.r; r++) for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (r !== merge.s.r || c !== merge.s.c) hidden.add(`${r}:${c}`);
      }
    }

    // Row 37: Cols 0-3 merged for Total Marks label
    // Row 38: Cols 0-3 merged for Percentage (%) label; Each level's obs & score merged for Percentage
    const summaryMerges = [
      { s: { c: 0, r: 37 }, e: { c: 3, r: 37 } },
      { s: { c: 0, r: 38 }, e: { c: 3, r: 38 } }
    ];

    auditColumns.forEach((colGroup) => {
      summaryMerges.push({
        s: { c: colGroup.obsCol, r: 38 },
        e: { c: colGroup.scoreCol, r: 38 }
      });
    });

    for (const sm of summaryMerges) {
      anchors.set(`${sm.s.r}:${sm.s.c}`, sm);
      for (let r = sm.s.r; r <= sm.e.r; r++) for (let c = sm.s.c; c <= sm.e.c; c++) {
        if (r !== sm.s.r || c !== sm.s.c) hidden.add(`${r}:${c}`);
      }
    }

    return { anchors, hidden };
  }, [sheet.merges, auditColumns]);

  const marksColumn = 4;
  const areaColumn = 3;

  // Determine if a column group is view-only based on sheet's target level:
  // - If sheet was created for Level 2: Level 3 columns are view-only (non-editable)
  // - If sheet was created for Level 1: Level 3 and Level 2 columns are view-only (non-editable)
  const sheetTargetLevel = sheet?.targetLevel || editor?.targetLevel || editor?.level || (auditColumns.some(c => c.level === 'L1') ? 'L1' : auditColumns.some(c => c.level === 'L2') ? 'L2' : 'L3');

  const isLevelReadOnly = useCallback((colGroup) => {
    if (!colGroup) return false;
    if (sheetTargetLevel === 'L1') {
      return colGroup.level === 'L3' || colGroup.level === 'L2';
    }
    if (sheetTargetLevel === 'L2') {
      return colGroup.level === 'L3';
    }
    return false;
  }, [sheetTargetLevel]);

  const handleCellChange = useCallback((r, c, val, extraUpdates = []) => {
    onChange(r, c, val, extraUpdates);
  }, [onChange]);

  // Observation change recalculates Score according to Rule:
  // O -> Marks, △ -> Marks - 1 (min 0), × -> 0, NA -> NA
  const handleObservationChange = (r, obsCol, scoreCol, newVal) => {
    const colGroup = auditColumns.find(g => g.obsCol === obsCol);
    if (isLevelReadOnly(colGroup)) return;
    const marksCell = sheet.rows[r]?.[marksColumn];
    const marksVal = marksCell?.value ?? marksCell?.formatted;
    const scoreVal = calculateAssemblyScore(newVal, marksVal);
    const extraUpdates = [{ rowIndex: r, columnIndex: scoreCol, value: scoreVal }];
    handleCellChange(r, obsCol, newVal, extraUpdates);
    handleCellChange(r, scoreCol, scoreVal);
  };

  // If Admin changes Marks, recalculate Score for all audit column groups in that row immediately
  const handleMarksChange = (r, c, newMarksVal) => {
    const extraUpdates = [];
    auditColumns.forEach((colGroup) => {
      const obsCol = colGroup.obsCol;
      const scoreCol = colGroup.scoreCol;
      const obsCell = sheet.rows[r]?.[obsCol];
      const obsVal = obsCell?.value ?? obsCell?.formatted;
      if (obsVal) {
        const scoreVal = calculateAssemblyScore(obsVal, newMarksVal);
        extraUpdates.push({ rowIndex: r, columnIndex: scoreCol, value: scoreVal });
      }
    });
    handleCellChange(r, c, newMarksVal, extraUpdates);
    extraUpdates.forEach(u => {
      handleCellChange(r, u.columnIndex, u.value);
    });
  };

  const measureRow = useCallback(rowIndex => {
    const row = sheetRef.current?.querySelector(`tr[data-row-index="${rowIndex}"]`);
    if (!row) return;
    let height = baseRowHeights[rowIndex];
    for (const textarea of row.querySelectorAll('textarea')) {
      const cell = textarea.closest('td');
      if (cell?.classList.contains('assembly-vertical')) continue;
      const previousHeight = textarea.style.height;
      textarea.style.height = 'auto';
      const span = cell?.rowSpan || 1;
      const baseSpanHeight = baseRowHeights.slice(rowIndex, rowIndex + span).reduce((sum, value) => sum + value, 0);
      height = Math.max(height, baseRowHeights[rowIndex] + Math.max(0, textarea.scrollHeight - baseSpanHeight));
      textarea.style.height = previousHeight;
    }
    height = Math.ceil(height);
    setRowHeights(previous => previous[rowIndex] === height
      ? previous
      : previous.map((current, index) => index === rowIndex ? height : current));
  }, [baseRowHeights]);

  useEffect(() => {
    setRowHeights(baseRowHeights);
    const frame = requestAnimationFrame(() => baseRowHeights.forEach((_, rowIndex) => measureRow(rowIndex)));
    return () => cancelAnimationFrame(frame);
  }, [baseRowHeights, measureRow, sheet.name]);

  // Locate the FRM-WH-QA-246 row so that the table ends directly after it
  const frmRowIndex = sheet.rows.findIndex(row =>
    Array.isArray(row) && row.some(cell => String(cell?.value ?? cell?.formatted ?? '').includes('FRM-WH-QA-246'))
  );
  const checklistEnd = frmRowIndex >= 0 ? frmRowIndex + 1 : (pdcaStart >= 0 ? pdcaStart : sheet.rows.length);

  // Authoritative calculations per active audit column group (Total Score & Separate Percentage)
  const levelScores = useMemo(() => {
    const endRow = legendStart > 0 ? Math.min(legendStart, 37) : 37;
    const scores = {};

    auditColumns.forEach((colGroup) => {
      const obsCol = colGroup.obsCol;
      const scoreCol = colGroup.scoreCol;
      let applicableMarksSum = 0;
      let scoreSum = 0;

      for (let r = 3; r < endRow; r++) {
        const row = sheet.rows[r];
        if (!row) continue;
        const obs = normalizeObservationSymbol(row[obsCol]?.value ?? row[obsCol]?.formatted);
        const marksNum = Number(row[marksColumn]?.value ?? row[marksColumn]?.formatted);
        const score = row[scoreCol]?.value ?? row[scoreCol]?.formatted;

        if (obs === 'NA') continue;

        if (Number.isFinite(marksNum) && marksNum > 0) {
          applicableMarksSum += marksNum;
        }
        if (score !== '' && score !== 'NA' && score != null) {
          const numScore = Number(score);
          if (Number.isFinite(numScore)) {
            scoreSum += numScore;
          }
        }
      }

      const pctNumber = applicableMarksSum > 0
        ? Math.round((scoreSum / applicableMarksSum) * 100)
        : 0;
      const pctText = `${pctNumber}%`;

      scores[colGroup.id] = {
        totalMarks: applicableMarksSum || 70,
        totalScore: scoreSum,
        percentageText: pctText,
        obsCol,
        scoreCol
      };
    });

    return scores;
  }, [sheet.rows, auditColumns, legendStart]);

  const isAuditorInfoRow = useCallback((row) => {
    if (!Array.isArray(row)) return false;
    return row.some(cell => {
      const text = String(cell?.value ?? cell?.formatted ?? '').toUpperCase();
      return (text.includes('AUDITOR NAME') && text.includes('AUDITOR SIGN')) ||
        (text.includes('AUDITOR SIGN') && text.includes('DEPARTMENT'));
    });
  }, []);

  const totalCols = widths.length;

  const renderRows = (start, end) => sheet.rows.slice(start, end).map((row, offset) => {
    const r = start + offset;
    if (pdcaStart >= 0 && r >= pdcaStart + 24 && r <= pdcaStart + 35) return null;
    if (isAuditorInfoRow(row) && r !== 38) return null;

    if (r === 39) {
      return (
        <tr key={r} data-row-index={r} className="assembly-gap" style={{ height: 12 }}>
          {Array.from({ length: totalCols }, (_, c) => (
            <td key={c} className="border-0 bg-transparent" />
          ))}
        </tr>
      );
    }

    const height = rowHeights[r] ?? baseRowHeights[r];
    const gap = r === legendStart - 1 || (pdcaStart >= 0 && r === pdcaStart - 1) || (pdcaStart >= 0 && r === pdcaStart - 2);

    return (
      <tr
        key={r}
        data-row-index={r}
        style={{ height: (r >= 3 && r <= 36) ? undefined : height }}
        className={gap ? 'assembly-gap' : pdcaStart >= 0 && r >= pdcaStart + 31 && r <= pdcaStart + 35 ? 'assembly-tail-blank' : undefined}
      >
        {Array.from({ length: totalCols }, (_, c) => {
          const key = `${r}:${c}`;
          if (merges.hidden.has(key)) return null;
          const merge = merges.anchors.get(key);
          const cell = row[c];
          let value = cell?.formatted ?? String(cell?.value ?? '');

          const isChecklistRow = r >= 3 && r <= 36;
          const isLegend = legendStart > 0 && r >= legendStart && (pdcaStart < 0 || r < pdcaStart);
          const isLegendHeader = isLegend && (r === legendStart || r === legendStart + 1);
          const isLegendFooter = isLegend && r >= legendStart + 7;
          const isLegendSymbol = isLegend && !isLegendHeader && !isLegendFooter && (c === 3 || c === 4);
          const isLegendDesc = isLegend && !isLegendHeader && !isLegendFooter && c >= 5;

          const vertical = isChecklistRow && (c === 1 || c === 3) && merge?.e.r > r;
          const heading = isLegendHeader;
          const footer = isLegendFooter;
          const richCheck = c === 2 && r >= 3 && r <= 7;
          const isMarks = c === marksColumn && isChecklistRow;
          const isTotalRow = r === 37;
          const isPercentageRow = r === 38;
          const isFocusCell = c === 1 && isChecklistRow;
          const isAreaCell = c === areaColumn && isChecklistRow;

          // Check if this column is an Observation or Score column for any audit column group
          let activeLevelObs = null;
          let activeLevelScore = null;
          auditColumns.forEach((colGroup) => {
            if (c === colGroup.obsCol) activeLevelObs = colGroup;
            if (c === colGroup.scoreCol) activeLevelScore = colGroup;
          });

          const isObservation = Boolean(activeLevelObs) && isChecklistRow;
          const isScore = Boolean(activeLevelScore) && isChecklistRow;

          // Dynamic Total Display on row 37 and Percentage Display on row 38
          const firstColGroupId = auditColumns[0]?.id;
          const totalMarksDisplay = levelScores[firstColGroupId]?.totalMarks || 70;

          const lines = value.split('\n');
          const titleLine = lines.findIndex(line => line.trim());
          const obsReadOnly = isObservation && isLevelReadOnly(activeLevelObs);
          const scoreReadOnly = isScore && isLevelReadOnly(activeLevelScore);
          const canEditThisCell = isAdmin || (isObservation && !obsReadOnly);

          const classes = [
            heading ? 'assembly-heading' : '',
            vertical ? 'assembly-vertical' : '',
            footer ? 'assembly-footer' : '',
            (isTotalRow || isPercentageRow) && c === 0 ? 'assembly-total' : '',
            isTotalRow && c === 4 ? 'assembly-total' : '',
            isPercentageRow && Boolean(activeLevelObs) ? 'assembly-percentage-cell' : '',
            isChecklistRow && c === 2 ? 'assembly-check' : '',
            isChecklistRow && [0, 4].includes(c) && /^\d+$/.test(value.trim()) ? 'assembly-number' : '',
            richCheck ? 'assembly-rich-check' : '',
            c === 0 && r >= legendStart + 2 && r <= legendStart + 6 ? 'assembly-legend-label' : '',
            c === 0 && r === legendStart + 6 ? 'assembly-horizontal' : '',
            isScore ? 'assembly-score-cell' : '',
            obsReadOnly || scoreReadOnly ? 'assembly-readonly-level bg-slate-50' : '',
            isFocusCell ? 'assembly-focus-cell' : '',
            isAreaCell ? 'assembly-area-cell' : '',
            isLegend ? 'assembly-legend-cell' : '',
            isLegendHeader ? 'assembly-legend-header' : '',
            isLegendSymbol ? 'assembly-legend-symbol' : '',
            isLegendDesc ? 'assembly-legend-desc' : '',
            isLegendFooter ? 'assembly-form-footer' : '',
            !canEditThisCell && !isLegend ? 'assembly-readonly' : ''
          ].filter(Boolean).join(' ');

          const colSpan = merge ? merge.e.c - c + 1 : 1;
          const rowSpan = merge ? merge.e.r - r + 1 : 1;

          return (
            <td key={c} rowSpan={rowSpan} colSpan={colSpan} className={classes}>
              {isTotalRow ? (
                c === 0 ? (
                  <div className="assembly-total-label">Total Marks:</div>
                ) : c === 4 ? (
                  <div className="text-center font-black text-sm text-slate-900 py-1">{totalMarksDisplay}/</div>
                ) : Boolean(activeLevelScore) ? (
                  <div className="assembly-score-container assembly-score-total" title={`${activeLevelScore.name} Total Score`}>
                    <span className="assembly-score-value font-black text-sm text-slate-900">
                      {levelScores[activeLevelScore.id]?.totalScore ?? 0}
                    </span>
                  </div>
                ) : (
                  <div className="text-center text-slate-300">-</div>
                )
              ) : isPercentageRow ? (
                c === 0 ? (
                  <div className="assembly-total-label">Percentage (%):</div>
                ) : Boolean(activeLevelObs) ? (
                  <div className="flex items-center justify-center font-black text-sm text-blue-700 py-1.5 px-3 tracking-wide bg-blue-50/50 select-none">
                    {levelScores[activeLevelObs.id]?.percentageText ?? '0.00%'}
                  </div>
                ) : null
              ) : isLegend ? (
                <div className={`assembly-legend-content ${isLegendHeader ? 'assembly-legend-header-box' : ''} ${isLegendSymbol ? 'assembly-legend-symbol-box' : ''} ${isLegendDesc ? 'assembly-legend-desc-box' : ''} ${isLegendFooter ? 'assembly-legend-footer-box' : ''}`}>
                  {isLegendFooter ? (
                    <div className="w-full flex items-center justify-between px-3 py-1 font-bold text-slate-800 text-[11.5px]">
                      <span>FRM-WH-QA-246</span>
                      <span>Rev. No:-06</span>
                      <span>Issue Date:-31.01.22</span>
                    </div>
                  ) : (
                    <span>{value}</span>
                  )}
                </div>
              ) : isObservation ? (
                obsReadOnly ? (
                  <div
                    className="assembly-readonly-observation flex items-center justify-center font-bold text-xs text-slate-700 bg-slate-100/60 h-full w-full py-1.5 px-2 select-none"
                    title={`${activeLevelObs.name} Observation (View Only)`}
                  >
                    <span>{normalizeObservationSymbol(value) || '-'}</span>
                  </div>
                ) : (
                  <select
                    aria-label={`${sheet.name} ${activeLevelObs.name} Observation row ${r + 1}`}
                    disabled={disabled}
                    value={normalizeObservationSymbol(value)}
                    onChange={event => {
                      const scoreCol = c + 1;
                      handleObservationChange(r, c, scoreCol, event.target.value);
                    }}
                    className="assembly-observation-select"
                  >
                    <option value=""></option>
                    {OBSERVATION_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                )
              ) : isMarks && isAdmin ? (
                <textarea
                  aria-label={`${sheet.name} Marks row ${r + 1}`}
                  disabled={disabled}
                  value={value}
                  onChange={event => {
                    handleMarksChange(r, c, event.target.value);
                    requestAnimationFrame(() => measureRow(r));
                  }}
                  spellCheck={false}
                  rows={1}
                />
              ) : isScore ? (
                <div className={`assembly-score-container ${scoreReadOnly ? 'bg-slate-100/60' : ''}`}>
                  {isAdmin && !scoreReadOnly ? (
                    <input
                      type="text"
                      aria-label={`${sheet.name} ${activeLevelScore.name} Score row ${r + 1}`}
                      disabled={disabled}
                      value={value}
                      onChange={event => {
                        handleCellChange(r, c, event.target.value);
                      }}
                      className="assembly-score-input"
                    />
                  ) : (
                    <span className="assembly-score-value font-bold text-slate-700">{value}</span>
                  )}
                </div>
              ) : (isChecklistRow && (c === 1 || c === areaColumn)) ? (
                <div className={`assembly-vertical-cell-wrapper ${c === 1 ? 'assembly-focus-wrapper' : 'assembly-area-wrapper'}`}>
                  <span
                    role={isAdmin ? 'textbox' : undefined}
                    contentEditable={isAdmin && !disabled}
                    suppressContentEditableWarning={true}
                    aria-label={`${sheet.name} ${columnName(c)}${r + 1}`}
                    onBlur={event => {
                      if (!isAdmin) return;
                      handleCellChange(r, c, event.currentTarget.innerText?.trim() || '');
                      requestAnimationFrame(() => measureRow(r));
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                    className={`assembly-vertical-cell-text ${c === 1 ? 'assembly-focus-text' : 'assembly-area-text'}`}
                  >
                    {(value || '').replace(/\s+/g, ' ').trim()}
                  </span>
                </div>
              ) : isChecklistRow && c === 2 ? (
                <div className="assembly-check-cell-content">
                  {richCheck ? (
                    <div
                      role={isAdmin ? 'textbox' : undefined}
                      contentEditable={isAdmin && !disabled}
                      suppressContentEditableWarning={true}
                      aria-label={`${sheet.name} ${columnName(c)}${r + 1}`}
                      onBlur={event => {
                        if (!isAdmin) return;
                        handleCellChange(r, c, event.currentTarget.innerText || '');
                      }}
                      className="assembly-check-rich-text"
                    >
                      {lines.slice(0, titleLine).map((l, i) => <React.Fragment key={i}>{l}<br/></React.Fragment>)}
                      {titleLine >= 0 && <strong><u>{lines[titleLine]}</u></strong>}
                      {titleLine >= 0 && lines.length > titleLine + 1 && <br/>}
                      {lines.slice(titleLine + 1).map((l, i) => (
                        <React.Fragment key={i}>
                          {l}
                          {i < lines.length - titleLine - 2 ? <br/> : null}
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <div
                      role={isAdmin ? 'textbox' : undefined}
                      contentEditable={isAdmin && !disabled}
                      suppressContentEditableWarning={true}
                      aria-label={`${sheet.name} ${columnName(c)}${r + 1}`}
                      onBlur={event => {
                        if (!isAdmin) return;
                        handleCellChange(r, c, event.currentTarget.innerText || '');
                      }}
                      className="assembly-check-plain-text"
                    >
                      {value}
                    </div>
                  )}
                </div>
              ) : (
                <textarea
                  aria-label={`${sheet.name} ${columnName(c)}${r + 1}`}
                  disabled={disabled || !canEditThisCell}
                  readOnly={!canEditThisCell}
                  value={value}
                  onKeyDown={event => {
                    if ((event.key === 'Enter' && event.shiftKey) || event.key === 'Backspace') {
                      const textarea = event.currentTarget;
                      requestAnimationFrame(() => { if (textarea.isConnected) measureRow(r); });
                    }
                  }}
                  onChange={event => {
                    if (!canEditThisCell) return;
                    handleCellChange(r, c, event.target.value);
                    requestAnimationFrame(() => measureRow(r));
                  }}
                  spellCheck={false}
                  rows={1}
                />
              )}
            </td>
          );
        })}
      </tr>
    );
  });

  return (
    <div className="assembly-sheet" ref={sheetRef}>
      <div className="assembly-audit-paper">
        {/* 1. Header Banner */}
        <div className="assembly-form-header-box">
          {/* Top Compartment: Title (Left) and Auditor Name (Right) */}
          <div className="assembly-header-top-row">
            {/* Left Box: Title with Border Frame & Active Level Badges */}
            <div className="assembly-header-title-box">
              <div className="assembly-header-title-frame">
                <h2 className="assembly-header-title-text">
                  Layered Process Audit
                </h2>
                <p className="assembly-header-subtitle-text">
                  Assembly Quality & Production
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1.5">
                  {auditColumns.map(colGroup => (
                    <span key={colGroup.id} className="assembly-level-badge">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      <span>{colGroup.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Box: Auditor Name(s) with Search Dropdown + Add Auditor */}
            <div className="assembly-header-auditor-box">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider !mb-0">
                  Auditor Name
                </label>
                <button
                  type="button"
                  onClick={handleAddAuditor}
                  disabled={disabled}
                  className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer disabled:opacity-50"
                  title="Add another auditor"
                >
                  <Plus size={11} />
                  <span>Add Auditor</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {auditorList.map((auditor, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <AuditorSearchDropdown
                      value={auditor}
                      onChange={(val) => handleAuditorChange(idx, val)}
                      employeeMaster={employeeMaster}
                      disabled={disabled}
                      placeholder="Search auditor name or ID..."
                    />
                    {auditorList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAuditor(idx)}
                        disabled={disabled}
                        className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer disabled:opacity-50 shrink-0"
                        title="Remove auditor"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Horizontal Bar: Date | Shift | Department | Section | Line */}
          <div className="assembly-header-bottom-row">
            {/* 1. Date */}
            <div className="assembly-header-field-col">
              <label htmlFor="lpa-assembly-date">
                Date <span className="text-red-600 font-bold">*</span>
              </label>
              <input
                id="lpa-assembly-date"
                type="date"
                value={formDate}
                onChange={handleDateChange}
                disabled={disabled}
                className="assembly-header-input assembly-header-input-date"
                required
              />
            </div>

            {/* 2. Shift */}
            <div className="assembly-header-field-col">
              <label htmlFor="lpa-assembly-shift">
                Shift <span className="text-red-600 font-bold">*</span>
              </label>
              <select
                id="lpa-assembly-shift"
                value={formShift}
                onChange={handleShiftChange}
                disabled={disabled}
                className="assembly-header-select assembly-header-select-shift"
                required
              >
                <option value="">Shift</option>
                {SHIFT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* 3. Department */}
            <div className="assembly-header-field-col">
              <label htmlFor="lpa-assembly-department">
                Department <span className="text-red-600 font-bold">*</span>
              </label>
              <select
                id="lpa-assembly-department"
                value={formDepartment}
                onChange={handleDepartmentChange}
                disabled={disabled}
                className="assembly-header-select assembly-header-select-dept truncate"
                title={formDepartment || 'Select Department'}
                required
              >
                <option value="">Department</option>
                {PDCA_DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* 4. Section */}
            <div className="assembly-header-field-col">
              <label htmlFor="lpa-assembly-section">
                Section
              </label>
              <select
                id="lpa-assembly-section"
                value={formSection}
                onChange={handleSectionChange}
                disabled={disabled}
                className="assembly-header-select assembly-header-select-section truncate"
                title={formSection || 'Select Section'}
              >
                <option value="">Section</option>
                {availableSections.map(sec => (
                  <option key={sec.id || sec.name} value={sec.name}>
                    {sec.name} {sec.uniCode ? `(${sec.uniCode})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Line */}
            <div className="assembly-header-field-col">
              <label htmlFor="lpa-assembly-line">
                Line
              </label>
              <select
                id="lpa-assembly-line"
                value={formLine}
                onChange={handleLineChange}
                disabled={disabled}
                className="assembly-header-select assembly-header-select-line truncate"
                title={formLine || 'Select Line'}
              >
                <option value="">Line</option>
                {availableLines.map(line => (
                  <option key={line} value={line}>{line}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2. Checklist Table with Sticky Header while Scrolling */}
        <table className="assembly-form-table assembly-audit-table" aria-label={`${sheet.name} audit check sheet`}>
          <colgroup>
            {widths.map((width, c) => (
              <col key={c} style={{ width: `${(width / totalWidth) * 100}%` }} />
            ))}
          </colgroup>
          <thead>
            {/* Header Row 1: Fixed / Sticky */}
            <tr className="assembly-header-row-1" style={{ height: 26 }}>
              <th rowSpan={2} className="assembly-header-th assembly-sticky-th">Sl No</th>
              <th rowSpan={2} className="assembly-header-th assembly-sticky-th">Focus</th>
              <th rowSpan={2} className="assembly-header-th assembly-sticky-th">CHECKS POINTS</th>
              <th rowSpan={2} className="assembly-header-th assembly-sticky-th">Area</th>
              <th rowSpan={2} className="assembly-header-th assembly-sticky-th">Marks</th>
              {auditColumns.map((colGroup) => {
                const readOnly = isLevelReadOnly(colGroup);
                return (
                  <th
                    key={colGroup.id}
                    colSpan={2}
                    className={`assembly-header-th assembly-level-group-th ${readOnly ? 'bg-slate-100/90 text-slate-600' : ''}`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{colGroup.name}</span>
                      {readOnly && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                          View Only
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
            {/* Header Row 2: Fixed / Sticky Subheaders */}
            <tr className="assembly-header-row-2" style={{ height: 24 }}>
              {auditColumns.map((colGroup) => (
                <React.Fragment key={colGroup.id}>
                  <th className="assembly-header-sub-th">Observation</th>
                  <th className="assembly-header-sub-th">Score</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderRows(3, checklistEnd)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
