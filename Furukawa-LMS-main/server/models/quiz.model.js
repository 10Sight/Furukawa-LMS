import { executeQuery } from "../db/mssqlHelper.js";
import { slugify } from "../utils/slugify.js";
import logger from "../logger/winston.logger.js";

import migrationHelper from "../db/migrationHelper.js";

class Quiz {
    constructor(data) {
        this.id = data.id;
        this._id = data.id; // Compatibility

        this.title = data.title;
        this.slug = data.slug;
        this.description = data.description;
        this.questions = typeof data.questions === 'string' ? JSON.parse(data.questions) : (data.questions || []);
        this.passingScore = data.passingScore;
        this.timeLimit = data.timeLimit;
        this.createdBy = data.createdBy;
        this.isPublished = !!data.isPublished;
        this.attemptsAllowed = data.attemptsAllowed !== undefined ? data.attemptsAllowed : 1;
        this.skillUpgradation = !!data.skillUpgradation;
        this.issueCertificate = data.issueCertificate !== undefined ? !!data.issueCertificate : true;
        this.isDojo = !!data.isDojo;
        this.isHandover = !!data.isHandover;
        this.isTheoretical = !!data.isTheoretical;
        this.conductedBy = data.conductedBy !== undefined && data.conductedBy !== null ? data.conductedBy : "";
        this.paperTitle = data.paperTitle || null;
        this.paperSubTitle = data.paperSubTitle || null;

        // Resource linking & Legacy fields
        this.courseId = data.courseId || data.course;
        this.course = this.courseId;

        this.moduleId = data.moduleId || data.module;
        this.module = this.moduleId;

        this.lessonId = data.lessonId;

        this.type = data.type || this.calculateType();
        this.scope = data.scope || this.calculateScope();

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;

        // Multi-department and section support
        this.departmentId = typeof data.departmentId === 'string' ? JSON.parse(data.departmentId || "[]") : (data.departmentId || []);
        this.sectionId = typeof data.sectionId === 'string' ? JSON.parse(data.sectionId || "[]") : (data.sectionId || []);
        this.lineId = typeof data.lineId === 'string' ? JSON.parse(data.lineId || "[]") : (data.lineId || []);
        this.subSectionId = typeof data.subSectionId === 'string' ? JSON.parse(data.subSectionId || "[]") : (data.subSectionId || []);
        this.level = data.level;
    }

    calculateType() {
        if (this.scope) return this.scope.toUpperCase();
        return this.module ? "MODULE" : "COURSE";
    }

    calculateScope() {
        if (this.lessonId || (this.type && this.type === "LESSON")) {
            return "lesson";
        } else if (this.moduleId || this.module) {
            return "module";
        } else if (this.courseId || this.course) {
            return "course";
        } else {
            return "standalone";
        }
    }

    validateScope() {
        if (this.scope === 'course' && (this.moduleId || this.lessonId)) {
            throw new Error('Course-scoped quiz cannot have module or lesson IDs');
        }
        if (this.scope === 'module' && (!this.moduleId || this.lessonId)) {
            throw new Error('Module-scoped quiz must have moduleId and cannot have lessonId');
        }
        if (this.scope === 'lesson' && (!this.lessonId || !this.moduleId)) {
            throw new Error('Lesson-scoped quiz must have both moduleId and lessonId');
        }
    }

