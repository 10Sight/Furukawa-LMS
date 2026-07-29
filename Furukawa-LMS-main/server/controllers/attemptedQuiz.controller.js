import AttemptedQuiz from "../models/attemptedQuiz.model.js";
import Quiz from "../models/quiz.model.js";
import Progress from "../models/progress.model.js";
import Module from "../models/module.model.js";
import Course from "../models/course.model.js";
import User from "../models/auth.model.js";
import ExtraAttemptAllowance from "../models/extraAttempt.model.js";
import AttemptExtensionRequest from "../models/attemptExtensionRequest.model.js";

import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { checkModuleAccessForAssessments } from "../utils/moduleCompletion.js";
import logAudit from "../utils/auditLogger.js";

// Helper to check if a student has an OJT approved for today, based on the per-student
// approvedAt stored on users.ojt (set from that student's own attendance row date, not
// the sheet's save/creation time — see onJobTraining.controller.js).
const checkOjtApprovedToday = async (userId) => {
    const [rows] = await executeQuery(`
        SELECT TOP 1 1
        FROM users u
        CROSS APPLY OPENJSON(ISNULL(u.ojt, '[]')) WITH (
            result NVARCHAR(50) '$.result',
            approvedAt DATETIME '$.approvedAt'
        ) AS ojt_item
        WHERE u.id = ?
          AND (ojt_item.result = 'Pass' OR ojt_item.result = 'Approved')
          AND CAST(ojt_item.approvedAt AS DATE) = CAST(GETDATE() AS DATE)
    `, [userId]);
    if (rows.length > 0) return true;

    // Fallback for sheets whose badge sync hasn't run yet: check the student's own attendance
    // row directly (matched by empId/userName), same-day only.
    try {
        const [userIdentityRows] = await executeQuery("SELECT empId, userName FROM users WHERE id = ?", [userId]);
        const empId = userIdentityRows[0]?.empId;
        const userName = userIdentityRows[0]?.userName;
        if (!empId && !userName) return false;

        const [rowRows] = await executeQuery(`
            SELECT TOP 1 1
            FROM on_job_trainings ojt
            CROSS APPLY OPENJSON(ojt.attendanceRecords) WITH (
                ecode NVARCHAR(100) '$.ecode',
                result NVARCHAR(50) '$.result',
                recDate DATE '$.date'
            ) AS rec
            WHERE (rec.result = 'Pass' OR rec.result = 'Approved')
              AND (rec.ecode = ? OR rec.ecode = ?)
              AND rec.recDate = CAST(GETDATE() AS DATE)
        `, [empId || null, userName || null]);
        return rowRows.length > 0;
    } catch (fallbackErr) {
        console.error("[ERROR] Fallback same-day OJT row query failed:", fallbackErr.message);
        return false;
    }
};

// Helper to check if a student has ever had an OJT approved (Pass/Approved), at any time —
// not restricted to today. Mirrors the base OJT gating check below: reads the per-student
// ojt JSON blob first, falling back to the on_job_trainings table if that column isn't synced.
//
// The fallback deliberately checks each student's OWN attendance row (matched by empId/userName)
// rather than the sheet-level `result` column: on a multi-trainee Record sheet, one student's row
// can be Approved while another's is Rejected, so trusting only the sheet-level result would wrongly
// approve every trainee on an otherwise-approved sheet.
const checkOjtApprovedGenerally = async (userId) => {
    try {
        const [userRows] = await executeQuery("SELECT ojt FROM users WHERE id = ?", [userId]);
        if (userRows.length > 0) {
            try {
                const ojtList = JSON.parse(userRows[0].ojt || "[]");
                if (Array.isArray(ojtList) && ojtList.some(o => o.result === "Pass" || o.result === "Approved")) {
                    return true;
                }
            } catch (e) { /* fall through to fallback check */ }
        }
    } catch (dbErr) {
        console.error("[ERROR] Failed to query user ojt list:", dbErr.message);
    }

    try {
        const [userIdentityRows] = await executeQuery("SELECT empId, userName FROM users WHERE id = ?", [userId]);
        const empId = userIdentityRows[0]?.empId;
        const userName = userIdentityRows[0]?.userName;

        // Primary-student sheets (Evaluation sheets): sheet-level result applies directly.
        const [primaryRows] = await executeQuery(`
            SELECT 1 FROM on_job_trainings
            WHERE student = CAST(? AS NVARCHAR(50))
              AND (result = 'Pass' OR result = 'Approved')
        `, [userId]);
        if (primaryRows.length > 0) return true;

        // Multi-trainee Record sheets: check this student's own attendance row result via OPENJSON.
        if (empId || userName) {
            const [rowRows] = await executeQuery(`
                SELECT TOP 1 1
                FROM on_job_trainings ojt
                CROSS APPLY OPENJSON(ojt.attendanceRecords) WITH (
                    ecode NVARCHAR(100) '$.ecode',
                    result NVARCHAR(50) '$.result'
                ) AS rec
                WHERE (rec.result = 'Pass' OR rec.result = 'Approved')
                  AND (rec.ecode = ? OR rec.ecode = ?)
            `, [empId || null, userName || null]);
            if (rowRows.length > 0) return true;
        }

        return false;
    } catch (fallbackErr) {
        console.error("[ERROR] Fallback OJT query failed:", fallbackErr.message);
        return false;
    }
};

// Resolves the snapshot fields (identity + status/hierarchy at attempt time) for the actual
// candidate taking the quiz. Always queries by the candidate's userId — never req.user — since
// admins/trainers frequently submit attempts on behalf of a candidate.
const resolveStudentSnapshot = async (userId) => {
    const snapshot = {
        studentName: null, studentEmpId: null, studentIsTemporary: 0,
        studentDeptId: null, studentSectionId: null, studentLineId: null, studentSubSectionId: null
    };
    try {
        const [rows] = await executeQuery(
            `SELECT fullName, empId, isTemporary, departmentId, sectionId, lineId, subSectionId,
                    targetDeptId, targetSectionId, targetLineId, targetSubSectionId
             FROM users WHERE id = ?`,
            [userId]
        );
        if (rows.length > 0) {
            const u = rows[0];
            snapshot.studentName = u.fullName || null;
            snapshot.studentEmpId = u.empId || null;
            snapshot.studentIsTemporary = u.isTemporary ? 1 : 0;
            snapshot.studentDeptId = u.departmentId || (u.isTemporary ? u.targetDeptId : null);
            snapshot.studentSectionId = u.sectionId || (u.isTemporary ? u.targetSectionId : null);
            snapshot.studentLineId = u.lineId || (u.isTemporary ? u.targetLineId : null);
            snapshot.studentSubSectionId = u.subSectionId || (u.isTemporary ? u.targetSubSectionId : null);
        }
    } catch (e) { /* non-fatal */ }
    return snapshot;
};

// Dojo quizzes can be restricted to candidates from specific target sections/departments.
// Sections take precedence over departments when both are configured; if neither is
// configured, every temporary candidate is eligible. Non-temporary candidates and
// non-Dojo quizzes are never gated by this check.
const checkDojoTargetAccess = (quiz, candidate) => {
    if (!quiz?.isDojo || !candidate?.isTemporary) return { allowed: true };

    const targetSections = (Array.isArray(quiz.targetSectionId) ? quiz.targetSectionId : []).filter(id => id !== null && id !== undefined && id !== '');
    const targetDepts = (Array.isArray(quiz.targetDeptId) ? quiz.targetDeptId : []).filter(id => id !== null && id !== undefined && id !== '');

    if (targetSections.length > 0) {
        const allowed = targetSections.some(id => String(id) === String(candidate.targetSectionId));
        return allowed ? { allowed: true } : { allowed: false, reason: "Access Denied: This Dojo quiz is restricted to candidates from specific sections." };
    }

    if (targetDepts.length > 0) {
        const allowed = targetDepts.some(id => String(id) === String(candidate.targetDeptId));
        return allowed ? { allowed: true } : { allowed: false, reason: "Access Denied: This Dojo quiz is restricted to candidates from specific departments." };
    }

    return { allowed: true };
};

