import { asyncHandler } from '../utils/asyncHandler.js';
import NotificationService from '../services/notification.service.js';
import { initializeEmailReportScheduler } from '../services/report.service.js';
import { executeQuery } from '../db/mssqlHelper.js';
import ExcelJS from 'exceljs';
import HeadcountReport from '../models/headcountReport.model.js';
import UserHierarchySnapshot from '../models/userHierarchySnapshot.model.js';
import Mail from '../models/mail.model.js';
import headcountReportScheduler from '../services/headcountReportScheduler.js';
import logAudit from '../utils/auditLogger.js';
import { getEligibleUserSql, getDesignationShutterLeftJoinSql, getEligibleUserConditionViaJoin } from '../utils/userEligibility.js';

/**
 * Controller to handle manual Excel report exports for configured sheets.
 */
export const exportFormReport = asyncHandler(async (req, res) => {
    const { formName } = req.params;
    const { id, departmentId, studentId, sectionId, date, month, year } = req.query;

    if (!formName) {
        return res.status(400).json({ success: false, message: "Form name is required" });
    }

    let formData = {};
    let resolvedDeptId = departmentId;

    // 1. Fetch data based on formName and ID
    switch (formName) {
        case "Multi Skill Sheet":
            const [msRows] = await executeQuery(`SELECT * FROM multi_skilling_plans WHERE departmentId = ?`, [departmentId]);
            if (msRows.length > 0) {
                formData = {
                    selectedLines: JSON.parse(msRows[0].selectedLines || "[]"),
                    tableData: JSON.parse(msRows[0].tableData || "{}")
                };
            }
            break;

        case "Skill Upgradation Sheet":
            const [suRows] = await executeQuery(`SELECT * FROM skill_upgradation_plans WHERE departmentId = ?`, [departmentId]);
            if (suRows.length > 0) {
                formData = {
                    selectedLines: JSON.parse(suRows[0].selectedLines || "[]"),
                    tableData: JSON.parse(suRows[0].tableData || "{}")
                };
            }
            break;

        case "Handover Sheet": {
            let hsQuery = `SELECT * FROM handover_sheets WHERE departmentId = ?`;
            const hsParams = [departmentId];
            if (sectionId) {
                hsQuery += ` AND sectionId = ?`;
                hsParams.push(sectionId);
            }
            if (date) {
                hsQuery += ` AND [date] = ?`;
                hsParams.push(date);
            }
            const [hoRows] = await executeQuery(hsQuery, hsParams);
            if (hoRows.length > 0) {
                formData = {
                    date: hoRows[0].date,
                    entries: JSON.parse(hoRows[0].entries || "[]"),
                    signatures: JSON.parse(hoRows[0].signatures || "{}"),
                    metadata: JSON.parse(hoRows[0].metadata || "{}")
                };
            }
            break;
        }

        case "On Job Training Record Sheet":
        case "On Job Training Evaluation Sheet":
            const [ojtRows] = await executeQuery(`
                SELECT ojt.*, uc.fullName as creatorName
                FROM on_job_trainings ojt
                LEFT JOIN users uc ON CAST(ojt.createdBy AS VARCHAR(255)) = CAST(uc.id AS VARCHAR(255)) OR ojt.createdBy = uc.userName
                WHERE ojt.id = ?
            `, [id]);
            if (ojtRows.length > 0) {
                formData = {
                    ...ojtRows[0],
                    attendanceRecords: JSON.parse(ojtRows[0].attendanceRecords || "[]"),
                    entries: JSON.parse(ojtRows[0].entries || "[]"),
                    trainingLog: JSON.parse(ojtRows[0].trainingLog || "[]")
                };
                resolvedDeptId = ojtRows[0].departmentId;
            }
            break;

        case "Operator Observance Check Sheet":
            const [ooRows] = await executeQuery(`SELECT * FROM operator_observances WHERE studentId = ?`, [id]);
            if (ooRows.length > 0) {
                formData = {
                    ...ooRows[0],
                    observanceData: JSON.parse(ooRows[0].observanceData || "{}")
                };
            }
            logAudit(req.user?.id, "EXPORT_OPERATOR_OBSERVANCE_SHEET",
                { studentId: id },
                { resourceType: "OperatorObservance", resourceId: id, req }
            ).catch(err => console.error("logAudit(EXPORT_OPERATOR_OBSERVANCE_SHEET) failed:", err.message));
            break;

        case "3-Day Monitoring Sheet":
            const [tdRows] = await executeQuery(`SELECT * FROM three_day_monitoring WHERE studentId = ?`, [studentId]);
            if (tdRows.length > 0) {
                formData = {
                    ...tdRows[0],
                    entries: JSON.parse(tdRows[0].entries || "{}")
                };
            }
            break;

        case "16-Day Monitoring Sheet":
            const [sdRows] = await executeQuery(`SELECT * FROM sixteen_day_monitoring WHERE studentId = ?`, [studentId]);
            if (sdRows.length > 0) {
                formData = {
                    ...sdRows[0],
                    monitoringData: JSON.parse(sdRows[0].monitoringData || "{}")
                };
            }
            break;

        case "10-Cycle Check Sheet":
            const [tcRows] = await executeQuery(`SELECT * FROM ten_cycle_checks WHERE id = ?`, [id]);
            if (tcRows.length > 0) {
                formData = {
                    ...tcRows[0],
                    cycles: JSON.parse(tcRows[0].cycles || "[]")
                };
            }
            break;

        case "Skill Matrix Sheet":
            const [smRows] = await executeQuery(`SELECT * FROM skill_matrix WHERE departmentId = ?`, [departmentId]);
            if (smRows.length > 0) {
                formData = {
                    ...smRows[0],
                    matrixData: JSON.parse(smRows[0].matrixData || "{}")
                };
            }
            break;

        case "Daily Production Report Sheet":
            const [dprRows] = await executeQuery(`SELECT * FROM daily_production_reports WHERE id = ?`, [id]);
            if (dprRows.length > 0) {
                formData = {
                    ...dprRows[0],
                    productionData: JSON.parse(dprRows[0].productionData || "{}")
                };
            }
            break;

        case "Daily 5M Recording Sheet":
            const [m5Rows] = await executeQuery(`SELECT * FROM daily_5m_records WHERE id = ?`, [id]);
            if (m5Rows.length > 0) {
                formData = {
                    ...m5Rows[0],
                    recordData: JSON.parse(m5Rows[0].recordData || "{}")
                };
                resolvedDeptId = m5Rows[0].departmentId || resolvedDeptId;
            }
            break;

        case "Skill Matrix Certificate Sheet":
            formData = { studentId, ...req.query };
            break;

        case "Associates Headcount Report": {
            const hcDeptId = departmentId || 0;
            let useMonth = month ? Number(month) : null;
            let useYear = year ? Number(year) : null;
            // The frontend's "Export" button (exportHelper.js) sends `date` instead of month/year
            if ((!useMonth || !useYear) && date) {
                const parsedDate = new Date(date);
                if (!isNaN(parsedDate)) {
                    useMonth = useMonth || (parsedDate.getMonth() + 1);
                    useYear = useYear || parsedDate.getFullYear();
                }
            }
            if (!useMonth || !useYear) {
                const now = new Date();
                useMonth = useMonth || (now.getMonth() + 1);
                useYear = useYear || now.getFullYear();
            }
            const report = await HeadcountReport.findOne({ departmentId: hcDeptId, month: useMonth, year: useYear });
            formData = {
                tableData: report?.tableData || {},
                month: useMonth,
                year: useYear,
                date: new Date(useYear, useMonth - 1, 1).toISOString().split('T')[0]
            };
            resolvedDeptId = hcDeptId;
            break;
        }

        default:
            return res.status(404).json({ success: false, message: "Report format not found" });
    }

    const workbook = new ExcelJS.Workbook();
    const filename = await NotificationService._generateExcel(workbook, formName, resolvedDeptId, formData);
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(Buffer.from(buffer));
});

