import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import assemblyTemplate from './assemblyTemplate.json' with { type: 'json' };
import {
  isAssemblyCheckSheet,
  normalizeAssemblySheet,
  upgradeAssemblyRecord,
  createBlankAssemblySheet,
  buildAuditColumnGroups,
  getActiveAuditColumns
} from '../../components/lpa/assemblySheetUtils.js';

test('1. Assembly check sheet template contains exactly 7 columns in required order', () => {
  const sheet = assemblyTemplate.sheets[0];
  assert.equal(sheet.columnCount, 7);

  // Row 1 Header
  const headers = sheet.rows[1].map(c => String(c?.value ?? c?.formatted ?? '').trim());
  assert.deepEqual(headers, [
    'Sl No',
    'Focus',
    'CHECKS POINTS',
    'Area',
    'Marks',
    'Observation',
    'Score'
  ]);
});

test('2. Area column appears immediately before Marks column', () => {
  const sheet = assemblyTemplate.sheets[0];
  const headers = sheet.rows[1].map(c => String(c?.value ?? c?.formatted ?? '').trim());
  const areaIdx = headers.indexOf('Area');
  const marksIdx = headers.indexOf('Marks');

  assert.equal(areaIdx, 3);
  assert.equal(marksIdx, 4);
  assert.equal(areaIdx, marksIdx - 1);
});

test('3. Removed columns after Area are completely absent from the 7-column form', () => {
  const sheet = assemblyTemplate.sheets[0];
  const headerTexts = sheet.rows[1].map(c => String(c?.value ?? c?.formatted ?? '').toLowerCase());

  assert.equal(headerTexts.length, 7);
  assert.ok(!headerTexts.some(h => h.includes('requirement met')));
  assert.ok(!headerTexts.some(h => h.includes('not corrected')));
  assert.ok(!headerTexts.some(h => h.includes('not applicable')));
  assert.ok(!headerTexts.some(h => h.includes('pdca points')));
  assert.ok(!headerTexts.some(h => h.includes('other observations')));
});

test('4. Vertically merged Area cells and row values are preserved correctly', () => {
  const sheet = assemblyTemplate.sheets[0];

  // Verify Area merges at column index 3
  const areaMerges = sheet.merges.filter(m => m.s.c === 3 && m.e.c === 3);
  assert.ok(areaMerges.length >= 4);

  // Rows 3-7: Assembly Area
  const merge1 = areaMerges.find(m => m.s.r === 3 && m.e.r === 7);
  assert.ok(merge1, 'Rows 3-7 must be merged for Area');
  assert.match(String(sheet.rows[3][3]?.value), /Assembly/i);

  // Rows 8-9: Assembly Area
  const merge2 = areaMerges.find(m => m.s.r === 8 && m.e.r === 9);
  assert.ok(merge2, 'Rows 8-9 must be merged for Area');
  assert.match(String(sheet.rows[8][3]?.value), /Assembly/i);

  // Rows 10-27: Production Lines
  const merge3 = areaMerges.find(m => m.s.r === 10 && m.e.r === 27);
  assert.ok(merge3, 'Rows 10-27 must be merged for Area');
  assert.match(String(sheet.rows[10][3]?.value), /Production Lines/i);

  // Rows 28-36: Quality
  const merge4 = areaMerges.find(m => m.s.r === 28 && m.e.r === 36);
  assert.ok(merge4, 'Rows 28-36 must be merged for Area');
  assert.match(String(sheet.rows[28][3]?.value), /Quality/i);
});

test('5. Vertically merged Focus cells are preserved correctly', () => {
  const sheet = assemblyTemplate.sheets[0];
  const focusMerges = sheet.merges.filter(m => m.s.c === 1 && m.e.c === 1);
  assert.ok(focusMerges.length >= 5);

  assert.ok(focusMerges.some(m => m.s.r === 3 && m.e.r === 7));
  assert.ok(focusMerges.some(m => m.s.r === 8 && m.e.r === 9));
  assert.ok(focusMerges.some(m => m.s.r === 10 && m.e.r === 27));
  assert.ok(focusMerges.some(m => m.s.r === 28 && m.e.r === 33));
  assert.ok(focusMerges.some(m => m.s.r === 34 && m.e.r === 36));
});

