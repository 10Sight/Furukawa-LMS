// Single source of truth for the Abnormal Condition sheet's layout, shared by the server
// (validation + defaults + new-sheet row count) and the admin UI (sheet + layout editor).
//
// The sheet's columns are fixed fields (entries[].producedQty, .cause, …), so a layout can
// only change TEXT — the title, each column header, the two group headers, the Remarks
// footer — and how many empty rows a new month's sheet starts with. Layouts resolve
// Department → Global → defaults (stored in monitoring_configs, type ABNORMAL_CONDITION).

export const ABNORMAL_CONDITION_CONFIG_TYPE = "ABNORMAL_CONDITION";
export const ABNORMAL_CONDITION_MAX_ROWS = 100;

// Header text per fixed column, in display order. `containment` and `containmentCheck`
// are the two group headers above Produced / OK / NG Qty.
export const ABNORMAL_CONDITION_HEADER_KEYS = Object.freeze([
    "sNo", "date", "line", "process",
    "containment", "containmentCheck", "producedQty", "okQty", "ngQty",
    "abnormalCondition", "cause", "action", "resp", "target", "setupConfirmation", "approvedBy",
]);

export const DEFAULT_ABNORMAL_CONDITION_LAYOUT = Object.freeze({
    title: "Abnormal Conditions recording and countermeasure sheet",
    headers: Object.freeze({
        sNo: "S.No",
        date: "Date",
        line: "Line",
        process: "Process",
        containment: "Immediate containment action (if required)",
        containmentCheck: "Checking status of the previously produced production same lot (if required)",
        producedQty: "Produced Qty.",
        okQty: "OK Qty.",
        ngQty: "NG. Qty.",
        abnormalCondition: "Abnormal Condition",
        cause: "Cause",
        action: "Action",
        resp: "Resp",
        target: "Target",
        setupConfirmation: "Setup Confirmation before restart process",
        approvedBy: "Approved By (Head, QA)",
    }),
    remarks: "NG product will be handled as the defective product handling system",
    defaultRows: 15,
});

const isText = (v) => typeof v === "string";

const resolveRows = (value) => {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= ABNORMAL_CONDITION_MAX_ROWS ? n : DEFAULT_ABNORMAL_CONDITION_LAYOUT.defaultRows;
};

// Full layout from a stored config (any part may be missing; unknown keys are dropped).
export const resolveAbnormalConditionLayout = (stored) => {
    const s = stored || {};
    const d = DEFAULT_ABNORMAL_CONDITION_LAYOUT;
    return {
        title: isText(s.title) ? s.title : d.title,
        headers: Object.fromEntries(ABNORMAL_CONDITION_HEADER_KEYS.map((key) => [
            key, isText(s.headers?.[key]) ? s.headers[key] : d.headers[key],
        ])),
        remarks: isText(s.remarks) ? s.remarks : d.remarks,
        defaultRows: resolveRows(s.defaultRows),
    };
};

// Problems with a proposed layout (empty list = valid).
export const validateAbnormalConditionLayout = (layout) => {
    if (!layout || typeof layout !== "object") return ["Layout is required"];
    const errors = [];
    if (!isText(layout.title) || !layout.title.trim()) errors.push("Title is required");
    if (!layout.headers || typeof layout.headers !== "object") {
        errors.push("Headers are required");
    } else {
        const extra = Object.keys(layout.headers).filter((k) => !ABNORMAL_CONDITION_HEADER_KEYS.includes(k));
        if (extra.length) errors.push(`Columns cannot be added (unknown: ${extra.join(", ")})`);
        ABNORMAL_CONDITION_HEADER_KEYS.forEach((key) => {
            if (!isText(layout.headers[key])) errors.push(`Header "${key}" must be text`);
        });
    }
    if (layout.remarks !== undefined && !isText(layout.remarks)) errors.push("Remarks must be text");
    const n = Number(layout.defaultRows);
    if (!Number.isInteger(n) || n < 1 || n > ABNORMAL_CONDITION_MAX_ROWS) {
        errors.push(`Default rows must be a whole number between 1 and ${ABNORMAL_CONDITION_MAX_ROWS}`);
    }
    return errors;
};
