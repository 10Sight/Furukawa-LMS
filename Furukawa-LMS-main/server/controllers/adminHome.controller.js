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

// Mirrors normalizeContentStructure from EvaluationTestAttemptPage.jsx / evaluationTestAttempt.model.js
const normalizeContentStructureLocal = (structure, fallbackTitle) => {
    if (!Array.isArray(structure) || structure.length === 0) {
        return [{ id: "mt-auto", title: fallbackTitle || "Main Title Section", contentSections: [] }];
    }
    const isNewFormat = structure.every(item => item && Array.isArray(item.contentSections));
    if (isNewFormat) {
        return structure.map(block => ({
            id: block.id || "mt-auto",
            title: block.title || "Main Title Section",
            contentSections: Array.isArray(block.contentSections) ? block.contentSections : []
        }));
    }
    return [{ id: "mt-auto-generated", title: fallbackTitle || "Main Title Section", contentSections: structure }];
};

// Mirrors getDynamicPerformDateCount from EvaluationTestAttemptPage.jsx / evaluationTestAttempt.model.js
const getDynamicPerformDateCountLocal = (attemptDataObj, performDatesArr, baseCount) => {
    let lastEvaluatedColIdx = -1;
    for (let colIdx = 0; colIdx < 100; colIdx++) {
        const hasDate = !!(performDatesArr && performDatesArr[colIdx]);
        let hasGrade = false;
        for (const qId of Object.keys(attemptDataObj || {})) {
            if (qId.startsWith("_")) continue;
            const score = attemptDataObj[qId]?.results?.[colIdx];
            if (score && score !== "") { hasGrade = true; break; }
        }
        if (hasDate || hasGrade) lastEvaluatedColIdx = colIdx;
    }
    let count = Math.max(baseCount || 4, lastEvaluatedColIdx + 1);
    while (count < 100) {
        const lastColIdx = count - 1;
        const hasFailure = Object.keys(attemptDataObj || {}).some(qId => {
            if (qId.startsWith("_")) return false;
            return attemptDataObj[qId]?.results?.[lastColIdx] === "X";
        });
        if (hasFailure) count++;
        else break;
    }
    return count;
};

// Determines pass/fail for a DOJO evaluation attempt at its last evaluated perform-date column.
// Pass: every check/question is "✓" in that column. Fail: any check is "X" or left blank.
// Returns null when the test has no gradable questions (attempt is excluded from stats).
const checkAttemptPassStatus = (attemptDataRaw, performDateCountBase, contentStructureRaw) => {
    let attemptData;
    try {
        attemptData = typeof attemptDataRaw === 'string' ? JSON.parse(attemptDataRaw) : (attemptDataRaw || {});
    } catch {
        attemptData = {};
    }

    let contentStructure;
    try {
        contentStructure = typeof contentStructureRaw === 'string' ? JSON.parse(contentStructureRaw) : (contentStructureRaw || []);
    } catch {
        contentStructure = [];
    }

    const normalized = normalizeContentStructureLocal(contentStructure);
    const allQIds = [];
    normalized.forEach(block => {
        (block.contentSections || []).forEach(content => {
            (content.categories || []).forEach(cat => {
                (cat.questions || []).forEach(q => allQIds.push(q.id));
            });
        });
    });

    if (allQIds.length === 0) return null;

    const performDates = attemptData._performDates || [];
    const count = getDynamicPerformDateCountLocal(attemptData, performDates, performDateCountBase || 4);
    const lastColIdx = count - 1;

    return allQIds.every(qId => attemptData[qId]?.results?.[lastColIdx] === "✓");
};

