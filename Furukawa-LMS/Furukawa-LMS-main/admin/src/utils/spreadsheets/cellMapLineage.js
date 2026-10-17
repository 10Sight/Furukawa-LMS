// Where a sheet's cell map came from, so two cell maps can be compared without
// looking at every cell.
//
// Cell maps are never edited in place: an edit makes a copy of the previous map
// and changes a few entries of it (see workbookUpdate.js and workbookSync.js).
// Each such copy is recorded here as a child of the map it was copied from,
// together with the ids it changed. Two maps that share an ancestor can then
// differ only at ids changed on the way from that ancestor to either of them —
// every other id holds the very same cell object in both. workbookDiff.js uses
// that to build a save patch from the handful of edited cells instead of
// scanning a sheet of a million.
//
// Only small records are kept, never the maps themselves: a node holds its
// parent node and its changed ids, and the map it describes is just the key of
// a WeakMap, so superseded maps are still garbage collected. Chains are cut
// after CHAIN_LIMIT steps to bound what they hold; maps further apart than
// that, or with no recorded relation at all (loaded from the server, built
// wholesale by an import or a sort), report null and are compared in full.

const CHAIN_LIMIT = 256;

const nodes = new WeakMap(); // cell map -> { parent: node | null, changed: Iterable<id> | null, depth }

const isMap = (cells) => !!cells && typeof cells === "object";

const nodeOf = (cells) => {
    let node = nodes.get(cells);
    if (!node) {
        node = { parent: null, changed: null, depth: 0 };
        nodes.set(cells, node);
    }
    return node;
};

/**
 * Records that `cells` is a copy of `base` with only `changedIds` set or removed.
 * The caller must not change `changedIds` afterwards.
 * @param {object} cells
 * @param {object} base
 * @param {Set<string>|string[]} changedIds
 */
export const recordCellMapCopy = (cells, base, changedIds) => {
    if (!isMap(cells) || !isMap(base) || cells === base) return;
    const parent = nodeOf(base);
    const node = { parent, changed: changedIds, depth: parent.depth + 1 };
    nodes.set(cells, node);
    let ancestor = node;
    for (let i = 0; i < CHAIN_LIMIT && ancestor; i++) ancestor = ancestor.parent;
    if (ancestor) ancestor.parent = null;
};

// The ids changed on the way from node `a` to node `b`, or null (see below).
const changesBetween = (a, b, limit) => {
    const ids = new Set();
    if (!a || !b) return null;
    const climb = (node) => {
        if (!node.parent) return null;
        for (const id of node.changed) ids.add(id);
        return ids.size > limit ? null : node.parent;
    };
    while (a !== b) {
        if (a.depth >= b.depth) a = climb(a); else b = climb(b);
        if (!a || !b) return null;
    }
    return ids;
};

/**
 * The ids at which `before` and `after` can hold different cells, or null when
 * that isn't known (no shared ancestor on record) or comes to more than `limit`
 * ids. An empty set means the two maps hold the same cell objects throughout.
 * @param {object} before
 * @param {object} after
 * @param {number} limit
 * @returns {Set<string>|null}
 */
export const cellMapChanges = (before, after, limit) => {
    if (before === after) return new Set();
    return changesBetween(isMap(before) ? nodes.get(before) : null, isMap(after) ? nodes.get(after) : null, limit);
};

/**
 * A mark standing for `cells` that doesn't keep the map alive, for comparing
 * against later with cellMapChangesSince.
 * @param {object} cells
 */
export const cellMapMark = (cells) => (isMap(cells) ? nodeOf(cells) : null);

/**
 * cellMapChanges from the map `mark` stands for to `after`.
 * @returns {Set<string>|null}
 */
export const cellMapChangesSince = (mark, after, limit) =>
    changesBetween(mark, isMap(after) ? nodes.get(after) : null, limit);
