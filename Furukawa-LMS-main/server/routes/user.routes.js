import { Router } from "express";
import multer from "multer";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { authorizeRole, authorizeAnyPermission, hasPermission } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";
import { checkPrivilege } from "../middlewares/checkPrivilege.middleware.js";
import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "../utils/ApiError.js";
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

// Explicit, per-target authorization for mutating a single user. Unlike the old
// checkUserUpdatePrivilege/checkUserDeletePrivilege, this never falls back to the generic
// checkPrivilege("user management") gate - that check treats any one of user/dojo_hiring/
// mentor permission (including an unrelated one like dojo_hiring:update) as sufficient,
// which would let a DOJO-only manager edit regular operators. Instead the exact permission
// required is derived from the target record's own current type:
//   - isTemporary = 1 (DOJO candidate)      -> requires dojo_hiring:{action}
//   - isMentor = 1 (and not temporary)      -> requires mentor:{action} (or user:{action})
//   - everything else (regular operator)    -> requires user:{action}
const authorizeUserMutation = (action) => async (req, res, next) => {
  try {
    if (req.user.role === 'SUPERADMIN' || req.user.isAdmin) {
      return next();
    }

    const [rows] = await executeQuery("SELECT isTemporary, isMentor FROM users WHERE id = ?", [req.params.id]);
    if (!rows?.length) {
      throw new ApiError("User not found", 404);
    }

    const target = rows[0];
    const permissions = req.user.customRole?.permissions || [];
    const verb = action === 'delete' ? 'delete' : 'update';

    if (target.isTemporary) {
      if (!permissions.includes(SYSTEM_PERMISSIONS[`DOJO_HIRING_${action.toUpperCase()}`])) {
        throw new ApiError(`Insufficient permissions to ${verb} DOJO candidate`, 403);
      }
    } else if (target.isMentor) {
      if (!permissions.includes(SYSTEM_PERMISSIONS[`MENTOR_${action.toUpperCase()}`]) && !permissions.includes(SYSTEM_PERMISSIONS[`USER_${action.toUpperCase()}`])) {
        throw new ApiError(`Insufficient permissions to ${verb} mentor`, 403);
      }
    } else {
      if (!permissions.includes(SYSTEM_PERMISSIONS[`USER_${action.toUpperCase()}`])) {
        throw new ApiError(`Insufficient permissions to ${verb} regular operator`, 403);
      }
    }

    next();
  } catch (e) {
    next(e);
  }
};

const authorizeUserUpdate = authorizeUserMutation('update');
const authorizeUserDelete = authorizeUserMutation('delete');

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
router.patch("/:id", verifyJWT, authorizeAnyPermission([SYSTEM_PERMISSIONS.USER_UPDATE, SYSTEM_PERMISSIONS.DOJO_HIRING_UPDATE, SYSTEM_PERMISSIONS.MENTOR_UPDATE]), authorizeUserUpdate, updateUser);
router.patch("/:id/admin-change-password", verifyJWT, adminChangePassword);
router.delete("/bulk", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_DELETE]), bulkDeleteUsers);
router.delete("/:id", verifyJWT, authorizeAnyPermission([SYSTEM_PERMISSIONS.USER_DELETE, SYSTEM_PERMISSIONS.DOJO_HIRING_DELETE, SYSTEM_PERMISSIONS.MENTOR_DELETE]), authorizeUserDelete, deleteUser);

export default router;
