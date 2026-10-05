import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class AttemptExtensionRequest {
  constructor(data) {
    this.id = data.id;
    this._id = data.id; // Compatibility

    this.quiz = data.quiz;
    this.student = data.student;
    this.reason = data.reason;
    this.status = data.status || 'PENDING';
    this.reviewedBy = data.reviewedBy;
    this.reviewedAt = data.reviewedAt ? new Date(data.reviewedAt) : null;
    this.extraAttemptsGranted = data.extraAttemptsGranted !== undefined ? data.extraAttemptsGranted : 1;

    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static async init() {
    try {
      if (!await migrationHelper.tableExists('attempt_extension_requests')) {
        await executeQuery(`
        CREATE TABLE attempt_extension_requests (
            id INT IDENTITY(1,1) PRIMARY KEY,
            quiz NVARCHAR(255) NOT NULL,
            student NVARCHAR(255) NOT NULL,
            reason NVARCHAR(MAX),
            status NVARCHAR(50) DEFAULT 'PENDING',
            reviewedBy NVARCHAR(255),
            reviewedAt DATETIME,
            extraAttemptsGranted INT DEFAULT 1,
            createdAt DATETIME DEFAULT GETDATE(),
            updatedAt DATETIME DEFAULT GETDATE()
        )
    `);
        await migrationHelper.ensureIndexExists('attempt_extension_requests', 'idx_quiz_student_status',
          'CREATE INDEX idx_quiz_student_status ON attempt_extension_requests(quiz, student, status)');
      }
    } catch (error) {
      logger.error("Failed to initialize AttemptExtensionRequest table", error);
    }
  }

  static async create(data) {
    const request = new AttemptExtensionRequest(data);

    const fields = [
      "quiz", "student", "reason", "status",
      "reviewedBy", "reviewedAt", "extraAttemptsGranted", "createdAt"
    ];

    if (!request.createdAt) request.createdAt = new Date();

    const values = fields.map(field => {
      const val = request[field];
      if (val === undefined) return null;
      return val;
    });

    const placeholders = fields.map(() => "?").join(",");
    const query = `INSERT INTO attempt_extension_requests (${fields.join(",")}) OUTPUT INSERTED.id VALUES (${placeholders})`;

    const [result] = await executeQuery(query, values);
    return AttemptExtensionRequest.findById(result[0].id);
  }

  static async findById(id) {
    const [rows] = await executeQuery("SELECT * FROM attempt_extension_requests WHERE id = ?", [id]);
    if (rows.length === 0) return null;
    return new AttemptExtensionRequest(rows[0]);
  }

  static async findOne(query) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    if (keys.length === 0) return null;

    const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
    const values = keys.map(key => query[key]);

    const [rows] = await executeQuery(`SELECT TOP 1 * FROM attempt_extension_requests WHERE ${whereClause}`, values);
    if (rows.length === 0) return null;
    return new AttemptExtensionRequest(rows[0]);
  }

  static async find(query = {}) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    let sql = "SELECT * FROM attempt_extension_requests";
    let values = [];

    if (keys.length > 0) {
      const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
      sql += ` WHERE ${whereClause}`;
      values = keys.map(key => query[key]);
    }

    const [rows] = await executeQuery(sql, values);
    return rows.map(row => new AttemptExtensionRequest(row));
  }

  static async countDocuments(query = {}) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    let sql = "SELECT COUNT(*) as count FROM attempt_extension_requests";
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
      "quiz", "student", "reason", "status",
      "reviewedBy", "reviewedAt", "extraAttemptsGranted"
    ];

    const setClause = fields.map(field => `${field} = ?`).join(", ");
    const values = fields.map(field => this[field]);
    values.push(this.id);

    await executeQuery(`UPDATE attempt_extension_requests SET ${setClause} WHERE id = ?`, values);
    return this;
  }
}

// Initialize table
AttemptExtensionRequest.init();

export default AttemptExtensionRequest;
