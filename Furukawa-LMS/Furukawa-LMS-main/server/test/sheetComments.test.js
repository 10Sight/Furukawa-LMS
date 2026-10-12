// Run with: node --test --experimental-test-module-mocks test/sheetComments.test.js
//
// The cell comment endpoints (controllers/sheetComment.controller.js) with the database
// replaced by a stand-in: who may do what to a comment, whose name goes on it, and what
// everyone else with the meeting open is told.
process.env.JWT_SECRET = "test-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { withoutCommentAnchors, commentThreadIdsOf, withCopiedCommentAnchors } from "../utils/sheetWorkbook.js";

const ADMIN = { id: 1, fullName: "Asha Admin", role: "ADMIN", isAdmin: true };
const EDITOR = { id: 2, fullName: "Esha Editor", role: "CUSTOM" };
const READER = { id: 3, userName: "ravi", role: "CUSTOM" };

// The stand-in database: threads by id, each with its messages.
const db = { threads: new Map(), nextMessageId: 1, canModify: true };
const announced = [];
const copy = (value) => (value ? JSON.parse(JSON.stringify(value)) : value);
const reset = () => { db.threads.clear(); db.nextMessageId = 1; db.canModify = true; announced.length = 0; };

mock.module("../models/dailyMorningMeeting.model.js", {
    defaultExport: { findMetaById: async (id) => (String(id) === "19" ? { id: 19, sectionId: 4 } : null) }
});
mock.module("../models/sheetComment.model.js", {
    defaultExport: {
        findByMeetingId: async (meetingId) => copy([...db.threads.values()].filter((t) => t.meetingId === meetingId)),
        findThreadById: async (id) => copy(db.threads.get(id) || null),
        createThread: async ({ id, meetingId, sheetName, cellRef, authorId, authorName, text }) => {
            if (db.threads.has(id)) return null;
            db.threads.set(id, {
                id, meetingId, sheetName, cellRef, status: "open", createdBy: authorId, createdByName: authorName,
                resolvedBy: null, resolvedByName: null,
                messages: [{ id: db.nextMessageId++, threadId: id, authorId, authorName, text, editedAt: null }]
            });
            return copy(db.threads.get(id));
        },
        addMessage: async (threadId, { authorId, authorName, text }) => {
            db.threads.get(threadId).messages.push({ id: db.nextMessageId++, threadId, authorId, authorName, text, editedAt: null });
            return copy(db.threads.get(threadId));
        },
        updateMessage: async (messageId, text) => {
            for (const thread of db.threads.values()) {
                for (const message of thread.messages) if (message.id === messageId) Object.assign(message, { text, editedAt: "now" });
            }
        },
        deleteMessage: async (messageId) => {
            for (const thread of db.threads.values()) thread.messages = thread.messages.filter((m) => m.id !== messageId);
        },
        setStatus: async (threadId, status, { userId, userName }) => {
            Object.assign(db.threads.get(threadId), status === "resolved"
                ? { status, resolvedBy: userId, resolvedByName: userName }
                : { status, resolvedBy: null, resolvedByName: null });
            return copy(db.threads.get(threadId));
        },
        deleteThread: async (threadId) => { db.threads.delete(threadId); },
    }
});
mock.module("../services/sheetLiveSync.js", {
    namedExports: { broadcastComment: (meetingId, payload) => announced.push({ meetingId, ...payload }) }
});
mock.module("../utils/dailyMeetingAccess.util.js", {
    namedExports: {
        canModifyDailyMeetingSection: async () => db.canModify,
        isDailyMeetingAdmin: (user) => user?.role === "ADMIN" || user?.isAdmin === true
    }
});

const controller = await import("../controllers/sheetComment.controller.js");

const call = async (handler, user, { params = {}, body = {} } = {}) => {
    const res = {
        statusCode: 200, headers: {}, sent: null,
        set(name, value) { res.headers[name.toLowerCase()] = value; return res; },
        status(code) { res.statusCode = code; return res; },
        json(value) { res.sent = copy(value); return res; },
    };
    await handler({ params: { id: "19", ...params }, body, user }, res);
    return { status: res.statusCode, headers: res.headers, body: res.sent };
};
const THREAD = "thread-0001";
const start = (user = EDITOR, body = {}) => call(controller.createCommentThread, user, {
    body: { threadId: THREAD, sheetName: "Sheet 1", cellRef: "B4", text: "  Check this value  ", ...body }
});

