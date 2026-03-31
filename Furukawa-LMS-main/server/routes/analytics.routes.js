import { Router } from "express";
import {
    getDashboardStats,
    getUserStats,
    getCourseStats,
    getEngagementStats,
    getSystemHealth,
    getServerMetrics,
    getDatabaseMetrics,
    getSystemAlerts,
    getSystemPerformanceHistory,
    getComprehensiveAnalytics,
    generateCustomReport,
    exportAnalyticsData,
    getDepartmentQuizStats
} from "../controllers/analytics.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

// All analytics routes require authentication and admin/superadmin access
router.use(verifyJWT);
router.use(authorizeRoles("isAdmin", "SUPERADMIN"));

// Basic Analytics endpoints
router.get("/dashboard", getDashboardStats);
router.get("/users", getUserStats);
router.get("/courses", getCourseStats);
router.get("/engagement", getEngagementStats);
router.get("/health", getSystemHealth);

// Exam history stats and export
import { getExamHistoryStats, exportExamHistoryStats, getAuditStats, exportAuditStats } from "../controllers/analytics.controller.js";
router.get("/exams/history", getExamHistoryStats);
router.get("/exams/export", exportExamHistoryStats);

// Audit stats and export (aggregated)
router.get("/audits/stats", getAuditStats);
router.get("/audits/export", exportAuditStats);

// System Health Monitoring endpoints
router.get("/system/server-metrics", getServerMetrics);
router.get("/system/database-metrics", getDatabaseMetrics);
router.get("/system/alerts", getSystemAlerts);
router.get("/system/performance-history", getSystemPerformanceHistory);

// Advanced Analytics endpoints
router.get("/comprehensive", getComprehensiveAnalytics);
router.get("/department-quiz-stats", getDepartmentQuizStats);
router.post("/reports/generate", generateCustomReport);
router.post("/export", exportAnalyticsData);

export default router;
