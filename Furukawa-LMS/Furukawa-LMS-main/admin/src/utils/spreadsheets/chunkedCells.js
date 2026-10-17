// A sheet's cell map ({ cellId: cell }) stored in blocks, so that a copy of it
// costs time in proportion to the number of blocks rather than of cells.
//
// Cell maps are never edited in place: every edit works on a copy of the
// previous map (see workbookUpdate.js). On a sheet of a million cells that
// copy alone takes the better part of a second. A chunked map instead splits
// its cells into blocks of CHUNK_ROWS rows by CHUNK_COLS columns, and a copy
// shares every block with the map it came from; a block is copied only when a
// cell in it is first written, so an edit costs one block, not the sheet.
//
// To everything that uses it, a chunked map *is* a plain object: it's a Proxy
// that answers `cells[id]`, `id in cells`, assignment, `delete`, Object.keys,
// for...in and JSON.stringify exactly as the plain map would, so the code that
// reads cells doesn't need to know which kind it has. Whole-sheet loops are
// faster through forEachCellId / cellIdsOf, which walk the blocks directly
// instead of going through the Proxy for every cell.

import { cellPosOf, CELL_POS_STRIDE, parseCellRef } from "./formulaEngine.js";

const CHUNK_ROW_SHIFT = 7; // 128 rows
const CHUNK_COL_SHIFT = 5; // by 32 columns
const MISC_CHUNK = -1; // keys that aren't canonical cell ids ("a1", "$A$1", "foo")

const STORE = Symbol("chunkedCellsStore");

const chunkKeyOf = (id) => {
    const pos = cellPosOf(id);
    if (pos < 0) return MISC_CHUNK;
    const row = Math.floor(pos / CELL_POS_STRIDE);
    const col = pos - row * CELL_POS_STRIDE;
    return (row >> CHUNK_ROW_SHIFT) * 1024 + (col >> CHUNK_COL_SHIFT);
};

// The object behind each Proxy. Its prototype is what makes a chunked map not
// a "plain" object to immer, which leaves it alone instead of drafting it,
// and what gives it the methods a plain object inherits.
class ChunkedCells {
    toJSON() {
        const out = {};
        for (const chunk of this[STORE].chunks.values()) for (const [id, cell] of chunk) out[id] = cell;
        return out;
    }
}

