import logger from "../logger/winston.logger.js";
import DailyHrMeetingDaily from "../models/dailyHrMeetingDaily.model.js";
import DailyManpowerConfig from "../models/dailyManpowerConfig.model.js";
import { getRequiredForDay, otHoursToMandays } from "../utils/manpowerPresence.js";
import {
    getRequirementsByDepartment,
    getDailyPresenceByDepartment,
    getUnmappedPresentByDate,
    getHolidayDates,
    getDatesWithAttendance,
} from "./manpowerPresence.service.js";

// Computes the Daily HR Meeting figures for given dates and stores them in
// daily_hr_meeting_manpower_daily / daily_hr_meeting_daily_meta (replacing what was there).
// Requirements are frozen at computation time: a later requirement change does not rewrite
// past days until they are recalculated.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Pure: stored rows + meta rows for the given dates of ONE month. */
export const buildSnapshotRows = ({ dates, departmentIds, requirements, presence, unmappedPresent, holidays }) => {
    const rows = [];
    const metaRows = [];
    const knownDepartments = new Set(departmentIds);

    for (const date of dates) {
        const day = Number(date.slice(8, 10));
        const perDept = presence.byDate.get(date) || new Map();

        for (const departmentId of departmentIds) {
            const req = requirements.byDepartment.get(departmentId) || { fn01: 0, fn02: 0 };
            const p = perDept.get(departmentId) || { present: 0, otHrs: 0, fallbackCount: 0 };
            const requiredForDay = getRequiredForDay(day, req.fn01, req.fn02);
            rows.push({
                reportDate: date,
                departmentId,
                requiredFN01: req.fn01,
                requiredFN02: req.fn02,
                requiredForDay,
                presentCount: p.present,
                otHrs: p.otHrs,
                otMandays: otHoursToMandays(p.otHrs),
                gap: p.present - requiredForDay,
                deptFallbackCount: p.fallbackCount,
            });
        }

        // Present punches resolved to a department id that is not an active department.
        let orphanPresent = 0;
        for (const [departmentId, p] of perDept) {
            if (!knownDepartments.has(departmentId)) orphanPresent += p.present;
        }

        metaRows.push({
            reportDate: date,
            unmappedPresent: unmappedPresent.get(date) || 0,
            noDepartmentPresent: (presence.noDepartmentPresentByDate.get(date) || 0) + orphanPresent,
            unmappedRequirementFN01: requirements.unmapped.fn01,
            unmappedRequirementFN02: requirements.unmapped.fn02,
            unmappedAttendanceDepartments: presence.unmappedAttendanceDepartmentsByDate.get(date) || [],
            isHoliday: holidays.has(date),
        });
    }

    return { rows, metaRows };
};

const groupByMonth = (dates) => {
    const byMonth = new Map();
    for (const date of dates) {
        const key = date.slice(0, 7);
        if (!byMonth.has(key)) byMonth.set(key, []);
        byMonth.get(key).push(date);
    }
    return byMonth;
};

/**
 * Computes and stores the figures for `dates` (YYYY-MM-DD). Processes one month at a time.
 * @returns {Promise<{ dates: number }>}
 */
export const computeAndStoreDates = async (dates, { source, userId = null } = {}) => {
    const unique = [...new Set((dates || []).filter((d) => DATE_PATTERN.test(String(d))))].sort();
    if (!unique.length) return { dates: 0 };

    await Promise.all([DailyHrMeetingDaily.init(), DailyManpowerConfig.init()]);

    const departments = await DailyManpowerConfig.getDepartmentsWithConfig();
    const departmentIds = departments.map((d) => d.departmentId);
    let stored = 0;

    for (const [monthKey, monthDates] of groupByMonth(unique)) {
        const [year, monthNumber] = monthKey.split("-").map(Number);
        const startDate = monthDates[0];
        const endDate = monthDates[monthDates.length - 1];

        const [requirements, presence, unmappedPresent, holidays, attendanceDates] = await Promise.all([
            getRequirementsByDepartment({ year, monthNumber }),
            getDailyPresenceByDepartment({ startDate, endDate, departmentResolution: "attendance" }),
            getUnmappedPresentByDate({ startDate, endDate }),
            getHolidayDates({ startDate, endDate }),
            getDatesWithAttendance({ startDate, endDate }),
        ]);

        // Only days with attendance uploaded get figures. Every requested day is still cleared, so a
        // day whose attendance was removed goes back to "not calculated" instead of keeping old numbers.
        const datesToStore = monthDates.filter((d) => attendanceDates.has(d));
        const { rows, metaRows } = buildSnapshotRows({
            dates: datesToStore, departmentIds, requirements, presence, unmappedPresent, holidays,
        });

        await DailyHrMeetingDaily.replaceDates({ dates: monthDates, rows, metaRows, source, computedBy: userId });
        stored += datesToStore.length;
        logger.info(`[DailyHrMeeting] ${monthKey}: stored ${datesToStore.length} of ${monthDates.length} requested date(s) (${source}).`);
    }

    return { dates: stored };
};

/**
 * Fire-and-forget variant for hooks (attendance upload): never throws, never delays the caller.
 * Failed dates are picked up again by the nightly job.
 */
export const queueRecompute = (dates, options) => {
    setImmediate(() => {
        computeAndStoreDates(dates, options).catch((error) => {
            logger.error(`[DailyHrMeeting] Recompute failed for ${[].concat(dates).join(", ")} (${options?.source}): ${error.message}`);
        });
    });
};
