import { forEachCellId } from "./chunkedCells.js";
import { parseCellRef } from "./formulaEngine.js";
import { changedCellIdsOf, plainOf } from "./workbookUpdate.js";

// How far the grid goes. A sheet keeps two sizes:
//   saved      sheet.rowCount / columnCount: as far as it holds anything. Saved,
//              shared with everyone and undoable; it grows when something is
//              written beyond it (see contentExtent).
//   on screen  how far the grid is drawn for this viewer: always some way past
//              what is in view, the cursor and the selection, so scrolling never
//              meets an edge, as in Excel. Never saved; it shrinks back to the
//              saved size and the screen once whatever took it further is gone.

export const GRID_MAX_ROWS = 100000;
export const GRID_MAX_COLS = 702; // A..ZZ

// The on-screen size along one axis, as a count of rows or columns. `reach` is how
// many it must take in (the last one in view, the cursor, ...); it goes `chunk`
// past that, in whole chunks so that it changes only every so often. It grows at
// once but only shrinks when `idle` (not while the user is scrolling or dragging),
// and never below `saved`.
export const viewExtent = ({ current, saved, reach, chunk, max, idle }) => {
    const want = Math.max(saved, Math.min(max, Math.ceil((reach + chunk) / chunk) * chunk));
    if (want > current) return want;
    return idle ? want : current;
};

const growTo = (extent, row, col) => {
    if (row + 1 > extent.rows) extent.rows = row + 1;
    if (col + 1 > extent.cols) extent.cols = col + 1;
};

// The size a sheet needs to take in what it holds, as { rows, cols } counts: its
// cells (only `cellIds` among them when given, else every one; a cell holding only
// formatting counts), merges, images and shapes, comment anchors, and rows and
// columns given a size of their own or hidden.
export const contentExtent = ({ cells, cellIds, merges, media, commentAnchors, rowHeights, columnWidths, hiddenRows, hiddenCols }) => {
    const extent = { rows: 0, cols: 0 };
    const visit = (id) => {
        const ref = parseCellRef(id);
        if (ref) growTo(extent, ref.row, ref.col);
    };
    if (cellIds) {
        for (const id of cellIds) if (cells && Object.prototype.hasOwnProperty.call(cells, id)) visit(id);
    } else if (cells) {
        forEachCellId(cells, visit);
    }
    for (const m of merges || []) {
        const s = parseCellRef(m.start), e = parseCellRef(m.end);
        if (s) growTo(extent, s.row, s.col);
        if (e) growTo(extent, e.row, e.col);
    }
    for (const item of media || []) growTo(extent, item.row || 0, item.col || 0);
    for (const id of Object.keys(commentAnchors || {})) visit(id);
    for (const r of Object.keys(rowHeights || {})) growTo(extent, Number(r), 0);
    for (const c of Object.keys(columnWidths || {})) growTo(extent, 0, Number(c));
    for (const r of hiddenRows || []) growTo(extent, r, 0);
    for (const c of hiddenCols || []) growTo(extent, 0, c);
    return extent;
};

// For an updater, run after it: each sheet's saved size grown to take in whatever
// the update put beyond it. Only the cells the update wrote are looked at, unless
// it replaced a sheet's cells wholesale. PivotTable sheets are sized by their own
// recompute.
export const fitSheetsToContent = (draft) => {
    for (const name of Object.keys(draft)) {
        const sheet = draft[name];
        if (!sheet || typeof sheet !== "object" || sheet.pivotConfig) continue;
        // The cells through plainOf (no proxy call per cell); the rest is small, and
        // read through the draft so that what this update added to it counts.
        const need = contentExtent({
            cells: plainOf(sheet.cells), cellIds: changedCellIdsOf(sheet.cells),
            merges: sheet.merges, media: sheet.media, commentAnchors: sheet.commentAnchors,
            rowHeights: sheet.rowHeights, columnWidths: sheet.columnWidths,
            hiddenRows: sheet.hiddenRows, hiddenCols: sheet.hiddenCols,
        });
        if (need.rows > (sheet.rowCount || 0)) sheet.rowCount = need.rows;
        if (need.cols > (sheet.columnCount || 0)) sheet.columnCount = need.cols;
    }
};
