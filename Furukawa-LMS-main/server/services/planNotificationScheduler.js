import cron from 'node-cron';
import ExcelJS from 'exceljs';
import { executeQuery } from '../db/mssqlHelper.js';
import sendMail from '../utils/mail.util.js';
import { generatePlanUpdationWarningEmail } from '../utils/emailTemplates.js';
import NotificationService from './notification.service.js';
import logger from '../logger/winston.logger.js';
import ENV from '../configs/env.config.js';

const QUARTERS = [
    { key: 'q1', label: 'Jan – Mar', dateKey: 'q1Date', actualKey: 'q1DateActual', statusKey: 'q1Status', skillKey: 'q1Skill' },
    { key: 'q2', label: 'Apr – Jun', dateKey: 'q2Date', actualKey: 'q2DateActual', statusKey: 'q2Status', skillKey: 'q2Skill' },
    { key: 'q3', label: 'Jul – Sep', dateKey: 'q3Date', actualKey: 'q3DateActual', statusKey: 'q3Status', skillKey: 'q3Skill' },
    { key: 'q4', label: 'Oct – Dec', dateKey: 'q4Date', actualKey: 'q4DateActual', statusKey: 'q4Status', skillKey: 'q4Skill' },
];

class PlanNotificationScheduler {
    constructor() {
        this.job = null;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;

        this.job = cron.schedule('* * * * *', async () => {
            await this._tick();
        }, {
            scheduled: true,
            timezone: 'Asia/Kolkata'
        });

        this.isInitialized = true;
        logger.info('[PlanNotificationScheduler] Initialized — checking every minute for plan date notifications.');
    }

    stop() {
        if (this.job) {
            this.job.stop();
            this.job.destroy();
            this.job = null;
        }
        this.isInitialized = false;
        logger.info('[PlanNotificationScheduler] Stopped.');
    }

