import { Router } from "express";
import {
    getSixteenDayMonitoring,
    saveSixteenDayMonitoring,
    getSixteenDayMonitoringConfig,
    saveSixteenDayMonitoringConfig,
    saveSixteenDayMonitoringConfigWithRevision,
    getSixteenDayMonitoringHistory,
    getStudentSixteenDayMonitoringHistory,
    sendSixteenDayMonitoringEmail,
    sendCombinedMonitoringEmail,
    listSixteenDayMonitoring
} from "../controllers/sixteenDayMonitoring.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

router.get("/", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "sixteen_day:manage"), listSixteenDayMonitoring);

router.get("/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "sixteen_day:manage", "sixteen_day:check"), getSixteenDayMonitoring);
router.get("/:studentId/history", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "sixteen_day:manage"), getStudentSixteenDayMonitoringHistory);
router.post("/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "sixteen_day:manage", "sixteen_day:check"), saveSixteenDayMonitoring);
router.post("/:studentId/email", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "sixteen_day:manage"), sendSixteenDayMonitoringEmail);
router.post("/:studentId/combined-email", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "sixteen_day:manage"), sendCombinedMonitoringEmail);

// 16 Day Monitoring Config
router.get("/config/:departmentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "sixteen_day:edit_layout", "sixteen_day:manage"), getSixteenDayMonitoringConfig);
router.post("/config/save", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "sixteen_day:edit_layout", "sixteen_day:manage"), saveSixteenDayMonitoringConfig);
router.post("/config/save-with-revision", verifyJWT, authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN", "sixteen_day:edit_layout", "sixteen_day:manage", "revision:update"), saveSixteenDayMonitoringConfigWithRevision);
router.get("/history/:departmentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee", "sixteen_day:edit_layout", "sixteen_day:manage"), getSixteenDayMonitoringHistory);

export default router;
