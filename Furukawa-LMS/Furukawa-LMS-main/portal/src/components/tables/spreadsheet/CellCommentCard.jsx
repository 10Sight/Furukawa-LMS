import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconArrowBackUp, IconTrash, IconPencil, IconX, IconSend } from "@tabler/icons-react";
import { cn } from "@/utils/classNames.js";

// The one floating card that shows a cell's comment thread (or the box to start one).
//
// There is only ever one of these, however many cells have comments: the grid draws a
// corner marker per commented cell and nothing more. The card is portaled to <body>
// and placed in screen pixels next to the cell (`rect`), so it sits outside the grid's
// scroll box and its CSS zoom — it neither scrolls away under the sticky headers nor
// grows and shrinks with the sheet.

const CARD_WIDTH = 300;
const GAP = 6; // between the cell and the card
const MARGIN = 8; // kept clear at the edges of the window

const initialsOf = (name) => {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
};

const AVATAR_COLORS = ["bg-indigo-500", "bg-emerald-600", "bg-amber-600", "bg-rose-500", "bg-sky-600", "bg-violet-500", "bg-teal-600", "bg-orange-500"];
const avatarColor = (key) => {
    let hash = 0;
    for (const ch of String(key ?? "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const formatWhen = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

const sameUser = (a, b) => a != null && b != null && String(a) === String(b);

// A text box that grows with what is typed. Enter sends; Shift+Enter starts a new line.
const CommentInput = ({ value, onChange, onSubmit, onCancel, placeholder, autoFocus, disabled }) => {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }, [value]);
    useEffect(() => {
        if (!autoFocus) return;
        const el = ref.current;
        if (!el) return;
        el.focus({ preventScroll: true });
        el.setSelectionRange(el.value.length, el.value.length);
    }, [autoFocus]);
    return (
        <textarea
            ref={ref}
            rows={1}
            maxLength={4000}
            disabled={disabled}
            className="block w-full resize-none rounded border border-slate-200 bg-white px-2 py-1.5 text-xs leading-4 text-slate-800 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 disabled:opacity-60"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSubmit(); }
                else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
            }}
        />
    );
};

/**
 * @param {object} props
 * @param {{ left: number, right: number, top: number, bottom: number }} props.rect the
 *   cell, in screen pixels
 * @param {string} props.cellLabel e.g. "B4", or "B4:D6" for a merged cell
 * @param {object|null} props.thread the thread on the cell; null shows the box to start one
 * @param {boolean} props.pinned opened on purpose (stays until closed) rather than by hovering
 * @param {boolean} props.unsaved the comment's place on the sheet hasn't been saved yet
 * @param {string|number} props.currentUserId
 * @param {boolean} props.isAdmin may delete what others wrote
 * @param {boolean} props.canRemoveThread deleting the whole comment also takes it off the
 *   sheet, which needs the right to edit the sheet
 * @param {(reason?: "outside") => void} props.onClose "outside" when a click elsewhere closed it
 * Every on… handler that writes returns a promise of whether it worked.
 */
