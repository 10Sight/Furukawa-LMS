import DailyMorningMeeting from "../models/dailyMorningMeeting.model.js";
import SheetComment from "../models/sheetComment.model.js";
import logger from "../logger/winston.logger.js";
import { canModifyDailyMeetingSection, isDailyMeetingAdmin } from "../utils/dailyMeetingAccess.util.js";
import { broadcastComment } from "../services/sheetLiveSync.js";

// Comments on the cells of a meeting's spreadsheet (see models/sheetComment.model.js for
// how they relate to the workbook).
//
// Who may do what:
//   read, reply, resolve/reopen   anyone who can open the meeting (daily_meeting:read)
//   start a thread                anyone who can save the sheet — the thread only shows
//                                 once its anchor is saved into the workbook, which takes
//                                 the same right (route: daily_meeting:update, plus the
//                                 section check here)
//   edit a message                its author
//   delete a message or thread    its author, or a Daily Meeting admin
//
// The author's id and name always come from the login, never from the request body.

const THREAD_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const CELL_ID_RE = /^[A-Z]{1,3}[1-9][0-9]{0,6}$/;
const MAX_SHEET_NAME_LENGTH = 255;
const MAX_COMMENT_LENGTH = 4000;

const displayName = (user) => user?.fullName || user?.userName || "User";
const sameUser = (a, b) => a != null && b != null && String(a) === String(b);

// The text of a comment as it will be stored, or null when it is empty or too long.
const cleanText = (value) => {
    if (typeof value !== "string") return null;
    const text = value.trim();
    return text.length > 0 && text.length <= MAX_COMMENT_LENGTH ? text : null;
};

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const invalidText = (res) => fail(res, 400, `A comment needs some text, up to ${MAX_COMMENT_LENGTH} characters`);

// The thread named in the URL, provided it belongs to the meeting named there too.
// Answers the request itself (and returns null) when there is no such thread.
const loadThread = async (req, res) => {
    const { id, threadId } = req.params;
    const thread = THREAD_ID_RE.test(String(threadId)) ? await SheetComment.findThreadById(threadId) : null;
    if (!thread || String(thread.meetingId) !== String(id)) {
        fail(res, 404, "Comment not found");
        return null;
    }
    return thread;
};

export const getMeetingComments = async (req, res) => {
    try {
        const { id } = req.params;
        const meeting = await DailyMorningMeeting.findMetaById(id);
        if (!meeting) return fail(res, 404, "Meeting not found");
        res.set("Cache-Control", "no-store");
        const threads = await SheetComment.findByMeetingId(meeting.id);
        return res.status(200).json({ success: true, data: { threads } });
    } catch (error) {
        logger.error("Error in getMeetingComments:", error);
        return fail(res, 500, "Internal server error");
    }
};

export const createCommentThread = async (req, res) => {
    try {
        const { id } = req.params;
        const { threadId, sheetName, cellRef } = req.body || {};
        const text = cleanText(req.body?.text);
        if (!THREAD_ID_RE.test(String(threadId ?? ""))) return fail(res, 400, "Invalid comment id");
        if (typeof sheetName !== "string" || !sheetName || sheetName.length > MAX_SHEET_NAME_LENGTH) return fail(res, 400, "Invalid sheet");
        if (typeof cellRef !== "string" || !CELL_ID_RE.test(cellRef)) return fail(res, 400, "Invalid cell");
        if (!text) return invalidText(res);

        const meeting = await DailyMorningMeeting.findMetaById(id);
        if (!meeting) return fail(res, 404, "Meeting not found");
        if (!(await canModifyDailyMeetingSection(req.user, meeting.sectionId))) {
            return fail(res, 403, "You are not assigned to this department/section");
        }

        const thread = await SheetComment.createThread({
            id: threadId, meetingId: meeting.id, sheetName, cellRef,
            authorId: req.user.id, authorName: displayName(req.user), text
        });
        if (!thread) return fail(res, 409, "This comment already exists");

        broadcastComment(meeting.id, { thread });
        return res.status(201).json({ success: true, data: { thread } });
    } catch (error) {
        logger.error("Error in createCommentThread:", error);
        return fail(res, 500, "Internal server error");
    }
};

