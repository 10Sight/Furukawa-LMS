// Excel export for the Manpower Efficiency charts (EfficiencyChart.jsx).
//
// The *Sheet builders are pure: they turn a chart's data into a sheet spec
// ({ name, title, meta, columns, rows, mergeColumn }) so they can be tested without ExcelJS.
// exportEfficiencyWorkbook writes one or more specs to a styled .xlsx and downloads it;
// ExcelJS (~1 MB) is only loaded on the first download.
//
// Chart figures are percentages (0–100); they are written as fractions with a % format so
// Excel sorts and sums them as numbers.

import { getAvg } from "./efficiencyMath.js";

// ─── Group keys (must match buildHierarchicalData's ids) ──────────────────────
const GROUP_ID_OF = {
    department: (op) => String(op.departmentId || op.departmentName || ''),
    section: (op) => String(op.sectionId || op.sectionName || ''),
    line: (op) => String(op.lineId || op.lineName || ''),
    subsection: (op) => String(op.subSectionId || op.subSectionName || ''),
};

// { groupId: { total, skilled, unskilled } } operator counts for a chart's population
export const countOperatorsByGroup = (opsAll, level) => {
    const idOf = GROUP_ID_OF[level];
    return opsAll.reduce((acc, op) => {
        const id = idOf(op);
        if (!id) return acc;
        const c = (acc[id] ||= { total: 0, skilled: 0, unskilled: 0 });
        c.total += 1;
        if (op.isSkilled) c.skilled += 1; else c.unskilled += 1;
        return acc;
    }, {});
};

const pct = (v) => (v == null ? 0 : Math.round(Number(v) * 100) / 10000);

// Filter row text: "Department: Assembly, Moulding · Shift: Shift A" (ids shown by their names)
export const describeFilters = ({ filter, deptOpts = [], sectionOpts = [], lineOpts = [], subSectionOpts = [], shiftName, t }) => {
    const names = (ids, opts) => ids.map(id => opts.find(o => o.value === id)?.label ?? id).join(', ');
    const parts = [];
    if (filter.deptIds?.length) parts.push(`${t('nav.department')}: ${names(filter.deptIds, deptOpts)}`);
    if (filter.sectionIds?.length) parts.push(`${t('charts.section')}: ${names(filter.sectionIds, sectionOpts)}`);
    if (filter.lineIds?.length) parts.push(`${t('charts.line')}: ${names(filter.lineIds, lineOpts)}`);
    if (filter.subSectionIds?.length) parts.push(`${t('charts.subsection')}: ${names(filter.subSectionIds, subSectionOpts)}`);
    if (filter.shifts?.length) parts.push(`${t('charts.shift')}: ${filter.shifts.map(shiftName).join(', ')}`);
    return parts.length ? parts.join(' · ') : t('charts.noFiltersApplied');
};

// Title-block rows shared by every sheet; `actualNote` explains Actual vs Considered (Charts 1–5)
const baseMeta = ({ dateText, filtersText, presentNote, t }, actualNote = false) => [
    [t('charts.date'), dateText.replace(/^[^:]*:\s*/, '')],
    [t('charts.filtersApplied'), filtersText],
    ...(presentNote ? [['', presentNote]] : []),
    ...(actualNote ? [['', t('charts.actualVsConsideredNote')]] : []),
    [t('charts.generatedAt'), new Date().toLocaleString()],
];

// Charts 1–5 efficiency columns: Actual (no cap) before Considered (each operator capped at
// 100%, the figure the charts plot). Actual headers use a darker shade of the chart colour.
const ACTUAL_TOTAL_COLOR = '#b45309';
const ACTUAL_PRESENT_COLOR = '#1e3a8a';
const efficiencyColumns = (t, labels) => [
    { header: t('charts.actualTotalEff'), key: 'actualTotal', type: 'percent', color: ACTUAL_TOTAL_COLOR },
    { header: t('charts.consideredTotalEff'), key: 'total', type: 'percent', color: labels.totalColor },
    { header: t('charts.actualPresentEff'), key: 'actualPresent', type: 'percent', color: ACTUAL_PRESENT_COLOR },
    { header: t('charts.consideredPresentEff'), key: 'present', type: 'percent', color: labels.presentColor },
];

