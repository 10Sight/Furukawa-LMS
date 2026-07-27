import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class RevisionHistory {
    constructor(data) {
        this.id = data.id;
        this.revisionRecordId = data.revisionRecordId;
        this.sheetKey = data.sheetKey;
        this.sheetName = data.sheetName;
        this.docNo = data.docNo;
        this.revNo = data.revNo;
        this.revDate = data.revDate;
        this.affectedSrNoPage = data.affectedSrNoPage;
        this.affectedSrNoPageHi = data.affectedSrNoPageHi;
        this.changeDetails = data.changeDetails;
        this.changeDetailsHi = data.changeDetailsHi;
        this.updatedBy = data.updatedBy;
        this.updatedByName = data.updatedByName;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'revision_history')
            BEGIN
                CREATE TABLE [revision_history] (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    revisionRecordId INT NOT NULL,
                    sheetKey VARCHAR(255) NOT NULL,
                    sheetName VARCHAR(255) NOT NULL,
                    docNo VARCHAR(255) NULL,
                    revNo VARCHAR(255) NULL,
                    revDate VARCHAR(255) NULL,
                    affectedSrNoPage VARCHAR(255) NULL,
                    affectedSrNoPageHi NVARCHAR(255) NULL,
                    changeDetails NVARCHAR(MAX) NULL,
                    changeDetailsHi NVARCHAR(MAX) NULL,
                    updatedBy INT NULL,
                    updatedByName NVARCHAR(255) NULL,
                    updatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (revisionRecordId) REFERENCES [revision_records](id) ON DELETE CASCADE,
                    FOREIGN KEY (updatedBy) REFERENCES users(id) ON DELETE SET NULL
                );
                CREATE INDEX idx_revision_history_record ON [revision_history](revisionRecordId);
            END
        `;
        try {
            await executeQuery(query);
            logger.info("Checked/Created revision_history table in MSSQL");
        } catch (error) {
            logger.error(`Failed to initialize RevisionHistory table: ${error.message}`);
        }
    }

    static async create(data) {
        const query = `
            INSERT INTO [revision_history]
            (revisionRecordId, sheetKey, sheetName, docNo, revNo, revDate, affectedSrNoPage, affectedSrNoPageHi, changeDetails, changeDetailsHi, updatedBy, updatedByName, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
        `;
        await executeQuery(query, [
            data.revisionRecordId,
            data.sheetKey,
            data.sheetName,
            data.docNo ?? null,
            data.revNo ?? null,
            data.revDate ?? null,
            data.affectedSrNoPage ?? null,
            data.affectedSrNoPageHi ?? null,
            data.changeDetails ?? null,
            data.changeDetailsHi ?? null,
            data.updatedBy ?? null,
            data.updatedByName ?? null,
        ]);
    }

    static async findAll() {
        const query = `
            SELECT h.*, u.fullName as resolvedUpdatedByName
            FROM [revision_history] h
            LEFT JOIN users u ON h.updatedBy = u.id
            ORDER BY h.updatedAt DESC
        `;
        const [rows] = await executeQuery(query);
        return rows.map(r => new RevisionHistory({ ...r, updatedByName: r.resolvedUpdatedByName || r.updatedByName }));
    }
}

export default RevisionHistory;
