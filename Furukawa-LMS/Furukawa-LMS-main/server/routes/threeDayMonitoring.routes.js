import { Router } from "express";
import {
    getThreeDayMonitoring,
    saveThreeDayMonitoring,
    getThreeDayMonitoringConfig,
    saveThreeDayMonitoringConfig,
    getThreeDayMonitoringHistory,
    getStudentThreeDayMonitoringHistory,
    sendThreeDayMonitoringEmail,
    listThreeDayMonitoring
} from "../controllers/threeDayMonitoring.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

router.get("/", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "three_day:manage", "three_day:edit", "three_day:edit_submitted"), listThreeDayMonitoring);

router.get("/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "three_day:manage", "three_day:edit", "three_day:edit_submitted"), getThreeDayMonitoring);
router.get("/:studentId/history", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "three_day:manage", "three_day:edit", "three_day:edit_submitted"), getStudentThreeDayMonitoringHistory);
router.post("/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "three_day:manage", "three_day:edit", "three_day:edit_submitted"), saveThreeDayMonitoring);
router.post("/:studentId/email", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "three_day:manage"), sendThreeDayMonitoringEmail);

// 3 Day Monitoring Config
router.get("/config/:departmentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "three_day:edit_layout", "three_day:manage"), getThreeDayMonitoringConfig);
router.post("/config/save", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "three_day:edit_layout", "three_day:manage"), saveThreeDayMonitoringConfig);
router.get("/history/:departmentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "three_day:edit_layout", "three_day:manage"), getThreeDayMonitoringHistory);

export default router;
