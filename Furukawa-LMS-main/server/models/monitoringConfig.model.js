import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";

class MonitoringConfig {
    constructor(data) {
        this.id = data.id;
        this.type = data.type; // '3DAY' or '16DAY'
        this.departmentId = data.departmentId;
        this.sectionId = data.sectionId;
        this.lineId = data.lineId;
        this.subSectionId = data.subSectionId;
        this.config = typeof data.config === 'string' ? JSON.parse(data.config) : (data.config || []);
        this.remark = data.remark || "";
        this.updatedBy = data.updatedBy;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        // Create table with VARCHAR for departmentId to support names directly
        if (!await migrationHelper.tableExists('monitoring_configs')) {
            await executeQuery(`
                CREATE TABLE monitoring_configs (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    type VARCHAR(20) NOT NULL, -- '3DAY', '16DAY', '10CYCLE'
                    departmentId VARCHAR(255),
                    sectionId INT DEFAULT 0,
                    lineId INT DEFAULT 0,
                    subSectionId INT DEFAULT 0,
                    config NVARCHAR(MAX) NOT NULL,
                    remark NVARCHAR(MAX),
                    updatedBy VARCHAR(255),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT uc_type_dept_sect_line_sub_monitor UNIQUE (type, departmentId, sectionId, lineId, subSectionId)
                )
            `);
        } else {
            // Ensure sectionId exists
            await migrationHelper.ensureColumnExists('monitoring_configs', 'sectionId', 'INT DEFAULT 0');

            // Ensure lineId/subSectionId exist
            await migrationHelper.ensureColumnExists('monitoring_configs', 'lineId', 'INT DEFAULT 0');
            await migrationHelper.ensureColumnExists('monitoring_configs', 'subSectionId', 'INT DEFAULT 0');

            // Ensure history table exists has sectionId/lineId/subSectionId
            if (!await migrationHelper.tableExists('monitoring_config_history')) {
                await executeQuery(`
                    CREATE TABLE monitoring_config_history (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        configId INT NOT NULL,
                        type VARCHAR(20),
                        departmentId VARCHAR(255),
                        sectionId INT DEFAULT 0,
                        lineId INT DEFAULT 0,
                        subSectionId INT DEFAULT 0,
                        config NVARCHAR(MAX),
                        remark NVARCHAR(MAX),
                        updatedBy VARCHAR(255),
                        updatedAt DATETIME DEFAULT GETDATE()
                    )
                `);
            } else {
                await migrationHelper.ensureColumnExists('monitoring_config_history', 'sectionId', 'INT DEFAULT 0');
                await migrationHelper.ensureColumnExists('monitoring_config_history', 'lineId', 'INT DEFAULT 0');
                await migrationHelper.ensureColumnExists('monitoring_config_history', 'subSectionId', 'INT DEFAULT 0');
            }

            // Update unique constraint to include sectionId
            await executeQuery(`
                IF EXISTS (SELECT * FROM sys.objects WHERE name = 'uc_type_dept_monitor' AND parent_object_id = OBJECT_ID('monitoring_configs'))
                BEGIN
                    ALTER TABLE monitoring_configs DROP CONSTRAINT uc_type_dept_monitor;
                    IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'uc_type_dept_sect_monitor' AND parent_object_id = OBJECT_ID('monitoring_configs'))
                    BEGIN
                        ALTER TABLE monitoring_configs ADD CONSTRAINT uc_type_dept_sect_monitor UNIQUE (type, departmentId, sectionId);
                    END
                END
            `);

            // Update unique constraint to include lineId/subSectionId
            await executeQuery(`
                IF EXISTS (SELECT * FROM sys.objects WHERE name = 'uc_type_dept_sect_monitor' AND parent_object_id = OBJECT_ID('monitoring_configs'))
                BEGIN
                    ALTER TABLE monitoring_configs DROP CONSTRAINT uc_type_dept_sect_monitor;
                    IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'uc_type_dept_sect_line_sub_monitor' AND parent_object_id = OBJECT_ID('monitoring_configs'))
                    BEGIN
                        ALTER TABLE monitoring_configs ADD CONSTRAINT uc_type_dept_sect_line_sub_monitor UNIQUE (type, departmentId, sectionId, lineId, subSectionId);
                    END
                END
            `);

            // MIGRATE departmentId from INT to VARCHAR(255) if necessary
            await executeQuery(`
                IF EXISTS (
                    SELECT 1
                    FROM sys.columns c
                    INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
                    WHERE c.object_id = OBJECT_ID('monitoring_configs')
                      AND c.name = 'departmentId'
                      AND t.name = 'int'
                )
                BEGIN
                    -- Handle existing unique constraint before altering
                    IF EXISTS (SELECT * FROM sys.objects WHERE name = 'uc_type_dept_sect_line_sub_monitor' AND parent_object_id = OBJECT_ID('monitoring_configs'))
                    BEGIN
                        ALTER TABLE monitoring_configs DROP CONSTRAINT uc_type_dept_sect_line_sub_monitor;
                    END
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

                    ALTER TABLE monitoring_configs ADD CONSTRAINT uc_type_dept_sect_line_sub_monitor UNIQUE (type, departmentId, sectionId, lineId, subSectionId);
                END
            `);
        }
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

    // Hierarchical fallback search used by types like '10CYCLE' that key off
    // department/section/line/subSection: most specific match wins, falling
    // back to progressively broader scopes and finally the global template.
    static async findByFilters(type, departmentId, sectionId = 0, lineId = 0, subSectionId = 0) {
        // Priority 1: Specific sub-section config
        if (subSectionId) {
            const [rows] = await executeQuery(
                "SELECT * FROM monitoring_configs WHERE type = ? AND departmentId = ? AND sectionId = ? AND lineId = ? AND subSectionId = ?",
                [type, departmentId, sectionId, lineId, subSectionId]
            );
            if (rows.length > 0) return new MonitoringConfig(rows[0]);
        }

        // Priority 2: Line-level config
        if (lineId) {
            const [rows] = await executeQuery(
                "SELECT * FROM monitoring_configs WHERE type = ? AND departmentId = ? AND sectionId = ? AND lineId = ? AND (subSectionId = 0 OR subSectionId IS NULL)",
                [type, departmentId, sectionId, lineId]
            );
            if (rows.length > 0) return new MonitoringConfig(rows[0]);
        }

        // Priority 3: Section-level config
        if (sectionId) {
            const [rows] = await executeQuery(
                "SELECT * FROM monitoring_configs WHERE type = ? AND departmentId = ? AND sectionId = ? AND (lineId = 0 OR lineId IS NULL) AND (subSectionId = 0 OR subSectionId IS NULL)",
                [type, departmentId, sectionId]
            );
            if (rows.length > 0) return new MonitoringConfig(rows[0]);
        }

        // Priority 4: Department-level config
        if (departmentId) {
            const [rows] = await executeQuery(
                "SELECT * FROM monitoring_configs WHERE type = ? AND departmentId = ? AND (sectionId = 0 OR sectionId IS NULL) AND (lineId = 0 OR lineId IS NULL) AND (subSectionId = 0 OR subSectionId IS NULL)",
                [type, departmentId]
            );
            if (rows.length > 0) return new MonitoringConfig(rows[0]);
        }

        // Priority 5: Global template (departmentId IS NULL)
        const [rows] = await executeQuery(
            "SELECT * FROM monitoring_configs WHERE type = ? AND departmentId IS NULL",
            [type]
        );
        if (rows.length > 0) return new MonitoringConfig(rows[0]);

        return null;
    }

    static async upsert(data) {
        const { type, departmentId, sectionId = 0, lineId = 0, subSectionId = 0, config, remark, updatedBy } = data;
        const configStr = JSON.stringify(config);

        // Check if exists
        const [existing] = await executeQuery(
            "SELECT id FROM monitoring_configs WHERE type = ? AND (departmentId = ? OR (departmentId IS NULL AND ? IS NULL)) AND (sectionId = ? OR (sectionId IS NULL AND ? = 0)) AND (lineId = ? OR (lineId IS NULL AND ? = 0)) AND (subSectionId = ? OR (subSectionId IS NULL AND ? = 0))",
            [type, departmentId, departmentId, sectionId, sectionId, lineId, lineId, subSectionId, subSectionId]
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
                "INSERT INTO monitoring_configs (type, departmentId, sectionId, lineId, subSectionId, config, remark, updatedBy) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [type, departmentId, sectionId, lineId, subSectionId, configStr, remark, updatedBy]
            );
            configId = insertRows[0].id;
        }

        // Add to history
        await executeQuery(
            "INSERT INTO monitoring_config_history (configId, type, departmentId, sectionId, lineId, subSectionId, config, remark, updatedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [configId, type, departmentId, sectionId, lineId, subSectionId, configStr, remark, updatedBy]
        );

        return configId;
    }

    static async getHistory(type, departmentId, sectionId = 0, lineId = 0, subSectionId = 0) {
        const query = `
            SELECT * FROM monitoring_config_history
            WHERE type = ?
            AND (departmentId = ? OR (departmentId IS NULL AND ? IS NULL))
            AND (sectionId = ? OR (sectionId IS NULL AND ? = 0))
            AND (lineId = ? OR (lineId IS NULL AND ? = 0))
            AND (subSectionId = ? OR (subSectionId IS NULL AND ? = 0))
            ORDER BY updatedAt DESC
        `;
        const [rows] = await executeQuery(query, [type, departmentId, departmentId, sectionId, sectionId, lineId, lineId, subSectionId, subSectionId]);
        return rows.map(r => ({
            ...r,
            config: JSON.parse(r.config)
        }));
    }
}

export default MonitoringConfig;
