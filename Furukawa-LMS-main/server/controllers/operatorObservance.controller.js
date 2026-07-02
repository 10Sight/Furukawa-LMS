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

// Same row ids as CHECK_CONTENTS in OperatorObservanceSheet.jsx (frontend)
const CHECK_ROW_IDS = [
    "workingManner",
    "cycleTime",
    "checkSheets",
    "processProductAwareness",
    "pastCustomerClaim",
    "checkedByLine",
    "verificationByShift"
];
const OBS_COLUMNS = ["obs1", "obs2", "obs3", "obs4", "obs5", "obs6"];
const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

const isCellFilled = (cell) => {
    if (!cell) return false;
    return String(cell.status || "").trim() !== "" || String(cell.val || "").trim() !== "";
};

const isCellComplete = (cell) => {
    if (!cell) return false;
    return String(cell.status || "").trim() !== "" && String(cell.val || "").trim() !== "";
};

const isSubColumnStarted = (data, colId) => {
    const date = data?.columnDates?.[colId];
    if (date && String(date).trim() !== "") return true;
    return CHECK_ROW_IDS.some((rowId) => isCellFilled(data?.[rowId]?.[colId]));
};

const isSubColumnComplete = (data, colId) => {
    const date = data?.columnDates?.[colId];
    if (!date || String(date).trim() === "") return false;
    return CHECK_ROW_IDS.every((rowId) => isCellComplete(data?.[rowId]?.[colId]));
};

// Mirrors client-side validation in OperatorObservanceSheet.jsx
const validateObservanceData = (observanceData) => {
    const data = observanceData || {};

    const anyDateFilled = Object.values(data.columnDates || {}).some((d) => d && String(d).trim() !== "");
    const anyRowFilled = CHECK_ROW_IDS.some((rowId) =>
        OBS_COLUMNS.some((col) => isCellFilled(data?.[rowId]?.[col]) || isCellFilled(data?.[rowId]?.[`${col}Re`]))
    );
    if (!anyDateFilled && !anyRowFilled) {
        return "Please fill at least one observance before saving.";
    }

    for (let i = 0; i < OBS_COLUMNS.length; i++) {
        const col = OBS_COLUMNS[i];
        const colRe = `${col}Re`;
        const ordinal = ORDINALS[i];

        const primaryStarted = isSubColumnStarted(data, col) || isSubColumnStarted(data, colRe);
        if (primaryStarted && !isSubColumnComplete(data, col)) {
            return `${ordinal} Observance: Please select the 1st Time date and fill OK/NG status with result description for all check content rows before saving.`;
        }

        const reStarted = isSubColumnStarted(data, colRe);
        if (reStarted && !isSubColumnComplete(data, colRe)) {
            return `${ordinal} Observance: You have started the Reinspect column — please select the reinspection date and fill OK/NG status with result description for all check content rows before saving.`;
        }
    }

    return null;
};

// Determines which observance column (1st..6th Observance) the operator is currently on,
// based on whether every check-content row has a status recorded for that column.
const computeCurrentStage = (observanceData) => {
    if (!observanceData) return { stageLabel: "Not Started", stageIndex: 0 };

    for (let i = 0; i < OBS_COLUMNS.length; i++) {
        const colId = OBS_COLUMNS[i];
        const allFilled = CHECK_ROW_IDS.every((rowId) => {
            const cell = observanceData?.[rowId]?.[colId];
            return cell && String(cell.status || "").trim() !== "";
        });
        if (!allFilled) {
            const anyFilled = CHECK_ROW_IDS.some((rowId) => {
                const cell = observanceData?.[rowId]?.[colId];
                return cell && (String(cell.status || "").trim() !== "" || String(cell.val || "").trim() !== "");
            });
            return {
                stageLabel: `${ORDINALS[i]} Observance${anyFilled ? " (In Progress)" : ""}`,
                stageIndex: i + 1
            };
        }
    }
    return { stageLabel: "Completed", stageIndex: OBS_COLUMNS.length };
};

