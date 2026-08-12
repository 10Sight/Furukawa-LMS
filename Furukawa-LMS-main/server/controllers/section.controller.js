import { ApiResponse } from "../utils/ApiResponse.js";
import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Section from "../models/section.model.js";
import CourseLevelConfig from "../models/courseLevelConfig.model.js";
import { getCustomRoleScope } from "./user.controller.js";

const VALID_SKILL_LEVELS = ["L1", "L2", "L3", "L4"];

// Confines a list of section rows to a CUSTOM-role user's assigned departments/sections, so the
// department-filter dropdowns (and any client widening/dropping departmentId) can't be used to
// enumerate sections outside their profile. Non-CUSTOM users, and CUSTOM users on a full-access
// layout with no assignments, are left unrestricted.
const filterSectionsByUserScope = (sections, user) => {
    if (user?.role !== 'CUSTOM') return sections;

    // Access-all bypass permissions: department.controller.js's getAllDepartments/
    // getHandoverSheetsMonitoring already treat these as full department access, so a user
    // with one of these sees every department in the dropdown. Without the same bypass here,
    // picking a department they aren't explicitly assigned to hits getCustomRoleScope's
    // allowedDepts=[] branch and silently returns [] sections instead of respecting the bypass.
    const permissions = user?.customRole?.permissions || [];
    const hasBypass = permissions.includes('dojo:handover_sheet') ||
        permissions.includes('dojo:sixteenday_monitoring') ||
        permissions.includes('test_paper:access_all');
    if (hasBypass) return sections;

    const { isFullAccessLayout, allowedDepts, allowedSections } = getCustomRoleScope(user);
    if (allowedDepts.length === 0 && allowedSections.length === 0) {
        return isFullAccessLayout ? sections : [];
    }
    return sections.filter(s =>
        (allowedSections.length > 0 && allowedSections.includes(String(s.id))) ||
        (allowedDepts.length > 0 && allowedDepts.includes(String(s.departmentId)))
    );
};

// Resolves the set of valid skill level names (uppercased) from the active
// Course Level Config, falling back to the legacy L1-L4 set if none exists.
const getValidSkillLevels = async () => {
    const activeConfig = await CourseLevelConfig.getActiveConfig();
    return activeConfig && activeConfig.levels.length > 0
        ? activeConfig.levels.map(l => l.name.toUpperCase())
        : VALID_SKILL_LEVELS;
};

// Validates a { L1: number, L2: number, ... } per-level day count override map.
// Throws ApiError on malformed keys/values; silently allows undefined/null/empty (no overrides).
const validateDayCountsMap = (map, label, validLevels) => {
    if (map === undefined || map === null || map === "") return;
    if (typeof map !== "object" || Array.isArray(map)) {
        throw new ApiError(400, `${label} must be an object keyed by skill level`);
    }
    for (const [level, value] of Object.entries(map)) {
        if (!validLevels.includes(level.toUpperCase())) {
            throw new ApiError(400, `${label} has an invalid skill level '${level}'`);
        }
        if (value === undefined || value === null || value === "") continue;
        if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
            throw new ApiError(400, `${label} for ${level} must be a positive number`);
        }
    }
};

// @desc    Create a new section
// @route   POST /api/sections
// @access  Private
export const createSection = asyncHandler(async (req, res) => {
    const { name, uniCode, description, category, daily5mFormType, tenCycleFormType, departmentId, hideTenCycle, hideOperatorObservance, skillUpgradationDayCount, multiSkillingDayCount, skillUpgradationDayCounts, multiSkillingDayCounts } = req.body;

    if (!name || !departmentId) {
        throw new ApiError(400, "Name and Department ID are required");
    }

    const trimmedUniCode = (uniCode || "").trim();
    if (!trimmedUniCode) {
        throw new ApiError(400, "UniCode is required");
    }

    if (skillUpgradationDayCount !== undefined && skillUpgradationDayCount !== null && skillUpgradationDayCount !== "" && (!Number.isFinite(Number(skillUpgradationDayCount)) || Number(skillUpgradationDayCount) <= 0)) {
        throw new ApiError(400, "Skill Upgradation Day Count must be a positive number");
    }
    if (multiSkillingDayCount !== undefined && multiSkillingDayCount !== null && multiSkillingDayCount !== "" && (!Number.isFinite(Number(multiSkillingDayCount)) || Number(multiSkillingDayCount) <= 0)) {
        throw new ApiError(400, "Multi-Skilling Day Count must be a positive number");
    }
    const createValidLevels = await getValidSkillLevels();
    validateDayCountsMap(skillUpgradationDayCounts, "Skill Upgradation Day Count", createValidLevels);
    validateDayCountsMap(multiSkillingDayCounts, "Multi-Skilling Day Count", createValidLevels);

    const [existing] = await executeQuery(
        "SELECT id FROM [sections] WHERE LOWER(LTRIM(RTRIM(uniCode))) = LOWER(?)",
        [trimmedUniCode]
    );
    if (existing.length > 0) {
        throw new ApiError(400, `Section with UniCode '${trimmedUniCode}' already exists`);
    }

    const newSection = await Section.create({
        name,
        uniCode: trimmedUniCode,
        description,
        category,
        daily5mFormType,
        tenCycleFormType,
        departmentId,
        hideTenCycle,
        hideOperatorObservance,
        skillUpgradationDayCount,
        multiSkillingDayCount,
        skillUpgradationDayCounts,
        multiSkillingDayCounts
    });

    res.status(201).json(
        new ApiResponse(201, newSection, "Section created successfully")
    );
});

