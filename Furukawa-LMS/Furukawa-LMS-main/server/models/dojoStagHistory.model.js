import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";
import migrationHelper from "../db/migrationHelper.js";
import { formatLocalDate } from "../utils/istDate.util.js";

const TABLE = "dojo_stage_history";

const ZERO_ROW = {
    theoreticalCount: 0, practicalCount: 0, leftCount: 0, handoverCount: 0, leaveCount: 0,
    maleCount: 0, femaleCount: 0,
    theoreticalMale: 0, theoreticalFemale: 0, practicalMale: 0, practicalFemale: 0,
    leftMale: 0, leftFemale: 0, handoverMale: 0, handoverFemale: 0,
};

// Tedious (with useUTC:false, see connectDB.js) reconstructs SQL DATE columns as Date objects
// using local calendar fields — toISOString() would re-encode via UTC and shift the day back by
// the server's UTC offset, so this must go through formatLocalDate instead (see istDate.util.js).
const toDateStr = (d) => {
    if (typeof d === 'string') return d.split('T')[0];
    return formatLocalDate(d instanceof Date ? d : new Date(d));
};

// A snapshot for a future date would bake in *today's* current roster state and then never
// get refreshed until that day's own cron tick — i.e. it would sit there being wrong. Today's
// IST calendar date, so callers can clamp against it.
const todayISTStr = () => {
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    return new Date(Date.now() + IST_OFFSET_MS).toISOString().split('T')[0];
};

const numRow = (r) => ({
    theoreticalCount: Number(r.theoreticalCount) || 0,
    practicalCount: Number(r.practicalCount) || 0,
    leftCount: Number(r.leftCount) || 0,
    handoverCount: Number(r.handoverCount) || 0,
    leaveCount: Number(r.leaveCount) || 0,
    maleCount: Number(r.maleCount) || 0,
    femaleCount: Number(r.femaleCount) || 0,
    theoreticalMale: Number(r.theoreticalMale) || 0,
    theoreticalFemale: Number(r.theoreticalFemale) || 0,
    practicalMale: Number(r.practicalMale) || 0,
    practicalFemale: Number(r.practicalFemale) || 0,
    leftMale: Number(r.leftMale) || 0,
    leftFemale: Number(r.leftFemale) || 0,
    handoverMale: Number(r.handoverMale) || 0,
    handoverFemale: Number(r.handoverFemale) || 0,
});

const SUM_COLUMNS = [
    'theoreticalCount', 'practicalCount', 'leftCount', 'handoverCount', 'leaveCount',
    'maleCount', 'femaleCount', 'theoreticalMale', 'theoreticalFemale',
    'practicalMale', 'practicalFemale', 'leftMale', 'leftFemale', 'handoverMale', 'handoverFemale',
];

/**
 * Daily snapshot history for DOJO Temporary candidates, one row per (date, departmentId) —
 * departmentId NULL holds the plant-wide total. Each sync mirrors the exact business logic of
 * the live Dojo Hiring page (`getTemporaryUsers` in user.controller.js) with "today" replaced by
 * the date being synced, using stable date fields (joiningDate/leavingDate/handover approval date)
 * so a day that's backfilled *after the fact* still reflects who was actually in each stage on
 * that day — not just today's current state repeated for every day:
 *   Theoretical = joined on D, not left and not handed over as of D
 *   Practical   = joined before D, still active (not left, not handed over) as of D
 *   Handover    = approved for handover on D (handover_sheets, interviewStatus = 'APPROVE')
 *   Left        = status = 'LEFT' and leavingDate = D
 *   OnLeave     = status = 'ON_LEAVE' (current-state flag only — no stable date field exists to
 *                 reconstruct this historically, so it's accurate for "today" but approximate for
 *                 backfilled days; not surfaced anywhere in the UI today)
 *   Male/Female = gender split of the active roster (Theoretical ∪ Practical) as of D
 * Population: anyone currently isTemporary=1, OR anyone who ever had expectedHandover set (so a
 * candidate who has since been handed over — isTemporary flips to 0 — still shows up on their
 * actual handover date instead of disappearing from the table).
 */
