import ENV from "../configs/env.config.js";
import logger from "../logger/winston.logger.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import { isAcceptableAccessToken } from "../utils/accessToken.js";
import { meetingRoom, readSocketToken, cleanPresence, cleanClientId } from "../utils/sheetLiveProtocol.js";
import authorizeRoles from "../middlewares/authrization.middleware.js";
import DailyMorningMeeting from "../models/dailyMorningMeeting.model.js";

// Live co-editing of a meeting's spreadsheet.
//
// Nothing is ever written through a socket. A save goes to the HTTP API exactly as it
// always has — same permission checks, same version lock — and once it has been
// committed the controller calls broadcastPatch / broadcastReplaced below, which tell
// everyone else with that meeting open. Sockets carry those announcements, and who is
// looking at which cell ("presence", which is never stored).
//
// A socket gets a meeting's announcements only after `sheet:join`, and only if its
// connection carried a valid access token for a user allowed to read meetings. The
// user's id and name always come from that token, never from what the browser says.

export const liveSyncEnabled = () => ENV.SHEET_LIVE_SYNC && ENV.SHEET_PATCH_SAVE;

// Presence is relayed at most this often per socket; the client throttles too.
const PRESENCE_MIN_INTERVAL_MS = 50;

let ioRef = null;

// --- Who is on the other end of a socket --------------------------------------------

// The user an access token belongs to, loaded exactly the way an HTTP request's is
// (verifyJWT, including the account-status check and the role's permissions), or null.
export const userFromToken = (token) => new Promise((resolve) => {
    if (!isAcceptableAccessToken(token)) return resolve(null);
    const req = { cookies: { accessToken: token }, header: () => undefined, query: {} };
    verifyJWT(req, {}, (error) => resolve(error || !req.user ? null : req.user));
});

const readMeetings = authorizeRoles("daily_meeting:read", "isAdmin", "SUPERADMIN");
export const canReadMeetings = (user) => {
    if (!user) return false;
    try {
        let allowed = false;
        readMeetings({ user }, {}, () => { allowed = true; });
        return allowed;
    } catch {
        return false;
    }
};

const displayName = (user) => user?.fullName || user?.userName || "User";

/**
 * Socket.IO connection middleware: works out who the socket belongs to from the
 * access token sent with the connection, and keeps it on socket.data.user.
 * A socket without a valid token is still let in (it gets the general notifications
 * it always did) unless SOCKET_AUTH_REQUIRED is on.
 */
export const authenticateSocket = async (socket, next) => {
    try {
        const token = readSocketToken(socket);
        socket.data.user = token ? await userFromToken(token) : null;
    } catch (error) {
        logger.warn(`[SOCKET AUTH] could not verify socket ${socket.id}: ${error.message}`);
        socket.data.user = null;
    }
    if (!socket.data.user && ENV.SOCKET_AUTH_REQUIRED) {
        return next(new Error("Not logged in"));
    }
    return next();
};

// --- Sheet events ------------------------------------------------------------------

/**
 * Registers the sheet events on a newly connected socket.
 *
 *   sheet:join { meetingId }, ack     -> { ok: true, version, socketId } | { ok: false, message }
 *   sheet:leave { meetingId }
 *   sheet:presence { meetingId, sheet, cell, start, end }
 */
export const registerSheetSocketHandlers = (socket) => {
    const joined = new Set(); // meeting ids, as strings
    let lastPresenceAt = 0;

    socket.on("sheet:join", async (payload, ack) => {
        const reply = typeof ack === "function" ? ack : () => {};
        try {
            const meetingId = Number(payload?.meetingId);
            if (!Number.isInteger(meetingId) || meetingId <= 0) return reply({ ok: false, message: "Invalid meeting" });
            if (!liveSyncEnabled()) return reply({ ok: false, message: "Live editing is not enabled" });
            if (!canReadMeetings(socket.data.user)) return reply({ ok: false, message: "You do not have permission to open this meeting" });

            const meeting = await DailyMorningMeeting.findMetaById(meetingId);
            if (!meeting) return reply({ ok: false, message: "Meeting not found" });

            const room = meetingRoom(meetingId);
            socket.join(room);
            joined.add(String(meetingId));
            // The others answer with where they are, so the newcomer sees them at once.
            socket.to(room).emit("sheet:peer-joined", { meetingId });
            return reply({ ok: true, version: meeting.version ?? 1, socketId: socket.id });
        } catch (error) {
            logger.error("[SHEET LIVE] sheet:join failed:", error);
            return reply({ ok: false, message: "Could not join live editing" });
        }
    });

    socket.on("sheet:leave", (payload) => {
        const key = String(Number(payload?.meetingId));
        if (!joined.delete(key)) return;
        const room = meetingRoom(key);
        socket.leave(room);
        socket.to(room).emit("sheet:presence-left", { meetingId: Number(key), socketId: socket.id });
    });

    socket.on("sheet:presence", (payload) => {
        const key = String(Number(payload?.meetingId));
        if (!joined.has(key)) return;
        const now = Date.now();
        if (now - lastPresenceAt < PRESENCE_MIN_INTERVAL_MS) return;
        const presence = cleanPresence(payload);
        if (!presence) return;
        lastPresenceAt = now;
        socket.to(meetingRoom(key)).emit("sheet:presence", {
            meetingId: Number(key),
            socketId: socket.id,
            userId: socket.data.user.id,
            userName: displayName(socket.data.user),
            ...presence
        });
    });

    // Rooms are already left by the time "disconnect" fires, hence "disconnecting".
    socket.on("disconnecting", () => {
        for (const key of joined) {
            socket.to(meetingRoom(key)).emit("sheet:presence-left", { meetingId: Number(key), socketId: socket.id });
        }
        joined.clear();
    });
};

export const initSheetLiveSync = (io) => {
    ioRef = io;
    io.use(authenticateSocket);
};

// --- Announcements, called by the controllers after a save has been committed --------

const announce = (event, meetingId, payload) => {
    if (!ioRef || !liveSyncEnabled()) return;
    try {
        ioRef.to(meetingRoom(meetingId)).emit(event, { meetingId: Number(meetingId), ...payload });
    } catch (error) {
        // The save itself is already committed; a missed announcement is made up for
        // by the next one (clients notice the gap in version numbers and catch up).
        logger.warn(`[SHEET LIVE] could not announce ${event} for meeting ${meetingId}: ${error.message}`);
    }
};

/** A patch save was committed as `version`. */
export const broadcastPatch = (meetingId, { version, patch, user, clientId }) =>
    announce("sheet:patch", meetingId, {
        version, patch, userId: user?.id ?? null, userName: displayName(user), clientId: cleanClientId(clientId)
    });

/** The whole workbook was replaced by a full save, committed as `version`. */
export const broadcastReplaced = (meetingId, { version, user, clientId }) =>
    announce("sheet:replaced", meetingId, {
        version, userId: user?.id ?? null, userName: displayName(user), clientId: cleanClientId(clientId)
    });

export { isMeetingRoom } from "../utils/sheetLiveProtocol.js";
