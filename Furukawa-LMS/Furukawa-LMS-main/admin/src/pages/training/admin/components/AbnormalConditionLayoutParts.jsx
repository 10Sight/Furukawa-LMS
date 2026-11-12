import React from 'react';
import { LayoutText } from "@/components/common/training/LayoutEditorCells.jsx";

// Shared rendering for the configurable parts of the Abnormal Condition sheet — the title
// and the three header rows. Used by both AbnormalCondition (the real sheet) and
// AbnormalConditionLayoutEditor (its live preview), so the preview cannot drift from the
// sheet. Columns are fixed fields; only their text comes from the layout
// (shared/abnormalConditionLayout.js).

const TH = "p-2 border border-slate-300 font-bold";

// Sheet title text followed by the fixed "(Department - Month)" suffix.
export const AbnormalConditionTitle = ({ title, suffix, onEdit }) => (
    <>
        <LayoutText value={title} onEdit={onEdit} multiline={false} />
        {suffix ? ` (${suffix})` : null}
    </>
);

// The sheet's <thead> rows. onEditText(key, value) makes every header editable.
// `showActions` adds the print-hidden Actions column the live sheet shows to editors.
export const AbnormalConditionHeaderRows = ({ headers, onEditText, showActions = false }) => {
    const text = (key, multiline = true) => (
        <LayoutText value={headers[key]} onEdit={onEditText ? (v) => onEditText(key, v) : null} multiline={multiline} />
    );
    return (
        <>
            <tr className="bg-slate-100 text-xs text-center border-b border-slate-300">
                <th rowSpan={3} className={`${TH} min-w-[50px]`}>{text("sNo", false)}</th>
                <th rowSpan={3} className={`${TH} min-w-[130px]`}>{text("date", false)}</th>
                <th rowSpan={3} className={`${TH} min-w-[130px]`}>{text("line", false)}</th>
                <th rowSpan={3} className={`${TH} min-w-[150px]`}>{text("process", false)}</th>
                <th colSpan={3} className={TH}>{text("containment")}</th>
                <th rowSpan={3} className={`${TH} min-w-[180px]`}>{text("abnormalCondition")}</th>
                <th rowSpan={3} className={`${TH} min-w-[180px]`}>{text("cause")}</th>
                <th rowSpan={3} className={`${TH} min-w-[180px]`}>{text("action")}</th>
                <th rowSpan={3} className={`${TH} min-w-[170px]`}>{text("resp")}</th>
                <th rowSpan={3} className={`${TH} min-w-[110px]`}>{text("target")}</th>
                <th rowSpan={3} className={`${TH} min-w-[180px]`}>{text("setupConfirmation")}</th>
                <th rowSpan={3} className={`${TH} min-w-[160px]`}>{text("approvedBy")}</th>
                {showActions && <th rowSpan={3} className={`${TH} min-w-[60px] no-print`}>Actions</th>}
            </tr>
            <tr className="bg-slate-100 text-[10px] text-center border-b border-slate-300">
                <th colSpan={3} className="p-1.5 border border-slate-300 font-semibold bg-slate-50/80 max-w-[200px] leading-snug">
                    {text("containmentCheck")}
                </th>
            </tr>
            <tr className="bg-slate-100 text-[10px] text-center border-b border-slate-300">
                <th className="p-1 border border-slate-300 font-bold min-w-[80px]">{text("producedQty", false)}</th>
                <th className="p-1 border border-slate-300 font-bold min-w-[80px]">{text("okQty", false)}</th>
                <th className="p-1 border border-slate-300 font-bold min-w-[80px]">{text("ngQty", false)}</th>
            </tr>
        </>
    );
};
