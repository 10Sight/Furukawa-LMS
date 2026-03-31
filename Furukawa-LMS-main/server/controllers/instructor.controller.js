import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { executeQuery } from "../db/mssqlHelper.js";
import ENV from "../configs/env.config.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, ENV.JWT_ACCESS_SECRET, { expiresIn: ENV.JWT_ACCESS_EXPIRES_IN });
};

// @desc    Instructor login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) throw new ApiError("Please provide email and password", 400);

  const [users] = await executeQuery("SELECT * FROM users WHERE email = ? AND role = 'INSTRUCTOR'", [email]);
  const user = users[0];

  if (!user) throw new ApiError("Invalid credentials or not an instructor", 401);

  if (user.status !== "ACTIVE") throw new ApiError("Account is not active. Please contact administrator.", 401);

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) throw new ApiError("Invalid credentials", 401);

  const token = generateToken(user.id);

  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: ENV.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  const userResponse = { ...user };
  delete userResponse.password;

  res.status(200).json(new ApiResponse(200, { instructor: userResponse, token }, "Login successful"));
});

// @desc    Get dashboard statistics for instructor
export const getDashboardStats = asyncHandler(async (req, res) => {
  const instructorId = req.user.id;

  // 1. Get Departments assigned to instructor
  const [departments] = await executeQuery("SELECT * FROM departments WHERE instructor = ?", [instructorId]);

  // 2. Calculate Total Students (Unique) across all departments
  let setStudentIds = new Set();
  departments.forEach(d => {
    let sIds = [];
    try { sIds = typeof d.students === 'string' ? JSON.parse(d.students) : d.students || []; } catch (e) { }
    sIds.forEach(id => setStudentIds.add(String(id)));
  });
  const totalStudents = setStudentIds.size;
  const allStudentIds = [...setStudentIds];

  // 3. Active Departments
  const activeDepartments = departments.filter(d => d.status === 'ONGOING').length;

  // 4. Courses (via departments)
  const courseIds = [...new Set(departments.map(d => d.course).filter(Boolean))];
  let publishedCoursesCount = 0;
  if (courseIds.length > 0) {
    const [cRows] = await executeQuery("SELECT COUNT(*) as count FROM courses WHERE id IN (?) AND status = 'PUBLISHED'", [courseIds]);
    publishedCoursesCount = cRows[0].count;
  }

  // 5. Recent Activities
  let recentActivities = [];

  if (allStudentIds.length > 0) {
    const [attempts] = await executeQuery(`
            SELECT aq.createdAt, u.fullName as studentName, q.title as itemTitle, 'quiz' as type 
            FROM attempted_quizzes aq
            JOIN users u ON aq.student = u.id
            JOIN quizzes q ON aq.quiz = q.id
            WHERE aq.student IN (?)
            ORDER BY aq.createdAt DESC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
        `, [allStudentIds]);

    const [submissions] = await executeQuery(`
            SELECT s.submittedAt as createdAt, u.fullName as studentName, a.title as itemTitle, 'assignment' as type
            FROM submissions s
            JOIN users u ON s.student = u.id
            JOIN assignments a ON s.assignment = a.id
            WHERE s.student IN (?) 
            ORDER BY s.submittedAt DESC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
        `, [allStudentIds]);

    attempts.forEach(a => recentActivities.push({
      title: `Quiz Attempted: ${a.itemTitle}`,
      description: `${a.studentName} attempted a quiz`,
      createdAt: a.createdAt,
      type: 'quiz'
    }));
    submissions.forEach(s => recentActivities.push({
      title: `Assignment Submitted: ${s.itemTitle}`,
      description: `${s.studentName} submitted an assignment`,
      createdAt: s.createdAt,
      type: 'assignment'
    }));

    recentActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    recentActivities = recentActivities.slice(0, 10);
  }

  res.json(new ApiResponse(200, {
    courses: { total: courseIds.length, published: publishedCoursesCount },
    departments: { total: departments.length, active: activeDepartments },
    students: { total: totalStudents },
    recentActivities: { count: recentActivities.length, items: recentActivities }
  }, "Dashboard stats fetched"));
});

