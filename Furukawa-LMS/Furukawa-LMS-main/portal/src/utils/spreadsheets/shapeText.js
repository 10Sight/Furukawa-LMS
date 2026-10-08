// Text inside a shape: the parts that are plain arithmetic — the colour text
// takes on a given fill, and where its lines break in the exported picture.

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DARK_TEXT = "#1e293b";
const LIGHT_TEXT = "#ffffff";

// The text colour that reads on `fill` when the shape's text has none of its
// own: white on a dark fill, dark on a light one.
export const readableTextColor = (fill) => {
    const m = HEX_COLOR_RE.exec(String(fill ?? "").trim());
    if (!m) return DARK_TEXT;
    const hex = m[1].length === 3 ? m[1].replace(/./g, (ch) => ch + ch) : m[1];
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? DARK_TEXT : LIGHT_TEXT;
};

// Breaks `text` into the lines it takes within `maxWidth`, the way the grid's
// CSS does (pre-wrap, break-word): typed line breaks are kept, a line wraps at a
// space, and a word too long for a line is split. `measure(text)` gives a width.
export const wrapTextLines = (measure, text, maxWidth) => {
    const lines = [];
    for (const paragraph of String(text ?? "").split("\n")) {
        let line = "";
        for (const part of paragraph.split(/(\s+)/)) {
            if (part === "") continue;
            if (measure(line + part) <= maxWidth) { line += part; continue; }
            if (/^\s+$/.test(part)) { lines.push(line); line = ""; continue; } // the space the line wrapped at
            if (line !== "") { lines.push(line.trimEnd()); line = ""; }
            let word = part;
            while (word.length > 1 && measure(word) > maxWidth) {
                let fit = 1;
                while (fit < word.length - 1 && measure(word.slice(0, fit + 1)) <= maxWidth) fit++;
                lines.push(word.slice(0, fit));
                word = word.slice(fit);
            }
            line = word;
        }
        lines.push(line.trimEnd());
    }
    return lines;
};
