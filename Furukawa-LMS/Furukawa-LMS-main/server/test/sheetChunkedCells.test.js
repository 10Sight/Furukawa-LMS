// Run with: node --test test/sheetChunkedCells.test.js
//
// Chunked cell maps (admin/src/utils/spreadsheets/chunkedCells.js): to the code using
// them they must be indistinguishable from the plain { cellId: cell } object they
// replace, and a copy must never see writes made to the map it came from, or the
// other way round.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { copyCellMap, createCellMap, cellCountOf, isChunkedCells, forEachCellId, cellIdsOf } from "../../admin/src/utils/spreadsheets/chunkedCells.js";

// The same immer the grid uses (through Redux Toolkit), from the admin app's dependencies.
const { createNextState } = createRequire(new URL("../../admin/package.json", import.meta.url))("@reduxjs/toolkit");

const random = (seed) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const KEYS = ["A1", "B2", "Z999", "AA130", "C129", "AF33", "XFD1048576", "a1", "$A$1", "foo", "constructor", "toString", "A0"];
const keyIn = (rand) => (rand() < 0.7
    ? `${String.fromCharCode(65 + Math.floor(rand() * 40) % 26)}${1 + Math.floor(rand() * 600)}`
    : KEYS[Math.floor(rand() * KEYS.length)]);
const sorted = (keys) => [...keys].sort();

// Everything the code reading a cell map can ask of it.
const sameAs = (chunked, plain, label) => {
    assert.deepEqual(sorted(Object.keys(chunked)), sorted(Object.keys(plain)), label);
    assert.deepEqual(sorted(cellIdsOf(chunked)), sorted(Object.keys(plain)), label);
    const visited = [];
    forEachCellId(chunked, (id, cell) => { visited.push(id); assert.equal(cell, plain[id], label); });
    assert.deepEqual(sorted(visited), sorted(Object.keys(plain)), label);
    const forIn = [];
    for (const id in chunked) forIn.push(id);
    assert.deepEqual(sorted(forIn), sorted(Object.keys(plain)), label);
    for (const id of new Set([...KEYS, ...Object.keys(plain), "B3", "Q77"])) {
        // What a key it doesn't hold inherits can differ: `constructor` is its own class,
        // which is what keeps immer from treating it as a plain object.
        if (Object.prototype.hasOwnProperty.call(plain, id) || !(id in Object.prototype)) {
            assert.equal(chunked[id], plain[id], `${label}: ${id}`);
        }
        assert.equal(id in chunked, id in plain, `${label}: in ${id}`);
        assert.equal(Object.prototype.hasOwnProperty.call(chunked, id), Object.prototype.hasOwnProperty.call(plain, id), `${label}: own ${id}`);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(chunked)), JSON.parse(JSON.stringify(plain)), label);
    assert.deepEqual({ ...chunked }, { ...plain }, label);
};

test("a chunked map answers everything a plain object would, through edits and copies", () => {
    for (let seed = 1; seed <= 20; seed++) {
        const rand = random(seed);
        const start = {};
        for (let i = 0; i < 50; i++) start[keyIn(rand)] = { value: String(i) };
        // Pairs of [chunked, plain] that must stay the same; copies join the list.
        const maps = [[copyCellMap(start), { ...start }]];
        for (let step = 0; step < 300; step++) {
            const pair = maps[Math.floor(rand() * maps.length)];
            const roll = rand();
            const id = keyIn(rand);
            if (roll < 0.45) { const cell = { value: String(step) }; pair[0][id] = cell; pair[1][id] = cell; }
            else if (roll < 0.6) { delete pair[0][id]; delete pair[1][id]; }
            else if (roll < 0.65) { pair[0][id] = undefined; pair[1][id] = undefined; }
            else if (roll < 0.7) { Object.assign(pair[0], { [id]: { value: "assigned" } }); pair[1][id] = pair[0][id]; }
            else if (roll < 0.8 && maps.length < 6) maps.push([copyCellMap(pair[0]), { ...pair[1] }]);
            for (const [i, [chunked, plain]] of maps.entries()) sameAs(chunked, plain, `seed ${seed}, step ${step}, map ${i}`);
        }
    }
});

test("a plain object's methods are still there", () => {
    const cells = copyCellMap({ A1: { value: "1" } });
    assert.equal(cells.hasOwnProperty("A1"), true);
    assert.equal(cells.hasOwnProperty("A2"), false);
    assert.equal(typeof cells.toString, "function");
    assert.equal(String(cells), "[object Object]");
    assert.equal(isChunkedCells(cells), true);
    assert.equal(isChunkedCells({ A1: {} }), false);
});

test("immer leaves a chunked map alone: not drafted, not frozen", () => {
    const cells = copyCellMap({ A1: { value: "1" } });
    const state = { sheets: { S: { cells: {} } } };
    const next = createNextState(state, (draft) => { draft.sheets.S = { cells, rowCount: 3 }; });
    assert.equal(next.sheets.S.cells, cells);
    assert.equal(Object.isFrozen(next.sheets.S), true);
    cells.B2 = { value: "still writable" };
    assert.equal(next.sheets.S.cells.B2.value, "still writable");
});

test("a copy of a large sheet shares its blocks instead of copying every cell", () => {
    const plain = {};
    for (let r = 1; r <= 200000; r++) plain[`A${r}`] = { value: String(r) };
    const base = copyCellMap(plain);
    const started = performance.now();
    for (let i = 0; i < 100; i++) {
        const copy = copyCellMap(base);
        copy[`A${i + 1}`] = { value: "edited" };
    }
    // A full copy of 200,000 cells takes tens of milliseconds; 100 of them would be seconds.
    assert.ok(performance.now() - started < 1000, `${(performance.now() - started).toFixed(0)} ms for 100 copies`);
    assert.equal(base.A1.value, "1");
});

test("an empty chunked map is built up like a plain object, and counts what it holds", () => {
    const cells = createCellMap();
    assert.equal(cellCountOf(cells), 0);
    cells.A1 = { value: "1" };
    cells.C300 = { value: "2" };
    cells.foo = { value: "3" };
    delete cells.A1;
    assert.equal(cellCountOf(cells), 2);
    assert.equal(cellCountOf({ A1: {}, B2: {} }), 2);
    assert.deepEqual(JSON.parse(JSON.stringify(cells)), { C300: { value: "2" }, foo: { value: "3" } });
});
