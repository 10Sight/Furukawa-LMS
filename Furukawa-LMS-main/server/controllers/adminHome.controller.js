import { executeQuery } from "../db/mssqlHelper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

/**
 * Get stats for the Admin Home page
 * Includes Total Dojo Users and Gender Distribution
 */
export const getAdminHomeDojoStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    let whereClause = "WHERE isTemporary = 1 AND (isDeleted = 0 OR isDeleted IS NULL)";
    const params = [];

    if (startDate && endDate) {
        whereClause += " AND COALESCE(joiningDate, CAST(createdAt AS DATE)) >= ? AND COALESCE(joiningDate, CAST(createdAt AS DATE)) <= ?";
        params.push(startDate, endDate);
    }

    // Total counts for summary cards
    const [totalRows] = await executeQuery(`SELECT COUNT(*) as total FROM users ${whereClause}`, params);
    const totalDojoUsers = totalRows[0].total;

    // Gender distribution for chart
    const [genderRows] = await executeQuery(`
        SELECT gender, COUNT(*) as count 
        FROM users 
        ${whereClause}
        GROUP BY gender
    `, params);

    const formattedGenderDistribution = genderRows.map(row => ({
        name: row.gender || "Unspecified",
        value: row.count
    }));

    res.status(200).json(
        new ApiResponse(200, {
            totalDojoUsers,
            genderDistribution: formattedGenderDistribution
        }, "Admin home Dojo stats fetched successfully")
    );
});


/**
 * Get Handover Plan vs Actual stats for the Admin Home page
 * Fetches data from headcount_reports (global report, deptId=0)
 */
export const getAdminHomeHandoverStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    let start, end;
    if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
    } else {
        // Default to current month
        const now = new Date();
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    // Collect all unique month/year pairs in the range
    const monthsNeeded = [];
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
        monthsNeeded.push({ month: current.getMonth() + 1, year: current.getFullYear() });
        current.setMonth(current.getMonth() + 1);
    }

    const handoverStats = [];
    const tableDataCache = {};

    // Fetch reports for all needed months
    for (const { month, year } of monthsNeeded) {
        const [rows] = await executeQuery(
            "SELECT tableData FROM headcount_reports WHERE departmentId = 0 AND month = ? AND year = ?",
            [month, year]
        );
        if (rows.length > 0) {
            try {
                tableDataCache[`${year}-${month}`] = JSON.parse(rows[0].tableData || "{}");
            } catch (e) {
                console.error(`Error parsing report for ${month}/${year}:`, e);
            }
        }
    }

    // Iterate through each day in the range and collect stats
    let day = new Date(start);
    while (day <= end) {
        const y = day.getFullYear();
        const m = day.getMonth() + 1;
        const d = day.getDate();
        const dKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        const monthData = tableDataCache[`${y}-${m}`] || {};
        const plan = parseFloat(monthData[`Handover Plan_${dKey}`]) || 0;
        const actual = parseFloat(monthData[`Handover Actual_${dKey}`]) || 0;

        handoverStats.push({
            date: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
            plan,
            actual
        });

        day.setDate(day.getDate() + 1);
    }

    res.status(200).json(
        new ApiResponse(200, handoverStats, "Handover stats fetched successfully")
    );
});

/**
 * Get Test Paper stats for the Admin Home page
 * Returns aggregated totals + date-bucketed trend series for the theoretical test performance chart.
 *
 * Only Dojo theoretical quizzes (attempted_quizzes/quizzes with isDojo = 1) feed these stats —
 * the practical (DOJO evaluation test attempts) chart was removed.
 */
export const getAdminHomeTestPaperStats = asyncHandler(async (req, res) => {
    const { startDate, endDate, departmentId, isDojo, quizId, groupBy = 'monthly' } = req.query;

    const safeGroupBy = ['daily', 'monthly', 'yearly'].includes(groupBy) ? groupBy : 'monthly';

    // Default date window when caller omits explicit range
    const now = new Date();
    let start, end;
    if (startDate && endDate) {
        start = startDate;
        end   = endDate;
    } else if (safeGroupBy === 'daily') {
        const past = new Date(now);
        past.setDate(past.getDate() - 29);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    } else if (safeGroupBy === 'yearly') {
        start = `${now.getFullYear() - 4}-01-01`;
        end   = now.toISOString().split('T')[0];
    } else {
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    }

    const periodFormatMap = {
        daily:   "FORMAT(CAST(aq.completedAt AS DATE), 'yyyy-MM-dd')",
        monthly: "FORMAT(CAST(aq.completedAt AS DATE), 'yyyy-MM')",
        yearly:  "FORMAT(CAST(aq.completedAt AS DATE), 'yyyy')",
    };
    const periodExpr = periodFormatMap[safeGroupBy];

    // Build optional filters (department, worker type)
    let filterClause = '';
    const baseParams = [start, end];

    if (departmentId && departmentId !== 'all' && departmentId !== '') {
        filterClause += ' AND u.departmentId = ?';
        baseParams.push(departmentId);
    }

    if (isDojo !== undefined && isDojo !== '' && isDojo !== 'all') {
        const isDojoBool = isDojo === 'true' || isDojo === '1';
        // "Dojo" also covers users who have since been handed over — their attempts were
        // taken while they were still Dojo, so they shouldn't drop out once isTemporary flips
        // to 0. Mirrors the same guard used in getDojoHiringTrend / getContractorWiseOperatorStats.
        filterClause += isDojoBool
            ? ' AND (u.expectedHandover IS NOT NULL OR u.isTemporary = 1)'
            : ' AND u.isTemporary = 0';
    }

    const quizIds = quizId ? quizId.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (quizIds.length > 0) {
        const ph = quizIds.map(() => '?').join(',');
        filterClause += ` AND aq.quiz IN (${ph})`;
        baseParams.push(...quizIds);
    }

    // Only Dojo theoretical quizzes feed these stats now — the practical chart was removed.
    // attempted_quizzes.quiz/student are stored as NVARCHAR; casting to INT lets the join
    // seek on quizzes.id/users.id instead of scanning past an implicit conversion.
    const baseFrom = `
        FROM attempted_quizzes aq
        JOIN quizzes q ON q.id = TRY_CAST(aq.quiz AS INT)
        JOIN users u ON u.id = TRY_CAST(aq.student AS INT)
        WHERE aq.completedAt >= ? AND aq.completedAt <= ?
        AND q.isTheoretical = 1
        AND q.isDojo = 1
        ${filterClause}
    `;

    // Aggregated totals (used for footer metrics)
    const totalQuery = `
        SELECT
            'Theoretical' AS name,
            COUNT(*) AS value
        ${baseFrom}
    `;

    const passFailQuery = `
        SELECT
            'Theoretical' AS type,
            CASE WHEN aq.status = 'PASSED' THEN 'Passed' ELSE 'Failed' END AS status,
            COUNT(*) AS value
        ${baseFrom}
        GROUP BY CASE WHEN aq.status = 'PASSED' THEN 'Passed' ELSE 'Failed' END
    `;

    // Time-series for Chart 1: theoretical quiz volume per period
    const trendByTypeQuery = `
        SELECT
            ${periodExpr} AS period,
            COUNT(*) AS theoretical
        ${baseFrom}
        GROUP BY ${periodExpr}
        ORDER BY period ASC
    `;

    // Time-series for pass/fail per period
    const trendByResultQuery = `
        SELECT
            ${periodExpr} AS period,
            SUM(CASE WHEN aq.status = 'PASSED' THEN 1 ELSE 0 END) AS passedTheoretical,
            SUM(CASE WHEN aq.status != 'PASSED' THEN 1 ELSE 0 END) AS failedTheoretical
        ${baseFrom}
        GROUP BY ${periodExpr}
        ORDER BY period ASC
    `;

    const [totalRows]       = await executeQuery(totalQuery,       baseParams);
    const [passFailRows]    = await executeQuery(passFailQuery,    baseParams);
    const [trendTypeRows]   = await executeQuery(trendByTypeQuery, baseParams);
    const [trendResultRows] = await executeQuery(trendByResultQuery, baseParams);

    const totalDistribution = [
        { name: 'Theoretical', value: totalRows[0]?.value || 0 },
    ];

    const trendByType = trendTypeRows.map(r => ({
        period: r.period,
        theoretical: Number(r.theoretical) || 0,
    }));

    const trendByResult = trendResultRows.map(r => ({
        period: r.period,
        passedTheoretical: Number(r.passedTheoretical) || 0,
        failedTheoretical: Number(r.failedTheoretical) || 0,
    }));

    res.status(200).json(
        new ApiResponse(200, {
            totalDistribution,
            passFailData: passFailRows,
            trendByType,
            trendByResult,
            groupBy:        safeGroupBy,
            start,
            end,
        }, "Test paper stats fetched successfully")
    );
});

