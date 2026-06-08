import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import {
    getMultiSkillingPlanByDepartment,
    saveMultiSkillingPlanByDepartment,
    getMultiSkillingPlanConfig,
    saveMultiSkillingPlanConfig,
    getMultiSkillingPlanHistory,
    listMultiSkillingPlans,
} from "../controllers/multiSkillingPlan.controller.js";

const router = Router();

router.use(verifyJWT);

// List all multi-skilling plans
router.get(
    "/list",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    listMultiSkillingPlans
);

// Get multi skilling plan by department
// Get multi skilling plan by department and section
router.get(
    "/department/:departmentId",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    getMultiSkillingPlanByDepartment
);

// Save multi skilling plan by department and section
router.post(
    "/department/:departmentId",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    saveMultiSkillingPlanByDepartment
);

// Get multi skilling plan config by department
router.get(
    "/config/:departmentId",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    getMultiSkillingPlanConfig
);

// Save multi skilling plan config by department
router.post(
    "/config/save",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    saveMultiSkillingPlanConfig
);

// Get multi skilling plan history by department
router.get(
    "/history/:departmentId",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    getMultiSkillingPlanHistory
);

export default router;