// @desc    Get assigned courses for instructor
export const getAssignedCourses = asyncHandler(async (req, res) => {
  const instructorId = req.user.id;
  const { page = 1, limit = 10, search } = req.query;
  const offset = (page - 1) * limit;

  const [departments] = await executeQuery("SELECT course FROM departments WHERE instructor = ?", [instructorId]);
  const courseIds = [...new Set(departments.map(d => d.course).filter(Boolean))];

  if (courseIds.length === 0) {
    return res.json(new ApiResponse(200, { courses: [], totalPages: 0, currentPage: 1, total: 0 }, "No courses"));
  }

  let sql = `SELECT * FROM courses WHERE id IN (?) AND status = 'PUBLISHED'`;
  let params = [courseIds];

  if (search) {
    sql += " AND (title LIKE ? OR description LIKE ? OR category LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const [countRows] = await executeQuery(`SELECT COUNT(*) as total FROM courses WHERE id IN (?) AND status = 'PUBLISHED' ` + (search ? "AND (title LIKE ? OR description LIKE ? OR category LIKE ?)" : ""), params);
  const total = countRows[0].total;

  sql += " ORDER BY createdAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
  params.push(offset, parseInt(limit));

  const [courses] = await executeQuery(sql, params);

  for (let c of courses) {
    const [mods] = await executeQuery("SELECT id, title, description FROM modules WHERE course = ?", [c.id]);
    c.modules = mods;
  }

  res.json(new ApiResponse(200, {
    courses,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    total
  }, "Assigned courses fetched"));
});

// @desc    Get course details
export const getCourseDetails = asyncHandler(async (req, res) => {
  const instructorId = req.user.id;
  const { courseId } = req.params;

  if (isNaN(courseId)) throw new ApiError("Invalid course ID", 400);

  const [depts] = await executeQuery("SELECT id FROM departments WHERE instructor = ? AND course = ?", [instructorId, courseId]);
  if (depts.length === 0) throw new ApiError("Access denied. Course not assigned to you.", 403);

  const [rows] = await executeQuery("SELECT * FROM courses WHERE id = ? AND status = 'PUBLISHED'", [courseId]);
  if (rows.length === 0) throw new ApiError("Course not found or not published", 404);
  const course = rows[0];

  const [modules] = await executeQuery("SELECT * FROM modules WHERE course = ?", [courseId]);
  for (let m of modules) {
    const [lessons] = await executeQuery("SELECT id, title, description, duration, videoUrl FROM lessons WHERE module = ?", [m.id]);
    m.lessons = lessons;
  }
  course.modules = modules;

  res.json(new ApiResponse(200, course, "Course details fetched"));
});

// @desc    Get assigned departments for instructor
export const getAssignedDepartments = asyncHandler(async (req, res) => {
  const instructorId = req.user.id;
  const { page = 1, limit = 10, search } = req.query;
  const offset = (page - 1) * limit;

  let sql = "SELECT * FROM departments WHERE instructor = ?";
  let params = [instructorId];

  if (search) {
    sql += " AND (name LIKE ? OR description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const [allMatches] = await executeQuery(sql, params);
  const total = allMatches.length;

  sql += " ORDER BY createdAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
  params.push(offset, parseInt(limit));

  const [departments] = await executeQuery(sql, params);

  const departmentsWithProgress = await Promise.all(departments.map(async (d) => {
    if (d.course) {
      const [c] = await executeQuery("SELECT id, title, category, difficulty FROM courses WHERE id = ?", [d.course]);
      d.course = c.length > 0 ? c[0] : null;
    }

    let studentIds = [];
    try { studentIds = typeof d.students === 'string' ? JSON.parse(d.students) : d.students || []; } catch (e) { }

    let students = [];
    if (studentIds.length > 0) {
      const [sRows] = await executeQuery("SELECT id, fullName, email, userName, status, avatar FROM users WHERE id IN (?)", [studentIds]);
      students = sRows;

      if (d.course) {
        const [progRows] = await executeQuery("SELECT student, progressPercent FROM progress WHERE course = ? AND student IN (?)", [d.course.id, studentIds]);
        students = students.map(s => {
          const p = progRows.find(pr => String(pr.student) === String(s.id));
          return { ...s, progress: p ? p.progressPercent : 0 };
        });
      } else {
        students = students.map(s => ({ ...s, progress: 0 }));
      }
    }
    d.students = students;

    return d;
  }));

  res.json(new ApiResponse(200, {
    departments: departmentsWithProgress,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    total
  }, "Assigned departments fetched"));
});

// @desc    Get department details
export const getDepartmentDetails = asyncHandler(async (req, res) => {
  const instructorId = req.user.id;
  const { departmentId } = req.params;

  const [rows] = await executeQuery("SELECT * FROM departments WHERE id = ? AND instructor = ?", [departmentId, instructorId]);
  if (rows.length === 0) throw new ApiError("Department not found or access denied", 404);
  const department = rows[0];

  if (department.course) {
    const [c] = await executeQuery("SELECT id, title, description, category, level, difficulty FROM courses WHERE id = ?", [department.course]);
    department.course = c[0] || null;
  }

  let studentIds = [];
  try { studentIds = typeof department.students === 'string' ? JSON.parse(department.students) : department.students || []; } catch (e) { }

  if (studentIds.length > 0) {
    const [s] = await executeQuery("SELECT id, fullName, email, phoneNumber FROM users WHERE id IN (?)", [studentIds]);
    department.students = s;
  } else {
    department.students = [];
  }

  res.json(new ApiResponse(200, department, "Department details fetched"));
});

// @desc    Get department students
export const getDepartmentStudents = asyncHandler(async (req, res) => {
  const instructorId = req.user.id;
  const { departmentId } = req.params;

  const [dRows] = await executeQuery("SELECT * FROM departments WHERE id = ? AND instructor = ?", [departmentId, instructorId]);
  if (dRows.length === 0) throw new ApiError("Department not found or access denied", 404);
  const department = dRows[0];

  let studentIds = [];
  try { studentIds = typeof department.students === 'string' ? JSON.parse(department.students) : department.students || []; } catch (e) { }

  if (studentIds.length === 0) {
    return res.json(new ApiResponse(200, {
      department: { _id: department.id, name: department.name, course: department.course },
      students: []
    }, "No students"));
  }

  const [students] = await executeQuery("SELECT id, fullName, email, slug, phoneNumber, userName, status, avatar FROM users WHERE id IN (?)", [studentIds]);

  let progressMap = {};
  if (department.course) {
    const [pRows] = await executeQuery("SELECT student, progressPercent FROM progress WHERE course = ? AND student IN (?)", [department.course, studentIds]);
    pRows.forEach(p => progressMap[p.student] = p.progressPercent);
  }

  let quizStatsMap = {};
  if (department.course) {
    const [qtRows] = await executeQuery(`
            SELECT aq.student, aq.score, aq.status, q.questions
            FROM attempted_quizzes aq
            JOIN quizzes q ON aq.quiz = q.id
            WHERE aq.student IN (?) AND q.course = ?
        `, [studentIds, department.course]);

    qtRows.forEach(row => {
      if (!quizStatsMap[row.student]) quizStatsMap[row.student] = { completed: 0, sumPercent: 0 };
      let maxScore = 0;
      let questions = [];
      if (row.questions) try { questions = typeof row.questions === 'string' ? JSON.parse(row.questions) : row.questions; } catch (e) { }
      questions.forEach(q => maxScore += (parseInt(q.marks) || 1));

      if (row.status !== 'IN_PROGRESS') {
        quizStatsMap[row.student].completed++;
        const pct = maxScore > 0 ? (row.score / maxScore) * 100 : 0;
        quizStatsMap[row.student].sumPercent += pct;
      }
    });
  }

  let subStatsMap = {};
  if (department.course) {
    const [subs] = await executeQuery(`
            SELECT s.student 
            FROM submissions s
            JOIN assignments a ON s.assignment = a.id
            WHERE s.student IN (?) AND a.courseId = ?
        `, [studentIds, department.course]);

    subs.forEach(row => {
      if (!subStatsMap[row.student]) subStatsMap[row.student] = 0;
      subStatsMap[row.student]++;
    });
  }

  let totalQuizzes = 0;
  let totalAssignments = 0;
  if (department.course) {
    const [tq] = await executeQuery("SELECT COUNT(*) as c FROM quizzes WHERE courseId = ?", [department.course]);
    totalQuizzes = tq[0].c;
    const [ta] = await executeQuery("SELECT COUNT(*) as c FROM assignments WHERE courseId = ?", [department.course]);
    totalAssignments = ta[0].c;
  }

  const studentsWithStats = students.map(s => {
    const qs = quizStatsMap[s.id] || { completed: 0, sumPercent: 0 };
    const avgQuizScore = qs.completed > 0 ? Math.round(qs.sumPercent / qs.completed) : 0;

    return {
      _id: s.id,
      ...s,
      progress: progressMap[s.id] || 0,
      averageQuizScore: avgQuizScore,
      completedQuizzes: qs.completed,
      totalQuizzes,
      submittedAssignments: subStatsMap[s.id] || 0,
      totalAssignments
    };
  });

  res.json(new ApiResponse(200, {
    department: { _id: department.id, name: department.name, course: department.course },
    students: studentsWithStats
  }, "Department students fetched"));
});

// @desc    Get student progress
export const getStudentProgress = asyncHandler(async (req, res) => {
  const instructorId = req.user.id;
  const { studentId } = req.params;
  const { courseId } = req.query;

  const [myDepts] = await executeQuery("SELECT students, course FROM departments WHERE instructor = ?", [instructorId]);
  const validDept = myDepts.find(d => {
    let sIds = [];
    try { sIds = typeof d.students === 'string' ? JSON.parse(d.students) : d.students || []; } catch (e) { }
    return sIds.map(String).includes(String(studentId)) && (!courseId || String(d.course) === String(courseId));
  });

  if (!validDept) throw new ApiError("Access denied. Student not in your department.", 403);

  const targetCourseId = courseId || validDept.course;

  const [rows] = await executeQuery("SELECT * FROM progress WHERE student = ? AND course = ?", [studentId, targetCourseId]);
  let progress = rows[0] || null;

  if (progress) {
    const [c] = await executeQuery("SELECT title FROM courses WHERE id = ?", [targetCourseId]);
    progress.course = c[0];

    let completedIds = [];
    try { completedIds = typeof progress.completedLessons === 'string' ? JSON.parse(progress.completedLessons) : progress.completedLessons || []; } catch (e) { }
    if (completedIds.length > 0) {
      const [lessons] = await executeQuery("SELECT title FROM lessons WHERE id IN (?)", [completedIds]);
      progress.completedLessons = lessons;
    } else {
      progress.completedLessons = [];
    }
  }

  res.json(new ApiResponse(200, progress, "Student progress fetched"));
});

// @desc    Get department quiz attempts
export const getDepartmentQuizAttempts = asyncHandler(async (req, res) => {
  const instructorId = req.user.id;
  const { departmentId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const [dRows] = await executeQuery("SELECT * FROM departments WHERE id = ? AND instructor = ?", [departmentId, instructorId]);
  if (dRows.length === 0) throw new ApiError("Department not found or access denied", 404);
  const department = dRows[0];

  let studentIds = [];
  try { studentIds = typeof department.students === 'string' ? JSON.parse(department.students) : department.students || []; } catch (e) { }

  if (studentIds.length === 0) {
    return res.json(new ApiResponse(200, { attempts: [], totalPages: 0, currentPage: 1, total: 0 }, "Empty"));
  }

  let sql = `
        SELECT aq.*, u.fullName, u.email, u.userName, q.title as qTitle, q.description as qDesc, q.questions, q.course as qCourse
        FROM attempted_quizzes aq
        JOIN users u ON aq.student = u.id
        JOIN quizzes q ON aq.quiz = q.id
        WHERE aq.student IN (?) AND q.course = ?
    `;
  let params = [studentIds, department.course];

  let countSql = `
        SELECT COUNT(*) as total
        FROM attempted_quizzes aq
        JOIN quizzes q ON aq.quiz = q.id
        WHERE aq.student IN (?) AND q.course = ?
    `;
  const [cRows] = await executeQuery(countSql, params);
  const total = cRows[0].total;

  sql += " ORDER BY aq.createdAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
  params.push(offset, parseInt(limit));

  const [rows] = await executeQuery(sql, params);

  const attempts = rows.map(r => {
    let questions = [];
    try { questions = typeof r.questions === 'string' ? JSON.parse(r.questions) : r.questions; } catch (e) { }
    const totalMarks = questions.reduce((acc, q) => acc + (q.marks || 1), 0);

    return {
      _id: r.id,
      student: { _id: r.student, fullName: r.fullName, userName: r.userName, email: r.email },
      quiz: { _id: r.quiz, title: r.qTitle, description: r.qDesc, questions },
      score: r.score,
      totalScore: totalMarks,
      status: r.status,
      startedAt: r.startedAt,
      submittedAt: r.completedAt,
      timeTaken: r.timeTaken,
      createdAt: r.createdAt
    };
  });

  res.json(new ApiResponse(200, {
    attempts,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    total
  }, "Quiz attempts fetched"));
});

// @desc    Get quiz details
export const getQuizDetails = asyncHandler(async (req, res) => {
  const { quizId } = req.params;

  const [rows] = await executeQuery("SELECT * FROM quizzes WHERE id = ?", [quizId]);
  if (rows.length === 0) throw new ApiError("Quiz not found", 404);
  const quiz = rows[0];

  if (quiz.module) {
    const [m] = await executeQuery("SELECT id, title, course FROM modules WHERE id = ?", [quiz.module]);
    if (m.length > 0) {
      const [c] = await executeQuery("SELECT title FROM courses WHERE id = ?", [m[0].course]);
      m[0].course = c[0] || null;
      quiz.module = m[0];
    }
  }

  if (typeof quiz.questions === 'string') {
    try { quiz.questions = JSON.parse(quiz.questions); } catch (e) { }
  }

  res.json(new ApiResponse(200, quiz, "Quiz details fetched"));
});

// @desc    Get student quiz attempts specific
export const getStudentQuizAttempts = asyncHandler(async (req, res) => {
  const instructorId = req.user.id;
  const { studentId, quizId } = req.params;

  const [departments] = await executeQuery("SELECT * FROM departments WHERE instructor = ?", [instructorId]);
  let hasAccess = false;
  for (let d of departments) {
    let sIds = [];
    try { sIds = typeof d.students === 'string' ? JSON.parse(d.students) : d.students || []; } catch (e) { }
    if (sIds.map(String).includes(String(studentId))) { hasAccess = true; break; }
  }
  if (!hasAccess) throw new ApiError("Access denied", 403);

  const [rows] = await executeQuery("SELECT * FROM attempted_quizzes WHERE student = ? AND quiz = ? ORDER BY createdAt DESC", [studentId, quizId]);

  for (let r of rows) {
    const [q] = await executeQuery("SELECT title, description, questions FROM quizzes WHERE id = ?", [r.quiz]);
    if (q.length > 0) {
      if (typeof q[0].questions === 'string') try { q[0].questions = JSON.parse(q[0].questions); } catch (e) { }
      r.quiz = q[0];
    }
  }

  res.json(new ApiResponse(200, rows, "Student quiz attempts fetched"));
});

// @desc    Get department assignment submissions
export const getDepartmentAssignmentSubmissions = asyncHandler(async (req, res) => {
  const instructorId = req.user.id;
  const { departmentId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const [dRows] = await executeQuery("SELECT * FROM departments WHERE id = ? AND instructor = ?", [departmentId, instructorId]);
  if (dRows.length === 0) throw new ApiError("Department not found", 404);
  const department = dRows[0];

  let studentIds = [];
  try { studentIds = typeof department.students === 'string' ? JSON.parse(department.students) : department.students || []; } catch (e) { }
  if (studentIds.length === 0) return res.json(new ApiResponse(200, { submissions: [], total: 0 }, "Empty"));

  let sql = `
        SELECT s.*, u.fullName, u.userName, u.email, a.title, a.description, a.dueDate, a.maxScore, a.courseId as course
        FROM submissions s
        JOIN users u ON s.student = u.id
        JOIN assignments a ON s.assignment = a.id
        WHERE s.student IN (?) AND a.courseId = ?
    `;
  let params = [studentIds, department.course];

  const [cRows] = await executeQuery(`
        SELECT COUNT(*) as total 
        FROM submissions s 
        JOIN assignments a ON s.assignment = a.id 
        WHERE s.student IN (?) AND a.courseId = ?`, params);
  const total = cRows[0].total;

  sql += " ORDER BY s.submittedAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
  params.push(offset, parseInt(limit));

  const [rows] = await executeQuery(sql, params);

  const submissions = rows.map(r => ({
    _id: r.id,
    student: { _id: r.student, fullName: r.fullName, userName: r.userName, email: r.email },
    assignment: { _id: r.assignment, title: r.title, description: r.description, dueDate: r.dueDate, maxScore: r.maxScore, course: r.course },
    files: r.files,
    link: r.link,
    message: r.message,
    status: r.status,
    grade: r.grade,
    feedback: r.feedback,
    isLate: r.isLate,
    submittedAt: r.submittedAt,
    createdAt: r.createdAt
  }));

  submissions.forEach(s => {
    if (typeof s.files === 'string') try { s.files = JSON.parse(s.files); } catch (e) { }
  });

  res.json(new ApiResponse(200, {
    submissions,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    total
  }, "Submissions fetched"));
});

// @desc    Get assignment details
export const getAssignmentDetails = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;
  const [rows] = await executeQuery("SELECT * FROM assignments WHERE id = ?", [assignmentId]);
  if (rows.length === 0) throw new ApiError("Assignment not found", 404);
  res.json(new ApiResponse(200, rows[0], "Assignment details fetched"));
});

// === MISSING FUNCTIONS IMPLEMENTATION ===

export const getStudentAssignmentSubmissions = asyncHandler(async (req, res) => {
  const { studentId, assignmentId } = req.params;
  const instructorId = req.user.id;

  const [rows] = await executeQuery(`
        SELECT s.*, u.fullName 
        FROM submissions s
        JOIN users u ON s.student = u.id
        WHERE s.student = ? AND s.assignment = ?
    `, [studentId, assignmentId]);

  // Parse files
  rows.forEach(r => {
    if (typeof r.files === 'string') try { r.files = JSON.parse(r.files); } catch (e) { }
  });

  res.json(new ApiResponse(200, rows, "Student submissions fetched"));
});

export const getSubmissionDetails = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const [rows] = await executeQuery("SELECT * FROM submissions WHERE id = ?", [submissionId]);
  if (rows.length === 0) throw new ApiError("Not found", 404);

  const sub = rows[0];
  if (typeof sub.files === 'string') try { sub.files = JSON.parse(sub.files); } catch (e) { }

  // Populate student
  const [u] = await executeQuery("SELECT id, fullName, email FROM users WHERE id = ?", [sub.student]);
  sub.student = u[0];

  res.json(new ApiResponse(200, sub, "Submission details"));
});

