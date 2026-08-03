import { Router } from "express";
import {
    createDepartment,
    assignInstructor,
    addStudentToDepartment,
    removeStudentFromDepartment,
    getAllDepartments,
    getAllDepartmentsProgress,
    getDepartmentById,
    getDepartmentTrainees,
    updateDepartment,
    deleteDepartment,
    removeInstructor,
    getMyDepartment,
    getMyDepartments,
    getDepartmentAssessments,
    getDepartmentProgress,
    getDepartmentSubmissions,
    getDepartmentAttempts,
    getDepartmentCourseContent,
    // Department status management
    updateAllDepartmentStatuses,
    updateDepartmentStatus,
    cancelDepartment,
    getMyDepartmentNotifications,
    getDepartmentStatusInfo,
    getDepartmentSchedulerStatus,
    restartDepartmentScheduler,
    // Department cleanup management
    getDepartmentsScheduledForCleanup,
    triggerDepartmentCleanup,
    getDepartmentCleanupStatus,
    restartDepartmentCleanupScheduler,
    sendManualCleanupWarning,
    getHandoverSheet,
    saveHandoverSheet,
    getHandoverSheetConfig,
    saveHandoverSheetConfig,
    getHandoverSheetHistory,
    sendHandoverPDF,
    getStudentHandoverHistory,
    getHandoverEligibilityDetails,
    bypassHandoverEligibility,
    revokeHandoverEligibilityOverride,
    getHandoverSheetsMonitoring,
    deleteHandoverSheet,
    bulkDeleteHandoverSheets,
    getDojoHiringConfigs,
    saveDojoHiringConfig
} from "../controllers/department.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { authorizeRole, authorizeAnyPermission } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";
import checkAccountStatus from "../middlewares/accountStatus.middleware.js";

const router = Router();

router.post("/", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.DEPARTMENT_CREATE]), createDepartment);
router.post("/assign-instructor", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.DEPARTMENT_UPDATE]), assignInstructor);
router.post('/remove-instructor', verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.DEPARTMENT_UPDATE]), removeInstructor);
router.post("/add-student", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.DEPARTMENT_MANAGE_STUDENTS]), addStudentToDepartment);
router.post("/remove-student", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.DEPARTMENT_MANAGE_STUDENTS]), removeStudentFromDepartment);
// Specific routes first to avoid conflicts
router.get("/me/my-department", verifyJWT, authorizeRoles("isEmployee", "isTrainer", "isAdmin", "SUPERADMIN"), checkAccountStatus(true), getMyDepartment);
router.get("/me/my-departments", verifyJWT, authorizeRoles("isEmployee", "isTrainer", "isAdmin", "SUPERADMIN"), checkAccountStatus(true), getMyDepartments);
router.get("/me/course-content", verifyJWT, authorizeRoles("isEmployee", "isTrainer", "isAdmin", "SUPERADMIN"), checkAccountStatus(false), getDepartmentCourseContent);
router.get("/me/assessments", verifyJWT, authorizeRoles("isEmployee"), checkAccountStatus(false), getDepartmentAssessments);

// Global Progress Route (Must be before /:id routes)
router.get("/progress/all", verifyJWT, authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"), getAllDepartmentsProgress);

// Soft delete routes removed as per permanent deletion requirement

// General routes
// General routes
router.get("/", verifyJWT, authorizeAnyPermission([SYSTEM_PERMISSIONS.DEPARTMENT_READ, SYSTEM_PERMISSIONS.DOJO_HANDOVER_SHEET]), getAllDepartments);
router.get("/:id", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.DEPARTMENT_READ]), getDepartmentById);
router.get("/:id/trainees", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.DEPARTMENT_READ]), getDepartmentTrainees);
router.get("/:id/progress", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.DEPARTMENT_READ]), getDepartmentProgress);
router.get("/:id/submissions", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.DEPARTMENT_READ]), getDepartmentSubmissions);
router.get("/:id/attempts", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.DEPARTMENT_READ]), getDepartmentAttempts);
router.put("/:id", verifyJWT, authorizeRoles("isAdmin"), updateDepartment);
router.delete("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), deleteDepartment);

// ==================== DEPARTMENT STATUS MANAGEMENT ROUTES ====================

// Department status update routes (Admin/SuperAdmin)
router.post("/status/update-all", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), updateAllDepartmentStatuses);
router.patch("/status/:id/update", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), updateDepartmentStatus);
router.post("/:id/cancel", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), cancelDepartment);

