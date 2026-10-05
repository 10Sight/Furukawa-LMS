import { poolPromise, mssql as sql } from "../db/connectDB.js";
import { formatLocalDate } from "../utils/istDate.util.js";
import migrationHelper from "../db/migrationHelper.js";

class AttendanceLog {
    constructor(data) {
        this.id = data.id;
        this.userId = data.userId;
        this.payCode = data.payCode;
        this.cardNo = data.cardNo;
        this.employeeName = data.employeeName;
        this.date = data.date instanceof Date
            ? formatLocalDate(data.date)
            : (data.date || null);
        this.department = data.department;
        this.designation = data.designation;
        this.shift = data.shift;
        this.startTime = data.startTime;
        this.inTime = data.inTime;
        this.outTime = data.outTime;
        this.hrsWorked = data.hrsWorked;
        this.status = data.status;
        this.lateArrival = data.lateArrival;
        this.earlyDeparture = data.earlyDeparture;
        this.otHrs = data.otHrs;
        this.otAmount = data.otAmount;
        this.updatedBy = data.updatedBy;
        this.updatedByRole = data.updatedByRole;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        try {
            if (!await migrationHelper.tableExists('attendance_logs')) {
                const query = `
                    CREATE TABLE attendance_logs (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        userId INT NOT NULL,
                        payCode NVARCHAR(50),
                        cardNo NVARCHAR(50),
                        employeeName NVARCHAR(255),
                        [date] DATE NOT NULL,
                        department NVARCHAR(100),
                        designation NVARCHAR(100),
                        shift NVARCHAR(50),
                        startTime TIME,
                        inTime TIME,
                        outTime TIME,
                        hrsWorked DECIMAL(5,2),
                        status NVARCHAR(20) CHECK (status IN ('Present', 'Absent', 'Late', 'Half Day', 'Holiday')) NOT NULL,
                        lateArrival DECIMAL(5,2) DEFAULT 0,
                        earlyDeparture DECIMAL(5,2) DEFAULT 0,
                        otHrs DECIMAL(5,2) DEFAULT 0,
                        otAmount DECIMAL(10,2) DEFAULT 0,
                        updatedBy INT,
                        updatedByRole NVARCHAR(50),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        CONSTRAINT FK_Attendance_Users FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
                        CONSTRAINT UC_User_Date UNIQUE (userId, [date])
                    )
                `;
                const pool = await poolPromise;
                await pool.query(query);
                console.log("AttendanceLog table initialized in MSSQL.");
            }

            // Create indexes for payCode and date columns to optimize queries
            await migrationHelper.ensureIndexExists('attendance_logs', 'idx_attendance_logs_payCode',
                'CREATE INDEX idx_attendance_logs_payCode ON attendance_logs(payCode)');
            await migrationHelper.ensureIndexExists('attendance_logs', 'idx_attendance_logs_date',
                'CREATE INDEX idx_attendance_logs_date ON attendance_logs([date])');
            // The getAllStudents/getAllUsers attendance join does
            // WHERE [date] BETWEEN ? AND ? GROUP BY userId; this composite lets it seek the
            // date range and aggregate without a full scan, alongside the single-column index above.
            await migrationHelper.ensureIndexExists('attendance_logs', 'idx_attendance_logs_date_userId',
                'CREATE INDEX idx_attendance_logs_date_userId ON attendance_logs([date], userId)');
            console.log("Indexes checked/created for attendance_logs.");
        } catch (err) {
            console.error("Table Init Error:", err);
        }
    }

    static async create(logData) {
        const pool = await poolPromise;
        const request = pool.request();

        // Dynamically build inputs for mssql
        Object.keys(logData).forEach(key => {
            request.input(key, logData[key]);
        });

        const columns = Object.keys(logData).join(", ");
        const placeholders = Object.keys(logData).map(key => `@${key}`).join(", ");

        const query = `INSERT INTO attendance_logs (${columns}) OUTPUT INSERTED.* VALUES (${placeholders})`;
        const result = await request.query(query);
        return new AttendanceLog(result.recordset[0]);
    }

    static async upsert(logData, adminId, adminRole) {
        const pool = await poolPromise;
        const request = pool.request();

        // Set up parameters
        const data = {
            ...logData,
            updatedBy: adminId,
            updatedByRole: adminRole
        };

        Object.keys(data).forEach(key => {
            request.input(key, data[key]);
        });

        const query = `
            MERGE attendance_logs AS target
            USING (SELECT @userId AS userId, @date AS [date]) AS source
            ON (target.userId = source.userId AND target.[date] = source.[date])
            WHEN MATCHED THEN
                UPDATE SET 
                    payCode = @payCode,
                    cardNo = @cardNo,
                    employeeName = @employeeName,
                    department = @department,
                    designation = @designation,
                    shift = @shift,
                    startTime = @startTime,
                    inTime = @inTime,
                    outTime = @outTime,
                    hrsWorked = @hrsWorked,
                    status = @status,
                    lateArrival = @lateArrival,
                    earlyDeparture = @earlyDeparture,
                    otHrs = @otHrs,
                    otAmount = @otAmount,
                    updatedBy = @updatedBy,
                    updatedByRole = @updatedByRole,
                    updatedAt = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (userId, payCode, cardNo, employeeName, [date], department, designation, shift, startTime, inTime, outTime, hrsWorked, status, lateArrival, earlyDeparture, otHrs, otAmount, updatedBy, updatedByRole)
                VALUES (@userId, @payCode, @cardNo, @employeeName, @date, @department, @designation, @shift, @startTime, @inTime, @outTime, @hrsWorked, @status, @lateArrival, @earlyDeparture, @otHrs, @otAmount, @updatedBy, @updatedByRole)
            OUTPUT INSERTED.*;
        `;

        const result = await request.query(query);
        return new AttendanceLog(result.recordset[0]);
    }

    static async findByUserId(userId) {
        const pool = await poolPromise;
        const request = pool.request();
        request.input('userId', sql.Int, userId);
        const result = await request.query("SELECT * FROM attendance_logs WHERE userId = @userId ORDER BY [date] DESC");
        return result.recordset.map(row => new AttendanceLog(row));
    }

    static async getFullReport(startDate, endDate) {
        const pool = await poolPromise;
        const request = pool.request();
        request.input('start', sql.Date, startDate);
        request.input('end', sql.Date, endDate);
        const result = await request.query("SELECT * FROM attendance_logs WHERE [date] BETWEEN @start AND @end ORDER BY [date] ASC");
        return result.recordset.map(row => new AttendanceLog(row));
    }
}

// Initialize
AttendanceLog.init();

export default AttendanceLog;