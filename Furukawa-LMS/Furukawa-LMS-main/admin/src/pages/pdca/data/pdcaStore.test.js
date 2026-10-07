import test from 'node:test';
import assert from 'node:assert/strict';
import { commitPDCA, loadPDCA, addPDCA, updatePDCA } from './pdcaStore.js';
import { filterPDCARecords } from './recordFilters.js';
test('All four categories create, persist, update and retain existing fields and records', () => {
  const storage = new Map();
  let fail = false;
  globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => { if (fail) throw new Error('Storage full'); storage.set(k,v); } };
  const existing = { id: 'existing', topic: 'Existing', plant: 'Bawal', scope: 'Company', sheet: { rows: [{ remarks: 'Keep' }] } };
  for (const scope of ['Company', 'Department', 'Self PDCA', 'CFT']) {
    const record = { id: scope, topic: scope, description: 'Details', date: '06 Oct 2026', time: '10:30 AM', createdBy: { name: 'Creator', code: 'E1' }, department: 'Quality', section: 'Assembly', sectionId: 'section-1', plant: 'Bawal', scope, assignedMembers: [{ name: 'Member', code: 'E2' }] };
    commitPDCA(records => addPDCA(records, record), [existing]);
    assert.deepEqual(filterPDCARecords(loadPDCA([]), 'Bawal', scope).find(item => item.id === scope), record);
    commitPDCA(records => updatePDCA(records, { id: scope, topic: 'Updated', scope }), []);
    const reopened = loadPDCA([]).find(item => item.id === scope);
    assert.deepEqual(reopened, { ...record, topic: 'Updated' });
    assert.deepEqual(loadPDCA([]).find(item => item.id === 'existing'), existing);
  }
  assert.equal(loadPDCA([]).length, 5);
  // A stale page uses the latest persisted collection rather than its old list.
  commitPDCA(records => addPDCA(records, { id: 'another-tab', topic: 'Other tab', plant: 'Gujrat', scope: 'Company' }), [existing]);
  assert.equal(loadPDCA([]).length, 6);
  const before = loadPDCA([]);
  fail = true;
  assert.throws(() => commitPDCA(records => updatePDCA(records, { id: 'Company', topic: 'Failed edit', scope: 'Company' }), []), /Storage full/);
  assert.deepEqual(loadPDCA([]), before);
  fail = false;
  assert.throws(() => commitPDCA(records => addPDCA(records, { id: 'Company', topic: 'Duplicate', plant: 'Bawal', scope: 'Company' }), []), /already exists/);
  assert.deepEqual(loadPDCA([]), before);
});
