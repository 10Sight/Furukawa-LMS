import { executeQuery } from "../db/mssqlHelper.js";
import { slugify } from "../utils/slugify.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class Course {
    constructor(data) {
        this.id = data.id;
        this._id = data.id; // Compatibility

        this.title = data.title;
        this.description = data.description;
        this.thumbnail = typeof data.thumbnail === 'string' ? JSON.parse(data.thumbnail) : (data.thumbnail || { publicId: "", url: "" });
        this.category = data.category;
        this.tags = typeof data.tags === 'string' ? JSON.parse(data.tags) : (data.tags || []);
        this.students = typeof data.students === 'string' ? JSON.parse(data.students) : (data.students || []);
        this.price = data.price !== undefined ? data.price : 0;
        this.difficulty = data.difficulty || "BEGGINER";
        this.modules = typeof data.modules === 'string' ? JSON.parse(data.modules) : (data.modules || []);
        this.reviews = typeof data.reviews === 'string' ? JSON.parse(data.reviews) : (data.reviews || []);
        this.totalEnrollments = data.totalEnrollments !== undefined ? data.totalEnrollments : 0;
        this.averageRating = data.averageRating !== undefined ? data.averageRating : 0;
        this.slug = data.slug;
        this.createdBy = data.createdBy;
        this.quizzes = typeof data.quizzes === 'string' ? JSON.parse(data.quizzes) : (data.quizzes || []);
        this.assignments = typeof data.assignments === 'string' ? JSON.parse(data.assignments) : (data.assignments || []);
        this.resources = typeof data.resources === 'string' ? JSON.parse(data.resources) : (data.resources || []);
        this.isDeleted = !!data.isDeleted;
        this.departmentId = typeof data.departmentId === 'string' ? JSON.parse(data.departmentId || "[]") : (data.departmentId || []);
        this.sectionId = typeof data.sectionId === 'string' ? JSON.parse(data.sectionId || "[]") : (data.sectionId || []);

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    // Emulate Mongoose virtual
    get studentCount() {
        return this.students ? this.students.length : 0;
    }

    static async init() {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                const query = `
                    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'courses')
                    BEGIN
                        CREATE TABLE courses (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            title NVARCHAR(255) NOT NULL,
                            description NVARCHAR(MAX),
                            thumbnail NVARCHAR(MAX),
                            category NVARCHAR(255) NOT NULL,
                            tags NVARCHAR(MAX),
                            instructor INT NULL,
                            students NVARCHAR(MAX),
                            price DECIMAL(10, 2) DEFAULT 0,
                            difficulty NVARCHAR(50) DEFAULT 'BEGGINER',
                            modules NVARCHAR(MAX),
                            reviews NVARCHAR(MAX),
                            totalEnrollments INT DEFAULT 0,
                            averageRating DECIMAL(3, 2) DEFAULT 0,
                            slug NVARCHAR(255) UNIQUE,
                            createdBy INT,
                            quizzes NVARCHAR(MAX),
                            assignments NVARCHAR(MAX),
                            resources NVARCHAR(MAX),
                            departmentId NVARCHAR(MAX),
                            sectionId NVARCHAR(MAX),
                            isDeleted BIT DEFAULT 0,
                            createdAt DATETIME DEFAULT GETDATE(),
                            updatedAt DATETIME DEFAULT GETDATE()
                        );
                        CREATE INDEX idx_category ON courses(category);
                    END
                `;
                await executeQuery(query);

                // Self-healing migration: instructor is no longer required directly on a course
                // (instructors are now associated via department.instructor instead)
                await executeQuery(`
                    IF EXISTS (
                        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_NAME = 'courses' AND COLUMN_NAME = 'instructor' AND IS_NULLABLE = 'NO'
                    )
                    BEGIN
                        ALTER TABLE courses ALTER COLUMN instructor INT NULL;
                    END
                `);

                // Manual migration check for columns using INFORMATION_SCHEMA
                const columns = [
                    { name: 'departmentId', type: 'NVARCHAR(MAX)' },
                    { name: 'sectionId', type: 'NVARCHAR(MAX)' },
                    { name: 'isDeleted', type: 'BIT DEFAULT 0' }
                ];

                for (const col of columns) {
                    const checkColQuery = `
                        IF NOT EXISTS (
                            SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                            WHERE TABLE_NAME = 'courses' AND COLUMN_NAME = '${col.name}'
                        )
                        BEGIN
                            ALTER TABLE [courses] ADD [${col.name}] ${col.type}
                        END
                    `;
                    await executeQuery(checkColQuery);
                }

                // Ensure correct types
                await migrationHelper.ensureColumnType('courses', 'departmentId', 'NVARCHAR(MAX)');
                await migrationHelper.ensureColumnType('courses', 'sectionId', 'NVARCHAR(MAX)');
                
                logger.info("Course table initialized successfully");
                break; // Success
            } catch (error) {
                if (error.message.toLowerCase().includes('deadlock') && attempts < maxAttempts) {
                    logger.warn(`Course table initialization deadlock (attempt ${attempts}), retrying in 500ms...`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    logger.error("Failed to initialize Course table", error);
                    break;
                }
            }
        }
    }

    static async create(data) {
        // Generate unique slug
        let baseSlug = slugify(data.title);
        let slug = baseSlug;
        let suffix = 1;
        while (true) {
            const [rows] = await executeQuery("SELECT id FROM courses WHERE slug = ?", [slug]);
            if (rows.length === 0) break;
            suffix++;
            slug = `${baseSlug}-${suffix}`;
        }
        data.slug = slug;

        const course = new Course(data);

        const fields = [
            "title", "description", "thumbnail", "category", "tags",
            "students", "price", "difficulty",
            "modules", "reviews", "totalEnrollments", "averageRating",
            "slug", "createdBy", "quizzes", "assignments", "resources",
            "departmentId", "sectionId", "isDeleted", "createdAt"
        ];

        if (!course.createdAt) course.createdAt = new Date();

        const values = fields.map(field => {
            let val = course[field];
            if (['thumbnail', 'tags', 'students', 'modules', 'reviews', 'quizzes', 'assignments', 'resources', 'departmentId', 'sectionId'].includes(field)) {
                return JSON.stringify(val);
            }
            if (val === undefined) return null;
            return val;
        });

        const placeholders = fields.map(() => "?").join(",");
        const query = `INSERT INTO courses (${fields.join(",")}) 
        OUTPUT INSERTED.id
        VALUES (${placeholders})`;

        const [result] = await executeQuery(query, values);
        return Course.findById(result[0].id);
    }

    static async findById(id) {
        if (!id || isNaN(id)) return null;
        const [rows] = await executeQuery("SELECT * FROM courses WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new Course(rows[0]);
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
        const values = keys.map(key => query[key]);

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM courses WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new Course(rows[0]);
    }

    static async find(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined && key !== 'sort'); // Exclude special keys if any
        let sql = "SELECT * FROM courses";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new Course(row));
    }

    static async countDocuments(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT COUNT(*) as count FROM courses";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows[0].count;
    }

    static async exists(query) {
        const doc = await this.findOne(query);
        return !!doc;
    }

    async save() {
        // Update Slug if title changed (simple check: if current title != stored title from DB? 
        // But we don't have stored title easily accessible unless we fetch or store it.
        // For now, let's assume if the slug is empty or we force regen. 
        // Ideally, standard practice is to regen slug if title changes.
        // We'll skip complex change tracking for now to keep it simple, but we could add it.

        const fields = [
            "title", "description", "thumbnail", "category", "tags",
            "students", "price", "difficulty",
            "modules", "reviews", "totalEnrollments", "averageRating",
            "slug", "createdBy", "quizzes", "assignments", "resources",
            "departmentId", "sectionId", "isDeleted"
        ];

        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => {
            let val = this[field];
            if (['thumbnail', 'tags', 'students', 'modules', 'reviews', 'quizzes', 'assignments', 'resources', 'departmentId', 'sectionId'].includes(field)) {
                return JSON.stringify(val);
            }
            return val;
        });
        values.push(this.id);

        await executeQuery(`UPDATE courses SET ${setClause}, updatedAt = GETDATE() WHERE id = ?`, values);
        return this;
    }
}

// Initialize table
Course.init();

export default Course;
