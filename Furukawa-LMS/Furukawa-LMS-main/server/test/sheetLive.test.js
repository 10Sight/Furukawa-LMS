// Run with: node --test --experimental-test-module-mocks test/sheetLive.test.js
//
// Live co-editing, server side (services/sheetLiveSync.js): who is let into a meeting's
// room, whose name goes on what they send, and who hears about a save. The database
// (the meeting model, loading a user) is replaced by stand-ins; the permission check
// and everything in sheetLiveSync itself are the real code.
process.env.JWT_SECRET = "test-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.SHEET_PATCH_SAVE = "true";
process.env.SHEET_LIVE_SYNC = "true";

import test, { mock } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

const USERS = {
    1: { id: 1, fullName: "Asha Admin", userName: "asha", role: "ADMIN", isAdmin: true },
    2: { id: 2, fullName: "Ravi Reader", userName: "ravi", role: "CUSTOM", customRole: { permissions: ["daily_meeting:read"] } },
    3: { id: 3, fullName: "Nita NoAccess", userName: "nita", role: "CUSTOM", customRole: { permissions: ["courses:read"] } },
};
const MEETINGS = { 19: { id: 19, version: 7 } };

mock.module("../models/dailyMorningMeeting.model.js", {
    defaultExport: { findMetaById: async (id) => MEETINGS[id] || null }
});
mock.module("../controllers/rolesPermissions.controller.js", {
    namedExports: { DEFAULT_ROLES: { ADMIN: { permissions: [] }, SUPERADMIN: { permissions: [] } } }
});
// Stands in for the real login check's database lookup: the token's user, if there is one.
mock.module("../middlewares/auth.middleware.js", {
    defaultExport: (req, res, next) => {
        const { id } = jwt.verify(req.cookies.accessToken, process.env.JWT_SECRET);
        if (!USERS[id]) return next(new Error("Invalid Access Token!"));
        req.user = USERS[id];
        return next();
    }
});

const { default: ENV } = await import("../configs/env.config.js");
const live = await import("../services/sheetLiveSync.js");

const tokenFor = (id, secret = ENV.JWT_ACCESS_SECRET, options = { expiresIn: "5m" }) => jwt.sign({ id }, secret, options);

// A stand-in for the Socket.IO server and its sockets: rooms, and a record of what
// each socket was sent.
const makeHub = () => {
    const sockets = new Map();
    const deliver = (room, event, data, exceptId) => {
        for (const socket of sockets.values()) {
            if (socket.id !== exceptId && socket.rooms.has(room)) socket.received.push({ event, data });
        }
    };
    const io = {
        use(middleware) { io.middleware = middleware; },
        to: (room) => ({ emit: (event, data) => deliver(room, event, data, null) }),
    };
    let nextId = 1;
    const connect = async (auth) => {
        const handlers = new Map();
        const socket = {
            id: `socket-${nextId++}`,
            handshake: { auth: auth || {}, headers: {} },
            data: {},
            rooms: new Set(),
            received: [],
            on: (event, handler) => handlers.set(event, handler),
            join: (room) => socket.rooms.add(room),
            leave: (room) => socket.rooms.delete(room),
            to: (room) => ({ emit: (event, data) => deliver(room, event, data, socket.id) }),
            // What the browser on the other end does:
            send: (event, payload) => handlers.get(event)?.(payload),
            ask: (event, payload) => new Promise((resolve) => handlers.get(event)(payload, resolve)),
            disconnect: () => { handlers.get("disconnecting")?.(); sockets.delete(socket.id); },
        };
        const refused = await new Promise((resolve) => io.middleware(socket, resolve));
        if (refused) return { refused };
        sockets.set(socket.id, socket);
        live.registerSheetSocketHandlers(socket);
        return socket;
    };
    live.initSheetLiveSync(io);
    return { connect };
};
const eventsOf = (socket, event) => socket.received.filter((r) => r.event === event).map((r) => r.data);
// Presence is rate-limited per socket; tests space their updates out.
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("a socket is who its token says, or nobody", async () => {
    const hub = makeHub();
    assert.equal((await hub.connect({ token: tokenFor(1) })).data.user.fullName, "Asha Admin");
    assert.equal((await hub.connect({ token: `Bearer ${tokenFor(2)}` })).data.user.id, 2);
    for (const auth of [undefined, {}, { token: "junk" }, { token: tokenFor(1, "wrong-secret") },
        { token: tokenFor(1, ENV.JWT_ACCESS_SECRET, { expiresIn: -10 }) }, { token: tokenFor(99) }]) {
        assert.equal((await hub.connect(auth)).data.user, null);
    }
});

test("with SOCKET_AUTH_REQUIRED, a socket without a valid token can't connect at all", async () => {
    const hub = makeHub();
    ENV.SOCKET_AUTH_REQUIRED = true;
    try {
        assert.ok((await hub.connect({ token: "junk" })).refused instanceof Error);
        assert.ok((await hub.connect()).refused instanceof Error);
        assert.equal((await hub.connect({ token: tokenFor(2) })).data.user.id, 2);
    } finally {
        ENV.SOCKET_AUTH_REQUIRED = false;
    }
});

