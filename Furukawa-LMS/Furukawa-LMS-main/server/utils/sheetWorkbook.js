// The stored shape of a spreadsheet workbook — { sheets: { name: sheet }, activeSheet } —
// and the patches that change it.
//
// A patch is what a client sends instead of the whole workbook when only some cells or
// sheet settings changed since the version it loaded:
//
//   { v: 1,
//     activeSheet: "Sheet 1",                       // optional
//     sheets: { "Sheet 1": {
//         set:   { "B7": { value: "42" } },         // cells added or replaced, whole cell objects
//         del:   ["C9"],                            // cells removed
//         props: { rowCount: 40, merges: [...] },   // sheet settings replaced, whole values
//         unset: ["pivotConfig"]                    // sheet settings removed
//         anchors: { set: { "B4": "thread id" }, del: ["C2"] }   // comment anchors, cell by cell
//     } } }
//
// `anchors` changes the sheet's `commentAnchors` map ({ cellId: comment thread id }) one
// cell at a time rather than replacing it whole the way `props` would, so that two people
// who each comment on a different cell don't undo one another.
//
// A patch never adds, removes, renames or reorders sheets — the client saves the whole
// workbook for those. Every operation sets or removes a value outright, so applying
// the same patch twice leaves the same workbook as applying it once.

const DEFAULT_ROW_COUNT = 30;
const DEFAULT_COLUMN_COUNT = 15;
const DEFAULT_SHEET_NAME = "Sheet 1";

// Past this a client should have sent the whole workbook; it is a sanity bound, set
// above the client's own limit so the two can never disagree about a borderline patch.
const MAX_PATCH_CELLS = 20000;

const CELL_ID_RE = /^[A-Z]{1,3}[1-9][0-9]{0,6}$/;
const SHEET_ENTRY_KEYS = new Set(["set", "del", "props", "unset", "anchors"]);
const MAX_THREAD_ID_LENGTH = 64;
// Assigning to these on a plain object changes its prototype rather than storing a value.
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const isSettingKey = (key) => key !== "cells" && !UNSAFE_KEYS.has(key);

export const parseSheetData = (value) => {
    try {
        const parsed = typeof value === "string" ? JSON.parse(value) : (value || {});
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
        return {};
    }
};

export const normalizeWorkbook = (data) => {
    if (data && data.sheets && typeof data.sheets === "object" && Object.keys(data.sheets).length > 0) {
        const activeSheet = data.activeSheet && data.sheets[data.activeSheet]
            ? data.activeSheet
            : Object.keys(data.sheets)[0];
        return { sheets: data.sheets, activeSheet };
    }

    return {
        sheets: {
            [DEFAULT_SHEET_NAME]: { cells: {}, rowCount: DEFAULT_ROW_COUNT, columnCount: DEFAULT_COLUMN_COUNT }
        },
        activeSheet: DEFAULT_SHEET_NAME
    };
};

/**
 * A stored workbook for a copy of its meeting: the same, minus the comment anchors.
 * Comment threads belong to the meeting they were written in and are not copied, and an
 * anchor without its thread would only be dead weight in the new workbook.
 * @param {string|object} sheetData as the meeting model hands it over
 * @returns {string|object} `sheetData` itself when it has no anchors
 */
export const withoutCommentAnchors = (sheetData) => {
    const data = parseSheetData(sheetData);
    if (!isPlainObject(data.sheets)) return sheetData;
    let sheets = null;
    for (const [name, sheet] of Object.entries(data.sheets)) {
        if (!isPlainObject(sheet) || !hasOwn(sheet, "commentAnchors")) continue;
        const { commentAnchors, ...rest } = sheet;
        (sheets || (sheets = { ...data.sheets }))[name] = rest;
    }
    return sheets ? { ...data, sheets } : sheetData;
};

/**
 * Checks a patch received from a client before it is stored.
 * @returns {string|null} what is wrong with it, or null when it is well formed
 */
