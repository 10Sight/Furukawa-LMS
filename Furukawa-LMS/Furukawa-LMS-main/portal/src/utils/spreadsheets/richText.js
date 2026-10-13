// Text in a cell that isn't all in one style: a word in red, a few letters in bold.
//
// A cell's own font settings (`bold`, `color`, `fontSize`, ...) apply to all of its
// text. Where part of the text differs, the cell also carries
//
//     rich: { t: "<the text>", runs: [{ start, end, ...style }] }
//
// Each run covers the characters start..end-1 and says what is different about them,
// with the same keys a cell uses (RUN_STYLE_KEYS); a key a run doesn't mention is
// the cell's. `bold: false` is how part of a bold cell is made not bold. Runs are in
// order, never overlap and never run past the text.
//
// `t` is the text the runs were made for. Many things change a cell's value without
// knowing anything about runs — a paste, a fill, Find and Replace — and rather than
// teach each of them, runs simply count for nothing once `t` is no longer the cell's
// value (cellRuns). Only the editor, which knows what was typed where, carries them
// across a change (shiftRunsForEdit).

export const RUN_STYLE_KEYS = ["bold", "italic", "underline", "strike", "color", "fontSize", "fontFamily"];

const styleOf = (run) => {
    const style = {};
    for (const key of RUN_STYLE_KEYS) if (run[key] !== undefined && run[key] !== null) style[key] = run[key];
    return style;
};
const sameStyle = (a, b) => RUN_STYLE_KEYS.every((key) => a[key] === b[key]);
const isWhole = (n) => typeof n === "number" && Number.isInteger(n);

/**
 * Runs put in order and tidied for a text of `length` characters: clipped to it, those
 * that say nothing or cover nothing dropped, neighbours in the same style joined.
 * @returns {object[]|undefined} undefined when no run is left, or when the runs are
 *   not ones this file could have written (not a list, overlapping, not numbers)
 */
export const normalizeRuns = (runs, length) => {
    if (!Array.isArray(runs)) return undefined;
    const sorted = [];
    for (const run of runs) {
        if (!run || !isWhole(run.start) || !isWhole(run.end)) return undefined;
        const start = Math.max(0, run.start), end = Math.min(length, run.end);
        const style = styleOf(run);
        if (end > start && Object.keys(style).length) sorted.push({ start, end, ...style });
    }
    sorted.sort((a, b) => a.start - b.start);
    const out = [];
    for (const run of sorted) {
        const last = out[out.length - 1];
        if (last && run.start < last.end) return undefined;
        if (last && run.start === last.end && sameStyle(last, run)) last.end = run.end;
        else out.push(run);
    }
    return out.length ? out : undefined;
};

/** A cell's runs, if it has any that still belong to its value; otherwise undefined. */
export const cellRuns = (cell) => {
    const rich = cell?.rich;
    if (!rich || typeof cell.value !== "string" || rich.t !== cell.value) return undefined;
    return normalizeRuns(rich.runs, cell.value.length);
};

/**
 * The runs after `patch` is applied to the characters start..end-1. A key set to
 * undefined in `patch` goes back to being the cell's.
 * @returns {object[]|undefined} as normalizeRuns
 */
export const applyRunStyle = (runs, length, start, end, patch) => {
    const from = Math.max(0, Math.min(start, end)), to = Math.min(length, Math.max(start, end));
    const existing = normalizeRuns(runs, length) || [];
    if (to <= from) return existing.length ? existing : undefined;
    const cuts = new Set([0, length, from, to]);
    for (const run of existing) { cuts.add(run.start); cuts.add(run.end); }
    const points = [...cuts].sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i + 1 < points.length; i++) {
        const a = points[i], b = points[i + 1];
        const under = existing.find((run) => run.start <= a && run.end >= b);
        const style = under ? styleOf(under) : {};
        if (a >= from && b <= to) {
            for (const key of RUN_STYLE_KEYS) {
                if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
                if (patch[key] === undefined || patch[key] === null) delete style[key]; else style[key] = patch[key];
            }
        }
        out.push({ start: a, end: b, ...style });
    }
    return normalizeRuns(out, length);
};

