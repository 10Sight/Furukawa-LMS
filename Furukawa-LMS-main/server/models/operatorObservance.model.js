import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";

class OperatorObservance {
    constructor(data) {
        this.id = data.id;
        this.studentId = data.studentId;
        this.lineName = data.lineName || "";
        this.processName = data.processName || "";
        this.level1Date = data.level1Date ? new Date(data.level1Date) : null;
        this.level2Date = data.level2Date ? new Date(data.level2Date) : null;
        this.operatorNameCode = data.operatorNameCode || "";

        // Storing the complex table data as JSON
        this.observanceData = typeof data.observanceData === 'string'
            ? JSON.parse(data.observanceData)
            : (data.observanceData || {});

        this.checkedBy = data.checkedBy || "";
        this.verifiedBy = data.verifiedBy || "";
        this.preparedBy = data.preparedBy || "";
        this.status = data.status || "Draft";

        // Revision history
        this.revHistory = typeof data.revHistory === 'string'
            ? JSON.parse(data.revHistory)
            : (data.revHistory || []);

        this.docNo = data.docNo;
        this.revNo = data.revNo;
        this.revDate = data.revDate;

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        if (!await migrationHelper.tableExists('operator_observances')) {
            await executeQuery(`
                CREATE TABLE operator_observances (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    studentId INT NOT NULL,
                    lineName VARCHAR(255),
                    processName VARCHAR(255),
                    level1Date DATETIME,
                    level2Date DATETIME,
                    operatorNameCode VARCHAR(255),
                    observanceData NVARCHAR(MAX),
                    checkedBy VARCHAR(255),
                    verifiedBy VARCHAR(255),
                    preparedBy VARCHAR(255),
                    status VARCHAR(50) DEFAULT 'Draft',
                    revHistory NVARCHAR(MAX),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT fk_student_observance FOREIGN KEY (studentId) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
        } else {
            await migrationHelper.ensureColumnExists('operator_observances', 'preparedBy', 'VARCHAR(255) NULL');
            await migrationHelper.ensureColumnExists('operator_observances', 'status', 'VARCHAR(50) NULL');
            // Doc/revision snapshot: frozen at creation from the Revision Table.
            await migrationHelper.ensureColumnExists('operator_observances', 'docNo', 'VARCHAR(255) NULL');
            await migrationHelper.ensureColumnExists('operator_observances', 'revNo', 'VARCHAR(255) NULL');
            await migrationHelper.ensureColumnExists('operator_observances', 'revDate', 'VARCHAR(255) NULL');
            await migrationHelper.ensureColumnExists('operator_observances', 'level2Date', 'DATETIME NULL');
        }

        await migrationHelper.ensureIndexExists(
            'operator_observances',
            'idx_operator_observances_studentId',
            'CREATE INDEX idx_operator_observances_studentId ON operator_observances(studentId)'
        );
    }

    static async findByStudentId(studentId) {
        const [rows] = await executeQuery("SELECT * FROM operator_observances WHERE studentId = ?", [studentId]);
        if (rows.length === 0) return null;
        return new OperatorObservance(rows[0]);
    }

    static async create(data) {
        const {
            studentId, lineName, processName, level1Date, level2Date, operatorNameCode,
            observanceData, checkedBy, verifiedBy, preparedBy, status, revHistory,
            docNo, revNo, revDate
        } = data;

        const query = `
            INSERT INTO operator_observances
            (studentId, lineName, processName, level1Date, level2Date, operatorNameCode, observanceData, checkedBy, verifiedBy, preparedBy, status, revHistory, docNo, revNo, revDate)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            studentId,
            lineName,
            processName,
            level1Date ? new Date(level1Date) : null,
            level2Date ? new Date(level2Date) : null,
            operatorNameCode,
            JSON.stringify(observanceData || {}),
            checkedBy,
            verifiedBy,
            preparedBy,
            status || "Draft",
            JSON.stringify(revHistory || []),
            docNo || null,
            revNo || null,
            revDate || null
        ];

        const [rows] = await executeQuery(query, values);
        return { id: rows[0].id, ...data };
    }

    async save() {
        const query = `
            UPDATE operator_observances SET
            lineName = ?, processName = ?, level1Date = ?, level2Date = ?, operatorNameCode = ?,
            observanceData = ?, checkedBy = ?, verifiedBy = ?, preparedBy = ?, status = ?, revHistory = ?, updatedAt = GETDATE()
            WHERE id = ?
        `;

        const values = [
            this.lineName,
            this.processName,
            this.level1Date,
            this.level2Date,
            this.operatorNameCode,
            JSON.stringify(this.observanceData),
            this.checkedBy,
            this.verifiedBy,
            this.preparedBy,
            this.status || "Draft",
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
