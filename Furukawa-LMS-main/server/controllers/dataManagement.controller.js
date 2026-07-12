import fs from "fs/promises";
import path from "path";
import { pool, mssql, baseConfig } from "../db/connectDB.js";
import { getUserTables, tableHasIdentity } from "../db/mssqlHelper.js";
import ENV from "../configs/env.config.js";

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

// Native SQL Server .bak files live here; SQL Server itself must be able to read/write
// this path since RESTORE DATABASE runs inside the SQL Server service, not this process.
const BACKUP_DIR = "C:\\DojoBackup";

// Resolves a backupId (filename) to a path inside BACKUP_DIR, rejecting anything that
// isn't a plain "<name>.bak" filename so it can't be used for directory traversal.
const resolveBackupFile = (backupId) => {
    const filename = path.basename(backupId || "");
    if (!filename || filename !== backupId || !/\.bak$/i.test(filename)) {
        throw new ApiError("Invalid backup file name", 400);
    }
    return { filename, filePath: path.join(BACKUP_DIR, filename) };
};

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

// Resolves collection keys (friendly alias or raw table name) to real table names,
// dropping anything not present in the live table list. This whitelist check is what
// makes it safe to accept a raw table name here instead of only alias lookups -
// a key that isn't a real table (e.g. an injection attempt) is silently filtered out.
const resolveTableNames = (keys, allTables) =>
    keys.map(k => ENTITY_TABLE_MAP[k] || k).filter(name => allTables.includes(name));

// === DATABASE BACKUP OPERATIONS ===
// .bak files are produced outside this app (e.g. a SQL Server Agent maintenance plan)
// and dropped into BACKUP_DIR. This module only lists, restores, and deletes them.

// Get backup history
export const getBackupHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;

    try {
        await fs.access(BACKUP_DIR);
    } catch {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    }

    const entries = await fs.readdir(BACKUP_DIR);
    const bakFiles = entries.filter(name => /\.bak$/i.test(name));

    const filesWithStats = await Promise.all(bakFiles.map(async (filename) => {
        const stats = await fs.stat(path.join(BACKUP_DIR, filename));
        return { filename, size: stats.size, createdAt: stats.birthtime || stats.mtime };
    }));

    filesWithStats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalBackups = filesWithStats.length;
    const offset = (pageNum - 1) * limitNum;
    const pageFiles = filesWithStats.slice(offset, offset + limitNum);

    const backups = pageFiles.map(f => ({
        id: f.filename,
        createdAt: f.createdAt,
        fileExists: true,
        backup: { id: f.filename, size: f.size }
    }));

    res.json(new ApiResponse(200, {
        backups,
        pagination: {
            currentPage: pageNum,
            totalPages: Math.max(1, Math.ceil(totalBackups / limitNum)),
            totalBackups,
            limit: limitNum
        }
    }, 'Backup history fetched successfully'));
});

// Restore from backup
export const restoreFromBackup = asyncHandler(async (req, res) => {
    const { backupId } = req.params;
    const { confirmRestore = false } = req.body;

    if (!confirmRestore) throw new ApiError('Restore confirmation required', 400);

    const { filename, filePath } = resolveBackupFile(backupId);

    try {
        await fs.access(filePath);
    } catch {
        throw new ApiError('Backup file not found', 404);
    }

    // Restore runs against `master` on its own connection pool: the target database
    // gets dropped into SINGLE_USER mode and its own connections severed, so we can't
    // run this over the app's normal pool (which targets that same database).
    const masterPool = new mssql.ConnectionPool({ ...baseConfig, database: 'master' });
    let singleUserSet = false;

    try {
        await masterPool.connect();

        await masterPool.request().query(`ALTER DATABASE [${ENV.DB_NAME}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE`);
        singleUserSet = true;

        await masterPool.request()
            .input('backupPath', mssql.NVarChar, filePath)
            .query(`RESTORE DATABASE [${ENV.DB_NAME}] FROM DISK = @backupPath WITH REPLACE`);

        await masterPool.request().query(`ALTER DATABASE [${ENV.DB_NAME}] SET MULTI_USER`);
        singleUserSet = false;

        await Audit.create({
            user: req.user.id,
            action: 'RESTORE_BACKUP',
            details: { backupId: filename },
            ipAddress: req.ip || '',
            userAgent: req.get('User-Agent') || ''
        });

        res.json(new ApiResponse(200, {
            message: 'Database restored successfully',
            backupId: filename
        }, 'Restore completed'));
    } catch (error) {
        throw new ApiError(`Restore failed: ${error.message}`, 500);
    } finally {
        if (singleUserSet) {
            try {
                await masterPool.request().query(`ALTER DATABASE [${ENV.DB_NAME}] SET MULTI_USER`);
            } catch (e) {
                console.error('Failed to restore MULTI_USER mode after a failed restore:', e.message);
            }
        }
        await masterPool.close().catch(() => { });
    }
});

