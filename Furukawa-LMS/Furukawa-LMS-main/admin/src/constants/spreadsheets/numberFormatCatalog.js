// Data behind Format Cells > Number: Excel's categories, the "Type" lists
// for Date / Time / Fraction / Special / Custom, and the builders that turn
// the dialog's options (decimals, separator, symbol, negatives) into an Excel
// format code. The code is stored on the cell as `numberPattern` and rendered
// by formatWithPattern; `numberFormat` keeps the category.

export const NUMBER_CATEGORIES = [
    { key: "general", label: "General", help: "General format cells have no specific number format." },
    { key: "number", label: "Number", help: "Number is used for general display of numbers. Currency and Accounting offer specialized formatting for monetary value." },
    { key: "currency", label: "Currency", help: "Currency formats are used for general monetary values. Use Accounting formats to align decimal points in a column." },
    { key: "accounting", label: "Accounting", help: "Accounting formats line up the currency symbols and decimal points in a column." },
    { key: "date", label: "Date", help: "Date formats display date and time serial numbers as date values." },
    { key: "time", label: "Time", help: "Time formats display date and time serial numbers as time values." },
    { key: "percentage", label: "Percentage", help: "Percentage formats multiply the cell value by 100 and display the result with a percent symbol." },
    { key: "fraction", label: "Fraction", help: "Fraction formats display numbers as fractions." },
    { key: "scientific", label: "Scientific", help: "Scientific format displays numbers in exponential notation." },
    { key: "text", label: "Text", help: "Text format cells are treated as text even when a number is in the cell. The cell is displayed exactly as entered." },
    { key: "special", label: "Special", help: "Special formats are useful for tracking list and database values." },
    { key: "custom", label: "Custom", help: "Type the number format code, using one of the existing codes as a starting point." },
];

export const LOCALES = [
    { key: "en-IN", label: "English (India)" },
    { key: "en-US", label: "English (United States)" },
    { key: "en-GB", label: "English (United Kingdom)" },
];
export const CALENDAR_TYPES = [{ key: "gregorian", label: "Gregorian" }];

export const CURRENCY_SYMBOLS = [
    { value: "", label: "None" },
    { value: "₹", label: "₹" },
    { value: "$", label: "$" },
    { value: "€", label: "€" },
    { value: "£", label: "£" },
    { value: "¥", label: "¥" },
];
export const DEFAULT_SYMBOL_BY_LOCALE = { "en-IN": "₹", "en-US": "$", "en-GB": "£" };

const DAY_FIRST_DATES = [
    "dd-mm-yyyy", "dd mmmm yyyy", "dd-mm-yy", "d-m-yy", "d.m.yy", "yyyy-mm-dd", "d mmmm yyyy", "dd/mm/yyyy", "dd/mm/yy",
    "d-mmm", "d-mmm-yy", "dd-mmm-yy", "dd-mmm-yyyy", "mmm-yy", "mmmm-yy", "mmmm yyyy", "dddd, d mmmm yyyy",
    "dd-mm-yy h:mm AM/PM", "dd-mm-yy hh:mm",
];
const MONTH_FIRST_DATES = [
    "m/d/yyyy", "dddd, mmmm d, yyyy", "m/d", "m/d/yy", "mm/dd/yy", "mm/dd/yyyy", "yyyy-mm-dd", "d-mmm", "d-mmm-yy", "dd-mmm-yy",
    "mmm-yy", "mmmm-yy", "mmmm d, yyyy", "mmmm yyyy", "m/d/yy h:mm AM/PM", "m/d/yy hh:mm",
];
export const DATE_TYPES_BY_LOCALE = { "en-IN": DAY_FIRST_DATES, "en-GB": DAY_FIRST_DATES, "en-US": MONTH_FIRST_DATES };

const TIMES = ["hh:mm:ss", "h:mm", "h:mm AM/PM", "h:mm:ss", "h:mm:ss AM/PM", "hh:mm", "mm:ss.0"];
export const TIME_TYPES_BY_LOCALE = {
    "en-IN": [...TIMES, "dd-mm-yy h:mm AM/PM", "dd-mm-yy hh:mm"],
    "en-GB": [...TIMES, "dd/mm/yy hh:mm"],
    "en-US": [...TIMES, "m/d/yy h:mm AM/PM", "m/d/yy hh:mm"],
};

