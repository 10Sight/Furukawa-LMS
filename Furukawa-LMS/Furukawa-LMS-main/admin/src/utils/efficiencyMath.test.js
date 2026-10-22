import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateUserEfficiency, chartEfficiency, countLoggedDays, buildSkillSplit, buildHierarchicalData } from './efficiencyMath.js';

const op = (userId, eff, isSkilled, extra = {}) => ({
    userId, currentEffeciency: eff, isSkilled,
    departmentId: 1, departmentName: 'Assembly', sectionId: 10, sectionName: 'S1',
    lineId: 100, lineName: 'L1', subSectionId: 1000, subSectionName: 'SS1', ...extra,
});
const att = (user, date, logStatus = 'Present') => ({ ...user, attendanceDate: date, logStatus });
const byName = (rows) => Object.fromEntries(rows.map(r => [r.name, r]));
const near = (a, b) => assert.ok(Math.abs(a - b) <= 0.01, `${a} ≈ ${b}`);

test('Charts 1–5 count an operator at most 100%; Chart 6 keeps the real value', () => {
    assert.equal(calculateUserEfficiency(op(1, 135, true)), 135);
    assert.equal(chartEfficiency(op(1, 135, true)), 100);
    assert.equal(chartEfficiency(op(1, 80, true)), 80);
});

test('logged days count only dates in range that have attendance', () => {
    const u = op(1, 50, false);
    const rows = [att(u, '2026-10-01'), att(u, '2026-10-02'), att(op(2, 50, false), '2026-10-02'), att(u, '2026-10-09')];
    assert.equal(countLoggedDays(rows, '2026-10-01', '2026-10-05'), 2);
    assert.equal(countLoggedDays(rows, '2026-10-06', '2026-10-08'), 0);
});

test('a single day matches the per-day formula, and over-100 operators keep every bar ≤ 100', () => {
    const users = [op(1, 135, true), op(2, 120, false)];
    const rows = byName(buildSkillSplit(users, users.map(u => att(u, '2026-10-01')), 1));
    assert.equal(rows['Total Manpower'].total, 100);
    assert.equal(rows['Total Manpower'].present, 100);
    assert.equal(rows['Unskilled Manpower'].total + rows['Skilled Manpower'].total, 100);
});

test('Present over a range is the per-day average, not the sum of every day', () => {
    const a = op(1, 80, true);
    const b = op(2, 40, false);
    // 3 logged days: a present every day, b present on one day
    const rows = [
        att(a, '2026-10-01'), att(a, '2026-10-02'), att(a, '2026-10-03'),
        att(b, '2026-10-02'), att(b, '2026-10-01', 'Absent'), att(b, '2026-10-03', 'Absent'),
    ];
    const split = byName(buildSkillSplit([a, b], rows, 3));
    // Total = (80 + 40) / 2 = 60; Present = ((80) + (80 + 40) + (80)) / (2 × 3) = 46.67
    assert.equal(split['Total Manpower'].total, 60);
    assert.equal(split['Total Manpower'].present, 46.67);
    assert.ok(split['Total Manpower'].present <= split['Total Manpower'].total);
    assert.equal(split['Total Manpower'].presentCount, 2);
});

test('Unskilled + Skilled adds up to Total and Present', () => {
    const users = [op(1, 91.3, true), op(2, 47.7, false), op(3, 66.1, true), op(4, 12.9, false), op(5, 101, false)];
    const rows = [att(users[0], 'd1'), att(users[1], 'd1'), att(users[3], 'd2'), att(users[4], 'd2'), att(users[2], 'd2')];
    const split = byName(buildSkillSplit(users, rows, 2));
    const t = split['Total Manpower'], u = split['Unskilled Manpower'], s = split['Skilled Manpower'];
    near(u.total + s.total, t.total);
    near(u.present + s.present, t.present);
});

test('Chart 1 bars run Total, then Skilled, then Unskilled', () => {
    const users = [op(1, 80, true), op(2, 40, false)];
    const names = buildSkillSplit(users, users.map(u => att(u, 'd1')), 1).map(r => r.name);
    assert.deepEqual(names, ['Total Manpower', 'Skilled Manpower', 'Unskilled Manpower']);
});

