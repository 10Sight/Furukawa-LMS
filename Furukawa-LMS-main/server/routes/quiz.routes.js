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

router.post("/", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), createQuiz);
router.get("/", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee"), checkAccountStatus(false), getAllQuizzes);
router.get("/accessible/:courseId/:moduleId", verifyJWT, authorizeRoles("isEmployee"), checkAccountStatus(false), getAccessibleQuizzes);
router.get("/course/:courseId", verifyJWT, authorizeRoles("isEmployee"), checkAccountStatus(false), getCourseQuizzes);
// New scoped endpoints
router.get("/by-course/:courseId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee"), checkAccountStatus(false), getQuizzesByCourse);
router.get("/by-module/:moduleId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee"), checkAccountStatus(false), getQuizzesByModule);
router.get("/by-lesson/:lessonId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee"), checkAccountStatus(false), getQuizzesByLesson);
router.get("/:id", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee"), checkAccountStatus(false), getQuizById);
router.put("/:id", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), updateQuiz);
router.delete("/:id", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), deleteQuiz);

export default router;
