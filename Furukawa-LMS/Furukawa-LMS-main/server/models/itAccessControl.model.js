import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import withTransaction from "../db/withTransaction.js";
import logger from "../logger/winston.logger.js";
import { ApiError } from "../utils/ApiError.js";
import {
    FIELDS, FIELD_KEYS, STAFF_EMP_ID_PREFIX, columnType, normalizeFieldValue, storedFieldValue, buildRegisterRow,
    resolveUserDepartments,
} from "../utils/itAccessControlFields.js";

// IT Access Control Register (MIS Portal).
// - it_access_control_records: one row per user, created on first save. Users without a row are
//   still listed (LEFT JOIN), with every value blank.
// - it_access_control_history: one row per changed field per save (who, when, old -> new).
// Columns come from FIELDS in utils/itAccessControlFields.js; `version` guards concurrent edits.

const RECORDS = "it_access_control_records";
const HISTORY = "it_access_control_history";

// Column names below are interpolated only from FIELDS (fixed identifiers), never from requests.
const selectFieldColumns = (alias) => FIELDS
    .map((f) => (f.type === "date" ? `CONVERT(CHAR(10), ${alias}.${f.key}, 23) AS ${f.key}` : `${alias}.${f.key}`))
    .join(",\n                ");

class ITAccessControl {
    static _initPromise = null;

    static init() {
        if (!ITAccessControl._initPromise) {
            ITAccessControl._initPromise = ITAccessControl._init().catch((error) => {
                ITAccessControl._initPromise = null;
                throw error;
            });
        }
        return ITAccessControl._initPromise;
    }