// Department status information routes
router.get("/status/:id/info", verifyJWT, authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"), getDepartmentStatusInfo);

// Department notification routes
router.get("/notifications/my-department", verifyJWT, authorizeRoles("isEmployee", "isTrainer"), checkAccountStatus(true), getMyDepartmentNotifications);
router.get("/notifications/:departmentId", verifyJWT, authorizeRoles("isEmployee", "isTrainer"), checkAccountStatus(true), getMyDepartmentNotifications);

// Department scheduler management (SuperAdmin only)
router.get("/scheduler/status", verifyJWT, authorizeRoles("SUPERADMIN"), getDepartmentSchedulerStatus);
router.post("/scheduler/restart", verifyJWT, authorizeRoles("SUPERADMIN"), restartDepartmentScheduler);

// ==================== DEPARTMENT CLEANUP MANAGEMENT ROUTES ====================

// Department cleanup information routes (Admin)
router.get("/cleanup/scheduled", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getDepartmentsScheduledForCleanup);
router.get("/cleanup/status", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getDepartmentCleanupStatus);

// Department cleanup control routes (SuperAdmin only)
router.post("/cleanup/trigger", verifyJWT, authorizeRoles("SUPERADMIN"), triggerDepartmentCleanup);
router.post("/cleanup/scheduler/restart", verifyJWT, authorizeRoles("SUPERADMIN"), restartDepartmentCleanupScheduler);
router.post("/cleanup/warnings/send", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), sendManualCleanupWarning);

// Handover Sheet
router.get("/handover-sheet/monitoring", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.HANDOVER_SHEET_READ]), getHandoverSheetsMonitoring);
router.delete("/handover-sheet/:id", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.HANDOVER_SHEET_DELETE]), deleteHandoverSheet);
router.post("/handover-sheet/bulk-delete", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.HANDOVER_SHEET_DELETE]), bulkDeleteHandoverSheets);
router.get("/:id/handover-sheet", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.HANDOVER_SHEET_READ]), getHandoverSheet);
router.post("/:id/handover-sheet", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.HANDOVER_SHEET_MANAGE]), saveHandoverSheet);
router.get("/handover-sheet/config/:id", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.HANDOVER_SHEET_READ]), getHandoverSheetConfig);
router.post("/handover-sheet/config/save", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.HANDOVER_SHEET_EDIT_LAYOUT]), saveHandoverSheetConfig);
router.get("/handover-sheet/history/:id", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.HANDOVER_SHEET_READ]), getHandoverSheetHistory);
router.post("/handover-sheet/pdf/send", verifyJWT, sendHandoverPDF);
router.get("/handover-sheet/student/:studentId", verifyJWT, getStudentHandoverHistory);
router.get("/handover-sheet/eligibility-check/:studentId", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.HANDOVER_SHEET_READ]), getHandoverEligibilityDetails);
router.post("/handover-sheet/bypass-eligibility/:studentId", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), bypassHandoverEligibility);
router.post("/handover-sheet/revoke-eligibility/:studentId", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), revokeHandoverEligibilityOverride);

// Dojo Hiring Configs
router.get("/dojo-hiring/configs", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.DOJO_HIRING_READ]), getDojoHiringConfigs);
router.post("/dojo-hiring/config", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.DOJO_HIRING_UPDATE]), saveDojoHiringConfig);

export default router;
