import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OBSERVATION_OPTIONS,
  normalizeObservationSymbol,
  getScoreForObservation,
  getLpaPdcaTopic
} from './lpaPdcaUtils.js';

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

test('getScoreForObservation returns specified fixed scores', () => {
  assert.equal(getScoreForObservation('Ο'), 3);
  assert.equal(getScoreForObservation('O'), 3);

  assert.equal(getScoreForObservation('Δ'), 3);
  assert.equal(getScoreForObservation('△'), 3);

  assert.equal(getScoreForObservation('Χ'), 0);
  assert.equal(getScoreForObservation('×'), 0);
  assert.equal(getScoreForObservation('X'), 0);

  assert.equal(getScoreForObservation('NA'), 'NA');
  assert.equal(getScoreForObservation('na'), 'NA');

  assert.equal(getScoreForObservation(''), '');
});

test('getLpaPdcaTopic returns topic with at least 10 rows for Assembly, C&C and All', () => {
  const assemblyTopic = getLpaPdcaTopic({ section: 'assembly', unit: 'Bawal', level: 'L1', date: '2026-10-09' });
  assert.equal(assemblyTopic.topic, 'PDCA - M Tanaka San Audit');
  assert.ok(assemblyTopic.sheet.rows.length >= 10);
  assert.equal(assemblyTopic.sheet.rows[0].shift, 'G');

  const ccTopic = getLpaPdcaTopic({ section: 'cc', unit: 'Bawal', level: 'L1', date: '2026-10-09' });
  assert.ok(ccTopic.sheet.rows.length >= 10);

  const allTopic = getLpaPdcaTopic({ section: 'all', unit: 'Bawal', level: 'L1', date: '2026-10-09' });
  assert.ok(allTopic.sheet.rows.length >= 10);
});
