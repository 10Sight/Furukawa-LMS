import { getRequiredForDay, otHoursToMandays } from "../utils/manpowerPresence.js";

// Builds the Daily Manpower Report matrix from stored per-department figures. Pure: no DB access.
//
// Row rules (confirmed with HR):
// - Department, "Other" and Training rows: OT Mandays = ROUND(OT hours / 8); Gap = Present - Required,
//   Required being Indent 01 (FN01) for days 1-15 and Indent 16 (FN02) from day 16.
// - Group Total and Grand Total rows are plain SUMs of the rows they cover, for every column,
//   Mandays and Gap included (never recomputed from hours).
// - Grand Total = SUM of every group Total + Training.

export const OTHER_LABEL = "Other";
export const TRAINING_LABEL = "Training";
export const GRAND_TOTAL_LABEL = "Grand Total";
export const TOTAL_LABEL = "Total";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const emptyCell = () => ({ required: 0, present: 0, otHrs: 0, otMandays: 0, gap: 0 });

const sumCells = (cells) => {
    const present = cells.filter(Boolean);
    if (!present.length) return null;
    return present.reduce((acc, c) => ({
        required: acc.required + c.required,
        present: acc.present + c.present,
        otHrs: round2(acc.otHrs + c.otHrs),
        otMandays: acc.otMandays + c.otMandays,
        gap: acc.gap + c.gap,
    }), emptyCell());
};

const sumRows = (rows, dates, base) => ({
    ...base,
    requiredFN01: rows.reduce((s, r) => s + r.requiredFN01, 0),
    requiredFN02: rows.reduce((s, r) => s + r.requiredFN02, 0),
    cells: Object.fromEntries(dates.map((d) => [d, sumCells(rows.map((r) => r.cells[d]))])),
});

export const listMonthDates = (year, monthNumber, { upTo = null } = {}) => {
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const dates = [];
    for (let day = 1; day <= lastDay; day++) {
        const date = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (upTo && date > upTo) break;
        dates.push(date);
    }
    return dates;
};

const dayOf = (date) => Number(String(date).slice(8, 10));

const compareDepartments = (a, b) => {
    const ao = a.sortOrder === null ? Number.MAX_SAFE_INTEGER : a.sortOrder;
    const bo = b.sortOrder === null ? Number.MAX_SAFE_INTEGER : b.sortOrder;
    if (ao !== bo) return ao - bo;
    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
};

/**
 * @param {object} input
 * @param {number} input.year
 * @param {number} input.monthNumber
 * @param {string[]} input.dates                  YYYY-MM-DD, ascending
 * @param {Array}  input.departments              DailyManpowerConfig.getDepartmentsWithConfig()
 * @param {Array}  input.storedRows               DailyHrMeetingDaily.getRows()
 * @param {Map}    input.meta                     DailyHrMeetingDaily.getMeta()
 * @param {{requiredFN01:number, requiredFN02:number, entries: Map}} input.training
 */
