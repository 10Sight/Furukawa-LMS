// Efficiency math behind the Manpower Efficiency charts (EfficiencyChart.jsx).
//
// Charts 1–5 (attendance / department / section / line / sub-section) count each operator at
// most CHART_EFFICIENCY_CAP, so no Total or Present bar passes 100% while Unskilled + Skilled
// still adds up to the group's figure. Chart 6 (operator-wise) shows the uncapped value.
//
// Present over a date range is the average per logged day of (present operators' efficiency
// ÷ headcount), so a 30-day range is comparable to a single day rather than 30× larger.
//
// The shift-wise breakdown splits Present by the shift on each attendance row, using the same
// divisor, so a group's per-shift figures add up to its Present figure.

export const PRESENT_STATUSES = new Set(['Present', 'Late', 'Half Day']);
export const CHART_EFFICIENCY_CAP = 100;

export const getAvg = (arr) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0;
export const getSum = (arr) => arr.reduce((a, b) => a + b, 0);
export const round2 = (v) => Math.round(v * 100) / 100;

// Shift codes come normalised from the server (A/B/C/G/OTHER); a present row without one is
// grouped as UNASSIGNED so it still counts toward the breakdown.
export const UNASSIGNED_SHIFT = 'UNASSIGNED';
const SHIFT_DISPLAY_ORDER = ['A', 'B', 'C', 'G', 'OTHER', UNASSIGNED_SHIFT];
const shiftOf = (op) => op.shift || UNASSIGNED_SHIFT;
const shiftRank = (k) => (SHIFT_DISPLAY_ORDER.includes(k) ? SHIFT_DISPLAY_ORDER.indexOf(k) : SHIFT_DISPLAY_ORDER.length);
export const sortShiftKeys = (keys) => [...keys].sort((a, b) => shiftRank(a) - shiftRank(b) || String(a).localeCompare(String(b)));

// { shift: summed chart efficiency } over attendance rows
const sumByShift = (rows) => rows.reduce((acc, op) => {
    const k = shiftOf(op);
    acc[k] = (acc[k] || 0) + chartEfficiency(op);
    return acc;
}, {});
const divideByShift = (sums, divisor) =>
    Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, divisor ? round2(v / divisor) : 0]));
// a − b per shift (Skilled = Total − Unskilled, as for the un-split figures)
const subtractByShift = (a, b) =>
    Object.fromEntries(Object.keys(a).map(k => [k, round2(a[k] - (b[k] || 0))]));
// Average of children's per-shift figures; a child with no rows in a shift counts as 0 there,
// so the parent's shifts still add up to its averaged Present figure.
const averageByShift = (list) => {
    const keys = new Set(list.flatMap(o => Object.keys(o || {})));
    return Object.fromEntries([...keys].map(k => [k, getAvg(list.map(o => o?.[k] || 0))]));
};

// An operator's recorded efficiency, uncapped (Chart 6)
export const calculateUserEfficiency = (op) => {
    if (!op) return 0;
    if (op.currentEffeciency != null) return parseFloat(op.currentEffeciency) || 0;
    const evalData = op.evalData;
    if (!evalData) return 0;
    let parsed = evalData;
    if (typeof evalData === 'string') { try { parsed = JSON.parse(evalData); } catch { return 0; } }
    // L4: '3-5', L3: '2-0', L2: '1-2', L1: '0-2'
    for (const key of ['3-5', '2-0', '1-2', '0-2']) {
        const d = parsed[key];
        if (d?.standard === 'OK') return parseFloat(d.okVal) || 0;
    }
    return 0;
};

// The operator's efficiency as Charts 1–5 count it
export const chartEfficiency = (op) => Math.min(calculateUserEfficiency(op), CHART_EFFICIENCY_CAP);

// Days in [dateFrom, dateTo] that have any attendance logged (plant-wide); days with no
// records at all (holidays) are left out of the Present average.
export const countLoggedDays = (attendanceRows, dateFrom, dateTo) => {
    const days = new Set();
    attendanceRows.forEach(row => {
        const d = row.attendanceDate;
        if (d && d >= dateFrom && d <= dateTo) days.add(d);
    });
    return days.size;
};

// Present attendance rows, limited to operators in the Total population so Present can never
// exceed Total (the shift filter matches Total on each operator's latest shift but attendance
// on that day's shift).
const presentRowsWithin = (opsAll, opsAtt) => {
    const inTotal = new Set(opsAll.map(op => op.userId));
    return opsAtt.filter(op => PRESENT_STATUSES.has(op.logStatus) && inTotal.has(op.userId));
};

