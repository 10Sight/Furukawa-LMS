import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class Submission {
    constructor(data) {
        this.id = data.id;
        this._id = data.id; // Compatibility

        this.assignment = data.assignment;
        this.student = data.student;
        this.fileUrl = data.fileUrl;
        this.attachments = typeof data.attachments === 'string' ? JSON.parse(data.attachments) : (data.attachments || []);
        this.grade = data.grade !== undefined ? data.grade : null;
        this.feedback = data.feedback;
        this.submittedAt = data.submittedAt ? new Date(data.submittedAt) : new Date();
        this.isLate = data.isLate !== undefined ? !!data.isLate : false;
        this.resubmissionCount = data.resubmissionCount !== undefined ? data.resubmissionCount : 0;
        this.status = data.status || 'SUBMITTED';
        this.gradedAt = data.gradedAt ? new Date(data.gradedAt) : null;
        this.gradedBy = data.gradedBy || null;

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'submissions')
            BEGIN
                CREATE TABLE submissions (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    assignment INT NOT NULL,
                    student INT NOT NULL,
                    fileUrl NVARCHAR(MAX),
                    attachments NVARCHAR(MAX),
                    grade DECIMAL(5, 2) DEFAULT NULL,
                    feedback NVARCHAR(MAX),
                    submittedAt DATETIME DEFAULT GETDATE(),
                    isLate BIT DEFAULT 0,
                    resubmissionCount INT DEFAULT 0,
                    status NVARCHAR(50) DEFAULT 'SUBMITTED',
                    gradedAt DATETIME,
                    gradedBy INT,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT unique_submission UNIQUE (assignment, student)
                );
                CREATE INDEX idx_assignment_submission ON submissions(assignment);
                CREATE INDEX idx_student_submission ON submissions(student);
            END
        `;
        try {
            await executeQuery(query);
        } catch (error) {
            logger.error("Failed to initialize Submission table", error);
        }
    }

    static async create(data) {
        const submission = new Submission(data);

        const fields = [
            "assignment", "student", "fileUrl", "attachments",
            "grade", "feedback", "submittedAt", "isLate",
            "resubmissionCount", "status", "gradedAt", "gradedBy", "createdAt"
        ];

        if (!submission.createdAt) submission.createdAt = new Date();

        const values = fields.map(field => {
            let val = submission[field];
            if (field === 'attachments') return JSON.stringify(val);
            if (val === undefined) return null;
            return val;
        });

        const placeholders = fields.map(() => "?").join(",");
        const query = `INSERT INTO submissions (${fields.join(",")}) 
        OUTPUT INSERTED.id
        VALUES (${placeholders})`;

        const [result] = await executeQuery(query, values);
        return Submission.findById(result[0].id);
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM submissions WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new Submission(rows[0]);
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
        const values = keys.map(key => query[key]);

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM submissions WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new Submission(rows[0]);
    }

    static async find(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT * FROM submissions";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new Submission(row));
    }

    static async countDocuments(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT COUNT(*) as count FROM submissions";
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
            "assignment", "student", "fileUrl", "attachments",
            "grade", "feedback", "submittedAt", "isLate",
            "resubmissionCount", "status", "gradedAt", "gradedBy"
        ];

        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => {
            let val = this[field];
            if (field === 'attachments') return JSON.stringify(val);
            return val;
        });
        values.push(this.id);

        await executeQuery(`UPDATE submissions SET ${setClause}, updatedAt = GETDATE() WHERE id = ?`, values);
        return this;
    }
}

// Initialize table
Submission.init();

export default Submission;