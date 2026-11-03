import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateSectionData,
  formatShortDate,
  extractSheetScore,
  buildCombinedChartSlots,
  buildCombinedTableRows,
  extractAvailableMonths,
  formatYearMonth,
  toLocalDateStr,
  formatPeriodLabel
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
  assert.ok('level3Score' in day2);
  assert.ok('level2Score' in day2);
  assert.ok('level1Score' in day2);
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

// Minimal dailyData entries shaped like aggregateSectionData() output
const day = (date, avgScore, extra = {}) => ({
  date,
  avgScore,
  totalSheets: 1,
  level3Score: avgScore,
  level2Score: null,
  level1Score: null,
  ...extra
});

test('5. buildCombinedChartSlots pairs Assembly and C&C slots per date in both mode', () => {
  const slots = buildCombinedChartSlots(
    [day('2026-10-19', 80), day('2026-10-20', 90)],
    [day('2026-10-19', 70), day('2026-10-20', 60)],
    'both'
  );

  assert.deepEqual(slots.map(s => `${s.sheet}:${s.date}`), [
    'assembly:2026-10-19',
    'cc:2026-10-19',
    'assembly:2026-10-20',
    'cc:2026-10-20'
  ]);
  assert.deepEqual(slots.map(s => s.isGroupStart), [true, false, true, false]);
  assert.equal(slots[0].formattedDate, '19 Oct');
  assert.equal(slots[1].sheetLabel, 'C&C');
});

test('6. Both mode keeps an empty slot when one sheet has no audit that date', () => {
  const slots = buildCombinedChartSlots(
    [day('2026-10-19', 80), day('2026-10-20', 90)],
    [day('2026-10-19', 70)],
    'both'
  );

  assert.equal(slots.length, 4);
  const ccDay2 = slots[3];
  assert.equal(ccDay2.sheet, 'cc');
  assert.equal(ccDay2.isEmpty, true);
  assert.equal(ccDay2.avgScore, null);
  assert.equal(ccDay2.ccAvg, null);
  assert.equal(ccDay2.level3Score, null);
  assert.equal(ccDay2.totalSheets, 0);
});

test('7. Per-sheet trend values never cross sheets (no zigzag line)', () => {
  const slots = buildCombinedChartSlots(
    [day('2026-10-19', 80), day('2026-10-20', 90)],
    [day('2026-10-19', 70), day('2026-10-20', 60)],
    'both'
  );

  slots.filter(s => s.sheet === 'cc').forEach(s => assert.equal(s.assemblyAvg, null));
  slots.filter(s => s.sheet === 'assembly').forEach(s => assert.equal(s.ccAvg, null));
  assert.deepEqual(slots.map(s => s.assemblyAvg), [80, null, 90, null]);
  assert.deepEqual(slots.map(s => s.ccAvg), [null, 70, null, 60]);
});

test('8. Single sheet mode returns only that sheet and its dates', () => {
  const assembly = [day('2026-10-19', 80)];
  const cc = [day('2026-10-21', 70)];

  const asmSlots = buildCombinedChartSlots(assembly, cc, 'assembly');
  assert.equal(asmSlots.length, 1);
  assert.equal(asmSlots[0].sheet, 'assembly');
  assert.equal(asmSlots[0].isGroupStart, true);
  assert.equal(asmSlots[0].ccAvg, null);

  const ccSlots = buildCombinedChartSlots(assembly, cc, 'cc');
  assert.deepEqual(ccSlots.map(s => s.date), ['2026-10-21']);
  assert.deepEqual(ccSlots.map(s => s.ccAvg), [70]);
});

test('9. A real day with 0% average stays 0, not null', () => {
  const slots = buildCombinedChartSlots([day('2026-10-19', 0)], [], 'assembly');
  assert.equal(slots[0].isEmpty, false);
  assert.equal(slots[0].avgScore, 0);
  assert.equal(slots[0].assemblyAvg, 0);
});

test('10. buildCombinedTableRows sorts newest first, Assembly before C&C, skips empty dates', () => {
  const rows = buildCombinedTableRows(
    [day('2026-10-19', 80), day('2026-10-20', 90)],
    [day('2026-10-20', 60)],
    'both'
  );

  assert.deepEqual(rows.map(r => `${r.sheetLabel}:${r.date}`), [
    'Assembly:2026-10-20',
    'C&C:2026-10-20',
    'Assembly:2026-10-19'
  ]);

  const ccOnly = buildCombinedTableRows([day('2026-10-19', 80)], [day('2026-10-20', 60)], 'cc');
  assert.deepEqual(ccOnly.map(r => r.sheet), ['cc']);
});

test('11. Custom date range keeps only records within inclusive From/To bounds', () => {
  const records = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'].map((auditDate, i) => ({
    id: `rec-${i}`, section: 'assembly', unit: 'Bawal', auditDate
  }));

  const dates = (range) => aggregateSectionData(records, 'assembly', 'all', 'custom', range).dailyData.map(d => d.date);

  assert.deepEqual(dates({ from: '2026-10-19', to: '2026-10-20' }), ['2026-10-19', '2026-10-20']);
  assert.deepEqual(dates({ from: '2026-10-20', to: '' }), ['2026-10-20', '2026-10-21']);
  assert.deepEqual(dates({ from: '', to: '2026-10-18' }), ['2026-10-18']);
  assert.equal(dates({ from: '', to: '' }).length, 4);
});

const dated = (auditDate, extra = {}) => ({ id: auditDate, section: 'assembly', unit: 'Bawal', auditDate, ...extra });

test('12. A specific month key keeps only that month', () => {
  const records = ['2026-09-30', '2026-10-01', '2026-10-31', '2026-11-01'].map(d => dated(d));
  const dates = aggregateSectionData(records, 'assembly', 'all', '2026-10').dailyData.map(d => d.date);
  assert.deepEqual(dates, ['2026-10-01', '2026-10-31']);
});

