import { asyncHandler } from '../utils/asyncHandler.js';
import NotificationService from '../services/notification.service.js';
import { executeQuery } from '../db/mssqlHelper.js';
import ExcelJS from 'exceljs';
import HeadcountReport from '../models/headcountReport.model.js';
import UserHierarchySnapshot from '../models/userHierarchySnapshot.model.js';
import Mail from '../models/mail.model.js';
import logAudit from '../utils/auditLogger.js';
import { getEligibleUserSql, getDesignationShutterLeftJoinSql, getEligibleUserConditionViaJoin } from '../utils/userEligibility.js';

/**
 * Controller to handle manual Excel report exports for configured sheets.
 */
export const exportFormReport = asyncHandler(async (req, res) => {
    const { formName } = req.params;
    const { id, departmentId, studentId, sectionId, date } = req.query;

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
    }).catch(err => console.error("[Headcount] Notification failed:", err));

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
        SELECT id, sectionId, joiningDate, leavingDate, updatedAt, status, isTemporary
        FROM users u
        WHERE u.isEmployee = 1
        ${getEligibleUserSql('u')}
    `);

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
    // who is currently temporary OR was ever a Dojo hire (expectedHandover IS NOT NULL), and use
    // updatedAt as the handover-date proxy for those who've since been promoted out.
    const [allDojoUsers] = await executeQuery(`
        SELECT u.id, u.joiningDate, u.leavingDate, u.updatedAt, u.status, u.isTemporary
        FROM users u
        ${getDesignationShutterLeftJoinSql('u', 'ds')}
        WHERE (u.[expectedHandover] IS NOT NULL OR u.[isTemporary] = 1)
          AND (u.[isDeleted] = 0 OR u.[isDeleted] IS NULL)
          AND ds.[designation] IS NULL
    `);

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
            const join = u.joiningDate ? new Date(u.joiningDate) : null;
            if (join && join > dDate) return false;
            if (u.status?.toLowerCase() === 'left') {
                const left = new Date(u.leavingDate || u.updatedAt);
                if (left <= dDate) return false;
            }
            // Already promoted out of the Dojo before this date (isTemporary is now 0);
            // updatedAt is used as the handover-date proxy, per the note above.
            if (!u.isTemporary) {
                const promoted = u.updatedAt ? new Date(u.updatedAt) : null;
                if (promoted && promoted <= dDate) return false;
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

    // Initialize all shift keys with "0"
    const shiftsList = ['A-Shift', 'G-Shift', 'B-Shift', 'C-Shift'];
    for (let d = 1; d <= totalDays; d++) {
        const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        shiftsList.forEach(s => {
            tableData[`Available_${s}_${dKey}`] = "0";
            tableData[`Assigned_${s}_${dKey}`] = "0";
            tableData[`Attendance_${s}_${dKey}`] = "0";
        });
        tableData[`Available_Total_${dKey}`] = "0";
        tableData[`Assigned_Total_${dKey}`] = "0";
        tableData[`Attendance_Total_${dKey}`] = "0";
    }

    // Shift-wise attendance. Filters are kept identical to totalPresentEmployees above
    // (eligibleEmployeeCondition/notYetLeftCondition) so Available_Total always matches
    // Net Available Headcount Total exactly. Also deduplicated per (userId, date) for the
    // same reason as netHeadcountSql/clubDailySql — a duplicate attendance_logs row on the
    // same date would otherwise inflate the shift count without inflating the employee count.
    const shiftAttendanceSql = `
        SELECT
            CONVERT(VARCHAR, al.[date], 23) AS dateKey,
            UPPER(ISNULL(al.shift, ISNULL(u.shift, ''))) AS userShift,
            COUNT(*) AS count
        FROM (
            SELECT userId, [date], MAX(status) AS status, MAX(shift) AS shift
            FROM attendance_logs
            WHERE [date] >= ? AND [date] <= ?
            GROUP BY userId, [date]
        ) al
        INNER JOIN users u ON u.id = al.userId
        ${getDesignationShutterLeftJoinSql('u', 'ds')}
        WHERE u.[isEmployee] = 1 AND ${eligibleEmployeeCondition} AND ${notYetLeftCondition}
          AND UPPER(ISNULL(al.[status], '')) = 'PRESENT'
        GROUP BY al.[date], UPPER(ISNULL(al.shift, ISNULL(u.shift, '')))
    `;
    const [shiftAttendanceData] = await executeQuery(shiftAttendanceSql, [start, end]);

    const shiftMap = { 'A': 'A-Shift', 'G': 'G-Shift', 'B': 'B-Shift', 'C': 'C-Shift' };
    shiftAttendanceData.forEach(row => {
        const { dateKey, userShift, count } = row;
        const shiftKey = Object.keys(shiftMap).find(k => userShift.includes(k));
        if (shiftKey) {
            const shiftName = shiftMap[shiftKey];
            tableData[`Available_${shiftName}_${dateKey}`] = String(count || 0);
            tableData[`Attendance_${shiftName}_${dateKey}`] = String(count || 0);

            tableData[`Available_Total_${dateKey}`] = String(Number(tableData[`Available_Total_${dateKey}`] || 0) + count);
            tableData[`Attendance_Total_${dateKey}`] = String(Number(tableData[`Attendance_Total_${dateKey}`] || 0) + count);
        }
    });

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
    // Headcount required as per production plan:
    // Day 1 to 15 = prodPlanFN01
    // Day 16 onward = prodPlanFN02
    // Headcount required as per sale plan = salesPlan
    // Hiring Plan = prodPlan
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

    let requirementPlanMap = {};

    if (uniqueRequirementMonths.length > 0) {
        const requirementWhereClause = uniqueRequirementMonths
            .map(() => `([year] = ? AND monthNumber = ?)`)
            .join(' OR ');

        const requirementParams = [];
        uniqueRequirementMonths.forEach(item => {
            requirementParams.push(item.year);
            requirementParams.push(item.monthNumber);
        });

        const [requirementRows] = await executeQuery(`
            SELECT
                [year],
                monthNumber,
                SUM(ISNULL(salesPlan, 0)) AS salesPlan,
                SUM(ISNULL(prodPlan, 0)) AS prodPlan,
                SUM(ISNULL(prodPlanFN01, 0)) AS prodPlanFN01,
                SUM(ISNULL(prodPlanFN02, 0)) AS prodPlanFN02
            FROM requirements
            WHERE ${requirementWhereClause}
              AND ISNULL(is_active, 1) = 1
            GROUP BY [year], monthNumber
        `, requirementParams);

        requirementRows.forEach(row => {
            const key = `${row.year}-${row.monthNumber}`;
            requirementPlanMap[key] = {
                salesPlan: Number(row.salesPlan || 0),
                prodPlan: Number(row.prodPlan || 0),
                prodPlanFN01: Number(row.prodPlanFN01 || 0),
                prodPlanFN02: Number(row.prodPlanFN02 || 0)
            };
        });
    }

    visibleRequirementDates.forEach(item => {
        const planKey = `${item.year}-${item.monthNumber}`;
        const plan = requirementPlanMap[planKey] || {
            salesPlan: 0,
            prodPlan: 0,
            prodPlanFN01: 0,
            prodPlanFN02: 0
        };

        const productionPlanRequirement = item.day <= 15
            ? plan.prodPlanFN01
            : plan.prodPlanFN02;

        tableData[`Headcount required as per production plan_${item.dateKey}`] = productionPlanRequirement;
        tableData[`Headcount required as per sale plan_${item.dateKey}`] = plan.salesPlan;
        tableData[`Hiring Plan_${item.dateKey}`] = plan.prodPlan;
    });

    // 8. Shift Manpower — same eligibility/dedup treatment as shiftAttendanceSql above, plus a
    // station-assignment check to distinguish "Assigned" (has a station) from "Available" (just
    // present). Date-aware via attendance_logs, not a static per-employee snapshot.
    const assignedManpowerSql = `
        SELECT
            CONVERT(VARCHAR, al.[date], 23) AS dateKey,
            UPPER(ISNULL(al.shift, ISNULL(u.shift, ''))) AS userShift,
            COUNT(*) AS count
        FROM (
            SELECT userId, [date], MAX(status) AS status, MAX(shift) AS shift
            FROM attendance_logs
            WHERE [date] >= ? AND [date] <= ?
            GROUP BY userId, [date]
        ) al
        INNER JOIN users u ON u.id = al.userId
        ${getDesignationShutterLeftJoinSql('u', 'ds')}
        WHERE u.[isEmployee] = 1 AND ${eligibleEmployeeCondition} AND ${notYetLeftCondition}
          AND UPPER(ISNULL(al.[status], '')) = 'PRESENT'
          AND (
              u.stationId IS NOT NULL
              OR (u.stations IS NOT NULL AND LTRIM(RTRIM(u.stations)) NOT IN ('[]', ''))
          )
        GROUP BY al.[date], UPPER(ISNULL(al.shift, ISNULL(u.shift, '')))
    `;
    const [assignedManpowerData] = await executeQuery(assignedManpowerSql, [start, end]);

    assignedManpowerData.forEach(row => {
        const { dateKey, userShift, count } = row;
        const shiftKey = Object.keys(shiftMap).find(k => userShift.includes(k));
        if (shiftKey) {
            const shiftName = shiftMap[shiftKey];
            tableData[`Assigned_${shiftName}_${dateKey}`] = String(count || 0);
            tableData[`Assigned_Total_${dateKey}`] = String(Number(tableData[`Assigned_Total_${dateKey}`] || 0) + count);
        }
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

    res.status(200).json({ success: true, data: mapped });
});

/**
 * Create a new email report config
 */
export const createMail = asyncHandler(async (req, res) => {
    try {
        console.log("[DEBUG] createMail Payload received:", req.body);

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
        const isManagementDailyReport = freqArr.includes('management daily') || freqArr.includes('managementdaily') || freqArr.includes('monthly');

        const typesStr = Array.isArray(reportTypes)
            ? reportTypes.join(', ')
            : (reportTypes || formName || "Manpower");

        const newMail = await Mail.create({
            email,
            isDailyReport,
            isManagementDailyReport,
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

    try {
        const emailList = mails.map(m => m.email);

        const { sendBothReports } = await import('../services/report.service.js');

        await sendBothReports(emailList);

        res.status(200).json({
            success: true,
            data: { recipientCount: mails.length, sent: mails.length, failed: 0 },
            message: `Combined Excel reports sent to ${mails.length} recipients successfully.`
        });
    } catch (err) {
        console.error("[Report Controller] Failed to trigger manual report:", err);
        res.status(500).json({
            success: false,
            message: "Failed to generate and send Excel report.",
            error: err.message
        });
    }
});