import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Helper to safely parse JSON
const parseJSON = (data, fallback = []) => {
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch (e) { return fallback; }
    }
    return data || fallback;
};

export const createSubmission = asyncHandler(async (req, res) => {
    const { assignmentId, fileUrl } = req.body;
    const userId = req.user.id;

    if (!assignmentId) throw new ApiError("Invalid assignment ID", 400);

    // Fetch Assignment with relations
    const [assignRows] = await executeQuery(`
        SELECT a.*, c.id as cId, m.id as mId 
        FROM assignments a
        LEFT JOIN courses c ON a.courseId = c.id
        LEFT JOIN modules m ON a.moduleId = m.id
        WHERE a.id = ?
    `, [assignmentId]);

    if (assignRows.length === 0) throw new ApiError("Assignment not found", 404);
    const assignment = assignRows[0];

    // Validate access permissions
    if (assignment.moduleId && assignment.scope === "module") {
        // Module Assignment - Check module access
        // We replicate logic from progress controller / checkModuleAccessForAssessments
        // Logic: Access if (previous module completed OR is first module) AND (timeline check?)
        // Timeline check is complex. Simplified verification:

        const [pRows] = await executeQuery("SELECT * FROM progress WHERE student = ? AND course = ?", [userId, assignment.courseId]);
        if (pRows.length === 0) {
            // Check if first module
            const [mods] = await executeQuery("SELECT TOP 1 id FROM modules WHERE course = ? ORDER BY [order] ASC", [assignment.courseId]);
            if (mods.length === 0 || String(mods[0].id) !== String(assignment.moduleId)) {
                throw new ApiError("Access denied. Complete previous modules.", 403);
            }
        } else {
            const progress = pRows[0];
            const completedModules = parseJSON(progress.completedModules, []);
            const [mods] = await executeQuery("SELECT id, [order] FROM modules WHERE course = ? ORDER BY [order] ASC", [assignment.courseId]);
            const modIdx = mods.findIndex(m => String(m.id) === String(assignment.moduleId));

            if (modIdx > 0) {
                const prev = mods[modIdx - 1];
                const prevDone = completedModules.some(cm => String(cm.moduleId) === String(prev.id));
                if (!prevDone) throw new ApiError("Access denied. Complete previous modules.", 403);
            }
        }
    } else if (assignment.scope === "course") {
        // Course Assignment - Check all modules completed
        const [mods] = await executeQuery("SELECT id FROM modules WHERE course = ?", [assignment.courseId]);
        const totalModules = mods.length;

        const [pRows] = await executeQuery("SELECT completedModules FROM progress WHERE student = ? AND course = ?", [userId, assignment.courseId]);

        const completedModules = pRows.length > 0 ? parseJSON(pRows[0].completedModules, []) : [];
        if (completedModules.length < totalModules) {
            throw new ApiError(`Complete all ${totalModules} modules to access this course assignment.`, 403);
        }
    }

    // Check existing
    const [existing] = await executeQuery("SELECT id FROM submissions WHERE assignment = ? AND student = ?", [assignmentId, userId]);
    if (existing.length > 0) throw new ApiError("Submission already exists. Please resubmit", 400);

    const isLate = assignment.dueDate && new Date() > new Date(assignment.dueDate);

    // Create
    const [insertRows] = await executeQuery(
        `INSERT INTO submissions (assignment, student, fileUrl, isLate, status, submittedAt, createdAt, updatedAt)
         OUTPUT INSERTED.id
         VALUES (?, ?, ?, ?, 'SUBMITTED', GETDATE(), GETDATE(), GETDATE())`,
        [assignmentId, userId, fileUrl, isLate]
    );

    const [sub] = await executeQuery("SELECT * FROM submissions WHERE id = ?", [insertRows[0].id]);
    res.status(201).json(new ApiResponse(201, sub[0], "Submission created successfully"));
});

export const resubmitAssignment = asyncHandler(async (req, res) => {
    const { submissionId, fileUrl } = req.body;
    const userId = req.user.id; // Corrected from _id

    const [rows] = await executeQuery("SELECT * FROM submissions WHERE id = ?", [submissionId]);
    if (rows.length === 0) throw new ApiError("Submission not found", 404);
    const submission = rows[0];

    // Assuming student ID is int or matches user.id
    if (String(submission.student) !== String(userId)) throw new ApiError("Not authorized to resubmit this assignment", 403);

    await executeQuery(
        `UPDATE submissions 
         SET fileUrl = ?, resubmissionCount = resubmissionCount + 1, submittedAt = GETDATE(), status = 'SUBMITTED', updatedAt = GETDATE()
         WHERE id = ?`,
        [fileUrl, submissionId]
    );

    const [updated] = await executeQuery("SELECT * FROM submissions WHERE id = ?", [submissionId]);
    res.json(new ApiResponse(200, updated[0], "Submission resubmitted successfully"));
});

export const getSubmissionByAssignment = asyncHandler(async (req, res) => {
    const { assignmentId } = req.params;

    const [submissions] = await executeQuery(`
        SELECT s.*, u.fullName, u.email, u.slug
        FROM submissions s
        LEFT JOIN users u ON s.student = u.id
        WHERE s.assignment = ?
        ORDER BY s.submittedAt DESC
    `, [assignmentId]);

    const formatted = submissions.map(s => ({
        ...s,
        student: { id: s.student, fullName: s.fullName, email: s.email, slug: s.slug }
    })).map(s => { delete s.fullName; delete s.email; delete s.slug; return s; });

    res.json(new ApiResponse(200, formatted, "Submissions fetched successfully"));
});

