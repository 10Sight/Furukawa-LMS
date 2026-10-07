import template from './ccTemplate.json';

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
