import { executeQuery } from "../db/mssqlHelper.js";

class MultiSkillingPlanConfig {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.config = typeof data.config === 'string' ? JSON.parse(data.config) : (data.config || {});
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const configTableQuery = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'multi_skilling_plan_configs')
            BEGIN
                CREATE TABLE multi_skilling_plan_configs (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId NVARCHAR(255) NOT NULL UNIQUE,
                    config NVARCHAR(MAX),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                )
            END
        `;
        await executeQuery(configTableQuery);

        const historyTableQuery = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'multi_skilling_plan_config_history')
            BEGIN
                CREATE TABLE multi_skilling_plan_config_history (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId NVARCHAR(255) NOT NULL,
                    config NVARCHAR(MAX),
                    remark NVARCHAR(MAX),
                    updatedBy NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE()
                )
                CREATE INDEX idx_ms_dept_history ON multi_skilling_plan_config_history(departmentId)
            END
        `;
        await executeQuery(historyTableQuery);
        console.log("MultiSkillingPlanConfig tables verified/created in MSSQL.");
    }

    static async findByDepartmentId(departmentId) {
        const [rows] = await executeQuery("SELECT * FROM multi_skilling_plan_configs WHERE departmentId = ?", [departmentId]);
        if (rows.length === 0) return null;
        return new MultiSkillingPlanConfig(rows[0]);
    }

    static async upsert(departmentId, configData, remark = "Layout updated", updatedBy = "System") {
        const configJson = JSON.stringify(configData);

        const query = `
            MERGE INTO multi_skilling_plan_configs AS target
            USING (SELECT ? AS departmentId) AS source
            ON (target.departmentId = source.departmentId)
            WHEN MATCHED THEN
                UPDATE SET config = ?, updatedAt = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (departmentId, config, createdAt, updatedAt)
                VALUES (?, ?, GETDATE(), GETDATE());
        `;
        await executeQuery(query, [departmentId, configJson, departmentId, configJson]);

        const historyQuery = `
            INSERT INTO multi_skilling_plan_config_history (departmentId, config, remark, updatedBy, createdAt)
            VALUES (?, ?, ?, ?, GETDATE())
        `;
        await executeQuery(historyQuery, [departmentId, configJson, remark, updatedBy]);

        return this.findByDepartmentId(departmentId);
    }

    static async getHistory(departmentId, limit = 20) {
        const query = "SELECT TOP (?) * FROM multi_skilling_plan_config_history WHERE departmentId = ? ORDER BY createdAt DESC";
        const [rows] = await executeQuery(query, [limit, departmentId]);
        return rows.map(r => ({
            ...r,
            config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config
        }));
    }
}


export default MultiSkillingPlanConfig;
