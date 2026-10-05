import { Router } from "express";
import {
    getAllConfigurations,
    getConfigurationById,
    createConfiguration,
    updateConfiguration,
    deleteConfiguration,
    testHandoverScheduler,
    testSixteenDayScheduler,
    testSixteenDayEligibilityScheduler,
    testLeftRequestScheduler
} from "../controllers/emailConfiguration.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";

const router = Router();

// All email config routes require authentication and admin access
router.use(verifyJWT, authorizeRoles("isAdmin", "SUPERADMIN"));

router.route("/")
    .get(getAllConfigurations)
    .post(createConfiguration);

router.post("/test-handover-scheduler", testHandoverScheduler);
router.post("/test-sixteenday-scheduler", testSixteenDayScheduler);
router.post("/test-sixteenday-eligibility-scheduler", testSixteenDayEligibilityScheduler);
router.post("/test-left-request-scheduler", testLeftRequestScheduler);

router.route("/:id")
    .get(getConfigurationById)
    .put(updateConfiguration)
    .delete(deleteConfiguration);

export default router;