// Helper for population
const populateAttempt = async (attempt) => {
    if (!attempt) return null;
    if (attempt.quiz) {
        // Quiz is often just ID in SQL object, but might be number or string.
        // If it's already an object, skip.
        if (typeof attempt.quiz !== 'object') {
            const q = await Quiz.findById(attempt.quiz);
            if (q) {
                // Populate quiz details needed (course, module)
                if (q.course) q.course = await Course.findById(q.course).then(c => c ? { id: c.id, title: c.title, _id: c.id } : null);
                if (q.module) q.module = await Module.findById(q.module).then(m => m ? { id: m.id, title: m.title, _id: m.id } : null);
                
                // Fetch sub-section names for the quiz
                let subSectionNames = [];
                if (q.subSectionId && q.subSectionId.length > 0) {
                    const validIds = q.subSectionId.filter(id => !isNaN(id) && id !== null && id !== '');
                    if (validIds.length > 0) {
                        const placeholders = validIds.map(() => "?").join(",");
                        const [ssRows] = await executeQuery(`SELECT name FROM [sub_sections] WHERE id IN (${placeholders})`, validIds);
                        subSectionNames = ssRows.map(r => r.name);
                    }
                }
                q.subSectionNames = subSectionNames;

                attempt.quiz = q;
            }
        }
    }
    if (attempt.student) {
        if (typeof attempt.student !== 'object') {
            const _origStudentId = attempt.student;
            attempt.student = await User.findById(attempt.student).then(async (u) => {
                // Reconnect via empId snapshot when user was deleted and re-imported with new ID
                if (!u && attempt.studentEmpId) {
                    try {
                        const [rows] = await executeQuery(
                            "SELECT id FROM users WHERE empId = ?",
                            [attempt.studentEmpId]
                        );
                        if (rows.length > 0) u = await User.findById(rows[0].id);
                    } catch (e) { /* non-fatal */ }
                }
                if (!u) {
                    if (!attempt.studentName && !attempt.studentEmpId) return null;

                    let snapDeptName = null, snapSecName = null, snapLineName = null, snapSubSecName = null;
                    try {
                        if (attempt.studentDeptId) {
                            const [r] = await executeQuery("SELECT name FROM departments WHERE id = ?", [attempt.studentDeptId]);
                            if (r && r.length > 0) snapDeptName = r[0].name;
                        }
                        if (attempt.studentSectionId) {
                            const [r] = await executeQuery("SELECT name FROM [sections] WHERE id = ?", [attempt.studentSectionId]);
                            if (r && r.length > 0) snapSecName = r[0].name;
                        }
                        if (attempt.studentLineId) {
                            const [r] = await executeQuery("SELECT name FROM [lines] WHERE id = ?", [attempt.studentLineId]);
                            if (r && r.length > 0) snapLineName = r[0].name;
                        }
                        if (attempt.studentSubSectionId) {
                            const [r] = await executeQuery("SELECT name FROM sub_sections WHERE id = ?", [attempt.studentSubSectionId]);
                            if (r && r.length > 0) snapSubSecName = r[0].name;
                        }
                    } catch (err) {
                        console.error("Failed to populate snapshot hierarchy names in populateAttempt:", err.message);
                    }

                    return {
                        id: _origStudentId, _id: _origStudentId,
                        fullName: attempt.studentName || 'Unknown',
                        userName: attempt.studentEmpId || '',
                        empId: attempt.studentEmpId || '',
                        email: null,
                        isTemporary: !!attempt.studentIsTemporary,
                        departmentId: attempt.studentDeptId || null, departmentName: snapDeptName,
                        sectionId: attempt.studentSectionId || null, sectionName: snapSecName,
                        lineId: attempt.studentLineId || null, lineName: snapLineName,
                        subSectionId: attempt.studentSubSectionId || null, subSectionName: snapSubSecName,
                        role: null
                    };
                }
                let deptName = u.department || null;
                let secName = null;
                let lineName = null;
                let subSecName = null;

                try {
                    // Resolve department using same fallback order as user search:
                    // departmentId → targetDeptId (temporary users) → section's dept → line's dept
                    const resolvedDeptId = u.departmentId || (u.isTemporary ? u.targetDeptId : null);
                    if (resolvedDeptId) {
                        const [r] = await executeQuery("SELECT name FROM departments WHERE id = ?", [resolvedDeptId]);
                        if (r && r.length > 0) deptName = r[0].name;
                    }
                    if (!deptName && u.sectionId) {
                        const [r] = await executeQuery("SELECT d.name FROM departments d INNER JOIN [sections] s ON s.departmentId = d.id WHERE s.id = ?", [u.sectionId]);
                        if (r && r.length > 0) deptName = r[0].name;
                    }
                    if (!deptName && u.lineId) {
                        const [r] = await executeQuery("SELECT d.name FROM departments d INNER JOIN [sections] s ON s.departmentId = d.id INNER JOIN [lines] l ON l.sectionId = s.id WHERE l.id = ?", [u.lineId]);
                        if (r && r.length > 0) deptName = r[0].name;
                    }
                    if (u.sectionId) {
                        const [r] = await executeQuery("SELECT name FROM [sections] WHERE id = ?", [u.sectionId]);
                        if (r && r.length > 0) secName = r[0].name;
                    }
                    if (u.lineId) {
                        const [r] = await executeQuery("SELECT name FROM [lines] WHERE id = ?", [u.lineId]);
                        if (r && r.length > 0) lineName = r[0].name;
                    }
                    if (u.subSectionId) {
                        const [r] = await executeQuery("SELECT name FROM sub_sections WHERE id = ?", [u.subSectionId]);
                        if (r && r.length > 0) subSecName = r[0].name;
                    }
                } catch (err) {
                    console.error("Failed to populate hierarchy names in populateAttempt:", err.message);
                }

                return {
                    id: u.id,
                    _id: u.id,
                    fullName: u.fullName,
                    userName: u.userName,
                    email: u.email,
                    empId: u.empId,
                    departmentId: u.departmentId,
                    departmentName: deptName,
                    sectionId: u.sectionId,
                    sectionName: secName,
                    lineId: u.lineId,
                    lineName: lineName,
                    subSectionId: u.subSectionId,
                    subSectionName: subSecName,
                    role: u.role
                };
            });
        }
    }
    return attempt;
};

export const attemptQuiz = asyncHandler(async (req, res) => {
    const { quizId, answers, conductedBy } = req.body;
    const userId = req.user.id;

    if (!quizId) throw new ApiError("Quiz ID is required", 400);

    let resolvedQuizId = quizId;
    // Try to find quiz by ID first (if number), else slug
    let quiz = await Quiz.findById(quizId);
    if (!quiz) {
        // Try slug
        quiz = await Quiz.findOne({ slug: String(quizId).toLowerCase() });
        if (!quiz) throw new ApiError("Quiz not found", 400);
        resolvedQuizId = quiz.id;
    }

    // Populate needed fields for logic
    if (quiz.course) quiz.course = await Course.findById(quiz.course);
    if (quiz.module) quiz.module = await Module.findById(quiz.module);

    // Validate access permissions
    if (quiz.module && quiz.type === "MODULE") {
        const accessCheck = await checkModuleAccessForAssessments(userId, quiz.course.id, quiz.module.id);
        if (!accessCheck.hasAccess) {
            throw new ApiError(accessCheck.reason || "Access denied. Complete all lessons in the module first.", 403);
        }
    } else if (quiz.type === "COURSE") {
        const course = await Course.findById(quiz.course.id); // Re-fetch to be sure or use populated ?
        // We need modules list
        // Course model in SQL doesn't carry modules list in properties automatically unless we query.
        // Assuming we need to check Progress vs Course Modules count.

        // Count total modules in course
        const [modRows] = await executeQuery("SELECT COUNT(*) as count FROM modules WHERE course = ?", [quiz.course.id]);
        const totalModules = modRows[0].count;

        const progress = await Progress.findOne({
            student: userId,
            course: quiz.course.id
        });

        if (!progress) {
            throw new ApiError("No progress found. Complete all modules first.", 403);
        }

        const completedModules = progress.completedModules?.length || 0;

        if (completedModules < totalModules) {
            throw new ApiError(`Complete all ${totalModules} modules to access this course quiz. Currently completed: ${completedModules}`, 403);
        }
    }

    if (!answers || answers.length === 0) {
        throw new ApiError("Answers are required", 400);
    }

    let score = 0;
    let totalMarks = 0;

    // Quiz questions are JSON.
    const questions = quiz.questions || [];

    questions.forEach((q, index) => {
        const questionMarks = q.marks || 1;
        totalMarks += questionMarks;
        // Simple string matching for this legacy endpoint
        if (answers[index] && answers[index] === q.correctOption) {
            score += questionMarks;
        }
    });

    // Calculate if passed
    const scorePercent = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const passed = scorePercent >= (quiz.passingScore || 70);

    const studentSnapshot = await resolveStudentSnapshot(userId);

    const attempt = await AttemptedQuiz.create({
        quiz: resolvedQuizId,
        student: userId,
        ...studentSnapshot,
        answer: answers.map((ans, idx) => ({
            questionId: questions[idx]._id || questions[idx].id,
            selectedOptions: [ans || ""],
            isCorrect: answers[idx] === questions[idx].correctOption,
            marksObtained: answers[idx] === questions[idx].correctOption ? (questions[idx].marks || 1) : 0
        })),
        score,
        status: passed ? "PASSED" : "FAILED",
        completedAt: new Date(),
        attemptNumber: 1,
        timeTaken: 0,
        conductedBy: conductedBy !== undefined && conductedBy !== null ? conductedBy : ""
    });

    res.status(201)
        .json(new ApiResponse(201, attempt, "Quiz attempted successfully"));
});

