import { Router } from "express";
import {
    getSixteenDayMonitoring,
    saveSixteenDayMonitoring,
    getSixteenDayMonitoringConfig,
    saveSixteenDayMonitoringConfig,
    getSixteenDayMonitoringHistory
} from "../controllers/sixteenDayMonitoring.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

router.get("/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee"), getSixteenDayMonitoring);
router.post("/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), saveSixteenDayMonitoring);

// 16 Day Monitoring Config
router.get("/config/:departmentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee"), getSixteenDayMonitoringConfig);
router.post("/config/save", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), saveSixteenDayMonitoringConfig);
router.get("/history/:departmentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee"), getSixteenDayMonitoringHistory);

export default router;
