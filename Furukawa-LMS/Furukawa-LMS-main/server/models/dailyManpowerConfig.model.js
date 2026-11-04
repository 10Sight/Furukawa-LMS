import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import withTransaction from "../db/withTransaction.js";
import logger from "../logger/winston.logger.js";
import { normalizeAttendanceKey } from "../utils/manpowerPresence.js";

// Daily HR Meeting (Daily Manpower Report) configuration:
// - daily_manpower_report_configs: per-department display alias, "Other" roll-up, group, order.
// - daily_manpower_attendance_dept_map: department text written on attendance rows -> departments.id,
//   used to place each present punch under the department it was in on that day.

export const DEFAULT_GROUP = "MAIN";

class DailyManpowerConfig {
    static _initPromise = null;

    static init() {
        if (!DailyManpowerConfig._initPromise) {
            DailyManpowerConfig._initPromise = DailyManpowerConfig._init().catch((error) => {
                DailyManpowerConfig._initPromise = null;
                throw error;
            });
        }
        return DailyManpowerConfig._initPromise;
    }

    static async _init() {
        if (!await migrationHelper.tableExists("daily_manpower_report_configs")) {
            await executeQuery(`
                CREATE TABLE daily_manpower_report_configs (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId INT NOT NULL UNIQUE,
                    displayName NVARCHAR(255) NULL,
                    isOther BIT NOT NULL DEFAULT 0,
                    groupName NVARCHAR(100) NOT NULL DEFAULT 'MAIN',
                    groupSortOrder INT NOT NULL DEFAULT 0,
                    sortOrder INT NOT NULL DEFAULT 0,
                    isHidden BIT NOT NULL DEFAULT 0,
                    updatedBy INT NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_DMR_Config_Department FOREIGN KEY (departmentId)
                        REFERENCES departments(id) ON DELETE CASCADE
                )
            `);
            logger.info("Created daily_manpower_report_configs table in MSSQL");
        }
        await migrationHelper.ensureIndexExists(
            "daily_manpower_report_configs",
            "idx_dmr_configs_group",
            "CREATE INDEX idx_dmr_configs_group ON daily_manpower_report_configs(groupSortOrder, groupName, sortOrder)"
        );

        const mapTableIsNew = !await migrationHelper.tableExists("daily_manpower_attendance_dept_map");
        if (mapTableIsNew) {
            await executeQuery(`
                CREATE TABLE daily_manpower_attendance_dept_map (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    attendanceDepartment NVARCHAR(100) NOT NULL UNIQUE,
                    departmentId INT NOT NULL,
                    updatedBy INT NULL,
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_DMR_AttDeptMap_Department FOREIGN KEY (departmentId)
                        REFERENCES departments(id) ON DELETE CASCADE
                )
            `);
            logger.info("Created daily_manpower_attendance_dept_map table in MSSQL");
            await DailyManpowerConfig.seedAttendanceMapFromExactMatches();
        }
    }

    /**
     * Maps every attendance department spelling that exactly equals a department name
     * (trimmed, case-insensitive) and is not mapped yet. Returns the number of rows added.
     */
    static async seedAttendanceMapFromExactMatches() {
        const [, meta] = await executeQuery(`
            INSERT INTO daily_manpower_attendance_dept_map (attendanceDepartment, departmentId, updatedAt)
            SELECT att.dept, MIN(d.id), GETDATE()
            FROM (
                SELECT DISTINCT UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), department)))) AS dept
                FROM attendance_logs
                WHERE NULLIF(LTRIM(RTRIM(department)), '') IS NOT NULL
            ) att
            INNER JOIN departments d
                ON UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(255), d.name)))) = att.dept
               AND ISNULL(d.isDeleted, 0) = 0
            WHERE NOT EXISTS (
                SELECT 1 FROM daily_manpower_attendance_dept_map m WHERE m.attendanceDepartment = att.dept
            )
            GROUP BY att.dept
        `, [], { longRunning: true });
        const added = meta?.affectedRows || 0;
        if (added) logger.info(`[DailyHrMeeting] Seeded ${added} attendance department mapping(s) from exact name matches.`);
        return added;
    }

    /** Every non-deleted department with its report config (defaults when none saved). */
    static async getDepartmentsWithConfig() {
        await DailyManpowerConfig.init();
        const [rows] = await executeQuery(`
            SELECT
                d.id AS departmentId,
                d.name AS departmentName,
                c.displayName,
                ISNULL(c.isOther, 0) AS isOther,
                ISNULL(NULLIF(LTRIM(RTRIM(c.groupName)), ''), '${DEFAULT_GROUP}') AS groupName,
                ISNULL(c.groupSortOrder, 0) AS groupSortOrder,
                c.sortOrder AS sortOrder,
                ISNULL(c.isHidden, 0) AS isHidden,
                CASE WHEN c.id IS NULL THEN 0 ELSE 1 END AS isConfigured,
                c.updatedAt
            FROM departments d
            LEFT JOIN daily_manpower_report_configs c ON c.departmentId = d.id
            WHERE ISNULL(d.isDeleted, 0) = 0
            ORDER BY ISNULL(c.groupSortOrder, 0), CASE WHEN c.id IS NULL THEN 1 ELSE 0 END, c.sortOrder, d.name
        `);
        return (rows || []).map((r) => ({
            departmentId: Number(r.departmentId),
            departmentName: String(r.departmentName || "").trim(),
            displayName: r.displayName ? String(r.displayName).trim() : null,
            isOther: r.isOther === true || r.isOther === 1,
            groupName: String(r.groupName || DEFAULT_GROUP).trim(),
            groupSortOrder: Number(r.groupSortOrder) || 0,
            sortOrder: r.sortOrder === null || r.sortOrder === undefined ? null : Number(r.sortOrder),
            isHidden: r.isHidden === true || r.isHidden === 1,
            isConfigured: Number(r.isConfigured) === 1,
            updatedAt: r.updatedAt || null,
        }));
    }

