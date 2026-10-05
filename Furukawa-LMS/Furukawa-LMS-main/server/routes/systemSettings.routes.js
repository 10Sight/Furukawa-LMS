import { Router } from "express";
import {
    getSystemSettings,
    updateSystemSettings,
    resetSystemSettings,
    getSystemSettingsHistory,
    validateSystemConfiguration
} from "../controllers/systemSettings.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

// All system settings routes require authentication and Super Admin privileges
router.use(verifyJWT);
router.use(authorizeRoles("SUPERADMIN"));

// Get current system settings
router.get("/", getSystemSettings);

// Update system settings
router.put("/", updateSystemSettings);

// Reset system settings to default
router.post("/reset", resetSystemSettings);

// Get system settings history (optional for audit trail)
router.get("/history", getSystemSettingsHistory);

// Validate current system configuration
router.get("/validate", validateSystemConfiguration);

export default router;