test('6. Legacy 14-column Assembly check sheet upgrades cleanly to 7-column structure', () => {
  // Construct a simulated legacy 14-column sheet
  const legacyRows = [
    [
      { value: 'Date/Shift-' }, { value: '' },
      { value: ' LPA CHECK SHEET Level-3 Assy QA/Prod.' }, { value: '' }, { value: '' }, { value: '' }, { value: '' },
      { value: 'Auditor/Audtee-' }, { value: '' }, { value: '' }, { value: '' }, { value: '' }, { value: '' }, { value: '' }
    ],
    [
      { value: 'Sl No' }, { value: 'Focus' }, { value: 'CHECKS POINTS' },
      { value: 'Marks' }, { value: 'Observation' }, { value: 'Score' }, { value: 'Area' },
      { value: 'Requirement met' }, { value: 'Requirement not met corrected' },
      { value: 'Requirement not met not corrected' }, { value: 'Not Applicable' },
      { value: 'PDCA points/Other Observations' }, { value: '' }, { value: 'NUMBER' }
    ],
    Array.from({ length: 14 }, () => ({ value: '' })),
    [
      { value: 1 }, { value: "5's Concept" }, { value: 'Seiri:-Sort' },
      { value: 1 }, { value: 'O' }, { value: 3 }, { value: 'Assembly Area' },
      { value: '' }, { value: '' }, { value: '' }, { value: '' }, { value: '' }, { value: '' }, { value: '' }
    ]
  ];

  const legacySheet = {
    name: 'Assy QC & Pro',
    columnCount: 14,
    rows: legacyRows,
    merges: [
      { s: { r: 3, c: 6 }, e: { r: 7, c: 6 } }, // Area merge in col 6
      { s: { r: 3, c: 1 }, e: { r: 7, c: 1 } }, // Focus merge in col 1
      { s: { r: 3, c: 11 }, e: { r: 30, c: 12 } } // Removed notes merge
    ]
  };

  const upgraded = normalizeAssemblySheet(legacySheet);
  assert.equal(upgraded.columnCount, 7);

  // Headers
  assert.deepEqual(upgraded.rows[1].map(c => c.value), [
    'Sl No', 'Focus', 'CHECKS POINTS', 'Area', 'Marks', 'Observation', 'Score'
  ]);

  // Data row 3: Area is now at column 3, Marks at 4, Obs at 5, Score at 6
  assert.equal(upgraded.rows[3][0].value, 1);
  assert.equal(upgraded.rows[3][1].value, "5's Concept");
  assert.equal(upgraded.rows[3][2].value, 'Seiri:-Sort');
  assert.equal(upgraded.rows[3][3].value, 'Assembly Area');
  assert.equal(upgraded.rows[3][4].value, 1);
  assert.equal(upgraded.rows[3][5].value, 'O');
  assert.equal(upgraded.rows[3][6].value, 3);

  // Area merge remapped to col 3
  const remappedAreaMerge = upgraded.merges.find(m => m.s.r === 3 && m.e.r === 7 && m.s.c === 3 && m.e.c === 3);
  assert.ok(remappedAreaMerge, 'Area merge must be remapped to column 3');

  // Focus merge remains col 1
  const focusMerge = upgraded.merges.find(m => m.s.r === 3 && m.e.r === 7 && m.s.c === 1 && m.e.c === 1);
  assert.ok(focusMerge, 'Focus merge must stay in column 1');
});

test('7. upgradeAssemblyRecord upgrades assembly records while leaving others untouched', () => {
  const legacyRecord = {
    section: 'assembly',
    name: 'Assembly LPA Check Sheet.xls',
    sheets: [
      {
        name: 'Sheet 1',
        columnCount: 14,
        rows: [
          [{ value: 'Date' }],
          [{ value: 'Sl No' }, { value: 'Focus' }, { value: 'CHECKS POINTS' }, { value: 'Marks' }, { value: 'Observation' }, { value: 'Score' }, { value: 'Area' }, { value: 'Extra 1' }, { value: 'Extra 2' }, { value: 'Extra 3' }, { value: 'Extra 4' }, { value: 'Extra 5' }, { value: 'Extra 6' }, { value: 'Extra 7' }],
          [],
          [{ value: 1 }, { value: 'Focus 1' }, { value: 'Check 1' }, { value: 2 }, { value: '△' }, { value: 3 }, { value: 'Production Area' }]
        ],
        merges: [{ s: { r: 3, c: 6 }, e: { r: 5, c: 6 } }]
      }
    ]
  };

  const upgraded = upgradeAssemblyRecord(legacyRecord);
  assert.equal(upgraded.sheets[0].columnCount, 7);
  assert.equal(upgraded.sheets[0].rows[3][3].value, 'Production Area');

  // Non-assembly record untouched
  const ccRecord = { section: 'cc', sheets: [{ columnCount: 9 }] };
  assert.equal(upgradeAssemblyRecord(ccRecord), ccRecord);
});

test('8. isAssemblyCheckSheet detects 7-column and 14-column Assembly check sheets', () => {
  const sheet7 = assemblyTemplate.sheets[0];
  assert.ok(isAssemblyCheckSheet(sheet7));

  const sheet14 = { columnCount: 14, rows: [[{ value: 'Assy QC & Pro' }]] };
  assert.ok(isAssemblyCheckSheet(sheet14));

  const unrelatedSheet = { columnCount: 5, rows: [[{ value: 'Random Table' }]] };
  assert.ok(!isAssemblyCheckSheet(unrelatedSheet));
});

