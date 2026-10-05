import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";
import { formatLocalDate } from "../utils/istDate.util.js";
import migrationHelper from "../db/migrationHelper.js";

class LineRequirementHistory {
    constructor(data) {
        this.id = data.id;
        this.lineId = data.lineId;
        this.oldFn01 = data.oldFn01;
        this.newFn01 = data.newFn01;
        this.oldFn02 = data.oldFn02;
        this.newFn02 = data.newFn02;
        this.oldQuantity = data.oldQuantity;
        this.newQuantity = data.newQuantity;
        this.type = data.type;
        this.requirementDate = data.requirementDate instanceof Date
            ? formatLocalDate(data.requirementDate)
            : (data.requirementDate || null);
        this.requirementMonth = data.requirementMonth;
        this.requirementYear = data.requirementYear;
        this.changedBy = data.changedBy;
        this.createdAt = data.createdAt;
    }

    static async init() {
        try {
            if (!await migrationHelper.tableExists('line_requirement_history')) {
                await executeQuery(`
                    CREATE TABLE line_requirement_history (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        lineId INT NOT NULL,
                        oldFn01 INT NULL,
                        newFn01 INT NOT NULL DEFAULT 0,
                        oldFn02 INT NULL,
                        newFn02 INT NOT NULL DEFAULT 0,
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
                    )
                `);
                await migrationHelper.ensureIndexExists('line_requirement_history', 'idx_line_history',
                    'CREATE INDEX idx_line_history ON line_requirement_history(lineId)');
            } else {
                await migrationHelper.ensureColumnExists('line_requirement_history', 'oldFn01', 'INT NULL');
                await migrationHelper.ensureColumnExists('line_requirement_history', 'newFn01', 'INT NULL');
                await migrationHelper.ensureColumnExists('line_requirement_history', 'oldFn02', 'INT NULL');
                await migrationHelper.ensureColumnExists('line_requirement_history', 'newFn02', 'INT NULL');
            }
            logger.info("LineRequirementHistory table initialized successfully");
        } catch (error) {
            logger.error(`Failed to initialize LineRequirementHistory table: ${error.message}`);
        }
    }

    static async create(data) {
        const {
            lineId, oldFn01, newFn01, oldFn02, newFn02,
            oldQuantity, newQuantity, type,
            requirementDate, requirementMonth, requirementYear, changedBy
        } = data;
        const query = `
            INSERT INTO line_requirement_history
            (lineId, oldFn01, newFn01, oldFn02, newFn02, oldQuantity, newQuantity, type, requirementDate, requirementMonth, requirementYear, changedBy, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
        `;
        await executeQuery(query, [
            lineId,
            oldFn01 ?? 0, newFn01 ?? 0,
            oldFn02 ?? 0, newFn02 ?? 0,
            oldQuantity ?? 0, newQuantity ?? 0,
            type,
            requirementDate || null, requirementMonth || null, requirementYear,
            changedBy
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
        return rows.map(row => ({
            ...row,
            requirementDate: row.requirementDate instanceof Date
                ? formatLocalDate(row.requirementDate)
                : row.requirementDate
        }));
    }
}

export default LineRequirementHistory;
