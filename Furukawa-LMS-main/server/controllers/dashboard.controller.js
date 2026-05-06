import { executeQuery } from "../db/mssqlHelper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { poolPromise, mssql as sql } from "../db/connectDB.js";

export const getDashboardStats = asyncHandler(async (req, res) => {
    const { department, section, line, startDate, endDate } = req.query;

    let currentYear = new Date().getFullYear();
    let currentMonthNum = new Date().getMonth() + 1;           // 1-based
    let currentMonth = new Date().toLocaleString('en-US', { month: 'long' });

    if (startDate) {
        const d = new Date(startDate);
        currentYear = d.getFullYear();
        currentMonthNum = d.getMonth() + 1;
        currentMonth = d.toLocaleString('en-US', { month: 'long' });
    }

    const daysInMonth = new Date(currentYear, currentMonthNum, 0).getDate();

    // ── Step 1: Resolve department/section/line IDs → names ───────────────────
    let departmentName = null;
    let sectionName = null;
    let lineName = null;

    if (department && department !== 'ALL' && !isNaN(department)) {
        try {
            const [r] = await executeQuery("SELECT name FROM [departments] WHERE id = ?", [department]);
            if (r.length > 0) departmentName = r[0].name.trim();
        } catch (e) { console.warn("[DASHBOARD] department lookup failed:", e.message); }
    }

    if (section && section !== 'ALL' && !isNaN(section)) {
        try {
            const [r] = await executeQuery("SELECT name FROM [sections] WHERE id = ?", [section]);
            if (r.length > 0) sectionName = r[0].name.trim();
        } catch (e) { console.warn("[DASHBOARD] section lookup failed:", e.message); }
    }
    if (line && line !== 'ALL' && !isNaN(line)) {
        try {
            const [r] = await executeQuery("SELECT name FROM [lines] WHERE id = ?", [line]);
            if (r.length > 0) lineName = r[0].name.trim();
        } catch (e) { console.warn("[DASHBOARD] line lookup failed:", e.message); }
    }

    const safeName = (s) => s.replace(/'/g, "''");

    // ── Step 2: Build hierarchy WHERE condition ───────────────────────────────
    // TABLE COLUMNS: uhs.[department], uhs.[section]  and  uhs.[lines]
    let hierCondition = '';
    if (departmentName) hierCondition += ` AND UPPER(LTRIM(RTRIM(uhs.[department]))) = UPPER('${safeName(departmentName)}')`;
    if (sectionName) hierCondition += ` AND UPPER(LTRIM(RTRIM(uhs.[section]))) = UPPER('${safeName(sectionName)}')`;
    if (lineName) hierCondition += ` AND UPPER(LTRIM(RTRIM(uhs.[lines])))   = UPPER('${safeName(lineName)}')`;

    console.log(`[DASHBOARD] Filter → dept: "${departmentName}", section: "${sectionName}", line: "${lineName}"`);
    console.log(`[DASHBOARD] hierCondition: ${hierCondition}`);

    // ── Step 3: Requirements ──────────────────────────────────────────────────
    let reqResults = [];

    const buildReqFilterCamel = (deptId, secId, lineId) => {
        let extra = '';
        if (deptId && deptId !== 'ALL' && !isNaN(deptId))
            extra += ` AND departmentName = (SELECT name FROM [departments] WHERE id = ${parseInt(deptId)})`;
        if (secId && secId !== 'ALL' && !isNaN(secId))
            extra += ` AND sectionName = (SELECT name FROM [sections] WHERE id = ${parseInt(secId)})`;
        if (lineId && lineId !== 'ALL' && !isNaN(lineId))
            extra += ` AND lineDescription = (SELECT name FROM [lines] WHERE id = ${parseInt(lineId)})`;
        return extra;
    };

    const buildReqFilterSnake = (deptId, secId, lineId) => {
        let extra = '';
        if (deptId && deptId !== 'ALL' && !isNaN(deptId))
            extra += ` AND department_name = (SELECT name FROM [departments] WHERE id = ${parseInt(deptId)})`;
        if (secId && secId !== 'ALL' && !isNaN(secId))
            extra += ` AND section_name = (SELECT name FROM [sections] WHERE id = ${parseInt(secId)})`;
        if (lineId && lineId !== 'ALL' && !isNaN(lineId))
            extra += ` AND description_line = (SELECT name FROM [lines] WHERE id = ${parseInt(lineId)})`;
        return extra;
    };

    try {
        const filter = buildReqFilterCamel(department, section, line);
        const sql1 = `
            SELECT monthName AS month, CAST(SUM(ISNULL(prodPlan,0)) AS BIGINT) AS required_count
            FROM requirements
            WHERE [year] = ${currentYear} ${filter}
            GROUP BY monthName
        `;
        const [rows] = await executeQuery(sql1, []);
        reqResults = rows;
        console.log(`[DASHBOARD] camelCase req query OK, rows: ${rows.length}`);
    } catch (e1) {
        console.warn("[DASHBOARD] camelCase req query failed:", e1.message);
        try {
            const filter = buildReqFilterSnake(department, section, line);
            const sql2 = `
                SELECT month_name AS month, CAST(SUM(ISNULL(prod_plan,0)) AS BIGINT) AS required_count
                FROM requirements
                WHERE year_val = ${currentYear} ${filter}
                GROUP BY month_name
            `;
            const [rows] = await executeQuery(sql2, []);
            reqResults = rows;
            console.log(`[DASHBOARD] snake_case req query OK, rows: ${rows.length}`);
        } catch (e2) {
            console.warn("[DASHBOARD] snake_case req query also failed:", e2.message);
        }
    }

    // ── Step 4: Current headcount from snapshots ──────────────────────────────
    let snapshotTotal = 0;
    try {
        const [snapRows] = await executeQuery(
            `SELECT COUNT(DISTINCT employeeid) AS total
             FROM user_hierarchy_snapshots uhs
             WHERE 1=1 ${hierCondition}`,
            []
        );
        snapshotTotal = Number(snapRows[0]?.total) || 0;
        console.log(`[DASHBOARD] Snapshot headcount: ${snapshotTotal}`);
    } catch (e) {
        console.warn("[DASHBOARD] Snapshot headcount query failed:", e.message);
    }

    // ── Step 5: Daily attendance (current month) ──────────────────────────────
    let dailyAttendance = [];
    try {
        const attSql = `
            SELECT
                CONVERT(VARCHAR, al.[date], 23) AS fullDate,
                DAY(al.[date])  AS dayNum,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT'                          THEN 1 ELSE 0 END) AS presentCount,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','HALF DAY','LEAVE')     THEN 1 ELSE 0 END) AS absentCount,
                COUNT(*)        AS totalCount
            FROM attendance_logs al
            INNER JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS VARCHAR))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS VARCHAR))))
            WHERE 1=1
              ${startDate && endDate 
                  ? ` AND al.[date] >= '${startDate}' AND al.[date] <= '${endDate}' `
                  : ` AND YEAR(al.[date]) = ${currentYear} AND MONTH(al.[date]) = ${currentMonthNum} `
              }
              ${hierCondition}
            GROUP BY al.[date], DAY(al.[date])
            ORDER BY al.[date]
        `;
        const [attRows] = await executeQuery(attSql, []);
        dailyAttendance = attRows;
        console.log(`[DASHBOARD] Daily attendance rows: ${attRows.length}`);
    } catch (e) {
        console.warn("[DASHBOARD] Daily attendance query failed:", e.message);
    }

    // ── Step 6: Build manpowerData ────────────────────────────────────────────
    const currentReqItem = reqResults.find(r =>
        (r.month || '').toString().trim().toLowerCase() === currentMonth.toLowerCase()
    );
    const monthlyRequirement = currentReqItem ? (Number(currentReqItem.required_count) || 0) : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let loopDates = [];
    if (startDate && endDate) {
        let curr = new Date(startDate);
        let end = new Date(endDate);
        while (curr <= end) {
            loopDates.push(new Date(curr));
            curr.setDate(curr.getDate() + 1);
        }
    } else {
        for (let i = 1; i <= daysInMonth; i++) {
            loopDates.push(new Date(currentYear, currentMonthNum - 1, i));
        }
    }

    const manpowerData = loopDates.map(iterDate => {
        const day = iterDate.getDate();
        const monthShort = iterDate.toLocaleString('en-US', { month: 'short' });
        const dateStr = iterDate.toISOString().split('T')[0];
        
        const attItem = dailyAttendance.find(a => a.fullDate === dateStr);
        iterDate.setHours(0, 0, 0, 0);
        const isFuture = iterDate > today;

        return {
            month: `${day} ${monthShort}`,
            day: day,
            required: monthlyRequirement,
            current: isFuture ? null : snapshotTotal,
            present: attItem ? (Number(attItem.presentCount) || 0) : (isFuture ? null : 0),
            absent: attItem ? (Number(attItem.absentCount) || 0) : (isFuture ? null : 0),
        };
    });

    console.log(`[DASHBOARD] manpowerData sample:`, manpowerData.slice(0, 3));

    // ── Step 7: Attrition — CURRENT MONTH DAILY ───────────────────────────────
    // Shows daily absence rate (%) for each day of the current month only.
    // Formula per day: (absent + leave + half-day) / total_present_in_snapshots * 100
    // This mirrors the manpower chart — same day range, same section/line filter.
    let attritionData = [];
    try {
        const attrSql = `
            SELECT
                CONVERT(VARCHAR, al.[date], 23) AS fullDate,
                DAY(al.[date])  AS dayNum,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','HALF DAY','LEAVE') THEN 1 ELSE 0 END) AS absentCount,
                COUNT(*)        AS totalCount
            FROM attendance_logs al
            INNER JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS VARCHAR))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS VARCHAR))))
            WHERE 1=1
              ${startDate && endDate 
                  ? ` AND al.[date] >= '${startDate}' AND al.[date] <= '${endDate}' `
                  : ` AND YEAR(al.[date]) = ${currentYear} AND MONTH(al.[date]) = ${currentMonthNum} `
              }
              ${hierCondition}
            GROUP BY al.[date], DAY(al.[date])
            ORDER BY al.[date]
        `;
        const [attrRows] = await executeQuery(attrSql, []);
        console.log(`[DASHBOARD] Attrition daily rows: ${attrRows.length}`);

        // Build one entry per day of the range
        attritionData = loopDates.map(iterDate => {
            const day = iterDate.getDate();
            const monthShort = iterDate.toLocaleString('en-US', { month: 'short' });
            const dateStr = iterDate.toISOString().split('T')[0];
            
            iterDate.setHours(0, 0, 0, 0);
            const isFuture = iterDate > today;

            if (isFuture) return null; // skip future days

            const row = attrRows.find(r => r.fullDate === dateStr);
            const absent = row ? (Number(row.absentCount) || 0) : 0;
            const total = row ? (Number(row.totalCount) || 0) : 0;
            // Attrition rate = absent / total * 100, rounded to 1 decimal
            const rate = total > 0 ? Math.round((absent / total) * 1000) / 10 : 0;

            return {
                day: `${day} ${monthShort}`,  // e.g. "1 Apr"
                actual: rate,
                target: 2.0,
            };
        }).filter(Boolean); // remove nulls (future days)

    } catch (e) {
        console.warn("[DASHBOARD] Attrition daily query failed:", e.message);
        // Fallback: empty array — frontend will show "no data" state
        attritionData = [];
    }

    // ── Step 8: Absenteeism — 7-day rolling ──────────────────────────────────
    let absenteeismData = [];
    try {
        const absSql = `
            SELECT
                DATENAME(WEEKDAY, al.[date]) AS dayName,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','LEAVE','HALF DAY') THEN 1 ELSE 0 END) AS absent_count,
                COUNT(*) as total_count
            FROM attendance_logs al
            INNER JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS VARCHAR))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS VARCHAR))))
            WHERE CONVERT(DATE, al.[date]) >= DATEADD(DAY, -6, CONVERT(DATE, GETDATE()))
              AND CONVERT(DATE, al.[date]) <= CONVERT(DATE, GETDATE())
              ${hierCondition}
            GROUP BY DATENAME(WEEKDAY, al.[date]), DATEPART(WEEKDAY, al.[date])
            ORDER BY DATEPART(WEEKDAY, al.[date])
        `;
        const [absRows] = await executeQuery(absSql, []);
        if (absRows.length > 0) {
            const dayMap = {
                'Monday': 'Mon', 'Tuesday': 'Tue', 'Wednesday': 'Wed',
                'Thursday': 'Thu', 'Friday': 'Fri', 'Saturday': 'Sat', 'Sunday': 'Sun'
            };
            absenteeismData = absRows.map(r => ({
                day: dayMap[r.dayName] || r.dayName.substring(0, 3),
                actual: Number(r.absent_count) || 0,
                total: Number(r.total_count) || 0,
                limit: 10,
            }));
        }
    } catch (e) {
        console.warn("[DASHBOARD] Absenteeism query failed:", e.message);
    }

    // ── Step 9: Attrition Pie Chart Data (Left vs Active) ─────────────────────
    let attritionPieData = { left: 0, active: 0 };
    try {
        const attrPieSql = `
            SELECT 
                SUM(CASE WHEN u.isDeleted = 1 THEN 1 ELSE 0 END) as leftCount,
                SUM(CASE WHEN u.isDeleted = 0 THEN 1 ELSE 0 END) as activeCount
            FROM users u
            INNER JOIN user_hierarchy_snapshots uhs 
                ON UPPER(LTRIM(RTRIM(CAST(u.empId AS VARCHAR)))) = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS VARCHAR))))
            WHERE 1=1 ${hierCondition}
        `;
        const [attrPieRows] = await executeQuery(attrPieSql, []);
        if (attrPieRows.length > 0) {
            attritionPieData = {
                left: Number(attrPieRows[0].leftCount) || 0,
                active: Number(attrPieRows[0].activeCount) || 0
            };
        }
    } catch (e) {
        console.warn("[DASHBOARD] Attrition pie query failed:", e.message);
    }

    // ── Step 10: Employees Divided by Level (L0, L1, L2, L3, L4 only) ─────────
    let skillGapData = [];
    const levelColors = [
        'bg-zinc-500', 'bg-blue-500', 'bg-green-500',
        'bg-purple-500', 'bg-amber-500', 'bg-rose-500',
        'bg-teal-500', 'bg-orange-500',
    ];
    try {
        let skillSql = `
            SELECT
                UPPER(LTRIM(RTRIM(currentLevel))) AS skill_level,
                COUNT(*) AS avail
            FROM users
            WHERE isDeleted = 0
              AND currentLevel IN ('L0', 'L1', 'L2', 'L3', 'L4')
              AND currentLevel IS NOT NULL
              AND LTRIM(RTRIM(currentLevel)) != ''
        `;
        const skillParams = [];
        if (department && department.toLowerCase() !== 'all') {
            skillSql += " AND departmentId = ?";
            skillParams.push(department);
        }
        if (section && section.toLowerCase() !== 'all') {
            skillSql += " AND sectionId = ?";
            skillParams.push(section);
        }
        skillSql += " GROUP BY UPPER(LTRIM(RTRIM(currentLevel))) ORDER BY UPPER(LTRIM(RTRIM(currentLevel)))";
        const [skillRes] = await executeQuery(skillSql, skillParams);
        skillGapData = skillRes.map((row, i) => {
            const rawLvl = String(row.skill_level || '').trim().toUpperCase();
            const displayLevel = /^L\d+$/.test(rawLvl) ? rawLvl : `L${rawLvl}`;
            return {
                level: displayLevel,
                avail: Number(row.avail) || 0,
                color: levelColors[i % levelColors.length],
            };
        });
    } catch (e) {
        console.warn("[DASHBOARD] Skill gap query failed:", e.message);
    }

    // ── Step 11: Gender Distribution (Pie Chart) ──────────────────────────────
    let genderData = [];
    try {
        let genderSql = `
            SELECT
                ISNULL(UPPER(LTRIM(RTRIM(gender))), 'UNKNOWN') AS gender,
                COUNT(*) AS count
            FROM users
            WHERE isDeleted = 0
        `;
        const genderParams = [];
        if (department && department.toLowerCase() !== 'all') {
            genderSql += " AND departmentId = ?";
            genderParams.push(department);
        }
        if (section && section.toLowerCase() !== 'all') {
            genderSql += " AND sectionId = ?";
            genderParams.push(section);
        }
        genderSql += " GROUP BY UPPER(LTRIM(RTRIM(gender)))";
        const [genderRes] = await executeQuery(genderSql, genderParams);
        genderData = genderRes.map(row => ({
            name: row.gender,
            value: Number(row.count) || 0
        }));
    } catch (e) {
        console.warn("[DASHBOARD] Gender distribution query failed:", e.message);
    }

    // ── Final Response ────────────────────────────────────────────────────────
    res.status(200).json(
        new ApiResponse(200, {
            manpowerData,
            absenteeismData,
            attritionData,
            skillGapData,
            pieCharts: {
                skillLevels: skillGapData.map((gap, i) => ({
                    name: gap.level,
                    value: gap.avail,
                    color: levelColors[i % levelColors.length].replace('bg-', '')
                })),
                gender: genderData
            },
            filters: { departmentName, sectionName, lineName, snapshotTotal },
        }, "Dashboard stats fetched")
    );
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/attendance
// ─────────────────────────────────────────────────────────────────────────────
export const getDashboardAttendance = asyncHandler(async (req, res) => {
    const { section, line } = req.query;

    // ── 1. Resolve section name ───────────────────────────────────────────────
    let sectionName = null;
    if (section && section !== 'ALL') {
        if (!isNaN(section)) {
            const [rows] = await executeQuery("SELECT name FROM [sections] WHERE id = ?", [section]);
            if (rows.length > 0) sectionName = rows[0].name.trim();
        } else {
            sectionName = section.trim();
        }
    }

    // ── 2. Resolve line name ──────────────────────────────────────────────────
    let lineName = null;
    if (line && line !== 'ALL') {
        if (!isNaN(line)) {
            const [rows] = await executeQuery("SELECT name FROM [lines] WHERE id = ?", [line]);
            if (rows.length > 0) lineName = rows[0].name.trim();
        } else {
            lineName = line.trim();
        }
    }

    const pool = await poolPromise;
    const safeName = (s) => s.replace(/'/g, "''");

    // ── 3. Build WHERE clause ─────────────────────────────────────────────────
    const buildHierarchyFilter = (sectionName, lineName) => {
        const conditions = [];
        if (sectionName) conditions.push(`UPPER(LTRIM(RTRIM(uhs.[section]))) = UPPER('${safeName(sectionName)}')`);
        if (lineName) conditions.push(`UPPER(LTRIM(RTRIM(uhs.[lines])))   = UPPER('${safeName(lineName)}')`);
        return conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';
    };

    const hierarchyFilter = buildHierarchyFilter(sectionName, lineName);
    const useHierarchyJoin = !!(sectionName || lineName);

    const todayStr = new Date().toISOString().slice(0, 10);

    // ── 4. Today's KPI summary ────────────────────────────────────────────────
    let summarySQL;
    if (useHierarchyJoin) {
        summarySQL = `
            SELECT
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT'  THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'ABSENT'   THEN 1 ELSE 0 END) AS absent,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'HALF DAY' THEN 1 ELSE 0 END) AS halfDay,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'LEAVE'    THEN 1 ELSE 0 END) AS onLeave,
                COUNT(*) AS total
            FROM attendance_logs al
            INNER JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS VARCHAR))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS VARCHAR))))
            WHERE CONVERT(DATE, al.[date]) = @todayStr
              ${hierarchyFilter}
        `;
    } else {
        summarySQL = `
            SELECT
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT'  THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'ABSENT'   THEN 1 ELSE 0 END) AS absent,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'HALF DAY' THEN 1 ELSE 0 END) AS halfDay,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'LEAVE'    THEN 1 ELSE 0 END) AS onLeave,
                COUNT(*) AS total
            FROM attendance_logs al
            WHERE CONVERT(DATE, al.[date]) = @todayStr
        `;
    }

    const summaryReq = pool.request();
    summaryReq.input('todayStr', sql.VarChar, todayStr);
    const summaryResult = await summaryReq.query(summarySQL);
    const summaryRow = summaryResult.recordset[0] || { present: 0, absent: 0, halfDay: 0, onLeave: 0, total: 0 };

    // ── 5. 7-day rolling trend ────────────────────────────────────────────────
    let trendSQL;
    if (useHierarchyJoin) {
        trendSQL = `
            SELECT
                CONVERT(VARCHAR(10), al.[date], 23) AS [date],
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','HALF DAY','LEAVE') THEN 1 ELSE 0 END) AS absent,
                COUNT(*) AS total
            FROM attendance_logs al
            INNER JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS VARCHAR))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS VARCHAR))))
            WHERE CONVERT(DATE, al.[date]) >= DATEADD(DAY, -6, CONVERT(DATE, @todayStr2))
              AND CONVERT(DATE, al.[date]) <= CONVERT(DATE, @todayStr2)
              ${hierarchyFilter}
            GROUP BY CONVERT(VARCHAR(10), al.[date], 23)
            ORDER BY [date] ASC
        `;
    } else {
        trendSQL = `
            SELECT
                CONVERT(VARCHAR(10), al.[date], 23) AS [date],
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','HALF DAY','LEAVE') THEN 1 ELSE 0 END) AS absent,
                COUNT(*) AS total
            FROM attendance_logs al
            WHERE CONVERT(DATE, al.[date]) >= DATEADD(DAY, -6, CONVERT(DATE, @todayStr2))
              AND CONVERT(DATE, al.[date]) <= CONVERT(DATE, @todayStr2)
            GROUP BY CONVERT(VARCHAR(10), al.[date], 23)
            ORDER BY [date] ASC
        `;
    }

    const trendReq = pool.request();
    trendReq.input('todayStr2', sql.VarChar, todayStr);
    const trendResult = await trendReq.query(trendSQL);
    const trendRows = trendResult.recordset || [];

    // ── 6. Section breakdown (for today) ─────────────────────────────────────
    let sectionBreakdownSQL;
    if (useHierarchyJoin) {
        sectionBreakdownSQL = `
            SELECT
                ISNULL(LTRIM(RTRIM(uhs.[section])), 'Unknown') AS sectionName,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'ABSENT'  THEN 1 ELSE 0 END) AS absent,
                COUNT(*) AS total
            FROM attendance_logs al
            INNER JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS VARCHAR))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS VARCHAR))))
            WHERE CONVERT(DATE, al.[date]) = @todayStr3
              ${hierarchyFilter}
            GROUP BY LTRIM(RTRIM(uhs.[section]))
            ORDER BY present DESC
        `;
    } else {
        sectionBreakdownSQL = `
            SELECT
                ISNULL(LTRIM(RTRIM(uhs.[section])), 'Unknown') AS sectionName,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'ABSENT'  THEN 1 ELSE 0 END) AS absent,
                COUNT(*) AS total
            FROM attendance_logs al
            LEFT JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS VARCHAR))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS VARCHAR))))
            WHERE CONVERT(DATE, al.[date]) = @todayStr3
            GROUP BY LTRIM(RTRIM(uhs.[section]))
            ORDER BY present DESC
        `;
    }

    const breakdownReq = pool.request();
    breakdownReq.input('todayStr3', sql.VarChar, todayStr);
    const breakdownResult = await breakdownReq.query(sectionBreakdownSQL);
    const sectionBreakdown = breakdownResult.recordset || [];

    // ── 7. Build response ─────────────────────────────────────────────────────
    const summary = {
        present: Number(summaryRow.present) || 0,
        absent: Number(summaryRow.absent) || 0,
        halfDay: Number(summaryRow.halfDay) || 0,
        onLeave: Number(summaryRow.onLeave) || 0,
        total: Number(summaryRow.total) || 0,
    };
    summary.attendanceRate = summary.total > 0
        ? Math.round((summary.present / summary.total) * 100)
        : 0;

    const trend = trendRows.map(r => ({
        date: r.date,
        present: Number(r.present) || 0,
        absent: Number(r.absent) || 0,
        total: Number(r.total) || 0,
    }));

    const breakdown = sectionBreakdown.map(r => ({
        section: r.sectionName || 'Unknown',
        present: Number(r.present) || 0,
        absent: Number(r.absent) || 0,
        total: Number(r.total) || 0,
    }));

    res.status(200).json(
        new ApiResponse(200, {
            date: todayStr,
            filters: { sectionName, lineName },
            summary,
            trend,
            breakdown,
        }, "Attendance data fetched successfully")
    );
});