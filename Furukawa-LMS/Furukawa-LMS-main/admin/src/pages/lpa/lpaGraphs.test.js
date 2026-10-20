import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateSectionData,
  formatShortDate,
  extractSheetScore
} from './lpaGraphUtils.js';

test('1. formatShortDate correctly formats ISO dates', () => {
  assert.equal(formatShortDate('2026-10-20'), '20 Oct');
  assert.equal(formatShortDate('2026-01-05'), '5 Jan');
  assert.equal(formatShortDate(''), '');
});

test('2. aggregateSectionData groups daily sheets, shifts, levels and scores for Assembly', () => {
  const dummyRecords = [
    // Day 1: 2026-10-19 Assembly - 2 sheets (Shift A L3, Shift B L3)
    {
      id: 'rec-1',
      section: 'assembly',
      unit: 'Bawal',
      auditDate: '2026-10-19',
      targetLevel: 'L3',
      shift: 'A',
      sheets: [{ name: 'Assy Rev 1', shift: 'A', targetLevel: 'L3', rows: [] }]
    },
    {
      id: 'rec-2',
      section: 'assembly',
      unit: 'Bawal',
      auditDate: '2026-10-19',
      targetLevel: 'L3',
      shift: 'B',
      sheets: [{ name: 'Assy Rev 1', shift: 'B', targetLevel: 'L3', rows: [] }]
    },
    // Day 2: 2026-10-20 Assembly - 2 sheets (Shift A L3, Shift G L2)
    {
      id: 'rec-3',
      section: 'assembly',
      unit: 'Bawal',
      auditDate: '2026-10-20',
      targetLevel: 'L3',
      shift: 'A',
      sheets: [{ name: 'Assy Rev 2', shift: 'A', targetLevel: 'L3', rows: [] }]
    },
    {
      id: 'rec-4',
      section: 'assembly',
      unit: 'Bawal',
      auditDate: '2026-10-20',
      targetLevel: 'L2',
      shift: 'G',
      sheets: [{ name: 'Assy Rev 2', shift: 'G', targetLevel: 'L2', rows: [] }]
    },
    // C&C Sheet on 2026-10-20 (must be excluded from Assembly)
    {
      id: 'rec-5',
      section: 'cc',
      unit: 'Bawal',
      auditDate: '2026-10-20',
      targetLevel: 'L3',
      shift: 'A',
      sheets: [{ name: 'C&C Sheet', shift: 'A', targetLevel: 'L3', rows: [] }]
    }
  ];

  const { dailyData, summary } = aggregateSectionData(dummyRecords, 'assembly', 'all', 'all');

  // Verify total Assembly sheets
  assert.equal(summary.totalSheets, 4);
  assert.equal(summary.activeDays, 2);
  assert.equal(summary.totalShiftA, 2);
  assert.equal(summary.totalShiftB, 1);
  assert.equal(summary.totalShiftG, 1);
  assert.equal(summary.totalLevel3, 3);
  assert.equal(summary.totalLevel2, 1);
  assert.equal(summary.totalLevel1, 0);

  // Day 1 verification (2026-10-19)
  const day1 = dailyData.find(d => d.date === '2026-10-19');
  assert.ok(day1);
  assert.equal(day1.totalSheets, 2);
  assert.equal(day1.shiftA, 1);
  assert.equal(day1.shiftB, 1);
  assert.equal(day1.shiftG, 0);
  assert.equal(day1.level3, 2);
  assert.equal(day1.level2, 0);

  // Day 2 verification (2026-10-20)
  const day2 = dailyData.find(d => d.date === '2026-10-20');
  assert.ok(day2);
  assert.equal(day2.totalSheets, 2);
  assert.equal(day2.shiftA, 1);
  assert.equal(day2.shiftB, 0);
  assert.equal(day2.shiftG, 1);
  assert.equal(day2.level3, 1);
  assert.equal(day2.level2, 1);
});

test('3. aggregateSectionData groups daily sheets, shifts, levels for C&C Sheet', () => {
  const dummyRecords = [
    {
      id: 'cc-1',
      section: 'cc',
      unit: 'Bawal',
      auditDate: '2026-10-20',
      targetLevel: 'L3',
      shift: 'A',
      sheets: [{ name: 'CC Shift A', shift: 'A', targetLevel: 'L3' }]
    },
    {
      id: 'cc-2',
      section: 'cc',
      unit: 'Bawal',
      auditDate: '2026-10-20',
      targetLevel: 'L3',
      shift: 'B',
      sheets: [{ name: 'CC Shift B', shift: 'B', targetLevel: 'L3' }]
    },
    {
      id: 'cc-3',
      section: 'cc',
      unit: 'Bawal',
      auditDate: '2026-10-20',
      targetLevel: 'L1',
      shift: 'G',
      sheets: [{ name: 'CC Level 1', shift: 'G', targetLevel: 'L1' }]
    }
  ];

  const { dailyData, summary } = aggregateSectionData(dummyRecords, 'cc', 'all', 'all');

  assert.equal(summary.totalSheets, 3);
  assert.equal(summary.totalShiftA, 1);
  assert.equal(summary.totalShiftB, 1);
  assert.equal(summary.totalShiftG, 1);
  assert.equal(summary.totalLevel3, 2);
  assert.equal(summary.totalLevel1, 1);

  const day = dailyData[0];
  assert.equal(day.totalSheets, 3);
  assert.equal(day.shiftA, 1);
  assert.equal(day.shiftB, 1);
  assert.equal(day.shiftG, 1);
  assert.equal(day.level3, 2);
  assert.equal(day.level1, 1);
});

test('4. Unit filtering correctly isolates records by Unit', () => {
  const records = [
    { id: '1', section: 'assembly', unit: 'Bawal', auditDate: '2026-10-20', sheets: [{ shift: 'A' }] },
    { id: '2', section: 'assembly', unit: 'Gujrat', auditDate: '2026-10-20', sheets: [{ shift: 'B' }] }
  ];

  const bawalOnly = aggregateSectionData(records, 'assembly', 'Bawal', 'all');
  assert.equal(bawalOnly.summary.totalSheets, 1);
  assert.equal(bawalOnly.summary.totalShiftA, 1);
  assert.equal(bawalOnly.summary.totalShiftB, 0);

  const gujratOnly = aggregateSectionData(records, 'assembly', 'Gujrat', 'all');
  assert.equal(gujratOnly.summary.totalSheets, 1);
  assert.equal(gujratOnly.summary.totalShiftA, 0);
  assert.equal(gujratOnly.summary.totalShiftB, 1);
});
