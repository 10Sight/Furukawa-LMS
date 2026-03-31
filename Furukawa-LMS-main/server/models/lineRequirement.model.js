import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class LineRequirement {
    constructor(data) {
        this.id = data.id;
        this.lineId = data.lineId;
        this.requirementDate = data.requirementDate;
        this.requirementMonth = data.requirementMonth;
        this.requirementYear = data.requirementYear;
        this.quantity = data.quantity || 0;
        this.type = data.type; // 'DAILY' or 'MONTHLY'
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
                    requirementDate DATE NULL,
                    requirementMonth INT NULL,
                    requirementYear INT NOT NULL,
                    quantity INT DEFAULT 0,
                    type NVARCHAR(10) NOT NULL CHECK (type IN ('DAILY', 'MONTHLY')),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (lineId) REFERENCES [lines](id) ON DELETE CASCADE,
                    CONSTRAINT unique_line_requirement UNIQUE (lineId, requirementDate, requirementMonth, requirementYear, type)
                );
                CREATE INDEX idx_line_req ON line_requirements(lineId);
                CREATE INDEX idx_date_req ON line_requirements(requirementDate);
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
        const { lineId, requirementDate, requirementMonth, requirementYear, quantity, type } = data;
        
        const query = `
            MERGE line_requirements AS target
            USING (
                SELECT ? AS lineId, ? AS requirementDate, ? AS requirementMonth, ? AS requirementYear, ? AS type
            ) AS source
            ON target.lineId = source.lineId 
               AND (target.requirementDate = source.requirementDate OR (target.requirementDate IS NULL AND source.requirementDate IS NULL))
               AND (target.requirementMonth = source.requirementMonth OR (target.requirementMonth IS NULL AND source.requirementMonth IS NULL))
               AND target.requirementYear = source.requirementYear
               AND target.type = source.type
            WHEN MATCHED THEN
                UPDATE SET 
                    quantity = ?,
                    updatedAt = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (lineId, requirementDate, requirementMonth, requirementYear, quantity, type, createdAt, updatedAt)
                VALUES (source.lineId, source.requirementDate, source.requirementMonth, source.requirementYear, ?, source.type, GETDATE(), GETDATE())
            OUTPUT INSERTED.id;
        `;

        const [result] = await executeQuery(query, [
            lineId, requirementDate || null, requirementMonth || null, requirementYear, type,
            quantity, quantity
        ]);

        // Also update the main lines table for consistency with existing UI
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
        return rows;
    }
}

export default LineRequirement;
