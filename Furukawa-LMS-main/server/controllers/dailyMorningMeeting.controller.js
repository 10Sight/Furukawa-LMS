import ExcelJS from "exceljs";
import DailyMorningMeeting from "../models/dailyMorningMeeting.model.js";
import logger from "../logger/winston.logger.js";
import { canModifyDailyMeetingSection } from "../utils/dailyMeetingAccess.util.js";
import { executeQuery } from "../db/mssqlHelper.js";
import microsoftGraphService from "../services/microsoftGraph.service.js";

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
        fileProvider: row.fileProvider || "LOCAL_JSON",
        m365WebUrl: row.m365WebUrl || null,
        m365EmbedUrl: row.m365EmbedUrl || null,
        lastSyncedAt: row.lastSyncedAt || null,
    };
};

// Builds a real .xlsx buffer from the same { sheets, activeSheet } shape ExcelClone
// persists, so a migrated meeting opens in Excel Online with its existing cell data
// instead of a blank workbook. Only plain cell values/formulas are carried over —
// ExcelClone's charts/media/pivot state aren't representable in a single xlsx sheet.
const buildWorkbookBuffer = async (workbook) => {
    const wb = new ExcelJS.Workbook();
    const sheetNames = Object.keys(workbook.sheets || {});
    for (const sheetName of sheetNames.length ? sheetNames : ["Sheet 1"]) {
        const sheetData = workbook.sheets?.[sheetName] || {};
        const ws = wb.addWorksheet(sheetName.slice(0, 31) || "Sheet 1");
        const cells = sheetData.cells || {};
        for (const [cellKey, cell] of Object.entries(cells)) {
            // ExcelClone keys cells as "row,col" (0-indexed) — see formulaEngine.js.
            const [r, c] = cellKey.split(",").map(Number);
            if (Number.isNaN(r) || Number.isNaN(c)) continue;
            const value = cell?.formula ? { formula: String(cell.formula).replace(/^=/, "") } : (cell?.value ?? "");
            ws.getCell(r + 1, c + 1).value = value;
        }
    }
    return wb.xlsx.writeBuffer();
};

