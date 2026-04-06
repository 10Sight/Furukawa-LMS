import { executeQuery } from "../db/mssqlHelper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { poolPromise, mssql as sql } from "../db/connectDB.js";

export const getDashboardStats = asyncHandler(async (req, res) => {
    // line param now carries subSectionId from frontend
    const { section, line, machine } = req.query;

    const currentYear  = new Date().getFullYear();
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' }); // e.g. 'April'
    const monthsOrder  = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    let reqSql = `
        SELECT month_name as month, CAST(SUM(prod_plan) AS BIGINT) as required_count 
        FROM requirements 
        WHERE year_val = ? 
    `;
    const reqParams = [currentYear];

    if (section && section !== 'ALL') {
        reqSql += " AND section_name = (SELECT name FROM [sections] WHERE id = ?)";
        reqParams.push(section);
    }
    if (line && line !== 'ALL') {
        reqSql += " AND description_line = (SELECT name FROM [lines] WHERE id = ?)";
        reqParams.push(line);
    }
    // Ignoring machine filter as requested effectively

    reqSql += " GROUP BY month_name";

    let reqResults = [];
    try {
        const [rows] = await executeQuery(reqSql, reqParams);
        reqResults = rows;
    } catch (e) {
        console.warn("Requirements table error:", e.message);
    }

    let userWhereClause = "WHERE isEmployee = 1 AND isDeleted = 0 AND YEAR(createdAt) = ?";
    let userParams = [currentYear];

    if (section && section !== 'ALL') {
        userWhereClause += " AND sectionId = ?";
        userParams.push(section);
    }
    if (line && line !== 'ALL') {
        userWhereClause += " AND lineId = ?";
        userParams.push(line);
    }

    const userSql = `
        SELECT 
            DATENAME(month, createdAt) as month, 
            COUNT(*) as added_count 
        FROM users 
        ${userWhereClause}
        GROUP BY MONTH(createdAt), DATENAME(month, createdAt)
    `;

    const [userResults] = await executeQuery(userSql, userParams);

    // Initial count (users created before current year)
    let initialSql = "SELECT COUNT(*) as total FROM users WHERE isEmployee = 1 AND isDeleted = 0 AND YEAR(createdAt) < ?";
    let initialParams = [currentYear];

    if (section && section !== 'ALL') {
        initialSql += " AND sectionId = ?";
        initialParams.push(section);
    }
    if (line && line !== 'ALL') {
        initialSql += " AND lineId = ?";
        initialParams.push(line);
    }

    const [initialCountRes] = await executeQuery(initialSql, initialParams);
    let runningTotal = initialCountRes[0].total;

    const manpowerData = monthsOrder.map(m => {
        const reqItem  = reqResults.find(r => r.month === m);
        const userItem = userResults.find(u => u.month === m);

        if (userItem) runningTotal += userItem.added_count;

        const isFuture = new Date(`${m} 1, ${currentYear}`) > new Date();

        return {
            month:    m.substring(0, 3),
            required: reqItem ? reqItem.required_count : 0,
            current:  isFuture ? null : runningTotal,
            actual:   null, // filled in below for the current month
        };
    });

    // ── Yesterday's Actual Present (via payCode → employeeid join) ────────────
    // Resolve section / line to names so we can filter via user_hierarchy_snapshots
    let sectionNameHier = null;
    let lineNameHier    = null;

    if (section && section !== 'ALL' && !isNaN(section)) {
        try {
            const [sRows] = await executeQuery("SELECT name FROM [sections] WHERE id = ?", [section]);
            if (sRows.length > 0) sectionNameHier = sRows[0].name;
        } catch (e) { /* ignore */ }
    }
    if (line && line !== 'ALL' && !isNaN(line)) {
        try {
            const [lRows] = await executeQuery("SELECT name FROM [lines] WHERE id = ?", [line]);
            if (lRows.length > 0) lineNameHier = lRows[0].name;
        } catch (e) { /* ignore */ }
    }

    const yesterday    = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10); // YYYY-MM-DD

    // Build optional hierarchy WHERE additions (no user-supplied strings go into ?)
    const useHierJoin = !!(sectionNameHier || lineNameHier);
    let hierFilter    = '';
    if (sectionNameHier) hierFilter += ` AND LTRIM(RTRIM(UPPER(uhs.section_name))) = UPPER('${sectionNameHier.replace(/'/g, "''")}')` ;
    if (lineNameHier)    hierFilter += ` AND LTRIM(RTRIM(UPPER(uhs.line_name)))    = UPPER('${lineNameHier.replace(/'/g, "''")}')` ;

    let yesterdayPresent = 0;
    try {
        const ySql = useHierJoin
            ? `SELECT COUNT(*) AS cnt
               FROM   attendance_logs al
               INNER JOIN user_hierarchy_snapshots uhs
                   ON LTRIM(RTRIM(UPPER(CAST(al.payCode AS VARCHAR)))) =
                      LTRIM(RTRIM(UPPER(CAST(uhs.employeeid AS VARCHAR))))
               WHERE CONVERT(DATE, al.[date]) = ?
                 AND UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT'
                 ${hierFilter}`
            : `SELECT COUNT(*) AS cnt
               FROM   attendance_logs al
               WHERE CONVERT(DATE, al.[date]) = ?
                 AND UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT'`;

        const [yRows] = await executeQuery(ySql, [yesterdayStr]);
        yesterdayPresent = Number(yRows[0]?.cnt) || 0;
    } catch (e) {
        console.warn("Yesterday present count error:", e.message);
    }

    // Attach `actual` to the current-month slot (only slot that has real yesterday data)
    const curMonthEntry = manpowerData.find(m => m.month === currentMonth.substring(0, 3));
    if (curMonthEntry) curMonthEntry.actual = yesterdayPresent;

    const attritionData = monthsOrder.slice(0, 6).map(m => ({
        month: m.substring(0, 3),
        actual: Math.random() * 2,
        target: 2.0
    }));


    const absenteeismData = [];

    // Skill Gap Logic
    let skillSql = "SELECT currentLevel as skill_level, COUNT(*) as avail FROM users WHERE role != 'admin' AND isDeleted = 0";
    const skillParams = [];

    if (section && section.toLowerCase() !== 'all') {
        skillSql += " AND sectionId = ?";
        skillParams.push(section);
    }
    if (line && line.toLowerCase() !== 'all') {
        skillSql += " AND lineId = ?";
        skillParams.push(line);
    }

    skillSql += " GROUP BY currentLevel";
    const [skillRes] = await executeQuery(skillSql, skillParams);

    // Map DB levels (e.g. 'L1', 'Level 1') to standardized L0-L4
    const skillGapData = [
        { level: 'L0', label: 'Trainee', avail: 0, req: 0, color: 'bg-zinc-500' }, // Req is hard to know without data
        { level: 'L1', label: 'Operator', avail: 0, req: 0, color: 'bg-blue-500' },
        { level: 'L2', label: 'Skilled', avail: 0, req: 0, color: 'bg-green-500' },
        { level: 'L3', label: 'Expert', avail: 0, req: 0, color: 'bg-purple-500' },
        { level: 'L4', label: 'Master', avail: 0, req: 0, color: 'bg-amber-500' },
    ];

    skillRes.forEach(row => {
        // match row.skill_level to skillGapData
        // simple parsing
        const lvl = row.skill_level; // e.g. "L1" or "1"
        if (!lvl) return;
        const idx = skillGapData.findIndex(s => s.level === lvl || s.level === `L${lvl}`);
        if (idx !== -1) skillGapData[idx].avail = row.avail;
    });

    res.status(200).json(
        new ApiResponse(200, {
            manpowerData,
            attritionData, // Keeping this placeholder/0 for now
            absenteeismData: [
                { day: 'Mon', actual: 2, limit: 10 }, // Placeholder until attendance is populated
                { day: 'Tue', actual: 5, limit: 10 },
                { day: 'Wed', actual: 1, limit: 10 },
                { day: 'Thu', actual: 3, limit: 10 },
                { day: 'Fri', actual: 4, limit: 10 },
            ],
            skillGapData
        }, "Dashboard stats fetched")
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/attendance
// Returns today's attendance summary KPIs + 7-day trend
// filtered by section and/or line via user_hierarchy_snapshots join
// ─────────────────────────────────────────────────────────────────────────────
export const getDashboardAttendance = asyncHandler(async (req, res) => {
    const { section, line } = req.query;

    // ── 1. Resolve section name from id if provided ──────────────────────────
    let sectionName = null;
    if (section && section !== 'ALL') {
        if (!isNaN(section)) {
            const [rows] = await executeQuery("SELECT name FROM [sections] WHERE id = ?", [section]);
            if (rows.length > 0) sectionName = rows[0].name;
        } else {
            sectionName = section; // already a name
        }
    }

    // ── 2. Resolve line name from id if provided ─────────────────────────────
    let lineName = null;
    if (line && line !== 'ALL') {
        if (!isNaN(line)) {
            const [rows] = await executeQuery("SELECT name FROM [lines] WHERE id = ?", [line]);
            if (rows.length > 0) lineName = rows[0].name;
        } else {
            lineName = line;
        }
    }

    const pool = await poolPromise;

    // ── 3. Build dynamic WHERE clauses for hierarchy filter ──────────────────
    // Join: attendance_logs.payCode = user_hierarchy_snapshots.employeeid
    // Then filter by section_name and/or line_name in the snapshot table
    const buildHierarchyFilter = (sectionName, lineName) => {
        const conditions = [];
        if (sectionName) conditions.push(`LTRIM(RTRIM(UPPER(uhs.section_name))) = UPPER('${sectionName.replace(/'/g, "''")}')`);
        if (lineName)    conditions.push(`LTRIM(RTRIM(UPPER(uhs.line_name)))    = UPPER('${lineName.replace(/'/g, "''")}')`);
        return conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';
    };

    const hierarchyFilter = buildHierarchyFilter(sectionName, lineName);
    const useHierarchyJoin = !!(sectionName || lineName);

    // ── 4. Today's KPI summary ───────────────────────────────────────────────
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

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
                ON LTRIM(RTRIM(UPPER(CAST(al.payCode AS VARCHAR)))) =
                   LTRIM(RTRIM(UPPER(CAST(uhs.employeeid AS VARCHAR))))
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

    // ── 5. 7-day rolling trend ───────────────────────────────────────────────
    let trendSQL;
    if (useHierarchyJoin) {
        trendSQL = `
            SELECT
                CONVERT(VARCHAR(10), al.[date], 23)                                                      AS [date],
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' THEN 1 ELSE 0 END)              AS present,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','HALF DAY','LEAVE') THEN 1 ELSE 0 END) AS absent,
                COUNT(*)                                                                                  AS total
            FROM attendance_logs al
            INNER JOIN user_hierarchy_snapshots uhs
                ON LTRIM(RTRIM(UPPER(CAST(al.payCode AS VARCHAR)))) =
                   LTRIM(RTRIM(UPPER(CAST(uhs.employeeid AS VARCHAR))))
            WHERE CONVERT(DATE, al.[date]) >= DATEADD(DAY, -6, CONVERT(DATE, @todayStr2))
              AND CONVERT(DATE, al.[date]) <= CONVERT(DATE, @todayStr2)
              ${hierarchyFilter}
            GROUP BY CONVERT(VARCHAR(10), al.[date], 23)
            ORDER BY [date] ASC
        `;
    } else {
        trendSQL = `
            SELECT
                CONVERT(VARCHAR(10), al.[date], 23)                                                      AS [date],
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' THEN 1 ELSE 0 END)              AS present,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','HALF DAY','LEAVE') THEN 1 ELSE 0 END) AS absent,
                COUNT(*)                                                                                  AS total
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

    // ── 6. Attendance by Section breakdown (for today, useful for section-level detail) ──
    let sectionBreakdownSQL;
    if (useHierarchyJoin) {
        sectionBreakdownSQL = `
            SELECT
                ISNULL(LTRIM(RTRIM(uhs.section_name)), 'Unknown') AS sectionName,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'ABSENT'  THEN 1 ELSE 0 END) AS absent,
                COUNT(*) AS total
            FROM attendance_logs al
            INNER JOIN user_hierarchy_snapshots uhs
                ON LTRIM(RTRIM(UPPER(CAST(al.payCode AS VARCHAR)))) =
                   LTRIM(RTRIM(UPPER(CAST(uhs.employeeid AS VARCHAR))))
            WHERE CONVERT(DATE, al.[date]) = @todayStr3
              ${hierarchyFilter}
            GROUP BY LTRIM(RTRIM(uhs.section_name))
            ORDER BY present DESC
        `;
    } else {
        sectionBreakdownSQL = `
            SELECT
                ISNULL(LTRIM(RTRIM(uhs.section_name)), 'Unknown') AS sectionName,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'ABSENT'  THEN 1 ELSE 0 END) AS absent,
                COUNT(*) AS total
            FROM attendance_logs al
            LEFT JOIN user_hierarchy_snapshots uhs
                ON LTRIM(RTRIM(UPPER(CAST(al.payCode AS VARCHAR)))) =
                   LTRIM(RTRIM(UPPER(CAST(uhs.employeeid AS VARCHAR))))
            WHERE CONVERT(DATE, al.[date]) = @todayStr3
            GROUP BY LTRIM(RTRIM(uhs.section_name))
            ORDER BY present DESC
        `;
    }

    const breakdownReq = pool.request();
    breakdownReq.input('todayStr3', sql.VarChar, todayStr);
    const breakdownResult = await breakdownReq.query(sectionBreakdownSQL);
    const sectionBreakdown = breakdownResult.recordset || [];

    // ── 7. Build response ────────────────────────────────────────────────────
    const summary = {
        present: Number(summaryRow.present) || 0,
        absent:  Number(summaryRow.absent)  || 0,
        halfDay: Number(summaryRow.halfDay) || 0,
        onLeave: Number(summaryRow.onLeave) || 0,
        total:   Number(summaryRow.total)   || 0,
    };
    // Compute attendance rate
    summary.attendanceRate = summary.total > 0
        ? Math.round((summary.present / summary.total) * 100)
        : 0;

    const trend = trendRows.map(r => ({
        date:    r.date,
        present: Number(r.present) || 0,
        absent:  Number(r.absent)  || 0,
        total:   Number(r.total)   || 0,
    }));

    const breakdown = sectionBreakdown.map(r => ({
        section: r.sectionName || 'Unknown',
        present: Number(r.present) || 0,
        absent:  Number(r.absent)  || 0,
        total:   Number(r.total)   || 0,
    }));

    res.status(200).json(
        new ApiResponse(200, {
            date:      todayStr,
            filters:   { sectionName, lineName },
            summary,
            trend,
            breakdown,
        }, "Attendance data fetched successfully")
    );
});
