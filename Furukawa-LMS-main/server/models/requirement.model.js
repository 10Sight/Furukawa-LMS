import { poolPromise } from "../db/connectDB.js";
import logger from "../logger/winston.logger.js";
import migrationHelper from "../db/migrationHelper.js";

const executeSql = async (queryStr, params = []) => {
    const activeConn = await poolPromise;
    const request = activeConn.request();
    let formattedQuery = queryStr;
    for (let i = 0; i < params.length; i++) {
        const paramName = `p${i}`;
        request.input(paramName, params[i]);
        formattedQuery = formattedQuery.replace('?', `@${paramName}`);
    }
    const result = await request.query(formattedQuery);
    return [result.recordset || [], { affectedRows: result.rowsAffected ? result.rowsAffected[0] : 0 }];
};

class Requirement {
    constructor(data) {
        this.id = data.id;
        this.srNo = data.srNo;
        this.sectionCode = data.sectionCode;
        this.sectionName = data.sectionName;
        this.lineCode = data.lineCode;
        this.lineDescription = data.lineDescription;
        this.monthName = data.monthName;
        this.monthNumber = data.monthNumber;
        this.salesPlan = data.salesPlan || 0;
        this.prodPlan = data.prodPlan || 0;
        this.prodPlanFN01 = data.prodPlanFN01 || 0;
        this.prodPlanFN02 = data.prodPlanFN02 || 0;
        this.year = data.year;
        this.is_active = data.is_active !== undefined ? data.is_active : 1; // Default to 1 (active)
        this.createdAt = data.createdAt;
    }

    static async init() {
        try {
            if (!await migrationHelper.tableExists('requirements')) {
                await executeSql(`
                    CREATE TABLE requirements (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        srNo INT,
                        sectionCode VARCHAR(50),
                        sectionName NVARCHAR(510),
                        lineCode VARCHAR(50),
                        lineDescription NVARCHAR(MAX),
                        monthName VARCHAR(15),
                        monthNumber INT,
                        salesPlan FLOAT DEFAULT 0,
                        prodPlan FLOAT DEFAULT 0,
                        prodPlanFN01 FLOAT DEFAULT 0,
                        prodPlanFN02 FLOAT DEFAULT 0,
                        year INT,
                        is_active BIT DEFAULT 1,
                        createdAt DATETIME DEFAULT GETDATE()
                    )
                `);
            } else {
                // Ensure is_active exists if table was already created
                await migrationHelper.ensureColumnExists('requirements', 'is_active', 'BIT DEFAULT 1');
                // Ensure prodPlanFN01 exists if table was already created
                await migrationHelper.ensureColumnExists('requirements', 'prodPlanFN01', 'FLOAT DEFAULT 0');
                // Ensure prodPlanFN02 exists if table was already created
                await migrationHelper.ensureColumnExists('requirements', 'prodPlanFN02', 'FLOAT DEFAULT 0');
                // Ensure monthNumber exists if table was created by an older schema version
                await migrationHelper.ensureColumnExists('requirements', 'monthNumber', 'INT');
                // Ensure monthName exists if table was created by an older schema version
                await migrationHelper.ensureColumnExists('requirements', 'monthName', 'VARCHAR(15)');
                // Ensure year exists if table was created by an older schema version
                await migrationHelper.ensureColumnExists('requirements', 'year', 'INT');
                // Ensure salesPlan exists if table was created by an older schema version
                await migrationHelper.ensureColumnExists('requirements', 'salesPlan', 'FLOAT DEFAULT 0');
                // Ensure prodPlan exists if table was created by an older schema version
                await migrationHelper.ensureColumnExists('requirements', 'prodPlan', 'FLOAT DEFAULT 0');
                // Ensure approval-workflow columns exist (uploadBatchId/approve-reject tracking)
                await migrationHelper.ensureColumnExists('requirements', 'uploadBatchId', 'VARCHAR(100) NULL');
                await migrationHelper.ensureColumnExists('requirements', 'approvalStatus', 'VARCHAR(50) NULL');
                await migrationHelper.ensureColumnExists('requirements', 'approvalSource', 'VARCHAR(50) NULL');
                await migrationHelper.ensureColumnExists('requirements', 'approvedBy', 'NVARCHAR(255) NULL');
                await migrationHelper.ensureColumnExists('requirements', 'approvedByEmail', 'NVARCHAR(255) NULL');
                await migrationHelper.ensureColumnExists('requirements', 'approvedAt', 'DATETIME NULL');
                await migrationHelper.ensureColumnExists('requirements', 'rejectedBy', 'NVARCHAR(255) NULL');
                await migrationHelper.ensureColumnExists('requirements', 'rejectedAt', 'DATETIME NULL');
                await migrationHelper.ensureColumnExists('requirements', 'approvalOwnerName', 'NVARCHAR(255) NULL');
                await migrationHelper.ensureColumnExists('requirements', 'approvalOwnerEmail', 'NVARCHAR(255) NULL');
                await migrationHelper.ensureColumnExists('requirements', 'category', 'NVARCHAR(255) NULL');
                // sectionId + its FK are added together, atomically, only when the column is missing
                await executeSql(`
                    IF COL_LENGTH('requirements', 'sectionId') IS NULL
                    BEGIN
                        ALTER TABLE requirements ADD sectionId INT NULL;
                        ALTER TABLE requirements ADD CONSTRAINT FK_requirements_sections FOREIGN KEY (sectionId) REFERENCES [sections](id) ON DELETE SET NULL;
                    END
                `);
            }

            // Backfill sectionId for existing rows using the same string-matching
            // logic the report queries fall back on, so old rows join reliably too.
            await executeSql(`
                IF COL_LENGTH('requirements', 'sectionId') IS NOT NULL
                BEGIN
                    EXEC('
                        UPDATE r
                        SET r.sectionId = s.id
                        FROM requirements r
                        INNER JOIN [sections] s
                            ON (
                                UPPER(LTRIM(RTRIM(CAST(r.sectionCode AS NVARCHAR(510))))) = UPPER(LTRIM(RTRIM(CAST(s.uniCode AS NVARCHAR(510)))))
                                OR UPPER(LTRIM(RTRIM(CAST(r.sectionName AS NVARCHAR(510))))) = UPPER(LTRIM(RTRIM(CAST(s.name AS NVARCHAR(510)))))
                            )
                        WHERE r.sectionId IS NULL
                    ');
                END
            `);
            logger.info("Requirement table initialized successfully.");
        } catch (err) {
            logger.error("Failed to initialize Requirement table:", err.message);
        }
    }

