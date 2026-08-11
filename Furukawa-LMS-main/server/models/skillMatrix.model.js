import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class SkillMatrix {
    constructor(data) {
        this.id = data.id;
        this._id = data.id; // Compatibility

        this.department = data.department;
        this.line = data.line;
        this.month = data.month || null;

        // Complex nested structures stored as JSON
        this.entries = typeof data.entries === 'string' ? JSON.parse(data.entries) : (data.entries || []);
        this.headerInfo = typeof data.headerInfo === 'string' ? JSON.parse(data.headerInfo) : (data.headerInfo || {
            formatNo: "F-HRM-03-001",
            revNo: "8",
            revDate: "03-06-2025",
            pageNo: "1"
        });
        this.footerInfo = typeof data.footerInfo === 'string' ? JSON.parse(data.footerInfo) : (data.footerInfo || {
            guidelines: "",
            legendNote: "",
            revisions: []
        });

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='skill_matrices' and xtype='U')
            BEGIN
                CREATE TABLE skill_matrices (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    department VARCHAR(255) NOT NULL,
                    line VARCHAR(255) NOT NULL,
                    month VARCHAR(7),
                    entries NVARCHAR(MAX),
                    headerInfo NVARCHAR(MAX),
                    footerInfo NVARCHAR(MAX),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT uq_skill_matrix_dept_line_month UNIQUE (department, line, month)
                )
            END
        `;
        try {
            await executeQuery(query);
            await executeQuery(`
                IF COL_LENGTH('skill_matrices', 'month') IS NULL
                BEGIN
                    ALTER TABLE skill_matrices ADD month VARCHAR(7);
                END
            `);
            await executeQuery(`
                UPDATE skill_matrices SET month = FORMAT(createdAt, 'yyyy-MM') WHERE month IS NULL;
            `);
            await executeQuery(`
                IF EXISTS (SELECT 1 FROM sys.objects WHERE type = 'UQ' AND name = 'uq_skill_matrix_dept_line')
                BEGIN
                    ALTER TABLE skill_matrices DROP CONSTRAINT uq_skill_matrix_dept_line;
                END
            `);
            // Existing data may contain duplicate (department, line, month) combinations;
            // keep only the most recently updated row for each combination so the unique
            // constraint below can be created.
            await executeQuery(`
                WITH CTE AS (
                    SELECT id,
                           ROW_NUMBER() OVER (PARTITION BY department, line, month ORDER BY updatedAt DESC, id DESC) as rn
                    FROM skill_matrices
                )
                DELETE FROM skill_matrices
                WHERE id IN (SELECT id FROM CTE WHERE rn > 1);
            `);
            await executeQuery(`
                IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE type = 'UQ' AND name = 'uq_skill_matrix_dept_line_month')
                BEGIN
                    ALTER TABLE skill_matrices
                    ADD CONSTRAINT uq_skill_matrix_dept_line_month UNIQUE (department, line, month);
                END
            `);

            // Migration: month-based schema with full hierarchy columns (section/subSection/station)
            // and a nullable `line`, superseding the dept/line/month-only shape created above.
            await executeQuery(`
                IF COL_LENGTH('skill_matrices', 'section') IS NULL
                    ALTER TABLE skill_matrices ADD section VARCHAR(255);

                IF COL_LENGTH('skill_matrices', 'subSection') IS NULL
                    ALTER TABLE skill_matrices ADD subSection VARCHAR(255);

                IF COL_LENGTH('skill_matrices', 'station') IS NULL
                    ALTER TABLE skill_matrices ADD station VARCHAR(255);
            `);

            // Drop old narrow constraint if present
            await executeQuery(`
                IF EXISTS (SELECT 1 FROM sys.objects WHERE type = 'UQ' AND name = 'uq_skill_matrix_dept_line_month')
                BEGIN
                    ALTER TABLE skill_matrices DROP CONSTRAINT uq_skill_matrix_dept_line_month;
                END
            `);

            // Ensure line is NULLable in DB (we drop the uq_skill_matrix_full_hierarchy constraint if exists, alter line to nullable, then let the unique constraint block recreate it)
            await executeQuery(`
                IF EXISTS (
                    SELECT 1 FROM sys.columns c
                    INNER JOIN sys.objects o ON c.object_id = o.object_id
                    WHERE o.name = 'skill_matrices' AND c.name = 'line' AND c.is_nullable = 0
                )
                BEGIN
                    IF EXISTS (SELECT 1 FROM sys.objects WHERE type = 'UQ' AND name = 'uq_skill_matrix_full_hierarchy')
                    BEGIN
                        ALTER TABLE skill_matrices DROP CONSTRAINT uq_skill_matrix_full_hierarchy;
                    END
                    ALTER TABLE skill_matrices ALTER COLUMN line VARCHAR(255) NULL;
                END
            `);

            // Ensure broad unique constraint exists (including all hierarchy levels)
            await executeQuery(`
                IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE type = 'UQ' AND name = 'uq_skill_matrix_full_hierarchy')
                BEGIN
                    -- First, clean up any existing duplicates that would violate the new constraint
                    -- We keep the most recently updated record for each unique combination
                    WITH CTE AS (
                        SELECT id,
                               ROW_NUMBER() OVER (
                                   PARTITION BY department, section, line, subSection, station, month
                                   ORDER BY updatedAt DESC, id DESC
                               ) AS rn
                        FROM skill_matrices
                    )
                    DELETE FROM skill_matrices WHERE id IN (SELECT id FROM CTE WHERE rn > 1);

                    -- Now add the constraint
                    ALTER TABLE skill_matrices
                    ADD CONSTRAINT uq_skill_matrix_full_hierarchy UNIQUE (department, section, line, subSection, station, month);
                END
            `);
        } catch (error) {
            logger.error("Failed to initialize SkillMatrix table", error);
        }
    }

    static async create(data) {
        const matrix = new SkillMatrix(data);

        if (!matrix.createdAt) matrix.createdAt = new Date();

        const query = `
            INSERT INTO skill_matrices (department, line, month, entries, headerInfo, footerInfo, createdAt)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            matrix.department,
            matrix.line,
            matrix.month,
            JSON.stringify(matrix.entries),
            JSON.stringify(matrix.headerInfo),
            JSON.stringify(matrix.footerInfo),
            matrix.createdAt
        ];

        const [rows] = await executeQuery(query, values);
        return SkillMatrix.findById(rows[0].id);
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM skill_matrices WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new SkillMatrix(rows[0]);
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
        const values = keys.map(key => query[key]);

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM skill_matrices WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new SkillMatrix(rows[0]);
    }

    static async find(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT * FROM skill_matrices";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new SkillMatrix(row));
    }

    static async countDocuments(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT COUNT(*) as count FROM skill_matrices";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows[0].count;
    }

    async save() {
        const fields = ["department", "line", "month", "entries", "headerInfo", "footerInfo"];

        const setClause = fields.map(field => `${field} = ?`).join(", ") + ", updatedAt = GETDATE()";
        const values = fields.map(field => {
            let val = this[field];
            if (['entries', 'headerInfo', 'footerInfo'].includes(field)) {
                return JSON.stringify(val);
            }
            return val;
        });
        values.push(this.id);

        await executeQuery(`UPDATE skill_matrices SET ${setClause} WHERE id = ?`, values);
        return this;
    }
}

// Initialize table
SkillMatrix.init();

export { SkillMatrix };
export default SkillMatrix;
