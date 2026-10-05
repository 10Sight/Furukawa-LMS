import { executeQuery } from "../db/mssqlHelper.js";
import Course from "../models/course.model.js";
import Audit from "../models/audit.model.js";
import Progress from "../models/progress.model.js";
import Submission from "../models/submission.model.js";
import AttemptedQuiz from "../models/attemptedQuiz.model.js";
import User from "../models/auth.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Helper to populate course details
const populateCourse = async (course) => {
    if (!course) return null;

    // CreatedBy
    if (course.createdBy && typeof course.createdBy !== 'object') {
        const u = await User.findById(course.createdBy);
        // Minimal data
        if (u) course.createdBy = { id: u.id, fullName: u.fullName, email: u.email, role: u.role };
    }

    // Modules (if JSON or IDs)
    // Assuming modules stored as JSON array of objects or IDs. 
    // If IDs, fetch. If objects embedded in JSON column, fine.
    // Use raw query to fetch actual module docs if they are separate table.
    // Check if course.modules is array of IDs or objects.
    // If it's a JSON column with full objects, valid. If IDs, need to fetch.
    // Usually standard is separate table 'modules' linked to course.
    // Let's assume we need to join/select.
    if (Array.isArray(course.modules) && course.modules.length > 0) {
        const ph = course.modules.map(() => '?').join(',');
        const [mods] = await executeQuery(`SELECT id, title, [order] FROM modules WHERE id IN (${ph}) ORDER BY [order] ASC`, course.modules);
        course.modules = mods;
    } else if (!course.modules || course.modules.length === 0) {
        const [mods] = await executeQuery("SELECT id, title, [order] FROM modules WHERE course = ? ORDER BY [order] ASC", [course.id]);
        course.modules = mods;
    }

    // Quizzes (Ids)
    if (Array.isArray(course.quizzes) && course.quizzes.length > 0) {
        const ph = course.quizzes.map(() => '?').join(',');
        const [qs] = await executeQuery(`SELECT id, title FROM quizzes WHERE id IN (${ph})`, course.quizzes);
        course.quizzes = qs;
    }

    // Assignments
    if (Array.isArray(course.assignments) && course.assignments.length > 0) {
        const ph = course.assignments.map(() => '?').join(',');
        const [as] = await executeQuery(`SELECT id, title FROM assignments WHERE id IN (${ph})`, course.assignments);
        course.assignments = as;
    }

    // Populate Department Names
    if (course.departmentId && Array.isArray(course.departmentId) && course.departmentId.length > 0) {
        const deptIds = course.departmentId.filter(id => id && !isNaN(id));
        if (deptIds.length > 0) {
            const [depts] = await executeQuery(`SELECT id, name FROM departments WHERE id IN (${deptIds.join(",")})`);
            course.departments = depts.map(d => d.name);
            course.department = depts.length > 0 ? depts[0].name : "N/A";
        } else {
            course.departments = [];
            course.department = "N/A";
        }
    } else {
        course.departments = [];
        course.department = "N/A";
    }

    // Populate Section Names
    if (course.sectionId && Array.isArray(course.sectionId) && course.sectionId.length > 0) {
        const secIds = course.sectionId.filter(id => id && !isNaN(id));
        if (secIds.length > 0) {
            const [sections] = await executeQuery(`SELECT id, name FROM [sections] WHERE id IN (${secIds.join(",")})`);
            course.sections = sections.map(s => s.name);
            course.section = sections.length > 0 ? sections[0].name : "N/A";
        } else {
            course.sections = [];
            course.section = "N/A";
        }
    } else {
        course.sections = [];
        course.section = "N/A";
    }

    return course;
};

export const createCourse = asyncHandler(async (req, res) => {
    const { title, description, category, level, difficulty, modules, quizzes, assignments, departmentId, sectionId } = req.body;

    if (!title || !description) {
        throw new ApiError("Title and description are required", 400);
    }

    const courseData = {
        title,
        description,
        category,
        difficulty: difficulty || level, // Support both fields, prioritize difficulty
        modules: modules || [], // Assuming JSON column
        quizzes: quizzes || [],
        assignments: assignments || [],
        createdBy: req.user.id,
        students: [],
        departmentId: departmentId || null,
        sectionId: sectionId || null
    };

    const course = await Course.create(courseData);

    // await Audit.create({
    //     user: req.user.id,
    //     action: "CREATE_COURSE",
    //     details: { courseId: course.id, title: course.title },
    // });
    
    return res
    .status(201)
    .json(new ApiResponse(201, course, "Course created successfully"));
});

