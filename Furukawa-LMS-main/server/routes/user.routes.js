import { Router } from "express";
import multer from "multer";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
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
} from "../controllers/user.controller.js";
import { AvailableUserRoles } from "../constants.js";

const router = Router();
const upload = multer({ dest: "uploads/" }); // temp storage for avatar uploads

// Create user (admin/super-admin only) - sends welcome email with credentials
router.post("/", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), checkPrivilege("user management"), createUser);

// Get all users (admin/super-admin only)
router.get("/", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getAllUsers);

// Get all instructors (admin/super-admin only)
router.get("/instructors", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getAllInstructors);

// Get all students (admin/super-admin/instructor only)
router.get("/students", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "isTrainer"), getAllStudents);

// Get all mentors
router.get("/mentors", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getAllMentors);

// Get all supervisors
router.get("/supervisors", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getAllSupervisors);

// Get all incharges
router.get("/incharges", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getAllIncharges);

// Get employees (Onboarding & ID)
router.get("/employees", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getEmployees);
router.get("/employees/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getEmployeeById);

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
router.get("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN", "isTrainer"), getUserById);
router.patch("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), checkPrivilege("user management"), updateUser);
router.delete("/bulk", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), checkPrivilege("user management"), bulkDeleteUsers);
router.delete("/:id", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), checkPrivilege("user management"), deleteUser);

export default router;
