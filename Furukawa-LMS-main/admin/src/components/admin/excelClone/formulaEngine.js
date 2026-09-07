// Lightweight spreadsheet formula engine: cell refs (A1), ranges (A1:B3),
// arithmetic (+ - * /), and SUM/AVERAGE/MIN/MAX/COUNT. Deliberately not a full
// Excel-formula grammar — this exists to support the handful of calculations
// a daily-meeting tally sheet actually needs, evaluated via a hand-rolled
// parser (never eval/Function) so arbitrary cell input can't execute code.

export const colToIndex = (letters) => {
    let idx = 0;
    for (let i = 0; i < letters.length; i++) {
        idx = idx * 26 + (letters.charCodeAt(i) - 64);
    }
    return idx - 1;
};

export const indexToCol = (index) => {
    let n = index + 1;
    let s = "";
    while (n > 0) {
        const rem = (n - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
};

export const getCellId = (rowIndex, colIndex) => `${indexToCol(colIndex)}${rowIndex + 1}`;

export const parseCellRef = (ref) => {
    const cleaned = ref.replace(/\$/g, "");
    const m = /^([A-Z]+)(\d+)$/.exec(cleaned);
    if (!m) return null;
    return { col: colToIndex(m[1]), row: parseInt(m[2], 10) - 1 };
};

// Shifts every relative cell reference in a formula by (rowOffset, colOffset),
// leaving $-anchored (absolute) references untouched — used when the fill
// handle copies a formula cell into adjacent cells.
export const adjustFormula = (formula, rowOffset, colOffset) => {
    if (!formula || typeof formula !== "string" || !formula.startsWith("=")) return formula;

    const cellRefRegex = /(\$?)([A-Z]+)(\$?)([0-9]+)/g;

    return formula.replace(cellRefRegex, (match, colAbs, colLetters, rowAbs, rowNumStr) => {
        let nextColLetters = colLetters;
        let nextRowNum = parseInt(rowNumStr, 10);

        if (!colAbs) {
            const colIdx = colToIndex(colLetters);
            nextColLetters = indexToCol(Math.max(0, colIdx + colOffset));
        }
        if (!rowAbs) {
            nextRowNum = Math.max(1, nextRowNum + rowOffset);
        }

        return `${colAbs}${nextColLetters}${rowAbs}${nextRowNum}`;
    });
};

// Projects an arithmetic progression from known numeric values to fill
// `targetLength` further cells — the fill-handle "drag to sequence" behavior
// (1, 3 -> 5, 7, 9). A single seed value increments by 1 per step; a
// non-numeric or empty source produces blanks so callers fall back to a
// plain repeat/copy instead.
export const extrapolateSeries = (sourceValues, targetLength) => {
    const numbers = sourceValues.map(v => Number(v)).filter(v => !isNaN(v));
    if (numbers.length === 0) return Array(targetLength).fill("");
    if (numbers.length === 1) {
        return Array.from({ length: targetLength }, (_, i) => String(numbers[0] + i + 1));
    }

    let totalDiff = 0;
    for (let i = 1; i < numbers.length; i++) {
        totalDiff += numbers[i] - numbers[i - 1];
    }
    const avgDiff = totalDiff / (numbers.length - 1);
    const lastVal = numbers[numbers.length - 1];

    return Array.from({ length: targetLength }, (_, i) => String(lastVal + avgDiff * (i + 1)));
};

export const expandRange = (startRef, endRef) => {
    const s = parseCellRef(startRef);
    const e = parseCellRef(endRef);
    if (!s || !e) return [];
    const minRow = Math.min(s.row, e.row), maxRow = Math.max(s.row, e.row);
    const minCol = Math.min(s.col, e.col), maxCol = Math.max(s.col, e.col);
    const ids = [];
    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            ids.push(getCellId(r, c));
        }
    }
    return ids;
};

