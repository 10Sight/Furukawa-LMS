// Fill-handle series for text, the way Excel continues them when the fill
// handle is dragged: weekdays (Mon -> Tue), months (Jan -> Feb), dates
// (2026-10-15 -> 2026-10-16), quarters (Q1 -> Q2, wrapping after Q4),
// ordinals (1st -> 2nd) and text with a number in it (Item 1 -> Item 2,
// A001 -> A002). Plain numbers are not handled here — extrapolateSeries in
// formulaEngine.js does those.
//
// With one source value the series steps by one (one day, for a date). With
// several, by the step between them — Mon, Wed -> Fri; Item 2, Item 4 -> Item 6;
// 15 Jan, 15 Feb -> 15 Mar — as long as every source value is the same kind.
// Anything else returns null, and the caller copies the source as before.
import { MONTH_NAMES, DAY_NAMES, dateToSerial, serialToParts } from "./formulaValues.js";

const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
const DAY_SHORT = DAY_NAMES.map((d) => d.slice(0, 3));

// The step between consecutive source positions, when the values are evenly
// spaced; positions on a cycle (weekdays, months) are compared round it.
const stepOf = (positions, cycle) => {
    if (positions.length === 1) return 1;
    const diff = (a, b) => (cycle ? ((b - a) % cycle + cycle) % cycle : b - a);
    const step = diff(positions[0], positions[1]);
    for (let i = 2; i < positions.length; i++) if (diff(positions[i - 1], positions[i]) !== step) return null;
    return step;
};

// Writes `word` in the same letter case as `sample`: MON, mon or Mon.
const matchCase = (word, sample) => {
    if (sample === sample.toUpperCase()) return word.toUpperCase();
    if (sample === sample.toLowerCase()) return word.toLowerCase();
    return word;
};

// --- Weekdays and months: a name from a fixed cycle ---

const cycleSeries = (values, count, fullNames, shortNames) => {
    const positions = [];
    for (const v of values) {
        const s = v.trim().toLowerCase();
        let i = fullNames.findIndex((n) => n.toLowerCase() === s);
        if (i < 0) i = shortNames.findIndex((n) => n.toLowerCase() === s);
        if (i < 0) return null;
        positions.push(i);
    }
    const step = stepOf(positions, fullNames.length);
    if (step === null) return null;
    // Spelled like the last source value: full or short, and in its case.
    const sample = values[values.length - 1].trim();
    const names = sample.length > 3 ? fullNames : shortNames;
    const last = positions[positions.length - 1];
    return Array.from({ length: count }, (_, k) => {
        const i = ((last + step * (k + 1)) % fullNames.length + fullNames.length) % fullNames.length;
        return matchCase(names[i], sample);
    });
};

// --- Dates, written back in the format they were typed in ---

const pad2 = (n) => String(n).padStart(2, "0");

// Each format reads a date string into { year, month, day } and writes one back.
// Day-first numeric dates (15/10/2026) are taken as day/month, the order used here.
const DATE_FORMATS = [
    { // 2026-10-15, 2026/10/15
        re: /^(\d{4})([-/])(\d{1,2})\2(\d{1,2})$/,
        read: (m) => ({ year: +m[1], month: +m[3], day: +m[4] }),
        write: (p, m) => `${p.year}${m[2]}${m[3].length === 2 ? pad2(p.month) : p.month}${m[2]}${m[4].length === 2 ? pad2(p.day) : p.day}`,
    },
    { // 15/10/2026, 15-10-2026, 15.10.2026
        re: /^(\d{1,2})([-/.])(\d{1,2})\2(\d{4})$/,
        read: (m) => ({ year: +m[4], month: +m[3], day: +m[1] }),
        write: (p, m) => `${m[1].length === 2 ? pad2(p.day) : p.day}${m[2]}${m[3].length === 2 ? pad2(p.month) : p.month}${m[2]}${p.year}`,
    },
    { // 15 Oct 2026, 15-Oct-2026, 15 October 2026
        re: /^(\d{1,2})([- ])([A-Za-z]{3,9})\2(\d{4})$/,
        read: (m) => ({ year: +m[4], month: monthOf(m[3]), day: +m[1] }),
        write: (p, m) => `${m[1].length === 2 ? pad2(p.day) : p.day}${m[2]}${monthLike(p.month, m[3])}${m[2]}${p.year}`,
    },
    { // Oct 15, 2026; October 15 2026
        re: /^([A-Za-z]{3,9}) (\d{1,2})(,?) (\d{4})$/,
        read: (m) => ({ year: +m[4], month: monthOf(m[1]), day: +m[2] }),
        write: (p, m) => `${monthLike(p.month, m[1])} ${m[2].length === 2 ? pad2(p.day) : p.day}${m[3]} ${p.year}`,
    },
];
const monthOf = (name) => {
    const s = name.toLowerCase();
    const i = MONTH_NAMES.findIndex((n) => n.toLowerCase() === s || n.slice(0, 3).toLowerCase() === s);
    return i + 1; // 0 when not a month
};
const monthLike = (month, sample) => matchCase((sample.length > 3 ? MONTH_NAMES : MONTH_SHORT)[month - 1], sample);
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

