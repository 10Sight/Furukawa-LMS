import DailyMeetingConfig from "../models/dailyMeetingConfig.model.js";
import logger from "../logger/winston.logger.js";

const parseSections = (value) => {
    try {
        const parsed = typeof value === "string" ? JSON.parse(value) : (value || []);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};

export const getDailyMeetingConfig = async (req, res) => {
    try {
        const { departmentId } = req.params;
        if (!departmentId) {
            return res.status(400).json({ success: false, message: "Department ID is required" });
        }
        const config = await DailyMeetingConfig.findByDepartmentId(departmentId);

        return res.status(200).json({
            success: true,
            data: {
                departmentId,
                shutter: config ? !!config.shutter : false,
                lpaShutter: config ? !!config.lpaShutter : false,
                hrMeetingShutter: config ? !!config.hrMeetingShutter : false,
                handoverShutter: config ? !!config.handoverShutter : false,
                sections: config ? parseSections(config.sections) : []
            }
        });
    } catch (error) {
        logger.error("Error in getDailyMeetingConfig:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getHrTabDepartments = async (req, res) => {
    try {
        const rows = await DailyMeetingConfig.findWithHrTabs();
        return res.status(200).json({
            success: true,
            data: rows.map((row) => ({
                departmentId: String(row.departmentId),
                hrMeetingShutter: !!row.hrMeetingShutter,
                handoverShutter: !!row.handoverShutter
            }))
        });
    } catch (error) {
        logger.error("Error in getHrTabDepartments:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const saveDailyMeetingConfig = async (req, res) => {
    try {
        const { departmentId, shutter, sections, lpaShutter, hrMeetingShutter, handoverShutter } = req.body;
        if (!departmentId) {
            return res.status(400).json({ success: false, message: "Department ID is required" });
        }
        const sectionsList = Array.isArray(sections) ? sections : [];
        const config = await DailyMeetingConfig.upsert(departmentId, !!shutter, sectionsList, !!lpaShutter, !!hrMeetingShutter, !!handoverShutter);

        return res.status(200).json({
            success: true,
            message: "Configuration saved successfully",
            data: {
                departmentId: config.departmentId,
                shutter: !!config.shutter,
                lpaShutter: !!config.lpaShutter,
                hrMeetingShutter: !!config.hrMeetingShutter,
                handoverShutter: !!config.handoverShutter,
                sections: parseSections(config.sections)
            }
        });
    } catch (error) {
        logger.error("Error in saveDailyMeetingConfig:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
