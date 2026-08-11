import { executeQuery } from "../db/mssqlHelper.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getDesignationShutterExclusionSql } from "../utils/userEligibility.js";
import fs from "fs";

const lineCountSql = `
    (SELECT COUNT(*)
     FROM users u
     WHERE ISNULL(u.isDeleted, 0) = 0
       AND ISNULL(u.isTemporary, 0) = 0
       AND u.status = 'PRESENT'
       ${getDesignationShutterExclusionSql("u")}
       AND (
           u.lineId = l.id
           OR EXISTS (
               SELECT 1 FROM machine_assignments ma
               JOIN machines m ON ma.machine_id = m.id
               WHERE ma.user_id = u.id AND m.line = l.id
           )
       )
    ) as lineCount
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

// @desc    Create a new line
// @route   POST /api/lines
// @access  Private
export const createLine = asyncHandler(async (req, res) => {
    let { name, uniCode, lineLeader, mentor, requirement, departmentId, sectionId, description, tenCycleFormType } = req.body;

    if (!name || !departmentId || !sectionId) {
        throw new ApiError(400, "Name, Department ID, and Section ID are required");
    }

    // Resolve IDs
    const did = await resolveDepartmentId(departmentId);
    if (!did) throw new ApiError(404, "Department not found");
    departmentId = did;

    const sid = await resolveSectionId(sectionId);
    if (!sid) throw new ApiError(404, "Section not found");
    sectionId = sid;

    // Check if line with same name exists in this section
    const [existingLine] = await executeQuery("SELECT id FROM [lines] WHERE name = ? AND sectionId = ?", [name, sectionId]);
    if (existingLine.length > 0) {
        throw new ApiError(400, "Line with this name already exists in this section");
    }

    // Insert
    const [result] = await executeQuery(
        "INSERT INTO [lines] (name, uniCode, lineLeader, mentor, requirement, department, sectionId, description, isActive, tenCycleFormType, createdAt, updatedAt) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())",
        [
            name,
            uniCode && uniCode.trim() !== "" ? uniCode.trim() : null,
            lineLeader && lineLeader.trim() !== "" ? lineLeader.trim() : null,
            mentor && mentor.trim() !== "" ? mentor.trim() : null,
            requirement || 0,
            departmentId,
            sectionId,
            description,
            true,
            tenCycleFormType || "form1"
        ]
    );

    const [newLine] = await executeQuery(`
        SELECT l.*, 
        ${lineCountSql}
        FROM [lines] l WHERE l.id = ?`, [result[0].id]);

    res.status(201).json(
        new ApiResponse(201, newLine[0], "Line created successfully")
    );
});

// @desc    Get all lines for a section
// @route   GET /api/lines/section/:sectionId
// @access  Private
export const getLinesBySection = asyncHandler(async (req, res) => {
    const { sectionId } = req.params;
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

    if (sectionIds.length === 0) {
        throw new ApiError(404, "Section not found");
    }

    const idsString = sectionIds.join(',');
    const [lines] = await executeQuery(
        `SELECT l.*, s.name as sectionName,
        ${lineCountSql}
        FROM [lines] l LEFT JOIN [sections] s ON l.sectionId = s.id WHERE (l.sectionId IN (${idsString}) OR l.department IN (${idsString})) ORDER BY l.createdAt DESC`
    );

    res.status(200).json(
        new ApiResponse(200, lines, "Lines fetched successfully")
    );
});

// @desc    Get all lines for a department
// @route   GET /api/lines/department/:departmentId
// @access  Private
export const getLinesByDepartment = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
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

    if (departmentIds.length === 0) {
        throw new ApiError(404, "Department not found");
    }

    const idsString = departmentIds.join(',');
    const [lines] = await executeQuery(
        `SELECT l.*, s.name as sectionName,
        ${lineCountSql}
        FROM [lines] l LEFT JOIN [sections] s ON l.sectionId = s.id WHERE l.department IN (${idsString}) ORDER BY l.createdAt DESC`
    );

    res.status(200).json(
        new ApiResponse(200, lines, "Lines fetched successfully")
    );
});

// @desc    Update a line
// @route   PUT /api/lines/:id
// @access  Private
export const updateLine = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, uniCode, lineLeader, mentor, requirement, description, tenCycleFormType, isActive } = req.body;

    const [existing] = await executeQuery("SELECT * FROM [lines] WHERE id = ?", [id]);
    if (existing.length === 0) {
        throw new ApiError(404, "Line not found");
    }
    const line = existing[0];

    // If name is being updated, check for duplicates in the same section
    if (name && name !== line.name) {
        const [duplicate] = await executeQuery(
            "SELECT id FROM [lines] WHERE name = ? AND sectionId = ? AND id != ?",
            [name, line.sectionId, id]
        );

        if (duplicate.length > 0) {
            throw new ApiError(400, "Line with this name already exists in this section");
        }
    }

    if (uniCode !== undefined && uniCode !== line.uniCode) {
        if (!req.user?.isAdmin) {
            throw new ApiError(403, "Only administrators can change the Line UniCode");
        }

        const [duplicate] = await executeQuery(
            "SELECT id FROM [lines] WHERE uniCode = ? AND id != ?",
            [uniCode, id]
        );

        if (duplicate.length > 0) {
            throw new ApiError(400, "Line with this UniCode already exists");
        }
    }

    let updateFields = [];
    let updateValues = [];

    if (typeof name !== 'undefined') { updateFields.push("name = ?"); updateValues.push(name); }
    if (typeof uniCode !== 'undefined') { updateFields.push("uniCode = ?"); updateValues.push(uniCode); }
    if (typeof lineLeader !== 'undefined') { updateFields.push("lineLeader = ?"); updateValues.push(lineLeader); }
    if (typeof mentor !== 'undefined') { updateFields.push("mentor = ?"); updateValues.push(mentor); }
    if (typeof requirement !== 'undefined') { updateFields.push("requirement = ?"); updateValues.push(requirement); }
    if (typeof description !== 'undefined') { updateFields.push("description = ?"); updateValues.push(description); }
    if (typeof tenCycleFormType !== 'undefined') { updateFields.push("tenCycleFormType = ?"); updateValues.push(tenCycleFormType); }
    if (typeof isActive !== 'undefined') { updateFields.push("isActive = ?"); updateValues.push(isActive); }

    if (updateFields.length > 0) {
        updateFields.push("updatedAt = GETDATE()");
        await executeQuery(`UPDATE [lines] SET ${updateFields.join(', ')} WHERE id = ?`, [...updateValues, id]);

        // Synchronize with the new LineRequirement system if requirement was updated
        if (typeof requirement !== 'undefined') {
            try {
                const LineRequirement = (await import("../models/lineRequirement.model.js")).default;
                const LineRequirementHistory = (await import("../models/lineRequirementHistory.model.js")).default;
                const now = new Date();

                // We default to MONTHLY update for the current month when using the legacy UI
                await LineRequirement.createOrUpdate({
                    lineId: id,
                    requirementMonth: now.getMonth() + 1,
                    requirementYear: now.getFullYear(),
                    quantity: requirement,
                    type: 'MONTHLY'
                });

                await LineRequirementHistory.create({
                    lineId: id,
                    oldQuantity: line.requirement,
                    newQuantity: requirement,
                    type: 'MONTHLY',
                    requirementMonth: now.getMonth() + 1,
                    requirementYear: now.getFullYear(),
                    changedBy: req.user?._id || req.user?.id || 1 // Fallback to system user
                });
            } catch (err) {
                console.error("Failed to sync legacy requirement update to new system:", err);
            }
        }
    }

    const [updatedLine] = await executeQuery(`
        SELECT l.*,
        ${lineCountSql}
        FROM [lines] l WHERE l.id = ?`, [id]);

    res.status(200).json(
        new ApiResponse(200, updatedLine[0], "Line updated successfully")
    );
});

// @desc    Delete a line
// @route   DELETE /api/lines/:id
// @access  Private
export const deleteLine = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [existing] = await executeQuery("SELECT id FROM [lines] WHERE id = ?", [id]);
    if (existing.length === 0) {
        throw new ApiError(404, "Line not found");
    }

    // Cascade Delete Hierarchy
    // 1. Find all sub-sections for this line
    const [subSections] = await executeQuery("SELECT id FROM [sub_sections] WHERE lineId = ?", [id]);
    const subSectionIds = subSections.map(s => s.id);

    if (subSectionIds.length > 0) {
        // 2. Delete all machines for these sub-sections
        await executeQuery(`DELETE FROM machines WHERE subSectionId IN (${subSectionIds.join(",")})`);

        // 3. Delete all sub-sections for this line
        await executeQuery("DELETE FROM [sub_sections] WHERE lineId = ?", [id]);
    }

    // 4. Delete the line itself
    await executeQuery("DELETE FROM [lines] WHERE id = ?", [id]);

    res.status(200).json(
        new ApiResponse(200, {}, "Line deleted successfully")
    );
});

// @desc    Get all lines
// @route   GET /api/lines
// @access  Private
export const getAllLines = asyncHandler(async (req, res) => {
    const { sectionId, departmentId } = req.query;
    const logFile = "server_all_lines_debug.log";
    const log = (msg) => {
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] ${msg}\n`;
        try { fs.appendFileSync(logFile, line); } catch (e) { }
        console.log(msg);
    };

    log(`[DEBUG] getAllLines params: sectionId=${sectionId}, departmentId=${departmentId}`);

    let querySQL = `
        SELECT l.*, s.name as sectionName,
        ${lineCountSql}
        FROM [lines] l LEFT JOIN [sections] s ON l.sectionId = s.id`;
    let params = [];
    let conditions = [];

    if (sectionId && sectionId !== "undefined" && sectionId !== "null") {
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
            const idsStr = sectionIds.join(',');
            conditions.push(`(l.sectionId IN (${idsStr}) OR l.department IN (${idsStr}))`);
        }
    }

    if (departmentId && departmentId !== "undefined" && departmentId !== "null") {
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

    if (conditions.length > 0) {
        querySQL += " WHERE " + conditions.join(" AND ");
    }

    querySQL += " ORDER BY l.createdAt DESC";

    log(`[DEBUG] Executing SQL: ${querySQL}`);
    log(`[DEBUG] SQL Params: ${JSON.stringify(params)}`);

    const [lines] = await executeQuery(querySQL, params);

    log(`[DEBUG] Lines found count: ${lines?.length}`);
    if (lines?.length === 0) {
        const [totalLines] = await executeQuery("SELECT COUNT(*) as count FROM [lines]");
        log(`[DEBUG] Total lines in database: ${totalLines[0].count}`);
    }

    res.status(200).json(
        new ApiResponse(200, lines, "Lines fetched successfully")
    );
});
