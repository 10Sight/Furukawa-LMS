import ExcelJS from "exceljs";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import NotificationService from "../services/notification.service.js";
import SixteenDayMonitoring from "../models/sixteenDayMonitoring.model.js";
import SkillUpgradationPlan from "../models/skillUpgradationPlan.model.js";
import CourseLevelConfig from "../models/courseLevelConfig.model.js";
import MenteeFeedback from "../models/menteeFeedback.model.js";
import MonitoringConfig from "../models/monitoringConfig.model.js";
import EmailConfiguration from "../models/emailConfiguration.model.js";
import sendMail from "../utils/mail.util.js";
import emailTemplates from "../utils/emailTemplates.js";
import ENV from "../configs/env.config.js";

import { executeQuery } from "../db/mssqlHelper.js";
import logAudit from "../utils/auditLogger.js";
import RevisionRecordService from "../services/revisionRecord.service.js";
import { getNextCalendarDayMidnightIST } from "../utils/istDate.util.js";

// A signature is "validly signed" when it's filled and wasn't a rejection —
// this is the same notion of validity the client gates its sign-off buttons on.
const isApprovedSig = (sig) => Boolean(sig && typeof sig === 'string' && sig.trim() !== '' && !sig.toLowerCase().includes('rejected'));

// Trust-boundary re-check of the 4-tier sign-off order (Checked -> Verified -> Approved
// -> Verified by Edu Cell). The frontend already gates this in the UI, but a direct API
// call could otherwise write a later-stage signature without its prerequisites ever
// having been approved. Admins may override, matching their override of other locks
// on this sheet (isCellLocked, isSheetSaved edits, etc).
function validateSignatureProgression({ checkedBy, verifiedBy, approvedBy, verifiedByEduCell }, isAdmin = false) {
    if (isAdmin) return;
    if (verifiedBy && !isApprovedSig(checkedBy)) {
        throw new ApiError("Cannot verify sheet: 'Checked By' must be completed and approved first.", 400);
    }
    if (approvedBy && (!isApprovedSig(checkedBy) || !isApprovedSig(verifiedBy))) {
        throw new ApiError("Cannot approve sheet: 'Checked By' and 'Verified By' must be approved first.", 400);
    }
    if (verifiedByEduCell && (!isApprovedSig(checkedBy) || !isApprovedSig(verifiedBy) || !isApprovedSig(approvedBy))) {
        throw new ApiError("Cannot verify by Education/Training Cell: 'Checked By', 'Verified By', and 'Approved By' must be completed first.", 400);
    }
}

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

export const listSixteenDayMonitoring = asyncHandler(async (req, res) => {
    const { departmentId, sectionId, lineId } = req.query;

    if (!departmentId) {
        throw new ApiError("Department ID is required", 400);
    }

    let query = `
        WITH ApprovedHandovers AS (
            SELECT
                TRY_CAST(JSON_VALUE(entry.value, '$.studentId') AS INT) as studentId,
                JSON_VALUE(entry.value, '$.statusActionAt') as handoverApprovedAt,
                ROW_NUMBER() OVER (
                    PARTITION BY TRY_CAST(JSON_VALUE(entry.value, '$.studentId') AS INT)
                    ORDER BY hs.createdAt DESC
                ) as rn
            FROM handover_sheets hs
            CROSS APPLY OPENJSON(hs.entries) as entry
            WHERE hs.departmentId = ?
              AND JSON_VALUE(entry.value, '$.interviewStatus') = 'APPROVE'
        )
        SELECT
            u.id, u.fullName, u.empId, u.avatar, u.departmentId, u.sectionId, u.status as userStatus,
            d.name as departmentName, s.name as sectionName,
            m.status, m.checkedBy, m.verifiedBy, m.approvedBy, m.verifiedByEduCell, m.updatedAt, m.attemptNumber, m.startDate, m.gridData, m.adminRemarksHistory,
            stats.totalAttempts, stats.rejectedCount,
            ho.handoverApprovedAt
        FROM users u
        LEFT JOIN departments d ON u.departmentId = d.id
        LEFT JOIN sections s ON u.sectionId = s.id
        LEFT JOIN (
            SELECT studentId, status, checkedBy, verifiedBy, approvedBy, verifiedByEduCell, updatedAt, attemptNumber, startDate, gridData, adminRemarksHistory,
                   ROW_NUMBER() OVER(PARTITION BY studentId ORDER BY attemptNumber DESC, createdAt DESC) as rn
            FROM sixteen_day_monitorings
        ) m ON u.id = m.studentId AND m.rn = 1
        LEFT JOIN (
            SELECT studentId, COUNT(*) as totalAttempts,
                   SUM(CASE WHEN verifiedBy LIKE '%Rejected%' OR approvedBy LIKE '%Rejected%' OR verifiedByEduCell LIKE '%Rejected%' THEN 1 ELSE 0 END) as rejectedCount
            FROM sixteen_day_monitorings
            GROUP BY studentId
        ) stats ON u.id = stats.studentId
        INNER JOIN ApprovedHandovers ho ON ho.studentId = u.id AND ho.rn = 1
        WHERE u.departmentId = ?
        AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
    `;
    const params = [departmentId, departmentId];

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

    const formattedRows = rows.map(row => {
        if (row.gridData) {
            try {
                row.gridData = JSON.parse(row.gridData);
            } catch (e) {
                row.gridData = {};
            }
        } else {
            row.gridData = {};
        }
        if (row.adminRemarksHistory) {
            try {
                row.adminRemarksHistory = JSON.parse(row.adminRemarksHistory);
            } catch (e) {
                row.adminRemarksHistory = [];
            }
        } else {
            row.adminRemarksHistory = [];
        }

        if (row.handoverApprovedAt) {
            const eligibleAtMs = getNextCalendarDayMidnightIST(row.handoverApprovedAt).getTime();
            row.eligibleAt = new Date(eligibleAtMs).toISOString();
            row.isEligible = Date.now() >= eligibleAtMs;
        } else {
            row.eligibleAt = null;
            row.isEligible = true;
        }

        return row;
    });

    return res.status(200).json(
        new ApiResponse(200, formattedRows, "16-Day monitoring status list fetched successfully")
    );
});

