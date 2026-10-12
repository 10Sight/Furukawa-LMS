// Cells on the system clipboard: what the grid puts there when it copies, and how it
// reads what another program (Excel, Google Sheets, a text editor) put there.
//
// Spreadsheets exchange cells as plain text — one line per row, a tab between cells —
// alongside an HTML table and often a picture of the cells. The text is the part every
// program agrees on, so it is what a paste here reads. A cell whose text itself holds
// a line break, a tab or a quote is wrapped in double quotes, with a quote inside
// written twice ("He said ""hi"""), which is how Excel writes one and expects one.

import { getCellId, parseCellRef } from "./formulaEngine.js";

// A paste larger than this is refused rather than left to freeze the page. Reading
// and storing this many cells takes well under a second; twice as many takes over
// one, and a few hundred megabytes of memory with it.
export const MAX_PASTE_CELLS = 500000;
// Past this many cells a copy leaves out its HTML table (the text still goes).
const MAX_HTML_CELLS = 20000;
// A block of up to this many cells is walked cell by cell. A larger one — whole rows
// or columns, mostly — is walked by the cells that exist, which are far fewer.
export const DENSE_WALK_CELLS = 20000;

const CLIP_ATTRIBUTE = "data-sheet-clip";

export const newClipId = () => {
    const random = globalThis.crypto?.randomUUID?.();
    return random ? random.replace(/-/g, "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};

/** Text as it compares across platforms: Windows hands back \r\n for every line break. */
export const normalizeNewlines = (text) => String(text ?? "").replace(/\r\n?/g, "\n");

/**
 * Tab-separated text as rows of cell strings.
 * A quoted cell may contain line breaks, tabs and doubled quotes. Quotes that don't
 * wrap a whole cell (`5" pipe`, `"a" and "b"`) are ordinary characters. The one line
 * break a spreadsheet adds after the last row is not a row.
 * @returns {string[][]} empty when there is no text at all
 */
export const parseDelimitedText = (input) => {
    const text = normalizeNewlines(input);
    if (text === "") return [];
    const rows = [];
    let row = [];
    let i = 0;
    const length = text.length;
    while (i <= length) {
        let value = null;
        let next = i;
        if (text[i] === '"') {
            // A quoted cell — but only if its closing quote is followed by the end
            // of the cell. Otherwise it was never one, and is read as written.
            let j = i + 1;
            let quoted = "";
            let closed = false;
            while (j < length) {
                if (text[j] !== '"') { quoted += text[j++]; continue; }
                if (text[j + 1] === '"') { quoted += '"'; j += 2; continue; }
                closed = true;
                j++;
                break;
            }
            if (closed && (j >= length || text[j] === "\t" || text[j] === "\n")) { value = quoted; next = j; }
        }
        if (value === null) {
            let j = i;
            while (j < length && text[j] !== "\t" && text[j] !== "\n") j++;
            value = text.slice(i, j);
            next = j;
        }
        row.push(value);
        if (next >= length) { rows.push(row); break; }
        if (text[next] === "\n") {
            rows.push(row);
            row = [];
            if (next + 1 >= length) break; // the trailing line break
        }
        i = next + 1;
    }
    return rows;
};

/** The height and width (its longest row) of parsed rows. */
export const gridSize = (rows) => ({
    height: rows.length,
    width: rows.reduce((max, row) => Math.max(max, row.length), 0),
});

const quoteIfNeeded = (value) => {
    const text = String(value ?? "");
    return /["\t\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Rows of cell strings as tab-separated text, the way a spreadsheet writes it. */
export const serializeCellsToText = (rows) => rows.map((row) => row.map(quoteIfNeeded).join("\t")).join("\n");

const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Rows of cell strings as an HTML table, for programs that paste one as cells with
 * their line breaks intact. The table carries `clipId`, so that a paste back into the
 * grid can tell this copy from whatever else may be on the clipboard by then.
 * `styleAt(rowIndex, colIndex)`, if given, is a cell's formatting as inline CSS ("" for
 * none), which is how its colours and font reach the program pasted into.
 */
export const serializeCellsToHtml = (rows, clipId, styleAt = null) => {
    const body = rows.map((row, r) => `<tr>${row.map((value, c) => {
        const style = styleAt ? styleAt(r, c) : "";
        return `<td${style ? ` style="${escapeHtml(style)}"` : ""}>${escapeHtml(value).replace(/\r\n?|\n/g, "<br>")}</td>`;
    }).join("")}</tr>`).join("");
    return `<table ${CLIP_ATTRIBUTE}="${escapeHtml(clipId)}"><tbody>${body}</tbody></table>`;
};

/** The id a copy made by the grid left in clipboard HTML, or null. */
export const readClipMarker = (html) => {
    const match = new RegExp(`${CLIP_ATTRIBUTE}="([A-Za-z0-9_-]{1,64})"`).exec(String(html ?? ""));
    return match ? match[1] : null;
};

/**
 * What a copy of `rows` puts on the clipboard. `styleAt` is as for serializeCellsToHtml,
 * and is only asked when the table is written.
 * @returns {{ id: string, text: string, html: string|null }}
 */
export const buildClipboardPayload = (rows, styleAt = null) => {
    const id = newClipId();
    const { height, width } = gridSize(rows);
    return {
        id,
        text: serializeCellsToText(rows),
        html: height * width <= MAX_HTML_CELLS ? serializeCellsToHtml(rows, id, styleAt) : null,
    };
};

// --- Large blocks ---

const inBounds = (ref, b) => ref.row >= b.minRow && ref.row <= b.maxRow && ref.col >= b.minCol && ref.col <= b.maxCol;

/**
 * The smallest block inside `bounds` holding every one of the given cells that lies in
 * it, or null when none does. Each of `idLists` is something to iterate cell ids from.
 */
export const usedBoundsWithin = (bounds, ...idLists) => {
    let used = null;
    for (const ids of idLists) {
        for (const id of ids) {
            const ref = parseCellRef(id);
            if (!ref || !inBounds(ref, bounds)) continue;
            if (!used) { used = { minRow: ref.row, maxRow: ref.row, minCol: ref.col, maxCol: ref.col }; continue; }
            if (ref.row < used.minRow) used.minRow = ref.row; else if (ref.row > used.maxRow) used.maxRow = ref.row;
            if (ref.col < used.minCol) used.minCol = ref.col; else if (ref.col > used.maxCol) used.maxCol = ref.col;
        }
    }
    return used;
};

/**
 * Empties the block `bounds` of a cell map, without visiting every cell of a block
 * that is mostly empty.
 * @param {object} cells the map to delete from
 * @param {object} existing the same cells as a plain object, to read which exist (inside
 *   a workbook update `cells` is a handle, and `plainOf(cells)` is what goes here)
 */
export const clearCellBlock = (cells, existing, bounds) => {
    if ((bounds.maxRow - bounds.minRow + 1) * (bounds.maxCol - bounds.minCol + 1) <= DENSE_WALK_CELLS) {
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) delete cells[getCellId(r, c)];
        }
        return;
    }
    for (const id of Object.keys(existing)) {
        const ref = parseCellRef(id);
        if (ref && inBounds(ref, bounds)) delete cells[id];
    }
};

/**
 * Whether what is on the system clipboard is still the copy the grid last made.
 * @param {{ id: string, text: string, written: boolean }|null} own that copy
 * @param {{ text?: string, html?: string }} system what the clipboard holds now
 * A copy that never reached the system clipboard (the browser wouldn't allow the write)
 * can't have been replaced there as far as the grid can tell, and counts as current.
 */
export const isOwnClip = (own, { text = "", html = "" } = {}) => {
    if (!own) return false;
    if (!own.written) return true;
    return readClipMarker(html) === own.id || (text !== "" && normalizeNewlines(text) === own.text);
};

// --- Formatting from another program's HTML table ---
//
// The text says what the cells hold; the HTML table that travels with it says what
// they look like. Only that is read from it here — the fill colour, the text colour,
// bold, italic, underline, strikethrough and left/centre/right alignment — and only
// when the table has exactly as many rows and columns as the text, so that a style
// can never land on the wrong cell. Excel says these through classes defined in a
// <style> block; Google Sheets and this grid, in each cell's own style attribute.

// A paste of more cells than this takes its values only.
export const MAX_STYLED_PASTE_CELLS = 50000;

const NAMED_COLORS = {
    black: "#000000", white: "#ffffff", red: "#ff0000", lime: "#00ff00", blue: "#0000ff", yellow: "#ffff00",
    aqua: "#00ffff", cyan: "#00ffff", fuchsia: "#ff00ff", magenta: "#ff00ff", silver: "#c0c0c0", gray: "#808080",
    grey: "#808080", maroon: "#800000", olive: "#808000", green: "#008000", purple: "#800080", teal: "#008080",
    navy: "#000080", orange: "#ffa500",
};

const hexByte = (n) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, "0");