// Delete backup
export const deleteBackup = asyncHandler(async (req, res) => {
    const { backupId } = req.params;
    const { filename, filePath } = resolveBackupFile(backupId);

    try {
        await fs.access(filePath);
    } catch {
        throw new ApiError('Backup file not found', 404);
    }

    await fs.unlink(filePath);

    await Audit.create({
        user: req.user.id,
        action: 'DELETE_BACKUP',
        details: { backupId: filename },
        ipAddress: req.ip || '',
        userAgent: req.get('User-Agent') || ''
    });

    res.json(new ApiResponse(200, { backupId: filename }, 'Backup deleted successfully'));
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
    const allTables = await getUserTables();
    const keysToExport = collections.length ? resolveTableNames(collections, allTables) : allTables;

    for (const tableName of keysToExport) {
        let sql = `SELECT * FROM [${tableName}]`;
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
            exportData[tableName] = rows;
        } catch (e) {
            // Likely table missing or column missing
            console.warn(`Skipped export for ${tableName}: ${e.message}`);
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

        const allTables = await getUserTables();
        const keys = collections.length ? collections : Object.keys(importData.data);

        for (const key of keys) {
            const [tableName] = resolveTableNames([key], allTables);
            if (!tableName) continue;

            const data = importData.data[key];
            if (!Array.isArray(data) || data.length === 0) continue;

            if (mode === 'replace') {
                await conn.query(`DELETE FROM [${tableName}]`);
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
                    const sql = `INSERT INTO [${tableName}] (${cols.map(c => `[${c}]`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`;

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
    const allTables = await getUserTables();

    for (const tableName of allTables) {
        const [rows] = await pool.query(`SELECT COUNT(*) as total FROM [${tableName}]`);
        let recent = 0;
        try {
            const [recRows] = await pool.query(`SELECT COUNT(*) as c FROM [${tableName}] WHERE createdAt >= DATEADD(day, -7, GETDATE())`);
            recent = recRows[0].c;
        } catch (e) { }

        stats[tableName] = {
            total: rows[0].total,
            recent
        };
    }

    let estimatedSize = 0;
    try {
        const [sizeRows] = await pool.query("SELECT SUM(reserved_page_count) * 8 * 1024 AS totalBytes FROM sys.dm_db_partition_stats");
        estimatedSize = sizeRows[0]?.totalBytes || 0;
    } catch (e) { }

    const summary = {
        totalCollections: allTables.length,
        totalRecords: Object.values(stats).reduce((sum, s) => sum + s.total, 0),
        estimatedSize
    };

    res.json(new ApiResponse(200, { statistics: stats, summary }, 'Fetched stats'));
});

export const getDataOperationHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query(
        "SELECT a.*, u.fullName FROM audits a LEFT JOIN users u ON a.[user] = u.id WHERE action IN ('RESTORE_BACKUP','DELETE_BACKUP','EXPORT_DATA','IMPORT_DATA') ORDER BY createdAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
        [Number(offset), Number(limit)]
    );

    const [c] = await pool.query("SELECT COUNT(*) as total FROM audits WHERE action IN ('RESTORE_BACKUP','DELETE_BACKUP','EXPORT_DATA','IMPORT_DATA')");

    res.json(new ApiResponse(200, { operations: rows, total: c[0].total }, 'History fetched'));
});

export const cleanupOldData = asyncHandler(async (req, res) => {
    const { cleanupAuditLogs, auditLogRetentionDays = 90, cleanupBackups, backupRetentionDays = 30, dryRun = true } = req.body;

    const results = {};

    if (cleanupAuditLogs) {
        const sql = "SELECT COUNT(*) as count FROM audits WHERE createdAt < DATEADD(day, -?, GETDATE())";
        const [rows] = await pool.query(sql, [auditLogRetentionDays]);
        results.auditLogs = { toDelete: rows[0].count };

        if (!dryRun) {
            await pool.query("DELETE FROM audits WHERE createdAt < DATEADD(day, -?, GETDATE())", [auditLogRetentionDays]);
            results.auditLogs.deleted = rows[0].count;
        }
    }

    // Backup cleanup (deleting old .bak files from BACKUP_DIR) is not implemented yet.

    res.json(new ApiResponse(200, { results }, 'Cleanup run'));
});
