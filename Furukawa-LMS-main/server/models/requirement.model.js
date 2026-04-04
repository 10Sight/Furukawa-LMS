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
        this.year = data.year;
        this.createdAt = data.createdAt;
    }

    static async init() {
        // Table creation logic optimized for the new structure
        const createTableQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='requirements' and xtype='U')
            BEGIN
                CREATE TABLE requirements (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    srNo INT,
                    sectionCode VARCHAR(50),
                    sectionName NVARCHAR(255),
                    lineCode VARCHAR(50),
                    lineDescription NVARCHAR(MAX),
                    monthName VARCHAR(15),
                    monthNumber INT,
                    salesPlan FLOAT DEFAULT 0,
                    prodPlan FLOAT DEFAULT 0,
                    year INT,
                    createdAt DATETIME DEFAULT GETDATE()
                )
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
            salesPlan, prodPlan, year
        } = reqData;

        // MSSQL MERGE logic updated to match new unique keys (section, line, month, year)
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
                    prodPlan = ?
            WHEN NOT MATCHED THEN 
                INSERT (srNo, sectionCode, sectionName, lineCode, lineDescription, monthName, monthNumber, salesPlan, prodPlan, year)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;

        const params = [
            // ON clause mapping
            sectionCode, lineCode, monthNumber, year,
            // UPDATE values
            srNo, sectionName, lineDescription, monthName, salesPlan, prodPlan,
            // INSERT values
            srNo, sectionCode, sectionName, lineCode, lineDescription, monthName, monthNumber, salesPlan, prodPlan, year
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

// Auto-init on load
Requirement.init().catch(err => console.error("Initialization failed:", err));

export default Requirement;