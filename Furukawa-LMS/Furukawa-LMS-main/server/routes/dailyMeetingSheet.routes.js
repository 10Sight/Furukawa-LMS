import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import { getDailyMeetingSheet, saveDailyMeetingSheet } from "../controllers/dailyMeetingSheet.controller.js";

const router = Router();

router.use(verifyJWT);

router.get("/:sectionId", getDailyMeetingSheet);
router.post("/save", saveDailyMeetingSheet);

export default router;