test("starting a thread stores it under the logged-in user and announces it", async () => {
    reset();
    const res = await start(EDITOR, { authorId: 99, authorName: "Someone Else" });
    assert.equal(res.status, 201);
    const { thread } = res.body.data;
    assert.equal(thread.createdBy, 2);
    assert.equal(thread.createdByName, "Esha Editor");
    assert.deepEqual(thread.messages.map((m) => [m.authorId, m.authorName, m.text]), [[2, "Esha Editor", "Check this value"]]);
    assert.deepEqual(announced, [{ meetingId: 19, thread }]);

    // The same id again is refused rather than overwritten.
    assert.equal((await start(ADMIN)).status, 409);
    assert.equal(announced.length, 1);
});

test("starting a thread needs the right to save that section's sheet, and well-formed input", async () => {
    reset();
    db.canModify = false;
    assert.equal((await start()).status, 403);
    db.canModify = true;
    assert.equal((await call(controller.createCommentThread, EDITOR, { params: { id: "404" }, body: { threadId: THREAD, sheetName: "S", cellRef: "A1", text: "x" } })).status, 404);
    for (const body of [
        { threadId: "short" }, { threadId: "has spaces in it" }, { threadId: undefined },
        { sheetName: "" }, { sheetName: 5 }, { sheetName: "x".repeat(256) },
        { cellRef: "b4" }, { cellRef: "A0" }, { cellRef: "__proto__" },
        { text: "   " }, { text: 7 }, { text: "x".repeat(4001) },
    ]) {
        assert.equal((await start(EDITOR, body)).status, 400, JSON.stringify(body));
    }
    assert.equal(db.threads.size, 0);
    assert.equal(announced.length, 0);
});

test("anyone who can open the meeting can list, reply and resolve", async () => {
    reset();
    await start();
    announced.length = 0;

    const reply = await call(controller.addCommentReply, READER, { params: { threadId: THREAD }, body: { text: "Done" } });
    assert.equal(reply.status, 201);
    assert.deepEqual(reply.body.data.thread.messages.map((m) => [m.authorName, m.text]), [["Esha Editor", "Check this value"], ["ravi", "Done"]]);

    const resolved = await call(controller.setCommentStatus, READER, { params: { threadId: THREAD }, body: { status: "resolved" } });
    assert.equal(resolved.body.data.thread.status, "resolved");
    assert.equal(resolved.body.data.thread.resolvedByName, "ravi");
    // Resolving what is already resolved changes nothing and tells no one.
    await call(controller.setCommentStatus, ADMIN, { params: { threadId: THREAD }, body: { status: "resolved" } });
    assert.equal(db.threads.get(THREAD).resolvedByName, "ravi");
    const reopened = await call(controller.setCommentStatus, READER, { params: { threadId: THREAD }, body: { status: "open" } });
    assert.equal(reopened.body.data.thread.resolvedBy, null);
    assert.deepEqual(announced.map((a) => a.thread.status), ["open", "resolved", "open"]);

    assert.equal((await call(controller.setCommentStatus, READER, { params: { threadId: THREAD }, body: { status: "closed" } })).status, 400);
    assert.equal((await call(controller.addCommentReply, READER, { params: { threadId: THREAD }, body: { text: "" } })).status, 400);

    const list = await call(controller.getMeetingComments, READER);
    assert.equal(list.headers["cache-control"], "no-store");
    assert.equal(list.body.data.threads.length, 1);
    assert.equal(list.body.data.threads[0].messages.length, 2);
    assert.equal((await call(controller.getMeetingComments, READER, { params: { id: "404" } })).status, 404);
});