const shiftColumns = (shiftKeys, labels, keyOf = (k) => `shift_${k}`) =>
    shiftKeys.map(k => ({ header: `${labels.t('charts.consideredPresentEff')} · ${labels.shiftName(k)}`, key: keyOf(k), type: 'percent', color: labels.shiftColor(k) }));

const shiftValues = (shiftKeys, byShift = {}) =>
    Object.fromEntries(shiftKeys.map(k => [`shift_${k}`, pct(Math.max(0, byShift[k] || 0))]));

// ─── Chart 1: Total / Skilled / Unskilled manpower ────────────────────────────
// `actualRows`: the same split computed without the 100% cap (matched by row name)
export const skillSplitSheet = ({ name, title, rows, actualRows = [], shiftKeys, labels, meta }) => {
    const { t } = labels;
    const actualByName = new Map(actualRows.map(r => [r.name, r]));
    return {
        name, title, meta: baseMeta({ ...meta, t }, true),
        columns: [
            { header: t('charts.manpowerType'), key: 'type', type: 'text' },
            ...efficiencyColumns(t, labels),
            ...shiftColumns(shiftKeys, labels),
            { header: t('charts.operators'), key: 'operators', type: 'count' },
            { header: t('charts.evaluated'), key: 'evaluated', type: 'count' },
            { header: t('charts.notEvaluatedCount'), key: 'notEvaluated', type: 'count' },
            { header: t('charts.presentOperators'), key: 'presentCount', type: 'count' },
            ...shiftKeys.map(k => ({ header: `${t('charts.presentOperators')} · ${labels.shiftName(k)}`, key: `count_${k}`, type: 'count', color: labels.shiftColor(k) })),
        ],
        rows: rows.map(r => ({
            type: labels.manpowerName(r.name),
            actualTotal: pct(actualByName.get(r.name)?.total ?? r.total),
            total: pct(r.total),
            actualPresent: pct(actualByName.get(r.name)?.present ?? r.present),
            present: pct(r.present),
            ...shiftValues(shiftKeys, r.presentByShift),
            operators: r.totalCount,
            evaluated: r.evaluated,
            notEvaluated: Math.max(0, r.totalCount - r.evaluated),
            presentCount: r.presentCount,
            ...Object.fromEntries(shiftKeys.map(k => [`count_${k}`, r.presentCountByShift?.[k] || 0])),
        })),
    };
};

// ─── Charts 2–5: per group, Total / Skilled / Unskilled rows ──────────────────
const SKILL_ROWS = [
    { name: 'Total Manpower', total: 'allEfficiency', present: 'presEfficiency', shift: 'presShift', count: 'total' },
    { name: 'Skilled Manpower', total: 'allSkilled', present: 'presSkilled', shift: 'presSkilledShift', count: 'skilled' },
    { name: 'Unskilled Manpower', total: 'allUnskilled', present: 'presUnskilled', shift: 'presUnskilledShift', count: 'unskilled' },
];

