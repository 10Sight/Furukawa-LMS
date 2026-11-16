import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/utils/classNames.js";
import useScrollToCurrentDate from "./useScrollToCurrentDate.js";
import { formatReportDate, requiredHeader } from "@/utils/dailyManpowerExcelExport.js";
import { useSaveTrainingInputsMutation } from "@/services/api/DailyHrMeetingApi.js";

// Matrix view of the Daily Manpower Report: frozen Section / Indent 01 / Indent 16 columns and a
// sticky two-tier header, coloured like the HR workbook. Rows come pre-built from the server
// (department, Other, group Total, Training, Grand Total); this component only renders them.
// The Training row's inputs (Indent 01/16, Present, OT hours) are editable in place for users with
// edit rights. Each save sends only the edited field (the server does a partial update), and the
// derived cells (Mandays, Gap, Grand Total) refresh from the server once the report refetches.

const MAX_MANUAL_VALUE = 100000; // mirrors the server's limit

// Training cells that can be edited, keyed by a stable cell key.
const TRAINING_FIELDS = {
    requiredFN01: { label: "Indent 01 required", integer: true },
    requiredFN02: { label: "Indent 16 required", integer: true },
    present: { label: "Present", integer: true },
    otHrs: { label: "OT hours", integer: false },
};

const FORMULA_TITLES = {
    otMandays: "Auto-calculated: ROUND(OT hours / 8)",
    gap: "Auto-calculated: Present - Required",
};

const cellKey = (field, date) => (date ? `${date}:${field}` : field);

// Parses a draft; empty means 0 (like clearing a spreadsheet cell). Returns { value } or { error }.
const parseDraft = (raw, { label, integer }) => {
    const text = String(raw ?? "").trim();
    if (text === "") return { value: 0 };
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0 || n > MAX_MANUAL_VALUE) return { error: `${label} must be between 0 and ${MAX_MANUAL_VALUE}` };
    if (integer && !Number.isInteger(n)) return { error: `${label} must be a whole number` };
    return { value: integer ? n : Math.round(n * 100) / 100 };
};

// Text input (not type="number", so the mouse wheel can't change it). Commits exactly once:
// Enter / Tab / blur commit, Escape cancels; the ref stops the blur that follows unmount from
// committing a second time.
function InlineInput({ initial, integer, className, onCommit, onCancel }) {
    const [draft, setDraft] = useState(initial);
    const done = useRef(false);
    const finish = (fn) => {
        if (done.current) return;
        done.current = true;
        fn();
    };
    return (
        <input
            autoFocus
            type="text"
            inputMode={integer ? "numeric" : "decimal"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    finish(() => onCommit(draft, 0));
                } else if (e.key === "Tab") {
                    e.preventDefault();
                    finish(() => onCommit(draft, e.shiftKey ? -1 : 1));
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    finish(onCancel);
                }
            }}
            onBlur={() => finish(() => onCommit(draft, 0))}
            className={className}
        />
    );
}

const SUB_HEADERS = [
    { key: "present", label: "Total Present Headcount" },
    { key: "otHrs", label: "Over Time hours" },
    { key: "otMandays", label: "Over Time Mandays" },
    { key: "gap", label: "Gap" },
];

// Column widths and type per size. "large" is the full-screen meeting view (read across a room).
const SIZES = {
    normal: { section: 168, req: 112, sub: "w-[84px] min-w-[84px]", text: "text-xs", sectionHeader: "text-sm", maxHeight: "max-h-[calc(100vh-260px)]" },
    large: { section: 240, req: 150, sub: "w-[120px] min-w-[120px]", text: "text-base", sectionHeader: "text-lg", maxHeight: "max-h-[calc(100vh-150px)]" },
};

const formatNumber = (value) => {
    if (value === null || value === undefined) return "";
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
};

const palette = (darkMode) => (darkMode
    ? {
        section: "bg-[#3b5323] text-green-50",
        required: "bg-[#5c5200] text-yellow-50",
        dateHeader: "bg-slate-800 text-slate-100",
        latestDateHeader: "bg-[#2f4a2a] text-green-50",
        subHeader: "bg-slate-700 text-slate-100",
        body: "bg-slate-900 text-slate-100",
        holiday: "bg-slate-800/70 text-slate-300",
        total: "bg-slate-700 text-white font-bold",
        grandTotal: "bg-[#6b3a22] text-orange-50 font-bold",
        training: "bg-slate-900 text-slate-100",
        border: "border-slate-700",
        muted: "text-slate-500",
        negative: "text-red-400",
    }
    : {
        section: "bg-[#A9D08E] text-black",
        required: "bg-[#FFFF00] text-black",
        dateHeader: "bg-white text-black",
        latestDateHeader: "bg-[#E2EFDA] text-black",
        subHeader: "bg-[#D9D9D9] text-black",
        body: "bg-white text-slate-900",
        holiday: "bg-[#F2F2F2] text-slate-600",
        total: "bg-[#D9D9D9] text-black font-bold",
        grandTotal: "bg-[#F8CBAD] text-black font-bold",
        training: "bg-white text-slate-900",
        border: "border-slate-400",
        muted: "text-slate-400",
        negative: "text-red-600",
    });