export const getObservanceSummary = asyncHandler(async (req, res) => {
    const studentIds = String(req.query.studentIds || "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id && !isNaN(id));

    if (studentIds.length === 0) {
        return res.json(new ApiResponse(200, {}, "No student IDs provided"));
    }

    const placeholders = studentIds.map(() => "?").join(",");
    const [rows] = await executeQuery(
        `SELECT studentId, observanceData, status, updatedAt FROM operator_observances WHERE studentId IN (${placeholders})`,
        studentIds
    );

    const summary = {};
    for (const row of rows) {
        let observanceData = {};
        try {
            observanceData = typeof row.observanceData === "string" ? JSON.parse(row.observanceData) : (row.observanceData || {});
        } catch (e) {
            observanceData = {};
        }
        const { stageLabel, stageIndex } = computeCurrentStage(observanceData);
        summary[row.studentId] = {
            status: row.status || "Draft",
            updatedAt: row.updatedAt,
            stageLabel,
            stageIndex
        };
    }

    res.json(new ApiResponse(200, summary, "Observance summary fetched"));
});

export const getObservanceByStudent = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    if (!studentId) throw new ApiError("Student ID is required", 400);

    const resolvedId = await resolveStudentId(studentId);
    if (!resolvedId) throw new ApiError("Student not found", 404);

    const observance = await OperatorObservance.findByStudentId(resolvedId);
    const derivedLevel1Date = await getDerivedLevel1CompletionDate(resolvedId);

    // If no record exists, return an empty structure so frontend can initialize
    if (!observance) {
        return res.json(new ApiResponse(200, { isNew: true, studentId: resolvedId, level1Date: derivedLevel1Date, preparedBy: "", checkedBy: "", verifiedBy: "", status: "Draft" }, "No existing observance record"));
    }

    const responseData = {
        ...observance,
        level1Date: observance.level1Date || derivedLevel1Date || null,
        preparedBy: observance.preparedBy || "",
        checkedBy: observance.checkedBy || "",
        verifiedBy: observance.verifiedBy || "",
        status: observance.status || "Draft",
    };

    res.json(new ApiResponse(200, responseData, "Observance record fetched"));
});

export const createOrUpdateObservance = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const data = req.body;

    if (!studentId) throw new ApiError("Student ID is required", 400);

    const resolvedId = await resolveStudentId(studentId);
    if (!resolvedId) throw new ApiError("Student not found", 404);

    const validationError = validateObservanceData(data.observanceData);
    if (validationError) throw new ApiError(validationError, 400);

    const derivedLevel1Date = await getDerivedLevel1CompletionDate(resolvedId);
    const finalLevel1Date = data.level1Date || derivedLevel1Date || null;
    const userSavingName = req.user?.fullName || req.user?.name || "System";

    let observance = await OperatorObservance.findByStudentId(resolvedId);

    if (observance) {
        // Update existing
        observance.lineName = data.lineName;
        observance.processName = data.processName;
        observance.level1Date = finalLevel1Date;
        observance.operatorNameCode = data.operatorNameCode;
        observance.observanceData = data.observanceData;
        observance.checkedBy = data.checkedBy || "";
        observance.verifiedBy = data.verifiedBy || "";
        observance.preparedBy = data.preparedBy || observance.preparedBy || userSavingName;
        observance.status = data.status || "Draft";
        if (data.revHistory) observance.revHistory = data.revHistory;


        await observance.save();

        // Trigger Email Notification only if status is Submitted
        if (data.status === "Submitted") {
            NotificationService.sendFormReport("Operator Observance Check Sheet", null, req.body, resolvedId)
                .catch(err => console.error("[Observance] Notification failed:", err));
        }

        res.json(new ApiResponse(200, observance, "Observance record updated"));
    } else {
        // Create new
        const newRecord = await OperatorObservance.create({
            studentId: resolvedId,
            ...data,
            level1Date: finalLevel1Date,
            preparedBy: data.preparedBy || userSavingName,
            checkedBy: data.checkedBy || "",
            verifiedBy: data.verifiedBy || "",
            status: data.status || "Draft",
        });

        // Trigger Email Notification only if status is Submitted
        if (data.status === "Submitted") {
            NotificationService.sendFormReport("Operator Observance Check Sheet", null, req.body, resolvedId)
                .catch(err => console.error("[Observance] Notification failed:", err));
        }

        res.status(201).json(new ApiResponse(201, newRecord, "Observance record created"));
    }
});
