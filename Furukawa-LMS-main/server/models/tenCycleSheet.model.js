import { executeQuery } from "../db/mssqlHelper.js";

class TenCycleSheet {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.sectionId = data.sectionId;
        this.lineId = data.lineId;
        this.subSectionId = data.subSectionId;
        this.formType = data.formType || "form1";
        this.createdDate = data.createdDate;
        this.qualityEngineer = data.qualityEngineer || "";
        this.qualityEngineerSign = data.qualityEngineerSign || "";
        this.dojoEngineer = data.dojoEngineer || "";
        this.dojoEngineerSign = data.dojoEngineerSign || "";
        this.entries = typeof data.entries === "string"
            ? JSON.parse(data.entries || "[]")
            : (data.entries || []);
        this.status = data.status || "Draft";
        this.checkedBy = data.checkedBy || "";
        this.verifiedBy = data.verifiedBy || "";
        this.verifiedStatus = data.verifiedStatus || "";
        this.verifiedAt = data.verifiedAt;
        this.reviewedBy = data.reviewedBy || "";
        this.reviewedStatus = data.reviewedStatus || "";
        this.reviewedAt = data.reviewedAt;
        this.createdBy = data.createdBy || "";
        this.updatedBy = data.updatedBy || "";
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ten_cycle_sheets')
            BEGIN
                CREATE TABLE ten_cycle_sheets (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId INT NOT NULL,
                    sectionId INT,
                    lineId INT,
                    subSectionId INT,
                    formType NVARCHAR(50) DEFAULT 'form1',
                    createdDate DATE DEFAULT CAST(GETDATE() AS DATE),
                    qualityEngineer NVARCHAR(255),
                    qualityEngineerSign NVARCHAR(255),
                    dojoEngineer NVARCHAR(255),
                    dojoEngineerSign NVARCHAR(255),
                    entries NVARCHAR(MAX),
                    status NVARCHAR(50) DEFAULT 'Draft',
                    checkedBy NVARCHAR(255),
                    verifiedBy NVARCHAR(255),
                    verifiedStatus NVARCHAR(50),
                    verifiedAt DATETIME,
                    reviewedBy NVARCHAR(255),
                    reviewedStatus NVARCHAR(50),
                    reviewedAt DATETIME,
                    createdBy NVARCHAR(255),
                    updatedBy NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE
                );
                CREATE INDEX idx_ten_cycle_sheets_dept ON ten_cycle_sheets(departmentId);
            END
            ELSE
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ten_cycle_sheets') AND name = 'sectionId')
                    ALTER TABLE ten_cycle_sheets ADD sectionId INT;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ten_cycle_sheets') AND name = 'lineId')
                    ALTER TABLE ten_cycle_sheets ADD lineId INT;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ten_cycle_sheets') AND name = 'subSectionId')
                    ALTER TABLE ten_cycle_sheets ADD subSectionId INT;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ten_cycle_sheets') AND name = 'status')
                    ALTER TABLE ten_cycle_sheets ADD status NVARCHAR(50) DEFAULT 'Draft';
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ten_cycle_sheets') AND name = 'checkedBy')
                    ALTER TABLE ten_cycle_sheets ADD checkedBy NVARCHAR(255);
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ten_cycle_sheets') AND name = 'verifiedBy')
                    ALTER TABLE ten_cycle_sheets ADD verifiedBy NVARCHAR(255);
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ten_cycle_sheets') AND name = 'verifiedStatus')
                    ALTER TABLE ten_cycle_sheets ADD verifiedStatus NVARCHAR(50);
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ten_cycle_sheets') AND name = 'verifiedAt')
                    ALTER TABLE ten_cycle_sheets ADD verifiedAt DATETIME;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ten_cycle_sheets') AND name = 'reviewedBy')
                    ALTER TABLE ten_cycle_sheets ADD reviewedBy NVARCHAR(255);
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ten_cycle_sheets') AND name = 'reviewedStatus')
                    ALTER TABLE ten_cycle_sheets ADD reviewedStatus NVARCHAR(50);
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ten_cycle_sheets') AND name = 'reviewedAt')
                    ALTER TABLE ten_cycle_sheets ADD reviewedAt DATETIME;
            END
        `;
        await executeQuery(query);
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT TOP 1 * FROM ten_cycle_sheets WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new TenCycleSheet(rows[0]);
    }

    static async findByFilters({ departmentId, sectionId, lineId, subSectionId } = {}) {
        let query = "SELECT * FROM ten_cycle_sheets WHERE 1=1";
        const params = [];

        if (departmentId) {
            query += " AND departmentId = ?";
            params.push(departmentId);
        }
        if (sectionId) {
            query += " AND sectionId = ?";
            params.push(sectionId);
        }
        if (lineId) {
            query += " AND lineId = ?";
            params.push(lineId);
        }
        if (subSectionId) {
            query += " AND subSectionId = ?";
            params.push(subSectionId);
        }

        query += " ORDER BY createdAt DESC, id DESC";
        const [rows] = await executeQuery(query, params);
        return rows.map((row) => new TenCycleSheet(row));
    }

    static async findByDepartmentId(departmentId) {
        return this.findByFilters({ departmentId });
    }

    static async create(data) {
        const {
            departmentId,
            sectionId,
            lineId,
            subSectionId,
            formType,
            qualityEngineer,
            qualityEngineerSign,
            dojoEngineer,
            dojoEngineerSign,
            entries,
            status,
            checkedBy,
            verifiedBy,
            verifiedStatus,
            verifiedAt,
            reviewedBy,
            reviewedStatus,
            reviewedAt,
            createdBy,
        } = data;

        const [rows] = await executeQuery(
            `INSERT INTO ten_cycle_sheets
             (departmentId, sectionId, lineId, subSectionId, formType, qualityEngineer, qualityEngineerSign, dojoEngineer, dojoEngineerSign, entries, status, checkedBy, verifiedBy, verifiedStatus, verifiedAt, reviewedBy, reviewedStatus, reviewedAt, createdBy, updatedBy)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                departmentId,
                sectionId || null,
                lineId || null,
                subSectionId || null,
                formType || "form1",
                qualityEngineer || "",
                qualityEngineerSign || "",
                dojoEngineer || "",
                dojoEngineerSign || "",
                JSON.stringify(entries || []),
                status || "Draft",
                checkedBy || "",
                verifiedBy || "",
                verifiedStatus || null,
                verifiedAt || null,
                reviewedBy || "",
                reviewedStatus || null,
                reviewedAt || null,
                createdBy || "",
                createdBy || "",
            ]
        );

        if (rows.length === 0) return null;
        return this.findById(rows[0].id);
    }

    static async updateById(id, data) {
        const {
            formType,
            qualityEngineer,
            qualityEngineerSign,
            dojoEngineer,
            dojoEngineerSign,
            entries,
            status,
            checkedBy,
            verifiedBy,
            verifiedStatus,
            verifiedAt,
            reviewedBy,
            reviewedStatus,
            reviewedAt,
            updatedBy,
        } = data;

        await executeQuery(
            `UPDATE ten_cycle_sheets
             SET formType = ?, qualityEngineer = ?, qualityEngineerSign = ?, dojoEngineer = ?, dojoEngineerSign = ?,
                 entries = ?, status = ?, checkedBy = ?, verifiedBy = ?, verifiedStatus = ?, verifiedAt = ?, reviewedBy = ?, reviewedStatus = ?, reviewedAt = ?,
                 updatedBy = ?, updatedAt = GETDATE()
             WHERE id = ?`,
            [
                formType || "form1",
                qualityEngineer || "",
                qualityEngineerSign || "",
                dojoEngineer || "",
                dojoEngineerSign || "",
                JSON.stringify(entries || []),
                status || "Draft",
                checkedBy || "",
                verifiedBy || "",
                verifiedStatus || null,
                verifiedAt || null,
                reviewedBy || "",
                reviewedStatus || null,
                reviewedAt || null,
                updatedBy || "",
                id,
            ]
        );

        return this.findById(id);
    }

    static async delete(id) {
        await executeQuery("DELETE FROM ten_cycle_sheets WHERE id = ?", [id]);
        return true;
    }
}

TenCycleSheet.init().catch((err) => {
    console.error("Failed to initialize ten_cycle_sheets table:", err);
});

export default TenCycleSheet;
