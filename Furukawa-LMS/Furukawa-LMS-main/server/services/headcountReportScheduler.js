import cron from 'node-cron';
import { executeQuery } from '../db/mssqlHelper.js';
import HeadcountReport from '../models/headcountReport.model.js';
import NotificationService from './notification.service.js';
import { computeHeadcountTableData } from './headcountData.service.js';
import logger from '../logger/winston.logger.js';

class HeadcountReportScheduler {
    constructor() {
        this.job = null;
        this.isInitialized = false;
        this.isBusy = false;
    }

    init() {
        if (this.isInitialized) return;

        // Run every minute to match configured scheduledTime values (same pattern as
        // handoverNotificationScheduler.js / sixteenDayMonitoringScheduler.js)
        this.job = cron.schedule('* * * * *', async () => {
            await this._checkAndSend();
        }, {
            scheduled: true,
            timezone: "Asia/Kolkata"
        });

        this.isInitialized = true;
        logger.info('[HeadcountReportScheduler] Initialized — checking every minute for scheduled headcount report emails.');
    }

    stop() {
        if (this.job) {
            this.job.stop();
            this.job.destroy();
            this.job = null;
        }
        this.isInitialized = false;
        logger.info('[HeadcountReportScheduler] Stopped.');
    }

    _getISTTime() {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + istOffset);
        return {
            currentTime: `${String(istNow.getUTCHours()).padStart(2, '0')}:${String(istNow.getUTCMinutes()).padStart(2, '0')}`,
            month: istNow.getUTCMonth() + 1,
            year: istNow.getUTCFullYear()
        };
    }

    async _checkAndSend() {
        if (this.isBusy) return;
        this.isBusy = true;

        try {
            const { currentTime, month, year } = this._getISTTime();

            const [rows] = await executeQuery(`
                SELECT monthlyTime FROM dbo.email_report_schedule_settings
                WHERE id = 1
                  AND monthlyTime = ?
            `, [currentTime]);

            if (!rows || rows.length === 0) {
                return;
            }

            logger.info(`[HeadcountReportScheduler] Time ${currentTime} — matches configured monthly send time.`);
            const result = await this._sendReport(month, year);
            logger.info(`[HeadcountReportScheduler] ${result.message}`);
        } catch (error) {
            logger.error(`[HeadcountReportScheduler] Error in _checkAndSend: ${error.message}`, error);
        } finally {
            this.isBusy = false;
        }
    }

    // Called from the API to force-send immediately, ignoring scheduledTime and the same-day dedup check.
    async runNow() {
        const { month, year } = this._getISTTime();
        try {
            const result = await this._sendReport(month, year, true);
            return { ok: true, month, year, ...result };
        } catch (error) {
            logger.error(`[HeadcountReportScheduler] runNow error: ${error.message}`, error);
            return { ok: false, message: error.message };
        }
    }

    async _sendReport(month, year, forceResend = false) {
        const departmentId = 0; // matches resolvedDeptId = departmentId || 0 in saveHeadcountReport

        // Compute live, same as the "Sync Data" button on /admin/report — this way the
        // email still goes out even if nobody has clicked "Save" for this month yet,
        // matching how the Daily Manpower / Management Daily reports are always built
        // fresh from live data rather than a saved snapshot.
        const { tableData } = await computeHeadcountTableData(departmentId, month, year);

        if (!tableData || Object.keys(tableData).length === 0) {
            return { sent: false, message: `No headcount data available for ${month}/${year}. Skipping.` };
        }

        if (!forceResend) {
            const alreadySent = await HeadcountReport.wasEmailedToday(departmentId, month, year);
            if (alreadySent) {
                return { sent: false, message: `Headcount report for ${month}/${year} was already emailed today. Skipping.` };
            }
        }

        // Persist the freshly-synced data so /admin/report shows the same numbers that
        // were just emailed, same as clicking "Sync Data" + "Save" would have produced.
        const reportId = await HeadcountReport.createOrUpdate({ departmentId, month, year, tableData });

        const reportDate = new Date(year, month - 1, 1);
        const sent = await NotificationService.sendFormReport("Associates Headcount Report", null, {
            tableData,
            month,
            year,
            date: reportDate.toISOString().split('T')[0]
        });

        if (sent) {
            await HeadcountReport.updateLastEmailSentAt(reportId);
            return { sent: true, message: `Headcount report sent for ${month}/${year}.` };
        }

        return { sent: false, message: `sendFormReport did not dispatch for ${month}/${year} (no active config or recipients).` };
    }
}

export default new HeadcountReportScheduler();