export const getMyAttempts = asyncHandler(async (req, res) => {
    let attempts = await AttemptedQuiz.find({ student: req.user.id });
    // sort desc manually since SQL find might default ASC id
    attempts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    attempts = await Promise.all(attempts.map(populateAttempt));

    res.json(new ApiResponse(200, attempts, "My attempts fetched successfully"));
});

export const getAttemptsQuiz = asyncHandler(async (req, res) => {
    const { quizId } = req.params;

    let resolvedQuizId = quizId;
    let quiz = await Quiz.findById(quizId);
    if (!quiz) {
        quiz = await Quiz.findOne({ slug: String(quizId).toLowerCase() });
        if (!quiz) throw new ApiError("Invalid quiz ID", 400);
        resolvedQuizId = quiz.id;
    }

    let attempts = await AttemptedQuiz.find({ quiz: resolvedQuizId });
    attempts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    attempts = await Promise.all(attempts.map(populateAttempt));

    res.json(new ApiResponse(200, attempts, "Attempts for quiz fetched successfully"));
});

export const getAttemptById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    let attempt = await AttemptedQuiz.findById(id);

    if (!attempt) {
        throw new ApiError("Attempt not found", 404);
    }

    attempt = await populateAttempt(attempt);

    res.json(new ApiResponse(200, attempt, "Attempt fetched successfully"));
});

export const deleteAttempt = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Direct delete call using SQL helper or model method if exists.
    // Our models usually have deleteOne() instance method or use pool.
    // Assuming standard delete logic since we moved to SQL models.
    // If AttemptedQuiz doesn't have instance deleteOne, use pool.

    const [result, metadata] = await executeQuery("DELETE FROM attempted_quizzes WHERE id = ?", [id]);

    if (metadata.affectedRows === 0) {
        throw new ApiError("Attempt not found", 404); // Or just 200 OK? user expects it gone.
    }

    res.json(new ApiResponse(200, null, "Attempt deleted successfully"));
});

// ADMIN/TRAINER: Update attempt answers/scores manually
export const adminUpdateAttempt = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { answersOverride, adjustmentNotes } = req.body || {};

    let attempt = await AttemptedQuiz.findById(id);
    if (!attempt) throw new ApiError("Attempt not found", 404);

    attempt = await populateAttempt(attempt); // Need quiz populated

    // Allow ADMIN, TRAINER, or INSTRUCTOR to edit
    const hasEditRights = req.user && (
        req.user.isAdmin == true || 
        req.user.isTrainer == true || 
        ['ADMIN', 'SUPERADMIN', 'TRAINER', 'INSTRUCTOR'].includes(req.user.role) ||
        (req.user.role === 'CUSTOM' && ['admin', 'superadmin', 'trainer', 'instructor'].includes(String(req.user.customRole?.targetLayout).toLowerCase()))
    );

    if (!hasEditRights) {
        throw new ApiError("Only admins and trainers can modify attempts", 403);
    }

    if (!Array.isArray(answersOverride)) {
        throw new ApiError("answersOverride must be an array", 400);
    }

    const overrideMap = new Map();
    for (const item of answersOverride) {
        if (!item || !item.questionId) continue;
        overrideMap.set(String(item.questionId), {
            selectedOptions: item.selectedOptions,
            isCorrect: item.isCorrect,
            marksObtained: typeof item.marksObtained === 'number' ? item.marksObtained : undefined,
        });
    }

    let newScore = 0;
    // attempt.answer is parsed from JSON in SQL model
    const newAnswers = attempt.answer.map((ans, idx) => {
        const key = String(ans.questionId);
        const override = overrideMap.get(key) || overrideMap.get(String(idx));
        if (!override) {
            newScore += (ans.marksObtained || 0);
            return ans;
        }
        const updated = { ...ans };
        if (Array.isArray(override.selectedOptions)) updated.selectedOptions = override.selectedOptions;
        if (typeof override.isCorrect === 'boolean') updated.isCorrect = override.isCorrect;
        if (override.marksObtained !== undefined) updated.marksObtained = override.marksObtained;
        newScore += (updated.marksObtained || 0);
        return updated;
    });

    attempt.answer = newAnswers;
    attempt.score = newScore;

    const questions = attempt.quiz?.questions || [];
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0) || 0;
    const scorePercent = totalMarks > 0 ? Math.round((newScore / totalMarks) * 100) : 0;
    const passingScore = attempt.quiz?.passingScore || 70;
    attempt.status = scorePercent >= passingScore ? 'PASSED' : 'FAILED';

    attempt.manuallyAdjusted = true;
    attempt.adjustedBy = req.user.id;
    attempt.adjustedAt = new Date();
    if (adjustmentNotes) attempt.adjustmentNotes = String(adjustmentNotes).slice(0, 2000);

    await attempt.save();

    res.json(new ApiResponse(200, attempt, "Attempt updated successfully"));
});

// New endpoint to get specific student attempts for admin
export const getStudentAttempts = asyncHandler(async (req, res) => {
    const { studentId } = req.params;

    let resolvedStudentId = studentId;
    let userEmpId = null;

    if (isNaN(studentId)) {
        const handle = String(studentId).toLowerCase();
        const u = await User.findOne({ userName: handle });
        if (!u) throw new ApiError("Invalid student ID", 400);
        resolvedStudentId = u.id;
        userEmpId = u.empId || null;
    } else {
        // Fetch empId so we can also recover attempts recorded under a previous DB id (delete+reimport)
        try {
            const [userRows] = await executeQuery("SELECT empId FROM users WHERE id = ?", [resolvedStudentId]);
            if (userRows.length > 0) userEmpId = userRows[0].empId || null;
        } catch (e) { /* non-fatal */ }
    }

    // Match by current student id OR by empId snapshot so historical attempts survive delete+reimport
    let attemptRows;
    if (userEmpId) {
        [attemptRows] = await executeQuery(
            `SELECT * FROM attempted_quizzes WHERE student = ? OR (studentEmpId IS NOT NULL AND studentEmpId = ?) ORDER BY createdAt DESC`,
            [String(resolvedStudentId), userEmpId]
        );
    } else {
        [attemptRows] = await executeQuery(
            `SELECT * FROM attempted_quizzes WHERE student = ? ORDER BY createdAt DESC`,
            [String(resolvedStudentId)]
        );
    }

    // Deduplicate in case a single row matches both conditions
    const _seenIds = new Set();
    let attempts = attemptRows
        .filter(r => { if (_seenIds.has(r.id)) return false; _seenIds.add(r.id); return true; })
        .map(r => new AttemptedQuiz(r));
    attempts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    attempts = await Promise.all(attempts.map(populateAttempt));

    const transformedAttempts = attempts.map(attempt => {
        const questions = attempt.quiz?.questions || [];
        const totalQuestions = questions.length;
        const totalMarks = questions.reduce((sum, question) => sum + (question.marks || 1), 0) || totalQuestions;
        const scorePercent = totalMarks > 0 ? Math.round((attempt.score / totalMarks) * 100) : 0;
        const passingScore = attempt.quiz?.passingScore || 70;
        const passed = scorePercent >= passingScore;

        return {
            ...attempt, // Plain object
            scorePercent,
            passed,
            totalQuestions,
            totalMarks,
            attemptedAt: attempt.createdAt
        };
    });

    res.json(new ApiResponse(200, transformedAttempts, "Student attempts fetched successfully"));
});

