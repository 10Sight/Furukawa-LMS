import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import DailyManpowerConfig, { DEFAULT_GROUP } from "../models/dailyManpowerConfig.model.js";
import DailyManpowerManualEntry from "../models/dailyManpowerManualEntry.model.js";
import DailyHrMeetingDaily from "../models/dailyHrMeetingDaily.model.js";
import { buildMonthlyReport, listMonthDates } from "../services/dailyHrMeetingReport.js";
import { computeAndStoreDates } from "../services/dailyHrMeetingSnapshot.service.js";
import { todayIST } from "../services/dailyHrMeetingScheduler.js";

// Daily HR Meeting — Daily Manpower Report.
// GET /data reads only the stored figures (daily_hr_meeting_manpower_daily); it never aggregates
// attendance. Figures are produced by services/dailyHrMeetingSnapshot.service.js.

const MAX_MANUAL_VALUE = 100000;

const parseMonth = (query) => {
    const year = Number.parseInt(query.year, 10);
    const monthNumber = Number.parseInt(query.month, 10);
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
        throw new ApiError("year and month (1-12) are required", 400);
    }
    return { year, monthNumber };
};

const monthRange = (year, monthNumber) => {
    const today = todayIST();
    const all = listMonthDates(year, monthNumber);
    const dates = listMonthDates(year, monthNumber, { upTo: today });
    return { all, dates, startDate: all[0], endDate: all[all.length - 1], today };
};

export const getMonthlyReportData = asyncHandler(async (req, res) => {
    const { year, monthNumber } = parseMonth(req.query);
    const { dates } = monthRange(year, monthNumber);

    if (!dates.length) {
        // A future month: nothing to show yet.
        return res.status(200).json(new ApiResponse(200, {
            year, monthNumber, dates: [], groups: [], training: null, grandTotal: null, lastComputedAt: null,
            diagnostics: { notComputedDates: [], unmappedPresentTotal: 0, noDepartmentPresentTotal: 0, unmappedRequirement: { fn01: 0, fn02: 0 }, deptFallbackTotal: 0, unmappedAttendanceDepartments: [] },
        }, "Month has not started"));
    }

    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    const [departments, storedRows, meta, trainingMonth, trainingEntries] = await Promise.all([
        DailyManpowerConfig.getDepartmentsWithConfig(),
        DailyHrMeetingDaily.getRows(startDate, endDate),
        DailyHrMeetingDaily.getMeta(startDate, endDate),
        DailyManpowerManualEntry.getTrainingMonth(year, monthNumber),
        DailyManpowerManualEntry.getEntries(startDate, endDate),
    ]);

    const report = buildMonthlyReport({
        year,
        monthNumber,
        dates,
        departments,
        storedRows,
        meta,
        training: { ...trainingMonth, entries: trainingEntries },
    });

    return res.status(200).json(new ApiResponse(200, report, "Daily manpower report fetched"));
});

export const getConfig = asyncHandler(async (req, res) => {
    const departments = await DailyManpowerConfig.getDepartmentsWithConfig();
    return res.status(200).json(new ApiResponse(200, { departments }, "Configuration fetched"));
});

export const saveDepartmentConfigs = asyncHandler(async (req, res) => {
    const input = Array.isArray(req.body?.departments) ? req.body.departments : null;
    if (!input) throw new ApiError("departments array is required", 400);

    const known = new Set((await DailyManpowerConfig.getDepartmentsWithConfig()).map((d) => d.departmentId));
    const configs = input.map((c, index) => {
        const departmentId = Number(c?.departmentId);
        if (!known.has(departmentId)) throw new ApiError(`Unknown department id: ${c?.departmentId}`, 400);
        const displayName = String(c?.displayName ?? "").trim().slice(0, 255) || null;
        const groupName = (String(c?.groupName ?? "").trim().toUpperCase() || DEFAULT_GROUP).slice(0, 100);
        const groupSortOrder = Number.isFinite(Number(c?.groupSortOrder)) ? Math.trunc(Number(c.groupSortOrder)) : 0;
        const sortOrder = Number.isFinite(Number(c?.sortOrder)) ? Math.trunc(Number(c.sortOrder)) : index;
        return {
            departmentId,
            displayName,
            isOther: Boolean(c?.isOther),
            groupName,
            groupSortOrder,
            sortOrder,
            isHidden: Boolean(c?.isHidden),
        };
    });

    await DailyManpowerConfig.upsertConfigs(configs, req.user?.id);
    const departments = await DailyManpowerConfig.getDepartmentsWithConfig();
    return res.status(200).json(new ApiResponse(200, { departments }, "Configuration saved"));
});

export const getAttendanceDeptMap = asyncHandler(async (req, res) => {
    const { year, monthNumber } = parseMonth(req.query);
    const { startDate, endDate } = monthRange(year, monthNumber);
    const [mappings, seen] = await Promise.all([
        DailyManpowerConfig.getAttendanceMap(),
        DailyManpowerConfig.getAttendanceDepartmentsInRange(startDate, endDate),
    ]);
    return res.status(200).json(new ApiResponse(200, { mappings, seen }, "Attendance department mapping fetched"));
});

