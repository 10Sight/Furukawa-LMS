import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SocketContext } from "@/context/SocketContext.jsx";
import axiosInstance from "@/services/requests/axiosInstance.js";

// The comment threads of a meeting's spreadsheet: what people wrote on its cells.
//
// Which cell a thread sits on is part of the workbook (each sheet's `commentAnchors`,
// see commentEngine.js) and is saved with it. The threads are kept here instead, apart
// from the workbook and its undo history: they are written straight to the server, by
// anyone who can open the meeting, and reach everyone else who has it open at once —
// over the same socket room the grid joins for live co-editing (useSheetLiveSync.js),
// as `sheet:comment` carrying the whole thread as it now is, or the id of one removed.
// Without live co-editing nothing is announced, and `refresh` loads them again.

const EMPTY = Object.freeze({});

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

/**
 * @param {object} options
 * @param {string|number} [options.meetingId] comments exist only for a meeting's sheet
 * @returns {{
 *   threads: Object<string, object>, loaded: boolean, refresh: () => Promise<void>,
 *   createThread: (thread: { threadId, sheetName, cellRef, text }) => Promise<object|null>,
 *   addReply: (threadId, text) => Promise<object|null>,
 *   setStatus: (threadId, status: "open"|"resolved") => Promise<object|null>,
 *   editMessage: (threadId, messageId, text) => Promise<object|null>,
 *   deleteMessage: (threadId, messageId) => Promise<object|null>,
 *   deleteThread: (threadId) => Promise<object|null>
 * }} Every action resolves to what the server answered ({ thread } or { threadId,
 *   deleted }), or to null when it failed — the failure has then been shown already.
 */
export const useSheetComments = ({ meetingId }) => {
    const socketContext = useContext(SocketContext);
    const socket = socketContext?.socket || null;

    const [state, setState] = useState({ meetingId: null, threads: EMPTY, loaded: false });
    const meetingIdRef = useRef(meetingId);
    meetingIdRef.current = meetingId;

    // Takes what the server said about one thread, if it is about the meeting on screen.
    const take = useCallback((forMeetingId, { thread, threadId, deleted }) => {
        setState((prev) => {
            if (String(prev.meetingId) !== String(forMeetingId)) return prev;
            if (thread) return { ...prev, threads: { ...prev.threads, [thread.id]: thread } };
            if (deleted && prev.threads[threadId]) {
                const threads = { ...prev.threads };
                delete threads[threadId];
                return { ...prev, threads };
            }
            return prev;
        });
    }, []);

    const load = useCallback(async (forMeetingId) => {
        try {
            const response = await axiosInstance.get(`/api/daily-morning-meetings/${forMeetingId}/comments`);
            if (String(meetingIdRef.current) !== String(forMeetingId)) return;
            const list = response?.data?.data?.threads;
            const threads = {};
            for (const thread of Array.isArray(list) ? list : []) threads[thread.id] = thread;
            setState({ meetingId: forMeetingId, threads, loaded: true });
        } catch {
            // Comments are an extra: the sheet is still usable without them, and the
            // next refresh tries again.
        }
    }, []);

    useEffect(() => {
        setState({ meetingId: meetingId || null, threads: EMPTY, loaded: false });
        if (meetingId) load(meetingId);
    }, [meetingId, load]);

    useEffect(() => {
        if (!socket || !meetingId) return undefined;
        const onComment = (data) => {
            if (String(data?.meetingId) === String(meetingId)) take(meetingId, data);
        };
        // After a dropped connection, whatever was announced meanwhile was missed.
        const onReconnect = () => load(meetingId);
        socket.on("sheet:comment", onComment);
        socket.on("connect", onReconnect);
        return () => {
            socket.off("sheet:comment", onComment);
            socket.off("connect", onReconnect);
        };
    }, [socket, meetingId, take, load]);

    const refresh = useCallback(async () => {
        if (meetingIdRef.current) await load(meetingIdRef.current);
    }, [load]);

    const send = useCallback(async (method, path, body, failure) => {
        const forMeetingId = meetingIdRef.current;
        if (!forMeetingId) return null;
        try {
            const response = await axiosInstance({ method, url: `/api/daily-morning-meetings/${forMeetingId}/comments${path}`, data: body });
            const data = response?.data?.data || null;
            if (data) take(forMeetingId, data);
            return data;
        } catch (error) {
            toast.error(errorMessage(error, failure));
            // Someone else may have deleted it meanwhile: show what is really there.
            if (error?.response?.status === 404) load(forMeetingId);
            return null;
        }
    }, [take, load]);

    const actions = useMemo(() => {
        const at = (threadId) => `/${encodeURIComponent(threadId)}`;
        return {
            createThread: ({ threadId, sheetName, cellRef, text }) =>
                send("post", "", { threadId, sheetName, cellRef, text }, "Could not add the comment."),
            addReply: (threadId, text) => send("post", `${at(threadId)}/replies`, { text }, "Could not add the reply."),
            setStatus: (threadId, status) => send("patch", at(threadId), { status }, "Could not update the comment."),
            editMessage: (threadId, messageId, text) =>
                send("put", `${at(threadId)}/messages/${encodeURIComponent(messageId)}`, { text }, "Could not save the comment."),
            deleteMessage: (threadId, messageId) =>
                send("delete", `${at(threadId)}/messages/${encodeURIComponent(messageId)}`, undefined, "Could not delete the comment."),
            deleteThread: (threadId) => send("delete", at(threadId), undefined, "Could not delete the comment."),
        };
    }, [send]);

    // A meeting just switched to shows nothing until its own comments have loaded.
    const current = String(state.meetingId) === String(meetingId || null);
    return {
        threads: current ? state.threads : EMPTY,
        loaded: current && state.loaded,
        refresh,
        ...actions,
    };
};