    static async _init() {
        if (!await migrationHelper.tableExists(RECORDS)) {
            await executeQuery(`
                CREATE TABLE ${RECORDS} (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    userId INT NOT NULL UNIQUE,
                    ${FIELDS.map((f) => `${f.key} ${columnType(f)},`).join("\n                    ")}
                    version INT NOT NULL DEFAULT 0,
                    updatedBy INT NULL,
                    updatedByName NVARCHAR(255) NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_ITAC_Records_User FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
            logger.info(`Created ${RECORDS} table in MSSQL`);
        } else {
            // Fields added to FIELDS after the table was created.
            for (const field of FIELDS) await migrationHelper.ensureColumnExists(RECORDS, field.key, columnType(field));
        }

        // No foreign key: the audit trail outlives the user row.
        if (!await migrationHelper.tableExists(HISTORY)) {
            await executeQuery(`
                CREATE TABLE ${HISTORY} (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    userId INT NOT NULL,
                    empId NVARCHAR(255) NULL,
                    field NVARCHAR(100) NOT NULL,
                    oldValue NVARCHAR(255) NULL,
                    newValue NVARCHAR(255) NULL,
                    changedBy INT NULL,
                    changedByName NVARCHAR(255) NULL,
                    source NVARCHAR(255) NULL,
                    changedAt DATETIME NOT NULL DEFAULT GETDATE()
                )
            `);
            logger.info(`Created ${HISTORY} table in MSSQL`);
        } else {
            // Where a change came from, e.g. "import:Access_Q3.xlsx"; NULL for edits made on the page.
            await migrationHelper.ensureColumnExists(HISTORY, "source", "NVARCHAR(255) NULL");
        }
        await migrationHelper.ensureIndexExists(
            HISTORY,
            "idx_itac_history_user",
            `CREATE INDEX idx_itac_history_user ON ${HISTORY}(userId, changedAt DESC)`
        );
    }

    /** Every non-deleted ST employee (leavers included), with their recorded access. */
    static async getRegister() {
        await ITAccessControl.init();
        const [rows] = await executeQuery(`
            SELECT
                u.id AS userId,
                u.empId,
                u.fullName,
                u.designation,
                u.status,
                u.joiningDate,
                u.leavingDate,
                u.unit,
                u.departments,
                u.departmentId,
                d.name AS departmentName,
                u.department AS departmentText,
                ${selectFieldColumns("r")},
                r.version,
                r.updatedAt,
                r.updatedByName
            FROM users u
            LEFT JOIN departments d ON d.id = u.departmentId AND ISNULL(d.isDeleted, 0) = 0
            LEFT JOIN ${RECORDS} r ON r.userId = u.id
            WHERE ISNULL(u.isDeleted, 0) = 0
              AND UPPER(LTRIM(u.empId)) LIKE ?
            ORDER BY u.empId
        `, [`${STAFF_EMP_ID_PREFIX}%`], { label: "itAccessControl.getRegister" });
        const deptNameById = await ITAccessControl.getDepartmentNames();
        return (rows || []).map((r) => buildRegisterRow(r, deptNameById));
    }

    /** id -> name of every non-deleted department (users.departments holds ids). */
    static async getDepartmentNames(query = executeQuery) {
        const [rows] = await query(`SELECT id, name FROM departments WHERE ISNULL(isDeleted, 0) = 0`);
        return new Map((rows || []).map((d) => [Number(d.id), d.name]));
    }

    static async getHistory(userId, limit = 200) {
        await ITAccessControl.init();
        const [rows] = await executeQuery(`
            SELECT TOP (${Math.min(Math.max(Number(limit) || 200, 1), 1000)})
                id, field, oldValue, newValue, changedBy, changedByName, source, changedAt
            FROM ${HISTORY}
            WHERE userId = ?
            ORDER BY changedAt DESC, id DESC
        `, [userId]);
        return rows || [];
    }

    /**
     * Saves edited rows atomically.
     * @param {Array<{userId:number, version:number, values:object}>} rows  `version` is the one the
     *        page loaded; a row saved by someone else since then fails the whole save with 409.
     * @param {{id:number, name:string}} actor
     * @param {{ source?: string|null }} [options]  stored on every history row (e.g. "import:file.xlsx")
     * @returns {{ saved:number, changes:number }}
     */
    static async saveRows(rows, actor, { source = null } = {}) {
        await ITAccessControl.init();
        const prepared = ITAccessControl.prepareRows(rows);
        if (!prepared.length) return { saved: 0, changes: 0 };

        const needsDepartments = prepared.some((row) => row.values.departmentManual);
        const deptNameById = needsDepartments ? await ITAccessControl.getDepartmentNames() : new Map();

        return withTransaction(async (conn) => {
            const conflicts = [];
            let saved = 0;
            let changes = 0;

            for (const row of prepared) {
                const [users] = await conn.query(
                    `SELECT u.id, u.empId, u.departments, u.departmentId, d.name AS departmentName, u.department AS departmentText
                     FROM users u
                     LEFT JOIN departments d ON d.id = u.departmentId AND ISNULL(d.isDeleted, 0) = 0
                     WHERE u.id = ? AND ISNULL(u.isDeleted, 0) = 0 AND UPPER(LTRIM(u.empId)) LIKE ?`,
                    [row.userId, `${STAFF_EMP_ID_PREFIX}%`]
                );
                if (!users.length) throw new ApiError(`User ${row.userId} is not on the IT Access Control Register`, 400);
                const empId = users[0].empId;

                // A manual department is only for employees the users table gives none. Clearing is always allowed.
                if (row.values.departmentManual && resolveUserDepartments(users[0], deptNameById).length) {
                    throw new ApiError(`${empId} already has a department in employee records; a manual department can only be added when it is blank`, 400);
                }

                const [existingRows] = await conn.query(
                    `SELECT ${selectFieldColumns("r")}, r.version FROM ${RECORDS} r WITH (UPDLOCK, HOLDLOCK) WHERE r.userId = ?`,
                    [row.userId]
                );
                const existing = existingRows[0] || null;
                const currentVersion = existing ? Number(existing.version || 0) : 0;
                if (currentVersion !== row.version) {
                    conflicts.push(empId);
                    continue;
                }

                const changed = Object.entries(row.values)
                    .map(([key, value]) => ({ key, oldValue: storedFieldValue(key, existing?.[key]), newValue: value }))
                    .filter((c) => c.oldValue !== c.newValue);
                if (!changed.length) continue;

                if (existing) {
                    await conn.query(
                        `UPDATE ${RECORDS} SET ${changed.map((c) => `${c.key} = ?`).join(", ")},
                            version = version + 1, updatedBy = ?, updatedByName = ?, updatedAt = GETDATE()
                         WHERE userId = ?`,
                        [...changed.map((c) => c.newValue), actor.id ?? null, actor.name ?? null, row.userId]
                    );
                } else {
                    await conn.query(
                        `INSERT INTO ${RECORDS} (userId, ${changed.map((c) => c.key).join(", ")}, version, updatedBy, updatedByName, createdAt, updatedAt)
                         VALUES (?, ${changed.map(() => "?").join(", ")}, 1, ?, ?, GETDATE(), GETDATE())`,
                        [row.userId, ...changed.map((c) => c.newValue), actor.id ?? null, actor.name ?? null]
                    );
                }

                for (const c of changed) {
                    await conn.query(
                        `INSERT INTO ${HISTORY} (userId, empId, field, oldValue, newValue, changedBy, changedByName, source, changedAt)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE())`,
                        [row.userId, empId, c.key, c.oldValue, c.newValue, actor.id ?? null, actor.name ?? null, source]
                    );
                }
                saved += 1;
                changes += changed.length;
            }

            if (conflicts.length) {
                throw new ApiError(
                    `Someone else saved ${conflicts.join(", ")} after you opened the register. Reload to see their changes, then edit again.`,
                    409
                );
            }
            return { saved, changes };
        });
    }

    /** Validates the request body shape and every value; throws ApiError(400) on the first problem. */
    static prepareRows(rows) {
        if (!Array.isArray(rows)) throw new ApiError("rows array is required", 400);
        if (rows.length > 2000) throw new ApiError("Too many rows in one save", 400);
        const seen = new Set();
        return rows.map((row, index) => {
            const userId = Number(row?.userId);
            if (!Number.isInteger(userId) || userId <= 0) throw new ApiError(`Row ${index + 1}: userId is required`, 400);
            if (seen.has(userId)) throw new ApiError(`Row ${index + 1}: user ${userId} appears twice`, 400);
            seen.add(userId);

            const version = Number(row?.version ?? 0);
            if (!Number.isInteger(version) || version < 0) throw new ApiError(`Row ${index + 1}: invalid version`, 400);

            const input = row?.values;
            if (!input || typeof input !== "object" || Array.isArray(input)) throw new ApiError(`Row ${index + 1}: values object is required`, 400);
            const values = {};
            for (const [key, value] of Object.entries(input)) {
                if (!FIELD_KEYS.includes(key)) throw new ApiError(`Row ${index + 1}: unknown field "${key}"`, 400);
                try {
                    values[key] = normalizeFieldValue(key, value);
                } catch (error) {
                    throw new ApiError(`Row ${index + 1}: ${error.message}`, 400);
                }
            }
            return { userId, version, values };
        });
    }
}

export default ITAccessControl;
