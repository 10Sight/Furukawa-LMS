import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class Daily5MRecord {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.sectionId = data.sectionId;
        this.date = data.date;
        this.shift = data.shift;
        this.line = data.line;
        this.formType = data.formType || 'standard';
        this.recordData = typeof data.recordData === 'string' ? JSON.parse(data.recordData) : (data.recordData || {});
        this.submittedBy = data.submittedBy; // User ID
        this.submittedByName = data.submittedByName || "Unknown"; // Joined Full Name
        this.sectionName = data.sectionName;
        this.departmentName = data.departmentName;
        this.sessionId = data.sessionId;
        this.status = data.status || 'PENDING';
        this.approvedBy = data.approvedBy;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
        this.adminRemarks = data.adminRemarks || "";
        this.adminRemarksHistory = data.adminRemarksHistory || [];
    }

    static async init() {
        const createTableQuery = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'daily_5m_records')
            BEGIN
                CREATE TABLE daily_5m_records (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId NVARCHAR(255) NOT NULL,
                    date DATE NOT NULL,
                    shift NVARCHAR(50),
                    line NVARCHAR(50),
                    formType NVARCHAR(50),
                    recordData NVARCHAR(MAX),
                    submittedBy NVARCHAR(255),
                    sessionId INT,
                    status NVARCHAR(20) DEFAULT 'PENDING',
                    approvedBy INT,
                    createdAt DATETIME2 DEFAULT GETUTCDATE(),
                    updatedAt DATETIME2 DEFAULT GETUTCDATE(),
                    FOREIGN KEY (approvedBy) REFERENCES users(id)
                )
            END
        `;

        try {
            await executeQuery(createTableQuery);

            // Migration: Handle column type changes safely by dropping default constraints first
            const columnsToFix = [
                { name: 'createdAt', type: 'DATETIME2', default: 'GETUTCDATE()' },
                { name: 'updatedAt', type: 'DATETIME2', default: 'GETUTCDATE()' }
            ];

            for (const col of columnsToFix) {
                // Check if column is DATETIME (61) instead of DATETIME2
                const checkTypeQuery = `SELECT system_type_id FROM sys.columns WHERE object_id = OBJECT_ID('daily_5m_records') AND name = '${col.name}'`;
                const [typeRows] = await executeQuery(checkTypeQuery);
                
                if (typeRows && typeRows[0] && typeRows[0].system_type_id === 61) {
                    logger.info(`Migrating ${col.name} to DATETIME2 for daily_5m_records...`);
                    
                    // MSSQL: To alter a column with a default constraint, we must find and drop the constraint first
                    const findConstraintQuery = `
                        SELECT df.name 
                        FROM sys.default_constraints df
                        JOIN sys.columns c ON df.parent_column_id = c.column_id AND df.parent_object_id = c.object_id
                        WHERE c.name = '${col.name}' AND c.object_id = OBJECT_ID('daily_5m_records')
                    `;
                    const [constraints] = await executeQuery(findConstraintQuery);
                    
                    if (constraints && constraints[0]) {
                        await executeQuery(`ALTER TABLE daily_5m_records DROP CONSTRAINT ${constraints[0].name}`);
                    }
                    
                    // Now we can alter the column
                    await executeQuery(`ALTER TABLE daily_5m_records ALTER COLUMN ${col.name} ${col.type}`);
                    
                    // Re-add the default constraint
                    await executeQuery(`ALTER TABLE daily_5m_records ADD CONSTRAINT DF_daily5m_${col.name} DEFAULT ${col.default} FOR ${col.name}`);
                    
                    logger.info(`Successfully migrated ${col.name}.`);
                }
            }

            // Ensure new columns exist
            await migrationHelper.ensureColumnExists('daily_5m_records', 'formType', "NVARCHAR(50) DEFAULT 'standard'");
            await migrationHelper.ensureColumnExists('daily_5m_records', 'sessionId', "INT");
            await migrationHelper.ensureColumnExists('daily_5m_records', 'status', "NVARCHAR(20) DEFAULT 'PENDING'");
            await migrationHelper.ensureColumnExists('daily_5m_records', 'approvedBy', "INT");
            await migrationHelper.ensureColumnExists('daily_5m_records', 'sectionId', "NVARCHAR(255)");
            await migrationHelper.ensureColumnExists('daily_5m_records', 'adminRemarks', "NVARCHAR(MAX)");

            // Remove unique constraints to allow full history (every save = new row)
            const dropConstraintsQuery = `
                IF EXISTS (SELECT * FROM sys.objects WHERE name = 'uc_dept_date_user' AND type = 'UQ')
                BEGIN
                    ALTER TABLE daily_5m_records DROP CONSTRAINT uc_dept_date_user;
                END
                
                IF EXISTS (SELECT * FROM sys.objects WHERE name = 'uc_dept_date_user_shift_line' AND type = 'UQ')
                BEGIN
                    ALTER TABLE daily_5m_records DROP CONSTRAINT uc_dept_date_user_shift_line;
                END

                IF EXISTS (SELECT * FROM sys.objects WHERE name = 'uc_dept_date' AND type = 'UQ')
                BEGIN
                    ALTER TABLE daily_5m_records DROP CONSTRAINT uc_dept_date;
                END
            `;
            await executeQuery(dropConstraintsQuery);

            console.log("Daily5MRecord table verified/created in MSSQL.");
        } catch (error) {
            console.error("Failed to initialize Daily5MRecord table:", error);
        }
    }

    static calculateAggregateStatus(recordData) {
        if (!recordData) return 'PENDING';

        const rowCount = 20; // Max rows to check (safe upper bound)
        let activeRows = 0;
        let approvedRows = 0;
        let rejectedRows = 0;

        for (let i = 0; i < rowCount; i++) {
            // Check if row has any significant data
            const hasData = recordData[`rec_${i}_Date`] ||
                            recordData[`rec_${i}_Line`] ||
                            recordData[`rec_${i}_StationMC`] ||
                            recordData[`rec_${i}_OpName`] ||
                            recordData[`rec_${i}_OperatorName`];

            if (hasData) {
                activeRows++;
                const rowStatus = recordData[`rec_${i}_RowStatus`];
                if (rowStatus === 'APPROVED') {
                    approvedRows++;
                } else if (rowStatus === 'REJECTED' || rowStatus === 'DECLINED') {
                    rejectedRows++;
                }
            }
        }

        if (activeRows === 0) return 'PENDING';
        if (rejectedRows > 0) return 'DECLINED';
        if (approvedRows === activeRows) return 'APPROVED';
        
        return 'PENDING';
    }

    static async upsert(recordData) {
        const { departmentId, sectionId, date, shift, line, formType, recordData: data, submittedBy, sessionId, adminRemarks } = recordData;
        const dataJson = JSON.stringify(data);
        const aggregateStatus = this.calculateAggregateStatus(data);

        // Preserve the original submitter so that a QA Incharge approving rows
        // doesn't overwrite submittedBy with their own ID (which would trigger
        // the self-approval restriction on subsequent loads).
        let finalSubmittedBy = submittedBy;
        if (sessionId) {
            const [originalRows] = await executeQuery(
                `SELECT TOP 1 submittedBy FROM daily_5m_records WHERE sessionId = ? ORDER BY createdAt ASC`,
                [sessionId]
            );
            if (originalRows && originalRows.length > 0 && originalRows[0].submittedBy) {
                finalSubmittedBy = originalRows[0].submittedBy;
            }
        }

        const query = `
            INSERT INTO daily_5m_records (departmentId, sectionId, date, shift, line, formType, recordData, submittedBy, sessionId, status, adminRemarks, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETUTCDATE(), GETUTCDATE());
            SELECT SCOPE_IDENTITY() as id;
        `;

        const [rows] = await executeQuery(query, [
            departmentId, sectionId || null, date, shift, line, formType, dataJson, finalSubmittedBy, sessionId || null, aggregateStatus, adminRemarks || null
        ]);

        const newId = rows[0].id;

        // If sessionId was not provided, update the record to use its own ID as sessionId
        if (!sessionId) {
            await executeQuery("UPDATE daily_5m_records SET sessionId = ? WHERE id = ?", [newId, newId]);
        }

        return this.findById(newId);
    }

    static async findAll({ departmentId, sectionId, startDate, endDate, formType, limit = 50, offset = 0, submittedBy, groupBySession = false, search = "" }) {
        let sql = "";
        let params = [];
 
        if (groupBySession) {
            // Pick only the latest record for each sessionId
            sql = `
                WITH LatestSessions AS (
                    SELECT r.*, u.fullName as submittedByName, au.fullName as approvedByName,
                           s.name as sectionName, d.name as departmentName,
                           ROW_NUMBER() OVER (PARTITION BY r.sessionId ORDER BY r.createdAt DESC) as rn
                    FROM daily_5m_records r
                    LEFT JOIN users u ON r.submittedBy = CAST(u.id AS NVARCHAR(255))
                    LEFT JOIN users au ON r.approvedBy = au.id
                    LEFT JOIN [sections] s ON r.sectionId = CAST(s.id AS NVARCHAR(255))
                    LEFT JOIN departments d ON r.departmentId = CAST(d.id AS NVARCHAR(255))
                    WHERE (r.departmentId = ? OR ? = 'all')
            `;
            params.push(departmentId || 'all', departmentId || 'all');

            if (sectionId && sectionId !== 'all') {
                sql += " AND r.sectionId = ?";
                params.push(sectionId);
            }

            if (submittedBy) {
                sql += " AND r.submittedBy = ?";
                params.push(submittedBy);
            }
            if (formType) {
                sql += " AND r.formType = ?";
                params.push(formType);
            }
            if (startDate) {
                sql += " AND r.date >= ?";
                params.push(startDate);
            }
            if (endDate) {
                sql += " AND r.date <= ?";
                params.push(endDate);
            }
            if (search) {
                sql += ` AND (
                    r.line LIKE ? OR 
                    s.name LIKE ? OR 
                    d.name LIKE ? OR 
                    CAST(r.id AS NVARCHAR) LIKE ? OR
                    u.fullName LIKE ?
                )`;
                const searchParam = `%${search}%`;
                params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
            }

            sql += `
                ),
                FinalSessions AS (
                    SELECT *, COUNT(*) OVER() as totalCount FROM LatestSessions WHERE rn = 1
                )
                SELECT * FROM FinalSessions
            `;
        } else {
            sql = `
                SELECT r.*, u.fullName as submittedByName, au.fullName as approvedByName,
                       s.name as sectionName, d.name as departmentName,
                       COUNT(*) OVER() as totalCount
                FROM daily_5m_records r
                LEFT JOIN users u ON r.submittedBy = CAST(u.id AS NVARCHAR(255))
                LEFT JOIN users au ON r.approvedBy = au.id
                LEFT JOIN [sections] s ON r.sectionId = CAST(s.id AS NVARCHAR(255))
                LEFT JOIN departments d ON r.departmentId = CAST(d.id AS NVARCHAR(255))
                WHERE (r.departmentId = ? OR ? = 'all')
            `;
            params.push(departmentId || 'all', departmentId || 'all');

            if (sectionId && sectionId !== 'all') {
                sql += " AND r.sectionId = ?";
                params.push(sectionId);
            }

            if (submittedBy) {
                sql += " AND r.submittedBy = ?";
                params.push(submittedBy);
            }

            if (formType) {
                sql += " AND r.formType = ?";
                params.push(formType);
            }

            if (startDate) {
                sql += " AND r.date >= ?";
                params.push(startDate);
            }
            if (endDate) {
                sql += " AND r.date <= ?";
                params.push(endDate);
            }
            if (search) {
                sql += ` AND (
                    r.line LIKE ? OR 
                    s.name LIKE ? OR 
                    d.name LIKE ? OR 
                    CAST(r.id AS NVARCHAR) LIKE ? OR
                    u.fullName LIKE ?
                )`;
                const searchParam = `%${search}%`;
                params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
            }
        }

        sql += " ORDER BY date DESC, createdAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
        params.push(offset, limit);

        const [rows] = await executeQuery(sql, params);
        const totalCount = rows.length > 0 ? rows[0].totalCount : 0;
        const records = rows.map(row => new Daily5MRecord(row));

        if (groupBySession && records.length > 0) {
            const sessionIds = records.map(r => r.sessionId).filter(Boolean);
            if (sessionIds.length > 0) {
                const placeholders = sessionIds.map(() => '?').join(',');
                const historyQuery = `
                    SELECT r.sessionId, r.adminRemarks, r.createdAt, u.fullName as adminName
                    FROM daily_5m_records r
                    LEFT JOIN users u ON r.submittedBy = CAST(u.id AS NVARCHAR(255))
                    WHERE r.sessionId IN (${placeholders})
                      AND r.adminRemarks IS NOT NULL
                      AND r.adminRemarks != ''
                    ORDER BY r.sessionId, r.createdAt DESC
                `;
                const [historyRows] = await executeQuery(historyQuery, sessionIds);
                const historyMap = {};
                historyRows.forEach(row => {
                    if (!historyMap[row.sessionId]) historyMap[row.sessionId] = [];
                    historyMap[row.sessionId].push({
                        remark: row.adminRemarks,
                        createdAt: row.createdAt,
                        adminName: row.adminName || "Admin"
                    });
                });
                records.forEach(record => {
                    record.adminRemarksHistory = historyMap[record.sessionId] || [];
                });
            }
        }

        return { records, totalCount };
    }

    static async findById(id) {
        const query = `
            SELECT r.*, u.fullName as submittedByName, au.fullName as approvedByName
            FROM daily_5m_records r
            LEFT JOIN users u ON r.submittedBy = CAST(u.id AS NVARCHAR(255))
            LEFT JOIN users au ON r.approvedBy = au.id
            WHERE r.id = ?
        `;
        const [rows] = await executeQuery(query, [id]);
        if (rows.length === 0) return null;
        return new Daily5MRecord(rows[0]);
    }

    static async updateStatus(id, status, userId) {
        const query = `
            UPDATE daily_5m_records 
            SET status = ?, approvedBy = ?, updatedAt = GETUTCDATE() 
            WHERE id = ?
        `;
        await executeQuery(query, [status, userId, id]);
        return true;
    }

    static async findByDateDeptAndUser(departmentId, date, userId, sectionId) {
        let query = `
            SELECT r.*, u.fullName as submittedByName 
            FROM daily_5m_records r
            LEFT JOIN users u ON r.submittedBy = CAST(u.id AS NVARCHAR(255))
            WHERE r.departmentId = ? AND r.date = ?
        `;
        const params = [departmentId, date];

        if (userId) {
            query += " AND r.submittedBy = ?";
            params.push(userId);
        }

        if (sectionId) {
            query += " AND r.sectionId = ?";
            params.push(sectionId);
        }

        query += " ORDER BY r.createdAt DESC";
        const [rows] = await executeQuery(query, params);
        if (rows.length === 0) return null;
        return new Daily5MRecord(rows[0]);
    }

    static async delete(id) {
        const query = "DELETE FROM daily_5m_records WHERE id = ?";
        const [, metadata] = await executeQuery(query, [id]);
        return metadata.affectedRows > 0;
    }

    static async getStats({ departmentId, sectionId, startDate, endDate, formType }) {
        // Use CTE to pick only the latest row per session so repeated saves/edits
        // don't inflate the count — each unique sheet is counted exactly once.
        let whereClauses = "WHERE 1=1";
        let params = [];

        if (departmentId && departmentId !== 'all') {
            if (departmentId.includes(',')) {
                const ids = departmentId.split(',');
                whereClauses += ` AND departmentId IN (${ids.map(() => '?').join(',')})`;
                params.push(...ids);
            } else {
                whereClauses += " AND departmentId = ?";
                params.push(departmentId);
            }
        }

        if (sectionId && sectionId !== 'all') {
            whereClauses += " AND sectionId = ?";
            params.push(sectionId);
        }
        if (formType) {
            whereClauses += " AND formType = ?";
            params.push(formType);
        }
        if (startDate) {
            whereClauses += " AND date >= ?";
            params.push(startDate);
        }
        if (endDate) {
            whereClauses += " AND date <= ?";
            params.push(endDate);
        }

        const sql = `
            WITH LatestSessions AS (
                SELECT date, status, recordData, sessionId,
                       ROW_NUMBER() OVER (PARTITION BY sessionId ORDER BY createdAt DESC) AS rn
                FROM daily_5m_records
                ${whereClauses}
            )
            SELECT date, status, recordData
            FROM LatestSessions
            WHERE rn = 1
            ORDER BY date ASC
        `;

        const [records] = await executeQuery(sql, params);
        
        // Aggregate by date
        const dailyStatsMap = {};

        records.forEach(record => {
            // Ensure date is in YYYY-MM-DD format for grouping
            let dateStr = record.date;
            if (record.date instanceof Date) {
                const year = record.date.getUTCFullYear();
                const month = String(record.date.getUTCMonth() + 1).padStart(2, '0');
                const day = String(record.date.getUTCDate()).padStart(2, '0');
                dateStr = `${year}-${month}-${day}`;
            } else if (typeof record.date === 'string' && record.date.includes('T')) {
                dateStr = record.date.split('T')[0];
            }
            
            if (!dailyStatsMap[dateStr]) {
                dailyStatsMap[dateStr] = {
                    date: dateStr,
                    total: 0,
                    approved: 0,
                    rejected: 0,
                    pending: 0
                };
            }

            // Parse recordData to count filled rows
            let rowCount = 0;
            let approvedRows = 0;
            let rejectedRows = 0;
            let pendingRows = 0;

            if (record.recordData) {
                try {
                    const data = typeof record.recordData === 'string' ? JSON.parse(record.recordData) : record.recordData;
                    // Check up to 20 rows
                    for (let i = 0; i < 20; i++) {
                        const rowStatus = data[`rec_${i}_RowStatus`];
                        const hasData = data[`rec_${i}_Date`] ||
                                        data[`rec_${i}_Line`] ||
                                        data[`rec_${i}_StationMC`] ||
                                        data[`rec_${i}_OpName`] ||
                                        data[`rec_${i}_OperatorName`];

                        if (hasData) {
                            rowCount++;
                            if (rowStatus === 'APPROVED') approvedRows++;
                            else if (rowStatus === 'REJECTED' || rowStatus === 'DECLINED') rejectedRows++;
                            else pendingRows++;
                        }
                    }
                } catch (e) {
                    console.error("Error parsing recordData for stats:", e);
                }
            }

            dailyStatsMap[dateStr].total += rowCount;
            dailyStatsMap[dateStr].approved += approvedRows;
            dailyStatsMap[dateStr].rejected += rejectedRows;
            dailyStatsMap[dateStr].pending += pendingRows;
        });

        return Object.values(dailyStatsMap).sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    static async getRowStats({ departmentId, sectionId, startDate, endDate }) {
        // Use CTE to pick only the latest row per session before counting row statuses
        // so reopening/editing a sheet doesn't double-count its filled rows.
        let whereClauses = "WHERE 1=1";
        let params = [];

        if (departmentId && departmentId !== 'all') {
            if (departmentId.includes(',')) {
                const ids = departmentId.split(',');
                whereClauses += ` AND r.departmentId IN (${ids.map(() => '?').join(',')})`;
                params.push(...ids);
            } else {
                whereClauses += " AND r.departmentId = ?";
                params.push(departmentId);
            }
        }

        if (sectionId && sectionId !== 'all') {
            whereClauses += " AND r.sectionId = ?";
            params.push(sectionId);
        }
        if (startDate) {
            whereClauses += " AND r.date >= ?";
            params.push(startDate);
        }
        if (endDate) {
            whereClauses += " AND r.date <= ?";
            params.push(endDate);
        }

        const sql = `
            WITH LatestSessions AS (
                SELECT r.departmentId, r.recordData, r.sessionId,
                       ROW_NUMBER() OVER (PARTITION BY r.sessionId ORDER BY r.createdAt DESC) AS rn
                FROM daily_5m_records r
                ${whereClauses}
            )
            SELECT ls.departmentId, d.name AS departmentName, ls.recordData
            FROM LatestSessions ls
            LEFT JOIN departments d ON ls.departmentId = CAST(d.id AS NVARCHAR(255))
            WHERE ls.rn = 1
        `;

        const [records] = await executeQuery(sql, params);

        let overall = { approved: 0, pending: 0, rejected: 0, total: 0 };
        let departmentMap = {};

        records.forEach(record => {
            const data = typeof record.recordData === 'string' ? JSON.parse(record.recordData) : (record.recordData || {});
            const deptName = record.departmentName || "Unknown";
            const deptId = record.departmentId;

            if (!departmentMap[deptId]) {
                departmentMap[deptId] = { 
                    departmentId: deptId, 
                    departmentName: deptName, 
                    approved: 0, 
                    pending: 0, 
                    rejected: 0, 
                    total: 0 
                };
            }

            for (let i = 0; i < 20; i++) {
                const hasData = data[`rec_${i}_Date`] || data[`rec_${i}_Line`] || data[`rec_${i}_StationMC`] || data[`rec_${i}_OpName`] || data[`rec_${i}_OperatorName`];
                if (hasData) {
                    const status = data[`rec_${i}_RowStatus`] || 'PENDING';
                    
                    overall.total++;
                    departmentMap[deptId].total++;

                    if (status === 'APPROVED') {
                        overall.approved++;
                        departmentMap[deptId].approved++;
                    } else if (status === 'REJECTED' || status === 'DECLINED') {
                        overall.rejected++;
                        departmentMap[deptId].rejected++;
                    } else {
                        overall.pending++;
                        departmentMap[deptId].pending++;
                    }
                }
            }
        });

        return {
            overallStats: overall,
            departmentStats: Object.values(departmentMap)
        };
    }
}

// Initialize table
Daily5MRecord.init().catch(err => console.error("Failed to initialize daily_5m_records table:", err));

export default Daily5MRecord;
