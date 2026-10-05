// Run with: node --test --experimental-test-module-mocks test/sheetController.test.js
//
// The meeting sheet endpoints (controllers/dailyMorningMeeting.controller.js) with the
// database replaced by a stand-in: opening a meeting with the workbook passed through
// untouched, catching up on missed saves, and what a save reports and announces.
process.env.JWT_SECRET = "test-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.SHEET_PATCH_SAVE = "true";
process.env.SHEET_LIVE_SYNC = "true";
process.env.SHEET_RAW_OPEN = "true";

import test, { mock } from "node:test";
import assert from "node:assert/strict";
import zlib from "zlib";

const workbook = {
    sheets: { "Sheet 1": { cells: { A1: { value: "₹ 1" }, B2: { value: "=A1" } }, rowCount: 30, columnCount: 15 } },
    activeSheet: "Sheet 1"
};
const metaRow = (extra = {}) => ({
    id: 19, sectionId: 4, agenda: "Daily", description: null,
    meetingDate: new Date(2026, 9, 5), meetingTime: new Date(1970, 0, 1, 9, 30),
    createdBy: 1, createdByName: "Asha", createdAt: new Date(0), updatedAt: new Date(0),
    fileProvider: "LOCAL_JSON", version: 7, ...extra
});

// What the stand-in database holds, set by each test.
const db = { stored: null, patchesAfter: undefined, appendResult: undefined, updateResult: undefined, workbookReads: 0 };
const announced = [];

mock.module("../models/dailyMorningMeeting.model.js", {
    defaultExport: {
        findMetaById: async () => (db.stored ? metaRow({ version: db.stored.row.version }) : null),
        findStoredById: async () => { db.workbookReads++; return db.stored; },
        findById: async () => {
            db.workbookReads++;
            if (!db.stored) return null;
            const { sheetDataGz, ...row } = db.stored.row;
            return { ...row, sheetData: sheetDataGz ? zlib.gunzipSync(sheetDataGz).toString("utf8") : row.sheetData };
        },
        findPatchesAfter: async () => db.patchesAfter,
        appendPatch: async () => db.appendResult,
        updateSheetData: async () => db.updateResult,
    }
});
mock.module("../services/sheetLiveSync.js", {
    namedExports: {
        liveSyncEnabled: () => true,
        broadcastPatch: (meetingId, payload) => announced.push({ event: "patch", meetingId, ...payload }),
        broadcastReplaced: (meetingId, payload) => announced.push({ event: "replaced", meetingId, ...payload }),
    }
});
mock.module("../utils/dailyMeetingAccess.util.js", { namedExports: { canModifyDailyMeetingSection: async () => true } });
mock.module("../db/mssqlHelper.js", { namedExports: { executeQuery: async () => [[], {}] } });
mock.module("../services/microsoftGraph.service.js", { defaultExport: { isConfigured: () => false } });

const controller = await import("../controllers/dailyMorningMeeting.controller.js");

// Enough of an Express request/response to run a handler and see what it sent.
const call = async (handler, { params = { id: "19" }, query = {}, body = {}, fresh = false } = {}) => {
    const res = {
        statusCode: 200, headers: {}, chunks: [], ended: false,
        set(name, value) { res.headers[name.toLowerCase()] = value; return res; },
        status(code) { res.statusCode = code; return res; },
        type() { return res; },
        write(chunk) { res.chunks.push(chunk); return true; },
        end(chunk) { if (chunk) res.chunks.push(chunk); res.ended = true; return res; },
        json(value) { res.chunks.push(JSON.stringify(value)); res.ended = true; return res; },
    };
    const req = { params, query, body, fresh, headers: { "content-length": "123" }, user: { id: 1, fullName: "Asha" } };
    await handler(req, res);
    const text = res.chunks.join("");
    return { status: res.statusCode, headers: res.headers, text, body: text ? JSON.parse(text) : null };
};

const storedAs = ({ gz = false, json = JSON.stringify(workbook), patchRows = [], version = 7 } = {}) => {
    db.stored = {
        row: { ...metaRow({ version }), sheetData: gz ? "{}" : json, sheetDataGz: gz ? zlib.gzipSync(json) : null },
        patchRows
    };
};

test("opening a meeting raw sends the stored workbook untouched, in a valid response", async () => {
    for (const gz of [false, true]) {
        storedAs({ gz });
        const normal = await call(controller.getMeetingDetail);
        const raw = await call(controller.getMeetingDetail, { query: { workbook: "raw" } });
        assert.equal(raw.status, 200);
        assert.equal(raw.headers.etag, normal.headers.etag);
        assert.equal(raw.headers["cache-control"], "private, no-cache");
        const { workbook: sent, ...meeting } = raw.body.data;
        const { sheets, activeSheet, ...normalMeeting } = normal.body.data;
        assert.deepEqual(sent, workbook);
        assert.deepEqual({ sheets: sent.sheets, activeSheet: sent.activeSheet }, { sheets, activeSheet });
        assert.deepEqual(meeting, normalMeeting);
        assert.deepEqual(meeting.capabilities, { patchSave: true, autosave: false, liveSync: true });
        // The stored text is in the response character for character.
        assert.ok(raw.text.includes(`,"workbook":${JSON.stringify(workbook)}}}`));
    }
});

