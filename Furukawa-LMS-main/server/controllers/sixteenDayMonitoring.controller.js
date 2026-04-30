import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import NotificationService from "../services/notification.service.js";
import SixteenDayMonitoring from "../models/sixteenDayMonitoring.model.js";
import MonitoringConfig from "../models/monitoringConfig.model.js";
import EmailConfiguration from "../models/emailConfiguration.model.js";
import sendMail from "../utils/mail.util.js";
import emailTemplates from "../utils/emailTemplates.js";
import ENV from "../configs/env.config.js";

import { executeQuery } from "../db/mssqlHelper.js";

// Helper to resolve studentId (from ID, userName, empId or slug)
const resolveStudentId = async (studentId) => {
    if (!studentId) return null;
    let users;
    // Check if it's already a number
    if (!isNaN(studentId) && !isNaN(parseFloat(studentId))) {
        [users] = await executeQuery("SELECT id FROM users WHERE id = ?", [studentId]);
        if (users.length > 0) return users[0].id;
    }
    // Otherwise check userName, slug or empId
    [users] = await executeQuery("SELECT id FROM users WHERE userName = ? OR slug = ? OR empId = ?", [studentId, studentId, studentId]);
    return users.length > 0 ? users[0].id : null;
};

export const getSixteenDayMonitoring = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    // Authorization check: User can access if they are the owner OR have management permissions
    const isOwner = String(req.user.id) === String(sid);
    const hasManagePermission = req.user.isAdmin || req.user.isTrainer || 
                                (req.user.role === 'CUSTOM' && req.user.customRole?.permissions?.includes('sixteen_day:manage'));

    if (!isOwner && !hasManagePermission) {
        throw new ApiError("You do not have permission to view this monitoring record", 403);
    }

    let data = await SixteenDayMonitoring.findByStudentId(sid);
    
    // Fetch handover marks & approval date to pre-populate if needed
    const [handoverRows] = await executeQuery(`
        SELECT TOP 1 
            JSON_VALUE(entry.value, '$.marks') as marks,
            JSON_VALUE(entry.value, '$.statusActionAt') as handoverDate
        FROM handover_sheets
        CROSS APPLY OPENJSON(entries) as entry
        WHERE JSON_VALUE(entry.value, '$.studentId') = ?
        AND JSON_VALUE(entry.value, '$.interviewStatus') = 'APPROVE'
        ORDER BY createdAt DESC
    `, [sid]);

    const handoverInfo = handoverRows.length > 0 ? handoverRows[0] : null;

    if (!data) {
        return res.status(200).json(
            new ApiResponse(200, { 
                isNew: true,
                headerInfo: { 
                    trgResult: handoverInfo?.marks || "",
                    handoverDate: handoverInfo?.handoverDate ? handoverInfo.handoverDate.split('T')[0] : ""
                }
            }, "No record found")
        );
    }

    // If existing record has empty fields, auto-fill them from handover sheet
    if (!data.trgResult && handoverInfo?.marks) {
        data.trgResult = handoverInfo.marks;
    }
    if (!data.handoverDate && handoverInfo?.handoverDate) {
        data.handoverDate = handoverInfo.handoverDate.split('T')[0];
    }

    return res.status(200).json(
        new ApiResponse(200, {
            ...data,
            isNew: false,
        }, "16 Day Monitoring fetched successfully")
    );
});

export const saveSixteenDayMonitoring = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    // Authorization check: Only Trainers, Admins, or Custom Roles with manage permission can save
    const isOwner = String(req.user.id) === String(sid);
    const hasManagePermission = req.user.isAdmin || req.user.isTrainer || 
                                (req.user.role === 'CUSTOM' && req.user.customRole?.permissions?.includes('sixteen_day:manage'));

    if (!isOwner && !hasManagePermission) {
        throw new ApiError("You do not have permission to save this monitoring record", 403);
    }

    const { 
        employeeName, employeeCode, processName, dept,
        handoverDate, trgResult, workingWith, lineLeaderName,
        gridData, checkedBy, verifiedBy, approvedBy, status
    } = req.body;

    let sheet = await SixteenDayMonitoring.findByStudentId(sid);

    if (sheet) {
        sheet.employeeName = employeeName;
        sheet.employeeCode = employeeCode;
        sheet.processName = processName;
        sheet.dept = dept;
        sheet.handoverDate = handoverDate;
        sheet.trgResult = trgResult;
        sheet.workingWith = workingWith;
        sheet.lineLeaderName = lineLeaderName;
        sheet.gridData = gridData;
        sheet.checkedBy = checkedBy;
        sheet.verifiedBy = verifiedBy;
        sheet.approvedBy = approvedBy;
        sheet.status = status || sheet.status;
        sheet.updatedBy = req.user?.fullName || req.user?.name;
        await sheet.save();
    } else {
        sheet = await SixteenDayMonitoring.create({
            studentId: sid,
            employeeName,
            employeeCode,
            processName,
            dept,
            handoverDate,
            trgResult,
            workingWith,
            lineLeaderName,
            gridData,
            checkedBy,
            verifiedBy,
            approvedBy,
            createdBy: req.user?.fullName || req.user?.name,
            status: status || "Draft"
        });
    }

    // Trigger Email Notification
    NotificationService.sendFormReport("16-Day Monitoring Sheet", null, req.body, studentId)
        .catch(err => console.error("[16Day] Notification failed:", err));

    return res.status(200).json(
        new ApiResponse(200, sheet, "16 Day Monitoring saved successfully")
    );
});

