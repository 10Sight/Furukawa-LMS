import fs from "fs";
import DailyMorningMeeting from "../models/dailyMorningMeeting.model.js";
import { canModifyDailyMeetingSection } from "../utils/dailyMeetingAccess.util.js";
import { saveToLocal } from "../utils/fileStorage.util.js";
import logger from "../logger/winston.logger.js";

// Video files for spreadsheets (see middlewares/sheetMedia.middleware.js). The sheet
// keeps the URL answered here as the video's `src`.

// Before a meeting's upload is read: only someone who may save the meeting's sheet
// may add a file to it — checked first, so a refused request isn't written to disk.
export const requireMeetingSheetWrite = async (req, res, next) => {
    try {
        const meeting = await DailyMorningMeeting.findMetaById(req.params.id);
        if (!meeting) return res.status(404).json({ success: false, message: "Meeting not found" });
        if (!(await canModifyDailyMeetingSection(req.user, meeting.sectionId))) {
            return res.status(403).json({ success: false, message: "You are not assigned to this department/section" });
        }
        return next();
    } catch (error) {
        logger.error(`Sheet media access check failed: ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to upload video" });
    }
};

export const uploadSheetMedia = async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: "No video was sent" });
    try {
        const saved = await saveToLocal(file, "sheet-media");
        if (!saved.success) throw new Error(saved.error || "Could not store the video");
        return res.status(201).json({
            success: true,
            data: { url: saved.url, name: file.originalname, size: file.size, mime: file.mimetype },
        });
    } catch (error) {
        logger.error(`Sheet media upload failed: ${error.message}`);
        fs.promises.unlink(file.path).catch(() => {});
        return res.status(500).json({ success: false, message: "Failed to upload video" });
    }
};
