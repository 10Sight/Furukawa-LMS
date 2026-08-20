import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";

class TenCycleCheck {
    constructor(data) {
        this.id = data.id;
        this.studentId = data.studentId;

        // Header Info
        this.qualityEngineer = data.qualityEngineer || "";
        this.qualityEngineerSign = data.qualityEngineerSign || "";
        this.dojoEngineer = data.dojoEngineer || "";
        this.dojoEngineerSign = data.dojoEngineerSign || "";
        this.formType = data.formType || "form1"; // 'form1' (Checkbox) or 'form2' (Text)

        // Rows Data
        this.entries = typeof data.entries === 'string'
            ? JSON.parse(data.entries)
            : (data.entries || []);

        this.createdBy = data.createdBy;
        this.updatedBy = data.updatedBy;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        if (!await migrationHelper.tableExists('ten_cycle_checks')) {
            await executeQuery(`
                CREATE TABLE ten_cycle_checks (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    studentId INT NOT NULL,
                    qualityEngineer VARCHAR(255),
                    qualityEngineerSign VARCHAR(255),
                    dojoEngineer VARCHAR(255),
                    dojoEngineerSign VARCHAR(255),
                    formType VARCHAR(50) DEFAULT 'form1',
                    entries NVARCHAR(MAX),
                    createdBy VARCHAR(255),
                    updatedBy VARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT fk_student_tencycle FOREIGN KEY (studentId) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
        }

        // Migration: Add formType column if it doesn't exist
        await migrationHelper.ensureColumnExists('ten_cycle_checks', 'formType', "VARCHAR(50) DEFAULT 'form1'");
    }

    static async findByStudentId(studentId) {
        const [rows] = await executeQuery("SELECT * FROM ten_cycle_checks WHERE studentId = ?", [studentId]);
        if (rows.length === 0) return null;
        return new TenCycleCheck(rows[0]);
    }

    static async create(data) {
        const {
            studentId, qualityEngineer, qualityEngineerSign, dojoEngineer, dojoEngineerSign, formType, entries, createdBy
        } = data;

        const query = `
            INSERT INTO ten_cycle_checks 
            (studentId, qualityEngineer, qualityEngineerSign, dojoEngineer, dojoEngineerSign, formType, entries, createdBy)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            studentId,
            qualityEngineer,
            qualityEngineerSign,
            dojoEngineer,
            dojoEngineerSign,
            formType || 'form1',
            JSON.stringify(entries || []),
            createdBy
        ];

        const [rows] = await executeQuery(query, values);
        return { id: rows[0].id, ...data };
    }

    async save() {
        const query = `
            UPDATE ten_cycle_checks SET
            qualityEngineer = ?, qualityEngineerSign = ?, dojoEngineer = ?, dojoEngineerSign = ?, formType = ?, entries = ?, updatedBy = ?, updatedAt = GETDATE()
            WHERE id = ?
        `;

        const values = [
            this.qualityEngineer,
            this.qualityEngineerSign,
            this.dojoEngineer,
            this.dojoEngineerSign,
            this.formType,
            JSON.stringify(this.entries),
            this.updatedBy,
            this.id
        ];

        await executeQuery(query, values);
        return this;
    }
}

// Initialize
TenCycleCheck.init().catch(err => console.error("Failed to initialize TenCycleCheck table", err));

export default TenCycleCheck;