/**
 * Get Dojo Hiring Trend for Admin Home page
 * Groups dojo-hired users by creation period.
 *
 * Identity rule: a row is a dojo hire if it was ever created as temporary.
 * We use (expectedHandover IS NOT NULL OR isTemporary = 1) so we capture:
 *   - Users still in the pipeline      → isTemporary = 1
 *   - Users promoted/handed-over        → isTemporary = 0 but expectedHandover was set
 *   - Supports actual/permanent empIds from day one (not just TEMP-prefixed IDs)
 * The union avoids double-counting because it's a single-row predicate.
 */
export const getDojoHiringTrend = asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'monthly', departmentId } = req.query;

    const safeGroupBy = ['daily', 'monthly', 'yearly'].includes(groupBy) ? groupBy : 'monthly';

    // Default date window per groupBy when caller supplies no explicit range
    const now = new Date();
    let start, end;
    if (startDate && endDate) {
        start = startDate;
        end = endDate;
    } else if (safeGroupBy === 'daily') {
        const past = new Date(now);
        past.setDate(past.getDate() - 29);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    } else if (safeGroupBy === 'yearly') {
        start = `${now.getFullYear() - 4}-01-01`;
        end   = now.toISOString().split('T')[0];
    } else {
        // monthly: last 12 months
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    }

    // Dynamic GROUP BY expression — zero-padded so ORDER BY period ASC is chronological
    const formatMap = {
        daily:   "FORMAT(COALESCE(joiningDate, CAST(createdAt AS DATE)), 'yyyy-MM-dd')",
        monthly: "FORMAT(COALESCE(joiningDate, CAST(createdAt AS DATE)), 'yyyy-MM')",
        yearly:  "FORMAT(COALESCE(joiningDate, CAST(createdAt AS DATE)), 'yyyy')",
    };
    const periodExpr = formatMap[safeGroupBy];

    // Build optional department filter — accepts comma-separated IDs for multi-select
    // Temp users store dept in targetDeptId; after handover it moves to departmentId
    // Date range appears twice in the WHERE clause (joiningDate branch + createdAt fallback branch)
    const dateRangeParams = [start, end, start, end];
    let deptClause = '';
    const deptIds = departmentId ? departmentId.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (deptIds.length > 0) {
        const ph = deptIds.map(() => '?').join(',');
        deptClause = `AND (targetDeptId IN (${ph}) OR departmentId IN (${ph}))`;
        dateRangeParams.push(...deptIds, ...deptIds);
    }

    // Sargable date range: OR'd instead of COALESCE(...) >= ? so SQL Server can seek on
    // joiningDate directly rather than scanning every row to evaluate the function result.
    const [rows] = await executeQuery(`
        SELECT
            ${periodExpr}                                                               AS period,
            COUNT(*)                                                                    AS total,
            SUM(CASE WHEN gender = 'MALE'   THEN 1 ELSE 0 END)                         AS maleCount,
            SUM(CASE WHEN gender = 'FEMALE' THEN 1 ELSE 0 END)                         AS femaleCount,
            SUM(CASE WHEN gender NOT IN ('MALE','FEMALE') OR gender IS NULL THEN 1 ELSE 0 END) AS otherCount
        FROM users
        WHERE (expectedHandover IS NOT NULL OR isTemporary = 1)
          AND (isDeleted = 0 OR isDeleted IS NULL)
          AND (
              (joiningDate >= ? AND joiningDate <= ?)
              OR (joiningDate IS NULL AND CAST(createdAt AS DATE) >= ? AND CAST(createdAt AS DATE) <= ?)
          )
          ${deptClause}
        GROUP BY ${periodExpr}
        ORDER BY period ASC
    `, dateRangeParams);

    res.status(200).json(
        new ApiResponse(200, { trend: rows, groupBy: safeGroupBy, start, end }, "Dojo hiring trend fetched successfully")
    );
});


/**
 * Get Dojo Handover Comparison for Admin Home page
 * Expected Handover: dojo users grouped by their expectedHandover date
 * Actual Handover:   handed-over users (expectedHandover IS NOT NULL AND isTemporary=0) grouped by updatedAt
 */
