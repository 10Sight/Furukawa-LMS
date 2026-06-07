import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { slugify } from "../utils/slugify.js";

// Helper to safely parse JSON
const parseJSON = (data, fallback = []) => {
    if (data === null || data === undefined) return fallback;
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch (e) { return fallback; }
    }
    return data;
};

// Helper to resolve Quiz ID
const resolveQuizId = async (idOrSlug) => {
    if (!idOrSlug) return null;
    if (!isNaN(idOrSlug)) return idOrSlug;
    const [rows] = await executeQuery("SELECT id FROM quizzes WHERE slug = ?", [idOrSlug]);
    return rows.length > 0 ? rows[0].id : null;
};

// Create Quiz
export const createQuiz = asyncHandler(async (req, res) => {
    const {
        courseId, moduleId, lessonId, scope, title, questions,
        passingScore, description, timeLimit, attemptsAllowed,
        skillUpgradation, issueCertificate, departmentId, sectionId, lineId, subSectionId, level, isDojo, isHandover, isTheoretical, conductedBy, isMultiSkilling
    } = req.body;

    if (!title || !questions || questions.length === 0) {
        throw new ApiError("Title and questions are required", 400);
    }
    if (scope && !['course', 'module', 'lesson', 'standalone'].includes(scope)) {
        throw new ApiError("Scope must be 'course', 'module', 'lesson', or 'standalone'", 400);
    }

    const actualScope = scope || (lessonId ? 'lesson' : moduleId ? 'module' : courseId ? 'course' : 'standalone');

    let resolvedCourseId = courseId || null;
    let finalModuleId = null;
    let finalLessonId = null;

    if (actualScope !== 'standalone') {
        if (!courseId) throw new ApiError("Course ID is required for non-standalone quizzes", 400);

        if (isNaN(courseId)) {
            const [courses] = await executeQuery("SELECT id FROM courses WHERE slug = ?", [courseId]);
            if (courses.length === 0) throw new ApiError("Course not found (by slug)", 404);
            resolvedCourseId = courses[0].id;
        } else {
            const [courses] = await executeQuery("SELECT id FROM courses WHERE id = ?", [courseId]);
            if (courses.length === 0) throw new ApiError("Course not found (by ID)", 404);
        }
    }


    if (actualScope === 'module' || actualScope === 'lesson') {
        if (!moduleId) throw new ApiError(`Module ID required for ${actualScope} scope`, 400);
        let resolvedModId = moduleId;
        if (isNaN(moduleId)) {
            const [mods] = await executeQuery("SELECT id, course FROM modules WHERE slug = ?", [moduleId]);
            if (mods.length === 0) throw new ApiError("Module not found (by slug)", 404);
            resolvedModId = mods[0].id;
            if (String(mods[0].course) !== String(resolvedCourseId)) {
                throw new ApiError("Module mismatch: Module does not belong to this course", 400);
            }
        } else {
            const [mods] = await executeQuery("SELECT id, course FROM modules WHERE id = ?", [moduleId]);
            if (mods.length === 0) throw new ApiError("Module not found (by ID)", 404);
            if (String(mods[0].course) !== String(resolvedCourseId)) {
                throw new ApiError("Module mismatch: Module does not belong to this course", 400);
            }
        }
        finalModuleId = resolvedModId;

        if (actualScope === 'lesson') {
            if (!lessonId) throw new ApiError("Lesson ID required for lesson scope", 400);
            let resolvedLessId = lessonId;
            if (isNaN(lessonId)) {
                const [lessons] = await executeQuery("SELECT id FROM lessons WHERE slug = ? AND module = ?", [lessonId, finalModuleId]);
                if (lessons.length === 0) throw new ApiError("Lesson not found or mismatch (by slug)", 404);
                resolvedLessId = lessons[0].id;
            } else {
                const [lessons] = await executeQuery("SELECT id FROM lessons WHERE id = ? AND module = ?", [lessonId, finalModuleId]);
                if (lessons.length === 0) throw new ApiError("Lesson not found or mismatch (by ID)", 404);
            }
            finalLessonId = resolvedLessId;
        }
    }

    // Generate unique slug
    let baseSlug = slugify(title);
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
        const [rows] = await executeQuery("SELECT id FROM quizzes WHERE slug = ?", [slug]);
        if (rows.length === 0) break;
        suffix++;
        slug = `${baseSlug}-${suffix}`;
    }

    const [insertRows] = await executeQuery(
        `INSERT INTO quizzes 
        (course, [module], lesson, scope, title, slug, [description], questions, passingScore, timeLimit, attemptsAllowed, skillUpgradation, issueCertificate, departmentId, sectionId, lineId, subSectionId, level, isDojo, isHandover, isTheoretical, conductedBy, isMultiSkilling, createdBy, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
        [
            resolvedCourseId, finalModuleId, finalLessonId, actualScope, title, slug, description,
            JSON.stringify(questions), passingScore, timeLimit, attemptsAllowed,
            JSON.stringify(skillUpgradation ?? false), issueCertificate ?? true,
            JSON.stringify(departmentId || []), JSON.stringify(sectionId || []), JSON.stringify(lineId || []), JSON.stringify(subSectionId || []), level || null, isDojo ? 1 : 0, isHandover ? 1 : 0, isTheoretical ? 1 : 0, conductedBy !== undefined && conductedBy !== null ? conductedBy : "", isMultiSkilling ? 1 : 0, req.user.id
        ]
    );

    const [newQuiz] = await executeQuery("SELECT * FROM quizzes WHERE id = ?", [insertRows[0].id]);
    const quiz = newQuiz[0];
    if (quiz) {
        quiz._id = quiz.id; // Map for frontend
        quiz.questions = parseJSON(quiz.questions);
        quiz.skillUpgradation = parseJSON(quiz.skillUpgradation);
    }

    res.status(201).json(new ApiResponse(201, quiz, "Quiz created successfully"));
});

// Get All Quizzes
export const getAllQuizzes = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    let whereClauses = ["1=1"];
    let params = [];

    // Role-based filtering: Temporary candidates only see DOJO quizzes, 
    // regular students only see non-DOJO quizzes.
    if (req.user && req.user.isTemporary) {
        whereClauses.push("COALESCE(q.isDojo, 0) = 1");
        whereClauses.push(`(
            COALESCE(q.level, '') != 'L0 (Dojo User)' 
            OR ? IS NULL
        )`);
        params.push(req.user.currentLevel || null);
        if (req.user.targetDeptId) {
            whereClauses.push(`(
                q.departmentId IS NULL 
                OR q.departmentId = '[]' 
                OR q.departmentId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.departmentId) WHERE value = ?)
            )`);
            params.push(String(req.user.targetDeptId));
        } else {
            whereClauses.push("(q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = '')");
        }
    } else if (req.user && req.user.role === 'STUDENT') {
        whereClauses.push("COALESCE(q.isDojo, 0) = 0");

        // Department filtering for regular students
        if (req.user.departmentId) {
            whereClauses.push(`(
                q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.departmentId) WHERE value = ?)
            )`);
            params.push(String(req.user.departmentId));
        } else {
            whereClauses.push("(q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = '')");
        }

        // Section filtering for regular students
        if (req.user.sectionId) {
            whereClauses.push(`(
                q.sectionId IS NULL OR q.sectionId = '[]' OR q.sectionId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.sectionId) WHERE value = ?)
            )`);
            params.push(String(req.user.sectionId));
        } else {
            whereClauses.push("(q.sectionId IS NULL OR q.sectionId = '[]' OR q.sectionId = '')");
        }
    } else if (req.query.isDojo !== undefined) {
        whereClauses.push("COALESCE(q.isDojo, 0) = ?");
        params.push(req.query.isDojo === 'true' || req.query.isDojo === '1' || req.query.isDojo === true ? 1 : 0);
    }

    if (req.query.skillUpgradation !== undefined) {
        const val = req.query.skillUpgradation === 'true' || req.query.skillUpgradation === '1' ? 'true' : 'false';
        whereClauses.push("COALESCE(q.skillUpgradation, 'false') = ?");
        params.push(val);
    }
    if (req.query.isMultiSkilling !== undefined) {
        whereClauses.push("COALESCE(q.isMultiSkilling, 0) = ?");
        params.push(req.query.isMultiSkilling === 'true' || req.query.isMultiSkilling === '1' ? 1 : 0);
    }

    if (req.query.search) {
        whereClauses.push("q.title LIKE ?");
        params.push(`%${req.query.search}%`);
    }
    if (req.query.courseId) {
        whereClauses.push("q.course = ?");
        params.push(req.query.courseId);
    }
    if (req.query.departmentId) {
        whereClauses.push("EXISTS (SELECT 1 FROM OPENJSON(q.departmentId) WHERE value = ?)");
        params.push(req.query.departmentId);
    }
    if (req.query.sectionId) {
        whereClauses.push("EXISTS (SELECT 1 FROM OPENJSON(q.sectionId) WHERE value = ?)");
        params.push(req.query.sectionId);
    }

    const whereSQL = whereClauses.join(" AND ");

    const [countRes] = await executeQuery(`SELECT COUNT(*) as cnt FROM quizzes q WHERE ${whereSQL}`, params);
    const total = countRes[0].cnt;

    const [rows] = await executeQuery(`
        SELECT q.*, c.title as cTitle, m.title as mTitle, u.fullName, u.email, u.role
        FROM quizzes q
        LEFT JOIN courses c ON q.course = c.id
        LEFT JOIN modules m ON q.module = m.id
        LEFT JOIN users u ON q.createdBy = u.id
        WHERE ${whereSQL}
        ORDER BY q.createdAt DESC
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    `, [...params, skip, limit]);

    const quizzes = rows.map(q => {
        q._id = q.id; // Map for frontend
        q.questions = parseJSON(q.questions);
        q.skillUpgradation = parseJSON(q.skillUpgradation);
        q.departmentId = parseJSON(q.departmentId, []);
        q.sectionId = parseJSON(q.sectionId, []);
        q.lineId = parseJSON(q.lineId, []);
        q.subSectionId = parseJSON(q.subSectionId, []);
        q.course = { id: q.course, title: q.cTitle };
        q.module = q.module ? { id: q.module, title: q.mTitle } : null;
        q.createdBy = { id: q.createdBy, fullName: q.fullName, email: q.email, role: q.role };
        delete q.cTitle; delete q.mTitle; delete q.fullName; delete q.email; delete q.role;
        return q;
    });

    res.json(new ApiResponse(200, {
        quizzes,
        pagination: { total, page, pages: Math.ceil(total / limit), limit }
    }, "Quizzes fetched"));
});

// Get Quiz By ID
export const getQuizById = asyncHandler(async (req, res) => {
    const id = await resolveQuizId(req.params.id);
    if (!id) throw new ApiError("Quiz not found", 404);

    const [rows] = await executeQuery(`
        SELECT q.*, c.title as cTitle, u.fullName, u.email 
        FROM quizzes q 
        LEFT JOIN courses c ON q.course = c.id 
        LEFT JOIN users u ON q.createdBy = u.id 
        WHERE q.id = ?
    `, [id]);

    if (rows.length === 0) throw new ApiError("Quiz not found", 404);

    const quiz = rows[0];
    quiz._id = quiz.id; // Map for frontend
    quiz.questions = parseJSON(quiz.questions);
    quiz.skillUpgradation = parseJSON(quiz.skillUpgradation);
    quiz.departmentId = parseJSON(quiz.departmentId, []);
    quiz.sectionId = parseJSON(quiz.sectionId, []);
    quiz.lineId = parseJSON(quiz.lineId, []);
    quiz.subSectionId = parseJSON(quiz.subSectionId, []);
    
    // Fetch sub-section names
    let subSectionNames = [];
    if (quiz.subSectionId && quiz.subSectionId.length > 0) {
        const validIds = quiz.subSectionId.filter(id => !isNaN(id) && id !== null && id !== '');
        if (validIds.length > 0) {
            const placeholders = validIds.map(() => "?").join(",");
            const [ssRows] = await executeQuery(`SELECT name FROM [sub_sections] WHERE id IN (${placeholders})`, validIds);
            subSectionNames = ssRows.map(r => r.name);
        }
    }
    quiz.subSectionNames = subSectionNames;

    quiz.course = { id: quiz.course, title: quiz.cTitle };
    quiz.createdBy = { id: quiz.createdBy, fullName: quiz.fullName, email: quiz.email };
    delete quiz.cTitle; delete quiz.fullName; delete quiz.email;

    res.json(new ApiResponse(200, quiz, "Fetched"));
});

// Update Quiz
export const updateQuiz = asyncHandler(async (req, res) => {
    const id = await resolveQuizId(req.params.id);
    if (!id) throw new ApiError("Quiz not found", 404);

    const {
        title, questions, description, passingScore, timeLimit,
        attemptsAllowed, skillUpgradation, departmentId, sectionId, lineId, subSectionId, level, isDojo, isHandover, isTheoretical, conductedBy, isMultiSkilling
    } = req.body;

    const [rows] = await executeQuery("SELECT * FROM quizzes WHERE id = ?", [id]);
    if (rows.length === 0) throw new ApiError("Quiz not found", 404);

    let updates = [];
    let values = [];

    if (title) { updates.push("title = ?"); values.push(title); }
    if (description !== undefined) { updates.push("description = ?"); values.push(description); }
    if (questions && questions.length > 0) { updates.push("questions = ?"); values.push(JSON.stringify(questions)); }
    if (passingScore !== undefined) { updates.push("passingScore = ?"); values.push(Number(passingScore)); }
    if (timeLimit !== undefined) { updates.push("timeLimit = ?"); values.push(timeLimit); }
    if (attemptsAllowed !== undefined) { updates.push("attemptsAllowed = ?"); values.push(attemptsAllowed); }
    if (skillUpgradation !== undefined) { updates.push("skillUpgradation = ?"); values.push(JSON.stringify(skillUpgradation)); }
    if (req.body.issueCertificate !== undefined) { updates.push("issueCertificate = ?"); values.push(req.body.issueCertificate); }
    if (departmentId !== undefined) { updates.push("departmentId = ?"); values.push(JSON.stringify(departmentId)); }
    if (sectionId !== undefined) { updates.push("sectionId = ?"); values.push(JSON.stringify(sectionId)); }
    if (lineId !== undefined) { updates.push("lineId = ?"); values.push(JSON.stringify(lineId)); }
    if (subSectionId !== undefined) { updates.push("subSectionId = ?"); values.push(JSON.stringify(subSectionId)); }
    if (level !== undefined) { updates.push("level = ?"); values.push(level); }
    if (isDojo !== undefined) { updates.push("isDojo = ?"); values.push(isDojo ? 1 : 0); }
    if (isHandover !== undefined) { updates.push("isHandover = ?"); values.push(isHandover ? 1 : 0); }
    if (isTheoretical !== undefined) { updates.push("isTheoretical = ?"); values.push(isTheoretical ? 1 : 0); }
    if (conductedBy !== undefined) { updates.push("conductedBy = ?"); values.push(conductedBy); }
    if (isMultiSkilling !== undefined) { updates.push("isMultiSkilling = ?"); values.push(isMultiSkilling ? 1 : 0); }

    if (updates.length > 0) {
        updates.push("updatedAt = GETDATE()");
        await executeQuery(`UPDATE quizzes SET ${updates.join(', ')} WHERE id = ?`, [...values, id]);
    }

    // Return updated
    const [updated] = await executeQuery("SELECT * FROM quizzes WHERE id = ?", [id]);
    const quiz = updated[0];
    quiz._id = quiz.id; // Map for frontend
    quiz.questions = parseJSON(quiz.questions);
    quiz.skillUpgradation = parseJSON(quiz.skillUpgradation);
    quiz.departmentId = parseJSON(quiz.departmentId, []);
    quiz.sectionId = parseJSON(quiz.sectionId, []);
    quiz.lineId = parseJSON(quiz.lineId, []);
    quiz.subSectionId = parseJSON(quiz.subSectionId, []);

    res.json(new ApiResponse(200, quiz, "Updated"));
});

// Delete Quiz
export const deleteQuiz = asyncHandler(async (req, res) => {
    const id = await resolveQuizId(req.params.id);
    if (!id) throw new ApiError("Quiz not found", 404);

    const [result, metadata] = await executeQuery("DELETE FROM quizzes WHERE id = ?", [id]);
    res.json(new ApiResponse(200, null, "Deleted"));
});

// Get Accessible Quizzes
export const getAccessibleQuizzes = asyncHandler(async (req, res) => {
    const { courseId: rawCourseId, moduleId: rawModuleId } = req.params;
    const userId = req.user.id;

    // Resolve IDs
    let courseId = rawCourseId;
    let moduleId = rawModuleId;
    // Assuming frontend sends valid IDs; resolving slugs via SQL is trivial if needed.
    // Skipping extensive slug resolution for brevity unless critical; relying on IDs passed.

    // Check Access (Replicating Logic)
    let hasAccess = false;
    let reason = "Locked";

    // Check progress
    const [pRows] = await executeQuery("SELECT * FROM progress WHERE student = ? AND course = ?", [userId, courseId]);
    if (pRows.length === 0) {
        // Check if first module
        const [mods] = await executeQuery("SELECT TOP 1 id FROM modules WHERE course = ? ORDER BY [order] ASC", [courseId]);
        if (mods.length > 0 && String(mods[0].id) === String(moduleId)) {
            hasAccess = true; reason = "First module";
        }
    } else {
        const progress = pRows[0];
        const completedModules = parseJSON(progress.completedModules, []);
        const [mods] = await executeQuery("SELECT id, [order] FROM modules WHERE course = ? ORDER BY [order] ASC", [courseId]);
        const modIdx = mods.findIndex(m => String(m.id) === String(moduleId));

        if (modIdx !== -1) {
            if (modIdx === 0) {
                hasAccess = true; reason = "First module";
            } else {
                const prev = mods[modIdx - 1];
                const prevDone = completedModules.some(cm => String(cm.moduleId) === String(prev.id));
                if (prevDone) {
                    hasAccess = true; reason = "Previous completed";
                } else {
                    reason = "Previous not completed";
                }
            }
            // Or if current is already completed
            if (completedModules.some(cm => String(cm.moduleId) === String(moduleId))) {
                hasAccess = true; reason = "Completed";
            }
        }
    }

    if (!hasAccess) {
        return res.json(new ApiResponse(200, { quizzes: [], accessInfo: { hasAccess: false, reason } }, "Locked"));
    }

    // Access Granted - Fetch Quizzes
    const onlyModule = String(req.query.onlyModule || '').toLowerCase() === 'true';
    let quizzes = [];

    if (onlyModule) {
        const [rows] = await executeQuery(`
            SELECT q.*, c.title as cTitle, m.title as mTitle 
            FROM quizzes q
            LEFT JOIN courses c ON q.course = c.id
            LEFT JOIN modules m ON q.module = m.id
            WHERE q.course = ? AND q.module = ?
            ORDER BY q.createdAt DESC
        `, [courseId, moduleId]);
        quizzes = rows;
    } else {
        // Module OR Course-Wide (no module)
        const [rows] = await executeQuery(`
            SELECT q.*, c.title as cTitle, m.title as mTitle 
            FROM quizzes q
            LEFT JOIN courses c ON q.course = c.id
            LEFT JOIN modules m ON q.module = m.id
            WHERE q.course = ? AND (q.module = ? OR q.module IS NULL)
            ORDER BY q.createdAt DESC
        `, [courseId, moduleId]);
        quizzes = rows;
    }

    const formatted = quizzes.map(q => {
        q._id = q.id; // Map for frontend
        q.questions = parseJSON(q.questions);
        q.skillUpgradation = parseJSON(q.skillUpgradation);
        q.departmentId = parseJSON(q.departmentId, []);
        q.sectionId = parseJSON(q.sectionId, []);
        q.lineId = parseJSON(q.lineId, []);
        q.subSectionId = parseJSON(q.subSectionId, []);
        q.course = { id: q.course, title: q.cTitle };
        q.module = q.module ? { id: q.module, title: q.mTitle } : null;
        q.createdBy = { id: q.createdBy, fullName: q.fullName, email: q.email, role: q.role };
        delete q.cTitle; delete q.mTitle; delete q.fullName; delete q.email; delete q.role;
        return q;
    });

    res.json(new ApiResponse(200, { quizzes: formatted, accessInfo: { hasAccess: true, reason } }, "Fetched"));
});

// Get Course Quizzes
export const getCourseQuizzes = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const userId = req.user.id;

    if (isNaN(courseId)) throw new ApiError("Invalid Course ID format. Expected an integer.", 400);

    // Check completion
    const [mods] = await executeQuery("SELECT id FROM modules WHERE course = ?", [courseId]);
    const [pRows] = await executeQuery("SELECT completedModules FROM progress WHERE student = ? AND course = ?", [userId, courseId]);

    let hasAccess = false;
    let reason = "Not completed";

    if (pRows.length > 0) {
        const completed = parseJSON(pRows[0].completedModules, []);
        if (mods.length > 0 && completed.length >= mods.length) {
            hasAccess = true; reason = "Course completed";
        } else {
            reason = `Complete all ${mods.length} modules`;
        }
    } else {
        if (mods.length === 0) reason = "No modules";
        else reason = "No progress";
    }

    if (!hasAccess) {
        return res.json(new ApiResponse(200, { quizzes: [], accessInfo: { hasAccess: false, reason } }, "Locked"));
    }

    // Fetch Course-Type Quizzes
    let whereClauses = ["q.course = ?", "q.scope = 'course'"];
    let params = [courseId];

    if (req.user && req.user.isTemporary) {
        whereClauses.push("COALESCE(q.isDojo, 0) = 1");
        whereClauses.push(`(
            COALESCE(q.level, '') != 'L0 (Dojo User)' 
            OR ? IS NULL
        )`);
        params.push(req.user.currentLevel || null);
        if (req.user.targetDeptId) {
            whereClauses.push(`(
                q.departmentId IS NULL 
                OR q.departmentId = '[]' 
                OR q.departmentId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.departmentId) WHERE value = ?)
            )`);
            params.push(String(req.user.targetDeptId));
        } else {
            whereClauses.push("(q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = '')");
        }
    } else if (req.user && req.user.role === 'STUDENT') {
        whereClauses.push("COALESCE(q.isDojo, 0) = 0");

        // Department filtering for regular students
        if (req.user.departmentId) {
            whereClauses.push(`(
                q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.departmentId) WHERE value = ?)
            )`);
            params.push(String(req.user.departmentId));
        } else {
            whereClauses.push("(q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = '')");
        }

        // Section filtering for regular students
        if (req.user.sectionId) {
            whereClauses.push(`(
                q.sectionId IS NULL OR q.sectionId = '[]' OR q.sectionId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.sectionId) WHERE value = ?)
            )`);
            params.push(String(req.user.sectionId));
        } else {
            whereClauses.push("(q.sectionId IS NULL OR q.sectionId = '[]' OR q.sectionId = '')");
        }
    }

    const [rows] = await executeQuery(`
        SELECT q.*, c.title as cTitle 
        FROM quizzes q
        LEFT JOIN courses c ON q.course = c.id
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY q.createdAt DESC
    `, params);

    const formatted = rows.map(q => {
        q._id = q.id; // Map for frontend
        q.questions = parseJSON(q.questions);
        q.skillUpgradation = parseJSON(q.skillUpgradation);
        q.departmentId = parseJSON(q.departmentId, []);
        q.sectionId = parseJSON(q.sectionId, []);
        q.lineId = parseJSON(q.lineId, []);
        q.subSectionId = parseJSON(q.subSectionId, []);
        q.course = { id: q.course, title: q.cTitle };
        delete q.cTitle;
        return q;
    });

    res.json(new ApiResponse(200, { quizzes: formatted, accessInfo: { hasAccess: true, reason } }, "Fetched"));
});

// Get Quizzes by Course (Simple)
export const getQuizzesByCourse = asyncHandler(async (req, res) => {
    const rawCourseId = req.params.courseId || req.body.courseId;
    if (!rawCourseId) throw new ApiError("Course ID required", 400);

    // Resolve course ID if slug
    let courses;
    if (!isNaN(rawCourseId)) {
        [courses] = await executeQuery("SELECT id FROM courses WHERE id = ? OR slug = ?", [rawCourseId, rawCourseId]);
    } else {
        [courses] = await executeQuery("SELECT id FROM courses WHERE slug = ?", [rawCourseId]);
    }

    if (courses.length === 0) return res.status(200).json(new ApiResponse(200, [], "Course not found"));
    const courseId = courses[0].id;
    let whereClauses = ["q.course = ?"];
    let params = [courseId];

    // Role-based filtering: Temporary candidates only see DOJO quizzes,
    // regular students only see non-DOJO quizzes.
    if (req.user && req.user.isTemporary) {
        whereClauses.push("COALESCE(q.isDojo, 0) = 1");
        whereClauses.push(`(
            COALESCE(q.level, '') != 'L0 (Dojo User)' 
            OR ? IS NULL
        )`);
        params.push(req.user.currentLevel || null);
        if (req.user.targetDeptId) {
            whereClauses.push(`(
                q.departmentId IS NULL 
                OR q.departmentId = '[]' 
                OR q.departmentId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.departmentId) WHERE value = ?)
            )`);
            params.push(String(req.user.targetDeptId));
        } else {
            whereClauses.push("(q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = '')");
        }
    } else if (req.user && req.user.role === 'STUDENT') {
        whereClauses.push("COALESCE(q.isDojo, 0) = 0");

        // Department filtering for regular students
        if (req.user.departmentId) {
            whereClauses.push(`(
                q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.departmentId) WHERE value = ?)
            )`);
            params.push(String(req.user.departmentId));
        } else {
            whereClauses.push("(q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = '')");
        }

        // Section filtering for regular students
        if (req.user.sectionId) {
            whereClauses.push(`(
                q.sectionId IS NULL OR q.sectionId = '[]' OR q.sectionId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.sectionId) WHERE value = ?)
            )`);
            params.push(String(req.user.sectionId));
        } else {
            whereClauses.push("(q.sectionId IS NULL OR q.sectionId = '[]' OR q.sectionId = '')");
        }
    }

    const [rows] = await executeQuery(`
        SELECT q.*, c.title as cTitle, m.title as mTitle, u.fullName, u.email, u.role
        FROM quizzes q
        LEFT JOIN courses c ON q.course = c.id
        LEFT JOIN modules m ON q.module = m.id
        LEFT JOIN users u ON q.createdBy = u.id
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY q.createdAt DESC
    `, params);

    const formatted = rows.map(q => {
        q._id = q.id; // Map for frontend
        q.questions = parseJSON(q.questions);
        q.skillUpgradation = parseJSON(q.skillUpgradation);
        q.departmentId = parseJSON(q.departmentId, []);
        q.sectionId = parseJSON(q.sectionId, []);
        q.lineId = parseJSON(q.lineId, []);
        q.subSectionId = parseJSON(q.subSectionId, []);
        q.course = { id: q.course, title: q.cTitle };
        q.module = q.module ? { id: q.module, title: q.mTitle } : null;
        q.createdBy = { id: q.createdBy, fullName: q.fullName, email: q.email, role: q.role };
        delete q.cTitle; delete q.mTitle; delete q.fullName; delete q.email; delete q.role;
        return q;
    });

    res.json(new ApiResponse(200, formatted, "Fetched"));
});

// Module Scoped
export const getQuizzesByModule = asyncHandler(async (req, res) => {
    const rawModuleId = req.params.moduleId || req.body.moduleId;
    if (!rawModuleId) throw new ApiError("Module ID required", 400);

    // Resolve module ID
    let mods;
    if (!isNaN(rawModuleId)) {
        [mods] = await executeQuery("SELECT id FROM modules WHERE id = ? OR slug = ?", [rawModuleId, rawModuleId]);
    } else {
        [mods] = await executeQuery("SELECT id FROM modules WHERE slug = ?", [rawModuleId]);
    }
    if (mods.length === 0) return res.status(200).json(new ApiResponse(200, [], "Module not found"));
    const moduleId = mods[0].id;

    let whereClauses = ["q.module = ?", "q.scope = 'module'"];
    let params = [moduleId];

    if (req.user && req.user.isTemporary) {
        whereClauses.push("COALESCE(q.isDojo, 0) = 1");
        whereClauses.push(`(
            COALESCE(q.level, '') != 'L0 (Dojo User)' 
            OR ? IS NULL
        )`);
        params.push(req.user.currentLevel || null);
        if (req.user.targetDeptId) {
            whereClauses.push(`(
                q.departmentId IS NULL 
                OR q.departmentId = '[]' 
                OR q.departmentId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.departmentId) WHERE value = ?)
            )`);
            params.push(String(req.user.targetDeptId));
        } else {
            whereClauses.push("(q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = '')");
        }
    } else if (req.user && req.user.role === 'STUDENT') {
        whereClauses.push("COALESCE(q.isDojo, 0) = 0");

        // Department filtering for regular students
        if (req.user.departmentId) {
            whereClauses.push(`(
                q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.departmentId) WHERE value = ?)
            )`);
            params.push(String(req.user.departmentId));
        } else {
            whereClauses.push("(q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = '')");
        }

        // Section filtering for regular students
        if (req.user.sectionId) {
            whereClauses.push(`(
                q.sectionId IS NULL OR q.sectionId = '[]' OR q.sectionId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.sectionId) WHERE value = ?)
            )`);
            params.push(String(req.user.sectionId));
        } else {
            whereClauses.push("(q.sectionId IS NULL OR q.sectionId = '[]' OR q.sectionId = '')");
        }
    }

    const [rows] = await executeQuery(`
        SELECT q.*, c.title as cTitle, m.title as mTitle, u.fullName, u.email
        FROM quizzes q
        LEFT JOIN courses c ON q.course = c.id
        LEFT JOIN modules m ON q.module = m.id
        LEFT JOIN users u ON q.createdBy = u.id
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY q.createdAt DESC
    `, params);

    const formatted = rows.map(q => {
        q._id = q.id; // Map for frontend
        q.questions = parseJSON(q.questions);
        q.skillUpgradation = parseJSON(q.skillUpgradation);
        q.departmentId = parseJSON(q.departmentId, []);
        q.sectionId = parseJSON(q.sectionId, []);
        q.lineId = parseJSON(q.lineId, []);
        q.subSectionId = parseJSON(q.subSectionId, []);
        q.course = { id: q.course, title: q.cTitle };
        q.module = { id: q.module, title: q.mTitle };
        q.createdBy = { id: q.createdBy, fullName: q.fullName, email: q.email };
        delete q.cTitle; delete q.mTitle; delete q.fullName; delete q.email;
        return q;
    });

    res.json(new ApiResponse(200, formatted, "Fetched"));
});

// Lesson Scoped
export const getQuizzesByLesson = asyncHandler(async (req, res) => {
    const rawLessonId = req.params.lessonId || req.body.lessonId;
    if (!rawLessonId) throw new ApiError("Lesson ID required", 400);

    // Resolve lesson ID
    let lessons;
    if (!isNaN(rawLessonId)) {
        [lessons] = await executeQuery("SELECT id FROM lessons WHERE id = ? OR slug = ?", [rawLessonId, rawLessonId]);
    } else {
        [lessons] = await executeQuery("SELECT id FROM lessons WHERE slug = ?", [rawLessonId]);
    }
    if (lessons.length === 0) return res.status(200).json(new ApiResponse(200, [], "Lesson not found"));
    const lessonId = lessons[0].id;

    let whereClauses = ["q.lesson = ?", "q.scope = 'lesson'"];
    let params = [lessonId];

    if (req.user && req.user.isTemporary) {
        whereClauses.push("COALESCE(q.isDojo, 0) = 1");
        whereClauses.push(`(
            COALESCE(q.level, '') != 'L0 (Dojo User)' 
            OR ? IS NULL
        )`);
        params.push(req.user.currentLevel || null);
        if (req.user.targetDeptId) {
            whereClauses.push(`(
                q.departmentId IS NULL 
                OR q.departmentId = '[]' 
                OR q.departmentId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.departmentId) WHERE value = ?)
            )`);
            params.push(String(req.user.targetDeptId));
        } else {
            whereClauses.push("(q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = '')");
        }
    } else if (req.user && req.user.role === 'STUDENT') {
        whereClauses.push("COALESCE(q.isDojo, 0) = 0");

        // Department filtering for regular students
        if (req.user.departmentId) {
            whereClauses.push(`(
                q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.departmentId) WHERE value = ?)
            )`);
            params.push(String(req.user.departmentId));
        } else {
            whereClauses.push("(q.departmentId IS NULL OR q.departmentId = '[]' OR q.departmentId = '')");
        }

        // Section filtering for regular students
        if (req.user.sectionId) {
            whereClauses.push(`(
                q.sectionId IS NULL OR q.sectionId = '[]' OR q.sectionId = ''
                OR EXISTS (SELECT 1 FROM OPENJSON(q.sectionId) WHERE value = ?)
            )`);
            params.push(String(req.user.sectionId));
        } else {
            whereClauses.push("(q.sectionId IS NULL OR q.sectionId = '[]' OR q.sectionId = '')");
        }
    }

    const [rows] = await executeQuery(`
        SELECT q.*, c.title as cTitle, m.title as mTitle, u.fullName, u.email
        FROM quizzes q
        LEFT JOIN courses c ON q.course = c.id
        LEFT JOIN modules m ON q.module = m.id
        LEFT JOIN users u ON q.createdBy = u.id
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY q.createdAt DESC
    `, params);

    const formatted = rows.map(q => {
        q._id = q.id; // Map for frontend
        q.questions = parseJSON(q.questions);
        q.skillUpgradation = parseJSON(q.skillUpgradation);
        q.departmentId = parseJSON(q.departmentId, []);
        q.sectionId = parseJSON(q.sectionId, []);
        q.lineId = parseJSON(q.lineId, []);
        q.subSectionId = parseJSON(q.subSectionId, []);
        q.course = { id: q.course, title: q.cTitle };
        q.module = q.module ? { id: q.module, title: q.mTitle } : null;
        q.createdBy = { id: q.createdBy, fullName: q.fullName, email: q.email };
        delete q.cTitle; delete q.mTitle; delete q.fullName; delete q.email;
        return q;
    });

    res.json(new ApiResponse(200, formatted, "Fetched"));
});

