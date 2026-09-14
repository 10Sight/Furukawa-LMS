import { executeQuery } from "./mssqlHelper.js";
import logger from "../logger/winston.logger.js";

/**
 * Idempotent startup self-healing for the `users` table's status/statusHistory data.
 *
 * Historically, some rows ended up with non-canonical `status` values (e.g. 'ACTIVE',
 * 'ON-LEAVE') from bulk imports/direct edits that predate the centralized normalizer in
 * userEligibility.js (normalizeOperatorStatus), and some `statusHistory` genesis rows were
 * written as a bare JSON object instead of a one-entry array before statusHistory.js wrapped
 * every entry in an array. Both defects make different eligibility queries across the app
 * (Students page vs Dashboard) silently disagree with each other, since a raw 'ACTIVE' status
 * passes a loose `!= 'LEFT'` check but fails a strict `= 'PRESENT'` check, and a malformed
 * statusHistory object breaks OPENJSON()-based date reconstruction.
 *
 * Every step here is safe to re-run: each UPDATE only touches rows that are still wrong, so
 * running this on every server boot costs nothing once the data is clean.
 */
const healDatabaseIntegrity = async () => {
    try {
        const [, statusResult] = await executeQuery(`
            UPDATE users
            SET status = CASE
                WHEN UPPER(LTRIM(RTRIM(REPLACE(REPLACE(ISNULL(CONVERT(NVARCHAR(50), status), ''), '-', ''), '_', ''))))
                    IN ('LEFT', 'LEAVING', 'RESIGNED', 'TERMINATED') THEN 'LEFT'
                WHEN UPPER(LTRIM(RTRIM(REPLACE(REPLACE(ISNULL(CONVERT(NVARCHAR(50), status), ''), '-', ''), '_', ''))))
                    IN ('ONLEAVE', 'LEAVE') THEN 'ON_LEAVE'
                ELSE 'PRESENT'
            END
            WHERE status IS NULL
               OR UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(50), status)))) NOT IN ('PRESENT', 'ON_LEAVE', 'LEFT')
        `);
        const statusFixed = statusResult?.affectedRows || 0;
        if (statusFixed > 0) {
            logger.info(`[healDatabaseIntegrity] Normalized ${statusFixed} non-canonical users.status value(s) to PRESENT/ON_LEAVE/LEFT.`);
        }

        // A genesis statusHistory entry written before every entry was wrapped in an array
        // (see statusHistory.js) is a bare JSON object — '{...}' instead of '[{...}]'.
        const [, wrapResult] = await executeQuery(`
            UPDATE users
            SET statusHistory = '[' + CONVERT(NVARCHAR(MAX), statusHistory) + ']'
            WHERE statusHistory IS NOT NULL
              AND LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), statusHistory))) <> ''
              AND ISJSON(statusHistory) = 1
              AND LEFT(LTRIM(CONVERT(NVARCHAR(MAX), statusHistory)), 1) = '{'
        `);
        const wrapped = wrapResult?.affectedRows || 0;
        if (wrapped > 0) {
            logger.info(`[healDatabaseIntegrity] Wrapped ${wrapped} malformed single-object statusHistory value(s) into a JSON array.`);
        }

        // Users with NULL/empty/'[]' statusHistory get a genesis entry seeded from their
        // current (already-normalized, as of the step above) status/joiningDate/leavingDate.
        const [, seedResult] = await executeQuery(`
            UPDATE users
            SET statusHistory =
                '[{"status":"' + status + '",' +
                '"joiningDate":' + CASE WHEN joiningDate IS NULL THEN 'null' ELSE '"' + CONVERT(NVARCHAR(10), joiningDate, 23) + '"' END + ',' +
                '"leavingDate":' + CASE WHEN leavingDate IS NULL THEN 'null' ELSE '"' + CONVERT(NVARCHAR(10), leavingDate, 23) + '"' END + ',' +
                '"changedBy":null,"changedByName":null,' +
                '"changedAt":"' + CONVERT(NVARCHAR(33), ISNULL(createdAt, GETDATE()), 127) + '"}]'
            WHERE statusHistory IS NULL
               OR LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), statusHistory))) IN ('', '[]')
        `);
        const seeded = seedResult?.affectedRows || 0;
        if (seeded > 0) {
            logger.info(`[healDatabaseIntegrity] Seeded a genesis statusHistory entry for ${seeded} user(s) with missing/empty history.`);
        }

        if (!statusFixed && !wrapped && !seeded) {
            logger.info("[healDatabaseIntegrity] users.status/statusHistory already consistent — nothing to heal.");
        }
    } catch (error) {
        // Never block server startup on a healing pass — log and continue with whatever
        // data integrity currently exists.
        logger.error("[healDatabaseIntegrity] Failed:", error);
    }
};

export default healDatabaseIntegrity;
