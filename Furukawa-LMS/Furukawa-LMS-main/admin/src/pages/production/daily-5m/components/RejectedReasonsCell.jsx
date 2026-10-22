import React from 'react';
import { format } from "date-fns";
import { XCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/common/ui/popover.jsx";

const reasonText = (row) => row.reason || "No reason recorded";

// Records-list cell summarising why rows of a 5M sheet were rejected (reads record.rejectedRows).
const RejectedReasonsCell = React.memo(({ rejectedRows }) => {
    if (!rejectedRows?.length) return <span className="text-xs text-slate-300">—</span>;

    const [first] = rejectedRows;
    const extra = rejectedRows.length - 1;

    return (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs text-red-600 truncate flex-1" title={`Row ${first.rowNo}: ${reasonText(first)}`}>
                <span className="font-semibold">Row {first.rowNo}:</span> {reasonText(first)}
            </p>
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                        title="View all rejected rows"
                    >
                        {extra > 0 ? `+${extra}` : <XCircle className="w-3 h-3" />}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 shadow-xl" align="end">
                    <div className="p-3 border-b bg-red-50 rounded-t-md">
                        <p className="text-xs font-semibold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5" />
                            Rejected Rows ({rejectedRows.length})
                        </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                        {rejectedRows.map((row) => (
                            <div key={row.rowNo} className="p-3 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-slate-700">
                                        Row {row.rowNo}{row.actionBy && ` · ${row.actionBy}`}
                                    </span>
                                    {row.actionAt && (
                                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                            {format(new Date(row.actionAt), "PP p")}
                                        </span>
                                    )}
                                </div>
                                <p className={`text-xs leading-relaxed border-l-2 border-red-300 pl-2 ${row.reason ? 'text-slate-600' : 'text-slate-400 italic'}`}>
                                    {reasonText(row)}
                                </p>
                            </div>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
});

RejectedReasonsCell.displayName = 'RejectedReasonsCell';

export default RejectedReasonsCell;
