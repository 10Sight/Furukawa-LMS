import SkillUpgradationPlan from "../models/skillUpgradationPlan.model.js";
import SkillUpgradationPlanConfig from "../models/skillUpgradationPlanConfig.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import NotificationService from "../services/notification.service.js";

// Get skill upgradation plan by department
export const getSkillUpgradationPlanByDepartment = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const { sectionId } = req.query;
    if (!departmentId) throw new ApiError("Department ID is required", 400);

    const plan = await SkillUpgradationPlan.findByHierarchy(departmentId, sectionId);
    if (!plan) {
        return res.status(200).json(
            new ApiResponse(200, { isNew: true, departmentId, sectionId, selectedLines: [], tableData: {} }, "No skill upgradation plan found")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, { ...plan, isNew: false }, "Skill upgradation plan fetched successfully")
    );
});

// Save skill upgradation plan by department
export const saveSkillUpgradationPlanByDepartment = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    if (!departmentId) throw new ApiError("Department ID is required", 400);

    const { sectionId, selectedLines, tableData } = req.body || {};

    const saved = await SkillUpgradationPlan.upsert({
        departmentId,
        sectionId,
        selectedLines: Array.isArray(selectedLines) ? selectedLines : [],
        tableData: tableData && typeof tableData === "object" ? tableData : {},
        userName: req.user?.fullName || req.user?.name || req.user?.userName || "",
    });

    // Trigger Email Notification
    NotificationService.sendFormReport("Skill Upgradation Sheet", departmentId, { sectionId, selectedLines, tableData })
        .catch(err => console.error("[Notification] Failed to trigger email:", err));

    return res.status(200).json(
        new ApiResponse(200, saved, "Skill upgradation plan saved successfully")
    );
});

// Get skill upgradation plan config
export const getSkillUpgradationPlanConfig = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    if (!departmentId) throw new ApiError("Department ID is required", 400);

    const config = await SkillUpgradationPlanConfig.findByDepartmentId(departmentId);
    if (!config) {
        return res.status(200).json(
            new ApiResponse(200, { isNew: true, departmentId }, "No configuration found")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, { ...config, isNew: false }, "Configuration fetched successfully")
    );
});

// Save skill upgradation plan config
export const saveSkillUpgradationPlanConfig = asyncHandler(async (req, res) => {
    const { departmentId, config, remark } = req.body;
    if (!departmentId) throw new ApiError("Department ID is required", 400);
    if (!config) throw new ApiError("Configuration data is required", 400);

    const updatedBy = req.user?.fullName || req.user?.name || "System";
    const saved = await SkillUpgradationPlanConfig.upsert(departmentId, config, remark, updatedBy);

    return res.status(200).json(
        new ApiResponse(200, saved, "Configuration saved successfully")
    );
});

// Get skill upgradation plan history
export const getSkillUpgradationPlanHistory = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    if (!departmentId) throw new ApiError("Department ID is required", 400);

    const history = await SkillUpgradationPlanConfig.getHistory(departmentId);
    return res.status(200).json(
        new ApiResponse(200, history, "History fetched successfully")
    );
});
