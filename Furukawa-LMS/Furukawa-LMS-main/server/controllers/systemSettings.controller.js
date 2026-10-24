import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { readSystemSettingsStore, writeSystemSettingsStore, updateSystemSettingsStore, DEFAULT_SYSTEM_SETTINGS } from "../db/systemSettingsStore.js";

// Helper to ensure settings exist
const ensureSettingsExist = async (userId = null) => {
    try {
        const [rows] = await executeQuery("SELECT TOP 1 * FROM system_settings");
        if (rows && rows.length > 0) return rows[0];

        // Create default in DB
        const [result] = await executeQuery(`
            INSERT INTO system_settings (lastModifiedBy, createdAt, updatedAt)
            OUTPUT INSERTED.id
            VALUES (?, GETDATE(), GETDATE())
        `, [userId]);

        if (result && result.length > 0 && result[0]?.id) {
            const [newSettings] = await executeQuery("SELECT * FROM system_settings WHERE id = ?", [result[0].id]);
            if (newSettings && newSettings.length > 0) return newSettings[0];
        }
    } catch {
        // Fall back to JSON file store when DB is offline or table does not exist
    }

    const fileStore = readSystemSettingsStore();
    return { id: 1, ...fileStore };
};

// Get current system settings
export const getSystemSettings = asyncHandler(async (req, res) => {
    let settings = await ensureSettingsExist(req.user?.id);

    // Populate lastModifiedBy
    let lastModifiedBy = null;
    if (settings.lastModifiedBy) {
        try {
            const [users] = await executeQuery("SELECT id, fullName, email FROM users WHERE id = ?", [settings.lastModifiedBy]);
            if (users && users.length > 0) lastModifiedBy = users[0];
        } catch {
            // ignore if DB is offline
        }
    }

    res.json(new ApiResponse(200, { ...settings, lastModifiedBy }, "System settings fetched successfully"));
});

// Update system settings
export const updateSystemSettings = asyncHandler(async (req, res) => {
    const updateData = { ...req.body };
    const userId = req.user?.id || null; // Fix: use id not _id if relying on previous mysql implementations

    // Validate sensitive fields
    if (updateData.adminEmail && !/^\S+@\S+\.\S+$/.test(updateData.adminEmail)) {
        throw new ApiError("Invalid admin email format", 400);
    }

    if (updateData.fromEmail && !/^\S+@\S+\.\S+$/.test(updateData.fromEmail)) {
        throw new ApiError("Invalid from email format", 400);
    }

    // Validate numeric ranges
    if (updateData.sessionTimeout && (updateData.sessionTimeout < 5 || updateData.sessionTimeout > 480)) {
        throw new ApiError("Session timeout must be between 5 and 480 minutes", 400);
    }

    if (updateData.maxLoginAttempts && (updateData.maxLoginAttempts < 3 || updateData.maxLoginAttempts > 10)) {
        throw new ApiError("Max login attempts must be between 3 and 10", 400);
    }

    if (updateData.passwordMinLength && (updateData.passwordMinLength < 6 || updateData.passwordMinLength > 32)) {
        throw new ApiError("Password minimum length must be between 6 and 32 characters", 400);
    }

    if (updateData.maxFileUploadSize && (updateData.maxFileUploadSize < 1 || updateData.maxFileUploadSize > 100)) {
        throw new ApiError("Max file upload size must be between 1 and 100 MB", 400);
    }

    if (updateData.backupRetention && (updateData.backupRetention < 7 || updateData.backupRetention > 365)) {
        throw new ApiError("Backup retention must be between 7 and 365 days", 400);
    }

    if (updateData.notificationRetention && (updateData.notificationRetention < 7 || updateData.notificationRetention > 365)) {
        throw new ApiError("Notification retention must be between 7 and 365 days", 400);
    }

    if (updateData.maxConcurrentUsers && (updateData.maxConcurrentUsers < 100 || updateData.maxConcurrentUsers > 10000)) {
        throw new ApiError("Max concurrent users must be between 100 and 10,000", 400);
    }

    // Validate enum values
    const validTimeFormats = ["12h", "24h"];
    if (updateData.timeFormat && !validTimeFormats.includes(updateData.timeFormat)) {
        throw new ApiError("Invalid time format. Must be '12h' or '24h'", 400);
    }

    const validEncryptions = ["none", "tls", "ssl"];
    if (updateData.smtpEncryption && !validEncryptions.includes(updateData.smtpEncryption)) {
        throw new ApiError("Invalid SMTP encryption. Must be 'none', 'tls', or 'ssl'", 400);
    }

    const validLogLevels = ["error", "warn", "info", "debug"];
    if (updateData.logLevel && !validLogLevels.includes(updateData.logLevel)) {
        throw new ApiError("Invalid log level. Must be 'error', 'warn', 'info', or 'debug'", 400);
    }

    // Prepare Update Columns
    // Only update fields present in body
    // Allowed fields list to preventSQL injection via key names if we were doing dynamic keys (though we are parameterized)
    const allowedFields = [
        'adminEmail', 'appName', 'appUrl', 'companyName', 'companyAddress', 'companyPhone',
        'fromEmail', 'fromName', 'smtpHost', 'smtpPort', 'smtpUsername', 'smtpPassword', 'smtpEncryption',
        'sessionTimeout', 'maxLoginAttempts', 'passwordMinLength', 'passwordRequireSpecial', 'passwordRequireNumbers', 'passwordRequireUppercase',
        'maxFileUploadSize', 'allowedFileTypes', 'backupRetention', 'autoBackup',
        'maintenanceMode', 'logLevel', 'emailNotifications', 'notificationRetention',
        'maxConcurrentUsers', 'timeFormat'
    ];

    let updates = ["updatedAt = GETDATE()", "lastModifiedBy = ?"];
    let values = [userId];

    Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
            updates.push(`${key} = ?`);
            values.push(updateData[key]);
        }
    });

    const currentSettings = await ensureSettingsExist(userId);

    // Filter updateData to only allowed fields
    const safeUpdateData = {};
    Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
            safeUpdateData[key] = updateData[key];
        }
    });

    try {
        await executeQuery(`UPDATE system_settings SET ${updates.join(', ')} WHERE id = ?`, [...values, currentSettings.id]);
    } catch {
        // DB offline - continue to file store
    }

    // Always persist to JSON file store
    const fileStoreUpdated = updateSystemSettingsStore({ ...safeUpdateData, lastModifiedBy: userId });

    let newSettings = { ...currentSettings, ...fileStoreUpdated };
    try {
        const [updatedRows] = await executeQuery("SELECT * FROM system_settings WHERE id = ?", [currentSettings.id]);
        if (updatedRows && updatedRows.length > 0) {
            newSettings = { ...newSettings, ...updatedRows[0] };
        }
    } catch {
        // ignore if DB is offline
    }

    // Populate
    let lastModifiedBy = null;
    if (newSettings.lastModifiedBy) {
        try {
            const [users] = await executeQuery("SELECT id, fullName, email FROM users WHERE id = ?", [newSettings.lastModifiedBy]);
            if (users && users.length > 0) lastModifiedBy = users[0];
        } catch {
            // ignore if DB is offline
        }
    }

    res.json(new ApiResponse(200, { ...newSettings, lastModifiedBy }, "System settings updated successfully"));
});