test("only a logged-in user who may read meetings can join one", async () => {
    const hub = makeHub();
    const admin = await hub.connect({ token: tokenFor(1) });
    const reader = await hub.connect({ token: tokenFor(2) });
    const noAccess = await hub.connect({ token: tokenFor(3) });
    const anonymous = await hub.connect({ token: "junk" });

    assert.deepEqual(await admin.ask("sheet:join", { meetingId: 19 }), { ok: true, version: 7, socketId: admin.id });
    assert.equal((await reader.ask("sheet:join", { meetingId: "19" })).ok, true);
    assert.equal((await noAccess.ask("sheet:join", { meetingId: 19 })).ok, false);
    assert.equal((await anonymous.ask("sheet:join", { meetingId: 19 })).ok, false);
    assert.equal((await admin.ask("sheet:join", { meetingId: 404 })).ok, false);
    for (const meetingId of [undefined, "abc", -1, 1.5, "19; DROP"]) {
        assert.equal((await admin.ask("sheet:join", { meetingId })).ok, false);
    }
    assert.deepEqual([admin, reader, noAccess, anonymous].map((s) => s.rooms.has("meeting:19")), [true, true, false, false]);
    // The one already there is told someone arrived, so it can say where it is.
    assert.deepEqual(eventsOf(admin, "sheet:peer-joined"), [{ meetingId: 19 }]);
});

test("nobody joins while live sync is switched off", async () => {
    const hub = makeHub();
    const admin = await hub.connect({ token: tokenFor(1) });
    ENV.SHEET_LIVE_SYNC = false;
    try {
        assert.equal((await admin.ask("sheet:join", { meetingId: 19 })).ok, false);
        assert.equal(admin.rooms.size, 0);
    } finally {
        ENV.SHEET_LIVE_SYNC = true;
    }
});

test("a save is announced to everyone in the meeting, and nobody else", async () => {
    const hub = makeHub();
    const saver = await hub.connect({ token: tokenFor(1) });
    const other = await hub.connect({ token: tokenFor(2) });
    const outsider = await hub.connect({ token: tokenFor(3) });
    await saver.ask("sheet:join", { meetingId: 19 });
    await other.ask("sheet:join", { meetingId: 19 });

    const patch = { v: 1, sheets: { "Sheet 1": { set: { B2: { value: "42" } } } } };
    live.broadcastPatch("19", { version: 8, patch, user: USERS[1], clientId: "grid-a" });
    const expected = { meetingId: 19, version: 8, patch, userId: 1, userName: "Asha Admin", clientId: "grid-a" };
    // The saver hears it too and recognises its own clientId; it is the browser that skips it.
    assert.deepEqual(eventsOf(saver, "sheet:patch"), [expected]);
    assert.deepEqual(eventsOf(other, "sheet:patch"), [expected]);
    assert.deepEqual(outsider.received, []);

    live.broadcastReplaced(19, { version: 9, user: USERS[2], clientId: "not a valid id" });
    assert.deepEqual(eventsOf(other, "sheet:replaced"), [{ meetingId: 19, version: 9, userId: 2, userName: "Ravi Reader", clientId: null }]);

    ENV.SHEET_LIVE_SYNC = false;
    try {
        live.broadcastPatch(19, { version: 10, patch, user: USERS[1], clientId: "grid-a" });
        assert.equal(eventsOf(other, "sheet:patch").length, 1);
    } finally {
        ENV.SHEET_LIVE_SYNC = true;
    }
});

test("presence carries the sender's real name, goes only to the others, and stops on leaving", async () => {
    const hub = makeHub();
    const asha = await hub.connect({ token: tokenFor(1) });
    const ravi = await hub.connect({ token: tokenFor(2) });
    const outsider = await hub.connect({ token: tokenFor(3) });
    await asha.ask("sheet:join", { meetingId: 19 });
    await ravi.ask("sheet:join", { meetingId: 19 });

    // Not in the room: nothing is relayed.
    outsider.send("sheet:presence", { meetingId: 19, sheet: "Sheet 1", cell: "A1", start: "A1", end: "A1" });
    assert.deepEqual(eventsOf(asha, "sheet:presence"), []);

    // The name and id in the message are ignored.
    ravi.send("sheet:presence", { meetingId: 19, sheet: "Sheet 1", cell: "B2", start: "B2", end: "D4", userId: 1, userName: "Asha Admin" });
    assert.deepEqual(eventsOf(asha, "sheet:presence"), [{
        meetingId: 19, socketId: ravi.id, userId: 2, userName: "Ravi Reader", sheet: "Sheet 1", cell: "B2", start: "B2", end: "D4"
    }]);
    assert.deepEqual(eventsOf(ravi, "sheet:presence"), []);

    // Malformed positions and too-frequent updates are dropped.
    await pause(60);
    ravi.send("sheet:presence", { meetingId: 19, sheet: "Sheet 1", cell: "<b>", start: "B2", end: "D4" });
    ravi.send("sheet:presence", { meetingId: 19, sheet: "Sheet 1", cell: "C3", start: "C3", end: "C3" });
    ravi.send("sheet:presence", { meetingId: 19, sheet: "Sheet 1", cell: "C4", start: "C4", end: "C4" });
    assert.deepEqual(eventsOf(asha, "sheet:presence").map((p) => p.cell), ["B2", "C3"]);

    ravi.send("sheet:leave", { meetingId: 19 });
    assert.equal(ravi.rooms.has("meeting:19"), false);
    assert.deepEqual(eventsOf(asha, "sheet:presence-left"), [{ meetingId: 19, socketId: ravi.id }]);
    await pause(60);
    ravi.send("sheet:presence", { meetingId: 19, sheet: "Sheet 1", cell: "E5", start: "E5", end: "E5" });
    assert.equal(eventsOf(asha, "sheet:presence").length, 2);

    // Closing the tab says goodbye too.
    await ravi.ask("sheet:join", { meetingId: 19 });
    ravi.disconnect();
    assert.equal(eventsOf(asha, "sheet:presence-left").length, 2);
});