test('9. Observation dropdown and score calculation logic follows exact rules (O, △, ×, NA)', async () => {
  const { calculateAssemblyScore, getScoreForObservation } = await import('./lpaPdcaUtils.js');

  // Rule 1: O -> Score = Marks
  assert.equal(calculateAssemblyScore('O', 5), 5);
  assert.equal(calculateAssemblyScore('Ο', 3), 3);
  assert.equal(calculateAssemblyScore('○', 10), 10);
  assert.equal(getScoreForObservation('O', 5), 5);

  // Rule 2: △ -> Score = Marks - 1 (min 0)
  assert.equal(calculateAssemblyScore('△', 5), 4);
  assert.equal(calculateAssemblyScore('Δ', 3), 2);
  assert.equal(calculateAssemblyScore('▲', 1), 0);
  assert.equal(calculateAssemblyScore('△', 0), 0); // No negative score
  assert.equal(getScoreForObservation('△', 5), 4);
  assert.equal(getScoreForObservation('△', 0), 0);

  // Rule 3: × -> Score = 0
  assert.equal(calculateAssemblyScore('×', 5), 0);
  assert.equal(calculateAssemblyScore('X', 10), 0);
  assert.equal(calculateAssemblyScore('x', 3), 0);
  assert.equal(calculateAssemblyScore('Χ', 2), 0);
  assert.equal(getScoreForObservation('×', 5), 0);

  // Rule 4: NA -> Score = 'NA'
  assert.equal(calculateAssemblyScore('NA', 5), 'NA');
  assert.equal(calculateAssemblyScore('na', 3), 'NA');
  assert.equal(getScoreForObservation('NA', 5), 'NA');

  // Empty observation -> ''
  assert.equal(calculateAssemblyScore('', 5), '');
  assert.equal(getScoreForObservation('', 5), '');
});

test('10. Shift options contain only A, B, C, G and are validated', async () => {
  const { LPA_SHIFTS } = await import('./lpaValidation.js');
  assert.deepEqual(LPA_SHIFTS, ['A', 'B', 'C', 'G']);
});

test('11. Department options contain exactly the 13 required departments in order', async () => {
  const { LPA_DEPARTMENTS } = await import('./lpaValidation.js');
  const { PDCA_DEPARTMENTS } = await import('../pdca/data/pdcaConstants.js');
  const expected = [
    'PE', 'IT', 'Quality', 'Assembly', 'SRC', 'Store', 'HR', 'Safety', 'FG', 'PPC', 'Maintenance', 'D&D', 'C&C'
  ];
  assert.deepEqual(LPA_DEPARTMENTS, expected);
  assert.deepEqual(PDCA_DEPARTMENTS, expected);
});

test('12. Validation and Data Integrity: Date, Shift, Department and Auditors persistence', async () => {
  const { validateWorkbook } = await import('./lpaValidation.js');

  const validWorkbook = {
    section: 'assembly',
    unit: 'Bawal',
    level: 'L1',
    auditDate: '2026-10-17',
    date: '2026-10-17',
    shift: 'B',
    department: 'Assembly',
    sectionName: 'Assembly Production',
    line: 'Assembly Line 1',
    auditors: ['John Doe', 'Jane Smith'],
    name: 'Assembly Audit Record',
    sheets: [
      {
        name: 'Assy QC & Pro',
        columnCount: 7,
        rows: [[{ value: 'Header', formatted: 'Header', type: 's' }]]
      }
    ]
  };

  const validated = validateWorkbook(validWorkbook);
  assert.equal(validated.shift, 'B');
  assert.equal(validated.department, 'Assembly');
  assert.equal(validated.sectionName, 'Assembly Production');
  assert.equal(validated.line, 'Assembly Line 1');
  assert.deepEqual(validated.auditors, ['John Doe', 'Jane Smith']);

  // Invalid shift throws error
  assert.throws(() => {
    validateWorkbook({ ...validWorkbook, shift: 'D' });
  }, /Select Shift A, B, C or G/);

  // Invalid department throws error
  assert.throws(() => {
    validateWorkbook({ ...validWorkbook, department: 'Finance' });
  }, /Select a valid department/);
});

test('13. Area column width is reduced to 40px and supports wrapping', async () => {
  // Test normalizeAssemblySheet for Area column width
  const legacySheet = {
    name: 'Assy Legacy',
    columnCount: 14,
    rows: [
      [],
      [
        { value: 'Sl No' }, { value: 'Focus' }, { value: 'CHECKS POINTS' },
        { value: 'Marks' }, { value: 'Observation' }, { value: 'Score' }, { value: 'Area' }
      ]
    ]
  };
  const sheet = normalizeAssemblySheet(legacySheet);

  // Column 3 is Area, width should be 40
  assert.equal(sheet.columns[3].wpx, 40);
  assert.ok(sheet.columns[3].wpx < 50, 'Area column should be compact (<= 40px)');
});

