import React, { useRef } from "react";
import { cn } from "@/utils/classNames.js";
import useScrollToCurrentDate from "./useScrollToCurrentDate.js";

// Daily Handover Report tab: Handover Actual by section (with the vertical "Handover Plan" cell)
// followed by Hiring Actual by shift. Both live in one table so their date columns stay aligned
// and scroll together. Rows and totals come pre-built from the server.

// Column widths and type per size. "large" is the full-screen meeting view (read across a room).
const SIZES = {
    normal: { label: 150, plan: 34, date: "min-w-[84px]", text: "text-xs", title: "text-sm", plan_text: "text-[10px]", maxHeight: "max-h-[calc(100vh-260px)]" },
    large: { label: 220, plan: 44, date: "min-w-[120px]", text: "text-base", title: "text-lg", plan_text: "text-sm", maxHeight: "max-h-[calc(100vh-150px)]" },
};

const palette = (darkMode) => (darkMode
    ? {
        header: "bg-slate-800 text-slate-100",
        plan: "bg-slate-800 text-slate-300",
        body: "bg-slate-900 text-slate-100",
        total: "bg-slate-700 text-white font-bold",
        grandTotal: "bg-[#6b3a22] text-orange-50 font-bold",
        hiringLabel: "bg-slate-800 text-slate-100 font-semibold",
        border: "border-slate-700",
        zero: "text-slate-500",
    }
    : {
        header: "bg-white text-black",
        plan: "bg-[#F2F2F2] text-slate-700",
        body: "bg-white text-slate-900",
        total: "bg-[#D9D9D9] text-black font-bold",
        grandTotal: "bg-[#F8CBAD] text-black font-bold",
        hiringLabel: "bg-[#D9D9D9] text-black font-semibold",
        border: "border-slate-400",
        zero: "text-slate-400",
    });

export default function DailyHandoverReportSheet({ report, visibleDates, darkMode, large = false }) {
    const p = palette(darkMode);
    const size = large ? SIZES.large : SIZES.normal;
    const W_LABEL = size.label;
    const W_PLAN = size.plan;
    const scrollRef = useRef(null);
    useScrollToCurrentDate(scrollRef, visibleDates, large);
    const handoverRows = [
        ...report.handover.groups.flatMap((g) => [...g.rows, g.total]),
        report.handover.grandTotal,
    ];
    const hiringRows = [...report.hiring.rows, report.hiring.grandTotal];

    const cellBase = cn("border text-center tabular-nums whitespace-nowrap", large ? "px-3 py-1.5" : "px-2 py-1", p.border);
    const sticky = (left, width, zIndex = 2) => ({ position: "sticky", left, minWidth: width, maxWidth: width, width, zIndex });
    const rowClass = (row) => (row.kind === "groupTotal" ? p.total : row.kind === "grandTotal" ? p.grandTotal : p.body);

    const valueCells = (row) => visibleDates.map((d) => {
        const v = row.values[d.date] || 0;
        return (
            <td key={`${row.key}-${d.date}`} className={cn(cellBase, rowClass(row), v === 0 && row.kind !== "grandTotal" && row.kind !== "groupTotal" && p.zero)}>
                {v}
            </td>
        );
    });

    const dateHeaders = (keyPrefix) => visibleDates.map((d) => (
        <th key={`${keyPrefix}-${d.date}`} data-date={d.date} className={cn(cellBase, "font-bold", size.date, p.header)}>{d.date}</th>
    ));

    return (
        <div ref={scrollRef} className={cn("relative overflow-auto rounded-lg border", size.maxHeight, p.border)}>
            <table className={cn("border-separate border-spacing-0", size.text)}>
                <thead className="sticky top-0 z-20">
                    <tr>
                        <th colSpan={2} className={cn(cellBase, "font-bold underline", size.title, p.header)} style={sticky(0, W_LABEL + W_PLAN, 30)}>
                            Daily Handover Report
                        </th>
                        {dateHeaders("h")}
                    </tr>
                </thead>
                <tbody>
                    {handoverRows.map((row, index) => (
                        <tr key={row.key}>
                            <td
                                className={cn(cellBase, "text-left", rowClass(row))}
                                style={sticky(0, W_LABEL)}
                                title={row.mergedLabels?.length ? `Includes: ${row.mergedLabels.join(", ")}` : undefined}
                            >
                                <span className="block truncate">{row.label}</span>
                            </td>
                            {index === 0 && (
                                <td
                                    rowSpan={handoverRows.length}
                                    className={cn(cellBase, "px-0 font-bold tracking-[0.15em]", p.plan)}
                                    style={sticky(W_LABEL, W_PLAN)}
                                >
                                    <span className={cn("inline-block [writing-mode:vertical-rl] [text-orientation:upright]", size.plan_text)}>Handover Plan</span>
                                </td>
                            )}
                            {valueCells(row)}
                        </tr>
                    ))}

                    <tr aria-hidden="true">
                        <td colSpan={2 + visibleDates.length} className="h-5 border-0 bg-transparent" />
                    </tr>

                    <tr>
                        <th colSpan={2} className={cn(cellBase, "font-bold", size.title, p.header)} style={sticky(0, W_LABEL + W_PLAN)}>
                            Hiring Actual
                        </th>
                        {dateHeaders("r")}
                    </tr>
                    {hiringRows.map((row) => (
                        <tr key={row.key}>
                            <td
                                colSpan={2}
                                className={cn(cellBase, "text-center", row.kind === "grandTotal" ? p.grandTotal : p.hiringLabel)}
                                style={sticky(0, W_LABEL + W_PLAN)}
                                title={row.shiftKey === "UNASSIGNED" ? "Dojo recruits with no A/B/C/G shift recorded" : undefined}
                            >
                                {row.label}
                            </td>
                            {valueCells(row)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