/**
 * Get Test Paper stats for the Admin Home page
 * Returns aggregated totals + date-bucketed trend series for charts.
 *
 * "Theoretical" comes from theoretical quizzes (attempted_quizzes/quizzes).
 * "Practical" comes from DOJO evaluation test attempts (evaluation_test_attempts) —
 * pass/fail is derived from the last evaluated perform-date column (see checkAttemptPassStatus).
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

    // Only theoretical quizzes feed the quiz-based side of these stats now —
    // practical numbers come from DOJO evaluation test attempts below.
    const baseFrom = `
        FROM attempted_quizzes aq
        JOIN quizzes q ON aq.quiz = q.id
        JOIN users u ON aq.student = u.id
        WHERE aq.completedAt >= ? AND aq.completedAt <= ?
        AND q.isTheoretical = 1
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

    // Time-series for Chart 2 (theoretical half): pass/fail per period
    const trendByResultQuery = `
        SELECT
            ${periodExpr} AS period,
            SUM(CASE WHEN aq.status = 'PASSED' THEN 1 ELSE 0 END) AS passedTheoretical,
            SUM(CASE WHEN aq.status != 'PASSED' THEN 1 ELSE 0 END) AS failedTheoretical
        ${baseFrom}
        GROUP BY ${periodExpr}
        ORDER BY period ASC
    `;

    // Build the equivalent filters for DOJO evaluation test attempts (practical side)
    const evalPeriodFormatMap = {
        daily:   "FORMAT(CAST(a.createdAt AS DATE), 'yyyy-MM-dd')",
        monthly: "FORMAT(CAST(a.createdAt AS DATE), 'yyyy-MM')",
        yearly:  "FORMAT(CAST(a.createdAt AS DATE), 'yyyy')",
    };
    const evalPeriodExpr = evalPeriodFormatMap[safeGroupBy];

    let evalFilterClause = '';
    const evalParams = [start, end];

    if (departmentId && departmentId !== 'all' && departmentId !== '') {
        evalFilterClause += ' AND COALESCE(u.departmentId, CASE WHEN u.isTemporary = 1 THEN u.targetDeptId ELSE NULL END) = ?';
        evalParams.push(departmentId);
    }

    if (isDojo !== undefined && isDojo !== '' && isDojo !== 'all') {
        evalFilterClause += ' AND u.isTemporary = ?';
        evalParams.push(isDojo === 'true' || isDojo === '1' ? 1 : 0);
    }

    const evalAttemptsQuery = `
        SELECT
            a.attemptData,
            t.performDateCount,
            t.contentStructure,
            ${evalPeriodExpr} AS period
        FROM evaluation_test_attempts a
        JOIN evaluation_tests t ON a.testId = t.id
        LEFT JOIN users u ON a.userId = u.id OR (a.userId IS NULL AND a.employeeNo = u.empId)
        WHERE a.createdAt >= ? AND a.createdAt <= ?
        ${evalFilterClause}
    `;

    const [totalRows]       = await executeQuery(totalQuery,       baseParams);
    const [passFailRows]    = await executeQuery(passFailQuery,    baseParams);
    const [trendTypeRows]   = await executeQuery(trendByTypeQuery, baseParams);
    const [trendResultRows] = await executeQuery(trendByResultQuery, baseParams);
    const [evalRows]        = await executeQuery(evalAttemptsQuery, evalParams);

    // Compute pass/fail per DOJO evaluation attempt, grouped by period
    const evalByPeriod = {};
    let totalPracticalPassed = 0;
    let totalPracticalFailed = 0;
    evalRows.forEach(row => {
        const passed = checkAttemptPassStatus(row.attemptData, row.performDateCount, row.contentStructure);
        if (passed === null) return; // no gradable questions — exclude from stats

        if (!evalByPeriod[row.period]) {
            evalByPeriod[row.period] = { passedPractical: 0, failedPractical: 0 };
        }
        if (passed) {
            evalByPeriod[row.period].passedPractical++;
            totalPracticalPassed++;
        } else {
            evalByPeriod[row.period].failedPractical++;
            totalPracticalFailed++;
        }
    });

    // Merge theoretical (SQL) + practical (JS-computed) trend series by period
    const trendMap = {};
    trendResultRows.forEach(r => {
        trendMap[r.period] = {
            period: r.period,
            passedTheoretical: Number(r.passedTheoretical) || 0,
            failedTheoretical: Number(r.failedTheoretical) || 0,
            passedPractical: 0,
            failedPractical: 0,
        };
    });
    Object.entries(evalByPeriod).forEach(([period, counts]) => {
        if (!trendMap[period]) {
            trendMap[period] = { period, passedTheoretical: 0, failedTheoretical: 0, passedPractical: 0, failedPractical: 0 };
        }
        trendMap[period].passedPractical = counts.passedPractical;
        trendMap[period].failedPractical = counts.failedPractical;
    });
    const trendByResult = Object.values(trendMap).sort((a, b) => a.period.localeCompare(b.period));

    // Merge theoretical (SQL) + practical (JS-computed) type-volume trend by period
    const typeTrendMap = {};
    trendTypeRows.forEach(r => {
        typeTrendMap[r.period] = { period: r.period, theoretical: Number(r.theoretical) || 0, practical: 0 };
    });
    Object.entries(evalByPeriod).forEach(([period, counts]) => {
        if (!typeTrendMap[period]) {
            typeTrendMap[period] = { period, theoretical: 0, practical: 0 };
        }
        typeTrendMap[period].practical = counts.passedPractical + counts.failedPractical;
    });
    const trendByType = Object.values(typeTrendMap).sort((a, b) => a.period.localeCompare(b.period));

    const totalDistribution = [
        { name: 'Theoretical', value: totalRows[0]?.value || 0 },
        { name: 'Practical',   value: totalPracticalPassed + totalPracticalFailed },
    ];

    const passFailData = [
        ...passFailRows,
        { type: 'Practical', status: 'Passed', value: totalPracticalPassed },
        { type: 'Practical', status: 'Failed', value: totalPracticalFailed },
    ];

    res.status(200).json(
        new ApiResponse(200, {
            totalDistribution,
            passFailData,
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
        WHERE (expectedHandover IS NOT NULL OR isTemporary = 1)
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

    const expectedFormatMap = {
        daily:   "FORMAT(expectedHandover, 'yyyy-MM-dd')",
        monthly: "FORMAT(expectedHandover, 'yyyy-MM')",
        yearly:  "FORMAT(expectedHandover, 'yyyy')",
    };
    const actualFormatMap = {
        daily:   "FORMAT(hs.date, 'yyyy-MM-dd')",
        monthly: "FORMAT(hs.date, 'yyyy-MM')",
        yearly:  "FORMAT(hs.date, 'yyyy')",
    };

    // Temp users store their destination in targetDeptId; after handover it moves to departmentId
    // Accepts comma-separated IDs for multi-select
    let expectedDeptClause = '';
    let actualDeptClausePrefixed = '';
    const expectedParams = [start, end];
    const actualParams   = [start, end];
    const deptIds = departmentId ? departmentId.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (deptIds.length > 0) {
        const ph = deptIds.map(() => '?').join(',');
        expectedDeptClause = `AND COALESCE(departmentId, targetDeptId) IN (${ph})`;
        actualDeptClausePrefixed = `AND COALESCE(u.departmentId, u.targetDeptId) IN (${ph})`;
        expectedParams.push(...deptIds);
        actualParams.push(...deptIds);
    }

    const [expectedRows] = await executeQuery(`
        SELECT
            ${expectedFormatMap[safeGroupBy]} AS period,
            COUNT(*)                          AS expected
        FROM users
        WHERE (isTemporary = 1 OR expectedHandover IS NOT NULL)
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
        WHERE (isTemporary = 1 OR expectedHandover IS NOT NULL)
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
            COUNT(DISTINCT u.id)            AS actual
        FROM users u
        INNER JOIN handover_sheets hs ON 1=1
        CROSS APPLY OPENJSON(hs.entries) as entry
        WHERE TRY_CAST(JSON_VALUE(entry.value, '$.studentId') AS INT) = u.id
          AND JSON_VALUE(entry.value, '$.interviewStatus') = 'APPROVE'
          AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
          AND hs.date >= ?
          AND hs.date <= ?
          ${actualDeptClausePrefixed}
        GROUP BY ${actualFormatMap[safeGroupBy]}
        ORDER BY period ASC
    `, actualParams);

    // Per-department actual breakdown (grouped by period + COALESCE(u.departmentId, u.targetDeptId))
    const [deptActualRows] = await executeQuery(`
        SELECT
            ${actualFormatMap[safeGroupBy]}            AS period,
            CAST(COALESCE(u.departmentId, u.targetDeptId) AS NVARCHAR(20))     AS deptId,
            COUNT(DISTINCT u.id)                       AS actual
        FROM users u
        INNER JOIN handover_sheets hs ON 1=1
        CROSS APPLY OPENJSON(hs.entries) as entry
        WHERE TRY_CAST(JSON_VALUE(entry.value, '$.studentId') AS INT) = u.id
          AND JSON_VALUE(entry.value, '$.interviewStatus') = 'APPROVE'
          AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
          AND COALESCE(u.departmentId, u.targetDeptId) IS NOT NULL
          AND hs.date >= ?
          AND hs.date <= ?
          ${actualDeptClausePrefixed}
        GROUP BY ${actualFormatMap[safeGroupBy]}, COALESCE(u.departmentId, u.targetDeptId)
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
