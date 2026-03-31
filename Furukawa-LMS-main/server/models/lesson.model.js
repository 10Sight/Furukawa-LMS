import { executeQuery } from "../db/mssqlHelper.js";
import { slugify } from "../utils/slugify.js";
import logger from "../logger/winston.logger.js";

class Lesson {
  constructor(data) {
    this.id = data.id;
    this._id = data.id; // Compatibility

    this.module = data.module;
    this.title = data.title;
    this.content = data.content;
    this.slides = typeof data.slides === 'string' ? JSON.parse(data.slides) : (data.slides || []);
    this.duration = data.duration !== undefined ? data.duration : 0;
    this.order = data.order !== undefined ? data.order : 1;
    this.slug = data.slug;
    this.resources = typeof data.resources === 'string' ? JSON.parse(data.resources) : (data.resources || []);

    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static async init() {
    const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'lessons')
            BEGIN
                CREATE TABLE lessons (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    module INT NOT NULL,
                    title NVARCHAR(255) NOT NULL,
                    content NVARCHAR(MAX),
                    slides NVARCHAR(MAX),
                    duration INT DEFAULT 0,
                    [order] INT DEFAULT 1,
                    slug NVARCHAR(255),
                    resources NVARCHAR(MAX),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT unique_module_slug UNIQUE (module, slug)
                );
                CREATE INDEX idx_module_lessons ON lessons(module);
                CREATE INDEX idx_slug_lessons ON lessons(slug);
            END
        `;
    try {
      await executeQuery(query);
    } catch (error) {
      logger.error("Failed to initialize Lesson table", error);
    }
  }

  static async create(data) {
    // Generate unique slug scoped to module
    console.log("[DEBUG Lesson.create] Input data:", { module: data.module, title: data.title });
    let baseSlug = slugify(data.title);
    if (!baseSlug) baseSlug = Math.random().toString(36).slice(2, 8); // Fallback for empty titles
    let slug = baseSlug;
    let suffix = 1;
    console.log("[DEBUG Lesson.create] Initial slug:", slug);
    while (true) {
      const [rows] = await executeQuery(
        "SELECT id FROM lessons WHERE slug = ? AND module = ?",
        [slug, data.module]
      );
      if (rows.length === 0) break;
      suffix++;
      slug = `${baseSlug}-${suffix}`;
      console.log(`[DEBUG Lesson.create] Slug collision, trying: ${slug}`);
    }
    data.slug = slug;

    const lesson = new Lesson(data);

    const fields = [
      "module", "title", "content", "slides",
      "duration", "order", "slug", "resources", "createdAt"
    ];

    if (!lesson.createdAt) lesson.createdAt = new Date();

    const values = fields.map(field => {
      let val = lesson[field];
      if (['slides', 'resources'].includes(field)) {
        return JSON.stringify(val);
      }
      if (val === undefined) return null;
      return val;
    });

    console.log("[DEBUG Lesson.create] Final fields:", fields);
    console.log("[DEBUG Lesson.create] Final values:", values);

    // specific handling for "order" keyword in SQL usually requires backticks, 
    // but parameters (?) don't need them. The column name in the INSERT clause needs them if it conflicts.
    // "order" is a reserved word.
    const escapedFields = fields.map(f => f === 'order' ? '[order]' : f);
    const placeholders = fields.map(() => "?").join(",");
    const query = `INSERT INTO lessons (${escapedFields.join(",")}) 
    OUTPUT INSERTED.id
    VALUES (${placeholders})`;

    const [result] = await executeQuery(query, values);
    return Lesson.findById(result[0].id);
  }

  static async findById(id) {
    if (!id || isNaN(id)) return null;
    const [rows] = await executeQuery("SELECT * FROM lessons WHERE id = ?", [id]);
    if (rows.length === 0) return null;
    return new Lesson(rows[0]);
  }

  static async findOne(query) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    if (keys.length === 0) return null;

    const whereClause = keys.map(key => {
      if (key === 'order') return "[order] = ?";
      return `${key} = ?`;
    }).join(" AND ");
    const values = keys.map(key => query[key]);

    const [rows] = await executeQuery(`SELECT TOP 1 * FROM lessons WHERE ${whereClause}`, values);
    if (rows.length === 0) return null;
    return new Lesson(rows[0]);
  }

  static async find(query = {}) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined && key !== 'sort');
    let sql = "SELECT * FROM lessons";
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
    return rows.map(row => new Lesson(row));
  }

  static async countDocuments(query = {}) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    let sql = "SELECT COUNT(*) as count FROM lessons";
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
    // Slug update logic (simplified: if title changed, ideally regen, but keeping it simple for now)

    const fields = [
      "module", "title", "content", "slides",
      "duration", "order", "slug", "resources"
    ];

    const setClause = fields.map(field => {
      const col = field === 'order' ? '[order]' : field;
      return `${col} = ?`;
    }).join(", ");

    const values = fields.map(field => {
      let val = this[field];
      if (['slides', 'resources'].includes(field)) {
        return JSON.stringify(val);
      }
      return val;
    });
    values.push(this.id);

    await executeQuery(`UPDATE lessons SET ${setClause}, updatedAt = GETDATE() WHERE id = ?`, values);
    return this;
  }
}

// Initialize table
Lesson.init();

export default Lesson;
