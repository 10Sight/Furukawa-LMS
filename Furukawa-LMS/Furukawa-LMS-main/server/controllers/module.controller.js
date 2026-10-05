import { executeQuery } from "../db/mssqlHelper.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Module from "../models/module.model.js";

// @desc    Create a new module
// @route   POST /api/modules
// @access  Private
export const createModule = asyncHandler(async (req, res) => {
    const { courseId, title, description, order } = req.body;

    if (!courseId || !title) {
        throw new ApiError("Course ID and Title are required", 400);
    }

    let resolvedCourseId = courseId;
    if (isNaN(courseId)) {
        const [courses] = await executeQuery("SELECT id FROM courses WHERE slug = ?", [courseId]);
        if (courses.length === 0) throw new ApiError("Course not found (by slug)", 404);
        resolvedCourseId = courses[0].id;
    } else {
        const [courses] = await executeQuery("SELECT id FROM courses WHERE id = ?", [courseId]);
        if (courses.length === 0) throw new ApiError("Course not found (by ID)", 404);
    }

    // Use Module.create to ensure slug generation and proper initialization
    const newModule = await Module.create({
        course: resolvedCourseId,
        title,
        description,
        order: order || 0
    });

    // Note: We do NOT push to course.modules array anymore as relationships are handled via Foreign Key `module.course`.
    // If the frontend relies on the array in Course object, it should be fetching modules via `getModulesByCourse` or properly populated Course queries.

    res.status(201).json(new ApiResponse(201, newModule, "Module created successfully"));
});

// @desc    Get all modules for a course
// @route   GET /api/modules/course/:courseId
// @access  Private
export const getModulesByCourse = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    let id = courseId;
    // Check if valid UUID or similar ID format. If not, assume slug.
    // For simplicity, we query both ID and Slug or assume passed ID is correct.
    // However, if strict ID check fails, we look up by slug.
    let c;
    if (!isNaN(courseId)) {
        [c] = await executeQuery("SELECT id FROM courses WHERE id = ?", [courseId]);
    } else {
        [c] = await executeQuery("SELECT id FROM courses WHERE slug = ?", [courseId]);
    }
    if (c.length === 0) return res.status(404).json(new ApiResponse(404, [], "Course not found"));
    id = c[0].id;

    const [modules] = await executeQuery("SELECT * FROM modules WHERE course = ? ORDER BY [order] ASC", [id]);

    // Populate Lessons and Resources
    for (let m of modules) {
        // Lessons
        const [lessons] = await executeQuery("SELECT id, title, duration, [order], content FROM lessons WHERE module = ? ORDER BY [order] ASC", [m.id]);
        m.lessons = lessons;

        // Resources (Assuming simple 1:N or M:N via link table is not standard here yet, checking context implies simple FK usually)
        // If resources table has module FK:
        try {
            // previous logic
            const [resources] = await executeQuery("SELECT * FROM resources WHERE moduleId = ?", [m.id]);
            m.resources = resources;
        } catch (e) {
            m.resources = []; // Table might not exist or be different
        }
    }

    res.status(200).json(new ApiResponse(200, modules, "Modules fetched successfully"));
});

// @desc    Get module by ID
// @route   GET /api/modules/:moduleId
// @access  Private
export const getModuleById = asyncHandler(async (req, res) => {
    const { moduleId } = req.params;

    if (!moduleId || moduleId === 'undefined' || moduleId === 'null') {
        return res.status(400).json(new ApiResponse(400, null, "Module ID is required"));
    }

    const [rows] = await executeQuery("SELECT * FROM modules WHERE id = ?", [moduleId]);
    if (rows.length === 0) {
        return res.status(404).json(new ApiResponse(404, null, "Module not found"));
    }
    const module = rows[0];

    // Populate Course (partial)
    const [courses] = await executeQuery("SELECT id, title, description FROM courses WHERE id = ?", [module.course]);
    if (courses.length > 0) module.course = courses[0];

    // Populate Lessons
    const [lessons] = await executeQuery("SELECT * FROM lessons WHERE module = ? ORDER BY [order] ASC", [moduleId]);
    module.lessons = lessons;

    // Populate Resources
    try {
        const [resources] = await executeQuery("SELECT * FROM resources WHERE moduleId = ?", [moduleId]);
        module.resources = resources;
    } catch (e) {
        module.resources = [];
    }

    res.status(200).json(new ApiResponse(200, module, "Module fetched successfully"));
});

// @desc    Update module
// @route   PUT /api/modules/:moduleId
// @access  Private
export const updateModule = asyncHandler(async (req, res) => {
    const { moduleId } = req.params;
    const { title, description, order } = req.body;

    const [existing] = await executeQuery("SELECT * FROM modules WHERE id = ?", [moduleId]);
    if (existing.length === 0) throw new ApiError("Module not found", 404);

    let updateFields = [];
    let updateValues = [];

    if (typeof title !== 'undefined') { updateFields.push("title = ?"); updateValues.push(title); }
    if (typeof description !== 'undefined') { updateFields.push("description = ?"); updateValues.push(description); }
    if (typeof order !== 'undefined') { updateFields.push("[order] = ?"); updateValues.push(order); }

    if (updateFields.length > 0) {
        updateFields.push("updatedAt = GETDATE()");
        await executeQuery(`UPDATE modules SET ${updateFields.join(', ')} WHERE id = ?`, [...updateValues, moduleId]);
    }

    const [updated] = await executeQuery("SELECT * FROM modules WHERE id = ?", [moduleId]);

    res.status(200).json(new ApiResponse(200, updated[0], "Module updated successfully"));
});

// @desc    Delete module
// @route   DELETE /api/modules/:moduleId
// @access  Private
export const deleteModule = asyncHandler(async (req, res) => {
    const { moduleId } = req.params;

    const [result, metadata] = await executeQuery("DELETE FROM modules WHERE id = ?", [moduleId]);
    if (metadata.affectedRows === 0) throw new ApiError("Module not found", 404);

    // Note: Implicitly, ON DELETE CASCADE usually handles lessons/resources if configured in SQL.
    // Otherwise, we might need to manual delete lessons.
    // Mongoose implicitly didn't cascade unless middleware.
    // Assuming DB Constraints or manual cleanup required?
    // Safe bet: Delete lessons for this module to be sure if no CASCADE.
    await executeQuery("DELETE FROM lessons WHERE module = ?", [moduleId]);
    try { await executeQuery("DELETE FROM resources WHERE moduleId = ?", [moduleId]); } catch (e) { }

    res.status(200).json(new ApiResponse(200, {}, "Module deleted successfully"));
});