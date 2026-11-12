import { Router } from "express";
import {
    getAbnormalConditionSheet,
    createAbnormalConditionSheet,
    updateAbnormalConditionSheet,
    approveAbnormalConditionEntry,
    deleteAbnormalConditionSheet,
    getAbnormalConditionList,
    getAbnormalConditionLayout,
    getAbnormalConditionLayoutHistory,
    saveAbnormalConditionLayoutWithRevision
} from "../controllers/abnormalCondition.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import { authorizeRole } from "../middlewares/roleAuth.middleware.js";
// authorizeRole (above) requires ALL listed permissions; the layout routes need ANY of them.
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";

const router = Router();

// Apply auth middleware to all routes
router.use(verifyJWT);

// Layout (title / column headers / Remarks / default rows) — Department → Global → defaults.
// Registered before "/:id" routes so "layout" is never read as a sheet id.
const LAYOUT_EDITORS = ["ADMIN", "SUPERADMIN", SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_EDIT_LAYOUT, "revision:update"];
router.get("/layout/history/:departmentId", authorizeRoles(...LAYOUT_EDITORS), getAbnormalConditionLayoutHistory);
router.get("/layout/:departmentId", authorizeRoles(...LAYOUT_EDITORS, SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_READ), getAbnormalConditionLayout);
router.post("/layout/save-with-revision", authorizeRoles(...LAYOUT_EDITORS), saveAbnormalConditionLayoutWithRevision);

// abnormal condition endpoints
router.get("/list", authorizeRole([SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_READ]), getAbnormalConditionList);
router.get("/", authorizeRole([SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_READ]), getAbnormalConditionSheet);
router.post("/", authorizeRole([SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_CREATE]), createAbnormalConditionSheet);
router.put("/:id", authorizeRole([SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_UPDATE]), updateAbnormalConditionSheet);
router.post("/:id/approve", authorizeRole([SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_APPROVE]), approveAbnormalConditionEntry);
router.delete("/:id", authorizeRole([SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_DELETE]), deleteAbnormalConditionSheet);

export default router;