// One CSS colour as "#rrggbb", or null for anything else — a keyword such as
// `windowtext` or `inherit`, or a colour that is fully transparent.
const cssColorToHex = (value) => {
    const v = String(value ?? "").trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    if (/^#[0-9a-f]{8}$/.test(v)) return v.endsWith("00") ? null : v.slice(0, 7);
    const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+)(%?))?\s*\)$/.exec(v);
    if (rgb) return rgb[4] !== undefined && Number(rgb[4]) === 0 ? null : `#${hexByte(rgb[1])}${hexByte(rgb[2])}${hexByte(rgb[3])}`;
    return NAMED_COLORS[v] || null;
};

// The colour in a `background` shorthand ("yellow", "#ff0 none", "rgb(1, 2, 3) url(x)").
const backgroundColorOf = (value) => {
    for (const token of String(value ?? "").toLowerCase().match(/#[0-9a-f]+|rgba?\([^)]*\)|[a-z]+/g) || []) {
        const hex = cssColorToHex(token);
        if (hex) return hex;
    }
    return null;
};

// "color: red; font-weight: 700" -> { color: "red", "font-weight": "700" }
const parseDeclarations = (text) => {
    const out = {};
    for (const part of String(text ?? "").split(";")) {
        const colon = part.indexOf(":");
        if (colon < 1) continue;
        out[part.slice(0, colon).trim().toLowerCase()] = part.slice(colon + 1).replace(/!important/i, "").trim();
    }
    return out;
};

// The rules a document's <style> blocks give its classes: { className: declarations }.
// Rules for bare elements (Excel's `td { ... }`, which says what an unformatted cell
// looks like) are left out on purpose: they are the program's defaults, not formatting.
const classRulesOf = (doc) => {
    const rules = {};
    for (const style of doc.querySelectorAll("style")) {
        const css = String(style.textContent || "").replace(/<!--|-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
        for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
            for (const selector of selectors.split(",")) {
                const name = /^\s*(?:td|th)?\.([\w-]+)\s*$/.exec(selector)?.[1];
                if (name) rules[name] = { ...rules[name], ...parseDeclarations(body) };
            }
        }
    }
    return rules;
};

// Whether all of a cell's text sits inside one of these tags (<b>, <strong>, ...).
const wrappedIn = (cell, tags) => {
    const text = String(cell.textContent || "").trim();
    if (!text) return false;
    for (const el of cell.querySelectorAll(tags)) if (String(el.textContent || "").trim() === text) return true;
    return false;
};

// A table cell's formatting as the grid stores it, or null when it has none.
const cellStyleOf = (cell, classRules) => {
    let css = {};
    for (const name of String(cell.getAttribute("class") || "").split(/\s+/)) if (classRules[name]) css = { ...css, ...classRules[name] };
    css = { ...css, ...parseDeclarations(cell.getAttribute("style")) };

    const style = {};
    const bg = cssColorToHex(css["background-color"]) || backgroundColorOf(css.background);
    if (bg) style.bg = bg;
    const color = cssColorToHex(css.color);
    if (color) style.color = color;
    const weight = String(css["font-weight"] || "").toLowerCase();
    if (weight === "bold" || weight === "bolder" || Number(weight) >= 600 || wrappedIn(cell, "b, strong")) style.bold = true;
    if (/^(italic|oblique)/i.test(css["font-style"] || "") || wrappedIn(cell, "i, em")) style.italic = true;
    const decoration = `${css["text-decoration"] || ""} ${css["text-decoration-line"] || ""}`.toLowerCase();
    if (decoration.includes("underline") || wrappedIn(cell, "u")) style.underline = true;
    if (decoration.includes("line-through") || wrappedIn(cell, "s, strike, del")) style.strike = true;
    const align = String(css["text-align"] || "").toLowerCase();
    if (align === "left" || align === "center" || align === "right") style.align = align;
    return Object.keys(style).length ? style : null;
};

/**
 * The formatting of the cells of the first table in a parsed HTML document, row by
 * row: { height, width, styles }, where `styles[row][col]` is what to merge into that
 * cell ({ bg, color, bold, italic, underline, strike, align }, only those it has) or
 * null. A cell spanning several rows or columns gives its formatting to all of them.
 * null when the document has no table, or no cell of it has any formatting.
 */
export const parseClipboardHtmlStyles = (doc) => {
    const table = doc?.querySelector?.("table");
    if (!table) return null;
    const classRules = classRulesOf(doc);
    const styles = [];
    let width = 0, any = false;
    // Rows of this table only, not of a table nested in one of its cells.
    const rows = [...table.querySelectorAll("tr")].filter((tr) => tr.closest("table") === table);
    rows.forEach((tr, r) => {
        const row = styles[r] || (styles[r] = []);
        let c = 0;
        for (const cell of tr.children) {
            const tag = String(cell.tagName).toLowerCase();
            if (tag !== "td" && tag !== "th") continue;
            while (row[c] !== undefined) c++; // taken by a cell spanning down from above
            const span = (name) => Math.max(1, Math.min(1000, parseInt(cell.getAttribute(name), 10) || 1));
            const rowSpan = span("rowspan"), colSpan = span("colspan");
            const style = cellStyleOf(cell, classRules);
            if (style) any = true;
            for (let dr = 0; dr < rowSpan && r + dr < rows.length; dr++) {
                const into = styles[r + dr] || (styles[r + dr] = []);
                for (let dc = 0; dc < colSpan; dc++) into[c + dc] = style;
            }
            c += colSpan;
        }
        width = Math.max(width, row.length);
    });
    if (!any) return null;
    return { height: styles.length, width, styles: styles.map((row) => Array.from({ length: width }, (_, c) => row[c] ?? null)) };
};

/**
 * parseClipboardHtmlStyles for clipboard HTML as text, in a browser. null where there
 * is nothing to parse it with, or it can't be read.
 */
export const readClipboardHtmlStyles = (html) => {
    if (!html || typeof DOMParser === "undefined") return null;
    try {
        return parseClipboardHtmlStyles(new DOMParser().parseFromString(String(html), "text/html"));
    } catch {
        return null;
    }
};