export const saveAttendanceDeptMap = asyncHandler(async (req, res) => {
    const entries = Array.isArray(req.body?.mappings) ? req.body.mappings : null;
    if (!entries) throw new ApiError("mappings array is required", 400);

    const known = new Set((await DailyManpowerConfig.getDepartmentsWithConfig()).map((d) => d.departmentId));
    for (const e of entries) {
        const id = Number(e?.departmentId) || 0;
        if (id > 0 && !known.has(id)) throw new ApiError(`Unknown department id: ${e?.departmentId}`, 400);
        if (!String(e?.attendanceDepartment ?? "").trim()) throw new ApiError("attendanceDepartment is required", 400);
    }

    const changedKeys = await DailyManpowerConfig.saveAttendanceMap(entries, req.user?.id);

    // Re-store the affected dates of the selected month so the sheet reflects the new mapping.
    let recomputing = 0;
    if (req.body?.year && req.body?.month && changedKeys.length) {
        const { year, monthNumber } = parseMonth({ year: req.body.year, month: req.body.month });
        const { dates } = monthRange(year, monthNumber);
        if (dates.length) {
            const affected = await DailyManpowerConfig.getDatesUsingAttendanceDepartments(changedKeys, dates[0], dates[dates.length - 1]);
            if (affected.length) {
                const result = await computeAndStoreDates(affected, { source: "MAPPING", userId: req.user?.id });
                recomputing = result.dates;
            }
        }
    }

    const mappings = await DailyManpowerConfig.getAttendanceMap();
    return res.status(200).json(new ApiResponse(200, { mappings, recomputedDates: recomputing }, "Attendance department mapping saved"));
});

const toNonNegative = (value, name, { integer }) => {
    if (value === undefined || value === null || value === "") return 0;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > MAX_MANUAL_VALUE) throw new ApiError(`${name} must be between 0 and ${MAX_MANUAL_VALUE}`, 400);
    if (integer && !Number.isInteger(n)) throw new ApiError(`${name} must be a whole number`, 400);
    return integer ? n : Math.round(n * 100) / 100;
};

export const saveTrainingInputs = asyncHandler(async (req, res) => {
    const { year, monthNumber } = parseMonth({ year: req.body?.year, month: req.body?.month });
    const { all } = monthRange(year, monthNumber);
    const monthDates = new Set(all);

    const entries = (Array.isArray(req.body?.entries) ? req.body.entries : []).map((e) => {
        const date = String(e?.date || "");
        if (!monthDates.has(date)) throw new ApiError(`Date ${date || "(empty)"} is not in ${year}-${String(monthNumber).padStart(2, "0")}`, 400);
        return {
            date,
            presentCount: toNonNegative(e?.presentCount, `Present on ${date}`, { integer: true }),
            otHrs: toNonNegative(e?.otHrs, `OT hours on ${date}`, { integer: false }),
            remarks: e?.remarks ? String(e.remarks).slice(0, 500) : null,
        };
    });

    await DailyManpowerManualEntry.saveTrainingInputs({
        year,
        monthNumber,
        requiredFN01: toNonNegative(req.body?.requiredFN01, "Indent 01 required", { integer: true }),
        requiredFN02: toNonNegative(req.body?.requiredFN02, "Indent 16 required", { integer: true }),
        entries,
    }, req.user?.id);

    return res.status(200).json(new ApiResponse(200, { saved: entries.length }, "Training inputs saved"));
});

export const getTrainingInputs = asyncHandler(async (req, res) => {
    const { year, monthNumber } = parseMonth(req.query);
    const { all, startDate, endDate } = monthRange(year, monthNumber);
    const [month, entries] = await Promise.all([
        DailyManpowerManualEntry.getTrainingMonth(year, monthNumber),
        DailyManpowerManualEntry.getEntries(startDate, endDate),
    ]);
    return res.status(200).json(new ApiResponse(200, {
        year,
        monthNumber,
        requiredFN01: month.requiredFN01,
        requiredFN02: month.requiredFN02,
        entries: all.map((date) => ({ date, ...(entries.get(date) || { presentCount: 0, otHrs: 0, remarks: null }) })),
    }, "Training inputs fetched"));
});

export const recalculateMonth = asyncHandler(async (req, res) => {
    const { year, monthNumber } = parseMonth({ year: req.body?.year, month: req.body?.month });
    const { dates } = monthRange(year, monthNumber);
    if (!dates.length) throw new ApiError("This month has not started yet", 400);

    const result = await computeAndStoreDates(dates, { source: "MANUAL", userId: req.user?.id });
    return res.status(200).json(new ApiResponse(200, {
        recomputedDates: result.dates,
        daysWithoutAttendance: dates.length - result.dates,
    }, "Month recalculated"));
});
