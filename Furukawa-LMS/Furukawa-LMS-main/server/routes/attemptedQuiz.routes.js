import { Router } from "express";
import {
    attemptQuiz,
    getMyAttempts,
    getAttemptsQuiz,
    getAttemptById,
    deleteAttempt,
    getStudentAttempts,
    startQuiz,
    submitQuiz,
    getQuizAttemptStatus,
    adminUpdateAttempt,
    requestExtraAttempt,
    listExtraAttemptRequests,
    approveExtraAttempt,
    rejectExtraAttempt,
    getMonitoringAttempts
} from "../controllers/attemptedQuiz.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

router.post("/", verifyJWT, authorizeRoles("isEmployee", "test_paper:read"), attemptQuiz);

// New quiz flow routes - put specific routes BEFORE generic ones
router.get("/start/:quizId", verifyJWT, authorizeRoles("isEmployee", "isTrainer", "isAdmin", "test_paper:read"), startQuiz);
router.post("/submit", verifyJWT, authorizeRoles("isEmployee", "isTrainer", "isAdmin", "test_paper:read"), submitQuiz);
router.get("/status/:quizId", verifyJWT, authorizeRoles("isEmployee", "isTrainer", "isAdmin", "test_paper:read"), getQuizAttemptStatus);

// Monitoring endpoint for Trainer and Admin
router.get("/monitoring", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), getMonitoringAttempts);

// Extra attempt requests
router.post("/extra-requests", verifyJWT, authorizeRoles("isEmployee", "test_paper:read"), requestExtraAttempt);
router.get("/extra-requests", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), listExtraAttemptRequests);
router.patch("/extra-requests/:id/approve", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), approveExtraAttempt);
router.patch("/extra-requests/:id/reject", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), rejectExtraAttempt);

// Other specific routes
router.get("/my", verifyJWT, authorizeRoles("isEmployee", "test_paper:read"), getMyAttempts);
router.get("/quiz/:quizId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "test_paper:read"), getAttemptsQuiz);
router.get("/student/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "test_paper:read"), getStudentAttempts);

// Generic routes - put these LAST to avoid conflicts
router.get("/:id", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "test_paper:read"), getAttemptById);
router.delete("/:id", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), deleteAttempt);
router.patch("/:id/admin-update", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), adminUpdateAttempt);

export default router;
