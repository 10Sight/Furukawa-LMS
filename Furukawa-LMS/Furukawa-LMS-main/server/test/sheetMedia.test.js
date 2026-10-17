// Run with: node --test --experimental-test-module-mocks test/sheetMedia.test.js
//
// Videos uploaded for a spreadsheet (controllers/sheetMedia.controller.js,
// middlewares/sheetMedia.middleware.js): who may upload one to a meeting, which
// files are taken, and that a refused upload leaves nothing stored.
process.env.SHEET_VIDEO_MAX_BYTES = "1000";

import test, { mock } from "node:test";
import assert from "node:assert/strict";
import express from "express";

const state = { meeting: { id: 5, sectionId: 2 }, allowed: true, saved: [] };
mock.module("../models/dailyMorningMeeting.model.js", {
    defaultExport: { findMetaById: async () => state.meeting },
});
mock.module("../utils/dailyMeetingAccess.util.js", {
    namedExports: { canModifyDailyMeetingSection: async () => state.allowed },
});
mock.module("../utils/fileStorage.util.js", {
    namedExports: {
        saveToLocal: async (file, folder) => {
            state.saved.push({ name: file.originalname, folder });
            return { success: true, url: `/uploads/${folder}/stored-${file.originalname}` };
        },
    },
});

const { requireMeetingSheetWrite, uploadSheetMedia } = await import("../controllers/sheetMedia.controller.js");
const { sheetVideoUpload } = await import("../middlewares/sheetMedia.middleware.js");

const app = express();
app.use((req, res, next) => { req.user = { id: 1 }; next(); });
app.post("/meetings/:id/sheet/media", requireMeetingSheetWrite, sheetVideoUpload, uploadSheetMedia);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const send = (bytes, type, name = "clip.mp4") => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type }), name);
    return fetch(`${base}/meetings/5/sheet/media`, { method: "POST", body: form });
};

test("a video is stored and its URL answered", async () => {
    state.saved = [];
    const res = await send(500, "video/mp4");
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.deepEqual(body.data, { url: "/uploads/sheet-media/stored-clip.mp4", name: "clip.mp4", size: 500, mime: "video/mp4" });
    assert.deepEqual(state.saved, [{ name: "clip.mp4", folder: "sheet-media" }]);
});

test("a video over the limit is refused with 413", async () => {
    state.saved = [];
    const res = await send(1500, "video/mp4");
    assert.equal(res.status, 413);
    assert.match((await res.json()).message, /larger than/);
    assert.equal(state.saved.length, 0);
});

test("only video files are taken", async () => {
    state.saved = [];
    const res = await send(100, "application/pdf", "notes.pdf");
    assert.equal(res.status, 415);
    assert.equal(state.saved.length, 0);
});

test("someone who can't save the meeting's sheet can't add a video to it", async () => {
    state.saved = [];
    state.allowed = false;
    try {
        const res = await send(100, "video/mp4");
        assert.equal(res.status, 403);
        assert.equal(state.saved.length, 0);
    } finally {
        state.allowed = true;
    }
    state.meeting = null;
    try {
        assert.equal((await send(100, "video/mp4")).status, 404);
    } finally {
        state.meeting = { id: 5, sectionId: 2 };
    }
});