export const getDojoHandoverComparison = asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'monthly', departmentId } = req.query;

    const safeGroupBy = ['daily', 'monthly', 'yearly'].includes(groupBy) ? groupBy : 'monthly';

    const now = new Date();
    let start, end;
    if (startDate && endDate) {
        start = startDate;
        end   = endDate;
    } else if (safeGroupBy === 'daily') {
        const past = new Date(now);
        past.setDate(past.getDate() - 29);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    } else if (safeGroupBy === 'yearly') {
        start = `${now.getFullYear() - 4}-01-01`;
        end   = now.toISOString().split('T')[0];
    } else {
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    }

    // Temp users may not have an expectedHandover date filled in yet; fall back to when they
    // joined so they still land on the timeline instead of being dropped from the chart.
    const expectedDateExpr = (p = '') => `COALESCE(${p}expectedHandover, ${p}joiningDate, CAST(${p}createdAt AS DATE))`;
    const expectedFormatMap = {
        daily:   (p = '') => `FORMAT(${expectedDateExpr(p)}, 'yyyy-MM-dd')`,
        monthly: (p = '') => `FORMAT(${expectedDateExpr(p)}, 'yyyy-MM')`,
        yearly:  (p = '') => `FORMAT(${expectedDateExpr(p)}, 'yyyy')`,
    };
    const actualFormatMap = {
        daily:   "FORMAT(hs.date, 'yyyy-MM-dd')",
        monthly: "FORMAT(hs.date, 'yyyy-MM')",
        yearly:  "FORMAT(hs.date, 'yyyy')",
    };

    // Temp users store their destination in targetDeptId; after handover it moves to departmentId
    // Accepts comma-separated IDs for multi-select
    let expectedDeptClause = '';
    let expectedDeptClausePrefixed = '';
    let actualDeptClausePrefixed = '';
    const expectedParams = [start, end];
    const actualParams   = [start, end];
    const deptIds = departmentId ? departmentId.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (deptIds.length > 0) {
        const ph = deptIds.map(() => '?').join(',');
        expectedDeptClause = `AND COALESCE(departmentId, targetDeptId) IN (${ph})`;
        expectedDeptClausePrefixed = `AND COALESCE(u.departmentId, u.targetDeptId) IN (${ph})`;
        actualDeptClausePrefixed = `AND COALESCE(u.departmentId, u.targetDeptId) IN (${ph})`;
        expectedParams.push(...deptIds);
        actualParams.push(...deptIds);
    }

    const [expectedRows] = await executeQuery(`
        SELECT
            ${expectedFormatMap[safeGroupBy]()} AS period,
            COUNT(*)                          AS expected
        FROM users
        WHERE (isTemporary = 1 OR expectedHandover IS NOT NULL)
          AND (isDeleted = 0 OR isDeleted IS NULL)
          AND ${expectedDateExpr()} >= ?
          AND ${expectedDateExpr()} <= ?
          ${expectedDeptClause}
        GROUP BY ${expectedFormatMap[safeGroupBy]()}
        ORDER BY period ASC
    `, expectedParams);

    // Per-department + per-section expected breakdown (same filters, grouped by period + dept + section)
    const [deptExpectedRows] = await executeQuery(`
        SELECT
            ${expectedFormatMap[safeGroupBy]('u.')} AS period,
            CAST(COALESCE(u.departmentId, u.targetDeptId) AS NVARCHAR(20)) AS deptId,
            COALESCE(CAST(COALESCE(u.sectionId, u.targetSectionId) AS NVARCHAR(20)), 'unassigned') AS sectionId,
            COALESCE(s.name, 'Unassigned')    AS sectionName,
            COUNT(*)                          AS expected
        FROM users u
        LEFT JOIN sections s ON s.id = COALESCE(u.sectionId, u.targetSectionId)
        WHERE (u.isTemporary = 1 OR u.expectedHandover IS NOT NULL)
          AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
          AND COALESCE(u.departmentId, u.targetDeptId) IS NOT NULL
          AND ${expectedDateExpr('u.')} >= ?
          AND ${expectedDateExpr('u.')} <= ?
          ${expectedDeptClausePrefixed}
        GROUP BY ${expectedFormatMap[safeGroupBy]('u.')}, COALESCE(u.departmentId, u.targetDeptId), COALESCE(u.sectionId, u.targetSectionId), s.name
        ORDER BY period ASC
    `, expectedParams);

    // Scan handover_sheets first (filtered by date) before exploding into JSON rows, then join
    // users on the PK. Avoids the prior INNER JOIN ... ON 1=1 Cartesian product between every
    // user row and every handover_sheets row ahead of the JSON filter.
    const [actualRows] = await executeQuery(`
        SELECT
            ${actualFormatMap[safeGroupBy]} AS period,
            COUNT(DISTINCT u.id)            AS actual
        FROM handover_sheets hs
        CROSS APPLY OPENJSON(hs.entries) as entry
        INNER JOIN users u ON u.id = TRY_CAST(JSON_VALUE(entry.value, '$.studentId') AS INT)
        WHERE hs.date >= ?
          AND hs.date <= ?
          AND JSON_VALUE(entry.value, '$.interviewStatus') = 'APPROVE'
          AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
          ${actualDeptClausePrefixed}
        GROUP BY ${actualFormatMap[safeGroupBy]}
        ORDER BY period ASC
    `, actualParams);

    // Per-department + per-section actual breakdown (grouped by period + dept + section)
    const [deptActualRows] = await executeQuery(`
        SELECT
            ${actualFormatMap[safeGroupBy]}            AS period,
            CAST(COALESCE(u.departmentId, u.targetDeptId) AS NVARCHAR(20))     AS deptId,
            COALESCE(CAST(COALESCE(u.sectionId, u.targetSectionId) AS NVARCHAR(20)), 'unassigned') AS sectionId,
            COALESCE(s.name, 'Unassigned')             AS sectionName,
            COUNT(DISTINCT u.id)                       AS actual
        FROM handover_sheets hs
        CROSS APPLY OPENJSON(hs.entries) as entry
        INNER JOIN users u ON u.id = TRY_CAST(JSON_VALUE(entry.value, '$.studentId') AS INT)
        LEFT JOIN sections s ON s.id = COALESCE(u.sectionId, u.targetSectionId)
        WHERE hs.date >= ?
          AND hs.date <= ?
          AND JSON_VALUE(entry.value, '$.interviewStatus') = 'APPROVE'
          AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
          AND COALESCE(u.departmentId, u.targetDeptId) IS NOT NULL
          ${actualDeptClausePrefixed}
        GROUP BY ${actualFormatMap[safeGroupBy]}, COALESCE(u.departmentId, u.targetDeptId), COALESCE(u.sectionId, u.targetSectionId), s.name
        ORDER BY period ASC
    `, actualParams);

    // Merge total expected + actual by period
    const mergedMap = {};
    expectedRows.forEach(r => {
        if (r.period) mergedMap[r.period] = { period: r.period, expected: Number(r.expected), actual: 0 };
    });
    actualRows.forEach(r => {
        if (r.period) {
            if (mergedMap[r.period]) {
                mergedMap[r.period].actual = Number(r.actual);
            } else {
                mergedMap[r.period] = { period: r.period, expected: 0, actual: Number(r.actual) };
            }
        }
    });

    const trend = Object.values(mergedMap).sort((a, b) => a.period.localeCompare(b.period));

    // Build per-dept + per-section breakdown merging expected + actual per (deptId, sectionId, period)
    const deptExpMap = {};
    deptExpectedRows.forEach(r => {
        const key = `${r.deptId}__${r.sectionId}`;
        if (!deptExpMap[key]) deptExpMap[key] = {};
        deptExpMap[key][r.period] = Number(r.expected);
    });

    const deptActMap = {};
    deptActualRows.forEach(r => {
        const key = `${r.deptId}__${r.sectionId}`;
        if (!deptActMap[key]) deptActMap[key] = {};
        deptActMap[key][r.period] = Number(r.actual);
    });

    // Collect all unique (deptId, sectionId, period) tuples from both expected and actual rows
    const deptPeriodPairs = new Map();
    const addPair = (r) => {
        const key = `${r.deptId}__${r.sectionId}__${r.period}`;
        if (!deptPeriodPairs.has(key)) {
            deptPeriodPairs.set(key, {
                deptId: String(r.deptId),
                sectionId: String(r.sectionId),
                sectionName: r.sectionName,
                period: r.period,
            });
        }
    };
    deptExpectedRows.forEach(addPair);
    deptActualRows.forEach(addPair);

    const deptBreakdown = [...deptPeriodPairs.values()].map(({ deptId, sectionId, sectionName, period }) => {
        const key = `${deptId}__${sectionId}`;
        return {
            period,
            deptId,
            sectionId,
            sectionName,
            expected: deptExpMap[key]?.[period] || 0,
            actual:   deptActMap[key]?.[period]  || 0,
        };
    }).sort((a, b) =>
        Number(a.deptId) - Number(b.deptId) ||
        a.sectionName.localeCompare(b.sectionName) ||
        a.period.localeCompare(b.period)
    );

    res.status(200).json(
        new ApiResponse(200, { trend, deptBreakdown, groupBy: safeGroupBy, start, end }, "Dojo handover comparison fetched successfully")
    );
});


const MONTH_ABBR = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

const formatDateObj = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// The monitoring grid stores its own date columns (attendance_date_1..16) as "dd-MMM-yy"
// (e.g. "14-Aug-26") via date-fns `format(date, "dd-MMM-yy")" — NOT ISO — and the sheet's
// top-level `startDate` column is captured directly from that field, so it inherits the same
// format. Handles both that format and a plain ISO fallback.
const parseFlexibleDate = (str) => {
    if (!str) return null;
    const s = String(str).trim();
    const ddMmmYy = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
    if (ddMmmYy) {
        const day = Number(ddMmmYy[1]);
        const mon = MONTH_ABBR[ddMmmYy[2].toLowerCase()];
        let year = Number(ddMmmYy[3]);
        if (year < 100) year += 2000;
        if (mon === undefined || !day) return null;
        const d = new Date(year, mon, day);
        return isNaN(d.getTime()) ? null : d;
    }
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
        const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
};

const periodFromIso = (isoDate, groupBy) => {
    if (groupBy === 'yearly') return isoDate.slice(0, 4);
    if (groupBy === 'monthly') return isoDate.slice(0, 7);
    return isoDate;
};

// Every period in [start, end] for the given grouping, so the response can zero-fill gaps
// instead of leaving the frontend to reconstruct the range itself.
const buildFullPeriods = (groupBy, start, end) => {
    if (!start || !end) return [];
    const full = [];
    if (groupBy === 'daily') {
        const cur = new Date(`${start}T00:00:00`);
        const last = new Date(`${end}T00:00:00`);
        while (cur <= last) {
            full.push(formatDateObj(cur));
            cur.setDate(cur.getDate() + 1);
        }
    } else if (groupBy === 'monthly') {
        let [sy, sm] = start.split('-').map(Number);
        const [ey, em] = end.split('-').map(Number);
        while (sy < ey || (sy === ey && sm <= em)) {
            full.push(`${sy}-${String(sm).padStart(2, '0')}`);
            sm++;
            if (sm > 12) { sm = 1; sy++; }
        }
    } else {
        const sy = Number(start.split('-')[0]);
        const ey = Number(end.split('-')[0]);
        for (let y = sy; y <= ey; y++) full.push(String(y));
    }
    return full;
};

