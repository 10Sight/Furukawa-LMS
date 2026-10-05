import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { SocketContext } from "@/context/SocketContext.jsx";
import axiosInstance from "@/services/requests/axiosInstance.js";
import { rebaseRemotePatches } from "../../../utils/spreadsheets/workbookSync.js";

// Live co-editing for the grid: keeps an open meeting in step with what other people
// save, and shows where they are.
//
// Saving is untouched — it still goes to the HTTP API. After each save the server
// announces it on a socket to everyone else who has the meeting open:
//
//   sheet:patch     someone saved a few cells or settings; taken in on the spot
//                   (see workbookSync.js for how unsaved edits are kept)
//   sheet:replaced  someone saved the whole workbook; it has to be loaded again
//
// Announcements carry the meeting version they produced. One that isn't the next
// version means something was missed (a dropped connection, say); the missing saves
// are then fetched from the server, or the workbook is reloaded if they can't be.
//
// The grid's saved copy and version are only ever moved by one thing at a time: every
// change made here goes through the same queue the grid's own saves use.

const PRESENCE_INTERVAL_MS = 100; // at most 10 position updates a second
const PEER_COLORS = ["#e11d48", "#0891b2", "#ca8a04", "#7c3aed", "#059669", "#ea580c", "#db2777", "#2563eb"];

const colorFor = (socketId) => {
    let hash = 0;
    for (let i = 0; i < socketId.length; i++) hash = (hash * 31 + socketId.charCodeAt(i)) >>> 0;
    return PEER_COLORS[hash % PEER_COLORS.length];
};