export const getSixteenDayMonitoring = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    // Authorization check: User can access if they are the owner OR have management/verification permissions
    const isOwner = String(req.user.id) === String(sid);
    const hasManagePermission = req.user.isAdmin || req.user.isTrainer ||
                                 (req.user.role === 'CUSTOM' && (
                                     req.user.customRole?.permissions?.includes('sixteen_day:manage') ||
                                     req.user.customRole?.permissions?.includes('sixteen_day:check') ||
                                     req.user.customRole?.permissions?.includes('sixteen_day:verify') ||
                                     req.user.customRole?.permissions?.includes('sixteen_day:approve') ||
                                     req.user.customRole?.permissions?.includes('sixteen_day:verify_education')
                                 ));

    if (!isOwner && !hasManagePermission) {
        throw new ApiError("You do not have permission to view this monitoring record", 403);
    }

    let data;
    const recordId = req.query.recordId;

    if (recordId) {
        data = await SixteenDayMonitoring.findById(recordId);
    } else {
        data = await SixteenDayMonitoring.findByStudentId(sid);
    }
    
    // Resolve the candidate's current name, code, dept/section, and departmentId from the users table
    const [userRows] = await executeQuery(`
        SELECT u.fullName, u.empId, u.status, u.departmentId, d.name as departmentName, s.name as sectionName
        FROM users u
        LEFT JOIN departments d ON u.departmentId = d.id
        LEFT JOIN sections s ON u.sectionId = s.id
        WHERE u.id = ?
    `, [sid]);
    const student = userRows.length > 0 ? userRows[0] : null;

    // Fetch handover marks & approval date to pre-populate if needed.
    // Scoping to the student's departmentId first lets SQL Server filter out
    // unrelated handover_sheets rows before expanding/parsing their entries JSON.
    const [handoverRows] = await executeQuery(`
        SELECT TOP 1
            JSON_VALUE(entry.value, '$.marks') as marks,
            CONVERT(VARCHAR, hs.date, 23) as handoverSheetDate,
            JSON_VALUE(entry.value, '$.statusActionAt') as handoverApprovedAt
        FROM handover_sheets hs
        CROSS APPLY OPENJSON(entries) as entry
        WHERE hs.departmentId = ?
        AND JSON_VALUE(entry.value, '$.studentId') = ?
        AND JSON_VALUE(entry.value, '$.interviewStatus') = 'APPROVE'
        ORDER BY hs.createdAt DESC
    `, [student?.departmentId ?? null, sid]);

    const handoverInfo = handoverRows.length > 0 ? handoverRows[0] : null;
    const resolvedHandoverDate = handoverInfo?.handoverSheetDate
        || (handoverInfo?.handoverApprovedAt ? handoverInfo.handoverApprovedAt.split('T')[0] : null);

    let eligibleAt = null;
    let isEligible = true;
    if (handoverInfo?.handoverApprovedAt) {
        const eligibleAtMs = getNextCalendarDayMidnightIST(handoverInfo.handoverApprovedAt).getTime();
        eligibleAt = new Date(eligibleAtMs).toISOString();
        isEligible = Date.now() >= eligibleAtMs;
    }
    const canOverrideEligibility = !!(req.user.isAdmin || req.user.isTrainer);
    const resolvedDept = student
        ? [student.departmentName, student.sectionName].filter(Boolean).join(" / ")
        : "";
    const userStatus = student?.status || "PRESENT";

    if (!data) {
        return res.status(200).json(
            new ApiResponse(200, {
                isNew: true,
                userStatus,
                handoverApprovedAt: handoverInfo?.handoverApprovedAt || null,
                eligibleAt,
                isEligible,
                canOverrideEligibility,
                headerInfo: {
                    employeeName: student?.fullName || "",
                    employeeCode: student?.empId || "",
                    dept: resolvedDept,
                    trgResult: handoverInfo?.marks || "",
                    handoverDate: resolvedHandoverDate || ""
                }
            }, "No record found")
        );
    }

    // If existing record has empty fields, auto-fill them from handover sheet / user record
    if (!data.trgResult && handoverInfo?.marks) {
        data.trgResult = handoverInfo.marks;
    }
    if (!data.handoverDate && resolvedHandoverDate) {
        data.handoverDate = resolvedHandoverDate;
    }
    if (!data.employeeName && student?.fullName) {
        data.employeeName = student.fullName;
    }
    if (!data.employeeCode && student?.empId) {
        data.employeeCode = student.empId;
    }
    if (!data.dept && resolvedDept) {
        data.dept = resolvedDept;
    }

    return res.status(200).json(
        new ApiResponse(200, {
            ...data,
            isNew: false,
            userStatus,
            handoverApprovedAt: handoverInfo?.handoverApprovedAt || null,
            eligibleAt,
            isEligible,
            canOverrideEligibility,
        }, "16 Day Monitoring fetched successfully")
    );
});

