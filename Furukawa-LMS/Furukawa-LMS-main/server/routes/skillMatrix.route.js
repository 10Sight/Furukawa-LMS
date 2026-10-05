import { Router } from "express";
import {
    saveSkillMatrix,
    getSkillMatrix,
    listSkillMatrices,
    deleteSkillMatrix,
    getSkillMatrixConfig,
    saveSkillMatrixConfig,
    getSkillMatrixCertHistory,
    getSkillMatrixEvaluation,
    saveSkillMatrixEvaluation,
    getEvaluationSheets,
    getEvaluationSheet,
    createEvaluationSheet,
    saveEvaluationSheet,
    listAllEvaluationSheets,
    deleteEvaluationSheet,
    getSkillMatrixDashboardConfig,
    saveSkillMatrixDashboardConfig,
    getSkillMatrixDashboardHistory,
    getSkillMatrixEfficiencyStats,
    getSkillMatrixEfficiencySummary
} from "../controllers/skillMatrix.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import { authorizeAnyPermission } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";

const router = Router();

// Protect all routes
router.use(verifyJWT);

router.route("/evaluations/efficiency").get(getSkillMatrixEfficiencyStats);
router.route("/evaluations/summary").get(getSkillMatrixEfficiencySummary);
router.route("/evaluations/list").get(
    authorizeAnyPermission([
        SYSTEM_PERMISSIONS.EVALUATION_MANAGE,
        SYSTEM_PERMISSIONS.EVALUATION_READ,
    ]),
    listAllEvaluationSheets
);
router.route("/save").post(saveSkillMatrix);
router.route("/list").get(listSkillMatrices);
router.route("/fetch").get(getSkillMatrix);
router.route("/sheet/:id").delete(
    authorizeAnyPermission([
        SYSTEM_PERMISSIONS.EVALUATION_MANAGE,
        SYSTEM_PERMISSIONS.EVALUATION_DELETE,
    ]),
    deleteSkillMatrix
);

// Skill Matrix Certificate Config Routes
router.route("/config/:departmentId").get(getSkillMatrixConfig);
router.route("/config/save").post(saveSkillMatrixConfig);
router.route("/config/history/:departmentId").get(getSkillMatrixCertHistory);

// Skill Matrix Evaluation Routes
router.route("/evaluation/:studentId").get(getSkillMatrixEvaluation);
router.route("/evaluation/save/:studentId").post(saveSkillMatrixEvaluation);

// Multi-Sheet Skill Matrix Evaluation Routes
router.route("/evaluation/:studentId/sheets").get(getEvaluationSheets);
router.route("/evaluation/:studentId/sheet/create").post(createEvaluationSheet);
router.route("/evaluation/sheet/:sheetId")
    .get(getEvaluationSheet)
    .delete(
        authorizeAnyPermission([
            SYSTEM_PERMISSIONS.EVALUATION_MANAGE,
            SYSTEM_PERMISSIONS.EVALUATION_DELETE,
        ]),
        deleteEvaluationSheet
    );
router.route("/evaluation/sheet/:sheetId/save").put(saveEvaluationSheet);

// Skill Matrix Dashboard Config Routes
router.route("/dashboard/config/:departmentId").get(getSkillMatrixDashboardConfig);
router.route("/dashboard/config/save").post(saveSkillMatrixDashboardConfig);
router.route("/dashboard/config/history/:departmentId").get(getSkillMatrixDashboardHistory);

router.route("/:departmentId/:lineId").get(getSkillMatrix);

export default router;
