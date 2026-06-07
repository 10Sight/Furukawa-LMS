import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import NotificationService from "../services/notification.service.js";
import ThreeDayMonitoring from "../models/threeDayMonitoring.model.js";
import MonitoringConfig from "../models/monitoringConfig.model.js";

import { executeQuery } from "../db/mssqlHelper.js";
import EmailConfiguration from "../models/emailConfiguration.model.js";
import { generateThreeDayMonitoringEmail } from "../utils/emailTemplates.js";
import sendMail from "../utils/mail.util.js";

// Helper to parse emails from various formats (JSON array or comma-separated string)
const parseEmails = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    // Handle JSON string or simple comma-separated string
    try {
        if (input.trim().startsWith('[') && input.trim().endsWith(']')) {
            const parsed = JSON.parse(input);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        // Fallback to split
    }
    return String(input).split(',').map(e => e.trim()).filter(Boolean);
};

// Helper to resolve studentId (from ID, userName, empId or slug)
const resolveStudentId = async (studentId) => {
    if (!studentId) return null;
    let users;
    if (!isNaN(studentId) && !isNaN(parseFloat(studentId))) {
        [users] = await executeQuery("SELECT id FROM users WHERE id = ?", [studentId]);
        if (users.length > 0) return users[0].id;
    }
    [users] = await executeQuery("SELECT id FROM users WHERE userName = ? OR slug = ? OR empId = ?", [studentId, studentId, studentId]);
    return users.length > 0 ? users[0].id : null;
};

export const listThreeDayMonitoring = asyncHandler(async (req, res) => {
    const { departmentId, sectionId, lineId } = req.query;

    if (!departmentId) {
        throw new ApiError("Department ID is required", 400);
    }

    let query = `
        SELECT 
            u.id, u.fullName, u.empId, u.avatar,
            m.status, m.checkedBy, m.verifiedBy, m.approvedBy, m.updatedAt, m.attemptNumber,
            stats.totalAttempts, stats.rejectedCount
        FROM users u
        LEFT JOIN (
            SELECT studentId, status, checkedBy, verifiedBy, approvedBy, updatedAt, attemptNumber,
                   ROW_NUMBER() OVER(PARTITION BY studentId ORDER BY attemptNumber DESC, createdAt DESC) as rn
            FROM three_day_monitorings
        ) m ON u.id = m.studentId AND m.rn = 1
        LEFT JOIN (
            SELECT studentId, COUNT(*) as totalAttempts,
                   SUM(CASE WHEN verifiedBy LIKE '%Rejected%' OR approvedBy LIKE '%Rejected%' THEN 1 ELSE 0 END) as rejectedCount
            FROM three_day_monitorings
            GROUP BY studentId
        ) stats ON u.id = stats.studentId
        WHERE u.departmentId = ?
        AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
        AND (u.status IS NULL OR u.status != 'LEFT')
        AND (
            (m.studentId IS NOT NULL 
             AND COALESCE(m.verifiedBy, '') NOT LIKE '%Rejected%' 
             AND COALESCE(m.approvedBy, '') NOT LIKE '%Rejected%')
            OR (
                EXISTS (
                    SELECT 1 FROM on_job_trainings ojt
                    WHERE (
                        ojt.student = CAST(u.id AS NVARCHAR(50))
                        OR (ojt.attendanceRecords LIKE '%' + u.empId + '%' AND u.empId IS NOT NULL AND u.empId != '')
                        OR (ojt.attendanceRecords LIKE '%' + u.userName + '%' AND u.userName IS NOT NULL AND u.userName != '')
                    )
                    AND (ojt.result = 'Pass' OR ojt.result = 'Approved')
                    AND CAST(ojt.createdAt AS DATE) = CAST(GETDATE() AS DATE)
                )
                AND EXISTS (
                    SELECT 1 FROM attempted_quizzes aq
                    JOIN quizzes q ON CAST(q.id AS NVARCHAR(255)) = aq.quiz
                    WHERE (aq.student = CAST(u.id AS NVARCHAR(255)) OR aq.student = u.userName)
                      AND (aq.status = 'PASSED' OR aq.status = 'PASS')
                      AND q.isMultiSkilling = 1
                      AND CAST(aq.createdAt AS DATE) = CAST(GETDATE() AS DATE)
                )
            )
        )
    `;
    const params = [departmentId];

    if (sectionId && sectionId !== "0") {
        query += " AND u.sectionId = ?";
        params.push(sectionId);
    }
    if (lineId && lineId !== "0" && lineId !== "all" && lineId !== "All" && lineId !== "undefined" && lineId !== "null") {
        query += " AND u.lineId = ?";
        params.push(lineId);
    }

    query += " AND (u.role = 'STUDENT' OR u.isEmployee = 1)";

    const [rows] = await executeQuery(query, params);

    return res.status(200).json(
        new ApiResponse(200, rows, "3-Day monitoring status list fetched successfully")
    );
});

