import { Router } from "express";

import {
    getDashboardStats,
    getDashboardAttendance,
    getDashboardTenureStats,
    getDashboardSections,
    getDashboardLines,

    // Dashboard holiday controllers
    getDashboardHolidays,
    saveDashboardHoliday,
    deleteDashboardHoliday,
} from "../controllers/dashboard.controller.js";

import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Common Admin Middleware
|--------------------------------------------------------------------------
*/

const dashboardAdminAccess = [
    verifyJWT,
    authorizeRoles("isAdmin", "SUPERADMIN"),
];

/*
|--------------------------------------------------------------------------
| Holiday Management Routes
|--------------------------------------------------------------------------
| IMPORTANT:
| This router is expected to be mounted with:
| app.use("/api/dashboard", dashboardRoutes)
|
| Therefore the route must be /holidays here, NOT /dashboard/holidays.
|
| Final URLs:
| GET    /api/dashboard/holidays
| POST   /api/dashboard/holidays
| DELETE /api/dashboard/holidays/:id
|--------------------------------------------------------------------------
*/

router.get(
    "/holidays",
    ...dashboardAdminAccess,
    getDashboardHolidays
);

router.post(
    "/holidays",
    ...dashboardAdminAccess,
    saveDashboardHoliday
);

router.delete(
    "/holidays/:id",
    ...dashboardAdminAccess,
    deleteDashboardHoliday
);

/*
|--------------------------------------------------------------------------
| Main Dashboard Routes
|--------------------------------------------------------------------------
*/

router.get(
    "/stats",
    ...dashboardAdminAccess,
    getDashboardStats
);

router.get(
    "/attendance",
    ...dashboardAdminAccess,
    getDashboardAttendance
);

router.get(
    "/tenure-stats",
    ...dashboardAdminAccess,
    getDashboardTenureStats
);

router.get(
    "/sections",
    ...dashboardAdminAccess,
    getDashboardSections
);

router.get(
    "/lines",
    ...dashboardAdminAccess,
    getDashboardLines
);

console.log(
    "[DASHBOARD ROUTES] Loaded: /stats, /attendance, /tenure-stats, /sections, /lines, /holidays"
);

export default router;
