import { Router } from "express";
import {
    createAssignment,
    getAllAssignments,
    getAssigmentById,
    updatedAssignment,
    deleteAssignment,
    getAccessibleAssignments,
    getCourseAssignments,
    getAssignmentsByCourse,
    getAssignmentsByModule,
    getAssignmentsByLesson
} from "../controllers/assignment.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import checkAccountStatus from "../middlewares/accountStatus.middleware.js";

const router = Router();

router.post("/", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "assignment:create"), createAssignment);
router.get("/", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "assignment:read"), checkAccountStatus(false), getAllAssignments);
router.get("/accessible/:courseId/:moduleId", verifyJWT, authorizeRoles("isEmployee", "assignment:read"), checkAccountStatus(false), getAccessibleAssignments);
router.get("/course/:courseId", verifyJWT, authorizeRoles("isEmployee", "assignment:read"), checkAccountStatus(false), getCourseAssignments);
// New scoped endpoints
router.get("/by-course/:courseId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "assignment:read"), checkAccountStatus(false), getAssignmentsByCourse);
router.get("/by-module/:moduleId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "assignment:read"), checkAccountStatus(false), getAssignmentsByModule);
router.get("/by-lesson/:lessonId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "assignment:read"), checkAccountStatus(false), getAssignmentsByLesson);
router.get("/:id", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "assignment:read"), checkAccountStatus(false), getAssigmentById);
router.put("/:id", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "assignment:update"), updatedAssignment);
router.delete("/:id", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "assignment:delete"), deleteAssignment);

export default router;
