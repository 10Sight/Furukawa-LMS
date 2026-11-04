import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class DailyMeetingConfig {
    static async init() {
        try {
            if (!await migrationHelper.tableExists('daily_meeting_configs')) {
                await executeQuery(`
                    CREATE TABLE daily_meeting_configs (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        departmentId INT NOT NULL UNIQUE,
                        shutter BIT DEFAULT 0,
                        lpaShutter BIT DEFAULT 0,
                        sections NVARCHAR(MAX) DEFAULT '[]',
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE
                    )
                `);
            }
            await migrationHelper.ensureColumnExists('daily_meeting_configs', 'lpaShutter', 'BIT DEFAULT 0');
            await migrationHelper.ensureColumnExists('daily_meeting_configs', 'hrMeetingShutter', 'BIT DEFAULT 0');
            await migrationHelper.ensureColumnExists('daily_meeting_configs', 'handoverShutter', 'BIT DEFAULT 0');
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

    // Departments that show the Daily HR Meeting or Daily Handover Report tab; used to send
    // the old /daily-meeting/hr-meeting link to a department where that tab exists.
    static async findWithHrTabs() {
        const [rows] = await executeQuery(
            "SELECT departmentId, hrMeetingShutter, handoverShutter FROM daily_meeting_configs WHERE hrMeetingShutter = 1 OR handoverShutter = 1"
        );
        return rows;
    }

    static async upsert(departmentId, shutter, sections, lpaShutter = false, hrMeetingShutter = false, handoverShutter = false) {
        const sectionsJson = JSON.stringify(sections);
        const shutterVal = shutter ? 1 : 0;
        const lpaShutterVal = lpaShutter ? 1 : 0;
        const hrMeetingShutterVal = hrMeetingShutter ? 1 : 0;
        const handoverShutterVal = handoverShutter ? 1 : 0;
        const existing = await DailyMeetingConfig.findByDepartmentId(departmentId);

        if (existing) {
            await executeQuery(
                "UPDATE daily_meeting_configs SET shutter = ?, lpaShutter = ?, hrMeetingShutter = ?, handoverShutter = ?, sections = ?, updatedAt = GETDATE() WHERE departmentId = ?",
                [shutterVal, lpaShutterVal, hrMeetingShutterVal, handoverShutterVal, sectionsJson, departmentId]
            );
        } else {
            await executeQuery(
                `INSERT INTO daily_meeting_configs (departmentId, shutter, lpaShutter, hrMeetingShutter, handoverShutter, sections, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
                [departmentId, shutterVal, lpaShutterVal, hrMeetingShutterVal, handoverShutterVal, sectionsJson]
            );
        }

        return DailyMeetingConfig.findByDepartmentId(departmentId);
    }
}

DailyMeetingConfig.init().catch(err => logger.error("Failed to initialize daily_meeting_configs table:", err));

export default DailyMeetingConfig;
