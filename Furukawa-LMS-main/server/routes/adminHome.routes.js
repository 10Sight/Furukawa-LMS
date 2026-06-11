import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { getAdminHomeDojoStats, getAdminHomeHandoverStats, getAdminHomeTestPaperStats, getAdminHomeUserStatusStats, getDojoHiringTrend } from "../controllers/adminHome.controller.js";

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

export default router;
