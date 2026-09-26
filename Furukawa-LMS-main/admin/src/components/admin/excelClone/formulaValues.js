// Value model shared by the formula engine and its function library.
//
// A formula evaluates to one of:
//   number | string | boolean | null (a blank cell) | FormulaError | Matrix
// Matrix is a 2-D block of those scalars — either a cell range (which keeps
// its `origin` so reference-aware functions like ROW/SUBTOTAL can see where
// it came from) or an array produced by an expression/function, which spills
// when it's a cell's final result.

export const ERR = {
    NULL: "#NULL!",
    DIV0: "#DIV/0!",
    VALUE: "#VALUE!",
    REF: "#REF!",
    NAME: "#NAME?",
    NUM: "#NUM!",
    NA: "#N/A",
    SPILL: "#SPILL!",
    CALC: "#CALC!",
    CYCLE: "#CYCLE!",
    ERROR: "#ERROR!",
};

export class FormulaError {
    constructor(code) { this.code = code; }
    toString() { return this.code; }
}

const errorCache = new Map();
export const err = (code) => {
    if (!errorCache.has(code)) errorCache.set(code, new FormulaError(code));
    return errorCache.get(code);
};
export const isError = (v) => v instanceof FormulaError;

// Marks an argument the user left out (`=XLOOKUP(a, b, c, , 1)`), which
// functions treat as "use the default" — distinct from a blank cell.
export const MISSING = Object.freeze({ missing: true });
export const isMissing = (v) => v === MISSING || v === undefined;

export class Matrix {
    constructor(rows, origin = null) {
        this.rows = rows;
        this.height = rows.length;
        this.width = rows.length ? rows[0].length : 0;
        this.origin = origin; // { row, col } of the top-left cell when this is a range
    }
    get(r, c) { return this.rows[r]?.[c]; }
    map(fn) { return new Matrix(this.rows.map((row, r) => row.map((v, c) => fn(v, r, c)))); }
    flat() { return this.rows.flat(); }
    static of(value) { return value instanceof Matrix ? value : new Matrix([[value]]); }
    static fromColumn(values) { return new Matrix(values.map((v) => [v])); }
}
export const isMatrix = (v) => v instanceof Matrix;

// Collapses an array to its top-left value where a single value is needed.
export const toScalar = (v) => (v instanceof Matrix ? (v.height && v.width ? v.rows[0][0] : err(ERR.CALC)) : v);

// --- Dates ---
// Excel's serial date: whole days since 1899-12-30, time as the fraction of a
// day. (Excel's fictional 1900-02-29 means serials below 61 are off by one
// versus the real calendar; that's the same trade-off every non-Excel
// implementation makes, and irrelevant for real-world dates.)

const EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86400000;

export const dateToSerial = (year, month, day) => {
    const d = new Date(0);
    d.setUTCFullYear(year, month - 1, day);
    d.setUTCHours(0, 0, 0, 0);
    return Math.round((d.getTime() - EPOCH_MS) / DAY_MS);
};

export const serialToParts = (serial) => {
    const wholeDays = Math.floor(serial);
    let seconds = Math.round((serial - wholeDays) * 86400);
    let days = wholeDays;
    if (seconds >= 86400) { days += 1; seconds -= 86400; }
    const d = new Date(EPOCH_MS + days * DAY_MS);
    return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        weekday: d.getUTCDay(), // 0 = Sunday
        hour: Math.floor(seconds / 3600),
        minute: Math.floor((seconds % 3600) / 60),
        second: seconds % 60,
    };
};

export const nowSerial = (date = new Date()) =>
    dateToSerial(date.getFullYear(), date.getMonth() + 1, date.getDate())
    + (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) / 86400;

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_LOOKUP = Object.fromEntries(MONTH_NAMES.flatMap((name, i) => [[name.toLowerCase(), i + 1], [name.slice(0, 3).toLowerCase(), i + 1]]));

const parseTimeParts = (text) => {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?\s*([AaPp][Mm])?$/.exec(text.trim());
    if (!m) return null;
    let hour = Number(m[1]);
    const minute = Number(m[2]), second = Number(m[3] || 0);
    if (m[4]) {
        if (hour < 1 || hour > 12) return null;
        const pm = m[4].toLowerCase() === "pm";
        hour = (hour % 12) + (pm ? 12 : 0);
    }
    if (hour > 23 || minute > 59 || second >= 60) return null;
    return (hour * 3600 + minute * 60 + second) / 86400;
};

