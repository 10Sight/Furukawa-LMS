import { computeAndStoreDates } from "../services/dailyHrMeetingSnapshot.service.js";
import { listMonthDates } from "../services/dailyHrMeetingReport.js";
import { todayIST } from "../services/dailyHrMeetingScheduler.js";

// One-time backfill of the stored Daily HR Meeting figures (daily_hr_meeting_manpower_daily),
// month by month from --from up to today. Safe to re-run: each date is replaced, never duplicated.
// Point the server's DB env config at the target database before running it.
//
// Usage (from server/):
//   node scripts/backfillDailyHrMeeting.js --from 2026-04
//   node scripts/backfillDailyHrMeeting.js --from 2026-04 --to 2026-09

const argValue = (name) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
};

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

(async () => {
    const from = argValue("--from");
    const today = todayIST();
    const to = argValue("--to") || today.slice(0, 7);

    if (!MONTH_PATTERN.test(from || "") || !MONTH_PATTERN.test(to)) {
        console.error("Usage: node scripts/backfillDailyHrMeeting.js --from YYYY-MM [--to YYYY-MM]");
        process.exit(1);
    }
    if (from > to) {
        console.error(`--from ${from} is after --to ${to}`);
        process.exit(1);
    }

    try {
        let [year, month] = from.split("-").map(Number);
        let total = 0;
        for (;;) {
            const key = `${year}-${String(month).padStart(2, "0")}`;
            if (key > to) break;
            const dates = listMonthDates(year, month, { upTo: today });
            if (dates.length) {
                console.log(`Storing ${key} (${dates.length} days)...`);
                const result = await computeAndStoreDates(dates, { source: "BACKFILL" });
                total += result.dates;
            }
            month += 1;
            if (month > 12) { month = 1; year += 1; }
        }
        console.log(`Backfill complete: ${total} date(s) with attendance stored.`);
        process.exit(0);
    } catch (error) {
        console.error("Backfill failed:", error);
        process.exit(1);
    }
})();
