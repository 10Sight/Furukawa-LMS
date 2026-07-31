import { executeQuery } from "../db/mssqlHelper.js";

class MultiSkillingPlan {
    // Constructor to initialize MultiSkillingPlan object
    constructor(data) {
        this.id = data.id;
        this.departmentId = data.departmentId;
        this.sectionId = data.sectionId;
        this.year = data.year;
        this.selectedLines = typeof data.selectedLines === "string"
            ? JSON.parse(data.selectedLines || "[]")
            : (data.selectedLines || []);
        this.tableData = typeof data.tableData === "string"
            ? JSON.parse(data.tableData || "{}")
            : (data.tableData || {});
        this.createdBy = data.createdBy || "";
        this.updatedBy = data.updatedBy || "";
        this.departmentName = data.departmentName || "";
        this.sectionName = data.sectionName || "";
        this.docNo = data.docNo;
        this.revNo = data.revNo;
        this.revDate = data.revDate;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    // Initialize the multi_skilling_plans table
    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'multi_skilling_plans')
            BEGIN
                CREATE TABLE multi_skilling_plans (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    departmentId INT NOT NULL,
                    sectionId INT NULL,
                    year INT NULL,
                    selectedLines NVARCHAR(MAX),
                    tableData NVARCHAR(MAX),
                    createdBy NVARCHAR(255),
                    updatedBy NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT unique_dept_section_year_plan UNIQUE (departmentId, sectionId, year)
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
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('multi_skilling_plans') AND name = 'year')
                BEGIN
                    ALTER TABLE multi_skilling_plans ADD year INT NULL;
                END

                -- Drop all old unique constraints on this table dynamically (excluding our target year constraint)
                DECLARE @ConstraintName NVARCHAR(255);
                SELECT TOP 1 @ConstraintName = name
                FROM sys.key_constraints
                WHERE parent_object_id = OBJECT_ID('multi_skilling_plans') 
                  AND type = 'UQ' 
                  AND name <> 'unique_dept_section_year_plan';

                WHILE @ConstraintName IS NOT NULL
                BEGIN
                    DECLARE @DropQuery NVARCHAR(MAX) = 'ALTER TABLE multi_skilling_plans DROP CONSTRAINT ' + QUOTENAME(@ConstraintName);
                    EXEC sp_executesql @DropQuery;
                    
                    SET @ConstraintName = NULL;
                    SELECT TOP 1 @ConstraintName = name
                    FROM sys.key_constraints
                    WHERE parent_object_id = OBJECT_ID('multi_skilling_plans') 
                      AND type = 'UQ' 
                      AND name <> 'unique_dept_section_year_plan';
                END

                -- Add new unique constraint with year if it doesn't exist
                IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE name = 'unique_dept_section_year_plan' AND type = 'UQ')
                BEGIN
                    ALTER TABLE multi_skilling_plans ADD CONSTRAINT unique_dept_section_year_plan UNIQUE (departmentId, sectionId, year);
                END

                -- Doc/revision snapshot: frozen at creation from the Revision Table.
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('multi_skilling_plans') AND name = 'docNo')
                BEGIN
                    ALTER TABLE multi_skilling_plans ADD docNo VARCHAR(255) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('multi_skilling_plans') AND name = 'revNo')
                BEGIN
                    ALTER TABLE multi_skilling_plans ADD revNo VARCHAR(255) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('multi_skilling_plans') AND name = 'revDate')
                BEGIN
                    ALTER TABLE multi_skilling_plans ADD revDate VARCHAR(255) NULL;
                END
            END
        `;
        await executeQuery(query);
    }

    static async findByHierarchy(departmentId, sectionId = null, year = null) {
        let query = "SELECT TOP 1 * FROM multi_skilling_plans WHERE departmentId = ?";
        let params = [departmentId];
        if (sectionId) {
            query += " AND sectionId = ?";
            params.push(sectionId);
        } else {
            query += " AND sectionId IS NULL";
        }

        if (year) {
            query += " AND year = ?";
            params.push(year);
        } else {
            query += " AND year IS NULL";
        }
        const [rows] = await executeQuery(query, params);
        if (rows.length === 0) return null;
        return new MultiSkillingPlan(rows[0]);
    }

    static async listPlans(departmentId = null, sectionId = null) {
        let query = `
            SELECT msp.*, d.name AS departmentName, s.name AS sectionName
            FROM multi_skilling_plans msp
            LEFT JOIN departments d ON msp.departmentId = d.id
            LEFT JOIN [sections] s ON msp.sectionId = s.id
        `;
        let params = [];
        let conditions = [];
        if (departmentId) {
            conditions.push("msp.departmentId = ?");
            params.push(departmentId);
        }
        if (sectionId) {
            conditions.push("msp.sectionId = ?");
            params.push(sectionId);
        }
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }
        query += " ORDER BY msp.year DESC, msp.updatedAt DESC";
        const [rows] = await executeQuery(query, params);
        return rows.map(r => new MultiSkillingPlan(r));
    }

    static async upsert({ departmentId, sectionId = null, year = null, selectedLines, tableData, userName, docNo, revNo, revDate }) {
        const existing = await this.findByHierarchy(departmentId, sectionId, year);

        if (existing) {
            const incomingIsEmpty = !tableData || Object.keys(tableData).length === 0;
            const finalTableData = incomingIsEmpty ? existing.tableData : tableData;
            const finalSelectedLines = (!selectedLines || selectedLines.length === 0) && incomingIsEmpty
                ? existing.selectedLines
                : selectedLines;

            await executeQuery(
                `UPDATE multi_skilling_plans
                 SET selectedLines = ?, tableData = ?, updatedBy = ?, updatedAt = GETDATE()
                 WHERE departmentId = ?
                   AND (sectionId = ? OR (sectionId IS NULL AND ? IS NULL))
                   AND (year = ? OR (year IS NULL AND ? IS NULL))`,
                [
                    JSON.stringify(finalSelectedLines || []),
                    JSON.stringify(finalTableData || {}),
                    userName || "",
                    departmentId,
                    sectionId,
                    sectionId,
                    year,
                    year
                ]
            );
            return this.findByHierarchy(departmentId, sectionId, year);
        }

        const [rows] = await executeQuery(
            `INSERT INTO multi_skilling_plans
             (departmentId, sectionId, year, selectedLines, tableData, createdBy, updatedBy, docNo, revNo, revDate)
             OUTPUT INSERTED.id
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                departmentId,
                sectionId,
                year,
                JSON.stringify(selectedLines || []),
                JSON.stringify(tableData || {}),
                userName || "",
                userName || "",
                docNo || null,
                revNo || null,
                revDate || null,
            ]
        );

        if (rows.length === 0) return null;
        return this.findByHierarchy(departmentId, sectionId, year);
    }

    static async deleteById(id) {
        const query = "DELETE FROM multi_skilling_plans WHERE id = ?";
        await executeQuery(query, [id]);
        return true;
    }
}

// Initialize the multi_skilling_plans table
MultiSkillingPlan.init().catch((err) => {
    console.error("Failed to initialize multi_skilling_plans table:", err);
});

export default MultiSkillingPlan;