    /** Upserts the given department configs in one transaction. */
    static async upsertConfigs(configs, updatedBy) {
        await DailyManpowerConfig.init();
        await withTransaction(async (conn) => {
            for (const c of configs) {
                await conn.query(`
                    MERGE daily_manpower_report_configs AS target
                    USING (SELECT ? AS departmentId) AS source
                    ON target.departmentId = source.departmentId
                    WHEN MATCHED THEN UPDATE SET
                        displayName = ?, isOther = ?, groupName = ?, groupSortOrder = ?,
                        sortOrder = ?, isHidden = ?, updatedBy = ?, updatedAt = GETDATE()
                    WHEN NOT MATCHED THEN INSERT
                        (departmentId, displayName, isOther, groupName, groupSortOrder, sortOrder, isHidden, updatedBy, createdAt, updatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE());
                `, [
                    c.departmentId,
                    c.displayName, c.isOther ? 1 : 0, c.groupName, c.groupSortOrder, c.sortOrder, c.isHidden ? 1 : 0, updatedBy ?? null,
                    c.departmentId, c.displayName, c.isOther ? 1 : 0, c.groupName, c.groupSortOrder, c.sortOrder, c.isHidden ? 1 : 0, updatedBy ?? null,
                ]);
            }
        });
    }

    static async getAttendanceMap() {
        await DailyManpowerConfig.init();
        const [rows] = await executeQuery(`
            SELECT m.attendanceDepartment, m.departmentId, d.name AS departmentName, m.updatedAt
            FROM daily_manpower_attendance_dept_map m
            LEFT JOIN departments d ON d.id = m.departmentId
            ORDER BY m.attendanceDepartment
        `);
        return (rows || []).map((r) => ({
            attendanceDepartment: String(r.attendanceDepartment),
            departmentId: Number(r.departmentId),
            departmentName: r.departmentName ? String(r.departmentName) : null,
            updatedAt: r.updatedAt || null,
        }));
    }

    /** Distinct attendance department spellings in the range, with row counts and current mapping. */
    static async getAttendanceDepartmentsInRange(startDate, endDate) {
        await DailyManpowerConfig.init();
        const [rows] = await executeQuery(`
            SELECT
                UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), al.department)))) AS attendanceDepartment,
                COUNT(*) AS rowCount,
                MAX(m.departmentId) AS departmentId
            FROM attendance_logs al
            LEFT JOIN daily_manpower_attendance_dept_map m
                ON m.attendanceDepartment = UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), al.department))))
            WHERE al.[date] >= CONVERT(DATE, ?, 23)
              AND al.[date] <= CONVERT(DATE, ?, 23)
              AND NULLIF(LTRIM(RTRIM(al.department)), '') IS NOT NULL
            GROUP BY UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), al.department))))
            ORDER BY CASE WHEN MAX(m.departmentId) IS NULL THEN 0 ELSE 1 END, COUNT(*) DESC
        `, [startDate, endDate]);
        return (rows || []).map((r) => ({
            attendanceDepartment: String(r.attendanceDepartment),
            rowCount: Number(r.rowCount) || 0,
            departmentId: r.departmentId === null || r.departmentId === undefined ? null : Number(r.departmentId),
        }));
    }

    /**
     * Applies mapping changes in one transaction. Entries with departmentId null/0 are removed.
     * Returns the normalized attendance department keys that changed.
     */
    static async saveAttendanceMap(entries, updatedBy) {
        await DailyManpowerConfig.init();
        const changed = [];
        await withTransaction(async (conn) => {
            for (const entry of entries) {
                const key = normalizeAttendanceKey(entry.attendanceDepartment).slice(0, 100);
                if (!key) continue;
                const departmentId = Number(entry.departmentId) || 0;
                if (departmentId > 0) {
                    await conn.query(`
                        MERGE daily_manpower_attendance_dept_map AS target
                        USING (SELECT ? AS attendanceDepartment) AS source
                        ON target.attendanceDepartment = source.attendanceDepartment
                        WHEN MATCHED THEN UPDATE SET departmentId = ?, updatedBy = ?, updatedAt = GETDATE()
                        WHEN NOT MATCHED THEN INSERT (attendanceDepartment, departmentId, updatedBy, updatedAt)
                            VALUES (?, ?, ?, GETDATE());
                    `, [key, departmentId, updatedBy ?? null, key, departmentId, updatedBy ?? null]);
                } else {
                    await conn.query(
                        "DELETE FROM daily_manpower_attendance_dept_map WHERE attendanceDepartment = ?",
                        [key]
                    );
                }
                changed.push(key);
            }
        });
        return changed;
    }

    /** Dates in the range whose attendance rows use any of the given department spellings. */
    static async getDatesUsingAttendanceDepartments(keys, startDate, endDate) {
        if (!keys.length) return [];
        const [rows] = await executeQuery(`
            SELECT DISTINCT CONVERT(VARCHAR(10), CONVERT(DATE, [date]), 23) AS d
            FROM attendance_logs
            WHERE [date] >= CONVERT(DATE, ?, 23)
              AND [date] <= CONVERT(DATE, ?, 23)
              AND UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), department)))) IN (?)
        `, [startDate, endDate, keys]);
        return (rows || []).map((r) => String(r.d)).sort();
    }
}

export default DailyManpowerConfig;
