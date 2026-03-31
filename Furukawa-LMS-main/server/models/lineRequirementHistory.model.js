import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class LineRequirementHistory {
    constructor(data) {
        this.id = data.id;
        this.lineId = data.lineId;
        this.oldQuantity = data.oldQuantity;
        this.newQuantity = data.newQuantity;
        this.type = data.type;
        this.requirementDate = data.requirementDate;
        this.requirementMonth = data.requirementMonth;
        this.requirementYear = data.requirementYear;
        this.changedBy = data.changedBy;
        this.createdAt = data.createdAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'line_requirement_history')
            BEGIN
                CREATE TABLE line_requirement_history (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    lineId INT NOT NULL,
                    oldQuantity INT,
                    newQuantity INT NOT NULL,
                    type NVARCHAR(10) NOT NULL,
                    requirementDate DATE,
                    requirementMonth INT,
                    requirementYear INT,
                    changedBy INT,
                    createdAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (lineId) REFERENCES [lines](id) ON DELETE CASCADE,
                    FOREIGN KEY (changedBy) REFERENCES users(id) ON DELETE SET NULL
                );
                CREATE INDEX idx_line_history ON line_requirement_history(lineId);
            END
        `;
        try {
            await executeQuery(query);
            logger.info("LineRequirementHistory table initialized successfully");
        } catch (error) {
            logger.error(`Failed to initialize LineRequirementHistory table: ${error.message}`);
        }
    }

    static async create(data) {
        const { lineId, oldQuantity, newQuantity, type, requirementDate, requirementMonth, requirementYear, changedBy } = data;
        const query = `
            INSERT INTO line_requirement_history 
            (lineId, oldQuantity, newQuantity, type, requirementDate, requirementMonth, requirementYear, changedBy, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
        `;
        await executeQuery(query, [
            lineId, oldQuantity, newQuantity, type, requirementDate || null, requirementMonth || null, requirementYear, changedBy
        ]);
    }

    static async findByLine(lineId) {
        const query = `
            SELECT h.*, u.fullName as changedByName
            FROM line_requirement_history h
            LEFT JOIN users u ON h.changedBy = u.id
            WHERE h.lineId = ?
            ORDER BY h.createdAt DESC
        `;
        const [rows] = await executeQuery(query, [lineId]);
        return rows;
    }
}

export default LineRequirementHistory;
