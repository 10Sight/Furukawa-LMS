import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ensureCertificateIfEligible from "../utils/autoCertificate.js";
import Certificate from "../models/certificate.model.js";
// Assuming CourseLevelConfig is refactored or we query the table directly if needed. 
// If it has a model file with helper methods, we import it. 
import CourseLevelConfig from "../models/courseLevelConfig.model.js";
import TenCycleCheck from "../models/tenCycleCheck.model.js";
import ThreeDayMonitoring from "../models/threeDayMonitoring.model.js";
import MonitoringConfig from "../models/monitoringConfig.model.js";
import NotificationService from "../services/notification.service.js";
import logger from "../logger/winston.logger.js";
import logAudit from "../utils/auditLogger.js";

// Helper to safely parse JSON
const parseJSON = (data, fallback = []) => {
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch (e) { return fallback; }
    }
    return data || fallback;
};

// Helper to get active config (if model not fully available, replicate logic)
const getActiveLevelConfig = async () => {
    return await CourseLevelConfig.getActiveConfig();
};

const resolveStudentId = async (studentId) => {
    if (!studentId) return null;
    let users;
    // Check if it's already a number
    if (!isNaN(studentId) && !isNaN(parseFloat(studentId))) {
        [users] = await executeQuery("SELECT id FROM users WHERE id = ?", [studentId]);
        if (users.length > 0) return users[0].id;
    }
    // Otherwise check userName, slug or empId
    [users] = await executeQuery("SELECT id FROM users WHERE userName = ? OR slug = ? OR empId = ?", [studentId, studentId, studentId]);
    return users.length > 0 ? users[0].id : null;
};

const getStudentAssignedMachineLine = async (studentId) => {
    // 1. Try machine_assignments first (latest active assignment)
    const [rows] = await executeQuery(`
        SELECT TOP 1 m.name AS processName, l.name AS lineName, l.lineLeader AS lineLeader
        FROM machine_assignments ma
        INNER JOIN machines m ON ma.machine_id = m.id
        LEFT JOIN [lines] l ON m.line = l.id
        WHERE ma.user_id = ?
        ORDER BY ma.assigned_at DESC, ma.id DESC
    `, [studentId]);

    if (rows.length > 0) return rows[0];

    // 2. Fallback: Check user profile directly (handles direct assignments)
    const [fallbackRows] = await executeQuery(`
        SELECT m.name AS processName, l.name AS lineName, l.lineLeader AS lineLeader
        FROM users u
        LEFT JOIN machines m ON u.stationId = m.id
        LEFT JOIN [lines] l ON u.lineId = l.id
        WHERE u.id = ?
    `, [studentId]);

    return fallbackRows[0] || { processName: "", lineName: "", lineLeader: "" };
};

export const initializeProgress = asyncHandler(async (req, res) => {
    const { courseId } = req.body;
    const userId = req.user.id;

    if (!courseId) throw new ApiError("Course ID is required", 400);

    const [courses] = await executeQuery("SELECT id FROM courses WHERE id = ?", [courseId]);
    if (courses.length === 0) throw new ApiError("Course not found", 404);

    const [existing] = await executeQuery("SELECT id FROM progress WHERE student = ? AND course = ?", [userId, courseId]);
    if (existing.length > 0) throw new ApiError("Progress already initialized for this course", 400);

    const levelConfig = await getActiveLevelConfig();
    const firstLevel = levelConfig && levelConfig.levels.length > 0 ? levelConfig.levels[0].name : "L1";

    const [insertRows] = await executeQuery(
        `INSERT INTO progress 
        (student, course, currentLevel, completedLessons, completedModules, quizzes, assignments, progressPercent, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
        [userId, courseId, firstLevel, JSON.stringify([]), JSON.stringify([]), JSON.stringify([]), JSON.stringify([]), 0]
    );

    // Fetch created
    const [rows] = await executeQuery("SELECT * FROM progress WHERE id = ?", [insertRows[0].id]);
    const progress = rows[0];
    if (progress) {
        progress.completedLessons = parseJSON(progress.completedLessons);
        progress.completedModules = parseJSON(progress.completedModules);
        progress.quizzes = parseJSON(progress.quizzes);
        progress.assignments = parseJSON(progress.assignments);
    }

    res.status(201).json(new ApiResponse(201, progress, "Progress initialized successfully"));
});

export const updateProgress = asyncHandler(async (req, res) => {
    const { courseId } = req.body;
    const userId = req.user.id;

    const [rows] = await executeQuery("SELECT * FROM progress WHERE student = ? AND course = ?", [userId, courseId]);
    if (rows.length === 0) throw new ApiError("Progress not found", 404);

    await executeQuery("UPDATE progress SET lastAccessed = GETDATE() WHERE id = ?", [rows[0].id]);

    // Return updated
    rows[0].lastAccessed = new Date();
    res.json(new ApiResponse(200, rows[0], "Progress updated successfully"));
});

export const markLessonComplete = asyncHandler(async (req, res) => {
    const { courseId, lessonId } = req.body;
    const userId = req.user.id;

    if (!courseId || !lessonId) throw new ApiError("Invalid course ID or lesson ID", 400);

    // Fetch Lesson and Module
    const [lessons] = await executeQuery("SELECT * FROM lessons WHERE id = ?", [lessonId]);
    if (lessons.length === 0) throw new ApiError("Lesson not found", 404);
    const lesson = lessons[0];

    const [modules] = await executeQuery("SELECT * FROM modules WHERE id = ?", [lesson.module]);
    if (modules.length === 0) throw new ApiError("Module not found", 404);

    // Get all lessons in module for sequence check
    const [moduleLessons] = await executeQuery("SELECT id, [order] FROM lessons WHERE module = ? ORDER BY [order] ASC", [lesson.module]);
    const lessonIndex = moduleLessons.findIndex(l => String(l.id) === String(lessonId));
    if (lessonIndex === -1) throw new ApiError("Lesson not found in module", 404);

    // Get or Init Progress
    let progress;
    const [pRows] = await executeQuery("SELECT * FROM progress WHERE student = ? AND course = ?", [userId, courseId]);
    if (pRows.length === 0) {
        // Init logic
        const levelConfig = await getActiveLevelConfig();
        const firstLevel = levelConfig && levelConfig.levels.length > 0 ? levelConfig.levels[0].name : "L1";
        const [resP] = await executeQuery(
            `INSERT INTO progress (student, course, currentLevel, completedLessons, completedModules, quizzes, assignments, progressPercent, createdAt, updatedAt) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
            [userId, courseId, firstLevel, '[]', '[]', '[]', '[]', 0]
        );
        const [newP] = await executeQuery("SELECT * FROM progress WHERE id = ?", [resP[0].id]);
        progress = newP[0];
    } else {
        progress = pRows[0];
    }

    const completedLessons = parseJSON(progress.completedLessons, []);

    // Sequential Check
    if (lessonIndex > 0) {
        const prevLesson = moduleLessons[lessonIndex - 1];
        const isPrevCompleted = completedLessons.some(cl => String(cl.lessonId) === String(prevLesson.id));
        if (!isPrevCompleted) throw new ApiError("You must complete the previous lesson first", 400);
    }

    // Mark Complete
    const isAlreadyCompleted = completedLessons.some(cl => String(cl.lessonId) === String(lessonId));
    if (!isAlreadyCompleted) {
        completedLessons.push({ lessonId, completedAt: new Date() });
        await executeQuery("UPDATE progress SET completedLessons = ?, lastAccessed = GETDATE() WHERE id = ?", [JSON.stringify(completedLessons), progress.id]);
        progress.completedLessons = JSON.stringify(completedLessons); // Update local for response
    } else {
        await executeQuery("UPDATE progress SET lastAccessed = GETDATE() WHERE id = ?", [progress.id]);
    }

    // Format response
    progress.completedLessons = parseJSON(progress.completedLessons);
    progress.completedModules = parseJSON(progress.completedModules);

    res.json(new ApiResponse(200, progress, "Lesson marked as complete"));
});

