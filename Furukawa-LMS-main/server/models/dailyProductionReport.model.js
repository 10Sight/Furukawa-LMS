import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class DailyProductionReport {
    constructor(data) {
        this.id = data.id;
        this.date = data.date;
        this.department = data.department || data.department_id;
        this.line = data.line || data.line_id;
        this.shift = data.shift;
        this.leaderName = data.leaderName;

        this.delivery = typeof data.delivery === 'string'
            ? JSON.parse(data.delivery)
            : (data.delivery || []);

        this.quality = typeof data.quality === 'string'
            ? JSON.parse(data.quality)
            : (data.quality || {});

        this.downTime = typeof data.downTime === 'string'
            ? JSON.parse(data.downTime)
            : (data.downTime || {});

        this.shiftCommunication = typeof data.shiftCommunication === 'string'
            ? JSON.parse(data.shiftCommunication)
            : (data.shiftCommunication || []);

        this.moral = typeof data.moral === 'string'
            ? JSON.parse(data.moral)
            : (data.moral || []);

        this.directEfficiency = typeof data.directEfficiency === 'string'
            ? JSON.parse(data.directEfficiency)
            : (data.directEfficiency || {});

        this.customerEndDefectDetails = typeof data.customerEndDefectDetails === 'string'
            ? JSON.parse(data.customerEndDefectDetails)
            : (data.customerEndDefectDetails || []);

        this.internalDefectDetails = typeof data.internalDefectDetails === 'string'
            ? JSON.parse(data.internalDefectDetails)
            : (data.internalDefectDetails || []);

        this.manpowerAttendance = typeof data.manpowerAttendance === 'string'
            ? JSON.parse(data.manpowerAttendance)
            : (data.manpowerAttendance || []);

        this.kaizenDetails = typeof data.kaizenDetails === 'string'
            ? JSON.parse(data.kaizenDetails)
            : (data.kaizenDetails || []);

        this.madeBy = data.madeBy;
        this.checkedBy = data.checkedBy;

        this.isSubmitted = data.isSubmitted === true || data.isSubmitted === 1;
        this.submittedBy = data.submittedBy;
        this.status = data.status || 'DRAFT';
        this.checkedByUserId = data.checkedByUserId;

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='daily_production_reports' and xtype='U')
            BEGIN
                CREATE TABLE daily_production_reports (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    date DATE NOT NULL,
                    department_id INT NOT NULL,
                    line_id INT NOT NULL,
                    shift VARCHAR(50) NOT NULL,
                    leaderName VARCHAR(255),
                    delivery NVARCHAR(MAX),
                    quality NVARCHAR(MAX),
                    downTime NVARCHAR(MAX),
                    shiftCommunication NVARCHAR(MAX),
                    moral NVARCHAR(MAX),
                    directEfficiency NVARCHAR(MAX),
                    customerEndDefectDetails NVARCHAR(MAX),
                    internalDefectDetails NVARCHAR(MAX),
                    manpowerAttendance NVARCHAR(MAX),
                    kaizenDetails NVARCHAR(MAX),
                    madeBy VARCHAR(255),
                    checkedBy VARCHAR(255),
                    isSubmitted BIT DEFAULT 0,
                    submittedBy INT,
                    status VARCHAR(20) DEFAULT 'DRAFT',
                    checkedByUserId INT,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT uq_daily_report UNIQUE (date, department_id, line_id, shift)
                )
            END

            -- Migration: Add columns if they don't exist
            IF EXISTS (SELECT * FROM sysobjects WHERE name='daily_production_reports' and xtype='U')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('daily_production_reports') AND name = 'isSubmitted')
                BEGIN
                    ALTER TABLE daily_production_reports ADD isSubmitted BIT DEFAULT 0;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('daily_production_reports') AND name = 'submittedBy')
                BEGIN
                    ALTER TABLE daily_production_reports ADD submittedBy INT;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('daily_production_reports') AND name = 'status')
                BEGIN
                    ALTER TABLE daily_production_reports ADD status VARCHAR(20) DEFAULT 'DRAFT';
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('daily_production_reports') AND name = 'checkedByUserId')
                BEGIN
                    ALTER TABLE daily_production_reports ADD checkedByUserId INT;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('daily_production_reports') AND name = 'customerEndDefectDetails')
                BEGIN
                    ALTER TABLE daily_production_reports ADD customerEndDefectDetails NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('daily_production_reports') AND name = 'internalDefectDetails')
                BEGIN
                    ALTER TABLE daily_production_reports ADD internalDefectDetails NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('daily_production_reports') AND name = 'manpowerAttendance')
                BEGIN
                    ALTER TABLE daily_production_reports ADD manpowerAttendance NVARCHAR(MAX);
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('daily_production_reports') AND name = 'kaizenDetails')
                BEGIN
                    ALTER TABLE daily_production_reports ADD kaizenDetails NVARCHAR(MAX);
                END
            END
        `;
        try {
            await executeQuery(query);
        } catch (error) {
            logger.error("Failed to initialize daily_production_reports table", error);
        }
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        const whereClause = keys.map(key => {
            if (key === 'department') return `department_id = ?`;
            if (key === 'line') return `line_id = ?`;
            return `${key} = ?`;
        }).join(" AND ");

        const values = keys.map(key => query[key]);

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM daily_production_reports WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new DailyProductionReport(rows[0]);
    }

    static async findAll(filters = {}) {
        let query = `
            SELECT r.*, d.name as departmentName, l.name as lineName 
            FROM daily_production_reports r
            LEFT JOIN departments d ON r.department_id = d.id
            LEFT JOIN lines l ON r.line_id = l.id
            WHERE 1=1
        `;
        const values = [];

        if (filters.startDate) {
            query += ` AND r.date >= ?`;
            values.push(filters.startDate);
        }
        if (filters.endDate) {
            query += ` AND r.date <= ?`;
            values.push(filters.endDate);
        }
        if (filters.departmentId && filters.departmentId !== 'all') {
            query += ` AND r.department_id = ?`;
            values.push(filters.departmentId);
        }
        if (filters.lineId && filters.lineId !== 'all') {
            query += ` AND r.line_id = ?`;
            values.push(filters.lineId);
        }
        if (filters.shift && filters.shift !== 'all') {
            query += ` AND r.shift = ?`;
            values.push(filters.shift);
        }

        query += ` ORDER BY r.date DESC, r.createdAt DESC`;

        const [rows] = await executeQuery(query, values);
        return rows.map(row => new DailyProductionReport(row));
    }

    static async delete(id) {
        return await executeQuery(`DELETE FROM daily_production_reports WHERE id = ?`, [id]);
    }

    static async upsert(data) {
        // Check if the record exists first
        const existing = await DailyProductionReport.findOne({
            date: data.date,
            department: data.department,
            line: data.line,
            shift: data.shift
        });

        const jsonValues = {
            delivery: JSON.stringify(data.delivery || []),
            quality: JSON.stringify(data.quality || {}),
            downTime: JSON.stringify(data.downTime || {}),
            shiftCommunication: JSON.stringify(data.shiftCommunication || []),
            moral: JSON.stringify(data.moral || []),
            directEfficiency: JSON.stringify(data.directEfficiency || {}),
            customerEndDefectDetails: JSON.stringify(data.customerEndDefectDetails || []),
            internalDefectDetails: JSON.stringify(data.internalDefectDetails || []),
            manpowerAttendance: JSON.stringify(data.manpowerAttendance || []),
            kaizenDetails: JSON.stringify(data.kaizenDetails || [])
        };

        if (existing) {
            // UPDATE
            await executeQuery(`
                UPDATE daily_production_reports
                SET leaderName = ?, delivery = ?, quality = ?, downTime = ?, shiftCommunication = ?,
                    moral = ?, directEfficiency = ?, customerEndDefectDetails = ?, internalDefectDetails = ?,
                    manpowerAttendance = ?, kaizenDetails = ?, madeBy = ?, checkedBy = ?, 
                    isSubmitted = ?, submittedBy = ?, status = ?, checkedByUserId = ?, updatedAt = GETDATE()
                WHERE date = ? AND department_id = ? AND line_id = ? AND shift = ?
            `, [
                data.leaderName || null,
                jsonValues.delivery, jsonValues.quality, jsonValues.downTime,
                jsonValues.shiftCommunication, jsonValues.moral, jsonValues.directEfficiency,
                jsonValues.customerEndDefectDetails, jsonValues.internalDefectDetails,
                jsonValues.manpowerAttendance, jsonValues.kaizenDetails,
                data.madeBy || null, data.checkedBy || null,
                data.isSubmitted ? 1 : 0, data.submittedBy || null,
                data.status || 'DRAFT', data.checkedByUserId || null,
                data.date, data.department, data.line, data.shift
            ]);
        } else {
            // INSERT
            await executeQuery(`
                INSERT INTO daily_production_reports
                (date, department_id, line_id, shift, leaderName, delivery, quality, downTime, shiftCommunication, moral, directEfficiency, customerEndDefectDetails, internalDefectDetails, manpowerAttendance, kaizenDetails, madeBy, checkedBy, isSubmitted, submittedBy, status, checkedByUserId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                data.date, data.department, data.line, data.shift,
                data.leaderName || null,
                jsonValues.delivery, jsonValues.quality, jsonValues.downTime,
                jsonValues.shiftCommunication, jsonValues.moral, jsonValues.directEfficiency,
                jsonValues.customerEndDefectDetails, jsonValues.internalDefectDetails,
                jsonValues.manpowerAttendance, jsonValues.kaizenDetails,
                data.madeBy || null, data.checkedBy || null,
                data.isSubmitted ? 1 : 0, data.submittedBy || null,
                data.status || 'DRAFT', data.checkedByUserId || null
            ]);
        }

        return DailyProductionReport.findOne({
            date: data.date,
            department: data.department,
            line: data.line,
            shift: data.shift
        });
    }

    static async getManpowerStats(date, shift, subSectionIds) {
        if (!subSectionIds || subSectionIds.length === 0) return [];

        const formattedDate = new Date(date).toISOString().split('T')[0];
        const shiftParam = shift === 'all' ? 'all' : shift;

        const query = `
            SELECT 
                ss.id as subSectionId,
                ss.name as subSectionName,
                (
                    SELECT COUNT(DISTINCT ma.user_id) 
                    FROM machine_assignments ma 
                    JOIN machines m ON ma.machine_id = m.id 
                    WHERE m.subSectionId = ss.id
                ) as totalCount,
                (
                    SELECT COUNT(DISTINCT ma.user_id) 
                    FROM machine_assignments ma 
                    JOIN machines m ON ma.machine_id = m.id 
                    WHERE m.subSectionId = ss.id
                    AND EXISTS (
                        SELECT 1 FROM attendance_logs al 
                        JOIN users u ON ma.user_id = u.id
                        WHERE (al.userId = u.id OR (u.empId IS NOT NULL AND LTRIM(RTRIM(al.payCode)) = LTRIM(RTRIM(u.empId))))
                        AND CAST(al.[date] AS DATE) = CAST(? AS DATE)
                        AND LTRIM(RTRIM(al.status)) = 'Present'
                        AND (LTRIM(RTRIM(al.shift)) = ? OR ? = 'all')
                    )
                ) as presentCount
            FROM [sub_sections] ss
            WHERE ss.id IN (?)
        `;

        // Parameters: date, shift, shift (for present), subSectionIds array (expanded by helper)
        const params = [
            formattedDate, shiftParam, shiftParam,
            subSectionIds
        ];

        const [rows] = await executeQuery(query, params);

        return rows.map(row => ({
            ...row,
            absentCount: Math.max(0, (row.totalCount || 0) - (row.presentCount || 0))
        }));
    }

    static async getBatchMachineAssignments(machineIds, date, shift) {
        if (!machineIds || machineIds.length === 0) return {};

        const placeholders = machineIds.map(() => "?").join(",");
        const formattedDate = new Date(date).toISOString().split('T')[0];
        const shiftParam = shift === 'all' ? 'all' : shift;

        const query = `
            SELECT 
                ma.machine_id as machineId,
                u.id as userId,
                u.fullName,
                u.empId,
                u.departmentId,
                u.sectionId,
                u.lineId,
                u.subSectionId,
                u.currentLevel,
                d.name as departmentName,
                s.name as sectionName,
                l.name as lineName,
                ss.name as subSectionName,
                m.name as stationName,
                CASE WHEN al.status IS NOT NULL AND LTRIM(RTRIM(al.status)) = 'Present' THEN 'Present' ELSE 'Absent' END as status
            FROM machine_assignments ma
            JOIN users u ON ma.user_id = u.id
            LEFT JOIN departments d ON u.departmentId = d.id
            LEFT JOIN sections s ON u.sectionId = s.id
            LEFT JOIN lines l ON u.lineId = l.id
            LEFT JOIN sub_sections ss ON u.subSectionId = ss.id
            LEFT JOIN machines m ON ma.machine_id = m.id
            LEFT JOIN attendance_logs al ON (al.userId = u.id OR (u.empId IS NOT NULL AND LTRIM(RTRIM(al.payCode)) = LTRIM(RTRIM(u.empId))))
                AND CAST(al.[date] AS DATE) = CAST(? AS DATE)
                AND (LTRIM(RTRIM(al.shift)) = ? OR ? = 'all')
            WHERE ma.machine_id IN (${placeholders})
            ORDER BY u.fullName ASC
        `;

        const params = [formattedDate, shiftParam, shiftParam, ...machineIds];
        const [rows] = await executeQuery(query, params);

        // Group by machineId
        const assignments = {};
        rows.forEach(row => {
            if (!assignments[row.machineId]) {
                assignments[row.machineId] = [];
            }
            assignments[row.machineId].push({
                userId: row.userId,
                fullName: row.fullName,
                empId: row.empId,
                status: row.status,
                departmentId: row.departmentId,
                sectionId: row.sectionId,
                lineId: row.lineId,
                subSectionId: row.subSectionId,
                stationId: row.machineId,
                currentLevel: row.currentLevel,
                departmentName: row.departmentName,
                sectionName: row.sectionName,
                lineName: row.lineName,
                subSectionName: row.subSectionName,
                stationName: row.stationName
            });
        });

        return assignments;
    }
}

// Initialize table
DailyProductionReport.init();

export default DailyProductionReport;
