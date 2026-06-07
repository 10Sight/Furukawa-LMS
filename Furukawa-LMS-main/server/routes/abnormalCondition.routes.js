import { Router } from "express";
import {
    getAbnormalConditionSheet,
    createAbnormalConditionSheet,
    updateAbnormalConditionSheet,
    approveAbnormalConditionEntry,
    deleteAbnormalConditionSheet,
    getAbnormalConditionList
} from "../controllers/abnormalCondition.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import { authorizeRole } from "../middlewares/roleAuth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../controllers/rolesPermissions.controller.js";

const router = Router();

// Apply auth middleware to all routes
router.use(verifyJWT);

// abnormal condition endpoints
router.get("/list", authorizeRole([SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_READ]), getAbnormalConditionList);
router.get("/", authorizeRole([SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_READ]), getAbnormalConditionSheet);
router.post("/", authorizeRole([SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_CREATE]), createAbnormalConditionSheet);
router.put("/:id", authorizeRole([SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_UPDATE]), updateAbnormalConditionSheet);
router.post("/:id/approve", authorizeRole([SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_APPROVE]), approveAbnormalConditionEntry);
router.delete("/:id", authorizeRole([SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_DELETE]), deleteAbnormalConditionSheet);

export default router;
