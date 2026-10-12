export const LPA_SECTIONS = ['assembly', 'cc'];
export const LPA_UNITS = ['Bawal', 'Gujrat'];
export const LPA_LEVELS = ['L1', 'L2', 'L3'];
export function validateWorkbook(body) {
  if (!LPA_SECTIONS.includes(body?.section)) throw new Error('Select Assembly or C&C.');
  if (body?.unit != null && !LPA_UNITS.includes(body.unit)) throw new Error('Select Bawal or Gujrat.');
  if (body?.level != null && !LPA_LEVELS.includes(body.level)) throw new Error('Select L1, L2 or L3.');
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 255) throw new Error('A workbook name is required.');
  if (!Array.isArray(body.sheets) || !body.sheets.length || body.sheets.length > 100) throw new Error('The workbook must contain worksheets.');
  for (const sheet of body.sheets) {
    if (typeof sheet.name !== 'string' || !sheet.name || !Number.isInteger(sheet.columnCount) || sheet.columnCount < 1 || sheet.columnCount > 200 || !Array.isArray(sheet.rows) || sheet.rows.length > 10000 || sheet.rows.length * sheet.columnCount > 200000) throw new Error('Invalid worksheet dimensions (maximum 10,000 rows and 200 columns).');
    for (const row of sheet.rows) {
      if (!Array.isArray(row) || row.length > sheet.columnCount) throw new Error('Invalid worksheet row.');
      for (const cell of row) {
        if (cell !== null && (!cell || typeof cell !== 'object' || !['string', 'number', 'boolean', 'undefined'].includes(typeof cell.value) || (typeof cell.value === 'number' && !Number.isFinite(cell.value)))) throw new Error('Invalid cell value.');
      }
    }
    if (sheet.merges != null && (!Array.isArray(sheet.merges) || sheet.merges.length > 10000)) throw new Error('Invalid merged cells.');
    for (const merge of sheet.merges || []) {
      if (![merge.s?.r, merge.s?.c, merge.e?.r, merge.e?.c].every(Number.isInteger) || merge.s.r < 0 || merge.s.c < 0 || merge.e.r < merge.s.r || merge.e.c < merge.s.c || merge.e.r >= sheet.rows.length || merge.e.c >= sheet.columnCount) throw new Error('Merged cells fall outside the worksheet.');
    }
  }
  if (new TextEncoder().encode(JSON.stringify(body.sheets)).byteLength > 20 * 1024 * 1024) throw new Error('Workbook data exceeds 20 MB.');
  if (body?.auditDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(body.auditDate)) throw new Error('Select a valid audit date.');
  return { section: body.section, ...(body.unit ? { unit: body.unit } : {}), ...(body.level ? { level: body.level } : {}), ...(body.auditDate ? { auditDate: body.auditDate } : {}), ...(body.sampleData ? { sampleData: true } : {}), name: body.name.trim(), sheets: body.sheets };
}
