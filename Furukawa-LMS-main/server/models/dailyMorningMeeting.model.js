import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class DailyMorningMeeting {
    static async init() {
        try {
            if (!await migrationHelper.tableExists('daily_morning_meetings')) {
                await executeQuery(`
                    CREATE TABLE daily_morning_meetings (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        sectionId INT NOT NULL,
                        agenda NVARCHAR(255) NOT NULL,
                        description NVARCHAR(MAX),
                        meetingDate DATE NOT NULL,
                        meetingTime TIME NOT NULL,
                        createdBy INT NOT NULL,
                        sheetData NVARCHAR(MAX) DEFAULT '{}',
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        FOREIGN KEY (sectionId) REFERENCES [sections](id) ON DELETE CASCADE,
                        FOREIGN KEY (createdBy) REFERENCES users(id)
                    )
                `);
            }
            logger.info("Checked/Created daily_morning_meetings table in MSSQL");
        } catch (error) {
            logger.error("Failed to initialize daily_morning_meetings table", error);
        }
    }

    static async findBySectionId(sectionId) {
        const [rows] = await executeQuery(
            `SELECT m.*, u.fullName AS createdByName
             FROM daily_morning_meetings m
             LEFT JOIN users u ON u.id = m.createdBy
             WHERE m.sectionId = ?
             ORDER BY m.meetingDate DESC, m.meetingTime DESC, m.id DESC`,
            [sectionId]
        );
        return rows;
    }

    static async findById(id) {
        const [rows] = await executeQuery(
            `SELECT m.*, u.fullName AS createdByName
             FROM daily_morning_meetings m
             LEFT JOIN users u ON u.id = m.createdBy
             WHERE m.id = ?`,
            [id]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    static async create({ sectionId, agenda, description, meetingDate, meetingTime, createdBy }) {
        const [result] = await executeQuery(
            `INSERT INTO daily_morning_meetings (sectionId, agenda, description, meetingDate, meetingTime, createdBy, sheetData, createdAt, updatedAt)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?, ?, '{}', GETDATE(), GETDATE())`,
            [sectionId, agenda, description || null, meetingDate, meetingTime, createdBy]
        );
        const insertedId = result[0].id;
        return DailyMorningMeeting.findById(insertedId);
    }

    static async updateDetails(id, { agenda, description }) {
        await executeQuery(
            "UPDATE daily_morning_meetings SET agenda = ?, description = ?, updatedAt = GETDATE() WHERE id = ?",
            [agenda, description || null, id]
        );
        return DailyMorningMeeting.findById(id);
    }

    static async updateSheetData(id, sheetData) {
        const dataJson = typeof sheetData === "string" ? sheetData : JSON.stringify(sheetData);
        await executeQuery(
            "UPDATE daily_morning_meetings SET sheetData = ?, updatedAt = GETDATE() WHERE id = ?",
            [dataJson, id]
        );
        return DailyMorningMeeting.findById(id);
    }

    static async deleteById(id) {
        await executeQuery("DELETE FROM daily_morning_meetings WHERE id = ?", [id]);
    }
}

DailyMorningMeeting.init().catch(err => logger.error("Failed to initialize daily_morning_meetings table:", err));

export default DailyMorningMeeting;