export const sendSixteenDayMonitoringEmail = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    const sheet = await SixteenDayMonitoring.findByStudentId(sid);
    if (!sheet) throw new ApiError("Monitoring record not found", 404);

    // 1. Get recipients from EmailConfiguration
    // We need to find the dept ID from name or from user
    const [users] = await executeQuery("SELECT departmentId, sectionId, fullName, empId FROM users WHERE id = ?", [sid]);
    const student = users[0];
    
    // Find config for "16-Day Monitoring Sheet"
    const config = await EmailConfiguration.findByFormDeptAndSection(
        "16-Day Monitoring Sheet", 
        student?.departmentId, 
        student?.sectionId
    );

    if (!config) {
        throw new ApiError("No email configuration found for 16-Day Monitoring. Please set up recipients in Settings.", 400);
    }

    // Prepare recipients
    let to = config.toEmails || "";
    let cc = config.ccEmails || "";

    // If include trainer, find trainers for this department
    if (config.includeTrainer && student?.departmentId) {
        const [trainers] = await executeQuery(
            "SELECT email FROM users WHERE departmentId = ? AND (isTrainer = 1 OR role = 'INSTRUCTOR')", 
            [student.departmentId]
        );
        const trainerEmails = trainers.map(t => t.email).filter(e => e).join(", ");
        if (trainerEmails) {
            to = to ? `${to}, ${trainerEmails}` : trainerEmails;
        }
    }

    if (!to) {
        throw new ApiError("No recipient emails found in configuration.", 400);
    }

    // 2. Get Monitoring Config (to render labels in email)
    const monitoringConfig = await MonitoringConfig.findByTypeAndDepartment('16DAY', student?.departmentId, student?.sectionId);
    const sheetConfig = monitoringConfig?.config || null;

    // 3. Generate HTML
    const portalUrl = `${ENV.ADMIN_URL || 'http://localhost:5173'}/admin/16-day-monitoring/${studentId}`;
    
    const html = emailTemplates.generateSixteenDayMonitoringEmail({
        operatorName: student?.fullName || sheet.employeeName,
        employeeCode: student?.empId || sheet.employeeCode,
        departmentName: sheet.dept || "N/A",
        processName: sheet.processName || "N/A",
        headerInfo: {
            handoverDate: sheet.handoverDate,
            checkedBy: sheet.checkedBy,
            verifiedBy: sheet.verifiedBy,
            approvedBy: sheet.approvedBy
        },
        gridData: sheet.gridData,
        config: sheetConfig || [], // Empty list if no config found
        portalUrl
    });

    // 4. Send Email
    await sendMail(to, `16-Day Monitoring Report: ${student?.fullName || sheet.employeeName}`, html, [], cc);

    return res.status(200).json(
        new ApiResponse(200, null, "Monitoring report emailed successfully")
    );
});

export const getSixteenDayMonitoringConfig = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const sectionId = req.query.sectionId || 0;
    const config = await MonitoringConfig.findByTypeAndDepartment('16DAY', departmentId, sectionId);
    return res.status(200).json(
        new ApiResponse(200, { config: config?.config || null }, "16 Day Monitoring config fetched")
    );
});

export const saveSixteenDayMonitoringConfig = asyncHandler(async (req, res) => {
    const { departmentId, sectionId = 0, config, remark } = req.body;
    await MonitoringConfig.upsert({
        type: '16DAY',
        departmentId,
        sectionId,
        config,
        remark,
        updatedBy: req.user?.fullName || req.user?.name
    });
    return res.status(200).json(
        new ApiResponse(200, null, "16 Day Monitoring config saved")
    );
});

export const getSixteenDayMonitoringHistory = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const sectionId = req.query.sectionId || 0;
    const history = await MonitoringConfig.getHistory('16DAY', departmentId, sectionId);
    return res.status(200).json(
        new ApiResponse(200, history, "16 Day Monitoring history fetched")
    );
});
