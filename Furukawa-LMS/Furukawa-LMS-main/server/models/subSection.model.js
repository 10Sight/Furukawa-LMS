import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";
import { getDesignationShutterExclusionSql } from "../utils/userEligibility.js";

const toIdList = (ids) =>
    [...new Set((Array.isArray(ids) ? ids : [ids]).map(id => parseInt(id, 10)).filter(Number.isInteger))];

/**
 * Manpower count per sub-section: PRESENT, non-deleted, non-temporary users
 * not excluded by a designation shutter, linked either directly
 * (users.subSectionId) or through a machine assignment on that sub-section.
 * A user linked both ways is counted once.
 *
 * Returns a LEFT JOIN fragment (place it after FROM/JOINs, before WHERE) and
 * the matching select column. Built set-based so eligibility is evaluated
 * once per user instead of once per user per sub-section row; the old
 * correlated `u.subSectionId = ss.id OR EXISTS(...)` scalar subquery took
 * ~34s on the full sub-section list.
 *
 * `subSectionIds` / `lineIds` (optional) limit the aggregation to those
 * sub-sections / lines' sub-sections. Ids are coerced to integers before
 * being inlined, so callers may pass raw request values.
 */
export const subSectionCountJoinSql = (subSectionAlias = "ss", { subSectionIds = null, lineIds = null } = {}) => {
    let scope = "";
    if (subSectionIds !== null && subSectionIds !== undefined) {
        const ids = toIdList(subSectionIds);
        scope += ` AND links.subSectionId IN (${ids.length ? ids.join(",") : "NULL"})`;
    }
    if (lineIds !== null && lineIds !== undefined) {
        const ids = toIdList(lineIds);
        scope += ` AND links.subSectionId IN (SELECT id FROM [sub_sections] WHERE lineId IN (${ids.length ? ids.join(",") : "NULL"}))`;
    }
    return `
    LEFT JOIN (
        SELECT links.subSectionId, COUNT(DISTINCT eu.id) AS cnt
        FROM users eu
        CROSS APPLY (
            SELECT eu.subSectionId AS subSectionId
            UNION
            SELECT m.subSectionId
            FROM machine_assignments ma
            JOIN machines m ON ma.machine_id = m.id
            WHERE ma.user_id = eu.id
        ) links
        WHERE (eu.isDeleted = 0 OR eu.isDeleted IS NULL)
          AND (eu.isTemporary = 0 OR eu.isTemporary IS NULL)
          AND eu.status = 'PRESENT'
          ${getDesignationShutterExclusionSql("eu")}
          AND links.subSectionId IS NOT NULL
          ${scope}
        GROUP BY links.subSectionId
    ) ${subSectionAlias}_cnt ON ${subSectionAlias}_cnt.subSectionId = ${subSectionAlias}.id`;
};

export const subSectionCountSelectSql = (subSectionAlias = "ss") =>
    `ISNULL(${subSectionAlias}_cnt.cnt, 0) AS subSectionCount`;

