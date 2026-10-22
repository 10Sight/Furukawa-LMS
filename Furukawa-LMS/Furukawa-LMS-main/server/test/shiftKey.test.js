// Run with: node --test test/shiftKey.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeShiftKey, sortShiftKeys } from "../utils/shiftKey.js";

test("every spelling of a shift found in attendance_logs maps to its code", () => {
    const cases = {
        "A-Shift": "A", "A": "A", "A2": "A", "a shift": "A",
        "B-Shift": "B", "B": "B",
        "C-Shift": "C", "C": "C",
        "G-Shift": "G", "G2": "G", "GEN": "G", "General": "G",
        "D": "OTHER", "E": "OTHER",
    };
    for (const [raw, key] of Object.entries(cases)) assert.equal(normalizeShiftKey(raw), key, raw);
});

test("statuses in the shift column and blanks are not shifts", () => {
    for (const raw of ["Absent", "Left", "", "  ", null, undefined]) assert.equal(normalizeShiftKey(raw), null, String(raw));
});

test("shift keys sort A, B, C, G, OTHER", () => {
    assert.deepEqual(sortShiftKeys(["OTHER", "G", "B", "A"]), ["A", "B", "G", "OTHER"]);
});
