import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSkillSplit, buildHierarchicalData } from './efficiencyMath.js';
import {
    skillSplitSheet, groupSheet, operatorSheet, countOperatorsByGroup, describeFilters,
    buildEfficiencyWorkbook, safeSheetName, safeFileName,
} from './efficiencyExcelExport.js';

const t = (k) => k;
const labels = {
    t,
    shiftName: (k) => `Shift ${k}`,
    shiftColor: () => '#2563eb',
    manpowerName: (n) => n,
    statusName: (s) => s,
    totalColor: '#f59e0b',
    presentColor: '#2563eb',
};
const meta = { dateText: 'Date: 2026-09-01 to 2026-09-02', filtersText: 'None', presentNote: '' };

const op = (userId, eff, isSkilled, extra = {}) => ({
    userId, currentEffeciency: eff, isSkilled,
    departmentId: 1, departmentName: 'Assembly', sectionId: 10, sectionName: 'S1',
    lineId: 100, lineName: 'L1', subSectionId: 1000, subSectionName: 'SS1', ...extra,
});
const users = [op(1, 80, true), op(2, 40, false), op(3, 60, true, {
    departmentId: 2, departmentName: 'Moulding', sectionId: 20, sectionName: 'S2',
    lineId: 200, lineName: 'L2', subSectionId: 2000, subSectionName: 'SS2',
})];
const rows = [
    { ...users[0], attendanceDate: 'd1', logStatus: 'Present', shift: 'A' },
    { ...users[1], attendanceDate: 'd1', logStatus: 'Present', shift: 'B' },
    { ...users[2], attendanceDate: 'd1', logStatus: 'Present', shift: 'A' },
];
const near = (a, b) => assert.ok(Math.abs(a - b) <= 0.0001, `${a} ≈ ${b}`);

test('Chart 1 sheet: three manpower rows, percentages as fractions, shift columns', () => {
    const spec = skillSplitSheet({ name: 'Manpower', title: 'T', rows: buildSkillSplit(users, rows, 1), shiftKeys: ['A', 'B'], labels, meta });
    assert.deepEqual(spec.rows.map(r => r.type), ['Total Manpower', 'Skilled Manpower', 'Unskilled Manpower']);
    const [total, skilled, unskilled] = spec.rows;
    near(total.total, 0.6);                       // (80 + 40 + 60) / 3 = 60%
    near(skilled.total + unskilled.total, total.total);
    near(total.shift_A + total.shift_B, total.present);
    assert.equal(total.operators, 3);
    assert.equal(total.count_A, 2);
    assert.ok(spec.columns.some(c => c.key === 'shift_B'));
});

test('group sheet: per-group Total/Skilled/Unskilled rows, operator counts and averages', () => {
    const groups = buildHierarchicalData(users, rows, 'department', [], 1);
    const spec = groupSheet({
        name: 'Department', title: 'T', groupHeader: 'Department', groups,
        operatorCounts: countOperatorsByGroup(users, 'department'), shiftKeys: ['A', 'B'], labels, meta,
    });
    assert.equal(spec.rows.length, groups.length * 3);
    const assembly = spec.rows.filter(r => r.group === 'Assembly');
    assert.deepEqual(assembly.map(r => r.operators), [2, 1, 1]);
    near(assembly[1].total + assembly[2].total, assembly[0].total);
    assert.equal(spec.footerRows.length, 3);
    assert.equal(spec.footerRows[0].operators, 3);
});

test('operator sheet looks up org fields and labels skill', () => {
    const userById = new Map(users.map(u => [u.userId, { ...u, levelName: 'L2' }]));
    const spec = operatorSheet({
        name: 'Operators', title: 'T', userById, labels, meta,
        operators: [{ id: 1, name: 'A', empId: 'E1', efficiency: 135, status: 'Present', shift: 'A' }],
    });
    assert.equal(spec.rows[0].department, 'Assembly');
    assert.equal(spec.rows[0].skill, 'Skilled Manpower');
    near(spec.rows[0].efficiency, 1.35);           // uncapped, as Chart 6 shows it
    assert.equal(spec.rows[0].shift, 'Shift A');
});

test('filters are described by name', () => {
    const text = describeFilters({
        filter: { deptIds: ['1'], shifts: ['A'] },
        deptOpts: [{ value: '1', label: 'Assembly' }], shiftName: (k) => `Shift ${k}`, t,
    });
    assert.equal(text, 'nav.department: Assembly · charts.shift: Shift A');
    assert.equal(describeFilters({ filter: {}, shiftName: String, t }), 'charts.noFiltersApplied');
});

test('workbook: title, frozen header, % format, merged group cells', async () => {
    const groups = buildHierarchicalData(users, rows, 'department', [], 1);
    const spec = groupSheet({ name: 'Department', title: 'Dept Title', groupHeader: 'Department', groups, shiftKeys: ['A'], labels, meta });
    const wb = await buildEfficiencyWorkbook([spec]);
    const ws = wb.getWorksheet('Department');
    assert.equal(ws.getCell(1, 1).value, 'Dept Title');
    const headerRowNo = spec.meta.length + 3;
    assert.equal(ws.getCell(headerRowNo, 1).value, 'Department');
    assert.equal(ws.views[0].ySplit, headerRowNo);
    assert.equal(ws.getCell(headerRowNo + 1, 3).numFmt, '0.00%');
    // First group's name spans its three rows
    assert.equal(ws.getCell(headerRowNo + 2, 1).master.address, ws.getCell(headerRowNo + 1, 1).address);
    const buffer = await wb.xlsx.writeBuffer();
    assert.ok(buffer.byteLength > 1000);
});

test('sheet and file names are made safe', () => {
    assert.equal(safeSheetName('Line/Sub: [A]*?'), 'Line Sub   A');
    assert.ok(safeSheetName('x'.repeat(40)).length <= 31);
    assert.equal(safeFileName('Efficiency Department 2026-09-01 to 2026-09-30'), 'Efficiency_Department_2026-09-01_to_2026-09-30');
});