// New endpoint to start a quiz
export const startQuiz = asyncHandler(async (req, res) => {
    const { quizId } = req.params;
    const userId = req.user.id;

    let resolvedQuizId = quizId;
    let quiz = await Quiz.findById(quizId);
    if (!quiz) {
        quiz = await Quiz.findOne({ slug: String(quizId).toLowerCase() });
        if (!quiz) throw new ApiError("Invalid quiz ID", 400);
        resolvedQuizId = quiz.id;
    }

    // Populate needed
    if (quiz.course) quiz.course = await Course.findById(quiz.course);
    if (quiz.module) quiz.module = await Module.findById(quiz.module);

    const isCustomAdminOrTrainer = req.user?.role === 'CUSTOM' &&
        ['admin', 'superadmin', 'trainer', 'instructor'].includes(
            String(req.user?.customRole?.targetLayout || '').toLowerCase()
        );
    const isAdminOrTrainer = req.user && (
        req.user.role === 'ADMIN' ||
        req.user.role === 'SUPERADMIN' ||
        req.user.role === 'INSTRUCTOR' ||
        req.user.role === 'TRAINER' ||
        isCustomAdminOrTrainer
    );

    const isTemporaryCandidate = req.user && req.user.isTemporary;

    if (!isAdminOrTrainer && !isTemporaryCandidate) {
        if (quiz.module && quiz.type === "MODULE" && quiz.course) {
            const accessCheck = await checkModuleAccessForAssessments(userId, quiz.course.id || quiz.course, quiz.module.id || quiz.module);
            if (!accessCheck.hasAccess) {
                throw new ApiError(accessCheck.reason || "Access denied to this quiz. Complete all lessons in the module first.", 403);
            }
        } else if (quiz.type === "COURSE" && quiz.course) {
            const [modRows] = await executeQuery("SELECT COUNT(*) as count FROM modules WHERE course = ?", [quiz.course.id || quiz.course]);
            const totalModules = modRows[0].count;

            const progress = await Progress.findOne({ student: userId, course: quiz.course.id || quiz.course });

            if (!progress) {
                throw new ApiError("No progress found. Complete all modules first.", 403);
            }

            const completedModules = progress.completedModules?.length || 0;
            if (completedModules < totalModules) {
                throw new ApiError(`Complete all ${totalModules} modules to access this course quiz. Currently completed: ${completedModules}`, 403);
            }
        }
    }

    // Dojo Target Department/Section Gating (temporary candidates only)
    if (quiz.isDojo && !isAdminOrTrainer && isTemporaryCandidate) {
        const targetCheck = checkDojoTargetAccess(quiz, req.user);
        if (!targetCheck.allowed) {
            return res.json(new ApiResponse(200, {
                canAttempt: false,
                reason: targetCheck.reason,
                quiz: {
                    _id: quiz.id,
                    title: quiz.title,
                    course: quiz.course,
                    module: quiz.module,
                    level: quiz.level
                }
            }, "Dojo quiz target department/section restricted"));
        }
    }

    // OJT Gating for non-Dojo Quizzes (isDojo === false or not set)
    if (!quiz.isDojo && !isAdminOrTrainer && isTemporaryCandidate) {
        let isOjtApproved = false;
        try {
            const [userRows] = await executeQuery("SELECT ojt FROM users WHERE id = ?", [userId]);
            if (userRows.length > 0) {
                try {
                    const ojtList = JSON.parse(userRows[0].ojt || "[]");
                    isOjtApproved = Array.isArray(ojtList) && ojtList.some(o => o.result === "Pass" || o.result === "Approved");
                } catch (e) {
                    isOjtApproved = false;
                }
            }
        } catch (dbErr) {
            console.error("[ERROR] Failed to query user ojt list:", dbErr.message);
        }

        // Hybrid fallback check on database just in case user ojt column is not synced
        if (!isOjtApproved) {
            try {
                const [fallbackRows] = await executeQuery(`
                    SELECT 1 FROM on_job_trainings
                    WHERE student = CAST(? AS NVARCHAR(50))
                      AND (result = 'Pass' OR result = 'Approved')
                `, [userId]);
                if (fallbackRows.length > 0) {
                    isOjtApproved = true;
                }
            } catch (fallbackErr) {
                console.error("[ERROR] Fallback OJT query failed:", fallbackErr.message);
            }
        }

        if (!isOjtApproved) {
            return res.json(new ApiResponse(200, {
                canAttempt: false,
                reason: "Access Denied: You must be approved in On-Job-Training (OJT) before you can attempt this assessment.",
                quiz: {
                    _id: quiz.id,
                    title: quiz.title,
                    course: quiz.course,
                    module: quiz.module,
                    level: quiz.level
                }
            }, "OJT approval required"));
        }
    }

    // OJT Gating for Multi-Skilling (daily) and Skill Upgradation (general) Quizzes (for non-admins/trainers)
    if (!!quiz.isMultiSkilling && !isAdminOrTrainer) {
        const isOjtApprovedToday = await checkOjtApprovedToday(userId);
        if (!isOjtApprovedToday) {
            return res.json(new ApiResponse(200, {
                canAttempt: false,
                reason: "Access Denied: You must be approved in On-Job-Training (OJT) today before you can attempt this assessment. Please request your trainer to create and approve a new OJT session for today.",
                quiz: {
                    _id: quiz.id,
                    title: quiz.title,
                    course: quiz.course,
                    module: quiz.module,
                    level: quiz.level
                }
            }, "OJT approval today required"));
        }
    }
    if (!!quiz.skillUpgradation && !isAdminOrTrainer) {
        const isOjtApprovedGenerally = await checkOjtApprovedGenerally(userId);
        if (!isOjtApprovedGenerally) {
            return res.json(new ApiResponse(200, {
                canAttempt: false,
                reason: "Access Denied: You must be approved in On-Job-Training (OJT) before you can attempt this assessment.",
                quiz: {
                    _id: quiz.id,
                    title: quiz.title,
                    course: quiz.course,
                    module: quiz.module,
                    level: quiz.level
                }
            }, "OJT approval required"));
        }
    }

    const previousAttempts = await AttemptedQuiz.countDocuments({
        quiz: resolvedQuizId,
        student: userId
    });

    // Extra attempts
    const [allowRows] = await executeQuery(
        "SELECT SUM(extraAttemptsGranted) as total FROM extra_attempt_allowances WHERE quiz = ? AND student = ?",
        [quiz.id, userId]
    );
    const extraAllowed = allowRows[0].total || 0;

    // attemptsAllowed: 0 means unlimited
    const baseAllowed = quiz.attemptsAllowed === 0 ? Number.MAX_SAFE_INTEGER : (quiz.attemptsAllowed || 1);
    const attemptsAllowedWithExtra = baseAllowed + Number(extraAllowed);
    const attemptsRemainingWithExtra = attemptsAllowedWithExtra - previousAttempts;

    const isUnlimited = quiz.attemptsAllowed === 0;

    if (!isAdminOrTrainer && !isUnlimited && attemptsRemainingWithExtra <= 0) {
        return res.json(new ApiResponse(200, {
            canAttempt: false,
            reason: "No attempts remaining",
            attemptsUsed: previousAttempts,
            attemptsAllowed: attemptsAllowedWithExtra,
            quiz: {
                _id: quiz.id,
                title: quiz.title,
                course: quiz.course,
                module: quiz.module,
                level: quiz.level
            }
        }, "No attempts remaining for this quiz"));
    }

    // Fetch sub-section names for the quiz
    let subSectionNames = [];
    if (quiz.subSectionId && quiz.subSectionId.length > 0) {
        const validIds = quiz.subSectionId.filter(id => !isNaN(id) && id !== null && id !== '');
        if (validIds.length > 0) {
            const placeholders = validIds.map(() => "?").join(",");
            const [ssRows] = await executeQuery(`SELECT name FROM [sub_sections] WHERE id IN (${placeholders})`, validIds);
            subSectionNames = ssRows.map(r => r.name);
        }
    }

    const quizForTaking = {
        _id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        course: quiz.course,
        module: quiz.module,
        timeLimit: quiz.timeLimit,
        passingScore: quiz.passingScore,
        subSectionNames: subSectionNames,
        level: quiz.level,
        isDojo: quiz.isDojo,
        isHandover: quiz.isHandover,
        isTheoretical: quiz.isTheoretical,
        isMultiSkilling: !!quiz.isMultiSkilling,
        skillUpgradation: !!quiz.skillUpgradation,
        targetDeptId: quiz.targetDeptId,
        targetSectionId: quiz.targetSectionId,
        conductedBy: quiz.conductedBy || "Education Cell",
        paperTitle: quiz.paperTitle || null,
        paperSubTitle: quiz.paperSubTitle || null,
        attemptsAllowed: isUnlimited ? 0 : attemptsAllowedWithExtra,
        attemptsUsed: previousAttempts,
        attemptsRemaining: isUnlimited ? null : attemptsRemainingWithExtra,
        questions: (quiz.questions || []).map((q, index) => ({
            questionNumber: index + 1,
            questionText: q.questionText,
            questionTextSec: q.questionTextSec || "",
            type: q.type || "mcq",
            image: q.image,
            options: (q.options || []).map(opt => ({ 
                text: opt.text, 
                textSec: opt.textSec || "",
                image: opt.image 
            })),
            pairs: (q.pairs || []).map(p => ({
                leftText: p.leftText,
                leftTextSec: p.leftTextSec || "",
                leftImage: p.leftImage,
                rightText: p.rightText,
                rightTextSec: p.rightTextSec || "",
                rightImage: p.rightImage
            })),
            marks: q.marks,
            correctAnswerSec: q.correctAnswerSec || ""
        }))
    };

    logAudit(req.user.id, "START_QUIZ_ATTEMPT", {
        title: quiz.title,
        isDojo: !!quiz.isDojo,
        attemptNumber: previousAttempts + 1,
    }, { resourceType: "Quiz", resourceId: quiz.id, req }).catch(err =>
        console.error("logAudit(START_QUIZ_ATTEMPT) failed:", err.message)
    );

    res.json(new ApiResponse(200, {
        canAttempt: true,
        quiz: quizForTaking
    }, "Quiz ready to start"));
});

