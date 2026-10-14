import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPDCARecords } from './recordFilters.js';
import { commitPDCA, loadPDCA, addPDCA, updatePDCA, createDefaultRows } from './pdcaStore.js';

test('Multiple PDCA records with different departments remain visible together on Plant tab without deleting previous records', () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: k => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k)
  };

  // 1. Create PDCA A with Department "D&D"
  const pdcaA = {
    id: 'PDCA-REC-A',
    topic: 'Testing Topic A',
    description: 'Description A',
    plant: 'Bawal',
    scope: 'Company',
    department: 'D&D',
    section: 'Assembly Area',
    date: '14 Oct 2026',
    time: '02:25 PM',
    createdBy: { name: 'Joy Dastidar', code: 'ST080014' },
    isSelf: false,
    sheet: {
      headerInfo: { topicName: 'Testing Topic A', preparedBy: 'Joy Dastidar' },
      rows: createDefaultRows(10)
    }
  };
  commitPDCA(records => addPDCA(records, pdcaA), []);
  let stored = loadPDCA([]);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, 'PDCA-REC-A');

  // 2. Create PDCA B with Department "C&C"
  const pdcaB = {
    id: 'PDCA-REC-B',
    topic: 'Testing Topic B',
    description: 'Description B',
    plant: 'Bawal',
    scope: 'Company',
    department: 'C&C',
    section: 'Assembly Area',
    date: '14 Oct 2026',
    time: '02:26 PM',
    createdBy: { name: 'Joy Dastidar', code: 'ST080014' },
    isSelf: false,
    sheet: {
      headerInfo: { topicName: 'Testing Topic B', preparedBy: 'Joy Dastidar' },
      rows: createDefaultRows(10)
    }
  };
  commitPDCA(records => addPDCA(records, pdcaB), []);
  stored = loadPDCA([]);
  assert.equal(stored.length, 2);

  // Both A and B must be present in storage
  assert.ok(stored.some(r => r.id === 'PDCA-REC-A'));
  assert.ok(stored.some(r => r.id === 'PDCA-REC-B'));

  // On Plant tab (deptFilter = ''), both A and B must be visible
  const visibleTwo = filterPDCARecords(stored, 'Bawal', 'Company', '', '');
  assert.equal(visibleTwo.length, 2);

  // 3. Create PDCA C with Department "Assembly"
  const pdcaC = {
    id: 'PDCA-REC-C',
    topic: 'Testing Topic C',
    description: 'Description C',
    plant: 'Bawal',
    scope: 'Company',
    department: 'Assembly',
    section: 'Assembly Area',
    date: '14 Oct 2026',
    time: '02:27 PM',
    createdBy: { name: 'Joy Dastidar', code: 'ST080014' },
    isSelf: false,
    sheet: {
      headerInfo: { topicName: 'Testing Topic C', preparedBy: 'Joy Dastidar' },
      rows: createDefaultRows(10)
    }
  };
  commitPDCA(records => addPDCA(records, pdcaC), []);
  stored = loadPDCA([]);
  assert.equal(stored.length, 3);

  // All three records remain in storage and visible on Plant tab
  const visibleThree = filterPDCARecords(stored, 'Bawal', 'Company', '', '');
  assert.equal(visibleThree.length, 3);
  const ids = visibleThree.map(r => r.id);
  assert.ok(ids.includes('PDCA-REC-A'));
  assert.ok(ids.includes('PDCA-REC-B'));
  assert.ok(ids.includes('PDCA-REC-C'));

  // 4. Simulate page refresh (re-reading from storage)
  const afterRefresh = loadPDCA([]);
  assert.equal(afterRefresh.length, 3);
  const visibleAfterRefresh = filterPDCARecords(afterRefresh, 'Bawal', 'Company', '', '');
  assert.equal(visibleAfterRefresh.length, 3);

  // 5. Update Record B and verify Record A and Record C remain unchanged
  const updatedB = {
    ...pdcaB,
    topic: 'Testing Topic B - Updated Countermeasures'
  };
  commitPDCA(records => updatePDCA(records, updatedB), []);
  const afterUpdate = loadPDCA([]);
  assert.equal(afterUpdate.length, 3);

  const foundA = afterUpdate.find(r => r.id === 'PDCA-REC-A');
  const foundB = afterUpdate.find(r => r.id === 'PDCA-REC-B');
  const foundC = afterUpdate.find(r => r.id === 'PDCA-REC-C');

  assert.equal(foundA.topic, 'Testing Topic A');
  assert.equal(foundB.topic, 'Testing Topic B - Updated Countermeasures');
  assert.equal(foundC.topic, 'Testing Topic C');

  // Verify that all 3 records continue to be visible together
  const visibleFinal = filterPDCARecords(afterUpdate, 'Bawal', 'Company', '', '');
  assert.equal(visibleFinal.length, 3);
});
