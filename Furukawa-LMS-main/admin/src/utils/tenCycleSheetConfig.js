// Shared 10-Cycle Check Sheet layout config helpers — used by both the sheet
// page (Cycle10.jsx) and the dedicated layout editor (Cycle10LayoutEditor.jsx)
// so the two never drift apart on what a "config" shape looks like.

export const ALL_FORM_TYPES = [
    { id: 'form1', label: 'Form 1 (Standard)' },
    { id: 'form2', label: 'Form 2 (Complete)' },
    { id: 'form3', label: 'Form 3 (10 Cycle Numerical)' }
];

// Layout configuration: labels/descriptions for Section A questions & general
// points, Section B measuring instruments, and Section C inspection columns.
// Field keys on each row (secA_q1, secB_linearScale, etc.) stay derived from
// each item's `id`, so relabeling never breaks previously saved sheet data.
//
// Each form type (form1/form2/form3) keeps its own independent set of
// questions/instruments/columns — a sheet is permanently one form type, so
// editing Form 1's layout must never change what Form 2 or Form 3 show.
// buildDefaultFormConfig() is called fresh every time so the three forms
// (and any fallback/default reads) never share the same array/object
// references — editing one can never leak into another via object mutation.
export const buildDefaultFormConfig = () => ({
    secA: {
        questions: [
            { id: 'q1', label: 'Q1', desc: 'Is Operator aware of SOP Availability?' },
            { id: 'q2', label: 'Q2', desc: 'Does Operator understand SOP?' },
            { id: 'q3', label: 'Q3', desc: 'Is Operator adhering SOP?' },
            { id: 'q4', label: 'Q4', desc: 'Does Operator know operation cycle time?' },
        ],
        generalPoints: [
            { id: 'gp1', label: 'Q1', desc: "Is process started after 5'S?" },
            { id: 'gp2', label: 'Q2', desc: 'Is station check sheet filled?' },
            { id: 'gp3', label: 'Q3', desc: 'Is defective part identified?' },
            { id: 'gp4', label: 'Q4', desc: 'Is NC part handling system followed?' },
            { id: 'gp5', label: 'Q5', desc: 'Is Operator aware about 5 safety principle?' },
            { id: 'gp6', label: 'Q6', desc: 'Is operator aware about abnormal condition?' },
        ],
    },
    secB: {
        instruments: [
            { id: 'linearScale', label: 'Linear Scale' },
            { id: 'micrometer', label: 'Point Micrometer' },
            { id: 'bladeMicrometer', label: 'Blade Micrometer' },
            { id: 'strippingGauge', label: 'Stripping Gauge' },
            { id: 'others', label: 'Others' },
        ],
    },
    secC: {
        columns: [
            { id: '1', label: '1' },
            { id: '2', label: '2' },
            { id: '3', label: '3' },
            { id: '4', label: '4' },
            { id: '5', label: '5' },
        ],
    },
});

// Normalizes ONE form's {secA,secB,secC} shape. Always returns fresh
// objects/arrays (never a shared reference to a fallback or default),
// so callers can safely hand the result to state without risking one
// scope's edits mutating another scope's in-memory config.
export const normalizeFormConfig = (raw) => {
    const fallback = buildDefaultFormConfig();
    if (!raw || typeof raw !== 'object') return fallback;
    const pick = (arr, fb) => (Array.isArray(arr) && arr.length > 0 ? arr.map(x => ({ ...x })) : fb);
    return {
        secA: {
            questions: pick(raw.secA?.questions, fallback.secA.questions),
            generalPoints: pick(raw.secA?.generalPoints, fallback.secA.generalPoints),
        },
        secB: {
            instruments: pick(raw.secB?.instruments, fallback.secB.instruments),
        },
        secC: {
            columns: pick(raw.secC?.columns, fallback.secC.columns),
        },
    };
};

export const DEFAULT_10CYCLE_CONFIG = {
    form1: buildDefaultFormConfig(),
    form2: buildDefaultFormConfig(),
    form3: buildDefaultFormConfig(),
};

// Normalizes the full { form1, form2, form3 } config blob for a scope.
// Also upgrades older saved rows (from before per-form configs existed)
// that stored a single flat {secA,secB,secC} shape shared by all forms.
export const normalizeConfig = (raw) => {
    if (raw && typeof raw === 'object' && (raw.secA || raw.secB || raw.secC) && !raw.form1 && !raw.form2 && !raw.form3) {
        return {
            form1: normalizeFormConfig(raw),
            form2: normalizeFormConfig(raw),
            form3: normalizeFormConfig(raw),
        };
    }
    return {
        form1: normalizeFormConfig(raw?.form1),
        form2: normalizeFormConfig(raw?.form2),
        form3: normalizeFormConfig(raw?.form3),
    };
};

// Maps a group name to where its array lives inside one form's {secA,secB,secC} config
export const LAYOUT_GROUP_PATHS = {
    questions: ['secA', 'questions'],
    generalPoints: ['secA', 'generalPoints'],
    instruments: ['secB', 'instruments'],
    columns: ['secC', 'columns'],
};

export const getLayoutGroupArray = (formCfg, group) => {
    const [sec, key] = LAYOUT_GROUP_PATHS[group];
    return formCfg[sec][key];
};