export const markModuleComplete = asyncHandler(async (req, res) => {
    const { courseId, moduleId } = req.body;
    const userId = req.user.id;

    if (!courseId || !moduleId) throw new ApiError("Invalid IDs", 400);

    const [courses] = await executeQuery("SELECT * FROM courses WHERE id = ?", [courseId]);
    if (courses.length === 0) throw new ApiError("Course not found", 404);

    const [courseModules] = await executeQuery("SELECT id, [order] FROM modules WHERE course = ? ORDER BY [order] ASC", [courseId]);
    const modIndex = courseModules.findIndex(m => String(m.id) === String(moduleId));
    if (modIndex === -1) throw new ApiError("Module not found in course", 404);

    let progress;
    const [pRows] = await executeQuery("SELECT * FROM progress WHERE student = ? AND course = ?", [userId, courseId]);
    if (pRows.length === 0) {
        // Init
        const levelConfig = await getActiveLevelConfig();
        const firstLevel = levelConfig && levelConfig.levels.length > 0 ? levelConfig.levels[0].name : "L1";
        const [resP] = await executeQuery(
            `INSERT INTO progress (student, course, currentLevel, completedLessons, completedModules, quizzes, assignments, progressPercent, createdAt, updatedAt) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
            [userId, courseId, firstLevel, '[]', '[]', '[]', '[]', 0]
        );
        const [newP] = await executeQuery("SELECT * FROM progress WHERE id = ?", [resP[0].id]);
        progress = newP[0];
    } else {
        progress = pRows[0];
    }

    const completedModules = parseJSON(progress.completedModules, []);
    const completedLessons = parseJSON(progress.completedLessons, []);

    // Sequential Check
    if (modIndex > 0) {
        const prevMod = courseModules[modIndex - 1];
        const isPrevCompleted = completedModules.some(cm => String(cm.moduleId) === String(prevMod.id));
        if (!isPrevCompleted) throw new ApiError("You must complete the previous module first", 400);
    }

    // Verify all lessons completed
    const [modLessons] = await executeQuery("SELECT id FROM lessons WHERE module = ?", [moduleId]);
    if (modLessons.length > 0) {
        const allLessonsComputed = modLessons.every(l => completedLessons.some(cl => String(cl.lessonId) === String(l.id)));
        if (!allLessonsComputed) throw new ApiError("You must complete all lessons in this module first", 400);
    }

    let levelUpgraded = false;
    const isAlreadyCompleted = completedModules.some(cm => String(cm.moduleId) === String(moduleId));

    if (!isAlreadyCompleted) {
        completedModules.push({ moduleId, completedAt: new Date() });

        // Progress Percent
        const totalModules = courseModules.length;
        const percent = Math.min(100, Math.round((completedModules.length / totalModules) * 100));

        // Admin lock logic
        let currentLevel = progress.currentLevel;
        if (progress.levelLockEnabled && progress.lockedLevel && progress.currentLevel !== progress.lockedLevel) {
            currentLevel = progress.lockedLevel;
        }

        await executeQuery(
            "UPDATE progress SET completedModules = ?, progressPercent = ?, currentLevel = ?, lastAccessed = GETDATE() WHERE id = ?",
            [JSON.stringify(completedModules), percent, currentLevel, progress.id]
        );
        progress.completedModules = completedModules;
        progress.progressPercent = percent;

        // Sync to user profile if level changed (e.g. enforced lock)
        if (currentLevel !== progress.currentLevel) {
            await executeQuery("UPDATE users SET currentLevel = ? WHERE id = ?", [currentLevel, userId]);
        }
        progress.currentLevel = currentLevel;
    } else {
        await executeQuery("UPDATE progress SET lastAccessed = GETDATE() WHERE id = ?", [progress.id]);
    }

    // Check certificate
    try {
        if (courseModules.length > 0 && progress.completedModules.length >= courseModules.length) {
            await ensureCertificateIfEligible(userId, courseId, { issuedByUserId: undefined });
        }
    } catch (e) { }

    let msg = "Module marked as complete";
    // Check if logic for level upgrade happened (simplified from original which just checked flags)
    // We returned response.

    res.json(new ApiResponse(200, progress, msg));
});

export const upgradeLevel = asyncHandler(async (req, res) => {
    const { courseId } = req.body;
    const userId = req.user.id;

    const [rows] = await executeQuery("SELECT * FROM progress WHERE student = ? AND course = ?", [userId, courseId]);
    if (rows.length === 0) throw new ApiError("Progress not found", 404);
    const progress = rows[0];

    if (progress.levelLockEnabled) throw new ApiError("Level changes are locked by admin", 403);
    if (progress.progressPercent < 100) throw new ApiError("Cannot upgrade level until progress is 100%", 400);

    const levelConfig = await getActiveLevelConfig();
    if (!levelConfig) throw new ApiError("No active level configuration found", 404);

    const levels = levelConfig.levels;
    const currentIdx = levels.findIndex(l => l.name === progress.currentLevel);
    const hasNext = currentIdx !== -1 && currentIdx < levels.length - 1;

    console.log(`[DEBUG] UpgradeLevel: Current=${progress.currentLevel}, Index=${currentIdx}, HasNext=${hasNext}`);

    if (hasNext) {
        const nextLevel = levels[currentIdx + 1];
        await executeQuery("UPDATE progress SET currentLevel = ? WHERE id = ?", [nextLevel.name, progress.id]);
        progress.currentLevel = nextLevel.name;

        // Sync to user profile with station awareness
        const { default: UserModel } = await import("../models/auth.model.js");
        const userData = await UserModel.findById(userId);
        if (userData && userData.subSectionId) {
            let currentSkill = userData.currentSkill || {};
            if (typeof currentSkill === 'string') {
                try { currentSkill = JSON.parse(currentSkill); } catch (e) { currentSkill = {}; }
            }
            currentSkill[userData.subSectionId] = nextLevel.name;
            await executeQuery(
                "UPDATE users SET currentLevel = ?, currentSkill = ? WHERE id = ?",
                [nextLevel.name, JSON.stringify(currentSkill), userId]
            );
        } else {
            await executeQuery("UPDATE users SET currentLevel = ? WHERE id = ?", [nextLevel.name, userId]);
        }

        // --- AUTOMATED HANDOVER & MAX LEVEL CHECK ---
        // If user is upgraded from L1 -> Add to Handover Sheet + Email Trainer
        if (progress.currentLevel !== 'L1') {
            try {
                const { checkAndProcessHandover, checkAndProcessMaxLevelNotification } = await import("../utils/handover.util.js");
                await checkAndProcessHandover(userId, progress.currentLevel);
                await checkAndProcessMaxLevelNotification(userId, progress.currentLevel);
            } catch (err) {
                console.error("[Handover/MaxLevel] Automated process failed:", err);
            }
        }
        // ----------------------------------------------------

        res.json(new ApiResponse(200, progress, "Level upgraded successfully"));
    } else if (currentIdx === levels.length - 1) {
        // Issue cert (Manual logic if not covered by auto)
        // Check if certificate already exists to avoid duplicates
        const existingCert = await Certificate.findOne({ student: userId, course: courseId, type: 'COURSE_COMPLETION' });

        if (!existingCert) {
            // ---------------------------------------------------------
            // Certificate Generation with Full Metadata
            // ---------------------------------------------------------
            const { pool } = await import("../db/connectDB.js"); // Ensure pool is available
            const User = (await import("../models/auth.model.js")).default;
            const Department = (await import("../models/department.model.js")).default;
            const CertificateTemplate = (await import("../models/certificateTemplate.model.js")).default;
            const Enrollment = (await import("../models/enrollment.model.js")).default;
            const Course = (await import("../models/course.model.js")).default;

            let template = await CertificateTemplate.findOne({ isDefault: 1, isActive: 1 });
            if (!template) {
                const [temps] = await executeQuery("SELECT TOP 1 * FROM certificate_templates WHERE isActive = 1 ORDER BY createdAt ASC");
                if (temps.length > 0) template = new CertificateTemplate(temps[0]);
            }

            if (template) {
                const student = await User.findById(userId);
                const course = await Course.findById(courseId);

                let deptName = 'N/A';
                if (student.department) {
                    const d = await Department.findById(student.department);
                    if (d) deptName = d.name;
                }

                // Level Dates Logic
                const [allModules] = await executeQuery("SELECT id, level FROM modules WHERE course = ?", [courseId]);
                const completedModules = parseJSON(progress.completedModules, []);

                const getLevelCompletionDate = (lvlName) => {
                    const lvlModules = allModules.filter(m => m.level === lvlName);
                    if (lvlModules.length === 0) return null;
                    const compDates = lvlModules.map(m => {
                        const comp = completedModules.find(cm => String(cm.moduleId) === String(m.id));
                        return comp ? new Date(comp.completedAt) : null;
                    }).filter(d => d !== null);
                    if (compDates.length < lvlModules.length) return null;
                    return new Date(Math.max(...compDates));
                };

                const formatDate = (date) => {
                    if (!date) return '-';
                    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
                };

                const level1DateObj = getLevelCompletionDate('L1');
                const level2DateObj = getLevelCompletionDate('L2');
                const level3DateObj = getLevelCompletionDate('L3');

                // Start/Completion Dates
                // Current level index is the one we just finished (currentIdx)
                const completionDateObj = getLevelCompletionDate(levels[currentIdx].name) || new Date();

                let startDateObj;
                if (currentIdx === 0) {
                    startDateObj = new Date(student.createdAt);
                } else {
                    const prevLevelName = levels[currentIdx - 1].name;
                    startDateObj = getLevelCompletionDate(prevLevelName) || new Date(student.createdAt);
                }

                // Pie Chart
                const totalLevels = levels.length || 3;
                const currentProgressStep = currentIdx + 1; // 1-based index of level just achieved
                const fillPercentage = Math.round((currentProgressStep / totalLevels) * 100);
                const pieChartCss = `background: conic-gradient(#F97316 0% ${fillPercentage}%, #E5E7EB ${fillPercentage}% 100%); border-radius: 50%;`;

                const certData = {
                    studentName: student.fullName,
                    courseName: course.title,
                    departmentName: deptName,
                    instructorName: 'N/A',
                    level: levels[currentIdx].name,
                    issueDate: formatDate(new Date()),
                    grade: 'PASS',
                    employeeId: student.userName,
                    unit: student.unit || 'N/A',
                    startDate: formatDate(startDateObj),
                    completionDate: formatDate(completionDateObj),
                    level1Date: formatDate(level1DateObj),
                    level2Date: formatDate(level2DateObj),
                    level3Date: formatDate(level3DateObj),
                    userImage: student.avatar?.url || 'https://via.placeholder.com/150',
                    pieChart: pieChartCss
                };

                let html = template.template;
                Object.keys(certData).forEach(k => {
                    const val = certData[k] !== null && certData[k] !== undefined ? certData[k] : '';
                    html = html.split(`{{${k}}}`).join(val);
                });

                await Certificate.create({
                    student: userId,
                    course: courseId,
                    issuedBy: req.user.id,
                    grade: 'PASS',
                    issueDate: new Date(),
                    type: 'COURSE_COMPLETION',
                    level: levels[currentIdx].name,
                    metadata: {
                        ...certData,
                        templateId: template.id,
                        templateName: template.name,
                        generatedHTML: html,
                        styles: template.styles
                    }
                });
                console.log(`[DEBUG] Certificate issued with metadata for student ${userId}`);
            } else {
                // Fallback if no template (should not happen in prod usually)
                await Certificate.create({
                    student: userId,
                    course: courseId,
                    issuedBy: req.user.id,
                    grade: 'PASS',
                    issueDate: new Date(),
                    type: 'COURSE_COMPLETION',
                    level: levels[currentIdx].name
                });
            }
        } else {
            console.log(`[DEBUG] Certificate already exists for student ${userId}`);
        }

        // Assuming progress has isCompleted col
        try { await executeQuery("UPDATE progress SET isCompleted = 1 WHERE id = ?", [progress.id]); } catch (e) { }

        res.json(new ApiResponse(200, { progress }, "Course completed, certificate issued"));
    } else {
        throw new ApiError("Cannot determine next level", 400);
    }
});

