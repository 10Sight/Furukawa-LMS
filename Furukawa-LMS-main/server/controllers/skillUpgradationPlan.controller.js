import SkillUpgradationPlan from "../models/skillUpgradationPlan.model.js";
import SkillUpgradationPlanConfig from "../models/skillUpgradationPlanConfig.model.js";
import CourseLevelConfig from "../models/courseLevelConfig.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import NotificationService from "../services/notification.service.js";
import logAudit from "../utils/auditLogger.js";
import RevisionRecordService from "../services/revisionRecord.service.js";
import { syncAllPassedEvaluationsForPlan, sanitizeSkillUpgradationTableData } from "../utils/skillMatrix.util.js";

// Get skill upgradation plan by department
export const getSkillUpgradationPlanByDepartment = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const { sectionId, year } = req.query;
    if (!departmentId) throw new ApiError("Department ID is required", 400);

    const plan = await SkillUpgradationPlan.findByHierarchy(
        departmentId,
        sectionId ? parseInt(sectionId) : null,
        year ? parseInt(year) : null
    );

    logAudit(req.user?.id, "VIEW_SKILL_UPGRADATION_PLAN", { departmentId, sectionId, year },
        { resourceType: "SkillUpgradationPlan", resourceId: plan?.id || departmentId, req }
    ).catch(err => console.error("logAudit(VIEW_SKILL_UPGRADATION_PLAN) failed:", err.message));

    if (!plan) {
        return res.status(200).json(
            new ApiResponse(200, { isNew: true, departmentId, sectionId, year, selectedLines: [], tableData: {} }, "No skill upgradation plan found")
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

    const { sectionId, year, selectedLines, tableData, sendEmail = false } = req.body || {};

    const existing = await SkillUpgradationPlan.findByHierarchy(
        parseInt(departmentId),
        sectionId ? parseInt(sectionId) : null,
        year ? parseInt(year) : null
    );

    // Brand-new plan: freeze whatever the Revision Table currently says for this
    // form. Existing plans are untouched — upsert()'s UPDATE branch never writes
    // these columns, regardless of what's passed in.
    let revisionSnapshot = {};
    if (!existing) {
        const revision = await RevisionRecordService.getLatestForSheet('skill-upgradation-plan', parseInt(departmentId), sectionId ? parseInt(sectionId) : null);
        if (revision?.docNo) {
            revisionSnapshot = { docNo: revision.docNo, revNo: revision.revNo, revDate: revision.revDate };
        }
    }

    const sanitizedTableData = sanitizeSkillUpgradationTableData(
        tableData && typeof tableData === "object" ? tableData : {},
        year
    );

    let saved = await SkillUpgradationPlan.upsert({
        departmentId: parseInt(departmentId),
        sectionId: sectionId ? parseInt(sectionId) : null,
        year: year ? parseInt(year) : null,
        selectedLines: Array.isArray(selectedLines) ? selectedLines : [],
        tableData: sanitizedTableData,
        userName: req.user?.fullName || req.user?.name || req.user?.userName || "",
        ...revisionSnapshot,
    });

    // Brand-new, still-empty plan: auto-populate it with whatever's already been evaluated
    // and passed for students in this department/section, so "Create Plan" doesn't start
    // blank when certificates were already filled out before the plan existed.
    const incomingTableDataIsEmpty = !tableData || Object.keys(tableData).length === 0;
    if (!existing && incomingTableDataIsEmpty) {
        try {
            const activeConfig = await CourseLevelConfig.getActiveConfig();
            await syncAllPassedEvaluationsForPlan({
                departmentId: parseInt(departmentId),
                sectionId: sectionId ? parseInt(sectionId) : null,
                activeConfig
            });
            saved = await SkillUpgradationPlan.findByHierarchy(
                parseInt(departmentId),
                sectionId ? parseInt(sectionId) : null,
                year ? parseInt(year) : null
            );
        } catch (err) {
            console.error("[SkillUpgradationPlan] Failed to auto-populate new plan from evaluations:", err);
        }
    }

    const action = existing ? "SAVE_SKILL_UPGRADATION_PLAN" : "CREATE_SKILL_UPGRADATION_PLAN";
    const rowCount = Object.keys(saved.tableData || {}).filter(k => k !== "__removedUserIds").length;
    logAudit(req.user?.id, action, { departmentId, sectionId, year, rowCount },
        { resourceType: "SkillUpgradationPlan", resourceId: saved.id, req }
    ).catch(err => console.error(`logAudit(${action}) failed:`, err.message));

    // Trigger Email Notification only when explicitly requested
    if (sendEmail === true) {
        const updatedBy = req.user?.fullName || req.user?.name || req.user?.userName || "";
        NotificationService.sendFormReport("Skill Upgradation Sheet", departmentId, { sectionId, year, selectedLines, tableData, updatedBy })
            .catch(err => console.error("[Notification] Failed to trigger email:", err));
    }

    return res.status(200).json(
        new ApiResponse(200, saved, sendEmail === true
            ? "Skill upgradation plan saved & email dispatched successfully"
            : "Skill upgradation plan saved successfully")
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

// Delete skill upgradation plan by id
export const deleteSkillUpgradationPlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) throw new ApiError("Plan ID is required", 400);

    const deleted = await SkillUpgradationPlan.delete(id);
    if (!deleted) throw new ApiError("Skill upgradation plan not found", 404);

    logAudit(req.user?.id, "DELETE_SKILL_UPGRADATION_PLAN", { id },
        { resourceType: "SkillUpgradationPlan", resourceId: id, req }
    ).catch(err => console.error("logAudit(DELETE_SKILL_UPGRADATION_PLAN) failed:", err.message));

    return res.status(200).json(
        new ApiResponse(200, { id }, "Skill upgradation plan deleted successfully")
    );
});

// List all skill upgradation plans
export const listSkillUpgradationPlans = asyncHandler(async (req, res) => {
    const { departmentId, sectionId } = req.query;
    const plans = await SkillUpgradationPlan.listPlans(
        departmentId ? parseInt(departmentId) : null,
        sectionId ? parseInt(sectionId) : null
    );

    logAudit(req.user?.id, "VIEW_SKILL_UPGRADATION_PLANS_LIST", { departmentId, sectionId },
        { resourceType: "SkillUpgradationPlan", req }
    ).catch(err => console.error("logAudit(VIEW_SKILL_UPGRADATION_PLANS_LIST) failed:", err.message));

    return res.status(200).json(
        new ApiResponse(200, plans, "Skill upgradation plans list fetched successfully")
    );
});
