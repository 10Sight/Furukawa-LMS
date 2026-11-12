import AbnormalConditionSheet from "../models/abnormalCondition.model.js";
import NotificationService from "../services/notification.service.js";
import RevisionRecordService from "../services/revisionRecord.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import MonitoringConfig from "../models/monitoringConfig.model.js";
import logAudit from "../utils/auditLogger.js";
import {
    ABNORMAL_CONDITION_CONFIG_TYPE,
    resolveAbnormalConditionLayout,
    validateAbnormalConditionLayout,
} from "../../shared/abnormalConditionLayout.js";

// Sheet metadata fields owned by the Revision Table, never by a sheet save.
const REVISION_METADATA_FIELDS = ["docNo", "revNo", "issueDate", "revDate"];

// Layout scope: a department id, or null for the global template ('global' in URLs).
const toLayoutDepartmentId = (departmentId) => {
    const raw = String(departmentId ?? "").trim();
    return !raw || raw.toLowerCase() === "global" ? null : raw;
};

// Layout in effect for a department: its own, else the global template, else defaults.
const findLayout = async (departmentId) => {
    const record = await MonitoringConfig.findByFilters(ABNORMAL_CONDITION_CONFIG_TYPE, departmentId, 0, 0, 0);
    const scope = !record ? "default" : (record.departmentId ? "department" : "global");
    return { layout: resolveAbnormalConditionLayout(record?.config), scope };
};

// Helper to normalize any date/month string to YYYY-MM-01 format
const normalizeToMonthStart = (dateStr) => {
    if (!dateStr) return null;
    const match = dateStr.match(/^(\d{4}-\d{2})/);
    if (!match) return null;
    return `${match[1]}-01`;
};

// Helper to get user's assigned departments
const getAssignedDepartmentIds = (user) => {
    const assignedIds = [];
    if (user?.departmentId) assignedIds.push(parseInt(user.departmentId));
    if (Array.isArray(user?.departments)) {
        user.departments.forEach(id => {
            const parsed = parseInt(id);
            if (!isNaN(parsed) && !assignedIds.includes(parsed)) {
                assignedIds.push(parsed);
            }
        });
    }
    return assignedIds;
};

// Helper to check if user has master admin rights
const isUserMasterAdmin = (user) => {
    return user?.role === "SUPERADMIN" || user?.role === "ADMIN" || user?.isAdmin === 1 || user?.isAdmin === true;
};

/**
 * Get (or Auto-Create) Abnormal Condition Sheet (Month-Wise & Dept-Wise)
 */
export const getAbnormalConditionSheet = asyncHandler(async (req, res) => {
    const { departmentId, date } = req.query;

    if (!departmentId || !date) {
        throw new ApiError("Department ID and Date (Month) are required", 400);
    }

    const normalizedDate = normalizeToMonthStart(date);
    if (!normalizedDate) {
        throw new ApiError("Invalid Date format", 400);
    }

    // Role-based access control for customRole/assigned departments
    if (!isUserMasterAdmin(req.user)) {
        const assignedDepts = getAssignedDepartmentIds(req.user);
        if (!assignedDepts.includes(parseInt(departmentId))) {
            throw new ApiError("You are not authorized to access sheets for this department", 403);
        }
    }

    let sheet = await AbnormalConditionSheet.findSpecific(parseInt(departmentId), normalizedDate);

    // Auto-create sheet if not found
    if (!sheet) {
        // New sheets copy whatever docNo/revNo/issueDate/revDate is current in the
        // Revision Table at creation time; later Revision Table edits rewrite that copy
        // on every saved sheet via revisionPropagation.service.js.
        // Abnormal Condition has no section concept — always department-only scope.
        const revision = await RevisionRecordService.getLatestForSheet('abnormal-condition', parseInt(departmentId), null);
        const { layout } = await findLayout(String(parseInt(departmentId)));
        const metadata = revision?.docNo
            ? {
                docNo: revision.docNo,
                revNo: revision.revNo,
                issueDate: revision.issueDate,
                revDate: revision.revDate,
                remarks: layout.remarks
            }
            : undefined;

        sheet = await AbnormalConditionSheet.create({
            departmentId: parseInt(departmentId),
            date: normalizedDate,
            updatedBy: req.user?.fullName || "System",
            isSubmitted: false,
            metadata,
            rowCount: layout.defaultRows
        });
    }

    res.status(200).json(new ApiResponse(200, sheet, "Abnormal condition sheet retrieved successfully"));
});

/**
 * Create Abnormal Condition Sheet (Simplified API - Fallback/Legacy support)
 */
