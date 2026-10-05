import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";

class HandoverSheetConfig {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.sectionId = data.sectionId;
        this.config = typeof data.config === 'string' ? JSON.parse(data.config) : (data.config || {});
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        if (!await migrationHelper.tableExists('handover_sheet_configs')) {
            await executeQuery(`
                CREATE TABLE handover_sheet_configs (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId NVARCHAR(255) NOT NULL,
                    sectionId INT,
                    config NVARCHAR(MAX),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT unique_dept_section_hs_config UNIQUE (departmentId, sectionId)
                )
            `);
        }

        // Migration: Add sectionId column if missing
        try {
            await executeQuery("SELECT TOP 1 sectionId FROM handover_sheet_configs");
        } catch (error) {
            try {
                // First drop existing unique constraint on departmentId if it exists
                const [constraints] = await executeQuery(`
                    SELECT name FROM sys.objects 
                    WHERE type = 'UQ' AND parent_object_id = OBJECT_ID('handover_sheet_configs')
                `);
                for (const c of constraints) {
                    await executeQuery(`ALTER TABLE handover_sheet_configs DROP CONSTRAINT ${c.name}`);
                }
                
                await executeQuery("ALTER TABLE handover_sheet_configs ADD sectionId INT");
                await executeQuery("ALTER TABLE handover_sheet_configs ADD CONSTRAINT unique_dept_section_hs_config UNIQUE (departmentId, sectionId)");
                console.log("Migrated handover_sheet_configs to support sectionId");
            } catch (e) { console.error("Migration error hs-config:", e); }
        }

        if (!await migrationHelper.tableExists('handover_sheet_config_history')) {
            await executeQuery(`
                CREATE TABLE handover_sheet_config_history (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId NVARCHAR(255) NOT NULL,
                    sectionId INT,
                    config NVARCHAR(MAX),
                    remark NVARCHAR(MAX),
                    updatedBy NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE()
                )
            `);
            await migrationHelper.ensureIndexExists('handover_sheet_config_history', 'idx_hs_dept_history',
                'CREATE INDEX idx_hs_dept_history ON handover_sheet_config_history(departmentId, sectionId)');
        }

        // Migration: Add sectionId to history if missing
        try {
            await executeQuery("SELECT TOP 1 sectionId FROM handover_sheet_config_history");
        } catch (error) {
            try {
                await executeQuery("ALTER TABLE handover_sheet_config_history ADD sectionId INT");
                console.log("Added sectionId to handover_sheet_config_history");
            } catch (e) { }
        }
        console.log("HandoverSheetConfig tables verified/created in MSSQL.");
    }

    static async findSpecific(departmentId, sectionId = null) {
        let query = "SELECT * FROM handover_sheet_configs WHERE departmentId = ?";
        let params = [departmentId];
        if (sectionId) {
            query += " AND sectionId = ?";
            params.push(sectionId);
        } else {
            query += " AND sectionId IS NULL";
        }
        const [rows] = await executeQuery(query, params);
        if (rows.length === 0) return null;
        return new HandoverSheetConfig(rows[0]);
    }

    static async findByDepartmentId(departmentId) {
        return this.findSpecific(departmentId, null);
    }

    static async upsert(departmentId, configData, remark = "Layout updated", updatedBy = "System", sectionId = null) {
        const configJson = JSON.stringify(configData);

        const query = `
            MERGE INTO handover_sheet_configs AS target
            USING (SELECT ? AS departmentId, ? AS sectionId) AS source
            ON (target.departmentId = source.departmentId AND (target.sectionId = source.sectionId OR (target.sectionId IS NULL AND source.sectionId IS NULL)))
            WHEN MATCHED THEN
                UPDATE SET config = ?, updatedAt = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (departmentId, sectionId, config, createdAt, updatedAt)
                VALUES (?, ?, ?, GETDATE(), GETDATE());
        `;
        await executeQuery(query, [departmentId, sectionId, configJson, departmentId, sectionId, configJson]);

        const historyQuery = `
            INSERT INTO handover_sheet_config_history (departmentId, sectionId, config, remark, updatedBy, createdAt)
            VALUES (?, ?, ?, ?, ?, GETDATE())
        `;
        await executeQuery(historyQuery, [departmentId, sectionId, configJson, remark, updatedBy]);

        return this.findSpecific(departmentId, sectionId);
    }

    static async getHistory(departmentId, limit = 20, sectionId = null) {
        let query = "SELECT TOP (?) * FROM handover_sheet_config_history WHERE departmentId = ?";
        let params = [limit, departmentId];
        if (sectionId) {
            query += " AND sectionId = ?";
            params.push(sectionId);
        } else {
            query += " AND sectionId IS NULL";
        }
        query += " ORDER BY createdAt DESC";
        const [rows] = await executeQuery(query, params);
        return rows.map(r => ({
            ...r,
            config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config
        }));
    }
}


export default HandoverSheetConfig;
