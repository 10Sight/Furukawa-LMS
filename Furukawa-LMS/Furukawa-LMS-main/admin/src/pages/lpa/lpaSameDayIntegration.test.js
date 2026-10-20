import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAuditColumnGroups,
  normalizeSourceSheets,
  createBlankAssemblySheet,
  syncSheetWithLatestSameDaySources
} from '../../components/lpa/assemblySheetUtils.js';

import {
  createBlankCcSheet
} from './ccTemplate.js';

test('1. Column Group Building for Level 2 Sheet', () => {
  const groups = buildAuditColumnGroups(['L2'], ['G'], false, 'L2');
  assert.equal(groups.length, 3, 'Level 2 sheet must have exactly 3 column groups (L3 Shift A, L3 Shift B, L2)');

  const [shiftA, shiftB, l2] = groups;
  assert.equal(shiftA.id, 'L3_A');
  assert.equal(shiftA.shift, 'A');
  assert.equal(shiftA.isFetched, true, 'L3 Shift A must be marked as fetched (read-only)');
  assert.equal(shiftA.obsCol, 5);
  assert.equal(shiftA.scoreCol, 6);

  assert.equal(shiftB.id, 'L3_B');
  assert.equal(shiftB.shift, 'B');
  assert.equal(shiftB.isFetched, true, 'L3 Shift B must be marked as fetched (read-only)');
  assert.equal(shiftB.obsCol, 7);
  assert.equal(shiftB.scoreCol, 8);

  assert.equal(l2.id, 'L2');
  assert.equal(l2.isFetched, false, 'L2 group in L2 sheet must be editable by user');
  assert.equal(l2.obsCol, 9);
  assert.equal(l2.scoreCol, 10);
});

test('2. Column Group Building for Level 1 Sheet', () => {
  const groups = buildAuditColumnGroups(['L1'], ['G'], false, 'L1');
  assert.equal(groups.length, 4, 'Level 1 sheet must have 4 column groups (L3 Shift A, L3 Shift B, L2, L1)');

  const [shiftA, shiftB, l2, l1] = groups;
  assert.equal(shiftA.id, 'L3_A');
  assert.equal(shiftA.isFetched, true);
  assert.equal(shiftB.id, 'L3_B');
  assert.equal(shiftB.isFetched, true);

  assert.equal(l2.id, 'L2');
  assert.equal(l2.isFetched, true, 'L2 group in L1 sheet must be fetched (read-only)');
  assert.equal(l2.obsCol, 9);
  assert.equal(l2.scoreCol, 10);

  assert.equal(l1.id, 'L1');
  assert.equal(l1.isFetched, false, 'L1 group in L1 sheet must be editable by user');
  assert.equal(l1.obsCol, 11);
  assert.equal(l1.scoreCol, 12);
});

test('3. Column Group Building for C&C Sheet (Offset Verification)', () => {
  const groups = buildAuditColumnGroups(['L2'], ['G'], true, 'L2');
  assert.equal(groups.length, 3);
  // In C&C, metadata columns span 0-6, so audit groups start at column 7
  assert.equal(groups[0].obsCol, 7);
  assert.equal(groups[0].scoreCol, 8);
  assert.equal(groups[1].obsCol, 9);
  assert.equal(groups[1].scoreCol, 10);
  assert.equal(groups[2].obsCol, 11);
  assert.equal(groups[2].scoreCol, 12);
});

test('4. normalizeSourceSheets correctly segregates Shift A and Shift B', () => {
  const dummySheetA = {
    id: 101,
    level: 'L3',
    shift: 'A',
    rows: [['Check 1', '', '', '', '', 'O', 1]]
  };
  const dummySheetB = {
    id: 102,
    level: 'L3',
    shift: 'B',
    rows: [['Check 1', '', '', '', '', 'X', 0]]
  };
  const dummySheetL2 = {
    id: 201,
    level: 'L2',
    shift: 'G',
    rows: [['Check 1', '', '', '', '', '', '', '', '', 'O', 1]]
  };

  // Test array input
  const normalized = normalizeSourceSheets([dummySheetA, dummySheetB, dummySheetL2]);
  assert.equal(normalized.L3_A.id, 101);
  assert.equal(normalized.L3_A.shift, 'A');
  assert.equal(normalized.L3_B.id, 102);
  assert.equal(normalized.L3_B.shift, 'B');
  assert.equal(normalized.L2.id, 201);

  // Test API structure input { data: { shiftA, shiftB, level2 } }
  const apiNormalized = normalizeSourceSheets({
    data: {
      shiftA: dummySheetA,
      shiftB: dummySheetB,
      level2: dummySheetL2
    }
  });
  assert.equal(apiNormalized.L3_A.id, 101);
  assert.equal(apiNormalized.L3_B.id, 102);
  assert.equal(apiNormalized.L2.id, 201);
});

