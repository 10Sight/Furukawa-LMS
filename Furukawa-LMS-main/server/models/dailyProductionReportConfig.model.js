import { executeQuery } from "../db/mssqlHelper.js";

class DailyProductionReportConfig {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.config = typeof data.config === 'string' ? JSON.parse(data.config) : (data.config || {});
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        // Main config table
        const configQuery = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'daily_production_report_configs')
            BEGIN
                CREATE TABLE daily_production_report_configs (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId NVARCHAR(255) NOT NULL UNIQUE,
                    config NVARCHAR(MAX),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                )
            END
        `;
        await executeQuery(configQuery);

        // History table for tracking layout changes
        const historyQuery = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'daily_production_report_config_history')
            BEGIN
                CREATE TABLE daily_production_report_config_history (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId NVARCHAR(255) NOT NULL,
                    config NVARCHAR(MAX),
                    remark NVARCHAR(MAX),
                    updatedBy NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE()
                )
                CREATE INDEX idx_dpr_dept_history ON daily_production_report_config_history(departmentId)
            END
        `;
        await executeQuery(historyQuery);
        console.log("DailyProductionReportConfig tables verified/created in MSSQL.");
    }

    static async findByDepartmentId(departmentId) {
        const [rows] = await executeQuery("SELECT * FROM daily_production_report_configs WHERE departmentId = ?", [departmentId]);
        if (rows.length === 0) return null;
        return new DailyProductionReportConfig(rows[0]);
    }

    static async upsert(departmentId, configData, remark = "Layout updated", updatedBy = "System") {
        const configJson = JSON.stringify(configData);

        // Upsert main config using MERGE for MSSQL
        const query = `
            MERGE INTO daily_production_report_configs AS target
            USING (SELECT ? AS departmentId) AS source
            ON (target.departmentId = source.departmentId)
            WHEN MATCHED THEN
                UPDATE SET config = ?, updatedAt = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (departmentId, config, createdAt, updatedAt)
                VALUES (?, ?, GETDATE(), GETDATE());
        `;
        await executeQuery(query, [departmentId, configJson, departmentId, configJson]);

        // Insert history record
        const historyQuery = `
            INSERT INTO daily_production_report_config_history (departmentId, config, remark, updatedBy, createdAt)
            VALUES (?, ?, ?, ?, GETDATE())
        `;
        await executeQuery(historyQuery, [departmentId, configJson, remark, updatedBy]);

        return this.findByDepartmentId(departmentId);
    }

    static async getHistory(departmentId, limit = 20) {
        const query = "SELECT TOP (?) * FROM daily_production_report_config_history WHERE departmentId = ? ORDER BY createdAt DESC";
        const [rows] = await executeQuery(query, [limit, departmentId]);
        // Parse config json strings before returning
        return rows.map(r => ({
            ...r,
            config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config
        }));
    }
}

// Initialize table
DailyProductionReportConfig.init().catch(err => console.error("Failed to initialize daily_production_report_configs table:", err));

export default DailyProductionReportConfig;
