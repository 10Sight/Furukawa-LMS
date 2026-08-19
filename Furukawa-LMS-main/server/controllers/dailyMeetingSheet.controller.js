import DailyMeetingSheet from "../models/dailyMeetingSheet.model.js";
import logger from "../logger/winston.logger.js";

const DEFAULT_ROW_COUNT = 30;
const DEFAULT_COLUMN_COUNT = 15;
const DEFAULT_SHEET_NAME = "Sheet 1";

const parseSheetData = (value) => {
    try {
        const parsed = typeof value === "string" ? JSON.parse(value) : (value || {});
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
        return {};
    }
};

// Multi-sheet workbooks were introduced after the original single-grid
// format ({cells, rowCount, columnCount}) shipped, so rows saved before that
// still have the old shape. Normalize both into {sheets, activeSheet} here
// so older saved sheets keep loading instead of appearing empty.
const normalizeWorkbook = (data) => {
    if (data && data.sheets && typeof data.sheets === "object" && Object.keys(data.sheets).length > 0) {
        const activeSheet = data.activeSheet && data.sheets[data.activeSheet]
            ? data.activeSheet
            : Object.keys(data.sheets)[0];
        return { sheets: data.sheets, activeSheet };
    }

    if (data && (data.cells || data.rowCount || data.columnCount)) {
        return {
            sheets: {
                [DEFAULT_SHEET_NAME]: {
                    cells: data.cells || {},
                    rowCount: data.rowCount || DEFAULT_ROW_COUNT,
                    columnCount: data.columnCount || DEFAULT_COLUMN_COUNT
                }
            },
            activeSheet: DEFAULT_SHEET_NAME
        };
    }

    return {
        sheets: {
            [DEFAULT_SHEET_NAME]: { cells: {}, rowCount: DEFAULT_ROW_COUNT, columnCount: DEFAULT_COLUMN_COUNT }
        },
        activeSheet: DEFAULT_SHEET_NAME
    };
};

export const getDailyMeetingSheet = async (req, res) => {
    try {
        const { sectionId } = req.params;
        if (!sectionId) {
            return res.status(400).json({ success: false, message: "Section ID is required" });
        }
        const sheet = await DailyMeetingSheet.findBySectionId(sectionId);
        const workbook = normalizeWorkbook(sheet ? parseSheetData(sheet.data) : {});

        return res.status(200).json({
            success: true,
            data: { sectionId, sheets: workbook.sheets, activeSheet: workbook.activeSheet }
        });
    } catch (error) {
        logger.error("Error in getDailyMeetingSheet:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const saveDailyMeetingSheet = async (req, res) => {
    try {
        const { sectionId, sheets, activeSheet } = req.body;
        if (!sectionId) {
            return res.status(400).json({ success: false, message: "Section ID is required" });
        }
        const workbook = normalizeWorkbook({ sheets: sheets || {}, activeSheet });
        const sheet = await DailyMeetingSheet.upsert(sectionId, workbook);
        const parsedData = normalizeWorkbook(parseSheetData(sheet.data));

        return res.status(200).json({
            success: true,
            message: "Spreadsheet saved successfully",
            data: { sectionId, sheets: parsedData.sheets, activeSheet: parsedData.activeSheet }
        });
    } catch (error) {
        logger.error("Error in saveDailyMeetingSheet:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
