import { Router } from "express";
import {
    createSubmission,
    resubmitAssignment,
    getSubmissionByAssignment,
    getMySubmissions,
    gradeSubmission,
    getStudentSubmissions
} from "../controllers/submission.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

router.post("/", verifyJWT, authorizeRoles("isEmployee"), createSubmission);
router.patch("/resubmit", verifyJWT, authorizeRoles("isEmployee"), resubmitAssignment);
router.get("/assignment/:assignmentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), getSubmissionByAssignment);
router.get("/my", verifyJWT, authorizeRoles("isEmployee"), getMySubmissions);
router.get("/student/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), getStudentSubmissions);
router.patch("/grade/:submissionId", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), gradeSubmission);

export default router;