test('14. Centered Score column output and styling rules', async () => {
  const fs = await import('fs');
  const css = fs.readFileSync(new URL('../../components/lpa/assemblySheet.css', import.meta.url), 'utf-8');

  // Verify score column centering CSS classes
  assert.ok(css.includes('.assembly-score-cell'));
  assert.ok(css.includes('.assembly-score-container'));
  assert.ok(css.includes('.assembly-score-value'));
  assert.ok(css.includes('justify-content: center !important;'));
  assert.ok(css.includes('align-items: center !important;'));
  assert.ok(css.includes('text-align: center !important;'));
});

test('15. Unsaved changes confirmation dialog message and button specs', async () => {
  const fs = await import('fs');
  const pageSource = fs.readFileSync(new URL('./LpaPage.jsx', import.meta.url), 'utf-8');

  // Verify the exact required alert message
  assert.ok(pageSource.includes('You have unsaved changes. Are you sure you want to go back without saving?'));
  // Verify the required buttons
  assert.ok(pageSource.includes('Stay on Page'));
  assert.ok(pageSource.includes('Go Back'));
  // Verify dirty state checking and snapshot comparison
  assert.ok(pageSource.includes('hasUnsavedChanges'));
  assert.ok(pageSource.includes('discardAndExit'));
  assert.ok(pageSource.includes('handleStayOnPage'));
});

test('16. Assembly Legend section layout and formatting', async () => {
  const { ASSEMBLY_LEGEND_MERGES, ensureAssemblyLegend } = await import('../../components/lpa/assemblySheetUtils.js');
  assert.ok(Array.isArray(ASSEMBLY_LEGEND_MERGES));

  // Verify header merges
  const duringAuditMerge = ASSEMBLY_LEGEND_MERGES.find(m => m.s.r === 40 && m.s.c === 3);
  assert.deepEqual(duringAuditMerge, { s: { c: 3, r: 40 }, e: { c: 4, r: 41 } }, 'During audit spans cols 3-4 and rows 40-41');

  const scoreCriteriaMerge = ASSEMBLY_LEGEND_MERGES.find(m => m.s.r === 40 && m.s.c === 5);
  assert.deepEqual(scoreCriteriaMerge, { s: { c: 5, r: 40 }, e: { c: 6, r: 41 } }, 'Score Criteria spans cols 5-6 and rows 40-41');

  // Verify criteria descriptions span cols 5-6
  for (let r = 42; r <= 46; r++) {
    const descMerge = ASSEMBLY_LEGEND_MERGES.find(m => m.s.r === r && m.s.c === 5);
    assert.ok(descMerge && descMerge.e.c === 6, `Row ${r} description must span cols 5-6`);
  }

  // Verify CSS ensures horizontal orientation for legend
  const fs = await import('fs');
  const css = fs.readFileSync(new URL('../../components/lpa/assemblySheet.css', import.meta.url), 'utf-8');
  assert.ok(css.includes('.assembly-legend-cell'));
  assert.ok(css.includes('writing-mode: horizontal-tb !important;'));
});

test('17. LPA Assembly Form - Header layout matches reference drawing structure', async () => {
  const fs = await import('fs');
  const sheetSource = fs.readFileSync(new URL('../../components/lpa/AssemblySheet.jsx', import.meta.url), 'utf-8');
  const cssSource = fs.readFileSync(new URL('../../components/lpa/assemblySheet.css', import.meta.url), 'utf-8');

  // Verify structure in JSX
  assert.ok(sheetSource.includes('assembly-form-header-box'), 'Contains assembly-form-header-box container');
  assert.ok(sheetSource.includes('assembly-header-top-row'), 'Contains top compartment row');
  assert.ok(sheetSource.includes('assembly-header-title-box'), 'Contains left Title compartment');
  assert.ok(sheetSource.includes('assembly-header-auditor-box'), 'Contains right Auditor compartment');
  assert.ok(sheetSource.includes('assembly-header-bottom-row'), 'Contains bottom 5-column compartment row');
  assert.ok(sheetSource.includes('assembly-header-field-col'), 'Contains field columns');

  // Verify CSS classes
  assert.ok(cssSource.includes('.assembly-header-top-row'), 'CSS defines assembly-header-top-row');
  assert.ok(cssSource.includes('.assembly-header-title-box'), 'CSS defines assembly-header-title-box');
  assert.ok(cssSource.includes('.assembly-header-auditor-box'), 'CSS defines assembly-header-auditor-box');
  assert.ok(cssSource.includes('.assembly-header-bottom-row'), 'CSS defines assembly-header-bottom-row');
  assert.ok(cssSource.includes('repeat(5, minmax(0, 1fr))'), 'Bottom row is 5-column grid across Date, Shift, Department, Section, Line');
});