// Chart 1: Total / Skilled / Unskilled manpower, each with a Total and a Present figure.
// Every figure divides by the same headcount (and Present also by the logged-day count), so
// Unskilled + Skilled = Total Manpower for both; Skilled is derived so rounding matches too.
// `presentByShift` splits Present by shift (same divisor), `presentCountByShift` counts operators.
export const buildSkillSplit = (opsAll, opsAtt, dayCount) => {
    const presOps = presentRowsWithin(opsAll, opsAtt);
    const totalCount = opsAll.length;
    const presDiv = totalCount * dayCount;
    const totalPct = (ops) => totalCount ? round2(getSum(ops.map(chartEfficiency)) / totalCount) : 0;
    const presentPct = (ops) => presDiv ? round2(getSum(ops.map(chartEfficiency)) / presDiv) : 0;
    const presentShiftPct = (ops) => divideByShift(sumByShift(ops), presDiv);
    const countEvaluated = (ops) => ops.filter(op => op.currentEffeciency != null || op.evalData != null).length;
    const uniqueUsers = (rows) => new Set(rows.map(op => op.userId)).size;
    const usersByShift = (rows) => {
        const sets = {};
        rows.forEach(op => { (sets[shiftOf(op)] ||= new Set()).add(op.userId); });
        return Object.fromEntries(Object.entries(sets).map(([k, s]) => [k, s.size]));
    };
    const row = (name, allOps, presentOps, total, present, presentByShift) => ({
        name, displayName: name, total, present, presentByShift,
        totalCount: allOps.length, presentCount: uniqueUsers(presentOps), evaluated: countEvaluated(allOps),
        presentCountByShift: usersByShift(presentOps),
    });

    const unskilledAll = opsAll.filter(op => !op.isSkilled);
    const skilledAll = opsAll.filter(op => op.isSkilled);
    const unskilledPres = presOps.filter(op => !op.isSkilled);
    const skilledPres = presOps.filter(op => op.isSkilled);

    const tAll = totalPct(opsAll);
    const tPres = presentPct(presOps);
    const tUnskilledAll = totalPct(unskilledAll);
    const tUnskilledPres = presentPct(unskilledPres);
    const shiftPres = presentShiftPct(presOps);
    const shiftUnskilledPres = presentShiftPct(unskilledPres);

    return [
        row('Total Manpower', opsAll, presOps, tAll, tPres, shiftPres),
        row('Skilled Manpower', skilledAll, skilledPres, round2(tAll - tUnskilledAll), round2(tPres - tUnskilledPres),
            subtractByShift(shiftPres, shiftUnskilledPres)),
        row('Unskilled Manpower', unskilledAll, unskilledPres, tUnskilledAll, tUnskilledPres, shiftUnskilledPres),
    ];
};

// Shapes a rollup row into the flat item contract consumed by the charts/summary capsules.
// Skilled = Total − Unskilled, so the two shares always add up to the group's figure.
const shapeGroupRow = (row) => {
    const allEff = row.allEfficiency ?? 0;
    const presEff = row.presEfficiency ?? 0;
    const allUnskilled = row.allUnskilled ?? 0;
    const presUnskilled = row.presUnskilled ?? 0;
    const presShift = row.presShift || {};
    const presUnskilledShift = row.presUnskilledShift || {};
    return {
        id: row.id, name: row.name, displayName: row.name,
        allEfficiency: allEff, presEfficiency: presEff,
        allTotal: allEff, presTotal: presEff,
        allUnskilled, presUnskilled,
        allSkilled: round2(allEff - allUnskilled), presSkilled: round2(presEff - presUnskilled),
        presShift, presUnskilledShift, presSkilledShift: subtractByShift(presShift, presUnskilledShift),
    };
};

// Ensures every filter-selected group key is represented (as 0%) even when it has no active children.
const withAllGroupKeys = (rows, allGroupKeys) => {
    const map = {};
    rows.forEach(r => { map[r.id] = r; });
    (allGroupKeys || []).forEach(gk => {
        if (gk.id && gk.name && !map[gk.id]) {
            map[gk.id] = { id: gk.id, name: gk.name, allEfficiency: 0, presEfficiency: 0 };
        }
    });
    return Object.values(map).map(shapeGroupRow).sort((a, b) => b.allEfficiency - a.allEfficiency);
};

// Averages a list of child rows' efficiency metrics into a parent row, keyed by parent id/name.
// Averaging is linear, so a child's Unskilled + Skilled = Total carries up to the parent.
const rollUp = (childRows, getParentId, getParentName) => {
    const map = {};
    childRows.forEach(child => {
        const pId = getParentId(child);
        if (!pId) return;
        if (!map[pId]) map[pId] = { id: pId, name: getParentName(child), allArr: [], presArr: [], allUnsArr: [], presUnsArr: [], presShiftArr: [], presUnsShiftArr: [] };
        map[pId].allArr.push(child.allEfficiency);
        map[pId].presArr.push(child.presEfficiency);
        map[pId].allUnsArr.push(child.allUnskilled);
        map[pId].presUnsArr.push(child.presUnskilled);
        map[pId].presShiftArr.push(child.presShift);
        map[pId].presUnsShiftArr.push(child.presUnskilledShift);
    });
    return Object.values(map).map(row => ({
        ...row,
        allEfficiency: getAvg(row.allArr),
        presEfficiency: getAvg(row.presArr),
        allUnskilled: getAvg(row.allUnsArr),
        presUnskilled: getAvg(row.presUnsArr),
        presShift: averageByShift(row.presShiftArr),
        presUnskilledShift: averageByShift(row.presUnsShiftArr),
        headcount: row.allArr.length,
    }));
};

