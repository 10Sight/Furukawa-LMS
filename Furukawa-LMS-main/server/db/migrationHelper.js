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
     * Ensures a column has the correct data type
     * @param {string} tableName 
     * @param {string} columnName 
     * @param {string} expectedType 
     */
    ensureColumnType: async (tableName, columnName, expectedType) => {
        try {
            const checkQuery = `
                SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = '${tableName}' AND COLUMN_NAME = '${columnName}'
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
