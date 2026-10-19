import { getScoreForObservation, normalizeObservationSymbol } from '../../pages/lpa/lpaPdcaUtils.js';

export const LPA_LEVEL_DEFS = {
  L3: { id: 'L3', name: 'Level 3 Daily', title: 'Level 3 (Daily)', badge: 'Level 3 (Daily)', frequency: 'Daily' },
  L2: { id: 'L2', name: 'Level 2 Weekly', title: 'Level 2 (Weekly)', badge: 'Level 2 (Weekly)', frequency: 'Weekly' },
  L1: { id: 'L1', name: 'Level 1 Monthly', title: 'Level 1 (Monthly)', badge: 'Level 1 (Monthly)', frequency: 'Monthly' }
};

/**
 * Builds the list of audit column groups (each having an observation and score column).
 * If multiple shifts have filled data on Level 3, shows separate columns per shift.
 * If only one shift has data, shows single Level 3 column.
 */
export function buildAuditColumnGroups(levels = ['L3'], shifts = ['A'], isCc = false) {
  const startCol = isCc ? 7 : 5;
  const safeLevels = Array.isArray(levels) && levels.length > 0 ? levels : ['L3'];
  const safeShifts = Array.isArray(shifts) && shifts.length > 0 ? shifts : ['A'];
  const groups = [];

  // 1. Level 3 (Daily)
  if (safeLevels.includes('L3')) {
    const l3Shifts = safeShifts.filter(s => ['A', 'B', 'C'].includes(s));
    const finalShifts = l3Shifts.length > 0 ? l3Shifts : ['A'];

    if (finalShifts.length > 1) {
      // Multiple shifts have data on this day -> show separate shift columns
      finalShifts.forEach((s) => {
        const obsCol = startCol + groups.length * 2;
        groups.push({
          id: `L3_${s}`,
          level: 'L3',
          shift: s,
          name: `Level 3 Daily (Shift ${s})`,
          badge: `Level 3 Shift ${s}`,
          obsCol,
          scoreCol: obsCol + 1
        });
      });
    } else {
      // Single shift -> single Level 3 column pair
      const s = finalShifts[0] || 'A';
      const obsCol = startCol + groups.length * 2;
      const shiftName = s && s !== 'A' ? `Level 3 Daily (Shift ${s})` : 'Level 3 Daily';
      groups.push({
        id: `L3_${s}`,
        level: 'L3',
        shift: s,
        name: shiftName,
        badge: `Level 3 Shift ${s}`,
        obsCol,
        scoreCol: obsCol + 1
      });
    }
  }

  // 2. Level 2 (Weekly)
  if (safeLevels.includes('L2')) {
    const s = safeShifts[0] || 'G';
    const obsCol = startCol + groups.length * 2;
    groups.push({
      id: 'L2',
      level: 'L2',
      shift: s || 'G',
      name: 'Level 2 Weekly',
      badge: 'Level 2 Weekly',
      obsCol,
      scoreCol: obsCol + 1
    });
  }

  // 3. Level 1 (Monthly)
  if (safeLevels.includes('L1')) {
    const s = safeShifts[0] || 'G';
    const obsCol = startCol + groups.length * 2;
    groups.push({
      id: 'L1',
      level: 'L1',
      shift: s || 'G',
      name: 'Level 1 Monthly',
      badge: 'Level 1 Monthly',
      obsCol,
      scoreCol: obsCol + 1
    });
  }

  return groups;
}

/**
 * Returns the active audit column groups for a given sheet or editor.
 */
