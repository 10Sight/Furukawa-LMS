// Excel number-format codes ("#,##0.00", "0.0%", "yyyy-mm-dd", "hh:mm AM/PM",
// "0.00E+00", "$#,##0;($#,##0)", ...) applied to a value — backs the TEXT()
// function and the Date/Time/Scientific cell formats. Covers the format
// syntax people actually write; exotic pieces (fractions "# ?/?", [color]
// and [condition] prefixes, elapsed "[h]") are skipped rather than rejected.

import { formatGeneral, roundHalfAway, serialToParts, MONTH_NAMES, DAY_NAMES } from "./formulaValues";

// Splits "pos;neg;zero;text" on semicolons that aren't inside quotes.
const splitSections = (pattern) => {
    const sections = [];
    let current = "", inQuote = false;
    for (let i = 0; i < pattern.length; i++) {
        const ch = pattern[i];
        if (ch === '"') inQuote = !inQuote;
        if (ch === "\\" && !inQuote && i + 1 < pattern.length) { current += ch + pattern[++i]; continue; }
        if (ch === ";" && !inQuote) { sections.push(current); current = ""; continue; }
        current += ch;
    }
    sections.push(current);
    return sections;
};

// Breaks a section into literal runs and format characters, dropping [..]
// modifiers (colors, conditions, locale tags).
const lexSection = (section) => {
    const items = [];
    for (let i = 0; i < section.length; i++) {
        const ch = section[i];
        if (ch === '"') {
            const end = section.indexOf('"', i + 1);
            items.push({ lit: section.slice(i + 1, end === -1 ? undefined : end) });
            i = end === -1 ? section.length : end;
        } else if (ch === "\\" && i + 1 < section.length) {
            items.push({ lit: section[++i] });
        } else if (ch === "[") {
            const end = section.indexOf("]", i);
            i = end === -1 ? section.length : end;
        } else if (ch === "_" && i + 1 < section.length) {
            items.push({ lit: " " }); i++; // _x = space the width of x
        } else if (ch === "*" && i + 1 < section.length) {
            i++; // *x = repeat-fill, not meaningful outside a sized cell
        } else {
            items.push({ ch });
        }
    }
    return items;
};

