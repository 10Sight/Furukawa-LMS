// Worksheet function library for the formula engine.
//
// Each entry is { fn, min, max, ...flags }:
//   refs          cell arguments arrive as 1x1 reference Matrices (not bare
//                 values), so aggregations can apply Excel's "ignore text
//                 and logicals in references" rule to them too.
//   lift          true (every argument) or a list of argument indexes that,
//                 when handed an array, make the function run once per
//                 element and return an array — Excel's array "lifting",
//                 e.g. =LEN(A1:A5) or =COUNTIF(A:A, C1:C3).
//   acceptsErrors lifted arguments may be error values (ISERROR & co.);
//                 otherwise an error argument short-circuits to itself.
//   lazy          fn(argNodes, ctx, evaluate) evaluates its own arguments,
//                 so IF/IFERROR/CHOOSE don't evaluate branches they skip.
// Functions signal errors by throwing FormulaError (see formulaValues.js).

import {
    ERR, err, isError, FormulaError, Matrix, MISSING, isMissing, toScalar,
    toNumber, toText, toBool, toInt, compareValues, parseNumericText, parseDateTimeText,
    makeLookupEquals, parseCriteria, wildcardToRegexSource, hasWildcards,
    dateToSerial, serialToParts, roundHalfAway, fixFloat,
} from "./formulaValues";
import { formatWithPattern } from "./formulaFormat";

// ---------------------------------------------------------------------------
// Argument helpers

const optNum = (v, dflt) => (isMissing(v) ? dflt : toNumber(v));
const optBool = (v, dflt) => (isMissing(v) ? dflt : toBool(v));
const optInt = (v, dflt) => (isMissing(v) ? dflt : toInt(v));
const asMatrix = (v) => (v instanceof Matrix ? v : new Matrix([[isMissing(v) ? null : v]]));
const failIfError = (v) => { if (v instanceof FormulaError) throw v; return v; };

// Visits every value an argument supplies. `fromRef` is true for values that
// came from a range/array (where Excel skips text & logicals in math).
const forEachValue = (arg, cb) => {
    if (arg instanceof Matrix) {
        for (let r = 0; r < arg.height; r++) {
            for (let c = 0; c < arg.width; c++) cb(arg.rows[r][c], true, arg, r, c);
        }
    } else if (!isMissing(arg)) {
        cb(arg, false, null, 0, 0);
    }
};

// Numbers for SUM/AVERAGE/MIN/...: range values count only when numeric;
// directly-typed arguments are coerced (TRUE -> 1, "3" -> 3, "x" -> #VALUE!).
const collectNumbers = (args, { skipErrors = false, skipCell = null } = {}) => {
    const out = [];
    for (const arg of args) {
        forEachValue(arg, (v, fromRef, m, r, c) => {
            if (skipCell && m?.origin && skipCell(m.origin.row + r, m.origin.col + c)) return;
            if (v instanceof FormulaError) { if (skipErrors) return; throw v; }
            if (typeof v === "number") { out.push(v); return; }
            if (fromRef || v === null) return;
            out.push(toNumber(v));
        });
    }
    return out;
};

// All values (for COUNTA, CONCAT, ...), flattened row by row.
const collectValues = (args) => {
    const out = [];
    for (const arg of args) forEachValue(arg, (v) => out.push(v));
    return out;
};

const vectorOf = (arg) => {
    const m = asMatrix(arg);
    if (m.height !== 1 && m.width !== 1) throw err(ERR.NA);
    return m.height === 1 ? m.rows[0] : m.rows.map((row) => row[0]);
};

const sum = (nums) => nums.reduce((a, b) => a + b, 0);
const mean = (nums) => { if (!nums.length) throw err(ERR.DIV0); return sum(nums) / nums.length; };
const variance = (nums, sample) => {
    const n = nums.length;
    if (n < (sample ? 2 : 1)) throw err(ERR.DIV0);
    const m = sum(nums) / n;
    return nums.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (sample ? n - 1 : n);
};
const sortedAsc = (nums) => [...nums].sort((a, b) => a - b);
const median = (nums) => {
    if (!nums.length) throw err(ERR.NUM);
    const s = sortedAsc(nums), mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const modeSngl = (nums) => {
    const counts = new Map();
    let best = null, bestCount = 1;
    for (const x of nums) {
        const c = (counts.get(x) || 0) + 1;
        counts.set(x, c);
        if (c > bestCount) { best = x; bestCount = c; }
    }
    if (best === null) throw err(ERR.NA);
    return best;
};
const kth = (nums, k, largest) => {
    const s = sortedAsc(nums);
    if (!Number.isInteger(k)) k = Math.ceil(k);
    if (k < 1 || k > s.length) throw err(ERR.NUM);
    return largest ? s[s.length - k] : s[k - 1];
};
const percentileInc = (nums, k) => {
    if (!nums.length || k < 0 || k > 1) throw err(ERR.NUM);
    const s = sortedAsc(nums), pos = k * (s.length - 1), lo = Math.floor(pos);
    return lo + 1 < s.length ? s[lo] + (pos - lo) * (s[lo + 1] - s[lo]) : s[lo];
};
const percentileExc = (nums, k) => {
    const s = sortedAsc(nums), n = s.length, pos = k * (n + 1);
    if (!n || pos < 1 || pos > n) throw err(ERR.NUM);
    const lo = Math.floor(pos);
    return lo < n ? s[lo - 1] + (pos - lo) * (s[lo] - s[lo - 1]) : s[n - 1];
};

// Paired numeric values (CORREL, COVARIANCE): only positions where both
// sides are numbers count, like Excel.
const pairedNumbers = (a, b) => {
    const ma = asMatrix(a), mb = asMatrix(b);
    if (ma.height * ma.width !== mb.height * mb.width) throw err(ERR.NA);
    const fa = ma.flat(), fb = mb.flat(), xs = [], ys = [];
    fa.forEach((x, i) => {
        const y = fb[i];
        failIfError(x); failIfError(y);
        if (typeof x === "number" && typeof y === "number") { xs.push(x); ys.push(y); }
    });
    return [xs, ys];
};
const covariance = (xs, ys, sample) => {
    const n = xs.length;
    if (n < (sample ? 2 : 1)) throw err(ERR.DIV0);
    const mx = sum(xs) / n, my = sum(ys) / n;
    return xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0) / (sample ? n - 1 : n);
};

// ---------------------------------------------------------------------------
// Conditional aggregation (…IF / …IFS)

// Positions (flat indexes) where every [range, criterion] pair matches.
const matchingPositions = (pairs) => {
    const first = asMatrix(pairs[0][0]);
    const size = first.height * first.width;
    let positions = null;
    for (const [range, criterion] of pairs) {
        const m = asMatrix(range);
        if (m.height !== first.height || m.width !== first.width) throw err(ERR.VALUE);
        const test = parseCriteria(toScalar(criterion));
        const flat = m.flat();
        const next = [];
        for (const i of positions ?? Array.from({ length: size }, (_, k) => k)) {
            if (test(flat[i])) next.push(i);
        }
        positions = next;
    }
    return { positions: positions || [], shape: first };
};
const valuesAt = (range, positions, shape) => {
    const m = asMatrix(range);
    return positions.map((i) => {
        const r = Math.floor(i / shape.width), c = i % shape.width;
        return m.rows[r]?.[c] ?? null;
    });
};
const numbersAt = (range, positions, shape) =>
    valuesAt(range, positions, shape).filter((v) => { failIfError(v); return typeof v === "number"; });
const ifsPairs = (args, start) => {
    if ((args.length - start) % 2 !== 0 || args.length - start < 2) throw err(ERR.VALUE);
    const pairs = [];
    for (let i = start; i < args.length; i += 2) pairs.push([args[i], args[i + 1]]);
    return pairs;
};

// ---------------------------------------------------------------------------
// Lookup

// 0-based index of `value` in `values`, or -1.
//   mode: 0 exact, -1 exact-or-next-smaller, 1 exact-or-next-larger, 2 wildcard
//   reverse: search last-to-first
const xmatchIndex = (value, values, mode = 0, reverse = false) => {
    const order = values.map((_, i) => i);
    if (reverse) order.reverse();
    if (mode === 0 || mode === 2) {
        const eq = makeLookupEquals(value, mode === 2);
        for (const i of order) if (eq(values[i])) return i;
        return -1;
    }
    let best = -1;
    for (const i of order) {
        const v = values[i];
        if (v === null || typeof v !== typeof value) continue;
        const cmp = compareValues(v, value);
        if (cmp === 0) return i;
        if ((mode === -1 && cmp < 0) || (mode === 1 && cmp > 0)) {
            if (best === -1 || (mode === -1 ? compareValues(v, values[best]) > 0 : compareValues(v, values[best]) < 0)) best = i;
        }
    }
    return best;
};

// Classic sorted-data approximate match (MATCH 1/-1, VLOOKUP TRUE).
const sortedMatchIndex = (value, values, descending) => {
    let found = -1;
    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (v === null || typeof v !== typeof value) continue;
        const cmp = compareValues(v, value);
        if (descending ? cmp >= 0 : cmp <= 0) found = i;
        else break;
    }
    return found;
};

const sliceRows = (m, indexes) => new Matrix(indexes.map((i) => m.rows[i]));
const sliceCols = (m, indexes) => new Matrix(m.rows.map((row) => indexes.map((i) => row[i])));
const transpose = (m) => new Matrix(Array.from({ length: m.width }, (_, c) => m.rows.map((row) => row[c])));

