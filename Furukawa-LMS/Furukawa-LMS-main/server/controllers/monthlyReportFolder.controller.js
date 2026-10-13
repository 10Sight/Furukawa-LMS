import fs from "fs";
import path from "path";
import logger from "../logger/winston.logger.js";
import { executeQuery } from "../db/mssqlHelper.js";
import MonthlyReportFolder from "../models/monthlyReportFolder.model.js";
import MonthlyReportRecord from "../models/monthlyReportRecord.model.js";
import { deleteFromLocal } from "../utils/fileStorage.util.js";
import { canModifyMonthlyReportSection } from "../utils/monthlyReportAccess.util.js";

const formatFolderRow = (row) => ({
    id: row.id,
    departmentId: row.departmentId,
    sectionId: row.sectionId,
    name: row.name,
    color: row.color,
    recordCount: row.recordCount ?? 0,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
});

// The department and section tabs of the Monthly Meeting Report page: every
// department and section as { id, name }, for anyone holding monthly_report:read.
// The general lists (/api/departments, /api/sections) can't serve these tabs — they
// give a custom role only its own and need permissions of their own. Mirrors
// getMeetingDepartments / getMeetingDepartmentSections in dailyMorningMeeting.controller.js.
export const getReportDepartments = async (req, res) => {
    try {
        const [rows] = await executeQuery(
            "SELECT id, name FROM departments WHERE (isDeleted IS NULL OR isDeleted = 0) ORDER BY createdAt DESC"
        );
        return res.status(200).json({
            success: true,
            data: { departments: rows.map((row) => ({ id: row.id, name: row.name })) }
        });
    } catch (error) {
        logger.error("Error in getReportDepartments:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getReportDepartmentSections = async (req, res) => {
    try {
        const departmentId = Number(req.params.departmentId);
        if (!Number.isInteger(departmentId) || departmentId <= 0) {
            return res.status(400).json({ success: false, message: "Department ID is required" });
        }
        const [rows] = await executeQuery(
            "SELECT id, name, departmentId FROM [sections] WHERE departmentId = ? ORDER BY createdAt DESC",
            [departmentId]
        );
        return res.status(200).json({
            success: true,
            data: rows.map((row) => ({ id: row.id, name: row.name, departmentId: row.departmentId }))
        });
    } catch (error) {
        logger.error("Error in getReportDepartmentSections:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getFoldersForSection = async (req, res) => {
    try {
        const { sectionId } = req.params;
        if (!sectionId) {
            return res.status(400).json({ success: false, message: "Section ID is required" });
        }
        // Read access is permission-gated only (route middleware) — no department/section lock,
        // mirrors getMeetingsForSection in dailyMorningMeeting.controller.js.
        const rows = await MonthlyReportFolder.findBySectionId(sectionId);
        return res.status(200).json({ success: true, data: rows.map(formatFolderRow) });
    } catch (error) {
        logger.error("Error in getFoldersForSection:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const createFolder = async (req, res) => {
    try {
        const { departmentId, sectionId, name, color } = req.body;
        if (!departmentId || !sectionId || !name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Department, section and folder name are required" });
        }
        if (!(await canModifyMonthlyReportSection(req.user, sectionId))) {
            return res.status(403).json({ success: false, message: "You are not assigned to this department/section" });
        }

        const folder = await MonthlyReportFolder.create({
            departmentId, sectionId, name: name.trim(), color, createdBy: req.user.id
        });

        return res.status(201).json({ success: true, message: "Folder created successfully", data: formatFolderRow({ ...folder, recordCount: 0 }) });
    } catch (error) {
        logger.error("Error in createFolder:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await MonthlyReportFolder.findById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Folder not found" });
        }
        if (!(await canModifyMonthlyReportSection(req.user, existing.sectionId))) {
            return res.status(403).json({ success: false, message: "You are not assigned to this department/section" });
        }

        // The FK is ON DELETE CASCADE at the DB level, but that only removes rows —
        // the original .pptx files and generated slide images on disk have to be
        // cleaned up here explicitly, or every folder delete leaks storage.
        const records = await MonthlyReportRecord.findByFolderId(id);
        for (const record of records) {
            await deleteFromLocal(record.fileUrl).catch((err) => logger.error(`Failed to delete original file for record ${record.id}:`, err));
            const slidesDir = path.join(process.cwd(), "uploads", "monthly-report", "slides", String(record.id));
            fs.rm(slidesDir, { recursive: true, force: true }, () => {});
        }

        await MonthlyReportFolder.deleteById(id);
        return res.status(200).json({ success: true, message: "Folder deleted successfully" });
    } catch (error) {
        logger.error("Error in deleteFolder:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
