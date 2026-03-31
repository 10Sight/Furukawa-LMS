import { executeQuery } from "../db/mssqlHelper.js";

class OperatorObservance {
    constructor(data) {
        this.id = data.id;
        this.studentId = data.studentId;
        this.lineName = data.lineName || "";
        this.processName = data.processName || "";
        this.level1Date = data.level1Date ? new Date(data.level1Date) : null;
        this.operatorNameCode = data.operatorNameCode || "";

        // Storing the complex table data as JSON
        this.observanceData = typeof data.observanceData === 'string'
            ? JSON.parse(data.observanceData)
            : (data.observanceData || {});

        this.checkedBy = data.checkedBy || "";
        this.verifiedBy = data.verifiedBy || "";

        // Revision history
        this.revHistory = typeof data.revHistory === 'string'
            ? JSON.parse(data.revHistory)
            : (data.revHistory || []);

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='operator_observances' and xtype='U')
            BEGIN
                CREATE TABLE operator_observances (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    studentId INT NOT NULL,
                    lineName VARCHAR(255),
                    processName VARCHAR(255),
                    level1Date DATETIME,
                    operatorNameCode VARCHAR(255),
                    observanceData NVARCHAR(MAX),
                    checkedBy VARCHAR(255),
                    verifiedBy VARCHAR(255),
                    revHistory NVARCHAR(MAX),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT fk_student_observance FOREIGN KEY (studentId) REFERENCES users(id) ON DELETE CASCADE
                )
            END
        `;
        await executeQuery(query);
    }

    static async findByStudentId(studentId) {
        const [rows] = await executeQuery("SELECT * FROM operator_observances WHERE studentId = ?", [studentId]);
        if (rows.length === 0) return null;
        return new OperatorObservance(rows[0]);
    }

    static async create(data) {
        const {
            studentId, lineName, processName, level1Date, operatorNameCode,
            observanceData, checkedBy, verifiedBy, revHistory
        } = data;

        const query = `
            INSERT INTO operator_observances 
            (studentId, lineName, processName, level1Date, operatorNameCode, observanceData, checkedBy, verifiedBy, revHistory)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            studentId,
            lineName,
            processName,
            level1Date ? new Date(level1Date) : null,
            operatorNameCode,
            JSON.stringify(observanceData || {}),
            checkedBy,
            verifiedBy,
            JSON.stringify(revHistory || [])
        ];

        const [rows] = await executeQuery(query, values);
        return { id: rows[0].id, ...data };
    }

    async save() {
        const query = `
            UPDATE operator_observances SET
            lineName = ?, processName = ?, level1Date = ?, operatorNameCode = ?,
            observanceData = ?, checkedBy = ?, verifiedBy = ?, revHistory = ?, updatedAt = GETDATE()
            WHERE id = ?
        `;

        const values = [
            this.lineName,
            this.processName,
            this.level1Date,
            this.operatorNameCode,
            JSON.stringify(this.observanceData),
            this.checkedBy,
            this.verifiedBy,
            JSON.stringify(this.revHistory),
            this.id
        ];

        await executeQuery(query, values);
        return this;
    }
}

// Initialize table
OperatorObservance.init().catch(err => console.error("Failed to initialize OperatorObservance table:", err));

export default OperatorObservance;
