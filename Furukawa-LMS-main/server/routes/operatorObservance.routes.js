import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { getObservanceByStudent, createOrUpdateObservance } from "../controllers/operatorObservance.controller.js";

const router = Router();

router.route("/:studentId")
    .get(verifyJWT, authorizeRoles("ADMIN", "INSTRUCTOR", "SUPERADMIN", "operator_observance:read", "operator_observance:manage"), getObservanceByStudent)
    .post(verifyJWT, authorizeRoles("ADMIN", "INSTRUCTOR", "SUPERADMIN", "operator_observance:update", "operator_observance:manage"), createOrUpdateObservance);

export default router;