test('5. Level 2 Sheet Creation with same-day Shift A and Shift B Data', () => {
  // Create blank L3 Shift A and Shift B sheets
  const sheetA = createBlankAssemblySheet(
    null,
    '2026-10-20',
    ['L3'],
    ['A'],
    null,
    'L3'
  );
  // Set observation 'O' and score 1 in first checklist row (index 3)
  sheetA.rows[3][5] = { value: 'O', formatted: 'O' };
  sheetA.rows[3][6] = { value: 1, formatted: '1' };

  const sheetB = createBlankAssemblySheet(
    null,
    '2026-10-20',
    ['L3'],
    ['B'],
    null,
    'L3'
  );
  // Set observation 'X' and score 0 in first checklist row (index 3)
  sheetB.rows[3][5] = { value: 'X', formatted: 'X' };
  sheetB.rows[3][6] = { value: 0, formatted: '0' };

  // Now create Level 2 sheet passing both shift sheets
  const l2Sheet = createBlankAssemblySheet(
    null,
    '2026-10-20',
    ['L2'],
    ['G'],
    [sheetA, sheetB],
    'L2'
  );

  assert.equal(l2Sheet.sourceShiftStatus.A, true);
  assert.equal(l2Sheet.sourceShiftStatus.B, true);

  // Check row 3 (first checklist row):
  // Col 5: Shift A Observation -> 'O'
  // Col 6: Shift A Score -> 1
  // Col 7: Shift B Observation -> 'X'
  // Col 8: Shift B Score -> 0
  // Col 9: L2 Observation -> '' (empty for user input)
  // Col 10: L2 Score -> '' (empty for user input)
  assert.equal(l2Sheet.rows[3][5].value, 'O', 'Shift A observation correctly placed at col 5');
  assert.equal(l2Sheet.rows[3][6].value, 1, 'Shift A score correctly placed at col 6');
  assert.equal(l2Sheet.rows[3][7].value, 'X', 'Shift B observation correctly placed at col 7');
  assert.equal(l2Sheet.rows[3][8].value, 0, 'Shift B score correctly placed at col 8');
  assert.equal(l2Sheet.rows[3][9].value, '', 'L2 user observation must be initially empty');
  assert.equal(l2Sheet.rows[3][10].value, '', 'L2 user score must be initially empty');
});

test('6. Level 2 Sheet Creation with missing Shift B shows empty state', () => {
  const sheetA = createBlankAssemblySheet(
    null,
    '2026-10-20',
    ['L3'],
    ['A'],
    null,
    'L3'
  );
  sheetA.rows[3][5] = { value: 'O', formatted: 'O' };
  sheetA.rows[3][6] = { value: 1, formatted: '1' };

  // Only Shift A is provided; Shift B is missing
  const l2Sheet = createBlankAssemblySheet(
    null,
    '2026-10-20',
    ['L2'],
    ['G'],
    sheetA,
    'L2'
  );

  assert.equal(l2Sheet.sourceShiftStatus.A, true);
  assert.equal(l2Sheet.sourceShiftStatus.B, false, 'Shift B status must be false (missing)');

  // Shift A populated, Shift B remains empty
  assert.equal(l2Sheet.rows[3][5].value, 'O');
  assert.equal(l2Sheet.rows[3][6].value, 1);
  assert.equal(l2Sheet.rows[3][7].value, '', 'Missing Shift B observation column must remain empty');
  assert.equal(l2Sheet.rows[3][8].value, '', 'Missing Shift B score column must remain empty');
});

