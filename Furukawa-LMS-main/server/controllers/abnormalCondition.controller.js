import AbnormalConditionSheet from "../models/abnormalCondition.model.js";
import NotificationService from "../services/notification.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
        sheet = await AbnormalConditionSheet.create({
            departmentId: parseInt(departmentId),
            date: normalizedDate,
            updatedBy: req.user?.fullName || "System",
            isSubmitted: false
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
    if (metadata) sheet.metadata = metadata;
    
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
