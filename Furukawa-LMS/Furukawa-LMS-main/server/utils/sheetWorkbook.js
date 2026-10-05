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
//     } } }
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
const SHEET_ENTRY_KEYS = new Set(["set", "del", "props", "unset"]);
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
    }
    if (typeof patch.activeSheet === "string" && hasOwn(workbook.sheets, patch.activeSheet)) {
        workbook.activeSheet = patch.activeSheet;
    }
    return missingSheets;
};