export const getStudentSixteenDayMonitoringHistory = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    const history = await SixteenDayMonitoring.findAllByStudentId(sid);
    return res.status(200).json(
        new ApiResponse(200, history, "Monitoring history fetched successfully")
    );
});

export const saveSixteenDayMonitoring = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    // Authorization check: Only Trainers, Admins, or Custom Roles with manage/verify/approve/edu-cell/edit_submitted permissions can save
    const isOwner = String(req.user.id) === String(sid);
    const hasManagePermission = req.user.isAdmin || req.user.isTrainer ||
                                (req.user.role === 'CUSTOM' && (
                                    req.user.customRole?.permissions?.includes('sixteen_day:manage') ||
                                    req.user.customRole?.permissions?.includes('sixteen_day:check') ||
                                    req.user.customRole?.permissions?.includes('sixteen_day:verify') ||
                                    req.user.customRole?.permissions?.includes('sixteen_day:approve') ||
                                    req.user.customRole?.permissions?.includes('sixteen_day:verify_education') ||
                                    req.user.customRole?.permissions?.includes('sixteen_day:edit_submitted')
                                ));

    if (!isOwner && !hasManagePermission) {
        throw new ApiError("You do not have permission to save this monitoring record", 403);
    }

    const [userStatusRows] = await executeQuery("SELECT status, departmentId FROM users WHERE id = ?", [sid]);
    const isLeftUser = userStatusRows.length > 0 && userStatusRows[0].status === 'LEFT';
    const studentDepartmentId = userStatusRows.length > 0 ? userStatusRows[0].departmentId : null;

    // Eligibility gate: only applies before the very first attempt is created.
    // Admins/Trainers can override and start monitoring early.
    const canOverrideEligibility = req.user.isAdmin || req.user.isTrainer;
    if (!canOverrideEligibility) {
        const existingAttempt = await SixteenDayMonitoring.findByStudentId(sid);
        if (!existingAttempt) {
            // Scoping to the student's departmentId lets SQL Server filter out
            // unrelated handover_sheets rows before expanding/parsing their entries JSON.
            const [approvalRows] = await executeQuery(`
                SELECT TOP 1 JSON_VALUE(entry.value, '$.statusActionAt') as approvedAt
                FROM handover_sheets hs
                CROSS APPLY OPENJSON(hs.entries) as entry
                WHERE hs.departmentId = ?
                  AND JSON_VALUE(entry.value, '$.studentId') = ?
                  AND JSON_VALUE(entry.value, '$.interviewStatus') = 'APPROVE'
                ORDER BY hs.createdAt DESC
            `, [studentDepartmentId, sid]);
            const approvedAt = approvalRows[0]?.approvedAt;
            if (approvedAt) {
                const eligibleAtMs = getNextCalendarDayMidnightIST(approvedAt).getTime();
                if (Date.now() < eligibleAtMs) {
                    throw new ApiError("16-Day Monitoring can only be started on the next calendar day after Handover approval.", 400);
                }
            }
        }
    }

    let {
        employeeName, employeeCode, processName, dept,
        handoverDate, trgResult, workingWith, lineLeaderName,
        gridData, checkedBy, verifiedBy, approvedBy, verifiedByEduCell, status,
        isNewAttempt, recordId, startDate, adminRemark
    } = req.body;

    let sheet;
    if (recordId) {
        sheet = await SixteenDayMonitoring.findById(recordId);
    } else if (!isNewAttempt) {
        sheet = await SixteenDayMonitoring.findByStudentId(sid);
    }

    // LEFT associates: pin the performance data and header fields to their persisted
    // values server-side, regardless of what the client sends. Only the comment, the
    // signature/approval fields and the submission status may change. This can't be
    // enforced by the frontend UI lock alone since this endpoint is a real trust boundary.
    if (isLeftUser) {
        if (!sheet || isNewAttempt) {
            throw new ApiError("This associate has left. A new monitoring attempt cannot be created.", 400);
        }
        const incomingComment = (gridData && gridData.comment) || '';
        employeeName = sheet.employeeName;
        employeeCode = sheet.employeeCode;
        processName = sheet.processName;
        dept = sheet.dept;
        handoverDate = sheet.handoverDate;
        trgResult = sheet.trgResult;
        workingWith = sheet.workingWith;
        lineLeaderName = sheet.lineLeaderName;
        checkedBy = checkedBy !== undefined ? checkedBy : sheet.checkedBy;
        verifiedBy = verifiedBy !== undefined ? verifiedBy : sheet.verifiedBy;
        approvedBy = approvedBy !== undefined ? approvedBy : sheet.approvedBy;
        verifiedByEduCell = verifiedByEduCell !== undefined ? verifiedByEduCell : sheet.verifiedByEduCell;
        startDate = sheet.startDate;
        gridData = { ...sheet.gridData, comment: incomingComment };
    }

    validateSignatureProgression({ checkedBy, verifiedBy, approvedBy, verifiedByEduCell }, req.user?.isAdmin);

    let updatedHistory = [];
    const oldCheckedBy = (sheet && !isNewAttempt) ? sheet.checkedBy : null;
    const oldVerifiedBy = (sheet && !isNewAttempt) ? sheet.verifiedBy : null;
    const oldApprovedBy = (sheet && !isNewAttempt) ? sheet.approvedBy : null;
    const oldVerifiedByEduCell = (sheet && !isNewAttempt) ? sheet.verifiedByEduCell : null;
    if (sheet && !isNewAttempt) {
        updatedHistory = Array.isArray(sheet.adminRemarksHistory) ? sheet.adminRemarksHistory : [];
    }

    if (adminRemark && adminRemark.trim()) {
        updatedHistory.push({
            adminName: req.user?.fullName || req.user?.name || "Admin",
            remark: adminRemark.trim(),
            createdAt: new Date().toISOString()
        });
    }

    if (sheet && !isNewAttempt) {
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
        sheet.verifiedByEduCell = verifiedByEduCell;
        sheet.status = status || sheet.status;
        sheet.startDate = startDate;
        sheet.updatedBy = req.user?.fullName || req.user?.name;
        sheet.adminRemarksHistory = updatedHistory;
        await sheet.save();
    } else {
        // Find latest attempt number
        const latest = await SixteenDayMonitoring.findByStudentId(sid);
        const nextAttempt = latest ? (latest.attemptNumber + 1) : 1;

        // Freeze whatever the Revision Table currently says for this form — each new
        // attempt is a fresh physical copy of the form, so it gets the current
        // revision; the update branch above never touches these columns afterwards.
        // This model has no department/section of its own, so resolve the student's
        // current assignment.
        const [studentRows] = await executeQuery("SELECT departmentId, sectionId FROM users WHERE id = ?", [sid]);
        const student = studentRows[0] || {};
        const revision = await RevisionRecordService.getLatestForSheet('sixteen-day-monitoring', student.departmentId || null, student.sectionId || null);

        sheet = await SixteenDayMonitoring.create({
            studentId: sid,
            attemptNumber: nextAttempt,
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
            verifiedByEduCell,
            createdBy: req.user?.fullName || req.user?.name,
            status: status || "Draft",
            startDate,
            adminRemarksHistory: updatedHistory,
            docNo: revision?.docNo,
            revNo: revision?.revNo,
            revDate: revision?.revDate,
        });
    }

    // Sync to Skill Upgradation Plan the moment the approval signature transitions
    // into "Approved" (first attempt creation or a later edit to an existing sheet).
    const wasApproved = (oldApprovedBy || "").toLowerCase().includes("approved by");
    const isApprovedNow = (approvedBy || "").toLowerCase().includes("approved by");
    if (isApprovedNow && !wasApproved) {
        try {
            const activeConfig = await CourseLevelConfig.getActiveConfig();
            await SkillUpgradationPlan.syncSixteenDayApproval(sid, new Date(), activeConfig);
        } catch (err) {
            console.error("[SixteenDayMonitoring] Failed to sync to SkillUpgradationPlan:", err);
        }
    }

    // --- Audit Logging ---
    const auditMeta = { resourceType: "SixteenDayMonitoring", resourceId: sheet.id, req };
    const auditDetails = {
        studentId: sid,
        employeeName: sheet.employeeName,
        attemptNumber: sheet.attemptNumber,
    };

    const saveAction = (status || sheet.status) === "Submitted" ? "SUBMIT_SIXTEEN_DAY_MONITORING" : "SAVE_SIXTEEN_DAY_MONITORING_DRAFT";
    logAudit(req.user?.id, saveAction, auditDetails, auditMeta).catch(err =>
        console.error(`logAudit(${saveAction}) failed:`, err.message)
    );

    if (checkedBy && checkedBy !== oldCheckedBy) {
        const outcome = checkedBy.includes("Rejected") ? "Rejected" : "Approved";
        logAudit(req.user?.id, "CHECK_SIXTEEN_DAY_MONITORING", { ...auditDetails, outcome, checkedBy }, auditMeta).catch(err =>
            console.error("logAudit(CHECK_SIXTEEN_DAY_MONITORING) failed:", err.message)
        );
    }

    if (verifiedBy && verifiedBy !== oldVerifiedBy) {
        const outcome = verifiedBy.includes("Rejected") ? "Rejected" : "Approved";
        logAudit(req.user?.id, "VERIFY_SIXTEEN_DAY_MONITORING", { ...auditDetails, outcome, verifiedBy }, auditMeta).catch(err =>
            console.error("logAudit(VERIFY_SIXTEEN_DAY_MONITORING) failed:", err.message)
        );
    }

    if (approvedBy && approvedBy !== oldApprovedBy) {
        const outcome = approvedBy.includes("Rejected") ? "Rejected" : "Approved";
        logAudit(req.user?.id, "APPROVE_SIXTEEN_DAY_MONITORING", { ...auditDetails, outcome, approvedBy }, auditMeta).catch(err =>
            console.error("logAudit(APPROVE_SIXTEEN_DAY_MONITORING) failed:", err.message)
        );

        // Notify the Training Cell automatically the moment "Approved By" is signed
        // (Approved or Rejected) — replaces the old manual "Send to Training Cell"
        // button. Fire-and-forget so a missing email config can't fail the save itself.
        dispatchTrainingCellEmail(sid, sheet, req.user, req).catch(err =>
            console.error("[SixteenDayMonitoring] Failed to dispatch Training Cell email:", err.message)
        );
    }

    if (verifiedByEduCell && verifiedByEduCell !== oldVerifiedByEduCell) {
        const outcome = verifiedByEduCell.includes("Rejected") ? "Rejected" : "Approved";
        logAudit(req.user?.id, "VERIFY_EDU_CELL_SIXTEEN_DAY_MONITORING", { ...auditDetails, outcome, verifiedByEduCell }, auditMeta).catch(err =>
            console.error("logAudit(VERIFY_EDU_CELL_SIXTEEN_DAY_MONITORING) failed:", err.message)
        );
    }
    // ---------------------

    // Trigger Email Notification
    if (req.body.triggerEmail === true) {
        NotificationService.sendFormReport("16-Day Monitoring Sheet", null, req.body, studentId)
            .catch(err => console.error("[16Day] Notification failed:", err));
    }

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
            approvedBy: sheet.approvedBy,
            verifiedByEduCell: sheet.verifiedByEduCell,
        },
        gridData: sheet.gridData,
        config: sheetConfig || [], 
        portalUrl
    });

    // 4. Send Email
    await sendMail(to, `16-Day Monitoring Report: ${student?.fullName || sheet.employeeName}`, html, [], cc);

    logAudit(req.user?.id, "EMAIL_SIXTEEN_DAY_MONITORING_REPORT", {
        studentId: sid, employeeName: student?.fullName || sheet.employeeName, to, cc
    }, { resourceType: "SixteenDayMonitoring", resourceId: sheet.id, req }).catch(err =>
        console.error("logAudit(EMAIL_SIXTEEN_DAY_MONITORING_REPORT) failed:", err.message)
    );

    return res.status(200).json(
        new ApiResponse(200, null, "Monitoring report emailed successfully")
    );
});

