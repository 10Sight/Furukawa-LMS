// Run with: node --test test/sheetWorkbook.test.js
//
// Exercises the patch format from both ends: the client's diff
// (admin/.../spreadsheet/workbookDiff.js) and the server's validate/apply.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWorkbook, validatePatch, applyPatch } from "../utils/sheetWorkbook.js";
import { diffWorkbook, MAX_PATCH_CELLS } from "../../admin/src/components/tables/spreadsheet/workbookDiff.js";

const sheet = (cells, extra = {}) => ({ cells, rowCount: 30, columnCount: 15, merges: [], media: [], ...extra });
// What the server ends up holding: the patch goes over the wire as JSON and is applied
// to the server's own JSON copy of the base workbook.
const viaServer = (base, patch, activeSheet = Object.keys(base)[0]) => {
    const wire = JSON.parse(JSON.stringify(patch));
    assert.equal(validatePatch(wire), null);
    const workbook = normalizeWorkbook(JSON.parse(JSON.stringify({ sheets: base, activeSheet })));
    assert.deepEqual(applyPatch(workbook, wire), []);
    return workbook;
};
const asStored = (sheets) => JSON.parse(JSON.stringify(sheets));

test("no change gives an empty patch", () => {
    const base = { S: sheet({ A1: { value: "1" } }) };
    assert.deepEqual(diffWorkbook(base, base), { v: 1, sheets: {} });
    assert.deepEqual(diffWorkbook(base, { ...base }, { activeSheet: "S" }), { v: 1, sheets: {}, activeSheet: "S" });
});

test("edited, added and removed cells round-trip through the server", () => {
    const a1 = { value: "1" }, b2 = { value: "keep" }, c3 = { value: "gone" };
    const base = { S: sheet({ A1: a1, B2: b2, C3: c3 }), T: sheet({ A1: { value: "other" } }) };
    const next = { S: { ...base.S, cells: { A1: { value: "2", bold: true }, B2: b2, D4: { value: "new" } } }, T: base.T };

    const patch = diffWorkbook(base, next);
    assert.deepEqual(Object.keys(patch.sheets), ["S"]);
    assert.deepEqual(Object.keys(patch.sheets.S.set).sort(), ["A1", "D4"]);
    assert.deepEqual(patch.sheets.S.del, ["C3"]);
    assert.equal(patch.sheets.S.props, undefined);
    assert.deepEqual(viaServer(base, patch).sheets, asStored(next));
});

test("sheet settings: changed ones are replaced, removed ones are unset", () => {
    const base = { S: sheet({ A1: { value: "1" } }, { pivotConfig: { rows: ["a"] }, columnWidths: { A: 80 } }) };
    const { pivotConfig, ...rest } = base.S;
    const next = { S: { ...rest, rowCount: 99, columnWidths: { A: 80, B: 120 }, charts: [{ id: 1 }], hiddenRows: undefined } };

    const patch = diffWorkbook(base, next);
    assert.equal(patch.sheets.S.set, undefined);
    assert.deepEqual(Object.keys(patch.sheets.S.props).sort(), ["charts", "columnWidths", "rowCount"]);
    assert.deepEqual(patch.sheets.S.unset, ["pivotConfig"]);
    assert.deepEqual(viaServer(base, patch).sheets, asStored(next));
});

test("activeSheet is carried and applied", () => {
    const base = { S: sheet({}), T: sheet({}) };
    const patch = diffWorkbook(base, base, { activeSheet: "T" });
    assert.equal(viaServer(base, patch).activeSheet, "T");
});

test("changes a patch can't express ask for a full save", () => {
    const base = { S: sheet({}), T: sheet({}) };
    assert.equal(diffWorkbook(base, { S: base.S }), null, "sheet removed");
    assert.equal(diffWorkbook(base, { ...base, U: sheet({}) }), null, "sheet added");
    assert.equal(diffWorkbook(base, { S: base.S, Renamed: base.T }), null, "sheet renamed");
    assert.equal(diffWorkbook(base, { T: base.T, S: base.S }), null, "sheets reordered");

    const many = {};
    for (let i = 1; i <= MAX_PATCH_CELLS + 1; i++) many[`A${i}`] = { value: String(i) };
    assert.equal(diffWorkbook(base, { S: { ...base.S, cells: many }, T: base.T }), null, "bulk rewrite");
    const atLimit = { ...many };
    delete atLimit[`A${MAX_PATCH_CELLS + 1}`];
    assert.notEqual(diffWorkbook(base, { S: { ...base.S, cells: atLimit }, T: base.T }), null, "exactly at the limit");
});