export const submitQuiz = asyncHandler(async (req, res) => {
    const { quizId, answers, timeTaken, studentId, candidateName, eCode, conductedBy } = req.body;
    let userId = req.user.id;

    const isCustomAdminOrTrainer = req.user?.role === 'CUSTOM' &&
        ['admin', 'superadmin', 'trainer', 'instructor'].includes(
            String(req.user?.customRole?.targetLayout || '').toLowerCase()
        );
    const isAdminOrTrainer = req.user && (
        req.user.role === 'ADMIN' ||
        req.user.role === 'SUPERADMIN' ||
        req.user.role === 'INSTRUCTOR' ||
        req.user.role === 'TRAINER' ||
        isCustomAdminOrTrainer
    );

    // Handle student mapping/creation when custom candidateName & eCode are passed
    if (candidateName && candidateName.trim()) {
        const trimmedName = candidateName.trim();
        const trimmedECode = (eCode || "").trim();

        // 1. Try to find if user with this empId / eCode already exists in the database
        let existingUser = null;
        if (trimmedECode) {
            const [rows] = await executeQuery("SELECT id FROM users WHERE empId = ? OR userName = ?", [trimmedECode, trimmedECode.toLowerCase()]);
            if (rows.length > 0) {
                existingUser = rows[0];
            }
        } else {
            // Fallback: look up by name
            const [rows] = await executeQuery("SELECT id FROM users WHERE fullName = ? AND role = 'STUDENT'", [trimmedName]);
            if (rows.length > 0) {
                existingUser = rows[0];
            }
        }

        if (existingUser) {
            userId = existingUser.id;
        } else {
            // 2. Automatically create a student user dynamically on the backend (system level, no front-end check needed)
            const generatedUsername = trimmedECode 
                ? trimmedECode.toLowerCase() 
                : trimmedName.toLowerCase().replace(/\s+/g, "_") + "_" + Math.floor(Math.random() * 1000);
            
            const empIdValue = trimmedECode || generatedUsername.toUpperCase();
            const bcrypt = (await import("bcryptjs")).default;
            const hashedPassword = await bcrypt.hash("fme@" + (trimmedECode || "123"), 10);
            const slug = generatedUsername.replace(/ /g, '-');

            const [currentUserRows] = await executeQuery(
                "SELECT unit, departmentId, department, sectionId, lineId, subSectionId, stationId FROM users WHERE id = ?",
                [req.user.id]
            );
            const parentUnit = currentUserRows[0]?.unit || "FME";
            const parentDeptId = currentUserRows[0]?.departmentId || null;
            const parentDeptName = currentUserRows[0]?.department || null;
            const parentSectionId = currentUserRows[0]?.sectionId || null;
            const parentLineId = currentUserRows[0]?.lineId || null;
            const parentSubSectionId = currentUserRows[0]?.subSectionId || null;
            const parentStationId = currentUserRows[0]?.stationId || null;

            const fields = [
                "fullName", "userName", "slug", "email", "role", "password", "unit", "status",
                "empId", "isEmployee", "isAdmin", "isTrainer", "currentLevel", "isTemporary",
                "departmentId", "department", "sectionId", "lineId", "subSectionId", "stationId",
                "createdAt", "updatedAt"
            ];

            const values = [
                trimmedName,
                generatedUsername,
                slug,
                generatedUsername + "@fme-minda.co.in",
                "STUDENT",
                hashedPassword,
                parentUnit,
                "ACTIVE",
                empIdValue,
                1, // isEmployee
                0, // isAdmin
                0, // isTrainer
                "L1",
                0, // isTemporary
                parentDeptId,
                parentDeptName,
                parentSectionId,
                parentLineId,
                parentSubSectionId,
                parentStationId,
                new Date(),
                new Date()
            ];

            const placeholders = fields.map(() => "?").join(",");
            const [result] = await executeQuery(`INSERT INTO users (${fields.join(",")}) OUTPUT INSERTED.id VALUES (${placeholders})`, values);
            
            if (result && result.length > 0) {
                userId = result[0].id;
                console.log(`[DEBUG] Automatically created student ${trimmedName} with E.code ${empIdValue} and ID ${userId} on submit.`);
                
                // Trigger Hierarchy Sync for the new user's location
                if (parentSubSectionId || parentLineId) {
                    try {
                        const SubSection = (await import("../models/subSection.model.js")).default;
                        const Line = (await import("../models/line.model.js")).default;
                        if (parentSubSectionId) {
                            await SubSection.syncUserList(parentSubSectionId);
                        } else if (parentLineId) {
                            await Line.syncUserList(parentLineId);
                        }
                    } catch (syncErr) {
                        console.error("Failed to sync hierarchy on auto-create:", syncErr.message);
                    }
                }
            } else {
                throw new ApiError("Failed to auto-create student user during submission", 500);
            }
        }
    } else if (isAdminOrTrainer && studentId) {
        userId = studentId;
    }

    // Fetch resolved candidate details to include in response
    const [candidateRows] = await executeQuery(
        "SELECT id, fullName, empId, userName, isTemporary, targetDeptId, targetSectionId FROM users WHERE id = ?",
        [userId]
    );
    const attemptedByUser = candidateRows[0] || null;

    if (!quizId) throw new ApiError("Quiz ID is required", 400);

    let resolvedQuizId = quizId;
    let quiz = await Quiz.findById(quizId);
    if (!quiz) {
        quiz = await Quiz.findOne({ slug: String(quizId).toLowerCase() });
        if (!quiz) throw new ApiError("Invalid quiz ID format", 400);
        resolvedQuizId = quiz.id;
    }

    // Populate needed
    if (quiz.course) quiz.course = await Course.findById(quiz.course);
    if (quiz.module) quiz.module = await Module.findById(quiz.module);

    // Dojo Target Department/Section Gating — checked against the resolved candidate
    // (attemptedByUser), never req.user, since trainers frequently submit on behalf of someone else.
    const dojoTargetCheck = checkDojoTargetAccess(quiz, attemptedByUser);
    if (!dojoTargetCheck.allowed) {
        throw new ApiError(dojoTargetCheck.reason, 403);
    }

    // OJT Gating for Multi-Skilling (daily) and Skill Upgradation (general) Quizzes on submit
    if (!!quiz.isMultiSkilling) {
        const isOjtApprovedToday = await checkOjtApprovedToday(userId);
        if (!isOjtApprovedToday) {
            throw new ApiError("Access Denied: The candidate must be approved in On-Job-Training (OJT) today before attempting or submitting this assessment.", 403);
        }
    }
    if (!!quiz.skillUpgradation) {
        const isOjtApprovedGenerally = await checkOjtApprovedGenerally(userId);
        if (!isOjtApprovedGenerally) {
            throw new ApiError("Access Denied: The candidate must be approved in On-Job-Training (OJT) before attempting or submitting this assessment.", 403);
        }
    }

    if (!answers || !Array.isArray(answers)) {
        throw new ApiError("Answers must be provided as an array", 400);
    }

    const questions = quiz.questions || [];
    if (questions.length === 0) {
        throw new ApiError("Quiz has no questions", 400);
    }

    if (answers.length !== questions.length) {
        throw new ApiError(`Expected ${questions.length} answers, but received ${answers.length}`, 400);
    }

    // Check attempts
    const previousAttempts = await AttemptedQuiz.countDocuments({
        quiz: resolvedQuizId,
        student: userId
    });

    const [allowRows] = await executeQuery(
        "SELECT SUM(extraAttemptsGranted) as total FROM extra_attempt_allowances WHERE quiz = ? AND student = ?",
        [quiz.id, userId]
    );
    const extraAllowed = allowRows[0].total || 0;

    const baseAllowed = quiz.attemptsAllowed === 0 ? Number.MAX_SAFE_INTEGER : (quiz.attemptsAllowed || 1);
    const attemptsAllowed = baseAllowed + Number(extraAllowed);
    const isUnlimited = quiz.attemptsAllowed === 0;



    if (!isAdminOrTrainer && !isUnlimited && previousAttempts >= attemptsAllowed) {
        throw new ApiError("No attempts remaining for this quiz", 400);
    }

    let score = 0;
    let totalMarks = 0;
    const detailedAnswers = [];

    questions.forEach((question, index) => {
        const userAnswer = answers[index];
        let isCorrect = false;
        let correctAnswerText = "";

        const qType = question.type || "mcq";

        let correctAnswerSecText = "";

        if (qType === "shortAnswer") {
            correctAnswerText = question.correctAnswer || "";
            correctAnswerSecText = question.correctAnswerSec || "";
            isCorrect = userAnswer && typeof userAnswer.text === 'string' &&
                userAnswer.text.trim().toLowerCase() === correctAnswerText.trim().toLowerCase();
        } else if (qType === "matching") {
            const pairs = question.pairs || [];
            correctAnswerText = pairs.map(p => `${p.leftText} -> ${p.rightText}`).join(", ");
            correctAnswerSecText = pairs.map(p => {
                const left = p.leftTextSec ? `${p.leftText} (${p.leftTextSec})` : p.leftText;
                const right = p.rightTextSec ? `${p.rightText} (${p.rightTextSec})` : p.rightText;
                return `${left} -> ${right}`;
            }).join(", ");
            
            if (userAnswer && userAnswer.matches && typeof userAnswer.matches === 'object') {
                isCorrect = true;
                for (const p of pairs) {
                    const matchedRight = userAnswer.matches[p.leftText];
                    if (!matchedRight || String(matchedRight).trim().toLowerCase() !== String(p.rightText).trim().toLowerCase()) {
                        isCorrect = false;
                        break;
                    }
                }
            } else {
                isCorrect = false;
            }
        } else {
            // MCQ (default)
            const correctOption = (question.options || []).find(opt => opt && opt.isCorrect === true);
            correctAnswerText = correctOption ? correctOption.text : "";
            correctAnswerSecText = correctOption && correctOption.textSec ? correctOption.textSec : "";
            isCorrect = userAnswer && correctOption &&
                typeof userAnswer.text === 'string' &&
                userAnswer.text === correctOption.text;
        }

        totalMarks += (question.marks || 1);
        if (isCorrect) {
            score += (question.marks || 1);
        }

        detailedAnswers.push({
            questionNumber: index + 1,
            questionText: question.questionText || `Question ${index + 1}`,
            questionTextSec: question.questionTextSec || "",
            userAnswer: userAnswer && userAnswer.text ? userAnswer.text : null,
            correctAnswer: correctAnswerText,
            correctAnswerSec: correctAnswerSecText,
            isCorrect,
            marksObtained: isCorrect ? (question.marks || 1) : 0,
            totalMarks: (question.marks || 1)
        });
    });

    const scorePercent = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const passed = scorePercent >= (quiz.passingScore || 70);

    // Snapshot student identity + status/hierarchy so the attempt survives future promotion,
    // deletion, or re-import. Always resolved from the actual candidate (userId), since an
    // admin/trainer submitting on the candidate's behalf must not stamp their own data here.
    const studentSnapshot = await resolveStudentSnapshot(userId);

    const attemptData = {
        quiz: resolvedQuizId,
        student: userId,
        ...studentSnapshot,
        answer: answers.map((ans, idx) => {
            const question = questions[idx];
            const detailedAnswer = detailedAnswers[idx];
            return {
                questionId: question._id || question.id,
                selectedOptions: [ans && ans.text ? String(ans.text) : ""],
                isCorrect: detailedAnswer.isCorrect || false,
                marksObtained: detailedAnswer.marksObtained || 0
            };
        }),
        score: score || 0,
        status: passed ? "PASSED" : "FAILED",
        completedAt: new Date(),
        attemptNumber: previousAttempts + 1,
        timeTaken: timeTaken || 0,
        conductedBy: conductedBy !== undefined && conductedBy !== null ? conductedBy : ""
    };

    let attempt;
    try {
        attempt = await AttemptedQuiz.create(attemptData);
    } catch (err) {
        // MSSQL 2601/2627: unique index/constraint violation. Concurrent double-submits can both
        // pass the previousAttempts count check before either insert lands, so on that race,
        // return the attempt the other request already created instead of failing the submission.
        const isDuplicateKey = err && (err.number === 2601 || err.number === 2627 ||
            (typeof err.message === "string" && err.message.includes("idx_unique_attempt")));
        if (!isDuplicateKey) throw err;

        console.warn(`[WARN] Duplicate attempt detected for quiz ${resolvedQuizId}, student ${userId}, attempt ${attemptData.attemptNumber}. Resolving gracefully.`);
        attempt = await AttemptedQuiz.findOne({
            quiz: resolvedQuizId,
            student: userId,
            attemptNumber: attemptData.attemptNumber
        });
        if (!attempt) throw err;
    }

    logAudit(req.user.id, "SUBMIT_QUIZ_ATTEMPT", {
        quizId: quiz.id,
        quizTitle: quiz.title,
        attemptedByName: studentSnapshot.studentName,
        attemptedByEmpId: studentSnapshot.studentEmpId,
        scorePercent,
        passed,
        timeTaken: timeTaken || 0,
    }, { resourceType: "QuizAttempt", resourceId: attempt.id, req }).catch(err =>
        console.error("logAudit(SUBMIT_QUIZ_ATTEMPT) failed:", err.message)
    );

    let nextModuleUnlocked = false;
    let levelUpgraded = false;
    let newLevel = null;

    if (passed && quiz.module && quiz.course) {
        // Logic to unlock
        const progress = await Progress.findOne({ student: userId, course: quiz.course.id });
        if (progress) {
            // Find modules in order
            const [allModules] = await executeQuery("SELECT * FROM modules WHERE course = ? ORDER BY `order` ASC", [quiz.course.id]);

            const currentModuleIndex = allModules.findIndex(m => String(m.id) === String(quiz.module.id));

            if (currentModuleIndex >= 0 && currentModuleIndex < allModules.length - 1) {
                const nextModule = allModules[currentModuleIndex + 1];
                if (nextModule) {
                    const nextModId = String(nextModule.id);
                    const isNextCompleted = (progress.completedModules || []).some(m => String(m.moduleId || m) === nextModId);

                    if (!isNextCompleted) {
                        const curModId = String(quiz.module.id);
                        const isCurCompleted = (progress.completedModules || []).some(m => String(m.moduleId || m) === curModId);

                        if (!isCurCompleted) {
                            if (!progress.completedModules) progress.completedModules = [];
                            progress.completedModules.push({
                                moduleId: quiz.module.id,
                                completedAt: new Date()
                            });
                            await progress.save();
                        }
                        nextModuleUnlocked = true;
                    }
                }
            }
        }
    }


    const attemptsUsed = previousAttempts + 1;
    const attemptsRemaining = isUnlimited ? null : (attemptsAllowed - attemptsUsed);

    res.json(new ApiResponse(200, {
        attemptId: attempt.id,
        attemptedBy: attemptedByUser ? {
            id: attemptedByUser.id,
            fullName: attemptedByUser.fullName,
            userName: (attemptedByUser.userName || "").toUpperCase(),
            empId: (attemptedByUser.isTemporary ? attemptedByUser.userName : attemptedByUser.empId) || ""
        } : null,
        quiz: {
            _id: quiz.id,
            title: quiz.title,
            module: quiz.module,
            course: quiz.course,
            passingScore: quiz.passingScore
        },
        score,
        totalMarks,
        scorePercent,
        passed,
        attemptsUsed,
        attemptsAllowed: isUnlimited ? 0 : attemptsAllowed,
        attemptsRemaining,
        canRetry: isUnlimited ? true : (attemptsRemaining > 0),
        timeTaken: timeTaken || 0,
        detailedAnswers,
        nextModuleUnlocked,
        levelUpgraded,
        newLevel
    }, "Quiz submitted successfully"));
});

