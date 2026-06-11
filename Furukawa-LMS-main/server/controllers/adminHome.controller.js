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
        whereClause += " AND createdAt >= ? AND createdAt <= ?";
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
 * Returns distribution of total attempts and pass/fail results
 */
export const getAdminHomeTestPaperStats = asyncHandler(async (req, res) => {
    const { startDate, endDate, departmentId, isDojo } = req.query;
    
    let whereClause = "WHERE 1=1";
    let params = [];

    if (startDate && endDate) {
        whereClause += " AND aq.completedAt >= ? AND aq.completedAt <= ?";
        params.push(startDate, endDate);
    }

    if (departmentId && departmentId !== 'all') {
        whereClause += " AND u.departmentId = ?";
        params.push(departmentId);
    }

    if (isDojo !== undefined && isDojo !== 'all') {
        whereClause += " AND u.isTemporary = ?";
        params.push(isDojo === 'true' || isDojo === '1' ? 1 : 0);
    }

    // Query 1: Total distribution (Theoritical vs Practical)
    const totalQuery = `
        SELECT 
            CASE WHEN q.isTheoretical = 1 THEN 'Theoretical' ELSE 'Practical' END as name,
            COUNT(*) as value
        FROM attempted_quizzes aq
        JOIN quizzes q ON aq.quiz = q.id
        JOIN users u ON aq.student = u.id
        ${whereClause}
        GROUP BY CASE WHEN q.isTheoretical = 1 THEN 'Theoretical' ELSE 'Practical' END
    `;

    // Query 2: Pass/Fail distribution grouped by type
    const passFailQuery = `
        SELECT 
            CASE WHEN q.isTheoretical = 1 THEN 'Theoretical' ELSE 'Practical' END as type,
            CASE WHEN aq.status = 'PASSED' THEN 'Passed' ELSE 'Failed' END as status,
            COUNT(*) as value
        FROM attempted_quizzes aq
        JOIN quizzes q ON aq.quiz = q.id
        JOIN users u ON aq.student = u.id
        ${whereClause}
        GROUP BY 
            CASE WHEN q.isTheoretical = 1 THEN 'Theoretical' ELSE 'Practical' END, 
            CASE WHEN aq.status = 'PASSED' THEN 'Passed' ELSE 'Failed' END
    `;

    const [totalRows] = await executeQuery(totalQuery, params);
    const [passFailRows] = await executeQuery(passFailQuery, params);

    // Format total distribution
    const totalDistribution = [
        { name: 'Theoretical', value: 0 },
        { name: 'Practical', value: 0 }
    ];

    totalRows.forEach(row => {
        const item = totalDistribution.find(d => d.name === row.name);
        if (item) item.value = row.value;
    });

    res.status(200).json(
        new ApiResponse(200, {
            totalDistribution,
            passFailData: passFailRows
        }, "Test paper stats fetched successfully")
    );
});

/**
 * Get Dojo Hiring Trend for Admin Home page
 * Groups isTemporary users by creation month so historical counts survive handovers.
 * Uses empId LIKE 'TEMP%' instead of current isTemporary flag — once promoted the flag
 * flips to 0 but the TEMP prefix on empId is permanent, preserving the hire event.
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
        daily:   "FORMAT(createdAt, 'yyyy-MM-dd')",
        monthly: "FORMAT(createdAt, 'yyyy-MM')",
        yearly:  "FORMAT(createdAt, 'yyyy')",
    };
    const periodExpr = formatMap[safeGroupBy];

    // Build optional department filter
    // Temp users store dept in targetDeptId; after handover it moves to departmentId
    const params = [start, end];
    let deptClause = '';
    if (departmentId && departmentId !== '' && departmentId !== 'all') {
        deptClause = 'AND (targetDeptId = ? OR departmentId = ?)';
        params.push(departmentId, departmentId);
    }

    const [rows] = await executeQuery(`
        SELECT
            ${periodExpr}                                                               AS period,
            COUNT(*)                                                                    AS total,
            SUM(CASE WHEN gender = 'MALE'   THEN 1 ELSE 0 END)                         AS maleCount,
            SUM(CASE WHEN gender = 'FEMALE' THEN 1 ELSE 0 END)                         AS femaleCount,
            SUM(CASE WHEN gender NOT IN ('MALE','FEMALE') OR gender IS NULL THEN 1 ELSE 0 END) AS otherCount
        FROM users
        WHERE empId LIKE 'TEMP%'
          AND (isDeleted = 0 OR isDeleted IS NULL)
          AND createdAt >= ?
          AND createdAt <= ?
          ${deptClause}
        GROUP BY ${periodExpr}
        ORDER BY period ASC
    `, params);

    res.status(200).json(
        new ApiResponse(200, { trend: rows, groupBy: safeGroupBy, start, end }, "Dojo hiring trend fetched successfully")
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