export const validatePatch = (patch) => {
    if (!isPlainObject(patch)) return "Patch must be an object";
    if (patch.v !== 1) return "Unsupported patch version";
    for (const key of Object.keys(patch)) {
        if (key !== "v" && key !== "activeSheet" && key !== "sheets") return `Unknown patch field: ${key}`;
    }
    if (patch.activeSheet !== undefined && typeof patch.activeSheet !== "string") return "activeSheet must be a string";
    if (patch.sheets === undefined) return null;
    if (!isPlainObject(patch.sheets)) return "sheets must be an object";

    let cellCount = 0;
    for (const [name, entry] of Object.entries(patch.sheets)) {
        if (!isPlainObject(entry)) return `Sheet "${name}": entry must be an object`;
        for (const key of Object.keys(entry)) {
            if (!SHEET_ENTRY_KEYS.has(key)) return `Sheet "${name}": unknown field ${key}`;
        }
        if (entry.set !== undefined) {
            if (!isPlainObject(entry.set)) return `Sheet "${name}": set must be an object`;
            for (const [id, cell] of Object.entries(entry.set)) {
                if (!CELL_ID_RE.test(id)) return `Sheet "${name}": invalid cell id ${id}`;
                if (!isPlainObject(cell)) return `Sheet "${name}": cell ${id} must be an object`;
                cellCount++;
            }
        }
        if (entry.del !== undefined) {
            if (!Array.isArray(entry.del)) return `Sheet "${name}": del must be an array`;
            for (const id of entry.del) {
                if (typeof id !== "string" || !CELL_ID_RE.test(id)) return `Sheet "${name}": invalid cell id ${id}`;
                cellCount++;
            }
        }
        if (entry.props !== undefined) {
            if (!isPlainObject(entry.props)) return `Sheet "${name}": props must be an object`;
            for (const key of Object.keys(entry.props)) {
                if (!isSettingKey(key)) return `Sheet "${name}": ${key} cannot be set through props`;
            }
        }
        if (entry.unset !== undefined) {
            if (!Array.isArray(entry.unset)) return `Sheet "${name}": unset must be an array`;
            for (const key of entry.unset) {
                if (typeof key !== "string" || !isSettingKey(key)) return `Sheet "${name}": ${key} cannot be unset`;
            }
        }
        if (entry.anchors !== undefined) {
            const anchors = entry.anchors;
            if (!isPlainObject(anchors)) return `Sheet "${name}": anchors must be an object`;
            for (const key of Object.keys(anchors)) {
                if (key !== "set" && key !== "del") return `Sheet "${name}": unknown anchors field ${key}`;
            }
            if (anchors.set !== undefined) {
                if (!isPlainObject(anchors.set)) return `Sheet "${name}": anchors.set must be an object`;
                for (const [id, threadId] of Object.entries(anchors.set)) {
                    if (!CELL_ID_RE.test(id)) return `Sheet "${name}": invalid cell id ${id}`;
                    if (typeof threadId !== "string" || !threadId || threadId.length > MAX_THREAD_ID_LENGTH) {
                        return `Sheet "${name}": invalid comment thread for ${id}`;
                    }
                    cellCount++;
                }
            }
            if (anchors.del !== undefined) {
                if (!Array.isArray(anchors.del)) return `Sheet "${name}": anchors.del must be an array`;
                for (const id of anchors.del) {
                    if (typeof id !== "string" || !CELL_ID_RE.test(id)) return `Sheet "${name}": invalid cell id ${id}`;
                    cellCount++;
                }
            }
        }
        if (cellCount > MAX_PATCH_CELLS) return "Patch changes too many cells; save the whole workbook instead";
    }
    return null;
};

/**
 * Applies a validated patch to a normalized workbook, in place.
 * @returns {string[]} names of sheets the patch addressed that the workbook doesn't have
 *   (their changes are not applied) — empty unless the patch was built against a
 *   different workbook than this one.
 */
