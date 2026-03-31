import { executeQuery } from "../db/mssqlHelper.js";

class MultiSkillingPlan {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.selectedLines = typeof data.selectedLines === "string"
            ? JSON.parse(data.selectedLines || "[]")
            : (data.selectedLines || []);
        this.tableData = typeof data.tableData === "string"
            ? JSON.parse(data.tableData || "{}")
            : (data.tableData || {});
        this.createdBy = data.createdBy || "";
        this.updatedBy = data.updatedBy || "";
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'multi_skilling_plans')
            BEGIN
                CREATE TABLE multi_skilling_plans (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId INT NOT NULL UNIQUE,
                    selectedLines NVARCHAR(MAX),
                    tableData NVARCHAR(MAX),
                    createdBy NVARCHAR(255),
                    updatedBy NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                );
                CREATE INDEX idx_multi_skill_dept ON multi_skilling_plans(departmentId);
            END
        `;
        await executeQuery(query);
    }

    static async findByDepartmentId(departmentId) {
        const [rows] = await executeQuery(
            "SELECT TOP 1 * FROM multi_skilling_plans WHERE departmentId = ?",
            [departmentId]
        );
        if (rows.length === 0) return null;
        return new MultiSkillingPlan(rows[0]);
    }

    static async upsert({ departmentId, selectedLines, tableData, userName }) {
        const existing = await this.findByDepartmentId(departmentId);

        if (existing) {
            await executeQuery(
                `UPDATE multi_skilling_plans
                 SET selectedLines = ?, tableData = ?, updatedBy = ?, updatedAt = GETDATE()
                 WHERE departmentId = ?`,
                [
                    JSON.stringify(selectedLines || []),
                    JSON.stringify(tableData || {}),
                    userName || "",
                    departmentId,
                ]
            );
            return this.findByDepartmentId(departmentId);
        }

        const [rows] = await executeQuery(
            `INSERT INTO multi_skilling_plans
             (departmentId, selectedLines, tableData, createdBy, updatedBy)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?)`,
            [
                departmentId,
                JSON.stringify(selectedLines || []),
                JSON.stringify(tableData || {}),
                userName || "",
                userName || "",
            ]
        );

        if (rows.length === 0) return null;
        return this.findByDepartmentId(departmentId);
    }
}

MultiSkillingPlan.init().catch((err) => {
    console.error("Failed to initialize multi_skilling_plans table:", err);
});

export default MultiSkillingPlan;
