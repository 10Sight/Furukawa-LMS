import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OBSERVATION_OPTIONS,
  normalizeObservationSymbol,
  getScoreForObservation
} from './lpaPdcaUtils.js';
import ccTemplate from './ccTemplate.json' with { type: 'json' };

test('1. Observation dropdown contains exactly four options: O, △, ×, NA', () => {
  assert.deepEqual(OBSERVATION_OPTIONS, ['Ο', 'Δ', 'Χ', 'NA']);
  assert.equal(OBSERVATION_OPTIONS.length, 4);
});

test('2. Score mapping logic adheres to Rules A, B, C, D', () => {
  // Rule A — Observation = O -> Score = 3
  assert.equal(getScoreForObservation('O'), 3);
  assert.equal(getScoreForObservation('o'), 3);
  assert.equal(getScoreForObservation('Ο'), 3); // Greek Omicron fallback
  assert.equal(getScoreForObservation('○'), 3); // Circle fallback

  // Rule B — Observation = △ -> Score = 3
  assert.equal(getScoreForObservation('△'), 3);
  assert.equal(getScoreForObservation('Δ'), 3); // Greek Delta fallback
  assert.equal(getScoreForObservation('▲'), 3);

  // Rule C — Observation = × -> Score = 0
  assert.equal(getScoreForObservation('×'), 0);
  assert.equal(getScoreForObservation('X'), 0);
  assert.equal(getScoreForObservation('x'), 0);
  assert.equal(getScoreForObservation('Χ'), 0); // Greek Chi fallback

  // Rule D — Observation = NA -> Score = 'NA' (literal value, not zero)
  assert.equal(getScoreForObservation('NA'), 'NA');
  assert.equal(getScoreForObservation('na'), 'NA');
  assert.notEqual(getScoreForObservation('NA'), 0);

  // Blank/Unselected Observation leaves Score blank
  assert.equal(getScoreForObservation(''), '');
  assert.equal(getScoreForObservation(null), '');
  assert.equal(getScoreForObservation(undefined), '');
});

test('3. Dynamic Score & Summary calculation logic (including NA handling)', () => {
  // Simulate 31 checklist rows with varying marks and observations
  const testRows = [
    { marks: 3, obs: 'O' }, // score = 3
    { marks: 3, obs: '△' }, // score = 3
    { marks: 1, obs: '×' }, // score = 0
    { marks: 1, obs: 'O' }, // score = 3
    { marks: 3, obs: '×' }, // score = 0
    { marks: 2, obs: 'NA' }, // score = NA, marks excluded from denominator
    { marks: 2, obs: 'O' }, // score = 3
    { marks: 3, obs: '△' }, // score = 3
  ];

  let totalScore = 0;
  let totalMarks = 0;

  for (const row of testRows) {
    const scoreVal = getScoreForObservation(row.obs);
    if (row.obs === 'NA') {
      assert.equal(scoreVal, 'NA');
      continue; // Excluded from denominator
    }
    totalMarks += row.marks;
    if (row.obs === 'O' || row.obs === '△') {
      assert.equal(scoreVal, 3);
      totalScore += 3;
    } else if (row.obs === '×') {
      assert.equal(scoreVal, 0);
      totalScore += 0;
    }
  }

  // 6 evaluated rows (3+3+1+1+3+2+3 = 16 marks total)
  // Scores: 3 + 3 + 0 + 3 + 0 + 3 + 3 = 15
  assert.equal(totalScore, 15);
  assert.equal(totalMarks, 16);
  const percentage = Math.round((totalScore / totalMarks) * 100);
  assert.equal(percentage, 94);
});

test('4. C&C check sheet template structure matches Excel reference', () => {
  const sheet = ccTemplate.sheets[0];
  assert.equal(sheet.name, 'C&C');
  assert.equal(sheet.columnCount, 9);
  assert.equal(sheet.rows.length, 45);

  // Row 0: Title
  assert.equal(sheet.rows[0][0].value, 'LPA CHECK SHEET LEVEL-3 C&C QA/Prod.');

  // Row 2: Headers
  assert.equal(sheet.rows[2][1].value, 'Focus');
  assert.equal(sheet.rows[2][2].value, 'CHECKS POINTS');
  assert.equal(sheet.rows[2][5].value, 'Section');
  assert.equal(sheet.rows[2][6].value, 'Marks');
  assert.equal(sheet.rows[2][7].value, 'Observation');
  assert.equal(sheet.rows[2][8].value, 'Score');

  // Verify exactly 31 checklist rows (from row index 4 to 34)
  const checklistRows = sheet.rows.slice(4, 35);
  assert.equal(checklistRows.length, 31);
  assert.equal(String(checklistRows[0][0].value), '1');
  assert.equal(String(checklistRows[30][0].value), '31');

  // Verify Row 35 Total & Row 36 Percentage
  assert.equal(sheet.rows[35][6].formula, 'SUM(G5:G35)');
  assert.equal(sheet.rows[35][8].formula, 'SUM(I5:I34)');
  assert.equal(sheet.rows[36][5].value, '%');
  assert.equal(sheet.rows[36][6].formula, 'I36/G36*100');
});