export const getMyProgress = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const userId = req.user.id;

    const [rows] = await executeQuery(`
        SELECT p.*, c.title as courseTitle, u.fullName, u.email 
        FROM progress p
        JOIN courses c ON p.course = c.id
        JOIN users u ON p.student = u.id
        WHERE p.student = ? AND p.course = ?
    `, [userId, courseId]);

    if (rows.length === 0) throw new ApiError("Progress not found", 404);
    const progress = rows[0];

    // Format
    progress.completedLessons = parseJSON(progress.completedLessons);
    progress.completedModules = parseJSON(progress.completedModules);
    progress.quizzes = parseJSON(progress.quizzes);
    progress.assignments = parseJSON(progress.assignments);
    progress.course = { id: progress.course, title: progress.courseTitle };
    progress.student = { id: progress.student, fullName: progress.fullName, email: progress.email };
    delete progress.courseTitle; delete progress.fullName; delete progress.email;

    res.json(new ApiResponse(200, progress, "Progress fetched successfully"));
});

export const getOrInitializeProgress = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Check course
    const [c] = await executeQuery("SELECT id, title FROM courses WHERE id = ?", [courseId]);
    if (c.length === 0) throw new ApiError("Course not found", 404);

    let [rows] = await executeQuery(`
        SELECT p.*, u.fullName, u.email 
        FROM progress p 
        JOIN users u ON p.student = u.id 
        WHERE p.student = ? AND p.course = ?
    `, [userId, courseId]);

    let progress;
    if (rows.length === 0) {
        const levelConfig = await getActiveLevelConfig();
        const firstLevel = levelConfig && levelConfig.levels.length > 0 ? levelConfig.levels[0].name : "L1";
        const [resP] = await executeQuery(
            `INSERT INTO progress (student, course, currentLevel, completedLessons, completedModules, quizzes, assignments, progressPercent, createdAt, updatedAt) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
            [userId, courseId, firstLevel, '[]', '[]', '[]', '[]', 0]
        );
        progress = {
            id: resP[0].id, student: userId, course: courseId, currentLevel: firstLevel,
            completedLessons: [], completedModules: [],
            quizzes: [], assignments: [], progressPercent: 0
        };
        // Fetch full for joins would be ideal but manual construct is faster here
        progress.student = { id: userId, fullName: req.user.fullName, email: req.user.email }; // approximates
        progress.course = { id: courseId, title: c[0].title };
    } else {
        progress = rows[0];
        progress.completedLessons = parseJSON(progress.completedLessons, []);
        progress.completedModules = parseJSON(progress.completedModules, []);
        progress.quizzes = parseJSON(progress.quizzes, []);
        progress.assignments = parseJSON(progress.assignments, []);
        progress.course = { id: progress.course, title: c[0].title };
        progress.student = { id: progress.student, fullName: progress.fullName, email: progress.email };
        delete progress.fullName; delete progress.email;
    }

    const transformed = {
        ...progress,
        completedLessonIds: progress.completedLessons.map(l => String(l.lessonId)),
        completedModuleIds: progress.completedModules.map(m => String(m.moduleId)),
        lessonsCompleted: progress.completedLessons.map(l => String(l.lessonId)),
        modulesCompleted: progress.completedModules.map(m => String(m.moduleId))
    };

    res.json(new ApiResponse(200, transformed, "Progress fetched successfully"));
});

export const setStudentLevel = asyncHandler(async (req, res) => {
    let { studentId, courseId, stationId, level, lock } = req.body;

    if (!studentId) {
        throw new ApiError("studentId is required", 400);
    }

    // Check config
    if (level) {
        const levelConfig = await getActiveLevelConfig();
        // Normalize for comparison (L-1 == L1)
        const normalize = (s) => String(s).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        const matchedLevel = levelConfig?.levels?.find(l => normalize(l.name) === normalize(level));

        if (!matchedLevel) throw new ApiError(`Invalid level value: ${level}`, 400);

        // Use the canonical name from config to ensure consistency
        level = matchedLevel.name;
    }

    const { default: UserModel } = await import("../models/auth.model.js");
    const userData = await UserModel.findById(studentId);
    if (!userData) throw new ApiError("User not found", 404);

    if (!stationId) stationId = userData.stationId;

    let progress = null;
    if (courseId && courseId !== "undefined" && courseId !== "null") {
        let [rows] = await executeQuery("SELECT * FROM progress WHERE student = ? AND course = ?", [studentId, courseId]);
        if (rows.length === 0) {
            const levelConfig = await getActiveLevelConfig();
            const firstLevel = levelConfig && levelConfig.levels.length > 0 ? levelConfig.levels[0].name : "L1";
            const [resP] = await executeQuery(
                `INSERT INTO progress (student, course, currentLevel, completedLessons, completedModules, quizzes, assignments, progressPercent, createdAt, updatedAt) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
                [studentId, courseId, level || firstLevel, '[]', '[]', '[]', '[]', 0]
            );
            const [newP] = await executeQuery("SELECT * FROM progress WHERE id = ?", [resP[0].id]);
            progress = newP[0];
        } else {
            progress = rows[0];
        }
    }

    if (progress) {
        let updates = [];
        let values = [];
        if (level) { updates.push("currentLevel = ?"); values.push(level); }
        if (typeof lock === 'boolean') {
            updates.push("levelLockEnabled = ?"); values.push(lock);
            updates.push("lockedLevel = ?"); values.push(lock ? (level || progress.currentLevel) : null);
        }

        if (updates.length > 0) {
            await executeQuery(`UPDATE progress SET ${updates.join(', ')} WHERE id = ?`, [...values, progress.id]);
            // Re-fetch for response
            const [upP] = await executeQuery("SELECT * FROM progress WHERE id = ?", [progress.id]);
            progress = upP[0];
        }
    }

    // 2. Sync to User Profile with Station Awareness
    if (level || typeof lock === 'boolean') {
        let currentSkill = userData.currentSkill || {};
        if (typeof currentSkill === 'string') {
            try { currentSkill = JSON.parse(currentSkill); } catch (e) { currentSkill = {}; }
        }

        let subSectionId = userData.subSectionId;
        if (stationId) {
            const [mRows] = await executeQuery("SELECT subSectionId FROM [machines] WHERE id = ?", [stationId]);
            if (mRows.length > 0) {
                subSectionId = mRows[0].subSectionId;
            }
        }

        if (subSectionId) {
            if (level) currentSkill[subSectionId] = level;
            if (typeof lock === 'boolean') {
                currentSkill[`${subSectionId}_locked`] = lock;
                if (lock) currentSkill[`${subSectionId}_lockedLevel`] = level || currentSkill[subSectionId] || "L1";
            }
        }

        const updateFields = [];
        const updateParams = [];

        // If this is the user's primary station, also update the main currentLevel column
        if (String(userData.stationId) === String(stationId) && level) {
            updateFields.push("currentLevel = ?");
            updateParams.push(level);
        }

        updateFields.push("currentSkill = ?");
        updateParams.push(JSON.stringify(currentSkill));
        updateParams.push(studentId);

        await executeQuery(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);

        // --- TRIGGER AUTOMATED HANDOVER & MAX LEVEL CHECK ---
        if (level && level !== 'L1') {
            try {
                const { checkAndProcessHandover, checkAndProcessMaxLevelNotification } = await import("../utils/handover.util.js");
                await checkAndProcessHandover(studentId, level);
                await checkAndProcessMaxLevelNotification(studentId, level);
            } catch (err) {
                console.error("[SetStudentLevel] Handover/MaxLevel trigger failed:", err);
            }
        }
    }

    if (progress) {
        progress.completedLessons = typeof progress.completedLessons === 'string' ? JSON.parse(progress.completedLessons) : (progress.completedLessons || []);
        progress.completedModules = typeof progress.completedModules === 'string' ? JSON.parse(progress.completedModules) : (progress.completedModules || []);
    }

    res.json(new ApiResponse(200, progress || { success: true }, "Operator level updated successfully"));
});

