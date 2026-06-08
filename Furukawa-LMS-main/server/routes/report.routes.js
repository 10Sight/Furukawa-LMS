import express from 'express';
import verifyJWT from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/roleAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../controllers/rolesPermissions.controller.js';
import { 
    exportFormReport, 
    saveHeadcountReport, 
    getHeadcountReport, 
    syncHeadcountData,
    getMails,
    createMail,
    deleteMail,
    triggerManualReport
} from '../controllers/report.controller.js';

const router = express.Router();

// All report routes require authentication
router.use(verifyJWT);

/**
 * @route POST /api/v1/reports/headcount
 * @desc Save headcount report data
 */
router.post('/headcount', saveHeadcountReport);

/**
 * @route GET /api/v1/reports/headcount/data
 * @desc Get headcount report data
 */
router.get('/headcount/data', getHeadcountReport);

/**
 * @route GET /api/v1/reports/headcount/sync
 * @desc Sync headcount report data from real sources
 */
router.get('/headcount/sync', syncHeadcountData);

// Mail Recipient Configuration Routes
router.get('/recipients', getMails);
router.post('/recipients', authorizeRole([SYSTEM_PERMISSIONS.MPS_EMAIL_REPORTS_ADD]), createMail);
router.delete('/recipients/:id', authorizeRole([SYSTEM_PERMISSIONS.MPS_EMAIL_REPORTS_ADD]), deleteMail);

// Trigger Manual Report
router.post('/send-manual', authorizeRole([SYSTEM_PERMISSIONS.MPS_EMAIL_REPORTS_TRIGGER]), triggerManualReport);

/**
 * @route GET /api/v1/reports/:formName
 * @desc Export a high-fidelity Excel report for a specific form
 * @access Private (Admin/Trainer)
 */
router.get('/:formName', exportFormReport);

export default router;
