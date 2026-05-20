import { Router } from "express";
import {
    getDashboardStats,
    getDashboardAttendance,
    getDashboardTenureStats,
    getDashboardSections,
    getDashboardLines,
} from "../controllers/dashboard.controller.js";

import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

router.get(
    "/stats",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    getDashboardStats
);

router.get(
    "/attendance",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    getDashboardAttendance
);

router.get(
    "/tenure-stats",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    getDashboardTenureStats
);

router.get(
    "/sections",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    getDashboardSections
);

router.get(
    "/lines",
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
    getDashboardLines
);

export default router;