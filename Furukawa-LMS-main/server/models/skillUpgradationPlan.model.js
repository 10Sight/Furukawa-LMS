import { executeQuery } from "../db/mssqlHelper.js";

class SkillUpgradationPlan {
    // Constructor to initialize SkillUpgradationPlan object
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

    // Initialize the skill_upgradation_plans table
    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'skill_upgradation_plans')
            BEGIN
                CREATE TABLE skill_upgradation_plans (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId INT NOT NULL,
                    sectionId INT NULL,
                    selectedLines NVARCHAR(MAX),
                    tableData NVARCHAR(MAX),
                    createdBy NVARCHAR(255),
                    updatedBy NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT unique_dept_section_upgradation_plan UNIQUE (departmentId, sectionId)
                );
                CREATE INDEX idx_skill_upgrad_dept ON skill_upgradation_plans(departmentId);
                CREATE INDEX idx_skill_upgrad_sect ON skill_upgradation_plans(sectionId);
            END
            ELSE
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('skill_upgradation_plans') AND name = 'sectionId')
                BEGIN
                    ALTER TABLE skill_upgradation_plans ADD sectionId INT NULL;
                END
            END
        `;
        await executeQuery(query);
    }

    // Find skill upgradation plan by department
    static async findByHierarchy(departmentId, sectionId = null) {
        let query = "SELECT TOP 1 * FROM skill_upgradation_plans WHERE departmentId = ?";
        let params = [departmentId];

        if (sectionId) {
            query += " AND sectionId = ?";
            params.push(sectionId);
        } else {
            query += " AND sectionId IS NULL";
        }

        const [rows] = await executeQuery(query, params);
        if (rows.length === 0) return null;
        return new SkillUpgradationPlan(rows[0]);
    }

    // Upsert skill upgradation plan by department and section
    static async upsert({ departmentId, sectionId = null, selectedLines, tableData, userName }) {
        const existing = await this.findByHierarchy(departmentId, sectionId);

        if (existing) {
            await executeQuery(
                `UPDATE skill_upgradation_plans
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
            `INSERT INTO skill_upgradation_plans
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

// Initialize the skill_upgradation_plans table
SkillUpgradationPlan.init().catch((err) => {
    console.error("Failed to initialize skill_upgradation_plans table:", err);
});

export default SkillUpgradationPlan;