// The literal path segment "global" stands in for a NULL departmentId (the
// global template that applies when no more specific config exists).
const resolveDeptParam = (departmentId) => (departmentId === 'global' ? null : departmentId);

export const getSixteenDayMonitoringConfig = asyncHandler(async (req, res) => {
    const departmentId = resolveDeptParam(req.params.departmentId);
    const sectionId = req.query.sectionId || 0;
    const resolved = await MonitoringConfig.findByFilters('16DAY', departmentId, sectionId, 0, 0);
    // Tells the client which scope actually matched (hierarchical fallback can resolve to a
    // broader scope than requested), so the UI can make clear when a config is inherited.
    const resolvedScope = resolved ? {
        departmentId: resolved.departmentId,
        sectionId: resolved.sectionId,
    } : null;
    return res.status(200).json(
        new ApiResponse(200, { config: resolved?.config || null, resolvedScope }, "16 Day Monitoring config fetched")
    );
});

export const saveSixteenDayMonitoringConfig = asyncHandler(async (req, res) => {
    const { departmentId, sectionId = 0, config, remark } = req.body;
    await MonitoringConfig.upsert({
        type: '16DAY',
        departmentId: departmentId || null,
        sectionId,
        config,
        remark,
        updatedBy: req.user?.fullName || req.user?.name
    });

    logAudit(req.user?.id, "SAVE_SIXTEEN_DAY_MONITORING_CONFIG", { departmentId: departmentId || null, sectionId, remark }, {
        resourceType: "MonitoringConfig", resourceId: departmentId || 'global', req
    }).catch(err => console.error("logAudit(SAVE_SIXTEEN_DAY_MONITORING_CONFIG) failed:", err.message));

    return res.status(200).json(
        new ApiResponse(200, null, "16 Day Monitoring config saved")
    );
});

