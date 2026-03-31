import { Router } from "express";
import {
    saveSkillMatrix,
    getSkillMatrix,
    listSkillMatrices,
    getSkillMatrixConfig,
    saveSkillMatrixConfig,
    getSkillMatrixCertHistory,
    getSkillMatrixEvaluation,
    saveSkillMatrixEvaluation,
    getSkillMatrixDashboardConfig,
    saveSkillMatrixDashboardConfig,
    getSkillMatrixDashboardHistory
} from "../controllers/skillMatrix.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

// Protect all routes
router.use(verifyJWT);

router.route("/save").post(saveSkillMatrix);
router.route("/list").get(listSkillMatrices);

// Skill Matrix Certificate Config Routes
router.route("/config/:departmentId").get(getSkillMatrixConfig);
router.route("/config/save").post(saveSkillMatrixConfig);
router.route("/config/history/:departmentId").get(getSkillMatrixCertHistory);

// Skill Matrix Evaluation Routes
router.route("/evaluation/:studentId").get(getSkillMatrixEvaluation);
router.route("/evaluation/save/:studentId").post(saveSkillMatrixEvaluation);

// Skill Matrix Dashboard Config Routes
router.route("/dashboard/config/:departmentId").get(getSkillMatrixDashboardConfig);
router.route("/dashboard/config/save").post(saveSkillMatrixDashboardConfig);
router.route("/dashboard/config/history/:departmentId").get(getSkillMatrixDashboardHistory);

router.route("/:departmentId/:lineId").get(getSkillMatrix);

export default router;
