// Run with: node --test test/sheetSync.test.js
//
// Live co-editing, client side (portal/src/utils/spreadsheets/workbookSync.js): taking
// other people's saved patches into an open workbook without losing unsaved work, checked
// against what the server itself does with the same patches.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWorkbook, validatePatch, applyPatch } from "../utils/sheetWorkbook.js";
import { diffWorkbook } from "../../portal/src/components/tables/spreadsheet/workbookDiff.js";
import {
    normalizeStoredWorkbook, applyPatchToSaved, rebaseLive, rebaseRemotePatch, rebaseRemotePatches, rebaseSnapshot
} from "../../portal/src/utils/spreadsheets/workbookSync.js";

const sheet = (cells, extra = {}) => ({ cells, rowCount: 30, columnCount: 15, merges: [], media: [], ...extra });
const json = (value) => JSON.parse(JSON.stringify(value));
// A patch as another browser receives it: over the wire, sharing nothing with the sender.
const wire = (patch) => {
    const copy = json(patch);
    assert.equal(validatePatch(copy), null);
    return copy;
};
// The server's workbook after applying patches to its own copy of `base`.
const onServer = (base, ...patches) => {
    const workbook = normalizeWorkbook(json({ sheets: base, activeSheet: Object.keys(base)[0] }));
    for (const patch of patches) applyPatch(workbook, json(patch));
    return workbook.sheets;
};
// An edit the way the grid makes one: new objects along the path, everything else shared.
const edit = (workbook, name, changes, props = {}) => {
    const cells = { ...workbook[name].cells };
    for (const [id, cell] of Object.entries(changes)) {
        if (cell === null) delete cells[id]; else cells[id] = cell;
    }
    return { ...workbook, [name]: { ...workbook[name], ...props, cells } };
};
const unsaved = (saved, live) => diffWorkbook(saved, live);

test("a stored workbook is normalized the way the server does it", () => {
    for (const stored of [{}, null, { sheets: {} }, { sheets: [] }, { cells: {} }, "x"]) {
        assert.deepEqual(normalizeStoredWorkbook(stored), normalizeWorkbook(stored));
    }
    const sheets = { One: sheet({}), Two: sheet({}) };
    assert.deepEqual(normalizeStoredWorkbook({ sheets, activeSheet: "Two" }), { sheets, activeSheet: "Two" });
    assert.equal(normalizeStoredWorkbook({ sheets, activeSheet: "Gone" }).activeSheet, "One");
    assert.equal(normalizeStoredWorkbook({ sheets }).sheets, sheets);
});

test("the saved copy follows the server exactly, without being edited in place", () => {
    const base = { S: sheet({ A1: { value: "1" }, B2: { value: "old" }, C3: { value: "gone" } }, { pivotConfig: { x: 1 } }), T: sheet({ A1: { value: "t" } }) };
    const frozen = json(base);
    const patch = wire({ v: 1, activeSheet: "T", sheets: {
        S: { set: { B2: { value: "new" }, D4: { value: "=A1" } }, del: ["C3", "Z9"], props: { rowCount: 50 }, unset: ["pivotConfig", "absent"] },
        Missing: { set: { A1: { value: "x" } } }
    } });
    const next = applyPatchToSaved(base, patch);
    assert.deepEqual(next, onServer(base, patch));
    assert.deepEqual(base, frozen);
    // Untouched parts are shared, not copied.
    assert.equal(next.T, base.T);
    assert.equal(next.S.cells.A1, base.S.cells.A1);
    assert.equal(next.S.merges, base.S.merges);
    // A patch that changes nothing hands back the same workbook.
    assert.equal(applyPatchToSaved(base, wire({ v: 1, sheets: {} })), base);
    assert.equal(applyPatchToSaved(base, wire({ v: 1, sheets: { S: { del: ["Z9"], unset: ["absent"] } } })), base);
});

test("with nothing unsaved, the screen simply becomes the server's workbook", () => {
    const saved = { S: sheet({ A1: { value: "1" } }), T: sheet({}) };
    const patch = wire({ v: 1, sheets: { S: { set: { B2: { value: "theirs" } }, props: { rowCount: 60 } } } });
    const result = rebaseRemotePatch(saved, saved, patch);
    assert.deepEqual(result.saved, onServer(saved, patch));
    assert.equal(result.live.S, result.saved.S);
    assert.equal(result.live.T, saved.T);
    assert.deepEqual(unsaved(result.saved, result.live), { v: 1, sheets: {} });
});

