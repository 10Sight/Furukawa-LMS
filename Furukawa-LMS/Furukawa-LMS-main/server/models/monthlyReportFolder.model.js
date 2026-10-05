import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class MonthlyReportFolder {
    static async init() {
        try {
            if (!await migrationHelper.tableExists('monthly_report_folders')) {
                await executeQuery(`
                    CREATE TABLE monthly_report_folders (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        departmentId INT NOT NULL,
                        sectionId INT NOT NULL,
                        name NVARCHAR(255) NOT NULL,
                        color NVARCHAR(20) NOT NULL DEFAULT 'blue',
                        createdBy INT NOT NULL,
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        FOREIGN KEY (departmentId) REFERENCES departments(id),
                        FOREIGN KEY (sectionId) REFERENCES [sections](id) ON DELETE CASCADE,
                        FOREIGN KEY (createdBy) REFERENCES users(id)
                    )
                `);
            }
            await migrationHelper.ensureIndexExists(
                'monthly_report_folders',
                'IX_monthly_report_folders_section',
                'CREATE INDEX IX_monthly_report_folders_section ON monthly_report_folders (sectionId)'
            );
            logger.info("Checked/Created monthly_report_folders table in MSSQL");
        } catch (error) {
            logger.error("Failed to initialize monthly_report_folders table", error);
        }
    }

    static async findBySectionId(sectionId) {
        const [rows] = await executeQuery(
            `SELECT f.*,
                    (SELECT COUNT(*) FROM monthly_report_records r WHERE r.folderId = f.id) AS recordCount
             FROM monthly_report_folders f
             WHERE f.sectionId = ?
             ORDER BY f.createdAt DESC`,
            [sectionId]
        );
        return rows;
    }

    static async findById(id) {
        const [rows] = await executeQuery(
            "SELECT * FROM monthly_report_folders WHERE id = ?",
            [id]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    static async create({ departmentId, sectionId, name, color, createdBy }) {
        const [result] = await executeQuery(
            `INSERT INTO monthly_report_folders (departmentId, sectionId, name, color, createdBy, createdAt, updatedAt)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
            [departmentId, sectionId, name, color || 'blue', createdBy]
        );
        const insertedId = result[0].id;
        return MonthlyReportFolder.findById(insertedId);
    }

    static async deleteById(id) {
        await executeQuery("DELETE FROM monthly_report_folders WHERE id = ?", [id]);
    }
}

MonthlyReportFolder.init().catch(err => logger.error("Failed to initialize monthly_report_folders table:", err));

export default MonthlyReportFolder;