test('18. LPA Assembly Form - Summary section layout and cell merges (Total Marks & Percentage)', async () => {
  const sheet = assemblyTemplate.sheets[0];

  // Verify Row 37 merge: Cols 0-3 merged for Total Marks label
  const r37LabelMerge = sheet.merges.find(m => m.s.r === 37 && m.s.c === 0);
  assert.deepEqual(r37LabelMerge, { s: { c: 0, r: 37 }, e: { c: 3, r: 37 } }, 'Row 37 cols 0-3 must be merged for Total Marks');

  // Verify Row 38 merge: Cols 0-3 merged for Percentage label
  const r38LabelMerge = sheet.merges.find(m => m.s.r === 38 && m.s.c === 0);
  assert.deepEqual(r38LabelMerge, { s: { c: 0, r: 38 }, e: { c: 3, r: 38 } }, 'Row 38 cols 0-3 must be merged for Percentage (%) label');

  // Verify Row 38 merge: Cols 4-6 merged for Percentage display
  const r38ValueMerge = sheet.merges.find(m => m.s.r === 38 && m.s.c === 4);
  assert.deepEqual(r38ValueMerge, { s: { c: 4, r: 38 }, e: { c: 6, r: 38 } }, 'Row 38 cols 4-6 must be merged for Percentage display');

  // Ensure Row 37 col 4 is NOT merged to col 6 so Total Score counter can be displayed in col 6
  const oldR37Merge = sheet.merges.find(m => m.s.r === 37 && m.s.c === 4 && m.e.c === 6);
  assert.equal(oldR37Merge, undefined, 'Row 37 col 4 must not merge to col 6, preserving Total Score in col 6');
});

test('19. Total Score counter calculation and NA observation exclusion', async () => {
  const { calculateAssemblyScore } = await import('./lpaPdcaUtils.js');

  // Test observation scoring rules:
  // O -> Score = Marks
  assert.equal(calculateAssemblyScore('O', 3), 3);
  assert.equal(calculateAssemblyScore('Ο', 1), 1);

  // △ -> Score = Marks - 1 (min 0)
  assert.equal(calculateAssemblyScore('△', 3), 2);
  assert.equal(calculateAssemblyScore('△', 1), 0);

  // × -> Score = 0
  assert.equal(calculateAssemblyScore('×', 3), 0);
  assert.equal(calculateAssemblyScore('X', 1), 0);

  // NA -> Score = 'NA' (excluded from numeric score)
  assert.equal(calculateAssemblyScore('NA', 3), 'NA');

  // Simulate total score accumulation across 5 questions
  const sampleRows = [
    { marks: 3, obs: 'O', score: 3 },
    { marks: 1, obs: '△', score: 0 },
    { marks: 3, obs: '△', score: 2 },
    { marks: 1, obs: '×', score: 0 },
    { marks: 2, obs: 'NA', score: 'NA' }
  ];

  let totalApplicableMarks = 0;
  let totalScore = 0;

  for (const r of sampleRows) {
    if (r.obs === 'NA') continue; // Excluded
    totalApplicableMarks += r.marks;
    if (typeof r.score === 'number') {
      totalScore += r.score;
    }
  }

  assert.equal(totalApplicableMarks, 8, 'Applicable marks excludes NA item: 3+1+3+1 = 8');
  assert.equal(totalScore, 5, 'Total score sums numeric scores: 3+0+2+0 = 5');
});

test('20. Percentage (%) calculation formula and zero-marks boundary', () => {
  const calculatePercentage = (totalScore, totalApplicableMarks) => {
    if (!totalApplicableMarks || totalApplicableMarks <= 0) return 'N/A';
    const pct = (totalScore / totalApplicableMarks) * 100;
    return `${pct.toFixed(2)}%`;
  };

  // User requirement example: Total Applicable Marks = 50, Total Score = 42 -> 84.00%
  assert.equal(calculatePercentage(42, 50), '84.00%');

  // Perfect score
  assert.equal(calculatePercentage(70, 70), '100.00%');

  // Zero score
  assert.equal(calculatePercentage(0, 66), '0.00%');

  // Fractional percentage
  assert.equal(calculatePercentage(41, 66), '62.12%');

  // Zero applicable marks (all items NA) -> 'N/A'
  assert.equal(calculatePercentage(0, 0), 'N/A');
});

