// Run with: node --test test/sheetRichText.test.js
//
// Text in a cell that isn't all in one style (portal/src/utils/spreadsheets/richText.js):
// styling part of the text, keeping that styling in place while the text is edited, and
// letting go of it when the cell's value is no longer the text it was made for.
import test from "node:test";
import assert from "node:assert/strict";
import {
    normalizeRuns, cellRuns, applyRunStyle, shiftRunsForEdit, runSegments, isRunStyleOn, withRunStyle, withoutRunKeys
} from "../../portal/src/utils/spreadsheets/richText.js";

const RED = "#ff0000", BLUE = "#0000ff";
// A text's styled parts, written out: "Hello [World]" style.
const show = (text, runs) => runSegments(text, runs).map((s) => (s.style ? `[${s.text}|${Object.entries(s.style).map(([k, v]) => `${k}=${v}`).join(",")}]` : s.text)).join("");

test("part of a text is given a style of its own", () => {
    const runs = applyRunStyle(undefined, 11, 6, 11, { color: RED });
    assert.deepEqual(runs, [{ start: 6, end: 11, color: RED }]);
    assert.equal(show("Hello World", runs), `Hello [World|color=${RED}]`);
    // Selected backwards, or past the end: the same characters.
    assert.deepEqual(applyRunStyle(undefined, 11, 11, 6, { color: RED }), runs);
    assert.deepEqual(applyRunStyle(undefined, 11, 6, 99, { color: RED }), runs);
    // Nothing selected changes nothing.
    assert.equal(applyRunStyle(undefined, 11, 4, 4, { color: RED }), undefined);
    assert.deepEqual(applyRunStyle(runs, 11, 4, 4, { bold: true }), runs);
});

test("styles build up over the parts they are applied to", () => {
    let runs = applyRunStyle(undefined, 11, 0, 5, { color: RED });
    runs = applyRunStyle(runs, 11, 3, 8, { bold: true });
    assert.equal(show("Hello World", runs), `[Hel|color=${RED}][lo|bold=true,color=${RED}][ Wo|bold=true]rld`);
    // The same style on neighbouring parts is one run.
    runs = applyRunStyle(applyRunStyle(undefined, 11, 0, 3, { color: RED }), 11, 3, 5, { color: RED });
    assert.deepEqual(runs, [{ start: 0, end: 5, color: RED }]);
    // A later colour replaces an earlier one where they meet.
    assert.equal(show("Hello World", applyRunStyle(runs, 11, 2, 4, { color: BLUE })), `[He|color=${RED}][ll|color=${BLUE}][o|color=${RED}] World`);
});

test("a setting taken off a part goes back to the cell's", () => {
    const runs = applyRunStyle(undefined, 11, 0, 11, { color: RED, bold: true });
    assert.deepEqual(applyRunStyle(runs, 11, 0, 5, { color: undefined }), [{ start: 0, end: 5, bold: true }, { start: 5, end: 11, bold: true, color: RED }]);
    assert.equal(applyRunStyle(runs, 11, 0, 11, { color: undefined, bold: undefined }), undefined, "nothing left: no runs at all");
    // Not bold inside a bold cell is a setting of its own.
    assert.deepEqual(applyRunStyle(undefined, 11, 0, 5, { bold: false }), [{ start: 0, end: 5, bold: false }]);
});

test("a toggle looks at whether all of the selected text has it", () => {
    const runs = [{ start: 0, end: 5, bold: true }];
    assert.equal(isRunStyleOn(runs, 11, 0, 5, "bold", {}), true);
    assert.equal(isRunStyleOn(runs, 11, 2, 4, "bold", {}), true);
    assert.equal(isRunStyleOn(runs, 11, 3, 8, "bold", {}), false, "part of it isn't");
    assert.equal(isRunStyleOn(runs, 11, 6, 9, "bold", {}), false);
    // The cell's own setting counts where a run says nothing...
    assert.equal(isRunStyleOn(runs, 11, 3, 8, "bold", { bold: true }), true);
    assert.equal(isRunStyleOn(undefined, 11, 0, 11, "italic", { italic: true }), true);
    // ...and a run can say otherwise.
    assert.equal(isRunStyleOn([{ start: 2, end: 4, bold: false }], 11, 0, 11, "bold", { bold: true }), false);
});

