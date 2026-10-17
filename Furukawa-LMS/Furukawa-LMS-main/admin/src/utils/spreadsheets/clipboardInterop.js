// Cells on the system clipboard: what the grid puts there when it copies, and how it
// reads what another program (Excel, Google Sheets, a text editor) put there.
//
// Spreadsheets exchange cells as plain text — one line per row, a tab between cells —
// alongside an HTML table and often a picture of the cells. The text is the part every
// program agrees on, so it is what a paste here reads. A cell whose text itself holds
// a line break, a tab or a quote is wrapped in double quotes, with a quote inside
// written twice ("He said ""hi"""), which is how Excel writes one and expects one.

import { getCellId, parseCellRef } from "./formulaEngine.js";
import { cellIdsOf } from "./chunkedCells.js";

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
 * none), which is how its colours and font reach the program pasted into. `merges`
 * ([{ row, col, rowSpan, colSpan }], relative to the rows) become cells spanning
 * rows and columns, as Excel writes merged cells.
 */
export const serializeCellsToHtml = (rows, clipId, styleAt = null, merges = []) => {
    const height = rows.length, width = gridSize(rows).width;
    const covered = new Set(); // cells a merge spans, other than its top-left one
    const spans = new Map(); // "row,col" of a merge's top-left cell -> its span attributes
    for (const m of merges || []) {
        const rowSpan = Math.min(m.rowSpan, height - m.row), colSpan = Math.min(m.colSpan, width - m.col);
        if (m.row >= height || m.col >= width || (rowSpan < 2 && colSpan < 2)) continue;
        spans.set(`${m.row},${m.col}`, `${rowSpan > 1 ? ` rowspan="${rowSpan}"` : ""}${colSpan > 1 ? ` colspan="${colSpan}"` : ""}`);
        for (let r = m.row; r < m.row + rowSpan; r++) for (let c = m.col; c < m.col + colSpan; c++) if (r !== m.row || c !== m.col) covered.add(`${r},${c}`);
    }
    const body = rows.map((row, r) => `<tr>${row.map((value, c) => {
        if (covered.has(`${r},${c}`)) return "";
        const style = styleAt ? styleAt(r, c) : "";
        return `<td${spans.get(`${r},${c}`) || ""}${style ? ` style="${escapeHtml(style)}"` : ""}>${escapeHtml(value).replace(/\r\n?|\n/g, "<br>")}</td>`;
    }).join("")}</tr>`).join("");
    return `<table ${CLIP_ATTRIBUTE}="${escapeHtml(clipId)}"><tbody>${body}</tbody></table>`;
};

/** The id a copy made by the grid left in clipboard HTML, or null. */
export const readClipMarker = (html) => {
    const match = new RegExp(`${CLIP_ATTRIBUTE}="([A-Za-z0-9_-]{1,64})"`).exec(String(html ?? ""));
    return match ? match[1] : null;
};

/**
 * What a copy of `rows` puts on the clipboard. `styleAt` and `merges` are as for
 * serializeCellsToHtml; `styleAt` is only asked when the table is written.
 * @returns {{ id: string, text: string, html: string|null }}
 */
export const buildClipboardPayload = (rows, styleAt = null, merges = []) => {
    const id = newClipId();
    const { height, width } = gridSize(rows);
    return {
        id,
        text: serializeCellsToText(rows),
        html: height * width <= MAX_HTML_CELLS ? serializeCellsToHtml(rows, id, styleAt, merges) : null,
    };
};

// --- Merged cells in a selection ---

const mergeBounds = (m) => {
    const a = parseCellRef(m.start), b = parseCellRef(m.end);
    if (!a || !b) return null;
    return { minRow: Math.min(a.row, b.row), maxRow: Math.max(a.row, b.row), minCol: Math.min(a.col, b.col), maxCol: Math.max(a.col, b.col) };
};
const overlap = (a, b) => a.minRow <= b.maxRow && a.maxRow >= b.minRow && a.minCol <= b.maxCol && a.maxCol >= b.minCol;

/**
 * `bounds` grown to take in every merged cell ({ start, end }) it covers part of —
 * as Excel does, so that selecting a merged cell selects all of it. `bounds` itself
 * when no merge reaches out of it.
 */
