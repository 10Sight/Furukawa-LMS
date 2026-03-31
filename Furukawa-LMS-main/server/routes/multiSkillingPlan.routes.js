import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import {
    getMultiSkillingPlanByDepartment,
    saveMultiSkillingPlanByDepartment,
    getMultiSkillingPlanConfig,
    saveMultiSkillingPlanConfig,
    getMultiSkillingPlanHistory,
} from "../controllers/multiSkillingPlan.controller.js";

const router = Router();

router.use(verifyJWT);

router.get(
    "/department/:departmentId",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    getMultiSkillingPlanByDepartment
);

router.post(
    "/department/:departmentId",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    saveMultiSkillingPlanByDepartment
);

router.get(
    "/config/:departmentId",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    getMultiSkillingPlanConfig
);

router.post(
    "/config/save",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    saveMultiSkillingPlanConfig
);

router.get(
    "/history/:departmentId",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    getMultiSkillingPlanHistory
);

export default router;
