// Conditional formatting: the rule model and the pure evaluation pass that
// turns a sheet's rules plus its evaluated values into per-cell effects.
//
// A rule:
//   { id, type, ranges: [{ start, end }], stopIfTrue?, format?, ...params }
// Rules are stored in priority order — the first rule wins where two rules set
// the same property, and a matching `stopIfTrue` rule hides the ones below it.
//
//   type          params
//   cellIs        operator (gt|lt|gte|lte|eq|neq|between|notBetween), value, value2
//   text          operator (contains|notContains|beginsWith|endsWith), text
//   date          period (yesterday|today|tomorrow|last7Days|lastWeek|thisWeek|
//                 nextWeek|lastMonth|thisMonth|nextMonth)
//   duplicate, unique, blanks, noBlanks, errors, noErrors
//   top           bottom, rank, percent
//   average       mode (above|below|equalAbove|equalBelow)
//   dataBar       color, gradient
//   colorScale    colors: [min, max] or [min, mid, max]
//   iconSet       set (a key of ICON_SETS), reverse
//
// `format` is { bg, color, bold, italic, underline, strike, borderColor }.

import { parseCellRef, getCellId } from "./formulaEngine.js";
import { parseDateTimeText, dateToSerial, serialToParts, nowSerial } from "./formulaValues.js";

export const VISUAL_RULE_TYPES = new Set(["dataBar", "colorScale", "iconSet"]);

// Each icon is [shape, colour]; index 0 is shown for the highest values.
const G = "#3f9c35", Y = "#e6a700", R = "#d13438", K = "#404040", S = "#8a8a8a", B = "#2a78d6";
export const ICON_SETS = {
    "3Arrows": { label: "3 Arrows (Colored)", group: "Directional", icons: [["arrowUp", G], ["arrowRight", Y], ["arrowDown", R]] },
    "3ArrowsGray": { label: "3 Arrows (Gray)", group: "Directional", icons: [["arrowUp", S], ["arrowRight", S], ["arrowDown", S]] },
    "3Triangles": { label: "3 Triangles", group: "Directional", icons: [["triangleUp", G], ["dash", Y], ["triangleDown", R]] },
    "4Arrows": { label: "4 Arrows (Colored)", group: "Directional", icons: [["arrowUp", G], ["arrowUpRight", Y], ["arrowDownRight", Y], ["arrowDown", R]] },
    "5Arrows": { label: "5 Arrows (Colored)", group: "Directional", icons: [["arrowUp", G], ["arrowUpRight", Y], ["arrowRight", Y], ["arrowDownRight", Y], ["arrowDown", R]] },
    "3TrafficLights": { label: "3 Traffic Lights", group: "Shapes", icons: [["circle", G], ["circle", Y], ["circle", R]] },
    "3Signs": { label: "3 Signs", group: "Shapes", icons: [["circle", G], ["triangleUp", Y], ["diamond", R]] },
    "4TrafficLights": { label: "4 Traffic Lights", group: "Shapes", icons: [["circle", G], ["circle", Y], ["circle", R], ["circle", K]] },
    "3Symbols": { label: "3 Symbols (Circled)", group: "Indicators", icons: [["check", G], ["exclaim", Y], ["cross", R]] },
    "3Flags": { label: "3 Flags", group: "Indicators", icons: [["flag", G], ["flag", Y], ["flag", R]] },
    "3Stars": { label: "3 Stars", group: "Ratings", icons: [["star", Y], ["starHalf", Y], ["starEmpty", Y]] },
    "4Rating": { label: "4 Ratings", group: "Ratings", icons: [["bars4", B], ["bars3", B], ["bars2", B], ["bars1", B]] },
    "5Rating": { label: "5 Ratings", group: "Ratings", icons: [["bars4", B], ["bars3", B], ["bars2", B], ["bars1", B], ["bars0", B]] },
    "5Quarters": { label: "5 Quarters", group: "Ratings", icons: [["pie4", K], ["pie3", K], ["pie2", K], ["pie1", K], ["pie0", K]] },
};

