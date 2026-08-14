import { executeQuery } from "../db/mssqlHelper.js";
import HeadcountReport from "../models/headcountReport.model.js";
import { getEligibleUserSql, getDesignationShutterLeftJoinSql, getEligibleUserConditionViaJoin, getDesignationShutterExclusionCondition } from "../utils/userEligibility.js";

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

    // Previous month's last date — the leading reference column the frontend shows before
    // day 1. Hoisted here so attendance-based queries below can include it in their range.
    const prevMonthLastDateObj = new Date(Number(year), Number(month) - 1, 0);
    const prevMonthLastDateKey = `${prevMonthLastDateObj.getFullYear()}-${String(prevMonthLastDateObj.getMonth() + 1).padStart(2, '0')}-${String(prevMonthLastDateObj.getDate()).padStart(2, '0')}`;

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
        SELECT id, empId, sectionId, joiningDate, leavingDate, updatedAt, status, isTemporary, statusHistory, stationId, stations
        FROM users u
        WHERE u.isEmployee = 1
        ${getEligibleUserSql('u')}
    `);

    // Raw attendance punches for the whole report range, used below to compute "Net Available
    // Headcount Total" (Present) and "Absent" in memory so they match the MPS dashboard's Daily
    // Manpower Trend / Daily Absenteeism Rate graphs exactly: a punch only counts as Present when
    // its payCode matches the employee's empId AND that employee has an active statusHistory
    // stint on that date (dashboard.controller.js's getAttendancePayCodeMatchSql +
    // getStatusHistoryActiveConditionSql), not merely any Present-status row joined by userId.
    const [attendanceLogs] = await executeQuery(`
        SELECT userId, CONVERT(VARCHAR, [date], 23) AS dateKey, status, payCode, shift
        FROM attendance_logs
        WHERE [date] >= ? AND [date] <= ?
    `, [prevMonthLastDateKey, end]);

    const punchesByDate = {};
    attendanceLogs.forEach(p => {
        if (!punchesByDate[p.dateKey]) punchesByDate[p.dateKey] = [];
        punchesByDate[p.dateKey].push(p);
    });

    // Declared holidays suppress the subtraction-method Absent count to 0 below, matching the
    // dashboard's Daily Absenteeism Rate graph. Best-effort: if the table is missing/unreachable,
    // fall back to treating no date as a holiday rather than failing the whole sync.
    let holidaySet = new Set();
    try {
        const [holidayRows] = await executeQuery(`
            SELECT CONVERT(VARCHAR, holidayDate, 23) AS holidayDate
            FROM dbo.dashboard_holidays
            WHERE holidayDate >= ? AND holidayDate <= ? AND isActive = 1
        `, [prevMonthLastDateKey, end]);
        holidaySet = new Set(holidayRows.map(r => r.holidayDate).filter(Boolean));
    } catch (e) {
        console.warn("[HEADCOUNT] Failed to fetch holidays:", e.message);
    }

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
            SUM(CASE WHEN UPPER(ISNULL(al.[status], '')) = 'PRESENT' AND u.[isEmployee] = 1 AND ${eligibleEmployeeCondition} AND ${notYetLeftCondition} AND ISNULL(u.isAdmin, 0) = 0 THEN 1 ELSE 0 END) as totalPresentForHeadcount,
            SUM(CASE WHEN UPPER(ISNULL(al.status, '')) IN ('ABSENT', 'A') AND u.[isEmployee] = 1 AND ${eligibleEmployeeCondition} AND ${notYetLeftCondition} AND ISNULL(u.isAdmin, 0) = 0 THEN 1 ELSE 0 END) as totalAbsent,
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
    const [netHeadcountData] = await executeQuery(netHeadcountSql, [prevMonthLastDateKey, end]);

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

    // Timezone-safe day-only key (YYYYMMDD as a number). Ported verbatim (local-time getters,
    // not UTC) from dashboard.controller.js's parseManpowerDateKey so statusHistory-based
    // active-stint determination below matches the MPS dashboard's Daily Manpower Trend graph
    // exactly, including its date-string-format priority (ISO, then DD/MM/YYYY, then Date()).
    const parseManpowerDateKey = (value) => {
        if (value === null || value === undefined) return null;

        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return (
                value.getFullYear() * 10000
                + (value.getMonth() + 1) * 100
                + value.getDate()
            );
        }

        const raw = String(value).trim();
        const upper = raw.toUpperCase();
        if (!raw || upper === 'NULL' || upper === 'UNDEFINED' || upper === 'INVALID DATE') {
            return null;
        }

        let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (match) {
            const y = Number(match[1]);
            const m = Number(match[2]);
            const d = Number(match[3]);
            if (y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return y * 10000 + m * 100 + d;
        }

        // DD/MM/YYYY or DD-MM-YYYY before US formats, matching the SQL-side helper priority.
        match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
        if (match) {
            const d = Number(match[1]);
            const m = Number(match[2]);
            const y = Number(match[3]);
            if (y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return y * 10000 + m * 100 + d;
        }

        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.getFullYear() * 10000 + (parsed.getMonth() + 1) * 100 + parsed.getDate();
        }

        return null;
    };

    // Determines whether a user was on an active employment stint on dDate, and that stint's
    // joiningDate, by walking statusHistory rather than just the current joiningDate/status
    // columns — so a user who left and later rejoined is evaluated against the stint that was
    // actually open on dDate, not their latest one. Ported from dashboard.controller.js's
    // isUserActiveForManpowerDate/getValidStatusHistoryPeriods so "Headcount available" matches
    // the MPS dashboard's Daily Manpower Trend graph exactly: numeric day-only comparisons
    // instead of Date-object ones, and a stint with no recorded leavingDate is only active while
    // its latest statusHistory status is explicitly PRESENT (ON_LEAVE/SUSPENDED/BANNED do not
    // count as active here, matching the graph even though that differs from the broader
    // "anything but LEFT" rule used for other roster purposes elsewhere in this file).
    const getUserActiveStintOnDate = (u, dDate) => {
        const asOfDateKey = parseManpowerDateKey(dDate);
        if (asOfDateKey === null) return { active: false, joiningDate: null };

        let history = u.statusHistory;
        if (typeof history === 'string') {
            const trimmed = history.trim();
            if (!trimmed) {
                history = [];
            } else {
                try {
                    history = JSON.parse(trimmed);
                } catch (e) {
                    history = [];
                }
            }
        }
        if (!Array.isArray(history)) history = [];

        const periodsByJoiningDate = new Map();
        history.forEach((item, index) => {
            const joiningDateKey = parseManpowerDateKey(item?.joiningDate);
            if (joiningDateKey === null) return;

            const leavingDateKey = parseManpowerDateKey(item?.leavingDate);
            const status = String(item?.status || '').trim().toUpperCase();
            const changedAtMs = item?.changedAt ? new Date(item.changedAt).getTime() : Number.NaN;

            const existing = periodsByJoiningDate.get(joiningDateKey) || {
                joiningDateKey,
                leavingDateKey: null,
                latestStatus: '',
                latestChangedAtMs: Number.NEGATIVE_INFINITY,
                latestIndex: -1,
            };

            if (leavingDateKey !== null && (existing.leavingDateKey === null || leavingDateKey > existing.leavingDateKey)) {
                existing.leavingDateKey = leavingDateKey;
            }

            const comparableChangedAt = Number.isNaN(changedAtMs) ? Number.NEGATIVE_INFINITY : changedAtMs;
            if (comparableChangedAt > existing.latestChangedAtMs || (comparableChangedAt === existing.latestChangedAtMs && index > existing.latestIndex)) {
                existing.latestStatus = status;
                existing.latestChangedAtMs = comparableChangedAt;
                existing.latestIndex = index;
            }

            periodsByJoiningDate.set(joiningDateKey, existing);
        });

        const periods = Array.from(periodsByJoiningDate.values());

        if (periods.length > 0) {
            let isActive = false;
            let activeStintJoinDateKey = null;

            periods.forEach((period) => {
                if (period.joiningDateKey > asOfDateKey) return;

                // leavingDate is exclusive: joining 01, leaving 10 => active only 01..09.
                const periodActive = period.leavingDateKey !== null
                    ? asOfDateKey < period.leavingDateKey
                    : period.latestStatus === 'PRESENT';

                if (periodActive) {
                    isActive = true;
                    activeStintJoinDateKey = period.joiningDateKey;
                }
            });

            let joiningDateObj = null;
            if (activeStintJoinDateKey !== null) {
                const y = Math.floor(activeStintJoinDateKey / 10000);
                const m = Math.floor((activeStintJoinDateKey % 10000) / 100) - 1;
                const d = activeStintJoinDateKey % 100;
                joiningDateObj = new Date(y, m, d);
            }

            return { active: isActive, joiningDate: joiningDateObj };
        }

        // Legacy fallback for users with no usable statusHistory joiningDate — matches
        // isUserActiveForManpowerDate's fallback exactly.
        const currentStatus = String(u.status || '').trim().toUpperCase();
        const legacyJoiningDateKey = parseManpowerDateKey(u.joiningDate);
        const legacyLeavingDateKey = parseManpowerDateKey(u.leavingDate);
        const joinedByDate = (legacyJoiningDateKey === null || legacyJoiningDateKey <= asOfDateKey);

        let isActive = false;
        if (currentStatus === 'PRESENT') {
            isActive = joinedByDate;
        } else if (currentStatus === 'LEFT') {
            isActive = joinedByDate && legacyLeavingDateKey !== null && asOfDateKey < legacyLeavingDateKey;
        }

        const join = u.joiningDate ? new Date(u.joiningDate) : null;
        return { active: isActive, joiningDate: join };
    };

    // Date-aware "is this user part of the roster as of dDate" check, used by activeCount/
    // activeInClub (Total Headcount) below — a user who has since left still counts correctly
    // on days before they actually left.
    const isRosterActiveOnDate = (u, dDate) => getUserActiveStintOnDate(u, dDate).active;

    // Rejoining: per statusHistory.js, a fresh history entry is only ever pushed when a user
    // transitions OUT of LEFT (rejoins) — every other change updates the last entry in place.
    // So entries after the first (genesis) one are rejoin events, and their joiningDate is the
    // rejoin date. Deduped per user per date in case of duplicate/same-day history entries.
    const getRejoiningYMDs = (statusHistoryRaw) => {
        let history;
        try {
            history = typeof statusHistoryRaw === 'string' ? JSON.parse(statusHistoryRaw || '[]') : statusHistoryRaw;
        } catch (e) {
            history = [];
        }
        if (!Array.isArray(history) || history.length < 2) return [];
        const genesisYMD = toYMD(history[0]?.joiningDate);
        return history.slice(1)
            .map(entry => toYMD(entry?.joiningDate))
            .filter(dYMD => dYMD && dYMD !== genesisYMD);
    };

    const rejoiningUsersByDate = {};
    allEligibleUsers.forEach(u => {
        const seenDatesForUser = new Set();
        getRejoiningYMDs(u.statusHistory).forEach(dYMD => {
            if (seenDatesForUser.has(dYMD)) return;
            seenDatesForUser.add(dYMD);
            if (!rejoiningUsersByDate[dYMD]) rejoiningUsersByDate[dYMD] = new Set();
            rejoiningUsersByDate[dYMD].add(u.id);
        });
    });

    const todayObj = new Date();
    const todayYMD = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

    // Net Available Headcount Total / Above 3 Months, global or scoped to a club's sectionIds.
    // Both: users-table roster, date-aware via statusHistory stints (getUserActiveStintOnDate)
    // — active on the stint open as of dateObj. No attendance_logs fallback for either figure:
    // "Headcount available" is fed by countTotal and must match the MPS dashboard's Daily
    // Manpower Trend "Total Headcount" bar (totalManpower) exactly, which is purely
    // statusHistory-driven with no attendance-punch fallback of its own. Above 3 Months adds a
    // tenure check (DATEDIFF(DAY, that stint's joiningDate, dateObj) >= 91), matching the MPS
    // Portal's tenure-graph "3m-6m"+ bucketing exactly. Both are 0 for future dates.
    const getNetAvailableHeadcount = (dateKey, dateObj, targetSectionIds = null) => {
        if (dateKey > todayYMD) return { countTotal: 0, countAbove3Months: 0 };

        let countTotal = 0;
        let countAbove3Months = 0;

        allEligibleUsers.forEach(u => {
            if (targetSectionIds && !targetSectionIds.includes(String(u.sectionId))) return;

            // Pass the string dateKey (not dateObj) so the "as of" date is parsed by
            // parseManpowerDateKey's string branch — matching dashboard.controller.js's calling
            // convention exactly (it always passes a formatted date string, never a Date
            // instance) and sidestepping any local-vs-UTC skew from `new Date(dKey)`.
            const { active: stillActive, joiningDate: stintJoinDate } = getUserActiveStintOnDate(u, dateKey);
            const join = stintJoinDate;

            if (stillActive) countTotal++;
            if (stillActive && join) {
                // DATEDIFF(DAY, joinDate, asOfDate) >= 91, matching dashboard.controller.js's
                // tenure-graph bucketing exactly (3m-6m starts at 91 days) instead of a
                // calendar-month subtraction, which drifts by 1-3 days depending on month
                // lengths. UTC millis avoid local-timezone skew in the day-count subtraction.
                const joinKey = parseManpowerDateKey(join);
                const asOfKey = parseManpowerDateKey(dateKey);
                if (joinKey !== null && asOfKey !== null) {
                    const y1 = Math.floor(joinKey / 10000);
                    const m1 = Math.floor((joinKey % 10000) / 100) - 1;
                    const d1 = joinKey % 100;

                    const y2 = Math.floor(asOfKey / 10000);
                    const m2 = Math.floor((asOfKey % 10000) / 100) - 1;
                    const d2 = asOfKey % 100;

                    const utc1 = Date.UTC(y1, m1, d1);
                    const utc2 = Date.UTC(y2, m2, d2);

                    const diffDays = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
                    if (diffDays >= 91) {
                        countAbove3Months++;
                    }
                }
            }
        });

        return { countTotal, countAbove3Months };
    };

    // "Net Available Headcount Total" (Present), matching the MPS dashboard's Daily Manpower
    // Trend "mappedPresentCount" exactly: the roster (allEligibleUsers, per-stint active on
    // dateKey) count whose empId matches a Present punch's payCode that day — not merely any
    // Present-status attendance_logs row joined by userId.
    const getMappedPresentCount = (dateKey) => {
        const punchesForDay = punchesByDate[dateKey] || [];
        const presentPayCodes = new Set();
        punchesForDay.forEach(p => {
            const status = String(p.status || '').trim().toUpperCase();
            if (status === 'P' || status === 'PRESENT') {
                const payCodeClean = String(p.payCode || '').trim().toUpperCase();
                if (payCodeClean) presentPayCodes.add(payCodeClean);
            }
        });

        let present = 0;
        allEligibleUsers.forEach(u => {
            const empIdClean = String(u.empId || '').trim().toUpperCase();
            if (!empIdClean || !presentPayCodes.has(empIdClean)) return;
            if (getUserActiveStintOnDate(u, dateKey).active) present++;
        });

        return present;
    };

    const dailyTotalsMap = {};

    for (let d = 1; d <= totalDays; d++) {
        const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dDate = new Date(dKey);

        const activeCount = allEligibleUsers.filter(u => isRosterActiveOnDate(u, dDate)).length;

        // Temporary/Dojo users don't have attendance_logs punches uploaded for them, so
        // "present" here just means "still an active Dojo member as of this date" — the
        // join/leave/promotion filter below is already date-aware, so anyone it keeps is by
        // definition present on dKey. Future dates (no data can exist yet) show 0.
        let dojoPresentOnDate = 0;
        let dojoAbsentOnDate = 0;

        if (dKey <= todayYMD) {
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
            dojoPresentOnDate = dojoMembersOnDate.length;
        }

        const { countTotal: netAvailableHeadcountTotal, countAbove3Months: netAvailableAbove3Months } =
            getNetAvailableHeadcount(dKey, dDate);

        // Present/Absent now match the dashboard's Daily Manpower Trend / Daily Absenteeism Rate
        // graphs exactly: Present is the payCode-matched, statusHistory-active mappedPresentCount
        // (getMappedPresentCount above); Absent is the subtraction method (Roster - Present),
        // suppressed to 0 on declared holidays. Future dates have no attendance data yet.
        const isHoliday = holidaySet.has(dKey);
        const present = (dKey <= todayYMD) ? getMappedPresentCount(dKey) : 0;
        const absent = (dKey <= todayYMD)
            ? (isHoliday ? 0 : Math.max(netAvailableHeadcountTotal - present, 0))
            : 0;
        // totalPA (roster/activeCount-based) is kept as-is for Absenteeism % and the Attrition %
        // fallback average below.
        const totalPA = activeCount;
        const totalHeadcountPresentAbsent = (dKey <= todayYMD) ? (present + absent) : 0;

        dailyTotalsMap[dKey] = totalPA;
        // Swapped: "Headcount available" now shows the on-roll roster count (formerly Net
        // Available Headcount Total), and "Net Available Headcount Total" now shows the
        // attendance-present count (formerly Headcount available).
        tableData[`Headcount available_${dKey}`] = String(netAvailableHeadcountTotal);
        tableData[`Present in Training Cell_${dKey}`] = dojoPresentOnDate;
        tableData[`DojoAbsent_${dKey}`] = dojoAbsentOnDate;
        tableData[`Net Available Headcount Total_${dKey}`] = present;
        tableData[`Total Headcount (Present + Absent)_${dKey}`] = totalHeadcountPresentAbsent;
        tableData[`Net Available Headcount Above 3 Months_${dKey}`] = String(netAvailableAbove3Months);
        tableData[`Absent_${dKey}`] = String(absent);

        if (dKey > todayYMD) {
            tableData[`Absenteeism %_${dKey}`] = "0.00";
        } else {
            const globalAbsPercent = (totalPA > 0) ? (absent / totalPA) * 100 : 0;
            tableData[`Absenteeism %_${dKey}`] = globalAbsPercent.toFixed(2);
        }
    }

    // Shift-wise breakdown: driven by ACTUAL attendance_logs presence, not the scheduled roster.
    // Available_* must match "Net Available Headcount Total" (getMappedPresentCount) exactly, so
    // it's computed with the same in-memory roster (allEligibleUsers) and the same two rules —
    // payCode-matched-to-empId AND statusHistory-active-on-dKey (getUserActiveStintOnDate) —
    // instead of a separate SQL query that only checked isEmployee/eligibility via a plain JOIN
    // (no active-stint or payCode/empId verification), which let inactive/mismatched users
    // inflate the shift totals above the headcount total. Assigned_* is the subset of those
    // present employees who also have a station assigned in the database. Attendance_* is
    // Assigned / Available * 100.
    const shiftsList = ['A-Shift', 'G-Shift', 'B-Shift', 'C-Shift'];
    const shiftMap = { 'A': 'A-Shift', 'G': 'G-Shift', 'B': 'B-Shift', 'C': 'C-Shift' };

    const getShiftBreakdownForDate = (dKey) => {
        const punchesForDay = punchesByDate[dKey] || [];
        const presentEmpShiftMap = new Map();
        punchesForDay.forEach(p => {
            const status = String(p.status || '').trim().toUpperCase();
            if (status === 'P' || status === 'PRESENT') {
                const payCodeClean = String(p.payCode || '').trim().toUpperCase();
                if (payCodeClean) {
                    const shiftRaw = String(p.shift || '').trim().toUpperCase();
                    const shiftKey = Object.keys(shiftMap).find(k => shiftRaw.includes(k));
                    if (shiftKey) {
                        presentEmpShiftMap.set(payCodeClean, shiftMap[shiftKey]);
                    }
                }
            }
        });

        const availableByShift = {};
        const assignedByShift = {};
        shiftsList.forEach(s => { availableByShift[s] = 0; assignedByShift[s] = 0; });
        let availableTotal = 0;
        let assignedTotal = 0;

        allEligibleUsers.forEach(u => {
            const empIdClean = String(u.empId || '').trim().toUpperCase();
            if (!empIdClean || !presentEmpShiftMap.has(empIdClean)) return;
            if (!getUserActiveStintOnDate(u, dKey).active) return;

            const shiftName = presentEmpShiftMap.get(empIdClean);
            availableByShift[shiftName]++;
            availableTotal++;

            const stationsClean = (u.stations !== null && u.stations !== undefined) ? String(u.stations).trim() : '';
            const hasStation = (u.stationId !== null && u.stationId !== undefined && u.stationId !== '')
                || (stationsClean !== '' && stationsClean !== '[]' && stationsClean.toUpperCase() !== 'NULL');
            if (hasStation) {
                assignedByShift[shiftName]++;
                assignedTotal++;
            }
        });

        return { availableByShift, assignedByShift, availableTotal, assignedTotal };
    };

    const populateShiftTableData = (dKey) => {
        const isFuture = dKey > todayYMD;
        const { availableByShift, assignedByShift, availableTotal, assignedTotal } = getShiftBreakdownForDate(dKey);

        shiftsList.forEach(s => {
            const available = availableByShift[s] || 0;
            const assigned = assignedByShift[s] || 0;
            tableData[`Available_${s}_${dKey}`] = String(available);
            tableData[`Assigned_${s}_${dKey}`] = isFuture ? "0" : String(assigned);
            tableData[`Attendance_${s}_${dKey}`] = isFuture
                ? "0.00"
                : (available > 0 ? ((assigned / available) * 100).toFixed(2) : "0.00");
        });

        tableData[`Available_Total_${dKey}`] = String(availableTotal);
        tableData[`Assigned_Total_${dKey}`] = isFuture ? "0" : String(assignedTotal);
        tableData[`Attendance_Total_${dKey}`] = isFuture
            ? "0.00"
            : (availableTotal > 0 ? ((assignedTotal / availableTotal) * 100).toFixed(2) : "0.00");
    };

    populateShiftTableData(prevMonthLastDateKey);
    for (let d = 1; d <= totalDays; d++) {
        const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        populateShiftTableData(dKey);
    }

    // 3. Dynamic Club Headcount rows
    // Keyed by club.id so the leading previous-month reference column (populated further
    // below, outside this loop) can reuse each club's absent map.
    const clubAbsentMapByClubId = {};
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
                SUM(CASE WHEN UPPER(ISNULL(al.[status], '')) = 'PRESENT' AND ISNULL(u.isAdmin, 0) = 0 THEN 1 ELSE 0 END) AS presentCount,
                SUM(CASE WHEN UPPER(ISNULL(al.[status], '')) IN ('ABSENT', 'A') AND ISNULL(u.isAdmin, 0) = 0 THEN 1 ELSE 0 END) AS absentCount
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
        const [clubDailyData] = await executeQuery(clubDailySql, [prevMonthLastDateKey, end, ...sectionIds]);

        const clubPresentMap = {};
        clubDailyData.forEach(row => {
            if (row.dateKey) clubPresentMap[row.dateKey] = row;
        });
        clubAbsentMapByClubId[club.id] = clubPresentMap;

        const normalizedSectionIds = sectionIds.map(String);

        for (let d = 1; d <= totalDays; d++) {
            const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dDate = new Date(dKey);
            const row = clubPresentMap[dKey] || {};

            const activeInClub = allEligibleUsers.filter(u =>
                normalizedSectionIds.includes(String(u.sectionId)) && isRosterActiveOnDate(u, dDate)
            ).length;

            // Same attendance_logs-direct rule as the global Absent row above.
            const absent = (dKey <= todayYMD) ? (row.absentCount || 0) : 0;
            // totalPA (roster/activeInClub-based) is kept as-is for Absenteeism % below — only the
            // "Total Headcount (Present + Absent)" row switches to attendance_logs, 0 on future dates.
            const totalPA = activeInClub;
            const clubTotalHeadcountPresentAbsent = (dKey <= todayYMD)
                ? (row.presentCount || 0) + (row.absentCount || 0)
                : 0;

            const { countTotal: clubNetAvailableTotal, countAbove3Months: clubCountAbove3 } =
                getNetAvailableHeadcount(dKey, dDate, normalizedSectionIds);

            // Swapped: "Headcount available" now shows the on-roll roster count (formerly held
            // by Net Available Headcount Total), matching the global-row swap above.
            tableData[`${clubName} Headcount available_${dKey}`] = String(clubNetAvailableTotal);
            tableData[`${clubName} absent_${dKey}`] = String(absent);
            tableData[`${clubName} Total Headcount (Present + Absent)_${dKey}`] = String(clubTotalHeadcountPresentAbsent);
            tableData[`${clubName} Net Available Headcount Above 3 Months_${dKey}`] = String(clubCountAbove3);

            if (dKey > todayYMD) {
                tableData[`${clubName} Absenteeism %_${dKey}`] = "0.00";
            } else {
                const clubAbsPercent = (totalPA > 0) ? (absent / totalPA) * 100 : 0;
                tableData[`${clubName} Absenteeism %_${dKey}`] = clubAbsPercent.toFixed(2);
            }
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
    // Requires the user's CURRENT status = 'LEFT' — a user who was LEFT and has since been
    // reverted back to PRESENT (which clears leavingDate on that path, see user.controller.js)
    // no longer matches here. That's fine for "today"/future recomputation, but it means a past
    // date's already-recorded Left in nos (Daily) must be frozen below rather than re-derived
    // from this live snapshot, or the correction would silently erase that day's history.
    const leftSql = `
        SELECT id, empId as payCode, idCard as cardNo, fullName as employeeName, departmentId, sectionId, shift, isTemporary,
               CONVERT(VARCHAR, COALESCE(leavingDate, updatedAt), 23) as dateKey
        FROM users u
        WHERE TRIM(LOWER(status)) = 'left'
          AND COALESCE(leavingDate, updatedAt) >= ? AND COALESCE(leavingDate, updatedAt) < ?
          AND (u.[isEmployee] = 1 OR u.[isTemporary] = 1)
          AND (u.[isDeleted] = 0 OR u.[isDeleted] IS NULL)
          AND (u.[designation] IS NULL OR u.[designation] = '' OR ${getDesignationShutterExclusionCondition("u")})
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

        // Freeze Left in nos (Daily) once a past date already has a recorded value: a later
        // status correction (e.g. LEFT -> PRESENT) must only affect today's/future recomputation,
        // not silently rewrite a day that's already been reported.
        const priorLeftCount = tableData[`Left in nos (Daily)_${dKey}`];
        const hasPriorLeftCount = priorLeftCount !== undefined && priorLeftCount !== null;
        const dayLeftCount = (dKey < todayYMD && hasPriorLeftCount)
            ? Number(priorLeftCount) || 0
            : leftUsers.filter(l => l.dateKey === dKey && !l.isTemporary).length;

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
    // (prevMonthLastDateObj/prevMonthLastDateKey are hoisted at the top of this function).
    visibleRequirementDates.push({
        dateKey: prevMonthLastDateKey,
        day: prevMonthLastDateObj.getDate(),
        monthNumber: prevMonthLastDateObj.getMonth() + 1,
        year: prevMonthLastDateObj.getFullYear()
    });

    // Headcount available (and per-club Headcount available) for this leading reference
    // column — attendanceLogs/punchesByDate above already include prevMonthLastDateKey in
    // their query range, and getNetAvailableHeadcount/getMappedPresentCount are date-driven so
    // no separate range concern applies.
    const { countTotal: prevMonthNetTotal, countAbove3Months: prevMonthNetAbove3 } =
        getNetAvailableHeadcount(prevMonthLastDateKey, prevMonthLastDateObj);

    // Swapped, matching the daily-loop swap above: "Headcount available" shows the roster
    // count, "Net Available Headcount Total" shows the attendance-present count.
    tableData[`Headcount available_${prevMonthLastDateKey}`] = String(prevMonthNetTotal);
    const prevMonthPresent = (prevMonthLastDateKey <= todayYMD) ? getMappedPresentCount(prevMonthLastDateKey) : 0;
    tableData[`Net Available Headcount Total_${prevMonthLastDateKey}`] = prevMonthPresent;
    tableData[`Net Available Headcount Above 3 Months_${prevMonthLastDateKey}`] = String(prevMonthNetAbove3);

    // Absent / Total Headcount / Absenteeism % for the leading reference column, matching the
    // daily-loop subtraction method (Roster - Present, suppressed to 0 on declared holidays).
    if (prevMonthLastDateKey > todayYMD) {
        tableData[`Absent_${prevMonthLastDateKey}`] = "0";
        tableData[`Total Headcount (Present + Absent)_${prevMonthLastDateKey}`] = 0;
        tableData[`Absenteeism %_${prevMonthLastDateKey}`] = "0.00";
    } else {
        const prevMonthIsHoliday = holidaySet.has(prevMonthLastDateKey);
        const prevMonthAbsent = prevMonthIsHoliday ? 0 : Math.max(prevMonthNetTotal - prevMonthPresent, 0);
        // Roster-based, kept only for the Absenteeism % denominator below (unchanged rule).
        const prevMonthActiveCount = allEligibleUsers.filter(u => isRosterActiveOnDate(u, prevMonthLastDateObj)).length;
        const prevMonthAbsPercent = (prevMonthActiveCount > 0) ? (prevMonthAbsent / prevMonthActiveCount) * 100 : 0;
        const prevMonthTotalHeadcountPresentAbsent = prevMonthPresent + prevMonthAbsent;

        tableData[`Absent_${prevMonthLastDateKey}`] = String(prevMonthAbsent);
        tableData[`Total Headcount (Present + Absent)_${prevMonthLastDateKey}`] = prevMonthTotalHeadcountPresentAbsent;
        tableData[`Absenteeism %_${prevMonthLastDateKey}`] = prevMonthAbsPercent.toFixed(2);
    }

    reportingClubs.forEach(club => {
        let clubSectionIds = [];
        try {
            clubSectionIds = JSON.parse(club.sectionIds || "[]");
        } catch (e) {
            clubSectionIds = [];
        }
        const normalizedClubSectionIds = clubSectionIds.map(String);
        const { countTotal: clubPrevMonthNetTotal, countAbove3Months: clubPrevMonthAbove3 } =
            getNetAvailableHeadcount(prevMonthLastDateKey, prevMonthLastDateObj, normalizedClubSectionIds);

        // Swapped, matching the daily club-wise loop above.
        tableData[`${club.name} Headcount available_${prevMonthLastDateKey}`] = String(clubPrevMonthNetTotal);

        // Absent / Total Headcount / Absenteeism % for the leading reference column, scoped to
        // this club's sections.
        if (prevMonthLastDateKey > todayYMD) {
            tableData[`${club.name} absent_${prevMonthLastDateKey}`] = "0";
            tableData[`${club.name} Total Headcount (Present + Absent)_${prevMonthLastDateKey}`] = "0";
            tableData[`${club.name} Absenteeism %_${prevMonthLastDateKey}`] = "0.00";
        } else {
            const clubPrevMonthRow = clubAbsentMapByClubId[club.id]?.[prevMonthLastDateKey] || {};
            const clubPrevMonthAbsent = clubPrevMonthRow.absentCount || 0;
            // Roster-based, kept only for the Absenteeism % denominator below (unchanged rule).
            const clubPrevMonthActiveCount = allEligibleUsers.filter(u =>
                normalizedClubSectionIds.includes(String(u.sectionId)) && isRosterActiveOnDate(u, prevMonthLastDateObj)
            ).length;
            const clubPrevMonthAbsPercent = (clubPrevMonthActiveCount > 0)
                ? (clubPrevMonthAbsent / clubPrevMonthActiveCount) * 100
                : 0;
            const clubPrevMonthTotalHeadcountPresentAbsent = (clubPrevMonthRow.presentCount || 0) + clubPrevMonthAbsent;

            tableData[`${club.name} absent_${prevMonthLastDateKey}`] = String(clubPrevMonthAbsent);
            tableData[`${club.name} Total Headcount (Present + Absent)_${prevMonthLastDateKey}`] = String(clubPrevMonthTotalHeadcountPresentAbsent);
            tableData[`${club.name} Absenteeism %_${prevMonthLastDateKey}`] = clubPrevMonthAbsPercent.toFixed(2);
        }
        tableData[`${club.name} Net Available Headcount Above 3 Months_${prevMonthLastDateKey}`] = String(clubPrevMonthAbove3);
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
        // headcount now held by "Net Available Headcount Total" (post Headcount-available swap).
        // Shows 0 instead of a misleading number whenever: there's no requirement row for the
        // month, no attendance data for the day (e.g. the leading previous-month reference
        // column), or present is 0 (0 attendance minus a requirement should read as "no data to
        // size a gap from", not "hire the full requirement"). Otherwise capped at 0 so a
        // fully/over-staffed day doesn't show a negative hiring need.
        const presentRaw = tableData[`Net Available Headcount Total_${item.dateKey}`];
        const attendanceAvailable = presentRaw !== undefined && presentRaw !== null;
        const requirementAvailable = !!dashboardRequirementPlanEntry;
        const dayPresent = Number(presentRaw) || 0;

        tableData[`Hiring Plan_${item.dateKey}`] = (requirementAvailable && attendanceAvailable && dayPresent > 0)
            ? Math.max(0, productionPlanRequirement - dayPresent)
            : 0;

        tableData[`Rejoining_${item.dateKey}`] = rejoiningUsersByDate[item.dateKey]?.size || 0;

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
