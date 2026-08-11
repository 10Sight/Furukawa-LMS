import { executeQuery } from "../db/mssqlHelper.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getDesignationShutterExclusionSql } from "../utils/userEligibility.js";

const subSectionCountSql = `
    (SELECT COUNT(*)
     FROM users u
     WHERE ISNULL(u.isDeleted, 0) = 0
       AND ISNULL(u.isTemporary, 0) = 0
       AND u.status = 'PRESENT'
       ${getDesignationShutterExclusionSql("u")}
       AND (
           u.subSectionId = ss.id
           OR EXISTS (
               SELECT 1 FROM machine_assignments ma
               JOIN machines m ON ma.machine_id = m.id
               WHERE ma.user_id = u.id AND m.subSectionId = ss.id
           )
       )
    ) as subSectionCount
`;

const resolveDepartmentId = async (departmentId) => {
    if (!departmentId || departmentId === "undefined" || departmentId === "null") return null;
    let depts;
    if (!isNaN(departmentId) && !isNaN(parseFloat(departmentId))) {
        [depts] = await executeQuery("SELECT id FROM departments WHERE id = ?", [departmentId]);
        if (depts.length > 0) return depts[0].id;
    }
    [depts] = await executeQuery("SELECT id FROM departments WHERE name = ? OR uniCode = ? OR slug = ?", [departmentId, departmentId, departmentId]);
    return depts.length > 0 ? depts[0].id : null;
};

const resolveSectionId = async (sectionId) => {
    if (!sectionId || sectionId === "undefined" || sectionId === "null") return null;
    let sections;
    if (!isNaN(sectionId) && !isNaN(parseFloat(sectionId))) {
        [sections] = await executeQuery("SELECT id FROM [sections] WHERE id = ?", [sectionId]);
        if (sections.length > 0) return sections[0].id;
    }
    [sections] = await executeQuery("SELECT id FROM [sections] WHERE name = ? OR uniCode = ?", [sectionId, sectionId]);
    return sections.length > 0 ? sections[0].id : null;
};

// @desc    Create a new sub-section
// @route   POST /api/sub-sections
// @access  Private
export const createSubSection = asyncHandler(async (req, res) => {
    const { name, lineId, description, minimumRequiredLevel, minEfficiency, maxEfficiency } = req.body;

    if (!name || !lineId) {
        throw new ApiError(400, "Name and Line ID are required");
    }

    // Check if line exists
    if (isNaN(lineId)) {
        throw new ApiError(400, "Invalid Line ID parameter. Must be numeric.");
    }

    const [lines] = await executeQuery("SELECT id FROM [lines] WHERE id = ?", [lineId]);
    if (lines.length === 0) {
        throw new ApiError(404, "Line not found");
    }

    // Insert
    const [result] = await executeQuery(
        "INSERT INTO [sub_sections] (name, lineId, description, minimumRequiredLevel, minEfficiency, maxEfficiency, isActive, createdAt, updatedAt) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())",
        [name, lineId, description, minimumRequiredLevel || null, minEfficiency ?? null, maxEfficiency ?? null, true]
    );

    const [newSubSection] = await executeQuery(`
        SELECT ss.*, l.name as lineName, s.name as sectionName,
        ${subSectionCountSql}
        FROM [sub_sections] ss 
        LEFT JOIN [lines] l ON ss.lineId = l.id
        LEFT JOIN [sections] s ON l.sectionId = s.id
        WHERE ss.id = ?`, [result[0].id]);

    res.status(201).json(
        new ApiResponse(201, newSubSection[0], "Sub-Section created successfully")
    );
});

// @desc    Get all sub-sections for a line
// @route   GET /api/sub-sections/line/:lineId
// @access  Private
export const getSubSectionsByLine = asyncHandler(async (req, res) => {
    const { lineId } = req.params;
    let lineIds = [];
    if (typeof lineId === 'string' && lineId.includes(',')) {
        lineIds = lineId.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    } else {
        const parsed = parseInt(lineId);
        if (!isNaN(parsed)) {
            lineIds.push(parsed);
        }
    }

    if (lineIds.length === 0) {
        throw new ApiError(400, "Invalid Line ID parameter. Must be numeric.");
    }

    const idsString = lineIds.join(',');
    const [subSections] = await executeQuery(`
        SELECT ss.*, l.name as lineName, s.name as sectionName,
        ${subSectionCountSql}
        FROM [sub_sections] ss 
        LEFT JOIN [lines] l ON ss.lineId = l.id
        LEFT JOIN [sections] s ON l.sectionId = s.id
        WHERE ss.lineId IN (${idsString}) 
        ORDER BY ss.createdAt DESC`);

    res.status(200).json(
        new ApiResponse(200, subSections, "Sub-Sections fetched successfully")
    );
});

// @desc    Get a sub-section by ID
// @route   GET /api/sub-sections/:id
// @access  Private
export const getSubSectionById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
        throw new ApiError(400, "Invalid Sub-Section ID parameter. Must be numeric.");
    }

    const [subSections] = await executeQuery(`
        SELECT ss.*, l.name as lineName, s.name as sectionName,
        ${subSectionCountSql}
        FROM [sub_sections] ss 
        LEFT JOIN [lines] l ON ss.lineId = l.id
        LEFT JOIN [sections] s ON l.sectionId = s.id
        WHERE ss.id = ?`, [id]);

    if (subSections.length === 0) {
        throw new ApiError(404, "Sub-Section not found");
    }

    res.status(200).json(
        new ApiResponse(200, subSections[0], "Sub-Section fetched successfully")
    );
});

