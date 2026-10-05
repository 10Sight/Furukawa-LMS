import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";

class SixteenDayMonitoring {
    constructor(data) {
        this.id = data.id;
        this.studentId = data.studentId;
        this.attemptNumber = data.attemptNumber || 1;

        this.employeeName = data.employeeName || "";
        this.employeeCode = data.employeeCode || "";
        this.processName = data.processName || "";
        this.dept = data.dept || "";
        this.handoverDate = data.handoverDate || "";
        this.trgResult = data.trgResult || "";
        this.workingWith = data.workingWith || "";
        this.lineLeaderName = data.lineLeaderName || "";

        // All grid data stored as JSON
        this.gridData = typeof data.gridData === 'string'
            ? JSON.parse(data.gridData)
            : (data.gridData || {});

        this.createdBy = data.createdBy;
        this.updatedBy = data.updatedBy;
        this.checkedBy = data.checkedBy || "";
        this.verifiedBy = data.verifiedBy || "";
        this.approvedBy = data.approvedBy || "";
        this.verifiedByEduCell = data.verifiedByEduCell || "";
        this.status = data.status || "Draft";
        this.startDate = data.startDate || "";
        this.adminRemarksHistory = typeof data.adminRemarksHistory === 'string'
            ? JSON.parse(data.adminRemarksHistory)
            : (data.adminRemarksHistory || []);
        this.docNo = data.docNo;
        this.revNo = data.revNo;
        this.revDate = data.revDate;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        if (!await migrationHelper.tableExists('sixteen_day_monitorings')) {
            await executeQuery(`
                CREATE TABLE sixteen_day_monitorings (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    studentId INT NOT NULL,
                    attemptNumber INT DEFAULT 1,
                    employeeName VARCHAR(255),
                    employeeCode VARCHAR(255),
                    processName VARCHAR(255),
                    dept VARCHAR(255),
                    handoverDate VARCHAR(255),
                    trgResult VARCHAR(255),
                    workingWith VARCHAR(255),
                    lineLeaderName VARCHAR(255),
                    checkedBy VARCHAR(255),
                    verifiedBy VARCHAR(255),
                    approvedBy VARCHAR(255),
                    gridData NVARCHAR(MAX),
                    createdBy VARCHAR(255),
                    updatedBy VARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT fk_student_16day FOREIGN KEY (studentId) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
        } else {
            await migrationHelper.ensureColumnExists('sixteen_day_monitorings', 'checkedBy', 'VARCHAR(255)');
            await migrationHelper.ensureColumnExists('sixteen_day_monitorings', 'verifiedBy', 'VARCHAR(255)');
            await migrationHelper.ensureColumnExists('sixteen_day_monitorings', 'approvedBy', 'VARCHAR(255)');
            await migrationHelper.ensureColumnExists('sixteen_day_monitorings', 'status', "VARCHAR(50) DEFAULT 'Draft'");
            await migrationHelper.ensureColumnExists('sixteen_day_monitorings', 'attemptNumber', 'INT DEFAULT 1');
            await migrationHelper.ensureColumnExists('sixteen_day_monitorings', 'startDate', 'VARCHAR(255)');
            await migrationHelper.ensureColumnExists('sixteen_day_monitorings', 'adminRemarksHistory', 'NVARCHAR(MAX)');
            await migrationHelper.ensureColumnExists('sixteen_day_monitorings', 'verifiedByEduCell', 'VARCHAR(255)');
            // Doc/revision snapshot: frozen at creation from the Revision Table.
            await migrationHelper.ensureColumnExists('sixteen_day_monitorings', 'docNo', 'VARCHAR(255) NULL');
            await migrationHelper.ensureColumnExists('sixteen_day_monitorings', 'revNo', 'VARCHAR(255) NULL');
            await migrationHelper.ensureColumnExists('sixteen_day_monitorings', 'revDate', 'VARCHAR(255) NULL');
        }

        // Index for the Admin Home "16-Day Monitoring Comparison" chart, which filters and
        // groups by status + updatedAt before joining users — without it the query full-scans.
        try {
            await migrationHelper.ensureIndexExists(
                'sixteen_day_monitorings',
                'idx_sixteen_day_monitorings_status_updatedAt',
                'CREATE INDEX idx_sixteen_day_monitorings_status_updatedAt ON sixteen_day_monitorings(status, updatedAt)'
            );
        } catch (e) {
            console.error("Failed to create idx_sixteen_day_monitorings_status_updatedAt:", e.message);
        }
    }

    static async findByStudentId(studentId) {
        // Return the LATEST attempt
        const [rows] = await executeQuery("SELECT TOP 1 * FROM sixteen_day_monitorings WHERE studentId = ? ORDER BY attemptNumber DESC, createdAt DESC", [studentId]);
        if (rows.length === 0) return null;
        return new SixteenDayMonitoring(rows[0]);
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM sixteen_day_monitorings WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new SixteenDayMonitoring(rows[0]);
    }

    static async findAllByStudentId(studentId) {
        const [rows] = await executeQuery("SELECT * FROM sixteen_day_monitorings WHERE studentId = ? ORDER BY attemptNumber DESC, createdAt DESC", [studentId]);
        return rows.map(r => new SixteenDayMonitoring(r));
    }

    static async create(data) {
        const {
            studentId, attemptNumber, employeeName, employeeCode, processName, dept,
            handoverDate, trgResult, workingWith, lineLeaderName,
            gridData, checkedBy, verifiedBy, approvedBy, verifiedByEduCell, createdBy, status, startDate,
            adminRemarksHistory, docNo, revNo, revDate
        } = data;

        const query = `
            INSERT INTO sixteen_day_monitorings
            (studentId, attemptNumber, employeeName, employeeCode, processName, dept, handoverDate, trgResult, workingWith, lineLeaderName, gridData, checkedBy, verifiedBy, approvedBy, verifiedByEduCell, createdBy, status, startDate, adminRemarksHistory, docNo, revNo, revDate)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            studentId,
            attemptNumber || 1,
            employeeName,
            employeeCode,
            processName,
            dept,
            handoverDate,
            trgResult,
            workingWith,
            lineLeaderName,
            JSON.stringify(gridData || {}),
            checkedBy || "",
            verifiedBy || "",
            approvedBy || "",
            verifiedByEduCell || "",
            createdBy,
            status || "Draft",
            startDate || "",
            Array.isArray(adminRemarksHistory) ? JSON.stringify(adminRemarksHistory) : (adminRemarksHistory || "[]"),
            docNo || null,
            revNo || null,
            revDate || null
        ];

        const [rows] = await executeQuery(query, values);
        return { id: rows[0].id, ...data };
    }

    async save() {
        const query = `
            UPDATE sixteen_day_monitorings SET
            employeeName = ?, employeeCode = ?, processName = ?, dept = ?, 
            handoverDate = ?, trgResult = ?, workingWith = ?, lineLeaderName = ?, 
            gridData = ?, checkedBy = ?, verifiedBy = ?, approvedBy = ?, verifiedByEduCell = ?, status = ?, attemptNumber = ?, startDate = ?, updatedBy = ?, adminRemarksHistory = ?, updatedAt = GETDATE()
            WHERE id = ?
        `;

        const values = [
            this.employeeName,
            this.employeeCode,
            this.processName,
            this.dept,
            this.handoverDate,
            this.trgResult,
            this.workingWith,
            this.lineLeaderName,
            JSON.stringify(this.gridData),
            this.checkedBy,
            this.verifiedBy,
            this.approvedBy,
            this.verifiedByEduCell || "",
            this.status || "Draft",
            this.attemptNumber,
            this.startDate || "",
            this.updatedBy,
            Array.isArray(this.adminRemarksHistory) ? JSON.stringify(this.adminRemarksHistory) : (this.adminRemarksHistory || "[]"),
            this.id
        ];

        await executeQuery(query, values);
        return this;
    }
}

// Initialize table
SixteenDayMonitoring.init().catch(err => console.error("Failed to initialize SixteenDayMonitoring table:", err));

export default SixteenDayMonitoring;