const getSectionAndDepartmentNames = async (sectionId) => {
    const [rows] = await executeQuery(
        `SELECT s.name AS sectionName, d.name AS departmentName
         FROM [sections] s LEFT JOIN [departments] d ON d.id = s.departmentId
         WHERE s.id = ?`,
        [sectionId]
    );
    return rows[0] || {};
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
        // M365-backed meetings render via the embed iframe on the client, which reads the
        // live workbook straight from Excel Online — the sheetData column is only kept
        // in sync (best-effort) for search/export/fallback, not used to render the editor.
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

// Clones a meeting's metadata and full sheet (cells, charts, media — whatever
// lives under sheetData) into a brand new row, timestamped to right now on
// the server so a client can't backdate/forge the clone's meeting date/time.
export const cloneMeeting = async (req, res) => {
    try {
        const { id } = req.params;
        const { agenda, description } = req.body;

        if (!agenda || !agenda.trim()) {
            return res.status(400).json({ success: false, message: "Agenda is required" });
        }

        const sourceMeeting = await DailyMorningMeeting.findById(id);
        if (!sourceMeeting) {
            return res.status(404).json({ success: false, message: "Source meeting not found" });
        }

        if (!(await canModifyDailyMeetingSection(req.user, sourceMeeting.sectionId))) {
            return res.status(403).json({ success: false, message: "You are not assigned to this department/section" });
        }

        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const meetingDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const meetingTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

        let newMeeting;
        if (sourceMeeting.fileProvider === "M365_SHAREPOINT" && sourceMeeting.m365ItemId) {
            // The source is a real SharePoint workbook — duplicate the actual file via
            // Graph instead of cloning sheetData (which is only a best-effort mirror
            // for a M365-backed meeting, not the source of truth).
            if (!microsoftGraphService.isConfigured()) {
                return res.status(400).json({
                    success: false,
                    message: "Microsoft 365 integration is not configured on the server yet. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET and SHAREPOINT_DRIVE_ID."
                });
            }

            const { sectionName, departmentName } = await getSectionAndDepartmentNames(sourceMeeting.sectionId);
            const newFileName = `DailyMeeting_${Date.now()}_Copy.xlsx`;

            let copyResult;
            try {
                copyResult = await microsoftGraphService.copyWorkbookInSharePoint({
                    sourceItemId: sourceMeeting.m365ItemId,
                    targetDepartmentName: departmentName,
                    targetSectionName: sectionName,
                    newFileName
                });
            } catch (graphError) {
                logger.error("Microsoft Graph copy failed during cloneMeeting:", graphError);
                return res.status(502).json({ success: false, message: "Failed to duplicate the Microsoft 365 workbook. Please try again." });
            }

            try {
                newMeeting = await DailyMorningMeeting.createFromM365File({
                    sectionId: sourceMeeting.sectionId,
                    agenda: agenda.trim(),
                    description: description || null,
                    meetingDate,
                    meetingTime,
                    createdBy: req.user.id,
                    m365Info: {
                        driveId: copyResult.driveId,
                        itemId: copyResult.itemId,
                        webUrl: copyResult.webUrl,
                        embedUrl: copyResult.embedUrl,
                        fileName: copyResult.fileName,
                    }
                });

                // For a M365-backed meeting, sheetData only ever holds chart settings
                // (the real cell content lives in the SharePoint workbook) — carry it
                // over so the clone doesn't lose whatever charts were configured.
                if (sourceMeeting.sheetData && sourceMeeting.sheetData !== "{}") {
                    newMeeting = await DailyMorningMeeting.updateSheetData(newMeeting.id, sourceMeeting.sheetData);
                }
            } catch (dbError) {
                // Compensating action: don't leave an orphaned SharePoint copy the DB has no record of.
                await microsoftGraphService.deleteWorkbook(copyResult.itemId);
                throw dbError;
            }
        } else {
            newMeeting = await DailyMorningMeeting.createWithSheetData({
                sectionId: sourceMeeting.sectionId,
                agenda: agenda.trim(),
                description: description || null,
                meetingDate,
                meetingTime,
                createdBy: req.user.id,
                sheetData: sourceMeeting.sheetData
            });
        }

        // Include the parsed sheets/activeSheet (same shape getMeetingDetail returns) so
        // the client can seed the detail query's cache directly from this response,
        // instead of navigating to the new meeting and waiting on a follow-up GET.
        const workbook = normalizeWorkbook(parseSheetData(newMeeting.sheetData));

        return res.status(201).json({
            success: true,
            message: "Meeting cloned successfully",
            data: { ...formatMeetingRow(newMeeting), sheets: workbook.sheets, activeSheet: workbook.activeSheet }
        });
    } catch (error) {
        logger.error("Error in cloneMeeting:", error);
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

// One-shot, opt-in migration for a single meeting: exports its current sheetData
// to a real .xlsx and uploads it to SharePoint via Graph. Left as an explicit
// per-meeting action (not automatic on create) so a Graph outage/misconfiguration
// never blocks the plain create/save flow every meeting currently depends on.
export const migrateMeetingToM365 = async (req, res) => {
    try {
        const { id } = req.params;
        if (!microsoftGraphService.isConfigured()) {
            return res.status(400).json({
                success: false,
                message: "Microsoft 365 integration is not configured on the server yet. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET and SHAREPOINT_DRIVE_ID."
            });
        }

        const existing = await DailyMorningMeeting.findById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }
        if (!(await canModifyDailyMeetingSection(req.user, existing.sectionId))) {
            return res.status(403).json({ success: false, message: "You are not assigned to this department/section" });
        }
        if (existing.fileProvider === "M365_SHAREPOINT") {
            return res.status(400).json({ success: false, message: "This meeting is already backed by Microsoft 365." });
        }

        const workbook = normalizeWorkbook(parseSheetData(existing.sheetData));
        const fileBuffer = await buildWorkbookBuffer(workbook);
        const { sectionName, departmentName } = await getSectionAndDepartmentNames(existing.sectionId);

        let uploadResult;
        try {
            uploadResult = await microsoftGraphService.createMeetingWorkbook({
                departmentName, sectionName, meetingId: existing.id, fileBuffer
            });
        } catch (graphError) {
            logger.error("Microsoft Graph upload failed during migrateMeetingToM365:", graphError);
            return res.status(502).json({ success: false, message: "Failed to create the workbook in Microsoft 365. Please try again." });
        }

        let meeting;
        try {
            meeting = await DailyMorningMeeting.updateM365Info(id, {
                fileProvider: "M365_SHAREPOINT",
                m365DriveId: uploadResult.driveId,
                m365ItemId: uploadResult.itemId,
                m365WebUrl: uploadResult.webUrl,
                m365EmbedUrl: uploadResult.embedUrl,
            });
        } catch (dbError) {
            // Compensating action: don't leave an orphaned SharePoint file the DB has no record of.
            await microsoftGraphService.deleteWorkbook(uploadResult.itemId);
            throw dbError;
        }

        return res.status(200).json({ success: true, message: "Meeting migrated to Microsoft 365 successfully", data: formatMeetingRow(meeting) });
    } catch (error) {
        logger.error("Error in migrateMeetingToM365:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// On-demand, 1-click access: auto-provisions the SharePoint workbook the first
// time anyone opens it (no separate "migrate" step needed), then returns a
// sharing link scoped to the requester's own access. Same department/admin get
// an "edit" link; everyone else gets a strictly read-only "view" link — decided
// server-side via canModifyDailyMeetingSection, never trusted from the client.
// Deliberately leaves fileProvider/m365WebUrl untouched when handing out a view
// link, so it never overwrites the stored edit link a same-department user (or
// the legacy embed view) relies on.
export const openMeetingInM365 = async (req, res) => {
    try {
        const { id } = req.params;
        if (!microsoftGraphService.isConfigured()) {
            return res.status(400).json({
                success: false,
                message: "Microsoft 365 integration is not configured on the server yet. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET and SHAREPOINT_DRIVE_ID."
            });
        }

        const existing = await DailyMorningMeeting.findById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }

        const canEdit = await canModifyDailyMeetingSection(req.user, existing.sectionId);
        const linkType = canEdit ? "edit" : "view";

        let itemId = existing.m365ItemId;

        if (!itemId) {
            const workbook = normalizeWorkbook(parseSheetData(existing.sheetData));
            const fileBuffer = await buildWorkbookBuffer(workbook);
            const { sectionName, departmentName } = await getSectionAndDepartmentNames(existing.sectionId);

            let uploadResult;
            try {
                uploadResult = await microsoftGraphService.createMeetingWorkbook({
                    departmentName, sectionName, meetingId: existing.id, fileBuffer
                });
            } catch (graphError) {
                logger.error("Microsoft Graph upload failed during openMeetingInM365:", graphError);
                return res.status(502).json({ success: false, message: "Failed to create the workbook in Microsoft 365. Please try again." });
            }

            try {
                await DailyMorningMeeting.updateM365Info(id, {
                    fileProvider: existing.fileProvider || "LOCAL_JSON",
                    m365DriveId: uploadResult.driveId,
                    m365ItemId: uploadResult.itemId,
                    m365WebUrl: uploadResult.webUrl,
                    m365EmbedUrl: uploadResult.embedUrl,
                });
            } catch (dbError) {
                // Compensating action: don't leave an orphaned SharePoint file the DB has no record of.
                await microsoftGraphService.deleteWorkbook(uploadResult.itemId);
                throw dbError;
            }

            itemId = uploadResult.itemId;
            // The upload already minted an edit-type link — reuse it instead of a second Graph round-trip.
            if (linkType === "edit") {
                return res.status(200).json({ success: true, mode: "edit", url: uploadResult.webUrl });
            }
        }

        let shareLink;
        try {
            shareLink = await microsoftGraphService.getShareLink(itemId, linkType);
        } catch (graphError) {
            logger.error("Microsoft Graph link creation failed during openMeetingInM365:", graphError);
            return res.status(502).json({ success: false, message: "Failed to generate the Microsoft 365 link. Please try again." });
        }

        return res.status(200).json({ success: true, mode: linkType, url: shareLink.webUrl });
    } catch (error) {
        logger.error("Error in openMeetingInM365:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Reconciles a section's SharePoint folder against MSSQL: files created (or
// "Save a Copy"-d) directly in Excel Online/SharePoint never touch the LMS API,
// so without this the section's meeting list would never learn about them.
// Idempotent — every M365 item is keyed by m365ItemId, so re-running never
// creates duplicate rows for a file already tracked (in this section or any other).
export const syncSectionMeetingsFromM365 = async (req, res) => {
    try {
        const { sectionId } = req.params;
        if (!microsoftGraphService.isConfigured()) {
            return res.status(400).json({
                success: false,
                message: "Microsoft 365 integration is not configured on the server yet. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET and SHAREPOINT_DRIVE_ID."
            });
        }
        if (!(await canModifyDailyMeetingSection(req.user, sectionId))) {
            return res.status(403).json({ success: false, message: "You are not assigned to this department/section" });
        }

        const { sectionName, departmentName } = await getSectionAndDepartmentNames(sectionId);

        let files;
        try {
            files = await microsoftGraphService.getSectionFolderFiles({ departmentName, sectionName });
        } catch (graphError) {
            logger.error("Microsoft Graph folder listing failed during syncSectionMeetingsFromM365:", graphError);
            return res.status(502).json({ success: false, message: "Failed to read the section's Microsoft 365 folder. Please try again." });
        }

        const knownItemIds = new Set(await DailyMorningMeeting.findM365ItemIdsBySectionId(sectionId));
        const newFiles = files.filter((f) => !knownItemIds.has(f.itemId));

        let newCount = 0;
        for (const file of newFiles) {
            // A file already tracked under a different section (e.g. moved in
            // SharePoint after being synced) is left untouched — reconciliation
            // only adds rows here, it never reassigns an existing one.
            const trackedElsewhere = await DailyMorningMeeting.findByM365ItemId(file.itemId);
            if (trackedElsewhere) continue;

            const created = file.createdDateTime ? new Date(file.createdDateTime) : new Date();
            const pad = (n) => String(n).padStart(2, "0");
            const meetingDate = `${created.getFullYear()}-${pad(created.getMonth() + 1)}-${pad(created.getDate())}`;
            const meetingTime = `${pad(created.getHours())}:${pad(created.getMinutes())}:${pad(created.getSeconds())}`;
            const agenda = file.name.replace(/\.xlsx$/i, "").replace(/[_-]+/g, " ").trim() || "Untitled Meeting";

            let shareLink;
            try {
                shareLink = await microsoftGraphService.getShareLink(file.itemId, "edit");
            } catch (graphError) {
                logger.error(`Microsoft Graph link creation failed for discovered file ${file.itemId}:`, graphError);
                continue; // Skip this file for now — it'll be retried on the next sync.
            }

            await DailyMorningMeeting.createFromM365File({
                sectionId,
                agenda,
                description: "Imported from Microsoft Excel Online",
                meetingDate,
                meetingTime,
                createdBy: req.user.id,
                m365Info: {
                    driveId: process.env.SHAREPOINT_DRIVE_ID,
                    itemId: file.itemId,
                    webUrl: shareLink.webUrl,
                    embedUrl: shareLink.embedUrl,
                    fileName: file.name,
                    eTag: file.eTag,
                    createdDateTime: file.createdDateTime,
                    lastModifiedDateTime: file.lastModifiedDateTime,
                }
            });
            newCount++;
        }

        const rows = await DailyMorningMeeting.findBySectionId(sectionId);
        const meetings = rows.map(formatMeetingRow);

        return res.status(200).json({
            success: true,
            message: newCount > 0
                ? `Synced ${newCount} new meeting sheet${newCount === 1 ? "" : "s"} from Microsoft Excel.`
                : "All Microsoft Excel sheets are up to date.",
            data: { syncedCount: files.length, newCount, totalCount: meetings.length, meetings }
        });
    } catch (error) {
        logger.error("Error in syncSectionMeetingsFromM365:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const refreshMeetingEmbedUrl = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await DailyMorningMeeting.findById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }
        if (!(await canModifyDailyMeetingSection(req.user, existing.sectionId))) {
            return res.status(403).json({ success: false, message: "You are not assigned to this department/section" });
        }
        if (existing.fileProvider !== "M365_SHAREPOINT" || !existing.m365ItemId) {
            return res.status(400).json({ success: false, message: "This meeting is not backed by Microsoft 365." });
        }

        const { webUrl, embedUrl } = await microsoftGraphService.getEmbedUrl(existing.m365ItemId);
        const meeting = await DailyMorningMeeting.updateM365Info(id, {
            fileProvider: "M365_SHAREPOINT",
            m365DriveId: existing.m365DriveId,
            m365ItemId: existing.m365ItemId,
            m365WebUrl: webUrl,
            m365EmbedUrl: embedUrl,
        });

        return res.status(200).json({ success: true, message: "Embed link refreshed", data: formatMeetingRow(meeting) });
    } catch (error) {
        logger.error("Error in refreshMeetingEmbedUrl:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Read-only snapshot of a Microsoft-365-backed meeting's live cell values, used
// to feed ExcelGraph's charts — gated the same as getMeetingDetail (permission-only,
// no department/section lock), since it's non-destructive.
export const getMeetingM365Snapshot = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await DailyMorningMeeting.findById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }
        if (existing.fileProvider !== "M365_SHAREPOINT" || !existing.m365ItemId) {
            return res.status(400).json({ success: false, message: "This meeting is not backed by Microsoft 365." });
        }

        const snapshot = await microsoftGraphService.getWorksheetSnapshot(existing.m365ItemId);
        return res.status(200).json({ success: true, data: snapshot });
    } catch (error) {
        logger.error("Error in getMeetingM365Snapshot:", error);
        return res.status(500).json({ success: false, message: "Failed to read live data from Microsoft 365. Please try again." });
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