export const FRACTION_TYPES = [
    { pattern: "# ?/?", label: "Up to one digit (1/4)" },
    { pattern: "# ??/??", label: "Up to two digits (21/25)" },
    { pattern: "# ???/???", label: "Up to three digits (312/943)" },
    { pattern: "# ?/2", label: "As halves (1/2)" },
    { pattern: "# ?/4", label: "As quarters (2/4)" },
    { pattern: "# ?/8", label: "As eighths (4/8)" },
    { pattern: "# ??/16", label: "As sixteenths (8/16)" },
    { pattern: "# ?/10", label: "As tenths (3/10)" },
    { pattern: "# ??/100", label: "As hundredths (30/100)" },
];

export const SPECIAL_TYPES = [
    { pattern: "00000", label: "Zip Code" },
    { pattern: "00000-0000", label: "Zip Code + 4" },
    { pattern: "[<=9999999]###-####;(###) ###-####", label: "Phone Number" },
    { pattern: "000-00-0000", label: "Social Security Number" },
    { pattern: "000000", label: "PIN Code (India)" },
];

export const CUSTOM_CODES = [
    "General", "0", "0.00", "#,##0", "#,##0.00", "#,##0;(#,##0)", "#,##0.00;(#,##0.00)", "0%", "0.00%", "0.00E+00",
    "# ?/?", "# ??/??", "dd-mm-yyyy", "dd-mmm-yy", "d-mmm", "mmm-yy", "h:mm AM/PM", "h:mm:ss AM/PM", "h:mm", "h:mm:ss",
    "dd-mm-yyyy h:mm", "mm:ss", "@",
];

// Categories whose code is built from the option controls, not picked from a list.
export const BUILT_CATEGORIES = new Set(["number", "currency", "accounting", "percentage", "scientific"]);
// Categories that pick a code from a "Type" list.
export const TYPE_LIST_CATEGORIES = new Set(["date", "time", "fraction", "special", "custom"]);

// 14 March 2012, 1:30:55 PM — the date Excel's own Type lists are shown with.
export const SAMPLE_DATE_SERIAL = 40982.56313657;

export const NEGATIVE_STYLES = [
    { key: "minus", sample: (text) => `-${text}` },
    { key: "paren", sample: (text) => `(${text})` },
];

export function buildNumberPattern({ category, decimalPlaces = 2, useSeparator = false, symbol = "", negativeStyle = "minus" }) {
    const decimals = decimalPlaces > 0 ? `.${"0".repeat(decimalPlaces)}` : "";
    const withNegative = (base) => (negativeStyle === "paren" ? `${base};(${base})` : base);
    const sym = symbol ? `"${symbol}"` : "";
    switch (category) {
        case "number": return withNegative(`${useSeparator ? "#,##0" : "0"}${decimals}`);
        case "currency": return withNegative(`${sym}#,##0${decimals}`);
        case "accounting": {
            const lead = sym ? `${sym}* ` : "";
            return `_(${lead}#,##0${decimals}_);_(${lead}(#,##0${decimals});_(${lead}"-"??_);_(@_)`;
        }
        case "percentage": return `0${decimals}%`;
        case "scientific": return `0${decimals}E+00`;
        default: return undefined;
    }
}

// Reads the option controls back out of a stored code, for reopening the dialog.
export function optionsFromPattern(pattern, numberFormat) {
    const text = String(pattern || "");
    const symbol = /"([^"0-9-]+)"/.exec(text)?.[1];
    return {
        useSeparator: text ? text.includes("#,##") : numberFormat === "comma",
        negativeStyle: /;\s*\(/.test(text) && numberFormat !== "accounting" ? "paren" : "minus",
        symbol,
    };
}

// Home > Increase/Decrease Decimal on a cell with a stored code: rewrites the
// decimals of every numeric part ("#,##0.00;(#,##0.00)" -> "#,##0.0;(#,##0.0)").
export const patternWithDecimals = (pattern, decimalPlaces) => String(pattern).replace(
    /(?<![E+\-0.])0(\.0+)?(?![0#?.])/g,
    decimalPlaces > 0 ? `0.${"0".repeat(decimalPlaces)}` : "0"
);
