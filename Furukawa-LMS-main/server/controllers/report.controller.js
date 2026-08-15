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
import { computeHeadcountTableData } from '../services/headcountData.service.js';

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

    const { tableData } = await computeHeadcountTableData(departmentId, month, year);

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
let isTableEnsured = false;

const ensureEmailReportScheduleTable = async () => {
    if (isTableEnsured) return;

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

