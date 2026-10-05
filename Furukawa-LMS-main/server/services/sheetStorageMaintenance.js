import cron from 'node-cron';
import DailyMorningMeeting from '../models/dailyMorningMeeting.model.js';
import ENV from '../configs/env.config.js';
import logger from '../logger/winston.logger.js';

// Keeps the way meeting workbooks are stored in line with the configuration, so
// changing a setting needs a restart and nothing else — no script to run:
//
//   SHEET_COMPRESSION_WRITE  on  -> every large workbook ends up gzipped
//                            off -> every workbook ends up back as plain text
//   SHEET_PATCH_SAVE         off -> no edits are left held as patches
//
// It also folds each meeting's pending patches into its stored workbook, whatever the
// settings, so opening a meeting never has more than a day's patches to replay.
//
// Runs once shortly after startup and once a night. Every step is safe to repeat and
// safe to interrupt: nothing here changes a workbook's content, version or
// last-updated time, and a meeting someone saves mid-run is left for the next run.
//
// This is also the rollback path. Before deploying a release that predates one of
// these features, turn its setting off and restart; the startup run converts the data
// back to what the older release understands (watch the log for its summary line).

const mb = (bytes) => `${((bytes || 0) / 1048576).toFixed(2)} MB`;

class SheetStorageMaintenance {
    constructor() {
        this.jobs = [];
        this.isInitialized = false;
        this.isBusy = false;
    }

    init() {
        if (this.isInitialized) return;

        this.jobs.push(cron.schedule('30 2 * * *', () => this.runNow('cron-nightly'), {
            scheduled: true,
            timezone: 'Asia/Kolkata',
        }));
        this.isInitialized = true;
        logger.info('[SheetStorageMaintenance] Initialized — runs at startup and nightly at 02:30 IST.');

        this.runNow('startup');
    }

    stop() {
        this.jobs.forEach(j => { j.stop(); j.destroy(); });
        this.jobs = [];
        this.isInitialized = false;
        logger.info('[SheetStorageMaintenance] Stopped.');
    }

    // Never throws: a failure on one meeting is logged and the rest still run.
    async runNow(trigger = 'manual') {
        if (this.isBusy) return null;
        this.isBusy = true;
        const summary = { patchesFolded: 0, converted: 0, skipped: 0, failed: 0 };
        try {
            await this._foldPatches(summary);
            await this._convertSnapshots(summary);
            const quiet = !summary.patchesFolded && !summary.converted && !summary.skipped && !summary.failed;
            logger.info(
                `[SheetStorageMaintenance] ${trigger}: ` + (quiet ? 'nothing to do.' :
                    `folded patches for ${summary.patchesFolded} meeting(s), ` +
                    `${ENV.SHEET_COMPRESSION_WRITE ? 'compressed' : 'decompressed'} ${summary.converted}, ` +
                    `left ${summary.skipped} for the next run, ${summary.failed} failed.`)
            );
        } catch (error) {
            logger.error(`[SheetStorageMaintenance] ${trigger} run failed: ${error.message}`, error);
        } finally {
            this.isBusy = false;
        }
        return summary;
    }

    async _foldPatches(summary) {
        for (const id of await DailyMorningMeeting.findIdsWithPatches()) {
            try {
                if (await DailyMorningMeeting.compactPatches(id)) summary.patchesFolded++;
                await DailyMorningMeeting.purgeSupersededPatches(id);
            } catch (error) {
                summary.failed++;
                logger.error(`[SheetStorageMaintenance] folding patches failed for meeting ${id}: ${error.message}`, error);
            }
        }
        const left = await DailyMorningMeeting.findIdsWithPatches();
        if (left.length > 0) {
            // Saved during the run. Expected while patch saves are on; with them off it
            // means an open browser tab hasn't picked up the change yet.
            summary.skipped += left.length;
            if (!ENV.SHEET_PATCH_SAVE) {
                logger.warn(`[SheetStorageMaintenance] ${left.length} meeting(s) still hold patches after folding: ${left.join(', ')}`);
            }
        }
    }

    async _convertSnapshots(summary) {
        const compress = ENV.SHEET_COMPRESSION_WRITE;
        for (const id of await DailyMorningMeeting.findIdsToConvert(compress)) {
            try {
                const outcome = await DailyMorningMeeting.convertSnapshotStorage(id, compress);
                if (outcome.changed) {
                    summary.converted++;
                    logger.info(`[SheetStorageMaintenance] meeting ${id}: ${compress ? 'compressed' : 'decompressed'} ${mb(outcome.fromBytes)} -> ${mb(outcome.toBytes)}`);
                } else {
                    summary.skipped++;
                    logger.info(`[SheetStorageMaintenance] meeting ${id}: not converted (${outcome.reason})`);
                }
            } catch (error) {
                summary.failed++;
                logger.error(`[SheetStorageMaintenance] converting meeting ${id} failed: ${error.message}`, error);
            }
        }
        if (compress && summary.converted > 0) {
            try {
                await DailyMorningMeeting.reclaimSnapshotSpace();
            } catch (error) {
                // Only the space isn't handed back yet; the data is fine.
                logger.warn(`[SheetStorageMaintenance] could not reclaim freed space: ${error.message}`);
            }
        }
    }
}

export default new SheetStorageMaintenance();
