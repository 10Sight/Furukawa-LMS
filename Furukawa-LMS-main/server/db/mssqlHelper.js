import { poolPromise, mssql } from "./connectDB.js";

/**
 * Helper to execute MSSQL queries with parameters, mimicking the array-based parameter approach of mysql2.
 * Usage:
 * const [rows, result] = await executeQuery("SELECT * FROM users WHERE id = ?", [userId]);
 */
export const executeQuery = async (queryText, params = []) => {
    const pool = await poolPromise;
    const request = pool.request();

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

    const result = await request.query(processedQuery);

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
};
