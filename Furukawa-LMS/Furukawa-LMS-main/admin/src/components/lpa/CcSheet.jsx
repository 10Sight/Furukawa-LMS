import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, X, User } from 'lucide-react';
import { columnName } from '@pages/lpa/lpaWorkbook';
import { OBSERVATION_OPTIONS, normalizeObservationSymbol, getScoreForObservation } from '@pages/lpa/lpaPdcaUtils';
import { getActiveAuditColumns, LPA_LEVEL_DEFS } from './assemblySheetUtils';
import { AuditorSearchDropdown, SHIFT_OPTIONS } from './AssemblySheet';
import { PDCA_DEPARTMENTS, DEFAULT_LINE_AREAS } from '@pages/pdca/data/pdcaConstants';
import { fetchPdcaSections } from '@components/pdca/CascadingLineAreaSelect.jsx';
import { VERIFIED_SECTION_MASTER } from '@pages/pdca/data/pdcaSections';
import { VERIFIED_EMPLOYEE_MASTER } from '@pages/pdca/data/pdcaEmployees';
import pdcaApi from '@/services/api/pdcaApi';
import './assemblySheet.css';
import './ccSheet.css';

export default function CcSheet({
  sheet: rawSheet,
  editor,
  disabled,
  onChange,
  onMetadataChange,
  isAdmin: propIsAdmin
}) {
  const tableRef = useRef(null);
  const sheet = rawSheet;
  const rowCount = sheet.rows.length;

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
  const [formDepartment, setFormDepartment] = useState(rawSheet?.department || editor?.department || 'C&C');
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
      .catch(() => {});

    pdcaApi.getEmployees?.()
      .then(res => {
        const emps = res?.data || res?.employees || res || [];
        if (active && Array.isArray(emps) && emps.length > 0) {
          setEmployeeMaster(emps);
        }
      })
      .catch(() => {});

    return () => { active = false; };
  }, []);

  // Cascading Sections based on Department
  const availableSections = useMemo(() => {
    if (!formDepartment) return sectionsMaster;
    const deptNorm = formDepartment.trim().toLowerCase();
    const filtered = sectionsMaster.filter(s => {
      const sDept = (s.department || '').trim().toLowerCase();
      return !sDept || sDept === deptNorm;
    });
    return filtered.length > 0 ? filtered : sectionsMaster;
  }, [sectionsMaster, formDepartment]);

  // Cascading Lines based on Section & Department
  const availableLines = useMemo(() => {
    const currentSec = availableSections.find(s => s.name === formSection || String(s.id) === String(formSection));
    if (currentSec && Array.isArray(currentSec.lines) && currentSec.lines.length > 0) {
      return currentSec.lines.map(l => l.name || l);
    }
    const deptNorm = (formDepartment || '').trim().toLowerCase();
    if (deptNorm === 'c&c' || deptNorm === 'cc') {
      return ['C&C Area', 'Line 1', 'Line 2', 'Line 3'];
    }
    if (deptNorm === 'assembly') {
      return ['Assembly Line 1', 'Assembly Line 2', 'Assembly Line 3', 'Assembly Area', 'Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'];
    }
    if (deptNorm === 'quality') {
      return ['Quality Lab', 'Final Inspection Area', 'Pre-Inspection Rework'];
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

  const marksColumn = useMemo(() => {
    for (const row of sheet.rows.slice(0, 8)) {
      const index = row.findIndex(cell => /^marks$/i.test(cell?.formatted ?? String(cell?.value ?? '')));
      if (index >= 0) return index;
    }
    return 6;
  }, [sheet.rows]);

  const auditColumns = useMemo(() => {
    return getActiveAuditColumns(sheet, null, true);
  }, [sheet]);

  // Created sheet's level badge (displays ONLY the level chosen by the user when creating the sheet)
  const sheetTargetLevel = rawSheet?.targetLevel || rawSheet?.level || editor?.targetLevel || editor?.level || (auditColumns.some(c => c.level === 'L1') ? 'L1' : auditColumns.some(c => c.level === 'L2') ? 'L2' : 'L3');
  const createdLevelBadges = useMemo(() => {
    const activeCols = auditColumns.filter(col => !col.isFetched && (col.level === sheetTargetLevel || col.id === sheetTargetLevel));
    if (activeCols.length > 0) {
      return activeCols.map(col => ({ id: col.id, name: col.name }));
    }
    if (sheetTargetLevel === 'L2') return [{ id: 'L2', name: 'Level 2' }];
    if (sheetTargetLevel === 'L1') return [{ id: 'L1', name: 'Level 1' }];
    const shift = formShift || rawSheet?.shift || editor?.shift || 'A';
    return [{ id: 'L3', name: `Level 3 (Shift ${shift})` }];
  }, [auditColumns, sheetTargetLevel, formShift, rawSheet?.shift, editor?.shift]);

  // Dynamic Column Widths for C&C Form matching Assembly Form proportions:
  // Base columns (0-6): Sl No (35px), Focus (50px), Checks Points (220px + 140px + 80px = 440px), Section (40px), Marks (45px)
  // Audit columns (7+): Observation (75px), Score (50px) per column group
  const baseWidths = [35, 50, 220, 140, 80, 40, 45];
  const widths = useMemo(() => {
    const list = [...baseWidths];
    auditColumns.forEach(() => {
      list.push(80, 55); // Observation: 80px, Score: 55px (135px total per audit level group)
    });
    while (list.length < (sheet.columnCount || 0)) {
      list.push(list.length % 2 === 1 ? 80 : 55);
    }
    return list;
  }, [auditColumns, sheet.columnCount]);
  const tableWidth = useMemo(() => widths.reduce((sum, width) => sum + width, 0), [widths]);

  const baseRowHeights = useMemo(() => Array.from({ length: rowCount }, (_, rowIndex) => {
    if (rowIndex === 0) return 30; // Title row
    if (rowIndex === 1) return 24; // Date / Line row
    if (rowIndex === 2) return 48; // Header Row 2 (Level titles + View Only badge)
    if (rowIndex === 3) return 26; // Header Row 3 (Observation & Score titles)
    if (rowIndex >= 4 && rowIndex <= 34) {
      return Math.max(28, (sheet.rowSizes?.[rowIndex]?.hpt || 30) * 0.44);
    }
    if (rowIndex === 35 || rowIndex === 36) return 28; // Total and Percentage rows
    if (rowIndex === 37 || rowIndex === 38) return 22; // Legend header
    if (rowIndex >= 39 && rowIndex <= 43) return 26; // Legend criteria rows
    if (rowIndex === 44) return 30; // Footer row
    return Math.max(14, (sheet.rowSizes?.[rowIndex]?.hpt || 30) * 0.39);
  }), [rowCount, sheet.rowSizes]);
  const [rowHeights, setRowHeights] = useState(baseRowHeights);

  const sourceShiftStatus = useMemo(() => {
    const raw = sheet?.sourceShiftStatus || editor?.sourceShiftStatus;
    if (raw && (raw.A !== undefined || raw.B !== undefined)) return raw;

    const colA = auditColumns.find(g => g.id === 'L3_A' || (g.level === 'L3' && g.shift === 'A'));
    const colB = auditColumns.find(g => g.id === 'L3_B' || (g.level === 'L3' && g.shift === 'B'));
    const colL2 = auditColumns.find(g => g.id === 'L2' || g.level === 'L2');

    const hasA = colA ? sheet.rows.some((r, idx) => idx >= 4 && idx <= 34 && Boolean(r[colA.obsCol]?.value || r[colA.obsCol]?.formatted)) : false;
    const hasB = colB ? sheet.rows.some((r, idx) => idx >= 4 && idx <= 34 && Boolean(r[colB.obsCol]?.value || r[colB.obsCol]?.formatted)) : false;
    const hasL2 = colL2 ? sheet.rows.some((r, idx) => idx >= 4 && idx <= 34 && Boolean(r[colL2.obsCol]?.value || r[colL2.obsCol]?.formatted)) : false;

    return { A: hasA, B: hasB, L2: hasL2 };
  }, [sheet, editor, auditColumns]);

  const hasColumnData = useCallback((colGroup) => {
    if (!colGroup) return false;
    if (colGroup.shift === 'A') return Boolean(sourceShiftStatus.A);
    if (colGroup.shift === 'B') return Boolean(sourceShiftStatus.B);
    if (colGroup.level === 'L2' && sheetTargetLevel === 'L1') return Boolean(sourceShiftStatus.L2);
    return true;
  }, [sourceShiftStatus, sheetTargetLevel]);

  const isLevelReadOnly = useCallback((colGroup) => {
    if (!colGroup) return false;
    if (colGroup.isFetched) return true;
    if (sheetTargetLevel === 'L1') {
      return colGroup.level === 'L3' || colGroup.level === 'L2';
    }
    if (sheetTargetLevel === 'L2') {
      return colGroup.level === 'L3';
    }
    return false;
  }, [sheetTargetLevel]);

  // Dynamic live summary & percentage for each column group in C&C form
  const columnScores = useMemo(() => {
    const scores = {};
    auditColumns.forEach((colGroup) => {
      let applicableMarks = 0;
      let scoreSum = 0;
      for (let r = 4; r <= 34; r++) {
        const row = sheet.rows[r];
        if (!row) continue;
        const obs = normalizeObservationSymbol(row[colGroup.obsCol]?.value ?? row[colGroup.obsCol]?.formatted);
        if (obs === 'NA') continue;

        const marksNum = Number(row[marksColumn]?.value ?? row[marksColumn]?.formatted ?? 0);
        if (Number.isFinite(marksNum) && marksNum > 0) {
          applicableMarks += marksNum;
        }

        const scoreVal = row[colGroup.scoreCol]?.value ?? row[colGroup.scoreCol]?.formatted;
        if (scoreVal !== '' && scoreVal !== 'NA' && scoreVal != null) {
          const numScore = Number(scoreVal);
          if (Number.isFinite(numScore)) {
            scoreSum += numScore;
          }
        }
      }

      const pctNum = applicableMarks > 0 ? Math.round((scoreSum / applicableMarks) * 100) : 0;
      scores[colGroup.id] = {
        totalMarks: applicableMarks || 62,
        totalScore: scoreSum,
        percentageText: `${pctNum}%`,
        obsCol: colGroup.obsCol,
        scoreCol: colGroup.scoreCol
      };
    });
    return scores;
  }, [sheet.rows, marksColumn, auditColumns]);

  const handleObservationChange = (r, obsCol, scoreCol, newVal) => {
    const colGroup = auditColumns.find(g => g.obsCol === obsCol);
    if (isLevelReadOnly(colGroup) && !isAdmin) return;
    const row = sheet.rows[r];
    const marksVal = marksColumn >= 0 ? (row?.[marksColumn]?.value ?? row?.[marksColumn]?.formatted) : 3;
    const scoreVal = getScoreForObservation(newVal, marksVal);
    const extraUpdates = [{ rowIndex: r, columnIndex: scoreCol, value: scoreVal }];
    onChange(r, obsCol, newVal, extraUpdates);
    onChange(r, scoreCol, scoreVal);
  };

  const merges = useMemo(() => {
    const anchors = new Map();
    const hidden = new Set();
    const lastCol = Math.max(6, (sheet.columnCount || 7) - 1);

    // Keep all non-legend merges (rows < 37)
    const effectiveMerges = (sheet.merges || []).filter(m => m.s.r < 37);

    // Canonical full-width legend merges
    effectiveMerges.push(
      { s: { c: 0, r: 37 }, e: { c: 2, r: 38 } },
      { s: { c: 3, r: 37 }, e: { c: 3, r: 38 } },
      { s: { c: 4, r: 37 }, e: { c: lastCol, r: 38 } }
    );
    for (let r = 39; r <= 43; r++) {
      effectiveMerges.push(
        { s: { c: 0, r }, e: { c: 2, r } },
        { s: { c: 5, r }, e: { c: lastCol, r } }
      );
    }
    effectiveMerges.push(
      { s: { c: 0, r: 44 }, e: { c: 5, r: 44 } },
      { s: { c: 6, r: 44 }, e: { c: lastCol, r: 44 } }
    );

    for (const merge of effectiveMerges) {
      anchors.set(`${merge.s.r}:${merge.s.c}`, merge);
      for (let row = merge.s.r; row <= merge.e.r; row++) {
        for (let column = merge.s.c; column <= merge.e.c; column++) {
          if (row !== merge.s.r || column !== merge.s.c) hidden.add(`${row}:${column}`);
        }
      }
    }
    return { anchors, hidden };
  }, [sheet.merges, sheet.columnCount]);

  const measureRow = useCallback(rowIndex => {
    if (rowIndex === 2 || rowIndex === 3) return; // Keep fixed heights for sticky headers
    const row = tableRef.current?.querySelector?.(`tr[data-row-index="${rowIndex}"]`);
    if (!row) return;
    let height = baseRowHeights[rowIndex];
    for (const textarea of row.querySelectorAll('textarea')) {
      if (textarea.closest('td')?.classList.contains('cc-vertical')) continue;
      const previousHeight = textarea.style.height;
      textarea.style.height = 'auto';
      height = Math.max(height, textarea.scrollHeight);
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

  const firstGroupId = auditColumns[0]?.id;
  const firstTotalMarks = columnScores[firstGroupId]?.totalMarks ?? 62;

  return (
    <div className="cc-check-sheet" style={{ width: `${tableWidth}px`, minWidth: `${tableWidth}px` }}>
      {/* 1. Header Banner matching Assembly Form exactly */}
      <div className="assembly-form-header-box mb-3">
        {/* Top Compartment: Title (Left) and Auditor Name (Right) */}
        <div className="assembly-header-top-row">
          {/* Left Box: Title with Border Frame & Active Level Badges */}
          <div className="assembly-header-title-box">
            <div className="assembly-header-title-frame">
              <h2 className="assembly-header-title-text">
                Layered Process Audit
              </h2>
              <p className="assembly-header-subtitle-text">
                C&C Quality & Production
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1.5">
                {createdLevelBadges.map(colGroup => (
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
            <label htmlFor="lpa-cc-date">
              Date <span className="text-red-600 font-bold">*</span>
            </label>
            <input
              id="lpa-cc-date"
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
            <label htmlFor="lpa-cc-shift">
              Shift <span className="text-red-600 font-bold">*</span>
            </label>
            <select
              id="lpa-cc-shift"
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
            <label htmlFor="lpa-cc-department">
              Department <span className="text-red-600 font-bold">*</span>
            </label>
            <select
              id="lpa-cc-department"
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
            <label htmlFor="lpa-cc-section">
              Section
            </label>
            <select
              id="lpa-cc-section"
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
            <label htmlFor="lpa-cc-line">
              Line
            </label>
            <select
              id="lpa-cc-line"
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

      {/* 2. C&C Audit Table */}
      <table ref={tableRef} className="cc-check-sheet-table" style={{ width: `${tableWidth}px` }} aria-label={`${sheet.name} editable C&C LPA form`}>
        <colgroup>{widths.map((width, column) => <col key={column} style={{ width: `${width}px` }} />)}</colgroup>
        <tbody>
          {sheet.rows.map((row, rowIndex) => {
            // Rows 0 and 1 are replaced by the interactive Header Box
            if (rowIndex < 2) return null;

            return (
              <tr
                key={rowIndex}
                data-row-index={rowIndex}
                style={{ height: `${rowHeights[rowIndex] ?? baseRowHeights[rowIndex]}px` }}
                className={rowIndex === 2 ? 'cc-header-row-2' : rowIndex === 3 ? 'cc-header-row-3' : undefined}
              >
                {Array.from({ length: sheet.columnCount }, (_, columnIndex) => {
                  const key = `${rowIndex}:${columnIndex}`;
                  if (merges.hidden.has(key)) return null;
                  const merge = merges.anchors.get(key);
                  const value = row[columnIndex]?.formatted ?? String(row[columnIndex]?.value ?? '');
                  const style = row[columnIndex]?.style;

                  // Audit column group matching
                  const activeObsGroup = auditColumns.find(g => g.obsCol === columnIndex);
                  const activeScoreGroup = auditColumns.find(g => g.scoreCol === columnIndex);

                  const isObservation = Boolean(activeObsGroup) && rowIndex >= 4 && rowIndex <= 34;
                  const fill = style?.fgColor?.rgb;
                  const backgroundColor = fill && /^[0-9A-F]{6,8}$/i.test(fill) ? `#${fill.slice(-6)}` : undefined;
                  const isLevelHeader = rowIndex === 2 && Boolean(activeObsGroup);
                  const isSubHeader = rowIndex === 3 && (Boolean(activeObsGroup) || Boolean(activeScoreGroup));
                  const isBaseHeader = (rowIndex === 2 || rowIndex === 3) && columnIndex < 7;
                  const isStickyRow2 = rowIndex === 2;
                  const isStickyRow3 = rowIndex === 3;

                  const classes = [
                    isStickyRow2 ? 'cc-sticky-row-2' : '',
                    isStickyRow3 ? 'cc-sticky-row-3' : '',
                    isBaseHeader ? 'cc-column-heading' : '',
                    isLevelHeader ? 'cc-level-group-header' : '',
                    isSubHeader ? 'cc-sub-header' : '',
                    rowIndex === 35 || rowIndex === 36 ? 'cc-total' : '',
                    rowIndex === 37 ? 'cc-legend-heading' : '',
                    rowIndex >= 39 && rowIndex <= 43 ? 'cc-legend-row' : '',
                    rowIndex === 44 ? 'cc-footer' : '',
                    rowIndex === 44 && columnIndex === 6 ? 'cc-footer-date' : '',
                    (columnIndex === 1 || columnIndex === 5) && merge?.e.r > rowIndex ? 'cc-vertical' : '',
                    columnIndex === 0 && rowIndex >= 4 && rowIndex <= 34 ? 'cc-number' : '',
                    columnIndex === 6 && rowIndex >= 4 && rowIndex <= 35 ? 'cc-mark' : '',
                    (Boolean(activeObsGroup) || Boolean(activeScoreGroup)) && rowIndex >= 4 && rowIndex <= 36 ? 'cc-score-cell' : '',
                    columnIndex === 2 && rowIndex >= 4 && rowIndex <= 34 ? 'cc-question' : '',
                  ].filter(Boolean).join(' ');
                  const isVertical = classes.split(' ').includes('cc-vertical');
                  let cellDisplay = value;

                  // Row 35: Total Marks (col 6) and Total Scores for each group
                  if (rowIndex === 35) {
                    if (columnIndex === 6) cellDisplay = String(firstTotalMarks);
                    else if (activeScoreGroup) cellDisplay = hasColumnData(activeScoreGroup) ? String(columnScores[activeScoreGroup.id]?.totalScore ?? 0) : '-';
                  } else if (rowIndex === 36) {
                    if (columnIndex === 6) cellDisplay = columnScores[firstGroupId]?.percentageText ?? '0.00%';
                    else if (activeObsGroup) cellDisplay = hasColumnData(activeObsGroup) ? (columnScores[activeObsGroup.id]?.percentageText ?? '0.00%') : 'No data';
                  }

                  return (
                    <td key={columnIndex} rowSpan={merge ? merge.e.r - rowIndex + 1 : 1} colSpan={merge ? merge.e.c - columnIndex + 1 : 1} className={classes} style={{ backgroundColor }}>
                      {isVertical && (
                        <div className="cc-vertical-cell-wrapper">
                          <span className="cc-vertical-cell-text">
                            {cellDisplay}
                          </span>
                        </div>
                      )}
                      {!isVertical && isLevelHeader && (
                        <div className="flex flex-col items-center justify-center p-1 text-center select-none w-full min-h-[46px] leading-tight">
                          <span className="font-extrabold text-[11px] text-[#1e40af] leading-tight">{activeObsGroup.name}</span>
                          {isLevelReadOnly(activeObsGroup) && (
                            <span className="mt-0.5 text-[8.5px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold uppercase tracking-wider shrink-0">
                              View Only
                            </span>
                          )}
                        </div>
                      )}
                      {!isVertical && isSubHeader && (
                        <div className="text-center font-bold text-[10.5px] text-slate-700 py-0.5 select-none">
                          {Boolean(activeObsGroup) ? 'Observation' : 'Score'}
                        </div>
                      )}
                      {!isVertical && isBaseHeader && (
                        <div className="text-center font-extrabold text-[11px] text-slate-900 py-1 select-none">
                          {cellDisplay}
                        </div>
                      )}
                      {!isVertical && isObservation && (
                        isLevelReadOnly(activeObsGroup) ? (
                          <div
                            className="cc-observation-readonly flex items-center justify-center font-bold text-xs text-slate-800 bg-slate-50/70 py-1 select-none w-full h-full"
                            title={`${activeObsGroup.name} Observation (View Only)`}
                          >
                            <span>{value && String(value).trim() ? normalizeObservationSymbol(value) : '-'}</span>
                          </div>
                        ) : (
                          <select
                            aria-label={`${sheet.name} ${activeObsGroup.name} Observation row ${rowIndex + 1}`}
                            disabled={disabled}
                            value={normalizeObservationSymbol(value)}
                            onChange={event => handleObservationChange(rowIndex, activeObsGroup.obsCol, activeObsGroup.scoreCol, event.target.value)}
                            className="cc-observation-select"
                          >
                            <option value=""></option>
                            {OBSERVATION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                          </select>
                        )
                      )}
                      {!isVertical && !isObservation && !isLevelHeader && !isSubHeader && !isBaseHeader && (
                        (activeScoreGroup && isLevelReadOnly(activeScoreGroup) && rowIndex >= 4 && rowIndex <= 34) ? (
                          <div className="flex items-center justify-center font-bold text-xs text-slate-800 bg-slate-50/70 py-1 select-none w-full h-full">
                            <span>{cellDisplay && String(cellDisplay).trim() && cellDisplay !== '0' ? cellDisplay : (cellDisplay === '0' ? '0' : '-')}</span>
                          </div>
                        ) : (
                          <textarea
                            aria-label={`${sheet.name} ${columnName(columnIndex)}${rowIndex + 1}`}
                            disabled={disabled}
                            value={cellDisplay}
                            onKeyDown={event => {
                              if ((event.key === 'Enter' && event.shiftKey) || event.key === 'Backspace') {
                                const textarea = event.currentTarget;
                                requestAnimationFrame(() => {
                                  if (textarea.isConnected) measureRow(rowIndex);
                                });
                              }
                            }}
                            onChange={event => {
                              onChange(rowIndex, columnIndex, event.target.value);
                              requestAnimationFrame(() => measureRow(rowIndex));
                            }}
                            spellCheck={false}
                            rows={1}
                            title={row[columnIndex]?.formula ? `Excel formula: =${row[columnIndex].formula}` : undefined}
                          />
                        )
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