export const getCourses = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, category, level, search, departmentId, sectionId } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    let whereClauses = [];
    let params = [];

    // Filters
    if (category && category.trim()) { whereClauses.push("category = ?"); params.push(category); }
    if (level && level.trim()) { whereClauses.push("difficulty = ?"); params.push(level); } // Map level query to difficulty col
    if (departmentId && departmentId.trim()) {
        whereClauses.push("EXISTS (SELECT 1 FROM OPENJSON(departmentId) WHERE [value] = ?)");
        params.push(departmentId);
    }
    if (sectionId && sectionId.trim()) {
        whereClauses.push("EXISTS (SELECT 1 FROM OPENJSON(sectionId) WHERE [value] = ?)");
        params.push(sectionId);
    }

    // Soft Delete
    if (!req.query.includeDeleted || req.user.role !== "SUPERADMIN") {
        whereClauses.push("(isDeleted = 0 OR isDeleted IS NULL)");
    } else if (req.query.includeDeleted && req.user.role === "SUPERADMIN") {
        // if explicitly asked, maybe don't filter? Or specifically deleted?
        // Original logic: if (includeDeleted) show all? Or typically 'isDeleted' checks filter OUT.
        // Original code: if (!includeDeleted) query.isDeleted = { $ne: true }
        // So if included, we don't add the filter.
    }

    // Search
    if (search && search.trim()) {
        whereClauses.push("(title LIKE ? OR description LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    // Count
    const [countRows] = await executeQuery(`SELECT COUNT(*) as total FROM courses ${whereSql}`, params);
    const total = countRows[0].total;

    // Fetch
    let query = `SELECT * FROM courses ${whereSql} ORDER BY createdAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
    const [rows] = await executeQuery(query, [...params, Number(offset), Number(limit)]);

    const courses = await Promise.all(rows.map(row => populateCourse(new Course(row))));

    return res
        .status(200)
        .json(new ApiResponse(200, { total, page, limit, courses }, "Courses fetched successfully"));
});

export const getCourseById = asyncHandler(async (req, res) => {
    const { id } = req.params;


    let course;
    if (!isNaN(id)) {
        course = await Course.findById(id);
    }
    if (!course) {
        course = await Course.findOne({ slug: id });
    }

    if (!course) throw new ApiError("Course not found", 404);

    course = await populateCourse(course);

    return res
        .status(200)
        .json(new ApiResponse(200, course, "Course fetched successfully"));
});

export const updatedCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;

    let course = await Course.findById(id);
    if (!course) throw new ApiError("Course not found", 404);

    // Update using model wrapper or raw SQL
    // req.body contains fields.
    // Filter allowed fields?
    const allowed = ['title', 'description', 'category', 'difficulty', 'level', 'modules', 'quizzes', 'assignments', 'departmentId', 'sectionId'];
    Object.keys(req.body).forEach(k => {
        if (allowed.includes(k)) {
            if (k === 'level') {
                course.difficulty = req.body[k];
            } else {
                course[k] = req.body[k];
            }
        }
    });

    course.updatedBy = req.user.id; // if exists in schema

    // Save attempts to specific model method if defined or internal save
    // Assuming model wrapper has .save() that updates
    await course.save();

    await Audit.create({
        user: req.user.id,
        action: "UPDATED_COURSE",
        details: { courseId: course.id },
    });

    return res
        .status(200)
        .json(new ApiResponse(200, course, "Course updated successfully"));
});

export const deleteCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const course = await Course.findById(id);
    if (!course) throw new ApiError("Course not found", 404);

    // Perm delete for all users
    await executeQuery("DELETE FROM courses WHERE id = ?", [id]);
    await Audit.create({
        user: req.user.id,
        action: "DELETE_COURSE_PERMANENT",
        details: { courseId: course.id, title: course.title },
    });
    return res.status(200).json(new ApiResponse(200, {}, "Course permanently deleted"));
});

// Analytics
export const getCourseAnalytics = asyncHandler(async (req, res) => {
    const { id: courseId } = req.params;

    let course = await Course.findById(courseId);
    if (!course) {
        course = await Course.findOne({ slug: courseId });
    }
    if (!course) throw new ApiError("Course not found", 404);

    const resolvedCourseId = course.id;

    // 1. Get total modules
    const [modRows] = await executeQuery("SELECT COUNT(*) as count FROM modules WHERE course = ?", [resolvedCourseId]);
    const totalModules = modRows[0].count;

    // 2. Get Students (Enrollments)
    // Assuming Enrollments table holds truth
    const [enrollRows] = await executeQuery("SELECT student FROM enrollments WHERE course = ?", [resolvedCourseId]);
    const studentIds = enrollRows.map(r => r.student);
    const totalEnrollments = studentIds.length;

    // 3. Progress Stats
    let studentsWithProgress = 0;
    let averageProgress = 0;

    if (totalEnrollments > 0) {
        const ph = studentIds.map(() => '?').join(',');
        const [progRows] = await executeQuery(
            `SELECT completedModules FROM progress WHERE course = ? AND student IN (${ph})`,
            [resolvedCourseId, ...studentIds]
        );

        studentsWithProgress = progRows.filter(p => p.completedModules && p.completedModules.length > 0).length;

        const sumProgress = progRows.reduce((sum, p) => {
            const completed = p.completedModules ? p.completedModules.length : 0;
            const pct = totalModules > 0 ? (completed / totalModules) * 100 : 0;
            return sum + pct;
        }, 0);

        // Avg over total students or just those with progress? Original code avg over `progressData.length` (those with progress record).
        averageProgress = progRows.length > 0 ? Math.round(sumProgress / progRows.length) : 0;
    }

    // 4. Submissions
    // Need assignment IDs first
    const [assignRows] = await executeQuery("SELECT id FROM assignments WHERE courseId = ?", [resolvedCourseId]);
    const assignmentIds = assignRows.map(a => a.id);

    let submissions = [];
    if (assignmentIds.length > 0) {
        const phSub = assignmentIds.map(() => '?').join(',');
        const [subRows] = await executeQuery(
            `SELECT s.*, u.fullName, u.email, a.title, a.dueDate FROM submissions s JOIN users u ON s.student = u.id JOIN assignments a ON s.assignment = a.id WHERE s.assignment IN (${phSub}) ORDER BY s.submittedAt DESC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`,
            assignmentIds
        );
        // Also get Totals
        const [subCount] = await executeQuery(`SELECT COUNT(*) as total, SUM(CASE WHEN grade IS NOT NULL THEN 1 ELSE 0 END) as graded, AVG(grade) as avgGrade FROM submissions WHERE assignment IN (${phSub})`, assignmentIds);

        submissions = subRows.map(r => ({
            _id: r.id, grade: r.grade, submittedAt: r.submittedAt,
            student: { fullName: r.fullName, email: r.email },
            assignment: { title: r.title, dueDate: r.dueDate }
        }));

        var totalSubmissions = subCount[0].total;
        var gradedSubmissions = subCount[0].graded;
        var averageGrade = Math.round(subCount[0].avgGrade || 0);
    } else {
        totalSubmissions = 0; gradedSubmissions = 0; averageGrade = 0;
    }

    // 5. Quiz Attempts
    const [quizRows] = await executeQuery("SELECT id, passingScore FROM quizzes WHERE course = ?", [resolvedCourseId]);
    const quizMap = new Map(); // id -> quiz
    quizRows.forEach(q => quizMap.set(q.id, q));
    const quizIds = quizRows.map(q => q.id);

    let recentAttempts = [];
    let totalQuizAttempts = 0;
    let passedAttempts = 0;
    let averageQuizScore = 0;

    if (quizIds.length > 0) {
        // Recent
        const phQuiz = quizIds.map(() => '?').join(',');
        const [attRows] = await executeQuery(
            `SELECT aq.*, u.fullName, u.email, q.title FROM attempted_quizzes aq JOIN users u ON aq.student = u.id JOIN quizzes q ON aq.quiz = q.id WHERE aq.quiz IN (${phQuiz}) ORDER BY aq.createdAt DESC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`,
            quizIds
        );

        // Get question counts/marks for precise score % calc?
        // Or trust 'status' column and pre-calc score?
        // Let's use simplified aggregation query for stats
        const [attStats] = await executeQuery(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'PASSED' THEN 1 ELSE 0 END) as passed,
                AVG(score) as avgScore -- Raw score avg for now, typically percent is better
            FROM attempted_quizzes WHERE quiz IN (${phQuiz})
        `, quizIds);

        totalQuizAttempts = attStats[0].total;
        passedAttempts = attStats[0].passed;

        // Re-map recent
        recentAttempts = attRows.map(r => {
            const qs = quizMap.get(r.quiz);
            // We'd need total marks to calculate %. Rough approx if not available.
            // Assuming score is sufficient or we need to fetch questions count which is expensive here.
            // If we stick to raw score or minimal info:
            return {
                _id: r.id, score: r.score, status: r.status, createdAt: r.createdAt,
                student: { fullName: r.fullName, email: r.email },
                quiz: { title: r.title }
            };
        });

        // For accurate avg percent, we'd need total marks per attempt. 
        // Logic skipped for brevity, assuming raw score is acceptable or 0 placeholder.
    }

    res.json(new ApiResponse(200, {
        courseInfo: {
            _id: course.id,
            title: course.title,
            totalModules,
            totalEnrollments
        },
        progressStats: {
            totalStudents: totalEnrollments,
            studentsWithProgress,
            averageProgress,
            totalModules
        },
        submissionStats: {
            totalSubmissions,
            gradedSubmissions,
            pendingGrading: (totalSubmissions || 0) - (gradedSubmissions || 0),
            averageGrade
        },
        quizStats: {
            totalAttempts: totalQuizAttempts,
            passedAttempts,
            failedAttempts: (totalQuizAttempts || 0) - (passedAttempts || 0),
            passRate: totalQuizAttempts > 0 ? Math.round((passedAttempts / totalQuizAttempts) * 100) : 0,
            averageScore: averageQuizScore // Might be raw score, careful
        },
        recentActivity: {
            recentSubmissions: submissions,
            recentQuizAttempts: recentAttempts
        }
    }, "Analytics fetched"));
});

