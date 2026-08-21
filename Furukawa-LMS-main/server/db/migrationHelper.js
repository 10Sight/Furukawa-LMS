import { executeQuery } from "./mssqlHelper.js";
import logger from "../logger/winston.logger.js";

/**
 * Utility to help with database migrations in MSSQL
 */
export const migrationHelper = {
    /**
     * Ensures a column exists in a table, adding it if missing.
     * @param {string} tableName 
     * @param {string} columnName 
     * @param {string} dataType MSSQL data type and constraints (e.g., "NVARCHAR(255)", "BIT DEFAULT 0")
     */
    ensureColumnExists: async (tableName, columnName, dataType) => {
        try {
            // Check if column exists
            const checkQuery = `
                SELECT COL_LENGTH('${tableName}', '${columnName}') AS colLen
            `;
            const [rows] = await executeQuery(checkQuery);
            
            if (rows && rows[0] && rows[0].colLen === null) {
                logger.info(`Migration: Adding column '${columnName}' to table '${tableName}'...`);
                
                const alterQuery = `
                    ALTER TABLE ${tableName} ADD ${columnName} ${dataType}
                `;
                await executeQuery(alterQuery);
                
                logger.info(`Migration: Successfully added column '${columnName}' to '${tableName}'.`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`Migration Error adding column '${columnName}' to '${tableName}':`, error.message);
            throw error;
        }
    },

    /**
     * Checks if a table exists
     * @param {string} tableName 
     */
    tableExists: async (tableName) => {
        try {
            const query = `
                SELECT * FROM sysobjects WHERE name='${tableName}' AND xtype='U'
            `;
            const [rows] = await executeQuery(query);
            return rows.length > 0;
        } catch (error) {
            logger.error(`Error checking if table '${tableName}' exists:`, error.message);
            return false;
        }
    },

    /**
     * Ensures an index exists on a table, creating it if missing. Idempotent and safe to call
     * on every boot. Pass `{ longRunning: true }` for indexes built over tables that may already
     * hold significant data, since a first-time build can exceed the standard query timeout.
     * @param {string} tableName
     * @param {string} indexName
     * @param {string} ddl full CREATE INDEX statement
     * @param {{ longRunning?: boolean }} [options]
     */
    ensureIndexExists: async (tableName, indexName, ddl, options = {}) => {
        try {
            const [rows] = await executeQuery(
                `SELECT name FROM sys.indexes WHERE name = ? AND object_id = OBJECT_ID(?)`,
                [indexName, tableName]
            );
            if (rows.length === 0) {
                logger.info(`Migration: Creating index '${indexName}' on table '${tableName}'...`);
                await executeQuery(ddl, [], options.longRunning ? { longRunning: true } : undefined);
                logger.info(`Migration: Successfully created index '${indexName}' on '${tableName}'.`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`Migration Error creating index '${indexName}' on '${tableName}':`, error.message);
            throw error;
        }
    },

    /**
     * Ensures a column has the correct data type
     * @param {string} tableName
     * @param {string} columnName
     * @param {string} expectedType
     */
    ensureColumnType: async (tableName, columnName, expectedType) => {
        try {
            const checkQuery = `
                SELECT
                    t.name AS DATA_TYPE,
                    CASE
                        WHEN t.name IN ('nchar', 'nvarchar') AND c.max_length <> -1 THEN c.max_length / 2
                        ELSE c.max_length
                    END AS CHARACTER_MAXIMUM_LENGTH
                FROM sys.columns c
                INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
                WHERE c.object_id = OBJECT_ID('${tableName}') AND c.name = '${columnName}'
            `;
            const [rows] = await executeQuery(checkQuery);
            
            if (rows && rows.length > 0) {
                const currentType = rows[0].DATA_TYPE.toLowerCase();
                const currentLen = rows[0].CHARACTER_MAXIMUM_LENGTH;

                const expectedBase = expectedType.split('(')[0].toLowerCase();
                const expectsMax = expectedType.toUpperCase().includes('(MAX)');

                const typeMismatch = currentType !== expectedBase;
                // SQL Server reports CHARACTER_MAXIMUM_LENGTH = -1 for MAX columns
                const lengthMismatch = expectsMax && currentLen !== -1;

                if (typeMismatch || lengthMismatch) {
                    logger.info(`Migration: Altering column '${columnName}' in table '${tableName}' to ${expectedType}...`);
                    const alterQuery = `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} ${expectedType}`;
                    await executeQuery(alterQuery);

                    // If we converted from INT to NVARCHAR, wrap existing values in brackets to make them valid JSON arrays
                    if (currentType === 'int' && expectedBase.includes('nvarchar')) {
                        logger.info(`Migration: Wrapping existing INT values in JSON arrays for column '${columnName}'...`);
                        await executeQuery(`UPDATE ${tableName} SET ${columnName} = '[' + CAST(${columnName} AS NVARCHAR(MAX)) + ']' WHERE ${columnName} IS NOT NULL AND ${columnName} NOT LIKE '[%'`);
                    }

                    logger.info(`Migration: Successfully altered column '${columnName}' in '${tableName}' to ${expectedType}.`);
                    return true;
                }
            }
            return false;
        } catch (error) {
            logger.error(`Migration Error altering column '${columnName}' in '${tableName}':`, error.message);
            throw error;
        }
    }
};

export default migrationHelper;
