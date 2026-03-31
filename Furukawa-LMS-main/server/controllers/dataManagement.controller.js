import fs from "fs/promises";
import path from "path";
import archiver from "archiver";
import { promisify } from "util";
import { exec } from "child_process";
import { pool } from "../db/connectDB.js";

// Import all models mainly to ensure tables init or for referencing names if needed,
// but for bulk generic ops, simple SQL is often cleaner.
import User from "../models/auth.model.js";
import Course from "../models/course.model.js";
import Department from "../models/department.model.js";
import Progress from "../models/progress.model.js";
import Audit from "../models/audit.model.js";
import Quiz from "../models/quiz.model.js";
import Assignment from "../models/assignment.model.js";
import Certificate from "../models/certificate.model.js";
// Additional migrated models
import Enrollment from "../models/enrollment.model.js";
import AttemptedQuiz from "../models/attemptedQuiz.model.js";
import CourseLevelConfig from "../models/courseLevelConfig.model.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const execAsync = promisify(exec);

// Map collection/entity names to Table names
const ENTITY_TABLE_MAP = {
    users: 'users',
    courses: 'courses',
    departments: 'departments',
    progress: 'progress',
    audits: 'audits',
    quizzes: 'quizzes',
    assignments: 'assignments',
    certificates: 'certificates',
    enrollments: 'enrollments',
    attempted_quizzes: 'attempted_quizzes',
    course_level_configs: 'course_level_configs'
};

// Map collection names to Models for validation/schema awareness if needed
// (Models in SQL are mostly wrappers, might not support bulk validate same way)

// === DATABASE BACKUP OPERATIONS ===

// Create database backup
export const createDatabaseBackup = asyncHandler(async (req, res) => {
    try {
        const { includeFiles = false, compression = true, encryption = false, description } = req.body;

        const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const backupDir = path.join(process.cwd(), 'backups');
        const backupPath = path.join(backupDir, backupId);

        // Create backup directory
        try {
            await fs.access(backupDir);
        } catch {
            await fs.mkdir(backupDir, { recursive: true });
        }

        const backupMetadata = {
            id: backupId,
            createdAt: new Date(),
            createdBy: req.user.id,
            description: description || `Database backup created at ${new Date().toISOString()}`,
            includeFiles,
            compression,
            encryption, // Not fully implemented in this logic
            status: 'in_progress',
            size: 0,
            collections: {},
            version: process.env.APP_VERSION || '1.0.0'
        };

        // Export data from tables
        const collectionsData = {};

        for (const [key, tableName] of Object.entries(ENTITY_TABLE_MAP)) {
            const [rows] = await pool.query(`SELECT * FROM ${tableName}`);
            collectionsData[key] = rows;
            backupMetadata.collections[key] = rows.length;
        }

        const backupData = {
            metadata: backupMetadata,
            data: collectionsData,
            timestamp: new Date().toISOString()
        };

        let backupFilePath = `${backupPath}.json`;

        // Write backup data
        await fs.writeFile(backupFilePath, JSON.stringify(backupData, null, 2));

        // Compress
        if (compression) {
            const compressedPath = `${backupPath}.zip`;
            const output = await import('fs').then(fs => fs.createWriteStream(compressedPath));
            const archive = archiver('zip', { zlib: { level: 9 } });

            await new Promise((resolve, reject) => {
                output.on('close', resolve);
                output.on('error', reject);
                archive.on('error', reject);
                archive.pipe(output);
                archive.file(backupFilePath, { name: `${backupId}.json` });
                archive.finalize();
            });

            await fs.unlink(backupFilePath);
            backupFilePath = compressedPath;
        }

        const stats = await fs.stat(backupFilePath);
        backupMetadata.size = stats.size;
        backupMetadata.status = 'completed';
        backupMetadata.filePath = backupFilePath;

        // Log to Audit
        await Audit.create({
            user: req.user.id,
            action: 'CREATE_BACKUP',
            details: backupMetadata,
            ipAddress: req.ip || '',
            userAgent: req.get('User-Agent') || ''
        });

        res.json(new ApiResponse(200, {
            backupId,
            metadata: backupMetadata,
            message: 'Database backup created successfully'
        }, 'Backup created successfully'));

    } catch (error) {
        console.error("Backup failed:", error);
        throw new ApiError('Failed to create database backup', 500);
    }
});

