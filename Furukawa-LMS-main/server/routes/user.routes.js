import { Router } from "express";
import multer from "multer";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { authorizeRole, authorizeAnyPermission, hasPermission } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";
import { checkPrivilege } from "../middlewares/checkPrivilege.middleware.js";
import { executeQuery } from "../db/mssqlHelper.js";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateProfile,
  updateAvatar,
  deleteUser,
  bulkDeleteUsers,
  bulkUpdateShiftSchedule,
  bulkUpdateStatusLeft,
  getAllInstructors,
  getAllStudents,
  getAllMentors,
  getMentorMentees,
  getAllSupervisors,
  getAllIncharges,
  getSoftDeletedUsers,
  restoreUser,
  getEmployees,
  getEmployeeById,
  getTemporaryUsers,
  getNextTemporaryId,
  adminChangePassword,
} from "../controllers/user.controller.js";
import { AvailableUserRoles } from "../constants.js";

const router = Router();
const upload = multer({ dest: "uploads/" }); // temp storage for avatar uploads

// Intermediate wrappers to allow DOJO Candidate managers to bypass normal user privilege constraints on temporary candidate records
const checkUserManagementPrivilege = (req, res, next) => {
  const isTemporary = req.body.isTemporary === true || String(req.body.isTemporary) === 'true';
  const hasDojoCreate = req.user.role === 'SUPERADMIN' || req.user.customRole?.permissions?.includes(SYSTEM_PERMISSIONS.DOJO_HIRING_CREATE);
  
  if (isTemporary && hasDojoCreate) {
    return next(); // bypass checkPrivilege
  }
  
  return checkPrivilege("user management")(req, res, next);
};

const checkUserUpdatePrivilege = async (req, res, next) => {
  const hasDojoUpdate = req.user.role === 'SUPERADMIN' || req.user.customRole?.permissions?.includes(SYSTEM_PERMISSIONS.DOJO_HIRING_UPDATE);
  
  if (hasDojoUpdate) {
    try {
      // If the target user is temporary, bypass checkPrivilege
      const [targetUser] = await executeQuery("SELECT isTemporary FROM users WHERE id = ?", [req.params.id]);
      if (targetUser?.length && targetUser[0].isTemporary) {
        return next();
      }
    } catch (e) {
      console.error("[checkUserUpdatePrivilege Error]", e);
    }
  }
  
  return checkPrivilege("user management")(req, res, next);
};

const checkUserDeletePrivilege = async (req, res, next) => {
  const hasDojoDelete = req.user.role === 'SUPERADMIN' || req.user.customRole?.permissions?.includes(SYSTEM_PERMISSIONS.DOJO_HIRING_DELETE);
  
  if (hasDojoDelete) {
    try {
      // If the target user is temporary, bypass checkPrivilege
      const [targetUser] = await executeQuery("SELECT isTemporary FROM users WHERE id = ?", [req.params.id]);
      if (targetUser?.length && targetUser[0].isTemporary) {
        return next();
      }
    } catch (e) {
      console.error("[checkUserDeletePrivilege Error]", e);
    }
  }
  
  return checkPrivilege("user management")(req, res, next);
};

// Create user (admin/super-admin only) - sends welcome email with credentials
router.post("/", verifyJWT, authorizeAnyPermission([SYSTEM_PERMISSIONS.USER_CREATE, SYSTEM_PERMISSIONS.DOJO_HIRING_CREATE, SYSTEM_PERMISSIONS.MENTOR_CREATE]), checkUserManagementPrivilege, createUser);

// Get all users - full list for admin/super-admin, scoped to the requester's
// assigned departments/sections (via applyUserScopeRestriction in getAllUsers) for
// custom roles that only need to look up users within their own workflows.
router.get("/", verifyJWT, authorizeAnyPermission([
  SYSTEM_PERMISSIONS.USER_READ,
  SYSTEM_PERMISSIONS.DOJO_EVALUATION_TEST_TAKE,
  SYSTEM_PERMISSIONS.DOJO_EVALUATION_TEST_VIEW,
  SYSTEM_PERMISSIONS.DOJO_HIRING_READ,
  SYSTEM_PERMISSIONS.MULTI_SKILLING_MANAGE,
  SYSTEM_PERMISSIONS.SKILL_UPGRADATION_MANAGE,
  SYSTEM_PERMISSIONS.ON_JOB_TRAINING_READ,
  SYSTEM_PERMISSIONS.EVALUATION_READ
]), getAllUsers);