export const getCourseProgress = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const [rows] = await executeQuery(`
        SELECT p.*, u.fullName, u.email 
        FROM progress p
        JOIN users u ON p.student = u.id
        WHERE p.course = ?
        ORDER BY p.createdAt DESC
    `, [courseId]);

    const mapped = rows.map(p => ({
        ...p,
        completedLessons: parseJSON(p.completedLessons),
        completedModules: parseJSON(p.completedModules),
        student: { id: p.student, fullName: p.fullName, email: p.email }
    })).map(p => { delete p.fullName; delete p.email; return p; });

    res.json(new ApiResponse(200, mapped, "Course progress fetched successfully"));
});

export const getStudentProgress = asyncHandler(async (req, res) => {
    const { studentId } = req.params;

    // Resolve ID
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    const [rows] = await executeQuery(`
        SELECT p.*, c.title as cTitle, c.description as cDesc, 
               u.fullName, u.email, u.slug as uSlug
        FROM progress p
        JOIN courses c ON p.course = c.id
        JOIN users u ON p.student = u.id
        WHERE p.student = ?
        ORDER BY p.createdAt DESC
    `, [sid]);

    // We need total modules per course for details
    // Can be optimized, but loop query is safe for reasonable N
    const mapped = await Promise.all(rows.map(async p => {
        const [mods] = await executeQuery("SELECT COUNT(*) as cnt FROM modules WHERE course = ?", [p.course]);
        const totalModules = mods[0].cnt;
        p.completedLessons = parseJSON(p.completedLessons);
        p.completedModules = parseJSON(p.completedModules);

        return {
            ...p,
            courseTitle: p.cTitle,
            course: { id: p.course, title: p.cTitle, description: p.cDesc },
            student: { id: p.student, fullName: p.fullName, email: p.email, slug: p.uSlug },
            completedLessonIds: p.completedLessons.map(l => String(l.lessonId)),
            completedModuleIds: p.completedModules.map(m => String(m.moduleId)),
            lessonsCompleted: p.completedLessons.map(l => String(l.lessonId)),
            modulesCompleted: p.completedModules.map(m => String(m.moduleId)),
            totalModules
        };
    }));

    // Cleanup props
    const clean = mapped.map(p => { delete p.cTitle; delete p.cDesc; delete p.fullName; delete p.email; delete p.uSlug; return p; });

    res.json(new ApiResponse(200, clean, "Student progress fetched successfully"));
});

