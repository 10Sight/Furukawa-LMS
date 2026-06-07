import cron from 'node-cron';
import { executeQuery } from '../db/mssqlHelper.js';
import sendMail from '../utils/mail.util.js';
import { generateSixteenDayMonitoringEmail } from '../utils/emailTemplates.js';
import logger from '../logger/winston.logger.js';
import ENV from '../configs/env.config.js';
import MonitoringConfig from '../models/monitoringConfig.model.js';

class SixteenDayMonitoringScheduler {
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
        logger.info('[SixteenDayMonitoringScheduler] Initialized — checking every minute for scheduled 16-Day monitoring notifications.');
    }

    stop() {
        if (this.job) {
            this.job.stop();
            this.job.destroy();
            this.job = null;
        }
        this.isInitialized = false;
        logger.info('[SixteenDayMonitoringScheduler] Stopped.');
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
            const { currentTime } = this._getISTTime();
            logger.info(`[SixteenDayMonitoringScheduler] Tick — IST time: ${currentTime}`);

            const configs = await executeQuery(`
                SELECT ec.*, d.name AS departmentName
                FROM email_configurations ec
                LEFT JOIN departments d ON ec.departmentId = d.id
                WHERE ec.formName = '16-Day Monitoring Sheet'
                  AND ec.isActive = 1
                  AND ec.scheduledTime = ?
                  AND ec.toEmails IS NOT NULL
                  AND ec.departmentId IS NOT NULL
            `, [currentTime]);

            const rows = Array.isArray(configs) ? (Array.isArray(configs[0]) ? configs[0] : configs) : [];

            if (rows.length === 0) {
                return;
            }

            logger.info(`[SixteenDayMonitoringScheduler] Time ${currentTime} — found ${rows.length} 16-day config(s) to process.`);

            for (const config of rows) {
                await this._sendPendingNotifications(config);
            }
        } catch (error) {
            logger.error(`[SixteenDayMonitoringScheduler] Error in _checkAndSend: ${error.message}`, error);
        }
    }

    // Called from the API to immediately process all active 16-Day Monitoring Sheet configs (ignores scheduledTime)
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
            `, []);

            if (!configs || configs.length === 0) {
                return { ok: false, message: 'No active 16-Day Monitoring Sheet email configs found in the database.', results };
            }

            for (const config of configs) {
                const result = await this._sendPendingNotifications(config, true);
                results.push({ 
                    departmentId: config.departmentId, 
                    departmentName: config.departmentName, 
                    scheduledTime: config.scheduledTime, 
                    toEmails: config.toEmails, 
                    ...result 
                });
            }

            return { ok: true, configsFound: configs.length, results };
        } catch (error) {
            logger.error(`[SixteenDayMonitoringScheduler] runNow error: ${error.message}`, error);
            return { ok: false, message: error.message, results };
        }
    }

    async _sendPendingNotifications(config, returnReport = false) {
        const report = { sheetsFound: 0, emailsSent: [], errors: [] };
        try {
            // Find all students in this department (and section if configured) whose LATEST 16-day monitoring is Submitted but not yet approved
            let query = `
                SELECT sdm.*, u.id AS studentId, u.fullName, u.empId
                FROM sixteen_day_monitorings sdm
                JOIN users u ON sdm.studentId = u.id
                WHERE u.departmentId = ?
                  AND sdm.status = 'Submitted'
                  AND (sdm.approvedBy IS NULL OR sdm.approvedBy = '')
            `;
            const params = [config.departmentId];

            if (config.sectionId) {
                query += " AND u.sectionId = ?";
                params.push(config.sectionId);
            }

            const [sheets] = await executeQuery(query, params);

            if (!sheets || sheets.length === 0) {
                logger.info(`[SixteenDayMonitoringScheduler] No pending 16-day sheets for department ${config.departmentId}.`);
                return returnReport ? { ...report, message: 'No pending sheets found' } : undefined;
            }

            report.sheetsFound = sheets.length;
            logger.info(`[SixteenDayMonitoringScheduler] Found ${sheets.length} pending 16-day sheets for department ${config.departmentId}.`);

            // Fetch active layout configuration for 16-day monitoring for this department
            const sectionId = config.sectionId || 0;
            const monitoringConfig = await MonitoringConfig.findByTypeAndDepartment('16DAY', config.departmentId, sectionId);
            const sheetConfig = monitoringConfig?.config || [];

            // Resolve email recipients
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
                logger.error(`[SixteenDayMonitoringScheduler] ${msg}`);
                report.errors.push(msg);
                return returnReport ? report : undefined;
            }

            const adminUrl = ENV.ADMIN_URL || 'http://localhost:5173';

            for (const sheet of sheets) {
                try {
                    const portalUrl = `${adminUrl}/admin/16-day-monitoring/${sheet.studentId}`;
                    
                    let gridDataParsed = {};
                    try {
                        gridDataParsed = typeof sheet.gridData === 'string' ? JSON.parse(sheet.gridData) : (sheet.gridData || {});
                    } catch (e) {
                        logger.error(`[SixteenDayMonitoringScheduler] GridData parsing failed for student ${sheet.studentId}: ${e.message}`);
                    }

                    const html = generateSixteenDayMonitoringEmail({
                        operatorName: sheet.fullName || sheet.employeeName,
                        employeeCode: sheet.empId || sheet.employeeCode,
                        departmentName: config.departmentName || sheet.dept || "N/A",
                        processName: sheet.processName || "N/A",
                        headerInfo: {
                            handoverDate: sheet.handoverDate,
                            checkedBy: sheet.checkedBy,
                            verifiedBy: sheet.verifiedBy,
                            approvedBy: sheet.approvedBy
                        },
                        gridData: gridDataParsed,
                        config: sheetConfig,
                        portalUrl
                    });

                    await sendMail(
                        to,
                        `Pending Approval — 16-Day Monitoring Report: ${sheet.fullName || sheet.employeeName}`,
                        html,
                        [],
                        cc
                    );

                    logger.info(`[SixteenDayMonitoringScheduler] Email sent for student ${sheet.studentId} → ${to}`);
                    report.emailsSent.push(sheet.fullName || sheet.employeeName);
                } catch (mailErr) {
                    const errorMsg = `Failed to send email for student ${sheet.studentId}: ${mailErr.message}`;
                    logger.error(`[SixteenDayMonitoringScheduler] ${errorMsg}`);
                    report.errors.push(`${sheet.studentId}: ${mailErr.message}`);
                }
            }
        } catch (error) {
            logger.error(`[SixteenDayMonitoringScheduler] Error in _sendPendingNotifications for department ${config.departmentId}: ${error.message}`, error);
            report.errors.push(error.message);
        }

        return returnReport ? report : undefined;
    }
}

export default new SixteenDayMonitoringScheduler();
