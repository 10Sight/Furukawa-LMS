import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";
import { migrationHelper } from "../db/migrationHelper.js";

class QuizAttempt {
    constructor(data) {
        this.id = data.id;
        this._id = data.id; // Compatibility

        this.quiz = data.quiz;
        this.student = data.student;

        // Deserialize answer JSON if it's a string
        this.answer = typeof data.answer === 'string' ? JSON.parse(data.answer) : (data.answer || []);

        this.score = data.score !== undefined ? data.score : 0;
        this.status = data.status || "IN_PROGRESS";
        this.startedAt = data.startedAt ? new Date(data.startedAt) : new Date();
        this.completedAt = data.completedAt ? new Date(data.completedAt) : null;
        this.attemptNumber = data.attemptNumber !== undefined ? data.attemptNumber : 1;
        this.timeTaken = data.timeTaken !== undefined ? data.timeTaken : 0;
        this.conductedBy = data.conductedBy !== undefined && data.conductedBy !== null ? data.conductedBy : "";

        // Snapshot of student identity at attempt time (survives user deletion/re-import)
        this.studentName = data.studentName || null;
        this.studentEmpId = data.studentEmpId || null;

        // Snapshot of student status/hierarchy at attempt time (survives promotion or deletion)
        this.studentIsTemporary = data.studentIsTemporary ? 1 : 0;
        this.studentDeptId = data.studentDeptId !== undefined ? data.studentDeptId : null;
        this.studentSectionId = data.studentSectionId !== undefined ? data.studentSectionId : null;
        this.studentLineId = data.studentLineId !== undefined ? data.studentLineId : null;
        this.studentSubSectionId = data.studentSubSectionId !== undefined ? data.studentSubSectionId : null;

        // Admin adjustment metadata
        this.manuallyAdjusted = !!data.manuallyAdjusted;
        this.adjustedBy = data.adjustedBy;
        this.adjustedAt = data.adjustedAt ? new Date(data.adjustedAt) : null;
        this.adjustmentNotes = data.adjustmentNotes;

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='attempted_quizzes' and xtype='U')
            BEGIN
            CREATE TABLE attempted_quizzes (
                id INT IDENTITY(1,1) PRIMARY KEY,
                quiz NVARCHAR(255) NOT NULL,
                student NVARCHAR(255) NOT NULL,
                answer NVARCHAR(MAX),
                score INT DEFAULT 0,
                status NVARCHAR(50) DEFAULT 'IN_PROGRESS',
                startedAt DATETIME,
                completedAt DATETIME,
                attemptNumber INT DEFAULT 1,
                timeTaken INT DEFAULT 0,
                manuallyAdjusted BIT DEFAULT 0,
                adjustedBy NVARCHAR(255),
                adjustedAt DATETIME,
                adjustmentNotes NVARCHAR(MAX),
                conductedBy NVARCHAR(255) DEFAULT '',
                createdAt DATETIME DEFAULT GETDATE(),
                updatedAt DATETIME DEFAULT GETDATE()
            );
            CREATE UNIQUE INDEX idx_unique_attempt ON attempted_quizzes(quiz, student, attemptNumber);
            END
        `;
        try {
            await executeQuery(query);
            // Automated migration to add conductedBy column if the table already exists but lacks it
            const checkColQuery = `
                IF NOT EXISTS (
                    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'attempted_quizzes' AND COLUMN_NAME = 'conductedBy'
                )
                BEGIN
                    ALTER TABLE [attempted_quizzes] ADD [conductedBy] NVARCHAR(255) DEFAULT ''
                END
            `;
            await executeQuery(checkColQuery);

            // Migration: add studentName and studentEmpId snapshot columns
            await executeQuery(`
                IF NOT EXISTS (
                    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = 'attempted_quizzes' AND COLUMN_NAME = 'studentName'
                )
                BEGIN
                    ALTER TABLE [attempted_quizzes] ADD [studentName] NVARCHAR(255) NULL;
                    ALTER TABLE [attempted_quizzes] ADD [studentEmpId] NVARCHAR(255) NULL;
                END
            `);

            // Migration: add studentIsTemporary/studentDeptId/studentSectionId/studentLineId/studentSubSectionId
            // snapshot columns so monitoring views survive user promotion or permanent deletion
            await executeQuery(`
                IF NOT EXISTS (
                    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = 'attempted_quizzes' AND COLUMN_NAME = 'studentIsTemporary'
                )
                BEGIN
                    ALTER TABLE [attempted_quizzes] ADD [studentIsTemporary] BIT DEFAULT 0;
                    ALTER TABLE [attempted_quizzes] ADD [studentDeptId] INT NULL;
                    ALTER TABLE [attempted_quizzes] ADD [studentSectionId] INT NULL;
                    ALTER TABLE [attempted_quizzes] ADD [studentLineId] INT NULL;
                    ALTER TABLE [attempted_quizzes] ADD [studentSubSectionId] INT NULL;
                END
            `);

            // The only index on this table is the (quiz, student, attemptNumber) unique constraint,
            // so any query filtering by student alone (handover-sheet eligibility lookups, dojo
            // pass checks) or by completedAt alone falls back to a full table scan no matter how
            // the WHERE clause is written. This index is what actually turns those into seeks;
            // the accompanying query rewrites (removing CAST()-wrapped predicates) only matter
            // once a matching index exists to seek on.
            await migrationHelper.ensureIndexExists(
                'attempted_quizzes',
                'idx_attempted_quizzes_student',
                'CREATE INDEX idx_attempted_quizzes_student ON attempted_quizzes(student) INCLUDE (quiz, status, completedAt, score)',
                { longRunning: true }
            );

            // One-time backfill for rows created before the hierarchy snapshot columns existed.
            // Only touches rows still missing a snapshot, so it's a cheap no-op on subsequent boots.
            // Split into two sargable passes (student-as-id, then studentEmpId) instead of a single
            // OR-joined UPDATE, so each can use an index seek instead of a full table scan.
            const backfillSetClause = `
                    studentIsTemporary = COALESCE(u.isTemporary, 0),
                    studentDeptId = COALESCE(u.departmentId, CASE WHEN u.isTemporary = 1 THEN u.targetDeptId ELSE NULL END),
                    studentSectionId = COALESCE(u.sectionId, CASE WHEN u.isTemporary = 1 THEN u.targetSectionId ELSE NULL END),
                    studentLineId = COALESCE(u.lineId, CASE WHEN u.isTemporary = 1 THEN u.targetLineId ELSE NULL END),
                    studentSubSectionId = COALESCE(u.subSectionId, CASE WHEN u.isTemporary = 1 THEN u.targetSubSectionId ELSE NULL END)
            `;
            const backfillWhereClause = `
                WHERE aq.studentDeptId IS NULL AND aq.studentSectionId IS NULL
                  AND aq.studentLineId IS NULL AND aq.studentSubSectionId IS NULL
            `;

            await executeQuery(`
                UPDATE aq SET ${backfillSetClause}
                FROM attempted_quizzes aq
                JOIN users u ON u.id = TRY_CAST(aq.student AS INT)
                ${backfillWhereClause}
            `);

            await executeQuery(`
                UPDATE aq SET ${backfillSetClause}
                FROM attempted_quizzes aq
                JOIN users u ON u.empId = aq.studentEmpId
                ${backfillWhereClause}
                  AND aq.studentEmpId IS NOT NULL
            `);
        } catch (error) {
            logger.error("Failed to initialize QuizAttempt table", error);
        }
    }

    static async create(data) {
        const attempt = new QuizAttempt(data);

        const fields = [
            "quiz", "student", "answer", "score", "status",
            "startedAt", "completedAt", "attemptNumber", "timeTaken",
            "manuallyAdjusted", "adjustedBy", "adjustedAt", "adjustmentNotes", "conductedBy",
            "studentName", "studentEmpId",
            "studentIsTemporary", "studentDeptId", "studentSectionId", "studentLineId", "studentSubSectionId",
            "createdAt"
        ];

        if (!attempt.createdAt) attempt.createdAt = new Date();

        const values = fields.map(field => {
            let val = attempt[field];
            if (field === 'answer') return JSON.stringify(val);
            if (field === 'quiz' && val && typeof val === 'object') {
                return val.id || val._id || val;
            }
            if (field === 'student' && val && typeof val === 'object') {
                return val.id || val._id || val;
            }
            if (field === 'adjustedBy' && val && typeof val === 'object') {
                return val.id || val._id || val;
            }
            if (val === undefined) return null;
            return val;
        });

        const placeholders = fields.map(() => "?").join(",");
        const query = `INSERT INTO attempted_quizzes (${fields.join(",")}) OUTPUT INSERTED.id VALUES (${placeholders})`;

        const [result] = await executeQuery(query, values);
        return QuizAttempt.findById(result[0].id);
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM attempted_quizzes WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new QuizAttempt(rows[0]);
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
        const values = keys.map(key => query[key]);

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM attempted_quizzes WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new QuizAttempt(rows[0]);
    }

    static async find(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT * FROM attempted_quizzes";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new QuizAttempt(row));
    }

    static async countDocuments(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT COUNT(*) as count FROM attempted_quizzes";
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
            "quiz", "student", "answer", "score", "status",
            "startedAt", "completedAt", "attemptNumber", "timeTaken",
            "manuallyAdjusted", "adjustedBy", "adjustedAt", "adjustmentNotes", "conductedBy"
        ];

        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => {
            let val = this[field];
            if (field === 'answer') return JSON.stringify(val);
            if (field === 'quiz' && val && typeof val === 'object') {
                return val.id || val._id || val;
            }
            if (field === 'student' && val && typeof val === 'object') {
                return val.id || val._id || val;
            }
            if (field === 'adjustedBy' && val && typeof val === 'object') {
                return val.id || val._id || val;
            }
            if (val === undefined) return null;
            return val;
        });
        values.push(this.id);

        await executeQuery(`UPDATE attempted_quizzes SET ${setClause} WHERE id = ?`, values);
        return this;
    }
}

// Initialize table
QuizAttempt.init();

export default QuizAttempt;