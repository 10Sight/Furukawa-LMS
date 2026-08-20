import { executeQuery } from "../db/mssqlHelper.js";
import { formatLocalDate } from "../utils/istDate.util.js";
import migrationHelper from "../db/migrationHelper.js";

class AbnormalConditionSheet {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.date = data.date instanceof Date
            ? formatLocalDate(data.date)
            : (data.date || null);

        // Dynamic sheet rows: default 15 rows of entries
        this.entries = typeof data.entries === 'string'
            ? JSON.parse(data.entries)
            : (data.entries || []);

        this.signatures = typeof data.signatures === 'string'
            ? JSON.parse(data.signatures)
            : (data.signatures || { headQA: "" });

        this.metadata = typeof data.metadata === 'string'
            ? JSON.parse(data.metadata)
            : (data.metadata || {
                docNo: "FRM/QA/155-A",
                revNo: "01",
                revDate: "10.04.15",
                remarks: "NG product will be handled as the defective product handling system"
            });

        this.isSubmitted = !!data.isSubmitted;
        this.updatedBy = data.updatedBy;
        this.updatedAt = data.updatedAt;

        // Joined properties
        this.departmentName = data.departmentName || null;
    }

    static async init() {
        const migrateQuery = `
            IF EXISTS (SELECT * FROM sysobjects WHERE name='abnormal_condition_sheets' AND xtype='U')
            BEGIN
                -- Drop constraints first if they exist
                IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'fk_section_abnormal')
                    ALTER TABLE abnormal_condition_sheets DROP CONSTRAINT fk_section_abnormal;

                -- Drop obsolete columns if they exist
                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('abnormal_condition_sheets') AND name = 'sectionId')
                    ALTER TABLE abnormal_condition_sheets DROP COLUMN sectionId;

                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('abnormal_condition_sheets') AND name = 'lineId')
                    ALTER TABLE abnormal_condition_sheets DROP COLUMN lineId;

                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('abnormal_condition_sheets') AND name = 'subSectionId')
                    ALTER TABLE abnormal_condition_sheets DROP COLUMN subSectionId;

                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('abnormal_condition_sheets') AND name = 'createdBy')
                BEGIN
                    DECLARE @createdByConstraint NVARCHAR(256)
                    SELECT @createdByConstraint = dc.name
                    FROM sys.default_constraints dc
                    JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
                    WHERE c.object_id = OBJECT_ID('abnormal_condition_sheets') AND c.name = 'createdBy'
                    IF @createdByConstraint IS NOT NULL
                        EXEC('ALTER TABLE abnormal_condition_sheets DROP CONSTRAINT [' + @createdByConstraint + ']')
                    ALTER TABLE abnormal_condition_sheets DROP COLUMN createdBy;
                END

                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('abnormal_condition_sheets') AND name = 'createdAt')
                BEGIN
                    DECLARE @createdAtConstraint NVARCHAR(256)
                    SELECT @createdAtConstraint = dc.name
                    FROM sys.default_constraints dc
                    JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
                    WHERE c.object_id = OBJECT_ID('abnormal_condition_sheets') AND c.name = 'createdAt'
                    IF @createdAtConstraint IS NOT NULL
                        EXEC('ALTER TABLE abnormal_condition_sheets DROP CONSTRAINT [' + @createdAtConstraint + ']')
                    ALTER TABLE abnormal_condition_sheets DROP COLUMN createdAt;
                END
            END
        `;
        try {
            if (!await migrationHelper.tableExists('abnormal_condition_sheets')) {
                await executeQuery(`
                    CREATE TABLE abnormal_condition_sheets (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        departmentId INT NOT NULL,
                        date DATE NOT NULL,
                        entries NVARCHAR(MAX),
                        signatures NVARCHAR(MAX),
                        metadata NVARCHAR(MAX),
                        isSubmitted BIT DEFAULT 0,
                        updatedBy NVARCHAR(255),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        CONSTRAINT fk_department_abnormal FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE
                    )
                `);
            }
            await executeQuery(migrateQuery);
            console.log("Checked/Simplified abnormal_condition_sheets table in MSSQL");
        } catch (error) {
            console.error("Failed to initialize/simplify abnormal_condition_sheets table", error);
        }
    }

    static async findSpecific(departmentId, date) {
        let query = `
            SELECT a.*, d.name AS departmentName
            FROM abnormal_condition_sheets a
            JOIN departments d ON a.departmentId = d.id
            WHERE a.departmentId = ? AND CAST(a.date AS DATE) = CAST(? AS DATE)
        `;
        const [rows] = await executeQuery(query, [departmentId, date]);
        if (rows.length === 0) return null;
        return new AbnormalConditionSheet(rows[0]);
    }

    static async findById(id) {
        if (!id || isNaN(id)) return null;
        const [rows] = await executeQuery("SELECT a.*, d.name as departmentName FROM abnormal_condition_sheets a JOIN departments d ON a.departmentId = d.id WHERE a.id = ?", [id]);
        if (rows.length === 0) return null;
        return new AbnormalConditionSheet(rows[0]);
    }

    static async create(data) {
        const query = `
            INSERT INTO abnormal_condition_sheets (departmentId, date, entries, signatures, metadata, updatedBy, isSubmitted)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        // Create 15 default empty rows if not provided
        const defaultEntries = Array.from({ length: 15 }, (_, i) => ({
            sNo: i + 1,
            date: i === 0 ? (data.date ? data.date.split('T')[0] : new Date().toISOString().split('T')[0]) : "",
            processId: null,
            lineId: null,
            producedQty: "",
            okQty: "",
            ngQty: "",
            abnormalCondition: "",
            cause: "",
            action: "",
            respUserId: null,
            respUserText: "", 
            target: "",
            setupConfirmation: "",
            approvalStatus: "PENDING",
            approvedBy: ""
        }));

        const entriesStr = JSON.stringify(data.entries || defaultEntries);
        const signaturesStr = JSON.stringify(data.signatures || { headQA: "" });
        const metadataStr = JSON.stringify(data.metadata || {
            docNo: "FRM/QA/155-A",
            revNo: "01",
            revDate: "10.04.15",
            remarks: "NG product will be handled as the defective product handling system"
        });

        const [rows] = await executeQuery(query, [
            data.departmentId,
            data.date,
            entriesStr,
            signaturesStr,
            metadataStr,
            data.updatedBy || "System",
            data.isSubmitted ? 1 : 0
        ]);
        
        return new AbnormalConditionSheet({
            id: rows[0].id,
            departmentId: data.departmentId,
            date: data.date,
            entries: data.entries || defaultEntries,
            signatures: data.signatures || { headQA: "" },
            metadata: data.metadata || {
                docNo: "FRM/QA/155-A",
                revNo: "01",
                revDate: "10.04.15",
                remarks: "NG product will be handled as the defective product handling system"
            },
            updatedBy: data.updatedBy || "System",
            isSubmitted: !!data.isSubmitted
        });
    }

    async save() {
        const query = `
            UPDATE abnormal_condition_sheets 
            SET date = ?, entries = ?, signatures = ?, metadata = ?, updatedBy = ?, updatedAt = GETDATE(), isSubmitted = ?
            WHERE id = ?
        `;
        const entriesStr = JSON.stringify(this.entries);
        const signaturesStr = JSON.stringify(this.signatures);
        const metadataStr = JSON.stringify(this.metadata);

        await executeQuery(query, [
            this.date,
            entriesStr,
            signaturesStr,
            metadataStr,
            this.updatedBy,
            this.isSubmitted ? 1 : 0,
            this.id
        ]);
    }

    static async delete(id) {
        const [, metadata] = await executeQuery("DELETE FROM abnormal_condition_sheets WHERE id = ?", [id]);
        return metadata.affectedRows > 0;
    }

    static async findAll(filters = {}) {
        let query = `
            SELECT a.*, d.name AS departmentName
            FROM abnormal_condition_sheets a
            JOIN departments d ON a.departmentId = d.id
            WHERE 1=1
        `;
        const params = [];
        if (filters.departmentId) {
            query += " AND a.departmentId = ?";
            params.push(filters.departmentId);
        }
        if (filters.assignedDeptIds && filters.assignedDeptIds.length > 0) {
            const placeholders = filters.assignedDeptIds.map(() => "?").join(",");
            query += ` AND a.departmentId IN (${placeholders})`;
            params.push(...filters.assignedDeptIds);
        }
        if (filters.date) {
            query += " AND CAST(a.date AS DATE) = CAST(? AS DATE)";
            params.push(filters.date);
        }
        query += " ORDER BY a.updatedAt DESC";
        const [rows] = await executeQuery(query, params);
        return rows.map(r => new AbnormalConditionSheet(r));
    }
}

export default AbnormalConditionSheet;