export function getActiveAuditColumns(sheet, editor, isCc = false) {
  const startCol = isCc ? 7 : 5;

  // 1. Direct auditColumns metadata
  if (Array.isArray(sheet?.auditColumns) && sheet.auditColumns.length > 0) {
    return sheet.auditColumns;
  }
  if (Array.isArray(editor?.auditColumns) && editor.auditColumns.length > 0) {
    return editor.auditColumns;
  }

  // 2. Inspect header row for shift or level information
  const headerRowIdx = isCc ? 2 : 1;
  const headerRow = sheet?.rows?.[headerRowIdx];
  if (Array.isArray(headerRow)) {
    const groups = [];
    for (let c = startCol; c < (sheet.columnCount || headerRow.length); c += 2) {
      const cellVal = String(headerRow[c]?.value ?? headerRow[c]?.formatted ?? '').trim();
      if (!cellVal) continue;
      let level = 'L3';
      let shift = null;
      let id = `col_${c}`;

      if (/l1/i.test(cellVal) || /monthly/i.test(cellVal)) {
        level = 'L1';
        shift = 'G';
        id = 'L1';
      } else if (/l2/i.test(cellVal) || /weekly/i.test(cellVal)) {
        level = 'L2';
        shift = 'G';
        id = 'L2';
      } else if (/l3/i.test(cellVal) || /daily/i.test(cellVal)) {
        level = 'L3';
        const shiftMatch = cellVal.match(/shift\s*([ABC])/i);
        if (shiftMatch) {
          shift = shiftMatch[1].toUpperCase();
          id = `L3_${shift}`;
        } else {
          id = 'L3';
          shift = sheet?.shift || editor?.shift || 'A';
        }
      }

      groups.push({
        id,
        level,
        shift,
        name: cellVal || `${level} Check`,
        badge: cellVal || `${level}`,
        obsCol: c,
        scoreCol: c + 1
      });
    }
    if (groups.length > 0) return groups;
  }

  // 3. Fallback to levels + shifts metadata
  const levels = sheet?.levels || editor?.levels || [sheet?.level || editor?.level || 'L3'];
  const shifts = sheet?.shifts || editor?.shifts || (sheet?.shift || editor?.shift ? [sheet?.shift || editor?.shift] : ['A']);
  return buildAuditColumnGroups(levels, shifts, isCc);
}

export function getActiveLevels(sheet, editor) {
  const auditCols = getActiveAuditColumns(sheet, editor, false);
  const seen = new Set();
  const levels = [];
  auditCols.forEach(col => {
    if (!seen.has(col.level)) {
      seen.add(col.level);
      levels.push(LPA_LEVEL_DEFS[col.level] || { id: col.level, name: col.name, title: col.name, badge: col.name, frequency: 'Standard' });
    }
  });
  return levels.length > 0 ? levels : [LPA_LEVEL_DEFS.L3];
}

export function calculateColumnGroupScore(sheet, obsCol, scoreCol, marksCol = 4, startRow = 3, endRow = 36) {
  if (!sheet || !Array.isArray(sheet.rows)) {
    return { totalMarks: 70, totalScore: 0, percentage: 0, percentageText: '0.00%' };
  }

  let totalMarks = 0;
  let totalScore = 0;

  for (let r = startRow; r <= endRow; r++) {
    const row = sheet.rows[r];
    if (!row) continue;

    const obsCell = row[obsCol];
    const obsText = normalizeObservationSymbol(obsCell?.value ?? obsCell?.formatted);
    const marksCell = row[marksCol];
    const marksNum = Number(marksCell?.value ?? marksCell?.formatted ?? 1);
    const safeMarks = Number.isFinite(marksNum) && marksNum > 0 ? marksNum : 1;

    // 'NA' observation is excluded from total marks
    if (obsText !== 'NA') {
      totalMarks += safeMarks;
    }

    const scoreCell = row[scoreCol];
    const scoreVal = scoreCell?.value ?? scoreCell?.formatted;
    if (scoreVal !== '' && scoreVal !== 'NA' && scoreVal != null) {
      const numScore = Number(scoreVal);
      if (Number.isFinite(numScore)) {
        totalScore += numScore;
      }
    }
  }

  const pct = totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0;
  return {
    totalMarks,
    totalScore,
    percentage: pct,
    percentageText: `${pct.toFixed(2)}%`
  };
}

export function isAssemblyCheckSheet(sheet) {
  if (!sheet || !Array.isArray(sheet.rows)) return false;

  // 1. Dynamic multi-column structure (7, 9, 11 columns)
  if (sheet.columnCount >= 7) {
    const row1 = sheet.rows[1] || [];
    const colNames = row1.map(c => String(c?.value ?? c?.formatted ?? '').trim().toLowerCase());
    if (colNames.some(c => c.includes('checks points') || c.includes('check points')) ||
      (colNames.includes('sl no') && colNames.includes('area')) ||
      (Array.isArray(sheet.levels) && sheet.levels.length > 0)) {
      return true;
    }
  }

  // 2. Legacy 14-column structure
  if (sheet.columnCount === 14) {
    return true;
  }

  // 3. Title or sheet name matching Assembly
  const row0Text = (sheet.rows[0] || []).map(c => String(c?.value ?? c?.formatted ?? '')).join(' ');
  const sheetName = String(sheet.name || '');
  return /assy|assembly/i.test(row0Text) || /assy|assembly/i.test(sheetName);
}

