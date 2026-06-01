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

    async _checkAndSend() {
        try {
            const now = new Date();
            // Use IST (UTC+5:30) to match the cron timezone and stored scheduledTime values
            const istOffset = 5.5 * 60 * 60 * 1000;
            const istNow = new Date(now.getTime() + istOffset);
            const currentTime = `${String(istNow.getUTCHours()).padStart(2, '0')}:${String(istNow.getUTCMinutes()).padStart(2, '0')}`;
            const today = istNow.toISOString().split('T')[0]; // YYYY-MM-DD in IST

            // Find all Handover Sheet configs whose scheduledTime matches right now
            const [configs] = await executeQuery(`
                SELECT ec.*, d.name AS departmentName
                FROM email_configurations ec
                LEFT JOIN departments d ON ec.departmentId = d.id
                WHERE ec.formName = 'Handover Sheet'
                  AND ec.isActive = 1
                  AND ec.scheduledTime = ?
                  AND ec.toEmails IS NOT NULL
                  AND ec.departmentId IS NOT NULL
            `, [currentTime]);

            if (!configs || configs.length === 0) return;

            logger.info(`[HandoverNotificationScheduler] Time ${currentTime} — found ${configs.length} config(s) to process.`);

            for (const config of configs) {
                await this._sendPendingNotifications(config, today);
            }
        } catch (error) {
            logger.error(`[HandoverNotificationScheduler] Error in _checkAndSend: ${error.message}`, error);
        }
    }

    async _sendPendingNotifications(config, today) {
        try {
            // Fetch today's handover sheet for this department
            const [sheets] = await executeQuery(`
                SELECT entries FROM handover_sheets
                WHERE departmentId = ?
                  AND CONVERT(DATE, [date]) = ?
            `, [config.departmentId, today]);

            if (!sheets || sheets.length === 0) {
                logger.info(`[HandoverNotificationScheduler] No handover sheet found for dept ${config.departmentId} on ${today}.`);
                return;
            }

            let entries = [];
            try {
                entries = JSON.parse(sheets[0].entries || '[]');
            } catch (e) {
                logger.error(`[HandoverNotificationScheduler] Failed to parse entries for dept ${config.departmentId}: ${e.message}`);
                return;
            }

            // Only pending entries — not yet APPROVE or REJECT
            const pendingEntries = entries.filter(e =>
                e.employeeName &&
                (!e.interviewStatus || e.interviewStatus === '')
            );

            if (pendingEntries.length === 0) {
                logger.info(`[HandoverNotificationScheduler] No pending entries for dept ${config.departmentId} on ${today}.`);
                return;
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
                } catch (mailErr) {
                    logger.error(`[HandoverNotificationScheduler] Failed to send email for ${entry.employeeName}: ${mailErr.message}`);
                }
            }
        } catch (error) {
            logger.error(`[HandoverNotificationScheduler] Error in _sendPendingNotifications for dept ${config.departmentId}: ${error.message}`, error);
        }
    }
}

export default new HandoverNotificationScheduler();
