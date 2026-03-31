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
    }
};

export default migrationHelper;
