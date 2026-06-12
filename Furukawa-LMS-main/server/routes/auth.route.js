import { Router } from "express";
import {
  register,
  dojoRegister,
  login,
  logout,
  profile,
  forgotPassword,
  resetPassword,
  refreshAccessAndRefreshToken,
  changePassword,
} from "../controllers/auth.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import checkAccountStatus from "../middlewares/accountStatus.middleware.js";
import { authorizeAnyPermission } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword); 
router.post("/reset-password/:token", resetPassword);
router.post("/refresh-token", refreshAccessAndRefreshToken);

// Protected routes (require valid access token)
router.post("/dojo-register", verifyJWT, authorizeAnyPermission([SYSTEM_PERMISSIONS.USER_CREATE, SYSTEM_PERMISSIONS.DOJO_HIRING_CREATE]), dojoRegister);
router.get("/logout", verifyJWT, logout);
router.get("/profile", verifyJWT, checkAccountStatus(true), profile);
router.patch("/change-password", verifyJWT, changePassword);

export default router;