export const getQuizAttemptStatus = asyncHandler(async (req, res) => {
    const { quizId } = req.params;
    const userId = req.user.id;

    // Validate quiz
    let quiz = await Quiz.findById(quizId);
    if (!quiz) {
        quiz = await Quiz.findOne({ slug: String(quizId).toLowerCase() });
        if (!quiz) throw new ApiError("Quiz not found", 404);
    }

    const attemptsUsed = await AttemptedQuiz.countDocuments({
        quiz: quiz.id,
        student: userId
    });

    // Valid logic for allowed
    const [allowRows] = await executeQuery(
        "SELECT SUM(extraAttemptsGranted) as total FROM extra_attempt_allowances WHERE quiz = ? AND student = ?",
        [quiz.id, userId]
    );
    const extraAllowed = Number(allowRows[0].total || 0);
    const baseAllowed = quiz.attemptsAllowed === 0 ? Number.MAX_SAFE_INTEGER : (quiz.attemptsAllowed || 1);
    const attemptsAllowed = baseAllowed + extraAllowed;
    const isUnlimited = quiz.attemptsAllowed === 0;

    // Check existing best score?
    const [bestRows] = await executeQuery(
        "SELECT MAX(score) as maxScore FROM attempted_quizzes WHERE quiz = ? AND student = ?",
        [quiz.id, userId]
    );
    const bestScore = bestRows[0].maxScore || 0;

    // Check if passed any
    const [passRows] = await executeQuery(
        "SELECT COUNT(*) as passedCount FROM attempted_quizzes WHERE quiz = ? AND student = ? AND status = 'PASSED'",
        [quiz.id, userId]
    );
    const hasPassed = passRows[0].passedCount > 0;

    res.json(new ApiResponse(200, {
        attemptsUsed,
        attemptsAllowed: isUnlimited ? 'Unlimited' : attemptsAllowed,
        attemptsRemaining: isUnlimited ? 'Unlimited' : (attemptsAllowed - attemptsUsed),
        bestScore,
        hasPassed,
        canAttempt: isUnlimited ? true : (attemptsUsed < attemptsAllowed)
    }, "Quiz status fetched"));
});