class DojoStageHistory {
    static async init() {
        try {
            if (!await migrationHelper.tableExists(TABLE)) {
                await executeQuery(`
                    CREATE TABLE ${TABLE} (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        date DATE NOT NULL,
                        departmentId INT NULL,
                        theoreticalCount INT NOT NULL DEFAULT 0,
                        practicalCount INT NOT NULL DEFAULT 0,
                        leftCount INT NOT NULL DEFAULT 0,
                        handoverCount INT NOT NULL DEFAULT 0,
                        leaveCount INT NOT NULL DEFAULT 0,
                        maleCount INT NOT NULL DEFAULT 0,
                        femaleCount INT NOT NULL DEFAULT 0,
                        theoreticalMale INT NOT NULL DEFAULT 0,
                        theoreticalFemale INT NOT NULL DEFAULT 0,
                        practicalMale INT NOT NULL DEFAULT 0,
                        practicalFemale INT NOT NULL DEFAULT 0,
                        leftMale INT NOT NULL DEFAULT 0,
                        leftFemale INT NOT NULL DEFAULT 0,
                        handoverMale INT NOT NULL DEFAULT 0,
                        handoverFemale INT NOT NULL DEFAULT 0,
                        totalActive INT NOT NULL DEFAULT 0,
                        meta NVARCHAR(MAX) NULL,
                        createdAt DATETIME2 DEFAULT GETDATE(),
                        updatedAt DATETIME2 DEFAULT GETDATE()
                    )
                `);
            }
            // Idempotent for an already-existing table from before the Handover/gender-split columns
            // were added.
            await migrationHelper.ensureColumnExists(TABLE, 'handoverCount', 'INT NOT NULL DEFAULT 0');
            await migrationHelper.ensureColumnExists(TABLE, 'theoreticalMale', 'INT NOT NULL DEFAULT 0');
            await migrationHelper.ensureColumnExists(TABLE, 'theoreticalFemale', 'INT NOT NULL DEFAULT 0');
            await migrationHelper.ensureColumnExists(TABLE, 'practicalMale', 'INT NOT NULL DEFAULT 0');
            await migrationHelper.ensureColumnExists(TABLE, 'practicalFemale', 'INT NOT NULL DEFAULT 0');
            await migrationHelper.ensureColumnExists(TABLE, 'leftMale', 'INT NOT NULL DEFAULT 0');
            await migrationHelper.ensureColumnExists(TABLE, 'leftFemale', 'INT NOT NULL DEFAULT 0');
            await migrationHelper.ensureColumnExists(TABLE, 'handoverMale', 'INT NOT NULL DEFAULT 0');
            await migrationHelper.ensureColumnExists(TABLE, 'handoverFemale', 'INT NOT NULL DEFAULT 0');

            // SQL Server treats a full (date, departmentId) tuple — NULL included — as one
            // comparable value for uniqueness, so a single plain composite index correctly allows
            // only one "overall" (departmentId IS NULL) row per date alongside one row per dept.
            await migrationHelper.ensureIndexExists(
                TABLE,
                'UX_dojo_stage_history_date_dept',
                `CREATE UNIQUE INDEX UX_dojo_stage_history_date_dept ON ${TABLE}(date, departmentId)`
            );
            await migrationHelper.ensureIndexExists(
                TABLE,
                'IX_dojo_stage_history_date',
                `CREATE INDEX IX_dojo_stage_history_date ON ${TABLE}(date DESC)`
            );
            logger.info("Checked/Created dojo_stage_history table in MSSQL");
        } catch (error) {
            logger.error("Failed to initialize DojoStageHistory table", error);
        }
    }

