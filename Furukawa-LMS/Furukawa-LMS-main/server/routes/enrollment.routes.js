import { Router } from "express";
import {
    enrollStudent,
    unenrollStudent,
    getAllEnrollments,
    getStudentEnrollments,
    getCourseEnrollments,
    updateEnrollment,
    deleteEnrollment
} from "../controllers/enrollment.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import checkAccountStatus from "../middlewares/accountStatus.middleware.js";

const router = Router();

router.post("/", verifyJWT, authorizeRoles("isAdmin", "isTrainer"), enrollStudent);
router.post("/unenroll", verifyJWT, authorizeRoles("isAdmin", "isTrainer"), unenrollStudent);
router.get("/", verifyJWT, authorizeRoles("isAdmin", "isTrainer"), getAllEnrollments);
router.get("/student/:studentId", verifyJWT, authorizeRoles("isAdmin", "isTrainer", "isEmployee"), checkAccountStatus(true), getStudentEnrollments);
router.get("/course/:courseId", verifyJWT, authorizeRoles("isAdmin", "isTrainer"), getCourseEnrollments);
router.put("/:id", verifyJWT, authorizeRoles("isAdmin", "isTrainer"), updateEnrollment);
router.delete("/:id", verifyJWT, authorizeRoles("isAdmin", "isTrainer"), deleteEnrollment);

export default router;
