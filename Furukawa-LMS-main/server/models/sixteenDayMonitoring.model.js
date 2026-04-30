import { executeQuery } from "../db/mssqlHelper.js";

class SixteenDayMonitoring {
    constructor(data) {
        this.id = data.id;
        this.studentId = data.studentId;

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
        this.status = data.status || "Draft";
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sixteen_day_monitorings' and xtype='U')
            BEGIN
                CREATE TABLE sixteen_day_monitorings (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    studentId INT NOT NULL,
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
            END
            ELSE
            BEGIN
                -- Add checkedBy column if missing
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sixteen_day_monitorings') AND name = 'checkedBy')
                BEGIN
                    ALTER TABLE sixteen_day_monitorings ADD checkedBy VARCHAR(255);
                END
                -- Add verifiedBy column if missing
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sixteen_day_monitorings') AND name = 'verifiedBy')
                BEGIN
                    ALTER TABLE sixteen_day_monitorings ADD verifiedBy VARCHAR(255);
                END
                -- Add approvedBy column if missing
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sixteen_day_monitorings') AND name = 'approvedBy')
                BEGIN
                    ALTER TABLE sixteen_day_monitorings ADD approvedBy VARCHAR(255);
                END
                -- Add status column if missing
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sixteen_day_monitorings') AND name = 'status')
                BEGIN
                    ALTER TABLE sixteen_day_monitorings ADD status VARCHAR(50) DEFAULT 'Draft';
                END
            END
        `;
        await executeQuery(query);
    }

    static async findByStudentId(studentId) {
        const [rows] = await executeQuery("SELECT * FROM sixteen_day_monitorings WHERE studentId = ?", [studentId]);
        if (rows.length === 0) return null;
        return new SixteenDayMonitoring(rows[0]);
    }

    static async create(data) {
        const {
            studentId, employeeName, employeeCode, processName, dept,
            handoverDate, trgResult, workingWith, lineLeaderName,
            gridData, checkedBy, verifiedBy, approvedBy, createdBy, status
        } = data;

        const query = `
            INSERT INTO sixteen_day_monitorings 
            (studentId, employeeName, employeeCode, processName, dept, handoverDate, trgResult, workingWith, lineLeaderName, gridData, checkedBy, verifiedBy, approvedBy, createdBy, status)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            studentId,
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
            createdBy,
            status || "Draft"
        ];

        const [rows] = await executeQuery(query, values);
        return { id: rows[0].id, ...data };
    }

    async save() {
        const query = `
            UPDATE sixteen_day_monitorings SET
            employeeName = ?, employeeCode = ?, processName = ?, dept = ?, 
            handoverDate = ?, trgResult = ?, workingWith = ?, lineLeaderName = ?, 
            gridData = ?, checkedBy = ?, verifiedBy = ?, approvedBy = ?, status = ?, updatedBy = ?, updatedAt = GETDATE()
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
            this.status || "Draft",
            this.updatedBy,
            this.id
        ];

        await executeQuery(query, values);
        return this;
    }
}

// Initialize table
SixteenDayMonitoring.init().catch(err => console.error("Failed to initialize SixteenDayMonitoring table:", err));

export default SixteenDayMonitoring;
