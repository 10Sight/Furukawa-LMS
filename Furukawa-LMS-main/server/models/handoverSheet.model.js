import { executeQuery } from "../db/mssqlHelper.js";

class HandoverSheet {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.date = data.date;

        // Array of entries: { studentId, marks, process, mentor, interview1, interview2 }
        this.entries = typeof data.entries === 'string'
            ? JSON.parse(data.entries)
            : (data.entries || []);

        this.signatures = typeof data.signatures === 'string'
            ? JSON.parse(data.signatures)
            : (data.signatures || { educationCell: "", hod: "" });

        this.metadata = typeof data.metadata === 'string'
            ? JSON.parse(data.metadata)
            : (data.metadata || {
                docNo: "FRM-HR-003",
                revNo: "05",
                revDate: "30.01.2024",
                issueDate: "01.06.09"
            });

        this.createdBy = data.createdBy;
        this.updatedBy = data.updatedBy;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='handover_sheets' and xtype='U')
            BEGIN
                CREATE TABLE handover_sheets (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId INT NOT NULL,
                    date DATE,
                    entries NVARCHAR(MAX),
                    signatures NVARCHAR(MAX),
                    metadata NVARCHAR(MAX),
                    createdBy NVARCHAR(255),
                    updatedBy NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT fk_department_handover FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE
                )
            END
        `;
        await executeQuery(query);

        // Migration: Check if metadata column exists, if not add it
        try {
            await executeQuery("SELECT TOP 1 metadata FROM handover_sheets");
        } catch (error) {
            try {
                await executeQuery("ALTER TABLE handover_sheets ADD metadata NVARCHAR(MAX)");
                console.log("Added metadata column to handover_sheets");
            } catch (e) { }
        }
    }

    static async findByDepartmentId(departmentId) {
        const query = "SELECT * FROM handover_sheets WHERE departmentId = ?";
        const [rows] = await executeQuery(query, [departmentId]);
        if (rows.length === 0) return null;
        return new HandoverSheet(rows[0]);
    }

    static async create(data) {
        const query = `
            INSERT INTO handover_sheets (departmentId, date, entries, signatures, metadata, createdBy)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const entriesStr = JSON.stringify(data.entries || []);
        const signaturesStr = JSON.stringify(data.signatures || {});
        const metadataStr = JSON.stringify(data.metadata || {});

        const [rows] = await executeQuery(query, [
            data.departmentId,
            data.date,
            entriesStr,
            signaturesStr,
            metadataStr,
            data.createdBy
        ]);
        return new HandoverSheet({ ...data, id: rows[0].id });
    }

    async save() {
        const query = `
            UPDATE handover_sheets 
            SET date = ?, entries = ?, signatures = ?, metadata = ?, updatedBy = ?, updatedAt = GETDATE()
            WHERE id = ?
        `;
        const entriesStr = JSON.stringify(this.entries);
        const signaturesStr = JSON.stringify(this.signatures);
        const metadataStr = JSON.stringify(this.metadata);

        console.log(`[HandoverSheet Model] Saving sheet id=${this.id}, entries count=${this.entries.length}`);

        await executeQuery(query, [
            this.date,
            entriesStr,
            signaturesStr,
            metadataStr,
            this.updatedBy,
            this.id
        ]);
    }
}

export default HandoverSheet;