export const getMyAllProgress = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const [rows] = await executeQuery(`
        SELECT p.*, 
               c.title as cTitle, c.description as cDesc, 
               u.fullName, u.email, 
               d.name as dName, d.startDate as dStart, d.endDate as dEnd
        FROM progress p
        JOIN courses c ON p.course = c.id
        JOIN users u ON p.student = u.id
        LEFT JOIN departments d ON (u.department = CAST(d.id AS NVARCHAR(50)) OR u.department = d.name)
        WHERE p.student = ?
        ORDER BY p.createdAt DESC
    `, [userId]);

    const result = await Promise.all(rows.map(async p => {
        const [mods] = await executeQuery("SELECT id, title, [order] FROM modules WHERE course = ?", [p.course]);
        const completedModules = parseJSON(p.completedModules, []);
        const totalModules = mods.length;
        const passedCourse = totalModules > 0 && completedModules.length >= totalModules;

        let reportAvailable = false;
        if (passedCourse && p.progressPercent >= 100) {
            // Check Quizzes
            const [quizzes] = await executeQuery("SELECT id FROM quizzes WHERE course = ?", [p.course]);
            const [passedQuizAttempts] = await executeQuery(`
                SELECT quiz FROM attempted_quizzes 
                WHERE student = ? AND status = 'PASSED' AND quiz IN (SELECT id FROM quizzes WHERE course = ?)
            `, [userId, p.course]);

            const passedQSet = new Set(passedQuizAttempts.map(a => String(a.quiz)));
            const allPassed = quizzes.every(q => passedQSet.has(String(q.id)));

            // Check Assignments
            const [assignments] = await executeQuery("SELECT id FROM assignments WHERE courseId = ?", [p.course]);
            const [subs] = await executeQuery(`
                SELECT assignment FROM submissions 
                WHERE student = ? AND status IN ('SUBMITTED', 'GRADED', 'RETURNED') AND assignment IN (SELECT id FROM assignments WHERE courseId = ?)
            `, [userId, p.course]);
            const subSet = new Set(subs.map(s => String(s.assignment)));
            const allSub = assignments.every(a => subSet.has(String(a.id)));

            if (allPassed && allSub) reportAvailable = true;
        }

        p.completedLessons = parseJSON(p.completedLessons, []);
        p.completedModules = completedModules;

        return {
            ...p,
            courseTitle: p.cTitle,
            course: { id: p.course, title: p.cTitle, description: p.cDesc, modules: mods },
            student: {
                id: p.student, fullName: p.fullName, email: p.email,
                department: p.dName ? { name: p.dName, startDate: p.dStart, endDate: p.dEnd } : null
            },
            completedLessonIds: p.completedLessons.map(l => String(l.lessonId)),
            completedModuleIds: completedModules.map(m => String(m.moduleId)),
            lessonsCompleted: p.completedLessons.map(l => String(l.lessonId)),
            modulesCompleted: completedModules.map(m => String(m.moduleId)),
            totalModules,
            reportAvailable
        };
    }));

    const clean = result.map(p => { delete p.cTitle; delete p.cDesc; delete p.fullName; delete p.email; delete p.dName; delete p.dStart; delete p.dEnd; return p; });

    res.json(new ApiResponse(200, clean, "My progress fetched successfully"));
});

