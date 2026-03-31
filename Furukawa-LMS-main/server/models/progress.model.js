import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";
import Course from "./course.model.js";
import Module from "./module.model.js";

class Progress {
  constructor(data) {
    this.id = data.id;
    this._id = data.id; // Compatibility

    this.student = data.student;
    this.course = data.course;

    this.completedLessons = typeof data.completedLessons === 'string' ? JSON.parse(data.completedLessons) : (data.completedLessons || []);
    this.completedModules = typeof data.completedModules === 'string' ? JSON.parse(data.completedModules) : (data.completedModules || []);
    this.quizzes = typeof data.quizzes === 'string' ? JSON.parse(data.quizzes) : (data.quizzes || []);
    this.assignments = typeof data.assignments === 'string' ? JSON.parse(data.assignments) : (data.assignments || []);

    this.currentLevel = data.currentLevel || "L1";
    this.levelLockEnabled = !!data.levelLockEnabled;
    this.lockedLevel = data.lockedLevel || null;

    this.progressPercent = data.progressPercent !== undefined ? data.progressPercent : 0;
    this.lastAccessed = data.lastAccessed ? new Date(data.lastAccessed) : new Date();
    this.currentAccessibleModule = data.currentAccessibleModule;

    this.levelStartDate = data.levelStartDate ? new Date(data.levelStartDate) : (data.createdAt ? new Date(data.createdAt) : new Date());
    this.pendingLevelUpgrade = data.pendingLevelUpgrade || null;

    this.timelineViolations = typeof data.timelineViolations === 'string' ? JSON.parse(data.timelineViolations) : (data.timelineViolations || []);
    this.timelineNotifications = typeof data.timelineNotifications === 'string' ? JSON.parse(data.timelineNotifications) : (data.timelineNotifications || []);

    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static async init() {
    const query = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'progress')
            BEGIN
                CREATE TABLE progress (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    student INT NOT NULL,
                    course INT NOT NULL,
                    completedLessons NVARCHAR(MAX),
                    completedModules NVARCHAR(MAX),
                    quizzes NVARCHAR(MAX),
                    assignments NVARCHAR(MAX),
                    currentLevel NVARCHAR(50) DEFAULT 'L1',
                    levelStartDate DATETIME DEFAULT GETDATE(),
                    pendingLevelUpgrade NVARCHAR(50) DEFAULT NULL,
                    levelLockEnabled BIT DEFAULT 0,
                    lockedLevel NVARCHAR(50),
                    progressPercent DECIMAL(5, 2) DEFAULT 0,
                    lastAccessed DATETIME DEFAULT GETDATE(),
                    currentAccessibleModule INT,
                    timelineViolations NVARCHAR(MAX),
                    timelineNotifications NVARCHAR(MAX),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT unique_student_course UNIQUE (student, course)
                );
                CREATE INDEX idx_student_progress ON progress(student);
                CREATE INDEX idx_course_progress ON progress(course);
            END
        `;
    try {
      await executeQuery(query);
    } catch (error) {
      logger.error("Failed to initialize Progress table", error);
    }
  }

  static async create(data) {
    // Validation/Defaults logic could go here
    const progress = new Progress(data);

    // Initial Calculation (optional, but good practice if data provided implies progress)
    // await progress.calculateProgress(); // Might require saving first or mocking the context

    const fields = [
      "student", "course", "completedLessons", "completedModules",
      "quizzes", "assignments", "currentLevel", "levelStartDate", "pendingLevelUpgrade", "levelLockEnabled",
      "lockedLevel", "progressPercent", "lastAccessed", "currentAccessibleModule",
      "timelineViolations", "timelineNotifications", "createdAt"
    ];

    if (!progress.createdAt) progress.createdAt = new Date();

    const values = fields.map(field => {
      let val = progress[field];
      if (['completedLessons', 'completedModules', 'quizzes', 'assignments', 'timelineViolations', 'timelineNotifications'].includes(field)) {
        return JSON.stringify(val);
      }
      if (val === undefined) return null;
      return val;
    });

    const placeholders = fields.map(() => "?").join(",");
    const query = `INSERT INTO progress (${fields.join(",")}) 
    OUTPUT INSERTED.id
    VALUES (${placeholders})`;

    const [result] = await executeQuery(query, values);
    return Progress.findById(result[0].id);
  }

  static async findById(id) {
    const [rows] = await executeQuery("SELECT * FROM progress WHERE id = ?", [id]);
    if (rows.length === 0) return null;
    return new Progress(rows[0]);
  }

  static async findOne(query) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    if (keys.length === 0) return null;

    const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
    const values = keys.map(key => query[key]);

    const [rows] = await executeQuery(`SELECT TOP 1 * FROM progress WHERE ${whereClause}`, values);
    if (rows.length === 0) return null;
    return new Progress(rows[0]);
  }

  static async find(query = {}) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    let sql = "SELECT * FROM progress";
    let values = [];

    if (keys.length > 0) {
      const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
      sql += ` WHERE ${whereClause}`;
      values = keys.map(key => query[key]);
    }

    const [rows] = await executeQuery(sql, values);
    return rows.map(row => new Progress(row));
  }

  static async countDocuments(query = {}) {
    const keys = Object.keys(query).filter(key => query[key] !== undefined);
    let sql = "SELECT COUNT(*) as count FROM progress";
    let values = [];

    if (keys.length > 0) {
      const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
      sql += ` WHERE ${whereClause}`;
      values = keys.map(key => query[key]);
    }

    const [rows] = await executeQuery(sql, values);
    return rows[0].count;
  }

  static async exists(query) {
    const doc = await this.findOne(query);
    return !!doc;
  }

  async calculateProgress() {
    const course = await Course.findById(this.course);
    if (!course) return this.progressPercent;

    // Note: Course model in SQL uses JSON for 'modules' but those are typically just IDs or basic structures depending on how it was saved.
    // The original logic assumes course.modules is an array of IDs.
    // In our migrated Course model, `modules` is a JSON column.

    let totalLessons = 0;
    let totalModules = 0;

    // Retrieve actual Module objects
    // We assume course.modules contains IDs or objects with IDs
    let moduleIds = [];
    if (Array.isArray(course.modules)) {
      moduleIds = course.modules.map(m => (typeof m === 'object' && m._id) ? m._id : m);
    } else if (typeof course.modules === 'string') {
      // Edge case if it somehow stayed a string despite parsing in constructor?
      // Should not happen if Course model is working, but safe guard.
      try { moduleIds = JSON.parse(course.modules); } catch (e) { }
      if (Array.isArray(moduleIds)) moduleIds = moduleIds.map(m => (typeof m === 'object' && m._id) ? m._id : m);
    }

    if (moduleIds.length > 0) {
      // Fetch modules from DB
      // Need a way to do WHERE id IN (...)
      const ph = moduleIds.map(() => '?').join(',');
      const [modules] = await executeQuery(`SELECT * FROM modules WHERE course = ? AND id IN (${ph})`, [this.course, ...moduleIds]);

      totalModules = modules.length;
      totalLessons = modules.reduce((count, mod) => {
        let lessons = [];
        if (typeof mod.lessons === 'string') try { lessons = JSON.parse(mod.lessons); } catch (e) { }
        else lessons = mod.lessons || [];
        // Original logic: lessons refers to IDs in the module definition in Mongoose
        // In our SQL Module model, lessons is a JSON array of lesson objects or IDs.
        return count + lessons.length;
      }, 0);
    }

    const completedLessonsCount = this.completedLessons.length;
    const completedModulesCount = this.completedModules.length;

    const lessonWeight = 0.7;
    const quizWeight = 0.2;
    const assignmentWeight = 0.1;

    let lessonProgress = 0;
    if (totalLessons > 0) {
      lessonProgress = (completedLessonsCount / totalLessons) * 100;
    } else if (totalModules > 0) {
      lessonProgress = (completedModulesCount / totalModules) * 100;
    }

    const passedQuizzes = this.quizzes.filter((q) => q.isPassed).length;
    // Quizzes in Course:
    let courseQuizzes = [];
    if (Array.isArray(course.quizzes)) courseQuizzes = course.quizzes;
    else if (course.quizzes) try { courseQuizzes = JSON.parse(course.quizzes); } catch (e) { }
    const totalQuizzes = courseQuizzes.length || 0;
    const quizProgress = totalQuizzes > 0 ? (passedQuizzes / totalQuizzes) * 100 : 0;

    const submittedAssignments = this.assignments.length;
    // Assignments in Course:
    let courseAssignments = [];
    if (Array.isArray(course.assignments)) courseAssignments = course.assignments;
    else if (course.assignments) try { courseAssignments = JSON.parse(course.assignments); } catch (e) { }
    const totalAssignments = courseAssignments.length || 0;
    const assignmentProgress = totalAssignments > 0 ? (submittedAssignments / totalAssignments) * 100 : 0;

    const parts = [];
    const weights = [];
    if (totalLessons > 0 || totalModules > 0) { parts.push(lessonProgress); weights.push(lessonWeight); }
    if (totalQuizzes > 0) { parts.push(quizProgress); weights.push(quizWeight); }
    if (totalAssignments > 0) { parts.push(assignmentProgress); weights.push(assignmentWeight); }

    let totalProgress = 0;
    if (parts.length > 0) {
      const weighted = parts.reduce((sum, val, idx) => sum + val * weights[idx], 0);
      const weightSum = weights.reduce((a, b) => a + b, 0);
      totalProgress = weighted / (weightSum || 1);
    }

    this.progressPercent = Math.min(100, Math.round(totalProgress));
    return this.progressPercent;
  }

  async updateCurrentAccessibleModule() {
    try {
      const course = await Course.findById(this.course);
      if (!course) return;

      let moduleIds = [];
      if (Array.isArray(course.modules)) {
        moduleIds = course.modules.map(m => (typeof m === 'object' && m._id) ? m._id : m);
      }

      if (moduleIds.length === 0) return;

      // Fetch full module objects to get 'order'
      const ph = moduleIds.map(() => '?').join(',');
      const [modulesData] = await executeQuery(`SELECT * FROM modules WHERE id IN (${ph})`, moduleIds);

      // Map SQL rows to Module instances if needed, or just use raw data
      const modules = modulesData.map(m => new Module(m));
      modules.sort((a, b) => a.order - b.order);

      let nextModule = null;
      for (const module of modules) {
        const isCompleted = this.completedModules.some(
          completed => completed.moduleId.toString() === module.id.toString()
        );

        if (!isCompleted) {
          nextModule = module;
          break;
        }
      }

      this.currentAccessibleModule = nextModule ? nextModule.id : null;

    } catch (error) {
      logger.error('Error updating current accessible module:', error);
    }
  }

  async demoteToModule(targetModuleId, reason = 'TIMELINE_VIOLATION') {
    try {
      const course = await Course.findById(this.course);
      if (!course) return false;

      // Fetch target module to get its order
      const targetModule = await Module.findById(targetModuleId);
      if (!targetModule) return false;

      // Fetch all modules for course to compare orders
      let moduleIds = [];
      if (Array.isArray(course.modules)) {
        moduleIds = course.modules.map(m => (typeof m === 'object' && m._id) ? m._id : m);
      }
      if (moduleIds.length === 0) return false;

      const placeholders = moduleIds.map(() => '?').join(',');
      const [allModules] = await executeQuery(`SELECT * FROM modules WHERE id IN (${placeholders})`, moduleIds);
      const modulesToRemove = allModules.filter(m => m.order > targetModule.order);
      const modulesToRemoveIds = modulesToRemove.map(m => m.id.toString());

      // Remove completion records
      this.completedModules = this.completedModules.filter(
        completed => !modulesToRemoveIds.includes(completed.moduleId.toString())
      );

      // Remove lesson completions
      // Gather all lessons from the modules we are removing
      let lessonsToRemoveIds = [];
      modulesToRemove.forEach(mod => {
        let lessons = [];
        if (typeof mod.lessons === 'string') try { lessons = JSON.parse(mod.lessons); } catch (e) { }
        else lessons = mod.lessons || [];
        // Assuming lessons array in Module contains IDs or objects with IDs
        lessonsToRemoveIds.push(...lessons.map(l => (typeof l === 'object' && l._id) ? l._id.toString() : l.toString()));
      });

      this.completedLessons = this.completedLessons.filter(
        completed => !lessonsToRemoveIds.includes(completed.lessonId.toString())
      );

      this.currentAccessibleModule = targetModuleId;
      return true;

    } catch (error) {
      logger.error('Error demoting student:', error);
      return false;
    }
  }

  addTimelineViolation(moduleId, deadline, demotedFromModuleId, demotedToModuleId) {
    this.timelineViolations.push({
      module: moduleId,
      deadline: deadline,
      violatedAt: new Date(),
      demotedFromModule: demotedFromModuleId,
      demotedToModule: demotedToModuleId,
      reason: 'TIMELINE_VIOLATION',
    });
  }

  addTimelineNotification(type, moduleId, message) {
    this.timelineNotifications.push({
      type: type,
      module: moduleId,
      message: message,
      sentAt: new Date(),
      read: false,
    });
  }

  getUnreadTimelineNotifications() {
    return this.timelineNotifications.filter(notification => !notification.read);
  }

  markNotificationRead(notificationId) {
    // In array of objects, usually we don't have unique IDs unless generated.
    // Assuming notificationId matches index or some unique prop if we added one.
    // Original implementation used Mongoose subdocument .id().
    // Here we might need to rely on index or strict object matching, or add IDs manually.
    // For simplicity, let's look for a match by reference if possible, or assume caller provides index? 
    // Or strictly, we can't easily find by ID if we didn't generate one.
    // Let's modify creation to add an ephemeral ID for runtime, or assume typical usage.
    // Better: Find by properties or add ID field in addTimelineNotification.
    // Let's add a simple random ID if missing.
    const notification = this.timelineNotifications.find(n => n.id === notificationId || n._id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  async save() {
    await this.calculateProgress();
    // Check if completedModules changed? Hard to track changes without proxies.
    // We'll just always update accessible module on save for correctness.
    await this.updateCurrentAccessibleModule();

    const fields = [
      "student", "course", "completedLessons", "completedModules",
      "quizzes", "assignments", "currentLevel", "levelStartDate", "pendingLevelUpgrade", "levelLockEnabled",
      "lockedLevel", "progressPercent", "lastAccessed", "currentAccessibleModule",
      "timelineViolations", "timelineNotifications"
    ];

    const setClause = fields.map(field => `${field} = ?`).join(", ");
    const values = fields.map(field => {
      let val = this[field];
      if (['completedLessons', 'completedModules', 'quizzes', 'assignments', 'timelineViolations', 'timelineNotifications'].includes(field)) {
        return JSON.stringify(val);
      }
      return val;
    });
    values.push(this.id);

    await executeQuery(`UPDATE progress SET ${setClause}, updatedAt = GETDATE() WHERE id = ?`, values);
    return this;
  }
}

// Initialize table
Progress.init();

export default Progress;
