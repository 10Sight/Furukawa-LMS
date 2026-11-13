// Excel import for the IT Access Control Register.
//
// readImportWorkbook() turns an .xlsx into a plain matrix of cell values; buildImportPlan() matches
// its rows to the register by Employee Id and returns the edits it would make plus everything it
// could not use. Nothing is saved here: the page merges `plan.edits` into its unsaved edits and the
// user saves them through the normal PUT (same validation, version check and history).
//
// Rules (agreed for the register):
// - Employee Id only finds the employee. Name, Role, Department, Date Of Joining and Date Of
//   Leaving come from the users table and are never imported (IMPORT_IGNORED_COLUMNS).
// - Every other column is matched to the server's field labels, so new fields import automatically.
// - A blank cell leaves the saved value unchanged.
// - Written dates are day-first (DD-MM-YYYY, DD/MM/YYYY); YYYY-MM-DD and real Excel dates also work.
// - Register employees missing from the file are reported (notInFile), not changed.

export class ImportError extends Error {}

// Zero-width spaces/joiners, word joiner, BOM and soft hyphen: invisible, but they make "Yes" ≠ "Yes".
// Common in text pasted from web pages, Teams or Outlook.
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;
export const stripInvisible = (value) => String(value ?? "").replace(INVISIBLE, "");

/** Lowercase letters and digits only: "Desktop / Laptop" -> "desktoplaptop". */
export const normalizeHeader = (value) => stripInvisible(value).toLowerCase().replace(/[^a-z0-9]/g, "");

/** "  st 0012 " -> "ST0012" */
export const normalizeEmpId = (value) => stripInvisible(value).replace(/\s+/g, "").toUpperCase();

const EMP_ID_HEADERS = new Set(["employeeid", "empid", "employeecode", "empcode", "employeeno", "empno"]);

// Read-only columns: recognised so they are reported as "not imported", never matched to a field.
export const IMPORT_IGNORED_COLUMNS = new Set([
    "employeename", "name", "empname",
    "role", "designation",
    "department", "dept",
    "dateofjoining", "doj", "joiningdate",
    "dateofleaving", "dol", "leavingdate",
    "srno", "sno", "slno", "serialno",
]);

// Other spellings people use for a field's header (normalized header -> field key).
const FIELD_ALIASES = {
    physical: "physicalAccess",
    physicalaccess: "physicalAccess",
    inhouseapp: "inhouseApp",
    desktoplaptoptablet: "desktopLaptop",
    device: "desktopLaptop",
    fileserver: "deptFileServer",
    msadminportal: "msAdminPortal",
    emailonmobile: "emailAccessMobile",
    emaildeletiondate: "emailDeletionDate",
    dateofemaildeletion: "emailDeletionDate",
    addeletiondate: "adDeletionDate",
    dateofaddeletion: "adDeletionDate",
};

const HEADER_SCAN_ROWS = 10;

// ---------- reading the workbook ----------

/** Plain value of an exceljs cell value (rich text, formulas, hyperlinks unwrapped). */
export const plainCellValue = (value) => {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value;
    if (typeof value === "object") {
        if (Array.isArray(value.richText)) return value.richText.map((p) => p.text).join("");
        if ("result" in value) return plainCellValue(value.result);
        if ("text" in value) return plainCellValue(value.text);
        if ("error" in value) return null;
        return null;
    }
    return value;
};

/**
 * Reads the "Access Control Register" sheet (else the first sheet) into a matrix of plain values.
 * Merged cells repeat their master value in exceljs; that is harmless here because only the header
 * row and data rows are read.
 */
export async function readImportWorkbook(ExcelJS, buffer) {
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.load(buffer);
    } catch {
        throw new ImportError("This file could not be read as an Excel workbook (.xlsx).");
    }
    const sheet = workbook.worksheets.find((ws) => normalizeHeader(ws.name) === "accesscontrolregister") || workbook.worksheets[0];
    if (!sheet) throw new ImportError("The workbook has no sheets.");

    const matrix = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const values = [];
        row.eachCell({ includeEmpty: true }, (cell, col) => { values[col - 1] = plainCellValue(cell.value); });
        matrix[rowNumber - 1] = values;
    });
    for (let i = 0; i < matrix.length; i += 1) if (!matrix[i]) matrix[i] = [];
    return { sheetName: sheet.name, matrix };
}

