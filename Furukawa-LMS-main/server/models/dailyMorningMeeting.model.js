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
            await migrationHelper.ensureColumnExists('daily_morning_meetings', 'fileProvider', "NVARCHAR(30) NOT NULL DEFAULT 'LOCAL_JSON'");
            await migrationHelper.ensureColumnExists('daily_morning_meetings', 'm365DriveId', 'NVARCHAR(255) NULL');
            await migrationHelper.ensureColumnExists('daily_morning_meetings', 'm365ItemId', 'NVARCHAR(255) NULL');
            await migrationHelper.ensureColumnExists('daily_morning_meetings', 'm365WebUrl', 'NVARCHAR(1000) NULL');
            await migrationHelper.ensureColumnExists('daily_morning_meetings', 'm365EmbedUrl', 'NVARCHAR(2000) NULL');
            await migrationHelper.ensureColumnExists('daily_morning_meetings', 'lastSyncedAt', 'DATETIME NULL');
            await migrationHelper.ensureColumnExists('daily_morning_meetings', 'm365FileName', 'NVARCHAR(255) NULL');
            await migrationHelper.ensureColumnExists('daily_morning_meetings', 'm365ETag', 'NVARCHAR(255) NULL');
            await migrationHelper.ensureColumnExists('daily_morning_meetings', 'm365CreatedDateTime', 'DATETIME NULL');
            await migrationHelper.ensureColumnExists('daily_morning_meetings', 'm365LastModifiedDateTime', 'DATETIME NULL');
            // Optimistic-concurrency token for sheet saves. Added here, after every
            // earlier column and not in the CREATE TABLE above, so it lands in the
            // same position on a fresh database as on one that is being migrated.
            await migrationHelper.ensureColumnExists('daily_morning_meetings', 'version', 'INT NOT NULL DEFAULT 1');
            await migrationHelper.ensureIndexExists(
                'daily_morning_meetings',
                'IX_daily_morning_meetings_section_meetingDate',
                'CREATE INDEX IX_daily_morning_meetings_section_meetingDate ON daily_morning_meetings (sectionId, meetingDate DESC)'
            );
            await migrationHelper.ensureIndexExists(
                'daily_morning_meetings',
                'IX_daily_morning_meetings_section_m365ItemId',
                'CREATE INDEX IX_daily_morning_meetings_section_m365ItemId ON daily_morning_meetings (sectionId, m365ItemId)'
            );

            logger.info("Checked/Created daily_morning_meetings table in MSSQL");
        } catch (error) {
            logger.error("Failed to initialize daily_morning_meetings table", error);
        }
    }

    // List rows only — sheetData (the whole workbook JSON, possibly megabytes
    // per meeting) is left out; findById loads it when a meeting is opened.
    static async findBySectionId(sectionId) {
        const [rows] = await executeQuery(
            `SELECT m.id, m.sectionId, m.agenda, m.description, m.meetingDate, m.meetingTime, m.createdBy,
                    m.createdAt, m.updatedAt, m.fileProvider, m.m365WebUrl, m.m365EmbedUrl, m.lastSyncedAt,
                    m.version, u.fullName AS createdByName
             FROM daily_morning_meetings m
             LEFT JOIN users u ON u.id = m.createdBy
             WHERE m.sectionId = ?
             ORDER BY m.meetingDate DESC, m.meetingTime DESC, m.id DESC`,
            [sectionId]
        );
        return rows;
    }

    // The meeting row without sheetData — for permission checks and save
    // responses, which have no use for the (possibly multi-megabyte) workbook.
    static async findMetaById(id) {
        const [rows] = await executeQuery(
            `SELECT m.id, m.sectionId, m.agenda, m.description, m.meetingDate, m.meetingTime, m.createdBy,
                    m.createdAt, m.updatedAt, m.fileProvider, m.m365WebUrl, m.m365EmbedUrl, m.lastSyncedAt,
                    m.version, u.fullName AS createdByName
             FROM daily_morning_meetings m
             LEFT JOIN users u ON u.id = m.createdBy
             WHERE m.id = ?`,
            [id]
        );
        return rows.length > 0 ? rows[0] : null;
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

    static async createWithSheetData({ sectionId, agenda, description, meetingDate, meetingTime, createdBy, sheetData }) {
        const dataJson = typeof sheetData === "string" ? sheetData : JSON.stringify(sheetData || {});
        const [result] = await executeQuery(
            `INSERT INTO daily_morning_meetings (sectionId, agenda, description, meetingDate, meetingTime, createdBy, sheetData, createdAt, updatedAt)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
            [sectionId, agenda, description || null, meetingDate, meetingTime, createdBy, dataJson]
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

    // Every save bumps `version`. When `expectedVersion` is given the update is
    // atomic on it: if another tab/user saved in between, no row matches and
    // this returns null instead of overwriting their work. `withSheetData:
    // false` returns the updated row without reading the workbook back out.
    static async updateSheetData(id, sheetData, expectedVersion = null, { withSheetData = true } = {}) {
        const dataJson = typeof sheetData === "string" ? sheetData : JSON.stringify(sheetData);
        const hasExpected = expectedVersion !== null && expectedVersion !== undefined;
        const [, result] = await executeQuery(
            `UPDATE daily_morning_meetings SET sheetData = ?, version = version + 1, updatedAt = GETDATE() WHERE id = ?${hasExpected ? " AND version = ?" : ""}`,
            hasExpected ? [dataJson, id, expectedVersion] : [dataJson, id]
        );
        if (hasExpected && !result.affectedRows) return null;
        return withSheetData ? DailyMorningMeeting.findById(id) : DailyMorningMeeting.findMetaById(id);
    }

    static async updateM365Info(id, { fileProvider, m365DriveId, m365ItemId, m365WebUrl, m365EmbedUrl }) {
        await executeQuery(
            `UPDATE daily_morning_meetings
             SET fileProvider = ?, m365DriveId = ?, m365ItemId = ?, m365WebUrl = ?, m365EmbedUrl = ?, lastSyncedAt = GETDATE(), updatedAt = GETDATE()
             WHERE id = ?`,
            [fileProvider, m365DriveId || null, m365ItemId || null, m365WebUrl || null, m365EmbedUrl || null, id]
        );
        return DailyMorningMeeting.findById(id);
    }

    // m365ItemId is unique per SharePoint drive, so this is a global lookup — used
    // by the sync reconciler to detect a file that's already tracked, possibly
    // under a different section (e.g. moved in SharePoint after being synced).
    static async findByM365ItemId(m365ItemId) {
        const [rows] = await executeQuery(
            "SELECT * FROM daily_morning_meetings WHERE m365ItemId = ?",
            [m365ItemId]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    static async findM365ItemIdsBySectionId(sectionId) {
        const [rows] = await executeQuery(
            "SELECT m365ItemId FROM daily_morning_meetings WHERE sectionId = ? AND m365ItemId IS NOT NULL",
            [sectionId]
        );
        return rows.map((r) => r.m365ItemId);
    }

    // Inserts a meeting row that's already backed by an existing SharePoint
    // workbook (discovered via sync, or freshly copied via cloneMeeting) —
    // unlike `create`/`createWithSheetData`, this never starts from '{}' sheetData
    // since the real content lives in the M365 file, not the sheetData column.
    static async createFromM365File({ sectionId, agenda, description, meetingDate, meetingTime, createdBy, m365Info }) {
        const [result] = await executeQuery(
            `INSERT INTO daily_morning_meetings
                (sectionId, agenda, description, meetingDate, meetingTime, createdBy, sheetData,
                 fileProvider, m365DriveId, m365ItemId, m365WebUrl, m365EmbedUrl,
                 m365FileName, m365ETag, m365CreatedDateTime, m365LastModifiedDateTime,
                 lastSyncedAt, createdAt, updatedAt)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?, ?, '{}',
                     'M365_SHAREPOINT', ?, ?, ?, ?,
                     ?, ?, ?, ?,
                     GETDATE(), GETDATE(), GETDATE())`,
            [
                sectionId, agenda, description || null, meetingDate, meetingTime, createdBy,
                m365Info.driveId || null, m365Info.itemId, m365Info.webUrl || null, m365Info.embedUrl || null,
                m365Info.fileName || null, m365Info.eTag || null,
                m365Info.createdDateTime || null, m365Info.lastModifiedDateTime || null
            ]
        );
        const insertedId = result[0].id;
        return DailyMorningMeeting.findById(insertedId);
    }

    static async deleteById(id) {
        await executeQuery("DELETE FROM daily_morning_meetings WHERE id = ?", [id]);
    }
}

DailyMorningMeeting.init().catch(err => logger.error("Failed to initialize daily_morning_meetings table:", err));

export default DailyMorningMeeting;
