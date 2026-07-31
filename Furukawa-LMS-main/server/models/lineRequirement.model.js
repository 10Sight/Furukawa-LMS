import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";
import { formatLocalDate } from "../utils/istDate.util.js";

class LineRequirement {
    constructor(data) {
        this.id = data.id;
        this.lineId = data.lineId;
        this.sectionId = data.sectionId;
        this.requirementDate = data.requirementDate instanceof Date
            ? formatLocalDate(data.requirementDate)
            : (data.requirementDate || null);
        this.requirementMonth = data.requirementMonth;
        this.requirementYear = data.requirementYear;
        this.fn01 = data.fn01 || 0;
        this.fn02 = data.fn02 || 0;
        this.quantity = data.quantity || 0;
        this.type = data.type;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'line_requirements')
            BEGIN
                CREATE TABLE line_requirements (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    lineId INT NOT NULL,
                    sectionId INT NULL,
                    requirementDate DATE NULL,
                    requirementMonth INT NULL,
                    requirementYear INT NOT NULL,
                    fn01 INT DEFAULT 0,
                    fn02 INT DEFAULT 0,
                    quantity INT DEFAULT 0,
                    type NVARCHAR(10) NOT NULL CHECK (type IN ('DAILY', 'MONTHLY')),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (lineId) REFERENCES [lines](id) ON DELETE CASCADE,
                    FOREIGN KEY (sectionId) REFERENCES [sections](id) ON DELETE SET NULL,
                    CONSTRAINT unique_line_requirement UNIQUE (lineId, requirementDate, requirementMonth, requirementYear, type)
                );
                CREATE INDEX idx_line_req ON line_requirements(lineId);
                CREATE INDEX idx_date_req ON line_requirements(requirementDate);
            END
            ELSE
            BEGIN
                IF COL_LENGTH('line_requirements', 'fn01') IS NULL
                BEGIN
                    ALTER TABLE line_requirements ADD fn01 INT DEFAULT 0;
                END
                IF COL_LENGTH('line_requirements', 'fn02') IS NULL
                BEGIN
                    ALTER TABLE line_requirements ADD fn02 INT DEFAULT 0;
                END
                IF COL_LENGTH('line_requirements', 'sectionId') IS NULL
                BEGIN
                    ALTER TABLE line_requirements ADD sectionId INT NULL;
                    ALTER TABLE line_requirements ADD CONSTRAINT FK_line_requirements_sections FOREIGN KEY (sectionId) REFERENCES [sections](id) ON DELETE SET NULL;
                END
            END

            -- Ensure any existing records with NULL sectionId are updated to their correct sectionId
            IF COL_LENGTH('line_requirements', 'sectionId') IS NOT NULL
            BEGIN
                EXEC('
                    UPDATE lr
                    SET lr.sectionId = l.sectionId
                    FROM line_requirements lr
                    INNER JOIN [lines] l ON lr.lineId = l.id
                    INNER JOIN [sections] s ON l.sectionId = s.id
                    WHERE lr.sectionId IS NULL
                ');
            END
        `;
        try {
            await executeQuery(query);
            logger.info("LineRequirement table initialized successfully");
        } catch (error) {
            logger.error(`Failed to initialize LineRequirement table: ${error.message}`);
        }
    }

    static async createOrUpdate(data) {
        const { lineId, requirementDate, requirementMonth, requirementYear, fn01, fn02, type } = data;
        const quantity = (fn01 || 0) + (fn02 || 0);

        // Fetch sectionId for the given lineId from lines table, ensuring the section exists
        const [lineRows] = await executeQuery(
            "SELECT l.sectionId FROM [lines] l INNER JOIN [sections] s ON l.sectionId = s.id WHERE l.id = ?",
            [lineId]
        );
        const sectionId = lineRows[0]?.sectionId || null;

        const query = `
            MERGE line_requirements AS target
            USING (
                SELECT ? AS lineId, ? AS requirementDate, ? AS requirementMonth, ? AS requirementYear, ? AS type, ? AS sectionId
            ) AS source
            ON target.lineId = source.lineId
               AND (target.requirementDate = source.requirementDate OR (target.requirementDate IS NULL AND source.requirementDate IS NULL))
               AND (target.requirementMonth = source.requirementMonth OR (target.requirementMonth IS NULL AND source.requirementMonth IS NULL))
               AND target.requirementYear = source.requirementYear
               AND target.type = source.type
            WHEN MATCHED THEN
                UPDATE SET
                    fn01 = ?,
                    fn02 = ?,
                    quantity = ?,
                    sectionId = source.sectionId,
                    updatedAt = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (lineId, sectionId, requirementDate, requirementMonth, requirementYear, fn01, fn02, quantity, type, createdAt, updatedAt)
                VALUES (source.lineId, source.sectionId, source.requirementDate, source.requirementMonth, source.requirementYear, ?, ?, ?, source.type, GETDATE(), GETDATE())
            OUTPUT INSERTED.id;
        `;

        const [result] = await executeQuery(query, [
            lineId, requirementDate || null, requirementMonth || null, requirementYear, type, sectionId,
            fn01 || 0, fn02 || 0, quantity,
            fn01 || 0, fn02 || 0, quantity
        ]);

        const updateLineQuery = `UPDATE [lines] SET requirement = ? WHERE id = ?`;
        await executeQuery(updateLineQuery, [quantity, lineId]);

        return result[0]?.id;
    }

    static async findByFilters(filters) {
        let sql = `
            SELECT lr.*, l.name as lineName, s.name as sectionName, d.name as departmentName
            FROM line_requirements lr
            INNER JOIN [lines] l ON lr.lineId = l.id
            INNER JOIN [sections] s ON l.sectionId = s.id
            INNER JOIN departments d ON l.department = d.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.lineId) { sql += " AND lr.lineId = ?"; params.push(filters.lineId); }
        if (filters.sectionId) { sql += " AND l.sectionId = ?"; params.push(filters.sectionId); }
        if (filters.departmentId) { sql += " AND l.department = ?"; params.push(filters.departmentId); }
        if (filters.type) { sql += " AND lr.type = ?"; params.push(filters.type); }
        if (filters.year) { sql += " AND lr.requirementYear = ?"; params.push(filters.year); }
        if (filters.month) { sql += " AND lr.requirementMonth = ?"; params.push(filters.month); }
        if (filters.date) { sql += " AND lr.requirementDate = ?"; params.push(filters.date); }

        const [rows] = await executeQuery(sql, params);
        return rows.map(row => ({
            ...row,
            requirementDate: row.requirementDate instanceof Date
                ? formatLocalDate(row.requirementDate)
                : row.requirementDate
        }));
    }
}

export default LineRequirement;