// Recognizes the date/time spellings this app itself produces (ISO dates
// from Excel import and Ctrl+;) plus the month-name forms people commonly
// type. Deliberately skips ambiguous numeric d/m/y vs m/d/y orders.
export const parseDateTimeText = (text) => {
    const s = String(text).trim();
    if (!s) return null;
    const timeOnly = parseTimeParts(s);
    if (timeOnly !== null) return timeOnly;

    let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](.+))?$/.exec(s);
    let year, month, day, rest;
    if (m) { [, year, month, day, rest] = m; }
    else if ((m = /^(\d{1,2})[- ]([A-Za-z]{3,9})[- ,]+(\d{4})(?:\s+(.+))?$/.exec(s))) {
        day = m[1]; month = MONTH_LOOKUP[m[2].toLowerCase()]; year = m[3]; rest = m[4];
    } else if ((m = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})(?:\s+(.+))?$/.exec(s))) {
        month = MONTH_LOOKUP[m[1].toLowerCase()]; day = m[2]; year = m[3]; rest = m[4];
    } else {
        return null;
    }
    year = Number(year); month = Number(month); day = Number(day);
    if (!month || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const serial = dateToSerial(year, month, day);
    if (serialToParts(serial).day !== day) return null; // e.g. 2026-02-31
    if (rest) {
        const t = parseTimeParts(rest);
        if (t === null) return null;
        return serial + t;
    }
    return serial;
};

// --- Text <-> number ---

const NUMERIC_TEXT_RE = /^([-+])?\s*([$₹€£¥])?\s*((?:\d{1,3}(?:,\d{3})+|\d*)(?:\.\d*)?)(?:[eE]([-+]?\d+))?\s*(%)?$/;

// Text a user typed that Excel would treat as a number: plain, thousands
// separated, currency-prefixed, scientific, percentage, or a date/time.
export const parseNumericText = (text) => {
    const s = String(text).trim();
    if (!s) return null;
    const m = NUMERIC_TEXT_RE.exec(s);
    if (m && /\d/.test(m[3])) {
        let n = parseFloat(m[3].replace(/,/g, ""));
        if (m[4]) n *= Math.pow(10, Number(m[4]));
        if (m[5]) n /= 100;
        if (m[1] === "-") n = -n;
        return n;
    }
    return parseDateTimeText(s);
};

// Excel's "General" rendering of a number when it's turned into text (by &,
// TEXTJOIN, etc.): up to 15 significant digits, no trailing zeros.
export const formatGeneral = (n) => {
    if (!isFinite(n)) return String(n);
    if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
    const abs = Math.abs(n);
    if (abs !== 0 && (abs < 1e-9 || abs >= 1e15)) {
        const [mant, exp] = n.toExponential(9).split("e");
        return `${parseFloat(mant)}E${Number(exp) >= 0 ? "+" : "-"}${String(Math.abs(Number(exp))).padStart(2, "0")}`;
    }
    return String(parseFloat(n.toPrecision(15)));
};

// --- Coercions (throw FormulaError, which the evaluator turns into a value) ---

export const toNumber = (v) => {
    if (typeof v === "number") {
        if (!isFinite(v)) throw err(ERR.NUM);
        return v;
    }
    if (v === null || v === undefined || v === MISSING) return 0;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v instanceof FormulaError) throw v;
    if (v instanceof Matrix) return toNumber(toScalar(v));
    const n = parseNumericText(v);
    if (n === null) throw err(ERR.VALUE);
    return n;
};

export const toText = (v) => {
    if (v === null || v === undefined || v === MISSING) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number") return formatGeneral(v);
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (v instanceof FormulaError) throw v;
    if (v instanceof Matrix) return toText(toScalar(v));
    return String(v);
};

export const toBool = (v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (v === null || v === undefined || v === MISSING) return false;
    if (v instanceof FormulaError) throw v;
    if (v instanceof Matrix) return toBool(toScalar(v));
    const upper = String(v).trim().toUpperCase();
    if (upper === "TRUE") return true;
    if (upper === "FALSE") return false;
    throw err(ERR.VALUE);
};

export const toInt = (v) => Math.trunc(toNumber(v));

// Excel's sort/compare order across types: numbers < text < FALSE < TRUE,
// text compared case-insensitively. A blank takes on the other side's type
// (0, "" or FALSE), and two blanks are equal.
const typeRank = (v) => (typeof v === "number" ? 0 : typeof v === "string" ? 1 : typeof v === "boolean" ? 2 : 3);
export const compareValues = (a, b) => {
    if (a === null && b === null) return 0;
    if (a === null) a = typeof b === "number" ? 0 : typeof b === "boolean" ? false : "";
    if (b === null) b = typeof a === "number" ? 0 : typeof a === "boolean" ? false : "";
    const ra = typeRank(a), rb = typeRank(b);
    if (ra !== rb) return ra < rb ? -1 : 1;
    if (typeof a === "string") {
        const la = a.toLowerCase(), lb = b.toLowerCase();
        return la < lb ? -1 : la > lb ? 1 : 0;
    }
    if (typeof a === "boolean") return a === b ? 0 : a ? 1 : -1;
    return a < b ? -1 : a > b ? 1 : 0;
};

