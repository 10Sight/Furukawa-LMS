import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class Assignment {
    constructor(data) {
        this.id = data.id;
        this._id = data.id; // Compatibility
        // Legacy fields mapping
        this.course = data.course || data.courseId;
        this.module = data.module || data.moduleId;
        this.lesson = data.lesson || data.lessonId;

        // New fields
        this.courseId = data.courseId || data.course; // Sync
        this.moduleId = data.moduleId || data.module; // Sync
        this.lessonId = data.lessonId || data.lesson; // Sync

        this.scope = data.scope || this._determineScope();

        // Foreign keys - keeping as strings to support mixed Mongo/SQL ID types if necessary, though User is int now.
        this.instructor = data.instructor;
        this.title = data.title;
        this.description = data.description;
        this.resources = typeof data.resources === 'string' ? JSON.parse(data.resources) : (data.resources || []);
        this.dueDate = data.dueDate ? new Date(data.dueDate) : null;
        this.maxScore = data.maxScore !== undefined ? data.maxScore : 100;
        this.allowResubmission = data.allowResubmission !== undefined ? !!data.allowResubmission : true;
        this.status = data.status || "ACTIVE";
        this.createdBy = data.createdBy;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    _determineScope() {
        if (this.lessonId) return "lesson";
        if (this.moduleId) return "module";
        return "course";
    }

    static async init() {
        const query = `
            IF OBJECT_ID('assignments', 'U') IS NULL
            BEGIN
                CREATE TABLE assignments (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    courseId INT NOT NULL,
                    moduleId INT,
                    lessonId INT,
                    scope NVARCHAR(50) NOT NULL,
                    instructor INT,
                    title NVARCHAR(255) NOT NULL,
                    description NVARCHAR(MAX),
                    resources NVARCHAR(MAX),
                    dueDate DATETIME NOT NULL,
                    maxScore INT DEFAULT 100,
                    allowResubmission BIT DEFAULT 1,
                    status NVARCHAR(50) DEFAULT 'ACTIVE',
                    createdBy INT NOT NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                )
            END
        `;
        try {
            await executeQuery(query);
        } catch (error) {
            logger.error("Failed to initialize Assignment table", error);
        }
    }

    static async create(data) {
        // Validation logic from pre-save hook
        const assignment = new Assignment(data);
        const { scope, courseId, moduleId, lessonId } = assignment;

        if (scope === 'course' && (moduleId || lessonId)) {
            throw new Error('Course-scoped assignment cannot have module or lesson IDs');
        }
        if (scope === 'module' && (!moduleId || lessonId)) {
            throw new Error('Module-scoped assignment must have moduleId and cannot have lessonId');
        }
        if (scope === 'lesson' && (!lessonId || !moduleId)) {
            throw new Error('Lesson-scoped assignment must have both moduleId and lessonId');
        }

        const fields = [
            "courseId", "moduleId", "lessonId", "scope", "instructor",
            "title", "description", "resources", "dueDate", "maxScore",
            "allowResubmission", "status", "createdBy"
        ];

        const values = fields.map(field => {
            let val = assignment[field];
            if (field === 'resources') return JSON.stringify(val);
            if (val === undefined) return null;
            return val;
        });

        const placeholders = fields.map(() => "?").join(",");
        const query = `INSERT INTO assignments (${fields.join(",")}) 
        OUTPUT INSERTED.id
        VALUES (${placeholders})`;

        const [result] = await executeQuery(query, values);
        return Assignment.findById(result[0].id);
    }

    static async findById(id) {
        if (!id || isNaN(id)) return null;
        const [rows] = await executeQuery("SELECT * FROM assignments WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new Assignment(rows[0]);
    }

    static async findOne(query) {
        // Map legacy fields
        const mappedQuery = { ...query };
        if (mappedQuery.course !== undefined) {
            mappedQuery.courseId = mappedQuery.course;
            delete mappedQuery.course;
        }
        if (mappedQuery.module !== undefined) {
            mappedQuery.moduleId = mappedQuery.module;
            delete mappedQuery.module;
        }
        if (mappedQuery.lesson !== undefined) {
            mappedQuery.lessonId = mappedQuery.lesson;
            delete mappedQuery.lesson;
        }

        const keys = Object.keys(mappedQuery).filter(key => mappedQuery[key] !== undefined);
        if (keys.length === 0) return null;

        const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
        const values = keys.map(key => mappedQuery[key]);

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM assignments WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new Assignment(rows[0]);
    }

    static async find(query = {}) {
        // Map legacy fields
        const mappedQuery = { ...query };
        if (mappedQuery.course !== undefined) {
            mappedQuery.courseId = mappedQuery.course;
            delete mappedQuery.course;
        }
        if (mappedQuery.module !== undefined) {
            mappedQuery.moduleId = mappedQuery.module;
            delete mappedQuery.module;
        }
        if (mappedQuery.lesson !== undefined) {
            mappedQuery.lessonId = mappedQuery.lesson;
            delete mappedQuery.lesson;
        }

        const keys = Object.keys(mappedQuery).filter(key => mappedQuery[key] !== undefined && key !== 'sort');
        let sql = "SELECT * FROM assignments";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => mappedQuery[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new Assignment(row));
    }

    static async countDocuments(query = {}) {
        // Map legacy fields
        const mappedQuery = { ...query };
        if (mappedQuery.course !== undefined) {
            mappedQuery.courseId = mappedQuery.course;
            delete mappedQuery.course;
        }
        if (mappedQuery.module !== undefined) {
            mappedQuery.moduleId = mappedQuery.module;
            delete mappedQuery.module;
        }
        if (mappedQuery.lesson !== undefined) {
            mappedQuery.lessonId = mappedQuery.lesson;
            delete mappedQuery.lesson;
        }

        const keys = Object.keys(mappedQuery).filter(key => mappedQuery[key] !== undefined);
        let sql = "SELECT COUNT(*) as count FROM assignments";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => mappedQuery[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows[0].count;
    }

    async save() {
        // Re-validate scope
        if (this.scope === 'course' && (this.moduleId || this.lessonId)) {
            throw new Error('Course-scoped assignment cannot have module or lesson IDs');
        }
        if (this.scope === 'module' && (!this.moduleId || this.lessonId)) {
            throw new Error('Module-scoped assignment must have moduleId and cannot have lessonId');
        }
        if (this.scope === 'lesson' && (!this.lessonId || !this.moduleId)) {
            throw new Error('Lesson-scoped assignment must have both moduleId and lessonId');
        }

        const fields = [
            "courseId", "moduleId", "lessonId", "scope", "instructor",
            "title", "description", "resources", "dueDate", "maxScore",
            "allowResubmission", "status", "createdBy"
        ];

        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => {
            const val = this[field];
            if (field === 'resources') return JSON.stringify(val);
            return val;
        });
        values.push(this.id);

        await executeQuery(`UPDATE assignments SET ${setClause}, updatedAt = GETDATE() WHERE id = ?`, values);
        return this;
    }
}

// Initialize table
Assignment.init();

export default Assignment;
