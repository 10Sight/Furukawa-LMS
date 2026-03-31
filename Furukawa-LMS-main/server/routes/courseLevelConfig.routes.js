import { Router } from "express";
import {
  getActiveConfig,
  getAllConfigs,
  getConfigById,
  createConfig,
  updateConfig,
  deleteConfig,
  setAsDefault,
  validateCompatibility,
  migrateLevels
} from "../controllers/courseLevelConfig.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

// Public route - needed for students to see their level information
router.get("/active", getActiveConfig);

// Admin and SuperAdmin routes
router.get("/", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getAllConfigs);
router.get("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getConfigById);
router.post("/", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), createConfig);
router.patch("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), updateConfig);
router.delete("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), deleteConfig);
router.patch("/:id/set-default", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), setAsDefault);

// Validation and migration routes
router.post("/validate-compatibility", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), validateCompatibility);
router.post("/migrate-levels", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), migrateLevels);

export default router;