// RevisionRecord only scopes by (sheetKey, departmentId, sectionId) — no lineId/subSectionId
// concept, which matches 16-Day Monitoring's own scope model (department + section only).
// MonitoringConfig also uses departmentId=VARCHAR with the literal string 'global' as its
// "no department" sentinel and sectionId=0 for "not section-scoped", while RevisionRecord
// uses real SQL NULLs for both — these helpers translate between them.
const toRevisionDepartmentId = (departmentId) => {
    if (!departmentId || departmentId === 'global') return null;
    const parsed = parseInt(departmentId, 10);
    return Number.isNaN(parsed) ? null : parsed;
};
const toRevisionSectionId = (sectionId) => {
    const parsed = parseInt(sectionId, 10);
    return Number.isNaN(parsed) || parsed === 0 ? null : parsed;
};

// Atomically saves a 16-Day Monitoring layout config for a scope AND records the
// doc-control revision (docNo/revNo/revDate/changeDetails) that the layout change
// corresponds to, so a structural edit can never be saved without also updating
// the Revision Table entry operators/instructors see on the printed sheet.
export const saveSixteenDayMonitoringConfigWithRevision = asyncHandler(async (req, res) => {
    const { departmentId, sectionId = 0, config, remark, revision } = req.body || {};

    if (!config) throw new ApiError("Config is required", 400);
    if (!revision?.docNo?.trim() || !revision?.revNo?.trim()) {
        throw new ApiError("Document No. and Revision No. are required", 400);
    }

    await MonitoringConfig.upsert({
        type: '16DAY',
        departmentId: departmentId || null,
        sectionId,
        config,
        remark,
        updatedBy: req.user?.fullName || req.user?.name || req.user?.userName || "",
    });

    const savedRevision = await RevisionRecordService.upsertForScope(
        'sixteen-day-monitoring',
        toRevisionDepartmentId(departmentId),
        toRevisionSectionId(sectionId),
        {
            sheetName: "16 Day Monitoring",
            docNo: revision.docNo,
            revNo: revision.revNo,
            revDate: revision.revDate,
            affectedSrNoPage: revision.affectedSrNoPage,
            affectedSrNoPageHi: revision.affectedSrNoPageHi,
            changeDetails: revision.changeDetails,
            changeDetailsHi: revision.changeDetailsHi,
        },
        req.user
    );

    logAudit(req.user?.id, "SAVE_SIXTEEN_DAY_MONITORING_CONFIG_WITH_REVISION",
        { departmentId: departmentId || null, sectionId, remark, revisionRecordId: savedRevision.id, docNo: revision.docNo, revNo: revision.revNo },
        { resourceType: "MonitoringConfig", resourceId: departmentId || 'global', req }
    ).catch(err => console.error("logAudit(SAVE_SIXTEEN_DAY_MONITORING_CONFIG_WITH_REVISION) failed:", err.message));

    return res.status(200).json(new ApiResponse(200, { revision: savedRevision }, "16 Day Monitoring layout and revision saved"));
});