/**
 * Get Sixteen-Day Monitoring daily filled-count breakdown for Admin Home page.
 * For every attendance_date_1..16 field filled in on a student's latest monitoring attempt,
 * count one "filled day" against the period that date falls into (daily/monthly/yearly),
 * grouped by department — or by section once the caller has narrowed to a single department
 * ("drill mode", matching the same convention as the Dojo Handover chart).
 */
export const getSixteenDayMonitoringStatus = asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'monthly', departmentId } = req.query;

    const safeGroupBy = ['daily', 'monthly', 'yearly'].includes(groupBy) ? groupBy : 'monthly';

    const now = new Date();
    let start, end;
    if (startDate && endDate) {
        start = startDate;
        end   = endDate;
    } else if (safeGroupBy === 'daily') {
        const past = new Date(now);
        past.setDate(past.getDate() - 29);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    } else if (safeGroupBy === 'yearly') {
        start = `${now.getFullYear() - 4}-01-01`;
        end   = now.toISOString().split('T')[0];
    } else {
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    }

    // Accepts comma-separated department IDs for multi-select. Narrowing to exactly one
    // department switches the breakdown from department-level to section-level ("drill mode").
    let deptClause = '';
    const deptIds = departmentId ? departmentId.split(',').map(s => s.trim()).filter(Boolean) : [];
    const params = [];
    if (deptIds.length > 0) {
        const ph = deptIds.map(() => '?').join(',');
        deptClause = `AND COALESCE(u.departmentId, u.targetDeptId) IN (${ph})`;
        params.push(...deptIds);
    }
    const isSectionDrill = deptIds.length === 1;

    // Table is one row per operator (attempt), not a high-frequency event log, so fetching every
    // latest-attempt row's full gridData JSON (all 16 day columns) is cheap.
    const [rows] = await executeQuery(`
        WITH LatestAttempt AS (
            SELECT
                m.studentId, m.gridData,
                ROW_NUMBER() OVER (PARTITION BY m.studentId ORDER BY m.attemptNumber DESC, m.createdAt DESC) AS rn
            FROM sixteen_day_monitorings m
        )
        SELECT
            la.studentId, la.gridData,
            CAST(COALESCE(u.departmentId, u.targetDeptId) AS NVARCHAR(20)) AS deptId,
            COALESCE(d.name, 'Unassigned') AS departmentName,
            COALESCE(CAST(COALESCE(u.sectionId, u.targetSectionId) AS NVARCHAR(20)), 'unassigned') AS sectionId,
            COALESCE(s.name, 'Unassigned') AS sectionName
        FROM LatestAttempt la
        INNER JOIN users u ON u.id = la.studentId
        LEFT JOIN departments d ON d.id = COALESCE(u.departmentId, u.targetDeptId)
        LEFT JOIN sections s ON s.id = COALESCE(u.sectionId, u.targetSectionId)
        WHERE la.rn = 1
          AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
          ${deptClause}
    `, params);

    // Group key + display name per row, depending on drill mode.
    const groupKeyFor = (row) => isSectionDrill
        ? { key: `sec_${row.sectionId}`, name: row.sectionName || 'Unassigned' }
        : { key: `dept_${row.deptId}`, name: row.departmentName || 'Unassigned' };

    const periodTotals = {};  // period -> { [seriesKey]: count }
    const seriesNames  = {};  // seriesKey -> display name

    for (const row of rows) {
        if (!row.deptId) continue;

        let gridData;
        try {
            gridData = typeof row.gridData === 'string' ? JSON.parse(row.gridData) : (row.gridData || {});
        } catch {
            continue;
        }

        const { key: seriesKey, name: seriesName } = groupKeyFor(row);
        if (!seriesNames[seriesKey]) seriesNames[seriesKey] = seriesName;

        for (let day = 1; day <= 16; day++) {
            const dateObj = parseFlexibleDate(gridData[`attendance_date_${day}`]);
            if (!dateObj) continue;
            const iso = formatDateObj(dateObj);
            if (iso < start || iso > end) continue;

            const period = periodFromIso(iso, safeGroupBy);
            if (!periodTotals[period]) periodTotals[period] = { period };
            periodTotals[period][seriesKey] = (periodTotals[period][seriesKey] || 0) + 1;
        }
    }

    // seriesKeys: stable, name-sorted list the frontend uses to build one Highcharts series
    // per department/section without needing to know the set of keys ahead of time.
    const seriesKeys = Object.entries(seriesNames)
        .map(([key, name]) => ({ key, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    // Zero-fill every period in the requested range so the frontend doesn't need to backfill gaps.
    const trend = buildFullPeriods(safeGroupBy, start, end).map(period => {
        const row = { period };
        seriesKeys.forEach(({ key }) => { row[key] = periodTotals[period]?.[key] || 0; });
        return row;
    });

    res.status(200).json(
        new ApiResponse(200, { trend, seriesKeys, groupBy: safeGroupBy, start, end }, "Sixteen-day monitoring status fetched successfully")
    );
});


/**
 * Get Three-Day Monitoring daily filled-count breakdown for Admin Home page.
 * For every day_date_1..3 field filled in on a student's latest monitoring attempt,
 * count one "filled day" against the period that date falls into (daily/monthly/yearly),
 * grouped by department — or by section once the caller has narrowed to a single department
 * ("drill mode"), matching the same convention as the Sixteen-Day Monitoring chart.
 */
export const getThreeDayMonitoringStatus = asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'monthly', departmentId } = req.query;

    const safeGroupBy = ['daily', 'monthly', 'yearly'].includes(groupBy) ? groupBy : 'monthly';

    const now = new Date();
    let start, end;
    if (startDate && endDate) {
        start = startDate;
        end   = endDate;
    } else if (safeGroupBy === 'daily') {
        const past = new Date(now);
        past.setDate(past.getDate() - 29);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    } else if (safeGroupBy === 'yearly') {
        start = `${now.getFullYear() - 4}-01-01`;
        end   = now.toISOString().split('T')[0];
    } else {
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    }

    // Accepts comma-separated department IDs for multi-select. Narrowing to exactly one
    // department switches the breakdown from department-level to section-level ("drill mode").
    let deptClause = '';
    const deptIds = departmentId ? departmentId.split(',').map(s => s.trim()).filter(Boolean) : [];
    const params = [];
    if (deptIds.length > 0) {
        const ph = deptIds.map(() => '?').join(',');
        deptClause = `AND COALESCE(u.departmentId, u.targetDeptId) IN (${ph})`;
        params.push(...deptIds);
    }
    const isSectionDrill = deptIds.length === 1;

    const [rows] = await executeQuery(`
        WITH LatestAttempt AS (
            SELECT
                m.studentId, m.entries,
                ROW_NUMBER() OVER (PARTITION BY m.studentId ORDER BY m.attemptNumber DESC, m.createdAt DESC) AS rn
            FROM three_day_monitorings m
        )
        SELECT
            la.studentId, la.entries,
            CAST(COALESCE(u.departmentId, u.targetDeptId) AS NVARCHAR(20)) AS deptId,
            COALESCE(d.name, 'Unassigned') AS departmentName,
            COALESCE(CAST(COALESCE(u.sectionId, u.targetSectionId) AS NVARCHAR(20)), 'unassigned') AS sectionId,
            COALESCE(s.name, 'Unassigned') AS sectionName
        FROM LatestAttempt la
        INNER JOIN users u ON u.id = la.studentId
        LEFT JOIN departments d ON d.id = COALESCE(u.departmentId, u.targetDeptId)
        LEFT JOIN sections s ON s.id = COALESCE(u.sectionId, u.targetSectionId)
        WHERE la.rn = 1
          AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
          ${deptClause}
    `, params);

    // Group key + display name per row, depending on drill mode.
    const groupKeyFor = (row) => isSectionDrill
        ? { key: `sec_${row.sectionId}`, name: row.sectionName || 'Unassigned' }
        : { key: `dept_${row.deptId}`, name: row.departmentName || 'Unassigned' };

    const periodTotals = {};  // period -> { [seriesKey]: count }
    const seriesNames  = {};  // seriesKey -> display name

    for (const row of rows) {
        if (!row.deptId) continue;

        let entries;
        try {
            entries = typeof row.entries === 'string' ? JSON.parse(row.entries) : (row.entries || {});
        } catch {
            continue;
        }

        const { key: seriesKey, name: seriesName } = groupKeyFor(row);
        if (!seriesNames[seriesKey]) seriesNames[seriesKey] = seriesName;

        for (let day = 1; day <= 3; day++) {
            const dateObj = parseFlexibleDate(entries[`day_date_${day}`]);
            if (!dateObj) continue;
            const iso = formatDateObj(dateObj);
            if (iso < start || iso > end) continue;

            const period = periodFromIso(iso, safeGroupBy);
            if (!periodTotals[period]) periodTotals[period] = { period };
            periodTotals[period][seriesKey] = (periodTotals[period][seriesKey] || 0) + 1;
        }
    }

    // seriesKeys: stable, name-sorted list the frontend uses to build one Highcharts series
    // per department/section without needing to know the set of keys ahead of time.
    const seriesKeys = Object.entries(seriesNames)
        .map(([key, name]) => ({ key, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    // Zero-fill every period in the requested range so the frontend doesn't need to backfill gaps.
    const trend = buildFullPeriods(safeGroupBy, start, end).map(period => {
        const row = { period };
        seriesKeys.forEach(({ key }) => { row[key] = periodTotals[period]?.[key] || 0; });
        return row;
    });

    res.status(200).json(
        new ApiResponse(200, { trend, seriesKeys, groupBy: safeGroupBy, start, end }, "Three-day monitoring status fetched successfully")
    );
});


/**
 * Get 10-Cycle Check daily filled-count breakdown for Admin Home page.
 * Unlike Sixteen-Day/Three-Day Monitoring, ten_cycle_sheets is scoped directly to
 * department/section/line (not per-student), and its `entries` column is a JSON array of
 * inspection rows that each carry their own ISO `date` field rather than fixed day-slot keys.
 * Count one "filled entry" against the period its date falls into (daily/monthly/yearly),
 * grouped by department — or by section once the caller has narrowed to a single department
 * ("drill mode"), matching the same convention as the other monitoring charts.
 */
export const getCycle10MonitoringStatus = asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'monthly', departmentId } = req.query;

    const safeGroupBy = ['daily', 'monthly', 'yearly'].includes(groupBy) ? groupBy : 'monthly';

    const now = new Date();
    let start, end;
    if (startDate && endDate) {
        start = startDate;
        end   = endDate;
    } else if (safeGroupBy === 'daily') {
        const past = new Date(now);
        past.setDate(past.getDate() - 29);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    } else if (safeGroupBy === 'yearly') {
        start = `${now.getFullYear() - 4}-01-01`;
        end   = now.toISOString().split('T')[0];
    } else {
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    }

    // Accepts comma-separated department IDs for multi-select. Narrowing to exactly one
    // department switches the breakdown from department-level to section-level ("drill mode").
    let deptClause = '';
    const deptIds = departmentId ? departmentId.split(',').map(s => s.trim()).filter(Boolean) : [];
    const params = [];
    if (deptIds.length > 0) {
        const ph = deptIds.map(() => '?').join(',');
        deptClause = `AND s.departmentId IN (${ph})`;
        params.push(...deptIds);
    }
    const isSectionDrill = deptIds.length === 1;

    // One row per sheet (not per-student, no "latest attempt" concept), so fetching every
    // sheet's entries array within the requested department scope is cheap.
    const [rows] = await executeQuery(`
        SELECT
            s.id, s.entries,
            CAST(s.departmentId AS NVARCHAR(20)) AS deptId,
            COALESCE(d.name, 'Unassigned') AS departmentName,
            COALESCE(CAST(s.sectionId AS NVARCHAR(20)), 'unassigned') AS sectionId,
            COALESCE(sec.name, 'Unassigned') AS sectionName
        FROM ten_cycle_sheets s
        LEFT JOIN departments d ON d.id = s.departmentId
        LEFT JOIN sections sec ON sec.id = s.sectionId
        WHERE 1=1
          ${deptClause}
    `, params);

    // Group key + display name per row, depending on drill mode.
    const groupKeyFor = (row) => isSectionDrill
        ? { key: `sec_${row.sectionId}`, name: row.sectionName || 'Unassigned' }
        : { key: `dept_${row.deptId}`, name: row.departmentName || 'Unassigned' };

    const periodTotals = {};  // period -> { [seriesKey]: count }
    const seriesNames  = {};  // seriesKey -> display name

    for (const row of rows) {
        if (!row.deptId) continue;

        let entries;
        try {
            entries = typeof row.entries === 'string' ? JSON.parse(row.entries) : (row.entries || []);
        } catch {
            continue;
        }
        if (!Array.isArray(entries)) continue;

        const { key: seriesKey, name: seriesName } = groupKeyFor(row);
        if (!seriesNames[seriesKey]) seriesNames[seriesKey] = seriesName;

        for (const entry of entries) {
            const dateObj = parseFlexibleDate(entry?.date);
            if (!dateObj) continue;
            const iso = formatDateObj(dateObj);
            if (iso < start || iso > end) continue;

            const period = periodFromIso(iso, safeGroupBy);
            if (!periodTotals[period]) periodTotals[period] = { period };
            periodTotals[period][seriesKey] = (periodTotals[period][seriesKey] || 0) + 1;
        }
    }

    // seriesKeys: stable, name-sorted list the frontend uses to build one Highcharts series
    // per department/section without needing to know the set of keys ahead of time.
    const seriesKeys = Object.entries(seriesNames)
        .map(([key, name]) => ({ key, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    // Zero-fill every period in the requested range so the frontend doesn't need to backfill gaps.
    const trend = buildFullPeriods(safeGroupBy, start, end).map(period => {
        const row = { period };
        seriesKeys.forEach(({ key }) => { row[key] = periodTotals[period]?.[key] || 0; });
        return row;
    });

    res.status(200).json(
        new ApiResponse(200, { trend, seriesKeys, groupBy: safeGroupBy, start, end }, "10-Cycle Check status fetched successfully")
    );
});


/**
 * Get Skill Matrix Certificate filled-item breakdown for Admin Home page.
 * skill_matrix_evaluations has no per-item date (evalData is just a level-item -> {status,val,...}
 * map), only a sheet-level updatedAt/createdAt — unlike the day-column sheets above. So each
 * sheet's count of filled checklist items is attributed to its updatedAt (falling back to
 * createdAt), grouped by department — or by section once the caller has narrowed to a single
 * department ("drill mode"), matching the same convention as the other monitoring charts.
 */
export const getSkillMatrixCertificateStatus = asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'monthly', departmentId } = req.query;

    const safeGroupBy = ['daily', 'monthly', 'yearly'].includes(groupBy) ? groupBy : 'monthly';

    const now = new Date();
    let start, end;
    if (startDate && endDate) {
        start = startDate;
        end   = endDate;
    } else if (safeGroupBy === 'daily') {
        const past = new Date(now);
        past.setDate(past.getDate() - 29);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    } else if (safeGroupBy === 'yearly') {
        start = `${now.getFullYear() - 4}-01-01`;
        end   = now.toISOString().split('T')[0];
    } else {
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    }

    // departmentId on skill_matrix_evaluations is a loose string (real dept id, dept name, or the
    // 'GLOBAL' sentinel) — resolved against departments the same way SkillMatrixEvaluation.listAll
    // does. Accepts comma-separated department IDs for multi-select; narrowing to exactly one
    // department switches the breakdown from department-level to section-level ("drill mode").
    let deptClause = '';
    const deptIds = departmentId ? departmentId.split(',').map(s => s.trim()).filter(Boolean) : [];
    const params = [];
    if (deptIds.length > 0) {
        const ph = deptIds.map(() => '?').join(',');
        deptClause = `AND d.id IN (${ph})`;
        params.push(...deptIds);
    }
    const isSectionDrill = deptIds.length === 1;

    const [rows] = await executeQuery(`
        SELECT
            sme.id, sme.evalData, sme.updatedAt, sme.createdAt,
            CAST(d.id AS NVARCHAR(20)) AS deptId,
            COALESCE(d.name, 'Unassigned') AS departmentName,
            COALESCE(CAST(COALESCE(u.sectionId, u.targetSectionId) AS NVARCHAR(20)), 'unassigned') AS sectionId,
            COALESCE(s.name, 'Unassigned') AS sectionName
        FROM skill_matrix_evaluations sme
        INNER JOIN users u ON u.id = sme.studentId
        LEFT JOIN departments d ON (sme.departmentId = CAST(d.id AS VARCHAR(255)) OR sme.departmentId = d.name)
        LEFT JOIN sections s ON s.id = COALESCE(u.sectionId, u.targetSectionId)
        WHERE (u.isDeleted = 0 OR u.isDeleted IS NULL)
          ${deptClause}
    `, params);

    // Group key + display name per row, depending on drill mode.
    const groupKeyFor = (row) => isSectionDrill
        ? { key: `sec_${row.sectionId}`, name: row.sectionName || 'Unassigned' }
        : { key: `dept_${row.deptId}`, name: row.departmentName || 'Unassigned' };

    const periodTotals = {};  // period -> { [seriesKey]: count }
    const seriesNames  = {};  // seriesKey -> display name

    for (const row of rows) {
        if (!row.deptId) continue;

        let evalData;
        try {
            evalData = typeof row.evalData === 'string' ? JSON.parse(row.evalData) : (row.evalData || {});
        } catch {
            continue;
        }

        const dateObj = row.updatedAt ? new Date(row.updatedAt) : (row.createdAt ? new Date(row.createdAt) : null);
        if (!dateObj || isNaN(dateObj.getTime())) continue;
        const iso = formatDateObj(dateObj);
        if (iso < start || iso > end) continue;

        const filledCount = Object.values(evalData).reduce((count, entry) => {
            if (!entry) return count;
            const hasStandard = String(entry.standard || '').trim() !== '';
            const hasSpeed = String(entry.actualSec || '').trim() !== '' && String(entry.targetSec || '').trim() !== '';
            return count + (hasStandard || hasSpeed ? 1 : 0);
        }, 0);
        if (filledCount === 0) continue;

        const { key: seriesKey, name: seriesName } = groupKeyFor(row);
        if (!seriesNames[seriesKey]) seriesNames[seriesKey] = seriesName;

        const period = periodFromIso(iso, safeGroupBy);
        if (!periodTotals[period]) periodTotals[period] = { period };
        periodTotals[period][seriesKey] = (periodTotals[period][seriesKey] || 0) + filledCount;
    }

    const seriesKeys = Object.entries(seriesNames)
        .map(([key, name]) => ({ key, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const trend = buildFullPeriods(safeGroupBy, start, end).map(period => {
        const row = { period };
        seriesKeys.forEach(({ key }) => { row[key] = periodTotals[period]?.[key] || 0; });
        return row;
    });

    res.status(200).json(
        new ApiResponse(200, { trend, seriesKeys, groupBy: safeGroupBy, start, end }, "Skill matrix certificate status fetched successfully")
    );
});


/**
 * Get Operator Observance Sheet filled-column breakdown for Admin Home page.
 * For every obs1/obs1Re/obs2/obs2Re/obs3/obs3Re/obs4/obs4Re column date filled in on a student's
 * observance sheet, count one "filled observance" against the period that date falls into
 * (daily/monthly/yearly), grouped by department — or by section once the caller has narrowed to
 * a single department ("drill mode"), matching the same convention as the other monitoring charts.
 */
export const getOperatorObservanceStatus = asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'monthly', departmentId } = req.query;

    const safeGroupBy = ['daily', 'monthly', 'yearly'].includes(groupBy) ? groupBy : 'monthly';

    const now = new Date();
    let start, end;
    if (startDate && endDate) {
        start = startDate;
        end   = endDate;
    } else if (safeGroupBy === 'daily') {
        const past = new Date(now);
        past.setDate(past.getDate() - 29);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    } else if (safeGroupBy === 'yearly') {
        start = `${now.getFullYear() - 4}-01-01`;
        end   = now.toISOString().split('T')[0];
    } else {
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    }

    // Accepts comma-separated department IDs for multi-select. Narrowing to exactly one
    // department switches the breakdown from department-level to section-level ("drill mode").
    let deptClause = '';
    const deptIds = departmentId ? departmentId.split(',').map(s => s.trim()).filter(Boolean) : [];
    const params = [];
    if (deptIds.length > 0) {
        const ph = deptIds.map(() => '?').join(',');
        deptClause = `AND COALESCE(u.departmentId, u.targetDeptId) IN (${ph})`;
        params.push(...deptIds);
    }
    const isSectionDrill = deptIds.length === 1;

    // One row per student (no "latest attempt" concept — the table has a single record per
    // studentId), so fetching every sheet's observanceData within the requested scope is cheap.
    const [rows] = await executeQuery(`
        SELECT
            oo.id, oo.observanceData,
            CAST(COALESCE(u.departmentId, u.targetDeptId) AS NVARCHAR(20)) AS deptId,
            COALESCE(d.name, 'Unassigned') AS departmentName,
            COALESCE(CAST(COALESCE(u.sectionId, u.targetSectionId) AS NVARCHAR(20)), 'unassigned') AS sectionId,
            COALESCE(s.name, 'Unassigned') AS sectionName
        FROM operator_observances oo
        INNER JOIN users u ON u.id = oo.studentId
        LEFT JOIN departments d ON d.id = COALESCE(u.departmentId, u.targetDeptId)
        LEFT JOIN sections s ON s.id = COALESCE(u.sectionId, u.targetSectionId)
        WHERE (u.isDeleted = 0 OR u.isDeleted IS NULL)
          ${deptClause}
    `, params);

    // Group key + display name per row, depending on drill mode.
    const groupKeyFor = (row) => isSectionDrill
        ? { key: `sec_${row.sectionId}`, name: row.sectionName || 'Unassigned' }
        : { key: `dept_${row.deptId}`, name: row.departmentName || 'Unassigned' };

    const periodTotals = {};  // period -> { [seriesKey]: count }
    const seriesNames  = {};  // seriesKey -> display name

    const OBS_COLUMN_IDS = ['obs1', 'obs1Re', 'obs2', 'obs2Re', 'obs3', 'obs3Re', 'obs4', 'obs4Re'];

    for (const row of rows) {
        if (!row.deptId) continue;

        let observanceData;
        try {
            observanceData = typeof row.observanceData === 'string' ? JSON.parse(row.observanceData) : (row.observanceData || {});
        } catch {
            continue;
        }

        const { key: seriesKey, name: seriesName } = groupKeyFor(row);
        if (!seriesNames[seriesKey]) seriesNames[seriesKey] = seriesName;

        for (const colId of OBS_COLUMN_IDS) {
            const dateObj = parseFlexibleDate(observanceData.columnDates?.[colId]);
            if (!dateObj) continue;
            const iso = formatDateObj(dateObj);
            if (iso < start || iso > end) continue;

            const period = periodFromIso(iso, safeGroupBy);
            if (!periodTotals[period]) periodTotals[period] = { period };
            periodTotals[period][seriesKey] = (periodTotals[period][seriesKey] || 0) + 1;
        }
    }

    const seriesKeys = Object.entries(seriesNames)
        .map(([key, name]) => ({ key, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const trend = buildFullPeriods(safeGroupBy, start, end).map(period => {
        const row = { period };
        seriesKeys.forEach(({ key }) => { row[key] = periodTotals[period]?.[key] || 0; });
        return row;
    });

    res.status(200).json(
        new ApiResponse(200, { trend, seriesKeys, groupBy: safeGroupBy, start, end }, "Operator observance status fetched successfully")
    );
});


/**
 * Get On-Job Training (OJT) approved-user breakdown for Admin Home page.
 * OJT approvals live in two shapes on on_job_trainings: single-trainee Evaluation sheets
 * (student column set, sheet-level result decides approval) and group Record sheets
 * (student NULL, attendanceRecords holds one JSON row per trainee with its own
 * ecode/result/date). A CTE + OPENJSON flattens both shapes into a common
 * (studentRef, result, entryDate) row before resolving each trainee's current department/section
 * via the users table, grouped by department — or by section once the caller has narrowed to a
 * single department ("drill mode"), matching the same convention as the other monitoring charts.
 * Counts distinct approved users per period (not raw approval rows), so a trainee re-approved
 * more than once within the same period is only counted once.
 */
export const getOnJobTrainingStatus = asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'monthly', departmentId } = req.query;

    const safeGroupBy = ['daily', 'monthly', 'yearly'].includes(groupBy) ? groupBy : 'monthly';

    const now = new Date();
    let start, end;
    if (startDate && endDate) {
        start = startDate;
        end   = endDate;
    } else if (safeGroupBy === 'daily') {
        const past = new Date(now);
        past.setDate(past.getDate() - 29);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    } else if (safeGroupBy === 'yearly') {
        start = `${now.getFullYear() - 4}-01-01`;
        end   = now.toISOString().split('T')[0];
    } else {
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    }

    // Accepts comma-separated department IDs for multi-select. Narrowing to exactly one
    // department switches the breakdown from department-level to section-level ("drill mode").
    let deptClause = '';
    const deptIds = departmentId ? departmentId.split(',').map(s => s.trim()).filter(Boolean) : [];
    const params = [];
    if (deptIds.length > 0) {
        const ph = deptIds.map(() => '?').join(',');
        deptClause = `AND COALESCE(u.departmentId, u.targetDeptId) IN (${ph})`;
        params.push(...deptIds);
    }
    const isSectionDrill = deptIds.length === 1;

    // studentRef is either a user id (single-trainee sheets) or an ecode — matched against
    // empId/userName the same way OnJobTraining.update syncs badges (onJobTraining.controller.js).
    const [rows] = await executeQuery(`
        WITH FlatOjt AS (
            SELECT
                CAST(ojt.student AS NVARCHAR(255)) AS studentRef,
                ojt.result AS entryResult,
                ojt.trainingDate AS trainingDate,
                ojt.createdAt AS createdAt,
                CAST(NULL AS NVARCHAR(50)) AS entryDate
            FROM on_job_trainings ojt
            WHERE ojt.student IS NOT NULL AND LTRIM(RTRIM(ojt.student)) <> ''

            UNION ALL

            SELECT
                JSON_VALUE(ar.value, '$.ecode') AS studentRef,
                JSON_VALUE(ar.value, '$.result') AS entryResult,
                ojt.trainingDate AS trainingDate,
                ojt.createdAt AS createdAt,
                JSON_VALUE(ar.value, '$.date') AS entryDate
            FROM on_job_trainings ojt
            CROSS APPLY OPENJSON(CASE WHEN ISJSON(ojt.attendanceRecords) = 1 THEN ojt.attendanceRecords ELSE '[]' END) ar
            WHERE (ojt.student IS NULL OR LTRIM(RTRIM(ojt.student)) = '')
        )
        SELECT
            u.id AS userId,
            f.trainingDate, f.createdAt, f.entryDate,
            CAST(COALESCE(u.departmentId, u.targetDeptId) AS NVARCHAR(20)) AS deptId,
            COALESCE(d.name, 'Unassigned') AS departmentName,
            COALESCE(CAST(COALESCE(u.sectionId, u.targetSectionId) AS NVARCHAR(20)), 'unassigned') AS sectionId,
            COALESCE(s.name, 'Unassigned') AS sectionName
        FROM FlatOjt f
        INNER JOIN users u
            ON u.id = TRY_CAST(f.studentRef AS INT)
            OR (TRY_CAST(f.studentRef AS INT) IS NULL AND (u.empId = f.studentRef OR u.userName = f.studentRef))
        LEFT JOIN departments d ON d.id = COALESCE(u.departmentId, u.targetDeptId)
        LEFT JOIN sections s ON s.id = COALESCE(u.sectionId, u.targetSectionId)
        WHERE f.entryResult IN ('Approved', 'Pass')
          AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
          ${deptClause}
    `, params);

    // Group key + display name per row, depending on drill mode.
    const groupKeyFor = (row) => isSectionDrill
        ? { key: `sec_${row.sectionId}`, name: row.sectionName || 'Unassigned' }
        : { key: `dept_${row.deptId}`, name: row.departmentName || 'Unassigned' };

    const periodSets  = {};  // period -> { [seriesKey]: Set of userId }
    const seriesNames = {};  // seriesKey -> display name

    for (const row of rows) {
        if (!row.deptId) continue;

        // Prefer the trainee's own attendance-row date; fall back to the sheet's training
        // date, then its creation date, mirroring the same fallback chain used when the
        // approval badge date is set on the user record.
        let dateObj = row.entryDate ? parseFlexibleDate(row.entryDate) : null;
        if (!dateObj && row.trainingDate) {
            const d = new Date(row.trainingDate);
            if (!isNaN(d.getTime())) dateObj = d;
        }
        if (!dateObj && row.createdAt) {
            const d = new Date(row.createdAt);
            if (!isNaN(d.getTime())) dateObj = d;
        }
        if (!dateObj) continue;

        const iso = formatDateObj(dateObj);
        if (iso < start || iso > end) continue;

        const { key: seriesKey, name: seriesName } = groupKeyFor(row);
        if (!seriesNames[seriesKey]) seriesNames[seriesKey] = seriesName;

        const period = periodFromIso(iso, safeGroupBy);
        if (!periodSets[period]) periodSets[period] = {};
        if (!periodSets[period][seriesKey]) periodSets[period][seriesKey] = new Set();
        periodSets[period][seriesKey].add(row.userId);
    }

    const seriesKeys = Object.entries(seriesNames)
        .map(([key, name]) => ({ key, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const trend = buildFullPeriods(safeGroupBy, start, end).map(period => {
        const row = { period };
        seriesKeys.forEach(({ key }) => { row[key] = periodSets[period]?.[key]?.size || 0; });
        return row;
    });

    res.status(200).json(
        new ApiResponse(200, { trend, seriesKeys, groupBy: safeGroupBy, start, end }, "On-job training status fetched successfully")
    );
});


/**
 * Get User Status stats for the Admin Home page
 * Groups counts by isTemporary (Dojo vs Operator) and status
 */
export const getAdminHomeUserStatusStats = asyncHandler(async (req, res) => {
    const { startDate, endDate, departmentId } = req.query;

    let whereClause = "WHERE (isEmployee = 1 OR isTemporary = 1) AND (isDeleted = 0 OR isDeleted IS NULL)";
    let params = [];

    if (startDate && endDate) {
        whereClause += " AND updatedAt >= ? AND updatedAt <= ?";
        params.push(startDate, endDate);
    }

    const deptIds = departmentId ? departmentId.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (deptIds.length > 0) {
        const ph = deptIds.map(() => '?').join(',');
        whereClause += ` AND COALESCE(departmentId, targetDeptId) IN (${ph})`;
        params.push(...deptIds);
    }

    const query = `
        SELECT 
            CASE WHEN isTemporary = 1 THEN 'dojo' ELSE 'operator' END as type,
            status,
            COUNT(*) as value
        FROM users
        ${whereClause}
        GROUP BY isTemporary, status
    `;

    const [rows] = await executeQuery(query, params);

    // Categories we want to ensure exist
    const statuses = ['PRESENT', 'ON LEAVE', 'LEFT'];
    
    const initialData = () => statuses.map(s => ({ 
        name: s.charAt(0) + s.slice(1).toLowerCase(), 
        value: 0 
    }));

    const results = {
        operator: initialData(),
        dojo: initialData()
    };

    rows.forEach(row => {
        const type = row.type; // 'operator' or 'dojo'
        const statusName = row.status.charAt(0) + row.status.slice(1).toLowerCase();
        
        if (results[type]) {
            const index = results[type].findIndex(r => r.name === statusName);
            if (index !== -1) {
                results[type][index].value = row.value;
            } else {
                // Handle unexpected status
                results[type].push({ name: statusName, value: row.value });
            }
        }
    });

    res.status(200).json(
        new ApiResponse(200, results, "User status stats fetched successfully")
    );
});

/**
 * Gets all operator records matching the date range with isTemporary = 1
 * for the Contractor-wise Operator trend chart.
 */
export const getContractorWiseOperatorStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const now = new Date();
    let start = startDate;
    let end = endDate;

    if (!start || !end) {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastOfMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        start = start || firstOfMonth.toISOString().split('T')[0];
        end   = end || lastOfMonth.toISOString().split('T')[0];
    }

    // Date range appears twice (joiningDate branch + createdAt fallback branch) so the
    // WHERE clause stays sargable instead of wrapping the column in COALESCE(...).
    const params = [start, end, start, end];

    const [rows] = await executeQuery(`
        SELECT
            FORMAT(COALESCE(u.joiningDate, CAST(u.createdAt AS DATE)), 'yyyy-MM-dd') AS joiningDate,
            u.contractorId,
            COALESCE(c.name, u.contractor, '') AS contractor
        FROM users u
        LEFT JOIN contractors c ON u.contractorId = c.id
        WHERE (u.expectedHandover IS NOT NULL OR u.isTemporary = 1)
          AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
          AND (
              (u.joiningDate >= ? AND u.joiningDate <= ?)
              OR (u.joiningDate IS NULL AND CAST(u.createdAt AS DATE) >= ? AND CAST(u.createdAt AS DATE) <= ?)
          )
        ORDER BY joiningDate ASC
    `, params);

    res.status(200).json(
        new ApiResponse(200, { users: rows }, "Contractor-wise operator stats fetched successfully")
    );
});


