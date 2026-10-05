// Applies a mutation-style updater to the workbook ({ sheetName: sheet })
// without mutating it and without deep-cloning it, and produces a compact
// record from which the previous workbook can be rebuilt (undo).
//
// Everything on a sheet except its cell map is small, so that part is handled
// by immer (via Redux Toolkit): the updater mutates a draft and only what it
// touches is copied. A sheet's `cells` map is different — it can hold hundreds
// of thousands of entries, and drafting it through immer costs far more than
// the edit itself. So each sheet's `cells` is swapped for a copy-on-write
// handle that immer treats as an opaque value: reads go straight to the
// existing map, and the first write makes one flat copy of it that all further
// writes land in. Cell objects themselves are never changed in place — an
// updater replaces `cells[id]` with a new object.
//
// The result shares every untouched sheet, cell map and cell with the previous
// workbook. The undo record for an ordinary edit holds just the previous
// values of the cells that changed, so the superseded cell map can be garbage
// collected instead of being kept alive by the undo stack.

import { createNextState, isDraft, original } from "@reduxjs/toolkit";
import { deriveCellIndex } from "./formulaEngine";

const CELLS_STATE = Symbol("cellsDraftState");
// Past this many changed cells an update is a bulk rewrite: its undo record
// keeps the whole previous sheet, and the formula index for the new cell map
// is rebuilt by a scan instead of derived from the old one.
const CHANGE_TRACK_LIMIT = 5000;

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// A non-plain prototype is what makes immer leave the handle alone.
class CellsDraft {}

const copyCells = (cells) => {
    const copy = {};
    for (const id in cells) copy[id] = cells[id];
    return copy;
};

const makeCellsDraft = (base, owner) => {
    const state = { base, copy: null, owner, shellSheet: null, changed: new Set(), bulk: false };
    const writable = () => state.copy || (state.copy = copyCells(base));
    const track = (id) => {
        if (state.bulk) return;
        if (state.changed.size >= CHANGE_TRACK_LIMIT) { state.bulk = true; state.changed = null; return; }
        state.changed.add(id);
    };
    const live = () => state.copy || base;
    return new Proxy(Object.create(CellsDraft.prototype), {
        get: (_, key) => (key === CELLS_STATE ? state : live()[key]),
        set: (_, key, value) => { writable()[key] = value; track(key); return true; },
        deleteProperty: (_, key) => {
            if (hasOwn(live(), key)) { delete writable()[key]; track(key); }
            return true;
        },
        has: (_, key) => key in live(),
        ownKeys: () => Reflect.ownKeys(live()),
        getOwnPropertyDescriptor: (_, key) => {
            const desc = Reflect.getOwnPropertyDescriptor(live(), key);
            // The existing map may be frozen; the handle's (empty) target isn't.
            return desc ? { ...desc, configurable: true, writable: true } : undefined;
        },
    });
};

// Inside an updater, the plain object behind `value`: the current contents of
// a cell-map handle, or the pre-update state of an immer draft. Use it for
// read-only passes over a whole sheet, where going through the handle or a
// draft would pay a proxy call per cell. Anything else is returned unchanged.
export const plainOf = (value) => {
    const state = value?.[CELLS_STATE];
    if (state) return state.copy || state.base;
    return isDraft(value) ? original(value) : value;
};

const isSheetObject = (sheet) => !!sheet && typeof sheet === "object" && !Array.isArray(sheet);

// A sheet's properties with the cell map dropped (so a record doesn't keep it
// alive) but its key kept in place, so a rebuilt sheet has the same key order.
const withoutCells = (sheet) => ({ ...sheet, cells: null });