let idCounter = 0;
export const newRuleId = () => `cf-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

// What a rule of each type starts with in the rule dialog, and the type each
// of the dialog's rule categories opens on.
export const TYPE_DEFAULTS = {
    colorScale: { colors: ["#f8696b", "#63be7b"] },
    dataBar: { color: "#638ec6", gradient: true },
    iconSet: { set: "3Arrows" },
    cellIs: { operator: "between", value: "", value2: "" },
    text: { operator: "contains", text: "" },
    date: { period: "yesterday" },
    top: { rank: 10 },
    average: { mode: "above" },
};
export const CATEGORY_DEFAULT_TYPE = { values: "colorScale", contain: "cellIs", rank: "top", average: "average", unique: "duplicate" };

// A blank rule for the dialog. `preset` is a category ("rank") or, for the
// value-based styles, "values:<type>".
export const blankRule = (preset) => {
    const [category, type] = String(preset || "contain").split(":");
    const ruleType = type || CATEGORY_DEFAULT_TYPE[category] || "cellIs";
    return { type: ruleType, ...TYPE_DEFAULTS[ruleType], format: {} };
};

const LEGACY_OPERATORS ={ ">": "gt", "<": "lt", ">=": "gte", "<=": "lte", "=": "eq" };

// Sheets saved before the rule model carry { range: [start, end], operator,
// threshold, color }, where the last matching rule won and numbers were read
// off the displayed text. They're converted on read (`byDisplay` keeps the old
// number reading) and listed last-first so the same rule still wins.
export const normalizeRules = (rules) => {
    if (!Array.isArray(rules) || rules.length === 0) return [];
    if (rules.every((r) => r && r.type)) return rules;
    const modern = [], legacy = [];
    rules.forEach((r, i) => {
        if (!r) return;
        if (r.type) { modern.push(r); return; }
        if (!Array.isArray(r.range)) return;
        legacy.push({
            id: `cf-legacy-${i}`,
            type: "cellIs",
            operator: LEGACY_OPERATORS[r.operator] || "eq",
            value: String(r.threshold),
            byDisplay: true,
            ranges: [{ start: r.range[0], end: r.range[1] }],
            format: { bg: r.color },
        });
    });
    return [...modern, ...legacy.reverse()];
};

// --- Ranges ---

export const boundsOfRange = (range) => {
    const s = parseCellRef(range?.start || ""), e = parseCellRef(range?.end || "");
    if (!s || !e) return null;
    return {
        minRow: Math.min(s.row, e.row), maxRow: Math.max(s.row, e.row),
        minCol: Math.min(s.col, e.col), maxCol: Math.max(s.col, e.col),
    };
};
export const rangeOfBounds = (b) => ({ start: getCellId(b.minRow, b.minCol), end: getCellId(b.maxRow, b.maxCol) });

const intersects = (a, b) => a.minRow <= b.maxRow && a.maxRow >= b.minRow && a.minCol <= b.maxCol && a.maxCol >= b.minCol;

export const ruleTouchesBounds = (rule, boundsList) =>
    (rule.ranges || []).some((range) => {
        const rb = boundsOfRange(range);
        return rb && boundsList.some((b) => intersects(rb, b));
    });

// `a` with `cut` removed, as up to four rectangles.
const subtractBounds = (a, cut) => {
    if (!intersects(a, cut)) return [a];
    const out = [];
    if (cut.minRow > a.minRow) out.push({ ...a, maxRow: cut.minRow - 1 });
    if (cut.maxRow < a.maxRow) out.push({ ...a, minRow: cut.maxRow + 1 });
    const minRow = Math.max(a.minRow, cut.minRow), maxRow = Math.min(a.maxRow, cut.maxRow);
    if (cut.minCol > a.minCol) out.push({ minRow, maxRow, minCol: a.minCol, maxCol: cut.minCol - 1 });
    if (cut.maxCol < a.maxCol) out.push({ minRow, maxRow, minCol: cut.maxCol + 1, maxCol: a.maxCol });
    return out;
};

// Removes the given areas from every rule; a rule left with no cells is dropped.
export const clearRulesFromBounds = (rules, boundsList) =>
    rules.flatMap((rule) => {
        let pieces = (rule.ranges || []).map(boundsOfRange).filter(Boolean);
        for (const cut of boundsList) pieces = pieces.flatMap((p) => subtractBounds(p, cut));
        return pieces.length ? [{ ...rule, ranges: pieces.map(rangeOfBounds) }] : [];
    });

// "A1:B5, D2" (Excel's "=$A$1:$B$5" is accepted too) -> ranges, or null when unreadable.
export const parseRangesText = (text) => {
    const parts = String(text || "").toUpperCase().replace(/[=$\s]/g, "").split(/[,;]/).filter(Boolean);
    if (!parts.length) return null;
    const ranges = [];
    for (const part of parts) {
        const [a, b = a] = part.split(":");
        const bounds = boundsOfRange({ start: a, end: b });
        if (!bounds) return null;
        ranges.push(rangeOfBounds(bounds));
    }
    return ranges;
};
export const formatRangesText = (ranges) =>
    (ranges || []).map((r) => (r.start === r.end ? r.start : `${r.start}:${r.end}`)).join(", ");

// --- Descriptions (Rules Manager "Rule" column) ---

const CELL_IS_TEXT = {
    gt: "Cell Value >", lt: "Cell Value <", gte: "Cell Value >=", lte: "Cell Value <=", eq: "Cell Value =", neq: "Cell Value <>",
};
const TEXT_OP_TEXT = { contains: "contains", notContains: "does not contain", beginsWith: "begins with", endsWith: "ends with" };
export const DATE_PERIODS = [
    ["yesterday", "Yesterday"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["last7Days", "In the last 7 days"],
    ["lastWeek", "Last week"], ["thisWeek", "This week"], ["nextWeek", "Next week"],
    ["lastMonth", "Last month"], ["thisMonth", "This month"], ["nextMonth", "Next month"],
];
const AVERAGE_TEXT = { above: "Above Average", below: "Below Average", equalAbove: "Equal or Above Average", equalBelow: "Equal or Below Average" };

export const describeRule = (rule) => {
    switch (rule.type) {
        case "cellIs":
            if (rule.operator === "between") return `Cell Value between ${rule.value} and ${rule.value2}`;
            if (rule.operator === "notBetween") return `Cell Value not between ${rule.value} and ${rule.value2}`;
            return `${CELL_IS_TEXT[rule.operator] || "Cell Value ="} ${rule.value}`;
        case "text": return `Cell Value ${TEXT_OP_TEXT[rule.operator] || "contains"} "${rule.text}"`;
        case "date": return (DATE_PERIODS.find(([key]) => key === rule.period) || DATE_PERIODS[1])[1];
        case "duplicate": return "Duplicate Values";
        case "unique": return "Unique Values";
        case "blanks": return "Blanks";
        case "noBlanks": return "No Blanks";
        case "errors": return "Errors";
        case "noErrors": return "No Errors";
        case "top": return `${rule.bottom ? "Bottom" : "Top"} ${rule.rank}${rule.percent ? "%" : ""}`;
        case "average": return AVERAGE_TEXT[rule.mode] || AVERAGE_TEXT.above;
        case "dataBar": return "Data Bar";
        case "colorScale": return "Graded Color Scale";
        case "iconSet": return "Icon Set";
        default: return "Rule";
    }
};

// --- Evaluation ---

const ERROR_RE = /^#(DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|VALUE!|SPILL!|CALC!|ERROR!?)/;
const NUMERIC_RE = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const DATE_FORMAT_RE = /[dy]/i;

const hexToRgb = (hex) => {
    const h = String(hex || "").replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
    const n = parseInt(full.slice(0, 6), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixColors = (from, to, t) => {
    const a = hexToRgb(from), b = hexToRgb(to);
    return `#${a.map((c, i) => Math.round(c + (b[i] - c) * t).toString(16).padStart(2, "0")).join("")}`;
};

