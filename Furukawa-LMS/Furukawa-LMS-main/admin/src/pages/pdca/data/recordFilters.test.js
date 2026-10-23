import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPDCARecords, matchesDateRange } from './recordFilters.js';
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

test('PDCA range filter includes both boundary dates and supports either endpoint', () => {
  assert.equal(matchesDateRange({ date: '23-10-2026' }, '2026-10-23', '2026-10-23'), true);
  assert.equal(matchesDateRange({ date: '24 Oct 2026' }, '2026-10-23', '2026-10-24'), true);
  assert.equal(matchesDateRange({ date: '2026-10-22' }, '2026-10-23', ''), false);
  assert.equal(matchesDateRange({ date: '23 Oct 2026' }, '', '2026-10-23'), true);
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

test('PDCA Unit selection persistence across session navigation and isolation', async () => {
  const { getStoredUnit, saveStoredUnit, clearStoredUnit, PDCA_PLANTS } = await import('./recordFilters.js');
  
  const sessionMap = new Map();
  globalThis.sessionStorage = {
    getItem: k => sessionMap.get(k) ?? null,
    setItem: (k, v) => sessionMap.set(k, String(v)),
    removeItem: k => sessionMap.delete(k),
    clear: () => sessionMap.clear()
  };

  // 1. Initial state (first visit): no unit stored -> defaults to 'Unit'
  assert.equal(getStoredUnit('user-1'), 'Bawal');

  // 2. User selects Bawal -> saved and restored
  saveStoredUnit('Bawal', 'user-1');
  assert.equal(getStoredUnit('user-1'), 'Bawal');

  // 3. User switches to Gujrat -> updated and restored
  saveStoredUnit('Gujrat', 'user-1');
  assert.equal(getStoredUnit('user-1'), 'Gujrat');

  // 4. Invalid unit input is rejected safely
  saveStoredUnit('InvalidPlant', 'user-1');
  assert.equal(getStoredUnit('user-1'), 'Bawal');

  // 5. Restoring with corrupted/non-matching JSON falls back safely
  sessionMap.set('pdca_selected_unit', '{"malformed');
  assert.equal(getStoredUnit('user-1'), 'Bawal');

  // 6. Multi-user isolation: user-2 must not inherit user-1's unit selection
  saveStoredUnit('Bawal', 'user-1');
  assert.equal(getStoredUnit('user-2'), 'Bawal');
  assert.equal(sessionMap.has('pdca_selected_unit'), false); // Cleared on mismatch

  // 7. Clear stored unit (e.g. on logout)
  saveStoredUnit('Bawal', 'user-1');
  assert.equal(getStoredUnit('user-1'), 'Bawal');
  clearStoredUnit();
  assert.equal(getStoredUnit('user-1'), 'Bawal');

  // 8. User selects 'All Unit' -> saved and restored
  saveStoredUnit('All Unit', 'user-1');
  assert.equal(getStoredUnit('user-1'), 'All Unit');
});

test('filterPDCARecords with All Unit returns all records across Bawal and Gujrat with one click', () => {
  const records = [
    { id: '1', plant: 'Bawal', scope: 'Company', topic: 'Bawal item 1' },
    { id: '2', plant: 'Gujrat', scope: 'Company', topic: 'Gujrat item 1' },
    { id: '3', plant: 'Bawal', scope: 'Company', topic: 'Bawal item 2' },
    { id: '4', plant: 'Gujrat', scope: 'Self PDCA', topic: 'Gujrat self item', isSelf: true }
  ];

  const companyAllUnits = filterPDCARecords(records, 'All Unit', 'Company');
  assert.equal(companyAllUnits.length, 3);
  assert.deepEqual(companyAllUnits.map(r => r.id), ['1', '2', '3']);

  const selfAllUnits = filterPDCARecords(records, 'All Unit', 'Self PDCA');
  assert.equal(selfAllUnits.length, 1);
  assert.equal(selfAllUnits[0].id, '4');
});

test('filterPDCARecords filters correctly with calendar date filter', () => {
  const records = [
    { id: '1', plant: 'Bawal', scope: 'Company', topic: 'Oct 15 item', date: '15 Oct 2026' },
    { id: '2', plant: 'Bawal', scope: 'Company', topic: 'Oct 16 item', date: '2026-10-16' },
    { id: '3', plant: 'Bawal', scope: 'Company', topic: 'ISO item', date: '2026-10-15T09:30:00Z' },
    { id: '4', plant: 'Bawal', scope: 'Company', topic: 'Another date', date: '10 Nov 2026' }
  ];

  // Filtering for 2026-10-15 should match record 1 and record 3
  const oct15Matches = filterPDCARecords(records, 'Bawal', 'Company', '', '', '2026-10-15');
  assert.equal(oct15Matches.length, 2);
  assert.deepEqual(oct15Matches.map(r => r.id), ['1', '3']);

  // Filtering for 2026-10-16 should match record 2
  const oct16Matches = filterPDCARecords(records, 'Bawal', 'Company', '', '', '2026-10-16');
  assert.equal(oct16Matches.length, 1);
  assert.equal(oct16Matches[0].id, '2');

  // Empty or cleared date filter should restore all records
  const allRecords = filterPDCARecords(records, 'Bawal', 'Company', '', '', '');
  assert.equal(allRecords.length, 4);
});