test("a thread is only reachable through the meeting it belongs to", async () => {
    reset();
    await start();
    for (const params of [{ id: "20", threadId: THREAD }, { threadId: "thread-9999" }, { threadId: "bad id" }]) {
        assert.equal((await call(controller.addCommentReply, ADMIN, { params, body: { text: "x" } })).status, 404, JSON.stringify(params));
        assert.equal((await call(controller.deleteCommentThread, ADMIN, { params })).status, 404, JSON.stringify(params));
    }
    assert.equal(db.threads.get(THREAD).messages.length, 1);
});

test("only the author edits a message; the author or an admin deletes it", async () => {
    reset();
    await start();
    await call(controller.addCommentReply, READER, { params: { threadId: THREAD }, body: { text: "A reply" } });
    const [first, reply] = db.threads.get(THREAD).messages.map((m) => String(m.id));
    announced.length = 0;
    const at = (messageId) => ({ threadId: THREAD, messageId });

    assert.equal((await call(controller.editCommentMessage, ADMIN, { params: at(reply), body: { text: "Hijacked" } })).status, 403);
    assert.equal((await call(controller.editCommentMessage, READER, { params: at("999"), body: { text: "x" } })).status, 404);
    const edited = await call(controller.editCommentMessage, READER, { params: at(reply), body: { text: "A better reply" } });
    assert.equal(edited.body.data.thread.messages[1].text, "A better reply");
    assert.ok(edited.body.data.thread.messages[1].editedAt);

    assert.equal((await call(controller.deleteCommentMessage, EDITOR, { params: at(reply) })).status, 403);
    assert.equal((await call(controller.deleteCommentThread, READER, { params: { threadId: THREAD } })).status, 403);
    const removedReply = await call(controller.deleteCommentMessage, ADMIN, { params: at(reply) });
    assert.equal(removedReply.body.data.thread.messages.length, 1);
    assert.equal(announced.length, 2);

    // Deleting the first message deletes the comment.
    const removed = await call(controller.deleteCommentMessage, EDITOR, { params: at(first) });
    assert.deepEqual(removed.body.data, { threadId: THREAD, deleted: true });
    assert.equal(db.threads.size, 0);
    assert.deepEqual(announced[2], { meetingId: 19, threadId: THREAD });
});

test("a thread is deleted by whoever started it, or an admin", async () => {
    reset();
    await start();
    assert.equal((await call(controller.deleteCommentThread, EDITOR, { params: { threadId: THREAD } })).status, 200);
    await start();
    assert.equal((await call(controller.deleteCommentThread, ADMIN, { params: { threadId: THREAD } })).status, 200);
    assert.equal(db.threads.size, 0);
});

test("a workbook can be stripped of its comment anchors", () => {
    const workbook = {
        activeSheet: "S",
        sheets: {
            S: { cells: { A1: { value: "1" } }, rowCount: 30, commentAnchors: { A1: "thread-0001" } },
            T: { cells: {}, rowCount: 30 }
        }
    };
    const expected = { activeSheet: "S", sheets: { S: { cells: { A1: { value: "1" } }, rowCount: 30 }, T: workbook.sheets.T } };
    assert.deepEqual(withoutCommentAnchors(workbook), expected);
    assert.deepEqual(withoutCommentAnchors(JSON.stringify(workbook)), expected);
    assert.equal(withoutCommentAnchors(workbook).sheets.T, workbook.sheets.T);
    assert.ok(workbook.sheets.S.commentAnchors, "the source is left as it was");
    // Nothing to strip: handed back untouched, whatever it is.
    const plain = JSON.stringify({ sheets: { S: { cells: {} } }, activeSheet: "S" });
    assert.equal(withoutCommentAnchors(plain), plain);
    for (const empty of ["{}", {}, null, "not json"]) assert.equal(withoutCommentAnchors(empty), empty);
});

// --- Several threads at once: the comments of pasted cells ---

const startSeveral = (user, threads, params) => call(controller.createCommentThreads, user, { params, body: { threads } });
const copied = (n, extra = {}) => ({ threadId: `thread-copy-${String(n).padStart(3, "0")}`, sheetName: "Sheet 1", cellRef: `D${n}`, text: `Asha: note ${n}`, ...extra });

