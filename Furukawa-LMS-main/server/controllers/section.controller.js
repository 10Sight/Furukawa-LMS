import { ApiResponse } from "../utils/ApiResponse.js";
import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Section from "../models/section.model.js";

// @desc    Create a new section
// @route   POST /api/sections
// @access  Private
export const createSection = asyncHandler(async (req, res) => {
    const { name, uniCode, description, category, daily5mFormType, tenCycleFormType, departmentId } = req.body;

    if (!name || !departmentId) {
        throw new ApiError(400, "Name and Department ID are required");
    }

    const trimmedUniCode = (uniCode || "").trim();
    if (!trimmedUniCode) {
        throw new ApiError(400, "UniCode is required");
    }

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
        departmentId
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
        new ApiResponse(200, sections, "Sections fetched successfully")
    );
});

// @desc    Get all sections globally (optional: filter by department)
// @route   GET /api/sections
// @access  Private
export const getAllSections = asyncHandler(async (req, res) => {
    const { departmentId } = req.query;
    let querySQL = "SELECT id, name, uniCode, description, category, departmentId, isActive, daily5mApproverDeptId, daily5mApproverSectionId, daily5mApproverLineId FROM [sections]";
    let params = [];

    if (departmentId && departmentId !== "ALL" && departmentId !== "undefined" && departmentId !== "null") {
        querySQL += " WHERE departmentId = ?";
        params.push(departmentId);
    }

    querySQL += " ORDER BY name ASC";

    const [sections] = await executeQuery(querySQL, params);

    res.status(200).json(
        new ApiResponse(200, sections, "Sections fetched successfully")
    );
});

// @desc    Update a section
// @route   PUT /api/sections/:id
// @access  Private
export const updateSection = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, uniCode, description, category, daily5mFormType, tenCycleFormType, isActive } = req.body;

    let trimmedUniCode;
    if (uniCode !== undefined) {
        trimmedUniCode = uniCode.trim();
        if (!trimmedUniCode) {
            throw new ApiError(400, "UniCode is required");
        }

        const [existing] = await executeQuery(
            "SELECT id FROM [sections] WHERE LOWER(LTRIM(RTRIM(uniCode))) = LOWER(?) AND id != ?",
            [trimmedUniCode, id]
        );
        if (existing.length > 0) {
            throw new ApiError(400, `Section with UniCode '${trimmedUniCode}' already exists`);
        }
    }

    const updatedSection = await Section.update(id, {
        name,
        uniCode: trimmedUniCode,
        description,
        category,
        daily5mFormType,
        tenCycleFormType,
        isActive
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
