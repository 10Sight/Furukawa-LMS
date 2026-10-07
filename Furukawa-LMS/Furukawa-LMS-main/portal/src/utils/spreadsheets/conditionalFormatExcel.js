// Conditional formatting <-> Excel files. Converts between this app's rules
// (see conditionalFormat.js) and the rule objects ExcelJS reads from / writes to
// a worksheet (`worksheet.conditionalFormattings`, `addConditionalFormatting`).
//
// ExcelJS neither reads nor writes a rule's "Stop If True" flag, so that one
// attribute is carried through the workbook's XML directly (readStopIfTrue /
// writeStopIfTrue, both given a JSZip of the .xlsx).

import { parseCellRef, getCellId, indexToCol } from "./formulaEngine.js";
import { ICON_SETS, VISUAL_RULE_TYPES, boundsOfRange, rangeOfBounds, normalizeRules, newRuleId } from "./conditionalFormat.js";

const EXCEL_MAX_ROW = 1048575; // zero-based
const EXCEL_MAX_COL = 16383;

const CELL_IS_FROM_EXCEL = {
    greaterThan: "gt", lessThan: "lt", greaterThanOrEqual: "gte", lessThanOrEqual: "lte",
    equal: "eq", notEqual: "neq", between: "between", notBetween: "notBetween",
};
const CELL_IS_TO_EXCEL = Object.fromEntries(Object.entries(CELL_IS_FROM_EXCEL).map(([excel, own]) => [own, excel]));

// Excel's icon sets -> the closest of this app's.
const ICON_SET_FROM_EXCEL = {
    "3Arrows": "3Arrows", "3ArrowsGray": "3ArrowsGray", "3Flags": "3Flags", "3TrafficLights": "3TrafficLights",
    "3TrafficLights1": "3TrafficLights", "3TrafficLights2": "3TrafficLights", "3Signs": "3Signs", "3Symbols": "3Symbols",
    "3Symbols2": "3Symbols", "3Stars": "3Stars", "3Triangles": "3Triangles", "4Arrows": "4Arrows", "4ArrowsGray": "4Arrows",
    "4RedToBlack": "4TrafficLights", "4Rating": "4Rating", "4TrafficLights": "4TrafficLights", "5Arrows": "5Arrows",
    "5ArrowsGray": "5Arrows", "5Rating": "5Rating", "5Quarters": "5Quarters", "5Boxes": "5Rating",
};
const ICON_SET_BY_COUNT = { 3: "3TrafficLights", 4: "4TrafficLights", 5: "5Arrows" };
const POINT_TYPES = new Set(["min", "max", "num", "percent", "percentile"]);
const DATE_PERIODS = new Set(["yesterday", "today", "tomorrow", "last7Days", "lastWeek", "thisWeek", "nextWeek", "lastMonth", "thisMonth", "nextMonth"]);

const NUMERIC_RE = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const STRING_LITERAL_RE = /^"((?:[^"]|"")*)"$/;
const FIRST_STRING_RE = /"((?:[^"]|"")*)"/;

// --- Ranges ---

// One sqref part ("A1", "A1:C9", "B:D", "2:5") -> a range, or null.
const rangeOfRefPart = (part) => {
    const [a, b = a] = part.replace(/\$/g, "").toUpperCase().split(":");
    if (/^[A-Z]+$/.test(a) && /^[A-Z]+$/.test(b)) {
        const s = parseCellRef(`${a}1`), e = parseCellRef(`${b}1`);
        return s && e ? rangeOfBounds({ minRow: 0, maxRow: EXCEL_MAX_ROW, minCol: Math.min(s.col, e.col), maxCol: Math.max(s.col, e.col) }) : null;
    }
    if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
        const r1 = Number(a) - 1, r2 = Number(b) - 1;
        return rangeOfBounds({ minRow: Math.min(r1, r2), maxRow: Math.max(r1, r2), minCol: 0, maxCol: EXCEL_MAX_COL });
    }
    const bounds = boundsOfRange({ start: a, end: b });
    return bounds ? rangeOfBounds(bounds) : null;
};
const rangesOfRef = (ref) => String(ref || "").trim().split(/\s+/).filter(Boolean).map(rangeOfRefPart).filter(Boolean);
const refOfRanges = (ranges) => ranges.map((r) => (r.start === r.end ? r.start : `${r.start}:${r.end}`)).join(" ");
const absoluteRef = (range) => {
    const b = boundsOfRange(range);
    const cell = (row, col) => `$${indexToCol(col)}$${row + 1}`;
    return `${cell(b.minRow, b.minCol)}:${cell(b.maxRow, b.maxCol)}`;
};