// ---------- values ----------

const isBlank = (v) => v === null || v === undefined || (typeof v === "string" && stripInvisible(v).trim() === "");

// Other ways a Yes/No cell is written (after lowercasing): Excel TRUE/FALSE, 1/0, ticks and crosses.
const YES_WORDS = new Set(["y", "true", "1", "\u2713", "\u2714", "\u2611", "\u2705"]); // ✓ ✔ ☑ ✅
const NO_WORDS = new Set(["n", "false", "0", "\u2717", "\u2718", "\u00D7", "\u2612", "\u274C"]); // ✗ ✘ × ☒ ❌

const isoFromParts = (year, month, day) => {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
    if (year < 1900 || year > 2200) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

// Excel serial day 0 is 1899-12-30 (accounts for Excel's 1900 leap-year bug for dates after Feb 1900).
const isoFromSerial = (n) => {
    if (!Number.isFinite(n) || n < 1 || n > 200000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
    return isoFromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

/** Excel/plain value -> "YYYY-MM-DD", or null when it is not a real date. */
export const parseImportDate = (value) => {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        // exceljs gives date cells as UTC midnight.
        return isoFromParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
    }
    if (typeof value === "number") return isoFromSerial(value);
    const s = stripInvisible(value).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return isoFromParts(Number(m[1]), Number(m[2]), Number(m[3]));
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) return isoFromParts(Number(m[3]), Number(m[2]), Number(m[1])); // day-first
    return null;
};

const matchOption = (options, value) => {
    const wanted = stripInvisible(value).trim().toLowerCase();
    return options.find((o) => o.toLowerCase() === wanted) || null;
};

/**
 * Cell value -> { value } (canonical) | { skip: true } (blank: leave unchanged) | { error }.
 */
export const parseImportValue = (field, raw) => {
    if (isBlank(raw)) return { skip: true };
    if (field.type === "date") {
        const iso = parseImportDate(raw);
        return iso ? { value: iso } : { error: "not a valid date (use DD-MM-YYYY)" };
    }
    if (field.type === "text") {
        const text = stripInvisible(raw).replace(/\s+/g, " ").trim();
        return text ? { value: text } : { skip: true };
    }
    let option = matchOption(field.options, raw);
    if (!option && field.options.includes("Yes") && field.options.includes("No")) {
        const word = stripInvisible(raw).trim().toLowerCase();
        if (YES_WORDS.has(word)) option = "Yes";
        if (NO_WORDS.has(word)) option = "No";
    }
    return option ? { value: option } : { error: `must be one of ${field.options.join(", ")}` };
};

// ---------- matching ----------

const levenshtein = (a, b) => {
    if (a === b) return 0;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
        const cur = [i];
        for (let j = 1; j <= b.length; j += 1) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[b.length];
};

/**
 * The field an unknown header most likely means, or null. Only an unambiguous match counts:
 * a near-miss spelling (1 letter off for short headers, 2 for longer) or a header contained in
 * exactly one label ("ITSM" -> "ITSM Support"). Never applied without the user seeing it.
 */
export function suggestField(norm, candidates) {
    if (!norm || norm.length < 3) return null;
    const names = (f) => [normalizeHeader(f.label), ...Object.entries(FIELD_ALIASES).filter(([, key]) => key === f.key).map(([alias]) => alias)];
    const limit = norm.length < 6 ? 1 : 2;
    let best = null;
    let bestDistance = Infinity;
    let tie = false;
    for (const f of candidates) {
        const d = Math.min(...names(f).map((n) => levenshtein(norm, n)));
        if (d < bestDistance) { best = f; bestDistance = d; tie = false; } else if (d === bestDistance) tie = true;
    }
    if (best && bestDistance <= limit && !tie) return best;

    const containing = candidates.filter((f) => names(f).some((n) => n.includes(norm) || (n.length >= 3 && norm.includes(n))));
    return containing.length === 1 ? containing[0] : null;
}

/**
 * Finds the header row and maps every column.
 * @param {Record<string,string>} mappings  user choices for headers that did not match a label:
 *        normalized header -> field key, or "" to leave that column out.
 * @returns {{ headerIndex, idColumn, fieldColumns, ignoredColumns, columns, missingFields }}
 *   columns: one entry per non-empty header — { col, header, norm, status, fieldKey, suggestedKey }
 *   status: "id" | "matched" | "manual" | "suggested" | "readonly" | "unknown" | "skipped" | "duplicate"
 *   missingFields: labels of importable fields no column maps to.
 * Throws ImportError when there is no Employee Id column or no column could ever be imported.
 */
export function mapColumns(matrix, fields, mappings = {}) {
    const importable = fields.filter((f) => f.importable !== false);
    const byLabel = new Map(importable.map((f) => [normalizeHeader(f.label), f]));
    const byKey = new Map(importable.map((f) => [f.key, f]));

    const headerIndex = matrix.slice(0, HEADER_SCAN_ROWS)
        .findIndex((row) => (row || []).some((cell) => EMP_ID_HEADERS.has(normalizeHeader(cell))));
    if (headerIndex < 0) throw new ImportError('No "Employee Id" column found in the first 10 rows.');

    const header = matrix[headerIndex] || [];
    const columns = [];
    const usedKeys = new Set();
    let idColumn = -1;

    // Pass 1: Employee Id, read-only columns and exact label/alias matches.
    header.forEach((cell, col) => {
        const text = stripInvisible(cell ?? "").replace(/\s+/g, " ").trim();
        const norm = normalizeHeader(text);
        if (!norm) return;
        const entry = { col, header: text, norm, status: "unknown", fieldKey: null, suggestedKey: null };
        columns.push(entry);
        if (EMP_ID_HEADERS.has(norm)) {
            if (idColumn < 0) { idColumn = col; entry.status = "id"; } else entry.status = "duplicate";
            return;
        }
        if (IMPORT_IGNORED_COLUMNS.has(norm)) { entry.status = "readonly"; return; }
        const field = byLabel.get(norm) || byKey.get(FIELD_ALIASES[norm]);
        if (!field) return;
        if (usedKeys.has(field.key)) { entry.status = "duplicate"; entry.fieldKey = field.key; return; }
        usedKeys.add(field.key);
        entry.status = "matched";
        entry.fieldKey = field.key;
    });

    // Pass 2: the user's mapping for each remaining header, else a suggestion.
    for (const entry of columns.filter((c) => c.status === "unknown")) {
        const unused = importable.filter((f) => !usedKeys.has(f.key));
        const suggestion = suggestField(entry.norm, unused);
        entry.suggestedKey = suggestion?.key || null;
        const chosen = Object.prototype.hasOwnProperty.call(mappings, entry.norm) ? mappings[entry.norm] : undefined;
        if (chosen === "") { entry.status = "skipped"; continue; }
        const field = chosen ? byKey.get(chosen) : suggestion;
        if (!field) continue;
        if (usedKeys.has(field.key)) { entry.status = "duplicate"; entry.fieldKey = field.key; continue; }
        usedKeys.add(field.key);
        entry.status = chosen ? "manual" : "suggested";
        entry.fieldKey = field.key;
    }

    const IMPORTED = new Set(["matched", "manual", "suggested"]);
    const fieldColumns = columns.filter((c) => IMPORTED.has(c.status)).map((c) => ({ col: c.col, field: byKey.get(c.fieldKey) }));
    const REASONS = {
        readonly: "comes from employee records, not imported",
        unknown: "unknown column",
        skipped: "left out by you",
    };
    const ignoredColumns = columns
        .filter((c) => !IMPORTED.has(c.status) && c.status !== "id")
        .map((c) => ({
            header: c.header,
            reason: c.status === "duplicate"
                ? (c.fieldKey ? `second "${byKey.get(c.fieldKey)?.label}" column` : "second Employee Id column")
                : REASONS[c.status],
        }));
    const missingFields = importable.filter((f) => !usedKeys.has(f.key)).map((f) => f.label);

    if (!fieldColumns.length && !columns.some((c) => c.status === "unknown" || c.status === "skipped")) {
        throw new ImportError("No access columns found next to Employee Id. Use the file from Export to Excel as the template.");
    }
    return { headerIndex, idColumn, fieldColumns, ignoredColumns, columns, missingFields };
}

/**
 * @param {{ matrix: any[][], fields: object[], rows: object[], mappings?: Record<string,string> }} input
 *        rows = register rows (saved values); mappings = see mapColumns
 * @returns plan: { edits, changes, matchedCount, changedRowCount, unchangedCells, importedColumns,
 *   ignoredColumns, columns, missingFields, notOnRegister, notInFile, duplicates, blankIdRows, invalid }
 */
export function buildImportPlan({ matrix, fields, rows, mappings = {} }) {
    const { headerIndex, idColumn, fieldColumns, ignoredColumns, columns, missingFields } = mapColumns(matrix, fields, mappings);
    const registerById = new Map(rows.map((r) => [normalizeEmpId(r.empId), r]));

    const blankIdRows = [];
    const fileRowsById = new Map(); // empId -> [{ rowNumber, cells }]
    for (let i = headerIndex + 1; i < matrix.length; i += 1) {
        const cells = matrix[i] || [];
        const fieldCellsBlank = fieldColumns.every(({ col }) => isBlank(cells[col]));
        const empId = normalizeEmpId(plainCellValue(cells[idColumn]));
        if (!empId) {
            if (!fieldCellsBlank) blankIdRows.push(i + 1);
            continue;
        }
        if (!fileRowsById.has(empId)) fileRowsById.set(empId, []);
        fileRowsById.get(empId).push({ rowNumber: i + 1, cells });
    }

    const parseRow = (entry, empId) => {
        const values = {};
        const errors = [];
        for (const { col, field } of fieldColumns) {
            const raw = entry.cells[col];
            const parsed = parseImportValue(field, raw);
            if (parsed.error) errors.push({ rowNumber: entry.rowNumber, empId, column: field.label, value: String(raw), reason: parsed.error });
            else if (!parsed.skip) values[field.key] = parsed.value;
        }
        return { values, errors };
    };

    const edits = {};
    const changes = [];
    const notOnRegister = [];
    const duplicates = [];
    const invalid = [];
    const matchedIds = new Set();
    let unchangedCells = 0;

    for (const [empId, entries] of fileRowsById) {
        const registerRow = registerById.get(empId);
        if (!registerRow) {
            notOnRegister.push({ rowNumber: entries[0].rowNumber, empId });
            continue;
        }
        matchedIds.add(empId);

        const parsedEntries = entries.map((e) => parseRow(e, empId));
        if (entries.length > 1) {
            const same = parsedEntries.every((p) => JSON.stringify(p.values) === JSON.stringify(parsedEntries[0].values));
            duplicates.push({ empId, rowNumbers: entries.map((e) => e.rowNumber), conflicting: !same });
            if (!same) continue;
        }
        const { values, errors } = parsedEntries[0];
        invalid.push(...errors);

        const rowEdits = {};
        for (const [key, value] of Object.entries(values)) {
            const saved = registerRow.values?.[key] ?? null;
            // The export fills a blank location with the plant; importing that back is no change.
            const unchanged = value === saved || (key === "location" && saved === null && value === registerRow.defaultLocation);
            if (unchanged) {
                unchangedCells += 1;
                continue;
            }
            rowEdits[key] = value;
            const field = fields.find((f) => f.key === key);
            changes.push({
                userId: registerRow.userId, empId: registerRow.empId, fullName: registerRow.fullName,
                key, label: field?.label || key, from: saved, to: value, rowNumber: entries[0].rowNumber,
            });
        }
        if (Object.keys(rowEdits).length) edits[registerRow.userId] = rowEdits;
    }

    const notInFile = rows
        .filter((r) => !matchedIds.has(normalizeEmpId(r.empId)))
        .map((r) => ({ userId: r.userId, empId: r.empId, fullName: r.fullName, department: r.department, hasLeft: !!r.hasLeft }));

    return {
        edits,
        changes,
        matchedCount: matchedIds.size,
        changedRowCount: Object.keys(edits).length,
        unchangedCells,
        importedColumns: fieldColumns.map(({ field }) => field.label),
        ignoredColumns,
        columns,
        missingFields,
        notOnRegister,
        notInFile,
        duplicates,
        blankIdRows,
        invalid,
    };
}