export const getCourseCompletionReport = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { courseId } = req.params;

    // Student & Dept Info
    const [uRows] = await executeQuery(`
        SELECT u.fullName, u.userName, u.email, d.name as dName, d.id as dId
        FROM users u 
        LEFT JOIN departments d ON (u.department = CAST(d.id AS NVARCHAR(50)) OR u.department = d.name)
        WHERE u.id = ?
    `, [userId]);
    const student = uRows[0];
    if (!student || !student.dId) throw new ApiError("Student not assigned to any department", 404);

    // Dept details including instructor
    const [dRows] = await executeQuery(`
        SELECT d.*, u.fullName as iName, u.email as iEmail, c.title as cTitle
        FROM departments d
        LEFT JOIN users u ON d.instructor = u.id
        LEFT JOIN courses c ON d.course = c.id
        WHERE d.id = ?
    `, [student.dId]);
    const dept = dRows[0];
    if (String(dept.course) !== String(courseId)) throw new ApiError("Course mismatch", 400);

    const [cRows] = await executeQuery("SELECT * FROM courses WHERE id = ?", [courseId]);
    const course = cRows[0];

    // Progress
    const [pRows] = await executeQuery("SELECT * FROM progress WHERE student = ? AND course = ?", [userId, courseId]);
    if (pRows.length === 0) throw new ApiError("No progress found", 404);
    const progress = pRows[0];
    const completedModules = parseJSON(progress.completedModules, []);

    // Check completion
    const [mods] = await executeQuery("SELECT id FROM modules WHERE course = ?", [courseId]);
    const totalModules = mods.length;
    if (totalModules > 0 && completedModules.length < totalModules) throw new ApiError("Course not completed", 400);
    if (progress.progressPercent < 100) throw new ApiError("Progress must be 100%", 400);

    // Quizzes
    const [qAttempts] = await executeQuery(`
        SELECT aq.*, q.title as qTitle, q.questions, q.passingScore, q.type as qType, q.id as qId
        FROM attempted_quizzes aq
        JOIN quizzes q ON aq.quiz = q.id
        WHERE aq.student = ? AND q.course = ?
        ORDER BY aq.createdAt DESC
    `, [userId, courseId]);

    const quizResults = qAttempts.map(att => {
        const questions = parseJSON(att.questions, []); // questions structure from quiz table
        // Calculation logic replicated
        const totalQs = questions.length;
        const totalMarks = questions.reduce((s, q) => s + (Number(q.marks) || 1), 0) || totalQs;
        const scorePercent = totalMarks > 0 ? Math.round((att.score / totalMarks) * 100) : 0;
        const passingScore = att.passingScore || 70;
        const passed = scorePercent >= passingScore;
        return {
            quizId: att.qId, quizTitle: att.qTitle, quizType: att.qType,
            score: att.score, totalQuestions: totalQs, totalMarks, scorePercent,
            passingScore, passed, status: passed ? 'PASSED' : 'FAILED',
            attemptDate: att.createdAt, timeTaken: att.timeTaken
        };
    });

    // Assignments
    const [subs] = await executeQuery(`
        SELECT s.*, a.title as aTitle, a.maxScore, a.id as aId
        FROM submissions s
        JOIN assignments a ON s.assignment = a.id
        WHERE s.student = ? AND a.courseId = ? AND s.status IN ('SUBMITTED', 'GRADED', 'RETURNED')
    `, [userId, courseId]);

    const assignmentResults = subs.map(s => ({
        assignmentId: s.aId, assignmentTitle: s.aTitle, score: s.grade, maxScore: s.maxScore,
        status: s.status, submittedAt: s.submittedAt
    }));

    // Aggregates
    const totalQuizzes = quizResults.length; // Actually usage implies unique quizzes? 
    // Logic implies "all quizzes in course". 
    // We generated results based on attempts. 
    // We should filter unique best attempts or list all? Old code listed attempts but calculated stats.
    const passedQuizzes = quizResults.filter(q => q.passed).length;
    const overallQuizPassRate = totalQuizzes > 0 ? Math.round((passedQuizzes / totalQuizzes) * 100) : 0;
    const avgQuizScore = totalQuizzes > 0 ? Math.round(quizResults.reduce((s, q) => s + q.scorePercent, 0) / totalQuizzes) : 0;

    const [allAssignments] = await executeQuery("SELECT COUNT(*) as c FROM assignments WHERE courseId = ?", [courseId]);
    const totalAssignments = allAssignments[0].c;

    const reportData = {
        student: { fullName: student.fullName, userName: student.userName, email: student.email, department: dept.dName },
        course: { title: course.title, description: course.description, totalModules },
        instructor: { fullName: dept.iName || 'N/A', email: dept.iEmail || 'N/A' },
        performance: {
            modulesCompleted: completedModules.length,
            progressPercent: progress.progressPercent,
            quizzes: { total: totalQuizzes, passed: passedQuizzes, passRate: overallQuizPassRate, averageScore: avgQuizScore, details: quizResults },
            assignments: { total: totalAssignments, submitted: subs.length, details: assignmentResults },
            completionDate: new Date()
        },
        certificationEligible: true
    };

    res.json(new ApiResponse(200, reportData, "Report generated"));
});

