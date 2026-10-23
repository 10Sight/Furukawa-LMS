import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OBSERVATION_OPTIONS,
  normalizeObservationSymbol,
  getScoreForObservation,
  getLpaPdcaTopic,
  createEmptyPdcaRow,
  saveLpaPdcaSnapshot
} from './lpaPdcaUtils.js';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

test('OBSERVATION_OPTIONS includes Ο, Δ, Χ, and NA', () => {
  assert.deepEqual(OBSERVATION_OPTIONS, ['Ο', 'Δ', 'Χ', 'NA']);
});

test('normalizeObservationSymbol normalizes variations of circle, delta, cross and NA', () => {
  assert.equal(normalizeObservationSymbol('Ο'), 'Ο');
  assert.equal(normalizeObservationSymbol('O'), 'Ο');
  assert.equal(normalizeObservationSymbol('o'), 'Ο');

  assert.equal(normalizeObservationSymbol('Δ'), 'Δ');
  assert.equal(normalizeObservationSymbol('△'), 'Δ');

  assert.equal(normalizeObservationSymbol('Χ'), 'Χ');
  assert.equal(normalizeObservationSymbol('×'), 'Χ');
  assert.equal(normalizeObservationSymbol('X'), 'Χ');

  assert.equal(normalizeObservationSymbol('NA'), 'NA');
  assert.equal(normalizeObservationSymbol('na'), 'NA');

  assert.equal(normalizeObservationSymbol(''), '');
  assert.equal(normalizeObservationSymbol(null), '');
});

test('getScoreForObservation returns specified fixed scores based on marks', () => {
  // Default marks = 3
  assert.equal(getScoreForObservation('Ο'), 3);
  assert.equal(getScoreForObservation('O'), 3);

  // △ is marks - 1 (decreased value)
  assert.equal(getScoreForObservation('Δ'), 2);
  assert.equal(getScoreForObservation('△'), 2);

  assert.equal(getScoreForObservation('Χ'), 0);
  assert.equal(getScoreForObservation('×'), 0);
  assert.equal(getScoreForObservation('X'), 0);

  assert.equal(getScoreForObservation('NA'), 'NA');
  assert.equal(getScoreForObservation('na'), 'NA');

  assert.equal(getScoreForObservation(''), '');

  // With explicit marks column value
  assert.equal(getScoreForObservation('O', 5), 5);
  assert.equal(getScoreForObservation('△', 5), 4);
  assert.equal(getScoreForObservation('△', 1), 0);
  assert.equal(getScoreForObservation('×', 5), 0);
  assert.equal(getScoreForObservation('NA', 5), 'NA');
});

test('getLpaPdcaTopic returns topic with at least 10 rows for Assembly, C&C and All', () => {
  const assemblyTopic = getLpaPdcaTopic({ section: 'assembly', unit: 'Bawal', level: 'L1', date: '2026-10-09' });
  assert.equal(assemblyTopic.topic, 'Assembly - LPA Observation (PDCA)');
  assert.equal(assemblyTopic.sheet.headerInfo.topicName, 'Assembly - LPA Observation (PDCA)');
  assert.ok(assemblyTopic.sheet.rows.length >= 10);
  assert.ok(assemblyTopic.sheet.rows[0].shift);
  assert.ok(assemblyTopic.sheet.rows.every(row => row.date === '' && row.status === ''));

  const ccTopic = getLpaPdcaTopic({ section: 'cc', unit: 'Bawal', level: 'L1', date: '2026-10-09' });
  assert.equal(ccTopic.topic, 'C&C - LPA Observation (PDCA)');
  assert.equal(ccTopic.sheet.headerInfo.topicName, 'C&C - LPA Observation (PDCA)');
  assert.ok(ccTopic.sheet.rows.length >= 10);

  const allTopic = getLpaPdcaTopic({ section: 'all', unit: 'Bawal', level: 'L1', date: '2026-10-09' });
  assert.ok(allTopic.sheet.rows.length >= 10);
});

test('new LPA PDCA rows leave Date and Status blank by default', () => {
  const row = createEmptyPdcaRow();
  assert.equal(row.date, '');
  assert.equal(row.status, '');
});

test('Single LPA PDCA sheet: dedicated single sheet ID for Assembly and single for C&C', () => {
  const assemblyTopic = getLpaPdcaTopic({ section: 'assembly', unit: 'Bawal', level: 'L1', date: '2026-10-18' });
  assert.equal(assemblyTopic.id, 'PDCA-LPA-ASSEMBLY-Bawal');
  assert.equal(assemblyTopic.section, 'assembly');

  const ccTopic = getLpaPdcaTopic({ section: 'cc', unit: 'Bawal', level: 'L1', date: '2026-10-18' });
  assert.equal(ccTopic.id, 'PDCA-LPA-CC-Bawal');
  assert.equal(ccTopic.section, 'cc');

  // Verify different dates point to the same single PDCA sheet
  const assemblyTomorrow = getLpaPdcaTopic({ section: 'assembly', unit: 'Bawal', level: 'L1', date: '2026-10-19' });
  assert.equal(assemblyTomorrow.id, 'PDCA-LPA-ASSEMBLY-Bawal');
});

test('Adding data by adding rows into the single PDCA sheet and saving snapshot', () => {
  const initialTopic = getLpaPdcaTopic({ section: 'assembly', unit: 'Bawal' });
  const rowCountBefore = initialTopic.sheet.rows.length;

  // Add new observation row
  const newRow = createEmptyPdcaRow({
    date: '2026-10-18',
    shift: 'A',
    status: 'Open',
    department: 'Assembly',
    lineArea: 'Door Assembly Line 1',
    observation: 'Torque wrench calibration tag expired'
  });

  const updatedRows = [...initialTopic.sheet.rows, newRow];
  assert.equal(updatedRows.length, rowCountBefore + 1);
  assert.equal(updatedRows[updatedRows.length - 1].observation, 'Torque wrench calibration tag expired');

  // Save snapshot to single storage
  saveLpaPdcaSnapshot(initialTopic.id, { rows: updatedRows });
  const loadedTopic = getLpaPdcaTopic({ section: 'assembly', unit: 'Bawal' });
  assert.equal(loadedTopic.sheet.rows.length, rowCountBefore + 1);
  assert.equal(loadedTopic.sheet.rows[loadedTopic.sheet.rows.length - 1].observation, 'Torque wrench calibration tag expired');
});
