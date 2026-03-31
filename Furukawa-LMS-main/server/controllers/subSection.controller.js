import { executeQuery } from "../db/mssqlHelper.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @desc    Create a new sub-section
// @route   POST /api/sub-sections
// @access  Private
export const createSubSection = asyncHandler(async (req, res) => {
    const { name, lineId, description } = req.body;

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
        "INSERT INTO [sub_sections] (name, lineId, description, isActive, createdAt, updatedAt) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, GETDATE(), GETDATE())",
        [name, lineId, description, true]
    );

    const [newSubSection] = await executeQuery("SELECT * FROM [sub_sections] WHERE id = ?", [result[0].id]);

    res.status(201).json(
        new ApiResponse(201, newSubSection[0], "Sub-Section created successfully")
    );
});

// @desc    Get all sub-sections for a line
// @route   GET /api/sub-sections/line/:lineId
// @access  Private
export const getSubSectionsByLine = asyncHandler(async (req, res) => {
    const { lineId } = req.params;

    if (isNaN(lineId)) {
        throw new ApiError(400, "Invalid Line ID parameter. Must be numeric.");
    }

    const [subSections] = await executeQuery("SELECT * FROM [sub_sections] WHERE lineId = ? ORDER BY createdAt DESC", [lineId]);

    res.status(200).json(
        new ApiResponse(200, subSections, "Sub-Sections fetched successfully")
    );
});

// @desc    Update a sub-section
// @route   PUT /api/sub-sections/:id
// @access  Private
export const updateSubSection = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

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
    if (typeof isActive !== 'undefined') { updateFields.push("isActive = ?"); updateValues.push(isActive); }

    if (updateFields.length > 0) {
        updateFields.push("updatedAt = GETDATE()");
        await executeQuery(`UPDATE [sub_sections] SET ${updateFields.join(', ')} WHERE id = ?`, [...updateValues, id]);
    }

    const [updatedSubSection] = await executeQuery("SELECT * FROM [sub_sections] WHERE id = ?", [id]);

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

// @desc    Get all sub-sections
// @route   GET /api/sub-sections
// @access  Private
export const getAllSubSections = asyncHandler(async (req, res) => {
    const { lineId } = req.query;

    let querySQL = "SELECT * FROM [sub_sections]";
    let params = [];

    if (lineId) {
        querySQL += " WHERE lineId = ?";
        params.push(lineId);
    }

    querySQL += " ORDER BY createdAt DESC";

    const [subSections] = await executeQuery(querySQL, params);

    res.status(200).json(
        new ApiResponse(200, subSections, "Sub-Sections fetched successfully")
    );
});