    _getISTTime() {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + istOffset);
        return {
            currentTime: `${String(istNow.getUTCHours()).padStart(2, '0')}:${String(istNow.getUTCMinutes()).padStart(2, '0')}`,
            today: istNow.toISOString().split('T')[0],
            currentYear: istNow.getUTCFullYear(),
        };
    }

    async _tick() {
        try {
            const { currentTime, today, currentYear } = this._getISTTime();
            logger.info(`[PlanNotificationScheduler] Tick — IST: ${currentTime}, date: ${today}`);

            const [configs] = await executeQuery(`
                SELECT ec.*, d.name AS departmentName, s.name AS sectionName
                FROM email_configurations ec
                LEFT JOIN departments d ON ec.departmentId = d.id
                LEFT JOIN sections s ON ec.sectionId = s.id
                WHERE ec.formName IN ('Multi Skill Sheet', 'Skill Upgradation Sheet')
                  AND ec.isActive = 1
                  AND ec.scheduledTime = ?
                  AND ec.toEmails IS NOT NULL
                  AND ec.departmentId IS NOT NULL
            `, [currentTime]);

            if (!configs || configs.length === 0) {
                logger.info(`[PlanNotificationScheduler] No configs scheduled for ${currentTime}.`);
                return;
            }

            logger.info(`[PlanNotificationScheduler] ${configs.length} config(s) matched for ${currentTime}.`);

            for (const config of configs) {
                await this._processConfig(config, today, currentYear);
            }
        } catch (err) {
            logger.error(`[PlanNotificationScheduler] Error in _tick: ${err.message}`, err);
        }
    }

    async _processConfig(config, today, currentYear) {
        try {
            const table = config.formName === 'Multi Skill Sheet'
                ? 'multi_skilling_plans'
                : 'skill_upgradation_plans';

            let query = `SELECT tableData FROM ${table} WHERE departmentId = ? AND year = ?`;
            const params = [config.departmentId, currentYear];

            if (config.sectionId) {
                query += ' AND sectionId = ?';
                params.push(config.sectionId);
            }

            const [plans] = await executeQuery(query, params);

            if (!plans || plans.length === 0) {
                logger.info(`[PlanNotificationScheduler] No ${config.formName} plan for dept ${config.departmentId}, year ${currentYear}.`);
                return;
            }

            const dueRows = [];
            const dueUserIds = new Set();
            const mergedTableData = {};

            for (const plan of plans) {
                let tableData = {};
                try {
                    tableData = typeof plan.tableData === 'string'
                        ? JSON.parse(plan.tableData)
                        : (plan.tableData || {});
                } catch (e) {
                    logger.error(`[PlanNotificationScheduler] tableData parse error for dept ${config.departmentId}: ${e.message}`);
                    continue;
                }

                Object.assign(mergedTableData, tableData);

                for (const [userId, row] of Object.entries(tableData)) {
                    // Skip internal metadata key and blank/empty rows
                    if (userId === '__removedUserIds') continue;
                    if (!row || typeof row !== 'object') continue;
                    if (!row.userName && !row.cardNo) continue;

                    for (const q of QUARTERS) {
                        const plannedDate = row[q.dateKey];
                        const actualDate = row[q.actualKey];
                        const status = (row[q.statusKey] || '').toLowerCase();

                        if (!plannedDate || plannedDate !== today) continue;
                        if (actualDate) continue;
                        if (status === 'completed') continue;

                        dueUserIds.add(userId);
                        dueRows.push({
                            userId,
                            userName: row.userName || '—',
                            cardNo: row.cardNo || '—',
                            // Skill Upgradation Plan stores Shift per-quarter (q1Shift, q2Shift,
                            // ...); older saved plans only have a row-level shift, hence the fallback.
                            shift: row[`${q.key}Shift`] || row.shift || '—',
                            // Multi-Skilling Plan stores Model & Line / Station per-quarter
                            // (q1ModelLine, q2ModelLine, ...); Skill Upgradation Plan still
                            // stores a single row-level modelLine/station, hence the fallback.
                            modelLine: row[`${q.key}ModelLine`] || row.modelLine || '—',
                            station: row[`${q.key}Station`] || row.station || '—',
                            quarter: q.label,
                            targetSkill: row[q.skillKey] || '—',
                            plannedDate,
                        });
                    }
                }
            }

            if (dueRows.length === 0) {
                logger.info(`[PlanNotificationScheduler] No due rows for dept ${config.departmentId} on ${today}.`);
                return;
            }

            logger.info(`[PlanNotificationScheduler] ${dueRows.length} due row(s) for dept ${config.departmentId} (${config.departmentName}) — sending email.`);

            // Resolve each due associate's email so it can be shown alongside their name in the mail
            const numericUserIds = [...dueUserIds].map(id => parseInt(id)).filter(id => !isNaN(id));
            if (numericUserIds.length > 0) {
                try {
                    const [userRows] = await executeQuery(
                        "SELECT id, email FROM users WHERE id IN (?)",
                        [numericUserIds]
                    );
                    const emailByUserId = new Map(userRows.map(u => [String(u.id), u.email]));
                    dueRows.forEach(row => {
                        row.email = emailByUserId.get(String(row.userId)) || '';
                    });
                } catch (e) {
                    logger.error(`[PlanNotificationScheduler] Failed to resolve associate emails: ${e.message}`);
                }
            }

            let toEmails = config.toEmails || '';
            const ccEmails = config.ccEmails || '';

            if (config.includeTrainer && config.departmentId) {
                const [trainers] = await executeQuery(
                    "SELECT email FROM users WHERE departmentId = ? AND (isTrainer = 1 OR role = 'INSTRUCTOR')",
                    [config.departmentId]
                );
                const trainerEmails = trainers.map(t => t.email).filter(Boolean).join(', ');
                if (trainerEmails) {
                    toEmails = toEmails ? `${toEmails}, ${trainerEmails}` : trainerEmails;
                }
            }

            if (!toEmails) {
                logger.warn(`[PlanNotificationScheduler] No recipients resolved for dept ${config.departmentId}. Skipping.`);
                return;
            }

            const adminUrl = ENV.ADMIN_URL || 'http://localhost:5174';
            const portalUrl = config.formName === 'Multi Skill Sheet'
                ? `${adminUrl}/admin/multi-skilling`
                : `${adminUrl}/admin/skill-matrix`;

            const html = generatePlanUpdationWarningEmail({
                formName: config.formName,
                departmentName: config.departmentName || 'Department',
                sectionName: config.sectionName || null,
                date: today,
                dueRows,
                portalUrl,
            });

            let attachments = [];
            try {
                const workbook = new ExcelJS.Workbook();
                const filename = await NotificationService._generateExcel(
                    workbook,
                    config.formName,
                    config.departmentId,
                    { year: currentYear, tableData: mergedTableData, selectedLines: [] },
                    dueUserIds
                );
                const buffer = await workbook.xlsx.writeBuffer();
                attachments = [{ filename, content: buffer }];
            } catch (e) {
                logger.error(`[PlanNotificationScheduler] Failed to generate excel attachment for dept ${config.departmentId}: ${e.message}`);
            }

            await sendMail(
                toEmails,
                `Plan Date Due Today — ${config.formName} (${config.departmentName || 'Dept'})`,
                html,
                attachments,
                ccEmails
            );

            logger.info(`[PlanNotificationScheduler] Email sent to ${toEmails}`);
        } catch (err) {
            logger.error(`[PlanNotificationScheduler] Error processing config for dept ${config.departmentId}: ${err.message}`, err);
        }
    }
}

export default new PlanNotificationScheduler();
