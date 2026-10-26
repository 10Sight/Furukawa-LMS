import template from './ccTemplate.json' with { type: 'json' };
import { buildAuditColumnGroups, getActiveAuditColumns, normalizeSourceSheets, syncSheetWithLatestSameDaySources, sheetHasData } from '../../components/lpa/assemblySheetUtils.js';

export { syncSheetWithLatestSameDaySources };

export const ccTemplate = template;

export function isCcCheckSheet(sheet) {
  return ((sheet?.columnCount >= 9 || (sheet?.columnCount >= 7 && /c&c|crimping/i.test(sheet?.name || ''))) &&
    sheet.rows?.length >= 40) ||
    Boolean(sheet?.merges?.some(merge => merge.s.r === 0 && merge.s.c === 0 && merge.e.c >= 8));
}

export function fixCcCheckPointQuestions(sheet) {
  if (!sheet?.rows || !Array.isArray(sheet.rows)) return sheet;
  if (sheet.rows[7]?.[2]) {
    const val = String(sheet.rows[7][2].value ?? sheet.rows[7][2].formatted ?? '');
    if (val.includes('attendance board and hourly production board') || val.includes('hourly production board')) {
      sheet.rows[7][2] = { ...sheet.rows[7][2], value: 'Is the hourly production board updated', formatted: 'Is the hourly production board updated' };
    }
  }
  if (sheet.rows[8]?.[2]) {
    const val = String(sheet.rows[8][2].value ?? sheet.rows[8][2].formatted ?? '');
    if (val.includes('attendance board and hourly production board') || val.includes('attendance board')) {
      sheet.rows[8][2] = { ...sheet.rows[8][2], value: 'Is the attendance board updated', formatted: 'Is the attendance board updated' };
    }
  }
  return sheet;
}

export function upgradeCcTemplateRecord(record) {
  if (record?.section !== 'cc') return record;
  if (Array.isArray(record.sheets)) {
    record.sheets.forEach(fixCcCheckPointQuestions);
  }
  if (record.name !== ccTemplate.name) return record;

  const legacySheet = record.sheets?.find(sheet => sheet.columnCount === 7 && sheet.rows?.length === 41);
  if (!legacySheet) return record;

  const replacementSheet = structuredClone(ccTemplate.sheets[0]);
  fixCcCheckPointQuestions(replacementSheet);
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

export function createBlankCcSheet(baseSheet, date, levels = ['L3'], shifts = ['A'], existingSheet = null, targetLevel = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const sheet = structuredClone(baseSheet || ccTemplate.sheets[0]);
  fixCcCheckPointQuestions(sheet);
  const safeLevels = Array.isArray(levels) && levels.length > 0 ? levels : ['L3'];
  const safeShifts = Array.isArray(shifts) && shifts.length > 0 ? shifts : ['A'];
  const effectiveTarget = targetLevel || (safeLevels.includes('L1') ? 'L1' : safeLevels.includes('L2') ? 'L2' : 'L3');

  const sources = existingSheet ? normalizeSourceSheets(existingSheet) : null;
  const auditColumns = buildAuditColumnGroups(safeLevels, safeShifts, true, effectiveTarget, sources);
  const columnCount = 7 + auditColumns.length * 2;

  const sourceShiftStatus = {
    A: Boolean(sources?.L3_A && sheetHasData(sources.L3_A, 'A')),
    B: Boolean(sources?.L3_B && sheetHasData(sources.L3_B, 'B')),
    C: Boolean(sources?.L3_C && sheetHasData(sources.L3_C, 'C')),
    L2: Boolean(sources?.L2 && sheetHasData(sources.L2))
  };

  // Build rows
  const newRows = sheet.rows.map((row, rIdx) => {
    if (!Array.isArray(row)) return row;
    const nextRow = Array.from({ length: columnCount }, (_, c) => row[c] || { value: '', formatted: '', type: 'z' });

    // Row 0: Title
    if (rIdx === 0) {
      const lvlNum = effectiveTarget === 'L1' ? '1' : effectiveTarget === 'L2' ? '2' : '3';
      nextRow[0] = { value: `LPA CHECK SHEET LEVEL-${lvlNum} C&C QA/Prod.`, formatted: `LPA CHECK SHEET LEVEL-${lvlNum} C&C QA/Prod.`, type: 's' };
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

      // Merge fetched observations and scores from normalized same-day sources
      auditColumns.forEach((colGroup) => {
        let srcSheet = null;
        if (colGroup.id === 'L3_A') {
          srcSheet = sources?.L3_A;
        } else if (colGroup.id === 'L3_B') {
          srcSheet = sources?.L3_B;
        } else if (colGroup.id === 'L2' && effectiveTarget === 'L1') {
          srcSheet = sources?.L2;
        }

        if (srcSheet && Array.isArray(srcSheet.rows?.[rIdx])) {
          const prevRow = srcSheet.rows[rIdx];
          const existingAuditCols = getActiveAuditColumns(srcSheet, null, true);
          let matchedPrevCol = null;

          if (colGroup.id) {
            matchedPrevCol = existingAuditCols.find(p => p.id === colGroup.id);
          }
          if (!matchedPrevCol && colGroup.level === 'L3') {
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
        }
      });

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

  const lastCol = columnCount - 1;

  // Merges for C&C
  const baseMerges = (sheet.merges || []).filter(m =>
    m.s.r < 2 || (m.s.r >= 4 && m.s.r <= 34 && m.s.c < 7)
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

  // Dynamic Legend Merges extending across the full width to lastCol
  const legendMerges = [
    { s: { c: 0, r: 37 }, e: { c: 2, r: 38 } },
    { s: { c: 3, r: 37 }, e: { c: 3, r: 38 } },
    { s: { c: 4, r: 37 }, e: { c: lastCol, r: 38 } },
  ];
  for (let r = 39; r <= 43; r++) {
    legendMerges.push(
      { s: { c: 0, r }, e: { c: 2, r } },
      { s: { c: 5, r }, e: { c: lastCol, r } }
    );
  }
  legendMerges.push(
    { s: { c: 0, r: 44 }, e: { c: 5, r: 44 } },
    { s: { c: 6, r: 44 }, e: { c: lastCol, r: 44 } }
  );

  const merges = [...baseMerges, ...headerMerges, ...summaryMerges, ...legendMerges];

  return {
    ...sheet,
    columnCount,
    rows: newRows,
    merges,
    levels: safeLevels,
    shifts: safeShifts,
    targetLevel: effectiveTarget,
    auditColumns,
    sourceShiftStatus,
    date: targetDate,
    shift: '',
    department: 'C&C',
    sectionName: '',
    line: '',
    auditors: [''],
    auditor: ''
  };
}
