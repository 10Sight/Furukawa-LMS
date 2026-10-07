// Builds the patch that turns one workbook ({ sheetName: sheet }) into another, so a
// save can send what changed instead of the whole workbook. The server applies it to
// its copy of `base` — see server/utils/sheetWorkbook.js, which defines the format.
//
// This relies on how workbookUpdate.js changes a workbook: nothing is edited in
// place, so a sheet, cell map, cell or sheet setting that is the same object in both
// workbooks is unchanged, and anything that changed is a different object. Comparing
// by identity therefore finds every change, whatever made it — typing, paste, fill,
// undo, import — without looking inside a single cell. (An undo followed by a redo
// can leave an equal cell as a new object; that just sends a cell that didn't need
// sending.)

// Past this many changed cells the edit is a bulk rewrite (a large paste, a row
// insert that shifts everything below it) and the whole workbook is saved instead.
export const MAX_PATCH_CELLS = 5000;

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const EMPTY = Object.freeze({});

/**
 * @param {Object<string, object>} base the workbook the server holds
 * @param {Object<string, object>} next the workbook to save
 * @param {{ activeSheet?: string }} [options] sheet to record as the active one
 * @returns {object|null} the patch, or null when the change can't be expressed as one
 *   (sheets added, removed, renamed or reordered, or too many cells changed) and the
 *   whole workbook has to be saved.
 */
export const diffWorkbook = (base, next, { activeSheet } = {}) => {
    const baseNames = Object.keys(base);
    const nextNames = Object.keys(next);
    if (baseNames.length !== nextNames.length || nextNames.some((name, i) => name !== baseNames[i])) return null;

    const sheets = {};
    let changedCells = 0;
    for (const name of nextNames) {
        const before = base[name];
        const after = next[name];
        if (before === after) continue;
        if (!before || !after || typeof before !== "object" || typeof after !== "object") return null;

        const entry = {};
        const beforeCells = before.cells || {};
        const afterCells = after.cells || {};
        if (beforeCells !== afterCells) {
            const set = {};
            const del = [];
            for (const id in afterCells) {
                if (afterCells[id] === beforeCells[id]) continue;
                // A cell can't be "set" to nothing; treat it as removed.
                if (afterCells[id] === undefined || afterCells[id] === null) {
                    if (beforeCells[id] !== undefined && beforeCells[id] !== null) { del.push(id); changedCells++; }
                    continue;
                }
                set[id] = afterCells[id];
                changedCells++;
            }
            for (const id in beforeCells) {
                if (!hasOwn(afterCells, id)) { del.push(id); changedCells++; }
            }
            if (changedCells > MAX_PATCH_CELLS) return null;
            if (Object.keys(set).length > 0) entry.set = set;
            if (del.length > 0) entry.del = del;
        }

        // Comment anchors ({ cellId: thread id }) are sent cell by cell too: replacing the
        // map whole would drop an anchor someone else saved to another cell meanwhile.
        const beforeAnchors = before.commentAnchors || EMPTY;
        const afterAnchors = after.commentAnchors || EMPTY;
        if (beforeAnchors !== afterAnchors) {
            const set = {};
            const del = [];
            for (const id in afterAnchors) {
                if (afterAnchors[id] === beforeAnchors[id]) continue;
                if (afterAnchors[id]) set[id] = afterAnchors[id];
                else if (beforeAnchors[id]) del.push(id);
            }
            for (const id in beforeAnchors) {
                if (beforeAnchors[id] && !hasOwn(afterAnchors, id)) del.push(id);
            }
            const anchors = {};
            if (Object.keys(set).length > 0) anchors.set = set;
            if (del.length > 0) anchors.del = del;
            // An empty one says only that the sheet now has an anchor map, when it had none.
            if (Object.keys(anchors).length > 0 || (!before.commentAnchors && after.commentAnchors)) entry.anchors = anchors;
        }

        // Everything else on a sheet (row/column counts, merges, widths, charts, media…)
        // is small next to the cells and is replaced whole when it changes.
        const props = {};
        const unset = [];
        for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
            if (key === "cells" || key === "commentAnchors" || before[key] === after[key]) continue;
            // JSON has no `undefined`: a setting that became undefined is one that's gone.
            if (after[key] === undefined) unset.push(key);
            else props[key] = after[key];
        }
        if (Object.keys(props).length > 0) entry.props = props;
        if (unset.length > 0) entry.unset = unset;

        if (Object.keys(entry).length > 0) sheets[name] = entry;
    }

    const patch = { v: 1, sheets };
    if (activeSheet !== undefined) patch.activeSheet = activeSheet;
    return patch;
};
