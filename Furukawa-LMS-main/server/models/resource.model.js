import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class Resource {
    constructor(data) {
        this.id = data.id;
        this._id = data.id; // Compatibility

        this.courseId = data.courseId || null;
        this.moduleId = data.moduleId || null;
        this.lessonId = data.lessonId || null;
        this.scope = data.scope;
        this.title = data.title;
        // Handle type normalization
        this.type = data.type ? data.type.toLowerCase() : data.type;
        this.description = data.description;
        this.url = data.url;
        this.publicId = data.publicId || null;
        this.fileSize = data.fileSize !== undefined ? data.fileSize : null;
        this.format = data.format || null;
        this.fileName = data.fileName || null;
        this.createdBy = data.createdBy;

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    validateScope() {
        if (this.scope === 'course' && !this.courseId) {
            throw new Error('Course ID is required for course-scoped resources');
        }
        if (this.scope === 'module' && !this.moduleId) {
            throw new Error('Module ID is required for module-scoped resources');
        }
        if (this.scope === 'lesson' && !this.lessonId) {
            throw new Error('Lesson ID is required for lesson-scoped resources');
        }

        const scopes = [this.courseId, this.moduleId, this.lessonId].filter(id => id);
        if (scopes.length !== 1) {
            throw new Error('Resource must belong to exactly one scope (course, module, or lesson)');
        }
    }

    static async init() {
        try {
            if (!await migrationHelper.tableExists('resources')) {
                await executeQuery(`
                    CREATE TABLE resources (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        courseId INT,
                        moduleId INT,
                        lessonId INT,
                        scope NVARCHAR(50) NOT NULL,
                        title NVARCHAR(255) NOT NULL,
                        type NVARCHAR(50) NOT NULL,
                        description NVARCHAR(MAX),
                        url NVARCHAR(MAX) NOT NULL,
                        publicId NVARCHAR(255),
                        fileSize INT,
                        format NVARCHAR(50),
                        fileName NVARCHAR(255),
                        createdBy INT NOT NULL,
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE()
                    )
                `);
                await migrationHelper.ensureIndexExists('resources', 'idx_resource_scope',
                    'CREATE INDEX idx_resource_scope ON resources(scope)');
                await migrationHelper.ensureIndexExists('resources', 'idx_resource_courseId',
                    'CREATE INDEX idx_resource_courseId ON resources(courseId)');
                await migrationHelper.ensureIndexExists('resources', 'idx_resource_moduleId',
                    'CREATE INDEX idx_resource_moduleId ON resources(moduleId)');
                await migrationHelper.ensureIndexExists('resources', 'idx_resource_lessonId',
                    'CREATE INDEX idx_resource_lessonId ON resources(lessonId)');
            }
            // logger.info("Resource table initialized successfully");
        } catch (error) {
            logger.error("Failed to initialize Resource table", error);
        }
    }

    static async create(data) {
        const resource = new Resource(data);
        resource.validateScope();

        const fields = [
            "courseId", "moduleId", "lessonId", "scope", "title",
            "type", "description", "url", "publicId", "fileSize",
            "format", "fileName", "createdBy"
        ];

        const values = fields.map(field => resource[field]);
        const placeholders = fields.map(() => "?").join(",");

        const query = `
            INSERT INTO resources (${fields.join(",")}) 
            OUTPUT INSERTED.*
            VALUES (${placeholders})
        `;

        const [rows] = await executeQuery(query, values);
        return new Resource(rows[0]);
    }

    static async findById(id) {
        if (!id) return null;
        const [rows] = await executeQuery("SELECT * FROM resources WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new Resource(rows[0]);
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
        const values = keys.map(key => query[key]);

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM resources WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new Resource(rows[0]);
    }

    static async find(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT * FROM resources";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new Resource(row));
    }

    static async countDocuments(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT COUNT(*) as count FROM resources";
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
        this.type = this.type ? this.type.toLowerCase() : this.type;
        this.validateScope();

        const fields = [
            "courseId", "moduleId", "lessonId", "scope", "title",
            "type", "description", "url", "publicId", "fileSize",
            "format", "fileName", "createdBy"
        ];

        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => this[field]);
        values.push(this.id);

        await executeQuery(`UPDATE resources SET ${setClause}, updatedAt = GETDATE() WHERE id = ?`, values);
        return this;
    }
}

// Initialize table
Resource.init();

export default Resource;