export const validateModuleAccess = asyncHandler(async (req, res) => {
    // Basic logic replacement
    const { courseId, moduleId } = req.params;
    const userId = req.user.id;

    // Logic: check progress, check module index vs effectively completed
    // Since this requires `isModuleEffectivelyCompleted` utility which takes a Mongoose doc, we might have issues if that utility isn't updated.
    // However, we can send the plain object if utility handles it (JSON parsed).
    // Let's implement simplified logic here or assume utility works on POJO.
    // Assuming utility works on POJO `progress` with `completedModules` array.

    // Fetch course modules
    const [mods] = await pool.query("SELECT id, `order` FROM modules WHERE course = ? ORDER BY `order` ASC", [courseId]);
    const modIndex = mods.findIndex(m => String(m.id) === String(moduleId));

    if (modIndex === -1) return res.json(new ApiResponse(200, { hasAccess: false, reason: "Module not found" }, "Checked"));

    const [pRows] = await pool.query("SELECT * FROM progress WHERE student = ? AND course = ?", [userId, courseId]);
    if (pRows.length === 0) {
        const hasAccess = modIndex === 0;
        return res.json(new ApiResponse(200, { hasAccess, reason: hasAccess ? 'First module' : 'No progress' }, "Checked"));
    }
    const progress = pRows[0];
    progress.completedModules = parseJSON(progress.completedModules, []);

    // Simple sequential Logic:
    // Has access if previous modules completed OR logic satisfies.
    // If modIndex == 0, access = true.
    // If modIndex > 0, check if modIndex-1 is in completedModules.

    let hasAccess = true;
    let reason = "Access granted";
    if (modIndex > 0) {
        const prevMod = mods[modIndex - 1];
        const prevDone = progress.completedModules.some(cm => String(cm.moduleId) === String(prevMod.id));
        if (!prevDone) {
            hasAccess = false;
            reason = "Previous modules not completed";
        }
    }

    // Check if current is completed
    const isDone = progress.completedModules.some(cm => String(cm.moduleId) === String(moduleId));
    if (isDone) reason = "Module completed";

    res.json(new ApiResponse(200, {
        hasAccess, reason, moduleIndex: modIndex,
        completedModulesCount: progress.completedModules.length,
        effectivelyCompletedCount: progress.completedModules.length
    }, "Checked"));
});

export const checkModuleAccessWithTimeline = asyncHandler(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const userId = req.user.id;

    const [uRows] = await pool.query("SELECT department FROM users WHERE id = ?", [userId]);
    const deptId = uRows[0]?.department;

    if (!deptId) return res.json(new ApiResponse(200, { hasAccess: true, reason: 'No dept', timeline: null }, "Checked"));

    const [tRows] = await pool.query("SELECT * FROM module_timelines WHERE course = ? AND module = ? AND department = ? AND isActive = 1", [courseId, moduleId, deptId]);

    if (tRows.length === 0) return res.json(new ApiResponse(200, { hasAccess: true, reason: 'No timeline', timeline: null }, "Checked"));
    const timeline = tRows[0];
    timeline.missedDeadlines = parseJSON(timeline.missedDeadlines, []);

    const now = new Date();
    const isOverdue = now > new Date(timeline.deadline);
    const hasMissed = timeline.missedDeadlines.some(m => String(m.student) === String(userId));

    let hasAccess = true;
    let reason = "Access granted";

    if (isOverdue && !hasMissed) {
        const grace = new Date(new Date(timeline.deadline).getTime() + (timeline.gracePeriodHours * 3600000));
        if (now > grace) reason = "Overdue - Grace period expired";
        else reason = "Overdue - Within grace period";
    }

    res.json(new ApiResponse(200, {
        hasAccess, reason,
        timeline: { deadline: timeline.deadline, isOverdue, gracePeriodHours: timeline.gracePeriodHours }
    }, "Checked"));
});

export const getTimelineViolations = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    let sid = await resolveStudentId(studentId);
    if (req.user.role === 'STUDENT') sid = req.user.id;
    if (!sid) throw new ApiError("Invalid student ID", 400);

    const [rows] = await executeQuery("SELECT p.timelineViolations, c.title as cTitle FROM progress p JOIN courses c ON p.course = c.id WHERE p.student = ?", [sid]);

    let violations = [];
    rows.forEach(r => {
        const vs = parseJSON(r.timelineViolations, []);
        vs.forEach(v => violations.push({ ...v, courseName: r.cTitle }));
    });

    // Populate module titles if needed?
    // Frontend likely wants titles. 
    // We can fetch all module titles referenced in violations.
    const modIds = [...new Set(violations.map(v => v.module))];
    if (modIds.length > 0) {
        const ph = modIds.map(() => '?').join(',');
        const [mods] = await pool.query(`SELECT id, title FROM modules WHERE id IN (${ph})`, modIds);
        const mMap = new Map(mods.map(m => [String(m.id), m.title]));
        violations = violations.map(v => ({ ...v, module: { title: mMap.get(String(v.module)) } }));
    }

    res.json(new ApiResponse(200, violations, "Retrieved"));
});

export const updateCurrentAccessibleModule = asyncHandler(async (req, res) => {
    // Admin override stuff - mostly for legacy logic support
    // We update 'currentAccessibleModule' column if it exists, or ignore
    // Assuming column exists per general schema inference
    const { studentId, courseId, moduleId } = req.body;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    await pool.query("UPDATE progress SET currentAccessibleModule = ? WHERE student = ? AND course = ?", [moduleId, sid, courseId]);
    res.json(new ApiResponse(200, {}, "Updated"));
});

// 10 Cycle Check Sheet
export const getTenCycleCheck = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    let data = await TenCycleCheck.findByStudentId(sid);

    if (!data) {
        // Return structured empty/default data if new
        return res.status(200).json(
            new ApiResponse(200, { isNew: true }, "No record found")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, { ...data, isNew: false }, "10 Cycle Check fetched successfully")
    );
});

