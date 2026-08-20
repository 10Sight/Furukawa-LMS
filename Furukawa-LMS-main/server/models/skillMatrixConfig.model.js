import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class SkillMatrixConfig {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId || "GLOBAL"; // Default to GLOBAL if not specific
        this.config = typeof data.config === 'string' ? JSON.parse(data.config) : (data.config || null);
        this.updatedBy = data.updatedBy || null;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        try {
            if (!await migrationHelper.tableExists('skill_matrix_certificate_configs')) {
                await executeQuery(`
                    CREATE TABLE skill_matrix_certificate_configs (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        departmentId VARCHAR(255) DEFAULT 'GLOBAL',
                        config NVARCHAR(MAX) NOT NULL,
                        updatedBy INT,
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        CONSTRAINT uq_smc_config_dept UNIQUE (departmentId)
                    )
                `);
            }

            if (!await migrationHelper.tableExists('skill_matrix_certificate_config_history')) {
                await executeQuery(`
                    CREATE TABLE skill_matrix_certificate_config_history (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        configId INT NOT NULL,
                        departmentId VARCHAR(255),
                        config NVARCHAR(MAX) NOT NULL,
                        remark NVARCHAR(MAX),
                        updatedBy INT,
                        createdAt DATETIME DEFAULT GETDATE()
                    )
                `);
            }
        } catch (error) {
            logger.error("Failed to initialize SkillMatrixConfig tables", error);
        }
    }

    static async findByDepartmentId(departmentId) {
        // Try to find department specific config first, then fallback to GLOBAL
        let [rows] = await executeQuery("SELECT * FROM skill_matrix_certificate_configs WHERE departmentId = ?", [departmentId]);

        if (rows.length === 0) {
            [rows] = await executeQuery("SELECT * FROM skill_matrix_certificate_configs WHERE departmentId = 'GLOBAL'");
        }

        if (rows.length === 0) return null;
        return new SkillMatrixConfig(rows[0]);
    }

    static async upsert(data) {
        const { departmentId, config, updatedBy, remark } = data;

        // Find if exists
        const existing = await executeQuery("SELECT id FROM skill_matrix_certificate_configs WHERE departmentId = ?", [departmentId || 'GLOBAL']);

        let configId;
        if (existing[0].length > 0) {
            configId = existing[0][0].id;
            await executeQuery(
                "UPDATE skill_matrix_certificate_configs SET config = ?, updatedBy = ?, updatedAt = GETDATE() WHERE id = ?",
                [JSON.stringify(config), updatedBy, configId]
            );
        } else {
            const [result] = await executeQuery(
                "INSERT INTO skill_matrix_certificate_configs (departmentId, config, updatedBy) OUTPUT INSERTED.id VALUES (?, ?, ?)",
                [departmentId || 'GLOBAL', JSON.stringify(config), updatedBy]
            );
            configId = result[0].id;
        }

        // Add to history
        await executeQuery(
            "INSERT INTO skill_matrix_certificate_config_history (configId, departmentId, config, remark, updatedBy) VALUES (?, ?, ?, ?, ?)",
            [configId, departmentId || 'GLOBAL', JSON.stringify(config), remark, updatedBy]
        );

        return this.findByDepartmentId(departmentId || 'GLOBAL');
    }

    static async getHistory(departmentId) {
        const query = `
            SELECT h.*, u.fullName as updatedBy 
            FROM skill_matrix_certificate_config_history h
            LEFT JOIN users u ON h.updatedBy = u.id
            WHERE h.departmentId = ? OR h.departmentId = 'GLOBAL'
            ORDER BY h.createdAt DESC
        `;
        const [rows] = await executeQuery(query, [departmentId]);
        return rows;
    }
}

// Initialize tables


export { SkillMatrixConfig };
export default SkillMatrixConfig;
