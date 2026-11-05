import React, { useRef } from "react";
import { cn } from "@/utils/classNames.js";
import useScrollToCurrentDate from "./useScrollToCurrentDate.js";
import { formatReportDate, requiredHeader } from "@/utils/dailyManpowerExcelExport.js";

// Matrix view of the Daily Manpower Report: frozen Section / Indent 01 / Indent 16 columns and a
// sticky two-tier header, coloured like the HR workbook. Rows come pre-built from the server
// (department, Other, group Total, Training, Grand Total); this component only renders them.

const SUB_HEADERS = [
    { key: "present", label: "Total Present Headcount" },
    { key: "otHrs", label: "Over Time hours" },
    { key: "otMandays", label: "Over Time Mandays" },
    { key: "gap", label: "Gap" },
];

// Column widths and type per size. "large" is the full-screen meeting view (read across a room).
const SIZES = {
    normal: { section: 168, req: 112, sub: "w-[84px] min-w-[84px]", text: "text-xs", sectionHeader: "text-sm", edit: "text-[10px]", maxHeight: "max-h-[calc(100vh-260px)]" },
    large: { section: 240, req: 150, sub: "w-[120px] min-w-[120px]", text: "text-base", sectionHeader: "text-lg", edit: "text-xs", maxHeight: "max-h-[calc(100vh-150px)]" },
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

export default function DailyManpowerReportSheet({ report, visibleDates, darkMode, canEdit, onEditTraining, large = false }) {
    const p = palette(darkMode);
    const size = large ? SIZES.large : SIZES.normal;
    const W_SECTION = size.section;
    const W_REQ = size.req;
    const scrollRef = useRef(null);
    useScrollToCurrentDate(scrollRef, visibleDates, large);
    const latestComputed = [...report.dates].reverse().find((d) => d.computed)?.date || null;

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
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="truncate">{row.label}</span>
                                        {isTraining && canEdit && (
                                            <button
                                                type="button"
                                                onClick={onEditTraining}
                                                className={cn("shrink-0 font-semibold text-blue-600 hover:underline dark:text-blue-400", size.edit)}
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className={cn(cellBase, rc)} style={stickyCol(W_SECTION, W_REQ)}>{formatNumber(row.requiredFN01)}</td>
                                <td className={cn(cellBase, rc)} style={stickyCol(W_SECTION + W_REQ, W_REQ)}>{formatNumber(row.requiredFN02)}</td>
                                {visibleDates.map((d) => {
                                    const c = row.cells[d.date];
                                    const holiday = d.isHoliday && row.kind !== "groupTotal" && row.kind !== "grandTotal";
                                    return SUB_HEADERS.map((s) => (
                                        <td
                                            key={`${row.key}-${d.date}-${s.key}`}
                                            className={cn(
                                                cellBase,
                                                holiday ? p.holiday : rc,
                                                !c && p.muted,
                                                c && s.key === "gap" && c.gap < 0 && row.kind !== "groupTotal" && row.kind !== "grandTotal" && p.negative,
                                            )}
                                        >
                                            {c ? formatNumber(c[s.key]) : "–"}
                                        </td>
                                    ));
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
