// Keeping an open workbook in step with saves made elsewhere (live co-editing).
//
// The grid holds two workbooks ({ sheetName: sheet }) for a meeting: `live`, what is
// on screen, and `saved`, what the server holds at the version the grid knows about.
// The difference between the two is exactly the user's unsaved work — workbookDiff.js
// finds it by comparing object identity, which works because nothing is ever edited
// in place (see workbookUpdate.js).
//
// When someone else's save arrives as a patch (the format is described in the
// server's utils/sheetWorkbook.js), `saved` takes all of it, and `live` takes it
// wherever the user has no unsaved change of their own: a cell or sheet setting they
// have edited keeps their value, which then wins when they save. Everything here
// follows the same no-editing-in-place rule, and puts the very same cell objects into
// both workbooks, so that after a patch is taken the two still differ by exactly the
// user's unsaved work and nothing else.

const DEFAULT_ROW_COUNT = 30;
const DEFAULT_COLUMN_COUNT = 15;
const DEFAULT_SHEET_NAME = "Sheet 1";

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const EMPTY_CELLS = Object.freeze({});

/**
 * A workbook exactly as stored on the server, in the shape the grid loads:
 * { sheets, activeSheet }. Mirrors normalizeWorkbook in the server's
 * utils/sheetWorkbook.js, for when the server passes the stored workbook through
 * untouched instead of normalizing it itself.
 */
export const normalizeStoredWorkbook = (data) => {
    if (isPlainObject(data) && isPlainObject(data.sheets) && Object.keys(data.sheets).length > 0) {
        const activeSheet = data.activeSheet && data.sheets[data.activeSheet]
            ? data.activeSheet
            : Object.keys(data.sheets)[0];
        return { sheets: data.sheets, activeSheet };
    }
    return {
        sheets: { [DEFAULT_SHEET_NAME]: { cells: {}, rowCount: DEFAULT_ROW_COUNT, columnCount: DEFAULT_COLUMN_COUNT } },
        activeSheet: DEFAULT_SHEET_NAME
    };
};

// Applies one sheet's patch entry to `sheet`, taking a cell or setting only where
// `takes(kind, key)` allows it. Returns `sheet` itself when nothing was taken.
const applyEntry = (sheet, entry, takes) => {
    let next = null;
    const writable = () => next || (next = { ...sheet });

    if (entry.set || entry.del) {
        const cells = isPlainObject(sheet.cells) ? sheet.cells : EMPTY_CELLS;
        let nextCells = null;
        const writableCells = () => nextCells || (nextCells = { ...cells });
        if (entry.set) {
            for (const id of Object.keys(entry.set)) {
                if (cells[id] !== entry.set[id] && takes("cell", id)) writableCells()[id] = entry.set[id];
            }
        }
        if (entry.del) {
            for (const id of entry.del) {
                if (hasOwn(nextCells || cells, id) && takes("cell", id)) delete writableCells()[id];
            }
        }
        if (nextCells) writable().cells = nextCells;
    }
    if (entry.anchors) {
        const anchors = isPlainObject(sheet.commentAnchors) ? sheet.commentAnchors : EMPTY_CELLS;
        let nextAnchors = null;
        const writableAnchors = () => nextAnchors || (nextAnchors = { ...anchors });
        if (entry.anchors.set) {
            for (const id of Object.keys(entry.anchors.set)) {
                if (anchors[id] !== entry.anchors.set[id] && takes("anchor", id)) writableAnchors()[id] = entry.anchors.set[id];
            }
        }
        if (entry.anchors.del) {
            for (const id of entry.anchors.del) {
                if (hasOwn(nextAnchors || anchors, id) && takes("anchor", id)) delete writableAnchors()[id];
            }
        }
        // As on the server, an anchors entry leaves the sheet with a map even if empty.
        if (nextAnchors || !isPlainObject(sheet.commentAnchors)) writable().commentAnchors = nextAnchors || {};
    }
    if (entry.props) {
        for (const key of Object.keys(entry.props)) {
            if (sheet[key] !== entry.props[key] && takes("prop", key)) writable()[key] = entry.props[key];
        }
    }
    if (entry.unset) {
        for (const key of entry.unset) {
            if (hasOwn(next || sheet, key) && takes("prop", key)) delete writable()[key];
        }
    }
    return next || sheet;
};

const takeAll = () => true;

/**
 * The server's workbook after `patch`: what the server's applyPatch produces, built
 * without changing `saved`. Sheets the patch names that the workbook doesn't have are
 * skipped, as they are on the server.
 * @param {Object<string, object>} saved
 * @param {object} patch
 * @returns {Object<string, object>} `saved` itself when the patch changes nothing
 */
