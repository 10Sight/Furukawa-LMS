import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { executeQuery } from "../db/mssqlHelper.js";
import LeftRequest from "../models/leftRequest.model.js";
import EmailConfiguration from "../models/emailConfiguration.model.js";
import DojoStageHistory from "../models/dojoStagHistory.model.js";
import { getUpdatedStatusHistory } from "../utils/statusHistory.js";
import sendMail from "../utils/mail.util.js";
import emailTemplates from "../utils/emailTemplates.js";
import logAudit from "../utils/auditLogger.js";
import ENV from "../configs/env.config.js";
import { hasPermission } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "./rolesPermissions.controller.js";

const LEFT_REQUEST_FORM_NAME = "Left Request Email";

const portalUrlForLeftRequests = () => `${ENV.ADMIN_URL || 'http://localhost:5173'}/admin/students?tab=left-request`;

const resolveRequesterRole = (user) => {
    if (user.role === 'CUSTOM') return user.customRole?.name || 'Custom Role';
    return user.role;
};

// left_requests.leavingDate is a native SQL DATE column, so the mssql driver hands it back as a
// JS Date -- but users.leavingDate is NVARCHAR, not DATE. Binding a Date object straight into an
// NVARCHAR parameter makes the driver fall back to SQL Server's default Date.toString() format
// ("Sep 19 2026 12:00AM") instead of a plain "YYYY-MM-DD" string. Normalize with local calendar
// components (not toISOString(), which would shift the date across a UTC day boundary) before
// writing it anywhere that expects the "YYYY-MM-DD" string the rest of the app uses.
const toDateOnlyString = (val) => {
    if (!val) return null;
    if (val instanceof Date) {
        const year = val.getFullYear();
        const month = String(val.getMonth() + 1).padStart(2, '0');
        const day = String(val.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return String(val).split('T')[0];
};

const canReviewLeftRequests = (user) => (
    user.isAdmin || user.role === 'SUPERADMIN' || hasPermission(user, SYSTEM_PERMISSIONS.USER_APPROVE_LEFT)
);

// Resolves recipients from the "Left Request Email" configuration for a department/section,
// optionally folding in department trainers -- mirrors sendSixteenDayMonitoringEmail's approach
// so Left Request notifications behave the same way admins already expect email config to work.
const resolveLeftRequestRecipients = async (departmentId, sectionId) => {
    const config = await EmailConfiguration.findByFormDeptAndSection(LEFT_REQUEST_FORM_NAME, departmentId, sectionId);
    if (!config) return null;

    let to = config.toEmails || "";
    const cc = config.ccEmails || "";

    if (config.includeTrainer && departmentId) {
        const [trainers] = await executeQuery(
            "SELECT email FROM users WHERE departmentId = ? AND (isTrainer = 1 OR role = 'INSTRUCTOR')",
            [departmentId]
        );
        const trainerEmails = trainers.map(t => t.email).filter(Boolean).join(", ");
        if (trainerEmails) to = to ? `${to}, ${trainerEmails}` : trainerEmails;
    }

    if (!to) return null;
    return { to, cc };
};

const sendLeftRequestSubmittedEmail = async (request) => {
    const recipients = await resolveLeftRequestRecipients(request.departmentId, request.sectionId);
    if (!recipients) return;

    const html = emailTemplates.generateLeftRequestSubmittedEmail({
        fullName: request.fullName,
        empId: request.empId,
        departmentName: request.departmentName,
        sectionName: request.sectionName,
        leavingDate: request.leavingDate,
        reasonOfLeavingByDept: request.reasonOfLeavingByDept,
        remarks: request.remarks,
        requestedByName: request.requestedByName,
        requestedByRole: request.requestedByRole,
        portalUrl: portalUrlForLeftRequests(),
    });

    await sendMail(recipients.to, `[Action Required] Left Request Submitted for Operator: ${request.fullName} (${request.empId || '-'})`, html, [], recipients.cc);
};

const sendLeftRequestResolutionEmail = async (request) => {
    const recipients = await resolveLeftRequestRecipients(request.departmentId, request.sectionId);
    if (!recipients) return;

    const html = emailTemplates.generateLeftRequestResolutionEmail({
        fullName: request.fullName,
        empId: request.empId,
        departmentName: request.departmentName,
        sectionName: request.sectionName,
        leavingDate: request.leavingDate,
        reasonOfLeavingByDept: request.reasonOfLeavingByDept,
        reasonOfLeavingByHr: request.reasonOfLeavingByHr,
        status: request.status,
        reviewedByName: request.reviewedByName,
        rejectionReason: request.rejectionReason,
        portalUrl: portalUrlForLeftRequests(),
    });

    const subjectPrefix = request.status === 'APPROVED' ? '[Notification] Left Request Approved' : '[Notification] Left Request Rejected';
    await sendMail(recipients.to, `${subjectPrefix}: ${request.fullName} (${request.empId || '-'})`, html, [], recipients.cc);
};

// Loads the fields off `users` that a Left Request snapshots at apply time, so the
// request stays meaningful even if the operator's assignment changes afterward.
const loadTargetUser = async (userId) => {
    const [rows] = await executeQuery(`
        SELECT id, fullName, empId, status, departmentId, sectionId, lineId, subSectionId, stationId, isTemporary
        FROM users
        WHERE id = ? AND (isDeleted = 0 OR isDeleted IS NULL)
    `, [userId]);
    return rows.length > 0 ? rows[0] : null;
};

// The apply dialog is filled by the department, so whatever reason it sends is the department's.
// Accept either field name so older clients posting `reasonOfLeaving` keep working.
const resolveDeptReason = (body) => String(body?.reasonOfLeavingByDept ?? body?.reasonOfLeaving ?? "").trim();

export const applyLeftRequest = asyncHandler(async (req, res) => {
    const { userId, leavingDate, remarks } = req.body;
    const reasonOfLeaving = resolveDeptReason(req.body);

    if (!userId) throw new ApiError("userId is required", 400);
    if (!leavingDate) throw new ApiError("Date of leaving is required", 400);
    if (!reasonOfLeaving) throw new ApiError("Reason of leaving is required", 400);

    const targetUser = await loadTargetUser(userId);
    if (!targetUser) throw new ApiError("Associate not found", 404);
    if (targetUser.status === "LEFT") throw new ApiError("This associate has already left", 400);

    const existingPending = await LeftRequest.findPendingByUserId(userId);
    if (existingPending) throw new ApiError("A left request is already pending for this associate", 400);

    const created = await LeftRequest.create({
        userId,
        empId: targetUser.empId,
        fullName: targetUser.fullName,
        departmentId: targetUser.departmentId,
        sectionId: targetUser.sectionId,
        lineId: targetUser.lineId,
        subSectionId: targetUser.subSectionId,
        stationId: targetUser.stationId,
        currentStatus: targetUser.status || "PRESENT",
        leavingDate,
        reasonOfLeaving,
        reasonOfLeavingByDept: reasonOfLeaving,
        remarks,
        requestedBy: req.user.id,
        requestedByName: req.user.fullName || req.user.userName,
        requestedByRole: resolveRequesterRole(req.user),
    });

    logAudit(req.user.id, "APPLY_LEFT_REQUEST", {
        leftRequestId: created.id, userId, leavingDate,
        reasonOfLeavingByDept: reasonOfLeaving, departmentName: created.departmentName || null
    }, { resourceType: "LeftRequest", resourceId: created.id, req }).catch(err =>
        console.error("logAudit(APPLY_LEFT_REQUEST) failed:", err.message)
    );

    sendLeftRequestSubmittedEmail(created).catch(err =>
        console.error("[LeftRequest] Failed to send submitted notification:", err.message)
    );

    return res.status(201).json(new ApiResponse(201, created, "Left request submitted for approval"));
});

export const bulkApplyLeftRequest = asyncHandler(async (req, res) => {
    const { ids, leavingDate, remarks } = req.body;
    const reasonOfLeaving = resolveDeptReason(req.body);

    if (!Array.isArray(ids) || ids.length === 0) throw new ApiError("No IDs provided", 400);
    if (!leavingDate) throw new ApiError("Date of leaving is required", 400);
    if (!reasonOfLeaving) throw new ApiError("Reason of leaving is required", 400);

    const uniqueIds = [...new Set(ids)];
    const bulkBatchId = `bulk-${Date.now()}-${req.user.id}`;
    const requestedByName = req.user.fullName || req.user.userName;
    const requestedByRole = resolveRequesterRole(req.user);

    const created = [];
    const skipped = [];

    for (const userId of uniqueIds) {
        const targetUser = await loadTargetUser(userId);
        if (!targetUser) { skipped.push({ userId, reason: "Not found" }); continue; }
        if (targetUser.status === "LEFT") { skipped.push({ userId, reason: "Already left" }); continue; }

        const existingPending = await LeftRequest.findPendingByUserId(userId);
        if (existingPending) { skipped.push({ userId, reason: "Already has a pending request" }); continue; }

        const request = await LeftRequest.create({
            userId,
            empId: targetUser.empId,
            fullName: targetUser.fullName,
            departmentId: targetUser.departmentId,
            sectionId: targetUser.sectionId,
            lineId: targetUser.lineId,
            subSectionId: targetUser.subSectionId,
            stationId: targetUser.stationId,
            currentStatus: targetUser.status || "PRESENT",
            leavingDate,
            reasonOfLeaving,
            reasonOfLeavingByDept: reasonOfLeaving,
            remarks,
            requestedBy: req.user.id,
            requestedByName,
            requestedByRole,
            isBulkRequest: true,
            bulkBatchId,
        });
        created.push(request);
        sendLeftRequestSubmittedEmail(request).catch(err =>
            console.error("[LeftRequest] Failed to send submitted notification:", err.message)
        );
    }

    logAudit(req.user.id, "BULK_APPLY_LEFT_REQUEST", {
        bulkBatchId, created: created.length, skipped: skipped.length, leavingDate, reasonOfLeavingByDept: reasonOfLeaving
    }, { req }).catch(err => console.error("logAudit(BULK_APPLY_LEFT_REQUEST) failed:", err.message));

    return res.status(201).json(new ApiResponse(201, { created, skipped }, `${created.length} left request(s) submitted, ${skipped.length} skipped`));
});

export const getAllLeftRequests = asyncHandler(async (req, res) => {
    const { status, departmentId, sectionId, lineId, search, page, limit } = req.query;
    const result = await LeftRequest.findAll({ status, departmentId, sectionId, lineId, search, page, limit });
    return res.status(200).json(new ApiResponse(200, result, "Left requests fetched successfully"));
});

export const getPendingLeftRequestCount = asyncHandler(async (req, res) => {
    const { departmentId } = req.query;
    const count = await LeftRequest.countPending(departmentId);
    return res.status(200).json(new ApiResponse(200, { count }, "Pending left request count fetched"));
});

export const getLeftRequestById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const request = await LeftRequest.findById(id);
    if (!request) throw new ApiError("Left request not found", 404);
    return res.status(200).json(new ApiResponse(200, request, "Left request fetched successfully"));
});

