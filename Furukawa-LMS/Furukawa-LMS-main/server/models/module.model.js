import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import { slugify } from "../utils/slugify.js";
import logger from "../logger/winston.logger.js";

class Module {
  constructor(data) {
    this.id = data.id;
    this._id = data.id; // Compatibility

    this.course = data.course;
    this.title = data.title;
    this.description = data.description;
    this.slug = data.slug;
    this.order = data.order !== undefined ? data.order : 1;
    this.lessons = typeof data.lessons === 'string' ? JSON.parse(data.lessons) : (data.lessons || []);
    this.resources = typeof data.resources === 'string' ? JSON.parse(data.resources) : (data.resources || []);

    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static async init() {
    try {
      if (!await migrationHelper.tableExists('modules')) {
        await executeQuery(`
                    CREATE TABLE modules (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        course INT NOT NULL,
                        title NVARCHAR(255) NOT NULL,
                        description NVARCHAR(MAX),
                        slug NVARCHAR(255),
                        [order] INT DEFAULT 1,
                        lessons NVARCHAR(MAX),
                        resources NVARCHAR(MAX),
                        createdAt DATETIME DEFAULT GETDATE(),
                        updatedAt DATETIME DEFAULT GETDATE(),
                        CONSTRAINT unique_course_slug UNIQUE (course, slug)
                    )
                `);
        await migrationHelper.ensureIndexExists('modules', 'idx_course_module',
          'CREATE INDEX idx_course_module ON modules(course)');
      }
    } catch (error) {
      logger.error("Failed to initialize Module table", error);
    }
  }

  static async create(data) {
    // Generate unique slug scoped to course
    let baseSlug = slugify(data.title);
    if (!baseSlug) baseSlug = Math.random().toString(36).slice(2, 8); // Fallback for empty titles
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const [rows] = await executeQuery(
        "SELECT id FROM modules WHERE slug = ? AND course = ?",
        [slug, data.course]
      );
      if (rows.length === 0) break;
      suffix++;
      slug = `${baseSlug}-${suffix}`;
    }
    data.slug = slug;

    const moduleItem = new Module(data);

    const fields = [
      "course", "title", "description", "slug",
      "order", "lessons", "resources", "createdAt"
    ];

    if (!moduleItem.createdAt) moduleItem.createdAt = new Date();

    const values = fields.map(field => {
      let val = moduleItem[field];
      if (['lessons', 'resources'].includes(field)) {
        return JSON.stringify(val);
      }
      if (val === undefined) return null;
      return val;
    });

    const escapedFields = fields.map(f => f === 'order' ? '[order]' : f);
    const placeholders = fields.map(() => "?").join(",");
    const query = `INSERT INTO modules (${escapedFields.join(",")}) OUTPUT INSERTED.id VALUES (${placeholders})`;

    const [result] = await executeQuery(query, values);
    return Module.findById(result[0].id);
  }

  static async findById(id) {
    if (!id || isNaN(id)) return null;
    const [rows] = await executeQuery("SELECT * FROM modules WHERE id = ?", [id]);
    if (rows.length === 0) return null;
    return new Module(rows[0]);
  }

  static async findOne(query) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    if (keys.length === 0) return null;

    const whereClause = keys.map(key => {
      if (key === 'order') return "[order] = ?";
      return `${key} = ?`;
    }).join(" AND ");
    const values = keys.map(key => query[key]);

    const [rows] = await executeQuery(`SELECT TOP 1 * FROM modules WHERE ${whereClause}`, values);
    if (rows.length === 0) return null;
    return new Module(rows[0]);
  }

  static async find(query = {}) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined && key !== 'sort');
    let sql = "SELECT * FROM modules";
    let values = [];

    if (keys.length > 0) {
      const whereClause = keys.map(key => {
        if (key === 'order') return "[order] = ?";
        return `${key} = ?`;
      }).join(" AND ");
      sql += ` WHERE ${whereClause}`;
      values = keys.map(key => query[key]);
    }

    if (query.sort) {
      const sortKey = Object.keys(query.sort)[0];
      const sortOrder = query.sort[sortKey] === -1 ? 'DESC' : 'ASC';
      const escapedSortKey = sortKey === 'order' ? '[order]' : sortKey;
      sql += ` ORDER BY ${escapedSortKey} ${sortOrder}`;
    }

    const [rows] = await executeQuery(sql, values);
    return rows.map(row => new Module(row));
  }

  static async countDocuments(query = {}) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    let sql = "SELECT COUNT(*) as count FROM modules";
    let values = [];

    if (keys.length > 0) {
      const whereClause = keys.map(key => {
        if (key === 'order') return "[order] = ?";
        return `${key} = ?`;
      }).join(" AND ");
      sql += ` WHERE ${whereClause}`;
      values = keys.map(key => query[key]);
    }

    const [rows] = await executeQuery(sql, values);
    return rows[0].count;
  }

  async save() {
    // Slug update logic skipped for simplicity, similar to Lesson model

    const fields = [
      "course", "title", "description", "slug",
      "order", "lessons", "resources"
    ];

    const setClause = fields.map(field => {
      const col = field === 'order' ? '[order]' : field;
      return `${col} = ?`;
    }).join(", ");

    const values = fields.map(field => {
      let val = this[field];
      if (['lessons', 'resources'].includes(field)) {
        return JSON.stringify(val);
      }
      return val;
    });
    values.push(this.id);

    await executeQuery(`UPDATE modules SET ${setClause}, updatedAt = GETDATE() WHERE id = ?`, values);
    return this;
  }
}

// Initialize table
Module.init();

export default Module;
