import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { getObservanceByStudent, createOrUpdateObservance } from "../controllers/operatorObservance.controller.js";

const router = Router();

router.route("/:studentId")
    .get(verifyJWT, authorizeRoles("ADMIN", "INSTRUCTOR", "SUPERADMIN"), getObservanceByStudent)
    .post(verifyJWT, authorizeRoles("ADMIN", "INSTRUCTOR", "SUPERADMIN"), createOrUpdateObservance);

export default router;
