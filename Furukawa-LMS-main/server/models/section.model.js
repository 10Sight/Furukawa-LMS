import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";
import { getDesignationShutterExclusionSql } from "../utils/userEligibility.js";

const VALID_SKILL_LEVELS = ["L1", "L2", "L3", "L4"];

const safeJsonParseObject = (value) => {
    if (value && typeof value === "object") return value;
    if (typeof value !== "string" || !value) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
        return {};
    }
};

// Keeps only known L1-L4 keys with positive integer values; returns null when empty
// so the DB stores NULL instead of '{}' for "no overrides configured".
const normalizeDayCountsForStorage = (value) => {
    const source = safeJsonParseObject(value);
    const result = {};
    for (const level of VALID_SKILL_LEVELS) {
        const raw = source[level];
        if (raw === undefined || raw === null || raw === "") continue;
        const parsed = parseInt(raw);
        if (Number.isFinite(parsed) && parsed > 0) result[level] = parsed;
    }
    return Object.keys(result).length > 0 ? JSON.stringify(result) : null;
};

const sectionCountSql = (sectionAlias = "s") => `
    (SELECT COUNT(*)
     FROM users u
     WHERE ISNULL(u.isDeleted, 0) = 0
       AND ISNULL(u.isTemporary, 0) = 0
       AND u.status = 'PRESENT'
       ${getDesignationShutterExclusionSql("u")}
       AND EXISTS (
           SELECT 1 FROM OPENJSON(ISNULL(u.sections, '[]'))
           WHERE TRY_CAST([value] AS INT) = ${sectionAlias}.id
       )
    ) as sectionCount
`;

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

        this.daily5mApproverDeptId = data.daily5mApproverDeptId || null;
        this.daily5mApproverSectionId = data.daily5mApproverSectionId || null;
        this.daily5mApproverLineId = data.daily5mApproverLineId || null;

        this.skillMatrixApproverQaDeptId = data.skillMatrixApproverQaDeptId || null;
        this.skillMatrixApproverQaSectionId = data.skillMatrixApproverQaSectionId || null;
        this.skillMatrixApproverQaLineId = data.skillMatrixApproverQaLineId || null;
        this.skillMatrixApproverSafetyDeptId = data.skillMatrixApproverSafetyDeptId || null;
        this.skillMatrixApproverSafetySectionId = data.skillMatrixApproverSafetySectionId || null;
        this.skillMatrixApproverSafetyLineId = data.skillMatrixApproverSafetyLineId || null;
        this.skillMatrixApproverProcessDeptId = data.skillMatrixApproverProcessDeptId || null;
        this.skillMatrixApproverProcessSectionId = data.skillMatrixApproverProcessSectionId || null;
        this.skillMatrixApproverProcessLineId = data.skillMatrixApproverProcessLineId || null;

        this.users = typeof data.users === 'string' ? JSON.parse(data.users) : (data.users || []);
        this.sectionCount = data.sectionCount || this.users.length || 0;

        this.skillUpgradationDayCount = data.skillUpgradationDayCount !== undefined && data.skillUpgradationDayCount !== null
            ? parseInt(data.skillUpgradationDayCount) : null;
        this.multiSkillingDayCount = data.multiSkillingDayCount !== undefined && data.multiSkillingDayCount !== null
            ? parseInt(data.multiSkillingDayCount) : null;
        this.skillUpgradationDayCounts = safeJsonParseObject(data.skillUpgradationDayCounts);
        this.multiSkillingDayCounts = safeJsonParseObject(data.multiSkillingDayCounts);

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
                    daily5mApproverDeptId INT NULL,
                    daily5mApproverSectionId INT NULL,
                    daily5mApproverLineId INT NULL,
                    skillMatrixApproverQaDeptId INT NULL,
                    skillMatrixApproverQaSectionId INT NULL,
                    skillMatrixApproverQaLineId INT NULL,
                    skillMatrixApproverSafetyDeptId INT NULL,
                    skillMatrixApproverSafetySectionId INT NULL,
                    skillMatrixApproverSafetyLineId INT NULL,
                    skillMatrixApproverProcessDeptId INT NULL,
                    skillMatrixApproverProcessSectionId INT NULL,
                    skillMatrixApproverProcessLineId INT NULL,
                    skillUpgradationDayCount INT NULL,
                    multiSkillingDayCount INT NULL,
                    skillUpgradationDayCounts NVARCHAR(MAX) NULL,
                    multiSkillingDayCounts NVARCHAR(MAX) NULL,
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

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'users')
                BEGIN
                    ALTER TABLE [sections] ADD users NVARCHAR(MAX) DEFAULT '[]';
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'daily5mApproverDeptId')
                BEGIN
                    ALTER TABLE [sections] ADD daily5mApproverDeptId INT NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'daily5mApproverSectionId')
                BEGIN
                    ALTER TABLE [sections] ADD daily5mApproverSectionId INT NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'daily5mApproverLineId')
                BEGIN
                    ALTER TABLE [sections] ADD daily5mApproverLineId INT NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'skillMatrixApproverQaDeptId')
                BEGIN
                    ALTER TABLE [sections] ADD skillMatrixApproverQaDeptId INT NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'skillMatrixApproverQaSectionId')
                BEGIN
                    ALTER TABLE [sections] ADD skillMatrixApproverQaSectionId INT NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'skillMatrixApproverQaLineId')
                BEGIN
                    ALTER TABLE [sections] ADD skillMatrixApproverQaLineId INT NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'skillMatrixApproverSafetyDeptId')
                BEGIN
                    ALTER TABLE [sections] ADD skillMatrixApproverSafetyDeptId INT NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'skillMatrixApproverSafetySectionId')
                BEGIN
                    ALTER TABLE [sections] ADD skillMatrixApproverSafetySectionId INT NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'skillMatrixApproverSafetyLineId')
                BEGIN
                    ALTER TABLE [sections] ADD skillMatrixApproverSafetyLineId INT NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'skillMatrixApproverProcessDeptId')
                BEGIN
                    ALTER TABLE [sections] ADD skillMatrixApproverProcessDeptId INT NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'skillMatrixApproverProcessSectionId')
                BEGIN
                    ALTER TABLE [sections] ADD skillMatrixApproverProcessSectionId INT NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'skillMatrixApproverProcessLineId')
                BEGIN
                    ALTER TABLE [sections] ADD skillMatrixApproverProcessLineId INT NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'skillUpgradationDayCount')
                BEGIN
                    ALTER TABLE [sections] ADD skillUpgradationDayCount INT NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'multiSkillingDayCount')
                BEGIN
                    ALTER TABLE [sections] ADD multiSkillingDayCount INT NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'skillUpgradationDayCounts')
                BEGIN
                    ALTER TABLE [sections] ADD skillUpgradationDayCounts NVARCHAR(MAX) NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns
                             WHERE object_id = OBJECT_ID('sections')
                             AND name = 'multiSkillingDayCounts')
                BEGIN
                    ALTER TABLE [sections] ADD multiSkillingDayCounts NVARCHAR(MAX) NULL;
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

                -- Trim existing uniCode values so the unique index compares cleanly
                UPDATE [sections] SET uniCode = LTRIM(RTRIM(uniCode)) WHERE uniCode IS NOT NULL;
            END
        `;

        // Rename duplicate/blank uniCode values before enforcing uniqueness so the
        // filtered unique index below does not fail on pre-existing data.
        const dedupeQuery = `
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'sections')
            BEGIN
                ;WITH ranked AS (
                    SELECT id, uniCode,
                        ROW_NUMBER() OVER (PARTITION BY LOWER(uniCode) ORDER BY id ASC) AS rn
                    FROM [sections]
                    WHERE uniCode IS NOT NULL AND uniCode <> ''
                )
                UPDATE s
                SET s.uniCode = s.uniCode + '-DUP' + CAST(r.id AS NVARCHAR(20))
                FROM [sections] s
                JOIN ranked r ON r.id = s.id AND r.rn > 1;

                UPDATE [sections] SET uniCode = 'SEC-' + CAST(id AS NVARCHAR(20)) WHERE uniCode IS NULL OR uniCode = '';
            END
        `;

        const uniqueIndexQuery = `
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_unique_section_unicode' AND object_id = OBJECT_ID('sections'))
            BEGIN
                CREATE UNIQUE NONCLUSTERED INDEX idx_unique_section_unicode
                ON [sections](uniCode)
                WHERE uniCode IS NOT NULL AND uniCode <> '';
            END
        `;

        try {
            await executeQuery(createQuery);
            await executeQuery(migrationQuery);
            await executeQuery(dedupeQuery);
            await executeQuery(uniqueIndexQuery);
            logger.info("Checked/Created sections table and migrated columns in MSSQL");

            // Initial sync for all sections
            const [sections] = await executeQuery("SELECT id FROM [sections]");
            for (const s of sections) {
                await Section.syncUserList(s.id);
            }
        } catch (error) {
            logger.error("Failed to initialize Section table", error);
        }
    }

    static async syncUserList(sectionId) {
        try {
            // Aggregate users from child lines AND from direct section assignment (sections JSON array)
            const query = `
                SELECT DISTINCT userId FROM (
                    SELECT u.[value] as userId
                    FROM [lines] l
                    CROSS APPLY OPENJSON(ISNULL(l.users, '[]')) u
                    WHERE l.sectionId = ?

                    UNION

                    SELECT CAST(u.id AS NVARCHAR(50)) as userId
                    FROM users u
                    WHERE (u.isDeleted = 0 OR u.isDeleted IS NULL)
                    AND EXISTS (SELECT 1 FROM OPENJSON(ISNULL(u.sections, '[]')) WHERE TRY_CAST([value] AS INT) = ?)
                ) combined
            `;
            const [rows] = await executeQuery(query, [sectionId, sectionId]);
            const userList = rows.map(r => r.userId);
            
            await executeQuery(
                "UPDATE [sections] SET users = ? WHERE id = ?",
                [JSON.stringify(userList), sectionId]
            );
            
            logger.info(`Synced user list for section ${sectionId}. Total users: ${userList.length}`);
            return userList;
        } catch (error) {
            logger.error(`Error syncing user list for section ${sectionId}:`, error);
            throw error;
        }
    }

    static async create(data) {
        const fields = [
            "name", "uniCode", "description", "category", "daily5mFormType", "tenCycleFormType", "departmentId", "isActive",
            "daily5mApproverDeptId", "daily5mApproverSectionId", "daily5mApproverLineId",
            "skillMatrixApproverQaDeptId", "skillMatrixApproverQaSectionId", "skillMatrixApproverQaLineId",
            "skillMatrixApproverSafetyDeptId", "skillMatrixApproverSafetySectionId", "skillMatrixApproverSafetyLineId",
            "skillMatrixApproverProcessDeptId", "skillMatrixApproverProcessSectionId", "skillMatrixApproverProcessLineId",
            "skillUpgradationDayCount", "multiSkillingDayCount",
            "skillUpgradationDayCounts", "multiSkillingDayCounts",
            "users", "createdAt", "updatedAt"
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
            data.daily5mApproverDeptId || null,
            data.daily5mApproverSectionId || null,
            data.daily5mApproverLineId || null,
            data.skillMatrixApproverQaDeptId || null,
            data.skillMatrixApproverQaSectionId || null,
            data.skillMatrixApproverQaLineId || null,
            data.skillMatrixApproverSafetyDeptId || null,
            data.skillMatrixApproverSafetySectionId || null,
            data.skillMatrixApproverSafetyLineId || null,
            data.skillMatrixApproverProcessDeptId || null,
            data.skillMatrixApproverProcessSectionId || null,
            data.skillMatrixApproverProcessLineId || null,
            data.skillUpgradationDayCount !== undefined && data.skillUpgradationDayCount !== null && data.skillUpgradationDayCount !== ""
                ? parseInt(data.skillUpgradationDayCount) : null,
            data.multiSkillingDayCount !== undefined && data.multiSkillingDayCount !== null && data.multiSkillingDayCount !== ""
                ? parseInt(data.multiSkillingDayCount) : null,
            normalizeDayCountsForStorage(data.skillUpgradationDayCounts),
            normalizeDayCountsForStorage(data.multiSkillingDayCounts),
            '[]',
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
            ${sectionCountSql("s")}
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
                ${sectionCountSql("s")}
                FROM [sections] s
                WHERE s.departmentId IN (${ids.join(',')}) 
                ORDER BY s.createdAt DESC`;
        } else {
            // Handle single ID
            query = `
                SELECT s.*,
                ${sectionCountSql("s")}
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
        if (data.daily5mApproverDeptId !== undefined) { updateFields.push("daily5mApproverDeptId = ?"); values.push(data.daily5mApproverDeptId); }
        if (data.daily5mApproverSectionId !== undefined) { updateFields.push("daily5mApproverSectionId = ?"); values.push(data.daily5mApproverSectionId); }
        if (data.daily5mApproverLineId !== undefined) { updateFields.push("daily5mApproverLineId = ?"); values.push(data.daily5mApproverLineId); }
        if (data.skillMatrixApproverQaDeptId !== undefined) { updateFields.push("skillMatrixApproverQaDeptId = ?"); values.push(data.skillMatrixApproverQaDeptId); }
        if (data.skillMatrixApproverQaSectionId !== undefined) { updateFields.push("skillMatrixApproverQaSectionId = ?"); values.push(data.skillMatrixApproverQaSectionId); }
        if (data.skillMatrixApproverQaLineId !== undefined) { updateFields.push("skillMatrixApproverQaLineId = ?"); values.push(data.skillMatrixApproverQaLineId); }
        if (data.skillMatrixApproverSafetyDeptId !== undefined) { updateFields.push("skillMatrixApproverSafetyDeptId = ?"); values.push(data.skillMatrixApproverSafetyDeptId); }
        if (data.skillMatrixApproverSafetySectionId !== undefined) { updateFields.push("skillMatrixApproverSafetySectionId = ?"); values.push(data.skillMatrixApproverSafetySectionId); }
        if (data.skillMatrixApproverSafetyLineId !== undefined) { updateFields.push("skillMatrixApproverSafetyLineId = ?"); values.push(data.skillMatrixApproverSafetyLineId); }
        if (data.skillMatrixApproverProcessDeptId !== undefined) { updateFields.push("skillMatrixApproverProcessDeptId = ?"); values.push(data.skillMatrixApproverProcessDeptId); }
        if (data.skillMatrixApproverProcessSectionId !== undefined) { updateFields.push("skillMatrixApproverProcessSectionId = ?"); values.push(data.skillMatrixApproverProcessSectionId); }
        if (data.skillMatrixApproverProcessLineId !== undefined) { updateFields.push("skillMatrixApproverProcessLineId = ?"); values.push(data.skillMatrixApproverProcessLineId); }
        if (data.skillUpgradationDayCount !== undefined) {
            updateFields.push("skillUpgradationDayCount = ?");
            values.push(data.skillUpgradationDayCount === null || data.skillUpgradationDayCount === "" ? null : parseInt(data.skillUpgradationDayCount));
        }
        if (data.multiSkillingDayCount !== undefined) {
            updateFields.push("multiSkillingDayCount = ?");
            values.push(data.multiSkillingDayCount === null || data.multiSkillingDayCount === "" ? null : parseInt(data.multiSkillingDayCount));
        }
        if (data.skillUpgradationDayCounts !== undefined) {
            updateFields.push("skillUpgradationDayCounts = ?");
            values.push(normalizeDayCountsForStorage(data.skillUpgradationDayCounts));
        }
        if (data.multiSkillingDayCounts !== undefined) {
            updateFields.push("multiSkillingDayCounts = ?");
            values.push(normalizeDayCountsForStorage(data.multiSkillingDayCounts));
        }

        if (updateFields.length === 0) return null;

        updateFields.push("updatedAt = GETDATE()");
        values.push(id);

        await executeQuery(`UPDATE [sections] SET ${updateFields.join(", ")} WHERE id = ?`, values);
        return Section.findById(id);
    }
}

// Initialize table
// Section.init();

export default Section;
