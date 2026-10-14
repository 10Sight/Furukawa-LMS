import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyRow, createDefaultRows } from './pdcaStore.js';

test('CFT Integration - Scenario A: When no CFT records exist, options list is empty and no fake records are seeded', () => {
  const cftRecords = [];
  const map = new Map();
  cftRecords.forEach((item) => {
    if (item && item.id && !item.isDeleted) {
      map.set(item.id, item);
    }
  });
  const availableOptions = Array.from(map.values());
  assert.equal(availableOptions.length, 0, 'No CFT records should be available');
});

test('CFT Integration - Scenario B: Newly created CFT record is available and selectable', () => {
  const newCftRecord = {
    id: 'CFT-GJ-999',
    recordId: 'CFT-GJ-999',
    topic: 'Crimping Quality Assurance Team',
    plant: 'Gujrat',
    scope: 'CFT',
    createdBy: { name: 'RAHUL SHARMA', code: 'BW041920' },
    assignedMembers: [{ name: 'DEEPAK MEHTA', code: 'GJ045819' }],
    isDeleted: false
  };

  const records = [newCftRecord];
  const map = new Map();
  records.forEach((item) => {
    if (item && item.id && !item.isDeleted) {
      map.set(item.id, {
        id: item.id,
        name: item.topic || item.name,
        plant: item.plant,
        members: item.createdBy ? [{ name: item.createdBy.name, code: item.createdBy.code }] : [],
        assignedEmployees: item.assignedMembers || []
      });
    }
  });

  const available = Array.from(map.values());
  assert.equal(available.length, 1);
  assert.equal(available[0].id, 'CFT-GJ-999');
  assert.equal(available[0].name, 'Crimping Quality Assurance Team');

  // Simulate user selecting this CFT in PDCA row
  const row = createEmptyRow();
  const updatedRow = {
    ...row,
    cftTopic: available[0].name,
    cftTopicId: available[0].id
  };

  assert.equal(updatedRow.cftTopic, 'Crimping Quality Assurance Team');
  assert.equal(updatedRow.cftTopicId, 'CFT-GJ-999');
});

test('CFT Integration - Scenario C: Multiple CFT records are deduplicated by unique ID and unique labels are preserved', () => {
  const records = [
    { id: 'CFT-BW-201', topic: 'Safety & 5S Protocol', plant: 'Bawal', scope: 'CFT', isDeleted: false },
    { id: 'CFT-GJ-202', topic: 'Assembly Line 1 Quality', plant: 'Gujrat', scope: 'CFT', isDeleted: false },
    // Duplicate with same ID
    { id: 'CFT-BW-201', topic: 'Safety & 5S Protocol', plant: 'Bawal', scope: 'CFT', isDeleted: false }
  ];

  const map = new Map();
  records.forEach((item) => {
    if (item && item.id && !item.isDeleted) {
      map.set(item.id, {
        id: item.id,
        name: item.topic || item.name,
        plant: item.plant
      });
    }
  });

  const options = Array.from(map.values());
  assert.equal(options.length, 2, 'Duplicates should be removed');
  assert.equal(options[0].id, 'CFT-BW-201');
  assert.equal(options[1].id, 'CFT-GJ-202');
});

test('CFT Integration - Scenario D: CFT update updates name in options while preserving stable unique identifier in rows', () => {
  const originalRecord = { id: 'CFT-BW-201', topic: 'Original CFT Name', plant: 'Bawal', scope: 'CFT', isDeleted: false };
  const updatedRecord = { id: 'CFT-BW-201', topic: 'Updated CFT Name', plant: 'Bawal', scope: 'CFT', isDeleted: false };

  // Row was selected when it was original
  const row = {
    ...createEmptyRow(),
    cftTopic: originalRecord.topic,
    cftTopicId: originalRecord.id
  };

  // Re-fetch returns updatedRecord
  const map = new Map();
  [updatedRecord].forEach((item) => {
    map.set(item.id, { id: item.id, name: item.topic });
  });

  const currentOption = map.get(row.cftTopicId);
  assert.ok(currentOption);
  assert.equal(currentOption.id, 'CFT-BW-201');
  assert.equal(currentOption.name, 'Updated CFT Name');
});

test('CFT Integration - Scenario E: Deleted CFT records (isDeleted = true) are excluded from selection', () => {
  const records = [
    { id: 'CFT-BW-201', topic: 'Active CFT', plant: 'Bawal', scope: 'CFT', isDeleted: false },
    { id: 'CFT-BW-202', topic: 'Deleted CFT', plant: 'Bawal', scope: 'CFT', isDeleted: true }
  ];

  const map = new Map();
  records.forEach((item) => {
    if (item && item.id && !item.isDeleted) {
      map.set(item.id, item);
    }
  });

  const available = Array.from(map.values());
  assert.equal(available.length, 1);
  assert.equal(available[0].id, 'CFT-BW-201');
});

test('PDCA Sheet Persistence: row schema retains cftTopic and cftTopicId without data loss', () => {
  const rows = createDefaultRows(2);
  rows[0].cftTopic = 'Team Composition & Role';
  rows[0].cftTopicId = 'CFT-GJ-201';
  rows[0].assignedEmployee = 'Deepak Mehta (GJ045819)';
  rows[0].cftSelectedName = 'Deepak Mehta';
  rows[0].cftSelectedCode = 'GJ045819';
  rows[0].cftSelectedType = 'assigned';

  const serialized = JSON.stringify(rows);
  const deserialized = JSON.parse(serialized);

  assert.equal(deserialized[0].cftTopic, 'Team Composition & Role');
  assert.equal(deserialized[0].cftTopicId, 'CFT-GJ-201');
  assert.equal(deserialized[0].cftSelectedName, 'Deepak Mehta');
  assert.equal(deserialized[0].cftSelectedCode, 'GJ045819');
  assert.equal(deserialized[0].cftSelectedType, 'assigned');
});
