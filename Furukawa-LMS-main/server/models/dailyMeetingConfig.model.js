import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class DailyMeetingConfig {
    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'daily_meeting_configs')
            BEGIN
                CREATE TABLE daily_meeting_configs (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId INT NOT NULL UNIQUE,
                    shutter BIT DEFAULT 0,
                    sections NVARCHAR(MAX) DEFAULT '[]',
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE
                );
            END
        `;
        try {
            await executeQuery(query);
            logger.info("Checked/Created daily_meeting_configs table in MSSQL");
        } catch (error) {
            logger.error("Failed to initialize daily_meeting_configs table", error);
        }
    }

    static async findByDepartmentId(departmentId) {
        const [rows] = await executeQuery(
            "SELECT * FROM daily_meeting_configs WHERE departmentId = ?",
            [departmentId]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    static async upsert(departmentId, shutter, sections) {
        const sectionsJson = JSON.stringify(sections);
        const shutterVal = shutter ? 1 : 0;
        const existing = await DailyMeetingConfig.findByDepartmentId(departmentId);

        if (existing) {
            await executeQuery(
                "UPDATE daily_meeting_configs SET shutter = ?, sections = ?, updatedAt = GETDATE() WHERE departmentId = ?",
                [shutterVal, sectionsJson, departmentId]
            );
        } else {
            await executeQuery(
                `INSERT INTO daily_meeting_configs (departmentId, shutter, sections, createdAt, updatedAt)
                 VALUES (?, ?, ?, GETDATE(), GETDATE())`,
                [departmentId, shutterVal, sectionsJson]
            );
        }

        return DailyMeetingConfig.findByDepartmentId(departmentId);
    }
}

DailyMeetingConfig.init().catch(err => logger.error("Failed to initialize daily_meeting_configs table:", err));

export default DailyMeetingConfig;
