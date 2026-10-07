// Run with: node --test test/sheetServer.test.js
//
// The server-side pieces around meeting sheets that need no database: the Excel
// export mapping, which patches count as pending, folding them (inline and on a worker
// thread), access-token checks, request body limits and the live-editing socket protocol.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret";

import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

const { cellKeyToPosition, cellExportValue, pendingPatchRun, foldPatches } = await import("../utils/sheetWorkbook.js");
const { gzipText, gunzipText, encodeSheetPayload, decodeSheetPayload } = await import("../utils/sheetCodec.js");
const { foldStoredPatches } = await import("../utils/sheetCompactor.js");
const { readAccessToken, isAcceptableAccessToken } = await import("../utils/accessToken.js");
const { isLargeBodyRoute, jsonBody } = await import("../middlewares/bodyLimits.middleware.js");
const { meetingRoom, isMeetingRoom, readSocketToken, cleanPresence, cleanClientId } = await import("../utils/sheetLiveProtocol.js");
const { default: ENV } = await import("../configs/env.config.js");

// --- Excel export -------------------------------------------------------------------

test("cell keys map to Excel positions", () => {
    assert.deepEqual(cellKeyToPosition("A1"), { row: 1, col: 1 });
    assert.deepEqual(cellKeyToPosition("B7"), { row: 7, col: 2 });
    assert.deepEqual(cellKeyToPosition("Z1"), { row: 1, col: 26 });
    assert.deepEqual(cellKeyToPosition("AA10"), { row: 10, col: 27 });
    assert.deepEqual(cellKeyToPosition("XFD1048576"), { row: 1048576, col: 16384 });
    // The old "row,col" keys, 0-indexed.
    assert.deepEqual(cellKeyToPosition("0,0"), { row: 1, col: 1 });
    assert.deepEqual(cellKeyToPosition("6,1"), { row: 7, col: 2 });
    for (const bad of ["", "A0", "a1", "1A", "A", "7", "A1:B2", "-1,2", "__proto__"]) {
        assert.equal(cellKeyToPosition(bad), null, bad);
    }
});

test("cell values export the way the grid's own export writes them", () => {
    assert.equal(cellExportValue({ value: "hello" }), "hello");
    assert.equal(cellExportValue({ value: "42" }), 42);
    assert.equal(cellExportValue({ value: " 3.5 " }), 3.5);
    assert.equal(cellExportValue({ value: 7 }), 7);
    assert.deepEqual(cellExportValue({ value: "=A1+B1" }), { formula: "A1+B1" });
    assert.deepEqual(cellExportValue({ value: "  =SUM(A1:A3)" }), { formula: "SUM(A1:A3)" });
    // Old shape, with the formula in its own field.
    assert.deepEqual(cellExportValue({ formula: "=A1*2", value: "4" }), { formula: "A1*2" });
    assert.deepEqual(cellExportValue({ formula: "A1*2" }), { formula: "A1*2" });
    // Formatting-only and empty cells write nothing.
    for (const empty of [{ bold: true }, { value: "" }, { value: null }, { value: "=" }, null, "x", []]) {
        assert.equal(cellExportValue(empty), null);
    }
});

// --- Pending patches ----------------------------------------------------------------

test("pending patches are the unbroken run ending at the current version", () => {
    const rows = (...versions) => versions.map((version) => ({ version }));
    const run = (version, ...versions) => pendingPatchRun(version, rows(...versions)).map((r) => r.version);
    assert.deepEqual(run(5), []);
    assert.deepEqual(run(5, 5, 4, 3), [3, 4, 5]);
    assert.deepEqual(run(5, 3, 5, 4), [3, 4, 5]);
    // A full save at v4 left no patch row: v2 and v3 are superseded.
    assert.deepEqual(run(6, 2, 3, 5, 6), [5, 6]);
    // The latest save was a full save.
    assert.deepEqual(run(7, 5, 6), []);
});

const baseWorkbook = () => ({
    sheets: {
        "Sheet 1": { cells: { A1: { value: "1" }, B2: { value: "old" } }, rowCount: 30, columnCount: 15 },
        Other: { cells: {}, rowCount: 30, columnCount: 15 }
    },
    activeSheet: "Sheet 1"
});
const patchOne = { v: 1, sheets: { "Sheet 1": { set: { B2: { value: "new" }, C3: { value: "=A1" } }, props: { rowCount: 40 } } } };
const patchTwo = { v: 1, activeSheet: "Other", sheets: { "Sheet 1": { del: ["A1"] }, Gone: { set: { A1: { value: "x" } } } } };
const foldedWorkbook = () => ({
    sheets: {
        "Sheet 1": { cells: { B2: { value: "new" }, C3: { value: "=A1" } }, rowCount: 40, columnCount: 15 },
        Other: { cells: {}, rowCount: 30, columnCount: 15 }
    },
    activeSheet: "Other"
});

