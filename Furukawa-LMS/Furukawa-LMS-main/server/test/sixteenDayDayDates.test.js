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