/**
 * Save headcount report data
 */
export const saveHeadcountReport = asyncHandler(async (req, res) => {
    const { departmentId, month, year, tableData } = req.body;
    const resolvedDeptId = departmentId || 0;

    if (!month || !year) {
        return res.status(400).json({ success: false, message: "month and year are required" });
    }

    const reportId = await HeadcountReport.createOrUpdate({
        departmentId: resolvedDeptId,
        month,
        year,
        tableData
    });

    // Trigger Email Notification
    const reportDate = new Date(year, month - 1, 1);
    NotificationService.sendFormReport("Associates Headcount Report", null, {
        tableData,
        month,
        year,
        date: reportDate.toISOString().split('T')[0]
    })
        .then(sent => {
            if (sent) return HeadcountReport.updateLastEmailSentAt(reportId);
        })
        .catch(err => console.error("[Headcount] Notification failed:", err));

    res.status(200).json({
        success: true,
        message: "Headcount report saved successfully",
        data: { reportId }
    });
});

/**
 * Get headcount report data
 */
export const getHeadcountReport = asyncHandler(async (req, res) => {
    const { departmentId, month, year } = req.query;
    const resolvedDeptId = departmentId || 0;

    if (!month || !year) {
        return res.status(400).json({ success: false, message: "month and year are required" });
    }

    const report = await HeadcountReport.findOne({
        departmentId: resolvedDeptId,
        month,
        year
    });

    res.status(200).json({
        success: true,
        data: report || { tableData: {} }
    });
});