const TOKEN_MATCHERS = [
    { type: "string", re: /^"[^"]*"|^'[^']*'/ },
    { type: "range", re: /^\$?[A-Z]+\$?[0-9]+:\$?[A-Z]+\$?[0-9]+/ },
    { type: "cell", re: /^\$?[A-Z]+\$?[0-9]+/ },
    { type: "func", re: /^[A-Z]+(?=\()/ },
    { type: "bool", re: /^(TRUE|FALSE)\b/ },
    { type: "number", re: /^\d+(\.\d+)?/ },
];

export const tokenize = (formula) => {
    let s = formula.trim().toUpperCase();
    const tokens = [];
    while (s.length) {
        if (/^\s/.test(s)) { s = s.slice(1); continue; }
        let matched = false;
        for (const { type, re } of TOKEN_MATCHERS) {
            const m = re.exec(s);
            if (m) {
                tokens.push({ type, value: m[0] });
                s = s.slice(m[0].length);
                matched = true;
                break;
            }
        }
        if (matched) continue;
        const ch = s[0];
        if (ch === "(") tokens.push({ type: "lparen", value: ch });
        else if (ch === ")") tokens.push({ type: "rparen", value: ch });
        else if (ch === ",") tokens.push({ type: "comma", value: ch });
        else if ("+-*/".includes(ch)) tokens.push({ type: "op", value: ch });
        // Unrecognized characters are skipped rather than throwing, so a
        // stray character doesn't blow up evaluation of the whole cell.
        s = s.slice(1);
    }
    return tokens;
};

// Coerces a resolved value (number, string, boolean, or NaN/blank) to a number
// for use in arithmetic (+ - * /) and unary negation — mirrors how a
// spreadsheet treats TRUE/FALSE as 1/0 and non-numeric text as 0 when it lands
// in a numeric context, without forcing every cell reference everywhere to be
// pre-coerced (VLOOKUP and friends need the raw string/boolean/number instead).
const toNumber = (v) => {
    if (typeof v === "number") return isNaN(v) ? 0 : v;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v === undefined || v === null || v === "") return 0;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
};

// Type-aware equality for VLOOKUP exact match: numeric values compare
// numerically (so a cell holding 101 matches a lookup value typed as "101"),
// everything else compares as case-insensitive text.
const valuesEqual = (a, b) => {
    const an = typeof a === "number" ? a : parseFloat(a);
    const bn = typeof b === "number" ? b : parseFloat(b);
    if (typeof a !== "boolean" && typeof b !== "boolean" && !isNaN(an) && !isNaN(bn)) return an === bn;
    return String(a).toUpperCase() === String(b).toUpperCase();
};

// Type-aware ordering for VLOOKUP approximate match, assuming the table's
// first column is sorted ascending: numeric comparison when both sides look
// like numbers, otherwise case-insensitive lexicographic comparison.
const compareValues = (a, b) => {
    const an = typeof a === "number" ? a : parseFloat(a);
    const bn = typeof b === "number" ? b : parseFloat(b);
    if (typeof a !== "boolean" && typeof b !== "boolean" && !isNaN(an) && !isNaN(bn)) return an < bn ? -1 : an > bn ? 1 : 0;
    const as = String(a).toUpperCase(), bs = String(b).toUpperCase();
    return as < bs ? -1 : as > bs ? 1 : 0;
};

class FormulaParser {
    constructor(tokens, resolveCell) {
        this.tokens = tokens;
        this.pos = 0;
        this.resolveCell = resolveCell;
    }
    peek() { return this.tokens[this.pos]; }
    next() { return this.tokens[this.pos++]; }

    parseExpression() {
        let value = this.parseTerm();
        while (this.peek() && this.peek().type === "op" && (this.peek().value === "+" || this.peek().value === "-")) {
            const op = this.next().value;
            const rhs = this.parseTerm();
            value = op === "+" ? toNumber(value) + toNumber(rhs) : toNumber(value) - toNumber(rhs);
        }
        return value;
    }

    parseTerm() {
        let value = this.parseFactor();
        while (this.peek() && this.peek().type === "op" && (this.peek().value === "*" || this.peek().value === "/")) {
            const op = this.next().value;
            const rhs = this.parseFactor();
            value = op === "*" ? toNumber(value) * toNumber(rhs) : toNumber(value) / toNumber(rhs);
        }
        return value;
    }

    parseFactor() {
        const tok = this.peek();
        if (!tok) throw new Error("#ERROR!");
        if (tok.type === "op" && tok.value === "-") {
            this.next();
            return -toNumber(this.parseFactor());
        }
        if (tok.type === "number") { this.next(); return parseFloat(tok.value); }
        if (tok.type === "string") { this.next(); return tok.value.slice(1, -1); }
        if (tok.type === "bool") { this.next(); return tok.value === "TRUE"; }
        if (tok.type === "cell") { this.next(); return this.resolveCell(tok.value); }
        if (tok.type === "lparen") {
            this.next();
            const value = this.parseExpression();
            if (!this.peek() || this.peek().type !== "rparen") throw new Error("#ERROR!");
            this.next();
            return value;
        }
        if (tok.type === "func") {
            const name = this.next().value;
            if (!this.peek() || this.peek().type !== "lparen") throw new Error("#ERROR!");
            this.next();
            const args = this.parseArgs();
            if (!this.peek() || this.peek().type !== "rparen") throw new Error("#ERROR!");
            this.next();
            return this.applyFunc(name, args);
        }
        throw new Error("#ERROR!");
    }

