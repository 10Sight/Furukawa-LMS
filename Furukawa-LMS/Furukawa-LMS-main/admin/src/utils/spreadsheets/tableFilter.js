// AutoFilter: which rows of a table a column's filter lets through.
//
// A table keeps its filters as { [column index]: filter }, one of
//   { hidden: ["Closed", ""] }                          rows showing one of these values are hidden
//   { condition: { type: "greaterThan", value: "5" } }  rows failing the condition are hidden
//   ["Open", "Pending"]                                  older sheets: only rows showing one of these are kept
//
// Values are the text a cell shows (its formatted display value), so they match
// what the filter list offers. A new filter names what it hides rather than what
// it keeps, so a row whose value did not exist when the filter was set stays
// visible. Number conditions compare the cell's underlying value, not that text
// — "1,234.50" is 1234.5, not 1.

export const FILTER_CONDITIONS = [
    { type: "empty", label: "Is empty" },
    { type: "notEmpty", label: "Is not empty" },
    { type: "textContains", label: "Text contains", input: "text" },
    { type: "textNotContains", label: "Text does not contain", input: "text" },
    { type: "textStartsWith", label: "Text starts with", input: "text" },
    { type: "textEndsWith", label: "Text ends with", input: "text" },
    { type: "textEquals", label: "Text is exactly", input: "text" },
    { type: "greaterThan", label: "Greater than", input: "number" },
    { type: "greaterThanOrEqual", label: "Greater than or equal to", input: "number" },
    { type: "lessThan", label: "Less than", input: "number" },
    { type: "lessThanOrEqual", label: "Less than or equal to", input: "number" },
    { type: "numberEquals", label: "Is equal to", input: "number" },
];

const NUMBER_TEXT_RE = /^[-+]?(?:\d[\d,]*\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
// A number as someone would type it ("1,200", "-3.5"); NaN for anything else.
export const parseNumberText = (text) => {
    const t = String(text ?? "").trim();
    return NUMBER_TEXT_RE.test(t) ? Number(t.replace(/,/g, "")) : NaN;
};

const numberOf = (text, raw) => {
    if (text.trim() === "") return NaN; // an empty cell is not 0
    if (typeof raw === "number") return raw;
    return parseNumberText(typeof raw === "string" ? raw : text);
};

const TEXT_TESTS = {
    textContains: (text, target) => text.includes(target),
    textNotContains: (text, target) => !text.includes(target),
    textStartsWith: (text, target) => text.startsWith(target),
    textEndsWith: (text, target) => text.endsWith(target),
    textEquals: (text, target) => text === target,
};
const NUMBER_TESTS = {
    greaterThan: (n, target) => n > target,
    greaterThanOrEqual: (n, target) => n >= target,
    lessThan: (n, target) => n < target,
    lessThanOrEqual: (n, target) => n <= target,
    numberEquals: (n, target) => n === target,
};

const compileCondition = (condition) => {
    const type = condition?.type;
    if (type === "empty") return (text) => text.trim() === "";
    if (type === "notEmpty") return (text) => text.trim() !== "";
    if (TEXT_TESTS[type]) {
        const target = String(condition.value ?? "").toLowerCase();
        if (target === "") return null;
        return (text) => TEXT_TESTS[type](text.toLowerCase(), target);
    }
    if (NUMBER_TESTS[type]) {
        const target = parseNumberText(condition.value);
        if (Number.isNaN(target)) return null;
        return (text, raw) => {
            const n = numberOf(text, raw);
            return !Number.isNaN(n) && NUMBER_TESTS[type](n, target);
        };
    }
    return null;
};

// (text, raw) => whether a row showing `text` (underlying value `raw`) in the
// filtered column stays visible; null when the filter filters nothing.
export const compileFilter = (filter) => {
    if (Array.isArray(filter)) {
        const shown = new Set(filter);
        return (text) => shown.has(text);
    }
    if (!filter || typeof filter !== "object") return null;
    if (filter.condition) return compileCondition(filter.condition);
    if (Array.isArray(filter.hidden) && filter.hidden.length) {
        const hidden = new Set(filter.hidden);
        return (text) => !hidden.has(text);
    }
    return null;
};

export const isFilterActive = (filter) => compileFilter(filter) !== null;

// A table's active filters as [{ col, test }], or null when it has none.
export const compileTableFilters = (table) => {
    if (!table?.filtersEnabled || !table.filters) return null;
    const tests = [];
    for (const [col, filter] of Object.entries(table.filters)) {
        const test = compileFilter(filter);
        if (test) tests.push({ col: Number(col), test });
    }
    return tests.length ? tests : null;
};

// Which of a column's values a value filter leaves ticked in the filter list.
export const shownValuesOf = (filter, allValues) => {
    if (Array.isArray(filter)) {
        const shown = new Set(filter);
        return allValues.filter((v) => shown.has(v));
    }
    if (Array.isArray(filter?.hidden)) {
        const hidden = new Set(filter.hidden);
        return allValues.filter((v) => !hidden.has(v));
    }
    return allValues;
};

// The filter to store for a ticked set of values; null when nothing is hidden.
export const valueFilterFor = (allValues, shown) => {
    const hidden = allValues.filter((v) => !shown.has(v));
    return hidden.length ? { hidden } : null;
};
