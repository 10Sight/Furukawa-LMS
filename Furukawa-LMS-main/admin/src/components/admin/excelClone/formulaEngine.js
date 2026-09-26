// Spreadsheet formula engine: Excel formula grammar (arithmetic, comparison,
// &, ^, %, cell/range/whole-column/whole-row references, array constants,
// spill references) evaluated by a hand-written lexer + parser + tree
// evaluator — never eval/Function, so arbitrary cell input can't run code.
//
// Formulas that return arrays (=SEQUENCE(5), =FILTER(...), =A1:A5*2) spill
// into the cells below/right of them, or show #SPILL! when something's in
// the way. The function library lives in formulaFunctions.js; the value
// model (errors, arrays, coercions) in formulaValues.js.

import {
    ERR, err, FormulaError, Matrix, MISSING, toScalar,
    toNumber, toText, compareValues, fixFloat, nowSerial, formatGeneral,
} from "./formulaValues";
import { FUNCTIONS, RESULT_FORMAT_HINTS } from "./formulaFunctions";
import { formatWithPattern, DATE_FORMAT_PATTERN, TIME_FORMAT_PATTERN, DATETIME_FORMAT_PATTERN } from "./formulaFormat";

// ---------------------------------------------------------------------------
// Cell addressing

export const colToIndex = (letters) => {
    let idx = 0;
    const upper = letters.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
        idx = idx * 26 + (upper.charCodeAt(i) - 64);
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
    const cleaned = String(ref).replace(/\$/g, "").toUpperCase();
    const m = /^([A-Z]+)(\d+)$/.exec(cleaned);
    if (!m) return null;
    return { col: colToIndex(m[1]), row: parseInt(m[2], 10) - 1 };
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

    return Array.from({ length: targetLength }, (_, i) => String(fixFloat(lastVal + avgDiff * (i + 1))));
};

export const isFormula = (raw) => typeof raw === "string" && raw.trim().startsWith("=");

// ---------------------------------------------------------------------------
// Lexer — position-preserving, so the same tokens drive evaluation, reference
// highlighting, F4 reference cycling and relative-reference shifting.

