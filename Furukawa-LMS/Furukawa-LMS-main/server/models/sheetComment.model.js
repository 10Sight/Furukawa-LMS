import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";
import DailyMorningMeeting from "./dailyMorningMeeting.model.js";

// Comments on the cells of a meeting's spreadsheet
// ------------------------------------------------
// A comment is a thread of messages. Which cell a thread sits on is NOT stored here: it
// is part of the workbook (each sheet's `commentAnchors`, { cellId: thread id } — see
// utils/sheetWorkbook.js), so that it moves with the cell when rows and columns are
// inserted, and is saved, undone and merged with everything else on the sheet. What is
// here is what people wrote, who wrote it and whether the thread is resolved, none of
// which waits for a save. `sheetName` and `cellRef` record where the thread was started,
// for display and audit only.
//
// A thread whose anchor never reached the workbook (its author didn't save) is simply
// never shown. Threads go when their meeting does.
//
// Author ids are deliberately not foreign keys, and the name is kept alongside: a
// comment should outlive, and not block, the removal of the user who wrote it.

const toThread = (row, messages) => ({
    id: row.id,
    meetingId: row.meetingId,
    sheetName: row.sheetName,
    cellRef: row.cellRef,
    status: row.status,
    createdBy: row.createdBy,
    createdByName: row.createdByName,
    createdAt: row.createdAt,
    resolvedBy: row.resolvedBy ?? null,
    resolvedByName: row.resolvedByName ?? null,
    resolvedAt: row.resolvedAt ?? null,
    messages
});

const toMessage = (row) => ({
    id: row.id,
    threadId: row.threadId,
    authorId: row.authorId,
    authorName: row.authorName,
    text: row.body,
    createdAt: row.createdAt,
    editedAt: row.editedAt ?? null
});

class SheetComment {
    static async init() {
        try {
            // Both tables hang off daily_morning_meetings, which has to be there first.
            await DailyMorningMeeting.schemaReady;
            if (!await migrationHelper.tableExists('sheet_comment_threads')) {
                await executeQuery(`
                    CREATE TABLE sheet_comment_threads (
                        id NVARCHAR(64) NOT NULL PRIMARY KEY,
                        meetingId INT NOT NULL,
                        sheetName NVARCHAR(255) NOT NULL,
                        cellRef NVARCHAR(16) NOT NULL,
                        status NVARCHAR(16) NOT NULL DEFAULT 'open',
                        createdBy INT NOT NULL,
                        createdByName NVARCHAR(255) NOT NULL,
                        createdAt DATETIME NOT NULL DEFAULT GETDATE(),
                        resolvedBy INT NULL,
                        resolvedByName NVARCHAR(255) NULL,
                        resolvedAt DATETIME NULL,
                        CONSTRAINT FK_sheet_comment_threads_meeting FOREIGN KEY (meetingId)
                            REFERENCES daily_morning_meetings(id) ON DELETE CASCADE
                    )
                `);
            }
            await migrationHelper.ensureIndexExists(
                'sheet_comment_threads',
                'IX_sheet_comment_threads_meeting',
                'CREATE INDEX IX_sheet_comment_threads_meeting ON sheet_comment_threads (meetingId)'
            );
            if (!await migrationHelper.tableExists('sheet_comment_messages')) {
                await executeQuery(`
                    CREATE TABLE sheet_comment_messages (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        threadId NVARCHAR(64) NOT NULL,
                        authorId INT NOT NULL,
                        authorName NVARCHAR(255) NOT NULL,
                        body NVARCHAR(MAX) NOT NULL,
                        createdAt DATETIME NOT NULL DEFAULT GETDATE(),
                        editedAt DATETIME NULL,
                        CONSTRAINT FK_sheet_comment_messages_thread FOREIGN KEY (threadId)
                            REFERENCES sheet_comment_threads(id) ON DELETE CASCADE
                    )
                `);
            }
            await migrationHelper.ensureIndexExists(
                'sheet_comment_messages',
                'IX_sheet_comment_messages_thread',
                'CREATE INDEX IX_sheet_comment_messages_thread ON sheet_comment_messages (threadId, id)'
            );
            logger.info("Checked/Created sheet comment tables in MSSQL");
        } catch (error) {
            logger.error("Failed to initialize sheet comment tables", error);
        }
    }

