import { executeQuery } from "../db/mssqlHelper.js";
import { formatLocalDate } from "../utils/istDate.util.js";

class HandoverSheet {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.sectionId = data.sectionId;
        this.shift = data.shift;
        this.date = data.date instanceof Date
            ? formatLocalDate(data.date)
            : (data.date || null);

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

        this.isSubmitted = !!data.isSubmitted;
        this.submittedAt = data.submittedAt;
        this.createdBy = data.createdBy;
        this.updatedBy = data.updatedBy;
        this.remarksHistory = typeof data.remarksHistory === 'string'
            ? JSON.parse(data.remarksHistory)
            : (data.remarksHistory || []);
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
                    sectionId INT,
                    date DATE,
                    entries NVARCHAR(MAX),
                    signatures NVARCHAR(MAX),
                    metadata NVARCHAR(MAX),
                    isSubmitted BIT DEFAULT 0,
                    submittedAt DATETIME,
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

        // Migration: Add sectionId column if missing
        try {
            await executeQuery("SELECT TOP 1 sectionId FROM handover_sheets");
        } catch (error) {
            try {
                await executeQuery("ALTER TABLE handover_sheets ADD sectionId INT");
                console.log("Added sectionId column to handover_sheets");
            } catch (e) { }
        }

        // Migration: Add isSubmitted column if missing
        try {
            await executeQuery("SELECT TOP 1 isSubmitted FROM handover_sheets");
        } catch (error) {
            try {
                await executeQuery("ALTER TABLE handover_sheets ADD isSubmitted BIT DEFAULT 0");
                console.log("Added isSubmitted column to handover_sheets");
            } catch (e) { }
        }

        // Migration: Add submittedAt column if missing
        try {
            await executeQuery("SELECT TOP 1 submittedAt FROM handover_sheets");
        } catch (error) {
            try {
                await executeQuery("ALTER TABLE handover_sheets ADD submittedAt DATETIME");
                console.log("Added submittedAt column to handover_sheets");
            } catch (e) { }
        }

        // Migration: Add remarksHistory column if missing
        try {
            await executeQuery("SELECT TOP 1 remarksHistory FROM handover_sheets");
        } catch (error) {
            try {
                await executeQuery("ALTER TABLE handover_sheets ADD remarksHistory NVARCHAR(MAX)");
                console.log("Added remarksHistory column to handover_sheets");
            } catch (e) { }
        }

        // Migration: Add shift column if missing
        try {
            await executeQuery("SELECT TOP 1 shift FROM handover_sheets");
        } catch (error) {
            try {
                await executeQuery("ALTER TABLE handover_sheets ADD shift NVARCHAR(10)");
                console.log("Added shift column to handover_sheets");
            } catch (e) { }
        }

        // Migration: Add index on departmentId if missing. This column is queried
        // heavily (16-Day Monitoring list/get/save) to narrow rows before the
        // CROSS APPLY OPENJSON entries scan, so it needs an index to be effective.
        try {
            await executeQuery(`
                IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes WHERE name = 'idx_handover_sheets_departmentId' AND object_id = OBJECT_ID('handover_sheets')
                )
                BEGIN
                    CREATE INDEX idx_handover_sheets_departmentId ON handover_sheets(departmentId)
                END
            `);
        } catch (e) {
            console.log("Failed to create idx_handover_sheets_departmentId:", e.message);
        }

        // Migration: Add index on date if missing. The Dojo Handover and 16-Day Monitoring
        // comparison charts both filter on hs.date before CROSS APPLY OPENJSON explodes entries,
        // so an index here bounds the pre-filter scan instead of scanning every sheet row.
        try {
            await executeQuery(`
                IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes WHERE name = 'idx_handover_sheets_date' AND object_id = OBJECT_ID('handover_sheets')
                )
                BEGIN
                    CREATE INDEX idx_handover_sheets_date ON handover_sheets(date)
                END
            `);
        } catch (e) {
            console.log("Failed to create idx_handover_sheets_date:", e.message);
        }
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM handover_sheets WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new HandoverSheet(rows[0]);
    }

    static async findSpecific(departmentId, sectionId = null, date = null, shift = null) {
        let query = "SELECT * FROM handover_sheets WHERE departmentId = ?";
        let params = [departmentId];
        if (sectionId) {
            query += " AND sectionId = ?";
            params.push(sectionId);
        } else {
            query += " AND sectionId IS NULL";
        }

        if (date) {
            query += " AND CAST(date AS DATE) = CAST(? AS DATE)";
            params.push(date);
        }

        if (shift) {
            query += " AND shift = ?";
            params.push(shift);
        } else {
            query += " AND shift IS NULL";
        }

        const [rows] = await executeQuery(query, params);
        if (rows.length === 0) return null;
        return new HandoverSheet(rows[0]);
    }

    // Keep for compatibility
    static async findByDepartmentId(departmentId) {
        return this.findSpecific(departmentId, null);
    }

    static async create(data) {
        const query = `
            INSERT INTO handover_sheets (departmentId, sectionId, shift, date, entries, signatures, metadata, createdBy, isSubmitted, submittedAt, remarksHistory)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const entriesStr = JSON.stringify(data.entries || []);
        const signaturesStr = JSON.stringify(data.signatures || {});
        const metadataStr = JSON.stringify(data.metadata || {});
        const remarksHistoryStr = JSON.stringify(data.remarksHistory || []);

        const [rows] = await executeQuery(query, [
            data.departmentId,
            data.sectionId || null,
            data.shift || null,
            data.date,
            entriesStr,
            signaturesStr,
            metadataStr,
            data.createdBy,
            data.isSubmitted ? 1 : 0,
            data.submittedAt || null,
            remarksHistoryStr
        ]);
        return new HandoverSheet({ ...data, id: rows[0].id });
    }

    async save() {
        const query = `
            UPDATE handover_sheets
            SET date = ?, sectionId = ?, shift = ?, entries = ?, signatures = ?, metadata = ?, updatedBy = ?, updatedAt = GETDATE(), isSubmitted = ?, submittedAt = ?, remarksHistory = ?
            WHERE id = ?
        `;
        const entriesStr = JSON.stringify(this.entries);
        const signaturesStr = JSON.stringify(this.signatures);
        const metadataStr = JSON.stringify(this.metadata);
        const remarksHistoryStr = JSON.stringify(this.remarksHistory || []);

        console.log(`[HandoverSheet Model] Saving sheet id=${this.id}, entries count=${this.entries.length}, isSubmitted=${this.isSubmitted}`);

        await executeQuery(query, [
            this.date,
            this.sectionId || null,
            this.shift || null,
            entriesStr,
            signaturesStr,
            metadataStr,
            this.updatedBy,
            this.isSubmitted ? 1 : 0,
            this.submittedAt || null,
            remarksHistoryStr,
            this.id
        ]);
    }
}

export default HandoverSheet;
