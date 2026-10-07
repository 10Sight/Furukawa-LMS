// Comment anchors: where on a sheet each comment thread sits.
//
// A sheet's `commentAnchors` is { cellId: thread id }. The threads themselves (what
// people wrote) live on the server and never wait for a save; the anchors are part of
// the workbook so that they are saved, undone and merged with it, and so that they
// follow their cell when the sheet is restructured. The functions here are those
// moves. None changes the map it is given: each returns a new map, or the same one
// when nothing moved.

import { getCellId, parseCellRef } from "./formulaEngine.js";

const EMPTY = Object.freeze({});

export const newThreadId = () => {
    const random = globalThis.crypto?.randomUUID?.();
    return `c_${random ? random.replace(/-/g, "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`}`;
};

// Rebuilds the map by passing every anchor through `place(ref, id)`, which returns the
// cell id it ends up on, or null to drop it. When two land on one cell the later wins.
const remap = (anchors, place) => {
    const source = anchors || EMPTY;
    const next = {};
    let changed = false;
    for (const id of Object.keys(source)) {
        const ref = parseCellRef(id);
        const target = ref ? place(ref, id) : null;
        if (target !== id) changed = true;
        if (target) next[target] = source[id];
    }
    return changed ? next : source;
};

/**
 * Rows or columns inserted (`count` > 0) or deleted (`count` < 0) at index `at`:
 * anchors past that point shift along, and those inside a deleted band are dropped.
 * @param {"row"|"col"} axis
 */
export const shiftCommentAnchors = (anchors, axis, at, count) => remap(anchors, (ref, id) => {
    const pos = axis === "row" ? ref.row : ref.col;
    if (pos < at) return id;
    if (count < 0 && pos < at - count) return null;
    return axis === "row" ? getCellId(pos + count, ref.col) : getCellId(ref.row, pos + count);
});

/**
 * Rows reordered within a block of columns (a sort): `rowMap` is a Map of the row each
 * moved row came from -> the row it is now on. Anchors in those columns go with their row.
 */
export const reorderCommentAnchorRows = (anchors, { minCol, maxCol }, rowMap) => remap(anchors, (ref, id) => {
    if (ref.col < minCol || ref.col > maxCol || !rowMap.has(ref.row)) return id;
    return getCellId(rowMap.get(ref.row), ref.col);
});

/**
 * A block of cells moved by cut and paste: its anchors move by the same offset, and
 * any that were on the cells it lands on are dropped along with those cells' content.
 */
export const moveCommentAnchorBlock = (anchors, { minRow, maxRow, minCol, maxCol }, rowOffset, colOffset) => {
    if (rowOffset === 0 && colOffset === 0) return anchors || EMPTY;
    const inSource = (ref) => ref.row >= minRow && ref.row <= maxRow && ref.col >= minCol && ref.col <= maxCol;
    const inTarget = (ref) => ref.row >= minRow + rowOffset && ref.row <= maxRow + rowOffset
        && ref.col >= minCol + colOffset && ref.col <= maxCol + colOffset;
    const source = anchors || EMPTY;
    const next = {};
    let changed = false;
    // Those staying put first, so a moved anchor always wins the cell it lands on.
    for (const id of Object.keys(source)) {
        const ref = parseCellRef(id);
        if (!ref || (!inSource(ref) && !inTarget(ref))) next[id] = source[id];
        else changed = true;
    }
    for (const id of Object.keys(source)) {
        const ref = parseCellRef(id);
        if (ref && inSource(ref)) next[getCellId(ref.row + rowOffset, ref.col + colOffset)] = source[id];
    }
    return changed ? next : source;
};

/**
 * Cells merged into one: only the top-left cell is left to hold a comment. It keeps its
 * own; otherwise the first one found in the range (reading across, then down) moves
 * there. The rest are dropped, as the other cells' content is.
 */
export const mergeCommentAnchors = (anchors, { minRow, maxRow, minCol, maxCol }) => {
    const source = anchors || EMPTY;
    const anchorId = getCellId(minRow, minCol);
    const inside = Object.keys(source)
        .map((id) => ({ id, ref: parseCellRef(id) }))
        .filter(({ id, ref }) => ref && id !== anchorId && ref.row >= minRow && ref.row <= maxRow && ref.col >= minCol && ref.col <= maxCol)
        .sort((a, b) => a.ref.row - b.ref.row || a.ref.col - b.ref.col);
    if (inside.length === 0) return source;
    const next = { ...source };
    for (const { id } of inside) delete next[id];
    if (!source[anchorId]) next[anchorId] = source[inside[0].id];
    return next;
};

/**
 * A thread as plain text for a spreadsheet note, one message per paragraph:
 * "Name: what they wrote".
 */
export const threadToNoteText = (thread) => {
    const lines = (thread?.messages || []).map((message) => `${message.authorName || "User"}: ${message.text}`);
    if (thread?.status === "resolved") lines.push(`(Resolved${thread.resolvedByName ? ` by ${thread.resolvedByName}` : ""})`);
    return lines.join("\n\n");
};
