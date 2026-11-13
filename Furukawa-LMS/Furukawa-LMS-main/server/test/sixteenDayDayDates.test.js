import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    dayOfInputKey,
    findDaysMissingDate,
    missingDateMessage,
} from "../utils/sixteenDayDayDates.util.js";

test("dayOfInputKey: typed inputs map to their day", () => {
    assert.equal(dayOfInputKey("row1_1_d2_0"), 2);              // cycle reading
    assert.equal(dayOfInputKey("row1_2_d3_target_9"), 3);       // cycle_detailed reading
    assert.equal(dayOfInputKey("row1_2_d1_score_4"), 1);
    assert.equal(dayOfInputKey("row2_1_d1"), 1);                // standard row, days 1-3
    assert.equal(dayOfInputKey("row3_2_d2"), 2);                // defect row
    assert.equal(dayOfInputKey("row2_1_day_4"), 4);             // standard row, days 4-16
    assert.equal(dayOfInputKey("row1_2_day_16_actual"), 16);
    assert.equal(dayOfInputKey("row_1700000000000_d5x9ab_day_7"), 7); // generated row id
    assert.equal(dayOfInputKey("attendance_actual_12"), 12);
});

test("dayOfInputKey: computed and non-day keys are ignored", () => {
    for (const key of [
        "row1_1_d1_avg", "row1_2_d1_target_avg", "row1_2_d1_achievement_0", "row1_2_day_5_achievement",
        "cat1_d1_total", "cat1_day_5_actual", "cat3_day_6_total", "row1_1_eval", "row1_2_eval_target",
        "summary_avg_score1", "summary_total_score", "attendance_total_score", "attendance_date_3",
        "comment", "row1_1_day_17", "row1_1_d4",
    ]) {
        assert.equal(dayOfInputKey(key), null, key);
    }
});

test("flags days with new values and no header date", () => {
    const grid = {
        row1_1_d2_0: "3", row2_1_day_5: "2", attendance_date_5: "",
        row2_1_day_6: "1", attendance_date_6: "10-Oct-26",
        attendance_actual_9: "1",
        cat1_d1_total: "5", row1_1_d1_avg: "0.3", // computed: ignored
    };
    assert.deepEqual(findDaysMissingDate(grid, {}), [2, 5, 9]);
    assert.equal(missingDateMessage([2, 5]), "Please select the date on the column header for Day-2, Day-5 before saving.");
});

test("empty values don't need a date", () => {
    assert.deepEqual(findDaysMissingDate({ row2_1_day_5: "", row1_1_d2_0: "  ", attendance_actual_3: null }, {}), []);
});

test("unchanged saved values without a date don't block (older records stay signable)", () => {
    const saved = { row2_1_day_5: "2", row1_1_d1_0: "3" };
    assert.deepEqual(findDaysMissingDate({ ...saved, comment: "x" }, saved), []);
    // Changing one of them does.
    assert.deepEqual(findDaysMissingDate({ ...saved, row2_1_day_5: "1" }, saved), [5]);
    // So does adding a value to a day that already had undated values.
    assert.deepEqual(findDaysMissingDate({ ...saved, row2_2_day_5: "1" }, saved), [5]);
});

test("clearing a saved date on a day that has values is flagged", () => {
    const saved = { row2_1_day_5: "2", attendance_date_5: "09-Oct-26" };
    assert.deepEqual(findDaysMissingDate({ ...saved, attendance_date_5: "" }, saved), [5]);
    assert.deepEqual(findDaysMissingDate({ attendance_date_5: "" }, { attendance_date_5: "09-Oct-26" }), []);
});

test("admin copy of the rule matches the server copy", () => {
    const strip = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
        .replace(/\r\n/g, "\n")
        .replace(/^\/\/ Keep in sync.*$/m, "");
    assert.equal(
        strip("../../admin/src/utils/sixteenDayDayDates.js"),
        strip("../utils/sixteenDayDayDates.util.js")
    );
});

// ---- Date values: handover-based earliest date, future dates, order ----
import {
    parseDayDate,
    parseIsoDate,
    formatDayNumber,
    earliestDayDate,
    todayInIST,
    validateDayDates,
    isFutureDay,
    findFutureDaysWithValues,
    futureValuesMessage,
    dayNumberOfLocalDate,
    localDateOfDayNumber,
} from "../utils/sixteenDayDayDates.util.js";