test("unsaved edits survive; everything else is taken", () => {
    const saved = { S: sheet({ A1: { value: "1" }, B2: { value: "2" }, C3: { value: "3" }, D4: { value: "4" } }, { rowCount: 30, columnWidths: { A: 80 } }) };
    // Mine, unsaved: A1 edited, C3 deleted, E5 added, column widths changed.
    const mine = edit(saved, "S", { A1: { value: "mine" }, C3: null, E5: { value: "mine too" } }, { columnWidths: { A: 120 } });
    const myChanges = unsaved(saved, mine);
    // Theirs, saved: A1 and C3 (which I also touched), B2 and F6 (which I didn't), E5 (which I added), and both settings.
    const patch = wire({ v: 1, sheets: { S: {
        set: { A1: { value: "theirs" }, C3: { value: "theirs" }, B2: { value: "theirs" }, F6: { value: "theirs" }, E5: { value: "theirs" } },
        del: ["D4"],
        props: { rowCount: 99, columnWidths: { A: 10 } }
    } } });

    const { live, saved: nextSaved } = rebaseRemotePatch(mine, saved, patch);
    assert.deepEqual(nextSaved, onServer(saved, patch));
    assert.deepEqual(live.S.cells, {
        A1: { value: "mine" }, E5: { value: "mine too" },   // mine kept (C3 stays deleted)
        B2: { value: "theirs" }, F6: { value: "theirs" }    // theirs taken (D4 gone)
    });
    assert.equal(live.S.rowCount, 99);
    assert.deepEqual(live.S.columnWidths, { A: 120 });
    // What is still unsaved is exactly what was unsaved before...
    assert.deepEqual(unsaved(nextSaved, live), myChanges);
    // ...and saving it gives everyone the workbook on my screen.
    assert.deepEqual(onServer(saved, patch, unsaved(nextSaved, live)), json(live));
    // Taken cells are the very objects the saved copy holds.
    assert.equal(live.S.cells.B2, nextSaved.S.cells.B2);
});

test("a sheet with unsaved settings but no unsaved cells shares the server's cell map", () => {
    const saved = { S: sheet({ A1: { value: "1" } }) };
    const mine = { S: { ...saved.S, rowHeights: { 1: 40 } } };
    const patch = wire({ v: 1, sheets: { S: { set: { B2: { value: "theirs" } } } } });
    const { live, saved: nextSaved } = rebaseRemotePatch(mine, saved, patch);
    assert.equal(live.S.cells, nextSaved.S.cells);
    assert.deepEqual(live.S.rowHeights, { 1: 40 });
    assert.deepEqual(unsaved(nextSaved, live), { v: 1, sheets: { S: { props: { rowHeights: { 1: 40 } } } } });
});

test("a sheet I removed or renamed without saving is left alone on screen", () => {
    const saved = { S: sheet({ A1: { value: "1" } }), T: sheet({}) };
    const mine = { Renamed: saved.S, T: saved.T };
    const patch = wire({ v: 1, sheets: { S: { set: { A1: { value: "theirs" } } }, T: { set: { A1: { value: "theirs" } } } } });
    const { live, saved: nextSaved } = rebaseRemotePatch(mine, saved, patch);
    assert.deepEqual(nextSaved, onServer(saved, patch));
    assert.equal(live.Renamed, saved.S);
    assert.deepEqual(live.T.cells, { A1: { value: "theirs" } });
    assert.deepEqual(Object.keys(live), ["Renamed", "T"]);
    // The rename still needs a full save.
    assert.equal(unsaved(nextSaved, live), null);
});

test("a patch that changes nothing on screen hands back the same workbook", () => {
    const saved = { S: sheet({ A1: { value: "1" } }) };
    const mine = edit(saved, "S", { A1: { value: "mine" } });
    assert.equal(rebaseLive(mine, saved, wire({ v: 1, sheets: { S: { set: { A1: { value: "theirs" } } } } })), mine);
    assert.equal(rebaseLive(mine, saved, wire({ v: 1, sheets: {} })), mine);
});

