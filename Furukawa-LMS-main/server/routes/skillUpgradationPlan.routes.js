import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import {
    getSkillUpgradationPlanByDepartment,
    saveSkillUpgradationPlanByDepartment,
    getSkillUpgradationPlanConfig,
    saveSkillUpgradationPlanConfig,
    getSkillUpgradationPlanHistory,
} from "../controllers/skillUpgradationPlan.controller.js";

const router = Router();

router.use(verifyJWT);

// Get skill upgradation plan by department and section
router.get(
    "/department/:departmentId",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    getSkillUpgradationPlanByDepartment
);

// Save skill upgradation plan by department and section
router.post(
    "/department/:departmentId",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    saveSkillUpgradationPlanByDepartment
);

// Get skill upgradation plan config by department
router.get(
    "/config/:departmentId",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    getSkillUpgradationPlanConfig
);

// Save skill upgradation plan config by department
router.post(
    "/config/save",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    saveSkillUpgradationPlanConfig
);

// Get skill upgradation plan history by department
router.get(
    "/history/:departmentId",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN"),
    getSkillUpgradationPlanHistory
);

export default router;
