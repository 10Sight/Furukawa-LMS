import template from './ccTemplate.json' with { type: 'json' };
import { buildAuditColumnGroups, getActiveAuditColumns } from '../../components/lpa/assemblySheetUtils.js';

export const ccTemplate = template;

export function isCcCheckSheet(sheet) {
  return ((sheet?.columnCount >= 9 || (sheet?.columnCount >= 7 && /c&c|crimping/i.test(sheet?.name || ''))) &&
    sheet.rows?.length >= 40) ||
    Boolean(sheet?.merges?.some(merge => merge.s.r === 0 && merge.s.c === 0 && merge.e.c >= 8));
}

export function upgradeCcTemplateRecord(record) {
  if (record?.section !== 'cc' || record.name !== ccTemplate.name) return record;

  const legacySheet = record.sheets?.find(sheet => sheet.columnCount === 7 && sheet.rows?.length === 41);
  if (!legacySheet) return record;

  const replacementSheet = structuredClone(ccTemplate.sheets[0]);
  for (let index = 0; index < 31; index++) {
    const oldRow = legacySheet.rows[index + 3];
    const newRow = replacementSheet.rows[index + 4];
    for (const [oldColumn, newColumn] of [[5, 7], [6, 8]]) {
      const savedCell = oldRow?.[oldColumn];
      if (savedCell && String(savedCell.formatted ?? savedCell.value ?? '').trim()) {
        newRow[newColumn] = {
          ...savedCell,
          ...(newRow[newColumn]?.style ? { style: newRow[newColumn].style } : {}),
        };
      }
    }
  }

  return {
    ...record,
    _needsTemplateUpgrade: true,
    sheets: record.sheets.map(sheet => sheet === legacySheet ? replacementSheet : sheet),
  };
}