    parseArgs() {
        const args = [];
        if (this.peek() && this.peek().type === "rparen") return args;
        args.push(this.parseArg());
        while (this.peek() && this.peek().type === "comma") {
            this.next();
            args.push(this.parseArg());
        }
        return args;
    }

    parseArg() {
        if (this.peek() && this.peek().type === "range") {
            const [start, end] = this.next().value.split(":");
            return { range: [start, end] };
        }
        return { value: this.parseExpression() };
    }

    applyFunc(name, args) {
        if (name === "VLOOKUP") return this.evalVlookup(args);

        const numbers = [];
        for (const arg of args) {
            if (arg.range) {
                for (const cellId of expandRange(arg.range[0], arg.range[1])) {
                    const v = this.resolveCell(cellId);
                    if (typeof v === "number" && !isNaN(v)) numbers.push(v);
                    else if (typeof v === "boolean") numbers.push(v ? 1 : 0);
                }
            } else {
                const v = arg.value;
                if (typeof v === "number" && !isNaN(v)) numbers.push(v);
                else if (typeof v === "boolean") numbers.push(v ? 1 : 0);
            }
        }
        switch (name) {
            case "SUM": return numbers.reduce((a, b) => a + b, 0);
            case "AVERAGE":
            case "AVG": return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
            case "MIN": return numbers.length ? Math.min(...numbers) : 0;
            case "MAX": return numbers.length ? Math.max(...numbers) : 0;
            case "COUNT": return numbers.length;
            default: throw new Error("#NAME?");
        }
    }

    // =VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])
    // Searches the first column of table_array for lookup_value and returns
    // the value from col_index_num columns across, on the matching row.
    evalVlookup(args) {
        if (args.length < 3 || args.length > 4) throw new Error("#VALUE!");

        const [lookupArg, tableArg, colArg, rangeArg] = args;
        if (!tableArg.range) throw new Error("#VALUE!");

        const lookupValue = lookupArg.value;

        const colIndexRaw = colArg.value;
        const colIndex = typeof colIndexRaw === "number" ? colIndexRaw : parseFloat(colIndexRaw);
        if (isNaN(colIndex) || !Number.isInteger(colIndex) || colIndex < 1) throw new Error("#VALUE!");

        const [startRef, endRef] = tableArg.range;
        const start = parseCellRef(startRef);
        const end = parseCellRef(endRef);
        if (!start || !end) throw new Error("#VALUE!");

        const minRow = Math.min(start.row, end.row), maxRow = Math.max(start.row, end.row);
        const minCol = Math.min(start.col, end.col), maxCol = Math.max(start.col, end.col);
        const totalCols = maxCol - minCol + 1;
        if (colIndex > totalCols) throw new Error("#REF!");

        let approximate = true;
        if (rangeArg !== undefined) {
            const rv = rangeArg.value;
            if (rv === false || rv === 0 || (typeof rv === "string" && rv.toUpperCase() === "FALSE")) approximate = false;
            else if (rv === true || rv === 1 || (typeof rv === "string" && rv.toUpperCase() === "TRUE")) approximate = true;
            else approximate = !!toNumber(rv);
        }

        let matchedRow = -1;
        if (!approximate) {
            for (let r = minRow; r <= maxRow; r++) {
                const cv = this.resolveCell(getCellId(r, minCol));
                if (valuesEqual(cv, lookupValue)) { matchedRow = r; break; }
            }
        } else {
            for (let r = minRow; r <= maxRow; r++) {
                const cv = this.resolveCell(getCellId(r, minCol));
                if (compareValues(cv, lookupValue) <= 0) matchedRow = r; else break;
            }
        }
        if (matchedRow === -1) throw new Error("#N/A");

        return this.resolveCell(getCellId(matchedRow, minCol + colIndex - 1));
    }
}

const formatNumber = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000));