/**
 * Sync headcount data from real sources (Attendance, User logs, Requirements)
 */
export const syncHeadcountData = asyncHandler(async (req, res) => {
    const { departmentId, month, year } = req.query;

    if (!month || !year) {
        return res.status(400).json({ success: false, message: "month and year are required" });
    }

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
    // Hiring Plan keeps its existing logic unchanged.
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

    // Existing map is retained for Hiring Plan only so its old logic remains untouched.
    let requirementPlanMap = {};

    // Dashboard-aligned map is used ONLY for the two requirement rows requested above.
    let dashboardRequirementPlanMap = {};

    // Per-club version of dashboardRequirementPlanMap, scoped to each club's sectionIds,
    // used for the `${club.name} Headcount required` rows below.
    const clubDashboardRequirementPlanMap = {};
    reportingClubs.forEach(club => { clubDashboardRequirementPlanMap[club.id] = {}; });

    if (uniqueRequirementMonths.length > 0) {
        const requirementWhereClause = uniqueRequirementMonths
            .map(() => `([year] = ? AND monthNumber = ?)`)
            .join(' OR ');

        const dashboardRequirementWhereClause = uniqueRequirementMonths
            .map(() => `(r.[year] = ? AND r.monthNumber = ?)`)
            .join(' OR ');

        const requirementParams = [];
        uniqueRequirementMonths.forEach(item => {
            requirementParams.push(item.year);
            requirementParams.push(item.monthNumber);
        });

        // Keep the original Hiring Plan source/logic exactly as it was.
        const [requirementRows] = await executeQuery(`
            SELECT
                [year],
                monthNumber,
                SUM(ISNULL(prodPlan, 0)) AS prodPlan
            FROM requirements
            WHERE ${requirementWhereClause}
              AND ISNULL(is_active, 1) = 1
            GROUP BY [year], monthNumber
        `, requirementParams);

        requirementRows.forEach(row => {
            const key = `${row.year}-${row.monthNumber}`;
            requirementPlanMap[key] = {
                prodPlan: Number(row.prodPlan || 0)
            };
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
                    UPPER(LTRIM(RTRIM(CAST(r.sectionCode AS NVARCHAR(510))))) = UPPER(LTRIM(RTRIM(CAST(s.uniCode AS NVARCHAR(510)))))
                    OR UPPER(LTRIM(RTRIM(CAST(r.sectionName AS NVARCHAR(510))))) = UPPER(LTRIM(RTRIM(CAST(s.name AS NVARCHAR(510)))))
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
                        UPPER(LTRIM(RTRIM(CAST(r.sectionCode AS NVARCHAR(510))))) = UPPER(LTRIM(RTRIM(CAST(s.uniCode AS NVARCHAR(510)))))
                        OR UPPER(LTRIM(RTRIM(CAST(r.sectionName AS NVARCHAR(510))))) = UPPER(LTRIM(RTRIM(CAST(s.name AS NVARCHAR(510)))))
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

        // Used ONLY for Hiring Plan — existing logic unchanged.
        const hiringPlan = requirementPlanMap[planKey] || {
            prodPlan: 0
        };

        // Used ONLY for the two requested requirement rows.
        const dashboardRequirementPlan = dashboardRequirementPlanMap[planKey] || {
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

        // Do not change Hiring Plan.
        tableData[`Hiring Plan_${item.dateKey}`] = hiringPlan.prodPlan;

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

    res.status(200).json({ success: true, data: { tableData } });
});

/**
 * Sync User Hierarchy Snapshot data from real sources
 */
export const syncUserHierarchySnapshot = asyncHandler(async (req, res) => {
    const result = await UserHierarchySnapshot.syncFromUsers();
    res.status(200).json(result);
});

/**
 * Get User Hierarchy Snapshot data
 */
export const getUserHierarchySnapshot = asyncHandler(async (req, res) => {
    const data = await UserHierarchySnapshot.getAll();
    res.status(200).json({
        success: true,
        data
    });
});


// ============================================================
// EMAIL REPORT SEND-TIME SETTINGS
// Admin can independently choose the automatic send time for:
// 1) Daily Manpower Report
// 2) Management Daily Report
//
// The settings are stored separately from recipient rows so the
// existing Mail model / recipient CRUD behavior remains unchanged.
// ============================================================
const ensureEmailReportScheduleTable = async () => {
    await executeQuery(`
        IF OBJECT_ID('dbo.email_report_schedule_settings', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.email_report_schedule_settings (
                id INT NOT NULL PRIMARY KEY,
                dailyTime NVARCHAR(5) NULL,
                managementDailyTime NVARCHAR(5) NULL,
                monthlyTime NVARCHAR(5) NULL,
                updatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
            )
        END
    `, []);

    await executeQuery(`
        IF NOT EXISTS (
            SELECT 1
            FROM sys.columns
            WHERE object_id = OBJECT_ID('dbo.email_report_schedule_settings')
              AND name = 'monthlyTime'
        )
        BEGIN
            ALTER TABLE dbo.email_report_schedule_settings ADD monthlyTime NVARCHAR(5) NULL
        END
    `, []);

    await executeQuery(`
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.email_report_schedule_settings
            WHERE id = 1
        )
        BEGIN
            INSERT INTO dbo.email_report_schedule_settings (
                id,
                dailyTime,
                managementDailyTime,
                monthlyTime
            )
            VALUES (1, NULL, NULL, NULL)
        END
    `, []);
};

const normalizeReportTime = (value) => {
    const time = String(value || '').trim();

    if (!time) return null;

    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
        throw new Error("Invalid report time. Expected HH:mm in 24-hour format.");
    }

    return time;
};

const getEmailReportScheduleSettings = async () => {
    await ensureEmailReportScheduleTable();

    const [rows] = await executeQuery(`
        SELECT
            dailyTime,
            managementDailyTime,
            monthlyTime
        FROM dbo.email_report_schedule_settings
        WHERE id = 1
    `, []);

    return {
        dailyTime: String(rows?.[0]?.dailyTime || '').trim(),
        managementDailyTime: String(rows?.[0]?.managementDailyTime || '').trim(),
        monthlyTime: String(rows?.[0]?.monthlyTime || '').trim(),
        timezone: 'Asia/Kolkata'
    };
};

const updateEmailReportScheduleSettings = async (settings = {}) => {
    const {
        dailyTime,
        managementDailyTime,
        monthlyTime
    } = settings;

    await ensureEmailReportScheduleTable();

    // Separate save buttons send only one field at a time.
    // Preserve the other saved time instead of accidentally overwriting it with NULL.
    const currentSchedule = await getEmailReportScheduleSettings();

    const hasDailyTime =
        Object.prototype.hasOwnProperty.call(settings, 'dailyTime');

    const hasManagementDailyTime =
        Object.prototype.hasOwnProperty.call(settings, 'managementDailyTime');

    const hasMonthlyTime =
        Object.prototype.hasOwnProperty.call(settings, 'monthlyTime');

    const normalizedDailyTime = hasDailyTime
        ? normalizeReportTime(dailyTime)
        : normalizeReportTime(currentSchedule.dailyTime);

    const normalizedManagementDailyTime = hasManagementDailyTime
        ? normalizeReportTime(managementDailyTime)
        : normalizeReportTime(currentSchedule.managementDailyTime);

    const normalizedMonthlyTime = hasMonthlyTime
        ? normalizeReportTime(monthlyTime)
        : normalizeReportTime(currentSchedule.monthlyTime);

    await executeQuery(`
        UPDATE dbo.email_report_schedule_settings
        SET
            dailyTime = ?,
            managementDailyTime = ?,
            monthlyTime = ?,
            updatedAt = GETDATE()
        WHERE id = 1
    `, [
        normalizedDailyTime,
        normalizedManagementDailyTime,
        normalizedMonthlyTime
    ]);

    return getEmailReportScheduleSettings();
};

// Start the automatic scheduler once when this controller module is loaded.
// The service owns the timer; controller only supplies schedule + recipient data.
initializeEmailReportScheduler({
    getSchedule: getEmailReportScheduleSettings,
    getRecipients: async () => Mail.findAll()
});

/**
 * ==========================================
 * Email Report CRUD Operations
 * ==========================================
 */

/**
 * Get all configured email reports
 */
export const getMails = asyncHandler(async (req, res) => {
    const mails = await Mail.findAll();

    const mapped = mails.map(m => {
        let freqs = [];
        if (m.isDailyReport) freqs.push('Daily');
        if (m.isManagementDailyReport) freqs.push('Management Daily');
        if (m.isMonthlyReport) freqs.push('Monthly');

        const frequencyStr = freqs.join(', ') || 'Daily';
        const reportTypesArr = m.reportTypes ? m.reportTypes.split(', ') : ['Manpower'];

        return {
            id: m.id,
            email: m.email,
            frequency: frequencyStr,
            reportTypes: reportTypesArr,
            toEmails: m.email,
            ccEmails: null,
            formName: reportTypesArr[0] || 'Manpower Report',
            departmentId: null,
            isActive: true,
            includeTrainer: false,
        };
    });

    const schedule = await getEmailReportScheduleSettings();

    res.status(200).json({
        success: true,
        data: mapped,
        schedule
    });
});

/**
 * Create a new email report config
 */
export const createMail = asyncHandler(async (req, res) => {
    try {
        console.log("[DEBUG] createMail Payload received:", req.body);

        // Reuse the existing POST /api/reports/recipients endpoint for schedule settings
        // so no route-file change is required.
        if (String(req.body?.action || '').trim().toLowerCase() === 'updateschedule') {
            // Separate save buttons send only one schedule field at a time.
            // IMPORTANT: build the payload only with fields that were actually sent.
            // Passing a missing field as `undefined` would make hasOwnProperty() true
            // inside updateEmailReportScheduleSettings() and could overwrite the
            // other saved schedule with NULL.
            const schedulePayload = {};

            if (Object.prototype.hasOwnProperty.call(req.body || {}, 'dailyTime')) {
                schedulePayload.dailyTime = req.body.dailyTime;
            }

            if (Object.prototype.hasOwnProperty.call(req.body || {}, 'managementDailyTime')) {
                schedulePayload.managementDailyTime = req.body.managementDailyTime;
            }

            if (Object.prototype.hasOwnProperty.call(req.body || {}, 'monthlyTime')) {
                schedulePayload.monthlyTime = req.body.monthlyTime;
            }

            const schedule = await updateEmailReportScheduleSettings(schedulePayload);

            return res.status(200).json({
                success: true,
                data: schedule,
                schedule,
                message: "Email report send time updated successfully"
            });
        }

        const email = req.body.email || req.body.toEmails || null;
        const { frequency, reportTypes, formName } = req.body;

        if (!email) {
            console.log("[DEBUG] createMail: Missing email");
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const freqArr = Array.isArray(frequency)
            ? frequency.map(f => String(f).trim().toLowerCase())
            : (typeof frequency === 'string'
                ? frequency.split(',').map(f => f.trim().toLowerCase())
                : ['daily']);

        const isDailyReport = freqArr.includes('daily');
        const isManagementDailyReport = freqArr.includes('management daily') || freqArr.includes('managementdaily');
        const isMonthlyReport = freqArr.includes('monthly');

        const typesStr = Array.isArray(reportTypes)
            ? reportTypes.join(', ')
            : (reportTypes || formName || "Manpower");

        const newMail = await Mail.create({
            email,
            isDailyReport,
            isManagementDailyReport,
            isMonthlyReport,
            reportTypes: typesStr
        });

        res.status(201).json({
            success: true,
            data: newMail,
            message: "Recipient added successfully"
        });
    } catch (err) {
        console.error("[DEBUG] createMail ERROR CAUGHT:", err);
        res.status(400).json({
            success: false,
            message: err.message || "Failed to create email record"
        });
    }
});

/**
 * Delete an email report config
 */
export const deleteMail = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await Mail.delete(id);
    res.status(200).json({ success: true, message: "Recipient deleted successfully" });
});

/**
 * Trigger manual report sending
 */
export const triggerManualReport = asyncHandler(async (req, res) => {
    const mails = await Mail.findAll();

    if (mails.length === 0) {
        return res.status(200).json({
            success: true,
            data: { recipientCount: 0 },
            message: "No recipients configured"
        });
    }

    // Split on comma/semicolon in case a recipient row holds more than one address,
    // then trim and dedupe so Nodemailer never receives a malformed `to` entry.
    const emailList = [...new Set(
        mails
            .flatMap(m => String(m.email || '').split(/[,;]/))
            .map(email => email.trim())
            .filter(Boolean)
    )];

    if (emailList.length === 0) {
        return res.status(400).json({
            success: false,
            message: "No valid recipient email addresses configured."
        });
    }

    try {
        const { sendBothReports } = await import('../services/report.service.js');

        await sendBothReports(emailList);

        // Also (best-effort) force-send the Monthly Associates Headcount Report to its own
        // subscriber list, same as the dedicated "Resend Email" button on /admin/report.
        // This is independent of sendBothReports above — it must not fail the Daily/Management
        // response if there's simply no saved headcount data yet or no Monthly recipients.
        let headcountResult = null;
        try {
            headcountResult = await headcountReportScheduler.runNow();
        } catch (hcErr) {
            console.error("[Report Controller] Monthly headcount report send failed:", hcErr);
        }

        const messageParts = [`Combined Excel reports sent to ${emailList.length} recipients successfully.`];
        if (headcountResult?.sent) {
            messageParts.push("Monthly Headcount Report sent successfully.");
        } else if (headcountResult?.message) {
            messageParts.push(`Monthly Headcount Report: ${headcountResult.message}`);
        }

        res.status(200).json({
            success: true,
            data: { recipientCount: emailList.length, sent: emailList.length, failed: 0, headcountReport: headcountResult },
            message: messageParts.join(' ')
        });
    } catch (err) {
        console.error("[Report Controller] Failed to trigger manual report:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Failed to generate and send Excel report.",
            error: err.message
        });
    }
});

/**
 * Trigger a manual (forced) send of the current month's Associates Headcount Report,
 * ignoring the configured scheduledTime and the same-day dedup check.
 */
export const sendHeadcountReportManually = asyncHandler(async (req, res) => {
    const result = await headcountReportScheduler.runNow();
    res.status(result.ok ? 200 : 500).json({
        success: result.ok,
        message: result.message,
        data: { month: result.month, year: result.year, sent: result.sent }
    });
});

