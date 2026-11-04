import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import withTransaction from "../db/withTransaction.js";
import logger from "../logger/winston.logger.js";

// Stored Daily HR Meeting figures. The report reads only these tables; they are (re)computed by
// services/dailyHrMeetingSnapshot.service.js on attendance upload, nightly, and on demand.
// - daily_hr_meeting_manpower_daily: one row per date x department (raw per-department figures;
//   aliases / Other / groups / totals are applied when the report is read).
// - daily_hr_meeting_daily_meta: one row per computed date with reconciliation diagnostics.

const INSERT_CHUNK_ROWS = 150; // 12 params per row -> 1800, under SQL Server's 2100-parameter limit

export const COMPUTE_SOURCES = ["UPLOAD", "NIGHTLY", "MANUAL", "BACKFILL", "MAPPING"];

class DailyHrMeetingDaily {
    static _initPromise = null;

    static init() {
        if (!DailyHrMeetingDaily._initPromise) {
            DailyHrMeetingDaily._initPromise = DailyHrMeetingDaily._init().catch((error) => {
                DailyHrMeetingDaily._initPromise = null;
                throw error;
            });
        }
        return DailyHrMeetingDaily._initPromise;
    }

    static async _init() {
        if (!await migrationHelper.tableExists("daily_hr_meeting_manpower_daily")) {
            await executeQuery(`
                CREATE TABLE daily_hr_meeting_manpower_daily (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    reportDate DATE NOT NULL,
                    departmentId INT NOT NULL,
                    requiredFN01 INT NOT NULL DEFAULT 0,
                    requiredFN02 INT NOT NULL DEFAULT 0,
                    requiredForDay INT NOT NULL DEFAULT 0,
                    presentCount INT NOT NULL DEFAULT 0,
                    otHrs DECIMAL(9,2) NOT NULL DEFAULT 0,
                    otMandays INT NOT NULL DEFAULT 0,
                    gap INT NOT NULL DEFAULT 0,
                    deptFallbackCount INT NOT NULL DEFAULT 0,
                    computedAt DATETIME NOT NULL DEFAULT GETDATE(),
                    computedBy INT NULL,
                    computeSource NVARCHAR(20) NOT NULL,
                    CONSTRAINT UQ_DHRM_Daily UNIQUE (reportDate, departmentId),
                    CONSTRAINT FK_DHRM_Daily_Department FOREIGN KEY (departmentId)
                        REFERENCES departments(id) ON DELETE CASCADE
                )
            `);
            logger.info("Created daily_hr_meeting_manpower_daily table in MSSQL");
        }
        await migrationHelper.ensureIndexExists(
            "daily_hr_meeting_manpower_daily",
            "idx_dhrm_daily_date",
            "CREATE INDEX idx_dhrm_daily_date ON daily_hr_meeting_manpower_daily(reportDate) INCLUDE (departmentId, presentCount, otHrs)"
        );

        if (!await migrationHelper.tableExists("daily_hr_meeting_daily_meta")) {
            await executeQuery(`
                CREATE TABLE daily_hr_meeting_daily_meta (
                    reportDate DATE NOT NULL PRIMARY KEY,
                    unmappedPresent INT NOT NULL DEFAULT 0,
                    noDepartmentPresent INT NOT NULL DEFAULT 0,
                    unmappedRequirementFN01 INT NOT NULL DEFAULT 0,
                    unmappedRequirementFN02 INT NOT NULL DEFAULT 0,
                    unmappedAttendanceDepartments NVARCHAR(MAX) NULL,
                    isHoliday BIT NOT NULL DEFAULT 0,
                    computedAt DATETIME NOT NULL DEFAULT GETDATE(),
                    computedBy INT NULL,
                    computeSource NVARCHAR(20) NOT NULL
                )
            `);
            logger.info("Created daily_hr_meeting_daily_meta table in MSSQL");
        }
    }

