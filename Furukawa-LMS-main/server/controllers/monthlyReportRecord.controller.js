import fs from "fs";
import path from "path";
import logger from "../logger/winston.logger.js";
import MonthlyReportFolder from "../models/monthlyReportFolder.model.js";
import MonthlyReportRecord from "../models/monthlyReportRecord.model.js";
import { saveToLocal, deleteFromLocal } from "../utils/fileStorage.util.js";
import { canModifyMonthlyReportSection } from "../utils/monthlyReportAccess.util.js";
import pptxConversionService from "../services/pptxConversion.service.js";

const parseSlides = (value) => {
    try {
        const parsed = typeof value === "string" ? JSON.parse(value) : (value || []);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};

const formatRecordRow = (row) => ({
    id: row.id,
    folderId: row.folderId,
    title: row.title,
    originalFileName: row.originalFileName,
    fileUrl: row.fileUrl,
    fileSizeBytes: row.fileSizeBytes,
    month: row.month,
    year: row.year,
    slideCount: row.slideCount,
    slides: parseSlides(row.slides),
    conversionStatus: row.conversionStatus,
    conversionError: row.conversionError || null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
});

// pptx (OOXML) files are zip archives — a genuine one always starts with the
// "PK" local-file-header signature. Legacy .ppt (OLE2/CFB) has its own magic
// number but is rare enough in practice that we only hard-verify the common
// .pptx case here; multer's extension+mimetype check already covers the rest.
const looksLikeValidPptx = (filePath, originalName) => {
    if (!originalName.toLowerCase().endsWith(".pptx")) return true;
    const fd = fs.openSync(filePath, "r");
    try {
        const buffer = Buffer.alloc(2);
        fs.readSync(fd, buffer, 0, 2, 0);
        return buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK"
    } finally {
        fs.closeSync(fd);
    }
};

export const getRecordsForFolder = async (req, res) => {
    try {
        const { folderId } = req.params;
        if (!folderId) {
            return res.status(400).json({ success: false, message: "Folder ID is required" });
        }
        const rows = await MonthlyReportRecord.findByFolderId(folderId);
        return res.status(200).json({ success: true, data: rows.map(formatRecordRow) });
    } catch (error) {
        logger.error("Error in getRecordsForFolder:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getRecordDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const record = await MonthlyReportRecord.findById(id);
        if (!record) {
            return res.status(404).json({ success: false, message: "Record not found" });
        }
        return res.status(200).json({ success: true, data: formatRecordRow(record) });
    } catch (error) {
        logger.error("Error in getRecordDetail:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const createRecord = async (req, res) => {
    try {
        const { folderId, title, month, year } = req.body;
        const file = req.file;

        if (!folderId || !title || !title.trim() || !month || !year) {
            return res.status(400).json({ success: false, message: "Folder, title, month and year are required" });
        }
        if (!file) {
            return res.status(400).json({ success: false, message: "A PowerPoint file (.pptx or .ppt) is required" });
        }

        const folder = await MonthlyReportFolder.findById(folderId);
        if (!folder) {
            fs.unlink(file.path, () => {});
            return res.status(404).json({ success: false, message: "Folder not found" });
        }
        if (!(await canModifyMonthlyReportSection(req.user, folder.sectionId))) {
            fs.unlink(file.path, () => {});
            return res.status(403).json({ success: false, message: "You are not assigned to this department/section" });
        }

        if (!looksLikeValidPptx(file.path, file.originalname)) {
            fs.unlink(file.path, () => {});
            return res.status(400).json({ success: false, message: "This file does not look like a valid PowerPoint (.pptx) file" });
        }

        const uploadResult = await saveToLocal(file, "monthly-report/originals");
        if (!uploadResult.success) {
            return res.status(500).json({ success: false, message: uploadResult.error || "Failed to store the uploaded file" });
        }

        const record = await MonthlyReportRecord.create({
            folderId,
            title: title.trim(),
            originalFileName: file.originalname,
            fileUrl: uploadResult.url,
            fileSizeBytes: file.size,
            month,
            year,
            createdBy: req.user.id,
        });

        // Conversion runs asynchronously — the client polls getRecordDetail until
        // conversionStatus leaves PENDING/PROCESSING. See pptxConversion.service.js.
        pptxConversionService.enqueue(record.id, uploadResult.localPath);

        return res.status(201).json({ success: true, message: "Presentation uploaded — converting slides…", data: formatRecordRow(record) });
    } catch (error) {
        logger.error("Error in createRecord:", error);
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const record = await MonthlyReportRecord.findById(id);
        if (!record) {
            return res.status(404).json({ success: false, message: "Record not found" });
        }
        const folder = await MonthlyReportFolder.findById(record.folderId);
        if (!folder || !(await canModifyMonthlyReportSection(req.user, folder.sectionId))) {
            return res.status(403).json({ success: false, message: "You are not assigned to this department/section" });
        }

        await deleteFromLocal(record.fileUrl);
        const slidesDir = path.join(process.cwd(), "uploads", "monthly-report", "slides", String(record.id));
        fs.rm(slidesDir, { recursive: true, force: true }, () => {});

        await MonthlyReportRecord.deleteById(id);
        return res.status(200).json({ success: true, message: "Record deleted successfully" });
    } catch (error) {
        logger.error("Error in deleteRecord:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