const LEX_RULES = [
    ["ws", /\s+/y],
    ["string", /"(?:[^"]|"")*"/y],
    ["string", /'(?:[^']|'')*'(?!!)/y], // single-quoted text, accepted for older saved sheets
    ["error", /#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|SPILL!|CALC!|CYCLE!|ERROR!)/iy],
    ["rowrange", /\$?\d+:\$?\d+(?![\d.A-Za-z_(])/y],
    ["number", /(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?(?![A-Za-z_(])/y],
    ["range", /\$?[A-Za-z]{1,3}\$?\d+:\$?[A-Za-z]{1,3}\$?\d+(?![A-Za-z0-9_.(])/y],
    ["colrange", /\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}(?![A-Za-z0-9_.(:])/y],
    ["cell", /\$?[A-Za-z]{1,3}\$?\d+(?![A-Za-z0-9_.(])/y],
    ["bool", /(?:TRUE|FALSE)(?![A-Za-z0-9_.(])/iy],
    ["func", /[A-Za-z_][A-Za-z0-9_.]*(?=\s*\()/y],
    ["name", /[A-Za-z_][A-Za-z0-9_.]*/y],
    ["op", /<=|>=|<>|[-+*/^&=<>%]/y],
    ["punct", /[(),;{}]/y],
    ["hash", /#/y],
];

class FormulaSyntaxError extends Error {}

// Tokenizes a formula body (the text after "="). `offset` shifts reported
// positions so callers can lex a substring of a larger string.
export const lexFormula = (body, offset = 0) => {
    const tokens = [];
    let pos = 0;
    while (pos < body.length) {
        let matched = false;
        for (const [type, re] of LEX_RULES) {
            re.lastIndex = pos;
            const m = re.exec(body);
            if (!m || m[0].length === 0) continue;
            const text = m[0];
            let value = text;
            if (type === "string") value = text.slice(1, -1).replace(text[0] === '"' ? /""/g : /''/g, text[0]);
            else if (type !== "ws" && type !== "punct" && type !== "op") value = text.toUpperCase();
            tokens.push({ type, value, text, start: offset + pos, end: offset + pos + text.length });
            pos += text.length;
            matched = true;
            break;
        }
        if (!matched) throw new FormulaSyntaxError(`Unexpected "${body[pos]}"`);
    }
    return tokens;
};

// Back-compat export: significant tokens of a formula body.
export const tokenize = (formula) => lexFormula(String(formula).trim()).filter((t) => t.type !== "ws");

const REF_PARTS_RE = /^(\$?)([A-Za-z]+)(\$?)(\d+)$/;
const parseRefParts = (text) => {
    const m = REF_PARTS_RE.exec(text);
    if (!m) return null;
    return { colAbs: m[1] === "$", col: colToIndex(m[2]), rowAbs: m[3] === "$", row: parseInt(m[4], 10) - 1 };
};

// ---------------------------------------------------------------------------
// Parser -> AST

class Parser {
    constructor(tokens) {
        this.tokens = tokens.filter((t) => t.type !== "ws");
        this.pos = 0;
    }
    peek(offset = 0) { return this.tokens[this.pos + offset]; }
    next() { return this.tokens[this.pos++]; }
    isOp(value) { const t = this.peek(); return t && t.type === "op" && t.value === value; }
    isPunct(value) { const t = this.peek(); return t && t.type === "punct" && t.value === value; }
    expectPunct(value) {
        if (!this.isPunct(value)) throw new FormulaSyntaxError(`Expected "${value}"`);
        this.next();
    }

    parse() {
        if (!this.tokens.length) throw new FormulaSyntaxError("Empty formula");
        const node = this.parseComparison();
        if (this.pos < this.tokens.length) throw new FormulaSyntaxError("Unexpected trailing input");
        return node;
    }
    parseBinary(nextLevel, ops) {
        let left = nextLevel();
        while (this.peek()?.type === "op" && ops.includes(this.peek().value)) {
            const op = this.next().value;
            left = { type: "bin", op, left, right: nextLevel() };
        }
        return left;
    }
    parseComparison() { return this.parseBinary(() => this.parseConcat(), ["=", "<>", "<", ">", "<=", ">="]); }
    parseConcat() { return this.parseBinary(() => this.parseAdditive(), ["&"]); }
    parseAdditive() { return this.parseBinary(() => this.parseMultiplicative(), ["+", "-"]); }
    parseMultiplicative() { return this.parseBinary(() => this.parsePower(), ["*", "/"]); }
    // Excel binds unary minus tighter than ^, so =-2^2 is 4.
    parsePower() { return this.parseBinary(() => this.parseUnary(), ["^"]); }
    parseUnary() {
        if (this.isOp("-") || this.isOp("+")) {
            const op = this.next().value;
            return { type: "un", op, arg: this.parseUnary() };
        }
        let node = this.parsePrimary();
        while (this.isOp("%")) { this.next(); node = { type: "pct", arg: node }; }
        return node;
    }
    parsePrimary() {
        const tok = this.next();
        if (!tok) throw new FormulaSyntaxError("Unexpected end of formula");
        switch (tok.type) {
            case "number": return { type: "num", value: parseFloat(tok.value) };
            case "string": return { type: "str", value: tok.value };
            case "bool": return { type: "bool", value: tok.value === "TRUE" };
            case "error": return { type: "err", code: tok.value };
            case "cell": {
                const ref = parseRefParts(tok.value);
                if (this.peek()?.type === "hash") { this.next(); return { type: "spill", row: ref.row, col: ref.col }; }
                return { type: "cell", row: ref.row, col: ref.col };
            }
            case "range": {
                const [a, b] = tok.value.split(":").map(parseRefParts);
                return {
                    type: "area",
                    r1: Math.min(a.row, b.row), r2: Math.max(a.row, b.row),
                    c1: Math.min(a.col, b.col), c2: Math.max(a.col, b.col),
                };
            }
            case "colrange": {
                const [a, b] = tok.value.replace(/\$/g, "").split(":").map(colToIndex);
                return { type: "area", r1: 0, r2: null, c1: Math.min(a, b), c2: Math.max(a, b) };
            }
            case "rowrange": {
                const [a, b] = tok.value.replace(/\$/g, "").split(":").map((n) => parseInt(n, 10) - 1);
                if (a < 0 || b < 0) throw new FormulaSyntaxError("Bad row range");
                return { type: "area", r1: Math.min(a, b), r2: Math.max(a, b), c1: 0, c2: null };
            }
            case "func": return this.parseCall(tok.value);
            case "name": return { type: "name", name: tok.value };
            case "punct":
                if (tok.value === "(") {
                    const inner = this.parseComparison();
                    this.expectPunct(")");
                    return inner;
                }
                if (tok.value === "{") return this.parseArrayConstant();
                break;
            default: break;
        }
        throw new FormulaSyntaxError(`Unexpected "${tok.text}"`);
    }
    parseCall(name) {
        this.expectPunct("(");
        const args = [];
        if (this.isPunct(")")) { this.next(); return { type: "func", name, args }; }
        for (;;) {
            if (this.isPunct(",") || this.isPunct(")")) args.push({ type: "empty" });
            else args.push(this.parseComparison());
            if (this.isPunct(",")) { this.next(); continue; }
            this.expectPunct(")");
            return { type: "func", name, args };
        }
    }
    parseArrayConstant() {
        const rows = [[]];
        for (;;) {
            let sign = 1;
            while (this.isOp("-") || this.isOp("+")) { if (this.next().value === "-") sign = -sign; }
            const tok = this.next();
            if (!tok) throw new FormulaSyntaxError("Unclosed array");
            if (tok.type === "number") rows[rows.length - 1].push(sign * parseFloat(tok.value));
            else if (tok.type === "string") rows[rows.length - 1].push(tok.value);
            else if (tok.type === "bool") rows[rows.length - 1].push(tok.value === "TRUE");
            else if (tok.type === "error") rows[rows.length - 1].push(err(tok.value));
            else throw new FormulaSyntaxError("Array constants may only hold literal values");
            if (this.isPunct(",")) { this.next(); continue; }
            if (this.isPunct(";")) { this.next(); rows.push([]); continue; }
            this.expectPunct("}");
            break;
        }
        const width = rows[0].length;
        if (rows.some((r) => r.length !== width)) throw new FormulaSyntaxError("Ragged array constant");
        return { type: "array", rows };
    }
}

const astCache = new Map();
const AST_CACHE_LIMIT = 5000;

// Parses "=..." text to an AST; syntax errors come back as { type: "err" }.
export const parseFormula = (formulaText) => {
    const body = String(formulaText).trim().replace(/^=/, "");
    const cached = astCache.get(body);
    if (cached) return cached;
    let ast;
    try {
        ast = new Parser(lexFormula(body)).parse();
    } catch (e) {
        if (!(e instanceof FormulaSyntaxError)) throw e;
        ast = { type: "err", code: ERR.ERROR };
    }
    if (astCache.size >= AST_CACHE_LIMIT) astCache.delete(astCache.keys().next().value);
    astCache.set(body, ast);
    return ast;
};

// Date/time display hint for a formula's result (see RESULT_FORMAT_HINTS).
const hintFor = (node) => {
    if (!node) return null;
    if (node.type === "func") return RESULT_FORMAT_HINTS[node.name] || null;
    if (node.type === "bin" && (node.op === "+" || node.op === "-")) {
        const l = hintFor(node.left), r = hintFor(node.right);
        if (node.op === "-" && l && r) return null; // date - date = a day count
        return l || r;
    }
    return null;
};

// ---------------------------------------------------------------------------
// Evaluation

// Excel array broadcasting: a 1-row/1-column array stretches across the
// other operand; positions beyond a smaller array become #N/A.
const broadcast = (values, fn) => {
    let height = 1, width = 1;
    for (const v of values) {
        if (v instanceof Matrix) { height = Math.max(height, v.height); width = Math.max(width, v.width); }
    }
    const na = err(ERR.NA);
    const rows = [];
    for (let r = 0; r < height; r++) {
        const row = [];
        for (let c = 0; c < width; c++) {
            const scalars = values.map((v) => {
                if (!(v instanceof Matrix)) return v;
                const rr = v.height === 1 ? 0 : r, cc = v.width === 1 ? 0 : c;
                return rr < v.height && cc < v.width ? v.rows[rr][cc] : na;
            });
            try {
                row.push(fn(scalars));
            } catch (e) {
                if (e instanceof FormulaError) row.push(e); else throw e;
            }
        }
        rows.push(row);
    }
    return new Matrix(rows);
};

const applyBinary = (op, a, b) => {
    if (a instanceof FormulaError) return a;
    if (b instanceof FormulaError) return b;
    switch (op) {
        case "+": return fixFloat(toNumber(a) + toNumber(b));
        case "-": return fixFloat(toNumber(a) - toNumber(b));
        case "*": return fixFloat(toNumber(a) * toNumber(b));
        case "/": {
            const d = toNumber(b);
            if (d === 0) throw err(ERR.DIV0);
            return fixFloat(toNumber(a) / d);
        }
        case "^": {
            const base = toNumber(a), exp = toNumber(b);
            if (base === 0 && exp < 0) throw err(ERR.DIV0);
            const r = Math.pow(base, exp);
            if (!isFinite(r)) throw err(ERR.NUM);
            return r;
        }
        case "&": return toText(a) + toText(b);
        case "=": return compareValues(a, b) === 0;
        case "<>": return compareValues(a, b) !== 0;
        case "<": return compareValues(a, b) < 0;
        case ">": return compareValues(a, b) > 0;
        case "<=": return compareValues(a, b) <= 0;
        case ">=": return compareValues(a, b) >= 0;
        default: throw err(ERR.ERROR);
    }
};

const guard = (fn) => {
    try {
        const v = fn();
        return typeof v === "number" && !isFinite(v) ? err(ERR.NUM) : v === undefined ? null : v;
    } catch (e) {
        if (e instanceof FormulaError) return e;
        throw e;
    }
};

// Literal (non-formula) cell text -> value, the way Excel reads what was
// typed: numbers (incl. "1,234", "12%", "1e3"), TRUE/FALSE, otherwise text.
const NUMBER_LITERAL_RE = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
const parseLiteral = (raw) => {
    if (typeof raw === "number" || typeof raw === "boolean") return raw;
    const s = String(raw);
    const t = s.trim();
    if (NUMBER_LITERAL_RE.test(t)) return parseFloat(t);
    if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return parseFloat(t.replace(/,/g, ""));
    if (/^[-+]?(\d+\.?\d*|\.\d+)%$/.test(t)) return parseFloat(t) / 100;
    const upper = t.toUpperCase();
    if (upper === "TRUE") return true;
    if (upper === "FALSE") return false;
    return s;
};

const isEmptyRaw = (raw) => raw === undefined || raw === null || raw === "";
const AGGREGATE_FORMULA_RE = /\b(SUBTOTAL|AGGREGATE)\s*\(/i;

// Tiny deterministic PRNG so RAND() is stable across the engine's repeat
// passes and re-renders, and only changes when the caller bumps `seed`.
const hashString = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
};
const mulberry32 = (a) => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

class EvalPass {
    constructor(cells, layout, known, options) {
        this.cells = cells;
        this.layout = layout;
        this.known = known;
        this.now = options.now;
        this.seed = options.seed;
        this.memo = new Map();
        this.literalMemo = new Map();
        this.inProgress = new Set();
    }

    // Final value of a formula cell: { value, matrix?, hint, spillBlocked? }.
    evalFormula(id) {
        const cached = this.memo.get(id);
        if (cached) return cached;
        if (this.inProgress.has(id)) return { value: err(ERR.CYCLE) };
        this.inProgress.add(id);
        const { row, col } = this.layout.positions.get(id) || parseCellRef(id);
        const ast = parseFormula(this.cells[id].value);
        let callCounter = 0;
        const frame = {
            row, col, id,
            random: () => mulberry32(hashString(`${this.seed}|${id}|${callCounter++}`)),
        };
        let result = this.evalNode(ast, frame);
        this.inProgress.delete(id);

        const entry = { hint: hintFor(ast) };
        if (result instanceof Matrix) {
            if (result.height === 0 || result.width === 0) {
                entry.value = err(ERR.CALC);
            } else if (result.height === 1 && result.width === 1) {
                entry.value = result.rows[0][0] ?? 0;
            } else {
                const normalized = result.rows.map((r) => r.map((v) => v ?? 0));
                entry.matrix = normalized;
                entry.spillBlocked = this.isSpillObstructed(row, col, normalized) || this.known.blocked.has(id);
                entry.value = entry.spillBlocked ? err(ERR.SPILL) : normalized[0][0];
            }
        } else {
            entry.value = result ?? 0;
        }
        this.memo.set(id, entry);
        return entry;
    }

    isSpillObstructed(row, col, rows) {
        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[0].length; c++) {
                if (r === 0 && c === 0) continue;
                if (!isEmptyRaw(this.cells[getCellId(row + r, col + c)]?.value)) return true;
            }
        }
        return false;
    }

    valueAt(row, col) {
        const id = getCellId(row, col);
        const raw = this.cells[id]?.value;
        if (isEmptyRaw(raw)) {
            const spilled = this.known.spill.get(id);
            return spilled ? spilled.value : null;
        }
        if (isFormula(raw)) return this.evalFormula(id).value;
        if (!this.literalMemo.has(id)) this.literalMemo.set(id, parseLiteral(raw));
        return this.literalMemo.get(id);
    }

    areaMatrix(r1, r2, c1, c2) {
        const rows = [];
        for (let r = r1; r <= r2; r++) {
            const row = [];
            for (let c = c1; c <= c2; c++) row.push(this.valueAt(r, c));
            rows.push(row);
        }
        return new Matrix(rows, { row: r1, col: c1 });
    }

    evalNode(node, frame) {
        switch (node.type) {
            case "num": return node.value;
            case "str": return node.value;
            case "bool": return node.value;
            case "err": return err(node.code);
            case "empty": return MISSING;
            case "name": return err(ERR.NAME);
            case "cell": return this.valueAt(node.row, node.col);
            case "area": {
                const r2 = node.r2 === null ? Math.max(this.layout.maxRow, node.r1) : node.r2;
                const c2 = node.c2 === null ? Math.max(this.layout.maxCol, node.c1) : node.c2;
                return this.areaMatrix(node.r1, r2, node.c1, c2);
            }
            case "spill": {
                const id = getCellId(node.row, node.col);
                if (!isFormula(this.cells[id]?.value)) return err(ERR.REF);
                const entry = this.evalFormula(id);
                if (entry.matrix && !entry.spillBlocked) return new Matrix(entry.matrix, { row: node.row, col: node.col });
                if (entry.value instanceof FormulaError) return entry.value;
                return new Matrix([[entry.value]], { row: node.row, col: node.col });
            }
            case "array": return new Matrix(node.rows.map((r) => r.slice()));
            case "un": {
                const v = this.evalNode(node.arg, frame);
                if (node.op === "+") return v;
                if (v instanceof Matrix) return broadcast([v], ([x]) => (x instanceof FormulaError ? x : -toNumber(x)));
                return guard(() => (v instanceof FormulaError ? v : -toNumber(v)));
            }
            case "pct": {
                const v = this.evalNode(node.arg, frame);
                if (v instanceof Matrix) return broadcast([v], ([x]) => (x instanceof FormulaError ? x : toNumber(x) / 100));
                return guard(() => (v instanceof FormulaError ? v : toNumber(v) / 100));
            }
            case "bin": {
                const a = this.evalNode(node.left, frame);
                const b = this.evalNode(node.right, frame);
                if (a instanceof Matrix || b instanceof Matrix) return broadcast([a, b], ([x, y]) => applyBinary(node.op, x, y));
                return guard(() => applyBinary(node.op, a, b));
            }
            case "func": return this.callFunction(node, frame);
            default: return err(ERR.ERROR);
        }
    }

    functionContext(frame) {
        return {
            row: frame.row,
            col: frame.col,
            now: this.now,
            random: frame.random,
            broadcast,
            colName: indexToCol,
            valueAt: (r, c) => this.valueAt(r, c),
            isAggregateCell: (r, c) => {
                const raw = this.cells[getCellId(r, c)]?.value;
                return isFormula(raw) && AGGREGATE_FORMULA_RE.test(raw);
            },
        };
    }

    callFunction(node, frame) {
        const spec = FUNCTIONS[node.name];
        if (!spec) return err(ERR.NAME);
        if (node.args.length < spec.min || node.args.length > spec.max) return err(ERR.VALUE);
        const ctx = this.functionContext(frame);

        if (spec.lazy) return guard(() => spec.fn(node.args, ctx, (n) => this.evalNode(n, frame)));

        const args = node.args.map((a) => {
            if (a.type === "empty") return MISSING;
            if (spec.refs && a.type === "cell") return new Matrix([[this.valueAt(a.row, a.col)]], { row: a.row, col: a.col });
            return this.evalNode(a, frame);
        });

        const liftIdx = spec.lift === true ? args.map((_, i) => i) : spec.lift || [];
        const invoke = (callArgs) => {
            if (!spec.acceptsErrors) {
                for (const i of liftIdx) if (callArgs[i] instanceof FormulaError) return callArgs[i];
            }
            return guard(() => spec.fn(callArgs, ctx));
        };
        const arrayIdx = liftIdx.filter((i) => args[i] instanceof Matrix);
        if (!arrayIdx.length) return invoke(args);

        return broadcast(arrayIdx.map((i) => args[i]), (scalars) => {
            const callArgs = args.slice();
            arrayIdx.forEach((argIndex, k) => { callArgs[argIndex] = scalars[k]; });
            const r = invoke(callArgs);
            return r instanceof Matrix ? toScalar(r) : r;
        });
    }
}

const sameKnown = (a, b) => {
    if (a.spill.size !== b.spill.size || a.blocked.size !== b.blocked.size) return false;
    for (const id of a.blocked) if (!b.blocked.has(id)) return false;
    for (const [id, entry] of a.spill) {
        const other = b.spill.get(id);
        if (!other || other.anchor !== entry.anchor) return false;
        const x = entry.value, y = other.value;
        if (x instanceof FormulaError || y instanceof FormulaError) {
            if (!(x instanceof FormulaError && y instanceof FormulaError && x.code === y.code)) return false;
        } else if (!Object.is(x, y)) return false;
    }
    return true;
};

// Evaluates every formula on a sheet. Array results are laid out in a
// second step (who spills where, and which spills collide); if that changes
// what some formula would have read, the sheet is re-evaluated with the new
// spill layout until it settles — a sheet with no array formulas takes one
// pass.
const evaluateSheetCells = (cells, options = {}) => {
    const opts = { now: options.now ?? nowSerial(), seed: options.seed ?? 0 };
    const positions = new Map();
    const formulaIds = [];
    let maxRow = 0, maxCol = 0;
    for (const id of Object.keys(cells)) {
        const ref = parseCellRef(id);
        if (!ref) continue;
        positions.set(id, ref);
        if (isEmptyRaw(cells[id]?.value)) continue;
        if (ref.row > maxRow) maxRow = ref.row;
        if (ref.col > maxCol) maxCol = ref.col;
        if (isFormula(cells[id].value)) formulaIds.push(id);
    }
    formulaIds.sort((a, b) => {
        const pa = positions.get(a), pb = positions.get(b);
        return pa.row - pb.row || pa.col - pb.col;
    });
    let known = { spill: new Map(), blocked: new Set() };
    let pass = null;
    for (let iteration = 0; iteration < 6; iteration++) {
        // Whole-column/row references (A:A, 1:1) stop at the used range,
        // which includes cells the previous pass spilled into.
        const layout = { positions, maxRow, maxCol };
        for (const id of known.spill.keys()) {
            const ref = parseCellRef(id);
            if (ref.row > layout.maxRow) layout.maxRow = ref.row;
            if (ref.col > layout.maxCol) layout.maxCol = ref.col;
        }
        pass = new EvalPass(cells, layout, known, opts);
        for (const id of formulaIds) pass.evalFormula(id);

        const next = { spill: new Map(), blocked: new Set() };
        for (const id of formulaIds) {
            const entry = pass.memo.get(id);
            if (!entry?.matrix) continue;
            const { row, col } = positions.get(id);
            // Blocked by a typed value in the way — independent of other spills.
            if (pass.isSpillObstructed(row, col, entry.matrix)) continue;
            const targets = [];
            let collides = false;
            entry.matrix.forEach((r, dr) => r.forEach((v, dc) => {
                if (dr === 0 && dc === 0) return;
                const tid = getCellId(row + dr, col + dc);
                if (next.spill.has(tid)) collides = true;
                targets.push([tid, v]);
            }));
            if (collides) { next.blocked.add(id); continue; }
            for (const [tid, v] of targets) next.spill.set(tid, { value: v, anchor: id });
        }
        const settled = sameKnown(next, known);
        known = next;
        if (settled) break;
    }
    return { pass, known };
};

// ---------------------------------------------------------------------------
// Display formatting

const formatNumber = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000));

// Renders a number per the cell's `numberFormat` + `decimalPlaces` (default
// 2). `hint` (from a date/time-returning formula) applies only when the cell
// has no explicit format. 'accounting' reuses the currency rendering — a
// true accounting layout (symbol pinned left, negatives in parens) needs
// column-level layout this per-cell formatter doesn't have.
export const applyNumberFormat = (num, cell, hint = null) => {
    const explicit = cell?.numberFormat && cell.numberFormat !== "general" ? cell.numberFormat : null;
    const fmt = explicit || hint;
    if (!fmt || typeof num !== "number" || isNaN(num)) return formatNumber(num);

    const decimals = cell?.decimalPlaces !== undefined && cell?.decimalPlaces !== null ? cell.decimalPlaces : 2;
    switch (fmt) {
        case "number":
            return num.toFixed(decimals);
        case "comma":
            return num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        case "currency":
        case "accounting":
            return `${num < 0 ? "-" : ""}$${Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
        case "percentage":
            return `${(num * 100).toFixed(decimals)}%`;
        case "scientific":
            return formatWithPattern(num, `0${decimals > 0 ? "." + "0".repeat(decimals) : ""}E+00`);
        case "date":
            return formatWithPattern(num, DATE_FORMAT_PATTERN);
        case "time":
            return formatWithPattern(num, TIME_FORMAT_PATTERN);
        case "datetime":
            return formatWithPattern(num, DATETIME_FORMAT_PATTERN);
        default:
            return formatNumber(num);
    }
};

const displayValue = (value, cell, hint) => {
    if (value instanceof FormulaError) return value.code;
    if (typeof value === "number") return isNaN(value) ? ERR.ERROR : applyNumberFormat(value, cell, hint);
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (value === null || value === undefined) return applyNumberFormat(0, cell, hint);
    return String(value);
};

const rawValue = (value) => (value instanceof FormulaError ? value.code : value ?? 0);

// Evaluates a whole sheet once and returns both views callers need:
//   display — formatted text per cell (what the grid shows), and
//   raw     — evaluated values (numbers stay numbers, errors are "#..." codes).
// Both include cells that only hold spilled values. `options.seed` re-rolls
// RAND/RANDBETWEEN (F9); `options.now` pins TODAY/NOW.
export const evaluateSheet = (cells, options = {}) => {
    const { pass, known } = evaluateSheetCells(cells, options);
    const display = {};
    const raw = {};
    for (const id of Object.keys(cells)) {
        const cell = cells[id];
        const v = cell?.value;
        if (isEmptyRaw(v)) {
            if (!known.spill.has(id)) {
                display[id] = "";
                raw[id] = 0;
            }
            continue;
        }
        if (isFormula(v)) {
            const entry = pass.evalFormula(id);
            display[id] = displayValue(entry.value, cell, entry.hint);
            raw[id] = rawValue(entry.value);
        } else {
            const trimmed = String(v).trim();
            const num = /^-?\d+(\.\d+)?$/.test(trimmed) ? parseFloat(trimmed) : NaN;
            display[id] = isNaN(num) ? String(v) : applyNumberFormat(num, cell);
            raw[id] = isNaN(num) ? v : num;
        }
    }
    for (const [id, { value, anchor }] of known.spill) {
        const hint = pass.memo.get(anchor)?.hint || null;
        display[id] = displayValue(value, cells[id], hint);
        raw[id] = rawValue(value);
    }
    return { display, raw, spillAnchors: new Map([...known.spill].map(([id, s]) => [id, s.anchor])) };
};

export const buildDisplayGrid = (cells, options) => evaluateSheet(cells, options).display;

// Same evaluation as buildDisplayGrid, but returns raw evaluated values
// (a number, or the original string for non-numeric text) instead of the
// formatted display string — e.g. a currency-formatted "$1,234.56" comes
// back as 1234.56. For callers that do arithmetic on cell values (like the
// pivot engine) rather than render them.
export const buildRawValueGrid = (cells, options) => evaluateSheet(cells, options).raw;

// ---------------------------------------------------------------------------
// Formula text utilities

const shiftCellRefText = (text, rowOffset, colOffset) => {
    const p = parseRefParts(text);
    if (!p) return text;
    const col = p.colAbs ? p.col : p.col + colOffset;
    const row = p.rowAbs ? p.row : p.row + rowOffset;
    if (col < 0 || row < 0) return null;
    return `${p.colAbs ? "$" : ""}${indexToCol(col)}${p.rowAbs ? "$" : ""}${row + 1}`;
};

const shiftToken = (tok, rowOffset, colOffset) => {
    if (tok.type === "cell") return shiftCellRefText(tok.text, rowOffset, colOffset) ?? ERR.REF;
    if (tok.type === "range") {
        const parts = tok.text.split(":").map((t) => shiftCellRefText(t, rowOffset, colOffset));
        return parts.includes(null) ? ERR.REF : parts.join(":");
    }
    if (tok.type === "colrange") {
        const parts = tok.text.split(":").map((t) => {
            const abs = t.startsWith("$");
            const idx = colToIndex(t.replace("$", "")) + (abs ? 0 : colOffset);
            return idx < 0 ? null : `${abs ? "$" : ""}${indexToCol(idx)}`;
        });
        return parts.includes(null) ? ERR.REF : parts.join(":");
    }
    if (tok.type === "rowrange") {
        const parts = tok.text.split(":").map((t) => {
            const abs = t.startsWith("$");
            const n = parseInt(t.replace("$", ""), 10) + (abs ? 0 : rowOffset);
            return n < 1 ? null : `${abs ? "$" : ""}${n}`;
        });
        return parts.includes(null) ? ERR.REF : parts.join(":");
    }
    return tok.text;
};

// Shifts every relative reference in a formula by (rowOffset, colOffset),
// leaving $-anchored parts alone — used by fill handle, Ctrl+D/R, and paste.
// Text inside strings and function names (LOG10, ATAN2) is never touched;
// a reference pushed off the top/left edge becomes #REF!, like Excel.
export const adjustFormula = (formula, rowOffset, colOffset) => {
    if (!isFormula(formula)) return formula;
    const eq = formula.indexOf("=");
    let tokens;
    try {
        tokens = lexFormula(formula.slice(eq + 1));
    } catch {
        return formula;
    }
    return formula.slice(0, eq + 1) + tokens.map((t) => shiftToken(t, rowOffset, colOffset)).join("");
};

// Every cell/range reference in a formula with its position — drives the
// colored reference highlighting while editing.
export const extractFormulaReferences = (text) => {
    if (!isFormula(text)) return [];
    const eq = text.indexOf("=");
    let tokens;
    try {
        tokens = lexFormula(text.slice(eq + 1), eq + 1);
    } catch {
        return [];
    }
    return tokens
        .filter((t) => t.type === "cell" || t.type === "range")
        .map((t) => ({ text: t.text, start: t.start, end: t.end, key: t.text.toUpperCase().replace(/\$/g, "") }));
};

// F4: cycles the reference under/just before the caret through
// A1 -> $A$1 -> A$1 -> $A1 -> A1. Returns { text, start, end } with the new
// reference's span, or null when the caret isn't on a reference.
export const cycleReferenceAt = (text, caret) => {
    if (!isFormula(text)) return null;
    const eq = text.indexOf("=");
    let tokens;
    try {
        tokens = lexFormula(text.slice(eq + 1), eq + 1);
    } catch {
        return null;
    }
    const tok = tokens.find((t) => ["cell", "range", "colrange", "rowrange"].includes(t.type) && t.start <= caret && caret <= t.end);
    if (!tok) return null;

    const nextState = (colAbs, rowAbs) => {
        if (!colAbs && !rowAbs) return [true, true];
        if (colAbs && rowAbs) return [false, true];
        if (!colAbs && rowAbs) return [true, false];
        return [false, false];
    };
    const setCell = (t, [colAbs, rowAbs]) => {
        const p = parseRefParts(t);
        return `${colAbs ? "$" : ""}${indexToCol(p.col)}${rowAbs ? "$" : ""}${p.row + 1}`;
    };

    let replacement;
    const parts = tok.text.split(":");
    if (tok.type === "cell" || tok.type === "range") {
        const first = parseRefParts(parts[0]);
        const state = nextState(first.colAbs, first.rowAbs);
        replacement = parts.map((p) => setCell(p, state)).join(":");
    } else {
        const abs = !parts[0].startsWith("$");
        replacement = parts.map((p) => `${abs ? "$" : ""}${p.replace("$", "").toUpperCase()}`).join(":");
    }
    return {
        text: text.slice(0, tok.start) + replacement + text.slice(tok.end),
        start: tok.start,
        end: tok.start + replacement.length,
    };
};

export { formatGeneral };