// @desc    Update a sub-section
// @route   PUT /api/sub-sections/:id
// @access  Private
export const updateSubSection = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, isActive, minimumRequiredLevel, minEfficiency, maxEfficiency } = req.body;

    if (isNaN(id)) {
        throw new ApiError(400, "Invalid Sub-Section ID parameter. Must be numeric.");
    }

    const [existing] = await executeQuery("SELECT * FROM [sub_sections] WHERE id = ?", [id]);
    if (existing.length === 0) {
        throw new ApiError(404, "Sub-Section not found");
    }
    const subSection = existing[0];

    let updateFields = [];
    let updateValues = [];

    if (typeof name !== 'undefined') { updateFields.push("name = ?"); updateValues.push(name); }
    if (typeof description !== 'undefined') { updateFields.push("description = ?"); updateValues.push(description); }
    if (typeof minimumRequiredLevel !== 'undefined') { updateFields.push("minimumRequiredLevel = ?"); updateValues.push(minimumRequiredLevel); }
    if (typeof minEfficiency !== 'undefined') { updateFields.push("minEfficiency = ?"); updateValues.push(minEfficiency ?? null); }
    if (typeof maxEfficiency !== 'undefined') { updateFields.push("maxEfficiency = ?"); updateValues.push(maxEfficiency ?? null); }
    if (typeof isActive !== 'undefined') { updateFields.push("isActive = ?"); updateValues.push(isActive); }

    if (updateFields.length > 0) {
        updateFields.push("updatedAt = GETDATE()");
        await executeQuery(`UPDATE [sub_sections] SET ${updateFields.join(', ')} WHERE id = ?`, [...updateValues, id]);
    }

    const [updatedSubSection] = await executeQuery(`
        SELECT ss.*, l.name as lineName, s.name as sectionName,
        ${subSectionCountSql}
        FROM [sub_sections] ss 
        LEFT JOIN [lines] l ON ss.lineId = l.id
        LEFT JOIN [sections] s ON l.sectionId = s.id
        WHERE ss.id = ?`, [id]);

    res.status(200).json(
        new ApiResponse(200, updatedSubSection[0], "Sub-Section updated successfully")
    );
});

// @desc    Delete a sub-section
// @route   DELETE /api/sub-sections/:id
// @access  Private
export const deleteSubSection = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
        throw new ApiError(400, "Invalid Sub-Section ID parameter. Must be numeric.");
    }

    // Cascade Delete Machines
    await executeQuery("DELETE FROM machines WHERE subSectionId = ?", [id]);

    await executeQuery("DELETE FROM [sub_sections] WHERE id = ?", [id]);

    res.status(200).json(
        new ApiResponse(200, {}, "Sub-Section deleted successfully")
    );
});

export const getAllSubSections = asyncHandler(async (req, res) => {
    const { lineId, departmentId, sectionId } = req.query;

    let querySQL = `
        SELECT ss.*, l.name as lineName, s.name as sectionName,
        ${subSectionCountSql}
        FROM [sub_sections] ss
        LEFT JOIN [lines] l ON ss.lineId = l.id
        LEFT JOIN [sections] s ON l.sectionId = s.id`;
    let conditions = [];

    if (lineId) {
        let lineIds = [];
        if (typeof lineId === 'string' && lineId.includes(',')) {
            lineIds = lineId.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        } else {
            const parsed = parseInt(lineId);
            if (!isNaN(parsed)) lineIds.push(parsed);
        }
        if (lineIds.length > 0) {
            conditions.push(`ss.lineId IN (${lineIds.join(',')})`);
        }
    }

    if (departmentId) {
        let departmentIds = [];
        if (typeof departmentId === 'string' && departmentId.includes(',')) {
            const parts = departmentId.split(',');
            for (const part of parts) {
                const resolved = await resolveDepartmentId(part.trim());
                if (resolved) departmentIds.push(resolved);
            }
        } else {
            const resolved = await resolveDepartmentId(departmentId);
            if (resolved) departmentIds.push(resolved);
        }
        if (departmentIds.length > 0) {
            conditions.push(`l.department IN (${departmentIds.join(',')})`);
        }
    }

    if (sectionId) {
        let sectionIds = [];
        if (typeof sectionId === 'string' && sectionId.includes(',')) {
            const parts = sectionId.split(',');
            for (const part of parts) {
                const resolved = await resolveSectionId(part.trim());
                if (resolved) sectionIds.push(resolved);
            }
        } else {
            const resolved = await resolveSectionId(sectionId);
            if (resolved) sectionIds.push(resolved);
        }
        if (sectionIds.length > 0) {
            conditions.push(`l.sectionId IN (${sectionIds.join(',')})`);
        }
    }

    if (conditions.length > 0) {
        querySQL += " WHERE " + conditions.join(" AND ");
    }

    querySQL += " ORDER BY ss.createdAt DESC";

    const [subSections] = await executeQuery(querySQL);

    res.status(200).json(
        new ApiResponse(200, subSections, "Sub-Sections fetched successfully")
    );
});
