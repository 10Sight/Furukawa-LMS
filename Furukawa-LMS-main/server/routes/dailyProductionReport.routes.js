import express from 'express';
import {
    getDailyProductionReport,
    saveDailyProductionReport,
    listDailyProductionReports,
    deleteDailyProductionReport,
    getManpowerStats,
    getBatchMachineAssignments,
    checkDailyProductionReport
} from '../controllers/dailyProductionReport.controller.js';
import { getDPRConfig, saveDPRConfig, getDPRConfigHistory } from '../controllers/dailyProductionReportConfig.controller.js';
import { getDPRManualStats, saveDPRManualStats, getDPRFilledDates } from '../controllers/dprManualStatistics.controller.js';
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = express.Router();

router.use(verifyJWT);

router.get('/manpower-stats', getManpowerStats);
router.get('/machine-assignments', getBatchMachineAssignments);

router.get('/manual-stats/filled-dates', getDPRFilledDates);

router.route('/manual-stats')
    .get(getDPRManualStats)
    .post(authorizeRoles('ADMIN', 'SUPERADMIN', 'INSTRUCTOR'), saveDPRManualStats);

router.route('/')
    .get(getDailyProductionReport)
    .post(authorizeRoles('ADMIN', 'SUPERADMIN', 'INSTRUCTOR'), saveDailyProductionReport);

router.get('/list', listDailyProductionReports);
router.delete('/:id', authorizeRoles('ADMIN', 'SUPERADMIN'), deleteDailyProductionReport);

// Approval routes
router.post('/check', authorizeRoles('ADMIN', 'SUPERADMIN', 'SHIFT_INCHARGE', 'INSTRUCTOR'), checkDailyProductionReport);

// Config routes
router.get("/config/:departmentId", getDPRConfig);
router.post("/config/save", authorizeRoles("ADMIN", "SUPERADMIN"), saveDPRConfig);
router.get("/history/:departmentId", authorizeRoles("ADMIN", "SUPERADMIN"), getDPRConfigHistory);

export default router;