test("random edit sequences: patches applied in order reproduce the workbook", () => {
    let seed = 42;
    const rand = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    const id = () => `${String.fromCharCode(65 + rand(6))}${1 + rand(40)}`;

    let client = { S: sheet({}), T: sheet({ A1: { value: "t" } }) };
    const server = normalizeWorkbook(JSON.parse(JSON.stringify({ sheets: client, activeSheet: "S" })));
    for (let round = 0; round < 60; round++) {
        const name = rand(3) === 0 ? "T" : "S";
        const cells = { ...client[name].cells };
        for (let k = 0, n = 1 + rand(12); k < n; k++) {
            const cellId = id();
            if (rand(4) === 0) delete cells[cellId];
            else cells[cellId] = { value: String(rand(1000)), ...(rand(3) === 0 && { bold: true }) };
        }
        const nextSheet = { ...client[name], cells };
        if (rand(5) === 0) nextSheet.rowCount = 30 + rand(100);
        if (rand(7) === 0) nextSheet.merges = [{ start: id(), end: id() }];
        const next = { ...client, [name]: nextSheet };

        const patch = JSON.parse(JSON.stringify(diffWorkbook(client, next, { activeSheet: name })));
        assert.equal(validatePatch(patch), null);
        assert.deepEqual(applyPatch(server, patch), []);
        client = next;
        assert.deepEqual(server.sheets, asStored(client), `diverged at round ${round}`);
        assert.equal(server.activeSheet, name);
    }
});

test("applying a patch twice is the same as applying it once", () => {
    const base = { S: sheet({ A1: { value: "1" }, B1: { value: "x" } }) };
    const next = { S: { ...base.S, rowCount: 50, cells: { A1: { value: "2" }, C1: { value: "3" } } } };
    const patch = diffWorkbook(base, next);
    const once = viaServer(base, patch);
    const twice = viaServer(base, patch);
    applyPatch(twice, JSON.parse(JSON.stringify(patch)));
    assert.deepEqual(twice, once);
});

test("a patch for a sheet the workbook lacks is reported, not applied", () => {
    const workbook = normalizeWorkbook({ sheets: { S: sheet({}) }, activeSheet: "S" });
    const missing = applyPatch(workbook, { v: 1, sheets: { Nope: { set: { A1: { value: "1" } } } }, activeSheet: "Nope" });
    assert.deepEqual(missing, ["Nope"]);
    assert.deepEqual(Object.keys(workbook.sheets), ["S"]);
    assert.equal(workbook.activeSheet, "S");
});

test("validatePatch rejects malformed and unsafe patches", () => {
    const bad = [
        null, [], "x", { v: 2, sheets: {} }, { v: 1, extra: 1 }, { v: 1, activeSheet: 5 }, { v: 1, sheets: [] },
        { v: 1, sheets: { S: [] } },
        { v: 1, sheets: { S: { cells: {} } } },
        { v: 1, sheets: { S: { set: { a1: {} } } } },
        { v: 1, sheets: { S: { set: { "A0": {} } } } },
        { v: 1, sheets: { S: { set: { A1: "text" } } } },
        { v: 1, sheets: { S: { set: { A1: null } } } },
        { v: 1, sheets: { S: { del: ["A1", 7] } } },
        { v: 1, sheets: { S: { del: "A1" } } },
        { v: 1, sheets: { S: { props: { cells: {} } } } },
        { v: 1, sheets: { S: { props: JSON.parse('{"__proto__": {"polluted": true}}') } } },
        { v: 1, sheets: { S: { set: JSON.parse('{"__proto__": {"polluted": true}}') } } },
        { v: 1, sheets: { S: { unset: ["cells"] } } },
        { v: 1, sheets: { S: { unset: ["constructor"] } } },
    ];
    for (const patch of bad) assert.notEqual(validatePatch(patch), null, JSON.stringify(patch));

    assert.equal(validatePatch({ v: 1 }), null);
    assert.equal(validatePatch({ v: 1, sheets: {}, activeSheet: "S" }), null);
    assert.equal(validatePatch({ v: 1, sheets: { "__proto__x": { set: { XFD1048576: { value: 1 } }, del: [], props: { a: null }, unset: ["b"] } } }), null);
    assert.equal({}.polluted, undefined);
});

test("a sheet literally named __proto__ can't be used to reach the prototype", () => {
    const workbook = normalizeWorkbook({ sheets: { S: sheet({}) }, activeSheet: "S" });
    const patch = JSON.parse('{"v":1,"sheets":{"__proto__":{"props":{"polluted":true}}}}');
    assert.equal(validatePatch(patch), null);
    assert.deepEqual(applyPatch(workbook, patch), ["__proto__"]);
    assert.equal({}.polluted, undefined);
});
