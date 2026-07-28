import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class RevisionHistory {
    constructor(data) {
        this.id = data.id;
        this.revisionRecordId = data.revisionRecordId;
        this.sheetKey = data.sheetKey;
        this.sheetName = data.sheetName;
        this.departmentId = data.departmentId;
        this.sectionId = data.sectionId;
        this.departmentName = data.departmentName;
        this.sectionName = data.sectionName;
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
                    departmentId INT NULL,
                    sectionId INT NULL,
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
            ELSE
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('revision_history') AND name = 'departmentId')
                BEGIN
                    ALTER TABLE [revision_history] ADD departmentId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('revision_history') AND name = 'sectionId')
                BEGIN
                    ALTER TABLE [revision_history] ADD sectionId INT NULL;
                END
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
            (revisionRecordId, sheetKey, sheetName, departmentId, sectionId, docNo, revNo, revDate, affectedSrNoPage, affectedSrNoPageHi, changeDetails, changeDetailsHi, updatedBy, updatedByName, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
        `;
        await executeQuery(query, [
            data.revisionRecordId,
            data.sheetKey,
            data.sheetName,
            data.departmentId ?? null,
            data.sectionId ?? null,
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

    static async findAll({ departmentId, sectionId, sheetKey } = {}) {
        let query = `
            SELECT h.*, u.fullName as resolvedUpdatedByName, d.name as departmentName, s.name as sectionName
            FROM [revision_history] h
            LEFT JOIN users u ON h.updatedBy = u.id
            LEFT JOIN departments d ON h.departmentId = d.id
            LEFT JOIN [sections] s ON h.sectionId = s.id
            WHERE 1=1
        `;
        const values = [];
        if (sheetKey) {
            query += " AND h.sheetKey = ?";
            values.push(sheetKey);
        }
        if (departmentId) {
            query += " AND h.departmentId = ?";
            values.push(departmentId);
        }
        if (sectionId) {
            query += " AND h.sectionId = ?";
            values.push(sectionId);
        }
        query += " ORDER BY h.updatedAt DESC";
        const [rows] = await executeQuery(query, values);
        return rows.map(r => new RevisionHistory({ ...r, updatedByName: r.resolvedUpdatedByName || r.updatedByName }));
    }
}

export default RevisionHistory;
