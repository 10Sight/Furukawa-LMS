import { executeQuery } from "../db/mssqlHelper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { poolPromise, mssql as sql } from "../db/connectDB.js";

export const getDashboardStats = asyncHandler(async (req, res) => {
    const { section, line } = req.query;

    const currentYear     = new Date().getFullYear();
    const currentMonthNum = new Date().getMonth() + 1;           // 1-based
    const currentMonth    = new Date().toLocaleString('en-US', { month: 'long' });
    const daysInMonth     = new Date(currentYear, currentMonthNum, 0).getDate();

    // ── Step 1: Resolve section/line IDs → names ──────────────────────────────
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
    // TABLE COLUMNS: uhs.[section]  and  uhs.[lines]
    let hierCondition = '';
    if (sectionName) hierCondition += ` AND UPPER(LTRIM(RTRIM(uhs.[section]))) = UPPER('${safeName(sectionName)}')`;
    if (lineName)    hierCondition += ` AND UPPER(LTRIM(RTRIM(uhs.[lines])))   = UPPER('${safeName(lineName)}')`;

    console.log(`[DASHBOARD] Filter → section: "${sectionName}", line: "${lineName}"`);
    console.log(`[DASHBOARD] hierCondition: ${hierCondition}`);

    // ── Step 3: Requirements ──────────────────────────────────────────────────
    let reqResults = [];

    const buildReqFilterCamel = (secId, lineId) => {
        let extra = '';
        if (secId && secId !== 'ALL' && !isNaN(secId))
            extra += ` AND sectionName = (SELECT name FROM [sections] WHERE id = ${parseInt(secId)})`;
        if (lineId && lineId !== 'ALL' && !isNaN(lineId))
            extra += ` AND lineDescription = (SELECT name FROM [lines] WHERE id = ${parseInt(lineId)})`;
        return extra;
    };

    const buildReqFilterSnake = (secId, lineId) => {
        let extra = '';
        if (secId && secId !== 'ALL' && !isNaN(secId))
            extra += ` AND section_name = (SELECT name FROM [sections] WHERE id = ${parseInt(secId)})`;
        if (lineId && lineId !== 'ALL' && !isNaN(lineId))
            extra += ` AND description_line = (SELECT name FROM [lines] WHERE id = ${parseInt(lineId)})`;
        return extra;
    };

    try {
        const filter = buildReqFilterCamel(section, line);
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
            const filter = buildReqFilterSnake(section, line);
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
    } catch(e) {
        console.warn("[DASHBOARD] Snapshot headcount query failed:", e.message);
    }

    // ── Step 5: Daily attendance (current month) ──────────────────────────────
    let dailyAttendance = [];
    try {
        const attSql = `
            SELECT
                DAY(al.[date])  AS dayNum,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) = 'PRESENT'                          THEN 1 ELSE 0 END) AS presentCount,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','HALF DAY','LEAVE')     THEN 1 ELSE 0 END) AS absentCount,
                COUNT(*)        AS totalCount
            FROM attendance_logs al
            INNER JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS VARCHAR))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS VARCHAR))))
            WHERE YEAR(al.[date])  = ${currentYear}
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

    // ── Step 6: Build manpowerData ────────────────────────────────────────────
    const currentReqItem = reqResults.find(r =>
        (r.month || '').toString().trim().toLowerCase() === currentMonth.toLowerCase()
    );
    const monthlyRequirement = currentReqItem ? (Number(currentReqItem.required_count) || 0) : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const manpowerData = Array.from({ length: daysInMonth }, (_, index) => {
        const day      = index + 1;
        const attItem  = dailyAttendance.find(a => Number(a.dayNum) === day);
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

    // ── Step 7: Attrition — CURRENT MONTH DAILY ───────────────────────────────
    // Shows daily absence rate (%) for each day of the current month only.
    // Formula per day: (absent + leave + half-day) / total_present_in_snapshots * 100
    // This mirrors the manpower chart — same day range, same section/line filter.
    let attritionData = [];
    try {
        const attrSql = `
            SELECT
                DAY(al.[date])  AS dayNum,
                SUM(CASE WHEN UPPER(LTRIM(RTRIM(al.status))) IN ('ABSENT','HALF DAY','LEAVE') THEN 1 ELSE 0 END) AS absentCount,
                COUNT(*)        AS totalCount
            FROM attendance_logs al
            INNER JOIN user_hierarchy_snapshots uhs
                ON UPPER(LTRIM(RTRIM(CAST(al.payCode AS VARCHAR))))
                 = UPPER(LTRIM(RTRIM(CAST(uhs.employeeid AS VARCHAR))))
            WHERE YEAR(al.[date])  = ${currentYear}
              AND MONTH(al.[date]) = ${currentMonthNum}
              ${hierCondition}
            GROUP BY DAY(al.[date])
            ORDER BY DAY(al.[date])
        `;
        const [attrRows] = await executeQuery(attrSql, []);
        console.log(`[DASHBOARD] Attrition daily rows: ${attrRows.length}`);

        // Build one entry per day of the current month (past days only)
        attritionData = Array.from({ length: daysInMonth }, (_, index) => {
            const day      = index + 1;
            const iterDate = new Date(currentYear, currentMonthNum - 1, day);
            iterDate.setHours(0, 0, 0, 0);
            const isFuture = iterDate > today;

            if (isFuture) return null; // skip future days

            const row    = attrRows.find(r => Number(r.dayNum) === day);
            const absent = row ? (Number(row.absentCount) || 0) : 0;
            const total  = row ? (Number(row.totalCount)  || 0) : 0;
            // Attrition rate = absent / total * 100, rounded to 1 decimal
            const rate   = total > 0 ? Math.round((absent / total) * 1000) / 10 : 0;

            return {
                day:    `${day} ${currentMonth.substring(0, 3)}`,  // e.g. "1 Apr"
                actual: rate,
                target: 2.0,
            };
        }).filter(Boolean); // remove nulls (future days)

    } catch(e) {
        console.warn("[DASHBOARD] Attrition daily query failed:", e.message);
        // Fallback: empty array — frontend will show "no data" state
        attritionData = [];
    }

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