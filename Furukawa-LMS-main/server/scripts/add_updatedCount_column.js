import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

const migrateUpdatedCountColumn = async () => {
    try {
        logger.info("Adding 'updatedCount' column to import_logs...");

        const addColumnQuery = `
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID('import_logs') AND name = 'updatedCount'
            )
            BEGIN
                ALTER TABLE import_logs ADD updatedCount INT DEFAULT 0;
                PRINT 'Column "updatedCount" added successfully.';
            END
            ELSE
            BEGIN
                PRINT 'Column "updatedCount" already exists.';
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

migrateUpdatedCountColumn();
