import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class MonthlyReportConfig {
    static async init() {
        try {
            if (!await migrationHelper.tableExists('monthly_report_configs')) {
                await executeQuery(`
                    CREATE TABLE monthly_report_configs (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        departmentId INT NOT NULL UNIQUE,
                        shutter BIT DEFAULT 0,
                        sections NVARCHAR(MAX) DEFAULT '[]',
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE
                    )
                `);
            }
            logger.info("Checked/Created monthly_report_configs table in MSSQL");
        } catch (error) {
            logger.error("Failed to initialize monthly_report_configs table", error);
        }
    }

    static async findByDepartmentId(departmentId) {
        const [rows] = await executeQuery(
            "SELECT * FROM monthly_report_configs WHERE departmentId = ?",
            [departmentId]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    static async upsert(departmentId, shutter, sections) {
        const sectionsJson = JSON.stringify(sections);
        const shutterVal = shutter ? 1 : 0;
        const existing = await MonthlyReportConfig.findByDepartmentId(departmentId);

        if (existing) {
            await executeQuery(
                "UPDATE monthly_report_configs SET shutter = ?, sections = ?, updatedAt = GETDATE() WHERE departmentId = ?",
                [shutterVal, sectionsJson, departmentId]
            );
        } else {
            await executeQuery(
                `INSERT INTO monthly_report_configs (departmentId, shutter, sections, createdAt, updatedAt)
                 VALUES (?, ?, ?, GETDATE(), GETDATE())`,
                [departmentId, shutterVal, sectionsJson]
            );
        }

        return MonthlyReportConfig.findByDepartmentId(departmentId);
    }
}

MonthlyReportConfig.init().catch(err => logger.error("Failed to initialize monthly_report_configs table:", err));

export default MonthlyReportConfig;