// `actualGroups`: the same rollup computed without the 100% cap (matched by group id)
export const groupSheet = ({ name, title, groupHeader, groups, actualGroups = [], operatorCounts = {}, shiftKeys, labels, meta }) => {
    const { t } = labels;
    const actualById = new Map(actualGroups.map(g => [g.id, g]));
    const actualOf = (g) => actualById.get(g.id) || g;
    const rows = groups.flatMap(g => SKILL_ROWS.map(s => ({
        _groupId: g.id, // merge key: two groups can share a name (e.g. "Line 1" in two sections)
        group: g.name,
        type: labels.manpowerName(s.name),
        actualTotal: pct(actualOf(g)[s.total]),
        total: pct(g[s.total]),
        actualPresent: pct(actualOf(g)[s.present]),
        present: pct(g[s.present]),
        ...shiftValues(shiftKeys, g[s.shift]),
        operators: operatorCounts[g.id]?.[s.count] || 0,
    })));
    // Average across groups, as in the chart's stats panel
    const averages = groups.length ? SKILL_ROWS.map(s => ({
        _groupId: '__average__',
        group: t('charts.average'),
        type: labels.manpowerName(s.name),
        actualTotal: pct(getAvg(groups.map(g => actualOf(g)[s.total] ?? 0))),
        total: pct(getAvg(groups.map(g => g[s.total] ?? 0))),
        actualPresent: pct(getAvg(groups.map(g => actualOf(g)[s.present] ?? 0))),
        present: pct(getAvg(groups.map(g => g[s.present] ?? 0))),
        ...Object.fromEntries(shiftKeys.map(k => [`shift_${k}`, pct(Math.max(0, getAvg(groups.map(g => g[s.shift]?.[k] || 0))))])),
        operators: groups.reduce((sum, g) => sum + (operatorCounts[g.id]?.[s.count] || 0), 0),
    })) : [];
    return {
        name, title, meta: baseMeta({ ...meta, t }, true),
        mergeColumn: 'group',
        columns: [
            { header: groupHeader, key: 'group', type: 'text', wrap: true },
            { header: t('charts.manpowerType'), key: 'type', type: 'text' },
            ...efficiencyColumns(t, labels),
            ...shiftColumns(shiftKeys, labels),
            { header: t('charts.operators'), key: 'operators', type: 'count' },
        ],
        rows,
        footerRows: averages,
    };
};

// ─── Chart 6: one row per operator ────────────────────────────────────────────
export const operatorSheet = ({ name, title, operators, userById, labels, meta }) => {
    const { t } = labels;
    return {
        name, title, meta: baseMeta({ ...meta, t }),
        columns: [
            { header: t('charts.empId'), key: 'empId', type: 'text' },
            { header: t('charts.operator'), key: 'name', type: 'text' },
            { header: t('nav.department'), key: 'department', type: 'text' },
            { header: t('charts.section'), key: 'section', type: 'text' },
            { header: t('charts.line'), key: 'line', type: 'text' },
            { header: t('charts.subsection'), key: 'subSection', type: 'text' },
            { header: t('charts.level'), key: 'level', type: 'text' },
            { header: t('charts.skill'), key: 'skill', type: 'text' },
            { header: t('charts.efficiency'), key: 'efficiency', type: 'percent', color: labels.presentColor },
            { header: t('charts.attendance'), key: 'attendance', type: 'text' },
            { header: t('charts.shift'), key: 'shift', type: 'text' },
        ],
        rows: operators.map(op => {
            const u = userById.get(op.id) || {};
            return {
                empId: op.empId,
                name: op.name,
                department: u.departmentName || '',
                section: u.sectionName || '',
                line: u.lineName || '',
                subSection: u.subSectionName || '',
                level: u.levelName || '',
                skill: labels.manpowerName(u.isSkilled ? 'Skilled Manpower' : 'Unskilled Manpower'),
                efficiency: pct(op.efficiency),
                attendance: labels.statusName(op.status),
                shift: op.shift ? labels.shiftName(op.shift) : '',
            };
        }),
    };
};

// ─── Workbook writer ──────────────────────────────────────────────────────────
const argb = (hex) => `FF${String(hex || '#1e293b').replace('#', '').toUpperCase()}`;
const BORDER = { style: 'thin', color: { argb: 'FFE2E8F0' } };
const CELL_BORDER = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
const HEADER_FILL = '#1e293b';
const ZEBRA_FILL = 'FFF8FAFC';
const MIN_WIDTH = 10;
const MAX_WIDTH = 45;

// Excel sheet names: ≤ 31 chars, none of : \ / ? * [ ]
export const safeSheetName = (name) => String(name).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || 'Sheet';
export const safeFileName = (name) => String(name).replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

