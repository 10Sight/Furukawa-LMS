// Single source of truth for the Daily Production Report (DPR) sheet's *presentation*
// layout, shared by the server (validation + defaults) and the admin UI (sheet + editor).
//
// A DPR config row (daily_production_report_configs) holds two independent parts:
//   • presentation — section titles, header text, row labels, footer labels, row counts.
//     Resolved Department → Global → defaults, and edited in the DPR Layout & Revision editor.
//   • manpower rows — moral.rows / attendance.rows. Resolved Line → Global → Department and
//     edited in the Manpower setup tab (DPRManage). Never touched by the layout editor.
//
// The sheet's data cells are fixed fields with fixed keys (e.g. downTime.tubeShortage), so the
// layout editor may only change TEXT and row counts — never header shape or row keys.

export const DPR_GLOBAL_KEY = "GLOBAL";

const h = (text, extra = {}) => ({ text, ...extra });

// Down Time rows in display order. Keys are the stored data keys and must never change.
const DOWN_TIME_ROWS = [
    { label: "Circuits shortage from Charging", key: "circuitsShortageFromCharging" },
    { label: "Components shortage from store", key: "componentsShortageFromStore" },
    { label: "Tube shortage", key: "tubeShortage" },
    { label: "Changeover time", key: "changeoverTime" },
    { label: "Quality issues from C&C", key: "qualityIssuesFromCC" },
    { label: "Quality issues in assembly", key: "qualityIssuesInAssembly" },
    {
        label: "Delay in Inspection",
        children: [
            { label: "Dim", key: "delayInInspectionDim" },
            { label: "ECT", key: "delayInInspectionECT" },
            { label: "Visual", key: "delayInInspectionVisual" }
        ]
    },
    {
        label: "Machine Under Break Down",
        children: [
            { label: "CPG", key: "machineBreakDownCPG" },
            { label: "Conveyor", key: "machineBreakDownConveyor" },
            { label: "Torque Tight", key: "machineBreakDownTorqueTight" },
            { label: "Grease Insert", key: "machineBreakDownGreaseInsert" },
            { label: "F/A Board", key: "machineBreakDownFABoard" },
            { label: "A/B Crimping", key: "machineBreakDownABCrimping" },
            { label: "Gromett", key: "machineBreakDownGromett" }
        ]
    },
    { label: "Test paper for skill evaluation", key: "testPaperForSkillEvaluation" },
    { label: "Meeting Time/Training Time", key: "meetingTimeTrainingTime" },
    { label: "Plan Not Available", key: "planNotAvailable" }
];

// Quality sections in display order. `name` is the stored data key; fields are
// [production qty, defect qty, PPM] — the first two are inputs, PPM is computed.
const QUALITY_SECTIONS = [
    { name: "customerEndDefect", label: "Customer End Defect", fields: ["Production Qty.", "Defect Qty.", "PPM"] },
    { name: "internalDefect", label: "Internal Defect", fields: ["Production Qty.", "Defect Qty.", "PPM"] }
];

export const DEFAULT_DPR_PRESENTATION = Object.freeze({
    delivery: {
        title: "Delivery (Schedule Adherence)",
        headers: [
            h("S.No", { width: "w-8" }), h("W-H CODE", { width: "w-24" }), h("PLAN", { width: "w-16" }),
            h("Lot No.", { width: "w-16" }), h("Start Time", { width: "w-16" }), h("1st 2 Hrs", { width: "w-16" }),
            h("2nd 2 Hrs", { width: "w-16" }), h("3rd 2 Hrs", { width: "w-16" }), h("4th 2 Hrs", { width: "w-16" }),
            h("Total", { width: "w-16" })
        ],
        rows: 6
    },
    quality: {
        title: "Quality (Defect Summary)",
        sections: QUALITY_SECTIONS
    },
    downTime: {
        title: "Down Time Summary",
        headers: [
            h("Down Time :", { colSpan: 2 }), h("1st 2 Hrs", { width: "w-10" }), h("2nd 2 Hrs", { width: "w-10" }),
            h("3rd 2 Hrs", { width: "w-10" }), h("4th 2 Hrs", { width: "w-10" }), h("Total", { width: "w-10" })
        ],
        rows: DOWN_TIME_ROWS
    },
    shiftComm: {
        title: "Shift Communication",
        headerText: "Previous shift issues and general information during start up :",
        rows: 3
    },
    moral: {
        title: "Moral (Manpower Summary)",
        headers: [
            h("Sr. No.", { width: "w-8" }), h("Process"), h("Handover", { width: "w-16" }),
            h("Present", { width: "w-12" }), h("Absent", { width: "w-12" }), h("Present %", { width: "w-12" })
        ]
    },
    footer: {
        title: "Efficiency & Signatures",
        efficiencyTitle: "Direct Efficiency",
        signatureTitle: "Approvals & Signatures",
        madeByLabel: "Made By (Line Leader):",
        checkedByLabel: "Checked By (Shift Incharge):"
    }
});

// Which keys of each section are presentation (owned by the layout editor).
export const DPR_PRESENTATION_FIELDS = Object.freeze({
    delivery: ["title", "headers", "rows"],
    quality: ["title", "sections"],
    downTime: ["title", "headers", "rows"],
    shiftComm: ["title", "headerText", "rows"],
    moral: ["title", "headers"], // moral.rows is manpower data — DPRManage owns it
    footer: ["title", "efficiencyTitle", "signatureTitle", "madeByLabel", "checkedByLabel"]
});

export const DPR_MAX_ROW_COUNT = 50;

const clone = (value) => JSON.parse(JSON.stringify(value));
const isText = (v) => typeof v === "string";