test("typing keeps the styled parts where they were", () => {
    const text = "Hello World";
    const runs = [{ start: 6, end: 11, color: RED }];
    const after = (next) => show(next, shiftRunsForEdit(runs, text, next));
    assert.equal(after("Oh Hello World"), `Oh Hello [World|color=${RED}]`, "typed before");
    assert.equal(after("Hello World!"), `Hello [World!|color=${RED}]`, "typed at its end: takes its style");
    assert.equal(after("Hello Wide World"), `Hello [Wide World|color=${RED}]`, "typed inside");
    assert.equal(after("Hello, World"), `Hello, [World|color=${RED}]`, "typed just before: plain, like what it follows");
    assert.equal(after("Hello Wld"), `Hello [Wld|color=${RED}]`, "deleted inside");
    assert.equal(after("HelloWorld"), `Hello[World|color=${RED}]`, "deleted before");
    assert.equal(after("Hello "), "Hello ", "deleted altogether");
    assert.equal(after("Hi World"), `Hi [World|color=${RED}]`, "replaced before");
    assert.equal(after("Hello Wonderful"), `Hello [Wonderful|color=${RED}]`, "its end replaced");
    assert.equal(after(""), "");
    assert.equal(after(text), `Hello [World|color=${RED}]`);
});

test("typing at the very start takes the style of what comes next", () => {
    const runs = [{ start: 0, end: 5, bold: true }];
    assert.equal(show(">Hello World", shiftRunsForEdit(runs, "Hello World", ">Hello World")), "[>Hello|bold=true] World");
    // Edits made one after another, each carried across in turn.
    let text = "Hello World", live = [{ start: 6, end: 11, color: RED }];
    for (const next of ["Hello World!", "Say Hello World!", "Say Hello Wor!"]) { live = shiftRunsForEdit(live, text, next); text = next; }
    assert.equal(show(text, live), `Say Hello [Wor!|color=${RED}]`);
});

test("runs that don't fit, or weren't written here, count for nothing", () => {
    assert.equal(normalizeRuns("nope", 5), undefined);
    assert.equal(normalizeRuns([{ start: 0, end: 3, color: RED }, { start: 2, end: 5, bold: true }], 5), undefined, "overlapping");
    assert.equal(normalizeRuns([{ start: "0", end: 3, color: RED }], 5), undefined);
    assert.equal(normalizeRuns([null], 5), undefined);
    assert.equal(normalizeRuns([{ start: 0, end: 3 }], 5), undefined, "a run that says nothing");
    assert.deepEqual(normalizeRuns([{ start: 3, end: 99, bold: true, onclick: "x" }, { start: -4, end: 2, color: RED }], 5), [{ start: 0, end: 2, color: RED }, { start: 3, end: 5, bold: true }]);
    assert.deepEqual(runSegments("abc", undefined), [{ text: "abc", style: null }]);
    assert.deepEqual(runSegments("", undefined), [{ text: "", style: null }]);
});

test("a cell's runs go with its value, and are let go of when the value changes", () => {
    const cell = withRunStyle({ value: "Hello World", bg: "#ffff00" }, 6, 11, { color: RED });
    assert.deepEqual(cell, { value: "Hello World", bg: "#ffff00", rich: { t: "Hello World", runs: [{ start: 6, end: 11, color: RED }] } });
    assert.deepEqual(cellRuns(cell), [{ start: 6, end: 11, color: RED }]);
    // Something else put another value in the cell and kept the rest of it: no runs.
    assert.equal(cellRuns({ ...cell, value: "Hello Wendy" }), undefined);
    assert.equal(cellRuns({ ...cell, value: 42 }), undefined);
    assert.equal(cellRuns({ value: "plain" }), undefined);
    assert.equal(cellRuns(undefined), undefined);
    // Styling a cell whose runs are stale starts afresh; nothing to style is left alone.
    assert.deepEqual(withRunStyle({ ...cell, value: "Bye" }, 0, 3, { bold: true }).rich, { t: "Bye", runs: [{ start: 0, end: 3, bold: true }] });
    const number = { value: 42 };
    assert.equal(withRunStyle(number, 0, 2, { bold: true }), number);
    assert.equal(withRunStyle(cell, 6, 11, { color: undefined }).rich, undefined, "the last run gone, so is `rich`");
});

test("a font change for the whole cell overrides its parts' setting for that", () => {
    const cell = { value: "Hello World", color: BLUE, rich: { t: "Hello World", runs: [{ start: 0, end: 5, color: RED, bold: true }, { start: 6, end: 11, color: RED }] } };
    assert.deepEqual(withoutRunKeys(cell, ["color"]), { value: "Hello World", color: BLUE, rich: { t: "Hello World", runs: [{ start: 0, end: 5, bold: true }] } });
    assert.deepEqual(withoutRunKeys(cell, ["color", "bold"]), { value: "Hello World", color: BLUE });
    assert.deepEqual(withoutRunKeys({ ...cell, value: "changed" }, ["color"]), { value: "changed", color: BLUE }, "stale runs are dropped while at it");
    const plain = { value: "x", bold: true };
    assert.equal(withoutRunKeys(plain, ["bold"]), plain);
});
