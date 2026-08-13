import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { getAdminHomeDojoStats, getAdminHomeHandoverStats, getAdminHomeTestPaperStats, getAdminHomeUserStatusStats, getDojoHiringTrend, getDojoHandoverComparison, getSixteenDayMonitoringComparison, getContractorWiseOperatorStats } from "../controllers/adminHome.controller.js";

const router = Router();

// Get Dojo Hiring stats for Admin Home
router.get("/dojo-stats", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getAdminHomeDojoStats);

// Get Handover Plan vs Actual stats for Admin Home
router.get("/handover-stats", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getAdminHomeHandoverStats);

// Get Test Paper Pass stats for Admin Home
router.get("/test-paper-stats", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getAdminHomeTestPaperStats);

// Get User Status distribution stats for Admin Home
router.get("/user-status-stats", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getAdminHomeUserStatusStats);

// Get Dojo Hiring monthly trend for Admin Home
router.get("/dojo-hiring-trend", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getDojoHiringTrend);

// Get Dojo Handover Comparison (Expected vs Actual) for Admin Home
router.get("/dojo-handover-comparison", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getDojoHandoverComparison);

// Get Sixteen-Day Monitoring Comparison (Expected vs Actual + Avg Score) for Admin Home
router.get("/sixteen-day-monitoring-comparison", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getSixteenDayMonitoringComparison);

// Get Contractor-wise Operator stats for Admin Home
router.get("/contractor-wise-operator-stats", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getContractorWiseOperatorStats);

export default router;
