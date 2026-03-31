import { poolPromise } from "../db/connectDB.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

// Helper function to bridge MySQL "?" syntax to MSSQL "@param" syntax
const executeSql = async (queryStr, params = []) => {
    const activeConn = await poolPromise;
    const request = activeConn.request();
    let formattedQuery = queryStr;
    for (let i = 0; i < params.length; i++) {
        const paramName = `p${i}`;
        request.input(paramName, params[i]);
        // Replace first occurrence of '?' with '@paramName'
        formattedQuery = formattedQuery.replace('?', `@${paramName}`);
    }
    const result = await request.query(formattedQuery);
    return [result.recordset || [], { affectedRows: result.rowsAffected ? result.rowsAffected[0] : 0 }];
};

class Requirement {
    constructor(data) {
        this.id = data.id;

        this.sr_no = data.sr_no || data.srNo;
        this.section_id = data.section_id || data.sectionId;
        this.section_code = data.section_code || data.sectionCode || data['Section Code'];
        this.section_name = data.section_name || data.sectionName || data['Section Name'] || data.Section;
        this.section_desc_unicode = data.section_desc_unicode;
        this.description_line = data.description_line || data.subSectionName || data['Sub Section'];
        this.supervisor_name = data.supervisor_name || data.supervisorName || data['Supervisor Name'];
        this.mentor = data.mentor || data['Mentor'];
        this.station_no = data.station_no || data.stationNo || data['Station No.'];
        this.month_name = data.month_name || data.month;
        this.year_val = data.year_val || data.year || data.Year;
        this.sales_plan = data.sales_plan || data.salesPlan || 0;
        this.prod_plan = data.prod_plan || data.prodPlan || 0;
        this.created_at = data.created_at;
    }

    static async init() {
        const createTableQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='requirements' and xtype='U')
            BEGIN
                CREATE TABLE requirements (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    section_id INT,
                    sr_no INT,
                    section_code VARCHAR(50),
                    section_name VARCHAR(255),
                    section_desc_unicode VARCHAR(50),
                    description_line NVARCHAR(MAX),
                    supervisor_name VARCHAR(255),
                    mentor VARCHAR(255),
                    station_no VARCHAR(50),
                    month_name VARCHAR(20),
                    year_val INT,
                    sales_plan FLOAT DEFAULT 0,
                    prod_plan FLOAT DEFAULT 0,
                    created_at DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (section_id) REFERENCES departments(id) ON DELETE SET NULL
                )
            END
        `;
        await executeSql(createTableQuery);

        try {
            const addColsQuery = `
                IF COL_LENGTH('requirements', 'sales_plan') IS NULL
                BEGIN
                    ALTER TABLE requirements ADD sales_plan FLOAT DEFAULT 0;
                END
                IF COL_LENGTH('requirements', 'prod_plan') IS NULL
                BEGIN
                    ALTER TABLE requirements ADD prod_plan FLOAT DEFAULT 0;
                END
            `;
            await executeSql(addColsQuery);
        } catch (error) {
            console.error("Failed to add new plan columns:", error.message);
        }

        const migrateColumns = [
            { name: "section_id", type: "INT" },
            { name: "sr_no", type: "INT" },
            { name: "section_code", type: "VARCHAR(50)" },
            { name: "section_name", type: "VARCHAR(255)" },
            { name: "section_desc_unicode", type: "VARCHAR(50)" },
            { name: "description_line", type: "NVARCHAR(MAX)" },
            { name: "supervisor_name", type: "VARCHAR(255)" },
            { name: "mentor", type: "VARCHAR(255)" },
            { name: "station_no", type: "VARCHAR(50)" },
            { name: "month_name", type: "VARCHAR(20)" },
            { name: "year_val", type: "INT" },
            { name: "sales_plan", type: "FLOAT DEFAULT 0" },
            { name: "prod_plan", type: "FLOAT DEFAULT 0" },
            { name: "created_at", type: "DATETIME DEFAULT GETDATE()" }
        ];

        for (const col of migrateColumns) {
            await migrationHelper.ensureColumnExists('requirements', col.name, col.type);
        }

        try {
            const replaceUniqueKeyQuery = `
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'unique_manpower_req')
                BEGIN
                    ALTER TABLE requirements DROP CONSTRAINT unique_manpower_req;
                END

                ALTER TABLE requirements 
                ADD CONSTRAINT unique_manpower_req UNIQUE (section_code, section_desc_unicode, station_no, month_name, year_val);
            `;
            await executeSql(replaceUniqueKeyQuery);
        } catch (error) {
            console.error("Failed to update unique constraint:", error.message);
        }
    }

    static async createOrUpdate(reqData) {
        const {
            sr_no, section_id, section_code, section_name, section_desc_unicode,
            description_line, supervisor_name, mentor,
            station_no, month_name, year_val, sales_plan, prod_plan
        } = reqData;

        // MSSQL MERGE
        const query = `
            MERGE requirements AS target
            USING (
                SELECT ? AS sr_no, ? AS section_id, ? AS section_code, ? AS section_name, 
                       ? AS section_desc_unicode, ? AS description_line, 
                       ? AS supervisor_name, ? AS mentor, 
                       ? AS station_no, ? AS month_name, ? AS year_val, ? AS sales_plan, ? AS prod_plan
            ) AS source
            ON ISNULL(target.section_code, '') = ISNULL(source.section_code, '') 
               AND ISNULL(target.section_desc_unicode, '') = ISNULL(source.section_desc_unicode, '')
               AND ISNULL(target.station_no, '') = ISNULL(source.station_no, '') 
               AND target.month_name = source.month_name 
               AND target.year_val = source.year_val
            WHEN MATCHED THEN 
                UPDATE SET 
                    sr_no = source.sr_no,
                    section_id = source.section_id,
                    section_name = source.section_name,
                    section_desc_unicode = source.section_desc_unicode,
                    description_line = source.description_line,
                    supervisor_name = source.supervisor_name,
                    mentor = source.mentor,
                    sales_plan = source.sales_plan, 
                    prod_plan = source.prod_plan
            WHEN NOT MATCHED THEN 
                INSERT (sr_no, section_id, section_code, section_name, section_desc_unicode, description_line, supervisor_name, mentor, station_no, month_name, year_val, sales_plan, prod_plan)
                VALUES (source.sr_no, source.section_id, source.section_code, source.section_name, source.section_desc_unicode, source.description_line, source.supervisor_name, source.mentor, source.station_no, source.month_name, source.year_val, source.sales_plan, source.prod_plan);
        `;

        await executeSql(query, [
            sr_no, section_id, section_code, section_name, section_desc_unicode,
            description_line, supervisor_name, mentor,
            station_no, month_name, year_val, sales_plan, prod_plan
        ]);

        return new Requirement(reqData);
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

        const [rows] = await executeSql(sql, values);
        return rows.map(row => new Requirement(row));
    }
}

// Initialize table
Requirement.init().catch(err => console.error("Failed to initialize Requirement table:", err));

export default Requirement;