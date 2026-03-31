import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class ExtraAttemptAllowance {
  constructor(data) {
    this.id = data.id;
    this._id = data.id; // Compatibility

    this.quiz = data.quiz;
    this.student = data.student;
    this.extraAttemptsGranted = data.extraAttemptsGranted !== undefined ? data.extraAttemptsGranted : 1;
    this.grantedBy = data.grantedBy;
    this.approvedAt = data.approvedAt ? new Date(data.approvedAt) : null;

    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static async init() {
    const query = `
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='extra_attempt_allowances' and xtype='U')
        BEGIN
        CREATE TABLE extra_attempt_allowances (
            id INT IDENTITY(1,1) PRIMARY KEY,
            quiz NVARCHAR(255) NOT NULL,
            student NVARCHAR(255) NOT NULL,
            extraAttemptsGranted INT DEFAULT 1,
            grantedBy NVARCHAR(255),
            approvedAt DATETIME,
            createdAt DATETIME DEFAULT GETDATE(),
            updatedAt DATETIME DEFAULT GETDATE()
        );
        CREATE INDEX idx_extra_quiz_student ON extra_attempt_allowances(quiz, student);
        END
    `;
    try {
      await executeQuery(query);
    } catch (error) {
      logger.error("Failed to initialize ExtraAttemptAllowance table", error);
    }
  }

  static async create(data) {
    const attempt = new ExtraAttemptAllowance(data);

    const fields = [
      "quiz", "student", "extraAttemptsGranted",
      "grantedBy", "approvedAt", "createdAt"
    ];

    if (!attempt.createdAt) attempt.createdAt = new Date();

    const values = fields.map(field => {
      const val = attempt[field];
      if (val === undefined) return null;
      return val;
    });

    const placeholders = fields.map(() => "?").join(",");
    const query = `INSERT INTO extra_attempt_allowances (${fields.join(",")}) OUTPUT INSERTED.id VALUES (${placeholders})`;

    const [result] = await executeQuery(query, values);
    return ExtraAttemptAllowance.findById(result[0].id);
  }

  static async findById(id) {
    const [rows] = await executeQuery("SELECT * FROM extra_attempt_allowances WHERE id = ?", [id]);
    if (rows.length === 0) return null;
    return new ExtraAttemptAllowance(rows[0]);
  }

  static async findOne(query) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    if (keys.length === 0) return null;

    const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
    const values = keys.map(key => query[key]);

    const [rows] = await executeQuery(`SELECT TOP 1 * FROM extra_attempt_allowances WHERE ${whereClause}`, values);
    if (rows.length === 0) return null;
    return new ExtraAttemptAllowance(rows[0]);
  }

  static async find(query = {}) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    let sql = "SELECT * FROM extra_attempt_allowances";
    let values = [];

    if (keys.length > 0) {
      const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
      sql += ` WHERE ${whereClause}`;
      values = keys.map(key => query[key]);
    }

    const [rows] = await executeQuery(sql, values);
    return rows.map(row => new ExtraAttemptAllowance(row));
  }

  static async countDocuments(query = {}) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    let sql = "SELECT COUNT(*) as count FROM extra_attempt_allowances";
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
      "quiz", "student", "extraAttemptsGranted",
      "grantedBy", "approvedAt"
    ];

    const setClause = fields.map(field => `${field} = ?`).join(", ");
    const values = fields.map(field => this[field]);
    values.push(this.id);

    await executeQuery(`UPDATE extra_attempt_allowances SET ${setClause} WHERE id = ?`, values);
    return this;
  }
}

// Initialize table
ExtraAttemptAllowance.init();

export default ExtraAttemptAllowance;