/**
 * Shared implementation for Skill Upgradation Plan / Multi-Skilling Plan comparison charts.
 * Both plan tables (skill_upgradation_plans, multi_skilling_plans) share the same shape:
 * one row per (departmentId, sectionId, year), with tableData being a studentId -> quarter
 * map carrying q{1..4}Date (planned) / q{1..4}DateActual (actual) ISO "YYYY-MM-DD" strings
 * (see admin/src/components/departments/SkillUpgradationPlan.jsx and MultiSkillingPlan.jsx).
 * Counts each quarter's planned/actual date against the period it falls into, grouped by
 * period (daily/monthly/yearly) and by department/section, mirroring the Expected/Actual
 * shape getDojoHandoverComparison returns (trend + deptBreakdown).
 */
const getPlanComparisonStatus = async (tableName, req, res, successMessage) => {
    const { startDate, endDate, groupBy = 'monthly', departmentId } = req.query;

    const safeGroupBy = ['daily', 'monthly', 'yearly'].includes(groupBy) ? groupBy : 'monthly';

    const now = new Date();
    let start, end;
    if (startDate && endDate) {
        start = startDate;
        end   = endDate;
    } else if (safeGroupBy === 'daily') {
        const past = new Date(now);
        past.setDate(past.getDate() - 29);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    } else if (safeGroupBy === 'yearly') {
        start = `${now.getFullYear() - 4}-01-01`;
        end   = now.toISOString().split('T')[0];
    } else {
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        start = past.toISOString().split('T')[0];
        end   = now.toISOString().split('T')[0];
    }

    const startYear = Number(start.slice(0, 4));
    const endYear = Number(end.slice(0, 4));

    // Accepts comma-separated department IDs for multi-select.
    let deptClause = '';
    const deptIds = departmentId ? departmentId.split(',').map(s => s.trim()).filter(Boolean) : [];
    const params = [startYear, endYear];
    if (deptIds.length > 0) {
        const ph = deptIds.map(() => '?').join(',');
        deptClause = `AND p.departmentId IN (${ph})`;
        params.push(...deptIds);
    }

    const [rows] = await executeQuery(`
        SELECT
            p.tableData,
            CAST(p.departmentId AS NVARCHAR(20)) AS deptId,
            COALESCE(CAST(p.sectionId AS NVARCHAR(20)), 'unassigned') AS sectionId,
            COALESCE(s.name, 'Unassigned') AS sectionName
        FROM ${tableName} p
        LEFT JOIN sections s ON s.id = p.sectionId
        WHERE p.year BETWEEN ? AND ?
        ${deptClause}
    `, params);

    const QUARTERS = ['q1', 'q2', 'q3', 'q4'];
    const periodTotals = {};             // period -> { period, expected, actual }
    const deptPeriodTotals = {};         // "deptId__sectionId" -> period -> { expected, actual }
    const deptMeta = {};                 // "deptId__sectionId" -> { deptId, sectionId, sectionName }

    const bump = (key, period, field) => {
        if (!periodTotals[period]) periodTotals[period] = { period, expected: 0, actual: 0 };
        periodTotals[period][field]++;

        if (!deptPeriodTotals[key]) deptPeriodTotals[key] = {};
        if (!deptPeriodTotals[key][period]) deptPeriodTotals[key][period] = { expected: 0, actual: 0 };
        deptPeriodTotals[key][period][field]++;
    };

    for (const row of rows) {
        if (!row.deptId) continue;

        let tableData;
        try {
            tableData = typeof row.tableData === 'string' ? JSON.parse(row.tableData) : (row.tableData || {});
        } catch {
            continue;
        }

        const key = `${row.deptId}__${row.sectionId}`;
        if (!deptMeta[key]) deptMeta[key] = { deptId: row.deptId, sectionId: row.sectionId, sectionName: row.sectionName };

        for (const [studentKey, entry] of Object.entries(tableData)) {
            if (studentKey === '__removedUserIds' || !entry || typeof entry !== 'object') continue;

            for (const q of QUARTERS) {
                const plannedDate = entry[`${q}Date`];
                if (plannedDate && plannedDate >= start && plannedDate <= end) {
                    bump(key, periodFromIso(plannedDate, safeGroupBy), 'expected');
                }

                const actualDate = entry[`${q}DateActual`];
                if (actualDate && actualDate >= start && actualDate <= end) {
                    bump(key, periodFromIso(actualDate, safeGroupBy), 'actual');
                }
            }
        }
    }

    const trend = Object.values(periodTotals).sort((a, b) => a.period.localeCompare(b.period));

    const deptBreakdown = [];
    Object.entries(deptPeriodTotals).forEach(([key, periods]) => {
        const meta = deptMeta[key];
        Object.entries(periods).forEach(([period, vals]) => {
            deptBreakdown.push({
                period,
                deptId: meta.deptId,
                sectionId: meta.sectionId,
                sectionName: meta.sectionName,
                expected: vals.expected,
                actual: vals.actual,
            });
        });
    });
    deptBreakdown.sort((a, b) =>
        Number(a.deptId) - Number(b.deptId) ||
        a.sectionName.localeCompare(b.sectionName) ||
        a.period.localeCompare(b.period)
    );

    res.status(200).json(
        new ApiResponse(200, { trend, deptBreakdown, groupBy: safeGroupBy, start, end }, successMessage)
    );
};

/**
 * Get Skill Upgradation Plan comparison (Planned vs Actual) for Admin Home page.
 */
export const getSkillUpgradationPlanStatus = asyncHandler(async (req, res) => {
    await getPlanComparisonStatus('skill_upgradation_plans', req, res, "Skill upgradation plan status fetched successfully");
});

/**
 * Get Multi-Skilling Plan comparison (Planned vs Actual) for Admin Home page.
 */
export const getMultiSkillingPlanStatus = asyncHandler(async (req, res) => {
    await getPlanComparisonStatus('multi_skilling_plans', req, res, "Multi-skilling plan status fetched successfully");
});
