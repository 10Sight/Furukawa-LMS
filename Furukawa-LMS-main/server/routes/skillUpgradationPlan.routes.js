import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import {
    getSkillUpgradationPlanByDepartment,
    saveSkillUpgradationPlanByDepartment,
    getSkillUpgradationPlanConfig,
    saveSkillUpgradationPlanConfig,
    getSkillUpgradationPlanHistory,
    listSkillUpgradationPlans,
    deleteSkillUpgradationPlan,
} from "../controllers/skillUpgradationPlan.controller.js";

const router = Router();

router.use(verifyJWT);

// List all skill upgradation plans
router.get(
    "/list",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN", "skill_upgradation:read", "skill_upgradation:create", "skill_upgradation:update", "skill_upgradation:manage"),
    listSkillUpgradationPlans
);

// Get skill upgradation plan by department and section
router.get(
    "/department/:departmentId",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN", "skill_upgradation:read", "skill_upgradation:create", "skill_upgradation:update", "skill_upgradation:manage"),
    getSkillUpgradationPlanByDepartment
);

// Save (upsert) skill upgradation plan by department and section
router.post(
    "/department/:departmentId",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN", "skill_upgradation:create", "skill_upgradation:update", "skill_upgradation:manage"),
    saveSkillUpgradationPlanByDepartment
);

// Delete skill upgradation plan by id
router.delete(
    "/:id",
    authorizeRoles("isAdmin", "isTrainer", "SUPERADMIN", "skill_upgradation:delete", "skill_upgradation:manage"),
    deleteSkillUpgradationPlan
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
