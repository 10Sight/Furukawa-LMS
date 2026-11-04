import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import {
    getMonthlyReportData,
    getConfig,
    saveDepartmentConfigs,
    getAttendanceDeptMap,
    saveAttendanceDeptMap,
    getTrainingInputs,
    saveTrainingInputs,
    recalculateMonth,
} from "../controllers/dailyManpowerReport.controller.js";

const router = Router();

router.use(verifyJWT);

const canRead = authorizeRoles("hr_meeting:read", "isAdmin", "SUPERADMIN");
const canWrite = authorizeRoles("hr_meeting:update", "isAdmin", "SUPERADMIN");

router.get("/data", canRead, getMonthlyReportData);
router.get("/config", canRead, getConfig);
router.post("/config", canWrite, saveDepartmentConfigs);
router.get("/attendance-map", canRead, getAttendanceDeptMap);
router.post("/attendance-map", canWrite, saveAttendanceDeptMap);
router.get("/training", canRead, getTrainingInputs);
router.post("/training", canWrite, saveTrainingInputs);
router.post("/recalculate", canWrite, recalculateMonth);

export default router;