    /**
     * Computes and upserts the snapshot for a single date, for the plant-wide total
     * (departmentId NULL) and for every department that has at least one relevant candidate.
     * Idempotent — safe to call repeatedly for the same date (cron re-runs, manual triggers,
     * write-path hooks all converge on the same MERGE).
     */
    static async syncDate(dateStr, options = {}) {
        // Never persist a snapshot for a day that hasn't happened yet — see todayISTStr's comment.
        if (dateStr > todayISTStr()) return;

        const meta = JSON.stringify({ syncedBy: options.syncedBy || 'manual', syncedAt: new Date().toISOString() });
        await executeQuery(`
            ;WITH ho AS (
                SELECT TRY_CAST(JSON_VALUE(entry.value, '$.studentId') AS INT) AS userId, MIN(hs.date) AS handoverDate
                FROM handover_sheets hs
                CROSS APPLY OPENJSON(hs.entries) AS entry
                WHERE JSON_VALUE(entry.value, '$.interviewStatus') = 'APPROVE'
                GROUP BY TRY_CAST(JSON_VALUE(entry.value, '$.studentId') AS INT)
            ),
            flagged AS (
                SELECT
                    COALESCE(u.targetDeptId, u.departmentId) AS departmentId,
                    -- "Not left/handed-over as of D": for D = today these collapse to the plain
                    -- current-state checks — but for a D synced after the fact, they correctly still
                    -- count someone who has since left/been handed over as active on the days
                    -- *before* that event, instead of using today's state for every day retroactively.
                    CASE WHEN u.status != 'LEFT' OR u.status IS NULL OR TRY_CAST(u.leavingDate AS DATE) > ? THEN 1 ELSE 0 END AS notLeftAsOfD,
                    CASE WHEN ho.handoverDate IS NULL OR ho.handoverDate > ? THEN 1 ELSE 0 END AS notHandedOverAsOfD,
                    CASE WHEN CAST(u.joiningDate AS DATE) = ? THEN 1 ELSE 0 END AS joinedOnD,
                    CASE WHEN u.joiningDate IS NULL OR CAST(u.joiningDate AS DATE) != ? THEN 1 ELSE 0 END AS notJoinedOnD,
                    CASE WHEN u.status = 'LEFT' AND TRY_CAST(u.leavingDate AS DATE) = ? THEN 1 ELSE 0 END AS isLeft,
                    CASE WHEN ho.handoverDate = ? THEN 1 ELSE 0 END AS isHandover,
                    CASE WHEN u.status = 'ON_LEAVE' THEN 1 ELSE 0 END AS isOnLeave,
                    u.gender
                FROM users u
                LEFT JOIN ho ON ho.userId = u.id
                WHERE (u.isTemporary = 1 OR u.expectedHandover IS NOT NULL) AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
            ),
            withFlags AS (
                SELECT
                    departmentId,
                    CASE WHEN joinedOnD = 1 AND notLeftAsOfD = 1 AND notHandedOverAsOfD = 1 THEN 1 ELSE 0 END AS isTheoretical,
                    CASE WHEN notJoinedOnD = 1 AND notLeftAsOfD = 1 AND notHandedOverAsOfD = 1 THEN 1 ELSE 0 END AS isPractical,
                    isLeft,
                    isHandover,
                    isOnLeave,
                    CASE WHEN notLeftAsOfD = 1 AND notHandedOverAsOfD = 1 AND gender = 'MALE' THEN 1 ELSE 0 END AS isMale,
                    CASE WHEN notLeftAsOfD = 1 AND notHandedOverAsOfD = 1 AND gender = 'FEMALE' THEN 1 ELSE 0 END AS isFemale,
                    CASE WHEN joinedOnD = 1 AND notLeftAsOfD = 1 AND notHandedOverAsOfD = 1 AND gender = 'MALE' THEN 1 ELSE 0 END AS isTheoreticalMale,
                    CASE WHEN joinedOnD = 1 AND notLeftAsOfD = 1 AND notHandedOverAsOfD = 1 AND gender = 'FEMALE' THEN 1 ELSE 0 END AS isTheoreticalFemale,
                    CASE WHEN notJoinedOnD = 1 AND notLeftAsOfD = 1 AND notHandedOverAsOfD = 1 AND gender = 'MALE' THEN 1 ELSE 0 END AS isPracticalMale,
                    CASE WHEN notJoinedOnD = 1 AND notLeftAsOfD = 1 AND notHandedOverAsOfD = 1 AND gender = 'FEMALE' THEN 1 ELSE 0 END AS isPracticalFemale,
                    CASE WHEN isLeft = 1 AND gender = 'MALE' THEN 1 ELSE 0 END AS isLeftMale,
                    CASE WHEN isLeft = 1 AND gender = 'FEMALE' THEN 1 ELSE 0 END AS isLeftFemale,
                    CASE WHEN isHandover = 1 AND gender = 'MALE' THEN 1 ELSE 0 END AS isHandoverMale,
                    CASE WHEN isHandover = 1 AND gender = 'FEMALE' THEN 1 ELSE 0 END AS isHandoverFemale
                FROM flagged
            ),
            agg AS (
                SELECT departmentId,
                       SUM(isTheoretical) AS theoreticalCount, SUM(isPractical) AS practicalCount,
                       SUM(isLeft) AS leftCount, SUM(isHandover) AS handoverCount, SUM(isOnLeave) AS leaveCount,
                       SUM(isMale) AS maleCount, SUM(isFemale) AS femaleCount,
                       SUM(isTheoreticalMale) AS theoreticalMale, SUM(isTheoreticalFemale) AS theoreticalFemale,
                       SUM(isPracticalMale) AS practicalMale, SUM(isPracticalFemale) AS practicalFemale,
                       SUM(isLeftMale) AS leftMale, SUM(isLeftFemale) AS leftFemale,
                       SUM(isHandoverMale) AS handoverMale, SUM(isHandoverFemale) AS handoverFemale
                FROM withFlags
                WHERE departmentId IS NOT NULL
                GROUP BY departmentId

                UNION ALL

                SELECT NULL,
                       SUM(isTheoretical), SUM(isPractical), SUM(isLeft), SUM(isHandover), SUM(isOnLeave),
                       SUM(isMale), SUM(isFemale),
                       SUM(isTheoreticalMale), SUM(isTheoreticalFemale), SUM(isPracticalMale), SUM(isPracticalFemale),
                       SUM(isLeftMale), SUM(isLeftFemale), SUM(isHandoverMale), SUM(isHandoverFemale)
                FROM withFlags
            )
            MERGE ${TABLE} AS target
            USING agg AS src
            ON target.date = ? AND (
                target.departmentId = src.departmentId OR (target.departmentId IS NULL AND src.departmentId IS NULL)
            )
            WHEN MATCHED THEN UPDATE SET
                theoreticalCount = src.theoreticalCount,
                practicalCount = src.practicalCount,
                leftCount = src.leftCount,
                handoverCount = src.handoverCount,
                leaveCount = src.leaveCount,
                maleCount = src.maleCount,
                femaleCount = src.femaleCount,
                theoreticalMale = src.theoreticalMale,
                theoreticalFemale = src.theoreticalFemale,
                practicalMale = src.practicalMale,
                practicalFemale = src.practicalFemale,
                leftMale = src.leftMale,
                leftFemale = src.leftFemale,
                handoverMale = src.handoverMale,
                handoverFemale = src.handoverFemale,
                totalActive = src.theoreticalCount + src.practicalCount,
                meta = ?,
                updatedAt = GETDATE()
            WHEN NOT MATCHED THEN INSERT (
                date, departmentId, theoreticalCount, practicalCount, leftCount, handoverCount, leaveCount,
                maleCount, femaleCount, theoreticalMale, theoreticalFemale, practicalMale, practicalFemale,
                leftMale, leftFemale, handoverMale, handoverFemale, totalActive, meta, createdAt, updatedAt
            )
            VALUES (
                ?, src.departmentId, src.theoreticalCount, src.practicalCount, src.leftCount, src.handoverCount, src.leaveCount,
                src.maleCount, src.femaleCount, src.theoreticalMale, src.theoreticalFemale, src.practicalMale, src.practicalFemale,
                src.leftMale, src.leftFemale, src.handoverMale, src.handoverFemale,
                src.theoreticalCount + src.practicalCount, ?, GETDATE(), GETDATE()
            );
        `, [dateStr, dateStr, dateStr, dateStr, dateStr, dateStr, dateStr, meta, dateStr, meta]);
    }