// Get backup history
export const getBackupHistory = asyncHandler(async (req, res) => {
    try {
        const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        // Raw SQL for sorting
        const orderSql = order === 'desc' ? 'DESC' : 'ASC';
        const sortColStr = sortBy === 'createdAt' ? 'createdAt' : 'createdAt'; // Safety

        const validSort = ['createdAt'].includes(sortBy) ? sortBy : 'createdAt';

        // Fetch logs
        // Join with users for populating userId
        const query = `
            SELECT a.*, u.fullName, u.email 
            FROM audits a 
            LEFT JOIN users u ON a.user = u.id 
            WHERE a.action = 'CREATE_BACKUP' 
            ORDER BY a.${validSort} ${orderSql} 
            LIMIT ? OFFSET ?
        `;

        const [rows] = await pool.query(query, [Number(limit), Number(offset)]);

        const [countRow] = await pool.query("SELECT COUNT(*) as total FROM audits WHERE action = 'CREATE_BACKUP'");
        const totalBackups = countRow[0].total;

        // Check files
        const backupsWithStatus = await Promise.all(rows.map(async (row) => {
            // Details is JSON
            let details = row.details;
            if (typeof details === 'string') {
                try { details = JSON.parse(details); } catch (e) { }
            }

            let fileExists = false;
            let fileSize = 0;
            if (details && details.filePath) {
                try {
                    const stats = await fs.stat(details.filePath);
                    fileExists = true;
                    fileSize = stats.size;
                } catch (e) { }
            }

            return {
                ...row,
                details,
                user: { fullName: row.fullName, email: row.email },
                fileExists,
                fileSize,
                backup: details
            };
        }));

        res.json(new ApiResponse(200, {
            backups: backupsWithStatus,
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(totalBackups / Number(limit)),
                totalBackups,
                limit: Number(limit)
            }
        }, 'Backup history fetched successfully'));

    } catch (error) {
        console.error(error);
        throw new ApiError('Failed to fetch backup history', 500);
    }
});

