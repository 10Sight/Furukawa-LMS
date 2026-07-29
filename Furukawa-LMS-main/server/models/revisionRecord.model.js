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
    { sheetKey: "evaluation-test-attempt", sheetName: "DOJO Evaluation Test", docNo: "ST-S16-01 FORMAT 4 -E", revNo: "01", revDate: "28.02.2025" },
    { sheetKey: "on-job-training", sheetName: "On the Job Training", docNo: "FRM-WH-QA-178", revNo: "02", revDate: "19.06.2021" },
    // Hardcoded fallback for skill-matrix-certificate — only used by the normal
    // "missing" seed path below when no admin-entered value exists yet. If a real
    // value was already saved via the legacy skill-matrix-config screen,
    // _migrateSkillMatrixCertificateDocDefaults() (called earlier in init(), see
    // below) creates the global row from that instead, and this entry is skipped
    // as "already exists" by the time the seed loop runs.
    { sheetKey: "skill-matrix-certificate", sheetName: "Skill Matrix Certificate", docNo: "FRM-HR-007", revNo: "02", revDate: "06/10/17" },
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
        this.departmentId = data.departmentId;
        this.sectionId = data.sectionId;
        this.departmentName = data.departmentName;
        this.sectionName = data.sectionName;
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
                    sheetKey VARCHAR(255) NOT NULL,
                    sheetName VARCHAR(255) NOT NULL,
                    departmentId INT NULL,
                    sectionId INT NULL,
                    docNo VARCHAR(255) NULL,
                    revNo VARCHAR(255) NULL,
                    revDate VARCHAR(255) NULL,
                    affectedSrNoPage VARCHAR(255) NULL,
                    affectedSrNoPageHi NVARCHAR(255) NULL,
                    changeDetails NVARCHAR(MAX) NULL,
                    changeDetailsHi NVARCHAR(MAX) NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT uq_revision_records_scope UNIQUE (sheetKey, departmentId, sectionId),
                    FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE,
                    FOREIGN KEY (sectionId) REFERENCES [sections](id) ON DELETE NO ACTION
                );
            END
            ELSE
            BEGIN
                -- Department/section scoping: a form can now have a global default
                -- (both NULL) plus per-department and per-department+section overrides.
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('revision_records') AND name = 'departmentId')
                BEGIN
                    ALTER TABLE [revision_records] ADD departmentId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('revision_records') AND name = 'sectionId')
                BEGIN
                    ALTER TABLE [revision_records] ADD sectionId INT NULL;
                END

                -- Drop the old single-column UNIQUE(sheetKey) constraint, if present —
                -- it would block inserting department/section-specific overrides for a
                -- sheetKey that already has a global row.
                DECLARE @OldConstraintName NVARCHAR(255);
                SELECT TOP 1 @OldConstraintName = kc.name
                FROM sys.key_constraints kc
                JOIN sys.index_columns ic ON kc.parent_object_id = ic.object_id AND kc.unique_index_id = ic.index_id
                JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                WHERE kc.parent_object_id = OBJECT_ID('revision_records')
                  AND kc.type = 'UQ'
                  AND kc.name <> 'uq_revision_records_scope'
                GROUP BY kc.name
                HAVING COUNT(*) = 1 AND MAX(c.name) = 'sheetKey';

                IF @OldConstraintName IS NOT NULL
                BEGIN
                    DECLARE @DropOldUnique NVARCHAR(MAX) = 'ALTER TABLE [revision_records] DROP CONSTRAINT ' + QUOTENAME(@OldConstraintName);
                    EXEC sp_executesql @DropOldUnique;
                END

                IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE name = 'uq_revision_records_scope' AND type = 'UQ')
                BEGIN
                    ALTER TABLE [revision_records] ADD CONSTRAINT uq_revision_records_scope UNIQUE (sheetKey, departmentId, sectionId);
                END

                IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('revision_records') AND referenced_object_id = OBJECT_ID('departments'))
                BEGIN
                    ALTER TABLE [revision_records] ADD CONSTRAINT fk_revision_records_department FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE;
                END
                IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('revision_records') AND referenced_object_id = OBJECT_ID('sections'))
                BEGIN
                    ALTER TABLE [revision_records] ADD CONSTRAINT fk_revision_records_section FOREIGN KEY (sectionId) REFERENCES [sections](id) ON DELETE NO ACTION;
                END
            END
        `;
        try {
            await executeQuery(query);
            logger.info("Checked/Created revision_records table in MSSQL");
        } catch (error) {
            logger.error(`Failed to initialize RevisionRecord table: ${error.message}`);
            return;
        }

        // Runs before the seed step below so a migrated global row (from a real
        // admin-entered skill-matrix-config value) is already present by the time
        // the "missing" check runs, and the hardcoded fallback in DEFAULT_SHEETS is
        // correctly skipped in favor of it.
        await RevisionRecord._migrateSkillMatrixCertificateDocDefaults();

        // Seed default (global) sheets on first run only — never touch rows that
        // already exist, so admin edits/overrides are never clobbered by a restart.
        // "Existing" here specifically means the GLOBAL row (departmentId/sectionId
        // both NULL) — department/section-specific overrides are a separate concern
        // and never seeded automatically.
        try {
            const [existing] = await executeQuery(
                "SELECT sheetKey FROM [revision_records] WHERE departmentId IS NULL AND sectionId IS NULL"
            );
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

            // Prune rows for sheet keys that were removed from the register — every
            // row for that sheetKey, global default and any overrides alike.
            for (const removedKey of REMOVED_SHEET_KEYS) {
                await executeQuery("DELETE FROM [revision_records] WHERE sheetKey = ?", [removedKey]);
            }

            // Backfill the GLOBAL row only if it's still sitting on the old "TBD"
            // placeholder or blank docNo, for sheets where the real value is now known.
            // Never touches a department/section-specific override an admin created.
            for (const known of KNOWN_DEFAULTS_BACKFILL) {
                await executeQuery(
                    `UPDATE [revision_records] SET docNo = ?, revNo = ?, revDate = ?, updatedAt = GETDATE()
                     WHERE sheetKey = ? AND departmentId IS NULL AND sectionId IS NULL
                       AND (docNo = 'TBD' OR docNo IS NULL OR docNo = '')`,
                    [known.docNo, known.revNo ?? null, known.revDate ?? null, known.sheetKey]
                );
            }
        } catch (error) {
            logger.error(`Failed to seed RevisionRecord defaults: ${error.message}`);
        }
    }

    // One-time backfill: copies docNo/revNo/revDate out of the legacy
    // skill_matrix_certificate_configs.config JSON blob (docDefaults) into
    // revision_records, so the Skill Matrix Certificate's doc/rev header moves
    // onto the same Revision Table every other form uses. Only docNo/revNo/revDate
    // move — dateOfIssue/headerDefaults/levels stay on the legacy config table
    // (server/models/skillMatrixConfig.model.js), which is untouched and still
    // used by that table's own config API and by import.controller.js's bulk
    // import "levels" lookup.
    // Self-healing: skips any (sheetKey, departmentId) scope that already has a
    // revision_records row (an admin may have already set an override there
    // directly), so this only ever migrates configs it hasn't seen yet and is
    // safe to run on every startup.
    static async _migrateSkillMatrixCertificateDocDefaults() {
        try {
            const [tables] = await executeQuery(
                "SELECT * FROM sysobjects WHERE name = 'skill_matrix_certificate_configs' AND xtype = 'U'"
            );
            if (tables.length === 0) return;

            const [configRows] = await executeQuery("SELECT departmentId, config FROM skill_matrix_certificate_configs");
            for (const row of configRows) {
                let docDefaults;
                try {
                    docDefaults = JSON.parse(row.config)?.docDefaults;
                } catch {
                    continue;
                }
                if (!docDefaults?.docNo && !docDefaults?.revNo && !docDefaults?.revDate) continue;

                const departmentId = row.departmentId && row.departmentId !== "GLOBAL" ? parseInt(row.departmentId) : null;
                const existing = await RevisionRecord.findExactScope("skill-matrix-certificate", departmentId, null);
                if (existing) continue;

                await executeQuery(
                    `INSERT INTO [revision_records] (sheetKey, sheetName, departmentId, sectionId, docNo, revNo, revDate) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    ["skill-matrix-certificate", "Skill Matrix Certificate", departmentId, null, docDefaults.docNo || null, docDefaults.revNo || null, docDefaults.revDate || null]
                );
                logger.info(`Migrated skill-matrix-certificate doc defaults for departmentId=${departmentId ?? "GLOBAL"}`);
            }
        } catch (error) {
            logger.error(`Failed to migrate skill matrix certificate doc defaults: ${error.message}`);
        }
    }

    static _baseSelect() {
        return `
            SELECT rr.*, d.name as departmentName, s.name as sectionName
            FROM [revision_records] rr
            LEFT JOIN departments d ON rr.departmentId = d.id
            LEFT JOIN [sections] s ON rr.sectionId = s.id
        `;
    }

    // Every row that exists — global defaults and every department/section
    // override alike — optionally narrowed by department/section/sheetKey, or
    // restricted to just the global (departmentId/sectionId both NULL) rows via
    // isGlobal, so the admin directory list can show one row per sheet while the
    // per-sheet detail page can pull the global row plus all of its overrides.
    static async findAll({ departmentId, sectionId, sheetKey, isGlobal } = {}) {
        let query = `${this._baseSelect()} WHERE 1=1`;
        const values = [];
        if (sheetKey) {
            query += " AND rr.sheetKey = ?";
            values.push(sheetKey);
        }
        if (isGlobal) {
            query += " AND rr.departmentId IS NULL AND rr.sectionId IS NULL";
        } else {
            if (departmentId) {
                query += " AND rr.departmentId = ?";
                values.push(departmentId);
            }
            if (sectionId) {
                query += " AND rr.sectionId = ?";
                values.push(sectionId);
            }
        }
        query += " ORDER BY rr.sheetName ASC, d.name ASC, s.name ASC";
        const [rows] = await executeQuery(query, values);
        return rows.map(r => new RevisionRecord(r));
    }

    static async findById(id) {
        const [rows] = await executeQuery(`${this._baseSelect()} WHERE rr.id = ?`, [id]);
        if (rows.length === 0) return null;
        return new RevisionRecord(rows[0]);
    }

    // Exact-scope lookup (no fallback) — used to decide insert vs. update when
    // saving a specific department/section override.
    static async findExactScope(sheetKey, departmentId = null, sectionId = null) {
        const query = `${this._baseSelect()} WHERE rr.sheetKey = ?
            AND (rr.departmentId = ? OR (rr.departmentId IS NULL AND ? IS NULL))
            AND (rr.sectionId = ? OR (rr.sectionId IS NULL AND ? IS NULL))`;
        const [rows] = await executeQuery(query, [sheetKey, departmentId, departmentId, sectionId, sectionId]);
        if (rows.length === 0) return null;
        return new RevisionRecord(rows[0]);
    }

    // Most-specific match for a sheet given a department/section: exact
    // department+section match, falling back to department-only, falling back to
    // the global default. Mirrors EmailConfiguration.findByFormDeptAndSection's
    // fallback-hierarchy pattern (server/models/emailConfiguration.model.js).
    static async findLatestForScope(sheetKey, departmentId = null, sectionId = null) {
        const query = `
            SELECT TOP 1 rr.*, d.name as departmentName, s.name as sectionName
            FROM [revision_records] rr
            LEFT JOIN departments d ON rr.departmentId = d.id
            LEFT JOIN [sections] s ON rr.sectionId = s.id
            WHERE rr.sheetKey = ?
              AND (
                (rr.departmentId = ? AND rr.sectionId = ?) OR
                (rr.departmentId = ? AND rr.sectionId IS NULL) OR
                (rr.departmentId IS NULL AND rr.sectionId IS NULL)
              )
            ORDER BY rr.sectionId DESC, rr.departmentId DESC
        `;
        const [rows] = await executeQuery(query, [sheetKey, departmentId, sectionId, departmentId]);
        if (rows.length === 0) return null;
        return new RevisionRecord(rows[0]);
    }

    static async create(data) {
        const query = `
            INSERT INTO [revision_records]
            (sheetKey, sheetName, departmentId, sectionId, docNo, revNo, revDate, affectedSrNoPage, affectedSrNoPageHi, changeDetails, changeDetailsHi)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [rows] = await executeQuery(query, [
            data.sheetKey,
            data.sheetName,
            data.departmentId || null,
            data.sectionId || null,
            data.docNo || null,
            data.revNo || null,
            data.revDate || null,
            data.affectedSrNoPage || null,
            data.affectedSrNoPageHi || null,
            data.changeDetails || null,
            data.changeDetailsHi || null,
        ]);
        return RevisionRecord.findById(rows[0].id);
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
