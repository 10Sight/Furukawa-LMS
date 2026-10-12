import * as XLSX from 'xlsx';

export function importLPAWorkbook(buffer, name, section) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((value, index) => bytes[index] === value);
  const biff = bytes[0] === 0x09 && [0x00, 0x02, 0x04, 0x08].includes(bytes[1]);
  const xml = /<Workbook[\s>]/i.test(new TextDecoder().decode(bytes.slice(0, 2048)));
  if (!zip && !ole && !biff && !xml) throw new Error('This file is not a valid Excel workbook. Please select an .xlsx or .xls file.');
  const book = XLSX.read(buffer, { type: 'array', cellDates: false, cellStyles: true });
  const sheets = book.SheetNames.filter(title => book.Sheets[title]['!ref']).map(title => {
    const source = book.Sheets[title];
    const range = XLSX.utils.decode_range(source['!ref']);
    const columnCount = range.e.c + 1;
    const rowCount = range.e.r + 1;
    if (columnCount > 200 || rowCount > 10000 || columnCount * rowCount > 200000) throw new Error('This worksheet is too large (maximum 10,000 rows, 200 columns and 200,000 cells).');
    const rows = Array.from({ length: rowCount }, (_, r) => Array.from({ length: columnCount }, (_, c) => {
      const cell = source[XLSX.utils.encode_cell({ r, c })];
      if (!cell) return null;
      return { value: cell.v ?? '', formatted: cell.w ?? String(cell.v ?? ''), type: cell.t || 's', ...(cell.f ? { formula: cell.f } : {}), ...(cell.s ? { style: cell.s } : {}) };
    }));
    return { name: title, columnCount, rows, merges: source['!merges'] || [], columns: source['!cols'] || [], rowSizes: source['!rows'] || [] };
  });
  if (!sheets.length) throw new Error('The Excel file contains no readable worksheet data.');
  return { section, name, sheets };
}

export function editLPACell(cell, text) {
  const str = String(text ?? '');
  if (cell?.type === 'n' && str.trim() !== '' && Number.isFinite(Number(str))) {
    return { value: Number(str), formatted: str, type: 'n', ...(cell?.style ? { style: cell.style } : {}) };
  }
  // Changing a calculated cell replaces its formula explicitly; untouched formulas remain intact.
  return { value: str, formatted: str, type: 's', ...(cell?.style ? { style: cell.style } : {}) };
}
export function getLPAPDCASource(workbook, sheetIndex = 0) {
  const sheet = workbook?.sheets?.[sheetIndex];
  const rows = sheet?.rows || [];
  let observationColumn = -1;
  let observationStart = 0;
  for (const pattern of [/pdca.*point|other observations/i, /^observation$/i]) {
    for (const [rowIndex, row] of rows.slice(0, 8).entries()) {
      const index = row.findIndex(cell => pattern.test(cell?.formatted || String(cell?.value || '')));
      if (index >= 0) { observationColumn = index; observationStart = rowIndex + 1; break; }
    }
    if (observationColumn >= 0) break;
  }
  const observations = observationColumn < 0 ? [] : rows.slice(observationStart).map(row => row[observationColumn]?.formatted || '').filter(Boolean).slice(0, 20);
  return { category: workbook.section, workbookId: workbook.id, workbookName: workbook.name, worksheet: sheet?.name || '', observations };
}
export const columnName = index => XLSX.utils.encode_col(index);
