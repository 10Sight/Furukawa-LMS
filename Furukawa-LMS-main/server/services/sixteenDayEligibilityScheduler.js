import cron from 'node-cron';
import { executeQuery } from '../db/mssqlHelper.js';
import sendMail from '../utils/mail.util.js';
import { generateSixteenDayMonitoringEligibleEmail } from '../utils/emailTemplates.js';
import logger from '../logger/winston.logger.js';
import ENV from '../configs/env.config.js';
import SixteenDayEligibilityNotification from '../models/sixteenDayEligibilityNotification.model.js';

const ELIGIBILITY_WINDOW_MS = 24 * 60 * 60 * 1000;

class SixteenDayEligibilityScheduler {
    constructor() {
        this.job = null;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;

        // Elapsed-time based (not time-of-day), so a coarser interval than the
        // once-a-minute reminder schedulers is enough to catch newly-unlocked candidates.
        this.job = cron.schedule('*/5 * * * *', async () => {
            await this._checkAndSend();
        }, {
            scheduled: true,
            timezone: "Asia/Kolkata"
        });

        this.isInitialized = true;
        logger.info('[SixteenDayEligibilityScheduler] Initialized — checking every 5 minutes for newly-eligible 16-Day Monitoring candidates.');
    }

    stop() {
        if (this.job) {
            this.job.stop();
            this.job.destroy();
            this.job = null;
        }
        this.isInitialized = false;
        logger.info('[SixteenDayEligibilityScheduler] Stopped.');
    }

    async _checkAndSend() {
        try {
            const [configs] = await executeQuery(`
                SELECT ec.*, d.name AS departmentName
                FROM email_configurations ec
                LEFT JOIN departments d ON ec.departmentId = d.id
                WHERE ec.formName = '16-Day Monitoring Sheet'
                  AND ec.isActive = 1
                  AND ec.toEmails IS NOT NULL
                  AND ec.departmentId IS NOT NULL
            `);

            if (!configs || configs.length === 0) {
                return;
            }

            for (const config of configs) {
                await this._notifyNewlyEligible(config);
            }
        } catch (error) {
            logger.error(`[SixteenDayEligibilityScheduler] Error in _checkAndSend: ${error.message}`, error);
        }
    }

    // Called from the API to immediately process all active 16-Day Monitoring Sheet configs
    async runNow() {
        const results = [];
        try {
            const [configs] = await executeQuery(`
                SELECT ec.*, d.name AS departmentName
                FROM email_configurations ec
                LEFT JOIN departments d ON ec.departmentId = d.id
                WHERE ec.formName = '16-Day Monitoring Sheet'
                  AND ec.isActive = 1
                  AND ec.toEmails IS NOT NULL
                  AND ec.departmentId IS NOT NULL
            `);

            if (!configs || configs.length === 0) {
                return { ok: false, message: 'No active 16-Day Monitoring Sheet email configs found in the database.', results };
            }

            for (const config of configs) {
                const result = await this._notifyNewlyEligible(config, true);
                results.push({
                    departmentId: config.departmentId,
                    departmentName: config.departmentName,
                    toEmails: config.toEmails,
                    ...result
                });
            }

            return { ok: true, configsFound: configs.length, results };
        } catch (error) {
            logger.error(`[SixteenDayEligibilityScheduler] runNow error: ${error.message}`, error);
            return { ok: false, message: error.message, results };
        }
    }

