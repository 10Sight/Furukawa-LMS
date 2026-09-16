import cron from 'node-cron';
import DojoStageHistory from '../models/dojoStagHistory.model.js';
import logger from '../logger/winston.logger.js';

// IST calendar date, `offsetDays` days from now (e.g. -1 for "yesterday").
const toISTDateStr = (offsetDays = 0) => {
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffsetMs);
    ist.setUTCDate(ist.getUTCDate() + offsetDays);
    return ist.toISOString().split('T')[0];
};

class DojoStageHistoryScheduler {
    constructor() {
        this.jobs = [];
        this.isInitialized = false;
        this.isBusy = false;
    }

    init() {
        if (this.isInitialized) return;

        // End-of-day settle: captures the day's final state.
        this.jobs.push(cron.schedule('59 23 * * *', () => this._sync(toISTDateStr(0), 'cron-eod'), {
            scheduled: true,
            timezone: 'Asia/Kolkata',
        }));
        // Just-after-midnight settle, for any edit that landed between 23:59 and 00:00.
        this.jobs.push(cron.schedule('5 0 * * *', () => this._sync(toISTDateStr(-1), 'cron-midnight'), {
            scheduled: true,
            timezone: 'Asia/Kolkata',
        }));
        // Hourly refresh during shift hours so today's bar on the trend chart stays reasonably live.
        this.jobs.push(cron.schedule('0 6-22 * * *', () => this._sync(toISTDateStr(0), 'cron-hourly'), {
            scheduled: true,
            timezone: 'Asia/Kolkata',
        }));

        this.isInitialized = true;
        logger.info('[DojoStageHistoryScheduler] Initialized — daily settle at 23:59/00:05 IST, hourly refresh 06:00-22:00 IST.');
    }

    stop() {
        this.jobs.forEach(j => { j.stop(); j.destroy(); });
        this.jobs = [];
        this.isInitialized = false;
        logger.info('[DojoStageHistoryScheduler] Stopped.');
    }

    async _sync(dateStr, syncedBy) {
        if (this.isBusy) return;
        this.isBusy = true;
        try {
            await DojoStageHistory.syncDate(dateStr, { syncedBy });
            logger.info(`[DojoStageHistoryScheduler] Synced ${dateStr} (${syncedBy}).`);
        } catch (error) {
            logger.error(`[DojoStageHistoryScheduler] Sync failed for ${dateStr}: ${error.message}`, error);
        } finally {
            this.isBusy = false;
        }
    }

    // Manual/admin trigger — forces an immediate sync of today, ignoring the schedule.
    async runNow() {
        const dateStr = toISTDateStr(0);
        await DojoStageHistory.syncDate(dateStr, { syncedBy: 'manual' });
        return { ok: true, date: dateStr };
    }
}

export default new DojoStageHistoryScheduler();
