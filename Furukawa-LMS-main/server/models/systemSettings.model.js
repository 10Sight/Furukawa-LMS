import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class SystemSettings {
  constructor(data) {
    this.id = data.id;
    this._id = data.id; // Compatibility

    // General
    this.siteName = data.siteName || "Learning Management System";
    this.siteDescription = data.siteDescription || "Advanced Learning Management System";
    this.siteUrl = data.siteUrl || "https://lms.example.com";
    this.adminEmail = data.adminEmail || "admin@example.com";
    this.timezone = data.timezone || "UTC";
    this.language = data.language || "en";
    this.dateFormat = data.dateFormat || "YYYY-MM-DD";
    this.timeFormat = data.timeFormat || "24h";

    // Security
    this.sessionTimeout = data.sessionTimeout !== undefined ? data.sessionTimeout : 30;
    this.maxLoginAttempts = data.maxLoginAttempts !== undefined ? data.maxLoginAttempts : 5;
    this.passwordMinLength = data.passwordMinLength !== undefined ? data.passwordMinLength : 8;
    this.passwordRequireSpecial = data.passwordRequireSpecial !== undefined ? !!data.passwordRequireSpecial : true;
    this.passwordRequireNumbers = data.passwordRequireNumbers !== undefined ? !!data.passwordRequireNumbers : true;
    this.passwordRequireUppercase = data.passwordRequireUppercase !== undefined ? !!data.passwordRequireUppercase : true;
    this.twoFactorAuth = !!data.twoFactorAuth;
    this.ipWhitelist = data.ipWhitelist || "";

    // Email
    this.smtpHost = data.smtpHost || "";
    this.smtpPort = data.smtpPort !== undefined ? data.smtpPort : 587;
    this.smtpUsername = data.smtpUsername || "";
    this.smtpPassword = data.smtpPassword || "";
    this.smtpEncryption = data.smtpEncryption || "tls";
    this.fromEmail = data.fromEmail || "";
    this.fromName = data.fromName || "";

    // System
    this.maintenanceMode = !!data.maintenanceMode;
    this.maintenanceMessage = data.maintenanceMessage || "System is under maintenance. Please check back later.";
    this.maxFileUploadSize = data.maxFileUploadSize !== undefined ? data.maxFileUploadSize : 10;
    this.allowedFileTypes = data.allowedFileTypes || "jpg,jpeg,png,pdf,doc,docx,txt";
    this.autoBackup = data.autoBackup !== undefined ? !!data.autoBackup : true;
    this.backupRetention = data.backupRetention !== undefined ? data.backupRetention : 30;

    // Notification
    this.emailNotifications = data.emailNotifications !== undefined ? !!data.emailNotifications : true;
    this.systemNotifications = data.systemNotifications !== undefined ? !!data.systemNotifications : true;
    this.notificationRetention = data.notificationRetention !== undefined ? data.notificationRetention : 90;

    // Performance
    this.cacheEnabled = data.cacheEnabled !== undefined ? !!data.cacheEnabled : true;
    this.compressionEnabled = data.compressionEnabled !== undefined ? !!data.compressionEnabled : true;
    this.logLevel = data.logLevel || "info";
    this.maxConcurrentUsers = data.maxConcurrentUsers !== undefined ? data.maxConcurrentUsers : 1000;

    // Meta
    this.lastModifiedBy = data.lastModifiedBy || null;
    this.version = data.version !== undefined ? data.version : 1;

    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static async init() {
    const query = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='system_settings' and xtype='U')
      BEGIN
        CREATE TABLE system_settings (
          id INT IDENTITY(1,1) PRIMARY KEY,
          siteName VARCHAR(100) DEFAULT 'Learning Management System',
          siteDescription VARCHAR(500) DEFAULT 'Advanced Learning Management System',
          siteUrl VARCHAR(200) DEFAULT 'https://lms.example.com',
          adminEmail VARCHAR(255) DEFAULT 'admin@example.com',
          timezone VARCHAR(50) DEFAULT 'UTC',
          language VARCHAR(10) DEFAULT 'en',
          dateFormat VARCHAR(20) DEFAULT 'YYYY-MM-DD',
          timeFormat VARCHAR(5) DEFAULT '24h',
          sessionTimeout INT DEFAULT 30,
          maxLoginAttempts INT DEFAULT 5,
          passwordMinLength INT DEFAULT 8,
          passwordRequireSpecial BIT DEFAULT 1,
          passwordRequireNumbers BIT DEFAULT 1,
          passwordRequireUppercase BIT DEFAULT 1,
          twoFactorAuth BIT DEFAULT 0,
          ipWhitelist NVARCHAR(MAX),
          smtpHost VARCHAR(100) DEFAULT '',
          smtpPort INT DEFAULT 587,
          smtpUsername VARCHAR(100) DEFAULT '',
          smtpPassword VARCHAR(200) DEFAULT '',
          smtpEncryption VARCHAR(10) DEFAULT 'tls',
          fromEmail VARCHAR(255) DEFAULT '',
          fromName VARCHAR(100) DEFAULT '',
          maintenanceMode BIT DEFAULT 0,
          maintenanceMessage VARCHAR(500) DEFAULT 'System is under maintenance. Please check back later.',
          maxFileUploadSize INT DEFAULT 10,
          allowedFileTypes VARCHAR(200) DEFAULT 'jpg,jpeg,png,pdf,doc,docx,txt',
          autoBackup BIT DEFAULT 1,
          backupRetention INT DEFAULT 30,
          emailNotifications BIT DEFAULT 1,
          systemNotifications BIT DEFAULT 1,
          notificationRetention INT DEFAULT 90,
          cacheEnabled BIT DEFAULT 1,
          compressionEnabled BIT DEFAULT 1,
          logLevel VARCHAR(10) DEFAULT 'info',
          maxConcurrentUsers INT DEFAULT 1000,
          lastModifiedBy VARCHAR(255),
          version INT DEFAULT 1,
          createdAt DATETIME DEFAULT GETDATE(),
          updatedAt DATETIME DEFAULT GETDATE()
        )
      END
    `;
    try {
      await executeQuery(query);
      // Ensure at least one row exists
      const [rows] = await executeQuery("SELECT COUNT(*) as count FROM system_settings");
      if (rows[0].count === 0) {
        await executeQuery("INSERT INTO system_settings (createdAt) VALUES (GETDATE())");
      }
    } catch (error) {
      logger.error("Failed to initialize SystemSettings table", error);
    }
  }

  static async getSettings() {
    const [rows] = await executeQuery("SELECT TOP 1 * FROM system_settings ORDER BY id ASC");
    if (rows.length === 0) return null;
    return new SystemSettings(rows[0]);
  }

  // Alias for compatibility
  static async findOne() {
    return this.getSettings();
  }

  static async create(data) {
    const existing = await this.getSettings();
    if (existing) {
      const settings = new SystemSettings(data);
      settings.id = existing.id;
      return settings.save();
    }

    const settings = new SystemSettings(data);
    const fields = [
      "siteName", "siteDescription", "siteUrl", "adminEmail", "timezone", "language", "dateFormat", "timeFormat",
      "sessionTimeout", "maxLoginAttempts", "passwordMinLength", "passwordRequireSpecial", "passwordRequireNumbers",
      "passwordRequireUppercase", "twoFactorAuth", "ipWhitelist",
      "smtpHost", "smtpPort", "smtpUsername", "smtpPassword", "smtpEncryption", "fromEmail", "fromName",
      "maintenanceMode", "maintenanceMessage", "maxFileUploadSize", "allowedFileTypes", "autoBackup", "backupRetention",
      "emailNotifications", "systemNotifications", "notificationRetention",
      "cacheEnabled", "compressionEnabled", "logLevel", "maxConcurrentUsers",
      "lastModifiedBy", "version"
    ];

    const values = fields.map(field => {
      const val = settings[field];
      if (val === undefined) return null;
      return val;
    });

    const placeholders = fields.map(() => "?").join(",");
    const query = `INSERT INTO system_settings (${fields.join(",")}, createdAt) OUTPUT INSERTED.id VALUES (${placeholders}, GETDATE())`;

    const [rows] = await executeQuery(query, values);
    return new SystemSettings({ ...data, id: rows[0].id });
  }

  async save() {
    this.version += 1;

    const fields = [
      "siteName", "siteDescription", "siteUrl", "adminEmail", "timezone", "language", "dateFormat", "timeFormat",
      "sessionTimeout", "maxLoginAttempts", "passwordMinLength", "passwordRequireSpecial", "passwordRequireNumbers",
      "passwordRequireUppercase", "twoFactorAuth", "ipWhitelist",
      "smtpHost", "smtpPort", "smtpUsername", "smtpPassword", "smtpEncryption", "fromEmail", "fromName",
      "maintenanceMode", "maintenanceMessage", "maxFileUploadSize", "allowedFileTypes", "autoBackup", "backupRetention",
      "emailNotifications", "systemNotifications", "notificationRetention",
      "cacheEnabled", "compressionEnabled", "logLevel", "maxConcurrentUsers",
      "lastModifiedBy", "version"
    ];

    const setClause = fields.map(field => `${field} = ?`).join(", ") + ", updatedAt = GETDATE()";
    const values = fields.map(field => this[field]);
    values.push(this.id);

    await executeQuery(`UPDATE system_settings SET ${setClause} WHERE id = ?`, values);
    return this;
  }
}

// Initialize table
SystemSettings.init();

export default SystemSettings;