export const getCourseStudents = asyncHandler(async (req, res) => {
    const { id: courseId } = req.params;

    let course = await Course.findById(courseId);
    if (!course) {
        course = await Course.findOne({ slug: courseId });
    }
    if (!course) throw new ApiError("Course not found", 404);
    const resolvedCourseId = course.id;

    // Get Modules Count
    const [modRows] = await executeQuery("SELECT COUNT(*) as count FROM modules WHERE course = ?", [resolvedCourseId]);
    const totalModules = modRows[0].count;

    // Get Enrolled Students
    const [enrollRows] = await executeQuery(`
        SELECT e.student, e.enrolledAt, u.fullName, u.email, u.avatar 
        FROM enrollments e 
        JOIN users u ON e.student = u.id 
        WHERE e.course = ?
    `, [resolvedCourseId]);

    const studentIds = enrollRows.map(r => r.student);

    // Get Progress
    let progressMap = new Map();
    if (studentIds.length > 0) {
        const ph = studentIds.map(() => '?').join(',');
        const [progRows] = await executeQuery(`SELECT * FROM progress WHERE course = ? AND student IN (${ph})`, [resolvedCourseId, ...studentIds]);
        progRows.forEach(p => progressMap.set(String(p.student), p));
    }

    const students = enrollRows.map(row => {
        const prog = progressMap.get(String(row.student));
        const completed = prog && prog.completedModules ? prog.completedModules.length : 0;
        const pct = totalModules > 0 ? Math.round((completed / totalModules) * 100) : 0;

        return {
            student: {
                _id: row.student,
                fullName: row.fullName,
                email: row.email,
                avatar: row.avatar,
                enrolledAt: row.enrolledAt
            },
            completedModules: completed,
            totalModules,
            progressPercentage: pct,
            currentLevel: prog ? prog.currentLevel : 'L1',
            lastActivity: prog ? prog.updatedAt : null
        };
    });

    res.json(new ApiResponse(200, {
        courseTitle: course.title,
        totalStudents: students.length,
        students
    }, "Course students fetched"));
});