export const newClientId = () => {
    const random = globalThis.crypto?.randomUUID?.();
    return random || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

/**
 * @param {object} options
 * @param {boolean} options.enabled the server offers live sync and this meeting is loaded
 * @param {string|number} options.meetingId
 * @param {string} options.clientId this grid's id, sent with its saves so their
 *   announcements can be told apart from other people's
 * @param {React.MutableRefObject} options.meetingVersionsRef meetingId -> version known
 * @param {React.MutableRefObject} options.savedWorkbooksRef meetingId -> { sheets, ... }
 * @param {React.MutableRefObject} options.sheetsRef the workbook on screen
 * @param {(sheets: object) => void} options.setSheets replaces it, without an undo entry
 * @param {(task: () => any) => Promise<any>} options.enqueue runs a task on the grid's save queue
 * @param {(info: { userName?: string }) => void} options.onReloadNeeded the workbook
 *   can't be brought up to date piece by piece and has to be loaded again
 * @param {{ sheet: string, cell: string, start: string, end: string }|null} options.position
 *   where this user is, shown to the others
 * @returns {{ peers: Array<{ socketId, userName, color, sheet, cell, start, end }>,
 *             catchUpNow: (meetingId) => Promise<Array|null> }}
 */
export const useSheetLiveSync = ({
    enabled, meetingId, clientId, meetingVersionsRef, savedWorkbooksRef, sheetsRef, setSheets,
    enqueue, onReloadNeeded, position
}) => {
    const socketContext = useContext(SocketContext);
    const socket = socketContext?.socket || null;
    const isConnected = !!socketContext?.isConnected;

    const [peers, setPeers] = useState([]);
    const meetingIdRef = useRef(meetingId);
    meetingIdRef.current = meetingId;
    const onReloadNeededRef = useRef(onReloadNeeded);
    onReloadNeededRef.current = onReloadNeeded;
    const positionRef = useRef(position);
    positionRef.current = position;

    // Takes patches (oldest first, each { version, patch }) into the saved copy and the
    // screen, as far as they follow on from the version already held.
    // Returns "gap" when one of them isn't the version after the last one held, which
    // means a save in between was missed; those before the gap are still taken.
    const takePatches = useCallback((targetMeetingId, patches) => {
        const key = targetMeetingId;
        const saved = savedWorkbooksRef.current[key];
        const known = meetingVersionsRef.current[key];
        if (!saved || known == null) return "ignored";

        const fresh = [];
        let gap = false;
        for (const entry of patches) {
            if (entry.version <= known + fresh.length) continue; // already have it
            if (entry.version !== known + fresh.length + 1) { gap = true; break; }
            fresh.push(entry);
        }
        if (fresh.length === 0) return gap ? "gap" : "ignored";

        // The screen belongs to whichever meeting is open now.
        const onScreen = String(meetingIdRef.current) === String(key);
        const live = onScreen ? sheetsRef.current : saved.sheets;
        const next = rebaseRemotePatches(live, saved.sheets, fresh);
        savedWorkbooksRef.current[key] = { ...saved, sheets: next.saved };
        meetingVersionsRef.current[key] = known + fresh.length;
        if (onScreen && next.live !== live) setSheets(next.live);
        return gap ? "gap" : "applied";
    }, [meetingVersionsRef, savedWorkbooksRef, sheetsRef, setSheets]);

    // Fetches and takes in every save made since the version held. Must run on the save
    // queue (the grid's own save calls it from there; everything else goes through
    // `enqueue`). Returns the patches taken — possibly none — or null when the workbook
    // has to be reloaded instead.
    const catchUpNow = useCallback(async (targetMeetingId) => {
        const known = meetingVersionsRef.current[targetMeetingId];
        if (known == null) return null;
        let response;
        try {
            response = await axiosInstance.get(`/api/daily-morning-meetings/${targetMeetingId}/patches`, { params: { after: known } });
        } catch (error) {
            if (error?.response?.status === 410) return null;
            throw error;
        }
        const patches = response?.data?.data?.patches;
        if (!Array.isArray(patches)) return null;
        const outcome = takePatches(targetMeetingId, patches);
        return outcome === "gap" ? null : patches;
    }, [meetingVersionsRef, takePatches]);

    // Subscriptions: join the meeting's room (again after every reconnect) and listen.
    useEffect(() => {
        if (!enabled || !socket || !isConnected || !meetingId) return undefined;
        const key = meetingId;
        const mine = (data) => String(data?.meetingId) === String(key);
        let active = true;

        const reloadNeeded = (info) => { if (active) onReloadNeededRef.current?.(info || {}); };
        const catchUp = () => enqueue(async () => {
            if (!active) return;
            try {
                if ((await catchUpNow(key)) === null) reloadNeeded();
            } catch {
                // Offline or the server is busy: the next announcement or reconnect tries again.
            }
        });

        const onPatch = (data) => {
            if (!mine(data) || data.clientId === clientId) return;
            enqueue(() => {
                if (!active) return;
                const outcome = takePatches(key, [{ version: data.version, patch: data.patch }]);
                if (outcome === "gap") catchUp();
            });
        };
        const onReplaced = (data) => {
            if (!mine(data) || data.clientId === clientId) return;
            enqueue(() => {
                const known = meetingVersionsRef.current[key];
                if (known != null && data.version <= known) return;
                reloadNeeded({ userName: data.userName });
            });
        };
        const sendPosition = () => {
            if (positionRef.current) socket.emit("sheet:presence", { meetingId: Number(key), ...positionRef.current });
        };
        const onPresence = (data) => {
            if (!mine(data) || !data.socketId) return;
            const peer = {
                socketId: data.socketId, userName: data.userName || "Someone", color: colorFor(data.socketId),
                sheet: data.sheet, cell: data.cell, start: data.start, end: data.end
            };
            setPeers((list) => [...list.filter((p) => p.socketId !== peer.socketId), peer]);
        };
        const onPresenceLeft = (data) => {
            if (!mine(data)) return;
            setPeers((list) => list.filter((p) => p.socketId !== data.socketId));
        };
        // Someone just opened the meeting: let them know where everyone already is.
        const onPeerJoined = (data) => { if (mine(data)) sendPosition(); };

        socket.on("sheet:patch", onPatch);
        socket.on("sheet:replaced", onReplaced);
        socket.on("sheet:presence", onPresence);
        socket.on("sheet:presence-left", onPresenceLeft);
        socket.on("sheet:peer-joined", onPeerJoined);

        socket.emit("sheet:join", { meetingId: Number(key) }, (reply) => {
            if (!active || !reply?.ok) return;
            sendPosition();
            // Saves made between loading the workbook and joining were never announced here.
            const known = meetingVersionsRef.current[key];
            if (known != null && reply.version > known) catchUp();
        });

        return () => {
            active = false;
            socket.off("sheet:patch", onPatch);
            socket.off("sheet:replaced", onReplaced);
            socket.off("sheet:presence", onPresence);
            socket.off("sheet:presence-left", onPresenceLeft);
            socket.off("sheet:peer-joined", onPeerJoined);
            socket.emit("sheet:leave", { meetingId: Number(key) });
            setPeers([]);
        };
    }, [enabled, socket, isConnected, meetingId, clientId, enqueue, takePatches, catchUpNow, meetingVersionsRef]);

    // Tell the others where this user is: right away, then no more often than every
    // PRESENCE_INTERVAL_MS, always ending on the latest position.
    const presenceRef = useRef({ lastSentAt: 0, timer: null });
    const sheet = position?.sheet, cell = position?.cell, start = position?.start, end = position?.end;
    useEffect(() => {
        if (!enabled || !socket || !isConnected || !meetingId || !sheet) return undefined;
        const state = presenceRef.current;
        const send = () => {
            state.timer = null;
            state.lastSentAt = Date.now();
            if (positionRef.current) socket.emit("sheet:presence", { meetingId: Number(meetingId), ...positionRef.current });
        };
        const wait = PRESENCE_INTERVAL_MS - (Date.now() - state.lastSentAt);
        if (wait <= 0) send();
        else if (!state.timer) state.timer = setTimeout(send, wait);
        return undefined;
    }, [enabled, socket, isConnected, meetingId, sheet, cell, start, end]);
    useEffect(() => () => clearTimeout(presenceRef.current.timer), []);

    return { peers, catchUpNow };
};
