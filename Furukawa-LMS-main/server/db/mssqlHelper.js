import { poolPromise, longRunningPoolPromise } from "./connectDB.js";
import logger from "../logger/winston.logger.js";

const SLOW_QUERY_THRESHOLD_MS = 2000;

const truncateForLog = (text) => (text.length > 300 ? `${text.slice(0, 300)}...` : text);

/**
 * Runs a query against a given mssql Request (either pool.request() or transaction.request()),
 * mimicking the array-based parameter approach of mysql2.
 */
export const runOnRequest = async (request, queryText, params = []) => {
    let processedQuery = queryText;

    let paramIndex = 0;

    // First, flatten the params array and expand '?' where params are arrays
    let flattenedParams = [];

    processedQuery = processedQuery.replace(/\?/g, () => {
        const val = params[paramIndex];
        paramIndex++;

        if (Array.isArray(val)) {
            if (val.length === 0) {
                // Empty IN clause like `id IN ()` which is invalid SQL, but usually we handle it by returning early.
                // Outputting a dummy so we don't crash
                return "NULL";
            }
            const arrayParams = val.map((v) => {
                flattenedParams.push(v);
                return `?`; // Temporarily put ? back for the flattened pass
            });
            return arrayParams.join(", ");
        } else {
            flattenedParams.push(val);
            return "?";
        }
    });

    // Now replace all ? with @param0, @param1
    let finalIndex = 0;
    processedQuery = processedQuery.replace(/\?/g, () => {
        const paramName = `param${finalIndex}`;
        const val = flattenedParams[finalIndex];

        // Add parameter to the request
        request.input(paramName, val);

        finalIndex++;
        return `@${paramName}`;
    });

    const startedAt = Date.now();
    try {
        const result = await request.query(processedQuery);
        const durationMs = Date.now() - startedAt;

        if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
            logger.warn(`[SLOW QUERY] Execution took ${durationMs}ms: ${truncateForLog(queryText)}`);
        }

        // Mimic the mysql2 return format: [rows, fields/metadata]
        // result.recordset contains the rows
        // result.rowsAffected contains the number of rows affected

        // For INSERT queries involving IDENTITY, returning the ID requires OUTPUT INSERTED.id in MSSQL,
        // which complicates simple translation. If we just need rows, we return recordset.
        const fakeMetadata = {
            insertId: null, // We'll need to manually ensure output inserted.id is used if we need insertId
            affectedRows: result.rowsAffected ? result.rowsAffected[0] : 0
        };

        return [result.recordset || [], fakeMetadata];
    } catch (error) {
        const durationMs = Date.now() - startedAt;
        logger.error(`[QUERY FAILED] after ${durationMs}ms: ${error.message} | Query: ${truncateForLog(queryText)}`);
        throw error;
    }
};

/**
 * Helper to execute MSSQL queries with parameters, mimicking the array-based parameter approach of mysql2.
 * Usage:
 * const [rows, result] = await executeQuery("SELECT * FROM users WHERE id = ?", [userId]);
 * Pass { longRunning: true } to run against the long-running pool (5 minute timeout) for
 * operations like PDF generation or bulk import/restore.
 */
export const executeQuery = async (queryText, params = [], options = {}) => {
    const pool = await (options.longRunning ? longRunningPoolPromise : poolPromise);
    const request = pool.request();
    return runOnRequest(request, queryText, params);
};

/**
 * Returns the list of user base table names in the dbo schema.
 * Used to dynamically discover tables instead of relying on a hardcoded map.
 */
export const getUserTables = async () => {
    const [rows] = await executeQuery(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo' AND TABLE_NAME <> 'sysdiagrams'"
    );
    return rows.map(r => r.TABLE_NAME);
};

/**
 * Checks whether a table has an IDENTITY column.
 * SET IDENTITY_INSERT fails on tables without one, so this must be checked before using it.
 */
export const tableHasIdentity = async (tableName) => {
    const [rows] = await executeQuery(
        "SELECT OBJECTPROPERTY(OBJECT_ID(?), 'TableHasIdentity') AS HasIdentity",
        [tableName]
    );
    return !!(rows[0] && rows[0].HasIdentity);
};
