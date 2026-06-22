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
 * Returns aggregated totals + date-bucketed trend series for charts.
 */
export const getAdminHomeTestPaperStats = asyncHandler(async (req, res) => {
    const { startDate, endDate, departmentId, isDojo, groupBy = 'monthly' } = req.query;

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
        filterClause += ' AND u.isTemporary = ?';
        baseParams.push(isDojo === 'true' || isDojo === '1' ? 1 : 0);
    }

    const baseFrom = `
        FROM attempted_quizzes aq
        JOIN quizzes q ON aq.quiz = q.id
        JOIN users u ON aq.student = u.id
        WHERE aq.completedAt >= ? AND aq.completedAt <= ?
        ${filterClause}
    `;

    // Aggregated totals (used for footer metrics)
    const totalQuery = `
        SELECT
            CASE WHEN q.isTheoretical = 1 THEN 'Theoretical' ELSE 'Practical' END AS name,
            COUNT(*) AS value
        ${baseFrom}
        GROUP BY CASE WHEN q.isTheoretical = 1 THEN 'Theoretical' ELSE 'Practical' END
    `;

    const passFailQuery = `
        SELECT
            CASE WHEN q.isTheoretical = 1 THEN 'Theoretical' ELSE 'Practical' END AS type,
            CASE WHEN aq.status = 'PASSED' THEN 'Passed' ELSE 'Failed' END AS status,
            COUNT(*) AS value
        ${baseFrom}
        GROUP BY
            CASE WHEN q.isTheoretical = 1 THEN 'Theoretical' ELSE 'Practical' END,
            CASE WHEN aq.status = 'PASSED' THEN 'Passed' ELSE 'Failed' END
    `;

    // Time-series for Chart 1: theoretical vs practical counts per period
    const trendByTypeQuery = `
        SELECT
            ${periodExpr} AS period,
            SUM(CASE WHEN q.isTheoretical = 1 THEN 1 ELSE 0 END) AS theoretical,
            SUM(CASE WHEN q.isTheoretical = 0 THEN 1 ELSE 0 END) AS practical
        ${baseFrom}
        GROUP BY ${periodExpr}
        ORDER BY period ASC
    `;

    // Time-series for Chart 2: pass/fail broken down by test type per period
    const trendByResultQuery = `
        SELECT
            ${periodExpr} AS period,
            SUM(CASE WHEN aq.status = 'PASSED' AND q.isTheoretical = 1 THEN 1 ELSE 0 END) AS passedTheoretical,
            SUM(CASE WHEN aq.status != 'PASSED' AND q.isTheoretical = 1 THEN 1 ELSE 0 END) AS failedTheoretical,
            SUM(CASE WHEN aq.status = 'PASSED' AND q.isTheoretical = 0 THEN 1 ELSE 0 END) AS passedPractical,
            SUM(CASE WHEN aq.status != 'PASSED' AND q.isTheoretical = 0 THEN 1 ELSE 0 END) AS failedPractical
        ${baseFrom}
        GROUP BY ${periodExpr}
        ORDER BY period ASC
    `;

    const [totalRows]       = await executeQuery(totalQuery,       baseParams);
    const [passFailRows]    = await executeQuery(passFailQuery,    baseParams);
    const [trendTypeRows]   = await executeQuery(trendByTypeQuery, baseParams);
    const [trendResultRows] = await executeQuery(trendByResultQuery, baseParams);

    const totalDistribution = [
        { name: 'Theoretical', value: 0 },
        { name: 'Practical',   value: 0 },
    ];
    totalRows.forEach(row => {
        const item = totalDistribution.find(d => d.name === row.name);
        if (item) item.value = row.value;
    });

    res.status(200).json(
        new ApiResponse(200, {
            totalDistribution,
            passFailData:   passFailRows,
            trendByType:    trendTypeRows,
            trendByResult:  trendResultRows,
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
 * We use (empId LIKE 'TEMP%' OR isTemporary = 1) so we capture:
 *   - Users still in the pipeline      → isTemporary = 1
 *   - Users promoted/handed-over        → isTemporary = 0 but empId still starts TEMP
 *   - Bulk-imported users whose empId   → may not start with TEMP, caught by isTemporary = 1
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
    const params = [start, end];
    let deptClause = '';
    const deptIds = departmentId ? departmentId.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (deptIds.length > 0) {
        const ph = deptIds.map(() => '?').join(',');
        deptClause = `AND (targetDeptId IN (${ph}) OR departmentId IN (${ph}))`;
        params.push(...deptIds, ...deptIds);
    }

    const [rows] = await executeQuery(`
        SELECT
            ${periodExpr}                                                               AS period,
            COUNT(*)                                                                    AS total,
            SUM(CASE WHEN gender = 'MALE'   THEN 1 ELSE 0 END)                         AS maleCount,
            SUM(CASE WHEN gender = 'FEMALE' THEN 1 ELSE 0 END)                         AS femaleCount,
            SUM(CASE WHEN gender NOT IN ('MALE','FEMALE') OR gender IS NULL THEN 1 ELSE 0 END) AS otherCount
        FROM users
        WHERE (empId LIKE 'TEMP%' OR isTemporary = 1)
          AND (isDeleted = 0 OR isDeleted IS NULL)
          AND COALESCE(joiningDate, CAST(createdAt AS DATE)) >= ?
          AND COALESCE(joiningDate, CAST(createdAt AS DATE)) <= ?
          ${deptClause}
        GROUP BY ${periodExpr}
        ORDER BY period ASC
    `, params);

    res.status(200).json(
        new ApiResponse(200, { trend: rows, groupBy: safeGroupBy, start, end }, "Dojo hiring trend fetched successfully")
    );
});


/**
 * Get Dojo Handover Comparison for Admin Home page
 * Expected Handover: dojo users grouped by their expectedHandover date
 * Actual Handover:   handed-over users (empId LIKE 'TEMP%' AND isTemporary=0) grouped by updatedAt
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

    const expectedFormatMap = {
        daily:   "FORMAT(expectedHandover, 'yyyy-MM-dd')",
        monthly: "FORMAT(expectedHandover, 'yyyy-MM')",
        yearly:  "FORMAT(expectedHandover, 'yyyy')",
    };
    const actualFormatMap = {
        daily:   "FORMAT(CAST(updatedAt AS DATE), 'yyyy-MM-dd')",
        monthly: "FORMAT(CAST(updatedAt AS DATE), 'yyyy-MM')",
        yearly:  "FORMAT(CAST(updatedAt AS DATE), 'yyyy')",
    };

    // Temp users store their destination in targetDeptId; after handover it moves to departmentId
    // Accepts comma-separated IDs for multi-select
    let expectedDeptClause = '';
    let actualDeptClause = '';
    const expectedParams = [start, end];
    const actualParams   = [start, end];
    const deptIds = departmentId ? departmentId.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (deptIds.length > 0) {
        const ph = deptIds.map(() => '?').join(',');
        expectedDeptClause = `AND COALESCE(departmentId, targetDeptId) IN (${ph})`;
        actualDeptClause   = `AND COALESCE(departmentId, targetDeptId) IN (${ph})`;
        expectedParams.push(...deptIds);
        actualParams.push(...deptIds);
    }

    const [expectedRows] = await executeQuery(`
        SELECT
            ${expectedFormatMap[safeGroupBy]} AS period,
            COUNT(*)                          AS expected
        FROM users
        WHERE (isTemporary = 1 OR empId LIKE 'TEMP%')
          AND (isDeleted = 0 OR isDeleted IS NULL)
          AND expectedHandover IS NOT NULL
          AND expectedHandover >= ?
          AND expectedHandover <= ?
          ${expectedDeptClause}
        GROUP BY ${expectedFormatMap[safeGroupBy]}
        ORDER BY period ASC
    `, expectedParams);

    // Per-department expected breakdown (same filters, grouped by period + COALESCE(departmentId, targetDeptId))
    const [deptExpectedRows] = await executeQuery(`
        SELECT
            ${expectedFormatMap[safeGroupBy]} AS period,
            CAST(COALESCE(departmentId, targetDeptId) AS NVARCHAR(20)) AS deptId,
            COUNT(*)                           AS expected
        FROM users
        WHERE (isTemporary = 1 OR empId LIKE 'TEMP%')
          AND (isDeleted = 0 OR isDeleted IS NULL)
          AND expectedHandover IS NOT NULL
          AND COALESCE(departmentId, targetDeptId) IS NOT NULL
          AND expectedHandover >= ?
          AND expectedHandover <= ?
          ${expectedDeptClause}
        GROUP BY ${expectedFormatMap[safeGroupBy]}, COALESCE(departmentId, targetDeptId)
        ORDER BY period ASC
    `, expectedParams);

    const [actualRows] = await executeQuery(`
        SELECT
            ${actualFormatMap[safeGroupBy]} AS period,
            COUNT(*)                        AS actual
        FROM users
        WHERE empId LIKE 'TEMP%'
          AND isTemporary = 0
          AND (isDeleted = 0 OR isDeleted IS NULL)
          AND CAST(updatedAt AS DATE) >= ?
          AND CAST(updatedAt AS DATE) <= ?
          ${actualDeptClause}
        GROUP BY ${actualFormatMap[safeGroupBy]}
        ORDER BY period ASC
    `, actualParams);

    // Per-department actual breakdown (grouped by period + COALESCE(departmentId, targetDeptId))
    const [deptActualRows] = await executeQuery(`
        SELECT
            ${actualFormatMap[safeGroupBy]}            AS period,
            CAST(COALESCE(departmentId, targetDeptId) AS NVARCHAR(20))         AS deptId,
            COUNT(*)                                   AS actual
        FROM users
        WHERE empId LIKE 'TEMP%'
          AND isTemporary = 0
          AND (isDeleted = 0 OR isDeleted IS NULL)
          AND COALESCE(departmentId, targetDeptId) IS NOT NULL
          AND CAST(updatedAt AS DATE) >= ?
          AND CAST(updatedAt AS DATE) <= ?
          ${actualDeptClause}
        GROUP BY ${actualFormatMap[safeGroupBy]}, COALESCE(departmentId, targetDeptId)
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

    // Build per-dept breakdown merging expected + actual per (deptId, period)
    const deptExpMap = {};
    deptExpectedRows.forEach(r => {
        if (!deptExpMap[r.deptId]) deptExpMap[r.deptId] = {};
        deptExpMap[r.deptId][r.period] = Number(r.expected);
    });

    const deptActMap = {};
    deptActualRows.forEach(r => {
        if (!deptActMap[r.deptId]) deptActMap[r.deptId] = {};
        deptActMap[r.deptId][r.period] = Number(r.actual);
    });

    // Collect all unique (deptId, period) pairs from both expected and actual rows
    const deptPeriodPairs = new Map();
    deptExpectedRows.forEach(r => {
        const key = `${r.deptId}__${r.period}`;
        if (!deptPeriodPairs.has(key)) deptPeriodPairs.set(key, { deptId: String(r.deptId), period: r.period });
    });
    deptActualRows.forEach(r => {
        const key = `${r.deptId}__${r.period}`;
        if (!deptPeriodPairs.has(key)) deptPeriodPairs.set(key, { deptId: String(r.deptId), period: r.period });
    });

    const deptBreakdown = [...deptPeriodPairs.values()].map(({ deptId, period }) => ({
        period,
        deptId,
        expected: deptExpMap[deptId]?.[period] || 0,
        actual:   deptActMap[deptId]?.[period]  || 0,
    })).sort((a, b) => Number(a.deptId) - Number(b.deptId) || a.period.localeCompare(b.period));

    res.status(200).json(
        new ApiResponse(200, { trend, deptBreakdown, groupBy: safeGroupBy, start, end }, "Dojo handover comparison fetched successfully")
    );
});


/**
 * Get User Status stats for the Admin Home page
 * Groups counts by isTemporary (Dojo vs Operator) and status
 */
export const getAdminHomeUserStatusStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    let whereClause = "WHERE (isEmployee = 1 OR isTemporary = 1) AND (isDeleted = 0 OR isDeleted IS NULL)";
    let params = [];

    if (startDate && endDate) {
        whereClause += " AND updatedAt >= ? AND updatedAt <= ?";
        params.push(startDate, endDate);
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
