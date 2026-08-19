import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import { getDailyMeetingConfig, saveDailyMeetingConfig } from "../controllers/dailyMeetingConfig.controller.js";

const router = Router();

router.use(verifyJWT);

router.get("/:departmentId", getDailyMeetingConfig);
router.post("/save", authorizeRoles("ADMIN", "SUPERADMIN"), saveDailyMeetingConfig);

export default router;