test("folding applies patches in order and reports sheets that are missing", () => {
    const { json, missingSheets } = foldPatches(JSON.stringify(baseWorkbook()), [JSON.stringify(patchOne), JSON.stringify(patchTwo)]);
    assert.deepEqual(JSON.parse(json), foldedWorkbook());
    assert.deepEqual(missingSheets, ["Gone"]);
    // An empty stored workbook folds onto the default one.
    assert.deepEqual(Object.keys(JSON.parse(foldPatches("{}", []).json).sheets), ["Sheet 1"]);
});

const bigWorkbookJson = (cellCount) => {
    const cells = {};
    for (let i = 0; i < cellCount; i++) cells[`A${i + 1}`] = { value: `row ${i} — ₹ ${i * 3}` };
    return JSON.stringify({ sheets: { "Sheet 1": { cells, rowCount: cellCount, columnCount: 15 } }, activeSheet: "Sheet 1" });
};

for (const inWorker of [true, false]) {
    test(`stored patches fold ${inWorker ? "on a worker thread" : "on the main thread"}`, async () => {
        const previous = ENV.SHEET_COMPACT_IN_WORKER;
        ENV.SHEET_COMPACT_IN_WORKER = inWorker;
        try {
            const patches = [await gzipText(JSON.stringify(patchOne)), await gzipText(JSON.stringify(patchTwo))];

            // Small workbook, stored as text.
            const small = await foldStoredPatches({ text: JSON.stringify(baseWorkbook()), gz: null, patches, compress: true });
            assert.equal(small.inWorker, inWorker);
            assert.equal(small.gz, null);
            assert.deepEqual(JSON.parse(small.text), foldedWorkbook());
            assert.deepEqual(small.missingSheets, ["Gone"]);

            // Large workbook, stored compressed, and written back compressed.
            const stored = await encodeSheetPayload(bigWorkbookJson(5000), { compress: true });
            assert.ok(stored.gz);
            const edit = { v: 1, sheets: { "Sheet 1": { set: { A2: { value: "edited" } }, del: ["A5000"] } } };
            const big = await foldStoredPatches({ text: stored.text, gz: stored.gz, patches: [await gzipText(JSON.stringify(edit))], compress: true });
            assert.equal(big.inWorker, inWorker);
            assert.ok(Buffer.isBuffer(big.gz));
            const result = JSON.parse(await decodeSheetPayload(big.text, big.gz));
            assert.equal(result.sheets["Sheet 1"].cells.A2.value, "edited");
            assert.equal(result.sheets["Sheet 1"].cells.A5000, undefined);
            assert.equal(result.sheets["Sheet 1"].cells.A4999.value, "row 4998 — ₹ 14994");
            assert.equal(Object.keys(result.sheets["Sheet 1"].cells).length, 4999);

            // ...or back as text when compression is switched off.
            const plain = await foldStoredPatches({ text: stored.text, gz: stored.gz, patches: [], compress: false });
            assert.equal(plain.gz, null);
            assert.equal(plain.text, await gunzipText(stored.gz));
        } finally {
            ENV.SHEET_COMPACT_IN_WORKER = previous;
        }
    });
}

// --- Access tokens ------------------------------------------------------------------

test("an access token is accepted only when it is signed with the server's secret and unexpired", () => {
    const good = jwt.sign({ id: 5 }, ENV.JWT_ACCESS_SECRET, { expiresIn: "5m" });
    assert.equal(isAcceptableAccessToken(good), true);
    assert.equal(isAcceptableAccessToken(jwt.sign({ id: 5 }, "another-secret", { expiresIn: "5m" })), false);
    assert.equal(isAcceptableAccessToken(jwt.sign({ id: 5 }, ENV.JWT_ACCESS_SECRET, { expiresIn: -10 })), false);
    for (const bad of [undefined, null, "", "not-a-token", 42, {}]) assert.equal(isAcceptableAccessToken(bad), false);

    assert.equal(readAccessToken({ cookies: { accessToken: "c" }, header: () => "Bearer h", query: { token: "q" } }), "c");
    assert.equal(readAccessToken({ cookies: {}, header: () => "Bearer h", query: { token: "q" } }), "h");
    assert.equal(readAccessToken({ cookies: {}, header: () => undefined, query: { token: "q" } }), "q");
    assert.equal(readAccessToken({ cookies: {}, header: () => undefined, query: {} }), undefined);
});