// Hierarchical rollup: Sub-Section = avg of its users; Line = avg of its active sub-sections;
// Section = avg of its active lines; Department = avg of its active sections.
export const buildHierarchicalData = (opsAll, opsAtt, level, allGroupKeys = [], dayCount = 1) => {
    const ssMap = {};
    const ensureSS = (op) => {
        const ssId = String(op.subSectionId || op.subSectionName || '');
        if (!ssId) return null;
        if (!ssMap[ssId]) {
            ssMap[ssId] = {
                id: ssId, name: op.subSectionName,
                lineId: String(op.lineId || op.lineName || ''), lineName: op.lineName,
                sectionId: String(op.sectionId || op.sectionName || ''),
                sectionName: op.sectionCategory ? `${op.sectionName} (${op.sectionCategory})` : op.sectionName,
                deptId: String(op.departmentId || op.departmentName || ''), deptName: op.departmentName,
                allArr: [], presArr: [], allUnsArr: [], presUnsArr: [],
                presShiftSum: {}, presUnsShiftSum: {},
            };
        }
        return ssMap[ssId];
    };

    // Base: Total Efficiency per sub-section using opsAll (unfiltered by date)
    opsAll.forEach(op => {
        const row = ensureSS(op);
        if (!row) return;
        const eff = chartEfficiency(op);
        row.allArr.push(eff);
        if (!op.isSkilled) row.allUnsArr.push(eff);
    });

    // Base: Attendance-based metrics per sub-section using present rows (filtered by date)
    presentRowsWithin(opsAll, opsAtt).forEach(op => {
        const row = ensureSS(op);
        if (!row) return;
        const eff = chartEfficiency(op);
        const shift = shiftOf(op);
        row.presArr.push(eff);
        row.presShiftSum[shift] = (row.presShiftSum[shift] || 0) + eff;
        if (!op.isSkilled) {
            row.presUnsArr.push(eff);
            row.presUnsShiftSum[shift] = (row.presUnsShiftSum[shift] || 0) + eff;
        }
    });

    const ssRows = Object.values(ssMap).map(row => {
        const total = row.allArr.length;
        // Present figures are per logged day: summed over the range ÷ (headcount × days)
        const presDiv = total * dayCount;
        return {
            ...row,
            allEfficiency: getAvg(row.allArr),
            presEfficiency: presDiv ? round2(getSum(row.presArr) / presDiv) : 0,
            // Unskilled shares divide by the whole sub-section headcount, like Total / Present
            allUnskilled: total ? round2(getSum(row.allUnsArr) / total) : 0,
            presUnskilled: presDiv ? round2(getSum(row.presUnsArr) / presDiv) : 0,
            presShift: divideByShift(row.presShiftSum, presDiv),
            presUnskilledShift: divideByShift(row.presUnsShiftSum, presDiv),
            headcount: total,
        };
    });

    if (level === 'subsection') return withAllGroupKeys(ssRows, allGroupKeys);

    const lineRows = rollUp(ssRows.filter(r => r.headcount > 0), r => r.lineId, r => r.lineName);
    if (level === 'line') return withAllGroupKeys(lineRows, allGroupKeys);

    // Line rows carry sectionId/sectionName/deptId/deptName from their active sub-sections
    const lineToParent = {};
    ssRows.forEach(r => { if (r.lineId && !lineToParent[r.lineId]) lineToParent[r.lineId] = r; });
    const sectionRows = rollUp(
        lineRows.filter(r => r.headcount > 0),
        r => lineToParent[r.id]?.sectionId,
        r => lineToParent[r.id]?.sectionName
    );
    if (level === 'section') return withAllGroupKeys(sectionRows, allGroupKeys);

    const sectionToParent = {};
    ssRows.forEach(r => { if (r.sectionId && !sectionToParent[r.sectionId]) sectionToParent[r.sectionId] = r; });
    const deptRows = rollUp(
        sectionRows.filter(r => r.headcount > 0),
        r => sectionToParent[r.id]?.deptId,
        r => sectionToParent[r.id]?.deptName
    );
    return withAllGroupKeys(deptRows, allGroupKeys);
};
