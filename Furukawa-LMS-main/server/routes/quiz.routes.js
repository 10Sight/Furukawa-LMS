import { Router } from "express";
import {
    createQuiz,
    getAllQuizzes,
    getQuizById,
    updateQuiz,
    deleteQuiz,
    getAccessibleQuizzes,
    getCourseQuizzes,
    getQuizzesByCourse,
    getQuizzesByModule,
    getQuizzesByLesson
} from "../controllers/quiz.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import checkAccountStatus from "../middlewares/accountStatus.middleware.js";

const router = Router();

router.post("/", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "quiz:create"), createQuiz);
router.get("/", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "quiz:read"), checkAccountStatus(false), getAllQuizzes);
router.get("/accessible/:courseId/:moduleId", verifyJWT, authorizeRoles("isEmployee", "quiz:read"), checkAccountStatus(false), getAccessibleQuizzes);
router.get("/course/:courseId", verifyJWT, authorizeRoles("isEmployee", "quiz:read"), checkAccountStatus(false), getCourseQuizzes);
// New scoped endpoints
router.get("/by-course/:courseId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "quiz:read"), checkAccountStatus(false), getQuizzesByCourse);
router.get("/by-module/:moduleId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "quiz:read"), checkAccountStatus(false), getQuizzesByModule);
router.get("/by-lesson/:lessonId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "quiz:read"), checkAccountStatus(false), getQuizzesByLesson);
router.get("/:id", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "quiz:read"), checkAccountStatus(false), getQuizById);
router.put("/:id", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "quiz:update"), updateQuiz);
router.delete("/:id", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "quiz:delete"), deleteQuiz);

export default router;