/**
 * Normalizes an Assembly worksheet to the required column layout
 * Preserves Area values, row associations, and vertically merged cells.
 */
export const ASSEMBLY_LEGEND_MERGES = [
  { s: { c: 0, r: 40 }, e: { c: 2, r: 41 } },
  { s: { c: 3, r: 40 }, e: { c: 4, r: 41 } },
  { s: { c: 5, r: 40 }, e: { c: 6, r: 41 } },
  { s: { c: 0, r: 42 }, e: { c: 2, r: 42 } },
  { s: { c: 5, r: 42 }, e: { c: 6, r: 42 } },
  { s: { c: 0, r: 43 }, e: { c: 2, r: 43 } },
  { s: { c: 5, r: 43 }, e: { c: 6, r: 43 } },
  { s: { c: 0, r: 44 }, e: { c: 2, r: 44 } },
  { s: { c: 5, r: 44 }, e: { c: 6, r: 44 } },
  { s: { c: 0, r: 45 }, e: { c: 2, r: 45 } },
  { s: { c: 5, r: 45 }, e: { c: 6, r: 45 } },
  { s: { c: 0, r: 46 }, e: { c: 2, r: 46 } },
  { s: { c: 5, r: 46 }, e: { c: 6, r: 46 } },
  { s: { c: 0, r: 47 }, e: { c: 6, r: 47 } }
];

