import OperatorObservance from "../models/operatorObservance.model.js";
import CourseLevelConfig from "../models/courseLevelConfig.model.js";
import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import NotificationService from "../services/notification.service.js";

const normalizeLevel = (level) => String(level || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

const getDerivedLevel1CompletionDate = async (studentId) => {
    const activeConfig = await CourseLevelConfig.getActiveConfig();
    const levels = [...(activeConfig?.levels || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // "Level-1 complete" date is interpreted as entry date into 2nd active level (typically L2).
    const secondLevelName = levels[1]?.name;
    if (!secondLevelName) return null;

    const [progressRows] = await executeQuery(
        "SELECT currentLevel, levelStartDate, updatedAt, createdAt FROM progress WHERE student = ?",
        [studentId]
    );

    const targetNorm = normalizeLevel(secondLevelName);
    const matchedProgress = (progressRows || [])
        .filter((row) => normalizeLevel(row.currentLevel) === targetNorm)
        .map((row) => row.levelStartDate || row.updatedAt || row.createdAt)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0];

    if (matchedProgress) return matchedProgress;

    // Fallback: If level transition date isn't in progress history, use skill-upgradation certificate date for that level.
    const [certRows] = await executeQuery(
        `SELECT TOP 1 issueDate, createdAt
         FROM certificates
         WHERE student = ? AND type = 'SKILL_UPGRADATION' AND level = ?
         ORDER BY issueDate DESC, createdAt DESC`,
        [String(studentId), secondLevelName]
    );

    if (certRows.length > 0) return certRows[0].issueDate || certRows[0].createdAt || null;

    return null;
};

// Helper to resolve studentId (from ID, userName, empId or slug)
const resolveStudentId = async (studentId) => {
    if (!studentId) return null;
    let users;
    if (!isNaN(studentId) && !isNaN(parseFloat(studentId))) {
        [users] = await executeQuery("SELECT id FROM users WHERE id = ?", [studentId]);
        if (users.length > 0) return users[0].id;
    }
    [users] = await executeQuery("SELECT id FROM users WHERE userName = ? OR slug = ? OR empId = ?", [studentId, studentId, studentId]);
    return users.length > 0 ? users[0].id : null;
};

export const getObservanceByStudent = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    if (!studentId) throw new ApiError("Student ID is required", 400);

    const resolvedId = await resolveStudentId(studentId);
    if (!resolvedId) throw new ApiError("Student not found", 404);

    const observance = await OperatorObservance.findByStudentId(resolvedId);
    const derivedLevel1Date = await getDerivedLevel1CompletionDate(resolvedId);

    // If no record exists, return an empty structure so frontend can initialize
    if (!observance) {
        return res.json(new ApiResponse(200, { isNew: true, studentId: resolvedId, level1Date: derivedLevel1Date }, "No existing observance record"));
    }

    const responseData = {
        ...observance,
        level1Date: observance.level1Date || derivedLevel1Date || null,
    };

    res.json(new ApiResponse(200, responseData, "Observance record fetched"));
});

export const createOrUpdateObservance = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const data = req.body;

    if (!studentId) throw new ApiError("Student ID is required", 400);

    const resolvedId = await resolveStudentId(studentId);
    if (!resolvedId) throw new ApiError("Student not found", 404);

    const derivedLevel1Date = await getDerivedLevel1CompletionDate(resolvedId);
    const finalLevel1Date = data.level1Date || derivedLevel1Date || null;

    let observance = await OperatorObservance.findByStudentId(resolvedId);

    if (observance) {
        // Update existing
        observance.lineName = data.lineName;
        observance.processName = data.processName;
        observance.level1Date = finalLevel1Date;
        observance.operatorNameCode = data.operatorNameCode;
        observance.observanceData = data.observanceData;
        observance.checkedBy = data.checkedBy;
        observance.verifiedBy = data.verifiedBy;
        if (data.revHistory) observance.revHistory = data.revHistory;


        await observance.save();

        // Trigger Email Notification
        NotificationService.sendFormReport("Operator Observance Check Sheet", null, req.body, resolvedId)
            .catch(err => console.error("[Observance] Notification failed:", err));

        res.json(new ApiResponse(200, observance, "Observance record updated"));
    } else {
        // Create new
        const newRecord = await OperatorObservance.create({
            studentId: resolvedId,
            ...data,
            level1Date: finalLevel1Date,
        });

        // Trigger Email Notification
        NotificationService.sendFormReport("Operator Observance Check Sheet", null, req.body, resolvedId)
            .catch(err => console.error("[Observance] Notification failed:", err));

        res.status(201).json(new ApiResponse(201, newRecord, "Observance record created"));
    }
});
