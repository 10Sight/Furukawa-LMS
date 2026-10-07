import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";
import { encodeSheetPayload, decodeSheetPayload, gzipText, gunzipText } from "../utils/sheetCodec.js";
import { parseSheetData, normalizeWorkbook, applyPatch, pendingPatchRun } from "../utils/sheetWorkbook.js";
import { foldStoredPatches } from "../utils/sheetCompactor.js";

// How a meeting's workbook is stored
// ----------------------------------
// The row holds a full copy of the workbook (the "snapshot") in one of two columns:
// `sheetData` (plain JSON text) or, when it was stored compressed, `sheetDataGz` (see
// utils/sheetCodec.js).
//
// A save of a few changed cells doesn't rewrite the snapshot. It adds a row to
// daily_morning_meeting_patches (see utils/sheetWorkbook.js for the format), keyed by
// the meeting `version` that save produced — every save, full or patch, bumps
// `version` by one. The current workbook is the snapshot with the latest unbroken run
// of patches applied: the patches numbered ..., version-1, version. A full save bumps
// `version` without adding a patch, which breaks the run, so patches older than a
// full save are never applied again even if their rows are still around.
//
// Callers of findById see none of this: `sheetData` is the current workbook, as the
// JSON string when the snapshot is current, or as the already-parsed object when
// patches had to be applied to it.

// Fold a meeting's patches into a fresh snapshot once they pass either of these.
const COMPACT_AFTER_PATCHES = 200;
const COMPACT_AFTER_BYTES = 5 * 1024 * 1024;

const hydrate = async (row, patchRows = []) => {
    if (!row) return null;
    const { sheetDataGz, ...rest } = row;
    rest.sheetData = await decodeSheetPayload(row.sheetData, sheetDataGz);

    const pending = pendingPatchRun(rest.version, patchRows);
    rest.pendingPatches = pending.length;
    if (pending.length === 0) return rest;

    const workbook = normalizeWorkbook(parseSheetData(rest.sheetData));
    for (const { version, patch } of pending) {
        const missingSheets = applyPatch(workbook, JSON.parse(await gunzipText(patch)));
        if (missingSheets.length > 0) {
            logger.error(`[SHEET PATCH] meeting ${rest.id} patch v${version} addresses sheets the workbook lacks: ${missingSheets.join(", ")}`);
        }
    }
    rest.sheetData = workbook;
    return rest;
};