// HR's reason from the approve dialog (either field name). Empty means "agree with the
// department" and falls back to the reason the department submitted rather than clearing it.
const resolveHrReason = (body, request) => (
    String(body?.reasonOfLeavingByHr ?? body?.reasonOfLeaving ?? "").trim()
    || request.reasonOfLeavingByDept
    || request.reasonOfLeaving
);

// Marks the request's associate as LEFT with both reasons plus a snapshot of the department
// they left from, then flips the request to APPROVED. Shared by single and bulk approve.
// Returns null (and changes nothing) if the associate no longer exists.
const applyApproval = async (request, reviewer, hrReason, syncedBy) => {
    const [userRows] = await executeQuery(`
        SELECT u.id, u.status, u.joiningDate, u.statusHistory, u.isTemporary, d.name AS deptName
        FROM users u
        LEFT JOIN departments d ON d.id = COALESCE(u.departmentId, u.targetDeptId)
        WHERE u.id = ?
    `, [request.userId]);
    if (userRows.length === 0) return null;
    const targetUser = userRows[0];

    // request.leavingDate comes back from left_requests (a native DATE column) as a JS Date, but
    // users.leavingDate is NVARCHAR -- normalize to "YYYY-MM-DD" before it touches that column or
    // statusHistory, see toDateOnlyString's comment for why.
    const leavingDateStr = toDateOnlyString(request.leavingDate);
    const deptReason = request.reasonOfLeavingByDept || request.reasonOfLeaving;
    // Prefer the department snapshotted on the request (where it was raised from), falling
    // back to the associate's current department.
    const deptName = request.departmentName || targetUser.deptName || null;

    const updatedHistory = getUpdatedStatusHistory(
        targetUser.statusHistory,
        { status: targetUser.status, joiningDate: targetUser.joiningDate, leavingDate: undefined },
        { status: "LEFT", leavingDate: leavingDateStr },
        { changedBy: reviewer.id, changedByName: reviewer.fullName }
    );

    // reasonOfLeaving mirrors the HR reason so every existing reader (filters, exports) keeps
    // reporting the confirmed reason.
    const updateFields = [
        "status = 'LEFT'", "leavingDate = ?", "reasonOfLeaving = ?", "reasonOfLeavingByHr = ?",
        "reasonOfLeavingByDept = ?", "leftDepartmentName = ?", "updatedAt = GETDATE()"
    ];
    const updateParams = [leavingDateStr, hrReason, hrReason, deptReason, deptName];
    if (updatedHistory) {
        updateFields.push("statusHistory = ?");
        updateParams.push(JSON.stringify(updatedHistory));
    }
    updateParams.push(request.userId);
    await executeQuery(`UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`, updateParams);

    const updatedRequest = await LeftRequest.approve(request.id, {
        reviewedBy: reviewer.id,
        reviewedByName: reviewer.fullName || reviewer.userName,
        reasonOfLeavingByHr: hrReason,
    });

    // Keep dojo_stage_history current for temporary hires, mirroring updateUser's own sync.
    if (targetUser.isTemporary) {
        const today = new Date().toISOString().split('T')[0];
        for (const d of new Set([today, leavingDateStr])) {
            DojoStageHistory.syncDate(d, { syncedBy }).catch(err =>
                console.error(`[LeftRequest] DojoStageHistory.syncDate(${d}) failed:`, err.message)
            );
        }
    }

    sendLeftRequestResolutionEmail(updatedRequest).catch(err =>
        console.error("[LeftRequest] Failed to send approval notification:", err.message)
    );

    return { updatedRequest, leavingDateStr, deptReason, deptName };
};