// Runs `updater` against a draft of `prev`. `postProcess(next)`, if given, may
// return an adjusted workbook (e.g. with derived sheets recomputed). Returns
// { next, undo }: `undo` is a record for applyHistoryRecord that turns `next`
// back into `prev`. When nothing changed, `next` is `prev` and `undo` is null.
export const applyWorkbookUpdate = (prev, updater, postProcess) => {
    const shell = {};
    for (const name of Object.keys(prev)) {
        const sheet = prev[name];
        if (!isSheetObject(sheet)) { shell[name] = sheet; continue; }
        const handle = makeCellsDraft(sheet.cells || {}, sheet);
        shell[name] = { ...sheet, cells: handle };
        handle[CELLS_STATE].shellSheet = shell[name];
    }

    const result = createNextState(shell, (draft) => { updater(draft); });

    let next = {};
    const derived = {}; // name -> { sheet, state } for sheets whose cells came from the previous sheet's by tracked edits
    for (const name of Object.keys(result)) {
        const sheet = result[name];
        const state = isSheetObject(sheet) ? sheet.cells?.[CELLS_STATE] : null;
        if (!state) {
            next[name] = sheet; // a sheet the updater built, or one whose cells it replaced wholesale
        } else if (!state.copy && sheet === state.shellSheet) {
            next[name] = state.owner; // untouched: keep the previous object
        } else {
            if (state.copy && !state.bulk) deriveCellIndex(state.copy, state.base, state.changed);
            next[name] = { ...sheet, cells: state.copy || state.base };
            if (!state.bulk && state.owner === prev[name]) derived[name] = { sheet: next[name], state };
        }
    }
    if (postProcess) next = postProcess(next) || next;

    const prevNames = Object.keys(prev), nextNames = Object.keys(next);
    const unchanged = prevNames.length === nextNames.length
        && nextNames.every((name, i) => name === prevNames[i] && next[name] === prev[name]);
    if (unchanged) return { next: prev, undo: null };

    const sheets = {};
    for (const name of prevNames) {
        if (next[name] === prev[name]) continue;
        const d = derived[name];
        if (d && d.sheet === next[name]) {
            let cells = null;
            if (d.state.copy) {
                cells = new Map();
                for (const id of d.state.changed) cells.set(id, hasOwn(d.state.base, id) ? d.state.base[id] : undefined);
            }
            sheets[name] = { props: withoutCells(prev[name]), cells };
        } else {
            sheets[name] = { full: prev[name] };
        }
    }
    return { next, undo: { names: prevNames, sheets } };
};

// Applies an undo/redo record to `current`, the workbook it was recorded
// against. Returns { next, inverse }, where `inverse` undoes this application.
export const applyHistoryRecord = (current, record) => {
    const next = {};
    const patched = new Set();
    for (const name of record.names) {
        const entry = record.sheets[name];
        if (!entry) {
            if (hasOwn(current, name)) next[name] = current[name]; // this sheet was the same on both sides
        } else if (entry.full || !isSheetObject(current[name])) {
            if (entry.full) next[name] = entry.full;
        } else {
            const currentCells = current[name].cells || {};
            let cells = currentCells;
            if (entry.cells && entry.cells.size) {
                cells = copyCells(currentCells);
                for (const [id, cell] of entry.cells) {
                    if (cell === undefined) delete cells[id]; else cells[id] = cell;
                }
                deriveCellIndex(cells, currentCells, entry.cells.keys());
            }
            next[name] = { ...entry.props, cells };
            patched.add(name);
        }
    }

    const currentNames = Object.keys(current);
    const sheets = {};
    for (const name of currentNames) {
        if (next[name] === current[name]) continue;
        const entry = record.sheets[name];
        if (patched.has(name)) {
            let cells = null;
            if (entry.cells && entry.cells.size) {
                const currentCells = current[name].cells || {};
                cells = new Map();
                for (const id of entry.cells.keys()) cells.set(id, hasOwn(currentCells, id) ? currentCells[id] : undefined);
            }
            sheets[name] = { props: withoutCells(current[name]), cells };
        } else {
            sheets[name] = { full: current[name] };
        }
    }
    return { next, inverse: { names: currentNames, sheets } };
};
