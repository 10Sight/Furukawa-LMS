import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { getDailyMeetingConfig, getHrTabDepartments, saveDailyMeetingConfig } from "../controllers/dailyMeetingConfig.controller.js";

const router = Router();

router.use(verifyJWT);

// Registered before "/:departmentId" so the literal path is not read as a department id.
router.get("/hr-tabs", getHrTabDepartments);
router.get("/:departmentId", getDailyMeetingConfig);
router.post("/save", authorizeRoles("ADMIN", "SUPERADMIN"), saveDailyMeetingConfig);

export default router;
