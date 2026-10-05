import cron from 'node-cron';
import { executeQuery } from '../db/mssqlHelper.js';
import sendMail from '../utils/mail.util.js';
import { generateConsolidatedLeftRequestEmail } from '../utils/emailTemplates.js';
import logger from '../logger/winston.logger.js';
import ENV from '../configs/env.config.js';
import LeftRequest from '../models/leftRequest.model.js';

export const LEFT_REQUEST_FORM_NAME = "Left Request Email";

export const leftRequestPortalUrl = () => `${ENV.ADMIN_URL || 'http://localhost:5173'}/admin/students?tab=left-request`;

// Builds the To/CC list for a Left Request Email config. When includeTrainer is on, trainers of
// every department in `departmentIds` are added to To -- one department for a single request,
// possibly several for a global config's digest.
export const buildLeftRequestRecipients = async (config, departmentIds = []) => {
    let to = config.toEmails || "";
    const cc = config.ccEmails || "";

    const deptIds = [...new Set(departmentIds.filter(Boolean))];
    if (config.includeTrainer && deptIds.length > 0) {
        const [trainers] = await executeQuery(
            `SELECT email FROM users WHERE departmentId IN (${deptIds.map(() => '?').join(',')}) AND (isTrainer = 1 OR role = 'INSTRUCTOR')`,
            deptIds
        );
        const trainerEmails = [...new Set(trainers.map(t => t.email).filter(Boolean))].join(", ");
        if (trainerEmails) to = to ? `${to}, ${trainerEmails}` : trainerEmails;
    }

    if (!to) return null;
    return { to, cc };
};

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

// In-memory mirror of EmailConfiguration.findByFormDeptAndSection's precedence: an exact
// department+section config wins, then a department-wide one, then the global one. Every request
// is owned by exactly one config, so a global and a department schedule never both announce it.
const resolveConfigForRequest = (configs, request) => (
    configs.find(c => c.sectionId != null && sameId(c.sectionId, request.sectionId) && sameId(c.departmentId, request.departmentId))
    || configs.find(c => c.sectionId == null && c.departmentId != null && sameId(c.departmentId, request.departmentId))
    || configs.find(c => c.sectionId == null && c.departmentId == null)
    || null
);

class LeftRequestNotificationScheduler {
    constructor() {
        this.job = null;
        this.isInitialized = false;
        this.isBusy = false;
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
        logger.info('[LeftRequestNotificationScheduler] Initialized — checking every minute for scheduled left request digests.');
    }

    stop() {
        if (this.job) {
            this.job.stop();
            this.job.destroy();
            this.job = null;
        }
        this.isInitialized = false;
        logger.info('[LeftRequestNotificationScheduler] Stopped.');
    }