const makeHandle = (store) => new Proxy(new ChunkedCells(), {
    get(target, key, receiver) {
        if (key === STORE) return store;
        if (typeof key === "string") {
            const chunkKey = chunkKeyOf(key);
            const chunk = store.chunks.get(chunkKey);
            if (chunk && chunk.has(key)) return chunk.get(key);
            // A cell id can't name anything a plain object inherits.
            if (chunkKey !== MISC_CHUNK) return undefined;
        }
        return Reflect.get(target, key, receiver);
    },
    set(target, key, value) {
        if (typeof key !== "string") return Reflect.set(target, key, value);
        writableChunk(store, chunkKeyOf(key)).set(key, value);
        return true;
    },
    deleteProperty(target, key) {
        if (typeof key !== "string") return Reflect.deleteProperty(target, key);
        const chunkKey = chunkKeyOf(key);
        if (store.chunks.get(chunkKey)?.has(key)) {
            const chunk = writableChunk(store, chunkKey);
            chunk.delete(key);
            if (chunk.size === 0) { store.chunks.delete(chunkKey); store.owned.delete(chunkKey); }
        }
        return true;
    },
    has(target, key) {
        if (typeof key === "string") {
            const chunkKey = chunkKeyOf(key);
            if (store.chunks.get(chunkKey)?.has(key)) return true;
            if (chunkKey !== MISC_CHUNK) return false;
        }
        return Reflect.has(target, key);
    },
    ownKeys(target) {
        return [...idsOf(store), ...Reflect.ownKeys(target)];
    },
    getOwnPropertyDescriptor(target, key) {
        if (typeof key === "string") {
            const chunk = store.chunks.get(chunkKeyOf(key));
            if (chunk && chunk.has(key)) return { value: chunk.get(key), writable: true, enumerable: true, configurable: true };
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
    },
    defineProperty(target, key, descriptor) {
        if (typeof key !== "string" || !("value" in descriptor)) return Reflect.defineProperty(target, key, descriptor);
        writableChunk(store, chunkKeyOf(key)).set(key, descriptor.value);
        return true;
    },
    // A frozen map would have to list exactly its target's keys; it can't be one.
    preventExtensions() {
        return false;
    },
});

// The block for `chunkKey`, made this map's own (copied, if it was shared) so
// writing to it can't change any other map.
const writableChunk = (store, chunkKey) => {
    let chunk = store.chunks.get(chunkKey);
    if (!store.owned.has(chunkKey)) {
        chunk = chunk ? new Map(chunk) : new Map();
        store.chunks.set(chunkKey, chunk);
        store.owned.add(chunkKey);
    }
    return chunk;
};

function* idsOf(store) {
    for (const chunk of store.chunks.values()) yield* chunk.keys();
}

const storeOf = (cells) => (cells && typeof cells === "object" ? cells[STORE] : undefined);

/** Whether `cells` is a chunked map. */
export const isChunkedCells = (cells) => !!storeOf(cells);

/**
 * A new, empty chunked map, for building a large sheet's cells: unlike a plain
 * object, which V8 won't let hold more than about 8.4 million keys, it holds
 * any number (each block is a Map of its own).
 * @returns {object}
 */
export const createCellMap = () => makeHandle({ chunks: new Map(), owned: new Set() });

/**
 * A copy of a cell map — plain or chunked — as a chunked map. Copying a chunked
 * map shares its blocks (from then on neither writes to a shared block); a
 * plain one is split into blocks, which looks at every cell once.
 * @param {object} cells
 * @returns {object}
 */
export const copyCellMap = (cells) => {
    const source = storeOf(cells);
    if (source) {
        source.owned.clear();
        return makeHandle({ chunks: new Map(source.chunks), owned: new Set() });
    }
    const store = { chunks: new Map(), owned: new Set() };
    for (const id in cells) {
        if (!Object.prototype.hasOwnProperty.call(cells, id)) continue;
        writableChunk(store, chunkKeyOf(id)).set(id, cells[id]);
    }
    return makeHandle(store);
};

/**
 * Calls `fn(id, cell)` for each entry of a cell map, plain or chunked, the way
 * `for (const id in cells)` would visit them — without a Proxy call per cell.
 */
export const forEachCellId = (cells, fn) => {
    const store = storeOf(cells);
    if (store) {
        for (const chunk of store.chunks.values()) for (const [id, cell] of chunk) fn(id, cell);
        return;
    }
    for (const id in cells) fn(id, cells[id]);
};

/**
 * Calls `fn(id, row, col)` for each entry of a cell map whose id names a cell
 * inside `bounds` ({ minRow, maxRow, minCol, maxCol }, 0-based). For a chunked
 * map only the blocks that overlap `bounds` are looked at, so a range over one
 * column of a wide sheet doesn't walk the whole sheet.
 */
export const forEachCellIdIn = (cells, bounds, fn) => {
    const { minRow, maxRow, minCol, maxCol } = bounds;
    const visit = (id) => {
        const pos = cellPosOf(id);
        let row, col;
        if (pos >= 0) {
            row = Math.floor(pos / CELL_POS_STRIDE);
            col = pos - row * CELL_POS_STRIDE;
        } else {
            const ref = parseCellRef(id);
            if (!ref) return;
            ({ row, col } = ref);
        }
        if (row >= minRow && row <= maxRow && col >= minCol && col <= maxCol) fn(id, row, col);
    };
    const store = storeOf(cells);
    if (!store) {
        for (const id in cells) visit(id);
        return;
    }
    const r1 = minRow >> CHUNK_ROW_SHIFT, r2 = maxRow >> CHUNK_ROW_SHIFT;
    const c1 = minCol >> CHUNK_COL_SHIFT, c2 = maxCol >> CHUNK_COL_SHIFT;
    const visitChunk = (chunk) => { if (chunk) for (const id of chunk.keys()) visit(id); };
    if ((r2 - r1 + 1) * (c2 - c1 + 1) < store.chunks.size) {
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) visitChunk(store.chunks.get(r * 1024 + c));
        visitChunk(store.chunks.get(MISC_CHUNK));
    } else {
        for (const chunk of store.chunks.values()) visitChunk(chunk);
    }
};

/** How many entries a cell map, plain or chunked, holds. */
export const cellCountOf = (cells) => {
    const store = storeOf(cells);
    if (!store) return Object.keys(cells).length;
    let count = 0;
    for (const chunk of store.chunks.values()) count += chunk.size;
    return count;
};

/** Object.keys(cells), for a plain or chunked cell map, without a Proxy call per cell. */
export const cellIdsOf = (cells) => {
    const store = storeOf(cells);
    return store ? [...idsOf(store)] : Object.keys(cells);
};