export function createBlankCcSheet(baseSheet, date, levels = ['L3'], shifts = ['A'], existingSheet = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const sheet = structuredClone(baseSheet || ccTemplate.sheets[0]);
  const safeLevels = Array.isArray(levels) && levels.length > 0 ? levels : ['L3'];
  const safeShifts = Array.isArray(shifts) && shifts.length > 0 ? shifts : ['A'];

  const auditColumns = buildAuditColumnGroups(safeLevels, safeShifts, true);
  const columnCount = 7 + auditColumns.length * 2;

  // Build rows
  const newRows = sheet.rows.map((row, rIdx) => {
    if (!Array.isArray(row)) return row;
    const nextRow = Array.from({ length: columnCount }, (_, c) => row[c] || { value: '', formatted: '', type: 'z' });

    // Row 0: Title
    if (rIdx === 0) {
      nextRow[0] = row[0] || { value: 'LPA CHECK SHEET LEVEL-3 C&C QA/Prod.', formatted: 'LPA CHECK SHEET LEVEL-3 C&C QA/Prod.', type: 's' };
      return nextRow;
    }

    // Row 1: Date & Auditor/Line header
    if (rIdx === 1) {
      nextRow[0] = { value: `Date :-${targetDate}`, formatted: `Date :-${targetDate}`, type: 's' };
      nextRow[5] = { value: 'Auditor/Audtee-                                                                                                                         Line-', formatted: 'Auditor/Audtee-                                                                                                                         Line-', type: 's' };
      return nextRow;
    }

    // Row 2: Column Headers
    if (rIdx === 2) {
      nextRow[0] = row[0] || { value: '.', formatted: '.', type: 's' };
      nextRow[1] = row[1] || { value: 'Focus', formatted: 'Focus', type: 's' };
      nextRow[2] = row[2] || { value: 'CHECKS POINTS', formatted: 'CHECKS POINTS', type: 's' };
      nextRow[5] = row[5] || { value: 'Section', formatted: 'Section', type: 's' };
      nextRow[6] = row[6] || { value: 'Marks', formatted: 'Marks', type: 's' };
      auditColumns.forEach((colGroup) => {
        nextRow[colGroup.obsCol] = { value: colGroup.name, formatted: colGroup.name, type: 's' };
        nextRow[colGroup.scoreCol] = { value: '', formatted: '', type: 'z' };
      });
      return nextRow;
    }

    // Row 3: Subheaders
    if (rIdx === 3) {
      auditColumns.forEach((colGroup) => {
        nextRow[colGroup.obsCol] = { value: 'Observation', formatted: 'Observation', type: 's' };
        nextRow[colGroup.scoreCol] = { value: 'Score', formatted: 'Score', type: 's' };
      });
      return nextRow;
    }

    // Rows 4 to 34: Checklist rows
    if (rIdx >= 4 && rIdx <= 34) {
      auditColumns.forEach((colGroup) => {
        nextRow[colGroup.obsCol] = { value: '', formatted: '', type: 'z' };
        nextRow[colGroup.scoreCol] = { value: '', formatted: '', type: 'z' };
      });

      // If existingSheet(s) passed, merge previous observations & scores
      const sourceSheets = Array.isArray(existingSheet) ? existingSheet : (existingSheet ? [existingSheet] : []);
      for (const srcSheet of sourceSheets) {
        if (!srcSheet || !Array.isArray(srcSheet.rows?.[rIdx])) continue;
        const prevRow = srcSheet.rows[rIdx];
        const existingAuditCols = getActiveAuditColumns(srcSheet, null, true);

        auditColumns.forEach((colGroup) => {
          let matchedPrevCol = null;
          if (colGroup.id) {
            matchedPrevCol = existingAuditCols.find(p => p.id === colGroup.id);
          }
          if (!matchedPrevCol && colGroup.level === 'L3' && colGroup.shift) {
            matchedPrevCol = existingAuditCols.find(p => p.level === 'L3' && (p.shift === colGroup.shift || (!p.shift && existingAuditCols.filter(x => x.level === 'L3').length === 1)));
          }
          if (!matchedPrevCol) {
            matchedPrevCol = existingAuditCols.find(p => p.level === colGroup.level);
          }

          if (matchedPrevCol && prevRow[matchedPrevCol.obsCol]) {
            const savedObs = prevRow[matchedPrevCol.obsCol];
            const savedScore = prevRow[matchedPrevCol.scoreCol];
            if (savedObs && String(savedObs.value ?? savedObs.formatted ?? '').trim()) {
              nextRow[colGroup.obsCol] = { ...savedObs };
            }
            if (savedScore && String(savedScore.value ?? savedScore.formatted ?? '').trim()) {
              nextRow[colGroup.scoreCol] = { ...savedScore };
            }
          }
        });
      }

      return nextRow;
    }

    // Row 35: Total Marks (col 6) & Total Scores
    if (rIdx === 35) {
      auditColumns.forEach((colGroup) => {
        nextRow[colGroup.obsCol] = { value: '', formatted: '', type: 'z' };
        nextRow[colGroup.scoreCol] = { value: 0, formatted: '0', type: 'n' };
      });
      return nextRow;
    }

    // Row 36: Percentage (%)
    if (rIdx === 36) {
      nextRow[6] = { value: 0, formatted: '0.00%', type: 's' };
      auditColumns.forEach((colGroup) => {
        nextRow[colGroup.obsCol] = { value: '0.00%', formatted: '0.00%', type: 's' };
        nextRow[colGroup.scoreCol] = { value: '', formatted: '', type: 'z' };
      });
      return nextRow;
    }

    // Row 44: Signatures & Date
    if (rIdx === 44) {
      if (nextRow[2]) nextRow[2] = { ...nextRow[2], value: '', formatted: '', type: 'z' };
      if (nextRow[6]) nextRow[6] = { ...nextRow[6], value: targetDate, formatted: targetDate, type: 's' };
    }

    return nextRow;
  });

  // Merges for C&C
  const baseMerges = (sheet.merges || []).filter(m =>
    m.s.r < 2 || (m.s.r >= 4 && m.s.r <= 34 && m.s.c < 7) || m.s.r >= 37
  );

  const headerMerges = [
    { s: { c: 0, r: 2 }, e: { c: 0, r: 3 } },
    { s: { c: 1, r: 2 }, e: { c: 1, r: 3 } },
    { s: { c: 2, r: 2 }, e: { c: 4, r: 3 } },
    { s: { c: 5, r: 2 }, e: { c: 5, r: 3 } },
    { s: { c: 6, r: 2 }, e: { c: 6, r: 3 } },
  ];
  auditColumns.forEach((colGroup) => {
    headerMerges.push({
      s: { c: colGroup.obsCol, r: 2 },
      e: { c: colGroup.scoreCol, r: 2 }
    });
  });

  const summaryMerges = [
    { s: { c: 0, r: 35 }, e: { c: 5, r: 35 } },
    { s: { c: 0, r: 36 }, e: { c: 5, r: 36 } },
  ];
  auditColumns.forEach((colGroup) => {
    summaryMerges.push({
      s: { c: colGroup.obsCol, r: 36 },
      e: { c: colGroup.scoreCol, r: 36 }
    });
  });

  const merges = [...baseMerges, ...headerMerges, ...summaryMerges];

  return {
    ...sheet,
    columnCount,
    rows: newRows,
    merges,
    levels: safeLevels,
    shifts: safeShifts,
    auditColumns,
    date: targetDate,
    shift: '',
    department: 'C&C',
    sectionName: '',
    line: '',
    auditors: [''],
    auditor: ''
  };
}
