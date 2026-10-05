import { Router } from "express";
import {
  getRolesAndPermissions,
  createCustomRole,
  updateRolePermissions,
  deleteCustomRole,
  assignRoleToUser,
  bulkAssignRoles,
  getUsersByRole,
  // New custom role (page-level) endpoints
  listCustomRoles,
  createNewCustomRole,
  updateCustomRole,
  deleteNewCustomRole,
  assignCustomRoleToUser,
  unassignCustomRole,
} from "../controllers/rolesPermissions.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import { authorizeRole } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";

const router = Router();

// All routes require authentication
router.use(verifyJWT);

// Existing system-role endpoints
router.get("/", authorizeRole([SYSTEM_PERMISSIONS.ROLE_READ]), getRolesAndPermissions);
router.post("/roles", authorizeRole([SYSTEM_PERMISSIONS.ROLE_CREATE]), createCustomRole);
router.patch("/roles/:roleId", authorizeRole([SYSTEM_PERMISSIONS.ROLE_UPDATE]), updateRolePermissions);
router.delete("/roles/:roleId", authorizeRole([SYSTEM_PERMISSIONS.ROLE_DELETE]), deleteCustomRole);
router.post("/assign", authorizeRole([SYSTEM_PERMISSIONS.ROLE_ASSIGN]), assignRoleToUser);
router.post("/bulk-assign", authorizeRole([SYSTEM_PERMISSIONS.ROLE_ASSIGN]), bulkAssignRoles);
router.get("/roles/:roleId/users", authorizeRole([SYSTEM_PERMISSIONS.ROLE_READ, SYSTEM_PERMISSIONS.USER_READ]), getUsersByRole);

// ── Custom (page-permission) roles ──────────────────────────────────────────
// Admin or above can manage custom roles
router.get("/custom-roles", authorizeRole([SYSTEM_PERMISSIONS.ROLE_READ]), listCustomRoles);
router.post("/custom-roles", authorizeRole([SYSTEM_PERMISSIONS.ROLE_CREATE]), createNewCustomRole);
router.put("/custom-roles/:id", authorizeRole([SYSTEM_PERMISSIONS.ROLE_UPDATE]), updateCustomRole);
router.delete("/custom-roles/:id", authorizeRole([SYSTEM_PERMISSIONS.ROLE_DELETE]), deleteNewCustomRole);
router.post("/custom-roles/:id/assign", authorizeRole([SYSTEM_PERMISSIONS.ROLE_ASSIGN]), assignCustomRoleToUser);
router.delete("/custom-roles/unassign/:userId", authorizeRole([SYSTEM_PERMISSIONS.ROLE_ASSIGN]), unassignCustomRole);

export default router;