test('7. Level 1 Sheet Creation fetches same-day Level 2 and Level 3 data', () => {
  const sheetA = createBlankAssemblySheet(null, '2026-10-20', ['L3'], ['A'], null, 'L3');
  sheetA.rows[3][5] = { value: 'O', formatted: 'O' };
  sheetA.rows[3][6] = { value: 1, formatted: '1' };

  const sheetB = createBlankAssemblySheet(null, '2026-10-20', ['L3'], ['B'], null, 'L3');
  sheetB.rows[3][5] = { value: 'O', formatted: 'O' };
  sheetB.rows[3][6] = { value: 1, formatted: '1' };

  const sheetL2 = createBlankAssemblySheet(null, '2026-10-20', ['L2'], ['G'], [sheetA, sheetB], 'L2');
  // Fill L2's observation and score in cols 9 & 10
  sheetL2.rows[3][9] = { value: 'X', formatted: 'X' };
  sheetL2.rows[3][10] = { value: 0, formatted: '0' };

  // Create Level 1 sheet
  const l1Sheet = createBlankAssemblySheet(
    null,
    '2026-10-20',
    ['L1'],
    ['G'],
    [sheetA, sheetB, sheetL2],
    'L1'
  );

  assert.equal(l1Sheet.sourceShiftStatus.A, true);
  assert.equal(l1Sheet.sourceShiftStatus.B, true);
  assert.equal(l1Sheet.sourceShiftStatus.L2, true);

  // Shift A (cols 5-6)
  assert.equal(l1Sheet.rows[3][5].value, 'O');
  assert.equal(l1Sheet.rows[3][6].value, 1);
  // Shift B (cols 7-8)
  assert.equal(l1Sheet.rows[3][7].value, 'O');
  assert.equal(l1Sheet.rows[3][8].value, 1);
  // Level 2 (cols 9-10)
  assert.equal(l1Sheet.rows[3][9].value, 'X');
  assert.equal(l1Sheet.rows[3][10].value, 0);
  // Level 1 active column (cols 11-12)
  assert.equal(l1Sheet.rows[3][11].value, '', 'Level 1 observation must be empty for user input');
  assert.equal(l1Sheet.rows[3][12].value, '', 'Level 1 score must be empty for user input');
});

test('8. Same-Day Synchronization updates fetched data without overwriting active user input', () => {
  // Existing Level 2 sheet where user already typed an L2 observation 'X' (col 9) and score 0 (col 10)
  const l2Sheet = createBlankAssemblySheet(
    null,
    '2026-10-20',
    ['L2'],
    ['G'],
    null,
    'L2'
  );
  l2Sheet.rows[3][9] = { value: 'X', formatted: 'X' };
  l2Sheet.rows[3][10] = { value: 0, formatted: '0' };

  // New updated source sheet for Shift A arrived later
  const updatedSheetA = createBlankAssemblySheet(null, '2026-10-20', ['L3'], ['A'], null, 'L3');
  updatedSheetA.rows[3][5] = { value: 'O', formatted: 'O' };
  updatedSheetA.rows[3][6] = { value: 1, formatted: '1' };

  // Perform synchronization
  const syncedSheet = syncSheetWithLatestSameDaySources(l2Sheet, updatedSheetA, 'L2', false);

  // Shift A is now synced
  assert.equal(syncedSheet.rows[3][5].value, 'O');
  assert.equal(syncedSheet.rows[3][6].value, 1);
  // User's L2 input is untouched!
  assert.equal(syncedSheet.rows[3][9].value, 'X', 'User L2 observation must remain intact after sync');
  assert.equal(syncedSheet.rows[3][10].value, 0, 'User L2 score must remain intact after sync');
});

test('9. C&C Sheet same-day fetching matches correct column offsets', () => {
  const ccSheetA = createBlankCcSheet(
    null,
    '2026-10-20',
    ['L3'],
    ['A'],
    null,
    'L3'
  );
  // In C&C, checklist rows start at row 4, and audit cols start at col 7
  ccSheetA.rows[4][7] = { value: 'O', formatted: 'O' };
  ccSheetA.rows[4][8] = { value: 1, formatted: '1' };

  const ccSheetL2 = createBlankCcSheet(
    null,
    '2026-10-20',
    ['L2'],
    ['G'],
    ccSheetA,
    'L2'
  );

  // Shift A should be in cols 7 & 8
  assert.equal(ccSheetL2.rows[4][7].value, 'O');
  assert.equal(ccSheetL2.rows[4][8].value, 1);
  // L2 column should be empty for user input in cols 11 & 12
  assert.equal(ccSheetL2.rows[4][11].value, '');
  assert.equal(ccSheetL2.rows[4][12].value, '');
});
