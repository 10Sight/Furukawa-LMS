import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OBSERVATION_OPTIONS,
  normalizeObservationSymbol,
  getScoreForObservation
} from './lpaPdcaUtils.js';
import { createBlankCcSheet } from './ccTemplate.js';
import ccTemplate from './ccTemplate.json' with { type: 'json' };

test('1. Observation dropdown contains exactly four options: O, △, ×, NA', () => {
  assert.deepEqual(OBSERVATION_OPTIONS, ['Ο', 'Δ', 'Χ', 'NA']);
  assert.equal(OBSERVATION_OPTIONS.length, 4);
});

test('2. Score mapping logic adheres to Rules: O=Marks, △=Marks-1, ×=0, NA=NA', () => {
  // Rule: Observation = O -> same value of Marks column
  assert.equal(getScoreForObservation('O', 3), 3);
  assert.equal(getScoreForObservation('o', 3), 3);
  assert.equal(getScoreForObservation('Ο', 3), 3); // Greek Omicron fallback
  assert.equal(getScoreForObservation('○', 3), 3); // Circle fallback
  assert.equal(getScoreForObservation('O', 5), 5); // Marks = 5

  // Rule: Observation = △ -> minus 1 from Marks column (decreased value)
  assert.equal(getScoreForObservation('△', 3), 2);
  assert.equal(getScoreForObservation('Δ', 3), 2); // Greek Delta fallback
  assert.equal(getScoreForObservation('▲', 3), 2);
  assert.equal(getScoreForObservation('△', 5), 4);
  assert.equal(getScoreForObservation('△', 1), 0);
  assert.equal(getScoreForObservation('△', 0), 0);

  // Rule: Observation = × -> 0
  assert.equal(getScoreForObservation('×', 3), 0);
  assert.equal(getScoreForObservation('X', 3), 0);
  assert.equal(getScoreForObservation('x', 3), 0);
  assert.equal(getScoreForObservation('Χ', 3), 0); // Greek Chi fallback

  // Rule: Observation = NA -> 'NA'
  assert.equal(getScoreForObservation('NA', 3), 'NA');
  assert.equal(getScoreForObservation('na', 3), 'NA');
  assert.notEqual(getScoreForObservation('NA', 3), 0);

  // Blank/Unselected Observation leaves Score blank
  assert.equal(getScoreForObservation('', 3), '');
  assert.equal(getScoreForObservation(null, 3), '');
  assert.equal(getScoreForObservation(undefined, 3), '');
});

