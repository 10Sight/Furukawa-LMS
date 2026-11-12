import React from 'react';
import { EditableCell } from "@/components/common/training/LayoutEditorCells.jsx";
import { DEFAULT_CHANGE_TYPE_CONFIG } from "./daily5mLayoutDefaults.js";

// Shared rendering for the configurable parts of a Daily 5M sheet — the header rows and
// the "5M Change Type" footer table. Used by both Daily5MRecording (the real sheet) and
// Daily5MLayoutEditor (its live preview), so the preview can never drift from the sheet.
//
// Layout rules: the body cells below the header are fixed JSX with fixed field names, so
// only header TEXT is editable — never the number of cells or their colSpan/rowSpan (the
// server rejects shape changes too; see save5MConfigWithRevision). The change-type table
// and its notes are purely descriptive and fully text-editable.

// Older saved layouts spell some headers without line breaks; map them to the wrapped form.
const HEADER_NORMALIZE_MAP = {
    "Planned / Un-Planned": "Planned / <br /> Un-Planned",
    "Planned/Un-Planned": "Planned / <br /> Un-Planned",
    "Operator Code/ID": "Operator Code / <br /> ID",
    "Operator / Inspector ID": "Operator Code / <br /> ID",
    "Auth. Operator / Inspector Name": "Auth. Operator / <br /> Inspector Name",
    "Operator / Inspector Name": "Auth. Operator / <br /> Inspector Name",
    "Current Skill Level": "Current <br /> Skill <br /> Level",
    "Req. Min Skill Level": "Req. Min <br /> Skill Level",
    "Operator Code": "Operator <br /> Code",
    "Employee Code": "Operator <br /> Code",
    "Actual Skill Level": "Actual Skill <br /> Level",
    "Deputed From (Line/Process/Station)": "Deputed From <br /> (Line/Process/Station)",
    "Deputed Plan (Date)": "Deputation Plan <br /> (Date)",
    "Deputed on Plan": "Deputation Plan <br /> (Date)",
    "Deputation Plan (Date)": "Deputation Plan <br /> (Date)",
    "OJT Status (Attached OJT sheet)": "OJT Status <br /> (Attached OJT sheet)",
    "OJT Status (Attached OJT Sheet)": "OJT Status <br /> (Attached OJT sheet)",
    "OJT Status (Attended/Not Attended) [Attached OJT sheet]": "OJT Status <br /> (Attached OJT sheet)",
    "Last Produced Part Status (Parameters)": "Last Produced Part Status <br /> Parameters"
};

const BREAK_PATTERN = /(?:<br\s*\/?>|<\/br>|\n)/gi;

// Header text with {DeptName} substituted and <br /> / newlines rendered as line breaks.
const renderHeaderContent = (rawText, processText = (t) => t || "") => {
    if (!rawText) return "";
    let text = processText(rawText);
    if (HEADER_NORMALIZE_MAP[text]) text = HEADER_NORMALIZE_MAP[text];

    const parts = text.split(BREAK_PATTERN);
    if (parts.length === 1) return parts[0];

    return (
        <span className="inline-block leading-tight text-center">
            {parts.map((part, idx) => (
                <React.Fragment key={idx}>
                    {part}
                    {idx < parts.length - 1 && <br />}
                </React.Fragment>
            ))}
        </span>
    );
};

const getHeaderClassName = (header) => {
    let classes = "border border-black py-0.5 px-0 text-center ";
    if (header.className) classes += header.className;
    if (header.width) classes += ` ${header.width}`;

    const plainText = (header.text || "").replace(/<[^>]*>/g, '').trim();
    if (plainText === "Sr.no" || plainText === "Sr. No.") {
        classes += " w-10 min-w-[36px] max-w-[48px]";
    } else if (plainText === "Part No.") {
        classes += " w-16 min-w-[60px] max-w-[110px]";
    } else if (plainText === "Lot No.") {
        classes += " w-14 min-w-[50px] max-w-[95px]";
    } else if (plainText === "Circuit No.") {
        classes += " w-16 min-w-[60px] max-w-[100px]";
    } else if (plainText === "Produced Qty." || plainText === "Produce d Qty.") {
        classes += " w-12 min-w-[42px] max-w-[65px]";
    } else if (plainText === "NG Qty.") {
        classes += " w-12 min-w-[42px] max-w-[65px]";
    } else if (plainText === "Remarks") {
        classes += " w-20 min-w-[70px] max-w-[130px]";
    } else if (plainText === "Process Owner") {
        classes += " w-20 min-w-[75px] max-w-[110px]";
    }

    return classes;
};

// Stored text uses "<br />" for line breaks; the in-place editor shows them as newlines.
const toEditableText = (text) => (text || "").replace(/\s*(?:<br\s*\/?>|<\/br>)\s*/gi, "\n");
const fromEditableText = (text) => (text || "").split("\n").map(s => s.trim()).join(" <br /> ");

