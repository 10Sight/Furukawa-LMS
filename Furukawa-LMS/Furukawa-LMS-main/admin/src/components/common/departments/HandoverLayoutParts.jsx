import React from 'react';
import { LayoutText } from "@/components/common/training/LayoutEditorCells.jsx";

// Shared rendering for the configurable parts of the Handover Sheet — the title, the
// "From:" label and the column header row. Used by both HandoverSheet (the real sheet) and
// HandoverSheetLayoutEditor (its live preview), so the preview cannot drift from the sheet.
// Layout rules live in shared/handoverSheetLayout.js.

export const HandoverTitle = ({ title, onEdit }) => (
    <LayoutText value={title} onEdit={onEdit} multiline={false} />
);

export const HandoverFromLabel = ({ value, onEdit }) => (
    <LayoutText value={value} onEdit={onEdit} multiline={false} />
);

// Header cells for the visible columns plus the always-present Approve / Reject column.
// onEditHeader(field, value) makes headers editable; field "status" is the Approve column.
// `renderExtra(column)` lets the editor add per-column controls under each header.
export const HandoverHeaderCells = ({ columns = [], statusHeader, onEditHeader, renderExtra }) => (
    <>
        {columns.map((col) => (
            <th key={col.field} className={`border p-2 ${col.className || ""}`} style={col.style || {}}>
                <LayoutText value={col.header} onEdit={onEditHeader ? (v) => onEditHeader(col.field, v) : null} />
                {renderExtra ? renderExtra(col) : null}
            </th>
        ))}
        <th className="border p-2">
            <LayoutText value={statusHeader} onEdit={onEditHeader ? (v) => onEditHeader("status", v) : null} multiline={false} />
        </th>
    </>
);