// Meetings with a compaction in flight in this process, so a burst of saves starts one.
const compacting = new Set();

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
            // Gzipped workbook, for the ones too large to keep as text in sheetData.
            await migrationHelper.ensureColumnExists('daily_morning_meetings', 'sheetDataGz', 'VARBINARY(MAX) NULL');
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

            // createdBy is deliberately not a foreign key: patches are short-lived, and
            // one waiting to be compacted shouldn't be what blocks deleting a user.
            if (!await migrationHelper.tableExists('daily_morning_meeting_patches')) {
                await executeQuery(`
                    CREATE TABLE daily_morning_meeting_patches (
                        meetingId INT NOT NULL,
                        version INT NOT NULL,
                        patch VARBINARY(MAX) NOT NULL,
                        rawBytes INT NOT NULL,
                        createdBy INT NOT NULL,
                        createdAt DATETIME NOT NULL DEFAULT GETDATE(),
                        CONSTRAINT PK_daily_morning_meeting_patches PRIMARY KEY (meetingId, version),
                        CONSTRAINT FK_daily_morning_meeting_patches_meeting FOREIGN KEY (meetingId)
                            REFERENCES daily_morning_meetings(id) ON DELETE CASCADE
                    )
                `);
            }

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

    // The meeting row without sheetData — for permission checks, M365 lookups and
    // save responses, which have no use for the (possibly multi-megabyte) workbook.
    static async findMetaById(id) {
        const [rows] = await executeQuery(
            `SELECT m.id, m.sectionId, m.agenda, m.description, m.meetingDate, m.meetingTime, m.createdBy,
                    m.createdAt, m.updatedAt, m.fileProvider, m.m365DriveId, m.m365ItemId, m.m365WebUrl,
                    m.m365EmbedUrl, m.lastSyncedAt, m.version, u.fullName AS createdByName
             FROM daily_morning_meetings m
             LEFT JOIN users u ON u.id = m.createdBy
             WHERE m.id = ?`,
            [id],
            { label: "dailyMorningMeeting.findMetaById" }
        );
        return rows.length > 0 ? rows[0] : null;
    }

    // The meeting with its current workbook. The row and its patches are read in one
    // transaction with the row share-locked (HOLDLOCK): every write to a workbook
    // updates the meeting row first, so none can land between the two reads and leave
    // this holding a snapshot from one version and patches from another.
    static async findById(id) {
        const stored = await DailyMorningMeeting.findStoredById(id);
        return stored ? hydrate(stored.row, stored.patchRows) : null;
    }

    // The meeting exactly as stored: the row with both workbook columns untouched, and
    // its patch rows (gzipped, any order — see pendingPatchRun for which of them count).
    // For callers that can do without the parsed workbook; everything else wants findById.
    static async findStoredById(id) {
        await schemaReady;
        const [rows, meta] = await executeQuery(
            `SET XACT_ABORT ON;
             DECLARE @id INT = ?;
             BEGIN TRAN;
             SELECT m.*, u.fullName AS createdByName
             FROM daily_morning_meetings m WITH (HOLDLOCK)
             LEFT JOIN users u ON u.id = m.createdBy
             WHERE m.id = @id;
             SELECT version, patch FROM daily_morning_meeting_patches WHERE meetingId = @id;
             COMMIT;`,
            [id],
            { label: "dailyMorningMeeting.findById" }
        );
        return rows[0] ? { row: rows[0], patchRows: meta.recordsets[1] || [] } : null;
    }

    // The saves made after version `afterVersion`, for a client that is behind to catch
    // up without reloading the workbook. Only possible while every one of them is still
    // held as a patch.
    // Returns null when the meeting doesn't exist; otherwise { version, patches }, where
    // `patches` is the unbroken run afterVersion+1 .. version (oldest first, parsed), or
    // null when part of it is gone — folded into the stored workbook, or replaced by a
    // full save — and the client has to load the workbook again.
    static async findPatchesAfter(id, afterVersion) {
        await schemaReady;
        const [rows, meta] = await executeQuery(
            `SET XACT_ABORT ON;
             DECLARE @id INT = ?, @after INT = ?;
             BEGIN TRAN;
             SELECT m.version FROM daily_morning_meetings m WITH (HOLDLOCK) WHERE m.id = @id;
             SELECT p.version, p.patch, p.createdBy, u.fullName AS createdByName
             FROM daily_morning_meeting_patches p
             LEFT JOIN users u ON u.id = p.createdBy
             WHERE p.meetingId = @id AND p.version > @after
             ORDER BY p.version;
             COMMIT;`,
            [id, afterVersion],
            { label: "dailyMorningMeeting.findPatchesAfter" }
        );
        if (!rows[0]) return null;
        const { version } = rows[0];
        if (afterVersion === version) return { version, patches: [] };
        const patchRows = meta.recordsets[1] || [];
        const complete = afterVersion < version
            && patchRows.length === version - afterVersion
            && patchRows.every((row, i) => row.version === afterVersion + 1 + i);
        if (!complete) return { version, patches: null };

        const patches = [];
        for (const row of patchRows) {
            patches.push({
                version: row.version,
                patch: JSON.parse(await gunzipText(row.patch)),
                userId: row.createdBy,
                userName: row.createdByName || ""
            });
        }
        return { version, patches };
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
        const { text, gz } = await encodeSheetPayload(dataJson);
        await schemaReady;
        // NULL goes in as a literal: a null parameter is sent typed NVARCHAR, which SQL
        // Server refuses to convert to VARBINARY.
        const [result] = await executeQuery(
            `INSERT INTO daily_morning_meetings (sectionId, agenda, description, meetingDate, meetingTime, createdBy, sheetData, sheetDataGz, createdAt, updatedAt)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?, ?, ?, ${gz ? "?" : "NULL"}, GETDATE(), GETDATE())`,
            [sectionId, agenda, description || null, meetingDate, meetingTime, createdBy, text, ...(gz ? [gz] : [])],
            { label: "dailyMorningMeeting.createWithSheetData" }
        );
        const insertedId = result[0].id;
        return DailyMorningMeeting.findById(insertedId);
    }

    static async updateDetails(id, { agenda, description }) {
        await executeQuery(
            "UPDATE daily_morning_meetings SET agenda = ?, description = ?, updatedAt = GETDATE() WHERE id = ?",
            [agenda, description || null, id]
        );
        return DailyMorningMeeting.findMetaById(id);
    }

    // Every save bumps `version`. When `expectedVersion` is given the update is
    // atomic on it: if another tab/user saved in between, no row matches and
    // this returns null instead of overwriting their work. `withSheetData:
    // false` returns the updated row without reading the workbook back out.
    static async updateSheetData(id, sheetData, expectedVersion = null, { withSheetData = true } = {}) {
        const dataJson = typeof sheetData === "string" ? sheetData : JSON.stringify(sheetData);
        const hasExpected = expectedVersion !== null && expectedVersion !== undefined;
        const { text, gz } = await encodeSheetPayload(dataJson);
        await schemaReady;
        // Both columns are written every time so neither is ever left holding an older
        // workbook. NULL goes in as a literal: a null parameter is sent typed NVARCHAR,
        // which SQL Server refuses to convert to VARBINARY.
        const params = gz ? [id, text, gz] : [id, text];
        if (hasExpected) params.push(expectedVersion);
        // The new snapshot already contains whatever the meeting's patches held, so they
        // go in the same transaction. (Leaving them would still be correct — see the
        // note at the top of this file — this just doesn't keep dead rows around.)
        const [rows] = await executeQuery(
            `SET XACT_ABORT ON;
             DECLARE @id INT = ?, @updated INT;
             BEGIN TRAN;
             UPDATE daily_morning_meetings SET sheetData = ?, sheetDataGz = ${gz ? "?" : "NULL"}, version = version + 1, updatedAt = GETDATE() WHERE id = @id${hasExpected ? " AND version = ?" : ""};
             SET @updated = @@ROWCOUNT;
             IF @updated > 0 DELETE FROM daily_morning_meeting_patches WHERE meetingId = @id;
             COMMIT;
             SELECT @updated AS updated;`,
            params,
            { label: "dailyMorningMeeting.updateSheetData" }
        );
        if (hasExpected && !rows[0].updated) return null;
        return withSheetData ? DailyMorningMeeting.findById(id) : DailyMorningMeeting.findMetaById(id);
    }

    // Saves a patch (see utils/sheetWorkbook.js) as the next version of the workbook.
    // Atomic on `expectedVersion` exactly like updateSheetData: if anything was saved
    // since the client loaded that version, nothing is written and this returns null.
    static async appendPatch(id, expectedVersion, patch, userId) {
        const patchJson = JSON.stringify(patch);
        const gz = await gzipText(patchJson);
        await schemaReady;
        const [rows] = await executeQuery(
            `SET XACT_ABORT ON;
             DECLARE @id INT = ?, @expected INT = ?, @updated INT;
             BEGIN TRAN;
             UPDATE daily_morning_meetings SET version = version + 1, updatedAt = GETDATE() WHERE id = @id AND version = @expected;
             SET @updated = @@ROWCOUNT;
             IF @updated = 1
                 INSERT INTO daily_morning_meeting_patches (meetingId, version, patch, rawBytes, createdBy)
                 VALUES (@id, @expected + 1, ?, ?, ?);
             COMMIT;
             SELECT @updated AS updated,
                    (SELECT COUNT(*) FROM daily_morning_meeting_patches WHERE meetingId = @id) AS patchCount,
                    (SELECT ISNULL(SUM(rawBytes), 0) FROM daily_morning_meeting_patches WHERE meetingId = @id) AS patchBytes;`,
            [id, expectedVersion, gz, Buffer.byteLength(patchJson, "utf8"), userId],
            { label: "dailyMorningMeeting.appendPatch" }
        );
        const { updated, patchCount, patchBytes } = rows[0];
        if (!updated) return null;

        if (patchCount >= COMPACT_AFTER_PATCHES || patchBytes >= COMPACT_AFTER_BYTES) {
            // After the response has gone out; a failure here costs nothing but a retry
            // on a later save, since the patches are still there.
            setImmediate(() => {
                DailyMorningMeeting.compactPatches(id).catch((error) =>
                    logger.error(`[SHEET PATCH] compaction failed for meeting ${id}:`, error));
            });
        }
        return DailyMorningMeeting.findMetaById(id);
    }

    // Folds a meeting's pending patches into its snapshot. The workbook, its `version`
    // and `updatedAt` are all unchanged by this — only where the content is kept. If a
    // save lands while this is working, the write below matches no row and nothing
    // changes; the next trigger tries again.
    // Returns true when a new snapshot was written.
    static async compactPatches(id) {
        const key = String(id);
        if (compacting.has(key)) return false;
        compacting.add(key);
        try {
            const stored = await DailyMorningMeeting.findStoredById(id);
            if (!stored) return false;
            const meeting = stored.row;
            const pending = pendingPatchRun(meeting.version, stored.patchRows);
            if (pending.length === 0) return false;

            // Off the main thread: this is a parse and re-serialise of the whole workbook.
            const { text, gz, missingSheets } = await foldStoredPatches({
                text: meeting.sheetData, gz: meeting.sheetDataGz, patches: pending.map((p) => p.patch)
            });
            if (missingSheets.length > 0) {
                logger.error(`[SHEET PATCH] meeting ${id}: patches address sheets the workbook lacks: ${missingSheets.join(", ")}`);
            }
            const [rows] = await executeQuery(
                `SET XACT_ABORT ON;
                 DECLARE @id INT = ?, @version INT = ?, @updated INT;
                 BEGIN TRAN;
                 UPDATE daily_morning_meetings SET sheetData = ?, sheetDataGz = ${gz ? "?" : "NULL"} WHERE id = @id AND version = @version;
                 SET @updated = @@ROWCOUNT;
                 IF @updated = 1 DELETE FROM daily_morning_meeting_patches WHERE meetingId = @id AND version <= @version;
                 COMMIT;
                 SELECT @updated AS updated;`,
                gz ? [id, meeting.version, text, gz] : [id, meeting.version, text],
                { label: "dailyMorningMeeting.compactPatches" }
            );
            const compacted = rows[0].updated === 1;
            if (compacted) logger.info(`[SHEET PATCH] compacted ${pending.length} patch(es) into meeting ${id} at v${meeting.version}`);
            return compacted;
        } finally {
            compacting.delete(key);
        }
    }

    // --- Storage maintenance (see services/sheetStorageMaintenance.js) ---------------

    // Ids of meetings that currently have patch rows.
    static async findIdsWithPatches() {
        await schemaReady;
        const [rows] = await executeQuery("SELECT DISTINCT meetingId FROM daily_morning_meeting_patches ORDER BY meetingId");
        return rows.map((r) => r.meetingId);
    }

    // Removes patch rows that a later full save has made unreachable — ones older than
    // the current version when the current version itself has no patch. They are
    // never applied (see the note at the top of this file); this only tidies up.
    static async purgeSupersededPatches(id) {
        await executeQuery(
            `DELETE p FROM daily_morning_meeting_patches p
             JOIN daily_morning_meetings m ON m.id = p.meetingId
             WHERE p.meetingId = ? AND p.version < m.version
               AND NOT EXISTS (SELECT 1 FROM daily_morning_meeting_patches c WHERE c.meetingId = m.id AND c.version = m.version)`,
            [id]
        );
    }

    // Ids of meetings whose snapshot is not stored the way `compressed` asks for,
    // smallest first. For compressed = true, snapshots too small to be worth
    // compressing are left out (32K characters, at two bytes each in NVARCHAR).
    static async findIdsToConvert(compressed) {
        await schemaReady;
        const [rows] = await executeQuery(
            compressed
                ? "SELECT id FROM daily_morning_meetings WHERE sheetDataGz IS NULL AND DATALENGTH(sheetData) >= 65536 ORDER BY DATALENGTH(sheetData), id"
                : "SELECT id FROM daily_morning_meetings WHERE sheetDataGz IS NOT NULL ORDER BY DATALENGTH(sheetDataGz), id",
            [],
            { longRunning: true }
        );
        return rows.map((r) => r.id);
    }

    // Moves one meeting's snapshot into the gzipped column (compressed = true) or back
    // to plain text (false). The row is rewritten only if its `version` is still the
    // one that was read, so a save that lands meanwhile is never overwritten — the row
    // is simply left for the next run. Neither `version` nor `updatedAt` is touched:
    // the workbook's content is unchanged, so open editors keep saving normally and
    // browser caches stay valid. Pending patches are unaffected.
    // Returns { changed, fromBytes, toBytes } or { changed: false, reason }.
    static async convertSnapshotStorage(id, compressed, { dryRun = false } = {}) {
        await schemaReady;
        const LONG = { longRunning: true };
        const [[row]] = await executeQuery(
            `SELECT sheetData, sheetDataGz, version FROM daily_morning_meetings WHERE id = ? AND sheetDataGz IS ${compressed ? "NULL" : "NOT NULL"}`,
            [id], LONG
        );
        if (!row) return { changed: false, reason: "already stored that way, or deleted" };

        let fromBytes, toBytes, sql, params;
        if (compressed) {
            if (row.sheetData == null) return { changed: false, reason: "no workbook stored" };
            const { text, gz, storedBytes } = await encodeSheetPayload(row.sheetData, { compress: true });
            if (!gz) return { changed: false, reason: "too small to be worth compressing" };
            // Prove the compressed copy reads back exactly before it replaces the original.
            if ((await decodeSheetPayload(text, gz)) !== row.sheetData) {
                throw new Error("round-trip check failed; row left untouched");
            }
            fromBytes = row.sheetData.length * 2;
            toBytes = storedBytes;
            sql = "UPDATE daily_morning_meetings SET sheetData = ?, sheetDataGz = ? WHERE id = ? AND version = ? AND sheetDataGz IS NULL";
            params = [text, gz, id, row.version];
        } else {
            const json = await decodeSheetPayload(row.sheetData, row.sheetDataGz);
            fromBytes = row.sheetDataGz.length;
            toBytes = json.length * 2;
            sql = "UPDATE daily_morning_meetings SET sheetData = ?, sheetDataGz = NULL WHERE id = ? AND version = ? AND sheetDataGz IS NOT NULL";
            params = [json, id, row.version];
        }
        if (dryRun) return { changed: false, reason: "dry run", fromBytes, toBytes };

        const [, result] = await executeQuery(sql, params, LONG);
        return result.affectedRows
            ? { changed: true, fromBytes, toBytes }
            : { changed: false, reason: "saved by someone meanwhile; left for the next run" };
    }

    // Hands the space freed by compressing snapshots back to the data file. Online, and
    // safe to run at any time; it just has nothing to do unless large values shrank.
    static async reclaimSnapshotSpace() {
        await executeQuery(
            "ALTER INDEX ALL ON daily_morning_meetings REORGANIZE WITH (LOB_COMPACTION = ON)", [], { longRunning: true }
        );
    }

    static async updateM365Info(id, { fileProvider, m365DriveId, m365ItemId, m365WebUrl, m365EmbedUrl }) {
        await executeQuery(
            `UPDATE daily_morning_meetings
             SET fileProvider = ?, m365DriveId = ?, m365ItemId = ?, m365WebUrl = ?, m365EmbedUrl = ?, lastSyncedAt = GETDATE(), updatedAt = GETDATE()
             WHERE id = ?`,
            [fileProvider, m365DriveId || null, m365ItemId || null, m365WebUrl || null, m365EmbedUrl || null, id]
        );
        return DailyMorningMeeting.findMetaById(id);
    }

    // m365ItemId is unique per SharePoint drive, so this is a global lookup — used
    // by the sync reconciler to detect a file that's already tracked, possibly
    // under a different section (e.g. moved in SharePoint after being synced).
    static async findByM365ItemId(m365ItemId) {
        const [rows] = await executeQuery(
            "SELECT id, sectionId FROM daily_morning_meetings WHERE m365ItemId = ?",
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

// Sheet writes name the sheetDataGz column, so they wait for the migration that adds it.
const schemaReady = DailyMorningMeeting.init().catch(err => logger.error("Failed to initialize daily_morning_meetings table:", err));
// For models whose tables reference this one (sheetComment.model.js).
DailyMorningMeeting.schemaReady = schemaReady;

export default DailyMorningMeeting;