export default function DailyManpowerReportSheet({ report, visibleDates, darkMode, canEdit, large = false }) {
    const p = palette(darkMode);
    const size = large ? SIZES.large : SIZES.normal;
    const W_SECTION = size.section;
    const W_REQ = size.req;
    const scrollRef = useRef(null);
    useScrollToCurrentDate(scrollRef, visibleDates, large);
    const latestComputed = [...report.dates].reverse().find((d) => d.computed)?.date || null;

    // ---- Inline Training editing ----
    // Not in the full-screen meeting view, where a stray click while presenting shouldn't open an editor.
    const editable = Boolean(canEdit && !large && report.training);
    const [saveTraining] = useSaveTrainingInputsMutation();
    // { key, field, date, draft, nonce } of the cell being edited (nonce remounts the input).
    const [editing, setEditing] = useState(null);
    // key -> { value, saved, token }: values shown until the refetched report arrives, so the
    // cell doesn't flash back to its old value between save and refetch.
    const [pending, setPending] = useState({});

    // A new report means saved values are now in the server data; keep only in-flight saves.
    useEffect(() => {
        setPending((prev) => {
            const kept = Object.fromEntries(Object.entries(prev).filter(([, v]) => !v.saved));
            return Object.keys(kept).length === Object.keys(prev).length ? prev : kept;
        });
    }, [report.training]);

    // Editable cells in Tab order: Indent 01, Indent 16, then Present / OT hours for each visible date.
    const editableCells = editable
        ? [
            { key: cellKey("requiredFN01"), field: "requiredFN01" },
            { key: cellKey("requiredFN02"), field: "requiredFN02" },
            ...visibleDates.flatMap((d) => [
                { key: cellKey("present", d.date), field: "present", date: d.date },
                { key: cellKey("otHrs", d.date), field: "otHrs", date: d.date },
            ]),
        ]
        : [];

    const storedValue = (cell) => (cell.date ? report.training?.cells?.[cell.date]?.[cell.field] : report.training?.[cell.field]) ?? 0;
    const shownValue = (cell) => (pending[cell.key] ? pending[cell.key].value : storedValue(cell));

    const beginEdit = (cell, draft) => setEditing({ ...cell, draft: draft ?? formatNumber(shownValue(cell)), nonce: Date.now() + Math.random() });

    const commitEdit = (cell, raw, move) => {
        const parsed = parseDraft(raw, TRAINING_FIELDS[cell.field]);
        if (parsed.error) {
            toast.error(parsed.error);
            beginEdit(cell, raw);
            return;
        }

        const index = editableCells.findIndex((c) => c.key === cell.key);
        const next = move && index >= 0 ? editableCells[index + move] : null;
        if (next) beginEdit(next);
        else setEditing(null);

        const { value } = parsed;
        if (value === Number(shownValue(cell))) return;

        // Send only the edited field; the server leaves every other stored value alone.
        const payload = cell.date
            ? { year: report.year, month: report.monthNumber, entries: [{ date: cell.date, [cell.field === "present" ? "presentCount" : "otHrs"]: value }] }
            : { year: report.year, month: report.monthNumber, [cell.field]: value };

        const token = Symbol(cell.key);
        setPending((prev) => ({ ...prev, [cell.key]: { value, saved: false, token } }));
        saveTraining(payload).unwrap()
            .then(() => {
                setPending((prev) => (prev[cell.key]?.token === token ? { ...prev, [cell.key]: { ...prev[cell.key], saved: true } } : prev));
            })
            .catch((error) => {
                setPending((prev) => {
                    if (prev[cell.key]?.token !== token) return prev;
                    const { [cell.key]: _removed, ...rest } = prev;
                    return rest;
                });
                toast.error(error?.message || `Could not save ${TRAINING_FIELDS[cell.field].label}`);
                // Reopen the cell with what was typed, unless the user has moved on to another cell.
                setEditing((current) => current ?? { ...cell, draft: String(raw), nonce: Date.now() + Math.random() });
            });
    };

    const hoverClass = darkMode ? "hover:bg-blue-950/50" : "hover:bg-blue-50";
    const renderEditableCell = (cell, className, style) => {
        const isEditing = editing?.key === cell.key;
        const pend = pending[cell.key];
        const { integer } = TRAINING_FIELDS[cell.field];
        return (
            <td
                key={cell.key}
                className={cn(className, isEditing ? "outline outline-2 -outline-offset-2 outline-blue-500" : cn("cursor-pointer", hoverClass))}
                style={style}
                title={isEditing ? undefined : `Click to edit ${TRAINING_FIELDS[cell.field].label}`}
                onClick={isEditing ? undefined : () => beginEdit(cell)}
            >
                {isEditing ? (
                    <InlineInput
                        key={editing.nonce}
                        initial={editing.draft}
                        integer={integer}
                        className="w-full min-w-0 bg-transparent p-0 text-center tabular-nums outline-none"
                        onCommit={(raw, move) => commitEdit(cell, raw, move)}
                        onCancel={() => setEditing(null)}
                    />
                ) : (
                    <span className="inline-flex items-center justify-center gap-1">
                        {formatNumber(shownValue(cell))}
                        {pend && !pend.saved && <IconLoader2 className="size-3 animate-spin opacity-70" aria-label="Saving" />}
                    </span>
                )}
            </td>
        );
    };

    const rows = [
        ...report.groups.flatMap((g) => [...g.rows, g.total]),
        ...(report.training ? [report.training] : []),
        ...(report.grandTotal ? [report.grandTotal] : []),
    ];

    const rowClass = (row) => {
        if (row.kind === "groupTotal") return p.total;
        if (row.kind === "grandTotal") return p.grandTotal;
        if (row.kind === "training") return p.training;
        return p.body;
    };

    const cellBase = cn("border text-center tabular-nums whitespace-nowrap", large ? "px-3 py-1.5" : "px-2 py-1", p.border);
    const stickyCol = (left, width) => ({ position: "sticky", left, minWidth: width, maxWidth: width, width, zIndex: 2 });

    return (
        <div ref={scrollRef} className={cn("relative overflow-auto rounded-lg border", size.maxHeight, p.border)}>
            <table className={cn("border-separate border-spacing-0", size.text)}>
                <thead className="sticky top-0 z-20">
                    <tr>
                        <th rowSpan={2} className={cn(cellBase, "font-bold", size.sectionHeader, p.section)} style={{ ...stickyCol(0, W_SECTION), zIndex: 30 }}>
                            Section
                        </th>
                        <th rowSpan={2} className={cn(cellBase, "font-bold whitespace-normal", p.required)} style={{ ...stickyCol(W_SECTION, W_REQ), zIndex: 30 }}>
                            {requiredHeader("01", report.monthNumber, report.year)}
                        </th>
                        <th rowSpan={2} className={cn(cellBase, "font-bold whitespace-normal", p.required)} style={{ ...stickyCol(W_SECTION + W_REQ, W_REQ), zIndex: 30 }}>
                            {requiredHeader("16", report.monthNumber, report.year)}
                        </th>
                        {visibleDates.map((d) => (
                            <th
                                key={d.date}
                                data-date={d.date}
                                colSpan={4}
                                className={cn(cellBase, "font-bold underline", d.date === latestComputed ? p.latestDateHeader : p.dateHeader)}
                                title={d.computed ? `Stored ${d.computedAt ? new Date(d.computedAt).toLocaleString() : ""} (${d.computeSource || ""})` : "Not calculated yet"}
                            >
                                Daily Manpower Report {formatReportDate(d.date)}
                                {d.isHoliday && <span className="ml-1 font-normal no-underline">(Holiday)</span>}
                            </th>
                        ))}
                    </tr>
                    <tr>
                        {visibleDates.map((d) => SUB_HEADERS.map((s) => (
                            <th key={`${d.date}-${s.key}`} className={cn(cellBase, "font-semibold whitespace-normal", size.sub, p.subHeader)}>
                                {s.label}
                            </th>
                        )))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const rc = rowClass(row);
                        const isTraining = row.kind === "training";
                        return (
                            <tr key={row.key}>
                                <td
                                    className={cn(cellBase, "text-left", rc)}
                                    style={stickyCol(0, W_SECTION)}
                                    title={row.mergedLabels?.length ? `Includes: ${row.mergedLabels.join(", ")}` : undefined}
                                >
                                    <span className="block truncate">{row.label}</span>
                                </td>
                                {isTraining && editable
                                    ? renderEditableCell(editableCells[0], cn(cellBase, rc), stickyCol(W_SECTION, W_REQ))
                                    : <td className={cn(cellBase, rc)} style={stickyCol(W_SECTION, W_REQ)}>{formatNumber(row.requiredFN01)}</td>}
                                {isTraining && editable
                                    ? renderEditableCell(editableCells[1], cn(cellBase, rc), stickyCol(W_SECTION + W_REQ, W_REQ))
                                    : <td className={cn(cellBase, rc)} style={stickyCol(W_SECTION + W_REQ, W_REQ)}>{formatNumber(row.requiredFN02)}</td>}
                                {visibleDates.map((d) => {
                                    const c = row.cells[d.date];
                                    const holiday = d.isHoliday && row.kind !== "groupTotal" && row.kind !== "grandTotal";
                                    return SUB_HEADERS.map((s) => {
                                        const className = cn(
                                            cellBase,
                                            holiday ? p.holiday : rc,
                                            !c && p.muted,
                                            c && s.key === "gap" && c.gap < 0 && row.kind !== "groupTotal" && row.kind !== "grandTotal" && p.negative,
                                        );
                                        if (isTraining && editable && TRAINING_FIELDS[s.key]) {
                                            return renderEditableCell({ key: cellKey(s.key, d.date), field: s.key, date: d.date }, className);
                                        }
                                        return (
                                            <td
                                                key={`${row.key}-${d.date}-${s.key}`}
                                                className={className}
                                                title={isTraining && editable ? FORMULA_TITLES[s.key] : undefined}
                                            >
                                                {c ? formatNumber(c[s.key]) : "–"}
                                            </td>
                                        );
                                    });
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