    // Every thread of a meeting with its messages, oldest first.
    static async findByMeetingId(meetingId) {
        await schemaReady;
        const [threads] = await executeQuery(
            "SELECT * FROM sheet_comment_threads WHERE meetingId = ? ORDER BY createdAt, id",
            [meetingId]
        );
        if (threads.length === 0) return [];
        const [messages] = await executeQuery(
            `SELECT m.* FROM sheet_comment_messages m
             JOIN sheet_comment_threads t ON t.id = m.threadId
             WHERE t.meetingId = ? ORDER BY m.id`,
            [meetingId]
        );
        const byThread = new Map();
        for (const row of messages) {
            if (!byThread.has(row.threadId)) byThread.set(row.threadId, []);
            byThread.get(row.threadId).push(toMessage(row));
        }
        return threads.map((row) => toThread(row, byThread.get(row.id) || []));
    }

    static async findThreadById(threadId) {
        await schemaReady;
        const [threads] = await executeQuery("SELECT * FROM sheet_comment_threads WHERE id = ?", [threadId]);
        if (threads.length === 0) return null;
        const [messages] = await executeQuery(
            "SELECT * FROM sheet_comment_messages WHERE threadId = ? ORDER BY id",
            [threadId]
        );
        return toThread(threads[0], messages.map(toMessage));
    }

    static async findMessageById(messageId) {
        await schemaReady;
        const [rows] = await executeQuery("SELECT * FROM sheet_comment_messages WHERE id = ?", [messageId]);
        return rows.length > 0 ? toMessage(rows[0]) : null;
    }

    // Starts a thread with its first message. Returns null when the id is already taken.
    static async createThread({ id, meetingId, sheetName, cellRef, authorId, authorName, text }) {
        await schemaReady;
        const [inserted] = await executeQuery(
            `INSERT INTO sheet_comment_threads (id, meetingId, sheetName, cellRef, createdBy, createdByName)
             OUTPUT INSERTED.id
             SELECT ?, ?, ?, ?, ?, ?
             WHERE NOT EXISTS (SELECT 1 FROM sheet_comment_threads WHERE id = ?)`,
            [id, meetingId, sheetName, cellRef, authorId, authorName, id]
        );
        if (!inserted || inserted.length === 0) return null;
        await executeQuery(
            "INSERT INTO sheet_comment_messages (threadId, authorId, authorName, body) VALUES (?, ?, ?, ?)",
            [id, authorId, authorName, text]
        );
        return SheetComment.findThreadById(id);
    }

    static async addMessage(threadId, { authorId, authorName, text }) {
        await schemaReady;
        await executeQuery(
            "INSERT INTO sheet_comment_messages (threadId, authorId, authorName, body) VALUES (?, ?, ?, ?)",
            [threadId, authorId, authorName, text]
        );
        return SheetComment.findThreadById(threadId);
    }

    static async updateMessage(messageId, text) {
        await schemaReady;
        await executeQuery(
            "UPDATE sheet_comment_messages SET body = ?, editedAt = GETDATE() WHERE id = ?",
            [text, messageId]
        );
    }

    static async deleteMessage(messageId) {
        await schemaReady;
        await executeQuery("DELETE FROM sheet_comment_messages WHERE id = ?", [messageId]);
    }

    static async setStatus(threadId, status, { userId, userName }) {
        await schemaReady;
        if (status === "resolved") {
            await executeQuery(
                "UPDATE sheet_comment_threads SET status = 'resolved', resolvedBy = ?, resolvedByName = ?, resolvedAt = GETDATE() WHERE id = ?",
                [userId, userName, threadId]
            );
        } else {
            await executeQuery(
                "UPDATE sheet_comment_threads SET status = 'open', resolvedBy = NULL, resolvedByName = NULL, resolvedAt = NULL WHERE id = ?",
                [threadId]
            );
        }
        return SheetComment.findThreadById(threadId);
    }

    // Its messages go with it (ON DELETE CASCADE).
    static async deleteThread(threadId) {
        await schemaReady;
        await executeQuery("DELETE FROM sheet_comment_threads WHERE id = ?", [threadId]);
    }
}

const schemaReady = SheetComment.init().catch(err => logger.error("Failed to initialize sheet comment tables:", err));

export default SheetComment;