// --- Colours and formats ---

const defaultColor = (colorObj) => (colorObj?.argb ? `#${String(colorObj.argb).slice(-6).toLowerCase()}` : null);
const argbOf = (hex) => {
    const h = String(hex || "").replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
    return { argb: `FF${full.toUpperCase()}` };
};

const formatFromStyle = (style, resolveColor) => {
    const format = {};
    if (!style) return format;
    const fill = style.fill;
    if (fill && fill.type === "pattern" && fill.pattern !== "none") {
        // A differential fill keeps a solid colour in bgColor; fgColor is the fallback.
        const bg = resolveColor(fill.bgColor) || resolveColor(fill.fgColor);
        if (bg) format.bg = bg;
    }
    const font = style.font;
    if (font) {
        const color = resolveColor(font.color);
        if (color) format.color = color;
        if (font.bold) format.bold = true;
        if (font.italic) format.italic = true;
        if (font.underline && font.underline !== "none") format.underline = true;
        if (font.strike) format.strike = true;
    }
    const side = style.border && ["top", "bottom", "left", "right"].map((key) => style.border[key]).find((s) => s && s.style);
    if (side) format.borderColor = resolveColor(side.color) || "#000000";
    return format;
};

const styleFromFormat = (format) => {
    const style = {};
    if (!format) return style;
    if (format.bg) style.fill = { type: "pattern", pattern: "solid", bgColor: argbOf(format.bg) };
    const font = {};
    if (format.color) font.color = argbOf(format.color);
    if (format.bold) font.bold = true;
    if (format.italic) font.italic = true;
    if (format.underline) font.underline = true;
    if (format.strike) font.strike = true;
    if (Object.keys(font).length) style.font = font;
    if (format.borderColor) {
        const side = { style: "thin", color: argbOf(format.borderColor) };
        style.border = { top: side, bottom: side, left: side, right: side };
    }
    return style;
};

// --- Values and cut-off points ---

// A cellIs operand from Excel (a formula body) -> this app's rule value.
const valueFromOperand = (operand) => {
    const text = String(operand ?? "").trim();
    if (NUMERIC_RE.test(text)) return text;
    const literal = STRING_LITERAL_RE.exec(text);
    if (literal) return literal[1].replace(/""/g, '"');
    return `=${text}`;
};
const operandFromValue = (value) => {
    const text = String(value ?? "").trim();
    if (text.startsWith("=")) return text.slice(1);
    if (NUMERIC_RE.test(text)) return Number(text);
    return `"${text.replace(/"/g, '""')}"`;
};
const quoted = (text) => `"${String(text ?? "").replace(/"/g, '""')}"`;
const textFromRule = (rule) => {
    if (typeof rule.text === "string" && rule.text !== "") return rule.text;
    const match = FIRST_STRING_RE.exec(String(rule.formulae?.[0] ?? ""));
    return match ? match[1].replace(/""/g, '"') : "";
};

// Excel's cfvo list -> points, or undefined when any of them can't be represented.
const pointsFromCfvo = (cfvo) => {
    if (!Array.isArray(cfvo) || !cfvo.length) return undefined;
    const points = cfvo.map((v) => {
        const type = v?.type === "autoMin" ? "min" : v?.type === "autoMax" ? "max" : v?.type;
        if (!POINT_TYPES.has(type)) return null;
        if (type === "min" || type === "max") return { type };
        const value = Number(v.value);
        return Number.isFinite(value) ? { type, value, ...(v.gte === false ? { gte: false } : null) } : null;
    });
    return points.includes(null) ? undefined : points;
};
const cfvoFromPoints = (points) => points.map((p) => (p.type === "min" || p.type === "max" ? { type: p.type } : { type: p.type, value: p.value }));
const isPlainMinMax = (points) => points.length === 2 && points[0].type === "min" && points[1].type === "max";
const defaultIconPoints = (count) => Array.from({ length: count }, (_, i) => ({ type: "percent", value: Math.round((100 * i) / count) }));