test("a save that was overtaken is rebuilt on top of what it missed", () => {
    const saved = { S: sheet({ A1: { value: "1" }, B2: { value: "2" } }) };
    const snapshot = edit(saved, "S", { A1: { value: "mine" } });
    const missed = [
        { patch: wire({ v: 1, sheets: { S: { set: { B2: { value: "theirs" }, C3: { value: "first" } } } } }) },
        { patch: wire({ v: 1, sheets: { S: { set: { C3: { value: "second" } }, del: ["B2"] } } }) }
    ];
    // The grid takes them into what's on screen and its saved copy...
    const state = rebaseRemotePatches(snapshot, saved, missed);
    // ...and separately carries the workbook it was saving over them.
    const rebuilt = rebaseSnapshot(snapshot, saved, missed);
    assert.deepEqual(rebuilt, state.live);
    const retry = unsaved(state.saved, rebuilt);
    assert.deepEqual(retry, { v: 1, sheets: { S: { set: { A1: { value: "mine" } } } } });
    assert.deepEqual(onServer(saved, missed[0].patch, missed[1].patch, retry).S.cells, { A1: { value: "mine" }, C3: { value: "second" } });
});

// --- Random sessions ----------------------------------------------------------------

// Small deterministic generator, so a failure can be reproduced from its seed.
const rng = (seed) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
};
const CELL_IDS = ["A1", "A2", "B1", "B2", "C1", "C2", "D5", "E9"];
const SETTINGS = ["rowCount", "columnWidths", "rowHeights", "hiddenRows"];
const randomEdit = (workbook, random) => {
    const names = Object.keys(workbook);
    const name = names[Math.floor(random() * names.length)];
    const changes = {};
    const props = {};
    for (let i = 0, n = 1 + Math.floor(random() * 3); i < n; i++) {
        const id = CELL_IDS[Math.floor(random() * CELL_IDS.length)];
        changes[id] = random() < 0.25 ? null : { value: String(Math.floor(random() * 1000)) };
    }
    if (random() < 0.3) {
        const key = SETTINGS[Math.floor(random() * SETTINGS.length)];
        props[key] = key === "rowCount" ? 30 + Math.floor(random() * 50) : { [Math.floor(random() * 5)]: Math.floor(random() * 200) };
    }
    return edit(workbook, name, changes, props);
};

test("random sessions: everyone who has saved everything ends up with the server's workbook", () => {
    for (let seed = 1; seed <= 60; seed++) {
        const random = rng(seed);
        const start = { S: sheet({ A1: { value: "1" }, B2: { value: "2" } }), T: sheet({ C1: { value: "3" } }) };
        let server = json(start);
        const log = []; // every patch the server accepted, in order
        const clients = [0, 1, 2].map(() => {
            const copy = json(start);
            return { live: copy, saved: copy, seen: 0 };
        });
        const catchUp = (client) => {
            const missed = log.slice(client.seen).map((patch) => ({ patch: json(patch) }));
            Object.assign(client, rebaseRemotePatches(client.live, client.saved, missed), { seen: log.length });
        };
        const save = (client) => {
            catchUp(client); // a save is only accepted against the latest version
            const patch = unsaved(client.saved, client.live);
            assert.notEqual(patch, null, `seed ${seed}`);
            if (Object.keys(patch.sheets).length === 0) return;
            server = onServer(server, wire(patch));
            log.push(patch);
            client.saved = client.live;
            client.seen = log.length;
        };

        for (let step = 0; step < 40; step++) {
            const client = clients[Math.floor(random() * clients.length)];
            const action = random();
            if (action < 0.55) client.live = randomEdit(client.live, random);
            else if (action < 0.8) save(client);
            else catchUp(client);
            // Whatever has happened, the saved copy is the server's workbook as of the
            // patches this client has seen.
            assert.deepEqual(json(client.saved), onServer(start, ...log.slice(0, client.seen)), `seed ${seed} step ${step}`);
        }
        for (const client of clients) save(client);
        for (const client of clients) catchUp(client);
        for (const client of clients) {
            assert.deepEqual(json(client.live), server, `seed ${seed}`);
            assert.deepEqual(json(client.saved), server, `seed ${seed}`);
            assert.deepEqual(unsaved(client.saved, client.live), { v: 1, sheets: {} }, `seed ${seed}`);
        }
    }
});
