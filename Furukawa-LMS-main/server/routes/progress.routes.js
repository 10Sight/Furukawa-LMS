import { Router } from "express";
import {
    initializeProgress,
    updateProgress,
    upgradeLevel,
    getMyProgress,
    getCourseProgress,
    getOrInitializeProgress,
    markModuleComplete,
    markLessonComplete,
    validateModuleAccess,
    getStudentProgress,
    getMyAllProgress,
    setStudentLevel,
    getCourseCompletionReport,
    getTimelineViolations,
    checkModuleAccessWithTimeline,
    updateCurrentAccessibleModule,
    getTenCycleCheck,
    saveTenCycleCheck,
    getThreeDayMonitoring,
    saveThreeDayMonitoring,
    getThreeDayMonitoringConfig,
    saveThreeDayMonitoringConfig,
    getThreeDayMonitoringHistory
} from "../controllers/progress.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import checkAccountStatus from "../middlewares/accountStatus.middleware.js";

const router = Router();

router.post("/", verifyJWT, authorizeRoles("isEmployee"), checkAccountStatus(false), initializeProgress);
router.patch("/", verifyJWT, authorizeRoles("isEmployee"), checkAccountStatus(false), updateProgress);
router.patch("/lesson-complete", verifyJWT, authorizeRoles("isEmployee"), checkAccountStatus(false), markLessonComplete);
router.patch("/module-complete", verifyJWT, authorizeRoles("isEmployee"), checkAccountStatus(false), markModuleComplete);
router.patch("/upgrade-level", verifyJWT, authorizeRoles("isEmployee"), checkAccountStatus(false), upgradeLevel);
router.patch("/admin/set-level", verifyJWT, authorizeRoles("isAdmin"), setStudentLevel);
router.get("/my/:courseId", verifyJWT, authorizeRoles("isEmployee"), checkAccountStatus(false), getMyProgress);
router.get("/my", verifyJWT, authorizeRoles("isEmployee"), checkAccountStatus(true), getMyAllProgress);
router.get("/init/:courseId", verifyJWT, authorizeRoles("isEmployee"), checkAccountStatus(false), getOrInitializeProgress);
router.get("/validate-access/:courseId/:moduleId", verifyJWT, authorizeRoles("isEmployee"), checkAccountStatus(false), validateModuleAccess);
router.get("/course/:courseId", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), getCourseProgress);
router.get("/report/:courseId", verifyJWT, authorizeRoles("isEmployee"), checkAccountStatus(false), getCourseCompletionReport);
router.get("/student/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), getStudentProgress);

// Timeline-related routes
router.get("/timeline-violations/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee"), getTimelineViolations);
router.get("/timeline-access/:courseId/:moduleId", verifyJWT, authorizeRoles("isEmployee"), checkAccountStatus(false), checkModuleAccessWithTimeline);
router.patch("/admin/update-accessible-module", verifyJWT, authorizeRoles("isAdmin"), updateCurrentAccessibleModule);

// 10 Cycle Check
router.get("/ten-cycle-check/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee"), getTenCycleCheck);
router.post("/ten-cycle-check/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), saveTenCycleCheck);

// 3 Day Monitoring
router.get("/three-day-monitoring/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee"), getThreeDayMonitoring);
router.post("/three-day-monitoring/:studentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), saveThreeDayMonitoring);

// 3 Day Monitoring Config
router.get("/three-day-monitoring/config/:departmentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee"), getThreeDayMonitoringConfig);
router.post("/three-day-monitoring/config/save", verifyJWT, authorizeRoles("isTrainer", "isAdmin"), saveThreeDayMonitoringConfig);
router.get("/three-day-monitoring/history/:departmentId", verifyJWT, authorizeRoles("isTrainer", "isAdmin", "isEmployee"), getThreeDayMonitoringHistory);

export default router;
