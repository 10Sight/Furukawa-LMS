import { Router } from "express";
import { 
    createEvaluationTest, 
    getAllEvaluationTests, 
    getEvaluationTestById, 
    updateEvaluationTest, 
    deleteEvaluationTest,
    createEvaluationTestAttempt,
    getAllEvaluationTestAttempts,
    getEvaluationTestAttemptById,
    getEvaluationTestAttemptsByTestId,
    updateEvaluationTestAttempt,
    deleteEvaluationTestAttempt
} from "../controllers/evaluationTest.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

// Protect all routes with JWT authentication
router.use(verifyJWT);

// Student Grading / Attempt Sheet APIs
router.post("/attempts", createEvaluationTestAttempt);
router.get("/attempts", getAllEvaluationTestAttempts);
router.get("/attempts/:id", getEvaluationTestAttemptById);
router.put("/attempts/:id", updateEvaluationTestAttempt);
router.delete("/attempts/:id", deleteEvaluationTestAttempt);
router.get("/:testId/attempts", getEvaluationTestAttemptsByTestId);

// Core Template APIs
router.post("/", createEvaluationTest);
router.get("/", getAllEvaluationTests);
router.get("/:id", getEvaluationTestById);
router.put("/:id", updateEvaluationTest);
router.delete("/:id", deleteEvaluationTest);

export default router;
