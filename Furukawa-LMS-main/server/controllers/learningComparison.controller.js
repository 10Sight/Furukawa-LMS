import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import LearningComparison from "../models/learningComparison.model.js";
import { saveToLocal } from "../utils/fileStorage.util.js";

export const createComparison = asyncHandler(async (req, res) => {
    const { title, beforeDescription, afterDescription } = req.body;
    const createdBy = req.user.id;

    if (!title) throw new ApiError("Title is required", 400);

    const fileData = {
        title,
        beforeDescription,
        afterDescription,
        createdBy
    };

    const fileFields = [
        "beforeVideo", "beforePdf", "beforeExcel", "beforeWord", "beforePpt", "beforeImage",
        "afterVideo", "afterPdf", "afterExcel", "afterWord", "afterPpt", "afterImage"
    ];

    // Process uploaded files
    if (req.files) {
        for (const field of fileFields) {
            if (req.files[field] && req.files[field][0]) {
                const file = req.files[field][0];
                const result = await saveToLocal(file, "learning-content");
                if (result.success) {
                    fileData[field] = result.url;
                }
            }
        }
    }

    const comparison = await LearningComparison.create(fileData);

    res.status(201).json(
        new ApiResponse(201, comparison, "Learning comparison created successfully")
    );
});

export const getAllComparisons = asyncHandler(async (req, res) => {
    const comparisons = await LearningComparison.findAll();
    res.json(new ApiResponse(200, comparisons, "Comparisons fetched successfully"));
});

export const getComparisonById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const comparison = await LearningComparison.findById(id);
    if (!comparison) throw new ApiError("Comparison not found", 404);
    res.json(new ApiResponse(200, comparison, "Comparison fetched successfully"));
});

export const updateComparison = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, beforeDescription, afterDescription } = req.body;

    const existing = await LearningComparison.findById(id);
    if (!existing) throw new ApiError("Comparison not found", 404);

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (beforeDescription !== undefined) updateData.beforeDescription = beforeDescription;
    if (afterDescription !== undefined) updateData.afterDescription = afterDescription;

    const fileFields = [
        "beforeVideo", "beforePdf", "beforeExcel", "beforeWord", "beforePpt", "beforeImage",
        "afterVideo", "afterPdf", "afterExcel", "afterWord", "afterPpt", "afterImage"
    ];

    // Check for deletions or updates in req.body for file fields
    fileFields.forEach(field => {
        if (req.body[field] === "" || req.body[field] === "null") {
            updateData[field] = null;
        }
    });

    if (req.files) {
        for (const field of fileFields) {
            if (req.files[field] && req.files[field][0]) {
                const file = req.files[field][0];
                const result = await saveToLocal(file, "learning-content");
                if (result.success) {
                    updateData[field] = result.url;
                }
            }
        }
    }

    const updated = await LearningComparison.update(id, updateData);

    res.json(new ApiResponse(200, updated, "Learning comparison updated successfully"));
});

export const deleteComparison = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const comparison = await LearningComparison.findById(id);
    if (!comparison) throw new ApiError("Comparison not found", 404);
    
    // In a real app, you might want to delete local files too
    await LearningComparison.delete(id);
    
    res.json(new ApiResponse(200, null, "Comparison deleted successfully"));
});
