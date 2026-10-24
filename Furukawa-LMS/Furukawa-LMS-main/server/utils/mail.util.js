import nodemailer from "nodemailer";
import ENV from "../configs/env.config.js";
import logger from "../logger/winston.logger.js";
import { readSystemSettingsStore } from "../db/systemSettingsStore.js";

const readStoredSmtpSettings = async () => {
    // 1. Try database if connected
    try {
        const { executeQuery } = await import("../db/mssqlHelper.js");
        const [rowsWithCreds] = await executeQuery(
            "SELECT TOP 1 smtpHost, smtpPort, smtpUsername, smtpPassword, smtpEncryption, fromEmail, fromName FROM system_settings WHERE smtpUsername IS NOT NULL AND LTRIM(RTRIM(smtpUsername)) <> '' ORDER BY id DESC"
        );
        if (rowsWithCreds && rowsWithCreds.length > 0 && rowsWithCreds[0]?.smtpUsername) {
            return rowsWithCreds[0];
        }
        const [fallbackRows] = await executeQuery(
            "SELECT TOP 1 smtpHost, smtpPort, smtpUsername, smtpPassword, smtpEncryption, fromEmail, fromName FROM system_settings ORDER BY id DESC"
        );
        if (fallbackRows && fallbackRows.length > 0 && fallbackRows[0]?.smtpUsername) {
            return fallbackRows[0];
        }
    } catch (error) {
        logger.warn(`[MAIL] Could not load stored SMTP settings from database code=${error?.code || "unknown"}`);
    }

    // 2. Try persistent file store fallback
    try {
        const fileStore = readSystemSettingsStore();
        if (fileStore && (fileStore.smtpUsername || fileStore.smtpHost)) {
            return {
                smtpHost: fileStore.smtpHost,
                smtpPort: fileStore.smtpPort,
                smtpUsername: fileStore.smtpUsername,
                smtpPassword: fileStore.smtpPassword,
                smtpEncryption: fileStore.smtpEncryption,
                fromEmail: fileStore.fromEmail,
                fromName: fileStore.fromName
            };
        }
    } catch (error) {
        logger.warn(`[MAIL] Could not load stored SMTP settings from file store: ${error?.message}`);
    }

    return {};
};

export const createMailSender = ({ env = ENV, createTransport = nodemailer.createTransport, log = logger, getSettings = readStoredSmtpSettings } = {}) => async function (email, subject, message, attachments = [], cc = "") {
    const settings = await getSettings();
    const username = (settings.smtpUsername && String(settings.smtpUsername).trim()) || (env.SMTP_USERNAME && String(env.SMTP_USERNAME).trim()) || "";
    const password = (settings.smtpPassword && String(settings.smtpPassword).trim()) || (env.SMTP_PASSWORD && String(env.SMTP_PASSWORD).trim()) || "";
    const host = (settings.smtpHost && String(settings.smtpHost).trim()) || env.SMTP_HOST || 'smtp.office365.com';
    const port = Number(settings.smtpPort || env.SMTP_PORT || 587);
    const encryption = String(settings.smtpEncryption || "tls").toLowerCase();
    const fromEmail = (settings.fromEmail && String(settings.fromEmail).trim()) || username;
    const fromName = (settings.fromName && String(settings.fromName).trim()) || "Furukawa Minda";

    const isTest = Boolean(process.env.NODE_TEST_CONTEXT || env.NODE_ENV === "test");
    const isDev = (env.NODE_ENV === "development" || process.env.NODE_ENV === "development") && !isTest;

    if (!username || !password || !fromEmail) {
        if (isDev && env.SIMULATE_DEV_EMAIL !== "false") {
            const recipients = Array.isArray(email) ? email : String(email).split(/[,;\s]+/).filter(Boolean);
            const ccRecipients = cc ? (Array.isArray(cc) ? cc : String(cc).split(/[,;\s]+/).filter(Boolean)) : [];
            log.info(`[MAIL] [DEV_SIMULATION] Simulated email delivery to=${recipients.join(",")} cc=${ccRecipients.join(",")} subject="${subject}"`);
            return {
                accepted: recipients,
                rejected: [],
                response: "250 2.0.0 OK (Dev simulated)",
                messageId: `<dev-${Date.now()}@furukawaminda.local>`
            };
        }
        const error = new Error("Email service is not configured.");
        error.code = "SMTP_NOT_CONFIGURED";
        throw error;
    }

    const transporter = createTransport({
        host,
        port,
        secure: encryption === "ssl" || port === 465,
        requireTLS: encryption === "tls" && port !== 465,
        auth: {
            user: username,
            pass: password,
        },
        tls: { minVersion: "TLSv1.2" },
    });
    const mailOptions = {
        from: `${fromName} <${fromEmail}>`,
        to: email,
        ...(cc ? { cc } : {}),
        subject: subject,
        html: message,
    };

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        mailOptions.attachments = attachments;
    }

    try {
        return await transporter.sendMail(mailOptions);
    } catch (error) {
        log.error(`[MAIL] SMTP send failed code=${error?.code || "unknown"} responseCode=${error?.responseCode || "unknown"} command=${error?.command || "unknown"}`);
        throw error;
    } finally {
        if (typeof transporter.close === "function") {
            transporter.close();
        }
    }
};

const sendMail = createMailSender();

export default sendMail;
