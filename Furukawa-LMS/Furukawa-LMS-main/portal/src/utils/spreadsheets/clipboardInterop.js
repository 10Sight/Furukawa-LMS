// Cells on the system clipboard: what the grid puts there when it copies, and how it
// reads what another program (Excel, Google Sheets, a text editor) put there.
//
// Spreadsheets exchange cells as plain text — one line per row, a tab between cells —
// alongside an HTML table and often a picture of the cells. The text is the part every
// program agrees on, so it is what a paste here reads. A cell whose text itself holds
// a line break, a tab or a quote is wrapped in double quotes, with a quote inside
// written twice ("He said ""hi"""), which is how Excel writes one and expects one.

// A paste larger than this is refused rather than left to freeze the page.
export const MAX_PASTE_CELLS = 100000;
// Past this many cells a copy leaves out its HTML table (the text still goes).
const MAX_HTML_CELLS = 20000;

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
 */
export const serializeCellsToHtml = (rows, clipId) => {
    const body = rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value).replace(/\r\n?|\n/g, "<br>")}</td>`).join("")}</tr>`).join("");
    return `<table ${CLIP_ATTRIBUTE}="${escapeHtml(clipId)}"><tbody>${body}</tbody></table>`;
};

/** The id a copy made by the grid left in clipboard HTML, or null. */
export const readClipMarker = (html) => {
    const match = new RegExp(`${CLIP_ATTRIBUTE}="([A-Za-z0-9_-]{1,64})"`).exec(String(html ?? ""));
    return match ? match[1] : null;
};

/**
 * What a copy of `rows` puts on the clipboard.
 * @returns {{ id: string, text: string, html: string|null }}
 */
export const buildClipboardPayload = (rows) => {
    const id = newClipId();
    const { height, width } = gridSize(rows);
    return {
        id,
        text: serializeCellsToText(rows),
        html: height * width <= MAX_HTML_CELLS ? serializeCellsToHtml(rows, id) : null,
    };
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