// --- Wildcards & criteria (COUNTIF, SUMIFS, MATCH, XLOOKUP, SEARCH, ...) ---

// Excel wildcards: * any run, ? one char, ~ escapes the next * ? or ~.
export const wildcardToRegexSource = (pattern) => {
    let out = "";
    for (let i = 0; i < pattern.length; i++) {
        const ch = pattern[i];
        if (ch === "~" && i + 1 < pattern.length && "*?~".includes(pattern[i + 1])) {
            out += "\\" + pattern[++i];
        } else if (ch === "*") out += "[\\s\\S]*";
        else if (ch === "?") out += "[\\s\\S]";
        else out += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    return out;
};
export const hasWildcards = (pattern) => /(^|[^~])[*?]/.test(pattern);
export const wildcardMatcher = (pattern) => {
    const re = new RegExp(`^${wildcardToRegexSource(pattern)}$`, "i");
    return (text) => re.test(text);
};

// Lookup equality (MATCH 0, XLOOKUP 0, VLOOKUP FALSE): same type, text
// case-insensitive, optional wildcard pattern when the lookup value is text.
export const makeLookupEquals = (lookupValue, useWildcards) => {
    if (typeof lookupValue === "string" && useWildcards && hasWildcards(lookupValue)) {
        const test = wildcardMatcher(lookupValue);
        return (v) => typeof v === "string" && test(v);
    }
    if (typeof lookupValue === "string") {
        const needle = lookupValue.toLowerCase();
        return (v) => typeof v === "string" && v.toLowerCase() === needle;
    }
    if (lookupValue === null) return (v) => v === null || v === "";
    return (v) => typeof v === typeof lookupValue && v === lookupValue;
};

// Builds a predicate for a COUNTIF-style criterion: 5, ">=10", "<>Done",
// "Delhi*", "=" (blank), "<>" (non-blank), or a date/number in text form.
export const parseCriteria = (criterion) => {
    if (criterion instanceof FormulaError) throw criterion;
    if (criterion === null || criterion === MISSING) criterion = "";
    if (typeof criterion === "number") {
        return (v) => (typeof v === "number" ? v === criterion : typeof v === "string" && parseNumericText(v) === criterion);
    }
    if (typeof criterion === "boolean") return (v) => v === criterion;

    const text = String(criterion);
    const opMatch = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(text);
    const op = opMatch[1] || "=";
    const operandText = opMatch[2];
    const operandNum = operandText.trim() === "" ? null : parseNumericText(operandText);
    const operandBool = /^(TRUE|FALSE)$/i.test(operandText) ? operandText.toUpperCase() === "TRUE" : null;

    if (operandText === "") {
        if (!opMatch[1]) return (v) => v === null || v === "";
        if (op === "=") return (v) => v === null || v === "";
        if (op === "<>") return (v) => v !== null && v !== "";
        return () => false;
    }

    if (operandNum !== null) {
        const cmp = (v) => {
            const n = typeof v === "number" ? v : typeof v === "string" && (op === "=" || op === "<>") ? parseNumericText(v) : null;
            return n === null ? null : n;
        };
        switch (op) {
            case "=": return (v) => cmp(v) === operandNum;
            case "<>": return (v) => cmp(v) !== operandNum;
            case ">": return (v) => typeof v === "number" && v > operandNum;
            case ">=": return (v) => typeof v === "number" && v >= operandNum;
            case "<": return (v) => typeof v === "number" && v < operandNum;
            case "<=": return (v) => typeof v === "number" && v <= operandNum;
        }
    }
    if (operandBool !== null) {
        if (op === "=") return (v) => v === operandBool;
        if (op === "<>") return (v) => v !== operandBool;
    }

    if (op === "=" || op === "<>") {
        const test = wildcardMatcher(operandText);
        return op === "="
            ? (v) => typeof v === "string" && test(v)
            : (v) => !(typeof v === "string" && test(v));
    }
    // Text ordering comparisons (">M" etc.) only consider text cells.
    const needle = operandText.toLowerCase();
    return (v) => {
        if (typeof v !== "string") return false;
        const hay = v.toLowerCase();
        return op === ">" ? hay > needle : op === ">=" ? hay >= needle : op === "<" ? hay < needle : hay <= needle;
    };
};

// --- Rounding (Excel rounds half away from zero, unlike Math.round) ---

export const fixFloat = (n) => (Number.isFinite(n) ? parseFloat(n.toPrecision(15)) : n);

export const roundHalfAway = (n, digits = 0) => {
    const factor = Math.pow(10, digits);
    const scaled = fixFloat(Math.abs(n) * factor);
    return Math.sign(n) * Math.round(scaled) / factor;
};