export const addCommentReply = async (req, res) => {
    try {
        const text = cleanText(req.body?.text);
        if (!text) return invalidText(res);
        const existing = await loadThread(req, res);
        if (!existing) return undefined;

        const thread = await SheetComment.addMessage(existing.id, {
            authorId: req.user.id, authorName: displayName(req.user), text
        });
        broadcastComment(existing.meetingId, { thread });
        return res.status(201).json({ success: true, data: { thread } });
    } catch (error) {
        logger.error("Error in addCommentReply:", error);
        return fail(res, 500, "Internal server error");
    }
};

export const setCommentStatus = async (req, res) => {
    try {
        const status = req.body?.status;
        if (status !== "open" && status !== "resolved") return fail(res, 400, "Status must be open or resolved");
        const existing = await loadThread(req, res);
        if (!existing) return undefined;

        const thread = existing.status === status
            ? existing
            : await SheetComment.setStatus(existing.id, status, { userId: req.user.id, userName: displayName(req.user) });
        if (thread !== existing) broadcastComment(existing.meetingId, { thread });
        return res.status(200).json({ success: true, data: { thread } });
    } catch (error) {
        logger.error("Error in setCommentStatus:", error);
        return fail(res, 500, "Internal server error");
    }
};

// The message named in the URL, provided it is part of `thread`.
const messageOf = (thread, messageId) => thread.messages.find((m) => String(m.id) === String(messageId)) || null;

export const editCommentMessage = async (req, res) => {
    try {
        const text = cleanText(req.body?.text);
        if (!text) return invalidText(res);
        const existing = await loadThread(req, res);
        if (!existing) return undefined;
        const message = messageOf(existing, req.params.messageId);
        if (!message) return fail(res, 404, "Comment not found");
        if (!sameUser(message.authorId, req.user.id)) return fail(res, 403, "Only the author can edit a comment");

        await SheetComment.updateMessage(message.id, text);
        const thread = await SheetComment.findThreadById(existing.id);
        broadcastComment(existing.meetingId, { thread });
        return res.status(200).json({ success: true, data: { thread } });
    } catch (error) {
        logger.error("Error in editCommentMessage:", error);
        return fail(res, 500, "Internal server error");
    }
};

const removeThread = async (res, thread) => {
    await SheetComment.deleteThread(thread.id);
    broadcastComment(thread.meetingId, { threadId: thread.id });
    return res.status(200).json({ success: true, data: { threadId: thread.id, deleted: true } });
};

export const deleteCommentMessage = async (req, res) => {
    try {
        const existing = await loadThread(req, res);
        if (!existing) return undefined;
        const message = messageOf(existing, req.params.messageId);
        if (!message) return fail(res, 404, "Comment not found");
        if (!sameUser(message.authorId, req.user.id) && !isDailyMeetingAdmin(req.user)) {
            return fail(res, 403, "Only the author can delete a comment");
        }
        // The first message is the comment itself; the rest are replies to it.
        if (existing.messages[0].id === message.id) return await removeThread(res, existing);

        await SheetComment.deleteMessage(message.id);
        const thread = await SheetComment.findThreadById(existing.id);
        broadcastComment(existing.meetingId, { thread });
        return res.status(200).json({ success: true, data: { thread } });
    } catch (error) {
        logger.error("Error in deleteCommentMessage:", error);
        return fail(res, 500, "Internal server error");
    }
};

export const deleteCommentThread = async (req, res) => {
    try {
        const existing = await loadThread(req, res);
        if (!existing) return undefined;
        if (!sameUser(existing.createdBy, req.user.id) && !isDailyMeetingAdmin(req.user)) {
            return fail(res, 403, "Only the author can delete a comment");
        }
        return await removeThread(res, existing);
    } catch (error) {
        logger.error("Error in deleteCommentThread:", error);
        return fail(res, 500, "Internal server error");
    }
};