// Click-to-edit text for the layout editor; plain rendered text everywhere else.
const LayoutText = ({ value, onEdit, multiline = true, render }) => {
    if (!onEdit) return render ? render(value) : value;
    return (
        <EditableCell
            value={toEditableText(value)}
            onCommit={(next) => onEdit(fromEditableText(next))}
            placeholder="—"
            multiline={multiline}
            inputClassName="text-[11px] text-black font-normal text-left"
        />
    );
};

// Non-crimping layouts get an injected "Approve or Reject" column (crimping has its own in
// the config). Returns the header row that hosts it.
const findApproveRejectRow = (headers, formType) => {
    const totalHeaderRows = headers.length;
    let targetRowIndex = totalHeaderRows - 1;
    if (formType !== 'crimping') {
        for (let i = 0; i < totalHeaderRows; i++) {
            const row = headers[i];
            const lastItem = row[row.length - 1];
            if (lastItem && (i + (lastItem.rowSpan || 1) === totalHeaderRows) && row.length > 1) {
                targetRowIndex = i;
                break;
            }
        }
    }
    return targetRowIndex;
};

// The sheet's <thead> rows. With `onEditText(path, value)` every header text (and split
// label) becomes click-to-edit; path = { kind: 'header', row, col, split? }.
export const Daily5MHeaderRows = ({ headers = [], formType, processText, onEditText }) => {
    const targetRowIndex = findApproveRejectRow(headers, formType);

    return headers.map((row, rowIndex) => (
        <tr key={rowIndex}>
            {row.map((header, colIndex) => {
                const isLastInRow = colIndex === row.length - 1;
                const adjustedColSpan = (formType !== 'crimping' && rowIndex < targetRowIndex && isLastInRow)
                    ? (header.colSpan || 1) + 1
                    : header.colSpan;
                const edit = onEditText
                    ? (split) => (value) => onEditText({ kind: 'header', row: rowIndex, col: colIndex, split }, value)
                    : null;

                return (
                    <th
                        key={colIndex}
                        colSpan={adjustedColSpan}
                        rowSpan={header.rowSpan}
                        className={getHeaderClassName(header)}
                    >
                        {header.isSplit ? (
                            <div className="flex flex-col h-full min-h-[40px]">
                                {header.splitLabels?.map((label, idx) => (
                                    <div key={idx} className={`flex-1 flex items-center justify-center ${idx < header.splitLabels.length - 1 ? 'border-b border-black' : ''}`}>
                                        <LayoutText value={label} onEdit={edit?.(idx)} multiline={false} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <LayoutText
                                value={header.text}
                                onEdit={edit?.(undefined)}
                                render={(text) => renderHeaderContent(text, processText)}
                            />
                        )}
                    </th>
                );
            })}
            {formType !== 'crimping' && rowIndex === targetRowIndex && (
                <th
                    rowSpan={row[row.length - 1]?.rowSpan || 1}
                    className="border border-black py-0.5 px-0 bg-slate-100 font-bold text-center text-[10px] uppercase align-middle shadow-sm"
                >
                    Approve or Reject
                </th>
            )}
        </tr>
    ));
};

// The "5M Change Type" footer table with its notes column. With `onEditText(path, value)`
// every text becomes click-to-edit; path kinds: 'ctTitle', 'ctCell' {row, col},
// 'noteTerm' {idx}, 'noteDef' {idx}.
export const Daily5MChangeTypeTable = ({ config, processText = (t) => t || "", onEditText }) => {
    const changeTypeConfig = config || DEFAULT_CHANGE_TYPE_CONFIG;
    const notes = changeTypeConfig.notes || [];
    const edit = (path) => (onEditText ? (value) => onEditText(path, value) : null);

    return (
        <div className="mt-8 border-2 border-black">
            <table className="w-full border-collapse text-[12px] sm:text-sm">
                <thead>
                    <tr>
                        <th colSpan={100} className="border border-black bg-gray-100 p-1 text-left font-bold text-[12px]">
                            <LayoutText value={changeTypeConfig.title} onEdit={edit({ kind: 'ctTitle' })} multiline={false} render={processText} />
                        </th>
                    </tr>
                </thead>
                <tbody className="text-[16px] leading-normal">
                    {(changeTypeConfig.rows || []).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex} rowSpan={cell.rowSpan} colSpan={cell.colSpan} className={cell.className}>
                                    <LayoutText value={cell.text} onEdit={edit({ kind: 'ctCell', row: rowIndex, col: cellIndex })} render={processText} />
                                </td>
                            ))}
                            {rowIndex === 0 && notes.length > 0 && (
                                <td rowSpan={changeTypeConfig.rows.length} className="border border-black p-1.5 align-top bg-slate-50/50">
                                    <div className="space-y-1.5">
                                        {notes.map((note, noteIndex) => (
                                            <div key={noteIndex}>
                                                <span className="font-bold underline">
                                                    <LayoutText value={note.term} onEdit={edit({ kind: 'noteTerm', idx: noteIndex })} multiline={false} render={processText} />
                                                </span>
                                                <p className="mt-0.5 italic">
                                                    <LayoutText value={note.definition} onEdit={edit({ kind: 'noteDef', idx: noteIndex })} render={processText} />
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
