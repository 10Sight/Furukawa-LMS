import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

const createImportLogTables = async () => {
    try {
        logger.info("Creating Import Log tables...");

        const createImportLogs = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'import_logs')
            BEGIN
                CREATE TABLE import_logs (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    fileName NVARCHAR(255) NOT NULL,
                    importType NVARCHAR(50) NOT NULL, -- e.g. 'OPERATOR', 'INSTRUCTOR'
                    totalRows INT DEFAULT 0,
                    successCount INT DEFAULT 0,
                    failCount INT DEFAULT 0,
                    importedBy INT, -- user id
                    createdAt DATETIME DEFAULT GETDATE()
                );
                CREATE INDEX idx_import_type ON import_logs(importType);
                CREATE INDEX idx_import_created ON import_logs(createdAt);
            END
        `;

        const createImportLogDetails = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'import_log_details')
            BEGIN
                CREATE TABLE import_log_details (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    logId INT NOT NULL,
                    rowNumber INT,
                    rowData NVARCHAR(MAX), -- JSON string of the row
                    status NVARCHAR(20), -- 'SUCCESS', 'FAILED'
                    errorMessage NVARCHAR(MAX),
                    entityId INT, -- created user id if success
                    FOREIGN KEY (logId) REFERENCES import_logs(id) ON DELETE CASCADE
                );
                CREATE INDEX idx_log_id ON import_log_details(logId);
            END
        `;

        await executeQuery(createImportLogs);
        await executeQuery(createImportLogDetails);
        
        logger.info("Import Log tables created successfully.");
        process.exit(0);
    } catch (error) {
        logger.error("Failed to create Import Log tables:", error);
        process.exit(1);
    }
};

createImportLogTables();
