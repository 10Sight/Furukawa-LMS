import cron from "node-cron";
import logger from "../logger/winston.logger.js";
import { computeAndStoreDates } from "./dailyHrMeetingSnapshot.service.js";

// Keeps the stored Daily HR Meeting figures in step with attendance and employee records: once
// shortly after startup and nightly, recomputes every date of the current and previous month (up to
// today). Every date, not only those whose attendance changed: present is counted in each user's
// current department (like the MPS Portal trend chart), so transfers, designation shutters and
// statusHistory edits must reach past days too.

export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export const previousMonthStart = (isoDate) => {
    const [y, m] = isoDate.split("-").map(Number);
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    return `${py}-${String(pm).padStart(2, "0")}-01`;
};

/** Every YYYY-MM-DD from startDate to endDate inclusive. */
export const datesBetween = (startDate, endDate) => {
    const dates = [];
    const cursor = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    while (cursor <= end) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
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
            const dates = datesBetween(previousMonthStart(today), today);
            const result = await computeAndStoreDates(dates, { source });
            return result.dates;
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
