import { executeQuery } from "../db/mssqlHelper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { poolPromise, mssql as sql } from "../db/connectDB.js";

export const getDashboardStats = asyncHandler(async (req, res) => {
    const { section, line } = req.query;

    const currentYear  = new Date().getFullYear();
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
    const monthsOrder  = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December'];

    // ── Step 1: Resolve section/line IDs → names ──────────────────────────────
    // user_hierarchy_snapshots columns: section, lines  (NOT section_name / line_name)
    let sectionName = null;
    let lineName    = null;

    if (section && section !== 'ALL' && !isNaN(section)) {
        try {
            const [r] = await executeQuery("SELECT name FROM [sections] WHERE id = ?", [section]);
            if (r.length > 0) sectionName = r[0].name.trim();
        } catch(e) { console.warn("[DASHBOARD] section lookup failed:", e.message); }
    }
    if (line && line !== 'ALL' && !isNaN(line)) {
        try {
            const [r] = await executeQuery("SELECT name FROM [lines] WHERE id = ?", [line]);
            if (r.length > 0) lineName = r[0].name.trim();
        } catch(e) { console.warn("[DASHBOARD] line lookup failed:", e.message); }
    }

    const safeName = (s) => s.replace(/'/g, "''");

    // ── Step 2: Build hierarchy WHERE condition ───────────────────────────────
    // TABLE COLUMNS: uhs.section  and  uhs.lines  (as per user_hierarchy_snapshots schema)
    let hierCondition = '';
    if (sectionName) hierCondition += ` AND UPPER(LTRIM(RTRIM(uhs.[section]))) = UPPER('${safeName(sectionName)}')`;
    if (lineName)    hierCondition += ` AND UPPER(LTRIM(RTRIM(uhs.[lines])))   = UPPER('${safeName(lineName)}')`;

    console.log(`[DASHBOARD] Filter → section: "${sectionName}", line: "${lineName}"`);
    console.log(`[DASHBOARD] hierCondition: ${hierCondition}`);

    // ── Step 3: Requirements ──────────────────────────────────────────────────
    let reqResults = [];
    const buildReqFilter = (secCol, lineCol, secId, lineId) => {
        let extra = '';
        if (secId && secId !== 'ALL') extra += ` AND ${secCol} = (SELECT name FROM [sections] WHERE id = ${parseInt(secId)})`;
        if (lineId && lineId !== 'ALL') extra += ` AND ${lineCol} = (SELECT name FROM [lines] WHERE id = ${parseInt(lineId)})`;
        return extra;
    };

    // Try camelCase columns first
    try {
        const filter = buildReqFilter('sectionName', 'lineDescription', section, line);
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
            const filter = buildReqFilter('section_name', 'description_line', section, line);
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

    // ── Step 4: Headcount from user_hierarchy_snapshots ───────────────────────
    // Correct columns: [section] and [lines]
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
    } catch(e) {
        console.warn("[DASHBOARD] Snapshot headcount query failed:", e.message);
    }

    // ── Step 5: Daily attendance — join attendance_logs ↔ user_hierarchy_snapshots ──
    // attendance_logs.payCode  matches  user_hierarchy_snapshots.employeeid
    // Then filter by uhs.[section] and uhs.[lines]
    let dailyAttendance = [];
    const currentMonthNum = new Date().getMonth() + 1;
    const daysInMonth = new Date(currentYear, currentMonthNum, 0).getDate();

    try {
        const attSql = `
            SELECT
                DAY(al.[date])               AS dayNum,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT'  THEN 1 ELSE 0 END) AS presentCount,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','HALF DAY','LEAVE') THEN 1 ELSE 0 END) AS absentCount,
                COUNT(*)                     AS totalCount
            FROM attendance_logs al
            INNER JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS VARCHAR))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS VARCHAR))))
            WHERE YEAR(al.[date]) = ${currentYear}
              AND MONTH(al.[date]) = ${currentMonthNum}
              ${hierCondition}
            GROUP BY DAY(al.[date])
            ORDER BY DAY(al.[date])
        `;
        const [attRows] = await executeQuery(attSql, []);
        dailyAttendance = attRows;
        console.log(`[DASHBOARD] Daily attendance rows: ${attRows.length}`);
    } catch(e) {
        console.warn("[DASHBOARD] Daily attendance query failed:", e.message);
    }

    // ── Step 6: Build manpowerData array ──────────────────────────────────────
    const currentReqItem = reqResults.find(r =>
        (r.month || '').toString().trim().toLowerCase() === currentMonth.toLowerCase()
    );
    const monthlyRequirement = currentReqItem ? (Number(currentReqItem.required_count) || 0) : 0;

    const manpowerData = Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const attItem = dailyAttendance.find(a => Number(a.dayNum) === day);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const iterDate = new Date(currentYear, currentMonthNum - 1, day);
        iterDate.setHours(0, 0, 0, 0);
        const isFuture = iterDate > today;

        return {
            month:    `${day} ${currentMonth.substring(0, 3)}`,
            day:      day,
            required: monthlyRequirement,
            current:  isFuture ? null : snapshotTotal,
            present:  attItem ? (Number(attItem.presentCount) || 0) : (isFuture ? null : 0),
            absent:   attItem ? (Number(attItem.absentCount)  || 0) : (isFuture ? null : 0),
        };
    });

    console.log(`[DASHBOARD] manpowerData sample:`, manpowerData.slice(0, 3));

    // ── Step 7: Attrition (placeholder) ──────────────────────────────────────
    const attritionData = monthsOrder.slice(0, 6).map(m => ({
        month:  m.substring(0, 3),
        actual: 0,
        target: 2.0,
    }));

    // ── Step 8: Absenteeism — 7-day rolling ──────────────────────────────────
    let absenteeismData = [
        { day: 'Mon', actual: 0, limit: 10 },
        { day: 'Tue', actual: 0, limit: 10 },
        { day: 'Wed', actual: 0, limit: 10 },
        { day: 'Thu', actual: 0, limit: 10 },
        { day: 'Fri', actual: 0, limit: 10 },
    ];
    try {
        const absSql = `
            SELECT
                DATENAME(WEEKDAY, al.[date]) AS dayName,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','LEAVE','HALF DAY') THEN 1 ELSE 0 END) AS absent_count
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
                'Monday':'Mon','Tuesday':'Tue','Wednesday':'Wed',
                'Thursday':'Thu','Friday':'Fri','Saturday':'Sat','Sunday':'Sun'
            };
            absenteeismData = absRows.map(r => ({
                day:    dayMap[r.dayName] || r.dayName.substring(0, 3),
                actual: Number(r.absent_count) || 0,
                limit:  10,
            }));
        }
    } catch(e) {
        console.warn("[DASHBOARD] Absenteeism query failed:", e.message);
    }

    // ── Step 9: Skill Gap ─────────────────────────────────────────────────────
    const skillGapData = [
        { level: 'L0', label: 'Trainee',  avail: 0, req: 0, color: 'bg-zinc-500' },
        { level: 'L1', label: 'Operator', avail: 0, req: 0, color: 'bg-blue-500' },
        { level: 'L2', label: 'Skilled',  avail: 0, req: 0, color: 'bg-green-500' },
        { level: 'L3', label: 'Expert',   avail: 0, req: 0, color: 'bg-purple-500' },
        { level: 'L4', label: 'Master',   avail: 0, req: 0, color: 'bg-amber-500' },
    ];
    try {
        let skillSql = "SELECT currentLevel as skill_level, COUNT(*) as avail FROM users WHERE role != 'admin' AND isDeleted = 0";
        const skillParams = [];
        if (section && section.toLowerCase() !== 'all') {
            skillSql += " AND sectionId = ?";
            skillParams.push(section);
        }
        skillSql += " GROUP BY currentLevel";
        const [skillRes] = await executeQuery(skillSql, skillParams);
        skillRes.forEach(row => {
            const lvl = row.skill_level;
            if (!lvl) return;
            const idx = skillGapData.findIndex(s => s.level === lvl || s.level === `L${lvl}`);
            if (idx !== -1) skillGapData[idx].avail = row.avail;
        });
    } catch(e) {
        console.warn("[DASHBOARD] Skill gap query failed:", e.message);
    }

    // ── Final Response ────────────────────────────────────────────────────────
    res.status(200).json(
        new ApiResponse(200, {
            manpowerData,
            attritionData,
            absenteeismData,
            skillGapData,
            filters: { sectionName, lineName, snapshotTotal },
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
    // Correct column names: uhs.[section]  and  uhs.[lines]
    const buildHierarchyFilter = (sectionName, lineName) => {
        const conditions = [];
        if (sectionName) conditions.push(`UPPER(LTRIM(RTRIM(uhs.[section]))) = UPPER('${safeName(sectionName)}')`);
        if (lineName)    conditions.push(`UPPER(LTRIM(RTRIM(uhs.[lines])))   = UPPER('${safeName(lineName)}')`);
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
    // Use uhs.[section] as the grouping column
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
        present:  Number(summaryRow.present)  || 0,
        absent:   Number(summaryRow.absent)   || 0,
        halfDay:  Number(summaryRow.halfDay)  || 0,
        onLeave:  Number(summaryRow.onLeave)  || 0,
        total:    Number(summaryRow.total)    || 0,
    };
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
            date: todayStr,
            filters: { sectionName, lineName },
            summary,
            trend,
            breakdown,
        }, "Attendance data fetched successfully")
    );
});