// Renders a numeric result per the cell's `numberFormat` ('number', 'currency',
// 'accounting', 'percentage', 'comma') and `decimalPlaces` (default 2).
// 'accounting' reuses the currency rendering — a true accounting layout
// (symbol pinned left, amount right-aligned, negatives in parens) needs
// column-level layout this per-cell formatter doesn't have; out of scope here.
export const applyNumberFormat = (num, cell) => {
    const fmt = cell?.numberFormat;
    if (!fmt || fmt === "general" || typeof num !== "number" || isNaN(num)) return formatNumber(num);

    const decimals = cell?.decimalPlaces !== undefined && cell?.decimalPlaces !== null ? cell.decimalPlaces : 2;
    switch (fmt) {
        case "number":
            return num.toFixed(decimals);
        case "comma":
            return num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        case "currency":
        case "accounting":
            return `$${num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
        case "percentage":
            return `${(num * 100).toFixed(decimals)}%`;
        default:
            return formatNumber(num);
    }
};

// Shared evaluator behind both buildDisplayGrid and buildRawValueGrid below:
// resolves every cell to its evaluated-but-unformatted value (a number for
// formulas/numeric cells, the original string otherwise), memoized per call
// and guarded against circular references the same way. Kept private so the
// two public grid builders can't drift out of sync with each other.
const evaluateCellsRaw = (cells) => {
    const memo = new Map();

    const evalCell = (cellId, visited) => {
        if (memo.has(cellId)) return memo.get(cellId);
        if (visited.has(cellId)) return NaN;

        const raw = cells[cellId]?.value;
        if (raw === undefined || raw === null || raw === "") { memo.set(cellId, 0); return 0; }

        if (typeof raw === "string" && raw.trim().startsWith("=")) {
            const nextVisited = new Set(visited);
            nextVisited.add(cellId);
            // Returns the raw evaluated value (number, string, or boolean) rather
            // than coercing to 0 — VLOOKUP and bare cell-reference formulas need
            // the actual text/number, not a numeric stand-in. Arithmetic operators
            // coerce via toNumber() at the point they combine values instead.
            const resolveCell = (ref) => evalCell(ref.replace(/\$/g, ""), nextVisited);
            try {
                const tokens = tokenize(raw.trim().slice(1));
                const result = new FormulaParser(tokens, resolveCell).parseExpression();
                memo.set(cellId, result);
                return result;
            } catch (e) {
                const code = typeof e?.message === "string" && e.message.startsWith("#") ? e.message : "#ERROR!";
                memo.set(cellId, code);
                return code;
            }
        }

        const trimmed = String(raw).trim();
        const num = /^-?\d+(\.\d+)?$/.test(trimmed) ? parseFloat(trimmed) : raw;
        memo.set(cellId, num);
        return num;
    };

    return (cellId) => evalCell(cellId, new Set());
};

// Evaluates every formula cell in `cells` ({cellId: {value, ...}}) in one pass,
// sharing a memo cache across cells and tracking the in-progress resolution
// path per top-level cell so a circular reference (A1=B1, B1=A1) hits the
// `visited` check and resolves to NaN/"#ERROR!" instead of recursing forever.
export const buildDisplayGrid = (cells) => {
    const evalCell = evaluateCellsRaw(cells);
    const display = {};

    for (const cellId of Object.keys(cells)) {
        const cell = cells[cellId];
        const raw = cell?.value;
        if (raw === undefined || raw === null || raw === "") { display[cellId] = ""; continue; }
        if (typeof raw === "string" && raw.trim().startsWith("=")) {
            const result = evalCell(cellId);
            if (typeof result === "number") display[cellId] = isNaN(result) ? "#ERROR!" : applyNumberFormat(result, cell);
            else if (typeof result === "boolean") display[cellId] = result ? "TRUE" : "FALSE";
            else if (typeof result === "string") display[cellId] = result;
            else display[cellId] = "#ERROR!";
        } else {
            const trimmed = String(raw).trim();
            const num = /^-?\d+(\.\d+)?$/.test(trimmed) ? parseFloat(trimmed) : NaN;
            display[cellId] = isNaN(num) ? String(raw) : applyNumberFormat(num, cell);
        }
    }
    return display;
};

// Same evaluation as buildDisplayGrid, but returns the raw evaluated value
// (a number, or the original string for non-numeric text) instead of the
// per-cell formatted display string — e.g. a currency-formatted "$1,234.56"
// comes back as the number 1234.56, not that formatted string. For callers
// that need to do arithmetic on cell values (like the pivot engine) rather
// than render them, since parsing a formatted display string back into a
// number is lossy/wrong for currency, comma, and percentage formats.
export const buildRawValueGrid = (cells) => {
    const evalCell = evaluateCellsRaw(cells);
    const raw = {};
    for (const cellId of Object.keys(cells)) raw[cellId] = evalCell(cellId);
    return raw;
};