const writeSheet = (workbook, spec) => {
    const { columns, rows, footerRows = [], meta = [], mergeColumn } = spec;
    const lastCol = columns.length;
    const ws = workbook.addWorksheet(safeSheetName(spec.name));

    // Title and meta block
    ws.mergeCells(1, 1, 1, lastCol);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = spec.title;
    titleCell.font = { bold: true, size: 14, color: { argb: argb(HEADER_FILL) } };
    ws.getRow(1).height = 24;
    meta.forEach(([label, value], i) => {
        const r = 2 + i;
        ws.getCell(r, 1).value = label;
        ws.getCell(r, 1).font = { bold: true, color: { argb: 'FF475569' } };
        if (lastCol > 1) ws.mergeCells(r, 2, r, lastCol);
        ws.getCell(r, 2).value = value;
        ws.getCell(r, 2).font = { color: { argb: 'FF334155' } };
    });

    // Header row (one blank row after the meta block)
    const headerRowNo = meta.length + 3;
    const header = ws.getRow(headerRowNo);
    columns.forEach((col, i) => {
        const cell = header.getCell(i + 1);
        cell.value = col.header;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(col.color || HEADER_FILL) } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = CELL_BORDER;
    });
    header.height = 32;

    // Data rows, then footer (average) rows
    const writeRow = (row, rowNo, { zebra, footer }) => {
        const xlRow = ws.getRow(rowNo);
        columns.forEach((col, i) => {
            const cell = xlRow.getCell(i + 1);
            cell.value = row[col.key] ?? (col.type === 'text' ? '' : 0);
            cell.border = CELL_BORDER;
            if (col.type === 'percent') cell.numFmt = '0.00%';
            if (col.type === 'count') cell.numFmt = '0';
            cell.alignment = {
                vertical: 'middle',
                horizontal: col.type === 'text' ? 'left' : 'right',
                wrapText: !!col.wrap,
            };
            if (footer) cell.font = { bold: true };
            if (zebra || footer) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: footer ? 'FFF1F5F9' : ZEBRA_FILL } };
        });
    };
    const firstDataRow = headerRowNo + 1;
    rows.forEach((row, i) => writeRow(row, firstDataRow + i, { zebra: i % 2 === 1 }));
    const firstFooterRow = firstDataRow + rows.length;
    footerRows.forEach((row, i) => writeRow(row, firstFooterRow + i, { footer: true }));

    // Merge each group's run of rows (e.g. a department's three manpower rows) in mergeColumn,
    // keyed by _groupId when rows carry one
    if (mergeColumn) {
        const colNo = columns.findIndex(c => c.key === mergeColumn) + 1;
        const all = [...rows, ...footerRows];
        const keyOf = (r) => r._groupId ?? r[mergeColumn];
        let start = 0;
        for (let i = 1; i <= all.length; i++) {
            if (i === all.length || keyOf(all[i]) !== keyOf(all[start])) {
                if (i - start > 1) ws.mergeCells(firstDataRow + start, colNo, firstDataRow + i - 1, colNo);
                start = i;
            }
        }
    }

    // Frozen header, filter buttons, fitted column widths
    ws.views = [{ state: 'frozen', ySplit: headerRowNo }];
    if (rows.length) ws.autoFilter = { from: { row: headerRowNo, column: 1 }, to: { row: headerRowNo + rows.length, column: lastCol } };
    columns.forEach((col, i) => {
        const longest = Math.max(
            ...String(col.header).split(' ').map(w => w.length),
            ...[...rows, ...footerRows].map(r => (col.type === 'text' ? String(r[col.key] ?? '').length : 9)),
        );
        ws.getColumn(i + 1).width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longest + 2));
    });
    return ws;
};

const loadExcelJS = async () => {
    const mod = await import('exceljs');
    return mod.Workbook ? mod : (mod.default || mod);
};

export const buildEfficiencyWorkbook = async (specs) => {
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Furukawa LMS';
    workbook.created = new Date();
    specs.forEach(spec => writeSheet(workbook, spec));
    return workbook;
};

// Builds the workbook and starts the browser download
export const exportEfficiencyWorkbook = async (specs, fileName) => {
    const workbook = await buildEfficiencyWorkbook(specs);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFileName(fileName) || 'Efficiency'}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