export const createAbnormalConditionSheet = asyncHandler(async (req, res) => {
    const { departmentId, date } = req.body;

    if (!departmentId || !date) {
        throw new ApiError("Department ID and Date are required", 400);
    }

    const normalizedDate = normalizeToMonthStart(date);
    if (!normalizedDate) {
        throw new ApiError("Invalid Date format", 400);
    }

    // Role-based access control
    if (!isUserMasterAdmin(req.user)) {
        const assignedDepts = getAssignedDepartmentIds(req.user);
        if (!assignedDepts.includes(parseInt(departmentId))) {
            throw new ApiError("You are not authorized to create sheets for this department", 403);
        }
    }

    // Check if sheet already exists
    const existing = await AbnormalConditionSheet.findSpecific(parseInt(departmentId), normalizedDate);
    if (existing) {
        throw new ApiError("An abnormal condition sheet already exists for this department and month", 409);
    }

    const newSheet = await AbnormalConditionSheet.create({
        departmentId: parseInt(departmentId),
        date: normalizedDate,
        updatedBy: req.user?.fullName || "System",
        isSubmitted: false
    });

    res.status(201).json(new ApiResponse(201, newSheet, "Abnormal condition sheet created successfully"));
});

/**
 * Update Abnormal Condition Sheet
 */
export const updateAbnormalConditionSheet = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { entries, signatures, metadata, isSubmitted } = req.body;

    const sheet = await AbnormalConditionSheet.findById(id);
    if (!sheet) {
        throw new ApiError("Abnormal condition sheet not found", 404);
    }

    // Role-based access control
    if (!isUserMasterAdmin(req.user)) {
        const assignedDepts = getAssignedDepartmentIds(req.user);
        if (!assignedDepts.includes(parseInt(sheet.departmentId))) {
            throw new ApiError("You are not authorized to update sheets for this department", 403);
        }
    }

    if (entries) sheet.entries = entries;
    if (signatures) sheet.signatures = signatures;
    // The doc/revision header is owned by the Revision Table (copied at creation, then
    // rewritten by revisionPropagation.service.js). Clients send back the metadata they
    // loaded, so a stale copy must never overwrite a newer propagated header.
    if (metadata) {
        const current = sheet.metadata || {};
        sheet.metadata = {
            ...metadata,
            ...Object.fromEntries(REVISION_METADATA_FIELDS
                .filter((f) => current[f] !== undefined)
                .map((f) => [f, current[f]])),
        };
    }
    
    const wasSubmitted = sheet.isSubmitted;
    if (isSubmitted !== undefined) sheet.isSubmitted = isSubmitted;
    sheet.updatedBy = req.user?.fullName || "System";

    await sheet.save();

    // Trigger email notification if sheet is newly submitted
    if (sheet.isSubmitted && !wasSubmitted) {
        try {
            NotificationService.sendFormReport(
                "Abnormal Condition Sheet",
                sheet.departmentId,
                {
                    ...sheet,
                    date: sheet.date,
                    entries: sheet.entries
                }
            );
        } catch (e) {
            console.error("[AbnormalCondition] Failed to trigger email notification:", e);
        }
    }

    res.status(200).json(new ApiResponse(200, sheet, "Abnormal condition sheet updated successfully"));
});

/**
 * Approve or Reject a specific row/entry by QA Head
 */
export const approveAbnormalConditionEntry = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { sNo, action } = req.body; // action: "APPROVED" or "REJECTED" or "RESET"

    if (!sNo || !action) {
        throw new ApiError("sNo and action are required", 400);
    }

    const sheet = await AbnormalConditionSheet.findById(id);
    if (!sheet) {
        throw new ApiError("Abnormal condition sheet not found", 404);
    }

    // Role-based access control
    if (!isUserMasterAdmin(req.user)) {
        const assignedDepts = getAssignedDepartmentIds(req.user);
        if (!assignedDepts.includes(parseInt(sheet.departmentId))) {
            throw new ApiError("You are not authorized to sign off sheets for this department", 403);
        }
    }

    const entryIndex = sheet.entries.findIndex(e => parseInt(e.sNo) === parseInt(sNo));
    if (entryIndex === -1) {
        throw new ApiError(`Row with Serial Number ${sNo} not found`, 404);
    }

    const username = req.user?.fullName || "Authorized QA Head";

    if (action === "APPROVED") {
        sheet.entries[entryIndex].approvalStatus = "APPROVED";
        sheet.entries[entryIndex].approvedBy = `Approved by: ${username}`;
    } else if (action === "REJECTED") {
        sheet.entries[entryIndex].approvalStatus = "REJECTED";
        sheet.entries[entryIndex].approvedBy = `Rejected by: ${username}`;
    } else {
        sheet.entries[entryIndex].approvalStatus = "PENDING";
        sheet.entries[entryIndex].approvedBy = "";
    }

    sheet.updatedBy = username;
    await sheet.save();

    res.status(200).json(new ApiResponse(200, sheet, `Row ${sNo} has been successfully ${action.toLowerCase()}`));
});

/**
 * Delete Abnormal Condition Sheet
 */
