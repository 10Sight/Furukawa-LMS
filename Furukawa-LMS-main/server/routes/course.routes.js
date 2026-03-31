import { Router } from "express";
import {
    createCourse,
    getCourses,
    getCourseById,
    updatedCourse,
    deleteCourse,
    togglePublishCourse,
    getCourseAnalytics,
    getCourseStudents,
    getSoftDeletedCourses,
    restoreCourse
} from "../controllers/course.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

router.post("/", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), createCourse);

// Super admin specific routes - must come before /:id routes
router.get("/deleted/all", verifyJWT, authorizeRoles("SUPERADMIN"), getSoftDeletedCourses);
router.patch("/deleted/:id/restore", verifyJWT, authorizeRoles("SUPERADMIN"), restoreCourse);

router.get("/", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "SUPERADMIN"), getCourses);
router.get("/:id", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee"), getCourseById);
router.get("/:id/analytics", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), getCourseAnalytics);
router.get("/:id/students", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), getCourseStudents);
router.put("/:id", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), updatedCourse);
router.delete("/:id", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "SUPERADMIN"), deleteCourse);
router.patch("/:id/toggle-publish", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), togglePublishCourse);

export default router;
