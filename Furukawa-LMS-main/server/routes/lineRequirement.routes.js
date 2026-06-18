import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import {
    getLineRequirements,
    updateLineRequirement,
    getHistoryByLine
} from "../controllers/lineRequirement.controller.js";

const router = Router();

// Apply auth middleware to all routes
router.use(verifyJWT);

// Get requirements with filters
router.get("/", authorizeRoles("isAdmin", "SUPERADMIN", "line_requirement:read"), getLineRequirements);

// Update/Create requirement
router.post("/update", authorizeRoles("isAdmin", "SUPERADMIN", "line_requirement:update"), updateLineRequirement);

// Get history for a line
router.get("/history/:lineId", authorizeRoles("isAdmin", "SUPERADMIN", "line_requirement:read"), getHistoryByLine);

export default router;