test("date parsing and formatting", () => {
    assert.equal(formatDayNumber(parseDayDate("05-Oct-26")), "05-Oct-26");
    assert.equal(parseDayDate("31-Feb-26"), null);
    assert.equal(parseDayDate("2026-10-05"), null);
    assert.equal(parseDayDate("05-oct-26"), null);
    assert.equal(parseIsoDate("2026-10-05"), parseDayDate("05-Oct-26"));
    assert.equal(parseIsoDate("2026-10-05T18:30:00.000Z"), parseDayDate("05-Oct-26"));
    assert.equal(earliestDayDate("2026-10-31"), parseDayDate("01-Nov-26"));
    assert.equal(earliestDayDate(""), null);
    const local = localDateOfDayNumber(parseDayDate("05-Oct-26"));
    assert.deepEqual([local.getFullYear(), local.getMonth(), local.getDate()], [2026, 9, 5]);
    assert.equal(dayNumberOfLocalDate(local), parseDayDate("05-Oct-26"));
});

test("todayInIST rolls over at midnight IST, not UTC", () => {
    // 18:29 UTC on 4 Oct = 23:59 IST on 4 Oct; 18:30 UTC = 00:00 IST on 5 Oct.
    assert.equal(todayInIST(Date.UTC(2026, 9, 4, 18, 29)), parseDayDate("04-Oct-26"));
    assert.equal(todayInIST(Date.UTC(2026, 9, 4, 18, 30)), parseDayDate("05-Oct-26"));
});

const handover = { handoverDate: "2026-10-01" };

test("future dates are allowed; dates before the day after handover are not", () => {
    assert.equal(validateDayDates({ attendance_date_1: "02-Oct-26", attendance_date_16: "30-Dec-27" }, {}, handover), null);
    assert.match(validateDayDates({ attendance_date_1: "01-Oct-26" }, {}, handover), /Day-1 date must be on or after 02-Oct-26, the day after the handover date/);
    assert.match(validateDayDates({ attendance_date_3: "20-Sep-26" }, {}, handover), /Day-3 date must be on or after 02-Oct-26/);
});

test("without a handover date there is no earliest date", () => {
    assert.equal(validateDayDates({ attendance_date_1: "01-Jan-25" }, {}, {}), null);
});

test("dates must be valid and run strictly forward", () => {
    assert.match(validateDayDates({ attendance_date_2: "2026-10-04" }, {}, handover), /Invalid date for Day-2/);
    assert.match(validateDayDates({ attendance_date_1: "05-Oct-26", attendance_date_2: "05-Oct-26" }, {}, handover), /Day-2 date must be after the Day-1 date/);
    assert.match(validateDayDates({ attendance_date_1: "05-Oct-26", attendance_date_4: "03-Oct-26" }, {}, handover), /Day-4 date must be after the Day-1 date/);
    assert.equal(validateDayDates({ attendance_date_1: "05-Oct-26", attendance_date_2: "" , attendance_date_4: "09-Oct-26" }, {}, handover), null);
});

test("unchanged older dates aren't re-checked unless the saved handover date moves", () => {
    const saved = { attendance_date_1: "01-Oct-26", attendance_date_2: "2026-10-02" }; // legacy
    assert.equal(validateDayDates({ ...saved }, saved, { handoverDate: "2026-10-01", previousHandoverDate: "2026-10-01" }), null);
    // Handover auto-filled for the first time: still not re-checked.
    assert.equal(validateDayDates({ ...saved }, saved, { handoverDate: "2026-10-01", previousHandoverDate: "" }), null);
    // Moving a saved handover date past set dates is rejected.
    const dated = { attendance_date_1: "03-Oct-26", attendance_date_2: "04-Oct-26" };
    assert.match(
        validateDayDates({ ...dated }, dated, { handoverDate: "2026-10-03", previousHandoverDate: "2026-10-01" }),
        /Day-1 date must be on or after 04-Oct-26/
    );
    assert.equal(validateDayDates({ ...dated }, dated, { handoverDate: "2026-10-02", previousHandoverDate: "2026-10-01" }), null);
});

test("values can't be entered for days dated in the future", () => {
    const today = parseDayDate("10-Oct-26");
    const grid = {
        attendance_date_1: "09-Oct-26", row2_1_d1: "2",
        attendance_date_2: "10-Oct-26", row2_1_d2: "2",
        attendance_date_3: "11-Oct-26", row2_1_d3: "2",
        attendance_date_4: "12-Oct-26", attendance_actual_4: "1",
        attendance_date_5: "13-Oct-26", // future but empty: fine
    };
    assert.equal(isFutureDay(grid, 2, today), false);
    assert.equal(isFutureDay(grid, 3, today), true);
    assert.deepEqual(findFutureDaysWithValues(grid, {}, today), [3, 4]);
    assert.equal(futureValuesMessage([3], grid), "Values can't be entered yet for Day-3 (11-Oct-26): that date is in the future.");
    // Already-saved values on a future day don't block other edits.
    assert.deepEqual(findFutureDaysWithValues({ ...grid, comment: "x" }, grid, today), []);
});