test('3. Dynamic Score & Summary calculation logic (including NA handling)', () => {
  // Simulate checklist rows with varying marks and observations
  const testRows = [
    { marks: 3, obs: 'O' },  // score = 3
    { marks: 3, obs: '△' },  // score = 3 - 1 = 2
    { marks: 1, obs: '×' },  // score = 0
    { marks: 1, obs: 'O' },  // score = 1
    { marks: 3, obs: '×' },  // score = 0
    { marks: 2, obs: 'NA' }, // score = NA, marks excluded from denominator
    { marks: 2, obs: 'O' },  // score = 2
    { marks: 3, obs: '△' },  // score = 3 - 1 = 2
  ];

  let totalScore = 0;
  let totalMarks = 0;

  for (const row of testRows) {
    const scoreVal = getScoreForObservation(row.obs, row.marks);
    if (row.obs === 'NA') {
      assert.equal(scoreVal, 'NA');
      continue; // Excluded from denominator
    }
    totalMarks += row.marks;
    if (row.obs === 'O') {
      assert.equal(scoreVal, row.marks);
      totalScore += row.marks;
    } else if (row.obs === '△') {
      assert.equal(scoreVal, row.marks - 1);
      totalScore += (row.marks - 1);
    } else if (row.obs === '×') {
      assert.equal(scoreVal, 0);
      totalScore += 0;
    }
  }

  // 7 evaluated rows (excluding NA):
  // totalMarks = 3 + 3 + 1 + 1 + 3 + 2 + 3 = 16
  // totalScore = 3 + 2 + 0 + 1 + 0 + 2 + 2 = 10
  assert.equal(totalScore, 10);
  assert.equal(totalMarks, 16);
  const percentage = Math.round((totalScore / totalMarks) * 100);
  assert.equal(percentage, 63);
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

test('5. createBlankCcSheet produces completely blank values for New LPA check sheet', () => {
  const blankSheet = createBlankCcSheet();
  assert.equal(blankSheet.name, 'C&C');
  assert.equal(blankSheet.shift, '');
  assert.equal(blankSheet.sectionName, '');
  assert.equal(blankSheet.line, '');
  assert.deepEqual(blankSheet.auditors, ['']);

  // All 31 checklist rows (from index 4 to 34) must have blank observation and blank score
  for (let r = 4; r <= 34; r++) {
    const obsCell = blankSheet.rows[r][7];
    const scoreCell = blankSheet.rows[r][8];
    assert.equal(obsCell.value, '', `Row ${r} observation must be blank`);
    assert.equal(obsCell.formatted, '', `Row ${r} observation formatted must be blank`);
    assert.equal(scoreCell.value, '', `Row ${r} score must be blank`);
    assert.equal(scoreCell.formatted, '', `Row ${r} score formatted must be blank`);
  }

  // Row 35 Total Score should be 0
  assert.equal(blankSheet.rows[35][8].value, 0);
  // Row 36 Percentage should be '0.00%'
  assert.equal(blankSheet.rows[36][6].formatted, '0.00%');
});

test('6. createBlankCcSheet dynamically expands legend merges to lastCol without stray empty cells', () => {
  // Test with multi-level C&C sheet (e.g. L2 sheet has 13 columns: 0 to 12)
  const l2CcSheet = createBlankCcSheet(null, '2026-10-20', ['L2'], ['A'], null, 'L2');
  const lastCol = l2CcSheet.columnCount - 1;
  assert.equal(l2CcSheet.columnCount, 13);
  assert.equal(lastCol, 12);

  // Row 37-38 Score Criteria merge must extend from column 4 to lastCol (12)
  const scoreCriteriaMerge = l2CcSheet.merges.find(m => m.s.r === 37 && m.s.c === 4);
  assert.ok(scoreCriteriaMerge, 'Score Criteria merge must exist at row 37, col 4');
  assert.equal(scoreCriteriaMerge.e.c, lastCol);
  assert.equal(scoreCriteriaMerge.e.r, 38);

  // Row 39 Description merge must extend from col 5 to lastCol (12)
  const r39DescMerge = l2CcSheet.merges.find(m => m.s.r === 39 && m.s.c === 5);
  assert.ok(r39DescMerge, 'Row 39 description merge must exist at col 5');
  assert.equal(r39DescMerge.e.c, lastCol);

  // Row 44 Date merge must extend from col 6 to lastCol (12)
  const r44DateMerge = l2CcSheet.merges.find(m => m.s.r === 44 && m.s.c === 6);
  assert.ok(r44DateMerge, 'Row 44 date merge must exist at col 6');
  assert.equal(r44DateMerge.e.c, lastCol);
});

test('7. C&C check sheet sticky header CSS rules ensure stable 48px/26px heights and alignment', async () => {
  const fs = await import('node:fs');
  const cssSource = fs.readFileSync(new URL('../../components/lpa/ccSheet.css', import.meta.url), 'utf-8');
  assert.ok(cssSource.includes('tr.cc-header-row-2'));
  assert.ok(cssSource.includes('height: 48px !important'));
  assert.ok(cssSource.includes('tr.cc-header-row-3'));
  assert.ok(cssSource.includes('top: 48px !important'));
  assert.ok(cssSource.includes('height: 74px !important'));
});

