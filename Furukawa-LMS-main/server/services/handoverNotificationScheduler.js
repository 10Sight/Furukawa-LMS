import cron from 'node-cron';
import { executeQuery } from '../db/mssqlHelper.js';
import sendMail from '../utils/mail.util.js';
import { generateHandoverApprovalRequestEmail } from '../utils/emailTemplates.js';
import logger from '../logger/winston.logger.js';
import ENV from '../configs/env.config.js';

class HandoverNotificationScheduler {
    constructor() {
        this.job = null;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;

        // Run every minute to match configured scheduledTime values
        this.job = cron.schedule('* * * * *', async () => {
            await this._checkAndSend();
        }, {
            scheduled: true,
            timezone: "Asia/Kolkata"
        });

        this.isInitialized = true;
        logger.info('[HandoverNotificationScheduler] Initialized — checking every minute for scheduled handover notifications.');
    }

    stop() {
        if (this.job) {
            this.job.stop();
            this.job.destroy();
            this.job = null;
        }
        this.isInitialized = false;
        logger.info('[HandoverNotificationScheduler] Stopped.');
    }

    _getISTTime() {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + istOffset);
        return {
            currentTime: `${String(istNow.getUTCHours()).padStart(2, '0')}:${String(istNow.getUTCMinutes()).padStart(2, '0')}`,
            today: istNow.toISOString().split('T')[0]
        };
    }

    async _checkAndSend() {
        try {
            const { currentTime, today } = this._getISTTime();
            logger.info(`[HandoverNotificationScheduler] Tick — IST time: ${currentTime}, date: ${today}`);

            const configs = await executeQuery(`
                SELECT ec.*, d.name AS departmentName
                FROM email_configurations ec
                LEFT JOIN departments d ON ec.departmentId = d.id
                WHERE ec.formName = 'Handover Sheet'
                  AND ec.isActive = 1
                  AND ec.scheduledTime = ?
                  AND ec.toEmails IS NOT NULL
                  AND ec.departmentId IS NOT NULL
            `, [currentTime]);

            const rows = Array.isArray(configs) ? (Array.isArray(configs[0]) ? configs[0] : configs) : [];

            if (rows.length === 0) {
                logger.info(`[HandoverNotificationScheduler] No config scheduled for ${currentTime}.`);
                return;
            }

            logger.info(`[HandoverNotificationScheduler] Time ${currentTime} — found ${rows.length} config(s) to process.`);

            for (const config of rows) {
                await this._sendPendingNotifications(config, today);
            }
        } catch (error) {
            logger.error(`[HandoverNotificationScheduler] Error in _checkAndSend: ${error.message}`, error);
        }
    }

    // Called from the API to immediately process all active Handover Sheet configs (ignores scheduledTime)
    async runNow() {
        const { today } = this._getISTTime();
        const results = [];

        try {
            const [configs] = await executeQuery(`
                SELECT ec.*, d.name AS departmentName
                FROM email_configurations ec
                LEFT JOIN departments d ON ec.departmentId = d.id
                WHERE ec.formName = 'Handover Sheet'
                  AND ec.isActive = 1
                  AND ec.toEmails IS NOT NULL
                  AND ec.departmentId IS NOT NULL
            `, []);

            if (!configs || configs.length === 0) {
                return { ok: false, message: 'No active Handover Sheet email configs found in the database.', results };
            }

            for (const config of configs) {
                const result = await this._sendPendingNotifications(config, today, true);
                results.push({ departmentId: config.departmentId, departmentName: config.departmentName, scheduledTime: config.scheduledTime, toEmails: config.toEmails, ...result });
            }

            return { ok: true, today, configsFound: configs.length, results };
        } catch (error) {
            logger.error(`[HandoverNotificationScheduler] runNow error: ${error.message}`, error);
            return { ok: false, message: error.message, results };
        }
    }

    async _sendPendingNotifications(config, today, returnReport = false) {
        const report = { sheetFound: false, totalEntries: 0, pendingEntries: 0, emailsSent: [], errors: [] };
        try {
            const [sheets] = await executeQuery(`
                SELECT entries FROM handover_sheets
                WHERE departmentId = ?
                  AND CAST([date] AS DATE) = CAST(? AS DATE)
            `, [config.departmentId, today]);

            if (!sheets || sheets.length === 0) {
                logger.info(`[HandoverNotificationScheduler] No handover sheet found for dept ${config.departmentId} on ${today}.`);
                return returnReport ? { ...report, message: `No handover sheet found for dept ${config.departmentId} on ${today}` } : undefined;
            }

            report.sheetFound = true;

            let entries = [];
            try {
                entries = JSON.parse(sheets[0].entries || '[]');
            } catch (e) {
                const msg = `Failed to parse entries for dept ${config.departmentId}: ${e.message}`;
                logger.error(`[HandoverNotificationScheduler] ${msg}`);
                return returnReport ? { ...report, message: msg } : undefined;
            }

            report.totalEntries = entries.length;

            const pendingEntries = entries.filter(e =>
                e.employeeName &&
                (!e.interviewStatus || e.interviewStatus === 'pending')
            );

            report.pendingEntries = pendingEntries.length;

            if (pendingEntries.length === 0) {
                logger.info(`[HandoverNotificationScheduler] No pending entries for dept ${config.departmentId} on ${today}.`);
                return returnReport ? { ...report, message: 'No pending entries found' } : undefined;
            }

            logger.info(`[HandoverNotificationScheduler] Sending ${pendingEntries.length} notification(s) for dept ${config.departmentId} (${config.departmentName}).`);

            const adminUrl = ENV.ADMIN_URL || 'http://localhost:5173';
            const portalUrl = `${adminUrl}/admin/handover-sheet?dept=${config.departmentId}`;

            const toList = config.toEmails.split(',').map(e => e.trim()).filter(Boolean);
            const ccList = config.ccEmails ? config.ccEmails.split(',').map(e => e.trim()).filter(Boolean) : [];

            for (const entry of pendingEntries) {
                try {
                    const html = generateHandoverApprovalRequestEmail({
                        userName: entry.employeeName,
                        empCode: entry.empCode || '',
                        departmentName: config.departmentName || 'Department',
                        marks: entry.marks || '',
                        process: entry.process || '',
                        date: today,
                        portalUrl
                    });

                    await sendMail(
                        toList.join(','),
                        `Action Required — Handover Approval for ${entry.employeeName}`,
                        html,
                        [],
                        ccList.join(',')
                    );

                    logger.info(`[HandoverNotificationScheduler] Email sent for ${entry.employeeName} → ${toList.join(', ')}`);
                    report.emailsSent.push(entry.employeeName);
                } catch (mailErr) {
                    logger.error(`[HandoverNotificationScheduler] Failed to send email for ${entry.employeeName}: ${mailErr.message}`);
                    report.errors.push(`${entry.employeeName}: ${mailErr.message}`);
                }
            }
        } catch (error) {
            logger.error(`[HandoverNotificationScheduler] Error in _sendPendingNotifications for dept ${config.departmentId}: ${error.message}`, error);
            report.errors.push(error.message);
        }
        return returnReport ? report : undefined;
    }
}

export default new HandoverNotificationScheduler();
