import { forEachCellId } from "./chunkedCells.js";
import { parseCellRef } from "./formulaEngine.js";
import { wrapTextLines } from "./shapeText.js";

// A row nobody has given a height of its own is sized to what it holds, as in Excel:
// tall enough for every line of a Wrap Text cell, and for text in a font larger than
// the default. Worked out from the cells rather than stored, so it follows edits,
// pastes, formula results and column widths by itself; a row the user has sized
// (sheet.rowHeights) keeps that height.

// How the grid draws a cell's text (ExcelClone's `px-1.5 text-xs` and cellStyleFor).
const DEFAULT_FONT_SIZE = 12;
const LINE_HEIGHT = 1.35; // text-xs leading is 4/3 of the font size; a little over keeps descenders in
const PADDING_X = 12; // px-1.5 on each side
const PADDING_Y = 10;
const INDENT_PX = 9; // per indent level

// The largest font in a cell: its own, or a bigger one given to part of its text
// (rich text runs, see richText.js).
export const largestFontSize = (cell) => {
    let size = cell?.fontSize || DEFAULT_FONT_SIZE;
    for (const run of cell?.rich?.runs || []) if (run?.fontSize > size) size = run.fontSize;
    return size;
};

// The height the text of `cell` needs in a column `columnWidth` wide.
// `measure(text, cell)` gives the width of one line of text in the cell's font.
// Text in more than one size is measured as if all of it were the largest, so it
// may wrap a little early but never runs past the column or gets cut off.
export const cellTextHeight = (measure, text, cell, columnWidth) => {
    const fontSize = largestFontSize(cell);
    const font = fontSize === cell?.fontSize ? cell : { ...cell, fontSize };
    let lines = 1;
    if (cell?.wrap) {
        const available = Math.max(20, columnWidth - PADDING_X - (cell.indent || 0) * INDENT_PX);
        lines = Math.max(1, wrapTextLines((line) => measure(line, font), text, available).length);
    }
    return Math.ceil(lines * fontSize * LINE_HEIGHT + PADDING_Y);
};

// { row: height } for each row whose cells need more than `defaultHeight`. Rows
// with a height in `rowHeights` are left out, as are merged cells (Excel doesn't
// fit rows to those either). `cache`, a WeakMap, keeps each cell's answer while its
// text and column width stay the same, so an edit only measures the cells it changed.
export const contentRowHeights = ({ cells, display, columnWidths, rowHeights, mergeMap, defaultHeight, defaultColumnWidth, measure, cache }) => {
    const heights = {};
    forEachCellId(cells, (id, cell) => {
        if (!cell || !(cell.wrap || largestFontSize(cell) > DEFAULT_FONT_SIZE) || mergeMap?.[id]) return;
        const shown = display?.[id] ?? cell.value;
        if (shown === undefined || shown === null || shown === "") return;
        const ref = parseCellRef(id);
        if (!ref || rowHeights?.[ref.row]) return;
        const text = String(shown);
        const width = columnWidths?.[ref.col] || defaultColumnWidth;
        let fit = cache?.get(cell);
        if (!fit || fit.text !== text || fit.width !== width) {
            fit = { text, width, height: cellTextHeight(measure, text, cell, width) };
            cache?.set(cell, fit);
        }
        if (fit.height > (heights[ref.row] || defaultHeight)) heights[ref.row] = fit.height;
    });
    return heights;
};
