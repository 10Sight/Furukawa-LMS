import path from "path";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import LearningComparison from "../models/learningComparison.model.js";
import { saveToLocal, deleteFromLocal } from "../utils/fileStorage.util.js";

const fileFields = [
    "beforeVideo", "beforePdf", "beforeExcel", "beforeWord", "beforePpt", "beforeImage",
    "afterVideo", "afterPdf", "afterExcel", "afterWord", "afterPpt", "afterImage"
];

export const createComparison = asyncHandler(async (req, res) => {
    const { title, groupName, beforeDescription, afterDescription } = req.body;
    const createdBy = req.user.id;

    if (!title) throw new ApiError("Title is required", 400);

    const fileData = { title, groupName: groupName || null, beforeDescription, afterDescription, createdBy };

    if (req.files) {
        for (const field of fileFields) {
            if (req.files[field] && req.files[field].length > 0) {
                const urls = [];
                for (const file of req.files[field]) {
                    const result = await saveToLocal(file, "learning-content");
                    if (result.success) urls.push(result.url);
                }
                if (urls.length > 0) {
                    fileData[field] = JSON.stringify(urls);
                    const descRaw = req.body[`${field}Descriptions`];
                    const descs = descRaw ? JSON.parse(descRaw) : [];
                    fileData[`${field}Descriptions`] = JSON.stringify(urls.map((_, i) => descs[i] || ''));
                }
            }
        }
    }

    const comparison = await LearningComparison.create(fileData);
    res.status(201).json(new ApiResponse(201, comparison, "Learning comparison created successfully"));
});

export const getAllComparisons = asyncHandler(async (req, res) => {
    const { group } = req.query;
    const comparisons = await LearningComparison.findAll(group);
    res.json(new ApiResponse(200, comparisons, "Comparisons fetched successfully"));
});

export const getGroups = asyncHandler(async (_req, res) => {
    const groups = await LearningComparison.getDistinctGroups();
    res.json(new ApiResponse(200, groups, "Groups fetched successfully"));
});

export const getComparisonById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const comparison = await LearningComparison.findById(id);
    if (!comparison) throw new ApiError("Comparison not found", 404);
    res.json(new ApiResponse(200, comparison, "Comparison fetched successfully"));
});

export const updateComparison = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, groupName, beforeDescription, afterDescription } = req.body;

    const existing = await LearningComparison.findById(id);
    if (!existing) throw new ApiError("Comparison not found", 404);

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (groupName !== undefined) updateData.groupName = groupName || null;
    if (beforeDescription !== undefined) updateData.beforeDescription = beforeDescription;
    if (afterDescription !== undefined) updateData.afterDescription = afterDescription;

    // Parse remaining existing files sent from the frontend (files the user kept after deletions)
    let remainingExisting = {};
    if (req.body.remainingExisting) {
        try { remainingExisting = JSON.parse(req.body.remainingExisting); } catch (e) { remainingExisting = {}; }
    }

    for (const field of fileFields) {
        const rawKept = Array.isArray(remainingExisting[field]) ? remainingExisting[field] : [];
        const kept = rawKept.map(i => (typeof i === 'string' ? i : i.path));
        const keptDescs = rawKept.map(i => (typeof i === 'string' ? '' : (i.description || '')));

        // Remove files the user deleted (present in DB but not kept) from disk
        const existingUrls = Array.isArray(existing[field]) ? existing[field] : [];
        const removedUrls = existingUrls.filter(url => !kept.includes(url));
        for (const url of removedUrls) {
            await deleteFromLocal(url);
        }

        const newUrls = [];
        if (req.files && req.files[field] && req.files[field].length > 0) {
            for (const file of req.files[field]) {
                const result = await saveToLocal(file, "learning-content");
                if (result.success) newUrls.push(result.url);
            }
        }
        const newDescRaw = req.body[`${field}Descriptions`];
        const newDescs = newDescRaw ? JSON.parse(newDescRaw) : [];

        const combined = [...kept, ...newUrls];
        const combinedDescs = [...keptDescs, ...newUrls.map((_, i) => newDescs[i] || '')];

        updateData[field] = combined.length > 0 ? JSON.stringify(combined) : null;
        updateData[`${field}Descriptions`] = combinedDescs.length > 0 ? JSON.stringify(combinedDescs) : null;
    }

    const updated = await LearningComparison.update(id, updateData);
    res.json(new ApiResponse(200, updated, "Learning comparison updated successfully"));
});

export const downloadFile = asyncHandler(async (req, res, next) => {
    const { path: relativePath } = req.query;

    if (!relativePath || typeof relativePath !== "string" || !relativePath.startsWith("/uploads/")) {
        throw new ApiError("Invalid file path", 400);
    }

    const uploadsRoot = path.join(process.cwd(), "uploads");
    const absolutePath = path.join(process.cwd(), relativePath);

    // Guard against directory traversal (e.g. "/uploads/../../.env") by ensuring the
    // resolved path still lives inside the uploads directory before streaming it back.
    if (!absolutePath.startsWith(uploadsRoot + path.sep)) {
        throw new ApiError("Invalid file path", 400);
    }

    res.download(absolutePath, (err) => {
        // res.download's callback fires after the promise this handler returns has
        // already settled, so asyncHandler can't catch a throw here — route errors
        // through next() instead.
        if (err && !res.headersSent) {
            next(new ApiError("File not found", 404));
        }
    });
});

export const deleteComparison = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const comparison = await LearningComparison.findById(id);
    if (!comparison) throw new ApiError("Comparison not found", 404);

    for (const field of fileFields) {
        const urls = Array.isArray(comparison[field]) ? comparison[field] : [];
        for (const url of urls) {
            await deleteFromLocal(url);
        }
    }

    await LearningComparison.delete(id);
    res.json(new ApiResponse(200, null, "Comparison deleted successfully"));
});
