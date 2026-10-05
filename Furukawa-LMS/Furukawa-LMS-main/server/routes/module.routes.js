import { Router } from "express";
import { createModule, getModulesByCourse, getModuleById, updateModule, deleteModule } from "../controllers/module.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import { authorizeRole } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";

const router = Router();

// Apply JWT verification to all routes
router.use(verifyJWT);

// Module CRUD operations with permission-based authorization
router.post("/", authorizeRole([SYSTEM_PERMISSIONS.MODULE_CREATE]), createModule);
router.get("/course/:courseId", authorizeRole([SYSTEM_PERMISSIONS.MODULE_READ]), getModulesByCourse);
router.get("/:moduleId", authorizeRole([SYSTEM_PERMISSIONS.MODULE_READ]), getModuleById);
router.put("/:moduleId", authorizeRole([SYSTEM_PERMISSIONS.MODULE_UPDATE]), updateModule);
router.delete("/:moduleId", authorizeRole([SYSTEM_PERMISSIONS.MODULE_DELETE]), deleteModule);

export default router;