const isDateSection = (items) => items.some((it) => it.ch && /[yYdDhHsS]/.test(it.ch))
    || (items.some((it) => it.ch && /[mM]/.test(it.ch)) && !items.some((it) => it.ch && /[0#?]/.test(it.ch)));

const formatDateSection = (serial, items) => {
    // Tokenize runs of the same date letter, plus AM/PM markers.
    const tokens = [];
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.lit !== undefined) { tokens.push({ lit: it.lit }); continue; }
        const ch = it.ch;
        const rest = items.slice(i, i + 5).map((x) => x.ch || "\u0000").join("");
        if (/^AM\/PM/i.test(rest)) { tokens.push({ ampm: "long" }); i += 4; continue; }
        if (/^A\/P/i.test(rest)) { tokens.push({ ampm: "short" }); i += 2; continue; }
        const lower = ch.toLowerCase();
        if ("ydhms".includes(lower)) {
            let run = 1;
            while (i + run < items.length && items[i + run].ch && items[i + run].ch.toLowerCase() === lower) run++;
            tokens.push({ kind: lower, len: run });
            i += run - 1;
            continue;
        }
        if (ch === "." && items[i + 1]?.ch === "0") { // fractional seconds: .0/.00/.000
            let run = 0;
            while (items[i + 1 + run]?.ch === "0") run++;
            tokens.push({ kind: "frac", len: run });
            i += run;
            continue;
        }
        tokens.push({ lit: ch });
    }

    // "m" means minutes right after an hour token or right before a seconds token.
    const timeTokens = tokens.filter((t) => t.kind);
    timeTokens.forEach((t, idx) => {
        if (t.kind !== "m") return;
        const prev = timeTokens[idx - 1], next = timeTokens[idx + 1];
        if (prev?.kind === "h" || next?.kind === "s") t.kind = "min";
    });

    const hasAmPm = tokens.some((t) => t.ampm);
    const p = serialToParts(serial);
    const pad = (n, len) => String(n).padStart(len, "0");
    const hour12 = ((p.hour + 11) % 12) + 1;
    const fracSeconds = serial * 86400 - Math.floor(serial * 86400);

    return tokens.map((t) => {
        if (t.lit !== undefined) return t.lit;
        if (t.ampm) return t.ampm === "long" ? (p.hour < 12 ? "AM" : "PM") : (p.hour < 12 ? "A" : "P");
        switch (t.kind) {
            case "y": return t.len <= 2 ? pad(p.year % 100, 2) : String(p.year);
            case "m":
                if (t.len === 1) return String(p.month);
                if (t.len === 2) return pad(p.month, 2);
                if (t.len === 3) return MONTH_NAMES[p.month - 1].slice(0, 3);
                if (t.len === 4) return MONTH_NAMES[p.month - 1];
                return MONTH_NAMES[p.month - 1][0];
            case "d":
                if (t.len === 1) return String(p.day);
                if (t.len === 2) return pad(p.day, 2);
                if (t.len === 3) return DAY_NAMES[p.weekday].slice(0, 3);
                return DAY_NAMES[p.weekday];
            case "h": return pad(hasAmPm ? hour12 : p.hour, Math.min(t.len, 2));
            case "min": return pad(p.minute, Math.min(t.len, 2));
            case "s": return pad(p.second, Math.min(t.len, 2));
            case "frac": return "." + String(Math.floor(fracSeconds * Math.pow(10, t.len))).padStart(t.len, "0");
            default: return "";
        }
    }).join("");
};

const groupThousands = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const formatNumberSection = (n, items, withSign) => {
    const isPlaceholder = (it) => it.ch && "0#?".includes(it.ch);
    const first = items.findIndex(isPlaceholder);
    if (first === -1) {
        // No digit placeholders: all literal (e.g. "Yes"), or just "%".
        return items.map((it) => (it.lit !== undefined ? it.lit : it.ch === "%" ? "%" : it.ch)).join("");
    }
    let last = items.length - 1;
    while (last > first && !(items[last].ch && "0#?.,Ee+-".includes(items[last].ch))) last--;
    // Scientific exponent digits end the numeric part too.
    const core = items.slice(first, last + 1).map((it) => it.ch ?? "").join("");
    const prefix = items.slice(0, first).map((it) => it.lit ?? it.ch).join("");
    const suffix = items.slice(last + 1).map((it) => it.lit ?? it.ch).join("");

    const percentCount = (prefix + suffix + core).split("%").length - 1;
    let value = Math.abs(n) * Math.pow(100, percentCount);

    const sciMatch = /^([^Ee]*)[Ee]([+-])(0+)$/.exec(core);
    const mantissaPattern = sciMatch ? sciMatch[1] : core;
    const [intPatternRaw, decPattern = null] = mantissaPattern.split(".");
    // Trailing commas right after the integer digits scale by 1000 each.
    const trailingCommas = /,+$/.exec(intPatternRaw)?.[0].length || 0;
    const intPattern = intPatternRaw.slice(0, intPatternRaw.length - trailingCommas);
    value /= Math.pow(1000, trailingCommas);
    const useGrouping = intPattern.includes(",");
    const minInt = (intPattern.match(/0/g) || []).length;
    const decimals = decPattern ? (decPattern.match(/[0#?]/g) || []).length : 0;
    const minDec = decPattern ? (decPattern.match(/0/g) || []).length : 0;

    let exponentText = "";
    if (sciMatch) {
        let exp = value === 0 ? 0 : Math.floor(Math.log10(value));
        const intDigits = Math.max(1, (intPattern.match(/[0#?]/g) || []).length);
        exp -= intDigits - 1;
        let mantissa = value / Math.pow(10, exp);
        if (roundHalfAway(mantissa, decimals) >= Math.pow(10, intDigits)) { exp += 1; mantissa /= 10; }
        value = mantissa;
        exponentText = `E${exp < 0 ? "-" : sciMatch[2] === "+" ? "+" : ""}${String(Math.abs(exp)).padStart(sciMatch[3].length, "0")}`;
    }

    const rounded = roundHalfAway(value, decimals);
    let [intDigits, decDigits = ""] = rounded.toFixed(decimals).split(".");
    if (intDigits === "0" && minInt === 0) intDigits = "";
    intDigits = intDigits.padStart(minInt, "0");
    if (useGrouping) intDigits = groupThousands(intDigits);
    while (decDigits.length > minDec && decDigits.endsWith("0")) decDigits = decDigits.slice(0, -1);

    const body = decPattern !== null ? `${intDigits}.${decDigits}` : intDigits;
    return `${withSign && n < 0 && rounded !== 0 ? "-" : ""}${prefix}${body}${exponentText}${suffix}`;
};

export const formatWithPattern = (value, pattern) => {
    const fmt = String(pattern ?? "");
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (value === null || value === undefined) value = 0;
    if (fmt === "" || /^general$/i.test(fmt.trim())) return typeof value === "number" ? formatGeneral(value) : String(value);

    const sections = splitSections(fmt);
    if (typeof value === "string") {
        const textSection = sections[3] ?? (sections.length === 1 && sections[0].includes("@") ? sections[0] : null);
        if (textSection === null) return value;
        return lexSection(textSection).map((it) => (it.lit !== undefined ? it.lit : it.ch === "@" ? value : it.ch)).join("");
    }

    let section = sections[0];
    let withSign = true;
    if (value < 0 && sections.length >= 2 && sections[1] !== "") { section = sections[1]; withSign = false; }
    else if (value === 0 && sections.length >= 3 && sections[2] !== "") section = sections[2];

    const items = lexSection(section);
    if (isDateSection(items)) return formatDateSection(value, items);
    return formatNumberSection(value, items, withSign);
};

export const DATE_FORMAT_PATTERN = "yyyy-mm-dd";
export const TIME_FORMAT_PATTERN = "hh:mm:ss";
export const DATETIME_FORMAT_PATTERN = "yyyy-mm-dd hh:mm";