test('Present only counts operators in the Total population (shift filter mismatch)', () => {
    const inTotal = op(1, 90, true);
    const notInTotal = op(2, 90, true);
    const split = byName(buildSkillSplit([inTotal], [att(inTotal, 'd1'), att(notInTotal, 'd1')], 1));
    assert.equal(split['Total Manpower'].present, 90);
    assert.ok(split['Total Manpower'].present <= split['Total Manpower'].total);
});

const sumShifts = (byShift) => Object.values(byShift || {}).reduce((a, b) => a + b, 0);

test('Chart 1 shift breakdown adds up to Present for Total, Skilled and Unskilled', () => {
    const users = [op(1, 91.3, true), op(2, 47.7, false), op(3, 66.1, true), op(4, 12.9, false), op(5, 101, false)];
    const rows = [
        { ...att(users[0], 'd1'), shift: 'A' }, { ...att(users[1], 'd1'), shift: 'B' }, { ...att(users[2], 'd1'), shift: 'A' },
        { ...att(users[3], 'd2'), shift: 'C' }, { ...att(users[4], 'd2'), shift: null }, { ...att(users[0], 'd2'), shift: 'B' },
    ];
    const split = buildSkillSplit(users, rows, 2);
    split.forEach(r => near(sumShifts(r.presentByShift), r.present));
    const total = byName(split)['Total Manpower'];
    assert.deepEqual(Object.keys(total.presentByShift).sort(), ['A', 'B', 'C', 'UNASSIGNED']);
    // Operator 1 worked A on d1 and B on d2, so counts in both
    assert.deepEqual(total.presentCountByShift, { A: 2, B: 2, C: 1, UNASSIGNED: 1 });
});

test('hierarchical shift breakdown adds up at every level, with missing shifts counted as 0', () => {
    const users = [
        op(1, 80, true), op(2, 60, false),
        op(3, 70, true, { subSectionId: 1001, subSectionName: 'SS2', lineId: 101, lineName: 'L2' }),
        op(4, 30, false, { subSectionId: 1001, subSectionName: 'SS2', lineId: 101, lineName: 'L2' }),
    ];
    // SS1 works only shift A; SS2 works A and B
    const rows = [
        { ...att(users[0], 'd1'), shift: 'A' }, { ...att(users[1], 'd1'), shift: 'A' },
        { ...att(users[2], 'd1'), shift: 'A' }, { ...att(users[3], 'd1'), shift: 'B' },
    ];
    for (const level of ['subsection', 'line', 'section', 'department']) {
        buildHierarchicalData(users, rows, level, [], 1).forEach(r => {
            near(sumShifts(r.presShift), r.presEfficiency);
            near(sumShifts(r.presUnskilledShift), r.presUnskilled);
            near(sumShifts(r.presSkilledShift), r.presSkilled);
        });
    }
    // Section = avg of L1 (A 70) and L2 (A 35, B 15): B averages 15 with L1's 0, not 15 alone
    const [section] = buildHierarchicalData(users, rows, 'section', [], 1);
    assert.equal(section.presShift.A, 52.5);
    assert.equal(section.presShift.B, 7.5);
});

test('hierarchical rollup: per-day Present, capped values, and Unskilled + Skilled = group', () => {
    const users = [
        op(1, 130, true), op(2, 60, false),
        op(3, 70, true, { subSectionId: 1001, subSectionName: 'SS2' }), op(4, 30, false, { subSectionId: 1001, subSectionName: 'SS2' }),
    ];
    const rows = ['d1', 'd2'].flatMap(d => users.map(u => att(u, d)));
    for (const level of ['subsection', 'line', 'section', 'department']) {
        const out = buildHierarchicalData(users, rows, level, [], 2);
        out.forEach(r => {
            assert.ok(r.allEfficiency <= 100 && r.presEfficiency <= 100, `${level} ${r.name} ≤ 100`);
            assert.ok(r.presEfficiency <= r.allEfficiency, `${level} present ≤ total`);
            near(r.allUnskilled + r.allSkilled, r.allEfficiency);
            near(r.presUnskilled + r.presSkilled, r.presEfficiency);
        });
    }
    // Everyone present both days → Present equals Total (not 2× Total)
    const ss = byName(buildHierarchicalData(users, rows, 'subsection', [], 2));
    assert.equal(ss.SS1.allEfficiency, 80);   // (100 capped + 60) / 2
    assert.equal(ss.SS1.presEfficiency, 80);
});
