import DailyMorningMeeting from "../models/dailyMorningMeeting.model.js";
import logger from "../logger/winston.logger.js";
import { canModifyDailyMeetingSection } from "../utils/dailyMeetingAccess.util.js";

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

const normalizeWorkbook = (data) => {
    if (data && data.sheets && typeof data.sheets === "object" && Object.keys(data.sheets).length > 0) {
        const activeSheet = data.activeSheet && data.sheets[data.activeSheet]
            ? data.activeSheet
            : Object.keys(data.sheets)[0];
        return { sheets: data.sheets, activeSheet };
    }

    return {
        sheets: {
            [DEFAULT_SHEET_NAME]: { cells: {}, rowCount: DEFAULT_ROW_COUNT, columnCount: DEFAULT_COLUMN_COUNT }
        },
        activeSheet: DEFAULT_SHEET_NAME
    };
};

// MSSQL DATE/TIME columns come back as full JS Date objects (TIME anchored to
// 1970-01-01) — format them here so the client never has to guess a timezone.
const formatMeetingRow = (row) => {
    if (!row) return null;
    const date = row.meetingDate instanceof Date ? row.meetingDate : new Date(row.meetingDate);
    const time = row.meetingTime instanceof Date ? row.meetingTime : new Date(row.meetingTime);
    const pad = (n) => String(n).padStart(2, "0");
    return {
        id: row.id,
        sectionId: row.sectionId,
        agenda: row.agenda,
        description: row.description || "",
        meetingDate: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        meetingTime: `${pad(time.getHours())}:${pad(time.getMinutes())}`,
        createdBy: row.createdBy,
        createdByName: row.createdByName || "",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
};

export const getMeetingsForSection = async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { scope } = req.query;
        if (!sectionId) {
            return res.status(400).json({ success: false, message: "Section ID is required" });
        }
        // Read access is permission-gated only (route middleware) — a user holding
        // daily_meeting:read can view any department/section, by design.

        const rows = await DailyMorningMeeting.findBySectionId(sectionId);
        let meetings = rows.map(formatMeetingRow);

        if (scope === "month") {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            meetings = meetings.filter((m) => {
                const d = new Date(m.meetingDate);
                return d.getFullYear() === year && d.getMonth() === month;
            });
        }

        return res.status(200).json({ success: true, data: meetings });
    } catch (error) {
        logger.error("Error in getMeetingsForSection:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMeetingDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const meeting = await DailyMorningMeeting.findById(id);
        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }
        // Read access is permission-gated only (route middleware) — no department/section lock.
        const workbook = normalizeWorkbook(parseSheetData(meeting.sheetData));

        return res.status(200).json({
            success: true,
            data: {
                ...formatMeetingRow(meeting),
                sheets: workbook.sheets,
                activeSheet: workbook.activeSheet
            }
        });
    } catch (error) {
        logger.error("Error in getMeetingDetail:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const createMeeting = async (req, res) => {
    try {
        const { sectionId, agenda, description } = req.body;
        if (!sectionId || !agenda || !agenda.trim()) {
            return res.status(400).json({ success: false, message: "Section ID and agenda are required" });
        }
        if (!(await canModifyDailyMeetingSection(req.user, sectionId))) {
            return res.status(403).json({ success: false, message: "You are not assigned to this department/section" });
        }

        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const meetingDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const meetingTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

        const meeting = await DailyMorningMeeting.create({
            sectionId,
            agenda: agenda.trim(),
            description,
            meetingDate,
            meetingTime,
            createdBy: req.user.id
        });

        return res.status(201).json({ success: true, message: "Meeting created successfully", data: formatMeetingRow(meeting) });
    } catch (error) {
        logger.error("Error in createMeeting:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateMeeting = async (req, res) => {
    try {
        const { id } = req.params;
        const { agenda, description } = req.body;
        if (!agenda || !agenda.trim()) {
            return res.status(400).json({ success: false, message: "Agenda is required" });
        }
        const existing = await DailyMorningMeeting.findById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }
        if (!(await canModifyDailyMeetingSection(req.user, existing.sectionId))) {
            return res.status(403).json({ success: false, message: "You are not assigned to this department/section" });
        }
        const meeting = await DailyMorningMeeting.updateDetails(id, { agenda: agenda.trim(), description });
        return res.status(200).json({ success: true, message: "Meeting updated successfully", data: formatMeetingRow(meeting) });
    } catch (error) {
        logger.error("Error in updateMeeting:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const saveMeetingSheet = async (req, res) => {
    try {
        const { id } = req.params;
        const { sheets, activeSheet } = req.body;
        const existing = await DailyMorningMeeting.findById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }
        if (!(await canModifyDailyMeetingSection(req.user, existing.sectionId))) {
            return res.status(403).json({ success: false, message: "You are not assigned to this department/section" });
        }

        const workbook = normalizeWorkbook({ sheets: sheets || {}, activeSheet });
        const meeting = await DailyMorningMeeting.updateSheetData(id, workbook);
        const parsedData = normalizeWorkbook(parseSheetData(meeting.sheetData));

        return res.status(200).json({
            success: true,
            message: "Spreadsheet saved successfully",
            data: { ...formatMeetingRow(meeting), sheets: parsedData.sheets, activeSheet: parsedData.activeSheet }
        });
    } catch (error) {
        logger.error("Error in saveMeetingSheet:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteMeeting = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await DailyMorningMeeting.findById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }
        if (!(await canModifyDailyMeetingSection(req.user, existing.sectionId))) {
            return res.status(403).json({ success: false, message: "You are not assigned to this department/section" });
        }
        await DailyMorningMeeting.deleteById(id);
        return res.status(200).json({ success: true, message: "Meeting deleted successfully" });
    } catch (error) {
        logger.error("Error in deleteMeeting:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