export default function CellCommentCard({
    rect, cellLabel, thread, pinned, unsaved, currentUserId, isAdmin, canRemoveThread,
    onCreate, onReply, onSetStatus, onEditMessage, onDeleteMessage, onDeleteThread,
    onClose, onPin, onPointerEnter, onPointerLeave
}) {
    const cardRef = useRef(null);
    const [height, setHeight] = useState(0);
    const [draft, setDraft] = useState("");
    const [editing, setEditing] = useState(null); // { id, text }: the message being edited
    const [confirmDelete, setConfirmDelete] = useState(null); // message id, or "thread"
    const [busy, setBusy] = useState(false);

    const threadId = thread?.id || null;
    // A different comment in the same card: start clean.
    useEffect(() => { setDraft(""); setEditing(null); setConfirmDelete(null); }, [threadId, cellLabel]);

    // Its height decides where it fits on screen, and changes as replies come in.
    useLayoutEffect(() => {
        const el = cardRef.current;
        if (!el) return undefined;
        setHeight(el.offsetHeight);
        if (typeof ResizeObserver === "undefined") return undefined;
        const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Opened on purpose: it stays until Escape or a click anywhere else.
    useEffect(() => {
        if (!pinned) return undefined;
        const onMouseDown = (e) => { if (!cardRef.current?.contains(e.target)) onClose("outside"); };
        const onKeyDown = (e) => {
            if (e.key !== "Escape" || e.defaultPrevented) return;
            e.preventDefault();
            onClose();
        };
        document.addEventListener("mousedown", onMouseDown, true);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onMouseDown, true);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [pinned, onClose]);

    const run = async (action) => {
        if (busy) return false;
        setBusy(true);
        try { return !!(await action()); } finally { setBusy(false); }
    };
    const submitDraft = async () => {
        const text = draft.trim();
        if (!text) return;
        if (await run(() => (thread ? onReply(text) : onCreate(text)))) setDraft("");
    };
    const submitEdit = async () => {
        const text = editing?.text.trim();
        if (!text) return;
        if (await run(() => onEditMessage(editing.id, text))) setEditing(null);
    };

    // To the right of the cell, or to its left when there is no room; kept on screen.
    const viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
    let left = rect.right + GAP;
    if (left + CARD_WIDTH > viewportWidth - MARGIN) left = rect.left - CARD_WIDTH - GAP;
    left = Math.max(MARGIN, Math.min(left, viewportWidth - CARD_WIDTH - MARGIN));
    const top = Math.max(MARGIN, Math.min(rect.top, viewportHeight - height - MARGIN));

    const resolved = thread?.status === "resolved";
    const messages = thread?.messages || [];
    const iconButton = "inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-default";

    return createPortal(
        <div
            ref={cardRef}
            role="dialog"
            aria-label={thread ? `Comment on ${cellLabel}` : `New comment on ${cellLabel}`}
            className={cn(
                "fixed z-[60] flex flex-col rounded-lg border bg-white text-slate-800 shadow-lg",
                resolved ? "border-emerald-300" : "border-amber-300"
            )}
            style={{ left, top, width: CARD_WIDTH, maxHeight: viewportHeight - 2 * MARGIN, visibility: height ? "visible" : "hidden" }}
            onMouseDown={(e) => { e.stopPropagation(); if (!pinned) onPin?.(); }}
            onMouseEnter={onPointerEnter}
            onMouseLeave={onPointerLeave}
            onContextMenu={(e) => e.stopPropagation()}
        >
            <div className={cn("flex items-center gap-1 rounded-t-lg border-b px-2 py-1", resolved ? "border-emerald-100 bg-emerald-50" : "border-amber-100 bg-amber-50")}>
                <span className="text-[11px] font-semibold text-slate-700">{cellLabel}</span>
                {resolved && <span className="rounded bg-emerald-600 px-1 text-[10px] font-medium leading-4 text-white">Resolved</span>}
                <span className="flex-1" />
                {thread && (
                    <button
                        type="button"
                        className={iconButton}
                        disabled={busy}
                        title={resolved ? "Reopen" : "Mark as resolved"}
                        onClick={() => run(() => onSetStatus(resolved ? "open" : "resolved"))}
                    >
                        {resolved ? <IconArrowBackUp className="h-3.5 w-3.5" /> : <IconCheck className="h-3.5 w-3.5 text-emerald-600" />}
                    </button>
                )}
                <button type="button" className={iconButton} title="Close (Esc)" onClick={() => onClose()}>
                    <IconX className="h-3.5 w-3.5" />
                </button>
            </div>

            {messages.length > 0 && (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2">
                    {messages.map((message, index) => {
                        const mine = sameUser(message.authorId, currentUserId);
                        const isFirst = index === 0;
                        // The first message is the comment itself: deleting it deletes the thread.
                        const canDelete = (mine || isAdmin) && (!isFirst || canRemoveThread);
                        const deleteKey = isFirst ? "thread" : message.id;
                        const isEditingThis = editing?.id === message.id;
                        return (
                            <div key={message.id} className="group flex gap-2">
                                <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white", avatarColor(message.authorId))}>
                                    {initialsOf(message.authorName)}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1">
                                        <span className="truncate text-[11px] font-semibold text-slate-800">{message.authorName || "User"}</span>
                                        <span className="shrink-0 text-[10px] text-slate-400">{formatWhen(message.createdAt)}{message.editedAt ? " · edited" : ""}</span>
                                        <span className="flex-1" />
                                        {!isEditingThis && confirmDelete !== deleteKey && (
                                            <span className="flex shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                                                {mine && (
                                                    <button type="button" className={cn(iconButton, "h-5 w-5")} title="Edit" disabled={busy} onClick={() => { setEditing({ id: message.id, text: message.text }); setConfirmDelete(null); }}>
                                                        <IconPencil className="h-3 w-3" />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button type="button" className={cn(iconButton, "h-5 w-5")} title={isFirst ? "Delete comment" : "Delete reply"} disabled={busy} onClick={() => setConfirmDelete(deleteKey)}>
                                                        <IconTrash className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    {isEditingThis ? (
                                        <div className="mt-1 space-y-1">
                                            <CommentInput
                                                value={editing.text}
                                                onChange={(text) => setEditing({ id: message.id, text })}
                                                onSubmit={submitEdit}
                                                onCancel={() => setEditing(null)}
                                                autoFocus
                                                disabled={busy}
                                            />
                                            <div className="flex justify-end gap-1">
                                                <button type="button" className="h-6 rounded px-2 text-[11px] text-slate-600 hover:bg-slate-100 cursor-pointer" onClick={() => setEditing(null)}>Cancel</button>
                                                <button type="button" className="h-6 rounded bg-indigo-600 px-2 text-[11px] font-medium text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50" disabled={busy || !editing.text.trim()} onClick={submitEdit}>Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="whitespace-pre-wrap break-words text-xs leading-4 text-slate-700">{message.text}</div>
                                    )}
                                    {confirmDelete === deleteKey && (
                                        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-600">
                                            <span className="flex-1">{isFirst ? "Delete this comment and its replies?" : "Delete this reply?"}</span>
                                            <button type="button" className="h-6 rounded px-2 hover:bg-slate-100 cursor-pointer" onClick={() => setConfirmDelete(null)}>No</button>
                                            <button
                                                type="button"
                                                className="h-6 rounded bg-rose-600 px-2 font-medium text-white hover:bg-rose-700 cursor-pointer disabled:opacity-50"
                                                disabled={busy}
                                                onClick={async () => {
                                                    if (await run(() => (isFirst ? onDeleteThread() : onDeleteMessage(message.id)))) setConfirmDelete(null);
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {unsaved && thread && (
                <div className="border-t border-amber-100 bg-amber-50 px-2 py-1 text-[10px] leading-4 text-amber-800">
                    Only you can see this comment until you save the sheet.
                </div>
            )}

            <div className={cn("flex items-end gap-1 px-2 py-2", messages.length > 0 && "border-t border-slate-100")}>
                <div className="min-w-0 flex-1">
                    <CommentInput
                        value={draft}
                        onChange={setDraft}
                        onSubmit={submitDraft}
                        onCancel={() => onClose()}
                        placeholder={thread ? "Reply…" : "Add a comment…"}
                        autoFocus={pinned && !editing}
                        disabled={busy}
                    />
                </div>
                <button
                    type="button"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-40 disabled:cursor-default"
                    disabled={busy || !draft.trim()}
                    title={thread ? "Reply (Enter)" : "Comment (Enter)"}
                    onClick={submitDraft}
                >
                    <IconSend className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>,
        document.body
    );
}
