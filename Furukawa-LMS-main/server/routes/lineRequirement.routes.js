import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { checkPrivilege } from "../middlewares/checkPrivilege.middleware.js";
import {
    getLineRequirements,
    updateLineRequirement,
    getHistoryByLine
} from "../controllers/lineRequirement.controller.js";

const router = Router();

// Apply auth middleware to all routes
router.use(verifyJWT);

// Get requirements with filters
router.get("/", authorizeRoles("isAdmin", "SUPERADMIN"), getLineRequirements);

// Update/Create requirement
router.post("/update", authorizeRoles("isAdmin", "SUPERADMIN"), checkPrivilege("setrequirement"), updateLineRequirement);

// Get history for a line
router.get("/history/:lineId", authorizeRoles("isAdmin", "SUPERADMIN"), getHistoryByLine);

export default router;