export const getThreeDayMonitoring = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    // Authorization check: User can access if they are the owner OR have management permissions
    const isOwner = String(req.user.id) === String(sid);
    const hasManagePermission = req.user.isAdmin || req.user.isTrainer || 
                                 (req.user.role === 'CUSTOM' && req.user.customRole?.permissions?.includes('three_day:manage'));

    if (!isOwner && !hasManagePermission) {
        throw new ApiError("You do not have permission to view this monitoring record", 403);
    }

    let data;
    const recordId = req.query.recordId;

    if (recordId) {
        data = await ThreeDayMonitoring.findById(recordId);
    } else {
        data = await ThreeDayMonitoring.findByStudentId(sid);
    }

    if (!data) {
        return res.status(200).json(
            new ApiResponse(200, { isNew: true }, "No record found")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, {
            ...data,
            isNew: false,
        }, "3 Day Monitoring fetched successfully")
    );
});

export const getStudentThreeDayMonitoringHistory = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    const history = await ThreeDayMonitoring.findAllByStudentId(sid);
    return res.status(200).json(
        new ApiResponse(200, history, "Monitoring history fetched successfully")
    );
});

export const saveThreeDayMonitoring = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    // Authorization check: Only Trainers, Admins, or Custom Roles with manage permission can save
    const isOwner = String(req.user.id) === String(sid);
    const hasManagePermission = req.user.isAdmin || req.user.isTrainer || 
                                (req.user.role === 'CUSTOM' && req.user.customRole?.permissions?.includes('three_day:manage'));

    if (!isOwner && !hasManagePermission) {
        throw new ApiError("You do not have permission to save this monitoring record", 403);
    }

    const {
        processName, lineName, entries, evaluation,
        checkedBy, verifiedBy, approvedBy, status,
        isNewAttempt, recordId
    } = req.body;

    let sheet;
    if (recordId) {
        sheet = await ThreeDayMonitoring.findById(recordId);
    } else if (!isNewAttempt) {
        sheet = await ThreeDayMonitoring.findByStudentId(sid);
    }

    if (sheet && !isNewAttempt) {
        sheet.processName = processName;
        sheet.lineName = lineName;
        sheet.entries = entries;
        sheet.evaluation = evaluation;
        sheet.checkedBy = checkedBy;
        sheet.verifiedBy = verifiedBy;
        sheet.approvedBy = approvedBy;
        sheet.status = status || sheet.status || "Draft";
        sheet.updatedBy = req.user?.fullName || req.user?.name;
        await sheet.save();
    } else {
        // Find latest attempt
        const latest = await ThreeDayMonitoring.findByStudentId(sid);
        const nextAttempt = latest ? (latest.attemptNumber + 1) : 1;

        sheet = await ThreeDayMonitoring.create({
            studentId: sid,
            attemptNumber: nextAttempt,
            processName,
            lineName,
            entries,
            evaluation,
            checkedBy,
            verifiedBy,
            approvedBy,
            status: status || "Draft",
            createdBy: req.user?.fullName || req.user?.name
        });
    }

    // Trigger Email Notification in background
    NotificationService.sendFormReport("3-Day Monitoring Sheet", null, req.body, studentId)
        .catch(err => console.error("[3Day] Notification failed:", err));

    res.status(200).json(
        new ApiResponse(200, sheet, "3 Day Monitoring saved successfully")
    );
});