export const applyPatchToSaved = (saved, patch) => {
    let next = null;
    for (const [name, entry] of Object.entries(patch?.sheets || {})) {
        if (!hasOwn(saved, name) || !isPlainObject(saved[name]) || !isPlainObject(entry)) continue;
        const sheet = applyEntry(saved[name], entry, takeAll);
        if (sheet !== saved[name]) (next || (next = { ...saved }))[name] = sheet;
    }
    return next || saved;
};

/**
 * The on-screen workbook after someone else's `patch`: each cell and sheet setting the
 * patch touches is taken unless the user has an unsaved change to it.
 * @param {Object<string, object>} live the workbook on screen
 * @param {Object<string, object>} savedBefore the server's workbook before the patch
 * @param {object} patch
 * @param {Object<string, object>} [savedAfter] applyPatchToSaved(savedBefore, patch), if
 *   already at hand: a sheet with no unsaved changes at all is then taken from it whole
 * @returns {Object<string, object>} `live` itself when nothing on screen changes
 */
export const rebaseLive = (live, savedBefore, patch, savedAfter = applyPatchToSaved(savedBefore, patch)) => {
    let next = null;
    for (const [name, entry] of Object.entries(patch?.sheets || {})) {
        // A sheet the user has removed or renamed (unsaved) has nowhere to take it.
        if (!hasOwn(live, name) || !isPlainObject(live[name]) || !isPlainObject(entry)) continue;
        if (!hasOwn(savedBefore, name) || !isPlainObject(savedBefore[name])) continue;
        const liveSheet = live[name];
        const savedSheet = savedBefore[name];

        let sheet;
        if (liveSheet === savedSheet) {
            sheet = savedAfter[name];
        } else {
            const liveCells = isPlainObject(liveSheet.cells) ? liveSheet.cells : EMPTY_CELLS;
            const savedCells = isPlainObject(savedSheet.cells) ? savedSheet.cells : EMPTY_CELLS;
            // "Unsaved" is "not the object the server's copy has" — including a cell or
            // setting present in one and absent from the other.
            const liveAnchors = isPlainObject(liveSheet.commentAnchors) ? liveSheet.commentAnchors : EMPTY_CELLS;
            const savedAnchors = isPlainObject(savedSheet.commentAnchors) ? savedSheet.commentAnchors : EMPTY_CELLS;
            const untouched = (kind, key) => {
                if (kind === "cell") return liveCells[key] === savedCells[key];
                if (kind === "anchor") return liveAnchors[key] === savedAnchors[key];
                return liveSheet[key] === savedSheet[key];
            };
            sheet = applyEntry(liveSheet, entry, untouched);
            // No unsaved cell edits on this sheet: share the server's cell map outright,
            // so the next save doesn't have to compare the two cell by cell.
            if (liveSheet.cells === savedSheet.cells && sheet !== liveSheet && isPlainObject(savedAfter[name])) {
                sheet.cells = savedAfter[name].cells;
            }
            // Likewise for comment anchors, so the two stay the same object.
            if (entry.anchors && liveSheet.commentAnchors === savedSheet.commentAnchors && sheet !== liveSheet
                && isPlainObject(savedAfter[name]?.commentAnchors)) {
                sheet.commentAnchors = savedAfter[name].commentAnchors;
            }
        }
        if (sheet !== liveSheet) (next || (next = { ...live }))[name] = sheet;
    }
    return next || live;
};

/**
 * Takes someone else's saved `patch` into both workbooks.
 * @returns {{ live: Object<string, object>, saved: Object<string, object> }}
 */
export const rebaseRemotePatch = (live, saved, patch) => {
    const nextSaved = applyPatchToSaved(saved, patch);
    return { live: rebaseLive(live, saved, patch, nextSaved), saved: nextSaved };
};

/**
 * Takes a run of patches, oldest first, into both workbooks.
 * @param {Array<{ patch: object }>} patches
 * @returns {{ live: Object<string, object>, saved: Object<string, object> }}
 */
export const rebaseRemotePatches = (live, saved, patches) => {
    let state = { live, saved };
    for (const { patch } of patches) state = rebaseRemotePatch(state.live, state.saved, patch);
    return state;
};

/**
 * A workbook that was being saved when the server turned out to be ahead, carried over
 * the patches it had missed — the same treatment the on-screen workbook gets, so the
 * save can be retried without undoing what the others saved.
 * @param {Object<string, object>} snapshot the workbook being saved
 * @param {Object<string, object>} savedBefore the server's workbook the save was built on
 * @param {Array<{ patch: object }>} patches what the server had beyond it, oldest first
 */
export const rebaseSnapshot = (snapshot, savedBefore, patches) =>
    rebaseRemotePatches(snapshot, savedBefore, patches).live;
