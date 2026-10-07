import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { importLPAWorkbook, editLPACell, getLPAPDCASource } from './lpaWorkbook.js';
import { validateWorkbook } from './lpaValidation.js';
import { nextLPARevision } from './lpaStore.js';

function example(format, section) {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([['Audit title'], ['Topic', 'Observation', 'Score'], ['Safety', '× Fix guard', 2], ['Quality', '', 0]]);
  sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  sheet.C3.f = '1+1';
  XLSX.utils.book_append_sheet(book, sheet, 'Audit');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Revision'], [true]]), 'Revision');
  return importLPAWorkbook(XLSX.write(book, { type: 'array', bookType: format }), `audit.${format}`, section);
}

test('a renamed text file is rejected instead of being imported as an Excel workbook', () => {
  assert.throws(() => importLPAWorkbook(new TextEncoder().encode('not an Excel workbook'), 'bad.xlsx', 'cc'), /not a valid Excel/);
});

for (const [format, section] of [['xlsx', 'cc'], ['xls', 'assembly']]) {
  test(`${format} imports all sheets, blanks, values, formulas and merges`, () => {
    const result = example(format, section);
    assert.equal(result.sheets.length, 2);
    assert.equal(result.sheets[0].rows[2][1].value, '× Fix guard');
    assert.equal(result.sheets[0].rows[3][2].value, 0);
    if (format === 'xlsx') assert.equal(result.sheets[0].rows[2][2].formula, '1+1');
    assert.equal(result.sheets[0].rows[2][2].value, 2);
    assert.equal(result.sheets[1].rows[1][0].value, true);
    assert.deepEqual(result.sheets[0].merges, [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]);
    assert.deepEqual(validateWorkbook(result), result);
  });
}

test('editing a number preserves its numeric value; editing a formula removes only that formula', () => {
  assert.equal(editLPACell({ type: 'n', value: 2, formula: '1+1' }, '4').value, 4);
  assert.equal(editLPACell({ type: 'n', value: 2, formula: '1+1' }, '4').formula, undefined);
  assert.equal(editLPACell(null, '0012').value, '0012');
});

test('PDCA source identifies category, workbook and sheet without mixing categories', () => {
  const workbook = { ...example('xlsx', 'cc'), id: 'cc-123' };
  const source = getLPAPDCASource(workbook);
  assert.equal(source.category, 'cc');
  assert.equal(source.workbookId, 'cc-123');
  assert.equal(source.worksheet, 'Audit');
  assert.deepEqual(source.observations, ['× Fix guard']);
});

test('validation rejects invalid categories, values, oversized sheets and out-of-bounds merges', () => {
  const workbook = example('xlsx', 'cc');
  assert.throws(() => validateWorkbook({ ...workbook, section: 'ptm' }));
  const invalid = structuredClone(workbook);
  invalid.sheets[0].rows[0][0].value = { injected: true };
  assert.throws(() => validateWorkbook(invalid));
  invalid.sheets[0].rows[0][0].value = 'okay';
  invalid.sheets[0].merges[0].e.r = 999;
  assert.throws(() => validateWorkbook(invalid));
  assert.throws(() => validateWorkbook({ ...workbook, sheets: [{ name: 'large', columnCount: 200, rows: Array.from({ length: 1001 }, () => []) }] }));
});

test('revisions retain edits, added rows and other worksheets; reject stale or foreign saves', () => {
  const body = example('xls', 'assembly');
  const saved = { ...body, id: 'book1', ownerId: 'user1', version: 1 };
  const edited = structuredClone(saved);
  edited.sheets[0].rows[2][1] = editLPACell(edited.sheets[0].rows[2][1], 'Corrected guard');
  edited.sheets[0].rows.push([editLPACell(null, 'New audit'), null, null]);
  const next = nextLPARevision('user1', saved, edited);
  assert.equal(next.version, 2);
  assert.equal(next.sheets[0].rows[2][1].value, 'Corrected guard');
  assert.equal(next.sheets[0].rows.at(-1)[0].value, 'New audit');
  assert.deepEqual(next.sheets[1], saved.sheets[1]);
  assert.throws(() => nextLPARevision('user1', next, edited), /another tab/);
  assert.throws(() => nextLPARevision('user2', saved, edited), /unavailable/);
  assert.throws(() => nextLPARevision('user1', saved, { ...edited, section: 'cc' }), /unavailable/);
});
