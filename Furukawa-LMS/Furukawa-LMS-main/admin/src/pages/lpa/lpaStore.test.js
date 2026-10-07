import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { parseWorkbook, saveWorkbook, loadWorkbook, ensureLinkedPDCA, editCell, storageKey, sourceObservations } from './lpaStore.js';
import { PDCA_STORAGE_KEY } from '../pdca/data/pdcaStore.js';

const entries = new Map();
globalThis.localStorage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
test('provided workbooks retain every worksheet, position, displayed cell and merge', () => {
  for (const file of ['C:/Users/adity/Downloads/Assy..xls', 'C:/Users/adity/Downloads/C&C.xlsx']) {
    const bytes = fs.readFileSync(file), source = XLSX.read(bytes, { type: 'array', cellNF: true, cellStyles: true });
    const imported = parseWorkbook(bytes, file);
    assert.deepEqual(imported.sheets.map(sheet => sheet.name), source.SheetNames);
    for (const sheet of imported.sheets) {
      const original = source.Sheets[sheet.name], range = XLSX.utils.decode_range(original['!ref']);
      assert.equal(sheet.rows.length, range.e.r - range.s.r + 1);
      assert.equal(sheet.columns.length, range.e.c - range.s.c + 1);
      assert.equal(sheet.merges.length, original['!merges'].length);
      for (let r = 0; r < sheet.rows.length; r++) for (let c = 0; c < sheet.columns.length; c++) {
        const cell = original[XLSX.utils.encode_cell({ r: r + sheet.startRow, c: c + sheet.startCol })];
        assert.equal(sheet.rows[r][c].text, cell?.w ?? String(cell?.v ?? ''));
        assert.equal(sheet.rows[r][c].value, cell?.v ?? '');
      }
    }
  }
});
test('section separation, edits, additions, updates and PDCA references survive reload', () => {
  entries.clear();
  const assembly = parseWorkbook(fs.readFileSync('C:/Users/adity/Downloads/Assy..xls'), 'Assy..xls');
  const cc = parseWorkbook(fs.readFileSync('C:/Users/adity/Downloads/C&C.xlsx'), 'C&C.xlsx');
  saveWorkbook('assembly', assembly); saveWorkbook('cc', cc);
  const aId = ensureLinkedPDCA('assembly', assembly.sheets[0].name), cId = ensureLinkedPDCA('cc', cc.sheets[0].name);
  assert.notEqual(aId, cId);
  const records = JSON.parse(entries.get(PDCA_STORAGE_KEY));
  assert.ok(records.find(item => item.id === cId).sheet.rows.length > 0);
  assert.ok(records.find(item => item.id === cId).sheet.rows.every(row => row.department === 'C&C'));
  assert.equal(sourceObservations(assembly.sheets[0], 'assembly').length, 0);
  records.find(item => item.id === aId).sheet.rows.push({ observation: 'Saved corrective action' });
  entries.set(PDCA_STORAGE_KEY, JSON.stringify(records));
  const updated = loadWorkbook('assembly');
  updated.sheets[0].rows[0][0] = editCell(updated.sheets[0].rows[0][0], 'New audit date');
  updated.sheets[0].rows.push(updated.sheets[0].columns.map(() => ({ text: '', value: '', type: 's' })));
  saveWorkbook('assembly', updated);
  ensureLinkedPDCA('assembly', updated.sheets[0].name);
  assert.equal(loadWorkbook('assembly').sheets[0].rows.length, 87);
  assert.equal(loadWorkbook('assembly').sheets[0].rows[0][0].text, 'New audit date');
  assert.equal(loadWorkbook('cc').sheets[0].rows[0][0].text, cc.sheets[0].rows[0][0].text);
  assert.equal(JSON.parse(entries.get(PDCA_STORAGE_KEY)).find(item => item.id === aId).sheet.rows[0].observation, 'Saved corrective action');
  assert.equal(JSON.parse(entries.get(PDCA_STORAGE_KEY)).find(item => item.id === cId).lpaSource.section, 'cc');
  assert.throws(() => parseWorkbook(new Uint8Array(), 'empty.xls'));
  assert.equal(loadWorkbook('assembly').sheets[0].rows.length, 87);
});
test('failed writes and malformed saved data preserve the previous version', () => {
  const previous = entries.get(storageKey('assembly'));
  const setter = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Storage is full'); };
  assert.throws(() => saveWorkbook('assembly', loadWorkbook('assembly')), /Storage is full/);
  assert.equal(entries.get(storageKey('assembly')), previous);
  localStorage.setItem = setter;
  entries.set(storageKey('assembly'), '{broken');
  assert.throws(() => saveWorkbook('assembly', JSON.parse(previous)));
  assert.equal(entries.get(storageKey('assembly')), '{broken');
});