// Header list with stored text over the default shape. If a stored header list has a
// different shape (an older hand-edited layout) it is kept as-is: the sheet renders it
// today and the editor still lets its text be changed.
const resolveHeaders = (stored, fallback) => (Array.isArray(stored) && stored.length ? clone(stored) : clone(fallback));

// Down Time rows: canonical order and keys, with any stored labels laid over them. Group
// labels are matched by their children's keys (groups have no key of their own).
const resolveDownTimeRows = (stored) => {
    const labels = {};
    const groupLabels = {};
    (Array.isArray(stored) ? stored : []).forEach((row) => {
        if (row?.key && isText(row.label)) labels[row.key] = row.label;
        if (Array.isArray(row?.children)) {
            row.children.forEach((c) => { if (c?.key && isText(c.label)) labels[c.key] = c.label; });
            const firstKey = row.children[0]?.key;
            if (firstKey && isText(row.label)) groupLabels[firstKey] = row.label;
        }
    });
    return DOWN_TIME_ROWS.map((row) => row.children
        ? {
            label: groupLabels[row.children[0].key] ?? row.label,
            children: row.children.map((c) => ({ key: c.key, label: labels[c.key] ?? c.label }))
        }
        : { key: row.key, label: labels[row.key] ?? row.label });
};

const resolveQualitySections = (stored) => {
    const byName = {};
    (Array.isArray(stored) ? stored : []).forEach((s) => { if (s?.name) byName[s.name] = s; });
    return QUALITY_SECTIONS.map((def) => {
        const s = byName[def.name] || {};
        return {
            name: def.name,
            label: isText(s.label) ? s.label : def.label,
            fields: def.fields.map((f, i) => (isText(s.fields?.[i]) ? s.fields[i] : f))
        };
    });
};

const resolveCount = (value, fallback) => {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= DPR_MAX_ROW_COUNT ? n : fallback;
};

// Full presentation layout from a stored config (any part may be missing).
export const resolveDprPresentation = (storedConfig) => {
    const s = storedConfig || {};
    const d = DEFAULT_DPR_PRESENTATION;
    const text = (section, field) => (isText(s[section]?.[field]) ? s[section][field] : d[section][field]);
    return {
        delivery: {
            title: text("delivery", "title"),
            headers: resolveHeaders(s.delivery?.headers, d.delivery.headers),
            rows: resolveCount(s.delivery?.rows, d.delivery.rows)
        },
        quality: {
            title: text("quality", "title"),
            sections: resolveQualitySections(s.quality?.sections)
        },
        downTime: {
            title: text("downTime", "title"),
            headers: resolveHeaders(s.downTime?.headers, d.downTime.headers),
            rows: resolveDownTimeRows(s.downTime?.rows)
        },
        shiftComm: {
            title: text("shiftComm", "title"),
            headerText: text("shiftComm", "headerText"),
            rows: resolveCount(s.shiftComm?.rows, d.shiftComm.rows)
        },
        moral: {
            title: text("moral", "title"),
            headers: resolveHeaders(s.moral?.headers, d.moral.headers)
        },
        footer: Object.fromEntries(DPR_PRESENTATION_FIELDS.footer.map((f) => [f, text("footer", f)]))
    };
};

// Shape of a header list: cell count and colSpans (text excluded).
export const dprHeaderShape = (headers = []) => (headers || []).map((c) => c?.colSpan || 1).join(",");

const downTimeKeyShape = (rows = []) => (rows || [])
    .map((r) => (Array.isArray(r?.children) ? `[${r.children.map((c) => c?.key).join(",")}]` : r?.key))
    .join("|");

// Problems with a proposed presentation, compared with the one currently in effect.
// Returns a list of human-readable messages (empty = valid).
export const validateDprPresentation = (next, current) => {
    const errors = [];
    if (!next || typeof next !== "object") return ["Layout is required"];
    ["delivery", "downTime", "moral"].forEach((section) => {
        if (dprHeaderShape(next[section]?.headers) !== dprHeaderShape(current?.[section]?.headers)) {
            errors.push(`${section} header columns cannot change (only their text can be edited)`);
        }
        (next[section]?.headers || []).forEach((cell, i) => {
            if (!isText(cell?.text)) errors.push(`${section} header ${i + 1} must be text`);
        });
    });
    if (downTimeKeyShape(next.downTime?.rows) !== downTimeKeyShape(current?.downTime?.rows)) {
        errors.push("Down Time rows cannot be added, removed or reordered (only their labels can be edited)");
    }
    const qualityNames = (sections) => (sections || []).map((s) => `${s?.name}:${(s?.fields || []).length}`).join(",");
    if (qualityNames(next.quality?.sections) !== qualityNames(current?.quality?.sections)) {
        errors.push("Quality sections cannot be added or removed (only their labels can be edited)");
    }
    [["delivery", "rows"], ["shiftComm", "rows"]].forEach(([section, field]) => {
        const n = Number(next[section]?.[field]);
        if (!Number.isInteger(n) || n < 1 || n > DPR_MAX_ROW_COUNT) {
            errors.push(`${section} row count must be a whole number between 1 and ${DPR_MAX_ROW_COUNT}`);
        }
    });
    return errors;
};

// Writes the presentation keys into a stored config, leaving everything else (notably
// moral.rows and attendance.rows) exactly as it was.
export const mergeDprPresentation = (storedConfig, presentation) => {
    const merged = clone(storedConfig || {});
    Object.entries(DPR_PRESENTATION_FIELDS).forEach(([section, fields]) => {
        merged[section] = { ...(merged[section] || {}) };
        fields.forEach((field) => {
            if (presentation?.[section]?.[field] !== undefined) merged[section][field] = clone(presentation[section][field]);
        });
    });
    return merged;
};
