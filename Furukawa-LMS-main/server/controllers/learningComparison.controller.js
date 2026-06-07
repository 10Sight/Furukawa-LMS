import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import LearningComparison from "../models/learningComparison.model.js";
import { saveToLocal } from "../utils/fileStorage.util.js";

const fileFields = [
    "beforeVideo", "beforePdf", "beforeExcel", "beforeWord", "beforePpt", "beforeImage",
    "afterVideo", "afterPdf", "afterExcel", "afterWord", "afterPpt", "afterImage"
];

export const createComparison = asyncHandler(async (req, res) => {
    const { title, beforeDescription, afterDescription } = req.body;
    const createdBy = req.user.id;

    if (!title) throw new ApiError("Title is required", 400);

    const fileData = { title, beforeDescription, afterDescription, createdBy };

    if (req.files) {
        for (const field of fileFields) {
            if (req.files[field] && req.files[field].length > 0) {
                const urls = [];
                for (const file of req.files[field]) {
                    const result = await saveToLocal(file, "learning-content");
                    if (result.success) urls.push(result.url);
                }
                if (urls.length > 0) fileData[field] = JSON.stringify(urls);
            }
        }
    }

    const comparison = await LearningComparison.create(fileData);
    res.status(201).json(new ApiResponse(201, comparison, "Learning comparison created successfully"));
});

export const getAllComparisons = asyncHandler(async (_req, res) => {
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

    // Parse remaining existing files sent from the frontend (files the user kept after deletions)
    let remainingExisting = {};
    if (req.body.remainingExisting) {
        try { remainingExisting = JSON.parse(req.body.remainingExisting); } catch (e) { remainingExisting = {}; }
    }

    for (const field of fileFields) {
        const kept = Array.isArray(remainingExisting[field]) ? remainingExisting[field] : [];
        const newUrls = [];

        if (req.files && req.files[field] && req.files[field].length > 0) {
            for (const file of req.files[field]) {
                const result = await saveToLocal(file, "learning-content");
                if (result.success) newUrls.push(result.url);
            }
        }

        const combined = [...kept, ...newUrls];
        updateData[field] = combined.length > 0 ? JSON.stringify(combined) : null;
    }

    const updated = await LearningComparison.update(id, updateData);
    res.json(new ApiResponse(200, updated, "Learning comparison updated successfully"));
});

export const deleteComparison = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const comparison = await LearningComparison.findById(id);
    if (!comparison) throw new ApiError("Comparison not found", 404);
    await LearningComparison.delete(id);
    res.json(new ApiResponse(200, null, "Comparison deleted successfully"));
});