class SubSection {
    constructor(data) {
        this.id = data.id || data._id;
        this.name = data.name;
        this.lineId = data.lineId;
        this.description = data.description;
        this.minimumRequiredLevel = data.minimumRequiredLevel || null;
        this.minEfficiency = data.minEfficiency !== undefined ? data.minEfficiency : null;
        this.maxEfficiency = data.maxEfficiency !== undefined ? data.maxEfficiency : null;
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
            if (!await migrationHelper.tableExists('sub_sections')) {
                await executeQuery(`
                    CREATE TABLE [sub_sections] (
                        id INT PRIMARY KEY IDENTITY(1,1),
                        name NVARCHAR(255) NOT NULL,
                        lineId INT NOT NULL,
                        description NVARCHAR(MAX),
                        isActive BIT DEFAULT 1,
                        users NVARCHAR(MAX) DEFAULT '[]',
                        minEfficiency DECIMAL(5,2) NULL,
                        maxEfficiency DECIMAL(5,2) NULL,
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        CONSTRAINT FK_SubSections_Lines FOREIGN KEY (lineId) REFERENCES [lines](id) ON DELETE CASCADE
                    )
                `);
                await migrationHelper.ensureIndexExists('sub_sections', 'IX_SubSections_LineId', 'CREATE INDEX IX_SubSections_LineId ON [sub_sections](lineId)');
            } else {
                await migrationHelper.ensureColumnExists('sub_sections', 'users', "NVARCHAR(MAX) DEFAULT '[]'");
                await migrationHelper.ensureColumnExists('sub_sections', 'minimumRequiredLevel', 'NVARCHAR(50)');
                await migrationHelper.ensureColumnExists('sub_sections', 'minEfficiency', 'DECIMAL(5,2) NULL');
                await migrationHelper.ensureColumnExists('sub_sections', 'maxEfficiency', 'DECIMAL(5,2) NULL');
            }
            logger.info("SubSection table initialized successfully");

            // Startup full-table resync removed: sub_sections.users is kept current incrementally by
            // SubSection.syncUserList, called from user create/update/import flows (see
            // user.controller.js). Re-running it for every sub-section here was a per-row scan
            // against `users`/`machine_assignments` on every boot, causing lock contention on startup.
            // const [subSections] = await executeQuery("SELECT id FROM [sub_sections]");
            // for (const ss of subSections) {
            //     await SubSection.syncUserList(ss.id);
            // }
        } catch (error) {
            logger.error("Failed to initialize SubSection table", error);
        }
    }

    static async syncUserList(subSectionId) {
        try {
            // Aggregate users from direct assignment, JSON array assignment, AND machine assignments
            const query = `
                SELECT DISTINCT u.id
                FROM users u
                LEFT JOIN machine_assignments ma ON u.id = ma.user_id
                LEFT JOIN machines m ON ma.machine_id = m.id
                WHERE (u.role IN ('STUDENT', 'CUSTOM') AND (u.isDeleted = 0 OR u.isDeleted IS NULL))
                AND (
                    u.subSectionId = ?
                    OR EXISTS (SELECT 1 FROM OPENJSON(ISNULL(u.subSections, '[]')) WHERE TRY_CAST([value] AS INT) = ?)
                    OR m.subSectionId = ?
                )
            `;
            const [rows] = await executeQuery(query, [subSectionId, subSectionId, subSectionId]);
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
            "name", "lineId", "description", "minimumRequiredLevel", "minEfficiency", "maxEfficiency", "isActive", "createdAt"
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
            SELECT ss.*, ${subSectionCountSelectSql("ss")}
            FROM [sub_sections] ss
            ${subSectionCountJoinSql("ss", { subSectionIds: [id] })}
            WHERE ss.id = ?`;
        const [rows] = await executeQuery(query, [id]);
        if (rows.length === 0) return null;
        return new SubSection(rows[0]);
    }

    static async findByLine(lineId) {
        let query;
        let params = [];

        if (typeof lineId === 'string' && lineId.includes(',')) {
            const ids = lineId.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
            if (ids.length === 0) return [];
            query = `
                SELECT ss.*, ${subSectionCountSelectSql("ss")}
                FROM [sub_sections] ss
                ${subSectionCountJoinSql("ss", { lineIds: ids })}
                WHERE ss.lineId IN (${ids.join(',')})
                ORDER BY ss.createdAt DESC`;
        } else {
            const parsedId = parseInt(lineId);
            if (isNaN(parsedId)) return [];
            query = `
                SELECT ss.*, ${subSectionCountSelectSql("ss")}
                FROM [sub_sections] ss
                ${subSectionCountJoinSql("ss", { lineIds: [parsedId] })}
                WHERE ss.lineId = ?
                ORDER BY ss.createdAt DESC`;
            params = [parsedId];
        }

        const [rows] = await executeQuery(query, params);
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
            "name", "lineId", "description", "minimumRequiredLevel", "minEfficiency", "maxEfficiency", "isActive"
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