// --- Excel -> app ---

const ruleFromExcel = (excelRule, resolveColor) => {
    const format = formatFromStyle(excelRule.style, resolveColor);
    switch (excelRule.type) {
        case "expression": {
            const body = String(excelRule.formulae?.[0] ?? "").trim();
            return body ? { type: "formula", formula: `=${body}`, format } : null;
        }
        case "cellIs": {
            const operator = CELL_IS_FROM_EXCEL[excelRule.operator];
            if (!operator || excelRule.formulae?.[0] === undefined) return null;
            const two = operator === "between" || operator === "notBetween";
            if (two && excelRule.formulae[1] === undefined) return null;
            return { type: "cellIs", operator, value: valueFromOperand(excelRule.formulae[0]), ...(two ? { value2: valueFromOperand(excelRule.formulae[1]) } : null), format };
        }
        case "top10":
            return { type: "top", rank: Math.max(1, Math.floor(Number(excelRule.rank) || 10)), ...(excelRule.bottom ? { bottom: true } : null), ...(excelRule.percent ? { percent: true } : null), format };
        case "aboveAverage": {
            const above = excelRule.aboveAverage !== false;
            const mode = excelRule.equalAverage ? (above ? "equalAbove" : "equalBelow") : above ? "above" : "below";
            return { type: "average", mode, format };
        }
        case "containsText":
            switch (excelRule.operator) {
                case "containsBlanks": return { type: "blanks", format };
                case "notContainsBlanks": return { type: "noBlanks", format };
                case "containsErrors": return { type: "errors", format };
                case "notContainsErrors": return { type: "noErrors", format };
                default: return { type: "text", operator: "contains", text: textFromRule(excelRule), format };
            }
        case "notContainsText": return { type: "text", operator: "notContains", text: textFromRule(excelRule), format };
        case "beginsWith": return { type: "text", operator: "beginsWith", text: textFromRule(excelRule), format };
        case "endsWith": return { type: "text", operator: "endsWith", text: textFromRule(excelRule), format };
        case "containsBlanks": return { type: "blanks", format };
        case "notContainsBlanks": return { type: "noBlanks", format };
        case "containsErrors": return { type: "errors", format };
        case "notContainsErrors": return { type: "noErrors", format };
        case "timePeriod": return DATE_PERIODS.has(excelRule.timePeriod) ? { type: "date", period: excelRule.timePeriod, format } : null;
        case "duplicateValues": return { type: "duplicate", format };
        case "uniqueValues": return { type: "unique", format };
        case "colorScale": {
            const colors = (excelRule.color || []).map(resolveColor);
            if (colors.length < 2 || colors.length > 3 || colors.some((c) => !c)) return null;
            const points = pointsFromCfvo(excelRule.cfvo);
            const usePoints = points && points.length === colors.length;
            return { type: "colorScale", colors, ...(usePoints ? { points } : null) };
        }
        case "iconSet": {
            const count = excelRule.cfvo?.length || 3;
            const set = ICON_SET_FROM_EXCEL[excelRule.iconSet || "3TrafficLights"] || ICON_SET_BY_COUNT[count];
            if (!set) return null;
            const points = pointsFromCfvo(excelRule.cfvo);
            const usePoints = points && points.length === ICON_SETS[set].icons.length;
            return { type: "iconSet", set, ...(excelRule.reverse ? { reverse: true } : null), ...(usePoints ? { points } : null) };
        }
        case "dataBar": {
            const points = pointsFromCfvo(excelRule.cfvo);
            const usePoints = points && points.length === 2 && !isPlainMinMax(points);
            return { type: "dataBar", color: resolveColor(excelRule.color) || "#638ec6", gradient: excelRule.gradient !== false, ...(usePoints ? { points } : null) };
        }
        default: return null;
    }
};

