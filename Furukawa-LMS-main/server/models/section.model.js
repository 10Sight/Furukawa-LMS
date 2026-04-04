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
            "name", "uniCode", "description", "category", "departmentId", "isActive", "createdAt", "updatedAt"
        ];

        const now = new Date();
        const values = [
            data.name,
            data.uniCode || null,
            data.description || null,
            data.category || "Not Applicable",
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
            (SELECT COUNT(DISTINCT ma.user_id) 
             FROM machine_assignments ma
             JOIN machines m ON ma.machine_id = m.id
             JOIN sub_sections ss ON m.subSectionId = ss.id
             JOIN [lines] l ON ss.lineId = l.id
             WHERE l.sectionId = s.id) as sectionCount
            FROM [sections] s 
            WHERE s.id = ?`;
        const [rows] = await executeQuery(query, [id]);
        if (rows.length === 0) return null;
        return new Section(rows[0]);
    }

    static async findByDepartment(departmentId) {
        const query = `
            SELECT s.*, 
            (SELECT COUNT(DISTINCT ma.user_id) 
             FROM machine_assignments ma
             JOIN machines m ON ma.machine_id = m.id
             JOIN sub_sections ss ON m.subSectionId = ss.id
             JOIN [lines] l ON ss.lineId = l.id
             WHERE l.sectionId = s.id) as sectionCount
            FROM [sections] s 
            WHERE s.departmentId = ? 
            ORDER BY s.createdAt DESC`;
        const [rows] = await executeQuery(query, [departmentId]);
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
        if (data.isActive !== undefined) { updateFields.push("isActive = ?"); values.push(data.isActive); }

        if (updateFields.length === 0) return null;

        updateFields.push("updatedAt = GETDATE()");
        values.push(id);

        await executeQuery(`UPDATE [sections] SET ${updateFields.join(", ")} WHERE id = ?`, values);
        return Section.findById(id);
    }
    
    static async findAll() {
        const query = `
            SELECT s.*, 
            (SELECT COUNT(DISTINCT ma.user_id) 
             FROM machine_assignments ma
             JOIN machines m ON ma.machine_id = m.id
             JOIN sub_sections ss ON m.subSectionId = ss.id
             JOIN [lines] l ON ss.lineId = l.id
             WHERE l.sectionId = s.id) as sectionCount
            FROM [sections] s 
            ORDER BY s.createdAt DESC`;
        const [rows] = await executeQuery(query);
        return rows.map(row => new Section(row));
    }
}

// Initialize table
Section.init();

export default Section;