export const getMySubmissions = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const [submissions] = await executeQuery(`
        SELECT s.*, a.title as aTitle, a.dueDate as aDueDate
        FROM submissions s
        LEFT JOIN assignments a ON s.assignment = a.id
        WHERE s.student = ?
        ORDER BY s.submittedAt DESC
    `, [userId]);

    const formatted = submissions.map(s => ({
        ...s,
        assignment: { id: s.assignment, title: s.aTitle, dueDate: s.aDueDate }
    })).map(s => { delete s.aTitle; delete s.aDueDate; return s; });

    res.json(new ApiResponse(200, formatted, "Your submissions fetched successfully"));
});

export const gradeSubmission = asyncHandler(async (req, res) => {
    const { submissionId } = req.params;
    const { grade, feedback } = req.body;
    const userId = req.user.id;

    // Fetch full context: Submission -> Assignment -> Course
    // AND Submission -> Student -> Department -> Instructor
    const [sRows] = await executeQuery(`
        SELECT s.*, 
               a.id as aId, a.courseId as aCourse, a.maxScore, a.title as aTitle, a.dueDate,
               u.id as uId, u.fullName as uName, u.email as uEmail, u.department as uDept
        FROM submissions s
        JOIN assignments a ON s.assignment = a.id
        JOIN users u ON s.student = u.id
        WHERE s.id = ?
    `, [submissionId]);

    if (sRows.length === 0) throw new ApiError("Submission not found", 404);
    const sub = sRows[0];

    // Auth logic
    if (req.user.role === 'INSTRUCTOR') {
        if (!sub.uDept) throw new ApiError("Student not assigned to department", 400);

        const [dRows] = await executeQuery("SELECT * FROM departments WHERE id = ?", [sub.uDept]);
        if (dRows.length === 0) throw new ApiError("Department not found", 404);
        const dept = dRows[0];

        if (String(dept.instructor) !== String(userId) || String(dept.course) !== String(sub.aCourse)) {
            throw new ApiError("You are not authorized to grade this submission", 403);
        }
    }

    if (grade !== null && grade !== undefined) {
        const maxScore = sub.maxScore || 100;
        if (grade < 0 || grade > maxScore) throw new ApiError(`Grade must be between 0 and ${maxScore}`, 400);
    }

    let updates = ["feedback = ?"];
    let values = [feedback || ''];

    if (grade !== null && grade !== undefined) {
        updates.push("grade = ?", "status = 'GRADED'", "gradedAt = GETDATE()", "gradedBy = ?");
        values.push(grade, userId);
    }

    await executeQuery(`UPDATE submissions SET ${updates.join(', ')} WHERE id = ?`, [...values, submissionId]);

    // Return populated
    const [users] = await executeQuery("SELECT fullName, email FROM users WHERE id = ?", [userId]); // Grader info

    const result = {
        ...sub,
        grade, feedback: feedback || '',
        status: grade !== null ? 'GRADED' : sub.status,
        gradedBy: users[0] ? { id: userId, fullName: users[0].fullName, email: users[0].email } : null,
        gradedAt: new Date(),
        assignment: { id: sub.aId, title: sub.aTitle, maxScore: sub.maxScore, dueDate: sub.dueDate },
        student: { id: sub.uId, fullName: sub.uName, email: sub.uEmail }
    };
    // Clean raw props
    delete result.aId; delete result.aCourse; delete result.maxScore; delete result.aTitle; delete result.dueDate;
    delete result.uId; delete result.uName; delete result.uEmail; delete result.uDept;

    res.json(new ApiResponse(200, result, "Submission graded successfully"));
});

export const getStudentSubmissions = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    let resolvedId = studentId;

    // Resolve ID/Slug
    let uRows;
    if (!isNaN(studentId)) {
        [uRows] = await executeQuery("SELECT id FROM users WHERE id = ?", [studentId]);
    } else {
        [uRows] = await executeQuery("SELECT id FROM users WHERE slug = ? OR userName = ?", [studentId, studentId]);
    }
    if (uRows.length === 0) throw new ApiError("Invalid student ID", 400);
    resolvedId = uRows[0].id;

    const [submissions] = await executeQuery(`
        SELECT s.*, 
               a.title as aTitle, a.maxScore, a.dueDate, 
               c.title as cTitle
        FROM submissions s
        JOIN assignments a ON s.assignment = a.id
        JOIN courses c ON a.courseId = c.id
        WHERE s.student = ?
        ORDER BY s.submittedAt DESC
    `, [resolvedId]);

    const formatted = submissions.map(s => ({
        ...s,
        assignment: {
            id: s.assignment, title: s.aTitle, maxScore: s.maxScore, dueDate: s.dueDate,
            course: { title: s.cTitle }
        }
    })).map(s => { delete s.aTitle; delete s.maxScore; delete s.dueDate; delete s.cTitle; return s; });

    res.json(new ApiResponse(200, formatted, "Student submissions fetched successfully"));
});
