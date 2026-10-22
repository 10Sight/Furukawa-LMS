import React from 'react';
import { cn } from "@/utils/classNames.js";
import { ROW_STATE } from "../../../../../../shared/daily5mRowStatus.js";

const STATE_STYLES = {
    [ROW_STATE.APPROVED]: { label: "Approved", pill: "bg-green-100 text-green-700 border-green-300", count: "bg-green-50 text-green-700 border-green-200" },
    [ROW_STATE.PENDING]: { label: "Pending", pill: "bg-amber-50 text-amber-700 border-amber-300", count: "bg-amber-50 text-amber-700 border-amber-200" },
    [ROW_STATE.REJECTED]: { label: "Rejected", pill: "bg-red-100 text-red-700 border-red-300", count: "bg-red-50 text-red-700 border-red-200" },
};
const COUNT_ORDER = [
    [ROW_STATE.APPROVED, "approved"],
    [ROW_STATE.PENDING, "pending"],
    [ROW_STATE.REJECTED, "rejected"],
];

// Records-list cell: per-row status of a 5M sheet (reads record.rowStatusSummary), so a sheet with
// one rejected row shows exactly which rows are approved, pending and rejected.
const RowStatusCell = React.memo(({ summary, submitted }) => {
    if (!summary?.total) return <span className="text-xs text-slate-300">No rows</span>;

    return (
        <div className="flex flex-col gap-1.5 min-w-[150px]">
            <div className="flex flex-wrap items-center gap-1">
                {COUNT_ORDER.filter(([, key]) => summary[key] > 0).map(([state, key]) => (
                    <span key={state} className={cn("px-1.5 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap", STATE_STYLES[state].count)}>
                        {summary[key]} {STATE_STYLES[state].label}
                    </span>
                ))}
                {submitted && (
                    <span className="px-1.5 py-0.5 rounded border text-[10px] font-semibold bg-blue-50 text-blue-700 border-blue-200">Submitted</span>
                )}
            </div>
            <div className="flex flex-wrap gap-1 max-w-[200px]">
                {summary.rows.map(({ rowNo, state }) => (
                    <span
                        key={rowNo}
                        title={`Row ${rowNo}: ${STATE_STYLES[state].label}`}
                        className={cn("inline-flex items-center justify-center min-w-[26px] h-5 px-1 rounded-full border text-[10px] font-bold", STATE_STYLES[state].pill)}
                    >
                        R{rowNo}
                    </span>
                ))}
            </div>
        </div>
    );
});

RowStatusCell.displayName = 'RowStatusCell';

export default RowStatusCell;
