import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class Section {
    constructor(data) {
        this.id = data.id;
        this._id = data.id; // Compatibility

        this.name = data.name;
        this.uniCode = data.uniCode;
        this.description = data.description;
        this.category = data.category || "Not Applicable";
        this.daily5mFormType = data.daily5mFormType || "standard";
        this.tenCycleFormType = data.tenCycleFormType || "form1";
        this.departmentId = data.departmentId;
        this.isActive = data.isActive !== undefined ? !!data.isActive : true;
        this.sectionCount = data.sectionCount || 0;

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        // Table creation
        const createQuery = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sections')
            BEGIN
                CREATE TABLE [sections] (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    name NVARCHAR(255) NOT NULL,
                    uniCode NVARCHAR(255) NOT NULL,
                    description NVARCHAR(MAX),
                    category NVARCHAR(50) DEFAULT 'Not Applicable',
                    daily5mFormType NVARCHAR(255) DEFAULT 'standard',
                    tenCycleFormType NVARCHAR(255) DEFAULT 'form1',
                    departmentId INT NOT NULL,
                    isActive BIT DEFAULT 1,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT unique_dept_section_category UNIQUE (name, category, departmentId),
                    FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE
                );
                CREATE INDEX idx_dept_section ON [sections](departmentId);
            END
        `;

        // Column migration
        const migrationQuery = `
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'sections')
            BEGIN
                -- Add category column if missing
                IF NOT EXISTS (SELECT * FROM sys.columns 
                             WHERE object_id = OBJECT_ID('sections') 
                             AND name = 'category')
                BEGIN
                    ALTER TABLE [sections] ADD category NVARCHAR(50) DEFAULT 'Not Applicable';
                END

                IF NOT EXISTS (SELECT * FROM sys.columns 
                             WHERE object_id = OBJECT_ID('sections') 
                             AND name = 'daily5mFormType')
                BEGIN
                    ALTER TABLE [sections] ADD daily5mFormType NVARCHAR(255) DEFAULT 'standard';
                END
                ELSE
                BEGIN
                    ALTER TABLE [sections] ALTER COLUMN daily5mFormType NVARCHAR(255);
                END

                IF NOT EXISTS (SELECT * FROM sys.columns 
                             WHERE object_id = OBJECT_ID('sections') 
                             AND name = 'tenCycleFormType')
                BEGIN
                    ALTER TABLE [sections] ADD tenCycleFormType NVARCHAR(255) DEFAULT 'form1';
                END
                ELSE
                BEGIN
                    ALTER TABLE [sections] ALTER COLUMN tenCycleFormType NVARCHAR(255);
                END

                -- Data Migration: Set correct form types based on category or NAME if they are still 'standard'
                UPDATE [sections] SET daily5mFormType = 'crimping' 
                WHERE (category = 'CRIMPING' OR category = 'Cutting & Crimping' OR name LIKE '%Crimping%' OR name LIKE '%Cutting%') 
                AND (daily5mFormType = 'standard' OR daily5mFormType IS NULL);

                UPDATE [sections] SET daily5mFormType = 'src' 
                WHERE (category = 'SRC' OR name LIKE '%SRC%') 
                AND (daily5mFormType = 'standard' OR daily5mFormType IS NULL);

                -- Update Unique Constraint
                -- 1. Drop old constraint if exists
                IF EXISTS (SELECT * FROM sys.objects WHERE name = 'unique_dept_section' AND parent_object_id = OBJECT_ID('sections'))
                BEGIN
                    ALTER TABLE [sections] DROP CONSTRAINT unique_dept_section;
                END

                -- 2. Drop global unique constraint on uniCode if exists
                -- We look for any UNIQUE constraint or index on just the uniCode column
                DECLARE @ConstraintName NVARCHAR(MAX);
                SELECT @ConstraintName = so.name
                FROM sys.objects so
                WHERE so.type = 'UQ' AND so.parent_object_id = OBJECT_ID('sections')
                AND so.name IN (
                    SELECT si.name FROM sys.indexes si
                    JOIN sys.index_columns ic ON si.object_id = ic.object_id AND si.index_id = ic.index_id
                    JOIN sys.columns sc ON ic.object_id = sc.object_id AND ic.column_id = sc.column_id
                    WHERE sc.name = 'uniCode' AND si.object_id = OBJECT_ID('sections')
                );

                IF @ConstraintName IS NOT NULL
                BEGIN
                    DECLARE @DropSql NVARCHAR(MAX) = 'ALTER TABLE [sections] DROP CONSTRAINT ' + @ConstraintName;
                    EXEC sp_executesql @DropSql;
                END

                -- 3. Create new constraint if not exists
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'unique_dept_section_category' AND parent_object_id = OBJECT_ID('sections'))
                BEGIN
                    ALTER TABLE [sections] ADD CONSTRAINT unique_dept_section_category UNIQUE (name, category, departmentId);
                END
            END
        `;

        try {
            await executeQuery(createQuery);
            await executeQuery(migrationQuery);
            logger.info("Checked/Created sections table and migrated columns in MSSQL");
        } catch (error) {
            logger.error("Failed to initialize Section table", error);
        }
    }

    static async create(data) {
        const fields = [
            "name", "uniCode", "description", "category", "daily5mFormType", "tenCycleFormType", "departmentId", "isActive", "createdAt", "updatedAt"
        ];

        const now = new Date();
        const values = [
            data.name,
            data.uniCode || null,
            data.description || null,
            data.category || "Not Applicable",
            data.daily5mFormType || "standard",
            data.tenCycleFormType || "form1",
            data.departmentId,
            data.isActive !== undefined ? data.isActive : true,
            now,
            now
        ];

        const placeholders = fields.map(() => "?").join(",");
        const query = `INSERT INTO [sections] (${fields.join(",")}) 
        OUTPUT INSERTED.id
        VALUES (${placeholders})`;

        const [result] = await executeQuery(query, values);
        return Section.findById(result[0].id);
    }

    static async findById(id) {
        const query = `
            SELECT s.*, 
            (SELECT COUNT(DISTINCT u.id) 
             FROM users u
             WHERE (u.role = 'Student' AND (u.isDeleted = 0 OR u.isDeleted IS NULL))
             AND (
                u.sectionId = s.id 
                OR u.lineId IN (SELECT id FROM [lines] WHERE sectionId = s.id)
                OR u.subSectionId IN (SELECT id FROM sub_sections WHERE lineId IN (SELECT id FROM [lines] WHERE sectionId = s.id))
                OR u.id IN (
                    SELECT ma.user_id 
                    FROM machine_assignments ma 
                    JOIN machines m ON ma.machine_id = m.id 
                    JOIN sub_sections ss ON m.subSectionId = ss.id 
                    JOIN [lines] l ON ss.lineId = l.id 
                    WHERE l.sectionId = s.id
                )
             )
            ) as sectionCount
            FROM [sections] s 
            WHERE s.id = ?`;
        const [rows] = await executeQuery(query, [id]);
        if (rows.length === 0) return null;
        return new Section(rows[0]);
    }

    static async findByDepartment(departmentId) {
        let query;
        let params = [];
        
        if (typeof departmentId === 'string' && departmentId.includes(',')) {
            // Handle multiple IDs
            const ids = departmentId.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
            if (ids.length === 0) return [];
            query = `
                SELECT s.*, 
                (SELECT COUNT(DISTINCT u.id) 
                 FROM users u
                 WHERE (u.role = 'Student' AND (u.isDeleted = 0 OR u.isDeleted IS NULL))
                 AND (
                    u.sectionId = s.id 
                    OR u.lineId IN (SELECT id FROM [lines] WHERE sectionId = s.id)
                    OR u.subSectionId IN (SELECT id FROM sub_sections WHERE lineId IN (SELECT id FROM [lines] WHERE sectionId = s.id))
                    OR u.id IN (
                        SELECT ma.user_id 
                        FROM machine_assignments ma 
                        JOIN machines m ON ma.machine_id = m.id 
                        JOIN sub_sections ss ON m.subSectionId = ss.id 
                        JOIN [lines] l ON ss.lineId = l.id 
                        WHERE l.sectionId = s.id
                    )
                 )
                ) as sectionCount
                FROM [sections] s 
                WHERE s.departmentId IN (${ids.join(',')}) 
                ORDER BY s.createdAt DESC`;
        } else {
            // Handle single ID
            query = `
                SELECT s.*, 
                (SELECT COUNT(DISTINCT u.id) 
                 FROM users u
                 WHERE (u.role = 'Student' AND (u.isDeleted = 0 OR u.isDeleted IS NULL))
                 AND (
                    u.sectionId = s.id 
                    OR u.lineId IN (SELECT id FROM [lines] WHERE sectionId = s.id)
                    OR u.subSectionId IN (SELECT id FROM sub_sections WHERE lineId IN (SELECT id FROM [lines] WHERE sectionId = s.id))
                    OR u.id IN (
                        SELECT ma.user_id 
                        FROM machine_assignments ma 
                        JOIN machines m ON ma.machine_id = m.id 
                        JOIN sub_sections ss ON m.subSectionId = ss.id 
                        JOIN [lines] l ON ss.lineId = l.id 
                        WHERE l.sectionId = s.id
                    )
                 )
                ) as sectionCount
                FROM [sections] s 
                WHERE s.departmentId = ? 
                ORDER BY s.createdAt DESC`;
            params = [departmentId];
        }

        const [rows] = await executeQuery(query, params);
        return rows.map(row => new Section(row));
    }

    static async delete(id) {
        const [result, metadata] = await executeQuery("DELETE FROM [sections] WHERE id = ?", [id]);
        return metadata.affectedRows > 0;
    }

    static async update(id, data) {
        const updateFields = [];
        const values = [];

        if (data.name !== undefined) { updateFields.push("name = ?"); values.push(data.name); }
        if (data.uniCode !== undefined) { updateFields.push("uniCode = ?"); values.push(data.uniCode); }
        if (data.description !== undefined) { updateFields.push("description = ?"); values.push(data.description); }
        if (data.category !== undefined) { updateFields.push("category = ?"); values.push(data.category); }
        if (data.daily5mFormType !== undefined) { updateFields.push("daily5mFormType = ?"); values.push(data.daily5mFormType); }
        if (data.tenCycleFormType !== undefined) { updateFields.push("tenCycleFormType = ?"); values.push(data.tenCycleFormType); }
        if (data.isActive !== undefined) { updateFields.push("isActive = ?"); values.push(data.isActive); }

        if (updateFields.length === 0) return null;

        updateFields.push("updatedAt = GETDATE()");
        values.push(id);

        await executeQuery(`UPDATE [sections] SET ${updateFields.join(", ")} WHERE id = ?`, values);
        return Section.findById(id);
    }
}

// Initialize table
Section.init();

export default Section;
