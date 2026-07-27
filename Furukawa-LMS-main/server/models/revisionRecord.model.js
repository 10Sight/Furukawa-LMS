import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

// Default document-control register seeded on first run — one row per form that
// carries a doc/revision header in this LMS. sheetKey must stay stable since it's
// the lookup key other controllers can use via RevisionRecord.findBySheetKey().
//
// Values below are pulled from the real doc/rev headers hardcoded into each form's
// print/UI component (the only place this data exists anywhere in the codebase —
// there is no shared source of truth). Sheets left without docNo/revNo/revDate here
// genuinely have no doc/rev number anywhere in the app and must be filled in via Edit.
//
// Notes on what was found:
// - multi-skilling-plan and skill-upgradation-plan both hardcode the exact same
//   docNo ("FRM-WH-QA-236") in their respective components, with no revNo/revDate
//   anywhere near it. That may be a copy-paste artifact in the original code rather
//   than a deliberate shared document — worth confirming with whoever owns document
//   control.
// - three-day-monitoring's component labels its date "Issue Date" (16.10.20), not
//   "Rev Date" — mapped into revDate here since that's the closest fit, but it may
//   not mean the same thing.
// - ten-cycle-sheet and mentee-feedback have no doc/rev header anywhere in their
//   components (checked both the frontend print components and the server models) —
//   still blank pending someone with the real paperwork filling them in via Edit.
//
// line-requirement was dropped from this register entirely (not a document-controlled
// form) — see REMOVED_SHEET_KEYS below, which prunes it from any DB that already seeded it.
const DEFAULT_SHEETS = [
    { sheetKey: "daily-production-report", sheetName: "Daily Production Report", docNo: "FRM-PR-274", revNo: "03" },
    { sheetKey: "ten-cycle-sheet", sheetName: "10 Cycle Sheet" },
    { sheetKey: "handover-sheet", sheetName: "Handover Sheet", docNo: "FRM-HR-003", revNo: "05", revDate: "30.01.2024" },
    { sheetKey: "abnormal-condition", sheetName: "Abnormal Condition", docNo: "FRM/QA/155-A", revNo: "01", revDate: "10.04.15" },
    { sheetKey: "skill-matrix", sheetName: "Skill Matrix", docNo: "FRM-WH-PR-009", revNo: "02", revDate: "02.05.2022" },
    { sheetKey: "multi-skilling-plan", sheetName: "Multi Skilling Plan", docNo: "FRM-WH-QA-236" },
    { sheetKey: "skill-upgradation-plan", sheetName: "Skill Upgradation Plan", docNo: "FRM-WH-QA-236" },
    { sheetKey: "sixteen-day-monitoring", sheetName: "16 Day Monitoring", docNo: "FRM-HR-004", revNo: "07", revDate: "11.12.21" },
    { sheetKey: "three-day-monitoring", sheetName: "3 Day Monitoring", docNo: "FRM-WH-QA-240", revNo: "00", revDate: "16.10.20" },
    { sheetKey: "daily-5m", sheetName: "Daily 5M Record", docNo: "FRM-WH-QA-241", revNo: "02", revDate: "27.01.2023" },
    { sheetKey: "operator-observance", sheetName: "Operator Observance", docNo: "FRM-WH-QA-277", revNo: "00", revDate: "01.04.2025" },
    { sheetKey: "mentee-feedback", sheetName: "Mentee Feedback" },
];

// Sheet keys that used to be seeded but were removed from the register — pruned from
// any DB that already inserted them. revision_history rows for the record cascade-delete
// automatically (FOREIGN KEY ... ON DELETE CASCADE on revisionRecordId).
const REMOVED_SHEET_KEYS = ["line-requirement"];

// Sheets whose real docNo/revNo/revDate were only discovered after the initial
// seed shipped blank (or with placeholder "TBD"/"00" values). Self-heals any install
// that already ran an earlier version of this seed, without touching rows an admin
// has since edited by hand.
const KNOWN_DEFAULTS_BACKFILL = DEFAULT_SHEETS.filter(s => s.docNo);