export const gradeInstructorSubmission = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const { grade, feedback } = req.body;

  const [rows] = await executeQuery("SELECT * FROM submissions WHERE id = ?", [submissionId]);
  if (rows.length === 0) throw new ApiError("Not found", 404);

  await executeQuery("UPDATE submissions SET grade = ?, feedback = ?, status = 'GRADED' WHERE id = ?", [grade, feedback, submissionId]);

  // Return updated
  const [updated] = await executeQuery("SELECT * FROM submissions WHERE id = ?", [submissionId]);
  res.json(new ApiResponse(200, updated[0], "Graded successfully"));
});

export const downloadSubmissionFile = asyncHandler(async (req, res) => {
  const { submissionId, fileIndex } = req.params;
  const [rows] = await executeQuery("SELECT files FROM submissions WHERE id = ?", [submissionId]);
  if (rows.length === 0) throw new ApiError("Submission not found", 404);

  let files = [];
  try { files = typeof rows[0].files === 'string' ? JSON.parse(rows[0].files) : rows[0].files || []; } catch (e) { }

  const file = files[fileIndex];
  if (!file) throw new ApiError("File not found", 404);

  // Assuming file object has url or path. 
  // If it's a URL (Cloudinary), redirect. If local path, download.
  // Based on previous contexts, likely Cloudinary URL.
  if (file.url) {
    return res.redirect(file.url);
  }

  // Fallback if just a string path
  res.download(file.path || file);
});