export const deleteAbnormalConditionSheet = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const sheet = await AbnormalConditionSheet.findById(id);
    if (!sheet) {
        throw new ApiError("Abnormal condition sheet not found", 404);
    }

    // Role-based access control
    if (!isUserMasterAdmin(req.user)) {
        const assignedDepts = getAssignedDepartmentIds(req.user);
        if (!assignedDepts.includes(parseInt(sheet.departmentId))) {
            throw new ApiError("You are not authorized to delete sheets for this department", 403);
        }
    }

    const deleted = await AbnormalConditionSheet.delete(id);
    if (!deleted) {
        throw new ApiError("Failed to delete abnormal condition sheet", 500);
    }

    res.status(200).json(new ApiResponse(200, null, "Abnormal condition sheet deleted successfully"));
});

/**
 * Get All Abnormal Condition Sheets (List/History)
 */
export const getAbnormalConditionList = asyncHandler(async (req, res) => {
    const { departmentId, date } = req.query;
    
    const filters = {};
    if (date) {
        const normalizedDate = normalizeToMonthStart(date);
        if (normalizedDate) filters.date = normalizedDate;
    }

    // Role-based filtering for customRoles
    if (!isUserMasterAdmin(req.user)) {
        const assignedDepts = getAssignedDepartmentIds(req.user);
        
        if (departmentId) {
            if (!assignedDepts.includes(parseInt(departmentId))) {
                throw new ApiError("You are not authorized to access sheets for this department", 403);
            }
            filters.departmentId = parseInt(departmentId);
        } else {
            // Restrict returned rows to only their assigned departments
            filters.assignedDeptIds = assignedDepts;
        }
    } else if (departmentId) {
        filters.departmentId = parseInt(departmentId);
    }

    const sheets = await AbnormalConditionSheet.findAll(filters);
    res.status(200).json(new ApiResponse(200, sheets, "Abnormal condition sheets list retrieved successfully"));
});

// ── Layout (Abnormal Condition Layout & Revision editor) ──────────────────────
// Text-only layout (title, column headers, Remarks, default rows); Department → Global → defaults.

export const getAbnormalConditionLayout = asyncHandler(async (req, res) => {
    const departmentId = toLayoutDepartmentId(req.params.departmentId);
    const { layout, scope } = await findLayout(departmentId);
    res.status(200).json(new ApiResponse(200, { layout, scope }, "Abnormal condition layout fetched"));
});

export const getAbnormalConditionLayoutHistory = asyncHandler(async (req, res) => {
    const departmentId = toLayoutDepartmentId(req.params.departmentId);
    const history = await MonitoringConfig.getHistory(ABNORMAL_CONDITION_CONFIG_TYPE, departmentId, 0);
    res.status(200).json(new ApiResponse(200, history, "Abnormal condition layout history fetched"));
});

// Atomic save: the layout for this department (or the global template) plus the Revision
// Table record for the same scope, which propagates the doc/rev header onto saved sheets.
export const saveAbnormalConditionLayoutWithRevision = asyncHandler(async (req, res) => {
    const { departmentId, layout, remark, revision } = req.body || {};
    if (!remark?.trim()) throw new ApiError("Remark is required when updating the layout", 400);
    if (!revision?.docNo?.trim() || !revision?.revNo?.trim()) {
        throw new ApiError("Document No. and Revision No. are required", 400);
    }
    const errors = validateAbnormalConditionLayout(layout);
    if (errors.length) throw new ApiError(errors.join("; "), 400);

    const deptId = toLayoutDepartmentId(departmentId);
    const config = resolveAbnormalConditionLayout(layout);
    await MonitoringConfig.upsert({
        type: ABNORMAL_CONDITION_CONFIG_TYPE,
        departmentId: deptId,
        sectionId: 0,
        config,
        remark: remark.trim(),
        updatedBy: req.user?.fullName || req.user?.name || "Admin",
    });

    const savedRevision = await RevisionRecordService.upsertForScope(
        "abnormal-condition",
        deptId ? (parseInt(deptId, 10) || null) : null,
        null, // Abnormal Condition has no section concept.
        {
            sheetName: "Abnormal Condition",
            docNo: revision.docNo,
            revNo: revision.revNo,
            issueDate: revision.issueDate,
            revDate: revision.revDate,
            affectedSrNoPage: revision.affectedSrNoPage,
            affectedSrNoPageHi: revision.affectedSrNoPageHi,
            changeDetails: revision.changeDetails,
            changeDetailsHi: revision.changeDetailsHi,
        },
        req.user
    );

    logAudit(req.user?.id, "SAVE_ABNORMAL_CONDITION_LAYOUT_WITH_REVISION",
        { departmentId: deptId, remark: remark.trim(), revisionRecordId: savedRevision.id, docNo: revision.docNo, revNo: revision.revNo },
        { resourceType: "AbnormalConditionLayout", resourceId: deptId || "global", req }
    ).catch(err => console.error("logAudit(SAVE_ABNORMAL_CONDITION_LAYOUT_WITH_REVISION) failed:", err.message));

    res.status(200).json(new ApiResponse(200, { revision: savedRevision }, "Abnormal condition layout and revision saved"));
});
