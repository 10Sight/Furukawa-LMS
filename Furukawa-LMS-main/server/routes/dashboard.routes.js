import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboard.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

router.get("/stats", verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"), getDashboardStats);

export default router;
