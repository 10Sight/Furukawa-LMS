import { executeQuery } from "../db/mssqlHelper.js";

class MonitoringConfig {
    constructor(data) {
        this.id = data.id;
        this.type = data.type; // '3DAY' or '16DAY'
        this.departmentId = data.departmentId;
        this.config = typeof data.config === 'string' ? JSON.parse(data.config) : (data.config || []);
        this.remark = data.remark || "";
        this.updatedBy = data.updatedBy;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        // Create table with VARCHAR for departmentId to support names directly
        const createTableQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='monitoring_configs' and xtype='U')
            BEGIN
                CREATE TABLE monitoring_configs (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    type VARCHAR(20) NOT NULL, -- '3DAY', '16DAY'
                    departmentId VARCHAR(255),
                    config NVARCHAR(MAX) NOT NULL,
                    remark NVARCHAR(MAX),
                    updatedBy VARCHAR(255),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT uc_type_dept_monitor UNIQUE (type, departmentId)
                )
            END
            ELSE
            BEGIN
                -- MIGRATE departmentId from INT to VARCHAR(255) if necessary (e.g. from previous deployment)
                IF (SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'monitoring_configs' AND COLUMN_NAME = 'departmentId') = 'int'
                BEGIN
                    ALTER TABLE monitoring_configs DROP CONSTRAINT uc_type_dept_monitor;
                    ALTER TABLE monitoring_configs ALTER COLUMN departmentId VARCHAR(255);
                    ALTER TABLE monitoring_configs ADD CONSTRAINT uc_type_dept_monitor UNIQUE (type, departmentId);
                    
                    ALTER TABLE monitoring_config_history ALTER COLUMN departmentId VARCHAR(255);
                END
            END

            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='monitoring_config_history' and xtype='U')
            BEGIN
                CREATE TABLE monitoring_config_history (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    configId INT NOT NULL,
                    type VARCHAR(20),
                    departmentId VARCHAR(255),
                    config NVARCHAR(MAX),
                    remark NVARCHAR(MAX),
                    updatedBy VARCHAR(255),
                    updatedAt DATETIME DEFAULT GETDATE()
                )
            END
        `;
        await executeQuery(createTableQuery);
    }

    static async findByTypeAndDepartment(type, departmentId) {
        // First try department specific config
        let [rows] = await executeQuery(
            "SELECT * FROM monitoring_configs WHERE type = ? AND departmentId = ?",
            [type, departmentId]
        );

        if (rows.length === 0) {
            // Try global config (departmentId IS NULL)
            [rows] = await executeQuery(
                "SELECT * FROM monitoring_configs WHERE type = ? AND departmentId IS NULL",
                [type]
            );
        }

        if (rows.length === 0) return null;
        return new MonitoringConfig(rows[0]);
    }

    static async upsert(data) {
        const { type, departmentId, config, remark, updatedBy } = data;
        const configStr = JSON.stringify(config);

        // Check if exists
        const [existing] = await executeQuery(
            "SELECT id FROM monitoring_configs WHERE type = ? AND (departmentId = ? OR (departmentId IS NULL AND ? IS NULL))",
            [type, departmentId, departmentId]
        );

        let configId;
        if (existing.length > 0) {
            configId = existing[0].id;
            await executeQuery(
                "UPDATE monitoring_configs SET config = ?, remark = ?, updatedBy = ?, updatedAt = GETDATE() WHERE id = ?",
                [configStr, remark, updatedBy, configId]
            );
        } else {
            const [insertRows] = await executeQuery(
                "INSERT INTO monitoring_configs (type, departmentId, config, remark, updatedBy) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?)",
                [type, departmentId, configStr, remark, updatedBy]
            );
            configId = insertRows[0].id;
        }

        // Add to history
        await executeQuery(
            "INSERT INTO monitoring_config_history (configId, type, departmentId, config, remark, updatedBy) VALUES (?, ?, ?, ?, ?, ?)",
            [configId, type, departmentId, configStr, remark, updatedBy]
        );

        return configId;
    }

    static async getHistory(type, departmentId) {
        const query = `
            SELECT * FROM monitoring_config_history 
            WHERE type = ? AND (departmentId = ? OR (departmentId IS NULL AND ? IS NULL))
            ORDER BY updatedAt DESC
        `;
        const [rows] = await executeQuery(query, [type, departmentId, departmentId]);
        return rows.map(r => ({
            ...r,
            config: JSON.parse(r.config)
        }));
    }
}

export default MonitoringConfig;