    static async init() {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                const query = `
                    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'quizzes')
                    BEGIN
                        CREATE TABLE quizzes (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            title NVARCHAR(255) NOT NULL,
                            slug NVARCHAR(255) UNIQUE,
                            description NVARCHAR(MAX),
                            questions NVARCHAR(MAX),
                            passingScore INT NOT NULL,
                            timeLimit INT,
                            createdBy NVARCHAR(255) NOT NULL,
                            isPublished BIT DEFAULT 0,
                            attemptsAllowed INT DEFAULT 1,
                            skillUpgradation NVARCHAR(MAX),
                            issueCertificate BIT DEFAULT 1,
                            courseId NVARCHAR(255),
                            course NVARCHAR(255),
                            moduleId NVARCHAR(255),
                            module NVARCHAR(255),
                            lesson NVARCHAR(255),
                            lessonId NVARCHAR(255),
                            type NVARCHAR(50),
                            scope NVARCHAR(50),
                            departmentId NVARCHAR(MAX),
                            sectionId NVARCHAR(MAX),
                            lineId NVARCHAR(MAX),
                            subSectionId NVARCHAR(MAX),
                            level NVARCHAR(50),
                            isDojo BIT DEFAULT 0,
                            isHandover BIT DEFAULT 0,
                            isTheoretical BIT DEFAULT 0,
                            conductedBy NVARCHAR(255) DEFAULT '',
                            paperTitle NVARCHAR(500),
                            paperSubTitle NVARCHAR(500),
                            createdAt DATETIME DEFAULT GETDATE(),
                            updatedAt DATETIME DEFAULT GETDATE()
                        );
                        CREATE INDEX idx_quiz_course ON quizzes(course);
                        CREATE INDEX idx_quiz_module ON quizzes(module);
                    END
                `;
                await executeQuery(query);

                // Manual migration check for columns using INFORMATION_SCHEMA
                const columns = [
                    { name: 'departmentId', type: 'NVARCHAR(MAX)' },
                    { name: 'sectionId', type: 'NVARCHAR(MAX)' },
                    { name: 'lineId', type: 'NVARCHAR(MAX)' },
                    { name: 'subSectionId', type: 'NVARCHAR(MAX)' },
                    { name: 'level', type: 'NVARCHAR(50)' },
                    { name: 'isDojo', type: 'BIT DEFAULT 0' },
                    { name: 'isHandover', type: 'BIT DEFAULT 0' },
                    { name: 'isTheoretical', type: 'BIT DEFAULT 0' },
                    { name: 'conductedBy', type: "NVARCHAR(255) DEFAULT ''" },
                    { name: 'paperTitle', type: 'NVARCHAR(500)' },
                    { name: 'paperSubTitle', type: 'NVARCHAR(500)' }
                ];

                for (const col of columns) {
                    const checkColQuery = `
                        IF NOT EXISTS (
                            SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                            WHERE TABLE_NAME = 'quizzes' AND COLUMN_NAME = '${col.name}'
                        )
                        BEGIN
                            ALTER TABLE [quizzes] ADD [${col.name}] ${col.type}
                        END
                    `;
                    await executeQuery(checkColQuery);
                }

                // Ensure correct types
                await migrationHelper.ensureColumnType('quizzes', 'departmentId', 'NVARCHAR(MAX)');
                await migrationHelper.ensureColumnType('quizzes', 'sectionId', 'NVARCHAR(MAX)');
                await migrationHelper.ensureColumnType('quizzes', 'lineId', 'NVARCHAR(MAX)');
                await migrationHelper.ensureColumnType('quizzes', 'subSectionId', 'NVARCHAR(MAX)');

                logger.info("Quiz table initialized successfully");
                break; // Success
            } catch (error) {
                if (error.message.toLowerCase().includes('deadlock') && attempts < maxAttempts) {
                    logger.warn(`Quiz table initialization deadlock (attempt ${attempts}), retrying in 500ms...`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    logger.error("Failed to initialize Quiz table", error);
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
            const [rows] = await executeQuery("SELECT id FROM quizzes WHERE slug = ?", [slug]);
            if (rows.length === 0) break;
            suffix++;
            slug = `${baseSlug}-${suffix}`;
        }
        data.slug = slug;

        const quiz = new Quiz(data);
        quiz.validateScope();

        const fields = [
            "title", "slug", "description", "questions", "passingScore",
            "timeLimit", "createdBy", "isPublished", "attemptsAllowed",
            "skillUpgradation", "issueCertificate", "courseId", "course", "moduleId", "module",
            "lessonId", "type", "scope", "departmentId", "sectionId", "lineId", "subSectionId", "level", "isDojo", "isHandover", "isTheoretical", "conductedBy", "paperTitle", "paperSubTitle", "createdAt"
        ];

        if (!quiz.createdAt) quiz.createdAt = new Date();

        const values = fields.map(field => {
            let val = quiz[field];
            if (field === 'questions' || field === 'departmentId' || field === 'sectionId' || field === 'lineId' || field === 'subSectionId') return JSON.stringify(val || []);
            if (val === undefined) return null;
            return val;
        });

        const placeholders = fields.map(() => "?").join(",");
        const query = `INSERT INTO quizzes (${fields.join(",")}) OUTPUT INSERTED.id VALUES (${placeholders})`;

        const [result] = await executeQuery(query, values);
        return Quiz.findById(result[0].id);
    }

    static async findById(id) {
        if (!id || isNaN(id)) return null;
        const [rows] = await executeQuery("SELECT * FROM quizzes WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new Quiz(rows[0]);
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
        const values = keys.map(key => query[key]);

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM quizzes WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new Quiz(rows[0]);
    }

    static async find(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined && key !== 'sort');
        let sql = "SELECT * FROM quizzes";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        if (query.sort) {
            const sortKey = Object.keys(query.sort)[0];
            const sortOrder = query.sort[sortKey] === -1 ? 'DESC' : 'ASC';
            sql += ` ORDER BY ${sortKey} ${sortOrder}`;
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new Quiz(row));
    }

    static async countDocuments(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT COUNT(*) as count FROM quizzes";
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
        // Sync fields and validate
        if (this.courseId && !this.course) this.course = this.courseId;
        if (this.course && !this.courseId) this.courseId = this.course;
        if (this.moduleId && !this.module) this.module = this.moduleId;
        if (this.module && !this.moduleId) this.moduleId = this.module;

        this.scope = this.calculateScope();
        this.type = this.calculateType();
        this.validateScope();

        const fields = [
            "title", "slug", "description", "questions", "passingScore",
            "timeLimit", "createdBy", "isPublished", "attemptsAllowed",
            "skillUpgradation", "issueCertificate", "courseId", "course", "moduleId", "module",
            "lessonId", "type", "scope", "departmentId", "sectionId", "lineId", "subSectionId", "level", "isDojo", "isHandover", "isTheoretical", "conductedBy", "paperTitle", "paperSubTitle"
        ];

        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => {
            let val = this[field];
            if (field === 'questions' || field === 'departmentId' || field === 'sectionId' || field === 'lineId' || field === 'subSectionId') return JSON.stringify(val || []);
            return val;
        });
        values.push(this.id);

        await executeQuery(`UPDATE quizzes SET ${setClause} WHERE id = ?`, values);
        return this;
    }
}

// Initialize table
Quiz.init();

export default Quiz;