    /**
     * Replaces everything stored for `dates` with `rows` / `metaRows`, atomically.
     * An application lock serialises concurrent recomputations (upload vs. Recalculate vs. nightly).
     */
    static async replaceDates({ dates, rows, metaRows, source, computedBy = null }) {
        await DailyHrMeetingDaily.init();
        if (!dates.length) return;

        await withTransaction(async (conn) => {
            await conn.query(`
                DECLARE @lockResult INT;
                EXEC @lockResult = sp_getapplock @Resource = ?, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 120000;
                IF @lockResult < 0 THROW 51000, 'Daily HR Meeting snapshot is busy, try again shortly.', 1;
            `, ["daily-hr-meeting-snapshot"]);

            await conn.query(
                "DELETE FROM daily_hr_meeting_manpower_daily WHERE reportDate IN (?)",
                [dates]
            );
            await conn.query(
                "DELETE FROM daily_hr_meeting_daily_meta WHERE reportDate IN (?)",
                [dates]
            );

            for (let i = 0; i < rows.length; i += INSERT_CHUNK_ROWS) {
                const chunk = rows.slice(i, i + INSERT_CHUNK_ROWS);
                const values = chunk.map(() => "(CONVERT(DATE, ?, 23), ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), ?, ?)").join(", ");
                const params = chunk.flatMap((r) => [
                    r.reportDate, r.departmentId, r.requiredFN01, r.requiredFN02, r.requiredForDay,
                    r.presentCount, r.otHrs, r.otMandays, r.gap, r.deptFallbackCount, computedBy, source,
                ]);
                await conn.query(`
                    INSERT INTO daily_hr_meeting_manpower_daily
                        (reportDate, departmentId, requiredFN01, requiredFN02, requiredForDay,
                         presentCount, otHrs, otMandays, gap, deptFallbackCount, computedAt, computedBy, computeSource)
                    VALUES ${values}
                `, params);
            }

            for (const m of metaRows) {
                await conn.query(`
                    INSERT INTO daily_hr_meeting_daily_meta
                        (reportDate, unmappedPresent, noDepartmentPresent, unmappedRequirementFN01, unmappedRequirementFN02,
                         unmappedAttendanceDepartments, isHoliday, computedAt, computedBy, computeSource)
                    VALUES (CONVERT(DATE, ?, 23), ?, ?, ?, ?, ?, ?, GETDATE(), ?, ?)
                `, [
                    m.reportDate, m.unmappedPresent, m.noDepartmentPresent, m.unmappedRequirementFN01, m.unmappedRequirementFN02,
                    JSON.stringify(m.unmappedAttendanceDepartments || []), m.isHoliday ? 1 : 0, computedBy, source,
                ]);
            }
        }, { longRunning: true });
    }

    static async getRows(startDate, endDate) {
        await DailyHrMeetingDaily.init();
        const [rows] = await executeQuery(`
            SELECT CONVERT(VARCHAR(10), reportDate, 23) AS reportDate, departmentId,
                   requiredFN01, requiredFN02, requiredForDay, presentCount, otHrs, otMandays, gap, deptFallbackCount
            FROM daily_hr_meeting_manpower_daily
            WHERE reportDate >= CONVERT(DATE, ?, 23) AND reportDate <= CONVERT(DATE, ?, 23)
        `, [startDate, endDate]);
        return (rows || []).map((r) => ({
            reportDate: String(r.reportDate),
            departmentId: Number(r.departmentId),
            requiredFN01: Number(r.requiredFN01) || 0,
            requiredFN02: Number(r.requiredFN02) || 0,
            requiredForDay: Number(r.requiredForDay) || 0,
            presentCount: Number(r.presentCount) || 0,
            otHrs: Number(r.otHrs) || 0,
            otMandays: Number(r.otMandays) || 0,
            gap: Number(r.gap) || 0,
            deptFallbackCount: Number(r.deptFallbackCount) || 0,
        }));
    }

    static async getMeta(startDate, endDate) {
        await DailyHrMeetingDaily.init();
        const [rows] = await executeQuery(`
            SELECT CONVERT(VARCHAR(10), reportDate, 23) AS reportDate, unmappedPresent, noDepartmentPresent,
                   unmappedRequirementFN01, unmappedRequirementFN02, unmappedAttendanceDepartments,
                   isHoliday, computedAt, computeSource
            FROM daily_hr_meeting_daily_meta
            WHERE reportDate >= CONVERT(DATE, ?, 23) AND reportDate <= CONVERT(DATE, ?, 23)
        `, [startDate, endDate]);
        return new Map((rows || []).map((r) => {
            let unmappedAttendanceDepartments = [];
            try { unmappedAttendanceDepartments = JSON.parse(r.unmappedAttendanceDepartments || "[]"); } catch { /* keep [] */ }
            return [String(r.reportDate), {
                unmappedPresent: Number(r.unmappedPresent) || 0,
                noDepartmentPresent: Number(r.noDepartmentPresent) || 0,
                unmappedRequirementFN01: Number(r.unmappedRequirementFN01) || 0,
                unmappedRequirementFN02: Number(r.unmappedRequirementFN02) || 0,
                unmappedAttendanceDepartments,
                isHoliday: r.isHoliday === true || r.isHoliday === 1,
                computedAt: r.computedAt || null,
                computeSource: r.computeSource || null,
            }];
        }));
    }

    /**
     * Dates in the range that have attendance but either no stored figures, or stored figures older
     * than the latest change to that date's attendance rows.
     */
    static async findStaleOrMissingDates(startDate, endDate) {
        await DailyHrMeetingDaily.init();
        const [rows] = await executeQuery(`
            SELECT CONVERT(VARCHAR(10), att.d, 23) AS d
            FROM (
                SELECT CONVERT(DATE, [date]) AS d, MAX(updatedAt) AS lastChange
                FROM attendance_logs
                WHERE [date] >= CONVERT(DATE, ?, 23) AND [date] <= CONVERT(DATE, ?, 23)
                GROUP BY CONVERT(DATE, [date])
            ) att
            LEFT JOIN daily_hr_meeting_daily_meta m ON m.reportDate = att.d
            WHERE m.reportDate IS NULL OR (att.lastChange IS NOT NULL AND att.lastChange > m.computedAt)
        `, [startDate, endDate], { longRunning: true });
        return (rows || []).map((r) => String(r.d).slice(0, 10)).sort();
    }
}

export default DailyHrMeetingDaily;
