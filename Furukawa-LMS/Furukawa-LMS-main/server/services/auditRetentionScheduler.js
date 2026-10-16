import cron from 'node-cron';
import { executeQuery } from '../db/mssqlHelper.js';
import { RETAINED_AUDIT_ACTIONS } from '../models/audit.model.js';
import ENV from '../configs/env.config.js';
import logger from '../logger/winston.logger.js';

// Deletes audit logs (Recent Activity) older than ENV.AUDIT_RETENTION_DAYS, except the
// backup / data-management actions in RETAINED_AUDIT_ACTIONS.
//
// Runs once shortly after startup and once a night. Deletes in batches so a large
// backlog never holds a long lock on the audits table.

const BATCH_SIZE = 5000;

class AuditRetentionScheduler {
    constructor() {
        this.jobs = [];
        this.isInitialized = false;
        this.isBusy = false;
    }

    init() {
        if (this.isInitialized) return;

        this.jobs.push(cron.schedule('15 3 * * *', () => this.runNow('cron-nightly'), {
            scheduled: true,
            timezone: 'Asia/Kolkata',
        }));
        this.isInitialized = true;
        logger.info(`[AuditRetention] Initialized — keeps ${ENV.AUDIT_RETENTION_DAYS} days, runs at startup and nightly at 03:15 IST.`);

        this.runNow('startup');
    }

    stop() {
        this.jobs.forEach(j => { j.stop(); j.destroy(); });
        this.jobs = [];
        this.isInitialized = false;
        logger.info('[AuditRetention] Stopped.');
    }

    // Never throws.
    async runNow(trigger = 'manual') {
        if (this.isBusy) return 0;
        this.isBusy = true;
        let deleted = 0;
        try {
            // Same cutoff GET /api/audits applies, computed the same way.
            const cutoff = new Date(Date.now() - ENV.AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
            const placeholders = RETAINED_AUDIT_ACTIONS.map(() => '?').join(',');
            const sql = `DELETE TOP (${BATCH_SIZE}) FROM audits
                WHERE createdAt < ?
                  AND action NOT IN (${placeholders})`;

            for (;;) {
                const [, meta] = await executeQuery(sql, [cutoff, ...RETAINED_AUDIT_ACTIONS], { longRunning: true });
                const affected = meta?.affectedRows || 0;
                deleted += affected;
                if (affected < BATCH_SIZE) break;
            }

            logger.info(`[AuditRetention] ${trigger}: deleted ${deleted} audit log(s) older than ${ENV.AUDIT_RETENTION_DAYS} days.`);
        } catch (error) {
            logger.error(`[AuditRetention] ${trigger} run failed after deleting ${deleted}: ${error.message}`, error);
        } finally {
            this.isBusy = false;
        }
        return deleted;
    }
}

export default new AuditRetentionScheduler();