const resolveIndexes = (requested, length) => requested.map((raw) => {
    const n = toInt(raw);
    const idx = n < 0 ? length + n : n - 1;
    if (n === 0 || idx < 0 || idx >= length) throw err(ERR.VALUE);
    return idx;
});

const stack = (args, vertical) => {
    const parts = args.filter((a) => !isMissing(a)).map(asMatrix);
    if (!parts.length) throw err(ERR.VALUE);
    const na = err(ERR.NA);
    if (vertical) {
        const width = Math.max(...parts.map((p) => p.width));
        return new Matrix(parts.flatMap((p) => p.rows.map((row) => [...row, ...Array(width - row.length).fill(na)])));
    }
    const height = Math.max(...parts.map((p) => p.height));
    return new Matrix(Array.from({ length: height }, (_, r) => parts.flatMap((p) => p.rows[r] ?? Array(p.width).fill(na))));
};

const takeDrop = (arr, rowsArg, colsArg, isTake) => {
    const m = asMatrix(arr);
    const pick = (count, length) => {
        if (isMissing(count)) return Array.from({ length }, (_, i) => i);
        const n = toInt(count);
        if (isTake) {
            if (n === 0) throw err(ERR.CALC);
            const k = Math.min(Math.abs(n), length);
            return n > 0 ? Array.from({ length: k }, (_, i) => i) : Array.from({ length: k }, (_, i) => length - k + i);
        }
        const k = Math.min(Math.abs(n), length);
        if (k === length && n !== 0) throw err(ERR.CALC);
        return n >= 0 ? Array.from({ length: length - k }, (_, i) => k + i) : Array.from({ length: length - k }, (_, i) => i);
    };
    const rowIdx = pick(rowsArg, m.height), colIdx = pick(colsArg, m.width);
    if (!rowIdx.length || !colIdx.length) throw err(ERR.CALC);
    return sliceCols(sliceRows(m, rowIdx), colIdx);
};

// ---------------------------------------------------------------------------
// Dates

const toSerial = (v) => {
    v = toScalar(v);
    if (typeof v === "number") return v;
    if (v === null || isMissing(v)) return 0;
    if (typeof v === "boolean") throw err(ERR.VALUE);
    failIfError(v);
    const parsed = parseDateTimeText(v) ?? parseNumericText(v);
    if (parsed === null) throw err(ERR.VALUE);
    return parsed;
};
const toDate = (v) => {
    const s = toSerial(v);
    if (s < 0) throw err(ERR.NUM);
    return Math.floor(s);
};
const daysInMonth = (y, m) => serialToParts(dateToSerial(y, m + 1, 0)).day;
const addMonths = (serial, months, endOfMonth) => {
    const p = serialToParts(serial);
    const total = p.year * 12 + (p.month - 1) + Math.trunc(months);
    const y = Math.floor(total / 12), m = (total % 12) + 1;
    const d = endOfMonth ? daysInMonth(y, m) : Math.min(p.day, daysInMonth(y, m));
    return dateToSerial(y, m, d);
};

// Weekend mask indexed by JS weekday (0 = Sunday).
const WEEKEND_CODES = {
    1: [6, 0], 2: [0, 1], 3: [1, 2], 4: [2, 3], 5: [3, 4], 6: [4, 5], 7: [5, 6],
    11: [0], 12: [1], 13: [2], 14: [3], 15: [4], 16: [5], 17: [6],
};
const weekendMask = (arg) => {
    const mask = Array(7).fill(false);
    if (isMissing(arg)) { mask[0] = mask[6] = true; return mask; }
    const v = toScalar(arg);
    if (typeof v === "string" && /^[01]{7}$/.test(v)) {
        // Monday-first string, "1" = weekend.
        for (let i = 0; i < 7; i++) mask[(i + 1) % 7] = v[i] === "1";
        if (mask.every(Boolean)) throw err(ERR.VALUE);
        return mask;
    }
    const days = WEEKEND_CODES[toInt(v)];
    if (!days) throw err(ERR.NUM);
    days.forEach((d) => { mask[d] = true; });
    return mask;
};
const holidaySet = (arg) => new Set(isMissing(arg) ? [] : collectValues([arg]).filter((v) => v !== null).map((v) => toDate(v)));
const isWorkday = (serial, mask, holidays) => !mask[serialToParts(serial).weekday] && !holidays.has(serial);
const MAX_DAY_SPAN = 400000;
const networkDays = (start, end, mask, holidays) => {
    const s = toDate(start), e = toDate(end);
    const [lo, hi] = s <= e ? [s, e] : [e, s];
    if (hi - lo > MAX_DAY_SPAN) throw err(ERR.NUM);
    let count = 0;
    for (let d = lo; d <= hi; d++) if (isWorkday(d, mask, holidays)) count++;
    return s <= e ? count : -count;
};
const workday = (start, days, mask, holidays) => {
    let d = toDate(start);
    let remaining = toInt(days);
    const step = remaining >= 0 ? 1 : -1;
    let guard = 0;
    while (remaining !== 0) {
        d += step;
        if (isWorkday(d, mask, holidays)) remaining -= step;
        if (++guard > MAX_DAY_SPAN) throw err(ERR.NUM);
    }
    return d;
};
const weekday = (serial, type) => {
    const dow = serialToParts(toDate(serial)).weekday; // 0 = Sunday
    const startMap = { 1: 0, 2: 1, 3: 1, 11: 1, 12: 2, 13: 3, 14: 4, 15: 5, 16: 6, 17: 0 };
    if (!(type in startMap)) throw err(ERR.NUM);
    const offset = (dow - startMap[type] + 7) % 7;
    return type === 3 ? offset : offset + 1;
};
const isoWeekNum = (serial) => {
    const p = serialToParts(serial);
    const dow = (p.weekday + 6) % 7; // Monday = 0
    const thursday = serial - dow + 3;
    const tp = serialToParts(thursday);
    const jan1 = dateToSerial(tp.year, 1, 1);
    return Math.floor((thursday - jan1) / 7) + 1;
};
const weekNum = (serial, type) => {
    const d = toDate(serial);
    if (type === 21) return isoWeekNum(d);
    const startMap = { 1: 0, 17: 0, 2: 1, 11: 1, 12: 2, 13: 3, 14: 4, 15: 5, 16: 6 };
    if (!(type in startMap)) throw err(ERR.NUM);
    const p = serialToParts(d);
    const jan1 = dateToSerial(p.year, 1, 1);
    const jan1Dow = serialToParts(jan1).weekday;
    const offset = (jan1Dow - startMap[type] + 7) % 7;
    return Math.floor((d - jan1 + offset) / 7) + 1;
};
const datedif = (startArg, endArg, unitArg) => {
    const s = toDate(startArg), e = toDate(endArg);
    if (s > e) throw err(ERR.NUM);
    const unit = toText(unitArg).toUpperCase();
    const a = serialToParts(s), b = serialToParts(e);
    let months = (b.year - a.year) * 12 + (b.month - a.month);
    if (b.day < a.day) months -= 1;
    switch (unit) {
        case "D": return e - s;
        case "M": return months;
        case "Y": return Math.floor(months / 12);
        case "YM": return months % 12;
        case "MD": {
            if (b.day >= a.day) return b.day - a.day;
            // Count from the start day within the previous month — clamped to
            // that month's length (Jan 31 -> Feb 28), so it can't go negative.
            const prevMonthDays = daysInMonth(b.month === 1 ? b.year - 1 : b.year, b.month === 1 ? 12 : b.month - 1);
            return prevMonthDays - Math.min(a.day, prevMonthDays) + b.day;
        }
        case "YD": {
            let anniversary = dateToSerial(b.year, a.month, Math.min(a.day, daysInMonth(b.year, a.month)));
            if (anniversary > e) anniversary = dateToSerial(b.year - 1, a.month, Math.min(a.day, daysInMonth(b.year - 1, a.month)));
            return e - anniversary;
        }
        default: throw err(ERR.NUM);
    }
};

// ---------------------------------------------------------------------------
// Financial (Excel sign convention: money paid out is negative)

const fvCalc = (r, n, pmt, pv, type) => (r === 0
    ? -(pv + pmt * n)
    : -(pv * Math.pow(1 + r, n) + pmt * (1 + r * type) * (Math.pow(1 + r, n) - 1) / r));
const pmtCalc = (r, n, pv, fv, type) => {
    if (n === 0) throw err(ERR.NUM);
    if (r === 0) return -(pv + fv) / n;
    const f = Math.pow(1 + r, n);
    return -(r * (pv * f + fv)) / ((1 + r * type) * (f - 1));
};
const pvCalc = (r, n, pmt, fv, type) => (r === 0
    ? -(fv + pmt * n)
    : -(fv + pmt * (1 + r * type) * (Math.pow(1 + r, n) - 1) / r) / Math.pow(1 + r, n));
const ipmtCalc = (r, per, n, pv, fv, type) => {
    if (per < 1 || per > n) throw err(ERR.NUM);
    const pmt = pmtCalc(r, n, pv, fv, type);
    let interest;
    if (per === 1) interest = type === 1 ? 0 : -pv;
    else interest = type === 1 ? fvCalc(r, per - 2, pmt, pv, 1) - pmt : fvCalc(r, per - 1, pmt, pv, 0);
    return interest * r;
};
const typeArg = (v) => (optNum(v, 0) !== 0 ? 1 : 0);