test('21. createBlankAssemblySheet creates dynamic columns for multiple levels (L1, L2, L3)', () => {
  const baseSheet = assemblyTemplate.sheets[0];

  // Test 1: L3 + L2 (Weekly) creates 11 columns (5 metadata + L3 Shift A + L3 Shift B + L2)
  const twoLevelSheet = createBlankAssemblySheet(baseSheet, '2026-10-19', ['L3', 'L2']);
  assert.equal(twoLevelSheet.columnCount, 11);
  assert.equal(twoLevelSheet.rows[1][0].value, 'Sl No');
  assert.equal(twoLevelSheet.rows[1][1].value, 'Focus');
  assert.equal(twoLevelSheet.rows[1][2].value, 'CHECKS POINTS');
  assert.equal(twoLevelSheet.rows[1][3].value, 'Area');
  assert.equal(twoLevelSheet.rows[1][4].value, 'Marks');
  assert.equal(twoLevelSheet.rows[1][5].value, 'Level 3 (Shift A)');
  assert.equal(twoLevelSheet.rows[1][7].value, 'Level 3 (Shift B)');
  assert.equal(twoLevelSheet.rows[1][9].value, 'Level 2');
  assert.equal(twoLevelSheet.rows[2][5].value, 'Observation');
  assert.equal(twoLevelSheet.rows[2][6].value, 'Score');
  assert.equal(twoLevelSheet.rows[2][7].value, 'Observation');
  assert.equal(twoLevelSheet.rows[2][8].value, 'Score');
  assert.equal(twoLevelSheet.rows[2][9].value, 'Observation');
  assert.equal(twoLevelSheet.rows[2][10].value, 'Score');

  // Test 2: L3 + L2 + L1 (Monthly) creates 13 columns (5 metadata + L3 Shift A + L3 Shift B + L2 + L1)
  const threeLevelSheet = createBlankAssemblySheet(baseSheet, '2026-10-19', ['L3', 'L2', 'L1']);
  assert.equal(threeLevelSheet.columnCount, 13);
  assert.equal(threeLevelSheet.rows[1][5].value, 'Level 3 (Shift A)');
  assert.equal(threeLevelSheet.rows[1][7].value, 'Level 3 (Shift B)');
  assert.equal(threeLevelSheet.rows[1][9].value, 'Level 2');
  assert.equal(threeLevelSheet.rows[1][11].value, 'Level 1');
  assert.equal(threeLevelSheet.rows[2][11].value, 'Observation');
  assert.equal(threeLevelSheet.rows[2][12].value, 'Score');

  // Total Marks on row 37
  assert.equal(threeLevelSheet.rows[37][0].value, 'Total Marks:');
  assert.equal(threeLevelSheet.rows[37][4].value, '70/');

  // Percentage on row 38
  assert.equal(threeLevelSheet.rows[38][0].value, 'Percentage (%):');
});

test('22. Table header row is fixed / sticky with the screen while scrolling', () => {
  const cssSource = fs.readFileSync(new URL('../../components/lpa/assemblySheet.css', import.meta.url), 'utf-8');
  assert.ok(cssSource.includes('.assembly-audit-table thead'));
  assert.ok(cssSource.includes('position: sticky'));
  assert.ok(cssSource.includes('.assembly-sticky-th'));
  assert.ok(cssSource.includes('.assembly-header-row-1'));
  assert.ok(cssSource.includes('.assembly-header-row-2'));

  const componentSource = fs.readFileSync(new URL('../../components/lpa/AssemblySheet.jsx', import.meta.url), 'utf-8');
  assert.ok(componentSource.includes('<thead'));
  assert.ok(componentSource.includes('assembly-header-row-1'));
  assert.ok(componentSource.includes('assembly-header-row-2'));
  assert.ok(componentSource.includes('CHECKS POINTS'));
  assert.ok(componentSource.includes('Observation'));
  assert.ok(componentSource.includes('Score'));
});

test('23. Create LPA Modal supports mandatory Levels (L1, L2, L3), Date, Shift, Department', () => {
  const modalSource = fs.readFileSync(new URL('../../components/lpa/CreateLpaModal.jsx', import.meta.url), 'utf-8');
  assert.ok(modalSource.includes("title: 'Level 3'"));
  assert.ok(modalSource.includes("title: 'Level 2'"));
  assert.ok(modalSource.includes("title: 'Level 1'"));
  assert.ok(modalSource.includes('Levels is mandatory'));
  assert.ok(modalSource.includes('Date is mandatory'));
  assert.ok(modalSource.includes('Shift is mandatory'));
  assert.ok(modalSource.includes('Department is mandatory'));
  assert.ok(modalSource.includes('availableSections'));
  assert.ok(modalSource.includes('availableLines'));
});

test('24. Create LPA Modal UI cleanup: removes Form Section, unnecessary helper badges, and configures shift defaults', () => {
  const modalSource = fs.readFileSync(new URL('../../components/lpa/CreateLpaModal.jsx', import.meta.url), 'utf-8');
  // Form Section toggle is removed
  assert.equal(modalSource.includes('Form Section'), false);
  assert.equal(modalSource.includes('Select one or more'), false);
  assert.equal(modalSource.includes('Select which levels to include in this audit'), false);
  // Compact no-scroll layout
  assert.equal(modalSource.includes('overflow-y-auto'), false);
  // Shift defaults by level: A, B, C for L3; G for L2 and L1
  assert.ok(modalSource.includes("targetLevel === 'L3'"));
  assert.ok(modalSource.includes("['A', 'B', 'C']"));
  assert.ok(modalSource.includes("['G', 'A', 'B', 'C']"));
});