const readDate = (value) => {
    const s = value.trim();
    for (const format of DATE_FORMATS) {
        const m = format.re.exec(s);
        if (!m) continue;
        const p = format.read(m);
        if (!p.month || p.month > 12 || p.day < 1 || p.day > daysInMonth(p.year, p.month)) return null;
        return { ...p, format, match: m, serial: dateToSerial(p.year, p.month, p.day) };
    }
    return null;
};

const dateSeries = (values, count) => {
    const dates = values.map(readDate);
    if (dates.some((d) => !d || d.format !== dates[0].format)) return null;
    const last = dates[dates.length - 1];
    const write = (p) => last.format.write(p, last.match);

    // Same day of the month, a whole number of months apart: step by months
    // (15 Jan, 15 Feb -> 15 Mar), keeping the day where the month has it.
    if (dates.length > 1 && dates.every((d) => d.day === dates[0].day)) {
        const monthStep = stepOf(dates.map((d) => d.year * 12 + d.month - 1), 0);
        if (monthStep) {
            return Array.from({ length: count }, (_, k) => {
                const index = last.year * 12 + last.month - 1 + monthStep * (k + 1);
                const year = Math.floor(index / 12), month = (index % 12) + 1;
                return write({ year, month, day: Math.min(last.day, daysInMonth(year, month)) });
            });
        }
    }
    const dayStep = stepOf(dates.map((d) => d.serial), 0);
    if (!dayStep) return null;
    return Array.from({ length: count }, (_, k) => write(serialToParts(last.serial + dayStep * (k + 1))));
};

// --- Quarters: Q1 -> Q2 -> Q3 -> Q4 -> Q1 ---

const QUARTER_RE = /^(Q|Qtr|Quarter)(\s?)([1-4])$/i;
const quarterSeries = (values, count) => {
    const parts = values.map((v) => QUARTER_RE.exec(v.trim()));
    if (parts.some((m) => !m || m[1].toLowerCase() !== parts[0][1].toLowerCase())) return null;
    const step = stepOf(parts.map((m) => +m[3] - 1), 4);
    if (step === null) return null;
    const [, label, gap] = parts[parts.length - 1];
    const last = +parts[parts.length - 1][3] - 1;
    return Array.from({ length: count }, (_, k) => `${label}${gap}${((last + step * (k + 1)) % 4 + 4) % 4 + 1}`);
};

// --- Text with a number in it: Item 1 -> Item 2, A001 -> A002, 1st -> 2nd ---

const ORDINAL_SUFFIX_RE = /^(st|nd|rd|th)$/i;
const ordinalSuffix = (n) => {
    const tens = Math.abs(n) % 100, ones = Math.abs(n) % 10;
    if (tens >= 11 && tens <= 13) return "th";
    return ones === 1 ? "st" : ones === 2 ? "nd" : ones === 3 ? "rd" : "th";
};
// The last run of digits is the one that counts, as in Excel ("Line 2 Shift 1" -> "Line 2 Shift 2").
const NUMBERED_TEXT_RE = /^(.*?)(\d+)(\D*)$/s;

const numberedTextSeries = (values, count) => {
    const parts = values.map((v) => NUMBERED_TEXT_RE.exec(v));
    if (parts.some((m) => !m)) return null;
    const [, prefix, , suffix] = parts[0];
    const ordinal = ORDINAL_SUFFIX_RE.test(suffix);
    // Every value has to be the same text around its number (an ordinal's ending may differ).
    if (parts.some((m) => m[1] !== prefix || (ordinal ? !ORDINAL_SUFFIX_RE.test(m[3]) : m[3] !== suffix))) return null;
    // The text has to be more than a bare number, which the numeric fill handles.
    if (!prefix && !suffix) return null;
    const step = stepOf(parts.map((m) => Number(m[2])), 0);
    if (step === null) return null;
    const lastDigits = parts[parts.length - 1][2];
    // Keeps zero padding: A001 -> A002, not A2.
    const width = lastDigits.length > 1 && lastDigits.startsWith("0") ? lastDigits.length : 0;
    const lastSuffix = parts[parts.length - 1][3];
    return Array.from({ length: count }, (_, k) => {
        const n = Number(lastDigits) + step * (k + 1);
        const digits = n < 0 ? `-${String(-n).padStart(width, "0")}` : String(n).padStart(width, "0");
        return `${prefix}${digits}${ordinal ? matchCase(ordinalSuffix(n), lastSuffix) : suffix}`;
    });
};

/**
 * The next `count` values after `values` (one source column or row, in order),
 * or null when they aren't a text series this knows.
 * @param {Array<unknown>} values
 * @param {number} count
 * @returns {string[]|null}
 */
export const continueTextSeries = (values, count) => {
    if (count <= 0 || values.length === 0) return null;
    if (!values.every((v) => typeof v === "string" && v.trim() !== "" && !v.trim().startsWith("="))) return null;
    return cycleSeries(values, count, DAY_NAMES, DAY_SHORT)
        ?? cycleSeries(values, count, MONTH_NAMES, MONTH_SHORT)
        ?? dateSeries(values, count)
        ?? quarterSeries(values, count)
        ?? numberedTextSeries(values, count);
};