// @desc    Get all sections for a department
// @route   GET /api/sections/department/:departmentId
// @access  Private
export const getSectionsByDepartment = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;

    const sections = await Section.findByDepartment(departmentId);

    res.status(200).json(
        new ApiResponse(200, filterSectionsByUserScope(sections, req.user), "Sections fetched successfully")
    );
});

// @desc    Get all sections globally (optional: filter by department)
// @route   GET /api/sections
// @access  Private
export const getAllSections = asyncHandler(async (req, res) => {
    const { departmentId } = req.query;
    let querySQL = "SELECT id, name, uniCode, description, category, departmentId, isActive, hideTenCycle, hideOperatorObservance, daily5mApproverDeptId, daily5mApproverSectionId, daily5mApproverLineId FROM [sections]";
    let params = [];

    if (departmentId && departmentId !== "ALL" && departmentId !== "undefined" && departmentId !== "null") {
        querySQL += " WHERE departmentId = ?";
        params.push(departmentId);
    }

    querySQL += " ORDER BY name ASC";

    const [sections] = await executeQuery(querySQL, params);

    res.status(200).json(
        new ApiResponse(200, filterSectionsByUserScope(sections, req.user), "Sections fetched successfully")
    );
});

// @desc    Update a section
// @route   PUT /api/sections/:id
// @access  Private
export const updateSection = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, uniCode, description, category, daily5mFormType, tenCycleFormType, isActive, hideTenCycle, hideOperatorObservance, skillUpgradationDayCount, multiSkillingDayCount, skillUpgradationDayCounts, multiSkillingDayCounts } = req.body;

    let trimmedUniCode;
    if (uniCode !== undefined) {
        trimmedUniCode = uniCode.trim();
        if (!trimmedUniCode) {
            throw new ApiError(400, "UniCode is required");
        }

        const section = await Section.findById(id);
        if (!section) {
            throw new ApiError(404, "Section not found");
        }

        if (section.uniCode !== trimmedUniCode) {
            if (!req.user?.isAdmin) {
                throw new ApiError(403, "Only administrators can change the Section UniCode");
            }

            const [existing] = await executeQuery(
                "SELECT id FROM [sections] WHERE LOWER(LTRIM(RTRIM(uniCode))) = LOWER(?) AND id != ?",
                [trimmedUniCode, id]
            );
            if (existing.length > 0) {
                throw new ApiError(400, `Section with UniCode '${trimmedUniCode}' already exists`);
            }
        }
    }

    if (skillUpgradationDayCount !== undefined && skillUpgradationDayCount !== null && skillUpgradationDayCount !== "" && (!Number.isFinite(Number(skillUpgradationDayCount)) || Number(skillUpgradationDayCount) <= 0)) {
        throw new ApiError(400, "Skill Upgradation Day Count must be a positive number");
    }
    if (multiSkillingDayCount !== undefined && multiSkillingDayCount !== null && multiSkillingDayCount !== "" && (!Number.isFinite(Number(multiSkillingDayCount)) || Number(multiSkillingDayCount) <= 0)) {
        throw new ApiError(400, "Multi-Skilling Day Count must be a positive number");
    }
    const updateValidLevels = await getValidSkillLevels();
    validateDayCountsMap(skillUpgradationDayCounts, "Skill Upgradation Day Count", updateValidLevels);
    validateDayCountsMap(multiSkillingDayCounts, "Multi-Skilling Day Count", updateValidLevels);

    const updatedSection = await Section.update(id, {
        name,
        uniCode: trimmedUniCode,
        description,
        category,
        daily5mFormType,
        tenCycleFormType,
        isActive,
        hideTenCycle,
        hideOperatorObservance,
        skillUpgradationDayCount,
        multiSkillingDayCount,
        skillUpgradationDayCounts,
        multiSkillingDayCounts
    });

    if (!updatedSection) {
        throw new ApiError(404, "Section not found or no changes made");
    }

    res.status(200).json(
        new ApiResponse(200, updatedSection, "Section updated successfully")
    );
});

// @desc    Delete a section
// @route   DELETE /api/sections/:id
// @access  Private
export const deleteSection = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Cascade Delete Hierarchy
    const [lines] = await executeQuery("SELECT id FROM [lines] WHERE sectionId = ?", [id]);
    const lineIds = lines.map(l => l.id);

    if (lineIds.length > 0) {
        // 1. Delete all machines for these lines (via sub-sections)
        const [subSections] = await executeQuery(`SELECT id FROM [sub_sections] WHERE lineId IN (${lineIds.join(",")})`);
        const subSectionIds = subSections.map(s => s.id);
        
        if (subSectionIds.length > 0) {
            await executeQuery(`DELETE FROM machines WHERE subSectionId IN (${subSectionIds.join(",")})`);
            await executeQuery(`DELETE FROM [sub_sections] WHERE lineId IN (${lineIds.join(",")})`);
        }

        // 2. Delete all lines for this section
        await executeQuery("DELETE FROM [lines] WHERE sectionId = ?", [id]);
    }

    const success = await Section.delete(id);

    if (!success) {
        throw new ApiError(404, "Section not found");
    }

    res.status(200).json(
        new ApiResponse(200, {}, "Section deleted successfully")
    );
});