export const buildMonthlyReport = ({ year, monthNumber, dates, departments, storedRows, meta, training }) => {
    const computedDates = new Set(dates.filter((d) => meta.has(d)));

    // departmentId -> date -> stored row
    const storedByDept = new Map();
    for (const r of storedRows) {
        if (!storedByDept.has(r.departmentId)) storedByDept.set(r.departmentId, new Map());
        storedByDept.get(r.departmentId).set(r.reportDate, r);
    }

    const latestComputedDate = [...computedDates].sort().pop() || null;

    const departmentRow = (dep) => {
        const stored = storedByDept.get(dep.departmentId) || new Map();
        const latest = latestComputedDate ? stored.get(latestComputedDate) : null;
        const cells = {};
        for (const date of dates) {
            if (!computedDates.has(date)) { cells[date] = null; continue; }
            const s = stored.get(date);
            // Every department is stored for every computed date; a missing row means the
            // department did not exist yet when the date was computed, so it counts as zero.
            cells[date] = s
                ? { required: s.requiredForDay, present: s.presentCount, otHrs: round2(s.otHrs), otMandays: s.otMandays, gap: s.gap }
                : emptyCell();
        }
        return {
            key: `dept-${dep.departmentId}`,
            kind: "department",
            label: dep.displayName || dep.departmentName,
            departmentIds: [dep.departmentId],
            requiredFN01: latest?.requiredFN01 || 0,
            requiredFN02: latest?.requiredFN02 || 0,
            cells,
        };
    };

    // "Other" is a row, not a total: present / OT / required are summed, then Mandays and Gap are
    // derived from the summed figures exactly as for a single department.
    const otherRow = (groupName, deptRows) => {
        const summed = sumRows(deptRows, dates, {});
        const cells = {};
        for (const date of dates) {
            const c = summed.cells[date];
            cells[date] = c
                ? { required: c.required, present: c.present, otHrs: c.otHrs, otMandays: otHoursToMandays(c.otHrs), gap: c.present - c.required }
                : null;
        }
        return {
            key: `other-${groupName}`,
            kind: "other",
            label: OTHER_LABEL,
            departmentIds: deptRows.flatMap((r) => r.departmentIds),
            mergedLabels: deptRows.map((r) => r.label),
            requiredFN01: summed.requiredFN01,
            requiredFN02: summed.requiredFN02,
            cells,
        };
    };

    const visible = departments.filter((d) => !d.isHidden);
    const groupsByName = new Map();
    for (const dep of visible) {
        const name = dep.groupName || "MAIN";
        if (!groupsByName.has(name)) groupsByName.set(name, { name, groupSortOrder: dep.groupSortOrder || 0, deps: [] });
        const g = groupsByName.get(name);
        g.groupSortOrder = Math.min(g.groupSortOrder, dep.groupSortOrder || 0);
        g.deps.push(dep);
    }

    const groups = [...groupsByName.values()]
        .sort((a, b) => (a.groupSortOrder - b.groupSortOrder) || (a.name === "MAIN" ? -1 : b.name === "MAIN" ? 1 : a.name.localeCompare(b.name)))
        .map((g) => {
            const own = g.deps.filter((d) => !d.isOther)
                .map((d) => ({ dep: d, row: departmentRow(d) }))
                .map(({ dep, row }) => ({ ...row, sortOrder: dep.sortOrder }))
                .sort(compareDepartments)
                .map(({ sortOrder, ...row }) => row);
            const merged = g.deps.filter((d) => d.isOther).map(departmentRow);
            const rows = merged.length ? [...own, otherRow(g.name, merged)] : own;
            const total = sumRows(rows, dates, {
                key: `total-${g.name}`,
                kind: "groupTotal",
                label: TOTAL_LABEL,
                groupName: g.name,
            });
            return { name: g.name, rows, total };
        });

    const trainingCells = {};
    for (const date of dates) {
        const entry = training.entries.get(date) || { presentCount: 0, otHrs: 0 };
        const required = getRequiredForDay(dayOf(date), training.requiredFN01, training.requiredFN02);
        const otHrs = round2(entry.otHrs);
        trainingCells[date] = {
            required,
            present: Number(entry.presentCount) || 0,
            otHrs,
            otMandays: otHoursToMandays(otHrs),
            gap: (Number(entry.presentCount) || 0) - required,
        };
    }
    const trainingRow = {
        key: "training",
        kind: "training",
        label: TRAINING_LABEL,
        departmentIds: [],
        requiredFN01: Number(training.requiredFN01) || 0,
        requiredFN02: Number(training.requiredFN02) || 0,
        cells: trainingCells,
    };

    const grandTotal = sumRows([...groups.map((g) => g.total), trainingRow], dates, {
        key: "grand-total",
        kind: "grandTotal",
        label: GRAND_TOTAL_LABEL,
    });
    // A date with no stored figures has no meaningful grand total (only Training would be in it).
    for (const date of dates) {
        if (!computedDates.has(date)) grandTotal.cells[date] = null;
    }

    const dateInfo = dates.map((date) => {
        const m = meta.get(date);
        return {
            date,
            day: dayOf(date),
            computed: Boolean(m),
            isHoliday: Boolean(m?.isHoliday),
            computedAt: m?.computedAt || null,
            computeSource: m?.computeSource || null,
        };
    });

    const unmappedAttendanceDepartments = new Map();
    let unmappedPresentTotal = 0;
    let noDepartmentPresentTotal = 0;
    let unmappedRequirement = { fn01: 0, fn02: 0 };
    for (const date of dates) {
        const m = meta.get(date);
        if (!m) continue;
        unmappedPresentTotal += m.unmappedPresent;
        noDepartmentPresentTotal += m.noDepartmentPresent;
        unmappedRequirement = { fn01: m.unmappedRequirementFN01, fn02: m.unmappedRequirementFN02 };
        for (const { name, count } of m.unmappedAttendanceDepartments || []) {
            unmappedAttendanceDepartments.set(name, (unmappedAttendanceDepartments.get(name) || 0) + count);
        }
    }
    const deptFallbackTotal = storedRows
        .filter((r) => computedDates.has(r.reportDate))
        .reduce((s, r) => s + r.deptFallbackCount, 0);

    const lastComputedAt = [...meta.values()]
        .map((m) => m.computedAt)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0] || null;

    return {
        year,
        monthNumber,
        dates: dateInfo,
        groups,
        training: trainingRow,
        grandTotal,
        lastComputedAt,
        diagnostics: {
            notComputedDates: dates.filter((d) => !computedDates.has(d)),
            unmappedPresentTotal,
            noDepartmentPresentTotal,
            unmappedRequirement,
            deptFallbackTotal,
            unmappedAttendanceDepartments: [...unmappedAttendanceDepartments]
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count),
        },
    };
};
