import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { getMonthlyReportConfig, saveMonthlyReportConfig } from "../controllers/monthlyReportConfig.controller.js";

const router = Router();

router.use(verifyJWT);

router.get("/:departmentId", authorizeRoles("monthly_report:read", "isAdmin", "SUPERADMIN"), getMonthlyReportConfig);
router.post("/save", authorizeRoles("ADMIN", "SUPERADMIN"), saveMonthlyReportConfig);

export default router;