test('13. Current month and day cutoffs use local time, not UTC', () => {
  // 1 Nov 2026, 02:00 local: UTC would still be 31 Oct in IST
  const now = new Date(2026, 10, 1, 2, 0, 0);
  assert.equal(toLocalDateStr(now), '2026-11-01');

  const records = ['2026-10-25', '2026-10-31', '2026-11-01'].map(d => dated(d));
  const month = aggregateSectionData(records, 'assembly', 'all', 'month', {}, now).dailyData.map(d => d.date);
  assert.deepEqual(month, ['2026-11-01']);

  const week = aggregateSectionData(records, 'assembly', 'all', '7d', {}, now).dailyData.map(d => d.date);
  assert.deepEqual(week, ['2026-10-25', '2026-10-31', '2026-11-01']);
});

test('14. extractAvailableMonths lists every month back to January of the earliest year, newest first', () => {
  const now = new Date(2026, 10, 3);

  // No old records: current month back to January of the previous year (11 + 12 months)
  const recent = extractAvailableMonths([dated('2026-10-02')], now);
  assert.equal(recent.length, 23);
  assert.deepEqual(recent[0], { key: '2026-11', label: 'November 2026' });
  assert.equal(recent[1].key, '2026-10');
  assert.equal(recent[2].key, '2026-09'); // included even with no audits
  assert.deepEqual(recent[recent.length - 1], { key: '2025-01', label: 'January 2025' });

  // Older records extend the list back to January of their year
  const older = extractAvailableMonths([dated('2023-06-15')], now);
  assert.equal(older[older.length - 1].key, '2023-01');
  assert.equal(older.length, 11 + 12 * 3);

  assert.equal(formatYearMonth('2026-01'), 'January 2026');
});

test('15. Shift scores are averaged per day; unaudited shifts are null; record.shifts fallback is kept', () => {
  const sheet = (shift, extra = {}) => ({ name: 's', ...(shift ? { shift } : {}), targetLevel: 'L3', ...extra });
  const records = [
    dated('2026-10-20', { sheets: [sheet('A'), sheet('A'), sheet('G')] }),
    dated('2026-10-20', { shifts: ['B'], sheets: [sheet(null)] })
  ];
  const [day] = aggregateSectionData(records, 'assembly', 'all', 'all').dailyData;
  assert.equal(day.shiftA, 2);
  assert.equal(day.shiftB, 1);
  assert.equal(day.shiftG, 1);
  assert.equal(day.shiftC, 0);
  assert.equal(typeof day.shiftAScore, 'number');
  assert.equal(typeof day.shiftBScore, 'number');
  assert.equal(day.shiftCScore, null);

  const [slot] = buildCombinedChartSlots([day], [], 'assembly');
  assert.equal(slot.shiftAScore, day.shiftAScore);
  assert.equal(slot.shiftCScore, null);
  assert.equal(slot.shiftGScore, day.shiftGScore);
});

test('16. Shift + level pairs get their own daily score', () => {
  const records = [
    dated('2026-10-20', { sheets: [{ shift: 'A', targetLevel: 'L3' }, { shift: 'A', targetLevel: 'L2' }, { shift: 'G', targetLevel: 'L1' }] })
  ];
  const [day] = aggregateSectionData(records, 'assembly', 'all', 'all').dailyData;
  assert.deepEqual(Object.keys(day.shiftLevelScores).sort(), ['A_L2', 'A_L3', 'G_L1']);
  Object.values(day.shiftLevelScores).forEach(v => assert.equal(typeof v, 'number'));

  const [slot] = buildCombinedChartSlots([day], [], 'assembly');
  assert.deepEqual(slot.shiftLevelScores, day.shiftLevelScores);
  const [empty] = buildCombinedChartSlots([], [day], 'assembly');
  assert.equal(empty, undefined);
});

test('17. Monthly and Yearly periods group records into month / year slots', () => {
  const now = new Date(2026, 10, 3);
  const records = ['2025-12-30', '2026-01-05', '2026-01-20', '2026-03-02', '2026-11-01'].map(d => dated(d));

  // Monthly: current year only, one slot per month
  const monthly = aggregateSectionData(records, 'assembly', 'all', 'year', {}, now, 'month').dailyData;
  assert.deepEqual(monthly.map(d => d.date), ['2026-01', '2026-03', '2026-11']);
  assert.deepEqual(monthly.map(d => d.formattedDate), ['January', 'March', 'November']);
  assert.equal(monthly[0].totalSheets, 2);

  // Yearly: all years, one slot per year
  const yearly = aggregateSectionData(records, 'assembly', 'all', 'all', {}, now, 'year').dailyData;
  assert.deepEqual(yearly.map(d => d.date), ['2025', '2026']);
  assert.deepEqual(yearly.map(d => d.totalSheets), [1, 4]);

  // Daily: current month, one slot per day
  const daily = aggregateSectionData(records, 'assembly', 'all', 'month', {}, now, 'day').dailyData;
  assert.deepEqual(daily.map(d => d.date), ['2026-11-01']);

  // Custom range + monthly grouping across years
  const custom = aggregateSectionData(records, 'assembly', 'all', 'custom', { from: '2025-12-01', to: '2026-01-31' }, now, 'month').dailyData;
  assert.deepEqual(custom.map(d => d.date), ['2025-12', '2026-01']);
  assert.equal(formatPeriodLabel('2025-12', now), 'Dec 2025');

  // Chart slots keep the period label
  const slots = buildCombinedChartSlots(monthly, [], 'assembly');
  assert.equal(slots[0].date, '2026-01');
});
