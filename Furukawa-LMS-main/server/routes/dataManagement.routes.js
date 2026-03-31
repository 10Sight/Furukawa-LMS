import { Router } from "express";
import {
    createDatabaseBackup,
    getBackupHistory,
    restoreFromBackup,
    deleteBackup,
    exportSystemData,
    importSystemData,
    getDataStatistics,
    getDataOperationHistory,
    cleanupOldData
} from "../controllers/dataManagement.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import upload from "../middleware/upload.js";

const router = Router();

// All data management routes require authentication and superadmin access
router.use(verifyJWT);
router.use(authorizeRoles("SUPERADMIN"));

// === DATABASE BACKUP ROUTES ===

// Create database backup
router.post("/backup", createDatabaseBackup);

// Get backup history
router.get("/backup/history", getBackupHistory);

// Restore from backup
router.post("/backup/:backupId/restore", restoreFromBackup);

// Delete backup
router.delete("/backup/:backupId", deleteBackup);

// === DATA EXPORT/IMPORT ROUTES ===

// Export system data
router.post("/export", exportSystemData);

// Import system data (with file upload)
router.post("/import", upload.single("dataFile"), importSystemData);

// === DATA ANALYTICS ROUTES ===

// Get data statistics
router.get("/statistics", getDataStatistics);

// Get data operation history
router.get("/history", getDataOperationHistory);

// === DATA CLEANUP ROUTES ===

// Clean up old data
router.post("/cleanup", cleanupOldData);

export default router;
