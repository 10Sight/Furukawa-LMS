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

export function extractWorkbookMetadata(workbook, fallbackDate) {
  if (!workbook || !Array.isArray(workbook.sheets)) return workbook;

  let topDate = workbook.auditDate || '';
  let topShift = workbook.shift || '';
  let topDept = workbook.department || '';
  let topSec = workbook.sectionName || '';
  let topLn = workbook.line || '';
  let topAuditors = Array.isArray(workbook.auditors) ? workbook.auditors.filter(Boolean) : [];

  const updatedSheets = workbook.sheets.map(sheet => {
    if (!sheet || !Array.isArray(sheet.rows)) return sheet;

    let sDate = sheet.date || '';
    let sShift = sheet.shift || '';
    let sDept = sheet.department || '';
    let sSec = sheet.sectionName || '';
    let sLn = sheet.line || '';
    let sAuditors = Array.isArray(sheet.auditors) ? sheet.auditors.filter(Boolean) : [];

    // Scan top 6 rows of the sheet
    for (let r = 0; r < Math.min(sheet.rows.length, 6); r++) {
      const row = sheet.rows[r];
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        const text = String(cell?.value ?? cell?.formatted ?? '').trim();
        if (!text) continue;

        const tokens = text.split(/[|\n]+/).map(t => t.trim()).filter(Boolean);
        for (const token of tokens) {
          // 1. Date: e.g. "Date: 2026-02-01", "Date/Shift- 31.01.2022"
          if (!sDate) {
            const dateMatch = token.match(/(?:date(?:\/shift)?|audit\s*date)[:\s\/-]+([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})/i);
            if (dateMatch) {
              const raw = dateMatch[1];
              if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                sDate = raw;
              } else {
                const parts = raw.split(/[./-]/);
                if (parts.length === 3) {
                  let [p1, p2, p3] = parts;
                  if (p3.length === 2) p3 = '20' + p3;
                  if (p1.length === 4) sDate = `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
                  else sDate = `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
                }
              }
            }
          }

          // 2. Shift: e.g. "Shift: A", "Shift- B", avoiding "Date/Shift- 31.01..."
          if (!sShift) {
            const shiftMatch = token.match(/(?<!date\/)shift[:\s-]+([A-Za-z0-9]+)/i);
            if (shiftMatch && !/^(?:shift|date)$/i.test(shiftMatch[1]) && isNaN(Number(shiftMatch[1]))) {
              sShift = shiftMatch[1].toUpperCase();
            }
          }

          // 3. Department: e.g. "Dept: Assembly", "Department: Quality"
          if (!sDept) {
            const deptMatch = token.match(/^(?:dept|department)[:\s-]+(.*)$/i);
            if (deptMatch && deptMatch[1].trim() && !/^(?:dept|department)$/i.test(deptMatch[1].trim())) {
              sDept = deptMatch[1].trim();
            }
          }

          // 4. Section: e.g. "Sec: Line 1", "Section: Assembly Line"
          if (!sSec) {
            const secMatch = token.match(/^(?:sec|section)[:\s-]+(.*)$/i);
            if (secMatch && secMatch[1].trim() && !/^(?:sec|section)$/i.test(secMatch[1].trim())) {
              sSec = secMatch[1].trim();
            }
          }

          // 5. Line: e.g. "Line: Assembly Line 1", "Line Area: Line 2"
          if (!sLn) {
            const lnMatch = token.match(/^(?:line|line\s*area)[:\s-]+(.*)$/i);
            if (lnMatch && lnMatch[1].trim() && !/^(?:line|area)$/i.test(lnMatch[1].trim())) {
              sLn = lnMatch[1].trim();
            }
          }

          // 6. Auditor: e.g. "Auditor: Ramesh", "Auditor/Audtee- Ramesh", "Auditor/Audtee- Vikram Singh Line- Line 1"
          if (sAuditors.length === 0) {
            const audMatch = token.match(/^(?:auditor|auditer|auditee|auditor\/audtee)[:\s-]+(.*)$/i);
            if (audMatch && audMatch[1].trim() && !/^(?:auditor|audtee|line)$/i.test(audMatch[1].trim())) {
              let audStr = audMatch[1].trim();
              const lineInside = audStr.match(/^(.*?)(?:\s+(?:line|line\s*area)[:\s-]+(.*))$/i);
              if (lineInside) {
                audStr = lineInside[1].trim();
                if (!sLn && lineInside[2]) sLn = lineInside[2].trim();
              }
              if (audStr) sAuditors = [audStr];
            }
          }
        }
      }
    }

    if (sDate && !topDate) topDate = sDate;
    if (sShift && !topShift) topShift = sShift;
    if (sDept && !topDept) topDept = sDept;
    if (sSec && !topSec) topSec = sSec;
    if (sLn && !topLn) topLn = sLn;
    if (sAuditors.length > 0 && topAuditors.length === 0) topAuditors = sAuditors;

    return {
      ...sheet,
      date: sDate || topDate || fallbackDate,
      shift: sShift || topShift,
      department: sDept || topDept,
      sectionName: sSec || topSec,
      line: sLn || topLn,
      auditors: sAuditors.length > 0 ? sAuditors : (topAuditors.length > 0 ? topAuditors : [''])
    };
  });

  return {
    ...workbook,
    auditDate: topDate || fallbackDate,
    date: topDate || fallbackDate,
    shift: topShift,
    department: topDept,
    sectionName: topSec,
    line: topLn,
    auditors: topAuditors.length > 0 ? topAuditors : [''],
    sheets: updatedSheets
  };
}