export const approveLeftRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const request = await LeftRequest.findById(id);
    if (!request) throw new ApiError("Left request not found", 404);
    if (request.status !== "PENDING") throw new ApiError(`This request has already been ${request.status.toLowerCase()}`, 400);

    const hrReason = resolveHrReason(req.body, request);
    const result = await applyApproval(request, req.user, hrReason, 'approveLeftRequest');
    if (!result) throw new ApiError("The associate for this request no longer exists", 404);

    logAudit(req.user.id, "APPROVE_LEFT_REQUEST", {
        leftRequestId: id, userId: request.userId, leavingDate: result.leavingDateStr,
        reasonOfLeavingByDept: result.deptReason, reasonOfLeavingByHr: hrReason, departmentName: result.deptName
    }, { resourceType: "LeftRequest", resourceId: id, req }).catch(err =>
        console.error("logAudit(APPROVE_LEFT_REQUEST) failed:", err.message)
    );

    return res.status(200).json(new ApiResponse(200, result.updatedRequest, "Left request approved; associate marked as LEFT"));
});

export const rejectLeftRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    if (!rejectionReason?.trim()) throw new ApiError("Rejection reason is required", 400);

    const request = await LeftRequest.findById(id);
    if (!request) throw new ApiError("Left request not found", 404);
    if (request.status !== "PENDING") throw new ApiError(`This request has already been ${request.status.toLowerCase()}`, 400);

    const updatedRequest = await LeftRequest.reject(id, {
        reviewedBy: req.user.id,
        reviewedByName: req.user.fullName || req.user.userName,
        rejectionReason: rejectionReason.trim(),
    });

    logAudit(req.user.id, "REJECT_LEFT_REQUEST", {
        leftRequestId: id, userId: request.userId, rejectionReason: rejectionReason.trim()
    }, { resourceType: "LeftRequest", resourceId: id, req }).catch(err =>
        console.error("logAudit(REJECT_LEFT_REQUEST) failed:", err.message)
    );

    sendLeftRequestResolutionEmail(updatedRequest).catch(err =>
        console.error("[LeftRequest] Failed to send rejection notification:", err.message)
    );

    return res.status(200).json(new ApiResponse(200, updatedRequest, "Left request rejected"));
});

