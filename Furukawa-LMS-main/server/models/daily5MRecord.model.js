import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class Daily5MRecord {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.date = data.date;
        this.shift = data.shift;
        this.line = data.line;
        this.formType = data.formType || 'standard';
        this.recordData = typeof data.recordData === 'string' ? JSON.parse(data.recordData) : (data.recordData || {});
        this.submittedBy = data.submittedBy; // User ID
        this.submittedByName = data.submittedByName || "Unknown"; // Joined Full Name
        this.sessionId = data.sessionId;
        this.status = data.status || 'PENDING';
        this.approvedBy = data.approvedBy;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
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

    static async upsert(recordData) {
        const { departmentId, date, shift, line, formType, recordData: data, submittedBy, sessionId } = recordData;
        const dataJson = JSON.stringify(data);

        const query = `
            INSERT INTO daily_5m_records (departmentId, date, shift, line, formType, recordData, submittedBy, sessionId, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', GETUTCDATE(), GETUTCDATE());
            SELECT SCOPE_IDENTITY() as id;
        `;

        const [rows] = await executeQuery(query, [
            departmentId, date, shift, line, formType, dataJson, submittedBy, sessionId || null
        ]);

        const newId = rows[0].id;

        // If sessionId was not provided, update the record to use its own ID as sessionId
        if (!sessionId) {
            await executeQuery("UPDATE daily_5m_records SET sessionId = ? WHERE id = ?", [newId, newId]);
        }

        return this.findById(newId);
    }

    static async findAll({ departmentId, startDate, endDate, formType, limit = 50, offset = 0, submittedBy, groupBySession = false }) {
        let sql = "";
        let params = [];

        if (groupBySession) {
            // Pick only the latest record for each sessionId
            sql = `
                WITH LatestSessions AS (
                    SELECT r.*, u.fullName as submittedByName, au.fullName as approvedByName,
                           ROW_NUMBER() OVER (PARTITION BY r.sessionId ORDER BY r.createdAt DESC) as rn
                    FROM daily_5m_records r
                    LEFT JOIN users u ON r.submittedBy = CAST(u.id AS NVARCHAR(255))
                    LEFT JOIN users au ON r.approvedBy = au.id
                    WHERE r.departmentId = ?
            `;
            params.push(departmentId);

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

            sql += `
                )
                SELECT * FROM LatestSessions WHERE rn = 1
            `;
        } else {
            sql = `
                SELECT r.*, u.fullName as submittedByName, au.fullName as approvedByName
                FROM daily_5m_records r
                LEFT JOIN users u ON r.submittedBy = CAST(u.id AS NVARCHAR(255))
                LEFT JOIN users au ON r.approvedBy = au.id
                WHERE r.departmentId = ?
            `;
            params.push(departmentId);

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
        }

        sql += " ORDER BY date DESC, createdAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
        params.push(offset, limit);

        const [rows] = await executeQuery(sql, params);
        return rows.map(row => new Daily5MRecord(row));
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

    static async findByDateDeptAndUser(departmentId, date, userId) {
        const query = `
            SELECT r.*, u.fullName as submittedByName 
            FROM daily_5m_records r
            LEFT JOIN users u ON r.submittedBy = CAST(u.id AS NVARCHAR(255))
            WHERE r.departmentId = ? AND r.date = ? AND r.submittedBy = ?
            ORDER BY r.createdAt DESC
        `;
        const [rows] = await executeQuery(query, [departmentId, date, userId]);
        if (rows.length === 0) return null;
        return new Daily5MRecord(rows[0]);
    }

    static async delete(id) {
        const query = "DELETE FROM daily_5m_records WHERE id = ?";
        const [, metadata] = await executeQuery(query, [id]);
        return metadata.affectedRows > 0;
    }
}

// Initialize table
Daily5MRecord.init().catch(err => console.error("Failed to initialize daily_5m_records table:", err));

export default Daily5MRecord;
