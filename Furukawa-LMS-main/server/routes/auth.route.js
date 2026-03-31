import { Router } from "express";
import {
  register,
  login,
  logout,
  profile,
  forgotPassword,
  resetPassword,
  refreshAccessAndRefreshToken,
} from "../controllers/auth.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import checkAccountStatus from "../middlewares/accountStatus.middleware.js";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword); 
router.post("/reset-password/:token", resetPassword);
router.post("/refresh-token", refreshAccessAndRefreshToken);

// Protected routes (require valid access token)
router.get("/logout", verifyJWT, logout);
router.get("/profile", verifyJWT, checkAccountStatus(true), profile);

export default router;