export const growBoundsToMerges = (bounds, merges) => {
    if (!bounds || !merges?.length) return bounds;
    const boxes = merges.map(mergeBounds).filter(Boolean);
    let grown = bounds;
    for (let changed = true; changed;) {
        changed = false;
        for (const m of boxes) {
            if (!overlap(m, grown)) continue;
            if (m.minRow < grown.minRow || m.maxRow > grown.maxRow || m.minCol < grown.minCol || m.maxCol > grown.maxCol) {
                grown = {
                    minRow: Math.min(grown.minRow, m.minRow), maxRow: Math.max(grown.maxRow, m.maxRow),
                    minCol: Math.min(grown.minCol, m.minCol), maxCol: Math.max(grown.maxCol, m.maxCol),
                };
                changed = true;
            }
        }
    }
    return grown;
};

/**
 * The merged cells lying wholly inside `bounds`, relative to its top-left cell:
 * [{ row, col, rowSpan, colSpan }], the form mergesAfterPaste and
 * serializeCellsToHtml take.
 */
export const mergesWithin = (merges, bounds) => {
    const out = [];
    for (const merge of merges || []) {
        const m = mergeBounds(merge);
        if (!m || m.minRow < bounds.minRow || m.maxRow > bounds.maxRow || m.minCol < bounds.minCol || m.maxCol > bounds.maxCol) continue;
        out.push({ row: m.minRow - bounds.minRow, col: m.minCol - bounds.minCol, rowSpan: m.maxRow - m.minRow + 1, colSpan: m.maxCol - m.minCol + 1 });
    }
    return out;
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
    for (const id of cellIdsOf(existing)) {
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

// CSS lengths, as screen pixels (96 per inch).
const PX_PER_UNIT = { px: 1, pt: 96 / 72, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, pc: 16 };
const lengthToPx = (value) => {
    const m = /^\s*(-?[\d.]+)\s*(px|pt|in|cm|mm|pc)?\s*$/i.exec(String(value ?? ""));
    if (!m) return null;
    const n = parseFloat(m[1]);
    return Number.isFinite(n) ? n * PX_PER_UNIT[(m[2] || "px").toLowerCase()] : null;
};

// One side of a cell border ("0.5pt solid windowtext", "1px solid #000", "none")
// as the grid draws it: "thin", "thick" or "double", or null for none. Excel's
// thin is .5pt and its medium 1pt; the grid shows medium and thick alike as thick.
const borderSideOf = (value) => {
    const v = String(value ?? "").trim().toLowerCase();
    if (!v || /^(none|hidden|0)\b/.test(v) || /\bnone\b/.test(v)) return null;
    if (/\bdouble\b/.test(v)) return "double";
    // Excel writes widths in points (thin .5pt, medium 1pt, thick 1.5pt), Google
    // Sheets in pixels (1px, 2px, 3px).
    const width = /(-?[\d.]+)\s*(px|pt)/.exec(v);
    if (width) {
        const n = parseFloat(width[1]);
        if (!(n > 0)) return null;
        return n >= (width[2] === "pt" ? 1 : 2) ? "thick" : "thin";
    }
    if (/\b(thick|medium)\b/.test(v)) return "thick";
    return "thin";
};

// Excel's `mso-number-format`, a CSS string holding a number format code with its
// own characters escaped ("\#\,\#\#0\.00", "\0022$\0022\#\,\#\#0") or one of the
// names Excel's HTML uses for its built-in formats.
const NAMED_NUMBER_FORMATS = {
    general: "General", "general number": "General", fixed: "0.00", standard: "#,##0.00", percent: "0.00%",
    scientific: "0.00E+00", "short date": "m/d/yyyy", "medium date": "d-mmm-yy", "long date": "dddd, mmmm d, yyyy",
    "short time": "h:mm", "medium time": "h:mm AM/PM", "long time": "h:mm:ss AM/PM", "@": "@",
};
const numberFormatOf = (value) => {
    let v = String(value ?? "").trim();
    if (!v) return null;
    if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
    v = v.replace(/\\([0-9a-f]{1,6}) ?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/\\(.)/g, "$1");
    const named = NAMED_NUMBER_FORMATS[v.toLowerCase()];
    const code = named || v;
    return code === "General" ? null : code;
};

// A table cell's formatting as the grid stores it, or null when it has none.
// `numFmt` is an Excel number format code, for the caller to turn into the grid's
// own number formats.
const cellStyleOf = (cell, classRules) => {
    let fromClasses = {};
    for (const name of String(cell.getAttribute("class") || "").split(/\s+/)) if (classRules[name]) fromClasses = { ...fromClasses, ...classRules[name] };
    const inline = parseDeclarations(cell.getAttribute("style"));
    const css = { ...fromClasses, ...inline };

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

    // Excel says how far a cell's own formatting reaches through classes; Google
    // Sheets writes its defaults (bottom alignment, say) into every cell's style.
    const valign = String(css["vertical-align"] || "").toLowerCase();
    if (valign === "top" || valign === "middle" || (valign === "bottom" && String(fromClasses["vertical-align"] || "").toLowerCase() === "bottom")) style.valign = valign;
    if (String(css["white-space"] || "").toLowerCase() === "normal") style.wrap = true;
    const size = lengthToPx(css["font-size"]);
    if (size && /pt\s*$/i.test(css["font-size"])) style.fontSize = Math.round(parseFloat(css["font-size"]));
    else if (size) style.fontSize = Math.round(size * 72 / 96);
    const family = String(css["font-family"] || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
    if (family && !/^(serif|sans-serif|monospace|inherit)$/i.test(family)) style.fontFamily = family;

    const border = {};
    const all = borderSideOf(css.border);
    for (const side of ["top", "right", "bottom", "left"]) {
        const own = css[`border-${side}`];
        const value = own !== undefined ? borderSideOf(own) : all;
        if (value) border[side] = value;
    }
    if (Object.keys(border).length) style.border = border;

    const numFmt = numberFormatOf(css["mso-number-format"]);
    if (numFmt) style.numFmt = numFmt;
    const rotate = parseInt(css["mso-rotate"], 10);
    if (Number.isFinite(rotate) && rotate !== 0) style.rotation = rotate;
    const indent = parseInt(css["mso-char-indent-count"], 10);
    if (Number.isFinite(indent) && indent > 0) style.indent = indent;
    return Object.keys(style).length ? style : null;
};

// --- Shapes in Excel's HTML ---
// Excel writes the shapes over a copied range as VML, inside conditional comments
// (`<!--[if gte vml 1]> ... <![endif]-->`) in the cell each one starts in. Their
// kind is the element (v:rect, v:oval, ...) or, for v:shape, the number of the
// built-in shape type it names (`type="#_x0000_t5"`, `o:spt="5"`).

// Excel's built-in shape types (MSO_SPT) and the grid's shape for each.
const SHAPE_BY_SPT = {
    1: "rect", 2: "roundRect", 3: "ellipse", 4: "diamond", 5: "triangle", 6: "rightTriangle", 7: "parallelogram",
    8: "trapezoid", 9: "hexagon", 10: "octagon", 11: "cross", 12: "star5", 13: "arrowRight", 15: "pentagon",
    20: "lineStraight", 32: "lineStraight", 33: "connectorElbow", 34: "connectorElbow", 55: "chevron", 56: "pentagon",
    58: "star8", 61: "callout", 62: "callout", 63: "callout", 66: "arrowLeft", 67: "arrowDown", 68: "arrowUp",
    69: "arrowLeftRight", 187: "star4", 202: "rect",
};
const PICTURE_SPT = 75;
const SHAPE_ELEMENTS = { "v:rect": "rect", "v:roundrect": "roundRect", "v:oval": "ellipse", "v:line": "lineStraight", "v:shape": null };
const LINE_SHAPES = new Set(["lineStraight", "connectorElbow"]);

// The first descendant of `el` with this tag name ("v:stroke"), looked up by name:
// a CSS selector can't be counted on to read the colon in it.
const firstTag = (el, name) => {
    for (const child of el.getElementsByTagName("*")) if (String(child.tagName).toLowerCase() === name) return child;
    return null;
};
const SHAPE_CONTAINERS = new Set(["v:group", "v:shape", "v:rect", "v:oval", "v:roundrect", "v:line"]);
// Whether `el` sits inside another shape, or a group (whose coordinates are its own).
const insideShape = (el, holder) => {
    for (let p = el.parentElement; p && p !== holder; p = p.parentElement) if (SHAPE_CONTAINERS.has(String(p.tagName).toLowerCase())) return true;
    return false;
};

// A VML colour ("#4472c4 [3204]", "white [3212]", "red") as "#rrggbb", or null.
const vmlColorOf = (value) => {
    const first = String(value ?? "").trim().split(/\s+/)[0];
    return first ? cssColorToHex(first) : null;
};
const isOff = (value) => /^(f|false|0)$/i.test(String(value ?? "").trim());

// The comment nodes directly inside `el` that hold VML.
const vmlCommentsIn = (el) => [...el.childNodes].filter((n) => n.nodeType === 8 && /^\[if gte vml 1\]>/i.test(n.data || ""));

// The elements of one VML comment, parsed on their own.
const vmlElementsOf = (comment, doc) => {
    const markup = String(comment.data).replace(/^\[if gte vml 1\]>/i, "").replace(/<!\[endif\]\s*$/i, "")
        // VML is XML: `<v:oval .../>` is a whole element, which HTML would read as an
        // opening tag and put everything after it inside.
        .replace(/<([a-z]+:[\w-]+)(\s[^<>]*?)?\/>/gi, "<$1$2></$1>");
    const holder = doc.createElement("div");
    holder.innerHTML = markup; // a detached element: nothing in it is loaded or run
    return holder;
};

// The text in a shape's v:textbox, with its first run's look.
const shapeTextOf = (vml, classRules) => {
    const box = firstTag(vml, "v:textbox");
    if (!box) return null;
    const lines = [...box.querySelectorAll("div, p")].map((el) => String(el.textContent || "").replace(/\s+/g, " ").trim());
    const text = (lines.length ? lines : [String(box.textContent || "").trim()]).join("\n").trim();
    if (!text) return null;
    const textStyle = {};
    const run = box.querySelector("font, span");
    if (run) {
        const rules = {};
        for (const name of String(run.getAttribute("class") || "").split(/\s+/)) Object.assign(rules, classRules[name]);
        Object.assign(rules, parseDeclarations(run.getAttribute("style")));
        const color = cssColorToHex(rules.color);
        if (color) textStyle.color = color;
        const weight = String(rules["font-weight"] || "").toLowerCase();
        if (weight === "bold" || Number(weight) >= 600) textStyle.bold = true;
        if (/^italic/i.test(rules["font-style"] || "")) textStyle.italic = true;
        if (/pt\s*$/i.test(rules["font-size"] || "")) textStyle.fontSize = Math.round(parseFloat(rules["font-size"]));
    }
    const align = String(parseDeclarations(box.querySelector("div, p")?.getAttribute("style"))["text-align"] || "").toLowerCase();
    if (align === "left" || align === "center" || align === "right") textStyle.align = align;
    return { text, textStyle };
};

// The shapes in one VML comment, with their position in pixels from the top-left
// of the cell the comment is in. `types` maps a v:shapetype's id to its MSO_SPT.
const shapesOfComment = (holder, types, classRules, counts) => {
    const shapes = [];
    for (const el of holder.getElementsByTagName("*")) {
        const tag = el.tagName.toLowerCase();
        if (tag === "v:shapetype") {
            const spt = parseInt(el.getAttribute("o:spt"), 10);
            if (el.id && Number.isFinite(spt)) types[el.id] = spt;
            continue;
        }
        if (!(tag in SHAPE_ELEMENTS) || insideShape(el, holder)) continue;
        const css = parseDeclarations(el.getAttribute("style"));
        if (String(css.visibility || "").toLowerCase() === "hidden") continue;

        let shape = SHAPE_ELEMENTS[tag];
        if (tag === "v:shape") {
            const typeRef = String(el.getAttribute("type") || "").replace(/^#/, "");
            const spt = parseInt(el.getAttribute("o:spt"), 10) || types[typeRef] || parseInt(/_x0000_t(\d+)$/.exec(typeRef)?.[1], 10);
            if (spt === PICTURE_SPT || firstTag(el, "v:imagedata")) { counts.pictures++; continue; }
            shape = SHAPE_BY_SPT[spt] || "rect";
        }

        let x = lengthToPx(css["margin-left"]) ?? lengthToPx(css.left) ?? 0;
        let y = lengthToPx(css["margin-top"]) ?? lengthToPx(css.top) ?? 0;
        let width = lengthToPx(css.width), height = lengthToPx(css.height);
        if (tag === "v:line") {
            const point = (v) => String(v || "0,0").split(",").map((p) => lengthToPx(p) ?? 0);
            const [x1, y1] = point(el.getAttribute("from")), [x2, y2] = point(el.getAttribute("to"));
            x = Math.min(x1, x2); y = Math.min(y1, y2);
            width = Math.abs(x2 - x1); height = Math.abs(y2 - y1);
        }
        if (!(width >= 0) || !(height >= 0)) continue;

        const stroke = firstTag(el, "v:stroke");
        const fill = firstTag(el, "v:fill");
        const strokeOn = !isOff(el.getAttribute("stroked")) && !isOff(stroke?.getAttribute("on"));
        const strokeColor = vmlColorOf(stroke?.getAttribute("color") || el.getAttribute("strokecolor")) || "#000000";
        const strokeWidth = lengthToPx(stroke?.getAttribute("weight") || el.getAttribute("strokeweight") || "0.75pt");
        const arrowAtEnd = /\S/.test(stroke?.getAttribute("endarrow") || "") && !/^none$/i.test(stroke.getAttribute("endarrow"));
        const arrowAtStart = /\S/.test(stroke?.getAttribute("startarrow") || "") && !/^none$/i.test(stroke.getAttribute("startarrow"));

        let rotation = parseFloat(css.rotation) || 0;
        if (shape === "lineStraight" && width > 0 && height > 0) {
            // The grid draws a straight line across the middle of its box and turns the
            // box; Excel gives the box the line runs corner to corner in (flipped when it
            // runs up instead of down).
            const flip = String(css.flip || "").toLowerCase();
            const rising = flip.includes("y") !== flip.includes("x");
            const length = Math.hypot(width, height);
            const cx = x + width / 2, cy = y + height / 2;
            rotation += (rising ? -1 : 1) * (Math.atan2(height, width) * 180) / Math.PI;
            x = cx - length / 2; y = cy; width = length; height = 0;
        }
        const item = { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
        if (LINE_SHAPES.has(shape)) {
            // A line has the one colour, its fill; arrowheads are separate shapes in the grid.
            if (shape === "lineStraight") shape = arrowAtStart && arrowAtEnd ? "lineArrowDouble" : arrowAtEnd || arrowAtStart ? "lineArrow" : "lineStraight";
            else if (arrowAtEnd || arrowAtStart) shape = "connectorElbowArrow";
            item.fill = strokeOn ? strokeColor : "none";
        } else {
            const fillOn = !isOff(el.getAttribute("filled")) && !isOff(fill?.getAttribute("on"));
            item.fill = fillOn ? vmlColorOf(fill?.getAttribute("color") || el.getAttribute("fillcolor")) || "#ffffff" : "none";
            item.stroke = strokeOn ? strokeColor : "none";
        }
        item.shape = shape;
        if (strokeWidth) item.strokeWidth = Math.max(1, Math.round(strokeWidth));
        if (Number.isFinite(rotation) && Math.round(rotation) % 360 !== 0) item.rotation = Math.round(rotation);
        const text = shape.startsWith("line") || shape.startsWith("connector") ? null : shapeTextOf(el, classRules);
        if (text) {
            item.text = text.text;
            const anchor = String(css["v-text-anchor"] || "").toLowerCase();
            const valign = anchor.startsWith("top") ? "top" : anchor.startsWith("bottom") ? "bottom" : null;
            item.textStyle = { ...text.textStyle, ...(valign && { valign }) };
        }
        shapes.push(item);
    }
    return shapes;
};

/**
 * What a parsed HTML document's first table says about the cells it holds, row by
 * row: { height, width, styles, merges?, shapes?, columnWidths?, rowHeights?,
 * skippedPictures? }.
 *   styles[row][col]  what to merge into that cell (see cellStyleOf), or null. A
 *                     cell spanning several rows or columns gives it to all of them.
 *   merges            [{ row, col, rowSpan, colSpan }] — the table's merged cells.
 *                     A span Excel only uses to let text run on into empty cells
 *                     (`mso-ignore:colspan`) isn't one.
 *   shapes            Excel's shapes over the range: { row, col, x, y, width,
 *                     height, shape, fill, stroke?, strokeWidth?, rotation?, text?,
 *                     textStyle? }, at (x, y) pixels from the top-left of cell (row, col).
 *   columnWidths, rowHeights   the table's own sizes in pixels (null where it
 *                     gives none), for placing the shapes — only with shapes.
 *   skippedPictures   how many pictures were over the range: Excel's HTML refers
 *                     to them as files on the copying computer, out of reach here.
 * null when the document has no table, or nothing of the above to give.
 */
export const parseClipboardHtmlStyles = (doc) => {
    const table = doc?.querySelector?.("table");
    if (!table) return null;
    const classRules = classRulesOf(doc);
    const styles = [];
    const merges = [];
    const shapes = [];
    const rowHeights = [];
    const counts = { pictures: 0 };
    const types = {};
    let width = 0, any = false;
    // Rows of this table only, not of a table nested in one of its cells.
    const rows = [...table.querySelectorAll("tr")].filter((tr) => tr.closest("table") === table);
    rows.forEach((tr, r) => {
        const row = styles[r] || (styles[r] = []);
        rowHeights[r] = lengthToPx(parseDeclarations(tr.getAttribute("style")).height) ?? lengthToPx(tr.getAttribute("height"));
        let c = 0;
        for (const cell of tr.children) {
            const tag = String(cell.tagName).toLowerCase();
            if (tag !== "td" && tag !== "th") continue;
            while (row[c] !== undefined) c++; // taken by a cell spanning down from above
            const span = (name) => Math.max(1, Math.min(1000, parseInt(cell.getAttribute(name), 10) || 1));
            const rowSpan = span("rowspan"), colSpan = span("colspan");
            const style = cellStyleOf(cell, classRules);
            if (style) any = true;
            const classCss = String(cell.getAttribute("class") || "").split(/\s+/).map((n) => classRules[n]?.["mso-ignore"] || "").join(" ");
            const overflowOnly = /colspan/i.test(`${parseDeclarations(cell.getAttribute("style"))["mso-ignore"] || ""} ${classCss}`);
            for (let dr = 0; dr < rowSpan && r + dr < rows.length; dr++) {
                const into = styles[r + dr] || (styles[r + dr] = []);
                // Text running on into empty cells doesn't give them its cell's look.
                for (let dc = 0; dc < colSpan; dc++) into[c + dc] = overflowOnly && dc > 0 ? null : style;
            }
            if (rowSpan > 1 || (colSpan > 1 && !overflowOnly)) merges.push({ row: r, col: c, rowSpan: Math.min(rowSpan, rows.length - r), colSpan });
            for (const comment of vmlCommentsIn(cell)) {
                for (const shape of shapesOfComment(vmlElementsOf(comment, doc), types, classRules, counts)) shapes.push({ row: r, col: c, ...shape });
            }
            c += colSpan;
        }
        width = Math.max(width, row.length);
    });
    if (!any && !merges.length && !shapes.length && !counts.pictures) return null;
    const out = { height: styles.length, width, styles: styles.map((row) => Array.from({ length: width }, (_, c) => row[c] ?? null)) };
    if (merges.length) out.merges = merges;
    if (shapes.length) {
        out.shapes = shapes;
        const columnWidths = Array(width).fill(null);
        let c = 0;
        for (const col of [...table.querySelectorAll("col")].filter((el) => el.closest("table") === table)) {
            const px = lengthToPx(parseDeclarations(col.getAttribute("style")).width) ?? lengthToPx(col.getAttribute("width"));
            const n = Math.max(1, parseInt(col.getAttribute("span"), 10) || 1);
            for (let i = 0; i < n && c < width; i++) columnWidths[c++] = px;
        }
        out.columnWidths = columnWidths;
        out.rowHeights = rowHeights.map((h) => h ?? null);
    }
    if (counts.pictures) out.skippedPictures = counts.pictures;
    return out;
};

// Where a shape read off Excel's HTML goes in the grid: its corners are found
// within the source's cells (as a cell and a fraction of it) and put at the same
// place within the target's cells, so a shape that sat over two columns of the
// source sits over the same two columns here whatever their widths.
//   shape         one of parseClipboardHtmlStyles' `shapes`
//   source        { columnWidths, rowHeights } from it (null entries: Excel's defaults)
//   targetWidth(c), targetHeight(r)   the target's sizes, c and r counted from the
//                 top-left of the paste
// Returns { row, col, offsetX, offsetY, width, height }, row and col counted from
// the top-left of the paste.
const EXCEL_DEFAULT_COLUMN_PX = 64;
const EXCEL_DEFAULT_ROW_PX = 20;
export const placeClipboardShape = (shape, source, targetWidth, targetHeight) => {
    const sourceWidth = (c) => source.columnWidths?.[c] || EXCEL_DEFAULT_COLUMN_PX;
    const sourceHeight = (r) => source.rowHeights?.[r] || EXCEL_DEFAULT_ROW_PX;
    // `offset` pixels from the start of line `start` -> { index, fraction } of a line.
    const locate = (start, offset, size) => {
        let index = start, left = offset;
        while (left < 0 && index > 0) { index--; left += size(index); }
        while (left >= size(index) && index < start + 10000) { left -= size(index); index++; }
        return { index, fraction: Math.max(0, left) / size(index) };
    };
    // The same place in the target, in pixels from the paste's top-left edge.
    const position = ({ index, fraction }, size) => {
        let px = 0;
        for (let i = 0; i < index; i++) px += size(i);
        return px + fraction * size(index);
    };
    const x1 = position(locate(shape.col, shape.x, sourceWidth), targetWidth);
    const y1 = position(locate(shape.row, shape.y, sourceHeight), targetHeight);
    const x2 = position(locate(shape.col, shape.x + shape.width, sourceWidth), targetWidth);
    const y2 = position(locate(shape.row, shape.y + shape.height, sourceHeight), targetHeight);
    // The cell the top-left corner falls in, and how far into it.
    const start = (px, size) => {
        let index = 0, left = px;
        while (left >= size(index) && index < 100000) { left -= size(index); index++; }
        return [index, Math.round(left)];
    };
    const [col, offsetX] = start(x1, targetWidth);
    const [row, offsetY] = start(y1, targetHeight);
    return { row, col, offsetX, offsetY, width: Math.max(1, Math.round(x2 - x1)), height: Math.max(1, Math.round(y2 - y1)) };
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

/**
 * A sheet's merges after a paste of `pasted` (parseClipboardHtmlStyles' `merges`,
 * relative to the paste) at (row, col) over a block `height` x `width`: those
 * overlapping the block are gone, as in Excel, and the pasted ones are added.
 * @param {Array<{ start: string, end: string }>} existing
 * @returns {Array<{ start: string, end: string }>}
 */
export const mergesAfterPaste = (existing, pasted, { row, col, height, width }) => {
    const overlaps = (m) => {
        const a = parseCellRef(m.start), b = parseCellRef(m.end);
        if (!a || !b) return false;
        const r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row), c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col);
        return r1 < row + height && r2 >= row && c1 < col + width && c2 >= col;
    };
    const kept = (existing || []).filter((m) => !overlaps(m));
    for (const m of pasted || []) {
        const lastRow = Math.min(m.row + m.rowSpan, height) - 1, lastCol = Math.min(m.col + m.colSpan, width) - 1;
        if (lastRow <= m.row && lastCol <= m.col) continue; // cut down to one cell by the block's edge
        kept.push({ start: getCellId(row + m.row, col + m.col), end: getCellId(row + lastRow, col + lastCol) });
    }
    return kept;
};

/**
 * The floating shapes a paste at (row, col) adds: parseClipboardHtmlStyles' `shapes`
 * placed over the target's cells (see placeClipboardShape), as media items without
 * ids. `widthOf(col)` / `heightOf(row)` are the sheet's sizes, in sheet coordinates;
 * a shape smaller than `minSize` either way is grown to it about its centre (a
 * line's box, say, which Excel gives no height).
 */
export const shapesForPaste = (read, { row, col, widthOf, heightOf, minSize = 1 }) => (read?.shapes || []).map((shape) => {
    const at = placeClipboardShape(shape, read, (c) => widthOf(col + c), (r) => heightOf(row + r));
    const width = Math.max(minSize, at.width), height = Math.max(minSize, at.height);
    const offsetX = at.offsetX - Math.round((width - at.width) / 2), offsetY = at.offsetY - Math.round((height - at.height) / 2);
    const item = { type: "shape", shape: shape.shape, row: row + at.row, col: col + at.col, offsetX, offsetY, width, height, fill: shape.fill };
    for (const key of ["stroke", "strokeWidth", "rotation", "text", "textStyle"]) if (shape[key] !== undefined) item[key] = shape[key];
    return item;
});