    async _notifyNewlyEligible(config, returnReport = false) {
        const report = { candidatesFound: 0, emailsSent: [], errors: [] };
        try {
            // Approved-but-not-yet-started candidates in this department (and section, if configured)
            // who haven't already been notified for this specific approval.
            let query = `
                SELECT u.id AS studentId, u.fullName, u.empId, u.departmentId, u.sectionId, ho.handoverApprovedAt
                FROM users u
                CROSS APPLY (
                    SELECT TOP 1 JSON_VALUE(entry.value, '$.statusActionAt') as handoverApprovedAt
                    FROM handover_sheets hs
                    CROSS APPLY OPENJSON(hs.entries) as entry
                    WHERE TRY_CAST(JSON_VALUE(entry.value, '$.studentId') AS INT) = u.id
                      AND JSON_VALUE(entry.value, '$.interviewStatus') = 'APPROVE'
                    ORDER BY hs.createdAt DESC
                ) ho
                WHERE u.departmentId = ?
                  AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
                  AND (u.status IS NULL OR u.status != 'LEFT')
                  AND (u.role = 'STUDENT' OR u.isEmployee = 1)
                  AND ho.handoverApprovedAt IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM sixteen_day_monitorings m WHERE m.studentId = u.id)
                  AND NOT EXISTS (
                      SELECT 1 FROM sixteen_day_eligibility_notifications n
                      WHERE n.studentId = u.id AND n.handoverApprovedAt = ho.handoverApprovedAt
                  )
            `;
            const params = [config.departmentId];

            if (config.sectionId) {
                query += " AND u.sectionId = ?";
                params.push(config.sectionId);
            }

            const [candidates] = await executeQuery(query, params);

            if (!candidates || candidates.length === 0) {
                return returnReport ? { ...report, message: 'No newly-eligible candidates found' } : undefined;
            }

            const eligibleNow = candidates.filter(c =>
                Date.now() >= new Date(c.handoverApprovedAt).getTime() + ELIGIBILITY_WINDOW_MS
            );

            if (eligibleNow.length === 0) {
                return returnReport ? { ...report, message: 'No candidates have crossed the 24h mark yet' } : undefined;
            }

            report.candidatesFound = eligibleNow.length;
            logger.info(`[SixteenDayEligibilityScheduler] Found ${eligibleNow.length} newly-eligible candidate(s) for department ${config.departmentId}.`);

            let to = config.toEmails || "";
            let cc = config.ccEmails || "";

            if (config.includeTrainer && config.departmentId) {
                const [trainers] = await executeQuery(
                    "SELECT email FROM users WHERE departmentId = ? AND (isTrainer = 1 OR role = 'INSTRUCTOR')",
                    [config.departmentId]
                );
                const trainerEmails = trainers.map(t => t.email).filter(e => e).join(", ");
                if (trainerEmails) {
                    to = to ? `${to}, ${trainerEmails}` : trainerEmails;
                }
            }

            if (!to) {
                const msg = `No recipients resolved for department ${config.departmentId}.`;
                logger.error(`[SixteenDayEligibilityScheduler] ${msg}`);
                report.errors.push(msg);
                return returnReport ? report : undefined;
            }

            const adminUrl = ENV.ADMIN_URL || 'http://localhost:5173';

            for (const candidate of eligibleNow) {
                try {
                    const portalUrl = `${adminUrl}/admin/16-day-monitoring/${candidate.studentId}`;

                    const html = generateSixteenDayMonitoringEligibleEmail({
                        operatorName: candidate.fullName,
                        employeeCode: candidate.empId,
                        departmentName: config.departmentName || "N/A",
                        handoverApprovedAt: candidate.handoverApprovedAt,
                        portalUrl
                    });

                    await sendMail(
                        to,
                        `Now Eligible — 16-Day Monitoring for ${candidate.fullName}`,
                        html,
                        [],
                        cc
                    );

                    await SixteenDayEligibilityNotification.markNotified(candidate.studentId, candidate.handoverApprovedAt);

                    logger.info(`[SixteenDayEligibilityScheduler] Email sent for student ${candidate.studentId} → ${to}`);
                    report.emailsSent.push(candidate.fullName);
                } catch (mailErr) {
                    const errorMsg = `Failed to notify for student ${candidate.studentId}: ${mailErr.message}`;
                    logger.error(`[SixteenDayEligibilityScheduler] ${errorMsg}`);
                    report.errors.push(errorMsg);
                }
            }
        } catch (error) {
            logger.error(`[SixteenDayEligibilityScheduler] Error in _notifyNewlyEligible for department ${config.departmentId}: ${error.message}`, error);
            report.errors.push(error.message);
        }

        return returnReport ? report : undefined;
    }
}

export default new SixteenDayEligibilityScheduler();
