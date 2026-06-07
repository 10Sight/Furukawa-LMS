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
                    sectionId INT DEFAULT 0,
                    config NVARCHAR(MAX) NOT NULL,
                    remark NVARCHAR(MAX),
                    updatedBy VARCHAR(255),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT uc_type_dept_sect_monitor UNIQUE (type, departmentId, sectionId)
                )
            END
            ELSE
            BEGIN
                -- Ensure sectionId exists
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('monitoring_configs') AND name = 'sectionId')
                BEGIN
                    ALTER TABLE monitoring_configs ADD sectionId INT DEFAULT 0;
                END

                -- Ensure history table exists has sectionId
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='monitoring_config_history' and xtype='U')
                BEGIN
                    CREATE TABLE monitoring_config_history (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        configId INT NOT NULL,
                        type VARCHAR(20),
                        departmentId VARCHAR(255),
                        sectionId INT DEFAULT 0,
                        config NVARCHAR(MAX),
                        remark NVARCHAR(MAX),
                        updatedBy VARCHAR(255),
                        updatedAt DATETIME DEFAULT GETDATE()
                    )
                END
                ELSE IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('monitoring_config_history') AND name = 'sectionId')
                BEGIN
                    ALTER TABLE monitoring_config_history ADD sectionId INT DEFAULT 0;
                END

                -- Update unique constraint to include sectionId
                IF EXISTS (SELECT * FROM sys.objects WHERE name = 'uc_type_dept_monitor' AND parent_object_id = OBJECT_ID('monitoring_configs'))
                BEGIN
                    ALTER TABLE monitoring_configs DROP CONSTRAINT uc_type_dept_monitor;
                    IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'uc_type_dept_sect_monitor' AND parent_object_id = OBJECT_ID('monitoring_configs'))
                    BEGIN
                        ALTER TABLE monitoring_configs ADD CONSTRAINT uc_type_dept_sect_monitor UNIQUE (type, departmentId, sectionId);
                    END
                END
                
                -- MIGRATE departmentId from INT to VARCHAR(255) if necessary
                IF (SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'monitoring_configs' AND COLUMN_NAME = 'departmentId') = 'int'
                BEGIN
                    -- Handle existing unique constraint before altering
                    IF EXISTS (SELECT * FROM sys.objects WHERE name = 'uc_type_dept_sect_monitor' AND parent_object_id = OBJECT_ID('monitoring_configs'))
                    BEGIN
                        ALTER TABLE monitoring_configs DROP CONSTRAINT uc_type_dept_sect_monitor;
                    END
                    IF EXISTS (SELECT * FROM sys.objects WHERE name = 'uc_type_dept_monitor' AND parent_object_id = OBJECT_ID('monitoring_configs'))
                    BEGIN
                        ALTER TABLE monitoring_configs DROP CONSTRAINT uc_type_dept_monitor;
                    END

                    ALTER TABLE monitoring_configs ALTER COLUMN departmentId VARCHAR(255);
                    ALTER TABLE monitoring_config_history ALTER COLUMN departmentId VARCHAR(255);

                    ALTER TABLE monitoring_configs ADD CONSTRAINT uc_type_dept_sect_monitor UNIQUE (type, departmentId, sectionId);
                END
            END
        `;
        await executeQuery(createTableQuery);
    }

    static async findByTypeAndDepartment(type, departmentId, sectionId = 0) {
        // Priority 1: Specific Section config
        let [rows] = await executeQuery(
            "SELECT * FROM monitoring_configs WHERE type = ? AND departmentId = ? AND sectionId = ?",
            [type, departmentId, sectionId]
        );

        // Priority 2: Department-wide config (sectionId 0)
        if (rows.length === 0 && sectionId != 0) {
            [rows] = await executeQuery(
                "SELECT * FROM monitoring_configs WHERE type = ? AND departmentId = ? AND (sectionId = 0 OR sectionId IS NULL)",
                [type, departmentId]
            );
        }

        // Priority 3: Global config (departmentId IS NULL)
        if (rows.length === 0) {
            [rows] = await executeQuery(
                "SELECT * FROM monitoring_configs WHERE type = ? AND departmentId IS NULL",
                [type]
            );
        }

        if (rows.length === 0) return null;
        return new MonitoringConfig(rows[0]);
    }

    static async upsert(data) {
        const { type, departmentId, sectionId = 0, config, remark, updatedBy } = data;
        const configStr = JSON.stringify(config);

        // Check if exists
        const [existing] = await executeQuery(
            "SELECT id FROM monitoring_configs WHERE type = ? AND (departmentId = ? OR (departmentId IS NULL AND ? IS NULL)) AND (sectionId = ? OR (sectionId IS NULL AND ? = 0))",
            [type, departmentId, departmentId, sectionId, sectionId]
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
                "INSERT INTO monitoring_configs (type, departmentId, sectionId, config, remark, updatedBy) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, ?)",
                [type, departmentId, sectionId, configStr, remark, updatedBy]
            );
            configId = insertRows[0].id;
        }

        // Add to history
        await executeQuery(
            "INSERT INTO monitoring_config_history (configId, type, departmentId, sectionId, config, remark, updatedBy) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [configId, type, departmentId, sectionId, configStr, remark, updatedBy]
        );

        return configId;
    }

    static async getHistory(type, departmentId, sectionId = 0) {
        const query = `
            SELECT * FROM monitoring_config_history 
            WHERE type = ? 
            AND (departmentId = ? OR (departmentId IS NULL AND ? IS NULL))
            AND (sectionId = ? OR (sectionId IS NULL AND ? = 0))
            ORDER BY updatedAt DESC
        `;
        const [rows] = await executeQuery(query, [type, departmentId, departmentId, sectionId, sectionId]);
        return rows.map(r => ({
            ...r,
            config: JSON.parse(r.config)
        }));
    }
}

export default MonitoringConfig;
