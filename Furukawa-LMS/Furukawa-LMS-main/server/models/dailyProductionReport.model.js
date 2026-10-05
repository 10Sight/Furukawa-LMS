import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";
import { formatLocalDate } from "../utils/istDate.util.js";
import migrationHelper from "../db/migrationHelper.js";

class DailyProductionReport {
    constructor(data) {
        if (!data) return;
        this.id = data.id;
        this.date = data.date instanceof Date
            ? formatLocalDate(data.date)
            : (typeof data.date === 'string' ? data.date.split('T')[0] : data.date);
        this.department = data.department || data.department_id;
        this.line = data.line || data.line_id;
        this.shift = data.shift;
        this.leaderName = data.leaderName;
        this.lineName = data.lineName;
        this.sectionName = data.sectionName;
        this.departmentName = data.departmentName;

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

        this.docNo = data.docNo;
        this.revNo = data.revNo;
        this.revDate = data.revDate;

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        try {
            if (!await migrationHelper.tableExists('daily_production_reports')) {
                await executeQuery(`
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
                        docNo VARCHAR(255) NULL,
                        revNo VARCHAR(255) NULL,
                        revDate VARCHAR(255) NULL,
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        CONSTRAINT uq_daily_report UNIQUE (date, department_id, line_id, shift)
                    )
                `);
            } else {
                // Migration: Add columns if they don't exist
                await migrationHelper.ensureColumnExists('daily_production_reports', 'isSubmitted', 'BIT DEFAULT 0');
                await migrationHelper.ensureColumnExists('daily_production_reports', 'submittedBy', 'INT');
                await migrationHelper.ensureColumnExists('daily_production_reports', 'status', "VARCHAR(20) DEFAULT 'DRAFT'");
                await migrationHelper.ensureColumnExists('daily_production_reports', 'checkedByUserId', 'INT');
                await migrationHelper.ensureColumnExists('daily_production_reports', 'customerEndDefectDetails', 'NVARCHAR(MAX)');
                await migrationHelper.ensureColumnExists('daily_production_reports', 'internalDefectDetails', 'NVARCHAR(MAX)');
                await migrationHelper.ensureColumnExists('daily_production_reports', 'manpowerAttendance', 'NVARCHAR(MAX)');
                await migrationHelper.ensureColumnExists('daily_production_reports', 'kaizenDetails', 'NVARCHAR(MAX)');
                // Doc/revision snapshot: frozen at creation from the Revision Table, never
                // updated afterwards (see upsert() below).
                await migrationHelper.ensureColumnExists('daily_production_reports', 'docNo', 'VARCHAR(255) NULL');
                await migrationHelper.ensureColumnExists('daily_production_reports', 'revNo', 'VARCHAR(255) NULL');
                await migrationHelper.ensureColumnExists('daily_production_reports', 'revDate', 'VARCHAR(255) NULL');
            }
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
        const { limit = 10, offset = 0 } = filters;
        let query = `
            SELECT r.*, d.name as departmentName, s.name as sectionName, l.name as lineName,
                   COUNT(*) OVER() as totalCount
            FROM daily_production_reports r
            LEFT JOIN departments d ON r.department_id = d.id
            LEFT JOIN lines l ON r.line_id = l.id
            LEFT JOIN sections s ON l.sectionId = s.id
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
        if (filters.sectionId && filters.sectionId !== 'all') {
            query += ` AND l.sectionId = ?`;
            values.push(filters.sectionId);
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
        query += ` OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
        values.push(Number(offset), Number(limit));

        const [rows] = await executeQuery(query, values);
        const reports = rows.map(row => new DailyProductionReport(row));
        const totalCount = rows.length > 0 ? rows[0].totalCount : 0;

        return { reports, totalCount };
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
            // INSERT — docNo/revNo/revDate are frozen here (caller passes the current
            // Revision Table snapshot for a brand-new record) and never touched by the
            // UPDATE branch above, so they stay immutable for the life of the record.
            await executeQuery(`
                INSERT INTO daily_production_reports
                (date, department_id, line_id, shift, leaderName, delivery, quality, downTime, shiftCommunication, moral, directEfficiency, customerEndDefectDetails, internalDefectDetails, manpowerAttendance, kaizenDetails, madeBy, checkedBy, isSubmitted, submittedBy, status, checkedByUserId, docNo, revNo, revDate)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                data.date, data.department, data.line, data.shift,
                data.leaderName || null,
                jsonValues.delivery, jsonValues.quality, jsonValues.downTime,
                jsonValues.shiftCommunication, jsonValues.moral, jsonValues.directEfficiency,
                jsonValues.customerEndDefectDetails, jsonValues.internalDefectDetails,
                jsonValues.manpowerAttendance, jsonValues.kaizenDetails,
                data.madeBy || null, data.checkedBy || null,
                data.isSubmitted ? 1 : 0, data.submittedBy || null,
                data.status || 'DRAFT', data.checkedByUserId || null,
                data.docNo || null, data.revNo || null, data.revDate || null
            ]);
        }

        return DailyProductionReport.findOne({
            date: data.date,
            department: data.department,
            line: data.line,
            shift: data.shift
        });
    }

    // Canonical shift codes shared across shiftSchedule JSON, users.shift, attendance_logs.shift and the DPR shift selector.
    static SHIFT_KEYS = ['A', 'B', 'C', 'G'];

    static _resolveShiftKey(raw) {
        const normalized = (raw || '').toString().trim().toUpperCase();
        if (!normalized) return null;
        return DailyProductionReport.SHIFT_KEYS.find(k => normalized === k || normalized.includes(k)) || null;
    }

    // Decides whether a user belongs on the sheet for `requestedShift`, and whether that appearance
    // is a scheduled Present, an off-schedule Mismatch, or an Absent. Shared by getManpowerStats and
    // getBatchMachineAssignments so both tables always agree on the same user.
    static _resolveAttendanceStatus({ formattedDate, requestedShift, defaultShift, shiftScheduleJson, logShift, logStatus }) {
        const requestedShiftKey = requestedShift === 'all' ? 'all' : DailyProductionReport._resolveShiftKey(requestedShift);

        let scheduledShiftRaw = defaultShift;
        if (shiftScheduleJson) {
            try {
                const scheduleObj = JSON.parse(shiftScheduleJson);
                if (scheduleObj && scheduleObj[formattedDate]) {
                    scheduledShiftRaw = scheduleObj[formattedDate];
                }
            } catch (e) {
                // Keep the default shift if the schedule JSON is malformed
            }
        }
        const scheduledShiftKey = DailyProductionReport._resolveShiftKey(scheduledShiftRaw);
        const logShiftKey = DailyProductionReport._resolveShiftKey(logShift);
        const isPresentLog = logStatus === 'Present';

        if (requestedShiftKey === 'all') {
            return { include: true, isPresent: isPresentLog, status: isPresentLog ? 'Present' : 'Absent' };
        }

        const isScheduledForShift = scheduledShiftKey === requestedShiftKey;
        const isPresentInShift = isPresentLog && logShiftKey === requestedShiftKey;

        // Only show a user on this shift's sheet if they're scheduled for it or actually punched in during it
        if (!isScheduledForShift && !isPresentInShift) return { include: false };

        if (!isPresentLog) {
            return { include: true, isPresent: false, status: 'Absent' };
        }

        // Unknown schedule (null) is not treated as a contradiction, so it isn't flagged Mismatch
        const status = (!scheduledShiftKey || logShiftKey === scheduledShiftKey) ? 'Present' : 'Mismatch';
        return { include: true, isPresent: true, status };
    }

    static async getManpowerStats(date, shift, subSectionIds) {
        if (!subSectionIds || subSectionIds.length === 0) return [];

        const placeholders = subSectionIds.map(() => "?").join(",");
        const formattedDate = new Date(date).toISOString().split('T')[0];
        const shiftParam = shift === 'all' ? 'all' : shift;

        const query = `
            SELECT DISTINCT
                m.subSectionId as subSectionId,
                ss.name as subSectionName,
                u.id as userId,
                u.shift as defaultShift,
                u.shiftSchedule as shiftSchedule,
                al.logShift,
                al.logStatus
            FROM machine_assignments ma
            JOIN machines m ON ma.machine_id = m.id
            JOIN users u ON ma.user_id = u.id
            JOIN sub_sections ss ON m.subSectionId = ss.id
            OUTER APPLY (
                SELECT TOP 1
                    LTRIM(RTRIM(al2.shift)) as logShift,
                    CASE WHEN al2.status IS NOT NULL AND LTRIM(RTRIM(al2.status)) = 'Present' THEN 'Present' ELSE 'Absent' END as logStatus
                FROM attendance_logs al2
                WHERE (al2.userId = u.id OR (u.empId IS NOT NULL AND LTRIM(RTRIM(al2.payCode)) = LTRIM(RTRIM(u.empId))))
                    AND CAST(al2.[date] AS DATE) = CAST(? AS DATE)
                ORDER BY
                    CASE
                        WHEN al2.status IS NOT NULL AND LTRIM(RTRIM(al2.status)) = 'Present' AND LTRIM(RTRIM(al2.shift)) = ? THEN 0
                        WHEN al2.status IS NOT NULL AND LTRIM(RTRIM(al2.status)) = 'Present' THEN 1
                        ELSE 2
                    END
            ) al
            WHERE m.subSectionId IN (${placeholders})
        `;

        const params = [formattedDate, shiftParam, ...subSectionIds];
        const [rows] = await executeQuery(query, params);

        // Pre-seed every requested sub-section so ones with no assignments still return a zeroed row
        const statsMap = {};
        subSectionIds.forEach(id => {
            statsMap[String(id)] = { subSectionId: id, subSectionName: null, totalCount: 0, presentCount: 0, absentCount: 0 };
        });

        rows.forEach(row => {
            const { include, isPresent } = DailyProductionReport._resolveAttendanceStatus({
                formattedDate,
                requestedShift: shiftParam,
                defaultShift: row.defaultShift,
                shiftScheduleJson: row.shiftSchedule,
                logShift: row.logShift,
                logStatus: row.logStatus
            });
            if (!include) return;

            const key = String(row.subSectionId);
            if (!statsMap[key]) {
                statsMap[key] = { subSectionId: row.subSectionId, subSectionName: row.subSectionName, totalCount: 0, presentCount: 0, absentCount: 0 };
            }
            statsMap[key].subSectionName = row.subSectionName;
            statsMap[key].totalCount++;
            if (isPresent) {
                statsMap[key].presentCount++;
            } else {
                statsMap[key].absentCount++;
            }
        });

        return Object.values(statsMap);
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
                u.shift as defaultShift,
                u.shiftSchedule as shiftSchedule,
                d.name as departmentName,
                s.name as sectionName,
                l.name as lineName,
                ss.name as subSectionName,
                m.name as stationName,
                al.logShift,
                al.logStatus
            FROM machine_assignments ma
            JOIN users u ON ma.user_id = u.id
            LEFT JOIN departments d ON u.departmentId = d.id
            LEFT JOIN sections s ON u.sectionId = s.id
            LEFT JOIN lines l ON u.lineId = l.id
            LEFT JOIN sub_sections ss ON u.subSectionId = ss.id
            LEFT JOIN machines m ON ma.machine_id = m.id
            OUTER APPLY (
                SELECT TOP 1
                    LTRIM(RTRIM(al2.shift)) as logShift,
                    CASE WHEN al2.status IS NOT NULL AND LTRIM(RTRIM(al2.status)) = 'Present' THEN 'Present' ELSE 'Absent' END as logStatus
                FROM attendance_logs al2
                WHERE (al2.userId = u.id OR (u.empId IS NOT NULL AND LTRIM(RTRIM(al2.payCode)) = LTRIM(RTRIM(u.empId))))
                    AND CAST(al2.[date] AS DATE) = CAST(? AS DATE)
                ORDER BY
                    CASE
                        WHEN al2.status IS NOT NULL AND LTRIM(RTRIM(al2.status)) = 'Present' AND LTRIM(RTRIM(al2.shift)) = ? THEN 0
                        WHEN al2.status IS NOT NULL AND LTRIM(RTRIM(al2.status)) = 'Present' THEN 1
                        ELSE 2
                    END
            ) al
            WHERE ma.machine_id IN (${placeholders})
            ORDER BY u.fullName ASC
        `;

        const params = [formattedDate, shiftParam, ...machineIds];
        const [rows] = await executeQuery(query, params);

        // Group by machineId
        const assignments = {};
        rows.forEach(row => {
            const { include, status } = DailyProductionReport._resolveAttendanceStatus({
                formattedDate,
                requestedShift: shiftParam,
                defaultShift: row.defaultShift,
                shiftScheduleJson: row.shiftSchedule,
                logShift: row.logShift,
                logStatus: row.logStatus
            });
            if (!include) return;

            if (!assignments[row.machineId]) {
                assignments[row.machineId] = [];
            }
            assignments[row.machineId].push({
                userId: row.userId,
                fullName: row.fullName,
                empId: row.empId,
                status,
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
