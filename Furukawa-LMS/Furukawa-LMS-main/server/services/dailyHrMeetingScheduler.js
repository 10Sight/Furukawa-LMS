import cron from "node-cron";
import logger from "../logger/winston.logger.js";
import DailyHrMeetingDaily from "../models/dailyHrMeetingDaily.model.js";
import { computeAndStoreDates } from "./dailyHrMeetingSnapshot.service.js";

// Keeps the stored Daily HR Meeting figures in step with attendance: once shortly after startup and
// nightly, recomputes every date of the current and previous month (up to today) that has attendance
// but no stored figures, or whose attendance changed after its figures were stored.

export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export const previousMonthStart = (isoDate) => {
    const [y, m] = isoDate.split("-").map(Number);
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    return `${py}-${String(pm).padStart(2, "0")}-01`;
};

class DailyHrMeetingScheduler {
    constructor() {
        this.jobs = [];
        this.isInitialized = false;
        this.isBusy = false;
        this.startupTimer = null;
    }

    init() {
        if (this.isInitialized) return;
        this.jobs.push(cron.schedule("30 2 * * *", () => this.runNow("NIGHTLY"), {
            scheduled: true,
            timezone: "Asia/Kolkata",
        }));
        this.isInitialized = true;
        logger.info("[DailyHrMeeting] Scheduler initialized — catches up at startup and nightly at 02:30 IST.");

        // Let the rest of startup settle before the first catch-up.
        this.startupTimer = setTimeout(() => this.runNow("NIGHTLY"), 60 * 1000);
        this.startupTimer.unref?.();
    }

    stop() {
        this.jobs.forEach((j) => { j.stop(); j.destroy?.(); });
        this.jobs = [];
        if (this.startupTimer) clearTimeout(this.startupTimer);
        this.isInitialized = false;
        logger.info("[DailyHrMeeting] Scheduler stopped.");
    }

    // Never throws.
    async runNow(source = "NIGHTLY") {
        if (this.isBusy) return 0;
        this.isBusy = true;
        try {
            const today = todayIST();
            const dates = await DailyHrMeetingDaily.findStaleOrMissingDates(previousMonthStart(today), today);
            if (!dates.length) return 0;
            await computeAndStoreDates(dates, { source });
            return dates.length;
        } catch (error) {
            logger.error(`[DailyHrMeeting] Catch-up run failed: ${error.message}`);
            return 0;
        } finally {
            this.isBusy = false;
        }
    }
}

const dailyHrMeetingScheduler = new DailyHrMeetingScheduler();
export default dailyHrMeetingScheduler;
