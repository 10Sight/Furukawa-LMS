import express from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import {
  login,
  getDashboardStats,
  getAssignedCourses,
  getCourseDetails,
  getAssignedDepartments,
  getDepartmentDetails,
  getDepartmentStudents,
  getStudentProgress,
  getDepartmentQuizAttempts,
  getQuizDetails,
  getStudentQuizAttempts,
  getDepartmentAssignmentSubmissions,
  getAssignmentDetails,
  getStudentAssignmentSubmissions,
  getSubmissionDetails,
  gradeInstructorSubmission,
  downloadSubmissionFile,
} from "../controllers/instructor.controller.js";

const router = express.Router();

// Authentication routes
router.post("/auth/login", login);

// Protected routes (require instructor authentication)
router.use(verifyJWT);
router.use(authorizeRoles("isTrainer"));

// Dashboard routes
router.get("/dashboard/stats", getDashboardStats);

// Course routes - only published courses assigned to instructor
router.get("/courses", getAssignedCourses);
router.get("/courses/:courseId", getCourseDetails);

// Department routes - only departments assigned to instructor
router.get("/departments", getAssignedDepartments);
router.get("/departments/:departmentId", getDepartmentDetails);
router.get("/departments/:departmentId/students", getDepartmentStudents);

// Student progress tracking
router.get("/students/:studentId/progress", getStudentProgress);

// Quiz monitoring - read only
router.get("/departments/:departmentId/quiz-attempts", getDepartmentQuizAttempts);
router.get("/quizzes/:quizId", getQuizDetails);
router.get("/students/:studentId/quiz-attempts/:quizId", getStudentQuizAttempts);

// Assignment monitoring - read only
router.get("/departments/:departmentId/assignment-submissions", getDepartmentAssignmentSubmissions);
router.get("/assignments/:assignmentId", getAssignmentDetails);
router.get("/students/:studentId/assignment-submissions/:assignmentId", getStudentAssignmentSubmissions);

// Submission management - view details, grade, and download files
router.get("/submissions/:submissionId", getSubmissionDetails);
router.patch("/submissions/:submissionId/grade", gradeInstructorSubmission);
router.get("/submissions/:submissionId/files/:fileIndex", downloadSubmissionFile);

export default router;
