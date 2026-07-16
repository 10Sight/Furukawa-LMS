import { executeQuery } from "../db/mssqlHelper.js";
import { slugify } from "../utils/slugify.js";
import logger from "../logger/winston.logger.js";
// Imports for cleanup operations - assuming successful migration of these models
import User from "./auth.model.js";
import Assignment from "./assignment.model.js";
import AttemptedQuiz from "./attemptedQuiz.model.js";
// Progress and Submission models should be imported here when they are migrated, or use direct SQL queries.
// To avoid circular or missing dependencies during partial migration, we will use dynamic imports or verify existence.

class Department {
    constructor(data) {
        this.id = data.id;
        this._id = data.id; // Compatibility

        this.name = data.name;
        this.uniCode = data.uniCode;
        this.slug = data.slug;
        this.course = data.course;
        this.courses = typeof data.courses === 'string' ? JSON.parse(data.courses) : (data.courses || []);
        // Instructor should be a scalar ID (string or number), but handle legacy JSON array if present
        if (typeof data.instructor === 'string' && (data.instructor.startsWith('[') || data.instructor.startsWith('"'))) {
            try {
                const parsed = JSON.parse(data.instructor);
                this.instructor = Array.isArray(parsed) ? (parsed.length > 0 ? parsed[0] : null) : parsed;
            } catch (e) {
                this.instructor = data.instructor;
            }
        } else {
            this.instructor = data.instructor;
        }
        this.students = typeof data.students === 'string' ? JSON.parse(data.students) : (data.students || []);
        this.startDate = data.startDate ? new Date(data.startDate) : null;
        this.endDate = data.endDate ? new Date(data.endDate) : null;
        this.capacity = data.capacity !== undefined ? data.capacity : 50;
        this.status = data.status || "UPCOMING";
        this.schedule = typeof data.schedule === 'string' ? JSON.parse(data.schedule) : (data.schedule || []);
        this.notes = data.notes;
        this.statusUpdatedAt = data.statusUpdatedAt ? new Date(data.statusUpdatedAt) : new Date();
        this.departmentQuiz = data.departmentQuiz;
        this.departmentAssignment = data.departmentAssignment;
        this.isDeleted = !!data.isDeleted;
        this.isReportingEnabled = !!data.isReportingEnabled;

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

        const parseIdArray = (val) => {
            if (Array.isArray(val)) return val;
            if (typeof val === 'string' && val.trim() !== '') {
                try {
                    const parsed = JSON.parse(val);
                    return Array.isArray(parsed) ? parsed : [parsed];
                } catch (e) {
                    return [];
                }
            }
            if (val === null || val === undefined || val === '') return [];
            return [val];
        };
        this.dojoMandatoryQuizId = parseIdArray(data.dojoMandatoryQuizId);
        this.dojoHandoverQuizId = parseIdArray(data.dojoHandoverQuizId);
        this.dojoInterviewQuizId = parseIdArray(data.dojoInterviewQuizId);
        this.dojoEligibilityEvaluationId = parseIdArray(data.dojoEligibilityEvaluationId);
        this.dojoInterviewEvaluationId = parseIdArray(data.dojoInterviewEvaluationId);
        this.isDojoSpecificDept = !!data.isDojoSpecificDept;

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='departments' and xtype='U')
            BEGIN
            CREATE TABLE departments (
                id INT IDENTITY(1,1) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                uniCode VARCHAR(255) UNIQUE,
                slug VARCHAR(255) UNIQUE,
                course VARCHAR(255),
                courses NVARCHAR(MAX),
                instructor NVARCHAR(MAX),
                students NVARCHAR(MAX),
                startDate DATETIME,
                endDate DATETIME,
                capacity INT DEFAULT 50,
                status VARCHAR(50) DEFAULT 'UPCOMING',
                schedule NVARCHAR(MAX),
                notes NVARCHAR(MAX),
                statusUpdatedAt DATETIME,
                departmentQuiz VARCHAR(255),
                departmentAssignment VARCHAR(255),
                isDeleted BIT DEFAULT 0,
                isReportingEnabled BIT DEFAULT 0,
                createdAt DATETIME,
                updatedAt DATETIME DEFAULT GETDATE()
            );
            CREATE INDEX idx_status ON departments(status);
            CREATE INDEX idx_statusUpdatedAt ON departments(statusUpdatedAt);
            END
            ELSE
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'isReportingEnabled')
                BEGIN
                    ALTER TABLE departments ADD isReportingEnabled BIT DEFAULT 0;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'daily5mApproverDeptId')
                BEGIN
                    ALTER TABLE departments ADD daily5mApproverDeptId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'daily5mApproverSectionId')
                BEGIN
                    ALTER TABLE departments ADD daily5mApproverSectionId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'daily5mApproverLineId')
                BEGIN
                    ALTER TABLE departments ADD daily5mApproverLineId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'skillMatrixApproverQaDeptId')
                BEGIN
                    ALTER TABLE departments ADD skillMatrixApproverQaDeptId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'skillMatrixApproverQaSectionId')
                BEGIN
                    ALTER TABLE departments ADD skillMatrixApproverQaSectionId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'skillMatrixApproverQaLineId')
                BEGIN
                    ALTER TABLE departments ADD skillMatrixApproverQaLineId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'skillMatrixApproverSafetyDeptId')
                BEGIN
                    ALTER TABLE departments ADD skillMatrixApproverSafetyDeptId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'skillMatrixApproverSafetySectionId')
                BEGIN
                    ALTER TABLE departments ADD skillMatrixApproverSafetySectionId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'skillMatrixApproverSafetyLineId')
                BEGIN
                    ALTER TABLE departments ADD skillMatrixApproverSafetyLineId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'skillMatrixApproverProcessDeptId')
                BEGIN
                    ALTER TABLE departments ADD skillMatrixApproverProcessDeptId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'skillMatrixApproverProcessSectionId')
                BEGIN
                    ALTER TABLE departments ADD skillMatrixApproverProcessSectionId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'skillMatrixApproverProcessLineId')
                BEGIN
                    ALTER TABLE departments ADD skillMatrixApproverProcessLineId INT NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'dojoMandatoryQuizId')
                BEGIN
                    ALTER TABLE departments ADD dojoMandatoryQuizId NVARCHAR(MAX) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'dojoHandoverQuizId')
                BEGIN
                    ALTER TABLE departments ADD dojoHandoverQuizId NVARCHAR(MAX) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'dojoInterviewQuizId')
                BEGIN
                    ALTER TABLE departments ADD dojoInterviewQuizId NVARCHAR(MAX) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'dojoEligibilityEvaluationId')
                BEGIN
                    ALTER TABLE departments ADD dojoEligibilityEvaluationId NVARCHAR(MAX) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'dojoInterviewEvaluationId')
                BEGIN
                    ALTER TABLE departments ADD dojoInterviewEvaluationId NVARCHAR(MAX) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('departments') AND name = 'isDojoSpecificDept')
                BEGIN
                    ALTER TABLE departments ADD isDojoSpecificDept BIT DEFAULT 0;
                END
            END
        `;
        try {
            await executeQuery(query);
            logger.info("Checked/Created departments table in MSSQL");

            const { migrationHelper } = await import("../db/migrationHelper.js");

            // idx_instructor on a VARCHAR column blocks ALTER to NVARCHAR(MAX) — drop it first
            await executeQuery(`
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_instructor' AND object_id = OBJECT_ID('departments'))
                    DROP INDEX idx_instructor ON departments
            `);

            await migrationHelper.ensureColumnType("departments", "instructor", "NVARCHAR(MAX)");

            // Dojo hiring config fields moved from single INT to NVARCHAR(MAX) JSON arrays (multi-select
            // support). Drop the indexes created for the old INT columns first — an index on the column
            // blocks the ALTER, and NVARCHAR(MAX) can't carry a plain B-tree index anyway.
            await executeQuery(`
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dojoHandoverQuizId' AND object_id = OBJECT_ID('departments'))
                    DROP INDEX idx_dojoHandoverQuizId ON departments
            `);
            await executeQuery(`
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_dojoEligibilityEvaluationId' AND object_id = OBJECT_ID('departments'))
                    DROP INDEX idx_dojoEligibilityEvaluationId ON departments
            `);
            await migrationHelper.ensureColumnType("departments", "dojoMandatoryQuizId", "NVARCHAR(MAX)");
            await migrationHelper.ensureColumnType("departments", "dojoHandoverQuizId", "NVARCHAR(MAX)");
            await migrationHelper.ensureColumnType("departments", "dojoInterviewQuizId", "NVARCHAR(MAX)");
            await migrationHelper.ensureColumnType("departments", "dojoEligibilityEvaluationId", "NVARCHAR(MAX)");
            await migrationHelper.ensureColumnType("departments", "dojoInterviewEvaluationId", "NVARCHAR(MAX)");
        } catch (error) {
            logger.error("Failed to initialize Department table", error);
        }
    }

    calculateStatus() {
        if (this.status === 'CANCELLED') {
            return 'CANCELLED';
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (this.startDate) {
            const startDate = new Date(this.startDate);
            startDate.setHours(0, 0, 0, 0);

            if (startDate > today) {
                return 'UPCOMING';
            }

            if (this.endDate) {
                const endDate = new Date(this.endDate);
                endDate.setHours(0, 0, 0, 0);

                if (endDate <= today) {
                    return 'COMPLETED';
                }

                if (startDate <= today && endDate > today) {
                    return 'ONGOING';
                }
            } else {
                if (startDate <= today) {
                    return 'ONGOING';
                }
            }
        }

        return 'UPCOMING';
    }

    static async create(data) {
        // Generate unique slug
        let baseSlug = slugify(data.name);
        let slug = baseSlug;
        let suffix = 1;
        while (true) {
            const [rows] = await executeQuery("SELECT id FROM departments WHERE slug = ?", [slug]);
            if (rows.length === 0) break;
            suffix++;
            slug = `${baseSlug}-${suffix}`;
        }
        data.slug = slug;

        // Auto-calculate status on create
        const tempDept = new Department(data);
        if (tempDept.status !== 'CANCELLED') {
            data.status = tempDept.calculateStatus();
        }

        const fields = [
            "name", "uniCode", "slug", "course", "courses", "instructor",
            "students", "startDate", "endDate", "capacity", "status",
            "schedule", "notes", "statusUpdatedAt", "departmentQuiz",
            "departmentAssignment", "isDeleted", "isReportingEnabled",
            "daily5mApproverDeptId", "daily5mApproverSectionId", "daily5mApproverLineId",
            "skillMatrixApproverQaDeptId", "skillMatrixApproverQaSectionId", "skillMatrixApproverQaLineId",
            "skillMatrixApproverSafetyDeptId", "skillMatrixApproverSafetySectionId", "skillMatrixApproverSafetyLineId",
            "skillMatrixApproverProcessDeptId", "skillMatrixApproverProcessSectionId", "skillMatrixApproverProcessLineId",
            "dojoMandatoryQuizId", "dojoHandoverQuizId", "dojoInterviewQuizId",
            "dojoEligibilityEvaluationId", "dojoInterviewEvaluationId", "isDojoSpecificDept",
            "createdAt"
        ];



        if (!data.statusUpdatedAt) data.statusUpdatedAt = new Date();
        if (!data.createdAt) data.createdAt = new Date();

        const values = fields.map(field => {
            let val = data[field];
            if (['courses', 'students', 'schedule', 'dojoMandatoryQuizId', 'dojoHandoverQuizId', 'dojoInterviewQuizId', 'dojoEligibilityEvaluationId', 'dojoInterviewEvaluationId'].includes(field)) {
                return JSON.stringify(val || []);
            }
            if (val === undefined) return null;
            return val;
        });

        const placeholders = fields.map(() => "?").join(",");
        const query = `INSERT INTO departments (${fields.join(",")}) OUTPUT INSERTED.id VALUES (${placeholders})`;

        const [result] = await executeQuery(query, values);
        return Department.findById(result[0].id);
    }

    static async findById(id) {
        if (!id || isNaN(id)) return null;
        const [rows] = await executeQuery("SELECT * FROM departments WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new Department(rows[0]);
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        // Defensive check: If searching by numeric ID, ensure it's actually numeric
        if (query.id && isNaN(query.id)) return null;

        const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
        const values = keys.map(key => {
            const val = query[key];
            // Ensure instructor ID is passed as string to avoid SQL Server converting column to INT
            if (key === 'instructor' && !isNaN(val)) return String(val);
            return val;
        });

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM departments WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new Department(rows[0]);
    }

    static async find(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined && key !== '$or' && key !== 'status' && key !== 'statusUpdatedAt' && key !== 'isDeleted');

        let sql = "SELECT * FROM departments";
        let values = [];
        let conditions = [];

        // Handle standard equality checks
        if (keys.length > 0) {
            conditions.push(...keys.map(key => `${key} = ?`));
            values.push(...keys.map(key => {
                const val = query[key];
                // Ensure instructor ID is passed as string to avoid SQL Server converting column to INT
                if (key === 'instructor' && !isNaN(val)) return String(val);
                return val;
            }));
        }

        // Handle specialized Mongoose-like query mappings manually for now
        if (query.status && typeof query.status === 'object') {
            if (query.status.$ne) {
                conditions.push("status != ?");
                values.push(query.status.$ne);
            }
            if (query.status.$in) {
                conditions.push(`status IN (${query.status.$in.map(() => '?').join(',')})`);
                values.push(...query.status.$in);
            }
        } else if (query.status) {
            conditions.push("status = ?");
            values.push(query.status);
        }

        if (query.isDeleted && typeof query.isDeleted === 'object' && query.isDeleted.$ne) {
            conditions.push("isDeleted != ?");
            values.push(query.isDeleted.$ne);
        } else if (query.isDeleted !== undefined) {
            conditions.push("isDeleted = ?");
            values.push(query.isDeleted);
        }

        if (query.statusUpdatedAt && query.statusUpdatedAt.$lt) {
            conditions.push("statusUpdatedAt < ?");
            values.push(query.statusUpdatedAt.$lt);
        }

        if (query.$or) {
            // Specific handling for startDate exists OR endDate exists logic in updateAllStatuses
            // SQL equivalence: startDate IS NOT NULL OR endDate IS NOT NULL
            const orConditions = query.$or.map(cond => {
                if (cond.startDate && cond.startDate.$exists) return "startDate IS NOT NULL";
                if (cond.endDate && cond.endDate.$exists) return "endDate IS NOT NULL";
                return "1=0";
            });
            if (orConditions.length > 0) {
                conditions.push(`(${orConditions.join(" OR ")})`);
            }
        }

        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(" AND ")}`;
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new Department(row));
    }

    static async countDocuments(query = {}) {
        // Simplified count implementation
        const result = await this.find(query);
        return result.length;
    }

    async save() {
        // Determine status before saving
        const newStatus = this.calculateStatus();
        if (this.status !== newStatus && this.status !== 'CANCELLED') {
            this.status = newStatus;
            if (newStatus === 'COMPLETED') {
                this.statusUpdatedAt = new Date();
            }
        }
        if (this.status === 'COMPLETED' || this.status === 'CANCELLED') {
            // We'd ideally check if status *changed* to these values, but logic assumes if it *is* this, update timestamp
            // For strict parity with Mongoose "isModified", we'd need old state.
            // Assuming this save is called with intent to persistence changes.
            this.statusUpdatedAt = new Date();
        }

        const fields = [
            "name", "uniCode", "slug", "course", "courses", "instructor",
            "students", "startDate", "endDate", "capacity", "status",
            "schedule", "notes", "statusUpdatedAt", "departmentQuiz",
            "departmentAssignment", "isDeleted", "isReportingEnabled",
            "daily5mApproverDeptId", "daily5mApproverSectionId", "daily5mApproverLineId",
            "skillMatrixApproverQaDeptId", "skillMatrixApproverQaSectionId", "skillMatrixApproverQaLineId",
            "skillMatrixApproverSafetyDeptId", "skillMatrixApproverSafetySectionId", "skillMatrixApproverSafetyLineId",
            "skillMatrixApproverProcessDeptId", "skillMatrixApproverProcessSectionId", "skillMatrixApproverProcessLineId",
            "dojoMandatoryQuizId", "dojoHandoverQuizId", "dojoInterviewQuizId",
            "dojoEligibilityEvaluationId", "dojoInterviewEvaluationId", "isDojoSpecificDept"
        ];

        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => {
            let val = this[field];
            if (['courses', 'students', 'schedule', 'dojoMandatoryQuizId', 'dojoHandoverQuizId', 'dojoInterviewQuizId', 'dojoEligibilityEvaluationId', 'dojoInterviewEvaluationId'].includes(field)) {
                return JSON.stringify(val || []);
            }
            return val;
        });
        values.push(this.id);

        await executeQuery(`UPDATE departments SET ${setClause} WHERE id = ?`, values);
        return this;
    }

    async updateStatus() {
        const newStatus = this.calculateStatus();
        if (this.status !== newStatus && this.status !== 'CANCELLED') {
            this.status = newStatus;
            await this.save();
        }
        return this.status;
    }

    static async updateAllStatuses() {
        const departments = await this.find({
            status: { $ne: 'CANCELLED' },
            $or: [
                { startDate: { $exists: true } },
                { endDate: { $exists: true } }
            ]
        });

        let updatedCount = 0;
        const results = [];

        for (const department of departments) {
            const oldStatus = department.status;
            const newStatus = department.calculateStatus();

            if (oldStatus !== newStatus) {
                department.status = newStatus;
                await department.save();
                updatedCount++;

                results.push({
                    departmentId: department.id,
                    name: department.name,
                    oldStatus,
                    newStatus,
                    startDate: department.startDate,
                    endDate: department.endDate
                });
            }
        }

        return {
            totalProcessed: departments.length,
            updatedCount,
            results
        };
    }

    // Stub for cleanup - requires other models to be fully migrated to SQL
    static async cleanupOldDepartments() {
        return { message: "Cleanup not fully implemented in SQL migration yet due to cross-model dependencies." };
    }
}

// Initialize table
Department.init();

export default Department;