test('25. Level selection hierarchy: L1 includes L3 Shift A + Shift B + L2 + L1, L2 includes L3 Shift A + Shift B + L2, L3 includes L3', () => {
  // L3 selection
  const groupsL3 = buildAuditColumnGroups(['L3'], ['A'], false);
  assert.equal(groupsL3.length, 1);
  assert.equal(groupsL3[0].level, 'L3');
  assert.equal(groupsL3[0].name, 'Level 3');

  // L2 selection
  const groupsL2 = buildAuditColumnGroups(['L3', 'L2'], ['A'], false);
  assert.equal(groupsL2.length, 3);
  assert.equal(groupsL2[0].level, 'L3');
  assert.equal(groupsL2[0].shift, 'A');
  assert.equal(groupsL2[1].level, 'L3');
  assert.equal(groupsL2[1].shift, 'B');
  assert.equal(groupsL2[2].level, 'L2');
  assert.equal(groupsL2[2].name, 'Level 2');

  // L1 selection
  const groupsL1 = buildAuditColumnGroups(['L3', 'L2', 'L1'], ['A'], false);
  assert.equal(groupsL1.length, 4);
  assert.equal(groupsL1[0].level, 'L3');
  assert.equal(groupsL1[1].level, 'L3');
  assert.equal(groupsL1[2].level, 'L2');
  assert.equal(groupsL1[3].level, 'L1');
  assert.equal(groupsL1[3].name, 'Level 1');
});

test('26. Multi-shift columns under Level 3 and same-day data merging', () => {
  // 1. Single shift does NOT show shift-wise columns
  const singleShiftGroups = buildAuditColumnGroups(['L3'], ['A'], false);
  assert.equal(singleShiftGroups.length, 1);
  assert.equal(singleShiftGroups[0].name, 'Level 3');

  // 2. Multiple shifts (e.g. Shift A + Shift B on same day) show separate columns per shift
  const multiShiftGroups = buildAuditColumnGroups(['L3'], ['A', 'B'], false);
  assert.equal(multiShiftGroups.length, 2);
  assert.equal(multiShiftGroups[0].name, 'Level 3 (Shift A)');
  assert.equal(multiShiftGroups[1].name, 'Level 3 (Shift B)');

  // 3. Merging existing sheet: Shift A had observations filled, Shift B is added
  const baseSheet = assemblyTemplate.sheets[0];
  const sheetShiftA = createBlankAssemblySheet(baseSheet, '2026-10-19', ['L3'], ['A']);
  sheetShiftA.rows[3][5] = { value: 'Ο', formatted: 'Ο', type: 's' };
  sheetShiftA.rows[3][6] = { value: 1, formatted: '1', type: 'n' };

  // New session merges Shift A and Shift B
  const mergedSheet = createBlankAssemblySheet(baseSheet, '2026-10-19', ['L3'], ['A', 'B'], sheetShiftA);
  assert.equal(mergedSheet.columnCount, 9); // 5 base + 2*2 shift cols
  // Shift A data is preserved
  assert.equal(mergedSheet.rows[3][5].value, 'Ο');
  assert.equal(mergedSheet.rows[3][6].value, 1);
  // Shift B data starts blank
  assert.equal(mergedSheet.rows[3][7].value, '');
  assert.equal(mergedSheet.rows[3][8].value, '');

  // Fill Shift B data and create L2 sheet with data
  mergedSheet.rows[3][7] = { value: 'X', formatted: 'X', type: 's' };
  mergedSheet.rows[3][8] = { value: 0, formatted: '0', type: 'n' };
  const l2Sheet = createBlankAssemblySheet(baseSheet, '2026-10-19', ['L2'], ['G']);
  l2Sheet.rows[3][5] = { value: 'Ο', formatted: 'Ο', type: 's' };
  l2Sheet.rows[3][6] = { value: 1, formatted: '1', type: 'n' };

  // 4. Auditor later adds Level 1 for same day: fetches existing L3 Shift A, Shift B, and L2 data
  const mergedL1Sheet = createBlankAssemblySheet(baseSheet, '2026-10-19', ['L3', 'L2', 'L1'], ['A', 'B'], [mergedSheet, l2Sheet]);
  assert.equal(mergedL1Sheet.columnCount, 13); // 5 base + 2*2 (L3 A&B) + 2 (L2) + 2 (L1) = 13 cols
  assert.equal(mergedL1Sheet.rows[3][5].value, 'Ο');
  assert.equal(mergedL1Sheet.rows[3][6].value, 1);
  assert.equal(mergedL1Sheet.rows[3][7].value, 'X');
  assert.equal(mergedL1Sheet.rows[3][8].value, 0);
});