// --- Extra Attempt Requests ---

export const requestExtraAttempt = asyncHandler(async (req, res) => {
    const { quizId, reason } = req.body;
    const userId = req.user.id;

    let quiz = await Quiz.findById(quizId);
    if (!quiz) throw new ApiError("Quiz not found", 404);

    // Check if existing pending request
    const existing = await AttemptExtensionRequest.findOne({
        student: userId,
        quiz: quiz.id,
        status: 'PENDING'
    });

    if (existing) {
        throw new ApiError("You already have a pending request for this quiz", 400);
    }

    const request = await AttemptExtensionRequest.create({
        student: userId,
        quiz: quiz.id,
        reason,
        status: 'PENDING',
        requestedAt: new Date()
    });

    res.status(201).json(new ApiResponse(201, request, "Extra attempt requested successfully"));
});

export const listExtraAttemptRequests = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    let requests = await AttemptExtensionRequest.find(query);

    // Manual populate
    // Get unique IDs for fetching details
    const userIds = [...new Set(requests.map(r => r.student))];
    const quizIds = [...new Set(requests.map(r => r.quiz))];

    let userMap = new Map();
    if (userIds.length > 0) {
        const [users] = await executeQuery("SELECT id, fullName, email FROM users WHERE id IN (?)", [userIds]);
        users.forEach(u => userMap.set(String(u.id), u));
    }

    let quizMap = new Map();
    if (quizIds.length > 0) {
        const [quizzes] = await executeQuery("SELECT id, title, course, module FROM quizzes WHERE id IN (?)", [quizIds]);
        // Need to populate course/module for display? Maybe simple title enough
        quizzes.forEach(q => quizMap.set(String(q.id), q));
    }

    const populated = requests.map(r => {
        const u = userMap.get(String(r.student));
        const q = quizMap.get(String(r.quiz));
        return {
            ...r, // it's already object from SQL model wrapper usually
            student: u ? { _id: u.id, fullName: u.fullName, email: u.email } : null,
            quiz: q ? { _id: q.id, title: q.title } : null
        };
    });

    res.json(new ApiResponse(200, populated, "Requests fetched"));
});

export const approveExtraAttempt = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const request = await AttemptExtensionRequest.findById(id);
    if (!request) throw new ApiError("Request not found", 404);

    if (request.status !== 'PENDING') {
        throw new ApiError(`Request is already ${request.status}`, 400);
    }

    const requestObj = request; // wrapper

    // Update status
    requestObj.status = 'APPROVED';
    requestObj.reviewedBy = req.user.id;
    requestObj.reviewedAt = new Date();
    await requestObj.save();

    // Grant allowance
    // Use ExtraAttemptAllowance model or direct inserts logic
    // We moved ExtraAttemptAllowance to SQL? Yes.

    await ExtraAttemptAllowance.create({
        student: requestObj.student,
        quiz: requestObj.quiz,
        grantedBy: req.user.id,
        extraAttemptsGranted: 1, // Default 1
        reason: "Request Approved: " + (requestObj.reason || "")
    });

    res.json(new ApiResponse(200, requestObj, "Request approved and attempt granted"));
});

export const rejectExtraAttempt = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const request = await AttemptExtensionRequest.findById(id);
    if (!request) throw new ApiError("Request not found", 404);

    if (request.status !== 'PENDING') {
        throw new ApiError(`Request is already ${request.status}`, 400);
    }

    const requestObj = request;
    requestObj.status = 'REJECTED';
    requestObj.reviewedBy = req.user.id;
    requestObj.reviewedAt = new Date();
    if (rejectionReason) requestObj.rejectionReason = rejectionReason;

    await requestObj.save();

    res.json(new ApiResponse(200, requestObj, "Request rejected"));
});