    _getISTTime() {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + istOffset);
        return `${String(istNow.getUTCHours()).padStart(2, '0')}:${String(istNow.getUTCMinutes()).padStart(2, '0')}`;
    }

    async _loadConfigs() {
        const [rows] = await executeQuery(`
            SELECT ec.*, d.name AS departmentName, s.name AS sectionName
            FROM email_configurations ec
            LEFT JOIN departments d ON ec.departmentId = d.id
            LEFT JOIN sections s ON ec.sectionId = s.id
            WHERE ec.formName = ? AND ec.isActive = 1
            ORDER BY ec.id ASC
        `, [LEFT_REQUEST_FORM_NAME]);
        return rows || [];
    }

    async _checkAndSend() {
        if (this.isBusy) return;
        this.isBusy = true;

        try {
            const currentTime = this._getISTTime();
            const configs = await this._loadConfigs();
            const dueConfigIds = new Set(configs.filter(c => c.scheduledTime === currentTime).map(c => c.id));
            if (dueConfigIds.size === 0) return;

            logger.info(`[LeftRequestNotificationScheduler] Time ${currentTime} — ${dueConfigIds.size} left request digest config(s) due.`);
            await this._processConfigs(configs, dueConfigIds);
        } catch (error) {
            logger.error(`[LeftRequestNotificationScheduler] Error in _checkAndSend: ${error.message}`, error);
        } finally {
            this.isBusy = false;
        }
    }

    // Called from the API to immediately send the digest for every scheduled Left Request Email
    // config, ignoring the time of day. The scheduled run still sends its own digest later.
    async runNow() {
        if (this.isBusy) {
            return { ok: false, message: 'A left request digest run is already in progress. Try again shortly.', results: [] };
        }
        this.isBusy = true;
        try {
            const configs = await this._loadConfigs();
            const scheduled = configs.filter(c => c.scheduledTime);
            if (scheduled.length === 0) {
                return { ok: false, message: 'No active Left Request Email configs with a scheduled time found.', results: [] };
            }
            const results = await this._processConfigs(configs, new Set(scheduled.map(c => c.id)));
            return { ok: true, configsFound: scheduled.length, results };
        } catch (error) {
            logger.error(`[LeftRequestNotificationScheduler] runNow error: ${error.message}`, error);
            return { ok: false, message: error.message, results: [] };
        } finally {
            this.isBusy = false;
        }
    }

    // Groups every pending request under the config that owns it, then sends one digest per due
    // config. Pending requests are re-sent every day until they are reviewed.
    async _processConfigs(configs, dueConfigIds) {
        const pending = await LeftRequest.findPendingForNotification();
        const byConfig = new Map();
        for (const request of pending) {
            const config = resolveConfigForRequest(configs, request);
            if (!config || !dueConfigIds.has(config.id)) continue;
            if (!byConfig.has(config.id)) byConfig.set(config.id, []);
            byConfig.get(config.id).push(request);
        }

        const results = [];
        for (const config of configs.filter(c => dueConfigIds.has(c.id))) {
            const result = await this._sendDigest(config, byConfig.get(config.id) || []);
            results.push({
                configId: config.id,
                departmentName: config.departmentName || 'All Departments',
                sectionName: config.sectionName || null,
                scheduledTime: config.scheduledTime,
                ...result,
            });
        }
        return results;
    }

    async _sendDigest(config, requests) {
        const scope = `config ${config.id} (${config.departmentName || 'Global'}${config.sectionName ? ` / ${config.sectionName}` : ''})`;
        if (requests.length === 0) {
            logger.info(`[LeftRequestNotificationScheduler] No pending left requests for ${scope}.`);
            return { requestsFound: 0, sent: false, message: 'No pending left requests' };
        }

        try {
            const recipients = await buildLeftRequestRecipients(config, requests.map(r => r.departmentId));
            if (!recipients) {
                logger.error(`[LeftRequestNotificationScheduler] No recipients resolved for ${scope}; ${requests.length} pending request(s) not sent.`);
                return { requestsFound: requests.length, sent: false, message: 'No recipients resolved' };
            }

            const html = generateConsolidatedLeftRequestEmail({
                requests,
                departmentName: config.departmentName,
                sectionName: config.sectionName,
                portalUrl: leftRequestPortalUrl(),
                reportDate: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            });

            const scopeLabel = [config.departmentName, config.sectionName].filter(Boolean).join(' / ') || 'All Departments';
            await sendMail(
                recipients.to,
                `[Action Required] Pending Left Requests Digest — ${requests.length} Associate${requests.length === 1 ? '' : 's'} (${scopeLabel})`,
                html,
                [],
                recipients.cc
            );

            // Records that (and when) these requests were last included in a sent digest.
            await LeftRequest.markAsNotified(requests.map(r => r.id));
            logger.info(`[LeftRequestNotificationScheduler] Digest with ${requests.length} request(s) sent for ${scope} → ${recipients.to}`);
            return { requestsFound: requests.length, sent: true, to: recipients.to };
        } catch (error) {
            logger.error(`[LeftRequestNotificationScheduler] Failed to send digest for ${scope}: ${error.message}`, error);
            return { requestsFound: requests.length, sent: false, message: error.message };
        }
    }
}

export default new LeftRequestNotificationScheduler();
