import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class EvaluationTest {
    constructor(data) {
        this.id = data.id;
        this.title = data.title;
        this.performDateCount = data.performDateCount || 4;
        this.processType = data.processType || 'Former process';

        // Dynamic tree structure representing Content -> Categories -> Questions
        this.contentStructure = typeof data.contentStructure === 'string'
            ? JSON.parse(data.contentStructure)
            : (data.contentStructure || []);

        this.departmentId = data.departmentId ?? null;
        this.departmentName = data.departmentName ?? null;

        this.createdBy = data.createdBy;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        try {
            if (!await migrationHelper.tableExists('evaluation_tests')) {
                await executeQuery(`
                    CREATE TABLE evaluation_tests (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        title NVARCHAR(255) NOT NULL,
                        performDateCount INT DEFAULT 4,
                        processType NVARCHAR(255) DEFAULT 'Former process',
                        contentStructure NVARCHAR(MAX),
                        departmentId INT,
                        createdBy NVARCHAR(255),
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        CONSTRAINT fk_evaluation_tests_department FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE SET NULL
                    )
                `);
            } else {
                await migrationHelper.ensureColumnExists('evaluation_tests', 'processType', "NVARCHAR(255) DEFAULT 'Former process'");
                await migrationHelper.ensureColumnExists('evaluation_tests', 'departmentId', 'INT');
                await executeQuery(`
                    IF NOT EXISTS (
                        SELECT * FROM sys.foreign_keys WHERE name = 'fk_evaluation_tests_department'
                    )
                    BEGIN
                        ALTER TABLE evaluation_tests ADD CONSTRAINT fk_evaluation_tests_department
                            FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE SET NULL
                    END
                `);
            }
            logger.info("MSSQL evaluation_tests table initialized successfully.");
        } catch (error) {
            logger.error("Failed to initialize evaluation_tests table", error);
            throw error;
        }
    }

    static async create(data) {
        const query = `
            INSERT INTO evaluation_tests (title, performDateCount, processType, contentStructure, departmentId, createdBy)
            OUTPUT INSERTED.*
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const structureStr = JSON.stringify(data.contentStructure || []);
        const [rows] = await executeQuery(query, [
            data.title,
            data.performDateCount || 4,
            data.processType || 'Former process',
            structureStr,
            data.departmentId ?? null,
            data.createdBy
        ]);
        return await this.findById(rows[0].id);
    }

    static async findById(id) {
        const [rows] = await executeQuery(
            `SELECT et.*, d.name as departmentName
             FROM evaluation_tests et
             LEFT JOIN departments d ON et.departmentId = d.id
             WHERE et.id = ?`,
            [id]
        );
        if (rows.length === 0) return null;
        return new EvaluationTest(rows[0]);
    }

    static async findAll(filters = {}) {
        let query = `
            SELECT ${filters.limit ? `TOP ${parseInt(filters.limit, 10)}` : ''} et.*, d.name as departmentName
            FROM evaluation_tests et
            LEFT JOIN departments d ON et.departmentId = d.id
        `;
        const conditions = [];
        const params = [];
        if (filters.departmentId !== undefined && filters.departmentId !== null) {
            if (filters.includeUnscoped) {
                // Also include tests with no department set (treated as available to any department)
                conditions.push("(et.departmentId IS NULL OR et.departmentId = ?)");
            } else {
                conditions.push("et.departmentId = ?");
            }
            params.push(filters.departmentId);
        }
        if (filters.search) {
            conditions.push("et.title LIKE ?");
            params.push(`%${filters.search}%`);
        }
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(" AND ")}`;
        }
        query += " ORDER BY et.createdAt DESC";

        const [rows] = await executeQuery(query, params);
        return rows.map(row => new EvaluationTest(row));
    }

    static async update(id, data) {
        const fields = [];
        const values = [];

        if (data.title !== undefined) {
            fields.push("title = ?");
            values.push(data.title);
        }
        if (data.performDateCount !== undefined) {
            fields.push("performDateCount = ?");
            values.push(data.performDateCount);
        }
        if (data.processType !== undefined) {
            fields.push("processType = ?");
            values.push(data.processType);
        }
        if (data.contentStructure !== undefined) {
            fields.push("contentStructure = ?");
            values.push(JSON.stringify(data.contentStructure));
        }
        if (data.departmentId !== undefined) {
            fields.push("departmentId = ?");
            values.push(data.departmentId);
        }

        if (fields.length === 0) return await this.findById(id);

        const query = `
            UPDATE evaluation_tests 
            SET ${fields.join(",")}, updatedAt = GETDATE()
            WHERE id = ?
        `;
        values.push(id);

        await executeQuery(query, values);
        return await this.findById(id);
    }

    static async delete(id) {
        await executeQuery("DELETE FROM evaluation_tests WHERE id = ?", [id]);
        return true;
    }
}

export default EvaluationTest;