test('27. Assembly Form Legend UI fix: complete cell borders and enlarged readable typography', () => {
  const cssSource = fs.readFileSync(new URL('../../components/lpa/assemblySheet.css', import.meta.url), 'utf-8');
  // Row 40 top border
  assert.ok(cssSource.includes('border-top: 2px solid #0f172a !important'));
  // Legend cells have solid borders
  assert.ok(cssSource.includes('.assembly-form-table td.assembly-legend-cell'));
  assert.ok(cssSource.includes('border: 1px solid #475569 !important'));
  // Row 47 footer border
  assert.ok(cssSource.includes('.assembly-form-table tr[data-row-index="47"] td'));
  assert.ok(cssSource.includes('border: 1.5px solid #334155 !important'));
  // Text size is increased from 8px to 11.5px+
  assert.ok(cssSource.includes('font-size: 11.5px'));
  assert.ok(cssSource.includes('font-size: 13px'));
});

test('28. Same-day data retrieval and read-only enforcement for Level 2 and Level 1 sheets', () => {
  const baseSheet = assemblyTemplate.sheets[0];

  // 1. Existing Level 3 sheet created on 2026-10-19 with observations
  const l3Sheet = createBlankAssemblySheet(baseSheet, '2026-10-19', ['L3'], ['A']);
  l3Sheet.rows[3][5] = { value: 'Ο', formatted: 'Ο', type: 's' };
  l3Sheet.rows[3][6] = { value: 1, formatted: '1', type: 'n' };
  l3Sheet.rows[4][5] = { value: '△', formatted: '△', type: 's' };
  l3Sheet.rows[4][6] = { value: 0, formatted: '0', type: 'n' };

  // 2. User creates a new Level 2 sheet on the same day:
  // It receives existing L3 sheet as source (only Shift A has data):
  const l2Sheet = createBlankAssemblySheet(baseSheet, '2026-10-19', ['L3', 'L2'], ['A'], [l3Sheet]);
  // Since Shift B has no data, it is omitted! columnCount is 9 (5 base + 2 Shift A + 2 Level 2)
  assert.equal(l2Sheet.columnCount, 9);
  // Level 3 Shift A columns are pre-populated with same-day data
  assert.equal(l2Sheet.rows[3][5].value, 'Ο');
  assert.equal(l2Sheet.rows[3][6].value, 1);
  assert.equal(l2Sheet.rows[4][5].value, '△');
  assert.equal(l2Sheet.rows[4][6].value, 0);
  // Level 2 columns start completely blank for user input in cols 7 & 8
  assert.equal(l2Sheet.rows[3][7].value, '');
  assert.equal(l2Sheet.rows[3][8].value, '');

  // 3. Check AssemblySheet.jsx component code has read-only guard and view-only rendering
  const componentSource = fs.readFileSync(new URL('../../components/lpa/AssemblySheet.jsx', import.meta.url), 'utf-8');
  assert.ok(componentSource.includes('isLevelReadOnly'));
  assert.ok(componentSource.includes('sheetTargetLevel'));
  assert.ok(componentSource.includes('assembly-readonly-observation'));
  assert.ok(componentSource.includes('View Only'));
});

test('29. Editing and deletion rule: only creator and admin can edit/delete LPA records', async () => {
  const { canEditRecord, isRecordCreator } = await import('../pdca/data/recordFilters.js');

  const creatorUser = { id: 'usr_123', empId: 'BW039182', name: 'Pooja Nair', role: 'EMPLOYEE' };
  const adminUser = { id: 'admin_999', empId: 'ADMIN01', name: 'Admin User', role: 'ADMIN', isAdmin: true };
  const otherUser = { id: 'other_456', empId: 'BW044111', name: 'Other User', role: 'EMPLOYEE' };

  const recordCreatedByUser = {
    id: 'lpa_rec_001',
    name: 'Assembly LPA Check Sheet · 2026-10-19',
    ownerId: 'usr_123',
    createdBy: 'Pooja Nair'
  };

  // Creator can edit
  assert.equal(canEditRecord(recordCreatedByUser, creatorUser), true);
  assert.equal(isRecordCreator(recordCreatedByUser, creatorUser), true);

  // Admin can edit
  assert.equal(canEditRecord(recordCreatedByUser, adminUser), true);

  // Other ordinary user CANNOT edit
  assert.equal(canEditRecord(recordCreatedByUser, otherUser), false);
  assert.equal(isRecordCreator(recordCreatedByUser, otherUser), false);

  // Verify LpaPage.jsx enforces the rule
  const lpaPageSource = fs.readFileSync(new URL('./LpaPage.jsx', import.meta.url), 'utf-8');
  assert.ok(lpaPageSource.includes('canEditCurrentRecord'));
  assert.ok(lpaPageSource.includes('canEditRecord'));
  assert.ok(lpaPageSource.includes('View Only'));
  assert.ok(lpaPageSource.includes('You are in view-only mode'));
});