export const getSixteenDayMonitoringHistory = asyncHandler(async (req, res) => {
    const departmentId = resolveDeptParam(req.params.departmentId);
    const sectionId = req.query.sectionId || 0;
    const history = await MonitoringConfig.getHistory('16DAY', departmentId, sectionId);
    return res.status(200).json(
        new ApiResponse(200, history, "16 Day Monitoring history fetched")
    );
});

export const sendCombinedMonitoringEmail = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    const [sheet, feedback] = await Promise.all([
        SixteenDayMonitoring.findByStudentId(sid),
        MenteeFeedback.findByStudentId(sid),
    ]);

    if (!sheet) throw new ApiError("16-Day monitoring record not found", 404);

    const [users] = await executeQuery(`
        SELECT u.id, u.fullName, u.empId, u.departmentId, u.sectionId, d.name as departmentName
        FROM users u
        LEFT JOIN departments d ON u.departmentId = d.id
        WHERE u.id = ?
    `, [sid]);
    const student = users[0];

    // Resolve recipients — merge both email configs, deduplicate
    const [config16, configFeedback] = await Promise.all([
        EmailConfiguration.findByFormDeptAndSection("16-Day Monitoring Sheet", student?.departmentId, student?.sectionId),
        EmailConfiguration.findByFormDeptAndSection("Mentee Feedback Monitoring Sheet", student?.departmentId, student?.sectionId),
    ]);

    if (!config16 && !configFeedback) {
        throw new ApiError("No email configuration found. Please set up recipients in Settings.", 400);
    }

    const toSet = new Set();
    const ccSet = new Set();

    const addEmails = (str, target) => {
        (str || "").split(',').map(e => e.trim()).filter(Boolean).forEach(e => target.add(e));
    };

    if (config16) { addEmails(config16.toEmails, toSet); addEmails(config16.ccEmails, ccSet); }
    if (configFeedback) { addEmails(configFeedback.toEmails, toSet); addEmails(configFeedback.ccEmails, ccSet); }

    // Add trainers if either config requests it
    if ((config16?.includeTrainer || configFeedback?.includeTrainer) && student?.departmentId) {
        const [trainers] = await executeQuery(
            "SELECT email FROM users WHERE departmentId = ? AND (isTrainer = 1 OR role = 'INSTRUCTOR' OR role = 'ADMIN')",
            [student.departmentId]
        );
        trainers.forEach(t => { if (t.email) toSet.add(t.email); });
    }

    const to = [...toSet].join(", ");
    if (!to) throw new ApiError("No recipient emails found in configuration.", 400);
    const cc = [...ccSet].join(", ");

    const monitoringConfig = await MonitoringConfig.findByTypeAndDepartment('16DAY', student?.departmentId, student?.sectionId);
    const portalUrl = `${ENV.ADMIN_URL || 'http://localhost:5173'}/admin/16-day-monitoring/${studentId}`;

    const operatorName = student?.fullName || sheet.employeeName;
    const employeeCode = student?.empId || sheet.employeeCode;
    const departmentName = student?.departmentName || sheet.dept || "N/A";
    const processName = sheet.processName || "N/A";
    const topTableData = feedback?.topTableData || {};
    const dailyLogs = feedback?.dailyLogs || Array(16).fill({ associatesFeedback: '', mentorAction: '', status1: '', areaEngineer: '', status2: '' });

    const html = emailTemplates.generateCombinedMonitoringEmail({
        operatorName,
        employeeCode,
        departmentName,
        processName,
        headerInfo: {
            handoverDate: sheet.handoverDate,
            checkedBy: sheet.checkedBy,
            verifiedBy: sheet.verifiedBy,
            approvedBy: sheet.approvedBy,
            verifiedByEduCell: sheet.verifiedByEduCell,
        },
        portalUrl,
    });

    // Build a two-sheet workbook matching the on-screen 16-Day Monitoring + Mentee Feedback layouts
    const workbook = new ExcelJS.Workbook();
    const monitoringSheet = workbook.addWorksheet('16-Day Monitoring');
    await NotificationService._fillSixteenDaySheet(monitoringSheet, {
        gridData: sheet.gridData || {},
        employeeName: sheet.employeeName,
        employeeCode: sheet.employeeCode,
        dept: sheet.dept,
        processName: sheet.processName,
        handoverDate: sheet.handoverDate,
        trgResult: sheet.trgResult,
        workingWith: sheet.workingWith,
        lineLeaderName: sheet.lineLeaderName,
        config: monitoringConfig?.config || [],
    });

    const feedbackSheet = workbook.addWorksheet('Mentee Feedback');
    await NotificationService._fillMenteeFeedbackSheet(feedbackSheet, {
        operatorName,
        employeeCode,
        departmentName,
        processName,
        topTableData,
        dailyLogs,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `16-Day_Monitoring_Report_${(operatorName || 'associate').replace(/\s+/g, '_')}.xlsx`;

    await sendMail(
        to,
        `16-Day Monitoring & Mentee Feedback Report: ${operatorName}`,
        html,
        [{ filename, content: buffer }],
        cc
    );

    logAudit(req.user?.id, "EMAIL_COMBINED_MONITORING_REPORT", {
        studentId: sid, employeeName: student?.fullName || sheet.employeeName, to, cc
    }, { resourceType: "SixteenDayMonitoring", resourceId: sheet.id, req }).catch(err =>
        console.error("logAudit(EMAIL_COMBINED_MONITORING_REPORT) failed:", err.message)
    );

    return res.status(200).json(
        new ApiResponse(200, null, "Combined monitoring report emailed successfully")
    );
});

