import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import MenteeFeedback from "../models/menteeFeedback.model.js";
import EmailConfiguration from "../models/emailConfiguration.model.js";
import sendMail from "../utils/mail.util.js";
import emailTemplates from "../utils/emailTemplates.js";
import ENV from "../configs/env.config.js";
import { executeQuery } from "../db/mssqlHelper.js";
import RevisionRecordService from "../services/revisionRecord.service.js";

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

export const getMenteeFeedback = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    // Authorization check
    const isOwner = String(req.user.id) === String(sid);
    const hasViewPermission = req.user.isAdmin || req.user.isTrainer || 
                               (req.user.role === 'CUSTOM' && (req.user.customRole?.permissions?.includes('mentee_feedback:view') || req.user.customRole?.permissions?.includes('mentee_feedback:manage')));

    if (!isOwner && !hasViewPermission) {
        throw new ApiError("You do not have permission to view this feedback record", 403);
    }

    const data = await MenteeFeedback.findByStudentId(sid);
    
    if (!data) {
        return res.status(200).json(
            new ApiResponse(200, { isNew: true }, "No feedback record found")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, {
            ...data,
            isNew: false,
        }, "Mentee feedback fetched successfully")
    );
});

export const saveMenteeFeedback = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    // Authorization check: Only Trainers, Admins, or Custom Roles with manage/edit_submitted permission can save
    // Mentee (student) should also be able to save their own feedback if they are the owner
    const isOwner = String(req.user.id) === String(sid);
    const hasManagePermission = req.user.isAdmin || req.user.isTrainer ||
                                (req.user.role === 'CUSTOM' && (
                                    req.user.customRole?.permissions?.includes('mentee_feedback:manage') ||
                                    req.user.customRole?.permissions?.includes('mentee_feedback:edit_submitted')
                                ));

    if (!isOwner && !hasManagePermission) {
        throw new ApiError("You do not have permission to save this feedback record", 403);
    }

    const { topTableData, dailyLogs, status } = req.body;

    let feedback = await MenteeFeedback.findByStudentId(sid);

    if (feedback) {
        feedback.topTableData = topTableData;
        feedback.dailyLogs = dailyLogs;
        feedback.status = status || feedback.status;
        feedback.updatedBy = req.user?.fullName || req.user?.name;
        await feedback.save();
    } else {
        // Freeze whatever the Revision Table currently says for this form; the
        // update branch above never touches these columns.
        const revision = await RevisionRecordService.getLatestForSheet('mentee-feedback');

        feedback = await MenteeFeedback.create({
            studentId: sid,
            topTableData,
            dailyLogs,
            createdBy: req.user?.fullName || req.user?.name,
            status: status || "Draft",
            docNo: revision?.docNo,
            revNo: revision?.revNo,
            revDate: revision?.revDate,
        });
    }

    return res.status(200).json(
        new ApiResponse(200, feedback, "Mentee feedback saved successfully")
    );
});

export const sendMenteeFeedbackEmail = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    const sheet = await MenteeFeedback.findByStudentId(sid);
    if (!sheet) throw new ApiError("Feedback record not found", 404);

    // 1. Get recipients from EmailConfiguration
    const [users] = await executeQuery(`
        SELECT u.departmentId, u.sectionId, u.fullName, u.empId, d.name as departmentName 
        FROM users u 
        LEFT JOIN departments d ON u.departmentId = d.id 
        WHERE u.id = ?
    `, [sid]);
    const student = users[0];
    
    // Find config for "Mentee Feedback Monitoring Sheet"
    const config = await EmailConfiguration.findByFormDeptAndSection(
        "Mentee Feedback Monitoring Sheet", 
        student?.departmentId, 
        student?.sectionId
    );

    if (!config) {
        throw new ApiError("No email configuration found for Mentee Feedback. Please set up recipients in Settings.", 400);
    }

    // Prepare recipients
    let toArr = (config.toEmails || "").split(',').map(e => e.trim()).filter(Boolean);
    let ccArr = (config.ccEmails || "").split(',').map(e => e.trim()).filter(Boolean);

    // If include trainer, find trainers for this department
    if (config.includeTrainer && student?.departmentId) {
        const [trainers] = await executeQuery(
            "SELECT email FROM users WHERE departmentId = ? AND (isTrainer = 1 OR role = 'INSTRUCTOR' OR role = 'ADMIN')", 
            [student.departmentId]
        );
        trainers.forEach(t => {
            if (t.email && !toArr.includes(t.email)) {
                toArr.push(t.email);
            }
        });
    }

    const to = toArr.join(", ");
    const cc = ccArr.join(", ");

    if (!to) {
        throw new ApiError("No recipient emails found in configuration.", 400);
    }

    // 2. Generate HTML
    const portalUrl = `${ENV.ADMIN_URL || 'http://localhost:5173'}/admin/16-day-monitoring/${studentId}`;
    
    const html = emailTemplates.generateMenteeFeedbackEmail({
        operatorName: student?.fullName || "N/A",
        employeeCode: student?.empId || "N/A",
        departmentName: student?.departmentName || "N/A",
        topTableData: sheet.topTableData,
        dailyLogs: sheet.dailyLogs,
        portalUrl
    });

    // 3. Send Email
    await sendMail(to, `Mentee Feedback Monitoring Report: ${student?.fullName}`, html, [], cc);

    return res.status(200).json(
        new ApiResponse(200, null, "Feedback report emailed successfully")
    );
});
