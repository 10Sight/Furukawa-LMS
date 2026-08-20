import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class Enrollment {
  constructor(data) {
    this.id = data.id;
    this._id = data.id; // Compatibility

    this.student = data.student;
    this.course = data.course;
    this.enrolledBy = data.enrolledBy;
    this.paymentStatus = data.paymentStatus || "PENDING";
    this.paymentMethod = data.paymentMethod || "FREE";
    this.enrolledAt = data.enrolledAt ? new Date(data.enrolledAt) : new Date();
    this.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    this.isActive = data.isActive !== undefined ? !!data.isActive : true;

    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static async init() {
    try {
      if (!await migrationHelper.tableExists('enrollments')) {
        await executeQuery(`
                    CREATE TABLE enrollments (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        student INT NOT NULL,
                        course INT NOT NULL,
                        enrolledBy INT NOT NULL,
                        paymentStatus NVARCHAR(50) DEFAULT 'PENDING',
                        paymentMethod NVARCHAR(50) DEFAULT 'FREE',
                        enrolledAt DATETIME DEFAULT GETDATE(),
                        expiresAt DATETIME,
                        isActive BIT DEFAULT 1,
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        CONSTRAINT unique_enrollment UNIQUE (student, course)
                    )
                `);
        await migrationHelper.ensureIndexExists('enrollments', 'idx_student',
          'CREATE INDEX idx_student ON enrollments(student)');
        await migrationHelper.ensureIndexExists('enrollments', 'idx_course',
          'CREATE INDEX idx_course ON enrollments(course)');
      }
    } catch (error) {
      logger.error("Failed to initialize Enrollment table", error);
    }
  }

  static async create(data) {
    const enrollment = new Enrollment(data);

    const fields = [
      "student", "course", "enrolledBy", "paymentStatus",
      "paymentMethod", "enrolledAt", "expiresAt", "isActive", "createdAt"
    ];

    if (!enrollment.createdAt) enrollment.createdAt = new Date();

    const values = fields.map(field => {
      const val = enrollment[field];
      if (val === undefined) return null;
      return val;
    });

    const placeholders = fields.map(() => "?").join(",");
    const query = `INSERT INTO enrollments (${fields.join(",")}) 
    OUTPUT INSERTED.id
    VALUES (${placeholders})`;

    const [result] = await executeQuery(query, values);
    return Enrollment.findById(result[0].id);
  }

  static async findById(id) {
    const [rows] = await executeQuery("SELECT * FROM enrollments WHERE id = ?", [id]);
    if (rows.length === 0) return null;
    return new Enrollment(rows[0]);
  }

  static async findOne(query) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    if (keys.length === 0) return null;

    const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
    const values = keys.map(key => query[key]);

    const [rows] = await executeQuery(`SELECT TOP 1 * FROM enrollments WHERE ${whereClause}`, values);
    if (rows.length === 0) return null;
    return new Enrollment(rows[0]);
  }

  static async find(query = {}) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    let sql = "SELECT * FROM enrollments";
    let values = [];

    if (keys.length > 0) {
      const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
      sql += ` WHERE ${whereClause}`;
      values = keys.map(key => query[key]);
    }

    const [rows] = await executeQuery(sql, values);
    return rows.map(row => new Enrollment(row));
  }

  static async countDocuments(query = {}) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    let sql = "SELECT COUNT(*) as count FROM enrollments";
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
      "student", "course", "enrolledBy", "paymentStatus",
      "paymentMethod", "enrolledAt", "expiresAt", "isActive"
    ];

    const setClause = fields.map(field => `${field} = ?`).join(", ");
    const values = fields.map(field => this[field]);
    values.push(this.id);

    await executeQuery(`UPDATE enrollments SET ${setClause}, updatedAt = GETDATE() WHERE id = ?`, values);
    return this;
  }
}

// Initialize table
Enrollment.init();

export default Enrollment;