test("pasted cells' comments are started together, each announced, under whoever pasted", async () => {
    reset();
    const res = await startSeveral(EDITOR, [copied(1), copied(2, { authorName: "Someone Else" }), copied(3)]);
    assert.equal(res.status, 201);
    const { threads } = res.body.data;
    assert.deepEqual(threads.map((t) => [t.id, t.cellRef, t.createdByName, t.messages[0].text]), [
        ["thread-copy-001", "D1", "Esha Editor", "Asha: note 1"],
        ["thread-copy-002", "D2", "Esha Editor", "Asha: note 2"],
        ["thread-copy-003", "D3", "Esha Editor", "Asha: note 3"],
    ]);
    assert.deepEqual(announced, threads.map((thread) => ({ meetingId: 19, thread })));

    // An id that is already taken is left out; the rest still go in.
    announced.length = 0;
    const again = await startSeveral(ADMIN, [copied(3), copied(4)]);
    assert.equal(again.status, 201);
    assert.deepEqual(again.body.data.threads.map((t) => t.id), ["thread-copy-004"]);
    assert.equal(db.threads.get("thread-copy-003").createdByName, "Esha Editor");
    assert.equal(announced.length, 1);
});

test("starting several threads is all or nothing on bad input, and takes the right to save", async () => {
    reset();
    for (const threads of [
        undefined, "nope", [],
        Array.from({ length: 201 }, (_, i) => copied(i + 1)),
        [copied(1), null],
        [copied(1), copied(1)],
        [copied(1), copied(2, { threadId: "short" })],
        [copied(1), copied(2, { sheetName: "" })],
        [copied(1), copied(2, { cellRef: "__proto__" })],
        [copied(1), copied(2, { text: "   " })],
        [copied(1), copied(2, { text: "x".repeat(4001) })],
    ]) {
        assert.equal((await startSeveral(EDITOR, threads)).status, 400, JSON.stringify(threads)?.slice(0, 80));
    }
    db.canModify = false;
    assert.equal((await startSeveral(EDITOR, [copied(1)])).status, 403);
    db.canModify = true;
    assert.equal((await startSeveral(EDITOR, [copied(1)], { id: "404" })).status, 404);
    assert.equal(db.threads.size, 0);
    assert.equal(announced.length, 0);

    assert.equal((await startSeveral(EDITOR, Array.from({ length: 200 }, (_, i) => copied(i + 1)))).body.data.threads.length, 200);
});

test("a copied meeting's workbook is anchored to the copies of its threads", () => {
    const workbook = {
        activeSheet: "S",
        sheets: {
            S: { cells: { A1: { value: "1" } }, rowCount: 30, commentAnchors: { A1: "thread-0001", B2: "thread-gone" } },
            T: { cells: {}, rowCount: 30 }
        }
    };
    assert.deepEqual([...commentThreadIdsOf(workbook)], ["thread-0001", "thread-gone"]);
    assert.deepEqual([...commentThreadIdsOf(JSON.stringify(workbook))], ["thread-0001", "thread-gone"]);
    for (const none of ["{}", {}, null, "not json", { sheets: { S: { cells: {} } } }]) assert.equal(commentThreadIdsOf(none).size, 0);

    const copied = withCopiedCommentAnchors(workbook, new Map([["thread-0001", "thread-9001"]]));
    // The anchor follows its thread's copy; one whose thread has no copy is dropped.
    assert.deepEqual(copied.sheets.S.commentAnchors, { A1: "thread-9001" });
    assert.deepEqual(copied.sheets.S.cells, workbook.sheets.S.cells);
    assert.equal(copied.sheets.T, workbook.sheets.T);
    assert.deepEqual(workbook.sheets.S.commentAnchors, { A1: "thread-0001", B2: "thread-gone" }, "the source is left as it was");
    assert.deepEqual(withCopiedCommentAnchors(JSON.stringify(workbook), new Map([["thread-0001", "thread-9001"]])), copied);
    const plain = JSON.stringify({ sheets: { S: { cells: {} } }, activeSheet: "S" });
    assert.equal(withCopiedCommentAnchors(plain, new Map()), plain);
});