export const getMonitoringAttempts = asyncHandler(async (req, res) => {
    const { departmentId, sectionId, lineId, subSectionId, level, testType, search, isTemporary, quizDepartmentId, page, limit } = req.query;
    const isTemporaryQuery = isTemporary === 'true' || isTemporary === '1' || isTemporary === true;
    const isPaginated = page !== undefined && limit !== undefined;

    const selectFields = `
        SELECT
            aq.id as id,
            aq.quiz as quizId,
            aq.student as studentId,
            aq.score as score,
            aq.status as status,
            aq.startedAt as startedAt,
            aq.completedAt as completedAt,
            aq.timeTaken as timeTaken,
            aq.createdAt as createdAt,

            q.title as quizTitle,
            q.type as quizType,
            q.level as quizLevel,
            q.isDojo as quizIsDojo,
            q.isHandover as quizIsHandover,
            q.isTheoretical as quizIsTheoretical,
            q.questions as quizQuestions,
            q.passingScore as quizPassingScore,

            COALESCE(u.fullName, aq.studentName, 'Unknown') as studentName,
            COALESCE(u.empId, aq.studentEmpId, '') as studentECode,
            COALESCE(u.userName, aq.studentEmpId, '') as studentUserName,
            u.email as studentEmail,
            u.role as studentRole,
            CASE WHEN aq.studentIsTemporary = 1 OR u.isTemporary = 1 THEN 1 ELSE 0 END as studentIsTemporary,
            u.currentLevel as studentLevel,
            u_hier_resolved.resolvedDeptId as studentDepartmentId,
            u.department as studentDepartmentName,
            u_hier_resolved.resolvedSectionId as studentSectionId,
            u_hier_resolved.resolvedLineId as studentLineId,
            u_hier_resolved.resolvedSubSectionId as studentSubSectionId,

            dept.name as deptName,
            sec.name as secName,
            lin.name as lineName,
            sub.name as subSecName
    `;

    const fromJoinClause = `
        FROM attempted_quizzes aq
        LEFT JOIN quizzes q ON CAST(q.id AS NVARCHAR(255)) = aq.quiz
        OUTER APPLY (
            SELECT TOP 1 u2.*
            FROM users u2
            WHERE CAST(u2.id AS NVARCHAR(255)) = aq.student
               OR (aq.studentEmpId IS NOT NULL AND u2.empId = aq.studentEmpId)
            ORDER BY CASE WHEN CAST(u2.id AS NVARCHAR(255)) = aq.student THEN 0 ELSE 1 END
        ) u
        OUTER APPLY (
            SELECT TOP 1
                COALESCE(u_hier_raw.ssId, ss_res.id) as resolvedSubSectionId,
                COALESCE(u_hier_raw.lId, lin.id) as resolvedLineId,
                COALESCE(u_hier_raw.sId, sec.id) as resolvedSectionId,
                COALESCE(u_hier_raw.dId, dept.id) as resolvedDeptId
            FROM (
                SELECT
                    COALESCE(u.subSectionId, (CASE WHEN u.isTemporary = 1 THEN u.targetSubSectionId ELSE NULL END), aq.studentSubSectionId) as ssId,
                    COALESCE(u.lineId, (CASE WHEN u.isTemporary = 1 THEN u.targetLineId ELSE NULL END), aq.studentLineId) as lId,
                    COALESCE(u.sectionId, (CASE WHEN u.isTemporary = 1 THEN u.targetSectionId ELSE NULL END), aq.studentSectionId) as sId,
                    COALESCE(u.departmentId, (CASE WHEN u.isTemporary = 1 THEN u.targetDeptId ELSE NULL END), aq.studentDeptId) as dId
            ) u_hier_raw
            OUTER APPLY (
                SELECT TOP 1 ss.id, ss.lineId as ssLineId 
                FROM sub_sections ss WHERE ss.id = u_hier_raw.ssId
            ) ss_res
            OUTER APPLY (
                SELECT TOP 1 l.id, l.sectionId as lSectionId, l.department as lDeptId
                FROM [lines] l WHERE l.id = COALESCE(u_hier_raw.lId, ss_res.ssLineId)
            ) lin
            OUTER APPLY (
                SELECT TOP 1 s.id, s.departmentId as sDeptId
                FROM [sections] s WHERE s.id = COALESCE(u_hier_raw.sId, lin.lSectionId)
            ) sec
            OUTER APPLY (
                SELECT TOP 1 d.id
                FROM departments d 
                WHERE d.id = COALESCE(u_hier_raw.dId, sec.sDeptId, lin.lDeptId)
            ) dept
        ) u_hier_resolved
        LEFT JOIN departments dept ON dept.id = u_hier_resolved.resolvedDeptId
        LEFT JOIN [sections] sec ON sec.id = u_hier_resolved.resolvedSectionId
        LEFT JOIN [lines] lin ON lin.id = u_hier_resolved.resolvedLineId
        LEFT JOIN sub_sections sub ON sub.id = u_hier_resolved.resolvedSubSectionId
    `;

    let whereClause = " WHERE 1=1";
    const values = [];

    // Restrict department/section scope for CUSTOM role users to their assigned hierarchy
    const isSuperAdminOrAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'ADMIN' || req.user?.isAdmin;
    let allowedDepts = [];
    let allowedSections = [];
    if (req.user && req.user.role === 'CUSTOM' && !isSuperAdminOrAdmin && !isTemporaryQuery) {
        if (req.user.departmentId) allowedDepts.push(String(req.user.departmentId));
        try {
            const parsedDepts = typeof req.user.departments === 'string' ? JSON.parse(req.user.departments) : (req.user.departments || []);
            if (Array.isArray(parsedDepts)) parsedDepts.forEach(d => {
                const id = (d && typeof d === 'object') ? String(d.id || d._id || '') : String(d);
                if (id) allowedDepts.push(id);
            });
        } catch (e) { /* ignore parse errors */ }
        allowedDepts = [...new Set(allowedDepts)].filter(Boolean);

        if (req.user.sectionId) allowedSections.push(String(req.user.sectionId));
        try {
            const parsedSections = typeof req.user.sections === 'string' ? JSON.parse(req.user.sections) : (req.user.sections || []);
            if (Array.isArray(parsedSections)) parsedSections.forEach(s => {
                const id = (s && typeof s === 'object') ? String(s.id || s._id || '') : String(s);
                if (id) allowedSections.push(id);
            });
        } catch (e) { /* ignore parse errors */ }
        allowedSections = [...new Set(allowedSections)].filter(Boolean);
    }

    if (departmentId) {
        if (allowedDepts.length > 0 && !allowedDepts.includes(String(departmentId))) {
            whereClause += " AND 1 = 0";
        } else {
            whereClause += " AND u_hier_resolved.resolvedDeptId = ?";
            values.push(parseInt(departmentId));
        }
    } else if (allowedDepts.length > 0) {
        whereClause += ` AND u_hier_resolved.resolvedDeptId IN (${allowedDepts.map(() => '?').join(',')})`;
        values.push(...allowedDepts);
    }

    if (quizDepartmentId && quizDepartmentId !== 'all') {
        whereClause += ` AND (
            q.departmentId LIKE ? 
            OR EXISTS (SELECT 1 FROM OPENJSON(q.departmentId) WHERE value = ?)
        )`;
        values.push(`%"${quizDepartmentId}"%`);
        values.push(String(quizDepartmentId));
    }

    if (sectionId) {
        if (allowedSections.length > 0 && !allowedSections.includes(String(sectionId))) {
            whereClause += " AND 1 = 0";
        } else {
            whereClause += " AND u_hier_resolved.resolvedSectionId = ?";
            values.push(parseInt(sectionId));
        }
    } else if (allowedSections.length > 0) {
        whereClause += ` AND u_hier_resolved.resolvedSectionId IN (${allowedSections.map(() => '?').join(',')})`;
        values.push(...allowedSections);
    }

    if (lineId) {
        whereClause += " AND u_hier_resolved.resolvedLineId = ?";
        values.push(parseInt(lineId));
    }
    if (subSectionId) {
        whereClause += " AND u_hier_resolved.resolvedSubSectionId = ?";
        values.push(parseInt(subSectionId));
    }
    if (level) {
        whereClause += " AND q.level = ?";
        values.push(level);
    }
    
    if (testType) {
        if (testType === "DOJO") {
            whereClause += " AND q.isDojo = 1";
        } else if (testType === "HANDOVER") {
            whereClause += " AND q.isHandover = 1";
        } else if (testType === "THEORETICAL") {
            whereClause += " AND q.isTheoretical = 1";
        } else if (testType === "REGULAR") {
            whereClause += " AND q.isDojo = 0 AND q.isHandover = 0 AND q.isTheoretical = 0";
        }
    }

    if (isTemporaryQuery) {
        whereClause += " AND (aq.studentIsTemporary = 1 OR u.isTemporary = 1)";
    }

    if (search) {
        const searchQuery = `%${search}%`;
        whereClause += " AND (COALESCE(u.fullName, aq.studentName, '') LIKE ? OR COALESCE(u.empId, aq.studentEmpId, '') LIKE ? OR q.title LIKE ?)";
        values.push(searchQuery, searchQuery, searchQuery);
    }

    let sql = selectFields + fromJoinClause + whereClause + " ORDER BY aq.createdAt DESC";
    const queryValues = [...values];

    let total = 0;
    let pageNum = 1;
    let limitNum = 0;
    if (isPaginated) {
        pageNum = Math.max(1, parseInt(page) || 1);
        limitNum = Math.max(1, parseInt(limit) || 25);
        const offset = (pageNum - 1) * limitNum;

        const countSql = `SELECT COUNT(*) as total ${fromJoinClause} ${whereClause}`;
        const [countRows] = await executeQuery(countSql, values);
        total = countRows[0]?.total || 0;

        sql += " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
        queryValues.push(offset, limitNum);
    }

    const [rows] = await executeQuery(sql, queryValues);

    const attempts = rows.map(row => {
        let quizQuestionsParsed = [];
        try {
            quizQuestionsParsed = typeof row.quizQuestions === "string" ? JSON.parse(row.quizQuestions) : (row.quizQuestions || []);
        } catch (e) {
            quizQuestionsParsed = [];
        }
        
        const totalMarks = quizQuestionsParsed.reduce((sum, q) => sum + (q.marks || 1), 0) || 0;

        return {
            _id: row.id,
            id: row.id,
            score: row.score,
            status: row.status,
            startedAt: row.startedAt,
            completedAt: row.completedAt,
            createdAt: row.createdAt,
            timeTaken: row.timeTaken,
            quiz: {
                _id: row.quizId,
                id: row.quizId,
                title: row.quizTitle,
                type: row.quizType,
                level: row.quizLevel,
                isDojo: !!row.quizIsDojo,
                isHandover: !!row.quizIsHandover,
                isTheoretical: !!row.quizIsTheoretical,
                passingScore: row.quizPassingScore,
                questions: quizQuestionsParsed
            },
            student: {
                _id: row.studentId,
                id: row.studentId,
                fullName: row.studentName,
                empId: row.studentECode,
                userName: row.studentUserName,
                email: row.studentEmail,
                role: row.studentRole,
                isTemporary: !!row.studentIsTemporary,
                currentLevel: row.studentLevel,
                departmentId: row.studentDepartmentId,
                departmentName: row.deptName || row.studentDepartmentName,
                sectionId: row.studentSectionId,
                sectionName: row.secName,
                lineId: row.studentLineId,
                lineName: row.lineName,
                subSectionId: row.studentSubSectionId,
                subSectionName: row.subSecName
            },
            totalScore: totalMarks
        };
    });

    if (isPaginated) {
        res.json(new ApiResponse(200, {
            attempts,
            totalPages: Math.max(1, Math.ceil(total / limitNum)),
            currentPage: pageNum,
            total
        }, "Monitoring attempts fetched successfully"));
    } else {
        res.json(new ApiResponse(200, attempts, "Monitoring attempts fetched successfully"));
    }
});