export const bulkApproveLeftRequests = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) throw new ApiError("No IDs provided", 400);

    const uniqueIds = [...new Set(ids)];
    const approved = [];
    const skipped = [];

    for (const id of uniqueIds) {
        const request = await LeftRequest.findById(id);
        if (!request) { skipped.push({ id, reason: "Not found" }); continue; }
        if (request.status !== "PENDING") { skipped.push({ id, reason: `Already ${request.status.toLowerCase()}` }); continue; }

        // A blank HR reason keeps each request's own department reason.
        const result = await applyApproval(request, req.user, resolveHrReason(req.body, request), 'bulkApproveLeftRequests');
        if (!result) { skipped.push({ id, reason: "Associate no longer exists" }); continue; }

        approved.push(result.updatedRequest);
    }

    logAudit(req.user.id, "BULK_APPROVE_LEFT_REQUEST", {
        ids: uniqueIds, approved: approved.length, skipped: skipped.length,
        reasonOfLeavingByHr: String(req.body?.reasonOfLeavingByHr ?? req.body?.reasonOfLeaving ?? "").trim() || null
    }, { req }).catch(err => console.error("logAudit(BULK_APPROVE_LEFT_REQUEST) failed:", err.message));

    return res.status(200).json(new ApiResponse(200, { approved, skipped }, `${approved.length} left request(s) approved, ${skipped.length} skipped`));
});

