import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

const migrateChangesColumn = async () => {
    try {
        logger.info("Adding 'changes' column to import_log_details...");

        const addColumnQuery = `
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID('import_log_details') AND name = 'changes'
            )
            BEGIN
                ALTER TABLE import_log_details ADD changes NVARCHAR(MAX);
                PRINT 'Column "changes" added successfully.';
            END
            ELSE
            BEGIN
                PRINT 'Column "changes" already exists.';
            END
        `;

        await executeQuery(addColumnQuery);
        
        logger.info("Migration completed successfully.");
        process.exit(0);
    } catch (error) {
        logger.error("Migration failed:", error);
        process.exit(1);
    }
};

migrateChangesColumn();