export const applyPatch = (workbook, patch) => {
    const missingSheets = [];
    for (const [name, entry] of Object.entries(patch.sheets || {})) {
        if (!hasOwn(workbook.sheets, name) || !isPlainObject(workbook.sheets[name])) {
            missingSheets.push(name);
            continue;
        }
        const sheet = workbook.sheets[name];
        if (entry.set || entry.del) {
            if (!isPlainObject(sheet.cells)) sheet.cells = {};
            if (entry.set) Object.assign(sheet.cells, entry.set);
            if (entry.del) for (const id of entry.del) delete sheet.cells[id];
        }
        if (entry.props) for (const [key, value] of Object.entries(entry.props)) sheet[key] = value;
        if (entry.unset) for (const key of entry.unset) delete sheet[key];
        if (entry.anchors) {
            if (!isPlainObject(sheet.commentAnchors)) sheet.commentAnchors = {};
            if (entry.anchors.set) Object.assign(sheet.commentAnchors, entry.anchors.set);
            if (entry.anchors.del) for (const id of entry.anchors.del) delete sheet.commentAnchors[id];
        }
    }
    if (typeof patch.activeSheet === "string" && hasOwn(workbook.sheets, patch.activeSheet)) {
        workbook.activeSheet = patch.activeSheet;
    }
    return missingSheets;
};

/**
 * The patches that are part of the current workbook, oldest first: the unbroken run of
 * versions ending at the meeting's current `version`. A full save bumps the version
 * without adding a patch, so anything older than a gap in the numbering has already
 * been superseded and is left out.
 * @template {{ version: number }} T
 * @param {number} version the meeting's current version
 * @param {T[]} patchRows
 * @returns {T[]}
 */
export const pendingPatchRun = (version, patchRows) => {
    const byVersion = new Map(patchRows.map((row) => [row.version, row]));
    const pending = [];
    for (let v = version; byVersion.has(v); v--) pending.unshift(byVersion.get(v));
    return pending;
};

/**
 * Applies patches, oldest first, to a stored workbook and returns the result as JSON.
 * @param {string|null|undefined} snapshotJson the stored workbook
 * @param {string[]} patchJsons
 * @returns {{ json: string, missingSheets: string[] }}
 */
export const foldPatches = (snapshotJson, patchJsons) => {
    const workbook = normalizeWorkbook(parseSheetData(snapshotJson));
    const missingSheets = [];
    for (const patchJson of patchJsons) missingSheets.push(...applyPatch(workbook, JSON.parse(patchJson)));
    return { json: JSON.stringify(workbook), missingSheets: [...new Set(missingSheets)] };
};

// --- Export to a real .xlsx ---------------------------------------------------------

/**
 * Where a stored cell sits on a worksheet, 1-indexed as Excel counts.
 * Cells are keyed by their A1-style id ("B7"). Workbooks saved by a much older grid
 * used "row,col" (0-indexed); both are understood.
 * @returns {{ row: number, col: number }|null} null when the key is neither form
 */
export const cellKeyToPosition = (key) => {
    const text = String(key);
    const a1 = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(text);
    if (a1) {
        let col = 0;
        for (const ch of a1[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
        return { row: Number(a1[2]), col };
    }
    const legacy = /^(\d+),(\d+)$/.exec(text);
    if (legacy) return { row: Number(legacy[1]) + 1, col: Number(legacy[2]) + 1 };
    return null;
};

/**
 * The value to write to Excel for a stored cell, following the grid's own export: a
 * value starting with "=" is a formula, a numeric string is a number, anything else is
 * kept as is.
 * @returns {{ formula: string }|number|string|boolean|null} null for an empty cell
 */
export const cellExportValue = (cell) => {
    if (!isPlainObject(cell)) return null;
    // `formula` is the old shape; the grid keeps a formula in `value` itself.
    const raw = cell.formula ? `=${String(cell.formula).replace(/^=/, "")}` : cell.value;
    if (raw === undefined || raw === null || raw === "") return null;
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (trimmed.startsWith("=")) return trimmed.length > 1 ? { formula: trimmed.slice(1) } : null;
        if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return Number(trimmed);
    }
    return raw;
};