// Newton-Raphson with a numeric derivative, falling back to #NUM! when it
// doesn't converge — the same failure mode Excel reports.
const solve = (f, guess) => {
    let x = guess;
    for (let i = 0; i < 100; i++) {
        const y = f(x);
        if (!isFinite(y)) break;
        if (Math.abs(y) < 1e-10) return x;
        const h = Math.max(1e-7, Math.abs(x) * 1e-7);
        const dy = (f(x + h) - f(x - h)) / (2 * h);
        if (!isFinite(dy) || dy === 0) break;
        const next = x - y / dy;
        if (Math.abs(next - x) < 1e-12) return next;
        x = next;
        if (x <= -1) x = (x + guess) / 2 - 0.5;
    }
    throw err(ERR.NUM);
};
const npvAt = (rate, values) => values.reduce((acc, v, i) => acc + v / Math.pow(1 + rate, i + 1), 0);
const cashflowSigns = (values) => {
    if (!values.some((v) => v > 0) || !values.some((v) => v < 0)) throw err(ERR.NUM);
};
const xnpvAt = (rate, values, dates) => values.reduce((acc, v, i) => acc + v / Math.pow(1 + rate, (dates[i] - dates[0]) / 365), 0);
const xflows = (valuesArg, datesArg) => {
    const values = collectValues([valuesArg]).map((v) => toNumber(v));
    const dates = collectValues([datesArg]).map((v) => toDate(v));
    if (values.length !== dates.length || values.length < 2) throw err(ERR.NUM);
    if (dates.some((d) => d < dates[0])) throw err(ERR.NUM);
    return [values, dates];
};

// ---------------------------------------------------------------------------
// Math helpers

const gcd2 = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
const combin = (n, k) => {
    if (n < 0 || k < 0 || k > n) throw err(ERR.NUM);
    let result = 1;
    for (let i = 1; i <= Math.min(k, n - k); i++) result = result * (n - Math.min(k, n - k) + i) / i;
    return Math.round(result);
};
const factorial = (n) => {
    if (n < 0) throw err(ERR.NUM);
    if (n > 170) throw err(ERR.NUM);
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
};

// SUBTOTAL / AGGREGATE function numbers.
const AGG_FUNCS = {
    1: (n) => mean(n),
    2: (n) => n.length,
    3: null, // COUNTA — needs all values, handled at the call site
    4: (n) => (n.length ? Math.max(...n) : 0),
    5: (n) => (n.length ? Math.min(...n) : 0),
    6: (n) => (n.length ? n.reduce((a, b) => a * b, 1) : 0),
    7: (n) => Math.sqrt(variance(n, true)),
    8: (n) => Math.sqrt(variance(n, false)),
    9: (n) => sum(n),
    10: (n) => variance(n, true),
    11: (n) => variance(n, false),
    12: (n) => median(n),
    13: (n) => modeSngl(n),
};
const AGG_K_FUNCS = {
    14: (n, k) => kth(n, k, true),
    15: (n, k) => kth(n, k, false),
    16: (n, k) => percentileInc(n, k),
    17: (n, k) => { if (k < 0 || k > 4) throw err(ERR.NUM); return percentileInc(n, Math.floor(k) / 4); },
    18: (n, k) => percentileExc(n, k),
    19: (n, k) => { if (k <= 0 || k >= 4) throw err(ERR.NUM); return percentileExc(n, Math.floor(k) / 4); },
};

// ---------------------------------------------------------------------------
// Text helpers

const findAllDelims = (text, delims, caseInsensitive) => {
    const hay = caseInsensitive ? text.toLowerCase() : text;
    const found = [];
    let i = 0;
    while (i <= text.length) {
        let hit = null;
        for (const d of delims) {
            if (d === "") continue;
            const needle = caseInsensitive ? d.toLowerCase() : d;
            if (hay.startsWith(needle, i) && (!hit || d.length > hit.length)) hit = d;
        }
        if (hit) { found.push({ start: i, end: i + hit.length }); i += hit.length; }
        else i++;
    }
    return found;
};
const delimList = (arg) => collectValues([arg]).map((v) => toText(v));

const textBeforeAfter = (args, after) => {
    const [textArg, delimArg, instArg, modeArg, endArg, notFoundArg] = args;
    const text = toText(toScalar(textArg));
    const delims = delimList(delimArg);
    const instance = optInt(instArg, 1);
    const caseInsensitive = optNum(modeArg, 0) === 1;
    const matchEnd = optNum(endArg, 0) === 1;
    if (instance === 0 || Math.abs(instance) > text.length + 1) throw err(ERR.VALUE);
    if (delims.every((d) => d === "")) return instance > 0 ? (after ? text : "") : (after ? "" : text);
    const hits = findAllDelims(text, delims, caseInsensitive);
    if (matchEnd) {
        if (instance > 0) hits.push({ start: text.length, end: text.length });
        else hits.unshift({ start: 0, end: 0 });
    }
    const hit = instance > 0 ? hits[instance - 1] : hits[hits.length + instance];
    if (!hit) {
        if (!isMissing(notFoundArg)) return notFoundArg;
        throw err(ERR.NA);
    }
    return after ? text.slice(hit.end) : text.slice(0, hit.start);
};

const proper = (s) => s.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (m, pre, ch) => pre + ch.toUpperCase());

// ---------------------------------------------------------------------------
// Sorting helpers (SORT / SORTBY / UNIQUE)

const sortRowsBy = (rows, keys) => rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
        for (const { values, order } of keys) {
            const va = values[a.i], vb = values[b.i];
            // Blanks sort last regardless of direction, like Excel.
            if (va === null && vb !== null) return 1;
            if (vb === null && va !== null) return -1;
            const cmp = compareValues(va, vb);
            if (cmp !== 0) return cmp * order;
        }
        return a.i - b.i;
    })
    .map((x) => x.row);

const rowKey = (row) => row.map((v) => (typeof v === "string" ? `s:${v.toLowerCase()}` : `${typeof v}:${v instanceof FormulaError ? v.code : v}`)).join("\u0001");

// ---------------------------------------------------------------------------
// The library

const numberFn = (impl) => ({ min: 1, max: 1, lift: true, fn: ([x]) => impl(toNumber(x)) });

