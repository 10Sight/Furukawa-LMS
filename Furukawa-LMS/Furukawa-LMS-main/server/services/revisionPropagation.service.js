import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

// Every form that stores its own copy of docNo/revNo/issueDate/revDate, keyed by
// the Revision Table sheetKey that copy came from. When a revision_records row is
// saved, propagate() rewrites that copy on every saved form the record governs,
// so already-saved sheets always show the current Revision Table values.
//
// `dept` / `section` are SQL expressions giving each saved row's department and
// section — the same scope that was passed to getLatestForSheet() when the row
// was created, so a row is matched to the same record it was originally frozen from.
// `json: true` means the values live inside a JSON `metadata` column rather than
// in their own columns.
//
// Sheets not listed here (skill-matrix, skill-matrix-certificate,
// evaluation-test-attempt, on-job-training) keep no copy — they read the live
// record on every load via useRevisionInfo, so there's nothing to propagate.
const SNAPSHOT_TABLES = {
    "ten-cycle-sheet": {
        table: "ten_cycle_sheets",
        dept: "t.departmentId",
        // Sheets are created with sectionId 0 meaning "no section".
        section: "NULLIF(t.sectionId, 0)",
    },
    "sixteen-day-monitoring": {
        table: "sixteen_day_monitorings",
        join: "JOIN users u ON u.id = t.studentId",
        dept: "u.departmentId",
        section: "u.sectionId",
    },
    "three-day-monitoring": {
        table: "three_day_monitorings",
        join: "JOIN users u ON u.id = t.studentId",
        dept: "u.departmentId",
        section: "u.sectionId",
    },
    "operator-observance": {
        table: "operator_observances",
        join: "JOIN users u ON u.id = t.studentId",
        dept: "u.departmentId",
        section: "u.sectionId",
    },
    "mentee-feedback": {
        table: "mentee_feedbacks",
        join: "JOIN users u ON u.id = t.studentId",
        dept: "u.departmentId",
        section: "u.sectionId",
    },
    "daily-5m": {
        table: "daily_5m_records",
        // Stored as NVARCHAR on this table.
        dept: "TRY_CAST(t.departmentId AS INT)",
        section: "TRY_CAST(t.sectionId AS INT)",
    },
    "daily-production-report": {
        table: "daily_production_reports",
        join: "LEFT JOIN [lines] l ON l.id = t.line_id",
        dept: "t.department_id",
        section: "l.sectionId",
    },
    "multi-skilling-plan": {
        table: "multi_skilling_plans",
        dept: "t.departmentId",
        section: "t.sectionId",
    },
    "skill-upgradation-plan": {
        table: "skill_upgradation_plans",
        dept: "t.departmentId",
        section: "t.sectionId",
    },
    "handover-sheet": {
        table: "handover_sheets",
        dept: "t.departmentId",
        section: "t.sectionId",
        json: true,
    },
    "abnormal-condition": {
        table: "abnormal_condition_sheets",
        dept: "t.departmentId",
        // No section concept — always resolved department-only.
        section: "NULL",
        json: true,
    },
};

const FIELDS = ["docNo", "revNo", "issueDate", "revDate"];

// WHERE clause selecting the saved rows whose most-specific Revision Table match
// (department+section -> department-only -> global, same order as
// RevisionRecord.findLatestForScope) is the record at this exact scope.
const buildScopeFilter = (def, sheetKey, departmentId, sectionId) => {
    const { dept, section } = def;
    if (departmentId == null) {
        // Global record: every row not claimed by a department or department+section override.
        return {
            sql: `NOT EXISTS (
                SELECT 1 FROM [revision_records] o
                WHERE o.sheetKey = ? AND o.departmentId = ${dept}
                  AND (o.sectionId IS NULL OR o.sectionId = ${section})
            )`,
            params: [sheetKey],
        };
    }
    if (sectionId == null) {
        // Department override: rows in that department not claimed by a section override.
        return {
            sql: `${dept} = ? AND NOT EXISTS (
                SELECT 1 FROM [revision_records] o
                WHERE o.sheetKey = ? AND o.departmentId = ? AND o.sectionId = ${section}
            )`,
            params: [departmentId, sheetKey, departmentId],
        };
    }
    // Department+section override: exactly that department and section.
    return { sql: `${dept} = ? AND ${section} = ?`, params: [departmentId, sectionId] };
};

class RevisionPropagationService {
    static isPropagated(sheetKey) {
        return Object.prototype.hasOwnProperty.call(SNAPSHOT_TABLES, sheetKey);
    }

    // How many saved forms a record at this scope governs — what a save would
    // rewrite. Works for a scope that has no record yet (a new override).
    static async countAffected(sheetKey, departmentId = null, sectionId = null) {
        const def = SNAPSHOT_TABLES[sheetKey];
        if (!def) return 0;
        const filter = buildScopeFilter(def, sheetKey, departmentId, sectionId);
        const [rows] = await executeQuery(
            `SELECT COUNT(*) AS total FROM ${def.table} t ${def.join || ""} WHERE ${filter.sql}`,
            filter.params,
            { label: `revisionPropagation.count.${sheetKey}` }
        );
        return rows[0]?.total || 0;
    }

    // Rewrites the doc/revision copy on every saved form this record governs.
    // One UPDATE statement per call, so it either fully applies or not at all;
    // re-running it is harmless, so a failed run is fixed by saving again.
    // Doesn't touch the forms' updatedAt — the form's own content didn't change.
    static async propagate(record) {
        const def = SNAPSHOT_TABLES[record.sheetKey];
        if (!def) return 0;

        const values = FIELDS.map((f) => record[f] || null);
        let setSql;
        if (def.json) {
            // JSON_MODIFY with a NULL value removes the key, mirroring a cleared field.
            const base = "ISNULL(NULLIF(t.metadata, ''), '{}')";
            setSql = "t.metadata = " + FIELDS.reduce((acc, f) => `JSON_MODIFY(${acc}, '$.${f}', ?)`, base);
        } else {
            setSql = FIELDS.map((f) => `t.${f} = ?`).join(", ");
        }

        const filter = buildScopeFilter(def, record.sheetKey, record.departmentId ?? null, record.sectionId ?? null);
        const jsonGuard = def.json ? " AND ISJSON(ISNULL(NULLIF(t.metadata, ''), '{}')) = 1" : "";

        const [, result] = await executeQuery(
            `UPDATE t SET ${setSql} FROM ${def.table} t ${def.join || ""} WHERE ${filter.sql}${jsonGuard}`,
            [...values, ...filter.params],
            { label: `revisionPropagation.update.${record.sheetKey}` }
        );
        const count = result?.affectedRows || 0;
        logger.info(`Revision propagation: ${record.sheetKey} (record ${record.id}) updated ${count} saved ${def.table} rows`);
        return count;
    }
}

export default RevisionPropagationService;
