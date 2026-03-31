import { asyncHandler } from '../utils/asyncHandler.js';
import NotificationService from '../services/notification.service.js';
import { executeQuery } from '../db/mssqlHelper.js';
import ExcelJS from 'exceljs';
import HeadcountReport from '../models/headcountReport.model.js';

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

    // Fetch existing report to preserve manual fields (like Expected Separations)
    const existingReport = await HeadcountReport.findOne({
        departmentId: departmentId || 0,
        month,
        year
    });
    const tableData = existingReport?.tableData || {};

    // 1. Fetch reporting-enabled departments (or all active departments if needed)
    // Changing to include all active departments to ensure Hiring Actual etc. don't miss users
    const [reportingDepts] = await executeQuery("SELECT id, name FROM departments WHERE (isDeleted = 0 OR isDeleted IS NULL)");

    // 2. Fetch Attendance Stats
    let attWhere = "";
    let attParams = [];

    if (departmentId) {
        const [deptRows] = await executeQuery("SELECT name FROM departments WHERE id = ?", [departmentId]);
        const deptName = deptRows[0]?.name;
        attWhere = "(u.[departmentId] = ? OR u.[department] = ? OR u.[department] LIKE ?)";
        attParams = [departmentId, deptName, `%${deptName}%`].filter(x => x !== undefined);
    } else {
        // Global: Include all employees regardless of whether their department exists in the departments table
        attWhere = "u.[isEmployee] = 1";
        attParams = [];
    }

    // Attendance and Net Headcount (Daily) - Global: Include ALL employees regardless of department
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
        const totalPA = present + absent; // Total Present + Absent

        dailyTotalsMap[row.dateKey] = totalPA;

        tableData[`Headcount available_${row.dateKey}`] = present;
        tableData[`Net Available Headcount (Total)_${row.dateKey}`] = row.totalUploaded || 0;
        tableData[`Total Headcount (Present + Absent)_${row.dateKey}`] = totalPA;
        tableData[`Net Available Headcount Above 3 Months_${row.dateKey}`] = row.totalPresentAbove3Months || 0;
        tableData[`Absent_${row.dateKey}`] = absent;

        // Calculate Global Absenteeism % based on Present + Absent roles only
        const globalAbsPercent = (totalPA > 0) ? (absent / totalPA) * 100 : 0;
        tableData[`Absenteeism %_${row.dateKey}`] = globalAbsPercent.toFixed(2);
    });



    // Shift-wise attendance
    const shiftAttendanceSql = `
        SELECT
            CONVERT(VARCHAR, al.[date], 23) AS dateKey,
            UPPER(ISNULL(al.shift, ISNULL(u.shift, ''))) AS userShift, -- Use al.shift if available
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
            // Map count to the standard shift label key for the frontend
            tableData[`${shiftMap[shiftKey]}_${dateKey}`] = count;
        }
    });

    // 3. Dynamic Department Headcount rows - Prioritize al.department from uploaded Excel
    for (const dept of reportingDepts) {
        const deptId = dept.id;
        const deptName = dept.name;

        const deptDailySql = `
            SELECT
                CONVERT(VARCHAR, al.[date], 23) AS dateKey,
                SUM(CASE WHEN UPPER(ISNULL(al.[status], '')) = 'PRESENT' THEN 1 ELSE 0 END) AS presentCount,
                SUM(CASE WHEN TRY_CONVERT(date, u.joiningDate) <= DATEADD(MONTH, -3, al.[date]) AND UPPER(ISNULL(al.[status], '')) = 'PRESENT' THEN 1 ELSE 0 END) AS presentAbove3Months,
                SUM(CASE WHEN UPPER(ISNULL(al.[status], '')) IN ('ABSENT', 'A') THEN 1 ELSE 0 END) AS absentCount
            FROM attendance_logs al
            INNER JOIN users u ON u.id = al.userId
            WHERE (
                LOWER(al.[department]) = LOWER(?) OR 
                LOWER(u.[department]) = LOWER(?) OR 
                u.[departmentId] = ?
            )
            AND u.[isEmployee] = 1
            AND al.[date] >= ? AND al.[date] <= ?
            GROUP BY al.[date]
        `;
        const [deptDailyData] = await executeQuery(deptDailySql, [deptName, deptName, deptId, start, end]);

        deptDailyData.forEach(row => {
            if (row.dateKey) {
                const present = row.presentCount || 0;
                const absent = row.absentCount || 0;
                const totalPA = present + absent;

                tableData[`${deptName} Headcount available_${row.dateKey}`] = present;
                tableData[`${deptName} Net Available Headcount Above 3 Months_${row.dateKey}`] = row.presentAbove3Months;
                tableData[`${deptName} absent_${row.dateKey}`] = absent;

                // Calculate Absenteeism % for the department based on Present + Absent
                const absenteeismPercent = totalPA > 0 ? (absent / totalPA) * 100 : 0;
                tableData[`${deptName} Absenteeism %_${row.dateKey}`] = absenteeismPercent.toFixed(2);

                // Specific logic for DOJO (Training Cell)
                if (deptName.toUpperCase() === 'DOJO') {
                    tableData[`Present in Training Cell_${row.dateKey}`] = present;
                    // We'll add attrition later from user logs, but combining absenteeism here
                    tableData[`Attrition & Absenteeism of Training Cell (Nos)_${row.dateKey}`] = (tableData[`Attrition & Absenteeism of Training Cell (Nos)_${row.dateKey}`] || 0) + absent;
                }
            }
        });
    }

    // Adjust Training Cell Attrition (Users leaving from DOJO)
    const dojoLeftSql = `SELECT leavingDate as dateKey, COUNT(*) as count FROM users WHERE (departmentId = 7 OR department = 'DOJO') AND leavingDate >= ? AND leavingDate <= ? GROUP BY leavingDate`;
    const [dojoLeftData] = await executeQuery(dojoLeftSql, [start, end]);
    dojoLeftData.forEach(row => {
        if (row.dateKey) {
            tableData[`Attrition & Absenteeism of Training Cell (Nos)_${row.dateKey}`] = (tableData[`Attrition & Absenteeism of Training Cell (Nos)_${row.dateKey}`] || 0) + row.count;
        }
    });

    // 4. Hiring Actual
    const joinSql = `SELECT joiningDate as dateKey, COUNT(*) as count FROM users u WHERE ${attWhere} AND u.[isEmployee] = 1 AND joiningDate >= ? AND joiningDate <= ? GROUP BY joiningDate`;
    const [joinData] = await executeQuery(joinSql, [...attParams, start, end]);
    joinData.forEach(row => { if (row.dateKey) tableData[`Hiring Actual_${row.dateKey}`] = row.count; });

    // 5. Handover Actual (From handover_sheets - count number of entries in JSON)
    const handoverSql = `
        SELECT CONVERT(VARCHAR, [date], 23) as dateKey, entries 
        FROM handover_sheets 
        WHERE [date] >= ? AND [date] <= ?
    `;
    const [handoverRows] = await executeQuery(handoverSql, [start, end]);

    const handoverDailyCounts = {};
    handoverRows.forEach(row => {
        let count = 0;
        try {
            const entries = JSON.parse(row.entries || "[]");
            count = entries.length;
        } catch (e) {
            console.error("Error parsing handover entries:", e);
        }
        if (row.dateKey) {
            handoverDailyCounts[row.dateKey] = (handoverDailyCounts[row.dateKey] || 0) + count;
        }
    });

    let cumulativeHandover = 0;
    // Iterate through days to calculate cumulative
    for (let d = 1; d <= totalDays; d++) {
        const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayHandover = handoverDailyCounts[dKey] || 0;
        cumulativeHandover += dayHandover;

        tableData[`Handover Actual_${dKey}`] = dayHandover;
        tableData[`Handed-over after training (Cumulative)_${dKey}`] = cumulativeHandover;
    }

    // 6. Separations (Actual Separations and Cumulative)
    let deptNameForFilter = null;
    if (departmentId) {
        const [deptRows] = await executeQuery("SELECT name FROM departments WHERE id = ?", [departmentId]);
        deptNameForFilter = deptRows[0]?.name;
    }

    const nextMonthStart = new Date(year, month, 1).toISOString().split('T')[0];
    const leftSql = `SELECT id, empId as payCode, idCard as cardNo, fullName as employeeName, departmentId, department, shift, CONVERT(VARCHAR, leavingDate, 23) as dateKey 
                     FROM users u 
                     WHERE (leavingDate >= ? AND leavingDate < ?)
                     ${departmentId ? "AND (u.[departmentId] = ? OR u.[department] = ? OR u.[department] LIKE ?)" : ""}
    `;
    const leftParams = [start, nextMonthStart];
    if (departmentId) leftParams.push(departmentId, deptNameForFilter, `%${deptNameForFilter}%`);
    const [leftUsers] = await executeQuery(leftSql, leftParams);

    // Automatically create/update attendance log for separations
    for (const u of leftUsers) {
        if (u.dateKey) {
            const upsertLogSql = `
                MERGE attendance_logs AS target
                USING (SELECT ? AS userId, ? AS [date]) AS source
                ON (target.userId = source.userId AND target.[date] = source.[date])
                WHEN MATCHED THEN
                    UPDATE SET status = 'Separated', updatedAt = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (userId, payCode, cardNo, employeeName, [date], department, shift, status, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'Separated', GETDATE());
            `;
            await executeQuery(upsertLogSql, [u.id, u.dateKey, u.id, u.payCode, u.cardNo, u.employeeName, u.dateKey, u.department, u.shift]);
        }
    }

    let cumulativeLeft = 0;
    const deptCumulativeLeft = {};
    reportingDepts.forEach(d => deptCumulativeLeft[d.name] = 0);

    // Find the average headcount for the month as a fallback for days with 0 attendance (e.g. Sundays)
    const counts = Object.values(dailyTotalsMap).filter(v => v > 0);
    const avgHeadcount = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    let lastKnownTotal = avgHeadcount;

    for (let d = 1; d <= totalDays; d++) {
        const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayLeftCount = leftUsers.filter(l => l.dateKey === dKey).length;
        cumulativeLeft += dayLeftCount;

        // Use the total uploaded headcount as the base for attrition (includes Off/Holiday)
        const dayStats = netHeadcountData.find(r => r.dateKey === dKey);
        const currentUploaded = dayStats?.totalUploaded || 0;
        if (currentUploaded > 0) lastKnownTotal = currentUploaded;

        const denom = lastKnownTotal || 1; // Avoid division by zero

        tableData[`Left in nos (Daily)_${dKey}`] = dayLeftCount;
        tableData[`Actual Separations (Cumulative)_${dKey}`] = cumulativeLeft;
        tableData[`Separated (Cumulative)_${dKey}`] = cumulativeLeft;

        // Calculate Attrition % Daily
        tableData[`Attrition % Daily_${dKey}`] = ((dayLeftCount / denom) * 100).toFixed(2);

        // Calculate Attrition % Cumulative
        tableData[`Attrition % Cumulative_${dKey}`] = ((cumulativeLeft / denom) * 100).toFixed(2);

        // Calculate Attrition % Weekly (Rolling 7 days)
        let weeklyLeftSum = 0;
        for (let i = Math.max(1, d - 6); i <= d; i++) {
            const prevDKey = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            weeklyLeftSum += leftUsers.filter(l => l.dateKey === prevDKey).length;
        }
        tableData[`Weekly Attrition %_${dKey}`] = ((weeklyLeftSum / denom) * 100).toFixed(2);

        // Gap calculation (Actual - Expected)
        // Since sync resets data, we try to preserve existing Expected Separations if they were already in tableData or DB
        const actual = cumulativeLeft;
        const expected = parseFloat(tableData[`Expected Separations (Cumulative)_${dKey}`]) || 0;
        tableData[`Gap_${dKey}`] = (actual - expected).toFixed(0);

        // Departmental cumulative
        reportingDepts.forEach(dept => {
            const deptDayCount = leftUsers.filter(l =>
                l.dateKey === dKey &&
                (l.departmentId === dept.id || (l.department && String(l.department).toLowerCase() === String(dept.name).toLowerCase()))
            ).length;
            deptCumulativeLeft[dept.name] = (deptCumulativeLeft[dept.name] || 0) + deptDayCount;
            tableData[`${dept.name} Separated (Cumulative)_${dKey}`] = deptCumulativeLeft[dept.name];
        });
    }

    // 7. Hiring Plan
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[parseInt(month) - 1];
    let planSql = "";
    let planParams = [];
    if (departmentId) {
        planSql = `SELECT SUM(prod_plan) as count FROM requirements WHERE (section_id = ? OR section_name = ?) AND month_name = ? AND year_val = ?`;
        planParams = [departmentId, deptNameForFilter || departmentId, monthName, year];
    } else {
        const deptIds = reportingDepts.map(d => d.id);
        if (deptIds.length > 0) {
            const placeholders = deptIds.map(() => "?").join(",");
            planSql = `SELECT SUM(prod_plan) as count FROM requirements WHERE section_id IN (${placeholders}) AND month_name = ? AND year_val = ?`;
            planParams = [...deptIds, monthName, year];
        }
    }
    if (planSql) {
        const [planRows] = await executeQuery(planSql, planParams);
        const monthlyHiringPlan = planRows[0]?.count || 0;
        for (let d = 1; d <= totalDays; d++) {
            const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            tableData[`Hiring Plan_${dKey}`] = monthlyHiringPlan;
        }
    }

    // 8. Shift-wise Breakdown of Assigned Manpower (From users table)
    const assignedManpowerSql = `
        SELECT 
            UPPER(ISNULL(shift, '')) as userShift,
            COUNT(*) as count
        FROM users u
        WHERE ${attWhere}
          AND u.[isEmployee] = 1
        GROUP BY UPPER(ISNULL(shift, ''))
    `;
    const [assignedManpowerData] = await executeQuery(assignedManpowerSql, attParams);

    assignedManpowerData.forEach(row => {
        const { userShift, count } = row;
        const shiftKey = Object.keys(shiftMap).find(k => userShift.includes(k));
        if (shiftKey) {
            // Assigned manpower is usually static for the month or reflects current state
            // We'll populate it for all days in the month for visibility
            for (let d = 1; d <= totalDays; d++) {
                const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                tableData[`Shift-wise Breakdown of Assigned Manpower_${shiftMap[shiftKey]}_${dKey}`] = count;
            }
        }
    });

    res.status(200).json({
        success: true,
        data: { tableData }
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

    // Fetch current manpower data for the report body
    let manpowerRows = [];
    try {
        const [rows] = await executeQuery(`
            SELECT TOP 100
                section, sub_section, line_area, stationNo,
                supervisorName, month, year, salesPlan, prodPlan
            FROM requirements
            ORDER BY year DESC, section ASC
        `);
        manpowerRows = rows || [];
    } catch (err) {
        console.error("[Report] Failed to fetch manpower data:", err.message);
    }

    // Build HTML table
    const tableRows = manpowerRows.length > 0
        ? manpowerRows.map(r => `
            <tr>
                <td style="padding:6px 10px;border:1px solid #e2e8f0">${r.section || '-'}</td>
                <td style="padding:6px 10px;border:1px solid #e2e8f0">${r.sub_section || '-'}</td>
                <td style="padding:6px 10px;border:1px solid #e2e8f0">${r.line_area || '-'}</td>
                <td style="padding:6px 10px;border:1px solid #e2e8f0">${r.month || '-'}</td>
                <td style="padding:6px 10px;border:1px solid #e2e8f0">${r.year || '-'}</td>
                <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">${r.salesPlan ?? '-'}</td>
                <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">${r.prodPlan ?? '-'}</td>
            </tr>`).join('')
        : `<tr><td colspan="7" style="padding:12px;text-align:center;color:#94a3b8">No data available</td></tr>`;

    const reportDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    const htmlBody = `
        <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto">
            <div style="background:#1e40af;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
                <h2 style="margin:0;font-size:20px">📊 Manpower Report</h2>
                <p style="margin:4px 0 0;opacity:0.8;font-size:13px">Generated on ${reportDate}</p>
            </div>
            <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px">
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead>
                        <tr style="background:#f1f5f9;color:#475569">
                            <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left">Section</th>
                            <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left">Sub-Section</th>
                            <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left">Line Area</th>
                            <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left">Month</th>
                            <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left">Year</th>
                            <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center">Sales Plan</th>
                            <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center">Prod Plan</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
                <p style="margin-top:16px;font-size:12px;color:#94a3b8">
                    This is an automated report from <strong>Furukawa LMS</strong>. Do not reply to this email.
                </p>
            </div>
        </div>`;

    // Dispatch to all recipients, track failures individually
    const results = await Promise.allSettled(
        mails.map(m => sendMail(m.email, `Manpower Report – ${reportDate}`, htmlBody))
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
        failed.forEach((f, i) => console.error(`[Report] Failed to send to recipient ${i + 1}:`, f.reason?.message));
    }

    res.status(200).json({
        success: true,
        data: { recipientCount: mails.length, sent, failed: failed.length },
        message: `Report sent to ${sent} of ${mails.length} recipients`
    });
});
