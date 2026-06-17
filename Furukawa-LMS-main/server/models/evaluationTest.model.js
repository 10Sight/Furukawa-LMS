import { executeQuery } from "../db/mssqlHelper.js";
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

        this.createdBy = data.createdBy;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_tests' AND xtype='U')
            BEGIN
                CREATE TABLE evaluation_tests (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    title NVARCHAR(255) NOT NULL,
                    performDateCount INT DEFAULT 4,
                    processType NVARCHAR(255) DEFAULT 'Former process',
                    contentStructure NVARCHAR(MAX),
                    createdBy NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                )
            END
            ELSE
            BEGIN
                IF COL_LENGTH('evaluation_tests', 'processType') IS NULL
                BEGIN
                    ALTER TABLE evaluation_tests ADD processType NVARCHAR(255) DEFAULT 'Former process'
                END
            END
        `;
        try {
            await executeQuery(query);
            logger.info("MSSQL evaluation_tests table initialized successfully.");
        } catch (error) {
            logger.error("Failed to initialize evaluation_tests table", error);
            throw error;
        }
    }

    static async create(data) {
        const query = `
            INSERT INTO evaluation_tests (title, performDateCount, processType, contentStructure, createdBy)
            OUTPUT INSERTED.*
            VALUES (?, ?, ?, ?, ?)
        `;
        const structureStr = JSON.stringify(data.contentStructure || []);
        const [rows] = await executeQuery(query, [
            data.title,
            data.performDateCount || 4,
            data.processType || 'Former process',
            structureStr,
            data.createdBy
        ]);
        return new EvaluationTest(rows[0]);
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM evaluation_tests WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new EvaluationTest(rows[0]);
    }

    static async findAll() {
        const [rows] = await executeQuery("SELECT * FROM evaluation_tests ORDER BY createdAt DESC");
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