export const bulkRejectLeftRequests = asyncHandler(async (req, res) => {
    const { ids, rejectionReason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) throw new ApiError("No IDs provided", 400);
    if (!rejectionReason?.trim()) throw new ApiError("Rejection reason is required", 400);

    const uniqueIds = [...new Set(ids)];
    const rejected = [];
    const skipped = [];

    for (const id of uniqueIds) {
        const request = await LeftRequest.findById(id);
        if (!request) { skipped.push({ id, reason: "Not found" }); continue; }
        if (request.status !== "PENDING") { skipped.push({ id, reason: `Already ${request.status.toLowerCase()}` }); continue; }

        const updatedRequest = await LeftRequest.reject(id, {
            reviewedBy: req.user.id,
            reviewedByName: req.user.fullName || req.user.userName,
            rejectionReason: rejectionReason.trim(),
        });

        sendLeftRequestResolutionEmail(updatedRequest).catch(err =>
            console.error("[LeftRequest] Failed to send rejection notification:", err.message)
        );

        rejected.push(updatedRequest);
    }

    logAudit(req.user.id, "BULK_REJECT_LEFT_REQUEST", {
        ids: uniqueIds, rejected: rejected.length, skipped: skipped.length, rejectionReason: rejectionReason.trim()
    }, { req }).catch(err => console.error("logAudit(BULK_REJECT_LEFT_REQUEST) failed:", err.message));

    return res.status(200).json(new ApiResponse(200, { rejected, skipped }, `${rejected.length} left request(s) rejected, ${skipped.length} skipped`));
});

export const cancelLeftRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const request = await LeftRequest.findById(id);
    if (!request) throw new ApiError("Left request not found", 404);
    if (request.status !== "PENDING") throw new ApiError(`This request has already been ${request.status.toLowerCase()}`, 400);

    const isOwner = String(request.requestedBy) === String(req.user.id);
    if (!isOwner && !canReviewLeftRequests(req.user)) {
        throw new ApiError("You do not have permission to cancel this left request", 403);
    }

    const updatedRequest = await LeftRequest.cancel(id);

    logAudit(req.user.id, "CANCEL_LEFT_REQUEST", {
        leftRequestId: id, userId: request.userId
    }, { resourceType: "LeftRequest", resourceId: id, req }).catch(err =>
        console.error("logAudit(CANCEL_LEFT_REQUEST) failed:", err.message)
    );

    return res.status(200).json(new ApiResponse(200, updatedRequest, "Left request withdrawn"));
});
