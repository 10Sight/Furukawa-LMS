import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class DailyMeetingSheet {
    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'daily_meeting_sheets')
            BEGIN
                CREATE TABLE daily_meeting_sheets (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    sectionId INT NOT NULL UNIQUE,
                    data NVARCHAR(MAX) DEFAULT '{}',
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (sectionId) REFERENCES [sections](id) ON DELETE CASCADE
                );
            END
        `;
        try {
            await executeQuery(query);
            logger.info("Checked/Created daily_meeting_sheets table in MSSQL");
        } catch (error) {
            logger.error("Failed to initialize daily_meeting_sheets table", error);
        }
    }

    static async findBySectionId(sectionId) {
        const [rows] = await executeQuery(
            "SELECT * FROM daily_meeting_sheets WHERE sectionId = ?",
            [sectionId]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    static async upsert(sectionId, data) {
        const dataJson = typeof data === 'string' ? data : JSON.stringify(data);
        const existing = await DailyMeetingSheet.findBySectionId(sectionId);

        if (existing) {
            await executeQuery(
                "UPDATE daily_meeting_sheets SET data = ?, updatedAt = GETDATE() WHERE sectionId = ?",
                [dataJson, sectionId]
            );
        } else {
            await executeQuery(
                `INSERT INTO daily_meeting_sheets (sectionId, data, createdAt, updatedAt)
                 VALUES (?, ?, GETDATE(), GETDATE())`,
                [sectionId, dataJson]
            );
        }

        return DailyMeetingSheet.findBySectionId(sectionId);
    }
}

DailyMeetingSheet.init().catch(err => logger.error("Failed to initialize daily_meeting_sheets table:", err));

export default DailyMeetingSheet;