    /** Syncs every date in [startDate, endDate] (inclusive), sequentially. Clamped to today. */
    static async syncRange(startDate, endDate, options = {}) {
        const today = todayISTStr();
        const clampedEnd = endDate > today ? today : endDate;
        if (startDate > clampedEnd) return { syncedDates: 0 };

        const dates = [];
        const cur = new Date(`${startDate}T00:00:00Z`);
        const last = new Date(`${clampedEnd}T00:00:00Z`);
        while (cur <= last) {
            dates.push(toDateStr(cur));
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
        for (const d of dates) {
            await this.syncDate(d, options);
        }
        return { syncedDates: dates.length };
    }

    /** Dates (as 'YYYY-MM-DD' strings) that already have an overall snapshot row in [startDate, endDate]. */
    static async getExistingDates(startDate, endDate) {
        const [rows] = await executeQuery(
            `SELECT date FROM ${TABLE} WHERE date >= ? AND date <= ? AND departmentId IS NULL`,
            [startDate, endDate]
        );
        return new Set(rows.map(r => toDateStr(r.date)));
    }

    /**
     * Raw daily rows in [startDate, endDate]. With `departmentIds`, sums the matching per-department
     * rows for each date (a date with none of the selected departments simply isn't in the result —
     * callers should treat a missing date as all-zero, not "unknown", within an already-synced range).
     * Without `departmentIds`, returns the plant-wide (departmentId IS NULL) rows directly.
     */
    static async getTrend({ startDate, endDate, departmentIds = [] }) {
        let rows;
        if (departmentIds && departmentIds.length > 0) {
            const ph = departmentIds.map(() => '?').join(',');
            const sumCols = SUM_COLUMNS.map(c => `SUM(${c}) AS ${c}`).join(', ');
            [rows] = await executeQuery(`
                SELECT date, ${sumCols}
                FROM ${TABLE}
                WHERE date >= ? AND date <= ? AND departmentId IN (${ph})
                GROUP BY date
                ORDER BY date ASC
            `, [startDate, endDate, ...departmentIds]);
        } else {
            [rows] = await executeQuery(`
                SELECT date, ${SUM_COLUMNS.join(', ')}
                FROM ${TABLE}
                WHERE date >= ? AND date <= ? AND departmentId IS NULL
                ORDER BY date ASC
            `, [startDate, endDate]);
        }
        return rows.map(r => ({ date: toDateStr(r.date), ...numRow(r) }));
    }

    /**
     * A single date's stage x gender breakdown (Theoretical/Practical/Handover/Left x Male/Female),
     * for the "Snapshot" chart view. Sums the matching per-department rows when `departmentIds` is
     * given; otherwise returns the plant-wide (departmentId IS NULL) row. Returns an all-zero row
     * (not null) when nothing was ever synced for that date — a missing row means no contemporaneous
     * snapshot was taken, not that a request should reach back and reconstruct one.
     */
    static async getSnapshot(dateStr, departmentIds = []) {
        let rows;
        if (departmentIds && departmentIds.length > 0) {
            const ph = departmentIds.map(() => '?').join(',');
            const sumCols = SUM_COLUMNS.map(c => `SUM(${c}) AS ${c}`).join(', ');
            [rows] = await executeQuery(`
                SELECT ${sumCols} FROM ${TABLE} WHERE date = ? AND departmentId IN (${ph})
            `, [dateStr, ...departmentIds]);
        } else {
            [rows] = await executeQuery(`
                SELECT ${SUM_COLUMNS.join(', ')} FROM ${TABLE} WHERE date = ? AND departmentId IS NULL
            `, [dateStr]);
        }
        const row = rows[0];
        return { date: dateStr, ...(row ? numRow(row) : ZERO_ROW) };
    }
}

export { ZERO_ROW };
export default DojoStageHistory;