// Reset system settings to default
export const resetSystemSettings = asyncHandler(async (req, res) => {
    // Delete all from DB if connected
    try {
        await executeQuery("DELETE FROM system_settings");
    } catch {
        // ignore if DB is offline
    }

    // Reset JSON file store
    writeSystemSettingsStore(DEFAULT_SYSTEM_SETTINGS);

    // Create Default
    const defaultSettings = await ensureSettingsExist(req.user?.id);

    // Populate
    let lastModifiedBy = null;
    if (defaultSettings.lastModifiedBy) {
        try {
            const [users] = await executeQuery("SELECT id, fullName, email FROM users WHERE id = ?", [defaultSettings.lastModifiedBy]);
            if (users && users.length > 0) lastModifiedBy = users[0];
        } catch {
            // ignore if DB is offline
        }
    }

    res.json(new ApiResponse(200, { ...defaultSettings, lastModifiedBy }, "System settings reset to default successfully"));
});

// Get system settings history (if needed for audit purposes)
export const getSystemSettingsHistory = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    // Since we only have 1 row in singleton design, pagination is trivial/fake here.

    const [rows] = await executeQuery("SELECT TOP 1 * FROM system_settings");
    const total = rows.length;

    // Populate
    const settings = [];
    if (total > 0) {
        const s = rows[0];
        let lastModifiedBy = null;
        if (s.lastModifiedBy) {
            const [users] = await executeQuery("SELECT id, fullName, email FROM users WHERE id = ?", [s.lastModifiedBy]);
            if (users.length > 0) lastModifiedBy = users[0];
        }
        settings.push({ ...s, lastModifiedBy });
    }

    res.json(new ApiResponse(200, {
        settings,
        pagination: {
            total,
            page,
            pages: Math.ceil(total / limit),
            totalUsers: total, // Keeping consistent key name if frontend expects it, though arguably wrong context
            limit,
        },
    }, "System settings history fetched successfully"));
});

// Validate system configuration (useful for system health checks)
export const validateSystemConfiguration = asyncHandler(async (req, res) => {
    const [rows] = await executeQuery("SELECT TOP 1 * FROM system_settings");

    if (rows.length === 0) {
        throw new ApiError("System settings not found", 404);
    }
    const settings = rows[0];

    const validation = {
        isValid: true,
        warnings: [],
        errors: [],
    };

    // Check email configuration
    if (settings.emailNotifications) {
        if (!settings.smtpHost || !settings.fromEmail) {
            validation.warnings.push("Email notifications are enabled but SMTP configuration is incomplete");
        }
    }

    // Check maintenance mode
    if (settings.maintenanceMode) {
        validation.warnings.push("System is currently in maintenance mode");
    }

    // Check security settings
    if (settings.passwordMinLength < 8) {
        validation.warnings.push("Password minimum length is less than recommended (8 characters)");
    }

    if (!settings.passwordRequireSpecial || !settings.passwordRequireNumbers || !settings.passwordRequireUppercase) {
        validation.warnings.push("Password complexity requirements are not fully enabled");
    }

    // Check file upload settings
    if (settings.maxFileUploadSize > 50) {
        validation.warnings.push("Large file upload size may impact performance");
    }

    // Check backup settings
    if (!settings.autoBackup) {
        validation.warnings.push("Automatic backups are disabled");
    }

    validation.isValid = validation.errors.length === 0;

    res.json(new ApiResponse(200, validation, "System configuration validation completed"));
});