    static async createOrUpdate(reqData) {
        const {
            srNo, sectionCode, sectionName,
            lineCode, lineDescription,
            monthName, monthNumber,
            salesPlan, prodPlan, prodPlanFN01, prodPlanFN02, year, is_active
        } = reqData;

        const query = `
            MERGE requirements AS target
            USING (
                SELECT ? AS sectionCode, ? AS lineCode, ? AS monthNumber, ? AS year
            ) AS source
            ON target.sectionCode = source.sectionCode 
               AND target.lineCode = source.lineCode 
               AND target.monthNumber = source.monthNumber 
               AND target.year = source.year
            WHEN MATCHED THEN 
                UPDATE SET 
                    srNo = ?, 
                    sectionName = ?, 
                    lineDescription = ?, 
                    monthName = ?, 
                    salesPlan = ?, 
                    prodPlan = ?,
                    prodPlanFN01 = ?,
                    prodPlanFN02 = ?,
                    is_active = ?
            WHEN NOT MATCHED THEN 
                INSERT (srNo, sectionCode, sectionName, lineCode, lineDescription, monthName, monthNumber, salesPlan, prodPlan, prodPlanFN01, prodPlanFN02, year, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;

        const params = [
            // Keys for ON clause
            sectionCode, lineCode, monthNumber, year,
            // Fields for UPDATE
            srNo, sectionName, lineDescription, monthName, salesPlan, prodPlan, prodPlanFN01 || 0, prodPlanFN02 || 0, (is_active !== undefined ? is_active : 1),
            // Fields for INSERT
            srNo, sectionCode, sectionName, lineCode, lineDescription, monthName, monthNumber, salesPlan, prodPlan, prodPlanFN01 || 0, prodPlanFN02 || 0, year, (is_active !== undefined ? is_active : 1)
        ];

        try {
            await executeSql(query, params);
            return new Requirement(reqData);
        } catch (err) {
            logger.error("Error in createOrUpdate Requirement:", err.message);
            throw err;
        }
    }

    static async findById(id) {
        const [rows] = await executeSql("SELECT * FROM requirements WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new Requirement(rows[0]);
    }

    static async findAll(queryObj = {}) {
        const keys = Object.keys(queryObj).filter(key => queryObj[key] !== undefined);
        let sql = "SELECT * FROM requirements";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => queryObj[key]);
        }

        sql += " ORDER BY year DESC, monthNumber DESC";

        const [rows] = await executeSql(sql, values);
        return rows.map(row => new Requirement(row));
    }
}

Requirement.init().catch(err => console.error("Initialization failed:", err));

export default Requirement;