// A worksheet's conditional formatting as this app's rules, highest priority first.
//   conditionalFormattings : ExcelJS's `worksheet.conditionalFormattings`
//   resolveColor           : ExcelJS colour object -> "#rrggbb" (handles theme colours)
//   stopIfTrue             : Set of rule priorities flagged Stop If True (see readStopIfTrue)
// Returns { rules, skipped } — `skipped` counts rules with no equivalent here.
export const rulesFromExcel = (conditionalFormattings, { resolveColor = defaultColor, stopIfTrue = null } = {}) => {
    const found = [];
    let skipped = 0, order = 0;
    for (const block of conditionalFormattings || []) {
        const ranges = rangesOfRef(block?.ref);
        for (const excelRule of block?.rules || []) {
            order += 1;
            const rule = ranges.length ? ruleFromExcel(excelRule, resolveColor) : null;
            if (!rule) { skipped += 1; continue; }
            const priority = Number(excelRule.priority);
            if (stopIfTrue?.has(priority) && !VISUAL_RULE_TYPES.has(rule.type)) rule.stopIfTrue = true;
            found.push({ rule: { id: newRuleId(), ...rule, ranges }, priority: Number.isFinite(priority) ? priority : Infinity, order });
        }
    }
    found.sort((a, b) => a.priority - b.priority || a.order - b.order);
    return { rules: found.map((f) => f.rule), skipped };
};

// --- App -> Excel ---

const ruleToExcel = (rule, priority) => {
    const first = boundsOfRange(rule.ranges[0]);
    const anchor = getCellId(first.minRow, first.minCol);
    const style = styleFromFormat(rule.format);
    const expression = (body) => ({ type: "expression", priority, formulae: [body], style });
    const areas = rule.ranges.map(absoluteRef);
    switch (rule.type) {
        case "formula": return expression(String(rule.formula ?? "").trim().replace(/^=/, ""));
        case "cellIs": {
            const two = rule.operator === "between" || rule.operator === "notBetween";
            return {
                type: "cellIs", priority, operator: CELL_IS_TO_EXCEL[rule.operator] || "equal", style,
                formulae: two ? [operandFromValue(rule.value), operandFromValue(rule.value2)] : [operandFromValue(rule.value)],
            };
        }
        case "text": {
            const text = String(rule.text ?? "");
            // ExcelJS only writes the "contains" kind; the others go out as the formula Excel itself uses.
            if (rule.operator === "notContains") return expression(`ISERROR(SEARCH(${quoted(text)},${anchor}))`);
            if (rule.operator === "beginsWith") return expression(`LEFT(${anchor},${text.length})=${quoted(text)}`);
            if (rule.operator === "endsWith") return expression(`RIGHT(${anchor},${text.length})=${quoted(text)}`);
            return { type: "containsText", priority, operator: "containsText", text, style };
        }
        case "blanks": return { type: "containsText", priority, operator: "containsBlanks", style };
        case "noBlanks": return { type: "containsText", priority, operator: "notContainsBlanks", style };
        case "errors": return { type: "containsText", priority, operator: "containsErrors", style };
        case "noErrors": return { type: "containsText", priority, operator: "notContainsErrors", style };
        case "date": return { type: "timePeriod", priority, timePeriod: rule.period, style };
        // No writer for these two in ExcelJS: the same test as a formula.
        case "duplicate":
        case "unique": {
            const count = areas.map((area) => `COUNTIF(${area},${anchor})`).join("+");
            return expression(`AND(NOT(ISBLANK(${anchor})),${count}${rule.type === "duplicate" ? ">1" : "=1"})`);
        }
        case "top":
            return { type: "top10", priority, rank: Math.max(1, Math.floor(Number(rule.rank) || 10)), percent: !!rule.percent, bottom: !!rule.bottom, style };
        case "average":
            if (rule.mode === "equalAbove") return expression(`${anchor}>=AVERAGE(${areas.join(",")})`);
            if (rule.mode === "equalBelow") return expression(`${anchor}<=AVERAGE(${areas.join(",")})`);
            return { type: "aboveAverage", priority, aboveAverage: rule.mode !== "below", style };
        case "colorScale": {
            const colors = rule.colors || [];
            const points = Array.isArray(rule.points) && rule.points.length === colors.length
                ? rule.points
                : colors.length === 3 ? [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }] : [{ type: "min" }, { type: "max" }];
            return { type: "colorScale", priority, cfvo: cfvoFromPoints(points), color: colors.map(argbOf) };
        }
        case "iconSet": {
            const set = rule.set in ICON_SETS ? rule.set : "3Arrows";
            const count = ICON_SETS[set].icons.length;
            const points = Array.isArray(rule.points) && rule.points.length === count ? rule.points : defaultIconPoints(count);
            return { type: "iconSet", priority, iconSet: set, ...(rule.reverse ? { reverse: true } : null), cfvo: cfvoFromPoints(points) };
        }
        case "dataBar": {
            const points = Array.isArray(rule.points) && rule.points.length === 2 ? rule.points : [{ type: "min" }, { type: "max" }];
            return { type: "dataBar", priority, cfvo: cfvoFromPoints(points), color: argbOf(rule.color || "#638ec6"), gradient: !!rule.gradient };
        }
        default: return null;
    }
};

