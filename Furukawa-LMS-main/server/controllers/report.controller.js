import { asyncHandler } from '../utils/asyncHandler.js';
import NotificationService from '../services/notification.service.js';
import { executeQuery } from '../db/mssqlHelper.js';
import ExcelJS from 'exceljs';
import HeadcountReport from '../models/headcountReport.model.js';
import UserHierarchySnapshot from '../models/userHierarchySnapshot.model.js';
import Mail from '../models/mail.model.js';

/**
 * Controller to handle manual Excel report exports for configured sheets.
 */
export const exportFormReport = asyncHandler(async (req, res) => {
    const { formName } = req.params;
    const { id, departmentId, studentId } = req.query;

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

        case "Handover Sheet":
            const [hoRows] = await executeQuery(`SELECT * FROM handover_sheets WHERE departmentId = ?`, [departmentId]);
            if (hoRows.length > 0) {
                formData = {
                    date: hoRows[0].date,
                    entries: JSON.parse(hoRows[0].entries || "[]"),
                    signatures: JSON.parse(hoRows[0].signatures || "{}"),
                    metadata: JSON.parse(hoRows[0].metadata || "{}")
                };
            }
            break;

        case "On Job Training Record Sheet":
        case "On Job Training Evaluation Sheet":
            const [ojtRows] = await executeQuery(`SELECT * FROM on_job_training WHERE id = ?`, [id]);
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
            const [ooRows] = await executeQuery(`SELECT * FROM operator_observance WHERE id = ?`, [id]);
            if (ooRows.length > 0) {
                formData = {
                    ...ooRows[0],
                    observanceData: JSON.parse(ooRows[0].observanceData || "{}")
                };
            }
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
 * Sync headcount data from real sources (Attendance, User logs)
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

    // 2. Global Attendance Stats (Net Headcount)
    const netHeadcountSql = `
        SELECT
            CONVERT(VARCHAR, al.[date], 23) AS dateKey,
            SUM(CASE WHEN UPPER(ISNULL(al.[status], '')) = 'PRESENT' THEN 1 ELSE 0 END) AS totalPresentEmployees,
            SUM(CASE WHEN TRY_CONVERT(date, u.joiningDate) <= DATEADD(MONTH, -3, al.[date]) AND UPPER(ISNULL(al.[status], '')) = 'PRESENT' THEN 1 ELSE 0 END) AS totalPresentAbove3Months,
            SUM(CASE WHEN UPPER(ISNULL(al.status, '')) IN ('ABSENT', 'A') THEN 1 ELSE 0 END) as totalAbsent,
            COUNT(*) as totalUploaded
        FROM attendance_logs al
        INNER JOIN users u ON u.id = al.userId
        WHERE u.[isEmployee] = 1
          AND al.[date] >= ? AND al.[date] <= ?
        GROUP BY al.[date]
    `;
    const [netHeadcountData] = await executeQuery(netHeadcountSql, [start, end]);

    const dailyTotalsMap = {};
    netHeadcountData.forEach(row => {
        if (!row.dateKey) return;
        const present = row.totalPresentEmployees || 0;
        const absent = row.totalAbsent || 0;
        const totalPA = present + absent;

        dailyTotalsMap[row.dateKey] = totalPA;
        tableData[`Headcount available_${row.dateKey}`] = present;
        tableData[`Net Available Headcount (Total)_${row.dateKey}`] = row.totalUploaded || 0;
        tableData[`Total Headcount (Present + Absent)_${row.dateKey}`] = totalPA;
        tableData[`Net Available Headcount Above 3 Months_${row.dateKey}`] = row.totalPresentAbove3Months || 0;
        tableData[`Absent_${row.dateKey}`] = absent;

        const globalAbsPercent = (totalPA > 0) ? (absent / totalPA) * 100 : 0;
        tableData[`Absenteeism %_${row.dateKey}`] = globalAbsPercent.toFixed(2);
    });

    // Shift-wise attendance
    const shiftAttendanceSql = `
        SELECT
            CONVERT(VARCHAR, al.[date], 23) AS dateKey,
            UPPER(ISNULL(al.shift, ISNULL(u.shift, ''))) AS userShift,
            COUNT(*) AS count
        FROM attendance_logs al
        INNER JOIN users u ON u.id = al.userId
        WHERE u.[isEmployee] = 1
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
            tableData[`${shiftMap[shiftKey]}_${dateKey}`] = count;
        }
    });

    // 3. Dynamic Club Headcount rows
    for (const club of reportingClubs) {
        const clubName = club.name;
        let sectionIds = [];
        try {
            sectionIds = JSON.parse(club.sectionIds || "[]");
        } catch (e) { continue; }

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
              AND al.[date] >= ? AND al.[date] <= ?
            GROUP BY al.[date]
        `;
        const [clubDailyData] = await executeQuery(clubDailySql, [...sectionIds, start, end]);

        clubDailyData.forEach(row => {
            if (row.dateKey) {
                const present = row.presentCount || 0;
                const absent = row.absentCount || 0;
                const totalPA = present + absent;

                tableData[`${clubName} Headcount available_${row.dateKey}`] = present;
                tableData[`${clubName} Net Available Headcount Above 3 Months_${row.dateKey}`] = row.presentAbove3Months;
                tableData[`${clubName} absent_${row.dateKey}`] = absent;

                const absenteeismPercent = totalPA > 0 ? (absent / totalPA) * 100 : 0;
                tableData[`${clubName} Absenteeism %_${row.dateKey}`] = absenteeismPercent.toFixed(2);

                if (clubName.toUpperCase().includes('DOJO')) {
                    tableData[`Present in Training Cell_${row.dateKey}`] = present;
                    tableData[`Attrition & Absenteeism of Training Cell (Nos)_${row.dateKey}`] = (tableData[`Attrition & Absenteeism of Training Cell (Nos)_${row.dateKey}`] || 0) + absent;
                }
            }
        });
    }

    // 4. Hiring Actual (Global)
    const joinSql = `SELECT joiningDate as dateKey, COUNT(*) as count FROM users u WHERE u.[isEmployee] = 1 AND joiningDate >= ? AND joiningDate <= ? GROUP BY joiningDate`;
    const [joinData] = await executeQuery(joinSql, [start, end]);
    joinData.forEach(row => { if (row.dateKey) tableData[`Hiring Actual_${row.dateKey}`] = row.count; });

    // 5. Handover Actual
    const handoverSql = `
        SELECT CONVERT(VARCHAR, [date], 23) as dateKey, entries 
        FROM handover_sheets 
        WHERE [date] >= ? AND [date] <= ?
    `;
    const [handoverRows] = await executeQuery(handoverSql, [start, end]);
    const handoverDailyCounts = {};
    handoverRows.forEach(row => {
        let count = 0;
        try { count = JSON.parse(row.entries || "[]").length; } catch (e) {}
        if (row.dateKey) handoverDailyCounts[row.dateKey] = (handoverDailyCounts[row.dateKey] || 0) + count;
    });

    let cumulativeHandover = 0;
    for (let d = 1; d <= totalDays; d++) {
        const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayHandover = handoverDailyCounts[dKey] || 0;
        cumulativeHandover += dayHandover;
        tableData[`Handover Actual_${dKey}`] = dayHandover;
        tableData[`Handed-over after training (Cumulative)_${dKey}`] = cumulativeHandover;
    }

    // 6. Separations (Actual Separations and Cumulative)
    const nextMonthStart = new Date(year, month, 1).toISOString().split('T')[0];
    const leftSql = `SELECT id, empId as payCode, idCard as cardNo, fullName as employeeName, departmentId, sectionId, shift, CONVERT(VARCHAR, leavingDate, 23) as dateKey 
                     FROM users u 
                     WHERE (leavingDate >= ? AND leavingDate < ?) AND u.[isEmployee] = 1
    `;
    const [leftUsers] = await executeQuery(leftSql, [start, nextMonthStart]);

    // Upsert separation logs
    for (const u of leftUsers) {
        if (u.dateKey) {
            const upsertLogSql = `
                MERGE attendance_logs AS target
                USING (SELECT ? AS userId, ? AS [date]) AS source
                ON (target.userId = source.userId AND target.[date] = source.[date])
                WHEN MATCHED THEN
                    UPDATE SET status = 'Separated', updatedAt = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (userId, payCode, cardNo, employeeName, [date], shift, status, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, 'Separated', GETDATE());
            `;
            await executeQuery(upsertLogSql, [u.id, u.dateKey, u.id, u.payCode, u.cardNo, u.employeeName, u.dateKey, u.shift]);
        }
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
        cumulativeLeft += dayLeftCount;

        const dayStats = netHeadcountData.find(r => r.dateKey === dKey);
        if (dayStats?.totalUploaded > 0) lastKnownTotal = dayStats.totalUploaded;
        const denom = lastKnownTotal || 1;

        tableData[`Left in nos (Daily)_${dKey}`] = dayLeftCount;
        tableData[`Actual Separations (Cumulative)_${dKey}`] = cumulativeLeft;
        tableData[`Gap_${dKey}`] = (cumulativeLeft - (parseFloat(tableData[`Expected Separations (Cumulative)_${dKey}`]) || 0)).toFixed(0);

        // Club-level separations
        reportingClubs.forEach(club => {
            let sectionIds = [];
            try { sectionIds = JSON.parse(club.sectionIds || "[]"); } catch (e) {}
            const clubDayCount = leftUsers.filter(l => l.dateKey === dKey && sectionIds.includes(l.sectionId)).length;
            clubCumulativeLeft[club.id] = (clubCumulativeLeft[club.id] || 0) + clubDayCount;
            tableData[`${club.name} Separated (Cumulative)_${dKey}`] = clubCumulativeLeft[club.id];
            
            if (club.name.toUpperCase().includes('DOJO')) {
                tableData[`Attrition & Absenteeism of Training Cell (Nos)_${dKey}`] = (tableData[`Attrition & Absenteeism of Training Cell (Nos)_${dKey}`] || 0) + clubDayCount;
            }
        });
    }

    // 7. Hiring Plan (Global/Clubs)
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[parseInt(month) - 1];
    const [planRows] = await executeQuery(`SELECT SUM(prod_plan) as count FROM requirements WHERE month_name = ? AND year_val = ?`, [monthName, year]);
    const monthlyHiringPlan = planRows[0]?.count || 0;
    for (let d = 1; d <= totalDays; d++) {
        const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        tableData[`Hiring Plan_${dKey}`] = monthlyHiringPlan;
    }

    // 8. Shift Manpower
    const assignedManpowerSql = `SELECT UPPER(ISNULL(shift, '')) as userShift, COUNT(*) as count FROM users WHERE isEmployee = 1 GROUP BY UPPER(ISNULL(shift, ''))`;
    const [assignedManpowerData] = await executeQuery(assignedManpowerSql);
    assignedManpowerData.forEach(row => {
        const shiftKey = Object.keys(shiftMap).find(k => row.userShift.includes(k));
        if (shiftKey) {
            for (let d = 1; d <= totalDays; d++) {
                const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                tableData[`Shift-wise Breakdown of Assigned Manpower_${shiftMap[shiftKey]}_${dKey}`] = row.count;
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
 * 
 * ==========================================
 * Email Report CRUD Operations
 * ==========================================
 */

/**
 * Get all configured email reports
 */
export const getMails = asyncHandler(async (req, res) => {
    const mails = await Mail.findAll();

    // Transform data to match frontend expectations
    const mapped = mails.map(m => {
        let freqs = [];
        if (m.isDailyReport) freqs.push('Daily');
        if (m.isMonthlyReport) freqs.push('Monthly');

        const frequencyStr = freqs.join(', ') || 'Daily';
        const reportTypesArr = m.reportTypes ? m.reportTypes.split(', ') : ['Manpower'];

        return {
            id: m.id,
            // Standard fields (new frontend)
            email: m.email,
            frequency: frequencyStr,
            reportTypes: reportTypesArr,
            // Compatibility fields (client live frontend)
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

        // Accept both field naming conventions:
        // New frontend: { email, frequency, reportTypes }
        // Live/old frontend: { toEmails, formName, departmentId, isActive, includeTrainer }
        const email = req.body.email || req.body.toEmails || null;
        const { frequency, reportTypes, formName } = req.body;

        if (!email) {
            console.log("[DEBUG] createMail: Missing email (checked both 'email' and 'toEmails')");
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const freqStr = typeof frequency === 'string' ? frequency : (Array.isArray(frequency) ? frequency.join(', ') : 'Daily');
        const isDailyReport = freqStr.includes('Daily');
        const isMonthlyReport = freqStr.includes('Monthly');

        console.log(`[DEBUG] Parsed frequency - Daily: ${isDailyReport}, Monthly: ${isMonthlyReport}`);

        // Accept reportTypes array or formName string as the report type
        const typesStr = Array.isArray(reportTypes)
            ? reportTypes.join(', ')
            : (reportTypes || formName || "Manpower");

        console.log("[DEBUG] Calling Mail.create...");
        const newMail = await Mail.create({
            email,
            isDailyReport,
            isMonthlyReport,
            reportTypes: typesStr
        });

        console.log("[DEBUG] Created mail record successfully:", newMail);
        res.status(201).json({ success: true, data: newMail, message: "Recipient added successfully" });
    } catch (err) {
        console.error("[DEBUG] createMail ERROR CAUGHT:", err);
        res.status(400).json({ success: false, message: err.message || "Failed to create email record" });
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
        return res.status(200).json({ success: true, data: { recipientCount: 0 }, message: "No recipients configured" });
    }

    try {
        const emailList = mails.map(m => m.email);
        
        // Import generateAndSend dynamically to avoid circular dependencies if any
        const { generateAndSend } = await import('../services/report.service.js');
        
        // Send the complete Excel report
        await generateAndSend(emailList, "(Manual Trigger)");

        res.status(200).json({
            success: true,
            data: { recipientCount: mails.length, sent: mails.length, failed: 0 },
            message: `Report Excel sent to ${mails.length} recipients successfully.`
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
