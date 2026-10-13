import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPDCARecords } from './recordFilters.js';
import { commitSaved, readSaved } from '../../../components/shared/formPersistence.js';
for (const plant of ['Bawal', 'Gujrat']) {
  for (const scope of ['Company', 'Department', 'Self PDCA', 'CFT']) {
    test(`PDCA ${plant}/${scope} remains visible after create, reopen and update`, () => {
      const storage = new Map();
      globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) };
      const item = { id: `${plant}-${scope}`, plant, scope, topic: 'Saved form', sheet: { rows: [{ remarks: 'Entered data' }], headerInfo: { attendees: 'Team' } } };
      commitSaved('pdca_dashboard_items', [item]);
      let records = readSaved('pdca_dashboard_items', []);
      assert.deepEqual(filterPDCARecords(records, plant, scope), [item]);
      assert.equal(filterPDCARecords(records, plant === 'Bawal' ? 'Gujrat' : 'Bawal', scope).length, 0);
      const updated = { ...records[0], topic: 'Updated form' };
      commitSaved('pdca_dashboard_items', [updated]);
      records = readSaved('pdca_dashboard_items', []);
      assert.deepEqual(filterPDCARecords(records, plant, scope, 'updated'), [updated]);
      assert.deepEqual(records[0].sheet, item.sheet);
    });
  }
}
test('Previously saved All Plants forms can be reopened from either unit', () => {
  const old = { id: 'old', plant: 'All Plants', scope: 'Company', topic: 'Previously saved' };
  for (const plant of ['Bawal', 'Gujrat']) assert.deepEqual(filterPDCARecords([old], plant, 'Company'), [old]);
  assert.deepEqual(filterPDCARecords([old], 'Unit', 'Company'), []);
});

test('PDCA_DEPARTMENTS contains exactly the 13 required departments in exact order', async () => {
  const { PDCA_DEPARTMENTS } = await import('./pdcaConstants.js');
  const expected = [
    'PE',
    'IT',
    'Quality',
    'Assembly',
    'SRC',
    'Store',
    'HR',
    'Safety',
    'FG',
    'PPC',
    'Maintenance',
    'D&D',
    'C&C'
  ];
  assert.deepEqual(PDCA_DEPARTMENTS, expected);
  assert.equal(PDCA_DEPARTMENTS.length, 13);
});

test('filterPDCARecords filters correctly by department and matches department in search query', () => {
  const records = [
    { id: '1', plant: 'Bawal', scope: 'Company', department: 'PE', topic: 'Poka Yoke' },
    { id: '2', plant: 'Bawal', scope: 'Company', department: 'IT', topic: 'Server upgrade' },
    { id: '3', plant: 'Bawal', scope: 'Company', department: 'Quality', topic: 'Scrap reduction' },
    { id: '4', plant: 'Gujrat', scope: 'Company', department: 'PE', topic: 'Line fixture' }
  ];

  // Specific department filter
  const peBawal = filterPDCARecords(records, 'Bawal', 'Company', '', 'PE');
  assert.equal(peBawal.length, 1);
  assert.equal(peBawal[0].id, '1');

  // Case-insensitive department filter
  const itBawal = filterPDCARecords(records, 'Bawal', 'Company', '', 'it');
  assert.equal(itBawal.length, 1);
  assert.equal(itBawal[0].id, '2');

  // Empty department filter returns all for scope & plant
  const allBawal = filterPDCARecords(records, 'Bawal', 'Company', '', '');
  assert.equal(allBawal.length, 3);

  // Search by department name in free text search query
  const searchByDept = filterPDCARecords(records, 'Bawal', 'Company', 'Quality');
  assert.equal(searchByDept.length, 1);
  assert.equal(searchByDept[0].id, '3');
});