// Builds and sends the combined 16-Day Monitoring + Mentee Feedback report to the
// "16 Day for Training Cell" recipient list. Shared by the manual endpoint and by
// saveSixteenDayMonitoring's automatic trigger on Approved By sign-off, so both paths
// stay in sync instead of drifting into two copies of the same email-building logic.
// `req` is optional — pass it (from a real HTTP request) to get ip/userAgent on the
// audit log; the automatic save-triggered path has no request of its own to attach.
export async function dispatchTrainingCellEmail(sid, sheet, triggeringUser, req = null) {
    const feedback = await MenteeFeedback.findByStudentId(sid);

    const [users] = await executeQuery(`
        SELECT u.id, u.fullName, u.empId, u.departmentId, u.sectionId, d.name as departmentName
        FROM users u
        LEFT JOIN departments d ON u.departmentId = d.id
        WHERE u.id = ?
    `, [sid]);
    const student = users[0];

    // "16 Day for Training Cell" is its own recipient list; if nobody has configured
    // it yet, fall back to the primary "16-Day Monitoring Sheet" config so this
    // notification isn't dead on arrival for teams that only set up the original form.
    let config = await EmailConfiguration.findByFormDeptAndSection(
        "16 Day for Training Cell",
        student?.departmentId,
        student?.sectionId
    );

    if (!config) {
        config = await EmailConfiguration.findByFormDeptAndSection(
            "16-Day Monitoring Sheet",
            student?.departmentId,
            student?.sectionId
        );
    }

    if (!config) {
        throw new ApiError("No email configuration found for Training Cell. Please set up recipients in Settings -> Email Notifications Settings.", 400);
    }

    const toSet = new Set();
    const ccSet = new Set();

    const addEmails = (str, target) => {
        (str || "").split(',').map(e => e.trim()).filter(Boolean).forEach(e => target.add(e));
    };

    addEmails(config.toEmails, toSet);
    addEmails(config.ccEmails, ccSet);

    if (config.includeTrainer && student?.departmentId) {
        const [trainers] = await executeQuery(
            "SELECT email FROM users WHERE departmentId = ? AND (isTrainer = 1 OR role = 'INSTRUCTOR' OR role = 'ADMIN')",
            [student.departmentId]
        );
        trainers.forEach(t => { if (t.email) toSet.add(t.email); });
    }

    const to = [...toSet].join(", ");
    if (!to) throw new ApiError("No recipient emails found in configuration.", 400);
    const cc = [...ccSet].join(", ");

    const monitoringConfig = await MonitoringConfig.findByTypeAndDepartment('16DAY', student?.departmentId, student?.sectionId);
    const portalUrl = `${ENV.ADMIN_URL || 'http://localhost:5173'}/admin/16-day-monitoring/${sid}`;

    const operatorName = student?.fullName || sheet.employeeName;
    const employeeCode = student?.empId || sheet.employeeCode;
    const departmentName = student?.departmentName || sheet.dept || "N/A";
    const processName = sheet.processName || "N/A";
    const topTableData = feedback?.topTableData || {};
    const dailyLogs = feedback?.dailyLogs || Array(16).fill({ associatesFeedback: '', mentorAction: '', status1: '', areaEngineer: '', status2: '' });

    const html = emailTemplates.generateCombinedMonitoringEmail({
        operatorName,
        employeeCode,
        departmentName,
        processName,
        headerInfo: {
            handoverDate: sheet.handoverDate,
            checkedBy: sheet.checkedBy,
            verifiedBy: sheet.verifiedBy,
            approvedBy: sheet.approvedBy,
            verifiedByEduCell: sheet.verifiedByEduCell,
        },
        portalUrl,
    });

    const workbook = new ExcelJS.Workbook();
    const monitoringSheet = workbook.addWorksheet('16-Day Monitoring');
    await NotificationService._fillSixteenDaySheet(monitoringSheet, {
        gridData: sheet.gridData || {},
        employeeName: sheet.employeeName,
        employeeCode: sheet.employeeCode,
        dept: sheet.dept,
        processName: sheet.processName,
        handoverDate: sheet.handoverDate,
        trgResult: sheet.trgResult,
        workingWith: sheet.workingWith,
        lineLeaderName: sheet.lineLeaderName,
        config: monitoringConfig?.config || [],
    });

    const feedbackSheet = workbook.addWorksheet('Mentee Feedback');
    await NotificationService._fillMenteeFeedbackSheet(feedbackSheet, {
        operatorName,
        employeeCode,
        departmentName,
        processName,
        topTableData,
        dailyLogs,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `16-Day_Monitoring_Report_TrainingCell_${(operatorName || 'associate').replace(/\s+/g, '_')}.xlsx`;

    await sendMail(
        to,
        `16-Day Monitoring Report (Training Cell): ${operatorName}`,
        html,
        [{ filename, content: buffer }],
        cc
    );

    logAudit(triggeringUser?.id, "EMAIL_SIXTEEN_DAY_TRAINING_CELL", {
        studentId: sid, employeeName: operatorName, to, cc
    }, { resourceType: "SixteenDayMonitoring", resourceId: sheet.id, req }).catch(err =>
        console.error("logAudit(EMAIL_SIXTEEN_DAY_TRAINING_CELL) failed:", err.message)
    );
}

export const sendTrainingCellMonitoringEmail = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    const sheet = await SixteenDayMonitoring.findByStudentId(sid);
    if (!sheet) throw new ApiError("16-Day monitoring record not found", 404);

    await dispatchTrainingCellEmail(sid, sheet, req.user, req);

    return res.status(200).json(
        new ApiResponse(200, null, "Monitoring sheet sent to Training Cell successfully")
    );
});