export const FUNCTIONS = {
    // ---- Math & arithmetic ----
    SUM: { min: 0, max: 255, refs: true, fn: (args) => sum(collectNumbers(args)) },
    PRODUCT: { min: 1, max: 255, refs: true, fn: (args) => { const n = collectNumbers(args); return n.length ? n.reduce((a, b) => a * b, 1) : 0; } },
    SUMPRODUCT: {
        min: 1, max: 255, fn: (args) => {
            const ms = args.map(asMatrix);
            const { height, width } = ms[0];
            if (ms.some((m) => m.height !== height || m.width !== width)) throw err(ERR.VALUE);
            let total = 0;
            for (let r = 0; r < height; r++) {
                for (let c = 0; c < width; c++) {
                    // Non-numbers (text, blanks, and even TRUE/FALSE) count as 0 —
                    // hence the familiar --(A1:A9>5) idiom to turn tests into 1/0.
                    let p = 1;
                    for (const m of ms) {
                        const v = failIfError(m.rows[r][c]);
                        p *= typeof v === "number" ? v : 0;
                    }
                    total += p;
                }
            }
            return total;
        },
    },
    SUMSQ: { min: 1, max: 255, refs: true, fn: (args) => sum(collectNumbers(args).map((x) => x * x)) },
    ABS: numberFn(Math.abs),
    SIGN: numberFn(Math.sign),
    INT: numberFn(Math.floor),
    SQRT: numberFn((x) => { if (x < 0) throw err(ERR.NUM); return Math.sqrt(x); }),
    EXP: numberFn(Math.exp),
    LN: numberFn((x) => { if (x <= 0) throw err(ERR.NUM); return Math.log(x); }),
    LOG10: numberFn((x) => { if (x <= 0) throw err(ERR.NUM); return Math.log10(x); }),
    LOG: {
        min: 1, max: 2, lift: true, fn: ([x, b]) => {
            const n = toNumber(x), base = optNum(b, 10);
            if (n <= 0 || base <= 0) throw err(ERR.NUM);
            if (base === 1) throw err(ERR.DIV0);
            return Math.log(n) / Math.log(base);
        },
    },
    PI: { min: 0, max: 0, fn: () => Math.PI },
    POWER: {
        min: 2, max: 2, lift: true, fn: ([a, b]) => {
            const x = toNumber(a), y = toNumber(b);
            if (x === 0 && y < 0) throw err(ERR.DIV0);
            const r = Math.pow(x, y);
            if (!isFinite(r)) throw err(ERR.NUM);
            return r;
        },
    },
    MOD: {
        min: 2, max: 2, lift: true, fn: ([a, b]) => {
            const n = toNumber(a), d = toNumber(b);
            if (d === 0) throw err(ERR.DIV0);
            return fixFloat(n - d * Math.floor(n / d));
        },
    },
    QUOTIENT: {
        min: 2, max: 2, lift: true, fn: ([a, b]) => {
            const d = toNumber(b);
            if (d === 0) throw err(ERR.DIV0);
            return Math.trunc(toNumber(a) / d);
        },
    },
    ROUND: { min: 2, max: 2, lift: true, fn: ([x, d]) => roundHalfAway(toNumber(x), toInt(d)) },
    ROUNDUP: {
        min: 2, max: 2, lift: true, fn: ([x, d]) => {
            const n = toNumber(x), f = Math.pow(10, toInt(d));
            return Math.sign(n) * Math.ceil(fixFloat(Math.abs(n) * f)) / f;
        },
    },
    ROUNDDOWN: {
        min: 2, max: 2, lift: true, fn: ([x, d]) => {
            const n = toNumber(x), f = Math.pow(10, toInt(d));
            return Math.sign(n) * Math.floor(fixFloat(Math.abs(n) * f)) / f;
        },
    },
    TRUNC: {
        min: 1, max: 2, lift: true, fn: ([x, d]) => {
            const n = toNumber(x), f = Math.pow(10, optInt(d, 0));
            return Math.trunc(fixFloat(n * f)) / f;
        },
    },
    MROUND: {
        min: 2, max: 2, lift: true, fn: ([x, m]) => {
            const n = toNumber(x), mult = toNumber(m);
            if (mult === 0) return 0;
            if (n !== 0 && Math.sign(n) !== Math.sign(mult)) throw err(ERR.NUM);
            return fixFloat(roundHalfAway(n / mult) * mult);
        },
    },
    CEILING: {
        min: 1, max: 2, lift: true, fn: ([x, s]) => {
            const n = toNumber(x), sig = optNum(s, 1);
            if (sig === 0) return 0;
            if (n > 0 && sig < 0) throw err(ERR.NUM);
            return fixFloat(Math.ceil(fixFloat(n / sig)) * sig);
        },
    },
    "CEILING.MATH": {
        min: 1, max: 3, lift: true, fn: ([x, s, mode]) => {
            const n = toNumber(x), sig = Math.abs(optNum(s, 1));
            if (sig === 0) return 0;
            const away = n < 0 && optNum(mode, 0) !== 0;
            return fixFloat((away ? Math.floor(fixFloat(n / sig)) : Math.ceil(fixFloat(n / sig))) * sig);
        },
    },
    FLOOR: {
        min: 1, max: 2, lift: true, fn: ([x, s]) => {
            const n = toNumber(x), sig = optNum(s, 1);
            if (sig === 0) throw err(ERR.DIV0);
            if (n > 0 && sig < 0) throw err(ERR.NUM);
            return fixFloat(Math.floor(fixFloat(n / sig)) * sig);
        },
    },
    "FLOOR.MATH": {
        min: 1, max: 3, lift: true, fn: ([x, s, mode]) => {
            const n = toNumber(x), sig = Math.abs(optNum(s, 1));
            if (sig === 0) return 0;
            const toward = n < 0 && optNum(mode, 0) !== 0;
            return fixFloat((toward ? Math.ceil(fixFloat(n / sig)) : Math.floor(fixFloat(n / sig))) * sig);
        },
    },
    EVEN: numberFn((x) => { const r = Math.ceil(Math.abs(x) / 2) * 2; return x < 0 ? -r : r; }),
    ODD: numberFn((x) => { let r = Math.ceil(Math.abs(x)); if (r % 2 === 0) r += 1; return x < 0 ? -r : r; }),
    RAND: { min: 0, max: 0, volatile: true, fn: (args, ctx) => ctx.random() },
    RANDBETWEEN: {
        min: 2, max: 2, volatile: true, fn: ([a, b], ctx) => {
            const lo = Math.ceil(toNumber(a)), hi = Math.floor(toNumber(b));
            if (lo > hi) throw err(ERR.NUM);
            return lo + Math.floor(ctx.random() * (hi - lo + 1));
        },
    },
    FACT: numberFn((x) => factorial(Math.trunc(x))),
    COMBIN: { min: 2, max: 2, lift: true, fn: ([n, k]) => combin(toInt(n), toInt(k)) },
    PERMUT: {
        min: 2, max: 2, lift: true, fn: ([n, k]) => {
            const nn = toInt(n), kk = toInt(k);
            if (nn < 0 || kk < 0 || kk > nn) throw err(ERR.NUM);
            let r = 1;
            for (let i = nn - kk + 1; i <= nn; i++) r *= i;
            return r;
        },
    },
    GCD: {
        min: 1, max: 255, refs: true, fn: (args) => {
            const nums = collectNumbers(args).map(Math.trunc);
            if (nums.some((x) => x < 0)) throw err(ERR.NUM);
            return nums.reduce((a, b) => gcd2(a, b), 0);
        },
    },
    LCM: {
        min: 1, max: 255, refs: true, fn: (args) => {
            const nums = collectNumbers(args).map(Math.trunc);
            if (nums.some((x) => x < 0)) throw err(ERR.NUM);
            if (nums.some((x) => x === 0)) return 0;
            return nums.reduce((a, b) => (a * b) / gcd2(a, b), 1);
        },
    },

    // ---- Statistical ----
    COUNT: {
        min: 0, max: 255, refs: true, fn: (args) => {
            let count = 0;
            for (const arg of args) {
                forEachValue(arg, (v, fromRef) => {
                    if (typeof v === "number") count++;
                    else if (!fromRef && (typeof v === "boolean" || (typeof v === "string" && parseNumericText(v) !== null))) count++;
                });
            }
            return count;
        },
    },
    COUNTA: { min: 1, max: 255, refs: true, fn: (args) => collectValues(args).filter((v) => v !== null).length },
    COUNTBLANK: { min: 1, max: 1, refs: true, fn: ([r]) => collectValues([r]).filter((v) => v === null || v === "").length },
    COUNTIF: {
        min: 2, max: 2, refs: true, lift: [1], fn: ([range, crit]) => matchingPositions([[range, crit]]).positions.length,
    },
    COUNTIFS: {
        min: 2, max: 254, refs: true, fn: (args) => matchingPositions(ifsPairs(args, 0)).positions.length,
    },
    SUMIF: {
        min: 2, max: 3, refs: true, lift: [1], fn: ([range, crit, sumRange]) => {
            const { positions, shape } = matchingPositions([[range, crit]]);
            return sum(numbersAt(isMissing(sumRange) ? range : sumRange, positions, shape));
        },
    },
    SUMIFS: {
        min: 3, max: 255, refs: true, fn: ([sumRange, ...rest]) => {
            const { positions, shape } = matchingPositions(ifsPairs(rest, 0));
            return sum(numbersAt(sumRange, positions, shape));
        },
    },
    AVERAGE: { min: 1, max: 255, refs: true, fn: (args) => mean(collectNumbers(args)) },
    AVG: { min: 1, max: 255, refs: true, fn: (args) => mean(collectNumbers(args)) },
    AVERAGEA: {
        min: 1, max: 255, refs: true, fn: (args) => mean(collectValues(args).filter((v) => v !== null).map((v) => {
            failIfError(v);
            return typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : 0;
        })),
    },
    AVERAGEIF: {
        min: 2, max: 3, refs: true, lift: [1], fn: ([range, crit, avgRange]) => {
            const { positions, shape } = matchingPositions([[range, crit]]);
            return mean(numbersAt(isMissing(avgRange) ? range : avgRange, positions, shape));
        },
    },
    AVERAGEIFS: {
        min: 3, max: 255, refs: true, fn: ([avgRange, ...rest]) => {
            const { positions, shape } = matchingPositions(ifsPairs(rest, 0));
            return mean(numbersAt(avgRange, positions, shape));
        },
    },
    MAXIFS: {
        min: 3, max: 255, refs: true, fn: ([maxRange, ...rest]) => {
            const { positions, shape } = matchingPositions(ifsPairs(rest, 0));
            const n = numbersAt(maxRange, positions, shape);
            return n.length ? Math.max(...n) : 0;
        },
    },
    MINIFS: {
        min: 3, max: 255, refs: true, fn: ([minRange, ...rest]) => {
            const { positions, shape } = matchingPositions(ifsPairs(rest, 0));
            const n = numbersAt(minRange, positions, shape);
            return n.length ? Math.min(...n) : 0;
        },
    },
    MEDIAN: { min: 1, max: 255, refs: true, fn: (args) => median(collectNumbers(args)) },
    "MODE.SNGL": { min: 1, max: 255, refs: true, fn: (args) => modeSngl(collectNumbers(args)) },
    MODE: { min: 1, max: 255, refs: true, fn: (args) => modeSngl(collectNumbers(args)) },
    MIN: { min: 1, max: 255, refs: true, fn: (args) => { const n = collectNumbers(args); return n.length ? Math.min(...n) : 0; } },
    MAX: { min: 1, max: 255, refs: true, fn: (args) => { const n = collectNumbers(args); return n.length ? Math.max(...n) : 0; } },
    LARGE: { min: 2, max: 2, refs: true, lift: [1], fn: ([arr, k]) => kth(collectNumbers([arr]), toNumber(k), true) },
    SMALL: { min: 2, max: 2, refs: true, lift: [1], fn: ([arr, k]) => kth(collectNumbers([arr]), toNumber(k), false) },
    "RANK.EQ": {
        min: 2, max: 3, refs: true, lift: [0], fn: ([n, ref, order]) => {
            const x = toNumber(n);
            const nums = collectNumbers([ref]);
            if (!nums.includes(x)) throw err(ERR.NA);
            const asc = optNum(order, 0) !== 0;
            return 1 + nums.filter((v) => (asc ? v < x : v > x)).length;
        },
    },
    "PERCENTILE.INC": { min: 2, max: 2, refs: true, lift: [1], fn: ([arr, k]) => percentileInc(collectNumbers([arr]), toNumber(k)) },
    "PERCENTILE.EXC": { min: 2, max: 2, refs: true, lift: [1], fn: ([arr, k]) => percentileExc(collectNumbers([arr]), toNumber(k)) },
    "QUARTILE.INC": {
        min: 2, max: 2, refs: true, lift: [1], fn: ([arr, q]) => {
            const quart = Math.trunc(toNumber(q));
            if (quart < 0 || quart > 4) throw err(ERR.NUM);
            return percentileInc(collectNumbers([arr]), quart / 4);
        },
    },
    "STDEV.S": { min: 1, max: 255, refs: true, fn: (args) => Math.sqrt(variance(collectNumbers(args), true)) },
    "STDEV.P": { min: 1, max: 255, refs: true, fn: (args) => Math.sqrt(variance(collectNumbers(args), false)) },
    "VAR.S": { min: 1, max: 255, refs: true, fn: (args) => variance(collectNumbers(args), true) },
    "VAR.P": { min: 1, max: 255, refs: true, fn: (args) => variance(collectNumbers(args), false) },
    CORREL: {
        min: 2, max: 2, fn: ([a, b]) => {
            const [xs, ys] = pairedNumbers(a, b);
            const sx = Math.sqrt(covariance(xs, xs, false)), sy = Math.sqrt(covariance(ys, ys, false));
            if (sx === 0 || sy === 0) throw err(ERR.DIV0);
            return covariance(xs, ys, false) / (sx * sy);
        },
    },
    "COVARIANCE.P": { min: 2, max: 2, fn: ([a, b]) => covariance(...pairedNumbers(a, b), false) },
    "COVARIANCE.S": { min: 2, max: 2, fn: ([a, b]) => covariance(...pairedNumbers(a, b), true) },

    // ---- Logical ----
    IF: {
        min: 1, max: 3, lazy: true, fn: (nodes, ctx, evaluate) => {
            const cond = evaluate(nodes[0]);
            const branch = (i, dflt) => (nodes[i] && nodes[i].type !== "empty" ? evaluate(nodes[i]) : nodes[i] ? 0 : dflt);
            if (cond instanceof Matrix) {
                const yes = branch(1, true), no = branch(2, false);
                return ctx.broadcast([cond, yes, no], ([c, y, n]) => (c instanceof FormulaError ? c : toBool(c) ? y : n));
            }
            if (cond instanceof FormulaError) return cond;
            return toBool(cond) ? branch(1, true) : branch(2, false);
        },
    },
    IFS: {
        min: 2, max: 254, lazy: true, fn: (nodes, ctx, evaluate) => {
            if (nodes.length % 2 !== 0) throw err(ERR.VALUE);
            for (let i = 0; i < nodes.length; i += 2) {
                const cond = toScalar(evaluate(nodes[i]));
                if (cond instanceof FormulaError) return cond;
                if (toBool(cond)) return evaluate(nodes[i + 1]);
            }
            throw err(ERR.NA);
        },
    },
    SWITCH: {
        min: 3, max: 254, lazy: true, fn: (nodes, ctx, evaluate) => {
            const target = toScalar(evaluate(nodes[0]));
            if (target instanceof FormulaError) return target;
            let i = 1;
            for (; i + 1 < nodes.length; i += 2) {
                const candidate = toScalar(evaluate(nodes[i]));
                if (compareValues(candidate, target) === 0 && typeof candidate === typeof target) return evaluate(nodes[i + 1]);
            }
            if (i < nodes.length) return evaluate(nodes[i]);
            throw err(ERR.NA);
        },
    },
    CHOOSE: {
        min: 2, max: 255, lazy: true, fn: (nodes, ctx, evaluate) => {
            const idx = evaluate(nodes[0]);
            if (idx instanceof Matrix) {
                const options = nodes.slice(1).map((n) => evaluate(n));
                return idx.map((v) => {
                    if (v instanceof FormulaError) return v;
                    const i = Math.trunc(toNumber(v));
                    if (i < 1 || i > options.length) return err(ERR.VALUE);
                    return toScalar(options[i - 1]);
                });
            }
            const i = Math.trunc(toNumber(idx));
            if (i < 1 || i >= nodes.length) throw err(ERR.VALUE);
            return evaluate(nodes[i]);
        },
    },
    AND: {
        min: 1, max: 255, refs: true, fn: (args) => {
            const bools = collectLogicals(args);
            return bools.every(Boolean);
        },
    },
    OR: { min: 1, max: 255, refs: true, fn: (args) => collectLogicals(args).some(Boolean) },
    XOR: { min: 1, max: 255, refs: true, fn: (args) => collectLogicals(args).filter(Boolean).length % 2 === 1 },
    NOT: { min: 1, max: 1, lift: true, fn: ([v]) => !toBool(v) },
    TRUE: { min: 0, max: 0, fn: () => true },
    FALSE: { min: 0, max: 0, fn: () => false },
    IFERROR: {
        min: 2, max: 2, lazy: true, fn: (nodes, ctx, evaluate) => {
            const v = evaluate(nodes[0]);
            if (v instanceof Matrix) {
                const alt = evaluate(nodes[1]);
                return ctx.broadcast([v, alt], ([x, a]) => (x instanceof FormulaError ? a : x));
            }
            return v instanceof FormulaError ? evaluate(nodes[1]) : v;
        },
    },
    IFNA: {
        min: 2, max: 2, lazy: true, fn: (nodes, ctx, evaluate) => {
            const v = evaluate(nodes[0]);
            const isNA = (x) => x instanceof FormulaError && x.code === ERR.NA;
            if (v instanceof Matrix) {
                const alt = evaluate(nodes[1]);
                return ctx.broadcast([v, alt], ([x, a]) => (isNA(x) ? a : x));
            }
            return isNA(v) ? evaluate(nodes[1]) : v;
        },
    },
    NA: { min: 0, max: 0, fn: () => { throw err(ERR.NA); } },

    // ---- Information ----
    ISBLANK: { min: 1, max: 1, lift: true, acceptsErrors: true, fn: ([v]) => v === null },
    ISNUMBER: { min: 1, max: 1, lift: true, acceptsErrors: true, fn: ([v]) => typeof v === "number" },
    ISTEXT: { min: 1, max: 1, lift: true, acceptsErrors: true, fn: ([v]) => typeof v === "string" },
    ISNONTEXT: { min: 1, max: 1, lift: true, acceptsErrors: true, fn: ([v]) => typeof v !== "string" },
    ISLOGICAL: { min: 1, max: 1, lift: true, acceptsErrors: true, fn: ([v]) => typeof v === "boolean" },
    ISERROR: { min: 1, max: 1, lift: true, acceptsErrors: true, fn: ([v]) => v instanceof FormulaError },
    ISERR: { min: 1, max: 1, lift: true, acceptsErrors: true, fn: ([v]) => v instanceof FormulaError && v.code !== ERR.NA },
    ISNA: { min: 1, max: 1, lift: true, acceptsErrors: true, fn: ([v]) => v instanceof FormulaError && v.code === ERR.NA },
    ISEVEN: { min: 1, max: 1, lift: true, fn: ([v]) => Math.trunc(toNumber(v)) % 2 === 0 },
    ISODD: { min: 1, max: 1, lift: true, fn: ([v]) => Math.abs(Math.trunc(toNumber(v))) % 2 === 1 },
    TYPE: {
        min: 1, max: 1, acceptsErrors: true, fn: ([v]) => {
            if (v instanceof Matrix) return v.height * v.width === 1 && v.origin ? typeCode(v.rows[0][0]) : 64;
            return typeCode(v);
        },
    },
    CELL: {
        min: 1, max: 2, refs: true, fn: ([infoArg, ref], ctx) => {
            const info = toText(toScalar(infoArg)).toLowerCase();
            const target = ref instanceof Matrix && ref.origin ? ref : null;
            const row = target ? target.origin.row : ctx.row, col = target ? target.origin.col : ctx.col;
            const value = target ? target.rows[0][0] : ctx.valueAt(row, col);
            switch (info) {
                case "address": return `$${ctx.colName(col)}$${row + 1}`;
                case "row": return row + 1;
                case "col": return col + 1;
                case "contents": return failIfError(value) ?? 0;
                case "type": return value === null ? "b" : typeof value === "string" ? "l" : "v";
                case "filename": return "";
                default: throw err(ERR.VALUE);
            }
        },
    },
    ROW: {
        min: 0, max: 1, refs: true, fn: ([ref], ctx) => {
            if (isMissing(ref)) return ctx.row + 1;
            if (!(ref instanceof Matrix) || !ref.origin) throw err(ERR.VALUE);
            return ref.height === 1 ? ref.origin.row + 1 : Matrix.fromColumn(Array.from({ length: ref.height }, (_, i) => ref.origin.row + i + 1));
        },
    },
    COLUMN: {
        min: 0, max: 1, refs: true, fn: ([ref], ctx) => {
            if (isMissing(ref)) return ctx.col + 1;
            if (!(ref instanceof Matrix) || !ref.origin) throw err(ERR.VALUE);
            return ref.width === 1 ? ref.origin.col + 1 : new Matrix([Array.from({ length: ref.width }, (_, i) => ref.origin.col + i + 1)]);
        },
    },
    ROWS: { min: 1, max: 1, refs: true, fn: ([r]) => asMatrix(r).height },
    COLUMNS: { min: 1, max: 1, refs: true, fn: ([r]) => asMatrix(r).width },

    // ---- Lookup & reference ----
    VLOOKUP: {
        min: 3, max: 4, lift: [0], fn: ([value, table, colArg, approxArg]) => {
            const m = asMatrix(table);
            const col = toInt(colArg);
            if (col < 1) throw err(ERR.VALUE);
            if (col > m.width) throw err(ERR.REF);
            const firstCol = m.rows.map((row) => row[0]);
            const lookup = failIfError(toScalar(value));
            const idx = optBool(approxArg, true) ? sortedMatchIndex(lookup, firstCol, false) : xmatchIndex(lookup, firstCol, 2);
            if (idx === -1) throw err(ERR.NA);
            return m.rows[idx][col - 1];
        },
    },
    HLOOKUP: {
        min: 3, max: 4, lift: [0], fn: ([value, table, rowArg, approxArg]) => {
            const m = asMatrix(table);
            const row = toInt(rowArg);
            if (row < 1) throw err(ERR.VALUE);
            if (row > m.height) throw err(ERR.REF);
            const lookup = failIfError(toScalar(value));
            const idx = optBool(approxArg, true) ? sortedMatchIndex(lookup, m.rows[0], false) : xmatchIndex(lookup, m.rows[0], 2);
            if (idx === -1) throw err(ERR.NA);
            return m.rows[row - 1][idx];
        },
    },
    INDEX: {
        min: 2, max: 3, refs: true, fn: ([arr, rowArg, colArg]) => {
            const m = asMatrix(arr);
            let row = optInt(rowArg, 0), col = optInt(colArg, 0);
            // A single row/column accepts one index along its length.
            if (isMissing(colArg) && m.height === 1 && m.width > 1) { col = row; row = 1; }
            if (row < 0 || col < 0 || row > m.height || col > m.width) throw err(ERR.REF);
            if (row === 0 && col === 0) return m;
            if (row === 0) return new Matrix(m.rows.map((r) => [r[col - 1]]), m.origin && { row: m.origin.row, col: m.origin.col + col - 1 });
            if (col === 0) {
                if (m.width === 1) return m.rows[row - 1][0];
                return new Matrix([m.rows[row - 1]], m.origin && { row: m.origin.row + row - 1, col: m.origin.col });
            }
            return m.rows[row - 1][col - 1];
        },
    },
    MATCH: {
        min: 2, max: 3, lift: [0], fn: ([value, arr, typeArg_]) => {
            const values = vectorOf(arr);
            const lookup = failIfError(toScalar(value));
            const type = optNum(typeArg_, 1);
            const idx = type === 0 ? xmatchIndex(lookup, values, 2) : sortedMatchIndex(lookup, values, type < 0);
            if (idx === -1) throw err(ERR.NA);
            return idx + 1;
        },
    },
    XMATCH: {
        min: 2, max: 4, lift: [0], fn: ([value, arr, modeArg, searchArg]) => {
            const values = vectorOf(arr);
            const mode = optInt(modeArg, 0), search = optInt(searchArg, 1);
            if (![0, -1, 1, 2].includes(mode) || ![1, -1, 2, -2].includes(search)) throw err(ERR.VALUE);
            const idx = xmatchIndex(failIfError(toScalar(value)), values, mode, search < 0);
            if (idx === -1) throw err(ERR.NA);
            return idx + 1;
        },
    },
    XLOOKUP: {
        min: 3, max: 6, lift: [0], fn: ([value, lookupArr, returnArr, notFound, modeArg, searchArg]) => {
            const lm = asMatrix(lookupArr), rm = asMatrix(returnArr);
            const vertical = lm.width === 1;
            if (!vertical && lm.height !== 1) throw err(ERR.VALUE);
            if (vertical ? rm.height !== lm.height : rm.width !== lm.width) throw err(ERR.VALUE);
            const mode = optInt(modeArg, 0), search = optInt(searchArg, 1);
            const idx = xmatchIndex(failIfError(toScalar(value)), vectorOf(lm), mode, search < 0);
            if (idx === -1) {
                if (!isMissing(notFound)) return notFound;
                throw err(ERR.NA);
            }
            if (vertical) return rm.width === 1 ? rm.rows[idx][0] : new Matrix([rm.rows[idx]]);
            return rm.height === 1 ? rm.rows[0][idx] : Matrix.fromColumn(rm.rows.map((row) => row[idx]));
        },
    },
    FILTER: {
        min: 2, max: 3, fn: ([arr, include, ifEmpty]) => {
            const m = asMatrix(arr), inc = asMatrix(include);
            const keep = (v) => { failIfError(v); return toBool(v); };
            let result;
            if (inc.width === 1 && inc.height === m.height) {
                result = m.rows.filter((_, r) => keep(inc.rows[r][0]));
                result = result.length ? new Matrix(result) : null;
            } else if (inc.height === 1 && inc.width === m.width) {
                const cols = inc.rows[0].map((v, c) => (keep(v) ? c : -1)).filter((c) => c >= 0);
                result = cols.length ? sliceCols(m, cols) : null;
            } else {
                throw err(ERR.VALUE);
            }
            if (result) return result;
            if (!isMissing(ifEmpty)) return ifEmpty;
            throw err(ERR.CALC);
        },
    },
    SORT: {
        min: 1, max: 4, fn: ([arr, idxArg, orderArg, byColArg]) => {
            const m = asMatrix(arr);
            const byCol = optBool(byColArg, false);
            const idx = optInt(idxArg, 1), order = optNum(orderArg, 1) < 0 ? -1 : 1;
            const base = byCol ? transpose(m) : m;
            if (idx < 1 || idx > base.width) throw err(ERR.VALUE);
            const sorted = new Matrix(sortRowsBy(base.rows, [{ values: base.rows.map((row) => row[idx - 1]), order }]));
            return byCol ? transpose(sorted) : sorted;
        },
    },
    SORTBY: {
        min: 2, max: 255, fn: ([arr, ...rest]) => {
            const m = asMatrix(arr);
            const keys = [];
            for (let i = 0; i < rest.length; i += 2) {
                const by = asMatrix(rest[i]);
                const order = optNum(rest[i + 1], 1) < 0 ? -1 : 1;
                if (by.width === 1 && by.height === m.height) keys.push({ values: by.rows.map((row) => row[0]), order, byRow: true });
                else if (by.height === 1 && by.width === m.width) keys.push({ values: by.rows[0], order, byRow: false });
                else throw err(ERR.VALUE);
            }
            if (keys.every((k) => k.byRow)) return new Matrix(sortRowsBy(m.rows, keys));
            if (keys.every((k) => !k.byRow)) return transpose(new Matrix(sortRowsBy(transpose(m).rows, keys)));
            throw err(ERR.VALUE);
        },
    },
    UNIQUE: {
        min: 1, max: 3, fn: ([arr, byColArg, onceArg]) => {
            const m = asMatrix(arr);
            const byCol = optBool(byColArg, false), once = optBool(onceArg, false);
            const base = byCol ? transpose(m) : m;
            const counts = new Map();
            base.rows.forEach((row) => { const k = rowKey(row); counts.set(k, (counts.get(k) || 0) + 1); });
            const seen = new Set();
            const rows = base.rows.filter((row) => {
                const k = rowKey(row);
                if (seen.has(k)) return false;
                seen.add(k);
                return !once || counts.get(k) === 1;
            });
            if (!rows.length) throw err(ERR.CALC);
            const out = new Matrix(rows.map((row) => row.map((v) => (v === null ? 0 : v))));
            return byCol ? transpose(out) : out;
        },
    },
    SEQUENCE: {
        min: 1, max: 4, fn: ([rowsArg, colsArg, startArg, stepArg]) => {
            const rows = toInt(rowsArg), cols = optInt(colsArg, 1);
            const start = optNum(startArg, 1), step = optNum(stepArg, 1);
            if (rows < 1 || cols < 1) throw err(ERR.CALC);
            if (rows * cols > 1000000) throw err(ERR.NUM);
            return new Matrix(Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => fixFloat(start + (r * cols + c) * step))));
        },
    },
    TAKE: { min: 2, max: 3, fn: ([arr, r, c]) => takeDrop(arr, r, c, true) },
    DROP: { min: 2, max: 3, fn: ([arr, r, c]) => takeDrop(arr, r, c, false) },
    TRANSPOSE: { min: 1, max: 1, fn: ([arr]) => transpose(asMatrix(arr)) },
    CHOOSECOLS: { min: 2, max: 255, fn: ([arr, ...cols]) => { const m = asMatrix(arr); return sliceCols(m, resolveIndexes(cols, m.width)); } },
    CHOOSEROWS: { min: 2, max: 255, fn: ([arr, ...rows]) => { const m = asMatrix(arr); return sliceRows(m, resolveIndexes(rows, m.height)); } },
    VSTACK: { min: 1, max: 254, fn: (args) => stack(args, true) },
    HSTACK: { min: 1, max: 254, fn: (args) => stack(args, false) },

    // ---- Text ----
    LEFT: {
        min: 1, max: 2, lift: true, fn: ([t, n]) => {
            const count = optInt(n, 1);
            if (count < 0) throw err(ERR.VALUE);
            return toText(t).slice(0, count);
        },
    },
    RIGHT: {
        min: 1, max: 2, lift: true, fn: ([t, n]) => {
            const count = optInt(n, 1), s = toText(t);
            if (count < 0) throw err(ERR.VALUE);
            return count === 0 ? "" : s.slice(-count);
        },
    },
    MID: {
        min: 3, max: 3, lift: true, fn: ([t, start, n]) => {
            const s = toInt(start), count = toInt(n);
            if (s < 1 || count < 0) throw err(ERR.VALUE);
            return toText(t).substr(s - 1, count);
        },
    },
    LEN: { min: 1, max: 1, lift: true, fn: ([t]) => toText(t).length },
    TRIM: { min: 1, max: 1, lift: true, fn: ([t]) => toText(t).replace(/ +/g, " ").trim() },
    // Stripping control characters is CLEAN's whole job.
    // eslint-disable-next-line no-control-regex
    CLEAN: { min: 1, max: 1, lift: true, fn: ([t]) => toText(t).replace(/[\x00-\x1f]/g, "") },
    UPPER: { min: 1, max: 1, lift: true, fn: ([t]) => toText(t).toUpperCase() },
    LOWER: { min: 1, max: 1, lift: true, fn: ([t]) => toText(t).toLowerCase() },
    PROPER: { min: 1, max: 1, lift: true, fn: ([t]) => proper(toText(t)) },
    CONCAT: {
        min: 1, max: 255, refs: true, fn: (args) => collectValues(args).map((v) => toText(failIfError(v))).join(""),
    },
    CONCATENATE: { min: 1, max: 255, lift: true, fn: (args) => args.map((v) => toText(v)).join("") },
    TEXTJOIN: {
        min: 3, max: 255, refs: true, fn: ([delimArg, ignoreArg, ...rest]) => {
            const delims = delimList(delimArg);
            const ignoreEmpty = toBool(toScalar(ignoreArg));
            const parts = collectValues(rest).map((v) => toText(failIfError(v))).filter((s) => !ignoreEmpty || s !== "");
            return parts.reduce((acc, s, i) => (i === 0 ? s : acc + (delims.length ? delims[(i - 1) % delims.length] : "") + s), "");
        },
    },
    FIND: {
        min: 2, max: 3, lift: true, fn: ([find, within, start]) => {
            const needle = toText(find), hay = toText(within), s = optInt(start, 1);
            if (s < 1 || s > hay.length + 1) throw err(ERR.VALUE);
            const i = hay.indexOf(needle, s - 1);
            if (i === -1) throw err(ERR.VALUE);
            return i + 1;
        },
    },
    SEARCH: {
        min: 2, max: 3, lift: true, fn: ([find, within, start]) => {
            const needle = toText(find), hay = toText(within), s = optInt(start, 1);
            if (s < 1 || s > hay.length + 1) throw err(ERR.VALUE);
            const re = new RegExp(hasWildcards(needle) || needle.includes("~") ? wildcardToRegexSource(needle) : needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            const m = re.exec(hay.slice(s - 1));
            if (!m) throw err(ERR.VALUE);
            return m.index + s;
        },
    },
    SUBSTITUTE: {
        min: 3, max: 4, lift: true, fn: ([t, oldArg, newArg, instArg]) => {
            const s = toText(t), oldText = toText(oldArg), newText = toText(newArg);
            if (oldText === "") return s;
            if (isMissing(instArg)) return s.split(oldText).join(newText);
            const instance = toInt(instArg);
            if (instance < 1) throw err(ERR.VALUE);
            let idx = -1;
            for (let i = 0; i < instance; i++) {
                idx = s.indexOf(oldText, idx + 1);
                if (idx === -1) return s;
            }
            return s.slice(0, idx) + newText + s.slice(idx + oldText.length);
        },
    },
    REPLACE: {
        min: 4, max: 4, lift: true, fn: ([t, start, n, newArg]) => {
            const s = toText(t), st = toInt(start), count = toInt(n);
            if (st < 1 || count < 0) throw err(ERR.VALUE);
            return s.slice(0, st - 1) + toText(newArg) + s.slice(st - 1 + count);
        },
    },
    EXACT: { min: 2, max: 2, lift: true, fn: ([a, b]) => toText(a) === toText(b) },
    REPT: {
        min: 2, max: 2, lift: true, fn: ([t, n]) => {
            const count = toInt(n);
            if (count < 0 || count * toText(t).length > 32767) throw err(ERR.VALUE);
            return toText(t).repeat(count);
        },
    },
    CHAR: {
        min: 1, max: 1, lift: true, fn: ([n]) => {
            const code = toInt(n);
            if (code < 1 || code > 255) throw err(ERR.VALUE);
            return String.fromCharCode(code);
        },
    },
    CODE: {
        min: 1, max: 1, lift: true, fn: ([t]) => {
            const s = toText(t);
            if (!s) throw err(ERR.VALUE);
            return s.charCodeAt(0);
        },
    },
    TEXT: { min: 2, max: 2, lift: true, fn: ([v, fmt]) => formatWithPattern(v, toText(fmt)) },
    VALUE: {
        min: 1, max: 1, lift: true, fn: ([v]) => {
            if (typeof v === "number") return v;
            if (v === null) return 0;
            if (typeof v === "boolean") throw err(ERR.VALUE);
            const n = parseNumericText(v);
            if (n === null) throw err(ERR.VALUE);
            return n;
        },
    },
    NUMBERVALUE: {
        min: 1, max: 3, lift: [0], fn: ([v, decArg, groupArg]) => {
            let s = toText(v);
            const dec = isMissing(decArg) ? "." : toText(decArg)[0], group = isMissing(groupArg) ? "," : toText(groupArg)[0];
            s = s.split(group).join("").replace(dec, ".");
            const n = parseNumericText(s);
            if (n === null) throw err(ERR.VALUE);
            return n;
        },
    },
    TEXTBEFORE: { min: 2, max: 6, fn: (args) => textBeforeAfter(args, false) },
    TEXTAFTER: { min: 2, max: 6, fn: (args) => textBeforeAfter(args, true) },
    TEXTSPLIT: {
        min: 2, max: 6, fn: ([textArg, colArg, rowArg, ignoreArg, modeArg, padArg]) => {
            const text = toText(toScalar(textArg));
            const colDelims = isMissing(colArg) ? [] : delimList(colArg).filter((d) => d !== "");
            const rowDelims = isMissing(rowArg) ? [] : delimList(rowArg).filter((d) => d !== "");
            if (!colDelims.length && !rowDelims.length) throw err(ERR.VALUE);
            const ignoreEmpty = optBool(ignoreArg, false), ci = optNum(modeArg, 0) === 1;
            const pad = isMissing(padArg) ? err(ERR.NA) : padArg;
            const split = (s, delims) => {
                if (!delims.length) return [s];
                const parts = [];
                let last = 0;
                for (const h of findAllDelims(s, delims, ci)) { parts.push(s.slice(last, h.start)); last = h.end; }
                parts.push(s.slice(last));
                return ignoreEmpty ? parts.filter((p) => p !== "") : parts;
            };
            const rows = split(text, rowDelims).map((line) => split(line, colDelims));
            const width = Math.max(1, ...rows.map((r) => r.length));
            const filled = rows.map((r) => [...r, ...Array(width - r.length).fill(pad)]);
            return new Matrix(filled.length ? filled : [[""]]);
        },
    },

    // ---- Date & time ----
    TODAY: { min: 0, max: 0, volatile: true, fn: (args, ctx) => Math.floor(ctx.now) },
    NOW: { min: 0, max: 0, volatile: true, fn: (args, ctx) => ctx.now },
    DATE: {
        min: 3, max: 3, lift: true, fn: ([y, m, d]) => {
            let year = toInt(y);
            if (year >= 0 && year < 1900) year += 1900;
            if (year < 0 || year > 9999) throw err(ERR.NUM);
            const serial = dateToSerial(year, toInt(m), toInt(d));
            if (serial < 0) throw err(ERR.NUM);
            return serial;
        },
    },
    TIME: {
        min: 3, max: 3, lift: true, fn: ([h, m, s]) => {
            const secs = toInt(h) * 3600 + toInt(m) * 60 + toInt(s);
            if (secs < 0) throw err(ERR.NUM);
            return (secs % 86400) / 86400;
        },
    },
    DATEVALUE: {
        min: 1, max: 1, lift: true, fn: ([t]) => {
            const n = parseDateTimeText(toText(t));
            if (n === null || n < 1) throw err(ERR.VALUE);
            return Math.floor(n);
        },
    },
    TIMEVALUE: {
        min: 1, max: 1, lift: true, fn: ([t]) => {
            const n = parseDateTimeText(toText(t));
            if (n === null) throw err(ERR.VALUE);
            return n - Math.floor(n);
        },
    },
    DAY: { min: 1, max: 1, lift: true, fn: ([d]) => serialToParts(toDate(d)).day },
    MONTH: { min: 1, max: 1, lift: true, fn: ([d]) => serialToParts(toDate(d)).month },
    YEAR: { min: 1, max: 1, lift: true, fn: ([d]) => serialToParts(toDate(d)).year },
    HOUR: { min: 1, max: 1, lift: true, fn: ([d]) => serialToParts(toSerial(d)).hour },
    MINUTE: { min: 1, max: 1, lift: true, fn: ([d]) => serialToParts(toSerial(d)).minute },
    SECOND: { min: 1, max: 1, lift: true, fn: ([d]) => serialToParts(toSerial(d)).second },
    WEEKDAY: { min: 1, max: 2, lift: true, fn: ([d, t]) => weekday(d, optInt(t, 1)) },
    WEEKNUM: { min: 1, max: 2, lift: true, fn: ([d, t]) => weekNum(d, optInt(t, 1)) },
    ISOWEEKNUM: { min: 1, max: 1, lift: true, fn: ([d]) => isoWeekNum(toDate(d)) },
    EDATE: { min: 2, max: 2, lift: true, fn: ([d, m]) => addMonths(toDate(d), toInt(m), false) },
    EOMONTH: { min: 2, max: 2, lift: true, fn: ([d, m]) => addMonths(toDate(d), toInt(m), true) },
    DAYS: { min: 2, max: 2, lift: true, fn: ([end, start]) => toDate(end) - toDate(start) },
    DATEDIF: { min: 3, max: 3, lift: true, fn: ([s, e, u]) => datedif(s, e, u) },
    NETWORKDAYS: { min: 2, max: 3, fn: ([s, e, h]) => networkDays(toScalar(s), toScalar(e), weekendMask(MISSING), holidaySet(h)) },
    "NETWORKDAYS.INTL": { min: 2, max: 4, fn: ([s, e, w, h]) => networkDays(toScalar(s), toScalar(e), weekendMask(w), holidaySet(h)) },
    WORKDAY: { min: 2, max: 3, fn: ([s, d, h]) => workday(toScalar(s), toScalar(d), weekendMask(MISSING), holidaySet(h)) },
    "WORKDAY.INTL": { min: 2, max: 4, fn: ([s, d, w, h]) => workday(toScalar(s), toScalar(d), weekendMask(w), holidaySet(h)) },

    // ---- Financial ----
    PMT: { min: 3, max: 5, lift: true, fn: ([r, n, pv, fv, t]) => pmtCalc(toNumber(r), toNumber(n), toNumber(pv), optNum(fv, 0), typeArg(t)) },
    PV: { min: 3, max: 5, lift: true, fn: ([r, n, pmt, fv, t]) => pvCalc(toNumber(r), toNumber(n), toNumber(pmt), optNum(fv, 0), typeArg(t)) },
    FV: { min: 3, max: 5, lift: true, fn: ([r, n, pmt, pv, t]) => fvCalc(toNumber(r), toNumber(n), toNumber(pmt), optNum(pv, 0), typeArg(t)) },
    NPER: {
        min: 3, max: 5, lift: true, fn: ([rArg, pmtArg, pvArg, fvArg, t]) => {
            const r = toNumber(rArg), pmt = toNumber(pmtArg), pv = toNumber(pvArg), fv = optNum(fvArg, 0), type = typeArg(t);
            if (r === 0) {
                if (pmt === 0) throw err(ERR.NUM);
                return -(pv + fv) / pmt;
            }
            const num = pmt * (1 + r * type) - fv * r, den = pv * r + pmt * (1 + r * type);
            if (den === 0 || num / den <= 0) throw err(ERR.NUM);
            return Math.log(num / den) / Math.log(1 + r);
        },
    },
    RATE: {
        min: 3, max: 6, lift: true, fn: ([nArg, pmtArg, pvArg, fvArg, t, guessArg]) => {
            const n = toNumber(nArg), pmt = toNumber(pmtArg), pv = toNumber(pvArg), fv = optNum(fvArg, 0), type = typeArg(t);
            const f = (r) => (Math.abs(r) < 1e-12
                ? pv + pmt * n + fv
                : pv * Math.pow(1 + r, n) + pmt * (1 + r * type) * (Math.pow(1 + r, n) - 1) / r + fv);
            return solve(f, optNum(guessArg, 0.1));
        },
    },
    IPMT: {
        min: 4, max: 6, lift: true, fn: ([r, per, n, pv, fv, t]) => ipmtCalc(toNumber(r), toNumber(per), toNumber(n), toNumber(pv), optNum(fv, 0), typeArg(t)),
    },
    PPMT: {
        min: 4, max: 6, lift: true, fn: ([rArg, perArg, nArg, pvArg, fvArg, t]) => {
            const r = toNumber(rArg), per = toNumber(perArg), n = toNumber(nArg), pv = toNumber(pvArg), fv = optNum(fvArg, 0), type = typeArg(t);
            return pmtCalc(r, n, pv, fv, type) - ipmtCalc(r, per, n, pv, fv, type);
        },
    },
    CUMIPMT: {
        min: 6, max: 6, lift: true, fn: ([rArg, nArg, pvArg, sArg, eArg, tArg]) => {
            const r = toNumber(rArg), n = toNumber(nArg), pv = toNumber(pvArg), s = toInt(sArg), e = toInt(eArg), type = toInt(tArg);
            if (r <= 0 || n <= 0 || pv <= 0 || s < 1 || e < s || e > n || (type !== 0 && type !== 1)) throw err(ERR.NUM);
            let total = 0;
            for (let per = s; per <= e; per++) total += ipmtCalc(r, per, n, pv, 0, type);
            return total;
        },
    },
    CUMPRINC: {
        min: 6, max: 6, lift: true, fn: ([rArg, nArg, pvArg, sArg, eArg, tArg]) => {
            const r = toNumber(rArg), n = toNumber(nArg), pv = toNumber(pvArg), s = toInt(sArg), e = toInt(eArg), type = toInt(tArg);
            if (r <= 0 || n <= 0 || pv <= 0 || s < 1 || e < s || e > n || (type !== 0 && type !== 1)) throw err(ERR.NUM);
            const pmt = pmtCalc(r, n, pv, 0, type);
            let total = 0;
            for (let per = s; per <= e; per++) total += pmt - ipmtCalc(r, per, n, pv, 0, type);
            return total;
        },
    },
    NPV: {
        min: 2, max: 255, refs: true, fn: ([rate, ...values]) => npvAt(toNumber(toScalar(rate)), collectNumbers(values)),
    },
    IRR: {
        min: 1, max: 2, refs: true, fn: ([values, guess]) => {
            const flows = collectNumbers([values]);
            cashflowSigns(flows);
            return solve((r) => flows.reduce((acc, v, i) => acc + v / Math.pow(1 + r, i), 0), optNum(toScalar(guess), 0.1));
        },
    },
    XNPV: {
        min: 3, max: 3, fn: ([rate, values, dates]) => {
            const [v, d] = xflows(values, dates);
            return xnpvAt(toNumber(toScalar(rate)), v, d);
        },
    },
    XIRR: {
        min: 2, max: 3, fn: ([values, dates, guess]) => {
            const [v, d] = xflows(values, dates);
            cashflowSigns(v);
            return solve((r) => xnpvAt(r, v, d), optNum(toScalar(guess), 0.1));
        },
    },

    // ---- Aggregation ----
    SUBTOTAL: {
        min: 2, max: 255, refs: true, fn: ([fnArg, ...refs], ctx) => {
            const code = toInt(toScalar(fnArg));
            const base = code > 100 ? code - 100 : code;
            if (base < 1 || base > 11) throw err(ERR.VALUE);
            const skipCell = (r, c) => ctx.isAggregateCell(r, c);
            if (base === 3) {
                let count = 0;
                for (const ref of refs) forEachValue(ref, (v, fromRef, m, r, c) => {
                    if (m?.origin && skipCell(m.origin.row + r, m.origin.col + c)) return;
                    if (v !== null) count++;
                });
                return count;
            }
            return AGG_FUNCS[base](collectNumbers(refs, { skipCell }));
        },
    },
    AGGREGATE: {
        min: 3, max: 255, refs: true, fn: ([fnArg, optArg, ...rest], ctx) => {
            const code = toInt(toScalar(fnArg)), options = toInt(toScalar(optArg));
            if (options < 0 || options > 7) throw err(ERR.VALUE);
            const skipErrors = [2, 3, 6, 7].includes(options);
            const skipNested = [0, 1, 2, 3].includes(options);
            const skipCell = skipNested ? (r, c) => ctx.isAggregateCell(r, c) : null;
            if (AGG_K_FUNCS[code]) {
                const [ref, k] = rest;
                if (isMissing(k)) throw err(ERR.VALUE);
                return AGG_K_FUNCS[code](collectNumbers([ref], { skipErrors, skipCell }), toNumber(toScalar(k)));
            }
            if (code === 3) {
                let count = 0;
                for (const ref of rest) forEachValue(ref, (v, fromRef, m, r, c) => {
                    if (skipCell && m?.origin && skipCell(m.origin.row + r, m.origin.col + c)) return;
                    if (v instanceof FormulaError && skipErrors) return;
                    if (v !== null) count++;
                });
                return count;
            }
            if (!AGG_FUNCS[code]) throw err(ERR.VALUE);
            return AGG_FUNCS[code](collectNumbers(rest, { skipErrors, skipCell }));
        },
    },
};

