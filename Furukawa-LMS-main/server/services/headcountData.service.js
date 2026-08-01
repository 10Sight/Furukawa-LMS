import { executeQuery } from "../db/mssqlHelper.js";
import HeadcountReport from "../models/headcountReport.model.js";
import { getEligibleUserSql, getDesignationShutterLeftJoinSql, getEligibleUserConditionViaJoin } from "../utils/userEligibility.js";

/**
 * Computes the Associates Headcount Report tableData live from real sources
 * (Attendance, User logs, Requirements), starting from any previously saved
 * manual fields for the same month/year as its base. Shared by the manual
 * "Sync Data" endpoint and the headcount email send paths, so an email can
 * go out even if nobody has clicked "Save" for this month yet.
 */
export const computeHeadcountTableData = async (departmentId, month, year) => {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const totalDays = lastDay;

    // Fetch existing report to preserve manual fields
    const existingReport = await HeadcountReport.findOne({
        departmentId: departmentId || 0,
        month,
        year
    });
    const tableData = existingReport?.tableData || {};

    // 1. Fetch active report clubs
    const [reportingClubs] = await executeQuery("SELECT id, name, sectionIds FROM report_clubs WHERE showInReport = 1");

    // Fetch all eligible users to calculate daily active counts
    // (isEmployee, non-temporary, non-deleted, non-shuttered-designation)
    const [allEligibleUsers] = await executeQuery(`
        SELECT id, sectionId, joiningDate, leavingDate, updatedAt, status, isTemporary,
               shiftSchedule, shift, stationId, stations
        FROM users u
        WHERE u.isEmployee = 1
        ${getEligibleUserSql('u')}
    `);

    // Shift-wise breakdown (Available/Assigned/Attendance) is driven purely by each user's
    // SCHEDULED shift (users.shiftSchedule for the date, falling back to users.shift) and their
    // active-on-this-date status — it intentionally does NOT require a matching attendance_logs
    // row, per product decision: a user's planned shift should show up even before/without an
    // attendance punch for that date.
    allEligibleUsers.forEach(u => {
        u._shiftSchedule = (() => {
            try { return JSON.parse(u.shiftSchedule || '{}'); } catch (e) { return {}; }
        })();
        u._hasStation = !!u.stationId || (u.stations && !['[]', ''].includes(String(u.stations).trim()));
    });

    // 2. Global Attendance Stats
    // NOTE: this query intentionally keeps a broad WHERE (isEmployee OR isTemporary) even though
    // only the employee-only columns are selected below, because totalUploaded (COUNT(*)) is a
    // general attendance-data-volume figure (including Dojo/temp rows) used later as the
    // attrition-percentage denominator fallback. The strict eligibility filter (non-deleted,
    // non-temporary, non-shuttered-designation) is applied inline to the employee-only CASE
    // branches rather than the WHERE clause so it doesn't affect totalUploaded. SQL Server
    // disallows a subquery inside a SUM()'s argument, so the shutter check uses a LEFT JOIN
    // instead of the NOT EXISTS subquery used elsewhere.
    const eligibleEmployeeCondition = getEligibleUserConditionViaJoin('u', 'ds');
    // Date-aware "not yet left" check: a user separated mid-month should still count as
    // present on the days before their leavingDate, matching allEligibleUsers' JS filter
    // below rather than blanket-excluding every date for anyone currently marked LEFT.
    const notYetLeftCondition = `(LOWER(ISNULL(u.status, '')) <> 'left' OR TRY_CONVERT(date, ISNULL(u.leavingDate, u.updatedAt)) > al.[date])`;
    const netHeadcountSql = `
        SELECT
            CONVERT(VARCHAR, al.[date], 23) AS dateKey,
            SUM(CASE WHEN UPPER(ISNULL(al.[status], '')) = 'PRESENT' AND u.[isEmployee] = 1 AND ${eligibleEmployeeCondition} AND ${notYetLeftCondition} THEN 1 ELSE 0 END) AS totalPresentEmployees,
            SUM(CASE WHEN TRY_CONVERT(date, u.joiningDate) <= DATEADD(MONTH, -3, al.[date]) AND UPPER(ISNULL(al.[status], '')) = 'PRESENT' AND u.[isEmployee] = 1 AND ${eligibleEmployeeCondition} AND ${notYetLeftCondition} THEN 1 ELSE 0 END) AS totalPresentAbove3Months,
            SUM(CASE WHEN UPPER(ISNULL(al.status, '')) IN ('ABSENT', 'A') AND u.[isEmployee] = 1 AND ${eligibleEmployeeCondition} AND ${notYetLeftCondition} THEN 1 ELSE 0 END) as totalAbsent,
            COUNT(*) as totalUploaded
        FROM (
            -- Collapse to one row per user per date first: a user with more than one
            -- attendance_logs row for the same day (duplicate punches, corrections,
            -- multi-shift entries) must not be counted more than once. Matches the
            -- MAX(status)-per-userId approach getAllUsers already uses for this reason.
            SELECT userId, [date], MAX(status) AS status
            FROM attendance_logs
            WHERE [date] >= ? AND [date] <= ?
            GROUP BY userId, [date]
        ) al
        INNER JOIN users u ON u.id = al.userId
        ${getDesignationShutterLeftJoinSql('u', 'ds')}
        WHERE (u.[isEmployee] = 1 OR u.[isTemporary] = 1)
        GROUP BY al.[date]
    `;
    const [netHeadcountData] = await executeQuery(netHeadcountSql, [start, end]);

    // "Present in Training Cell" needs date-aware historical membership, not today's isTemporary
    // flag: a user who was isTemporary = 1 on the 16th and got promoted (isTemporary -> 0) on the
    // 17th must still show as a training-cell member on the 16th, and only drop out from the 17th
    // onward. isTemporary itself has no history, so — mirroring the identity rule already used by
    // getDojoHandoverComparison/getDojoHiringTrend in dashboard.controller.js — we fetch anyone
    // who is currently temporary OR was ever a Dojo hire (expectedHandover IS NOT NULL).
    const [allDojoUsers] = await executeQuery(`
        SELECT u.id, u.joiningDate, u.leavingDate, u.updatedAt, u.status, u.isTemporary
        FROM users u
        ${getDesignationShutterLeftJoinSql('u', 'ds')}
        WHERE (u.[expectedHandover] IS NOT NULL OR u.[isTemporary] = 1)
          AND (u.[isDeleted] = 0 OR u.[isDeleted] IS NULL)
          AND ds.[designation] IS NULL
    `);

    // Approved handover date per user, used below as the promotion cutoff instead of updatedAt:
    // updatedAt is bumped by any later, unrelated profile edit, which would silently shift
    // already-synced historical "Present in Training Cell" counts. Mirrors the CROSS APPLY
    // OPENJSON(entries) pattern already used for this lookup in sixteenDayMonitoring.controller.js.
    const [approvedHandovers] = await executeQuery(`
        SELECT TRY_CAST(JSON_VALUE(entry.value, '$.studentId') AS INT) AS studentId,
               MIN(JSON_VALUE(entry.value, '$.statusActionAt')) AS handoverDate
        FROM handover_sheets hs
        CROSS APPLY OPENJSON(hs.entries) AS entry
        WHERE JSON_VALUE(entry.value, '$.interviewStatus') = 'APPROVE'
        GROUP BY TRY_CAST(JSON_VALUE(entry.value, '$.studentId') AS INT)
    `);
    const handoverDateMap = {};
    approvedHandovers.forEach(row => {
        if (row.studentId) handoverDateMap[row.studentId] = row.handoverDate;
    });

    // Normalizes a Date object (mssql returns DATE/DATETIME columns as UTC-based JS Date
    // instances) or a date-like string to a YYYY-MM-DD string, so day-boundary comparisons
    // in the loop below don't skew with the server's local timezone.
    const toYMD = (dateVal) => {
        if (!dateVal) return null;
        if (dateVal instanceof Date) {
            if (isNaN(dateVal.getTime())) return null;
            return `${dateVal.getUTCFullYear()}-${String(dateVal.getUTCMonth() + 1).padStart(2, '0')}-${String(dateVal.getUTCDate()).padStart(2, '0')}`;
        }
        const str = String(dateVal);
        const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) return match[1];
        const d = new Date(str);
        if (isNaN(d.getTime())) return null;
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    };

    const dailyTotalsMap = {};
    const presentDataMap = {};
    netHeadcountData.forEach(row => {
        if (row.dateKey) presentDataMap[row.dateKey] = row;
    });

    for (let d = 1; d <= totalDays; d++) {
        const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dDate = new Date(dKey);
        const row = presentDataMap[dKey] || {};

        const activeCount = allEligibleUsers.filter(u => {
            const join = u.joiningDate ? new Date(u.joiningDate) : null;
            if (join && join > dDate) return false;
            if (u.status?.toLowerCase() === 'left') {
                const left = new Date(u.leavingDate || u.updatedAt);
                if (left <= dDate) return false;
            }
            return true;
        }).length;

        const dojoMembersOnDate = allDojoUsers.filter(u => {
            const joinYMD = toYMD(u.joiningDate);
            if (joinYMD && joinYMD > dKey) return false;
            if (u.status?.toLowerCase() === 'left') {
                const leftYMD = toYMD(u.leavingDate || u.updatedAt);
                if (leftYMD && leftYMD <= dKey) return false;
            }
            // Already promoted out of the Dojo before this date (isTemporary is now 0).
            // Prefer the approved handover date; fall back to updatedAt only when no
            // approved handover_sheets entry exists for this user.
            if (!u.isTemporary) {
                const promotedYMD = toYMD(handoverDateMap[u.id]) || toYMD(u.updatedAt);
                if (promotedYMD && promotedYMD <= dKey) return false;
            }
            return true;
        });
        const dojoPresentOnDate = dojoMembersOnDate.filter(
            u => (u.status || 'PRESENT').toUpperCase() === 'PRESENT'
        ).length;
        const dojoAbsentOnDate = dojoMembersOnDate.length - dojoPresentOnDate;

        const present = row.totalPresentEmployees || 0;
        const absent = Math.max(0, activeCount - present);
        const totalPA = activeCount;

        dailyTotalsMap[dKey] = totalPA;
        tableData[`Headcount available_${dKey}`] = present;
        tableData[`Present in Training Cell_${dKey}`] = dojoPresentOnDate;
        tableData[`DojoAbsent_${dKey}`] = dojoAbsentOnDate;
        tableData[`Net Available Headcount Total_${dKey}`] = String(present || 0);
        tableData[`Total Headcount (Present + Absent)_${dKey}`] = totalPA;
        tableData[`Net Available Headcount Above 3 Months_${dKey}`] = String(row.totalPresentAbove3Months || 0);
        tableData[`Absent_${dKey}`] = String(absent);

        const globalAbsPercent = (totalPA > 0) ? (absent / totalPA) * 100 : 0;
        tableData[`Absenteeism %_${dKey}`] = globalAbsPercent.toFixed(2);
    }

    // Actual PRESENT punches per (userId, date), used only to compute the Shift-wise Attendance
    // percentage below — Available_*/Assigned_* stay schedule-based (see above), but "Attendance"
    // is defined as % actually present = (scheduled-for-shift users marked PRESENT that date) /
    // (scheduled-for-shift users that date) * 100.
    const [attendancePresenceRows] = await executeQuery(`
        SELECT userId, CONVERT(VARCHAR, [date], 23) AS dateKey, MAX(status) AS status
        FROM attendance_logs
        WHERE [date] >= ? AND [date] <= ?
        GROUP BY userId, [date]
    `, [start, end]);
    const presentSet = new Set();
    attendancePresenceRows.forEach(row => {
        if (row.dateKey && String(row.status || '').toUpperCase() === 'PRESENT') {
            presentSet.add(`${row.userId}|${row.dateKey}`);
        }
    });

    // Shift-wise breakdown: every active-on-this-date eligible employee (isEmployee = 1,
    // non-temporary, non-deleted, non-shuttered-designation, not yet left as of this date — same
    // eligibility and date-aware join/leave check as activeCount above), grouped by their
    // SCHEDULED shift for the date (users.shiftSchedule, falling back to users.shift).
    // Available_* is a pure schedule headcount, deliberately independent of attendance_logs — a
    // user's planned shift should show up even without an attendance punch for that date.
    // Assigned_* is a headcount too, but of the subset that (a) has a station assigned AND (b) is
    // marked PRESENT in attendance_logs for that date (see presentSet above) — i.e. actually
    // showed up to their assigned station. Attendance_* is a % actually present, not a headcount.
    const shiftsList = ['A-Shift', 'G-Shift', 'B-Shift', 'C-Shift'];
    const shiftMap = { 'A': 'A-Shift', 'G': 'G-Shift', 'B': 'B-Shift', 'C': 'C-Shift' };
    for (let d = 1; d <= totalDays; d++) {
        const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dDate = new Date(dKey);

        let availableTotal = 0;
        let assignedTotal = 0;
        let presentTotal = 0;
        const availableByShift = {};
        const assignedByShift = {};
        const presentByShift = {};
        shiftsList.forEach(s => { availableByShift[s] = 0; assignedByShift[s] = 0; presentByShift[s] = 0; });

        allEligibleUsers.forEach(u => {
            const join = u.joiningDate ? new Date(u.joiningDate) : null;
            if (join && join > dDate) return;
            if (u.status?.toLowerCase() === 'left') {
                const left = new Date(u.leavingDate || u.updatedAt);
                if (left <= dDate) return;
            }

            const resolvedShift = (u._shiftSchedule[dKey] || u.shift || '').toString().toUpperCase();
            const shiftKey = Object.keys(shiftMap).find(k => resolvedShift.includes(k));
            if (!shiftKey) return;
            const shiftName = shiftMap[shiftKey];
            const isPresent = presentSet.has(`${u.id}|${dKey}`);

            availableByShift[shiftName]++;
            availableTotal++;

            if (u._hasStation && isPresent) {
                assignedByShift[shiftName]++;
                assignedTotal++;
            }

            if (isPresent) {
                presentByShift[shiftName]++;
                presentTotal++;
            }
        });

        shiftsList.forEach(s => {
            tableData[`Available_${s}_${dKey}`] = String(availableByShift[s]);
            tableData[`Assigned_${s}_${dKey}`] = String(assignedByShift[s]);
            const present = presentByShift[s];
            const available = availableByShift[s];
            tableData[`Attendance_${s}_${dKey}`] = available > 0 ? ((present / available) * 100).toFixed(2) : "0.00";
        });

        tableData[`Available_Total_${dKey}`] = String(availableTotal);
        tableData[`Assigned_Total_${dKey}`] = String(assignedTotal);
        tableData[`Attendance_Total_${dKey}`] = availableTotal > 0 ? ((presentTotal / availableTotal) * 100).toFixed(2) : "0.00";
    }

    // 3. Dynamic Club Headcount rows
    for (const club of reportingClubs) {
        const clubName = club.name;
        let sectionIds = [];
        try {
            sectionIds = JSON.parse(club.sectionIds || "[]");
        } catch (e) {
            continue;
        }

        if (sectionIds.length === 0) continue;

        const placeholders = sectionIds.map(() => "?").join(",");
        const clubDailySql = `
            SELECT
                CONVERT(VARCHAR, al.[date], 23) AS dateKey,
                SUM(CASE WHEN UPPER(ISNULL(al.[status], '')) = 'PRESENT' THEN 1 ELSE 0 END) AS presentCount,
                SUM(CASE WHEN TRY_CONVERT(date, u.joiningDate) <= DATEADD(MONTH, -3, al.[date]) AND UPPER(ISNULL(al.[status], '')) = 'PRESENT' THEN 1 ELSE 0 END) AS presentAbove3Months,
                SUM(CASE WHEN UPPER(ISNULL(al.[status], '')) IN ('ABSENT', 'A') THEN 1 ELSE 0 END) AS absentCount
            FROM (
                -- Collapse to one row per user per date first, same reasoning as netHeadcountSql above.
                SELECT userId, [date], MAX(status) AS status
                FROM attendance_logs
                WHERE [date] >= ? AND [date] <= ?
                GROUP BY userId, [date]
            ) al
            INNER JOIN users u ON u.id = al.userId
            WHERE u.sectionId IN (${placeholders})
              AND u.[isEmployee] = 1
              ${getEligibleUserSql('u')}
              AND ${notYetLeftCondition}
            GROUP BY al.[date]
        `;
        const [clubDailyData] = await executeQuery(clubDailySql, [start, end, ...sectionIds]);

        const clubPresentMap = {};
        clubDailyData.forEach(row => {
            if (row.dateKey) clubPresentMap[row.dateKey] = row;
        });

        const normalizedSectionIds = sectionIds.map(String);

        for (let d = 1; d <= totalDays; d++) {
            const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dDate = new Date(dKey);
            const row = clubPresentMap[dKey] || {};

            const activeInClub = allEligibleUsers.filter(u => {
                if (!normalizedSectionIds.includes(String(u.sectionId))) return false;
                const join = u.joiningDate ? new Date(u.joiningDate) : null;
                if (join && join > dDate) return false;
                if (u.status?.toLowerCase() === 'left') {
                    const left = new Date(u.leavingDate || u.updatedAt);
                    if (left <= dDate) return false;
                }
                return true;
            }).length;

            const present = row.presentCount || 0;
            const absent = Math.max(0, activeInClub - present);
            const totalPA = activeInClub;

            tableData[`${clubName} Headcount available_${dKey}`] = String(present);
            tableData[`${clubName} absent_${dKey}`] = String(absent);
            tableData[`${clubName} Total Headcount (Present + Absent)_${dKey}`] = String(totalPA);
            tableData[`${clubName} Net Available Headcount Above 3 Months_${dKey}`] = String(row.presentAbove3Months || 0);

            const clubAbsPercent = (totalPA > 0) ? (absent / totalPA) * 100 : 0;
            tableData[`${clubName} Absenteeism %_${dKey}`] = clubAbsPercent.toFixed(2);
        }
    }

    // 4. Hiring Actual — intentionally includes both regular and temp/Dojo hires (unlike
    // eligibleEmployeeCondition, which requires isTemporary = 0), so isEmployee/isTemporary
    // stay as-is; only the isDeleted/shuttered-designation data-quality checks are added.
    const joinSql = `
        SELECT
            CONVERT(VARCHAR, joiningDate, 23) as dateKey,
            COUNT(*) as count
        FROM users u
        ${getDesignationShutterLeftJoinSql('u', 'ds')}
        WHERE (u.[isEmployee] = 1 OR u.[isTemporary] = 1)
          AND (u.[isDeleted] = 0 OR u.[isDeleted] IS NULL)
          AND ds.[designation] IS NULL
          AND joiningDate >= ?
          AND joiningDate <= ?
        GROUP BY CONVERT(VARCHAR, joiningDate, 23)
    `;
    const [joinData] = await executeQuery(joinSql, [start, end]);
    joinData.forEach(row => {
        if (row.dateKey) tableData[`Hiring Actual_${row.dateKey}`] = row.count;
    });

    // 5. Handover Actual
    const handoverSql = `
        SELECT CONVERT(VARCHAR, [date], 23) as dateKey, entries 
        FROM handover_sheets 
        WHERE [date] >= ? AND [date] <= ?
    `;
    const [handoverRows] = await executeQuery(handoverSql, [start, end]);
    const handoverDailyCounts = {};
    const clubHandoverDailyCounts = {};

    reportingClubs.forEach(c => clubHandoverDailyCounts[c.id] = {});

    handoverRows.forEach(row => {
        const dKey = row.dateKey;
        let dailyTotal = 0;
        try {
            const entriesArr = JSON.parse(row.entries || "[]");
            entriesArr.forEach(e => {
                if (e.interviewStatus === 'APPROVE') {
                    dailyTotal++;

                    reportingClubs.forEach(club => {
                        let clubSectionIds = [];
                        try {
                            clubSectionIds = typeof club.sectionIds === 'string'
                                ? JSON.parse(club.sectionIds || "[]")
                                : (club.sectionIds || []);
                        } catch (err) { }

                        if (clubSectionIds.map(String).includes(String(e.sectionId))) {
                            clubHandoverDailyCounts[club.id][dKey] = (clubHandoverDailyCounts[club.id][dKey] || 0) + 1;
                        }
                    });
                }
            });
        } catch (e) {
            console.error("Error parsing handover entries:", e);
        }

        if (dKey) handoverDailyCounts[dKey] = (handoverDailyCounts[dKey] || 0) + dailyTotal;
    });

    let cumulativeHandover = 0;
    const clubCumulativeHandover = {};
    reportingClubs.forEach(c => clubCumulativeHandover[c.id] = 0);

    for (let d = 1; d <= totalDays; d++) {
        const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayHandover = handoverDailyCounts[dKey] || 0;
        cumulativeHandover += dayHandover;

        tableData[`Handover Actual_${dKey}`] = dayHandover;
        tableData[`Handed-over after training (Cumulative)_${dKey}`] = cumulativeHandover;

        reportingClubs.forEach(club => {
            const clubDayHandover = clubHandoverDailyCounts[club.id][dKey] || 0;
            clubCumulativeHandover[club.id] += clubDayHandover;
            tableData[`${club.name} Handed-over after training (Cumulative)_${dKey}`] = clubCumulativeHandover[club.id];
        });
    }

    // 5b. Handover Plan (expected handover count per day)
    const expectedHandoverSql = `
        SELECT CONVERT(VARCHAR, u.expectedHandover, 23) AS dateKey, COUNT(*) AS count
        FROM users u
        ${getDesignationShutterLeftJoinSql('u', 'ds')}
        WHERE (u.[isTemporary] = 1 OR u.[expectedHandover] IS NOT NULL)
          AND (u.[isDeleted] = 0 OR u.[isDeleted] IS NULL)
          AND ds.[designation] IS NULL
          AND u.[expectedHandover] >= ?
          AND u.[expectedHandover] <= ?
        GROUP BY CONVERT(VARCHAR, u.expectedHandover, 23)
    `;
    const [expectedHandoverData] = await executeQuery(expectedHandoverSql, [start, end]);

    for (let d = 1; d <= totalDays; d++) {
        const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        tableData[`Handover Plan_${dKey}`] = 0;
    }
    expectedHandoverData.forEach(row => {
        if (row.dateKey) tableData[`Handover Plan_${row.dateKey}`] = row.count;
    });

    // 6. Separations
    const nYear = Number(month) === 12 ? Number(year) + 1 : Number(year);
    const nMonth = Number(month) === 12 ? 1 : Number(month) + 1;
    const nextMonthStart = `${nYear}-${String(nMonth).padStart(2, '0')}-01`;

    // WHERE stays broad (isEmployee OR isTemporary) because this raw result set feeds both the
    // employee "Separated (Cumulative)" metrics below AND dojoDayLeftCount (which specifically
    // needs isTemporary = 1 rows) further down. isDeleted/shuttered-designation are excluded here
    // since they're data-quality checks that apply to both populations; the isTemporary = 0
    // restriction for "Separated (Cumulative)" is instead applied in JS where dayLeftCount /
    // weeklyLeft / club counts are computed, so it doesn't zero out dojoDayLeftCount.
    const leftSql = `
        SELECT id, empId as payCode, idCard as cardNo, fullName as employeeName, departmentId, sectionId, shift, isTemporary,
               CONVERT(VARCHAR, COALESCE(leavingDate, updatedAt), 23) as dateKey
        FROM users u
        WHERE (
            (leavingDate >= ? AND leavingDate < ?) OR
            (TRIM(LOWER(status)) LIKE 'left%' AND (updatedAt >= ? AND updatedAt < ?))
        )
        AND (u.[isEmployee] = 1 OR u.[isTemporary] = 1)
        AND (u.[isDeleted] = 0 OR u.[isDeleted] IS NULL)
        AND (u.[designation] IS NULL OR u.[designation] = '' OR u.[designation] NOT IN (SELECT designation FROM designation_shutters))
    `;
    const [leftUsers] = await executeQuery(leftSql, [start, nextMonthStart, start, nextMonthStart]);

    console.log(`Sync Report [${month}/${year}] Range [${start} to ${nextMonthStart}]: Found ${leftUsers.length} separated users.`);
    if (leftUsers.length > 0) {
        console.log("Separated Users:", leftUsers.map(u => `${u.employeeName} (${u.dateKey})`).join(", "));
    }

    let cumulativeLeft = 0;
    const clubCumulativeLeft = {};
    reportingClubs.forEach(c => clubCumulativeLeft[c.id] = 0);

    const counts = Object.values(dailyTotalsMap).filter(v => v > 0);
    const avgHeadcount = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    let lastKnownTotal = avgHeadcount;

    for (let d = 1; d <= totalDays; d++) {
        const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayLeftCount = leftUsers.filter(l => l.dateKey === dKey && !l.isTemporary).length;
        const dojoDayLeftCount = leftUsers.filter(l => l.dateKey === dKey && l.isTemporary).length;
        cumulativeLeft += dayLeftCount;

        const dayStats = netHeadcountData.find(r => r.dateKey === dKey);
        if (dayStats?.totalUploaded > 0) lastKnownTotal = dayStats.totalUploaded;

        const denom = lastKnownTotal || 1;

        tableData[`Left in nos (Daily)_${dKey}`] = dayLeftCount;
        tableData[`Separated (Cumulative)_${dKey}`] = cumulativeLeft;
        tableData[`Actual Separations (Cumulative)_${dKey}`] = cumulativeLeft;

        const dailyAttr = (dayLeftCount / denom) * 100;
        const cumAttr = (cumulativeLeft / denom) * 100;

        tableData[`Attrition % Daily_${dKey}`] = dailyAttr.toFixed(2);
        tableData[`Attrition % Cumulative_${dKey}`] = cumAttr.toFixed(2);

        let weeklyLeft = 0;
        for (let i = 0; i < 7; i++) {
            const prevD = d - i;
            if (prevD >= 1) {
                const prevDKey = `${year}-${String(month).padStart(2, '0')}-${String(prevD).padStart(2, '0')}`;
                weeklyLeft += leftUsers.filter(l => l.dateKey === prevDKey && !l.isTemporary).length;
            }
        }

        const weeklyAttr = (weeklyLeft / denom) * 100;
        tableData[`Weekly Attrition %_${dKey}`] = weeklyAttr.toFixed(2);

        tableData[`Gap_${dKey}`] = (cumulativeLeft - (parseFloat(tableData[`Expected Separations (Cumulative)_${dKey}`]) || 0)).toFixed(0);

        const dojoAbsent = Number(tableData[`DojoAbsent_${dKey}`] || 0);
        tableData[`Attrition & Absenteeism of Training Cell (Nos)_${dKey}`] = dojoAbsent + dojoDayLeftCount;
        delete tableData[`DojoAbsent_${dKey}`];

        reportingClubs.forEach(club => {
            let clubSectionIds = [];
            try {
                clubSectionIds = typeof club.sectionIds === 'string'
                    ? JSON.parse(club.sectionIds || "[]")
                    : (club.sectionIds || []);
                clubSectionIds = clubSectionIds.map(String);
            } catch (e) {
                clubSectionIds = [];
            }

            const clubDayCount = leftUsers.filter(l => l.dateKey === dKey && !l.isTemporary && clubSectionIds.includes(String(l.sectionId))).length;
            clubCumulativeLeft[club.id] = (clubCumulativeLeft[club.id] || 0) + clubDayCount;
            tableData[`${club.name} Separated (Cumulative)_${dKey}`] = clubCumulativeLeft[club.id];
        });
    }

    // 7. Requirement Plan from requirements table
    // IMPORTANT:
    // Only these two monthly-report rows use the same approved requirement logic
    // as the dashboard first graph:
    // 1) Headcount required as per production plan
    // 2) Headcount required as per sale plan
    //
    // Production Plan:
    // Day 1 to 15 = prodPlanFN01
    // Day 16 onward = prodPlanFN02
    //
    // Sale Plan:
    // salesPlan from the same valid/approved requirements rows.
    //
    // Hiring Plan = productionPlanRequirement - present (attendance_logs-derived), floored at 0.
    const formatDateKey = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const visibleRequirementDates = [];

    // Previous month last date because frontend shows this as first column
    const prevMonthLastDate = new Date(Number(year), Number(month) - 1, 0);
    visibleRequirementDates.push({
        dateKey: formatDateKey(prevMonthLastDate),
        day: prevMonthLastDate.getDate(),
        monthNumber: prevMonthLastDate.getMonth() + 1,
        year: prevMonthLastDate.getFullYear()
    });

    // Current month all dates
    for (let d = 1; d <= totalDays; d++) {
        const currentDayDate = new Date(Number(year), Number(month) - 1, d);
        visibleRequirementDates.push({
            dateKey: formatDateKey(currentDayDate),
            day: d,
            monthNumber: Number(month),
            year: Number(year)
        });
    }

    const uniqueRequirementMonths = [];
    const uniqueRequirementMonthKeys = new Set();

    visibleRequirementDates.forEach(item => {
        const key = `${item.year}-${item.monthNumber}`;
        if (!uniqueRequirementMonthKeys.has(key)) {
            uniqueRequirementMonthKeys.add(key);
            uniqueRequirementMonths.push({
                year: item.year,
                monthNumber: item.monthNumber
            });
        }
    });

    // Dashboard-aligned map is used ONLY for the two requirement rows requested above.
    let dashboardRequirementPlanMap = {};

    // Per-club version of dashboardRequirementPlanMap, scoped to each club's sectionIds,
    // used for the `${club.name} Headcount required` rows below.
    const clubDashboardRequirementPlanMap = {};
    reportingClubs.forEach(club => { clubDashboardRequirementPlanMap[club.id] = {}; });

    if (uniqueRequirementMonths.length > 0) {
        const dashboardRequirementWhereClause = uniqueRequirementMonths
            .map(() => `(r.[year] = ? AND r.monthNumber = ?)`)
            .join(' OR ');

        const requirementParams = [];
        uniqueRequirementMonths.forEach(item => {
            requirementParams.push(item.year);
            requirementParams.push(item.monthNumber);
        });


        // Exact dashboard first-graph approval logic for requirement rows.
        // This includes active approved rows plus system-approved rows.
        const dashboardApprovalCondition = `
            AND (
                (
                    ISNULL(r.is_active, 0) = 1
                    AND LOWER(LTRIM(RTRIM(ISNULL(r.approvalStatus, 'approved')))) IN (
                        'approved',
                        'system_approved',
                        'system approved',
                        'system-approved',
                        'systemapproved'
                    )
                )
                OR LOWER(LTRIM(RTRIM(ISNULL(r.approvalStatus, '')))) IN (
                    'system_approved',
                    'system approved',
                    'system-approved',
                    'systemapproved'
                )
            )
        `;

        // Match the dashboard first graph's requirements-table query structure.
        // No dashboard Department/Section/Line filter is applied here because the
        // monthly report's existing requirement rows are global totals.
        const [dashboardRequirementRows] = await executeQuery(`
            SELECT
                r.[year] AS yearVal,
                r.monthNumber AS monthNumber,
                CAST(SUM(ISNULL(r.prodPlanFN01, 0)) AS BIGINT) AS required_fn01,
                CAST(SUM(ISNULL(r.prodPlanFN02, 0)) AS BIGINT) AS required_fn02,
                CAST(SUM(ISNULL(r.salesPlan, 0)) AS BIGINT) AS required_sales_plan
            FROM requirements r
            LEFT JOIN sections s
                ON (
                    r.sectionId = s.id
                    OR (
                        r.sectionId IS NULL
                        AND (
                            UPPER(LTRIM(RTRIM(CAST(r.sectionCode AS NVARCHAR(510))))) = UPPER(LTRIM(RTRIM(CAST(s.uniCode AS NVARCHAR(510)))))
                            OR UPPER(LTRIM(RTRIM(CAST(r.sectionName AS NVARCHAR(510))))) = UPPER(LTRIM(RTRIM(CAST(s.name AS NVARCHAR(510)))))
                        )
                    )
                )
                AND ISNULL(s.isActive, 1) = 1
            LEFT JOIN departments d ON d.id = s.departmentId
            WHERE (${dashboardRequirementWhereClause})
            ${dashboardApprovalCondition}
            GROUP BY r.[year], r.monthNumber
        `, requirementParams);

        dashboardRequirementRows.forEach(row => {
            const key = `${row.yearVal}-${row.monthNumber}`;
            dashboardRequirementPlanMap[key] = {
                prodPlanFN01: Number(row.required_fn01 || 0),
                prodPlanFN02: Number(row.required_fn02 || 0),
                salesPlan: Number(row.required_sales_plan || 0)
            };
        });

        // Same dashboard-approval logic as above, but scoped to each club's sectionIds so
        // `${club.name} Headcount required` matches that club's slice of the production plan.
        for (const club of reportingClubs) {
            let clubSectionIds = [];
            try {
                clubSectionIds = typeof club.sectionIds === 'string'
                    ? JSON.parse(club.sectionIds || "[]")
                    : (club.sectionIds || []);
            } catch (e) {
                clubSectionIds = [];
            }

            if (!Array.isArray(clubSectionIds) || clubSectionIds.length === 0) continue;

            const sectionPlaceholders = clubSectionIds.map(() => '?').join(',');
            const [clubRequirementRows] = await executeQuery(`
                SELECT
                    r.[year] AS yearVal,
                    r.monthNumber AS monthNumber,
                    CAST(SUM(ISNULL(r.prodPlanFN01, 0)) AS BIGINT) AS required_fn01,
                    CAST(SUM(ISNULL(r.prodPlanFN02, 0)) AS BIGINT) AS required_fn02
                FROM requirements r
                INNER JOIN sections s
                    ON (
                        r.sectionId = s.id
                        OR (
                            r.sectionId IS NULL
                            AND (
                                UPPER(LTRIM(RTRIM(CAST(r.sectionCode AS NVARCHAR(510))))) = UPPER(LTRIM(RTRIM(CAST(s.uniCode AS NVARCHAR(510)))))
                                OR UPPER(LTRIM(RTRIM(CAST(r.sectionName AS NVARCHAR(510))))) = UPPER(LTRIM(RTRIM(CAST(s.name AS NVARCHAR(510)))))
                            )
                        )
                    )
                    AND ISNULL(s.isActive, 1) = 1
                WHERE (${dashboardRequirementWhereClause})
                ${dashboardApprovalCondition}
                  AND s.id IN (${sectionPlaceholders})
                GROUP BY r.[year], r.monthNumber
            `, [...requirementParams, ...clubSectionIds]);

            clubRequirementRows.forEach(row => {
                const key = `${row.yearVal}-${row.monthNumber}`;
                clubDashboardRequirementPlanMap[club.id][key] = {
                    prodPlanFN01: Number(row.required_fn01 || 0),
                    prodPlanFN02: Number(row.required_fn02 || 0)
                };
            });
        }
    }

    visibleRequirementDates.forEach(item => {
        const planKey = `${item.year}-${item.monthNumber}`;

        // Used ONLY for the two requested requirement rows.
        const dashboardRequirementPlanEntry = dashboardRequirementPlanMap[planKey];
        const dashboardRequirementPlan = dashboardRequirementPlanEntry || {
            prodPlanFN01: 0,
            prodPlanFN02: 0,
            salesPlan: 0
        };

        // Same date split as dashboard first graph.
        const productionPlanRequirement = item.day <= 15
            ? dashboardRequirementPlan.prodPlanFN01
            : dashboardRequirementPlan.prodPlanFN02;

        tableData[`Headcount required as per production plan_${item.dateKey}`] = productionPlanRequirement;
        tableData[`Headcount required as per sale plan_${item.dateKey}`] = dashboardRequirementPlan.salesPlan;

        // Hiring Plan = requirement - present, where "present" is the same attendance_logs-derived
        // headcount as the "Headcount available" row above. If either side has no real data for
        // this date (no requirement row for the month, or no attendance data for the day — e.g.
        // the leading previous-month reference column), show 0 instead of a misleading number.
        // Otherwise capped at 0 so a fully/over-staffed day doesn't show a negative hiring need.
        const presentRaw = tableData[`Headcount available_${item.dateKey}`];
        const attendanceAvailable = presentRaw !== undefined && presentRaw !== null;
        const requirementAvailable = !!dashboardRequirementPlanEntry;

        tableData[`Hiring Plan_${item.dateKey}`] = (requirementAvailable && attendanceAvailable)
            ? Math.max(0, productionPlanRequirement - (Number(presentRaw) || 0))
            : 0;

        // `${club.name} Headcount required` — same FN01 (days 1-15) / FN02 (day 16+) split as
        // the aggregate production-plan row, scoped to each club's own sectionIds.
        reportingClubs.forEach(club => {
            const clubPlan = clubDashboardRequirementPlanMap[club.id]?.[planKey] || {
                prodPlanFN01: 0,
                prodPlanFN02: 0
            };
            const clubRequirement = item.day <= 15 ? clubPlan.prodPlanFN01 : clubPlan.prodPlanFN02;
            tableData[`${club.name} Headcount required_${item.dateKey}`] = clubRequirement;
        });
    });

    return { tableData };
};
