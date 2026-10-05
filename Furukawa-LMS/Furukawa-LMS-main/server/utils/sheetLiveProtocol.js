// The parts of live co-editing (services/sheetLiveSync.js) that are plain functions of
// their input: room names, and checking what a browser sent over a socket.

const MEETING_ROOM_PREFIX = "meeting:";
export const meetingRoom = (meetingId) => `${MEETING_ROOM_PREFIX}${meetingId}`;
export const isMeetingRoom = (roomId) => String(roomId).startsWith(MEETING_ROOM_PREFIX);

const CELL_ID_RE = /^[A-Z]{1,3}[1-9][0-9]{0,6}$/;
const MAX_SHEET_NAME_LENGTH = 255;

const cookieValue = (header, name) => {
    for (const part of String(header || "").split(";")) {
        const eq = part.indexOf("=");
        if (eq > 0 && part.slice(0, eq).trim() === name) {
            try { return decodeURIComponent(part.slice(eq + 1).trim()); } catch { return null; }
        }
    }
    return null;
};

// The access token a socket connected with: sent explicitly by the client
// (`auth: { token }`), as an Authorization header, or in the login cookie.
export const readSocketToken = (socket) => {
    const handshake = socket?.handshake || {};
    const fromAuth = handshake.auth?.token;
    if (typeof fromAuth === "string" && fromAuth) return fromAuth.replace(/^Bearer /, "");
    const fromHeader = handshake.headers?.authorization;
    if (typeof fromHeader === "string" && fromHeader) return fromHeader.replace(/^Bearer /, "");
    return cookieValue(handshake.headers?.cookie, "accessToken");
};

// Where a user is in a sheet, reduced to the fields that are relayed — or null when
// what was sent isn't a well-formed position.
export const cleanPresence = (payload) => {
    if (!payload || typeof payload !== "object") return null;
    const { sheet, cell, start, end } = payload;
    if (typeof sheet !== "string" || sheet.length === 0 || sheet.length > MAX_SHEET_NAME_LENGTH) return null;
    if (![cell, start, end].every((id) => typeof id === "string" && CELL_ID_RE.test(id))) return null;
    return { sheet, cell, start, end };
};

// A client-chosen id for one open grid, echoed back so that grid can recognise (and
// skip) the announcement of its own save.
export const cleanClientId = (value) =>
    (typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null);