export function ensureAssemblyLegend(sheet) {
  if (!sheet || !Array.isArray(sheet.rows)) return sheet;

  const colCount = Math.max(7, sheet.columnCount || 7);
  const endCol = colCount - 1;

  const nextRows = sheet.rows.map((row, r) => {
    if (r === 40) {
      const legRow = Array.from({ length: colCount }, () => ({ value: '', formatted: '', type: 'z' }));
      legRow[0] = { value: 'Legends', formatted: 'Legends', type: 's' };
      legRow[3] = { value: 'During audit', formatted: 'During audit', type: 's' };
      legRow[5] = { value: 'Score Criteria', formatted: 'Score Criteria', type: 's' };
      return legRow;
    }
    if (r === 41) {
      return Array.from({ length: colCount }, () => ({ value: '', formatted: '', type: 'z' }));
    }
    if (r === 42) {
      const legRow = Array.from({ length: colCount }, () => ({ value: '', formatted: '', type: 'z' }));
      legRow[0] = { value: 'Requirement met', formatted: 'Requirement met', type: 's' };
      legRow[3] = { value: 'Ο', formatted: 'Ο', type: 's' };
      legRow[4] = { value: 'Ο', formatted: 'Ο', type: 's' };
      legRow[5] = { value: 'If requirment meet & corrected during the audit', formatted: 'If requirment meet & corrected during the audit', type: 's' };
      return legRow;
    }
    if (r === 43) {
      const legRow = Array.from({ length: colCount }, () => ({ value: '', formatted: '', type: 'z' }));
      legRow[0] = { value: 'Requirement not met corrected during the audit', formatted: 'Requirement not met corrected during the audit', type: 's' };
      legRow[3] = { value: 'Δ', formatted: 'Δ', type: 's' };
      legRow[4] = { value: 'X', formatted: 'X', type: 's' };
      legRow[5] = { value: 'If requirment not meet & system not adhere', formatted: 'If requirment not meet & system not adhere', type: 's' };
      return legRow;
    }
    if (r === 44) {
      const legRow = Array.from({ length: colCount }, () => ({ value: '', formatted: '', type: 'z' }));
      legRow[0] = { value: 'Requirement not met not corrected during the audit', formatted: 'Requirement not met not corrected during the audit', type: 's' };
      legRow[3] = { value: 'Χ', formatted: 'Χ', type: 's' };
      legRow[4] = { value: 3, formatted: '3', type: 'n' };
      legRow[5] = { value: 'Critical or direct impact on quality', formatted: 'Critical or direct impact on quality', type: 's' };
      return legRow;
    }
    if (r === 45) {
      const legRow = Array.from({ length: colCount }, () => ({ value: '', formatted: '', type: 'z' }));
      legRow[0] = { value: 'Not Applicable', formatted: 'Not Applicable', type: 's' };
      legRow[3] = { value: 'NA', formatted: 'NA', type: 's' };
      legRow[4] = { value: 2, formatted: '2', type: 'n' };
      legRow[5] = { value: 'No impact on product quality', formatted: 'No impact on product quality', type: 's' };
      return legRow;
    }
    if (r === 46) {
      const legRow = Array.from({ length: colCount }, () => ({ value: '', formatted: '', type: 'z' }));
      legRow[0] = { value: 'Horizontal development', formatted: 'Horizontal development', type: 's', style: { patternType: 'solid', fgColor: { rgb: 'FFFFCC' } } };
      legRow[4] = { value: 1, formatted: '1', type: 'n' };
      legRow[5] = { value: 'Not impact on product but system requirment', formatted: 'Not impact on product but system requirment', type: 's' };
      return legRow;
    }
    if (r === 47) {
      const legRow = Array.from({ length: colCount }, () => ({ value: '', formatted: '', type: 'z' }));
      legRow[0] = { value: 'FRM-WH-QA-246                                                                          Rev. No:-06                                      Issue Date:-31.01.22', formatted: 'FRM-WH-QA-246                                                                          Rev. No:-06                                      Issue Date:-31.01.22', type: 's' };
      return legRow;
    }
    return row;
  });

  const legendMerges = [
    { s: { c: 0, r: 40 }, e: { c: 2, r: 41 } },
    { s: { c: 3, r: 40 }, e: { c: 4, r: 41 } },
    { s: { c: 5, r: 40 }, e: { c: endCol, r: 41 } },
    { s: { c: 0, r: 42 }, e: { c: 2, r: 42 } },
    { s: { c: 5, r: 42 }, e: { c: endCol, r: 42 } },
    { s: { c: 0, r: 43 }, e: { c: 2, r: 43 } },
    { s: { c: 5, r: 43 }, e: { c: endCol, r: 43 } },
    { s: { c: 0, r: 44 }, e: { c: 2, r: 44 } },
    { s: { c: 5, r: 44 }, e: { c: endCol, r: 44 } },
    { s: { c: 0, r: 45 }, e: { c: 2, r: 45 } },
    { s: { c: 5, r: 45 }, e: { c: endCol, r: 45 } },
    { s: { c: 0, r: 46 }, e: { c: 2, r: 46 } },
    { s: { c: 5, r: 46 }, e: { c: endCol, r: 46 } },
    { s: { c: 0, r: 47 }, e: { c: endCol, r: 47 } }
  ];

  const existingMerges = (sheet.merges || []).filter(m => m.s.r < 40 || m.s.r > 47);
  return {
    ...sheet,
    rows: nextRows,
    merges: [...existingMerges, ...legendMerges]
  };
}

