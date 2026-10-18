import { getScoreForObservation } from '../../pages/lpa/lpaPdcaUtils.js';

export function isAssemblyCheckSheet(sheet) {
  if (!sheet || !Array.isArray(sheet.rows)) return false;

  // 1. 7-column structure (current required format or template)
  if (sheet.columnCount === 7) {
    const row1 = sheet.rows[1] || [];
    const colNames = row1.map(c => String(c?.value ?? c?.formatted ?? '').trim().toLowerCase());
    if (colNames.some(c => c.includes('checks points') || c.includes('check points')) ||
        (colNames.includes('sl no') && colNames.includes('area'))) {
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
 * Normalizes an Assembly worksheet to the required 7-column layout:
 * 1. Sl No.
 * 2. Focus
 * 3. CHECKS POINTS
 * 4. Area
 * 5. Marks
 * 6. Observation
 * 7. Score
 *
 * Preserves all Area values, row associations, and vertically merged cells.
 * Removes columns after Area (Requirement met, Requirement not met corrected/uncorrected, NA, PDCA points).
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

  const nextRows = sheet.rows.map((row, r) => {
    if (r === 40) {
      return [
        { value: 'Legends', formatted: 'Legends', type: 's' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' },
        { value: 'During audit', formatted: 'During audit', type: 's' },
        { value: '', formatted: '', type: 'z' },
        { value: 'Score Criteria', formatted: 'Score Criteria', type: 's' },
        { value: '', formatted: '', type: 'z' }
      ];
    }
    if (r === 41) {
      return Array.from({ length: 7 }, () => ({ value: '', formatted: '', type: 'z' }));
    }
    if (r === 42) {
      return [
        { value: 'Requirement met', formatted: 'Requirement met', type: 's' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' },
        { value: 'Ο', formatted: 'Ο', type: 's' },
        { value: 'Ο', formatted: 'Ο', type: 's' },
        { value: 'If requirment meet & corrected during the audit', formatted: 'If requirment meet & corrected during the audit', type: 's' },
        { value: '', formatted: '', type: 'z' }
      ];
    }
    if (r === 43) {
      return [
        { value: 'Requirement not met corrected during the audit', formatted: 'Requirement not met corrected during the audit', type: 's' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' },
        { value: 'Δ', formatted: 'Δ', type: 's' },
        { value: 'X', formatted: 'X', type: 's' },
        { value: 'If requirment not meet & system not adhere', formatted: 'If requirment not meet & system not adhere', type: 's' },
        { value: '', formatted: '', type: 'z' }
      ];
    }
    if (r === 44) {
      return [
        { value: 'Requirement not met not corrected during the audit', formatted: 'Requirement not met not corrected during the audit', type: 's' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' },
        { value: 'Χ', formatted: 'Χ', type: 's' },
        { value: 3, formatted: '3', type: 'n' },
        { value: 'Critical or direct impact on quality', formatted: 'Critical or direct impact on quality', type: 's' },
        { value: '', formatted: '', type: 'z' }
      ];
    }
    if (r === 45) {
      return [
        { value: 'Not Applicable', formatted: 'Not Applicable', type: 's' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' },
        { value: 'NA', formatted: 'NA', type: 's' },
        { value: 2, formatted: '2', type: 'n' },
        { value: 'No impact on product quality', formatted: 'No impact on product quality', type: 's' },
        { value: '', formatted: '', type: 'z' }
      ];
    }
    if (r === 46) {
      return [
        { value: 'Horizontal development', formatted: 'Horizontal development', type: 's', style: { patternType: 'solid', fgColor: { rgb: 'FFFFCC' } } },
        { value: '', formatted: '', type: 'z', style: { patternType: 'solid', fgColor: { rgb: 'FFFFCC' } } },
        { value: '', formatted: '', type: 'z', style: { patternType: 'solid', fgColor: { rgb: 'FFFFCC' } } },
        { value: '', formatted: '', type: 'z' },
        { value: 1, formatted: '1', type: 'n' },
        { value: 'Not impact on product but system requirment', formatted: 'Not impact on product but system requirment', type: 's' },
        { value: '', formatted: '', type: 'z' }
      ];
    }
    if (r === 47) {
      return [
        { value: 'FRM-WH-QA-246                                                                          Rev. No:-06                                      Issue Date:-31.01.22', formatted: 'FRM-WH-QA-246                                                                          Rev. No:-06                                      Issue Date:-31.01.22', type: 's' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' },
        { value: '', formatted: '', type: 'z' }
      ];
    }
    return row;
  });

  const existingMerges = (sheet.merges || []).filter(m => m.s.r < 40 || m.s.r > 47);
  return {
    ...sheet,
    rows: nextRows,
    merges: [...existingMerges, ...ASSEMBLY_LEGEND_MERGES]
  };
}

export function normalizeAssemblySheet(sheet) {
  if (!sheet || !Array.isArray(sheet.rows)) return sheet;

  // If already exactly 7 columns in the required order, format legend and return
  if (sheet.columnCount === 7) {
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

  const rows = sheet.rows;
  const headerRow = rows[1] || [];

  // Identify column indices in legacy sheet
  const areaColIdx = headerRow.findIndex(c => /^area$/i.test(String(c?.value ?? c?.formatted ?? '').trim()));
  const marksColIdx = headerRow.findIndex(c => /^marks$/i.test(String(c?.value ?? c?.formatted ?? '').trim()));
  const obsColIdx = headerRow.findIndex(c => /^observation$/i.test(String(c?.value ?? c?.formatted ?? '').trim()));
  const scoreColIdx = headerRow.findIndex(c => /^score$/i.test(String(c?.value ?? c?.formatted ?? '').trim()));

  // In legacy 14-col: Sl No=0, Focus=1, Checks=2, Marks=3, Obs=4, Score=5, Area=6
  const oldAreaCol = areaColIdx >= 0 ? areaColIdx : 6;
  const oldMarksCol = marksColIdx >= 0 ? marksColIdx : 3;
  const oldObsCol = obsColIdx >= 0 ? obsColIdx : 4;
  const oldScoreCol = scoreColIdx >= 0 ? scoreColIdx : 5;

  const newRows = rows.map((row, r) => {
    if (!Array.isArray(row)) return [];
    if (r === 0) {
      // Row 0: Date/Shift- (merged 0-1) | Title (merged 2-4) | Auditor (merged 5-6)
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
      // Header row
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
      // Legend rows: keep columns 0 to 6
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
    // Map to required order: [Sl No (0), Focus (1), Checks (2), Area (oldAreaCol), Marks (oldMarksCol), Obs (oldObsCol), Score (oldScoreCol)]
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

  // Re-map merges to 7 columns
  const newMerges = [];
  for (const m of sheet.merges || []) {
    // Drop merges in removed columns (columns 7+ in checklist rows)
    if (m.s.r >= 3 && m.s.r <= 36 && m.s.c >= 7) continue;

    // Remap Area merges (oldAreaCol -> 3)
    if (m.s.c === oldAreaCol && m.e.c === oldAreaCol) {
      newMerges.push({ s: { r: m.s.r, c: 3 }, e: { r: m.e.r, c: 3 } });
    } else if (m.s.c === 1 && m.e.c === 1) {
      // Focus merges stay at column 1
      newMerges.push({ s: { r: m.s.r, c: 1 }, e: { r: m.e.r, c: 1 } });
    } else if (m.s.r >= 40) {
      // Legend merges: keep if within 7 columns
      if (m.e.c < 7) {
        newMerges.push(m);
      }
    }
  }

  // Standard 7-column header & footer merges
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
 * Upgrades an Assembly workbook record, ensuring all sheets adhere to the 7-column structure.
 */
export function upgradeAssemblyRecord(record) {
  if (record?.section !== 'assembly' || !Array.isArray(record.sheets)) return record;

  const needsUpgrade = record.sheets.some(s => s.columnCount !== 7);
  if (!needsUpgrade) return record;

  return {
    ...record,
    sheets: record.sheets.map(sheet => (sheet.columnCount !== 7 ? normalizeAssemblySheet(sheet) : sheet))
  };
}
