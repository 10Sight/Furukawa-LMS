import { executeQuery } from "../db/mssqlHelper.js";

class MultiSkillingPlan {
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.sectionId = data.sectionId;
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
                    departmentId INT NOT NULL,
                    sectionId INT NULL,
                    selectedLines NVARCHAR(MAX),
                    tableData NVARCHAR(MAX),
                    createdBy NVARCHAR(255),
                    updatedBy NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT unique_dept_section_plan UNIQUE (departmentId, sectionId)
                );
                CREATE INDEX idx_multi_skill_dept ON multi_skilling_plans(departmentId);
                CREATE INDEX idx_multi_skill_sect ON multi_skilling_plans(sectionId);
            END
            ELSE
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('multi_skilling_plans') AND name = 'sectionId')
                BEGIN
                    ALTER TABLE multi_skilling_plans ADD sectionId INT NULL;
                END
                
                -- Check for unique constraint update if needed (handled in future migrations or manually if it fails)
            END
        `;
        await executeQuery(query);
    }

    static async findByHierarchy(departmentId, sectionId = null) {
        let query = "SELECT TOP 1 * FROM multi_skilling_plans WHERE departmentId = ?";
        let params = [departmentId];
        
        if (sectionId) {
            query += " AND sectionId = ?";
            params.push(sectionId);
        } else {
            query += " AND sectionId IS NULL";
        }

        const [rows] = await executeQuery(query, params);
        if (rows.length === 0) return null;
        return new MultiSkillingPlan(rows[0]);
    }

    static async upsert({ departmentId, sectionId = null, selectedLines, tableData, userName }) {
        const existing = await this.findByHierarchy(departmentId, sectionId);

        if (existing) {
            await executeQuery(
                `UPDATE multi_skilling_plans
                 SET selectedLines = ?, tableData = ?, updatedBy = ?, updatedAt = GETDATE()
                 WHERE departmentId = ? AND (sectionId = ? OR (sectionId IS NULL AND ? IS NULL))`,
                [
                    JSON.stringify(selectedLines || []),
                    JSON.stringify(tableData || {}),
                    userName || "",
                    departmentId,
                    sectionId,
                    sectionId
                ]
            );
            return this.findByHierarchy(departmentId, sectionId);
        }

        const [rows] = await executeQuery(
            `INSERT INTO multi_skilling_plans
             (departmentId, sectionId, selectedLines, tableData, createdBy, updatedBy)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                departmentId,
                sectionId,
                JSON.stringify(selectedLines || []),
                JSON.stringify(tableData || {}),
                userName || "",
                userName || "",
            ]
        );

        if (rows.length === 0) return null;
        return this.findByHierarchy(departmentId, sectionId);
    }
}

MultiSkillingPlan.init().catch((err) => {
    console.error("Failed to initialize multi_skilling_plans table:", err);
});

export default MultiSkillingPlan;
