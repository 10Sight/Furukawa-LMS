import nodemailer from "nodemailer";
import ENV from "../configs/env.config.js";
import logger from "../logger/winston.logger.js";

const readStoredSmtpSettings = async () => {
    try {
        const { executeQuery } = await import("../db/mssqlHelper.js");
        const [rows] = await executeQuery("SELECT TOP 1 smtpHost, smtpPort, smtpUsername, smtpPassword, smtpEncryption, fromEmail, fromName FROM system_settings ORDER BY id ASC");
        return rows?.[0] || {};
    } catch (error) {
        logger.warn(`[MAIL] Could not load stored SMTP settings code=${error?.code || "unknown"}; using environment settings`);
        return {};
    }
};

export const createMailSender = ({ env = ENV, createTransport = nodemailer.createTransport, log = logger, getSettings = readStoredSmtpSettings } = {}) => async function (email, subject, message, attachments = [], cc = "") {
    const settings = await getSettings();
    const username = settings.smtpUsername || env.SMTP_USERNAME;
    const password = settings.smtpPassword || env.SMTP_PASSWORD;
    const host = settings.smtpHost || env.SMTP_HOST || 'smtp.office365.com';
    const port = Number(settings.smtpPort || env.SMTP_PORT || 587);
    const encryption = String(settings.smtpEncryption || "tls").toLowerCase();
    const fromEmail = settings.fromEmail || username;
    const fromName = settings.fromName || "Furukawa Minda";

    if (!username || !password || !fromEmail) {
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
        transporter.close();
    }
};

const sendMail = createMailSender();

export default sendMail;
