import fs from "fs";
import path from "path";
import logger from "../logger/winston.logger.js";

export const SYSTEM_SETTINGS_STORE_PATH = path.join(process.cwd(), "db", "system_settings_store.json");

export const DEFAULT_SYSTEM_SETTINGS = {
    appName: "Furukawa LMS",
    appUrl: "http://localhost:5173",
    companyName: "Furukawa Minda Electric Pvt. Ltd.",
    companyAddress: "",
    companyPhone: "",
    adminEmail: "admin@example.com",
    fromEmail: "",
    fromName: "Furukawa Minda",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpUsername: "",
    smtpPassword: "",
    smtpEncryption: "tls",
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    passwordRequireSpecial: true,
    passwordRequireNumbers: true,
    passwordRequireUppercase: true,
    maxFileUploadSize: 10,
    allowedFileTypes: "jpg,jpeg,png,pdf,doc,docx,txt",
    backupRetention: 30,
    autoBackup: true,
    maintenanceMode: false,
    logLevel: "info",
    emailNotifications: true,
    notificationRetention: 90,
    maxConcurrentUsers: 1000,
    timeFormat: "24h"
};

/**
 * Reads persistent system settings from disk
 */
export function readSystemSettingsStore() {
    try {
        if (fs.existsSync(SYSTEM_SETTINGS_STORE_PATH)) {
            const raw = fs.readFileSync(SYSTEM_SETTINGS_STORE_PATH, "utf-8");
            const data = JSON.parse(raw);
            return { ...DEFAULT_SYSTEM_SETTINGS, ...data };
        }
    } catch (e) {
        logger.warn(`Failed reading system settings store: ${e.message}`);
    }
    return { ...DEFAULT_SYSTEM_SETTINGS };
}

/**
 * Writes persistent system settings to disk
 */
export function writeSystemSettingsStore(data) {
    try {
        const dir = path.dirname(SYSTEM_SETTINGS_STORE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const merged = { ...DEFAULT_SYSTEM_SETTINGS, ...data, updatedAt: new Date().toISOString() };
        fs.writeFileSync(SYSTEM_SETTINGS_STORE_PATH, JSON.stringify(merged, null, 2), "utf-8");
        return merged;
    } catch (e) {
        logger.error(`Failed writing system settings store: ${e.message}`);
        return data;
    }
}

/**
 * Updates persistent system settings with partial data
 */
export function updateSystemSettingsStore(partialData) {
    const current = readSystemSettingsStore();
    const updated = { ...current, ...partialData };
    return writeSystemSettingsStore(updated);
}