export const saveTenCycleCheck = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    const { qualityEngineer, qualityEngineerSign, dojoEngineer, dojoEngineerSign, formType, entries } = req.body;

    let checkSheet = await TenCycleCheck.findByStudentId(sid);

    if (checkSheet) {
        checkSheet.qualityEngineer = qualityEngineer;
        checkSheet.qualityEngineerSign = qualityEngineerSign;
        checkSheet.dojoEngineer = dojoEngineer;
        checkSheet.dojoEngineerSign = dojoEngineerSign;
        checkSheet.formType = formType;
        checkSheet.entries = entries;
        checkSheet.updatedBy = req.user?.name;
        await checkSheet.save();
    } else {
        checkSheet = await TenCycleCheck.create({
            studentId: sid,
            qualityEngineer,
            qualityEngineerSign,
            dojoEngineer,
            dojoEngineerSign,
            formType,
            entries,
            createdBy: req.user?.name
        });
    }

    // Trigger Email Notification
    NotificationService.sendFormReport("10-Cycle Check Sheet", null, req.body, studentId)
        .catch(err => console.error("[10Cycle] Notification failed:", err));

    return res.status(200).json(
        new ApiResponse(200, checkSheet, "10 Cycle Check saved successfully")
    );
});

// 3 Day Monitoring Sheet
export const getThreeDayMonitoring = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    let data = await ThreeDayMonitoring.findByStudentId(sid);
    const assignmentInfo = await getStudentAssignedMachineLine(sid);
    
    // Fetch user details for the header
    const [userRows] = await executeQuery("SELECT fullName, userName, departmentId FROM users WHERE id = ?", [sid]);
    const student = userRows[0];

    if (!data) {
        const lineLeaderStr = assignmentInfo.lineLeader || "";
        const lineLeaderOptions = lineLeaderStr.split(',').map(s => s.trim()).filter(Boolean);
        return res.status(200).json(
            new ApiResponse(200, {
                isNew: true,
                employeeName: student?.fullName || "",
                employeeCode: student?.userName || "",
                departmentId: student?.departmentId || null,
                processName: assignmentInfo.processName || "",
                lineName: assignmentInfo.lineName || "",
                lineLeader: lineLeaderStr,
                lineLeaderOptions,
            }, "No record found")
        );
    }

    const resolvedProcessName = data.processName || assignmentInfo.processName || "";
    const resolvedLineName = data.lineName || assignmentInfo.lineName || "";
    const lineLeaderStr = assignmentInfo.lineLeader || "";
    const lineLeaderOptions = lineLeaderStr.split(',').map(s => s.trim()).filter(Boolean);

    return res.status(200).json(
        new ApiResponse(200, {
            ...data.toJSON ? data.toJSON() : data,
            employeeName: student?.fullName || "",
            employeeCode: student?.userName || "",
            departmentId: student?.departmentId || null,
            processName: resolvedProcessName,
            lineName: resolvedLineName,
            lineLeader: lineLeaderStr,
            lineLeaderOptions,
            isNew: false,
        }, "3 Day Monitoring fetched successfully")
    );
});

export const saveThreeDayMonitoring = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const sid = await resolveStudentId(studentId);
    if (!sid) throw new ApiError("Invalid student ID", 400);

    const {
        headerInfo, gridData, footerData, status
    } = req.body;

    const finalProcessName = headerInfo?.processName || "";
    const finalLineName = headerInfo?.lineName || "";
    const entries = gridData || {};
    const evaluation = footerData || {};
    const checkedBy = footerData?.checkedByName || "";
    const verifiedBy = footerData?.verifiedByName || "";
    const approvedBy = footerData?.approvedByName || "";
    const targetStatus = status || "Draft";

    let sheet = await ThreeDayMonitoring.findByStudentId(sid);

    if (sheet) {
        sheet.processName = finalProcessName;
        sheet.lineName = finalLineName;
        sheet.entries = entries;
        sheet.evaluation = evaluation;
        sheet.checkedBy = checkedBy;
        sheet.verifiedBy = verifiedBy;
        sheet.approvedBy = approvedBy;
        sheet.status = targetStatus;
        sheet.updatedBy = req.user?.fullName || req.user?.userName;
        logger.info(`[3Day] Updating existing sheet for sid: ${sid} by ${sheet.updatedBy}`);
        await sheet.save();
    } else {
        sheet = await ThreeDayMonitoring.create({
            studentId: sid,
            processName: finalProcessName,
            lineName: finalLineName,
            entries,
            evaluation,
            checkedBy,
            verifiedBy,
            approvedBy,
            status: targetStatus,
            createdBy: req.user?.fullName || req.user?.userName
        });
        logger.info(`[3Day] Created new sheet for sid: ${sid} by ${sheet.createdBy}`);
    }

    const auditAction = targetStatus === "Draft" ? "SAVE_THREE_DAY_MONITORING_DRAFT" : "SUBMIT_THREE_DAY_MONITORING";
    logAudit(req.user?.id, auditAction, { studentId: sid, status: targetStatus }, { resourceType: "ThreeDayMonitoring", resourceId: sheet.id, req })
        .catch(err => console.error(`logAudit(${auditAction}) failed:`, err.message));

    // Trigger Email Notification
    NotificationService.sendFormReport("3-Day Monitoring Sheet", null, req.body, studentId)
        .catch(err => console.error("[3Day] Notification failed:", err));

    return res.status(200).json(
        new ApiResponse(200, sheet, "3 Day Monitoring saved successfully")
    );
});

export const getThreeDayMonitoringConfig = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const config = await MonitoringConfig.findByTypeAndDepartment('3DAY', departmentId);
    return res.status(200).json(
        new ApiResponse(200, { config: config?.config || null }, "3 Day Monitoring config fetched")
    );
});

export const saveThreeDayMonitoringConfig = asyncHandler(async (req, res) => {
    const { departmentId, config, remark } = req.body;
    await MonitoringConfig.upsert({
        type: '3DAY',
        departmentId,
        config,
        remark,
        updatedBy: req.user?.name
    });
    return res.status(200).json(
        new ApiResponse(200, null, "3 Day Monitoring config saved")
    );
});

export const getThreeDayMonitoringHistory = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const history = await MonitoringConfig.getHistory('3DAY', departmentId);
    return res.status(200).json(
        new ApiResponse(200, history, "3 Day Monitoring history fetched")
    );
});
