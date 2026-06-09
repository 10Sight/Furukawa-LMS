import { poolPromise } from "../db/connectDB.js";
import logger from "../logger/winston.logger.js";

const executeSql = async (queryStr, params = [], transactionOrPool = null) => {
    const activeConn = transactionOrPool || await poolPromise;
    const request = activeConn.request();
    let formattedQuery = queryStr;
    for (let i = 0; i < params.length; i++) {
        const paramName = `p${i}`;
        request.input(paramName, params[i]);
        formattedQuery = formattedQuery.replace('?', `@${paramName}`);
    }
    const result = await request.query(formattedQuery);
    return [result.recordset || [], {
        affectedRows: result.rowsAffected ? result.rowsAffected.reduce((a, b) => a + b, 0) : 0,
        insertId: result.recordset && result.recordset.length > 0 && result.recordset[0].log_id ? result.recordset[0].log_id : null
    }];
};

const RequirementLog = {
    async init() {
        const createTableQuery = `
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[requriementLogs]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[requriementLogs] (
                    log_id INT IDENTITY(1,1) PRIMARY KEY,
                    requirement_id INT NOT NULL,
                    section_id INT NULL,
                    old_values NVARCHAR(MAX),
                    new_values NVARCHAR(MAX),
                    employee_id INT NULL,
                    employee_role NVARCHAR(50),
                    created_at DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_requriementLogs_requirements FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE
                )
            END
        `;

        const migrationQuery = `
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'requriementLogs')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('requriementLogs') AND name = 'section_id')
                    ALTER TABLE [dbo].[requriementLogs] ADD section_id INT NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('requriementLogs') AND name = 'old_values')
                    ALTER TABLE [dbo].[requriementLogs] ADD old_values NVARCHAR(MAX);
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('requriementLogs') AND name = 'new_values')
                    ALTER TABLE [dbo].[requriementLogs] ADD new_values NVARCHAR(MAX);
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('requriementLogs') AND name = 'created_at')
                    ALTER TABLE [dbo].[requriementLogs] ADD created_at DATETIME DEFAULT GETDATE();
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('requriementLogs') AND name = 'employee_id')
                    ALTER TABLE [dbo].[requriementLogs] ADD employee_id INT NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('requriementLogs') AND name = 'employee_role')
                    ALTER TABLE [dbo].[requriementLogs] ADD employee_role NVARCHAR(50);
            END
        `;

        try {
            await executeSql(createTableQuery);
            await executeSql(migrationQuery);
            logger.info("requriementLogs table and schema verified");
        } catch (error) {
            logger.error("Failed to initialize/migrate requriementLogs table", error);
        }
    },

    async create(logData, transaction = null) {
        let { requirement_id, section_id, old_values, new_values, employee_id, employee_role } = logData;

        const safeJson = (val) => (typeof val === 'string' ? val : JSON.stringify(val || {}));

        // Use absolute universally parsed UTC ISO string representation
        const utcIsoString = new Date().toISOString();

        const query = `
            INSERT INTO requriementLogs 
            (requirement_id, section_id, old_values, new_values, employee_id, employee_role, created_at)
            OUTPUT INSERTED.log_id
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        try {
            const [result, meta] = await executeSql(query, [
                requirement_id,
                section_id || null,
                safeJson(old_values),
                safeJson(new_values),
                employee_id || null,
                employee_role || null,
                utcIsoString
            ], transaction);

            return { log_id: meta.insertId, ...logData };
        } catch (error) {
            logger.error("Failed to create audit log in requriementLogs", error);
            throw error;
        }
    },

    async getLogs(filters = {}, options = {}) {
        const { requirement_id } = filters;
        const limit = Number(options.limit ?? 200);
        const offset = Number(options.offset ?? 0);

        let query = `
            SELECT 
                l.*,
                COALESCE(u.fullName, 'Unknown') as user_name,
                u.email as user_email,
                u.avatar as user_avatar,
                d.name as section_name
            FROM requriementLogs l
            LEFT JOIN users u ON l.employee_id = u.id
            LEFT JOIN [sections] d ON l.section_id = d.id
            WHERE 1=1
        `;

        const params = [];

        if (requirement_id) {
            query += ` AND l.requirement_id = ?`;
            params.push(requirement_id);
        }

        // MSSQL Pagination
        query += ` ORDER BY l.created_at DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
        params.push(offset, limit);

        const [rows] = await executeSql(query, params);

        return rows.map(r => {
            let oldV = r.old_values;
            let newV = r.new_values;
            try { if (typeof oldV === 'string') oldV = JSON.parse(oldV); } catch (e) { }
            try { if (typeof newV === 'string') newV = JSON.parse(newV); } catch (e) { }

            return {
                ...r,
                old_values: oldV,
                new_values: newV
            };
        });
    }
};

RequirementLog.init();

export default RequirementLog;