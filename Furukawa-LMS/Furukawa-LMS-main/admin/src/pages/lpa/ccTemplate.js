import template from './ccTemplate.json' with { type: 'json' };

export const ccTemplate = template;

export function isCcCheckSheet(sheet) {
  return sheet?.columnCount === 9 && sheet.rows?.length >= 45 &&
    sheet.merges?.some(merge => merge.s.r === 0 && merge.s.c === 0 && merge.e.c === 8);
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

export function createBlankCcSheet(baseSheet, date) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const sheet = structuredClone(baseSheet || ccTemplate.sheets[0]);
  const newRows = sheet.rows.map((row, rIdx) => {
    if (!Array.isArray(row)) return row;
    const nextRow = [...row];
    // Rows 4 to 34 are checklist rows (Observation col 7, Score col 8)
    if (rIdx >= 4 && rIdx <= 34) {
      if (nextRow[7]) nextRow[7] = { ...nextRow[7], value: '', formatted: '', type: 'z' };
      if (nextRow[8]) nextRow[8] = { ...nextRow[8], value: '', formatted: '', type: 'z', formula: undefined };
    }
    // Row 35: Total Marks (col 6) & Total Score (col 8)
    if (rIdx === 35) {
      if (nextRow[8]) nextRow[8] = { ...nextRow[8], value: 0, formatted: '0', type: 'n' };
    }
    // Row 36: Percentage (%)
    if (rIdx === 36) {
      if (nextRow[6]) nextRow[6] = { ...nextRow[6], value: 0, formatted: '0.00%', type: 's' };
    }
    // Row 1: Date & Auditor/Line header
    if (rIdx === 1) {
      if (nextRow[0]) nextRow[0] = { ...nextRow[0], value: `Date :-${targetDate}`, formatted: `Date :-${targetDate}`, type: 's' };
      if (nextRow[5]) nextRow[5] = { ...nextRow[5], value: 'Auditor/Audtee-                                                                                                                         Line-', formatted: 'Auditor/Audtee-                                                                                                                         Line-', type: 's' };
    }
    // Row 44: Signatures & Date
    if (rIdx === 44) {
      if (nextRow[2]) nextRow[2] = { ...nextRow[2], value: '', formatted: '', type: 'z' };
      if (nextRow[6]) nextRow[6] = { ...nextRow[6], value: targetDate, formatted: targetDate, type: 's' };
    }
    return nextRow;
  });

  return {
    ...sheet,
    rows: newRows,
    date: targetDate,
    shift: '',
    department: 'C&C',
    sectionName: '',
    line: '',
    auditors: [''],
    auditor: ''
  };
}