/**
 * The runs carried across an edit of the text they were made for. What was typed takes
 * the style of the character before it (of the one after, at the very start); what was
 * deleted takes its part of any run with it.
 * @returns {object[]|undefined} as normalizeRuns
 */
export const shiftRunsForEdit = (runs, oldText, newText) => {
    const existing = normalizeRuns(runs, oldText.length);
    if (!existing) return undefined;
    if (oldText === newText) return existing;
    // The edit, as the one stretch that differs: old[p..oldEnd) became new[p..newEnd).
    const limit = Math.min(oldText.length, newText.length);
    let p = 0;
    while (p < limit && oldText[p] === newText[p]) p++;
    let tail = 0;
    while (tail < limit - p && oldText[oldText.length - 1 - tail] === newText[newText.length - 1 - tail]) tail++;
    const oldEnd = oldText.length - tail, newEnd = newText.length - tail;
    const shift = newEnd - oldEnd;
    // The character whose style the new text takes, as a position in the old text.
    const like = p > 0 ? p - 1 : oldEnd < oldText.length ? oldEnd : -1;

    const out = [];
    for (const run of existing) {
        const style = styleOf(run);
        if (run.start < p) out.push({ start: run.start, end: Math.min(run.end, p), ...style });
        if (newEnd > p && like >= run.start && like < run.end) out.push({ start: p, end: newEnd, ...style });
        if (run.end > oldEnd) out.push({ start: Math.max(run.start, oldEnd) + shift, end: run.end + shift, ...style });
    }
    return normalizeRuns(out, newText.length);
};

/**
 * `text` cut where its style changes: [{ text, style }], in order and covering all of
 * it. `style` is the run's (null where the text is just the cell's).
 */
export const runSegments = (text, runs) => {
    const value = String(text ?? "");
    const list = normalizeRuns(runs, value.length) || [];
    const out = [];
    let at = 0;
    for (const run of list) {
        if (run.start > at) out.push({ text: value.slice(at, run.start), style: null });
        out.push({ text: value.slice(run.start, run.end), style: styleOf(run) });
        at = run.end;
    }
    if (at < value.length || out.length === 0) out.push({ text: value.slice(at), style: null });
    return out;
};

/**
 * Whether every character of start..end-1 has `key` on — in its run, or else in the
 * cell (`cellStyle`). What a toggle such as Bold looks at to decide which way to go.
 */
export const isRunStyleOn = (runs, length, start, end, key, cellStyle) => {
    const from = Math.max(0, Math.min(start, end)), to = Math.min(length, Math.max(start, end));
    if (to <= from) return !!cellStyle?.[key];
    const list = normalizeRuns(runs, length) || [];
    let at = from;
    for (const run of list) {
        if (run.end <= from || run.start >= to) continue;
        if (run.start > at && !cellStyle?.[key]) return false;
        if (!(run[key] !== undefined ? run[key] : cellStyle?.[key])) return false;
        at = Math.max(at, run.end);
    }
    return at >= to || !!cellStyle?.[key];
};

/**
 * `cell` with its runs changed over start..end-1 (see applyRunStyle), or `cell` itself
 * when it holds no plain text to style.
 */
export const withRunStyle = (cell, start, end, patch) => {
    if (!cell || typeof cell.value !== "string" || cell.value === "") return cell;
    const runs = applyRunStyle(cellRuns(cell), cell.value.length, start, end, patch);
    const { rich: _rich, ...rest } = cell;
    return runs ? { ...rest, rich: { t: cell.value, runs } } : rest;
};

/**
 * `cell` after one of its own font settings was changed for all of its text: its runs
 * no longer say anything about `keys`, so the cell's setting shows everywhere.
 */
export const withoutRunKeys = (cell, keys) => {
    const runs = cellRuns(cell);
    if (!cell?.rich) return cell;
    const { rich: _rich, ...rest } = cell;
    if (!runs) return rest;
    const kept = normalizeRuns(runs.map((run) => {
        const next = { ...run };
        for (const key of keys) delete next[key];
        return next;
    }), cell.value.length);
    return kept ? { ...rest, rich: { t: cell.value, runs: kept } } : rest;
};
