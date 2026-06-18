import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class Line {
    constructor(data) {
        this.id = data.id;
        this._id = data.id; // Compatibility

        this.name = data.name;
        this.uniCode = data.uniCode;
        this.lineLeader = data.lineLeader || null;
        this.mentor = data.mentor || null;
        this.department = data.department;
        this.sectionId = data.sectionId || null;
        this.description = data.description;
        this.requirement = data.requirement || 0;
        this.isActive = data.isActive !== undefined ? !!data.isActive : true;
        this.tenCycleFormType = data.tenCycleFormType || "form1";
        this.users = typeof data.users === 'string' ? JSON.parse(data.users) : (data.users || []);
        this.lineCount = data.lineCount || this.users.length || 0;

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                const query = `
                    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'lines')
                    BEGIN
                        CREATE TABLE [lines] (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            name NVARCHAR(255) NOT NULL,
                            uniCode NVARCHAR(255) UNIQUE,
                            lineLeader NVARCHAR(MAX),
                            department INT NOT NULL,
                            sectionId INT NOT NULL,
                            description NVARCHAR(MAX),
                            isActive BIT DEFAULT 1,
                            tenCycleFormType NVARCHAR(255) DEFAULT 'form1',
                            createdAt DATETIME DEFAULT GETDATE(),
                            updatedAt DATETIME DEFAULT GETDATE(),
                            CONSTRAINT unique_section_line UNIQUE (name, sectionId),
                            FOREIGN KEY (sectionId) REFERENCES sections(id) ON DELETE CASCADE
                        );
                        CREATE INDEX idx_section ON [lines](sectionId);
                        CREATE INDEX idx_department ON [lines](department);
                    END
                `;
                await executeQuery(query);

                // 1. Data Migration: Remap orphaned sectionId (department IDs) to actual section IDs
                const remappings = [
                    { old: 2, new: 11 }, { old: 3, new: 13 }, { old: 4, new: 14 },
                    { old: 5, new: 15 }, { old: 6, new: 16 }, { old: 9, new: 20 },
                    { old: 12, new: 23 }
                ];

                for (const map of remappings) {
                    const [targetExists] = await executeQuery("SELECT id FROM sections WHERE id = ?", [map.new]);
                    if (targetExists.length > 0) {
                        await executeQuery(`
                            DELETE FROM [lines] 
                            WHERE sectionId = ? 
                            AND sectionId != ?
                            AND name IN (SELECT name FROM [lines] WHERE sectionId = ?)
                        `, [map.old, map.new, map.new]);
                        await executeQuery(`UPDATE [lines] SET sectionId = ? WHERE sectionId = ? AND sectionId != ?`, [map.new, map.old, map.new]);
                    }
                }

                await executeQuery(`
                    IF COL_LENGTH('lines', 'lineLeader') IS NULL
                    BEGIN
                        ALTER TABLE [lines] ADD lineLeader NVARCHAR(MAX);
                    END
                    ELSE
                    BEGIN
                        ALTER TABLE [lines] ALTER COLUMN lineLeader NVARCHAR(MAX);
                    END
                    IF COL_LENGTH('lines', 'mentor') IS NULL
                    BEGIN
                        ALTER TABLE [lines] ADD mentor NVARCHAR(255);
                    END
                    IF COL_LENGTH('lines', 'requirement') IS NULL
                    BEGIN
                        ALTER TABLE [lines] ADD requirement INT DEFAULT 0;
                    END
                    IF COL_LENGTH('lines', 'tenCycleFormType') IS NULL
                    BEGIN
                        ALTER TABLE [lines] ADD tenCycleFormType NVARCHAR(255) DEFAULT 'form1';
                    END
                    ELSE
                    BEGIN
                        ALTER TABLE [lines] ALTER COLUMN tenCycleFormType NVARCHAR(255);
                    END

                    DECLARE @ConstraintName NVARCHAR(MAX);
                    DECLARE @DropQuery NVARCHAR(MAX);
                    DECLARE constraint_cursor CURSOR FOR
                    SELECT fk.name
                    FROM sys.foreign_keys AS fk
                    INNER JOIN sys.foreign_key_columns AS fkc ON fk.object_id = fkc.constraint_object_id
                    INNER JOIN sys.columns AS fkc_col ON fkc.parent_object_id = fkc_col.object_id AND fkc.parent_column_id = fkc_col.column_id
                    INNER JOIN sys.tables AS t_ref ON fk.referenced_object_id = t_ref.object_id
                    WHERE fk.parent_object_id = OBJECT_ID('lines')
                      AND fkc_col.name = 'sectionId'
                      AND t_ref.name = 'departments';

                    OPEN constraint_cursor;
                    FETCH NEXT FROM constraint_cursor INTO @ConstraintName;
                    WHILE @@FETCH_STATUS = 0
                    BEGIN
                        SET @DropQuery = 'ALTER TABLE [lines] DROP CONSTRAINT ' + QUOTENAME(@ConstraintName);
                        EXEC sp_executesql @DropQuery;
                        FETCH NEXT FROM constraint_cursor INTO @ConstraintName;
                    END
                    CLOSE constraint_cursor;
                    DEALLOCATE constraint_cursor;

                    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Lines_Sections' AND parent_object_id = OBJECT_ID('lines'))
                    BEGIN
                        BEGIN TRY
                            ALTER TABLE [lines]
                            ADD CONSTRAINT FK_Lines_Sections FOREIGN KEY (sectionId) REFERENCES sections(id) ON DELETE CASCADE;
                        END TRY
                        BEGIN CATCH
                            -- Ignore if failed
                        END CATCH
                    END

                    IF EXISTS (SELECT * FROM sys.objects WHERE name = 'unique_dept_line' AND parent_object_id = OBJECT_ID('lines') AND type = 'UQ')
                    BEGIN
                        ALTER TABLE [lines] DROP CONSTRAINT unique_dept_line;
                    END
                    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'unique_dept_line' AND object_id = OBJECT_ID('lines'))
                    BEGIN
                        DROP INDEX unique_dept_line ON [lines];
                    END

                    IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'unique_section_line' AND parent_object_id = OBJECT_ID('lines') AND type = 'UQ')
                       AND NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'unique_section_line' AND object_id = OBJECT_ID('lines'))
                    BEGIN
                        ;WITH CTE AS (
                            SELECT name, sectionId, 
                                   ROW_NUMBER() OVER (PARTITION BY name, sectionId ORDER BY id DESC) as rn
                            FROM [lines]
                        )
                        DELETE FROM CTE WHERE rn > 1;
                        ALTER TABLE [lines] ADD CONSTRAINT unique_section_line UNIQUE (name, sectionId);
                    END

                    IF COL_LENGTH('lines', 'users') IS NULL
                    BEGIN
                        ALTER TABLE [lines] ADD [users] NVARCHAR(MAX) DEFAULT '[]';
                    END
                `);
                logger.info("Line table initialized successfully");

                // Trigger an initial sync for all lines to populate the new 'users' column
                const [lines] = await executeQuery("SELECT id FROM [lines]");
                for (const line of lines) {
                    await Line.syncUserList(line.id);
                }
                break; // Success, exit loop
            } catch (error) {
                if (error.message.toLowerCase().includes('deadlock') && attempts < maxAttempts) {
                    logger.warn(`Line table initialization deadlock (attempt ${attempts}), retrying in 500ms...`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    logger.error(`Failed to initialize Line table: ${error.message}`);
                    break;
                }
            }
        }
    }

    static async syncUserList(lineId) {
        try {
            // Aggregate users from sub-sections AND from direct line assignment (lines JSON array)
            const query = `
                SELECT DISTINCT userId FROM (
                    SELECT u.[value] as userId
                    FROM [sub_sections] ss
                    CROSS APPLY OPENJSON(ISNULL(ss.users, '[]')) AS u
                    WHERE ss.lineId = ?

                    UNION

                    SELECT CAST(u.id AS NVARCHAR(50)) as userId
                    FROM users u
                    WHERE (u.isDeleted = 0 OR u.isDeleted IS NULL)
                    AND EXISTS (SELECT 1 FROM OPENJSON(ISNULL(u.lines, '[]')) WHERE TRY_CAST([value] AS INT) = ?)
                ) combined
            `;
            const [rows] = await executeQuery(query, [lineId, lineId]);

            const userIds = rows.map(r => r.userId).filter(id => id !== null);
            const jsonUsers = JSON.stringify(userIds);

            await executeQuery("UPDATE [lines] SET users = ?, updatedAt = GETDATE() WHERE id = ?", [jsonUsers, lineId]);
            logger.info(`Synced user list for line ${lineId}. Total users: ${userIds.length}`);
            
            // Trigger Section Sync
            const [lineData] = await executeQuery("SELECT sectionId FROM [lines] WHERE id = ?", [lineId]);
            if (lineData.length > 0 && lineData[0].sectionId) {
                const Section = (await import("./section.model.js")).default;
                await Section.syncUserList(lineData[0].sectionId);
            }
        } catch (error) {
            logger.error(`Error syncing user list for line ${lineId}: ${error.message}`);
        }
    }

    static async create(data) {
        const line = new Line(data);

        const fields = [
            "name", "uniCode", "lineLeader", "mentor", "requirement", "tenCycleFormType", "department", "sectionId", "description", "isActive", "createdAt"
        ];

        if (!line.createdAt) line.createdAt = new Date();

        const values = fields.map(field => {
            const val = line[field];
            if (val === undefined) return null;
            return val;
        });

        const placeholders = fields.map(() => "?").join(",");
        const query = `INSERT INTO [lines] (${fields.join(",")}) 
        OUTPUT INSERTED.id
        VALUES (${placeholders})`;

        const [result] = await executeQuery(query, values);
        return Line.findById(result[0].id);
    }

    static async findById(id) {
        const query = `
            SELECT l.*, 
            (SELECT COUNT(*) FROM OPENJSON(ISNULL(l.users, '[]'))) as lineCount
            FROM [lines] l 
            WHERE l.id = ?`;
        const [rows] = await executeQuery(query, [id]);
        if (rows.length === 0) return null;
        return new Line(rows[0]);
    }

    static async findBySection(sectionId) {
        let query;
        let params = [];

        if (typeof sectionId === 'string' && sectionId.includes(',')) {
            const ids = sectionId.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
            if (ids.length === 0) return [];
            query = `
                SELECT l.*, 
                (SELECT COUNT(*) FROM OPENJSON(ISNULL(l.users, '[]'))) as lineCount
                FROM [lines] l 
                WHERE l.sectionId IN (${ids.join(',')}) 
                ORDER BY l.createdAt DESC`;
        } else {
            const parsedId = parseInt(sectionId);
            if (isNaN(parsedId)) return [];
            query = `
                SELECT l.*, 
                (SELECT COUNT(*) FROM OPENJSON(ISNULL(l.users, '[]'))) as lineCount
                FROM [lines] l 
                WHERE l.sectionId = ? 
                ORDER BY l.createdAt DESC`;
            params = [parsedId];
        }

        const [rows] = await executeQuery(query, params);
        return rows.map(row => new Line(row));
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
        const values = keys.map(key => query[key]);

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM [lines] WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new Line(rows[0]);
    }

    static async find(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT * FROM [lines]";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new Line(row));
    }

    static async countDocuments(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT COUNT(*) as count FROM [lines]";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows[0].count;
    }

    async save() {
        const fields = [
            "name", "uniCode", "lineLeader", "mentor", "requirement", "tenCycleFormType", "department", "sectionId", "description", "isActive"
        ];
        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => this[field]);
        values.push(this.id);

        await executeQuery(`UPDATE [lines] SET ${setClause}, updatedAt = GETDATE() WHERE id = ?`, values);
        return this;
    }
}

// Initialize table - Moved to server index start for explicit awaiting
// Line.init();

export default Line;