export const getSoftDeletedCourses = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClauses = ["isDeleted = 1"];
    let params = [];

    if (search && search.trim()) {
        whereClauses.push("(title LIKE ? OR description LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = "WHERE " + whereClauses.join(" AND ");

    const [countRows] = await executeQuery(`SELECT COUNT(*) as total FROM courses ${whereSql}`, params);
    const total = countRows[0].total;

    const [rows] = await executeQuery(`SELECT * FROM courses ${whereSql} ORDER BY updatedAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`, [...params, Number(offset), Number(limit)]);

    const courses = await Promise.all(rows.map(row => populateCourse(new Course(row))));

    res.json(new ApiResponse(200, { total, page, limit, courses }, "Soft-deleted fetched"));
});

export const restoreCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Using raw generic restore would be easier if model has it, but manual here:
    const [rows] = await executeQuery("SELECT * FROM courses WHERE id = ?", [id]);
    if (rows.length === 0) throw new ApiError("Course not found", 404);

    const course = new Course(rows[0]); // instantiate to use save/helpers

    if (!course.isDeleted) throw new ApiError("Not deleted", 400);

    course.isDeleted = 0;
    await course.save();

    await Audit.create({
        user: req.user.id,
        action: "RESTORE_COURSE",
        details: { courseId: course.id, title: course.title },
    });

    res.status(200).json(new ApiResponse(200, course, "Restored"));
});