// A sheet's rules as the blocks to hand to `worksheet.addConditionalFormatting`,
// plus the priorities of the rules flagged Stop If True (see writeStopIfTrue).
export const rulesToExcel = (rules) => {
    const blocks = [];
    const stopIfTrue = [];
    normalizeRules(rules).forEach((rule, index) => {
        const ranges = (rule.ranges || []).filter(boundsOfRange);
        if (!ranges.length) return;
        const priority = index + 1;
        const excelRule = ruleToExcel({ ...rule, ranges }, priority);
        if (!excelRule) return;
        blocks.push({ ref: refOfRanges(ranges), rules: [excelRule] });
        if (rule.stopIfTrue && !VISUAL_RULE_TYPES.has(rule.type)) stopIfTrue.push(priority);
    });
    return { blocks, stopIfTrue };
};

// --- Stop If True, through the workbook XML ---

const CF_RULE_TAG_RE = /<cfRule\b[^>]*>/g;
const attributeOf = (tag, name) => (new RegExp(`\\s${name}="([^"]*)"`).exec(tag) || [])[1];
const unescapeXml = (text) => text.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// { sheetName: Set<priority> } for the rules flagged Stop If True. `zip` is a JSZip of the .xlsx.
export const readStopIfTrue = async (zip) => {
    const result = {};
    const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
    const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
    if (!workbookXml || !relsXml) return result;
    const targets = {};
    for (const tag of relsXml.match(/<Relationship\b[^>]*>/g) || []) targets[attributeOf(tag, "Id")] = attributeOf(tag, "Target");
    for (const tag of workbookXml.match(/<sheet\b[^>]*>/g) || []) {
        const name = attributeOf(tag, "name");
        const target = targets[attributeOf(tag, "r:id")];
        if (name === undefined || !target) continue;
        const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
        const sheetXml = await zip.file(path)?.async("string");
        if (!sheetXml) continue;
        const priorities = new Set();
        for (const rule of sheetXml.match(CF_RULE_TAG_RE) || []) {
            const flag = attributeOf(rule, "stopIfTrue");
            if (flag === "1" || flag === "true") priorities.add(Number(attributeOf(rule, "priority")));
        }
        if (priorities.size) result[unescapeXml(name)] = priorities;
    }
    return result;
};

// Flags rules Stop If True in a workbook ExcelJS wrote. `bySheetId` maps a
// worksheet's ExcelJS id to the rule priorities to flag. Changes `zip` in place.
export const writeStopIfTrue = async (zip, bySheetId) => {
    for (const [sheetId, priorities] of Object.entries(bySheetId)) {
        const path = `xl/worksheets/sheet${sheetId}.xml`;
        const sheetXml = await zip.file(path)?.async("string");
        if (!sheetXml || !priorities.length) continue;
        const wanted = new Set(priorities.map(Number));
        zip.file(path, sheetXml.replace(CF_RULE_TAG_RE, (tag) => (
            wanted.has(Number(attributeOf(tag, "priority"))) && attributeOf(tag, "stopIfTrue") === undefined
                ? tag.replace("<cfRule", '<cfRule stopIfTrue="1"')
                : tag
        )));
    }
};