test("raw is only used when it can be: otherwise the usual response is sent", async () => {
    // Patches waiting to be folded in: the stored workbook isn't current.
    storedAs({ patchRows: [{ version: 7, patch: Buffer.alloc(0) }] });
    assert.equal((await call(controller.getMeetingDetail, { query: { workbook: "raw" } })).body.data.workbook, undefined);
    // A superseded patch row doesn't count.
    storedAs({ patchRows: [{ version: 5, patch: Buffer.alloc(0) }] });
    assert.deepEqual((await call(controller.getMeetingDetail, { query: { workbook: "raw" } })).body.data.workbook, workbook);
    // Not asked for.
    storedAs();
    assert.equal((await call(controller.getMeetingDetail)).body.data.workbook, undefined);
    // Stored content that isn't a JSON object.
    for (const json of ["", "null", "[]", "not json"]) {
        storedAs({ json });
        const res = await call(controller.getMeetingDetail, { query: { workbook: "raw" } });
        assert.equal(res.body.data.workbook, undefined, json);
        assert.ok(res.body.data.sheets["Sheet 1"], json);
    }
    // An empty meeting is passed through as it is; the client fills in the default sheet.
    storedAs({ json: "{}" });
    assert.deepEqual((await call(controller.getMeetingDetail, { query: { workbook: "raw" } })).body.data.workbook, {});
});

test("an unchanged meeting is answered 304 without reading the workbook, raw or not", async () => {
    storedAs();
    db.workbookReads = 0;
    for (const query of [{ workbook: "raw" }, {}]) {
        const res = await call(controller.getMeetingDetail, { query, fresh: true });
        assert.equal(res.status, 304);
        assert.equal(res.text, "");
        assert.ok(res.headers.etag);
    }
    assert.equal(db.workbookReads, 0);
});

test("a missing meeting is 404", async () => {
    db.stored = null;
    assert.equal((await call(controller.getMeetingDetail, { query: { workbook: "raw" } })).status, 404);
});

test("catching up: the missed patches, 410 when they are gone, 400 and 404 for bad requests", async () => {
    const patches = [{ version: 8, patch: { v: 1, sheets: {} }, userId: 2, userName: "Ravi" }];
    db.patchesAfter = { version: 8, patches };
    const ok = await call(controller.getMeetingPatchesAfter, { query: { after: "7" } });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.data, { version: 8, patches });
    assert.equal(ok.headers["cache-control"], "no-store");

    db.patchesAfter = { version: 12, patches: null };
    const gone = await call(controller.getMeetingPatchesAfter, { query: { after: "7" } });
    assert.equal(gone.status, 410);
    assert.equal(gone.body.data.version, 12);

    db.patchesAfter = null;
    assert.equal((await call(controller.getMeetingPatchesAfter, { query: { after: "7" } })).status, 404);
    for (const after of [undefined, "", "abc", "-1", "1.5"]) {
        assert.equal((await call(controller.getMeetingPatchesAfter, { query: { after } })).status, 400, String(after));
    }
});

test("a patch save reports and announces the version it produced, not a later one", async () => {
    storedAs();
    const patch = { v: 1, sheets: { "Sheet 1": { set: { C3: { value: "x" } } } } };
    // Another save landed right behind this one: the row read back is already at v9.
    db.appendResult = metaRow({ version: 9 });
    announced.length = 0;
    const res = await call(controller.saveMeetingSheetPatch, { body: { patch, version: 7, clientId: "grid-a" } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.version, 8);
    assert.deepEqual(announced, [{ event: "patch", meetingId: "19", version: 8, patch, user: { id: 1, fullName: "Asha" }, clientId: "grid-a" }]);

    // Someone else got in first: refused, and nothing is announced.
    db.appendResult = null;
    announced.length = 0;
    assert.equal((await call(controller.saveMeetingSheetPatch, { body: { patch, version: 7 } })).status, 409);
    assert.deepEqual(announced, []);

    // Malformed requests never reach the database.
    assert.equal((await call(controller.saveMeetingSheetPatch, { body: { patch } })).status, 400);
    assert.equal((await call(controller.saveMeetingSheetPatch, { body: { patch: { v: 2 }, version: 7 } })).status, 400);
});

test("a full save reports and announces its version the same way", async () => {
    storedAs();
    db.updateResult = metaRow({ version: 9 });
    announced.length = 0;
    const res = await call(controller.saveMeetingSheet, { body: { ...workbook, version: 7, clientId: "grid-b" } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.version, 8);
    assert.deepEqual(announced.map(({ event, version, clientId }) => ({ event, version, clientId })), [{ event: "replaced", version: 8, clientId: "grid-b" }]);

    // A client from before versions existed sends none: the row's version is all there is.
    announced.length = 0;
    assert.equal((await call(controller.saveMeetingSheet, { body: { ...workbook } })).body.data.version, 9);
    assert.equal(announced[0].version, 9);

    db.updateResult = null;
    announced.length = 0;
    assert.equal((await call(controller.saveMeetingSheet, { body: { ...workbook, version: 7 } })).status, 409);
    assert.deepEqual(announced, []);
});
