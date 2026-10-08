// Colours as an .xlsx file holds them -> "#rrggbb". ExcelJS hands a colour over
// as one of { argb }, { theme, tint } or { indexed }; cells and conditional
// formatting rules are both read through here, so a colour that resolves for
// one resolves for the other.

// Modern Office theme palette (Background1/Text1/Background2/Text2/Accent1-6).
// A themed color only carries a {theme, tint} pair — ExcelJS doesn't surface the
// workbook's actual custom theme XML — so this approximates with the standard
// Office default palette, which is right for the large majority of real files
// (those that don't customize it).
export const EXCEL_THEME_COLORS = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47"];

// The legacy 56-colour palette, which files that began life in older Excel (and
// some exporters) still point into by index. 0-7 repeat as 8-15; 64 and 65 are
// the "system" text and background colours. A workbook can redefine the
// palette, which ExcelJS does not surface either — this is the standard one.
export const EXCEL_INDEXED_COLORS = [
    "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF",
    "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF",
    "800000", "008000", "000080", "808000", "800080", "008080", "C0C0C0", "808080",
    "9999FF", "993366", "FFFFCC", "CCFFFF", "660066", "FF8080", "0066CC", "CCCCFF",
    "000080", "FF00FF", "FFFF00", "00FFFF", "800080", "800000", "008080", "0000FF",
    "00CCFF", "CCFFFF", "CCFFCC", "FFFF99", "99CCFF", "FF99CC", "CC99FF", "FFCC99",
    "3366FF", "33CCCC", "99CC00", "FFCC00", "FF9900", "FF6600", "666699", "969696",
    "003366", "339966", "003300", "333300", "993300", "993366", "333399", "333333",
    "000000", "FFFFFF",
];

// Blends a RRGGBB color toward white (tint > 0) or black (tint < 0) using
// Excel's own tint formula, so a themed color with a lighter/darker shade
// applied in the source file still looks approximately right after import.
export const applyTint = (hex, tint) => {
    if (!tint) return hex;
    const num = parseInt(hex, 16);
    const channels = [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff].map((c) => {
        const blended = tint > 0 ? c * (1 - tint) + 255 * tint : c * (1 + tint);
        return Math.max(0, Math.min(255, Math.round(blended)));
    });
    return channels.map((c) => c.toString(16).padStart(2, "0")).join("");
};

// Resolves an ExcelJS color object to a "#rrggbb" string, or null if it names
// no color (unset, "automatic") or one that can't be told from the file.
export const parseExcelColor = (colorObj) => {
    if (!colorObj) return null;
    let hex = null;
    if (colorObj.argb) hex = String(colorObj.argb).slice(-6);
    else if (colorObj.theme !== undefined) hex = applyTint(EXCEL_THEME_COLORS[colorObj.theme] || "000000", colorObj.tint || 0);
    else if (colorObj.indexed !== undefined) hex = EXCEL_INDEXED_COLORS[colorObj.indexed] ?? null;
    return hex && /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
};
