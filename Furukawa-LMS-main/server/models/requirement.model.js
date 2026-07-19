import { poolPromise } from "../db/connectDB.js";
import logger from "../logger/winston.logger.js";

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
        const createTableQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='requirements' and xtype='U')
            BEGIN
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
            END
            ELSE
            BEGIN
                -- Ensure is_active exists if table was already created
                IF COL_LENGTH('requirements', 'is_active') IS NULL
                BEGIN
                    ALTER TABLE requirements ADD is_active BIT DEFAULT 1;
                END
                -- Ensure prodPlanFN01 exists if table was already created
                IF COL_LENGTH('requirements', 'prodPlanFN01') IS NULL
                BEGIN
                    ALTER TABLE requirements ADD prodPlanFN01 FLOAT DEFAULT 0;
                END
                -- Ensure prodPlanFN02 exists if table was already created
                IF COL_LENGTH('requirements', 'prodPlanFN02') IS NULL
                BEGIN
                    ALTER TABLE requirements ADD prodPlanFN02 FLOAT DEFAULT 0;
                END
                -- Ensure monthNumber exists if table was created by an older schema version
                IF COL_LENGTH('requirements', 'monthNumber') IS NULL
                BEGIN
                    ALTER TABLE requirements ADD monthNumber INT;
                END
                -- Ensure monthName exists if table was created by an older schema version
                IF COL_LENGTH('requirements', 'monthName') IS NULL
                BEGIN
                    ALTER TABLE requirements ADD monthName VARCHAR(15);
                END
                -- Ensure year exists if table was created by an older schema version
                IF COL_LENGTH('requirements', 'year') IS NULL
                BEGIN
                    ALTER TABLE requirements ADD year INT;
                END
                -- Ensure salesPlan exists if table was created by an older schema version
                IF COL_LENGTH('requirements', 'salesPlan') IS NULL
                BEGIN
                    ALTER TABLE requirements ADD salesPlan FLOAT DEFAULT 0;
                END
                -- Ensure prodPlan exists if table was created by an older schema version
                IF COL_LENGTH('requirements', 'prodPlan') IS NULL
                BEGIN
                    ALTER TABLE requirements ADD prodPlan FLOAT DEFAULT 0;
                END
            END
        `;
        try {
            await executeSql(createTableQuery);
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