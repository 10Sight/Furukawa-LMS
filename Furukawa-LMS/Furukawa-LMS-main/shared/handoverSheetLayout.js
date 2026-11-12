// Single source of truth for the Handover Sheet layout, shared by the server (validation +
// resolution) and the admin UI (sheet + layout editor).
//
// A layout is the sheet title, the "From:" label, and an ordered list of the BUILT-IN columns
// — each can be renamed, moved, made read-only, or hidden (except S.No and Employee Name).
// Custom columns are not supported: the rest of the system (save-change detection, email,
// export) only knows the built-in fields. The Approve / Reject column is always shown last.
// Layouts resolve Section → Department → Global → defaults (handover_sheet_configs).

export const HANDOVER_GLOBAL_KEY = "GLOBAL";

export const HANDOVER_COLUMNS = Object.freeze([
    { field: "sn", header: "SN." },
    { field: "employeeName", header: "Employee Name" },
    { field: "empCode", header: "Emp. Code" },
    { field: "marks", header: "Marks Secured in Induction Training" },
    { field: "department", header: "Department" },
    { field: "process", header: "Process" },
    { field: "mentor", header: "Mentor" },
    { field: "interview1", header: "1st Interview Accident" },
    { field: "interview2", header: "2nd Interview Practical" },
]);

// Columns that must always be visible.
export const HANDOVER_REQUIRED_FIELDS = Object.freeze(["sn", "employeeName"]);

export const DEFAULT_HANDOVER_LAYOUT = Object.freeze({
    title: "List of Employees Handed Over to Shop Floor After Induction Training",
    fromLabel: "Education Centre",
    statusHeader: "Approve / Reject",
    columns: HANDOVER_COLUMNS.map((c) => ({ ...c, readOnly: false, hidden: false })),
});

const FIELDS = HANDOVER_COLUMNS.map((c) => c.field);
// Older saved layouts used "departmentId" for the Department column.
const FIELD_ALIASES = { departmentId: "department" };
const isText = (v) => typeof v === "string";

// Full layout from a stored config ({ columns: [...] } plus optional text fields). Stored
// column order, headers, readOnly and styling are kept for built-in fields; unknown (custom)
// fields are dropped; built-in fields a stored layout left out are appended hidden, so an
// existing layout keeps looking the way it did.
export const resolveHandoverLayout = (stored) => {
    const s = stored || {};
    const d = DEFAULT_HANDOVER_LAYOUT;
    const storedColumns = Array.isArray(s.columns) ? s.columns : [];
    const seen = new Set();
    const columns = [];

    storedColumns.forEach((col) => {
        const field = FIELD_ALIASES[col?.field] || col?.field;
        if (!FIELDS.includes(field) || seen.has(field)) return;
        seen.add(field);
        const base = HANDOVER_COLUMNS.find((c) => c.field === field);
        columns.push({
            field,
            header: isText(col.header) ? col.header : base.header,
            readOnly: !!col.readOnly,
            hidden: HANDOVER_REQUIRED_FIELDS.includes(field) ? false : !!col.hidden,
            ...(isText(col.className) && col.className ? { className: col.className } : {}),
            ...(col.style && typeof col.style === "object" ? { style: col.style } : {}),
        });
    });

    const hadStoredColumns = columns.length > 0;
    HANDOVER_COLUMNS.forEach((base) => {
        if (seen.has(base.field)) return;
        columns.push({
            field: base.field,
            header: base.header,
            readOnly: false,
            // Missing from an existing layout = it wasn't shown; keep it that way (unless required).
            hidden: hadStoredColumns && !HANDOVER_REQUIRED_FIELDS.includes(base.field),
        });
    });

    return {
        title: isText(s.title) ? s.title : d.title,
        fromLabel: isText(s.fromLabel) ? s.fromLabel : d.fromLabel,
        statusHeader: isText(s.statusHeader) ? s.statusHeader : d.statusHeader,
        columns,
    };
};

export const visibleHandoverColumns = (layout) => (layout?.columns || []).filter((c) => !c.hidden);

// Problems with a proposed layout (empty list = valid).
export const validateHandoverLayout = (layout) => {
    if (!layout || typeof layout !== "object") return ["Layout is required"];
    const errors = [];
    if (!isText(layout.title) || !layout.title.trim()) errors.push("Title is required");
    ["fromLabel", "statusHeader"].forEach((f) => {
        if (layout[f] !== undefined && !isText(layout[f])) errors.push(`${f} must be text`);
    });
    const columns = Array.isArray(layout.columns) ? layout.columns : null;
    if (!columns) return [...errors, "Columns are required"];
    const fields = columns.map((c) => c?.field);
    const unknown = fields.filter((f) => !FIELDS.includes(f));
    if (unknown.length) errors.push(`Custom columns are not supported (${unknown.join(", ")})`);
    const missing = FIELDS.filter((f) => !fields.includes(f));
    if (missing.length) errors.push(`Built-in columns cannot be removed (hide them instead): ${missing.join(", ")}`);
    if (new Set(fields).size !== fields.length) errors.push("Each column can appear only once");
    columns.forEach((c) => {
        if (!isText(c?.header)) errors.push(`Header for "${c?.field}" must be text`);
        if (HANDOVER_REQUIRED_FIELDS.includes(c?.field) && c?.hidden) errors.push(`"${c.field}" column cannot be hidden`);
    });
    return errors;
};
