import { executeQuery } from "../db/mssqlHelper.js";

class TenCycleSheet {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.formType = data.formType || "form1";
        this.createdDate = data.createdDate;
        this.qualityEngineer = data.qualityEngineer || "";
        this.qualityEngineerSign = data.qualityEngineerSign || "";
        this.dojoEngineer = data.dojoEngineer || "";
        this.dojoEngineerSign = data.dojoEngineerSign || "";
        this.entries = typeof data.entries === "string"
            ? JSON.parse(data.entries || "[]")
            : (data.entries || []);
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
                    formType NVARCHAR(50) DEFAULT 'form1',
                    createdDate DATE DEFAULT CAST(GETDATE() AS DATE),
                    qualityEngineer NVARCHAR(255),
                    qualityEngineerSign NVARCHAR(255),
                    dojoEngineer NVARCHAR(255),
                    dojoEngineerSign NVARCHAR(255),
                    entries NVARCHAR(MAX),
                    createdBy NVARCHAR(255),
                    updatedBy NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE
                );
                CREATE INDEX idx_ten_cycle_sheets_dept ON ten_cycle_sheets(departmentId);
            END
        `;
        await executeQuery(query);
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT TOP 1 * FROM ten_cycle_sheets WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new TenCycleSheet(rows[0]);
    }

    static async findByDepartmentId(departmentId) {
        const [rows] = await executeQuery(
            "SELECT * FROM ten_cycle_sheets WHERE departmentId = ? ORDER BY createdAt DESC, id DESC",
            [departmentId]
        );
        return rows.map((row) => new TenCycleSheet(row));
    }

    static async create(data) {
        const {
            departmentId,
            formType,
            qualityEngineer,
            qualityEngineerSign,
            dojoEngineer,
            dojoEngineerSign,
            entries,
            createdBy,
        } = data;

        const [rows] = await executeQuery(
            `INSERT INTO ten_cycle_sheets
             (departmentId, formType, qualityEngineer, qualityEngineerSign, dojoEngineer, dojoEngineerSign, entries, createdBy, updatedBy)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                departmentId,
                formType || "form1",
                qualityEngineer || "",
                qualityEngineerSign || "",
                dojoEngineer || "",
                dojoEngineerSign || "",
                JSON.stringify(entries || []),
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
            updatedBy,
        } = data;

        await executeQuery(
            `UPDATE ten_cycle_sheets
             SET formType = ?, qualityEngineer = ?, qualityEngineerSign = ?, dojoEngineer = ?, dojoEngineerSign = ?,
                 entries = ?, updatedBy = ?, updatedAt = GETDATE()
             WHERE id = ?`,
            [
                formType || "form1",
                qualityEngineer || "",
                qualityEngineerSign || "",
                dojoEngineer || "",
                dojoEngineerSign || "",
                JSON.stringify(entries || []),
                updatedBy || "",
                id,
            ]
        );

        return this.findById(id);
    }
}

TenCycleSheet.init().catch((err) => {
    console.error("Failed to initialize ten_cycle_sheets table:", err);
});

export default TenCycleSheet;
