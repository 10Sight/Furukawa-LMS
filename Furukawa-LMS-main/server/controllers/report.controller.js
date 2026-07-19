import { asyncHandler } from '../utils/asyncHandler.js';
import NotificationService from '../services/notification.service.js';
import { executeQuery } from '../db/mssqlHelper.js';
import ExcelJS from 'exceljs';
import HeadcountReport from '../models/headcountReport.model.js';
import UserHierarchySnapshot from '../models/userHierarchySnapshot.model.js';
import Mail from '../models/mail.model.js';
import logAudit from '../utils/auditLogger.js';
import { getEligibleUserSql, getEligibleUserCondition } from '../utils/userEligibility.js';

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
    // NOTE: this query intentionally keeps a broad WHERE (isEmployee OR isTemporary) because
    // it computes both the strict employee headcount AND the separate Dojo/temp-staff stats
    // (totalPresentDojo/totalAbsentDojo) in one pass. The strict eligibility filter
    // (non-deleted, non-temporary, non-shuttered-designation) is therefore applied inline to
    // the employee-only CASE branches instead of the WHERE clause, so it doesn't zero out the
    // Dojo branches which deliberately target isTemporary = 1 rows.
    const eligibleEmployeeCondition = getEligibleUserCondition('u');
    const netHeadcountSql = `
        SELECT
            CONVERT(VARCHAR, al.[date], 23) AS dateKey,
            SUM(CASE WHEN UPPER(ISNULL(al.[status], '')) = 'PRESENT' AND u.[isEmployee] = 1 AND ${eligibleEmployeeCondition} THEN 1 ELSE 0 END) AS totalPresentEmployees,
            SUM(CASE WHEN UPPER(ISNULL(al.[status], '')) = 'PRESENT' AND u.[isTemporary] = 1 THEN 1 ELSE 0 END) AS totalPresentDojo,
            SUM(CASE WHEN UPPER(ISNULL(al.status, '')) IN ('ABSENT', 'A') AND u.[isTemporary] = 1 THEN 1 ELSE 0 END) AS totalAbsentDojo,
            SUM(CASE WHEN TRY_CONVERT(date, u.joiningDate) <= DATEADD(MONTH, -3, al.[date]) AND UPPER(ISNULL(al.[status], '')) = 'PRESENT' AND u.[isEmployee] = 1 AND ${eligibleEmployeeCondition} THEN 1 ELSE 0 END) AS totalPresentAbove3Months,
            SUM(CASE WHEN UPPER(ISNULL(al.status, '')) IN ('ABSENT', 'A') AND u.[isEmployee] = 1 AND ${eligibleEmployeeCondition} THEN 1 ELSE 0 END) as totalAbsent,
            COUNT(*) as totalUploaded
        FROM attendance_logs al
        INNER JOIN users u ON u.id = al.userId
        WHERE (u.[isEmployee] = 1 OR u.[isTemporary] = 1)
          AND al.[date] >= ? AND al.[date] <= ?
        GROUP BY al.[date]
    `;
    const [netHeadcountData] = await executeQuery(netHeadcountSql, [start, end]);

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

        const present = row.totalPresentEmployees || 0;
        const absent = Math.max(0, activeCount - present);
        const totalPA = activeCount;

        dailyTotalsMap[dKey] = totalPA;
        tableData[`Headcount available_${dKey}`] = present;
        tableData[`Present in Training Cell_${dKey}`] = row.totalPresentDojo || 0;
        tableData[`DojoAbsent_${dKey}`] = row.totalAbsentDojo || 0;
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

    // Shift-wise attendance
    const shiftAttendanceSql = `
        SELECT
            CONVERT(VARCHAR, al.[date], 23) AS dateKey,
            UPPER(ISNULL(al.shift, ISNULL(u.shift, ''))) AS userShift,
            COUNT(*) AS count
        FROM attendance_logs al
        INNER JOIN users u ON u.id = al.userId
        WHERE (u.[isEmployee] = 1 OR u.[isTemporary] = 1)
          AND UPPER(ISNULL(al.[status], '')) = 'PRESENT'
          AND al.[date] >= ? AND al.[date] <= ?
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
            FROM attendance_logs al
            INNER JOIN users u ON u.id = al.userId
            WHERE u.sectionId IN (${placeholders})
              AND u.[isEmployee] = 1
              ${getEligibleUserSql('u')}
              AND al.[date] >= ? AND al.[date] <= ?
            GROUP BY al.[date]
        `;
        const [clubDailyData] = await executeQuery(clubDailySql, [...sectionIds, start, end]);

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

    // 4. Hiring Actual
    const joinSql = `
        SELECT
            CONVERT(VARCHAR, joiningDate, 23) as dateKey,
            COUNT(*) as count
        FROM users u
        WHERE (u.[isEmployee] = 1 OR u.[isTemporary] = 1)
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
        SELECT CONVERT(VARCHAR, expectedHandover, 23) AS dateKey, COUNT(*) AS count
        FROM users
        WHERE (isTemporary = 1 OR expectedHandover IS NOT NULL)
          AND (isDeleted = 0 OR isDeleted IS NULL)
          AND expectedHandover >= ?
          AND expectedHandover <= ?
        GROUP BY CONVERT(VARCHAR, expectedHandover, 23)
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

    const leftSql = `
        SELECT id, empId as payCode, idCard as cardNo, fullName as employeeName, departmentId, sectionId, shift, isTemporary, 
               CONVERT(VARCHAR, COALESCE(leavingDate, updatedAt), 23) as dateKey 
        FROM users u 
        WHERE (
            (leavingDate >= ? AND leavingDate < ?) OR 
            (TRIM(LOWER(status)) LIKE 'left%' AND (updatedAt >= ? AND updatedAt < ?))
        ) 
        AND (u.[isEmployee] = 1 OR u.[isTemporary] = 1)
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
        const dayLeftCount = leftUsers.filter(l => l.dateKey === dKey).length;
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
                weeklyLeft += leftUsers.filter(l => l.dateKey === prevDKey).length;
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

            const clubDayCount = leftUsers.filter(l => l.dateKey === dKey && clubSectionIds.includes(String(l.sectionId))).length;
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

    // 8. Shift Manpower
    const assignedManpowerSql = `
        SELECT UPPER(ISNULL(shift, '')) as userShift, COUNT(*) as count 
        FROM users 
        WHERE isEmployee = 1 
        GROUP BY UPPER(ISNULL(shift, ''))
    `;
    const [assignedManpowerData] = await executeQuery(assignedManpowerSql);

    assignedManpowerData.forEach(row => {
        const shiftKey = Object.keys(shiftMap).find(k => row.userShift.includes(k));
        if (shiftKey) {
            const shiftName = shiftMap[shiftKey];

            for (let d = 1; d <= totalDays; d++) {
                const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                tableData[`Assigned_${shiftName}_${dKey}`] = String(row.count || 0);
                tableData[`Assigned_Total_${dKey}`] = String(Number(tableData[`Assigned_Total_${dKey}`] || 0) + row.count);
            }
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