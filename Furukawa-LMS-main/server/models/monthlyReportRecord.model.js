import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class MonthlyReportRecord {
    static async init() {
        try {
            if (!await migrationHelper.tableExists('monthly_report_records')) {
                await executeQuery(`
                    CREATE TABLE monthly_report_records (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        folderId INT NOT NULL,
                        title NVARCHAR(255) NOT NULL,
                        originalFileName NVARCHAR(500) NOT NULL,
                        fileUrl NVARCHAR(1000) NOT NULL,
                        fileSizeBytes BIGINT NOT NULL,
                        month NVARCHAR(20) NOT NULL,
                        year NVARCHAR(4) NOT NULL,
                        slideCount INT NOT NULL DEFAULT 0,
                        slides NVARCHAR(MAX) NOT NULL DEFAULT '[]',
                        conversionStatus NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
                        conversionError NVARCHAR(MAX) NULL,
                        createdBy INT NOT NULL,
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        FOREIGN KEY (folderId) REFERENCES monthly_report_folders(id) ON DELETE CASCADE,
                        FOREIGN KEY (createdBy) REFERENCES users(id)
                    )
                `);
            }
            await migrationHelper.ensureIndexExists(
                'monthly_report_records',
                'IX_monthly_report_records_folder',
                'CREATE INDEX IX_monthly_report_records_folder ON monthly_report_records (folderId)'
            );
            await migrationHelper.ensureIndexExists(
                'monthly_report_records',
                'IX_monthly_report_records_month_year',
                'CREATE INDEX IX_monthly_report_records_month_year ON monthly_report_records (month, year)'
            );
            logger.info("Checked/Created monthly_report_records table in MSSQL");
        } catch (error) {
            logger.error("Failed to initialize monthly_report_records table", error);
        }
    }

    static async findByFolderId(folderId) {
        const [rows] = await executeQuery(
            "SELECT * FROM monthly_report_records WHERE folderId = ? ORDER BY createdAt DESC",
            [folderId]
        );
        return rows;
    }

    static async findById(id) {
        const [rows] = await executeQuery(
            "SELECT * FROM monthly_report_records WHERE id = ?",
            [id]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    static async create({ folderId, title, originalFileName, fileUrl, fileSizeBytes, month, year, createdBy }) {
        const [result] = await executeQuery(
            `INSERT INTO monthly_report_records
                (folderId, title, originalFileName, fileUrl, fileSizeBytes, month, year, slideCount, slides, conversionStatus, createdBy, createdAt, updatedAt)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, '[]', 'PENDING', ?, GETDATE(), GETDATE())`,
            [folderId, title, originalFileName, fileUrl, fileSizeBytes, month, year, createdBy]
        );
        const insertedId = result[0].id;
        return MonthlyReportRecord.findById(insertedId);
    }

    static async markProcessing(id) {
        await executeQuery(
            "UPDATE monthly_report_records SET conversionStatus = 'PROCESSING', updatedAt = GETDATE() WHERE id = ?",
            [id]
        );
    }

    static async markDone(id, { slides, slideCount }) {
        await executeQuery(
            `UPDATE monthly_report_records
             SET conversionStatus = 'DONE', slides = ?, slideCount = ?, conversionError = NULL, updatedAt = GETDATE()
             WHERE id = ?`,
            [JSON.stringify(slides), slideCount, id]
        );
        return MonthlyReportRecord.findById(id);
    }

    static async markFailed(id, errorMessage) {
        await executeQuery(
            "UPDATE monthly_report_records SET conversionStatus = 'FAILED', conversionError = ?, updatedAt = GETDATE() WHERE id = ?",
            [String(errorMessage || "Conversion failed").slice(0, 4000), id]
        );
        return MonthlyReportRecord.findById(id);
    }

    static async deleteById(id) {
        await executeQuery("DELETE FROM monthly_report_records WHERE id = ?", [id]);
    }
}

MonthlyReportRecord.init().catch(err => logger.error("Failed to initialize monthly_report_records table:", err));

export default MonthlyReportRecord;