// Restore from backup
export const restoreFromBackup = asyncHandler(async (req, res) => {
    const { backupId } = req.params;
    const { collections = [], confirmRestore = false } = req.body;

    if (!confirmRestore) throw new ApiError('Restore confirmation required', 400);

    // Find backup in audit logs
    // Details is JSON, need LIKE or JSON_EXTRACT to find ID?
    // "details": {"id": "backup_..."}
    // Simple robust way: query audits with action CREATE_BACKUP and filter in app if volume low,
    // or use JSON_EXTRACT if MySQL 5.7+

    // Assuming JSON_EXTRACT:
    const [rows] = await pool.query("SELECT * FROM audits WHERE action = 'CREATE_BACKUP' AND JSON_EXTRACT(details, '$.id') = ?", [backupId]);
    const backupRecord = rows[0];

    if (!backupRecord) throw new ApiError('Backup not found', 404);

    let details = backupRecord.details;
    if (typeof details === 'string') details = JSON.parse(details);

    const backupPath = details.filePath;

    try {
        await fs.access(backupPath);
    } catch {
        throw new ApiError('Backup file not found', 404);
    }

    let backupContent;
    if (backupPath.endsWith('.zip')) {
        throw new ApiError('Compressed backup restore not yet implemented', 501);
    } else {
        const fileData = await fs.readFile(backupPath, 'utf8');
        backupContent = JSON.parse(fileData);
    }

    if (!backupContent.data || !backupContent.metadata) {
        throw new ApiError('Invalid backup format', 400);
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Disable FK checks
        await conn.query("SET FOREIGN_KEY_CHECKS = 0");

        const keysToRestore = collections.length ? collections : Object.keys(backupContent.data);

        for (const key of keysToRestore) {
            const tableName = ENTITY_TABLE_MAP[key];
            if (!tableName) continue;

            const tableData = backupContent.data[key];
            if (!tableData || !Array.isArray(tableData)) continue;

            // Truncate
            await conn.query(`TRUNCATE TABLE ${tableName}`);

            // Bulk Insert
            if (tableData.length > 0) {
                // Construct bulk insert
                // Need columns from first item
                const columns = Object.keys(tableData[0]);
                const placeholders = `(${columns.map(() => '?').join(',')})`;
                const sql = `INSERT INTO ${tableName} (${columns.map(c => `\`${c}\``).join(',')}) VALUES ${tableData.map(() => placeholders).join(',')}`;

                const flattenValues = tableData.flatMap(row =>
                    columns.map(col => {
                        const val = row[col];
                        // Handle objects/arrays specifically if they map to JSON columns
                        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                        return val;
                    })
                );

                await conn.query(sql, flattenValues);
            }
        }

        await conn.query("SET FOREIGN_KEY_CHECKS = 1");
        await conn.commit();

        await Audit.create({
            user: req.user.id,
            action: 'RESTORE_BACKUP',
            details: { backupId, restoredCollections: keysToRestore },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.json(new ApiResponse(200, {
            message: 'Database restored successfully',
            backupId
        }, 'Restore completed'));

    } catch (error) {
        await conn.query("SET FOREIGN_KEY_CHECKS = 1"); // Ensure re-enable
        await conn.rollback();
        throw new ApiError(`Restore failed: ${error.message}`, 500);
    } finally {
        conn.release();
    }
});

// Delete backup
export const deleteBackup = asyncHandler(async (req, res) => {
    const { backupId } = req.params;

    const [rows] = await pool.query("SELECT * FROM audits WHERE action = 'CREATE_BACKUP' AND JSON_EXTRACT(details, '$.id') = ?", [backupId]);
    const record = rows[0];

    if (!record) throw new ApiError('Backup not found', 404);

    let details = record.details;
    if (typeof details === 'string') details = JSON.parse(details);

    if (details.filePath) {
        try {
            await fs.unlink(details.filePath);
        } catch (e) { }
    }

    details.deleted = true;
    details.deletedAt = new Date();
    details.deletedBy = req.user.id;

    // Update audit info
    await pool.query("UPDATE audits SET details = ? WHERE id = ?", [JSON.stringify(details), record.id]);

    res.json(new ApiResponse(200, { backupId }, 'Backup deleted successfully'));
});

// === DATA EXPORT ===

export const exportSystemData = asyncHandler(async (req, res) => {
    const {
        collections = [],
        format = 'json',
        dateFrom,
        dateTo
    } = req.body;

    const exportData = {};
    const keysToExport = collections.length ? collections : Object.keys(ENTITY_TABLE_MAP);

    for (const key of keysToExport) {
        const tableName = ENTITY_TABLE_MAP[key];
        if (!tableName) continue;

        let sql = `SELECT * FROM ${tableName}`;
        let params = [];
        let clauses = [];

        // Check if table has createdAt for filtering
        // We assume most do. If not, catch error or check schema.
        // Simplified: try apply date filter, if fails, we consume error or skip filtering for that table?
        // Better: assume standard tables have createdAt if relevant.
        // We'll append WHERE logic conditionally
        if (dateFrom || dateTo) {
            // Basic Check if 'createdAt' column exists could be done or rely on try/catch
            // For now assume all main entities have createdAt
            if (dateFrom) { clauses.push("createdAt >= ?"); params.push(new Date(dateFrom)); }
            if (dateTo) { clauses.push("createdAt <= ?"); params.push(new Date(dateTo)); }
        }

        if (clauses.length > 0) sql += " WHERE " + clauses.join(" AND ");

        try {
            const [rows] = await pool.query(sql, params);
            exportData[key] = rows;
        } catch (e) {
            // Likely table missing or column missing
            console.warn(`Skipped export for ${key}: ${e.message}`);
        }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `lms_export_${timestamp}.${format}`;

    if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json(new ApiResponse(200, { data: exportData }, 'Exported'));
    } else if (format === 'csv') {
        let csvContent = '';
        for (const [key, data] of Object.entries(exportData)) {
            if (!data || data.length === 0) continue;
            csvContent += `\n--- ${key.toUpperCase()} ---\n`;
            const headers = Object.keys(data[0]);
            csvContent += headers.join(',') + '\n';
            data.forEach(row => {
                const vals = headers.map(h => {
                    const v = row[h];
                    if (typeof v === 'object') return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
                    return JSON.stringify(v); // handle commas in strings
                });
                csvContent += vals.join(',') + '\n';
            });
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);
    }
});

// Import System Data
export const importSystemData = asyncHandler(async (req, res) => {
    const { mode = 'append', collections = [] } = req.body;

    let importData;
    if (req.file) {
        const content = await fs.readFile(req.file.path, 'utf8');
        importData = JSON.parse(content);
        await fs.unlink(req.file.path).catch(() => { });
    } else {
        importData = req.body.data;
    }

    if (!importData || !importData.data) throw new ApiError('Invalid data', 400);

    const conn = await pool.getConnection();
    const results = {};

    try {
        await conn.beginTransaction();

        const keys = collections.length ? collections : Object.keys(importData.data);

        for (const key of keys) {
            const tableName = ENTITY_TABLE_MAP[key];
            if (!tableName) continue;

            const data = importData.data[key];
            if (!Array.isArray(data) || data.length === 0) continue;

            if (mode === 'replace') {
                await conn.query(`DELETE FROM ${tableName}`);
            }

            let imported = 0;
            let errors = 0;

            for (const record of data) {
                // Insert or Update logic
                // Simple insert first for append
                try {
                    // Construct INSERT SET ?
                    // This is complex for generic without known schema columns.
                    // Strategy: use keys from record
                    const cols = Object.keys(record);
                    const vals = Object.values(record).map(v => (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v);

                    // Prepare placeholders
                    const sql = `INSERT INTO ${tableName} (${cols.map(c => `\`${c}\``).join(',')}) VALUES (${cols.map(() => '?').join(',')})`;

                    // With REPLACE mode, we want standard INSERT? 
                    // Or ON DUPLICATE KEY UPDATE?
                    // If 'append', usually generic INSERT.
                    // If 'replace' entire table, generic INSERT.
                    await conn.query(sql, vals);
                    imported++;
                } catch (e) {
                    errors++;
                    // Ignore specific dupe errors?
                }
            }
            results[key] = { imported, errors };
        }

        await conn.commit();
        res.json(new ApiResponse(200, { results }, 'Import completed'));
    } catch (e) {
        await conn.rollback();
        throw new ApiError(`Import failed: ${e.message}`, 500);
    } finally {
        conn.release();
    }
});

// Stats
export const getDataStatistics = asyncHandler(async (req, res) => {
    const stats = {};

    for (const [key, tableName] of Object.entries(ENTITY_TABLE_MAP)) {
        const [rows] = await pool.query(`SELECT COUNT(*) as total FROM ${tableName}`);
        // Recent?
        // SELECT COUNT(*) FROM table WHERE createdAt >= ...
        // Requires checking schema or wrapping try catch
        let recent = 0;
        try {
            const [recRows] = await pool.query(`SELECT COUNT(*) as c FROM ${tableName} WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)`);
            recent = recRows[0].c;
        } catch (e) { }

        stats[key] = {
            total: rows[0].total,
            recent
        };
    }

    res.json(new ApiResponse(200, { statistics: stats }, 'Fetched stats'));
});

export const getDataOperationHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query(
        "SELECT a.*, u.fullName FROM audits a LEFT JOIN users u ON a.user = u.id WHERE action IN ('CREATE_BACKUP','RESTORE_BACKUP','EXPORT_DATA','IMPORT_DATA') ORDER BY createdAt DESC LIMIT ? OFFSET ?",
        [Number(limit), Number(offset)]
    );

    const [c] = await pool.query("SELECT COUNT(*) as total FROM audits WHERE action IN ('CREATE_BACKUP','RESTORE_BACKUP','EXPORT_DATA','IMPORT_DATA')");

    res.json(new ApiResponse(200, { operations: rows, total: c[0].total }, 'History fetched'));
});

export const cleanupOldData = asyncHandler(async (req, res) => {
    const { cleanupAuditLogs, auditLogRetentionDays = 90, cleanupBackups, backupRetentionDays = 30, dryRun = true } = req.body;

    const results = {};

    if (cleanupAuditLogs) {
        const sql = "SELECT COUNT(*) as count FROM audits WHERE createdAt < DATE_SUB(NOW(), INTERVAL ? DAY)";
        const [rows] = await pool.query(sql, [auditLogRetentionDays]);
        results.auditLogs = { toDelete: rows[0].count };

        if (!dryRun) {
            await pool.query("DELETE FROM audits WHERE createdAt < DATE_SUB(NOW(), INTERVAL ? DAY)", [auditLogRetentionDays]);
            results.auditLogs.deleted = rows[0].count;
        }
    }

    // Backups logic similar, involves checking Audit logs for 'CREATE_BACKUP' and iterating files
    // Implemented simplified

    res.json(new ApiResponse(200, { results }, 'Cleanup run'));
});
