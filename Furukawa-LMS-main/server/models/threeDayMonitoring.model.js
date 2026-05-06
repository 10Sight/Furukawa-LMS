import { executeQuery } from "../db/mssqlHelper.js";

class ThreeDayMonitoring {
    constructor(data) {
        this.id = data.id;
        this.studentId = data.studentId;
        this.attemptNumber = data.attemptNumber || 1;

        this.processName = data.processName || "";
        this.lineName = data.lineName || "";

        // Main Table Data (Day 1, 2, 3 scores)
        // Structure: { sectionName: { rowId: { day1: [], day2: [], day3: [] } } }
        this.entries = typeof data.entries === 'string'
            ? JSON.parse(data.entries)
            : (data.entries || {});

        // Summary / Evaluation Data
        this.evaluation = typeof data.evaluation === 'string'
            ? JSON.parse(data.evaluation)
            : (data.evaluation || {});

        this.checkedBy = data.checkedBy || "";
        this.verifiedBy = data.verifiedBy || "";
        this.approvedBy = data.approvedBy || "";
        this.status = data.status || "Draft";

        this.createdBy = data.createdBy;
        this.updatedBy = data.updatedBy;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='three_day_monitorings' and xtype='U')
            BEGIN
                CREATE TABLE three_day_monitorings (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    studentId INT NOT NULL,
                    attemptNumber INT DEFAULT 1,
                    processName VARCHAR(255),
                    lineName VARCHAR(255),
                    entries NVARCHAR(MAX),
                    evaluation NVARCHAR(MAX),
                    status VARCHAR(50) DEFAULT 'Draft',
                    checkedBy VARCHAR(255),
                    verifiedBy VARCHAR(255),
                    approvedBy VARCHAR(255),
                    createdBy VARCHAR(255),
                    updatedBy VARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT fk_student_3day FOREIGN KEY (studentId) REFERENCES users(id) ON DELETE CASCADE
                )
            END
            ELSE
            BEGIN
                -- Add status column if missing
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('three_day_monitorings') AND name = 'status')
                BEGIN
                    ALTER TABLE three_day_monitorings ADD status VARCHAR(50) DEFAULT 'Draft';
                END
                -- Add attemptNumber column if missing
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('three_day_monitorings') AND name = 'attemptNumber')
                BEGIN
                    ALTER TABLE three_day_monitorings ADD attemptNumber INT DEFAULT 1;
                END
            END
        `;
        await executeQuery(query);
    }

    static async findByStudentId(studentId) {
        // Return the LATEST attempt
        const [rows] = await executeQuery("SELECT TOP 1 * FROM three_day_monitorings WHERE studentId = ? ORDER BY attemptNumber DESC, createdAt DESC", [studentId]);
        if (rows.length === 0) return null;
        return new ThreeDayMonitoring(rows[0]);
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM three_day_monitorings WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new ThreeDayMonitoring(rows[0]);
    }

    static async findAllByStudentId(studentId) {
        const [rows] = await executeQuery("SELECT * FROM three_day_monitorings WHERE studentId = ? ORDER BY attemptNumber DESC, createdAt DESC", [studentId]);
        return rows.map(r => new ThreeDayMonitoring(r));
    }

    static async create(data) {
        const {
            studentId, attemptNumber, processName, lineName, entries, evaluation,
            checkedBy, verifiedBy, approvedBy, status, createdBy
        } = data;

        const query = `
            INSERT INTO three_day_monitorings 
            (studentId, attemptNumber, processName, lineName, entries, evaluation, checkedBy, verifiedBy, approvedBy, status, createdBy)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            studentId,
            attemptNumber || 1,
            processName,
            lineName,
            JSON.stringify(entries || {}),
            JSON.stringify(evaluation || {}),
            checkedBy,
            verifiedBy,
            approvedBy,
            status || "Draft",
            createdBy
        ];

        const [rows] = await executeQuery(query, values);
        return { id: rows[0].id, ...data };
    }

    async save() {
        const query = `
            UPDATE three_day_monitorings SET
            processName = ?, lineName = ?, entries = ?, evaluation = ?, 
            checkedBy = ?, verifiedBy = ?, approvedBy = ?, status = ?, attemptNumber = ?, updatedBy = ?, updatedAt = GETDATE()
            WHERE id = ?
        `;

        const values = [
            this.processName,
            this.lineName,
            JSON.stringify(this.entries),
            JSON.stringify(this.evaluation),
            this.checkedBy,
            this.verifiedBy,
            this.approvedBy,
            this.status || "Draft",
            this.attemptNumber,
            this.updatedBy,
            this.id
        ];

        await executeQuery(query, values);
        return this;
    }
}

// Initialize table
ThreeDayMonitoring.init().catch(err => console.error("Failed to initialize ThreeDayMonitoring table:", err));

export default ThreeDayMonitoring;