const startOfWeek = (serial) => serial - serialToParts(serial).weekday;
const monthBounds = (serial, offset) => {
    const { year, month } = serialToParts(serial);
    return [dateToSerial(year, month + offset, 1), dateToSerial(year, month + offset + 1, 1) - 1];
};
const datePeriodBounds = (period, today) => {
    switch (period) {
        case "yesterday": return [today - 1, today - 1];
        case "tomorrow": return [today + 1, today + 1];
        case "last7Days": return [today - 6, today];
        case "lastWeek": return [startOfWeek(today) - 7, startOfWeek(today) - 1];
        case "thisWeek": return [startOfWeek(today), startOfWeek(today) + 6];
        case "nextWeek": return [startOfWeek(today) + 7, startOfWeek(today) + 13];
        case "lastMonth": return monthBounds(today, -1);
        case "thisMonth": return monthBounds(today, 0);
        case "nextMonth": return monthBounds(today, 1);
        default: return [today, today];
    }
};

// Above this many cells a rule's range is walked through the sheet's filled
// cells instead of cell by cell, so a whole-column rule stays cheap.
const DENSE_RANGE_LIMIT = 20000;

// Returns { [cellId]: { style?, dataBar?, icon? } } for every cell a rule affects.
//   display / raw : the evaluated grids (formatted text / number-or-string)
//   cells         : the sheet's stored cells (for their number formats)
//   today         : whole-day serial, for the date rules
export const computeConditionalFormats = (rules, { display, raw, cells = {}, today = Math.floor(nowSerial()) }) => {
    const result = {};
    const list = normalizeRules(rules);
    if (!list.length) return result;

    let filled = null;
    const filledCells = () => {
        if (!filled) {
            filled = [];
            for (const id of Object.keys(display)) {
                const ref = parseCellRef(id);
                if (ref) filled.push({ id, row: ref.row, col: ref.col });
            }
        }
        return filled;
    };

    const entryFor = (id, rule) => {
        const text = display[id];
        const shown = text === undefined || text === null ? "" : String(text);
        const value = raw[id];
        const blank = shown === "";
        const error = !blank && ERROR_RE.test(shown);
        let num = null;
        if (!blank && !error) {
            if (rule.byDisplay) {
                const parsed = parseFloat(shown.replace(/[$,%]/g, ""));
                if (!isNaN(parsed)) num = parsed;
            } else if (typeof value === "number" && Number.isFinite(value)) num = value;
        }
        return { id, shown, value, blank, error, num };
    };

    const stopped = new Set();

    for (const rule of list) {
        const seen = new Set();
        const entries = [];
        for (const range of rule.ranges || []) {
            const b = boundsOfRange(range);
            if (!b) continue;
            const area = (b.maxRow - b.minRow + 1) * (b.maxCol - b.minCol + 1);
            if (area > DENSE_RANGE_LIMIT) {
                for (const c of filledCells()) {
                    if (c.row < b.minRow || c.row > b.maxRow || c.col < b.minCol || c.col > b.maxCol || seen.has(c.id)) continue;
                    seen.add(c.id);
                    entries.push(entryFor(c.id, rule));
                }
            } else {
                for (let r = b.minRow; r <= b.maxRow; r++) {
                    for (let c = b.minCol; c <= b.maxCol; c++) {
                        const id = getCellId(r, c);
                        if (seen.has(id)) continue;
                        seen.add(id);
                        entries.push(entryFor(id, rule));
                    }
                }
            }
        }
        if (!entries.length) continue;

        const effectFor = (id) => (result[id] || (result[id] = {}));
        const numbers = () => entries.filter((e) => e.num !== null).map((e) => e.num);

        if (rule.type === "dataBar") {
            const nums = numbers();
            const maxAbs = nums.reduce((m, n) => Math.max(m, Math.abs(n)), 0);
            for (const e of entries) {
                if (e.num === null || stopped.has(e.id)) continue;
                const effect = effectFor(e.id);
                if (effect.dataBar) continue;
                effect.dataBar = {
                    pct: maxAbs ? Math.abs(e.num) / maxAbs : 0,
                    color: e.num < 0 ? "#e34948" : rule.color || "#638ec6",
                    gradient: !!rule.gradient,
                };
            }
            continue;
        }

        if (rule.type === "colorScale") {
            const nums = numbers().sort((a, b) => a - b);
            if (!nums.length) continue;
            const colors = Array.isArray(rule.colors) && rule.colors.length >= 2 ? rule.colors : ["#f8696b", "#63be7b"];
            const lo = nums[0], hi = nums[nums.length - 1];
            const midPos = (nums.length - 1) / 2;
            const mid = (nums[Math.floor(midPos)] + nums[Math.ceil(midPos)]) / 2;
            for (const e of entries) {
                if (e.num === null || stopped.has(e.id)) continue;
                const effect = effectFor(e.id);
                const style = effect.style || (effect.style = {});
                if (style.bg !== undefined) continue;
                if (hi === lo) { style.bg = colors[colors.length - 1]; continue; }
                if (colors.length === 2) style.bg = mixColors(colors[0], colors[1], (e.num - lo) / (hi - lo));
                else if (e.num <= mid) style.bg = mid === lo ? colors[1] : mixColors(colors[0], colors[1], (e.num - lo) / (mid - lo));
                else style.bg = mixColors(colors[1], colors[2], (e.num - mid) / (hi - mid));
            }
            continue;
        }

        if (rule.type === "iconSet") {
            const set = ICON_SETS[rule.set] || ICON_SETS["3Arrows"];
            const nums = numbers();
            if (!nums.length) continue;
            const lo = Math.min(...nums), hi = Math.max(...nums);
            const count = set.icons.length;
            for (const e of entries) {
                if (e.num === null || stopped.has(e.id)) continue;
                const effect = effectFor(e.id);
                if (effect.icon) continue;
                // Bands split the value range evenly; the top band gets icon 0.
                const pct = hi === lo ? 1 : (e.num - lo) / (hi - lo);
                let index = count - 1 - Math.min(count - 1, Math.floor(pct * count + 1e-9));
                if (rule.reverse) index = count - 1 - index;
                effect.icon = { set: rule.set in ICON_SETS ? rule.set : "3Arrows", index };
            }
            continue;
        }

        // The remaining types decide match / no match, then apply `format`.
        let matches;
        switch (rule.type) {
            case "cellIs": {
                const resolve = (v) => {
                    const text = String(v ?? "").trim();
                    if (text.startsWith("=")) {
                        const ref = text.slice(1).replace(/\$/g, "").toUpperCase();
                        if (parseCellRef(ref)) {
                            const refRaw = raw[ref];
                            return typeof refRaw === "number" ? refRaw : String(display[ref] ?? "");
                        }
                        return text.slice(1).replace(/^"|"$/g, "");
                    }
                    return NUMERIC_RE.test(text) ? parseFloat(text) : text;
                };
                const a = resolve(rule.value), b = resolve(rule.value2);
                const compare = (e, target) => {
                    if (typeof target === "number") return e.num === null ? null : e.num - target;
                    if (e.blank || e.error) return null;
                    return e.shown.toLowerCase().localeCompare(String(target).toLowerCase());
                };
                matches = (e) => {
                    const ca = compare(e, a);
                    if (rule.operator === "between" || rule.operator === "notBetween") {
                        const cb = compare(e, b);
                        if (ca === null || cb === null) return false;
                        const inside = (ca >= 0 && cb <= 0) || (ca <= 0 && cb >= 0);
                        return rule.operator === "between" ? inside : !inside;
                    }
                    if (ca === null) return rule.operator === "neq" && !e.blank;
                    switch (rule.operator) {
                        case "gt": return ca > 0;
                        case "lt": return ca < 0;
                        case "gte": return ca >= 0;
                        case "lte": return ca <= 0;
                        case "neq": return ca !== 0;
                        default: return ca === 0;
                    }
                };
                break;
            }
            case "text": {
                const needle = String(rule.text ?? "").toLowerCase();
                matches = (e) => {
                    if (!needle || e.error) return false;
                    const hay = e.shown.toLowerCase();
                    switch (rule.operator) {
                        case "notContains": return !hay.includes(needle);
                        case "beginsWith": return hay.startsWith(needle);
                        case "endsWith": return hay.endsWith(needle);
                        default: return hay.includes(needle);
                    }
                };
                break;
            }
            case "date": {
                const [from, to] = datePeriodBounds(rule.period, today);
                matches = (e) => {
                    if (e.blank || e.error) return false;
                    let serial = null;
                    if (typeof e.value === "string") serial = parseDateTimeText(e.value.trim());
                    else if (e.num !== null) {
                        const cell = cells[e.id];
                        const format = cell?.numberFormat;
                        if (format === "date" || format === "datetime" || (cell?.numberPattern && DATE_FORMAT_RE.test(cell.numberPattern))) serial = e.num;
                    }
                    if (serial === null || serial === undefined) return false;
                    const day = Math.floor(serial);
                    return day >= from && day <= to;
                };
                break;
            }
            case "duplicate":
            case "unique": {
                const keyOf = (e) => (e.num !== null ? `n:${e.num}` : `s:${e.shown.toLowerCase()}`);
                const counts = new Map();
                for (const e of entries) if (!e.blank) counts.set(keyOf(e), (counts.get(keyOf(e)) || 0) + 1);
                matches = (e) => !e.blank && (counts.get(keyOf(e)) > 1) === (rule.type === "duplicate");
                break;
            }
            case "blanks": matches = (e) => e.shown.trim() === ""; break;
            case "noBlanks": matches = (e) => e.shown.trim() !== ""; break;
            case "errors": matches = (e) => e.error; break;
            case "noErrors": matches = (e) => !e.error; break;
            case "top": {
                const nums = numbers().sort((x, y) => (rule.bottom ? x - y : y - x));
                const rank = Math.max(1, Math.floor(Number(rule.rank) || 10));
                const take = rule.percent ? Math.max(1, Math.floor((nums.length * Math.min(100, rank)) / 100)) : Math.min(rank, nums.length);
                const cutoff = nums.length ? nums[take - 1] : null;
                matches = (e) => cutoff !== null && e.num !== null && (rule.bottom ? e.num <= cutoff : e.num >= cutoff);
                break;
            }
            case "average": {
                const nums = numbers();
                const mean = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
                matches = (e) => {
                    if (mean === null || e.num === null) return false;
                    switch (rule.mode) {
                        case "below": return e.num < mean;
                        case "equalAbove": return e.num >= mean;
                        case "equalBelow": return e.num <= mean;
                        default: return e.num > mean;
                    }
                };
                break;
            }
            default: matches = () => false;
        }

        const format = rule.format || {};
        for (const e of entries) {
            if (stopped.has(e.id) || !matches(e)) continue;
            const effect = effectFor(e.id);
            const style = effect.style || (effect.style = {});
            for (const key of ["bg", "color", "bold", "italic", "underline", "strike", "borderColor"]) {
                if (style[key] === undefined && format[key] !== undefined && format[key] !== null && format[key] !== "") style[key] = format[key];
            }
            if (rule.stopIfTrue) stopped.add(e.id);
        }
    }
    return result;
};
