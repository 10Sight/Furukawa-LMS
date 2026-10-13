import MonthlyReportConfig from "../models/monthlyReportConfig.model.js";
import logger from "../logger/winston.logger.js";

const parseSections = (value) => {
    try {
        const parsed = typeof value === "string" ? JSON.parse(value) : (value || []);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};

export const getMonthlyReportConfig = async (req, res) => {
    try {
        const { departmentId } = req.params;
        if (!departmentId) {
            return res.status(400).json({ success: false, message: "Department ID is required" });
        }
        const config = await MonthlyReportConfig.findByDepartmentId(departmentId);

        return res.status(200).json({
            success: true,
            data: {
                departmentId,
                shutter: config ? !!config.shutter : false,
                sections: config ? parseSections(config.sections) : []
            }
        });
    } catch (error) {
        logger.error("Error in getMonthlyReportConfig:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const saveMonthlyReportConfig = async (req, res) => {
    try {
        const { departmentId, shutter, sections } = req.body;
        if (!departmentId) {
            return res.status(400).json({ success: false, message: "Department ID is required" });
        }
        // The page compares these against String(section.id), so they are stored as strings.
        const sectionsList = Array.isArray(sections) ? sections.map(String) : [];
        const config = await MonthlyReportConfig.upsert(departmentId, !!shutter, sectionsList);

        return res.status(200).json({
            success: true,
            message: "Configuration saved successfully",
            data: {
                departmentId: config.departmentId,
                shutter: !!config.shutter,
                sections: parseSections(config.sections)
            }
        });
    } catch (error) {
        logger.error("Error in saveMonthlyReportConfig:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
