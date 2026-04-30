import AttemptedQuiz from "../models/attemptedQuiz.model.js";
import Quiz from "../models/quiz.model.js";
import Progress from "../models/progress.model.js";
import Module from "../models/module.model.js";
import Course from "../models/course.model.js";
import User from "../models/auth.model.js";
import ExtraAttemptAllowance from "../models/extraAttempt.model.js";
import AttemptExtensionRequest from "../models/attemptExtensionRequest.model.js";
import CourseLevelConfig from "../models/courseLevelConfig.model.js";
import Certificate from "../models/certificate.model.js";
import CertificateTemplate from "../models/certificateTemplate.model.js";

import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { checkModuleAccessForAssessments } from "../utils/moduleCompletion.js";

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
                attempt.quiz = q;
            }
        }
    }
    if (attempt.student) {
        if (typeof attempt.student !== 'object') {
            attempt.student = await User.findById(attempt.student).then(u => u ? { id: u.id, fullName: u.fullName, email: u.email, _id: u.id } : null);
        }
    }
    return attempt;
};

export const attemptQuiz = asyncHandler(async (req, res) => {
    const { quizId, answers } = req.body;
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

    const attempt = await AttemptedQuiz.create({
        quiz: resolvedQuizId,
        student: userId,
        answer: answers.map((ans, idx) => ({
            questionId: questions[idx]._id || questions[idx].id, // Ensure we have some ID
            selectedOptions: [ans || ""],
            isCorrect: answers[idx] === questions[idx].correctOption,
            marksObtained: answers[idx] === questions[idx].correctOption ? (questions[idx].marks || 1) : 0
        })),
        score,
        status: passed ? "PASSED" : "FAILED",
        completedAt: new Date(),
        attemptNumber: 1,
        timeTaken: 0
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

// ADMIN: Update attempt answers/scores manually
export const adminUpdateAttempt = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { answersOverride, adjustmentNotes } = req.body || {};

    let attempt = await AttemptedQuiz.findById(id);
    if (!attempt) throw new ApiError("Attempt not found", 404);

    attempt = await populateAttempt(attempt); // Need quiz populated

    // Only ADMIN can edit
    if (!req.user || !req.user.role || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
        throw new ApiError("Only admin can modify attempts", 403);
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
    const newAnswers = attempt.answer.map(ans => {
        const key = String(ans.questionId);
        const override = overrideMap.get(key);
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
    if (isNaN(studentId)) { // Assuming if not number, it's a slug or username
        const handle = String(studentId).toLowerCase();
        // findOne by username or slug logic needs to be robust
        // But User model usually has findOne.
        // Assuming UserName/Slug logic is custom.
        const u = await User.findOne({ userName: handle }); // or slug if user has slug
        if (!u) {
            throw new ApiError("Invalid student ID", 400);
        }
        resolvedStudentId = u.id;
    }

    let attempts = await AttemptedQuiz.find({ student: resolvedStudentId });
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

    const isAdminOrTrainer = req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN' || req.user.role === 'INSTRUCTOR' || req.user.role === 'TRAINER');

    if (!isAdminOrTrainer) {
        if (quiz.module && quiz.type === "MODULE") {
            const accessCheck = await checkModuleAccessForAssessments(userId, quiz.course.id, quiz.module.id);
            if (!accessCheck.hasAccess) {
                throw new ApiError(accessCheck.reason || "Access denied to this quiz. Complete all lessons in the module first.", 403);
            }
        } else if (quiz.type === "COURSE") {
            const [modRows] = await executeQuery("SELECT COUNT(*) as count FROM modules WHERE course = ?", [quiz.course.id]);
            const totalModules = modRows[0].count;

            const progress = await Progress.findOne({ student: userId, course: quiz.course.id });

            if (!progress) {
                throw new ApiError("No progress found. Complete all modules first.", 403);
            }

            const completedModules = progress.completedModules?.length || 0;
            if (completedModules < totalModules) {
                throw new ApiError(`Complete all ${totalModules} modules to access this course quiz. Currently completed: ${completedModules}`, 403);
            }
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

    if (!isUnlimited && attemptsRemainingWithExtra <= 0) {
        return res.json(new ApiResponse(200, {
            canAttempt: false,
            reason: "No attempts remaining",
            attemptsUsed: previousAttempts,
            attemptsAllowed: attemptsAllowedWithExtra,
            quiz: {
                _id: quiz.id,
                title: quiz.title,
                course: quiz.course,
                module: quiz.module
            }
        }, "No attempts remaining for this quiz"));
    }

    const quizForTaking = {
        _id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        course: quiz.course,
        module: quiz.module,
        timeLimit: quiz.timeLimit,
        passingScore: quiz.passingScore,
        attemptsAllowed: isUnlimited ? 0 : attemptsAllowedWithExtra,
        attemptsUsed: previousAttempts,
        attemptsRemaining: isUnlimited ? null : attemptsRemainingWithExtra,
        questions: (quiz.questions || []).map((q, index) => ({
            questionNumber: index + 1,
            questionText: q.questionText,
            image: q.image,
            options: (q.options || []).map(opt => ({ text: opt.text })),
            marks: q.marks
        }))
    };

    res.json(new ApiResponse(200, {
        canAttempt: true,
        quiz: quizForTaking
    }, "Quiz ready to start"));
});

export const submitQuiz = asyncHandler(async (req, res) => {
    const { quizId, answers, timeTaken, studentId } = req.body;
    let userId = req.user.id;

    const isAdminOrTrainer = req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN' || req.user.role === 'INSTRUCTOR' || req.user.role === 'TRAINER');

    if (isAdminOrTrainer && studentId) {
        userId = studentId;
    }

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
        // find correct option: in JSON it's `isCorrect: true`
        const correctOption = (question.options || []).find(opt => opt && opt.isCorrect === true);

        const isCorrect = userAnswer && correctOption &&
            typeof userAnswer.text === 'string' &&
            userAnswer.text === correctOption.text;

        totalMarks += (question.marks || 1);
        if (isCorrect) {
            score += (question.marks || 1);
        }

        detailedAnswers.push({
            questionNumber: index + 1,
            questionText: question.questionText || `Question ${index + 1}`,
            userAnswer: userAnswer && userAnswer.text ? userAnswer.text : null,
            correctAnswer: correctOption ? correctOption.text : null,
            isCorrect,
            marksObtained: isCorrect ? (question.marks || 1) : 0,
            totalMarks: (question.marks || 1)
        });
    });

    const scorePercent = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const passed = scorePercent >= (quiz.passingScore || 70);

    const attemptData = {
        quiz: resolvedQuizId,
        student: userId,
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
        timeTaken: timeTaken || 0
    };

    const attempt = await AttemptedQuiz.create(attemptData);

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

    if (passed && quiz.skillUpgradation && quiz.course) {
        console.log(`[DEBUG] Skill Upgradation Quiz Passed: User=${userId}, Course=${quiz.course.id}`);
        // Logic for skill upgrade
        const progress = await Progress.findOne({ student: userId, course: quiz.course.id });
        if (progress) {
            const levelConfig = await CourseLevelConfig.getActiveConfig();
            console.log(`[DEBUG] Level Config Found: ${!!levelConfig}, Current Level: ${progress.currentLevel}`);

            if (levelConfig) {
                const nextLevel = levelConfig.getNextLevel(progress.currentLevel);
                console.log(`[DEBUG] Next Level: ${nextLevel ? nextLevel.name : 'None'}`);

                if (nextLevel && nextLevel.name !== progress.currentLevel) {

                    // Time Restriction Check
                    const currentLevelConfig = levelConfig.levels.find(l => l.name === progress.currentLevel);
                    const maxDays = currentLevelConfig?.completionTimeframe?.maxDays || 0;

                    let levelStart = progress.levelStartDate;
                    if (!levelStart) {
                        try {
                            const user = await User.findById(userId);
                            // joiningDate could be string or Date. 
                            if (progress.currentLevel === 'L1') {
                                levelStart = user.joiningDate ? new Date(user.joiningDate) : user.createdAt;
                            } else {
                                levelStart = progress.updatedAt || progress.createdAt;
                            }
                        } catch (e) {
                            levelStart = new Date();
                        }
                    }
                    levelStart = new Date(levelStart); // Ensure Date object

                    const now = new Date();
                    const diffTime = Math.abs(now - levelStart);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    console.log(`[DEBUG] Time Check: Start=${levelStart.toISOString()}, Now=${now.toISOString()}, Days=${diffDays}, MaxDays=${maxDays}`);

                    if (diffDays >= maxDays) {
                        progress.currentLevel = nextLevel.name;
                        progress.levelStartDate = new Date(); // Update Start Date for new level
                        levelUpgraded = true;
                        newLevel = nextLevel.name;
                        await progress.save();

                        // Sync to Users table
                        await executeQuery("UPDATE users SET currentLevel = ? WHERE id = ?", [newLevel, userId]);
                    } else {
                        console.log(`[DEBUG] Level Upgrade Deferred: Time requirement not met (${diffDays}/${maxDays} days)`);
                        progress.pendingLevelUpgrade = nextLevel.name;
                        await progress.save();
                    }

                    // Certificate issuance
                    if (quiz.issueCertificate) { // Check if certificate should be issued
                        const courseIdStr = String(quiz.course.id || quiz.course._id || quiz.course);
                        console.log(`[DEBUG] Attempting to issue cert for Student=${userId}, Course=${courseIdStr}, Level=${newLevel}`);

                        // Check existing
                        const [existingCerts] = await executeQuery(
                            "SELECT * FROM certificates WHERE student = ? AND course = ? AND type = 'SKILL_UPGRADATION' AND level = ?",
                            [userId, courseIdStr, newLevel]
                        );

                        console.log(`[DEBUG] Existing Certs Count: ${existingCerts.length}`);

                        if (existingCerts.length === 0) {
                            try {
                                // Template
                                let template = await CertificateTemplate.findOne({ isDefault: 1, isActive: 1 });
                                if (!template) {
                                    // Find one active
                                    const [temps] = await executeQuery("SELECT TOP 1 * FROM certificate_templates WHERE isActive = 1 ORDER BY createdAt ASC");
                                    if (temps.length > 0) template = new CertificateTemplate(temps[0]);
                                }

                                if (template) {
                                    const issueDate = new Date();
                                    const userData = await User.findById(userId);

                                    const certificateData = {
                                        studentName: userData.fullName || "Student",
                                        courseName: quiz.course.title || "Course",
                                        departmentName: "N/A",
                                        instructorName: "System",
                                        level: newLevel,
                                        issueDate: issueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                                        grade: 'PASS'
                                    };

                                    let certificateHTML = template.template;
                                    Object.keys(certificateData).forEach(key => {
                                        const placeholder = new RegExp(`{{${key}}}`, 'g');
                                        certificateHTML = certificateHTML.replace(placeholder, certificateData[key]);
                                    });

                                    const newCert = await Certificate.create({
                                        student: userId,
                                        course: courseIdStr,
                                        issuedBy: userId,
                                        grade: 'PASS',
                                        type: 'SKILL_UPGRADATION',
                                        level: newLevel,
                                        metadata: {
                                            ...certificateData,
                                            templateId: template.id,
                                            templateName: template.name,
                                            generatedHTML: certificateHTML,
                                            styles: template.styles
                                        }
                                    });
                                    console.log(`[DEBUG] Certificate Created Successfully: ID=${newCert.id}`);
                                } else {
                                    console.log(`[DEBUG] Cert Skipped: No Template`);
                                }
                            } catch (certErr) {
                                console.error(`[DEBUG] Cert Creation Failed:`, certErr);
                            }
                        } else {
                            console.log(`[DEBUG] Cert Skipped: Already Exists`);
                        }
                    } else {
                        console.log(`[DEBUG] Cert Skipped: Quiz does not issue certificates.`);
                    }
                } else {
                    console.log(`[DEBUG] Level Upgrade Skipped: Next Level Same as Current (${progress.currentLevel}) or None`);
                }
            } else {
                console.log(`[DEBUG] Level Upgrade Skipped: No Level Config`);
            }
        } else {
            console.log(`[DEBUG] Level Upgrade Skipped: No Progress`);
        }
    }

    const attemptsUsed = previousAttempts + 1;
    const attemptsRemaining = isUnlimited ? null : (attemptsAllowed - attemptsUsed);

    res.json(new ApiResponse(200, {
        attemptId: attempt.id,
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