// Excel's legacy names for the same statistics.
Object.assign(FUNCTIONS, {
    RANK: FUNCTIONS["RANK.EQ"],
    PERCENTILE: FUNCTIONS["PERCENTILE.INC"],
    QUARTILE: FUNCTIONS["QUARTILE.INC"],
    STDEV: FUNCTIONS["STDEV.S"],
    STDEVP: FUNCTIONS["STDEV.P"],
    VAR: FUNCTIONS["VAR.S"],
    VARP: FUNCTIONS["VAR.P"],
    COVAR: FUNCTIONS["COVARIANCE.P"],
    COVARIANCE: FUNCTIONS["COVARIANCE.P"],
});

function typeCode(v) {
    if (typeof v === "number" || v === null) return 1;
    if (typeof v === "string") return 2;
    if (typeof v === "boolean") return 4;
    if (v instanceof FormulaError) return 16;
    return 64;
}

// AND/OR/XOR inputs: logicals and numbers (non-zero = TRUE); text in ranges
// is skipped, typed text must read TRUE/FALSE; nothing to test -> #VALUE!.
function collectLogicals(args) {
    const out = [];
    for (const arg of args) {
        forEachValue(arg, (v, fromRef) => {
            if (v instanceof FormulaError) throw v;
            if (typeof v === "boolean") out.push(v);
            else if (typeof v === "number") out.push(v !== 0);
            else if (!fromRef && v !== null) out.push(toBool(v));
        });
    }
    if (!out.length) throw err(ERR.VALUE);
    return out;
}

// Functions whose result reads as a date/time, so a cell holding one shows a
// date instead of a raw serial number unless it has an explicit format —
// what Excel does when you type =TODAY() into a General cell.
export const RESULT_FORMAT_HINTS = {
    TODAY: "date", DATE: "date", EDATE: "date", EOMONTH: "date", DATEVALUE: "date",
    WORKDAY: "date", "WORKDAY.INTL": "date",
    NOW: "datetime",
    TIME: "time", TIMEVALUE: "time",
};

export const isKnownFunction = (name) => Object.prototype.hasOwnProperty.call(FUNCTIONS, name);
export { isError, err, ERR };