export function normalizeAssemblySheet(sheet) {
  if (!sheet || !Array.isArray(sheet.rows)) return sheet;

  // If already normalized with >= 7 columns, ensure legend and return
  if (sheet.columnCount >= 7 && sheet.columnCount !== 14) {
    const updatedRows = sheet.rows.map((row, r) => {
      if (r < 3 || r > 36 || !Array.isArray(row)) return row;
      const obsCell = row[5] || { value: '', formatted: '', type: 'z' };
      let scoreCell = row[6] || { value: '', formatted: '', type: 'z' };
      const marksCell = row[4] || { value: '', formatted: '', type: 'z' };

      const obsText = String(obsCell.value ?? obsCell.formatted ?? '').trim();
      const scoreText = String(scoreCell.value ?? scoreCell.formatted ?? '').trim();
      const marksVal = Number(marksCell.value ?? marksCell.formatted ?? 0);

      if (obsText && !scoreText) {
        const autoScore = getScoreForObservation(obsText, marksVal);
        if (autoScore !== '') {
          scoreCell = {
            value: autoScore === 'NA' ? 'NA' : Number(autoScore),
            formatted: String(autoScore),
            type: autoScore === 'NA' ? 's' : 'n'
          };
          const nextRow = [...row];
          nextRow[6] = scoreCell;
          return nextRow;
        }
      }
      return row;
    });
    return ensureAssemblyLegend({ ...sheet, rows: updatedRows });
  }

  // Legacy 14-column conversion to 7 columns
  const rows = sheet.rows;
  const headerRow = rows[1] || [];

  const areaColIdx = headerRow.findIndex(c => /^area$/i.test(String(c?.value ?? c?.formatted ?? '').trim()));
  const marksColIdx = headerRow.findIndex(c => /^marks$/i.test(String(c?.value ?? c?.formatted ?? '').trim()));
  const obsColIdx = headerRow.findIndex(c => /^observation$/i.test(String(c?.value ?? c?.formatted ?? '').trim()));
  const scoreColIdx = headerRow.findIndex(c => /^score$/i.test(String(c?.value ?? c?.formatted ?? '').trim()));

  const oldAreaCol = areaColIdx >= 0 ? areaColIdx : 6;
  const oldMarksCol = marksColIdx >= 0 ? marksColIdx : 3;
  const oldObsCol = obsColIdx >= 0 ? obsColIdx : 4;
  const oldScoreCol = scoreColIdx >= 0 ? scoreColIdx : 5;

  const newRows = rows.map((row, r) => {
    if (!Array.isArray(row)) return [];
    if (r === 0) {
      const dateCell = row[0] || { value: 'Date/Shift-', formatted: 'Date/Shift-', type: 's' };
      const titleCell = row[2] || { value: ' LPA CHECK SHEET Level-3 Assy QA/Prod.', formatted: ' LPA CHECK SHEET Level-3 Assy QA/Prod.', type: 's' };
      const auditCell = row[5] || row[7] || { value: 'Auditor/Audtee-                                                                                                                         Line-', formatted: 'Auditor/Audtee-                                                                                                                         Line-', type: 's' };
      return [
        dateCell,
        { value: '', formatted: '', type: 'z' },
        titleCell,
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' },
        auditCell,
        { value: '', formatted: '', type: 'z' }
      ];
    }
    if (r === 1) {
      return [
        { value: 'Sl No', formatted: 'Sl No', type: 's' },
        { value: 'Focus', formatted: 'Focus', type: 's' },
        { value: 'CHECKS POINTS', formatted: 'CHECKS POINTS', type: 's' },
        { value: 'Area', formatted: 'Area', type: 's' },
        { value: 'Marks', formatted: 'Marks', type: 's' },
        { value: 'Observation', formatted: 'Observation', type: 's' },
        { value: 'Score', formatted: 'Score', type: 's' }
      ];
    }
    if (r === 2) {
      return Array.from({ length: 7 }, () => ({ value: '', formatted: '', type: 'z' }));
    }
    if (r >= 40) {
      return Array.from({ length: 7 }, (_, c) => row[c] || { value: '', formatted: '', type: 'z' });
    }

    if (r === 37) {
      return [
        { value: 'Total Marks:', formatted: 'Total Marks:', type: 's' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' },
        row[oldMarksCol] || { value: '70/', formatted: '70/', type: 's' },
        { value: '', formatted: '', type: 'z' },
        row[oldScoreCol] || { value: '0', formatted: '0', type: 's' }
      ];
    }
    if (r === 38) {
      return [
        { value: 'Percentage (%):', formatted: 'Percentage (%):', type: 's' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' },
        { value: '0.00%', formatted: '0.00%', type: 's' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' }
      ];
    }
    if (r === 39) {
      return Array.from({ length: 7 }, () => ({ value: '', formatted: '', type: 'z' }));
    }

    // Checklist rows (3 to 36)
    const obsCell = row[oldObsCol] || { value: '', formatted: '', type: 'z' };
    let scoreCell = row[oldScoreCol] || { value: '', formatted: '', type: 'z' };
    const marksCell = row[oldMarksCol] || { value: '', formatted: '', type: 'z' };

    const obsText = String(obsCell.value ?? obsCell.formatted ?? '').trim();
    const scoreText = String(scoreCell.value ?? scoreCell.formatted ?? '').trim();
    const marksVal = Number(marksCell.value ?? marksCell.formatted ?? 0);

    if (obsText && !scoreText) {
      const autoScore = getScoreForObservation(obsText, marksVal);
      if (autoScore !== '') {
        scoreCell = {
          value: autoScore === 'NA' ? 'NA' : Number(autoScore),
          formatted: String(autoScore),
          type: autoScore === 'NA' ? 's' : 'n'
        };
      }
    }

    return [
      row[0] || { value: '', formatted: '', type: 'z' },
      row[1] || { value: '', formatted: '', type: 'z' },
      row[2] || { value: '', formatted: '', type: 'z' },
      row[oldAreaCol] || { value: '', formatted: '', type: 'z' },
      marksCell,
      obsCell,
      scoreCell
    ];
  });

  const newMerges = [];
  for (const m of sheet.merges || []) {
    if (m.s.r >= 3 && m.s.r <= 36 && m.s.c >= 7) continue;

    if (m.s.c === oldAreaCol && m.e.c === oldAreaCol) {
      newMerges.push({ s: { r: m.s.r, c: 3 }, e: { r: m.e.r, c: 3 } });
    } else if (m.s.c === 1 && m.e.c === 1) {
      newMerges.push({ s: { r: m.s.r, c: 1 }, e: { r: m.e.r, c: 1 } });
    } else if (m.s.r >= 40) {
      if (m.e.c < 7) {
        newMerges.push(m);
      }
    }
  }

  const standardMerges = [
    { s: { c: 0, r: 0 }, e: { c: 1, r: 0 } },
    { s: { c: 2, r: 0 }, e: { c: 4, r: 0 } },
    { s: { c: 5, r: 0 }, e: { c: 6, r: 0 } },
    { s: { c: 0, r: 1 }, e: { c: 0, r: 2 } },
    { s: { c: 1, r: 1 }, e: { c: 1, r: 2 } },
    { s: { c: 2, r: 1 }, e: { c: 2, r: 2 } },
    { s: { c: 3, r: 1 }, e: { c: 3, r: 2 } },
    { s: { c: 4, r: 1 }, e: { c: 4, r: 2 } },
    { s: { c: 5, r: 1 }, e: { c: 5, r: 2 } },
    { s: { c: 6, r: 1 }, e: { c: 6, r: 2 } },
    { s: { c: 0, r: 37 }, e: { c: 3, r: 37 } },
    { s: { c: 0, r: 38 }, e: { c: 3, r: 38 } },
    { s: { c: 4, r: 38 }, e: { c: 6, r: 38 } }
  ];

  for (const sm of standardMerges) {
    if (!newMerges.some(m => m.s.r === sm.s.r && m.s.c === sm.s.c)) {
      newMerges.push(sm);
    }
  }

  return ensureAssemblyLegend({
    ...sheet,
    columnCount: 7,
    rows: newRows,
    merges: newMerges,
    columns: [
      { wpx: 38 },
      { wpx: 50 },
      { wpx: 490 },
      { wpx: 40 },
      { wpx: 45 },
      { wpx: 75 },
      { wpx: 50 }
    ]
  });
}

/**
 * Upgrades an Assembly workbook record, ensuring legacy 14-col sheets adhere to new layout.
 */
export function upgradeAssemblyRecord(record) {
  if (record?.section !== 'assembly' || !Array.isArray(record.sheets)) return record;

  const needsUpgrade = record.sheets.some(s => s.columnCount === 14);
  if (!needsUpgrade) return record;

  return {
    ...record,
    sheets: record.sheets.map(sheet => (sheet.columnCount === 14 ? normalizeAssemblySheet(sheet) : sheet))
  };
}

/**
 * Creates a blank Assembly check sheet supporting dynamic audit levels and multi-shift columns.
 * If existingSheet is provided, existing observations & scores for the same day are fetched and merged.
 */
export function createBlankAssemblySheet(baseSheet, date, levels = ['L3'], shifts = ['A'], existingSheet = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const normalized = normalizeAssemblySheet(baseSheet);
  const safeLevels = Array.isArray(levels) && levels.length > 0 ? levels : ['L3'];
  const safeShifts = Array.isArray(shifts) && shifts.length > 0 ? shifts : ['A'];

  const auditColumns = buildAuditColumnGroups(safeLevels, safeShifts, false);
  const columnCount = 5 + auditColumns.length * 2;

  // Build rows
  const newRows = normalized.rows.map((row, rIdx) => {
    if (!Array.isArray(row)) return row;

    if (rIdx === 0) {
      const row0 = Array.from({ length: columnCount }, () => ({ value: '', formatted: '', type: 'z' }));
      row0[0] = row[0] || { value: `Date: ${targetDate}`, formatted: `Date: ${targetDate}`, type: 's' };
      row0[2] = row[2] || { value: ' LPA CHECK SHEET Level-3 Assy QA/Prod.', formatted: ' LPA CHECK SHEET Level-3 Assy QA/Prod.', type: 's' };
      row0[columnCount - 2] = row[5] || row[7] || { value: 'Auditor/Audtee-                                                                                                                         Line-', formatted: 'Auditor/Audtee-                                                                                                                         Line-', type: 's' };
      return row0;
    }

    if (rIdx === 1) {
      const row1 = Array.from({ length: columnCount }, () => ({ value: '', formatted: '', type: 'z' }));
      row1[0] = { value: 'Sl No', formatted: 'Sl No', type: 's' };
      row1[1] = { value: 'Focus', formatted: 'Focus', type: 's' };
      row1[2] = { value: 'CHECKS POINTS', formatted: 'CHECKS POINTS', type: 's' };
      row1[3] = { value: 'Area', formatted: 'Area', type: 's' };
      row1[4] = { value: 'Marks', formatted: 'Marks', type: 's' };
      auditColumns.forEach((colGroup) => {
        row1[colGroup.obsCol] = { value: colGroup.name, formatted: colGroup.name, type: 's' };
        row1[colGroup.scoreCol] = { value: '', formatted: '', type: 'z' };
      });
      return row1;
    }

    if (rIdx === 2) {
      const row2 = Array.from({ length: columnCount }, () => ({ value: '', formatted: '', type: 'z' }));
      auditColumns.forEach((colGroup) => {
        row2[colGroup.obsCol] = { value: 'Observation', formatted: 'Observation', type: 's' };
        row2[colGroup.scoreCol] = { value: 'Score', formatted: 'Score', type: 's' };
      });
      return row2;
    }

    // Rows 3 to 36: Checklist rows
    if (rIdx >= 3 && rIdx <= 36) {
      const nextRow = Array.from({ length: columnCount }, () => ({ value: '', formatted: '', type: 'z' }));
      nextRow[0] = row[0] || { value: '', formatted: '', type: 'z' };
      nextRow[1] = row[1] || { value: '', formatted: '', type: 'z' };
      nextRow[2] = row[2] || { value: '', formatted: '', type: 'z' };
      nextRow[3] = row[3] || { value: '', formatted: '', type: 'z' };
      nextRow[4] = row[4] || { value: 1, formatted: '1', type: 'n' };

      // Initialize empty cells for each column group
      auditColumns.forEach((colGroup) => {
        nextRow[colGroup.obsCol] = { value: '', formatted: '', type: 'z' };
        nextRow[colGroup.scoreCol] = { value: '', formatted: '', type: 'z' };
      });

      // If existingSheet(s) passed, merge existing observations and scores
      const sourceSheets = Array.isArray(existingSheet) ? existingSheet : (existingSheet ? [existingSheet] : []);
      for (const srcSheet of sourceSheets) {
        if (!srcSheet || !Array.isArray(srcSheet.rows?.[rIdx])) continue;
        const prevRow = srcSheet.rows[rIdx];
        const existingAuditCols = getActiveAuditColumns(srcSheet, null, false);

        auditColumns.forEach((colGroup) => {
          let matchedPrevCol = null;
          // 1. Direct ID match
          if (colGroup.id) {
            matchedPrevCol = existingAuditCols.find(p => p.id === colGroup.id);
          }
          // 2. Exact level and shift match
          if (!matchedPrevCol && colGroup.shift) {
            matchedPrevCol = existingAuditCols.find(p => p.level === colGroup.level && p.shift === colGroup.shift);
          }
          // 3. If previous sheet had single L3 column, match it to the first L3 column only
          if (!matchedPrevCol && colGroup.level === 'L3' && existingAuditCols.filter(x => x.level === 'L3').length === 1) {
            const firstL3Group = auditColumns.find(x => x.level === 'L3');
            if (colGroup.id === firstL3Group?.id) {
              matchedPrevCol = existingAuditCols.find(x => x.level === 'L3');
            }
          }
          // 4. For L2 or L1, match by level
          if (!matchedPrevCol && (colGroup.level === 'L2' || colGroup.level === 'L1')) {
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

    // Row 37: Total Marks
    if (rIdx === 37) {
      const row37 = Array.from({ length: columnCount }, () => ({ value: '', formatted: '', type: 'z' }));
      row37[0] = { value: 'Total Marks:', formatted: 'Total Marks:', type: 's' };
      row37[4] = { value: '70/', formatted: '70/', type: 's' };
      auditColumns.forEach((colGroup) => {
        row37[colGroup.obsCol] = { value: '', formatted: '', type: 'z' };
        row37[colGroup.scoreCol] = { value: '0', formatted: '0', type: 's' };
      });
      return row37;
    }

    // Row 38: Percentage (%)
    if (rIdx === 38) {
      const row38 = Array.from({ length: columnCount }, () => ({ value: '', formatted: '', type: 'z' }));
      row38[0] = { value: 'Percentage (%):', formatted: 'Percentage (%):', type: 's' };
      auditColumns.forEach((colGroup) => {
        row38[colGroup.obsCol] = { value: '0.00%', formatted: '0.00%', type: 's' };
        row38[colGroup.scoreCol] = { value: '', formatted: '', type: 'z' };
      });
      return row38;
    }

    // Row 39: Blank separator row
    if (rIdx === 39) {
      return Array.from({ length: columnCount }, () => ({ value: '', formatted: '', type: 'z' }));
    }

    // Legend rows (40 to 47)
    if (rIdx >= 40) {
      return Array.from({ length: columnCount }, (_, c) => row[c] || { value: '', formatted: '', type: 'z' });
    }

    return row;
  });

  // Checklist Focus (c=1) and Area (c=3) merges
  const baseMerges = (normalized.merges || []).filter(m =>
    (m.s.c === 1 && m.e.c === 1 && m.s.r >= 3 && m.e.r <= 36) ||
    (m.s.c === 3 && m.e.c === 3 && m.s.r >= 3 && m.e.r <= 36)
  );

  // Header merges
  const headerMerges = [
    { s: { c: 0, r: 1 }, e: { c: 0, r: 2 } },
    { s: { c: 1, r: 1 }, e: { c: 1, r: 2 } },
    { s: { c: 2, r: 1 }, e: { c: 2, r: 2 } },
    { s: { c: 3, r: 1 }, e: { c: 3, r: 2 } },
    { s: { c: 4, r: 1 }, e: { c: 4, r: 2 } },
  ];
  auditColumns.forEach((colGroup) => {
    headerMerges.push({
      s: { c: colGroup.obsCol, r: 1 },
      e: { c: colGroup.scoreCol, r: 1 }
    });
  });

  // Summary merges
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

  // Legend merges
  const endCol = columnCount - 1;
  const legendMerges = [
    { s: { c: 0, r: 40 }, e: { c: 2, r: 41 } },
    { s: { c: 3, r: 40 }, e: { c: 4, r: 41 } },
    { s: { c: 5, r: 40 }, e: { c: endCol, r: 41 } },
    { s: { c: 0, r: 42 }, e: { c: 2, r: 42 } },
    { s: { c: 5, r: 42 }, e: { c: endCol, r: 42 } },
    { s: { c: 0, r: 43 }, e: { c: 2, r: 43 } },
    { s: { c: 5, r: 43 }, e: { c: endCol, r: 43 } },
    { s: { c: 0, r: 44 }, e: { c: 2, r: 44 } },
    { s: { c: 5, r: 44 }, e: { c: endCol, r: 44 } },
    { s: { c: 0, r: 45 }, e: { c: 2, r: 45 } },
    { s: { c: 5, r: 45 }, e: { c: endCol, r: 45 } },
    { s: { c: 0, r: 46 }, e: { c: 2, r: 46 } },
    { s: { c: 5, r: 46 }, e: { c: endCol, r: 46 } },
    { s: { c: 0, r: 47 }, e: { c: endCol, r: 47 } }
  ];

  const merges = [...baseMerges, ...headerMerges, ...summaryMerges, ...legendMerges];

  // Column widths
  const baseCols = [
    { wpx: 35 },
    { wpx: 50 },
    { wpx: 440 },
    { wpx: 40 },
    { wpx: 45 }
  ];
  auditColumns.forEach(() => {
    baseCols.push({ wpx: 75 }, { wpx: 50 });
  });

  return {
    ...normalized,
    columnCount,
    columns: baseCols,
    rows: newRows,
    merges,
    levels: safeLevels,
    shifts: safeShifts,
    auditColumns,
    date: targetDate,
    shift: safeShifts[0] || '',
    department: '',
    sectionName: '',
    line: '',
    auditors: [''],
    auditor: ''
  };
}
