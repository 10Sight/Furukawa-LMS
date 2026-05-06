import { Router } from "express";
import multer from "multer";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { authorizeRole } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";
import { checkPrivilege } from "../middlewares/checkPrivilege.middleware.js";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateProfile,
  updateAvatar,
  deleteUser,
  bulkDeleteUsers,
  getAllInstructors,
  getAllStudents,
  getAllMentors,
  getAllSupervisors,
  getAllIncharges,
  getSoftDeletedUsers,
  restoreUser,
  getEmployees,
  getEmployeeById,
  getTemporaryUsers,
  getNextTemporaryId,
} from "../controllers/user.controller.js";
import { AvailableUserRoles } from "../constants.js";

const router = Router();
const upload = multer({ dest: "uploads/" }); // temp storage for avatar uploads

// Create user (admin/super-admin only) - sends welcome email with credentials
router.post("/", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_CREATE]), checkPrivilege("user management"), createUser);

// Get all users (admin/super-admin only)
router.get("/", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getAllUsers);

// Get all instructors (admin/super-admin only)
router.get("/instructors", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getAllInstructors);

// Get all students (admin/super-admin/instructor only)
router.get("/students", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getAllStudents);

// Get all mentors
router.get("/mentors", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getAllMentors);

// Get all supervisors
router.get("/supervisors", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getAllSupervisors);

// Get all incharges
router.get("/incharges", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getAllIncharges);

// Get employees (Onboarding & ID)
router.get("/employees", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getEmployees);
router.get("/employees/:id", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getEmployeeById);

// DOJO Hiring routes
router.get("/temporary", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getTemporaryUsers);
router.get("/temporary/next-id", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getNextTemporaryId);

// Super admin specific routes - must come before /:id routes
router.get("/deleted/all", verifyJWT, authorizeRoles("SUPERADMIN"), getSoftDeletedUsers);
router.patch("/deleted/:id/restore", verifyJWT, authorizeRoles("SUPERADMIN"), restoreUser);

// Update own profile
router.patch("/profile", verifyJWT, updateProfile);

// Update avatar
router.patch(
  "/avatar",
  verifyJWT,
  upload.single("avatar"),
  updateAvatar
);
router.get("/:id", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_READ]), getUserById);
router.patch("/:id", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_UPDATE]), checkPrivilege("user management"), updateUser);
router.delete("/bulk", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_DELETE]), checkPrivilege("user management"), bulkDeleteUsers);
router.delete("/:id", verifyJWT, authorizeRole([SYSTEM_PERMISSIONS.USER_DELETE]), checkPrivilege("user management"), deleteUser);

export default router;
