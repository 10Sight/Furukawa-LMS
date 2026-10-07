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