// --- Request body limits ------------------------------------------------------------

test("only the sheet save routes get the large body allowance", () => {
    assert.equal(isLargeBodyRoute("POST", "/api/daily-morning-meetings/19/sheet"), true);
    assert.equal(isLargeBodyRoute("POST", "/api/daily-morning-meetings/19/sheet/patch"), true);
    assert.equal(isLargeBodyRoute("POST", "/api/daily-meeting-sheets/save"), true);
    assert.equal(isLargeBodyRoute("GET", "/api/daily-morning-meetings/19/sheet"), false);
    assert.equal(isLargeBodyRoute("POST", "/api/daily-morning-meetings/19/clone"), false);
    assert.equal(isLargeBodyRoute("POST", "/api/daily-morning-meetings/19/sheet/patch/extra"), false);
    assert.equal(isLargeBodyRoute("POST", "/api/users"), false);
});

test("a sheet save without a valid access token is refused before its body is read", () => {
    const attempt = (headers) => {
        let status = null, nexted = false;
        const req = {
            method: "POST", path: "/api/daily-morning-meetings/19/sheet", cookies: {}, query: {},
            headers, header: (name) => headers[name.toLowerCase()]
        };
        const res = { status: (code) => { status = code; return res; }, json: () => res };
        // With a valid token the real JSON parser takes over; it is not run here.
        const refused = !isAcceptableAccessToken(readAccessToken(req));
        if (refused) jsonBody(req, res, () => { nexted = true; });
        return { refused, status, nexted };
    };
    assert.deepEqual(attempt({}), { refused: true, status: 401, nexted: false });
    assert.deepEqual(attempt({ authorization: "Bearer junk" }), { refused: true, status: 401, nexted: false });
    const good = jwt.sign({ id: 5 }, ENV.JWT_ACCESS_SECRET, { expiresIn: "5m" });
    assert.equal(attempt({ authorization: `Bearer ${good}` }).refused, false);
});

// --- Live-editing socket protocol ---------------------------------------------------

test("meeting rooms can't be confused with other rooms", () => {
    assert.equal(meetingRoom(19), "meeting:19");
    assert.equal(isMeetingRoom("meeting:19"), true);
    assert.equal(isMeetingRoom("department-3"), false);
    assert.equal(isMeetingRoom("user-7"), false);
    assert.equal(isMeetingRoom(undefined), false);
});

test("a socket's token is read from the handshake", () => {
    assert.equal(readSocketToken({ handshake: { auth: { token: "a" }, headers: { cookie: "accessToken=c" } } }), "a");
    assert.equal(readSocketToken({ handshake: { auth: { token: "Bearer a" }, headers: {} } }), "a");
    assert.equal(readSocketToken({ handshake: { auth: {}, headers: { authorization: "Bearer h" } } }), "h");
    assert.equal(readSocketToken({ handshake: { headers: { cookie: "theme=dark; accessToken=c%2B1; other=x" } } }), "c+1");
    assert.equal(readSocketToken({ handshake: { headers: { cookie: "theme=dark" } } }), null);
    assert.equal(readSocketToken({}), null);
});

test("presence and client ids from a browser are checked before being relayed", () => {
    const position = { sheet: "Sheet 1", cell: "B2", start: "B2", end: "D9" };
    assert.deepEqual(cleanPresence({ meetingId: 19, ...position, userName: "someone else", extra: 1 }), position);
    assert.equal(cleanPresence({ ...position, cell: "b2" }), null);
    assert.equal(cleanPresence({ ...position, end: "<script>" }), null);
    assert.equal(cleanPresence({ ...position, sheet: "" }), null);
    assert.equal(cleanPresence({ ...position, sheet: "x".repeat(256) }), null);
    assert.equal(cleanPresence(null), null);

    assert.equal(cleanClientId("a1B2-c3_d4"), "a1B2-c3_d4");
    assert.equal(cleanClientId("has space"), null);
    assert.equal(cleanClientId("x".repeat(65)), null);
    assert.equal(cleanClientId(123), null);
    assert.equal(cleanClientId(undefined), null);
});
