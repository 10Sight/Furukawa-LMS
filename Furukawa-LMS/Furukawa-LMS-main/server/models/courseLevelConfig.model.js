import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class CourseLevelConfig {
  constructor(data) {
    this.id = data.id;
    this._id = data.id; // Compatibility

    this.name = data.name || "Default Course Level Configuration";
    this.description = data.description || "System-wide course level configuration";
    this.levels = typeof data.levels === 'string' ? JSON.parse(data.levels) : (data.levels || []);
    this.isActive = data.isActive !== undefined ? !!data.isActive : true;
    this.isDefault = !!data.isDefault;
    this.createdBy = data.createdBy;
    this.lastModifiedBy = data.lastModifiedBy;

    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;

    // Ensure levels are sorted by order on instantiation
    if (this.levels && this.levels.length > 0) {
      this.levels.sort((a, b) => a.order - b.order);
    }
  }

  static async init() {
    const query = `
            IF OBJECT_ID('course_level_configs', 'U') IS NULL
            BEGIN
                CREATE TABLE course_level_configs (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    name NVARCHAR(255) NOT NULL UNIQUE,
                    description NVARCHAR(MAX),
                    levels NVARCHAR(MAX) NOT NULL,
                    isActive BIT DEFAULT 1,
                    isDefault BIT DEFAULT 0,
                    createdBy NVARCHAR(255),
                    lastModifiedBy NVARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                )
                CREATE INDEX idx_status ON course_level_configs(isActive, isDefault)
            END
        `;
    try {
      await executeQuery(query);
      console.log("CourseLevelConfig table verified/created in MSSQL.");
    } catch (error) {
      logger.error("Failed to initialize CourseLevelConfig table", error);
    }
  }

  static async create(data) {
    // Validation logic
    const levels = data.levels || [];
    if (levels.length === 0) throw new Error("At least one level is required");

    // Ensure explicit default logic
    if (data.isDefault) {
      await executeQuery("UPDATE course_level_configs SET isDefault = 0");
    }

    // Sort levels
    levels.sort((a, b) => a.order - b.order);

    const config = new CourseLevelConfig({ ...data, levels });

    const fields = [
      "name", "description", "levels", "isActive", "isDefault",
      "createdBy", "lastModifiedBy", "createdAt"
    ];

    if (!config.createdAt) config.createdAt = new Date();

    const values = fields.map(field => {
      let val = config[field];
      if (field === 'levels') return JSON.stringify(val);
      if (val === undefined) return null;
      return val;
    });

    const placeholders = fields.map(() => "?").join(",");
    const query = `INSERT INTO course_level_configs (${fields.join(",")}) OUTPUT INSERTED.id VALUES (${placeholders})`;

    const [result] = await executeQuery(query, values);
    return CourseLevelConfig.findById(result[0]?.id);
  }

  static async findById(id) {
    const [rows] = await executeQuery("SELECT * FROM course_level_configs WHERE id = ?", [id]);
    if (rows.length === 0) return null;
    return new CourseLevelConfig(rows[0]);
  }

  static async findOne(query) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    let sql = "SELECT TOP 1 * FROM course_level_configs";
    let values = [];

    if (keys.length > 0) {
      const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
      sql += ` WHERE ${whereClause}`;
      values = keys.map(key => query[key]);
    }

    const [rows] = await executeQuery(sql, values);
    if (rows.length === 0) return null;
    return new CourseLevelConfig(rows[0]);
  }

  static async find(query = {}) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined && key !== 'sort');
    let sql = "SELECT * FROM course_level_configs";
    let values = [];

    if (keys.length > 0) {
      const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
      sql += ` WHERE ${whereClause}`;
      values = keys.map(key => query[key]);
    }

    if (query.sort) {
      // Very basic sort handling
      const sortKey = Object.keys(query.sort)[0];
      const sortOrder = query.sort[sortKey] === -1 ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${sortKey} ${sortOrder}`;
    }

    const [rows] = await executeQuery(sql, values);
    return rows.map(row => new CourseLevelConfig(row));
  }

  async save() {
    if (this.isDefault) {
      await executeQuery("UPDATE course_level_configs SET isDefault = 0 WHERE id != ?", [this.id]);
    }

    // Sort levels
    if (this.levels && this.levels.length > 0) {
      this.levels.sort((a, b) => a.order - b.order);
    }

    const fields = [
      "name", "description", "levels", "isActive", "isDefault",
      "createdBy", "lastModifiedBy"
    ];

    const setClause = fields.map(field => `${field} = ?`).join(", ");
    const values = fields.map(field => {
      let val = this[field];
      if (field === 'levels') return JSON.stringify(val);
      if (field === 'isActive') return val ? 1 : 0;
      if (field === 'isDefault') return val ? 1 : 0;
      return val;
    });
    values.push(this.id);

    await executeQuery(`UPDATE course_level_configs SET ${setClause} WHERE id = ?`, values);
    return this;
  }

  // Helper: Get Active Config
  static async getActiveConfig() {
    let [rows] = await executeQuery("SELECT TOP 1 * FROM course_level_configs WHERE isActive = 1 AND isDefault = 1");

    if (rows.length === 0) {
      [rows] = await executeQuery("SELECT TOP 1 * FROM course_level_configs WHERE isActive = 1 ORDER BY createdAt DESC");
    }

    if (rows.length === 0) {
      // Create default
      return await this.create({
        name: "Default Configuration",
        description: "Default 3-level system (L1, L2, L3)",
        isDefault: true,
        isActive: true,
        levels: [
          { name: "L1", order: 0, completionTimeframe: { minDays: 1, maxDays: 4 }, description: "Beginner Level", color: "#3B82F6" },
          { name: "L2", order: 1, completionTimeframe: { minDays: 5, maxDays: 8 }, description: "Intermediate Level", color: "#F97316" },
          { name: "L3", order: 2, completionTimeframe: { minDays: 9, maxDays: 12 }, description: "Advanced Level", color: "#10B981" },
        ],
      });
    }
    return new CourseLevelConfig(rows[0]);
  }

  static async isValidLevel(levelName) {
    const config = await this.getActiveConfig();
    if (!config) return false;
    return config.levels.some(level => level.name.toUpperCase() === levelName.toUpperCase());
  }

  static async getLevelByName(levelName) {
    const config = await this.getActiveConfig();
    if (!config) return null;
    return config.levels.find(level => level.name.toUpperCase() === levelName.toUpperCase());
  }

  getNextLevel(currentLevelName) {
    if (!currentLevelName) return this.levels[0];
    const currentLevel = this.levels.find(l => l.name.toUpperCase() === currentLevelName.toUpperCase());
    if (!currentLevel) return null;
    return this.levels.find(l => l.order === currentLevel.order + 1) || null;
  }

  getPreviousLevel(currentLevelName) {
    const currentLevel = this.levels.find(l => l.name.toUpperCase() === currentLevelName.toUpperCase());
    if (!currentLevel || currentLevel.order === 0) return null;
    return this.levels.find(l => l.order === currentLevel.order - 1) || null;
  }
}

// Initialize table
CourseLevelConfig.init();

export default CourseLevelConfig;