export const sendThreeDayMonitoringEmail = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    const sheet = await ThreeDayMonitoring.findByStudentId(sid);
    if (!sheet) throw new ApiError("No monitoring record found to email", 404);

    const [userRows] = await executeQuery(`
        SELECT u.fullName, u.userName, u.empId, u.departmentId, d.name AS deptName 
        FROM users u 
        LEFT JOIN departments d ON u.departmentId = d.id 
        WHERE u.id = ?`, [sid]);

    if (userRows.length === 0) throw new ApiError("Operator not found", 404);
    const operator = userRows[0];

    // Fetch Email Configuration using model helper
    const config = await EmailConfiguration.findByFormDeptAndSection(
        "3-Day Monitoring Sheet", 
        operator.departmentId, 
        null
    );

    if (!config) {
        console.warn(`[3Day] No active email configuration found for 3-Day Monitoring Sheet (Dept: ${operator.departmentId})`);
        throw new ApiError("Email configuration not found for 3-Day Monitoring Sheet. Please configure it in Email Settings.", 404);
    }

    const toRecipients = parseEmails(config.toEmails);
    const ccRecipients = parseEmails(config.ccEmails);

    if (toRecipients.length === 0) {
        console.warn(`[3Day] No recipients found in email configuration (ID: ${config.id})`);
        throw new ApiError("No recipients configured for this report", 400);
    }

    // Fetch Training Config (for categories/rows)
    const trainingConfig = await MonitoringConfig.findByTypeAndDepartment('3DAY', operator.departmentId);
    const gridConfig = trainingConfig?.config || [];

    const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/3-day-monitoring/${sid}`;

    const html = generateThreeDayMonitoringEmail({
        operatorName: operator.fullName,
        employeeCode: operator.empId,
        departmentName: operator.deptName || "N/A",
        processName: sheet.processName || "N/A",
        lineName: sheet.lineName || "N/A",
        headerInfo: {
            checkedBy: sheet.checkedBy,
            verifiedBy: sheet.verifiedBy,
            approvedBy: sheet.approvedBy
        },
        gridData: sheet.entries || {},
        config: gridConfig,
        portalUrl
    });

    // 4. Send Email
    await sendMail(
        toRecipients.join(', '), 
        `3-Day Monitoring Report: ${operator.fullName}`, 
        html, 
        [], 
        ccRecipients.join(', ')
    );

    // Also trigger background Excel report notification
    NotificationService.sendFormReport("3-Day Monitoring Sheet", operator.departmentId, sheet, studentId)
        .catch(err => console.error("[3Day] Background notification failed:", err));

    return res.status(200).json(new ApiResponse(200, null, "Monitoring report emailed successfully"));
});

export const getThreeDayMonitoringConfig = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const sectionId = req.query.sectionId || 0;
    const config = await MonitoringConfig.findByTypeAndDepartment('3DAY', departmentId, sectionId);
    return res.status(200).json(
        new ApiResponse(200, { config: config?.config || null }, "3 Day Monitoring config fetched")
    );
});

export const saveThreeDayMonitoringConfig = asyncHandler(async (req, res) => {
    const { departmentId, sectionId = 0, config, remark } = req.body;
    await MonitoringConfig.upsert({
        type: '3DAY',
        departmentId,
        sectionId,
        config,
        remark,
        updatedBy: req.user?.fullName || req.user?.name
    });
    return res.status(200).json(
        new ApiResponse(200, null, "3 Day Monitoring config saved")
    );
});

export const getThreeDayMonitoringHistory = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const sectionId = req.query.sectionId || 0;
    const history = await MonitoringConfig.getHistory('3DAY', departmentId, sectionId);
    return res.status(200).json(
        new ApiResponse(200, history, "3 Day Monitoring history fetched")
    );
});
