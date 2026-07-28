import MultiSkillingPlan from "../models/multiSkillingPlan.model.js";
import MultiSkillingPlanConfig from "../models/multiSkillingPlanConfig.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import NotificationService from "../services/notification.service.js";
import RevisionRecordService from "../services/revisionRecord.service.js";

// Get multi skilling plan by department
export const getMultiSkillingPlanByDepartment = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const { sectionId, year } = req.query;
    if (!departmentId) throw new ApiError("Department ID is required", 400);

    const plan = await MultiSkillingPlan.findByHierarchy(
        departmentId,
        sectionId ? parseInt(sectionId) : null,
        year ? parseInt(year) : null
    );
    if (!plan) {
        return res.status(200).json(
            new ApiResponse(200, { isNew: true, departmentId, sectionId, year, selectedLines: [], tableData: {} }, "No multi skilling plan found")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, { ...plan, isNew: false }, "Multi skilling plan fetched successfully")
    );
});

// Save multi skilling plan by department
export const saveMultiSkillingPlanByDepartment = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    if (!departmentId) throw new ApiError("Department ID is required", 400);

    const { sectionId, year, selectedLines, tableData, sendEmail = false } = req.body || {};

    const parsedSectionId = sectionId ? parseInt(sectionId) : null;
    const parsedYear = year ? parseInt(year) : null;

    // Brand-new plan: freeze whatever the Revision Table currently says for this
    // form. Existing plans are untouched — upsert()'s UPDATE branch never writes
    // these columns, regardless of what's passed in.
    const existing = await MultiSkillingPlan.findByHierarchy(parseInt(departmentId), parsedSectionId, parsedYear);
    let revisionSnapshot = {};
    if (!existing) {
        const revision = await RevisionRecordService.getLatestForSheet('multi-skilling-plan', parseInt(departmentId), parsedSectionId);
        if (revision?.docNo) {
            revisionSnapshot = { docNo: revision.docNo, revNo: revision.revNo, revDate: revision.revDate };
        }
    }

    const saved = await MultiSkillingPlan.upsert({
        departmentId: parseInt(departmentId),
        sectionId: parsedSectionId,
        year: parsedYear,
        selectedLines: Array.isArray(selectedLines) ? selectedLines : [],
        tableData: tableData && typeof tableData === "object" ? tableData : {},
        userName: req.user?.fullName || req.user?.name || req.user?.userName || "",
        ...revisionSnapshot,
    });

    // Trigger Email Notification only when explicitly requested
    if (sendEmail === true) {
        const updatedBy = req.user?.fullName || req.user?.name || req.user?.userName || "";
        NotificationService.sendFormReport("Multi Skill Sheet", departmentId, { sectionId, year, selectedLines, tableData, updatedBy })
            .catch(err => console.error("[Notification] Failed to trigger email:", err));
    }

    return res.status(200).json(
        new ApiResponse(200, saved, sendEmail === true
            ? "Multi skilling plan saved & email dispatched successfully"
            : "Multi skilling plan saved successfully")
    );
});

// Get multi skilling plan config
export const getMultiSkillingPlanConfig = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    if (!departmentId) throw new ApiError("Department ID is required", 400);

    const config = await MultiSkillingPlanConfig.findByDepartmentId(departmentId);
    if (!config) {
        return res.status(200).json(
            new ApiResponse(200, { isNew: true, departmentId }, "No configuration found")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, { ...config, isNew: false }, "Configuration fetched successfully")
    );
});

// Save multi skilling plan config
export const saveMultiSkillingPlanConfig = asyncHandler(async (req, res) => {
    const { departmentId, config, remark } = req.body;
    if (!departmentId) throw new ApiError("Department ID is required", 400);
    if (!config) throw new ApiError("Configuration data is required", 400);

    const updatedBy = req.user?.fullName || req.user?.name || "System";
    const saved = await MultiSkillingPlanConfig.upsert(departmentId, config, remark, updatedBy);

    return res.status(200).json(
        new ApiResponse(200, saved, "Configuration saved successfully")
    );
});

// Get multi skilling plan history
export const getMultiSkillingPlanHistory = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    if (!departmentId) throw new ApiError("Department ID is required", 400);

    const history = await MultiSkillingPlanConfig.getHistory(departmentId);
    return res.status(200).json(
        new ApiResponse(200, history, "History fetched successfully")
    );
});

// List all multi-skilling plans
export const listMultiSkillingPlans = asyncHandler(async (req, res) => {
    const { departmentId, sectionId } = req.query;
    const plans = await MultiSkillingPlan.listPlans(
        departmentId ? parseInt(departmentId) : null,
        sectionId ? parseInt(sectionId) : null
    );
    return res.status(200).json(
        new ApiResponse(200, plans, "Multi-skilling plans list fetched successfully")
    );
});