class RevisionRecord {
    constructor(data) {
        this.id = data.id;
        this.sheetKey = data.sheetKey;
        this.sheetName = data.sheetName;
        this.docNo = data.docNo;
        this.revNo = data.revNo;
        this.revDate = data.revDate;
        this.affectedSrNoPage = data.affectedSrNoPage;
        this.affectedSrNoPageHi = data.affectedSrNoPageHi;
        this.changeDetails = data.changeDetails;
        this.changeDetailsHi = data.changeDetailsHi;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'revision_records')
            BEGIN
                CREATE TABLE [revision_records] (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    sheetKey VARCHAR(255) NOT NULL UNIQUE,
                    sheetName VARCHAR(255) NOT NULL,
                    docNo VARCHAR(255) NULL,
                    revNo VARCHAR(255) NULL,
                    revDate VARCHAR(255) NULL,
                    affectedSrNoPage VARCHAR(255) NULL,
                    affectedSrNoPageHi NVARCHAR(255) NULL,
                    changeDetails NVARCHAR(MAX) NULL,
                    changeDetailsHi NVARCHAR(MAX) NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                );
            END
        `;
        try {
            await executeQuery(query);
            logger.info("Checked/Created revision_records table in MSSQL");
        } catch (error) {
            logger.error(`Failed to initialize RevisionRecord table: ${error.message}`);
            return;
        }

        // Seed default sheets on first run only — never touch rows that already exist,
        // so admin edits are never clobbered by a restart.
        try {
            const [existing] = await executeQuery("SELECT sheetKey FROM [revision_records]");
            const existingKeys = new Set(existing.map(r => r.sheetKey));
            const missing = DEFAULT_SHEETS.filter(s => !existingKeys.has(s.sheetKey));
            for (const sheet of missing) {
                await executeQuery(
                    `INSERT INTO [revision_records] (sheetKey, sheetName, docNo, revNo, revDate) VALUES (?, ?, ?, ?, ?)`,
                    [sheet.sheetKey, sheet.sheetName, sheet.docNo ?? null, sheet.revNo ?? null, sheet.revDate ?? null]
                );
            }
            if (missing.length > 0) {
                logger.info(`Seeded ${missing.length} default revision_records rows`);
            }

            // Prune rows for sheet keys that were removed from the register.
            for (const removedKey of REMOVED_SHEET_KEYS) {
                if (existingKeys.has(removedKey)) {
                    await executeQuery("DELETE FROM [revision_records] WHERE sheetKey = ?", [removedKey]);
                    logger.info(`Removed revision_records row for retired sheetKey '${removedKey}'`);
                }
            }

            // Backfill rows still sitting on the old "TBD" placeholder or a blank docNo
            // for sheets where the real value is now known. Only touches rows that have
            // never been given a real docNo, so an admin's own edits are never overwritten.
            for (const known of KNOWN_DEFAULTS_BACKFILL) {
                await executeQuery(
                    `UPDATE [revision_records] SET docNo = ?, revNo = ?, revDate = ?, updatedAt = GETDATE()
                     WHERE sheetKey = ? AND (docNo = 'TBD' OR docNo IS NULL OR docNo = '')`,
                    [known.docNo, known.revNo ?? null, known.revDate ?? null, known.sheetKey]
                );
            }
        } catch (error) {
            logger.error(`Failed to seed RevisionRecord defaults: ${error.message}`);
        }
    }

    static async findAll() {
        const [rows] = await executeQuery("SELECT * FROM [revision_records] ORDER BY sheetName ASC");
        return rows.map(r => new RevisionRecord(r));
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM [revision_records] WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new RevisionRecord(rows[0]);
    }

    static async findBySheetKey(sheetKey) {
        const [rows] = await executeQuery("SELECT * FROM [revision_records] WHERE sheetKey = ?", [sheetKey]);
        if (rows.length === 0) return null;
        return new RevisionRecord(rows[0]);
    }

    static async update(id, data) {
        const fields = [];
        const values = [];

        const editable = ["docNo", "revNo", "revDate", "affectedSrNoPage", "affectedSrNoPageHi", "changeDetails", "changeDetailsHi"];
        for (const key of editable) {
            if (data[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(data[key]);
            }
        }
        if (fields.length === 0) return RevisionRecord.findById(id);

        const query = `UPDATE [revision_records] SET ${fields.join(", ")}, updatedAt = GETDATE() WHERE id = ?`;
        values.push(id);
        await executeQuery(query, values);
        return RevisionRecord.findById(id);
    }
}

export default RevisionRecord;
