import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class SubSection {
    constructor(data) {
        this.id = data.id || data._id;
        this.name = data.name;
        this.lineId = data.lineId;
        this.description = data.description;
        this.minimumRequiredLevel = data.minimumRequiredLevel || null;
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.users = typeof data.users === 'string' ? JSON.parse(data.users) : (data.users || []);
        this.subSectionCount = data.subSectionCount || this.users.length || 0;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async asyncExecute(query, params = []) {
        try {
            return await executeQuery(query, params);
        } catch (error) {
            logger.error(`Database error: ${error.message}`, { query, params });
            // Don't throw for cleanup errors to allow init to proceed
            return [[]];
        }
    }

    static async init() {
        try {
            logger.info("Initializing SubSection table and cleaning up schema...");

            // 1. Identify and drop unique constraints on sub_sections
            const [constraints] = await this.asyncExecute(`
                SELECT name 
                FROM sys.key_constraints 
                WHERE type = 'UQ' AND parent_object_id = OBJECT_ID('sub_sections')
            `);
            for (const constraint of constraints) {
                logger.info(`Dropping unique constraint: ${constraint.name}`);
                await this.asyncExecute(`ALTER TABLE [sub_sections] DROP CONSTRAINT [${constraint.name}]`);
            }

            // 2. Identify and drop unique indexes
            const [indexes] = await this.asyncExecute(`
                SELECT name 
                FROM sys.indexes 
                WHERE is_unique = 1 AND object_id = OBJECT_ID('sub_sections') AND is_primary_key = 0
            `);
            for (const index of indexes) {
                logger.info(`Dropping unique index: ${index.name}`);
                await this.asyncExecute(`DROP INDEX [${index.name}] ON [sub_sections]`);
            }

            // 3. Drop uniCode column if it exists
            const [columns] = await this.asyncExecute(`
                SELECT name FROM sys.columns 
                WHERE object_id = OBJECT_ID('sub_sections') AND name = 'uniCode'
            `);
            if (columns.length > 0) {
                logger.info("Dropping uniCode column from sub_sections");
                await this.asyncExecute("ALTER TABLE [sub_sections] DROP COLUMN [uniCode]");
            }

            // 4. Ensure table exists with correct schema
            const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sub_sections')
            BEGIN
                CREATE TABLE [sub_sections] (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    name NVARCHAR(255) NOT NULL,
                    lineId INT NOT NULL,
                    description NVARCHAR(MAX),
                    isActive BIT DEFAULT 1,
                    users NVARCHAR(MAX) DEFAULT '[]',
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_SubSections_Lines FOREIGN KEY (lineId) REFERENCES [lines](id) ON DELETE CASCADE
                );
                CREATE INDEX IX_SubSections_LineId ON [sub_sections](lineId);
            END
            ELSE
            BEGIN
                IF COL_LENGTH('sub_sections', 'users') IS NULL
                BEGIN
                    ALTER TABLE [sub_sections] ADD users NVARCHAR(MAX) DEFAULT '[]';
                END
                IF COL_LENGTH('sub_sections', 'minimumRequiredLevel') IS NULL
                BEGIN
                    ALTER TABLE [sub_sections] ADD minimumRequiredLevel NVARCHAR(50);
                END
            END`;
            await executeQuery(query);
            logger.info("SubSection table initialized successfully");

            // Initial sync for all sub-sections
            const [subSections] = await executeQuery("SELECT id FROM [sub_sections]");
            for (const ss of subSections) {
                await SubSection.syncUserList(ss.id);
            }
        } catch (error) {
            logger.error("Failed to initialize SubSection table", error);
        }
    }

    static async syncUserList(subSectionId) {
        try {
            // Aggregate users from direct assignment AND machine assignments
            const query = `
                SELECT DISTINCT u.id
                FROM users u
                LEFT JOIN machine_assignments ma ON u.id = ma.user_id
                LEFT JOIN machines m ON ma.machine_id = m.id
                WHERE (u.role IN ('STUDENT', 'CUSTOM') AND (u.isDeleted = 0 OR u.isDeleted IS NULL))
                AND (u.subSectionId = ? OR m.subSectionId = ?)
            `;
            const [rows] = await executeQuery(query, [subSectionId, subSectionId]);
            const userIds = rows.map(r => r.id);
            const jsonUsers = JSON.stringify(userIds);

            await executeQuery("UPDATE [sub_sections] SET users = ?, updatedAt = GETDATE() WHERE id = ?", [jsonUsers, subSectionId]);
            
            logger.info(`Synced user list for sub-section ${subSectionId}. Total users: ${userIds.length}`);

            // Trigger parent line sync
            const [ss] = await executeQuery("SELECT lineId FROM [sub_sections] WHERE id = ?", [subSectionId]);
            if (ss.length > 0 && ss[0].lineId) {
                const Line = (await import("./line.model.js")).default;
                await Line.syncUserList(ss[0].lineId);
            }
        } catch (error) {
            logger.error(`Error syncing user list for sub-section ${subSectionId}: ${error.message}`);
        }
    }

    static async create(data) {
        const subSection = new SubSection(data);

        const fields = [
            "name", "lineId", "description", "minimumRequiredLevel", "isActive", "createdAt"
        ];

        if (!subSection.createdAt) subSection.createdAt = new Date();

        const values = fields.map(field => {
            const val = subSection[field];
            if (val === undefined) return null;
            return val;
        });

        const placeholders = fields.map(() => "?").join(",");
        const query = `INSERT INTO [sub_sections] (${fields.join(",")}) 
        OUTPUT INSERTED.id
        VALUES (${placeholders})`;

        const [result] = await executeQuery(query, values);
        return SubSection.findById(result[0].id);
    }

    static async findById(id) {
        const query = `
            SELECT ss.*, 
            (SELECT COUNT(*) FROM OPENJSON(ISNULL(ss.users, '[]'))) as subSectionCount
            FROM [sub_sections] ss 
            WHERE ss.id = ?`;
        const [rows] = await executeQuery(query, [id]);
        if (rows.length === 0) return null;
        return new SubSection(rows[0]);
    }

    static async findByLine(lineId) {
        const query = `
            SELECT ss.*, 
            (SELECT COUNT(*) FROM OPENJSON(ISNULL(ss.users, '[]'))) as subSectionCount
            FROM [sub_sections] ss 
            WHERE ss.lineId = ? 
            ORDER BY ss.createdAt DESC`;
        const [rows] = await executeQuery(query, [lineId]);
        return rows.map(row => new SubSection(row));
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
        const values = keys.map(key => query[key]);

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM [sub_sections] WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new SubSection(rows[0]);
    }

    static async find(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT * FROM [sub_sections]";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new SubSection(row));
    }

    async save() {
        const fields = [
            "name", "lineId", "description", "minimumRequiredLevel", "isActive"
        ];

        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => this[field]);
        values.push(this.id);

        await executeQuery(`UPDATE [sub_sections] SET ${setClause}, updatedAt = GETDATE() WHERE id = ?`, values);
        return this;
    }
}

// Initialize table
// SubSection.init();

export default SubSection;
