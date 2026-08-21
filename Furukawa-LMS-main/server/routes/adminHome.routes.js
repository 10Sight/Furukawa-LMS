import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { getAdminHomeDojoStats, getAdminHomeHandoverStats, getAdminHomeTestPaperStats, getAdminHomeUserStatusStats, getDojoHiringTrend, getDojoHandoverComparison, getSixteenDayMonitoringStatus, getThreeDayMonitoringStatus, getCycle10MonitoringStatus, getSkillMatrixCertificateStatus, getOperatorObservanceStatus, getOnJobTrainingStatus, getContractorWiseOperatorStats, getSkillUpgradationPlanStatus, getMultiSkillingPlanStatus } from "../controllers/adminHome.controller.js";

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

// Get Sixteen-Day Monitoring status breakdown (Started / Pending / Completed) for Admin Home
router.get("/sixteen-day-monitoring-status", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getSixteenDayMonitoringStatus);

// Get Three-Day Monitoring status breakdown for Admin Home
router.get("/three-day-monitoring-status", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getThreeDayMonitoringStatus);

// Get 10-Cycle Check status breakdown for Admin Home
router.get("/cycle10-monitoring-status", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getCycle10MonitoringStatus);

// Get Skill Matrix Certificate filled-item breakdown for Admin Home
router.get("/skill-matrix-status", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getSkillMatrixCertificateStatus);

// Get Operator Observance Sheet filled-column breakdown for Admin Home
router.get("/operator-observance-status", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getOperatorObservanceStatus);

// Get On-Job Training approved-user breakdown for Admin Home
router.get("/on-job-training-status", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getOnJobTrainingStatus);

// Get Contractor-wise Operator stats for Admin Home
router.get("/contractor-wise-operator-stats", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getContractorWiseOperatorStats);

// Get Skill Upgradation Plan comparison (Planned vs Actual) for Admin Home
router.get("/skill-upgradation-status", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getSkillUpgradationPlanStatus);

// Get Multi-Skilling Plan comparison (Planned vs Actual) for Admin Home
router.get("/multi-skilling-status", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getMultiSkillingPlanStatus);

export default router;
