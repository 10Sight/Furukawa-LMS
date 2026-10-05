import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class Certificate {
    constructor(data) {
        this.id = data.id;
        this._id = data.id; // Compatibility

        this.student = data.student;
        this.course = data.course;
        this.issuedBy = data.issuedBy;
        this.grade = data.grade || 'PASS';
        this.issueDate = data.issueDate ? new Date(data.issueDate) : new Date();
        this.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
        this.fileUrl = data.fileUrl;
        this.status = data.status || 'ACTIVE';
        this.type = data.type || 'COURSE_COMPLETION';
        this.level = data.level;
        this.metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : (data.metadata || {});

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        try {
            if (!await migrationHelper.tableExists('certificates')) {
                await executeQuery(`
                    CREATE TABLE certificates (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        student NVARCHAR(255) NOT NULL,
                        course NVARCHAR(255) NOT NULL,
                        issuedBy NVARCHAR(255) NOT NULL,
                        grade NVARCHAR(10) DEFAULT 'PASS',
                        issueDate DATETIME,
                        expiryDate DATETIME,
                        fileUrl NVARCHAR(MAX),
                        status NVARCHAR(20) DEFAULT 'ACTIVE',
                        type NVARCHAR(50) DEFAULT 'COURSE_COMPLETION',
                        level NVARCHAR(50),
                        metadata NVARCHAR(MAX),
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE()
                    )
                `);
                await migrationHelper.ensureIndexExists('certificates', 'idx_student',
                    'CREATE INDEX idx_student ON certificates(student)');
                await migrationHelper.ensureIndexExists('certificates', 'idx_course',
                    'CREATE INDEX idx_course ON certificates(course)');
            }
            console.log("Certificates table verified/created in MSSQL.");
        } catch (error) {
            logger.error("Failed to initialize Certificate table", error);
        }
    }

    static async create(data) {
        const cert = new Certificate(data);

        const fields = [
            "student", "course", "issuedBy", "grade", "issueDate",
            "expiryDate", "fileUrl", "status", "type", "level", "metadata", "createdAt"
        ];

        if (!cert.createdAt) cert.createdAt = new Date();

        const values = fields.map(field => {
            let val = cert[field];
            if (field === 'metadata') return JSON.stringify(val);
            if (val === undefined) return null;
            return val;
        });

        const placeholders = fields.map(() => "?").join(",");
        const query = `INSERT INTO certificates (${fields.join(",")}) OUTPUT INSERTED.id VALUES (${placeholders})`;

        const [result] = await executeQuery(query, values);
        return Certificate.findById(result[0]?.id);
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM certificates WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new Certificate(rows[0]);
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
        const values = keys.map(key => query[key]);

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM certificates WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new Certificate(rows[0]);
    }

    static async find(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT * FROM certificates";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new Certificate(row));
    }

    static async countDocuments(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT COUNT(*) as count FROM certificates";
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
            "student", "course", "issuedBy", "grade", "issueDate",
            "expiryDate", "fileUrl", "status", "type", "level", "metadata"
        ];

        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => {
            let val = this[field];
            if (field === 'metadata') return JSON.stringify(val);
            return val;
        });
        values.push(this.id);

        await executeQuery(`UPDATE certificates SET ${setClause} WHERE id = ?`, values);
        return this;
    }
}

// Initialize table
Certificate.init().catch(err => console.error("Failed to initialize certificates table:", err));

export default Certificate;