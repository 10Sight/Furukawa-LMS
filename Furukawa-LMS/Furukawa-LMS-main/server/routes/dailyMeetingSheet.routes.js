import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware.js";
import { getDailyMeetingSheet, saveDailyMeetingSheet } from "../controllers/dailyMeetingSheet.controller.js";
import { uploadSheetMedia } from "../controllers/sheetMedia.controller.js";
import { sheetVideoUpload } from "../middlewares/sheetMedia.middleware.js";

const router = Router();

router.use(verifyJWT);

router.get("/:sectionId", getDailyMeetingSheet);
router.post("/save", saveDailyMeetingSheet);
// A video for the sheet, uploaded as a file; the sheet stores only its URL.
router.post("/:sectionId/media", sheetVideoUpload, uploadSheetMedia);

export default router;