// Get all instructors (admin/super-admin only)
router.get("/instructors", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getAllInstructors);

// Get all students (admin/super-admin/instructor only)
router.get("/students", verifyJWT, authorizeRoles(SYSTEM_PERMISSIONS.USER_READ, SYSTEM_PERMISSIONS.DOJO_HANDOVER_SHEET, "isTrainer", "isAdmin"), getAllStudents);

// Get all mentors
router.get("/mentors", verifyJWT, authorizeAnyPermission([SYSTEM_PERMISSIONS.USER_READ, SYSTEM_PERMISSIONS.MENTOR_READ]), getAllMentors);

// Get a single mentor's assigned mentees (must come before the generic /:id route)
router.get("/mentors/:id/mentees", verifyJWT, authorizeAnyPermission([SYSTEM_PERMISSIONS.USER_READ, SYSTEM_PERMISSIONS.MENTOR_READ]), getMentorMentees);

// Get all supervisors
router.get("/supervisors", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getAllSupervisors);

// Get all incharges
router.get("/incharges", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getAllIncharges);

// Get employees (Onboarding & ID)
router.get("/employees", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getEmployees);
router.get("/employees/:id", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getEmployeeById);

// DOJO Hiring routes
router.get("/temporary", verifyJWT, authorizeAnyPermission([SYSTEM_PERMISSIONS.USER_READ, SYSTEM_PERMISSIONS.DOJO_HIRING_READ]), getTemporaryUsers);
router.get("/temporary/next-id", verifyJWT, authorizeAnyPermission([SYSTEM_PERMISSIONS.USER_READ, SYSTEM_PERMISSIONS.DOJO_HIRING_READ]), getNextTemporaryId);

// Super admin / admin specific routes - must come before /:id routes
router.get("/deleted/all", verifyJWT, authorizeRoles("SUPERADMIN", "isAdmin"), getSoftDeletedUsers);
router.patch("/deleted/:id/restore", verifyJWT, authorizeRoles("SUPERADMIN", "isAdmin"), restoreUser);

// Update own profile
router.patch("/profile", verifyJWT, updateProfile);

// Update avatar
router.patch(
  "/avatar",
  verifyJWT,
  upload.single("avatar"),
  updateAvatar
);
router.post("/bulk-shift", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_UPDATE]), checkPrivilege("user management"), bulkUpdateShiftSchedule);
router.post("/bulk-left", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_UPDATE]), checkPrivilege("user management"), bulkUpdateStatusLeft);
router.get("/:id", verifyJWT, authorizeAnyPermission([SYSTEM_PERMISSIONS.USER_READ, SYSTEM_PERMISSIONS.DOJO_HIRING_READ]), getUserById);
router.patch("/:id", verifyJWT, authorizeAnyPermission([SYSTEM_PERMISSIONS.USER_UPDATE, SYSTEM_PERMISSIONS.DOJO_HIRING_UPDATE, SYSTEM_PERMISSIONS.MENTOR_UPDATE]), checkUserUpdatePrivilege, updateUser);
router.patch("/:id/admin-change-password", verifyJWT, adminChangePassword);
router.delete("/bulk", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_DELETE]), checkPrivilege("user management"), bulkDeleteUsers);
router.delete("/:id", verifyJWT, authorizeAnyPermission([SYSTEM_PERMISSIONS.USER_DELETE, SYSTEM_PERMISSIONS.DOJO_HIRING_DELETE, SYSTEM_PERMISSIONS.MENTOR_DELETE]), checkUserDeletePrivilege, deleteUser);

export default router;
