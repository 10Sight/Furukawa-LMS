import React from 'react';
import { LayoutText } from "@/components/common/training/LayoutEditorCells.jsx";

// Shared rendering for the configurable (presentation) parts of the Daily Production
// Report — section title bars, header rows, Quality and Down Time row labels. Used by both
// DailyProductionReport (the real sheet) and DPRLayoutEditor (its live preview), so the
// preview cannot drift from the sheet. Layout rules live in shared/dprLayout.js.
//
// Every text accepts "<br />" for a line break. Text is rendered as React text — never as
// HTML — so a stored layout can't inject markup into the sheet.

// Plain rendered text, or click-to-edit text when `onEdit` is given (layout editor).
export const DPRLayoutText = LayoutText;

// Blue section title bar. `actions` renders on the right (print-hidden).
export const DPRSectionTitle = ({ title, onEdit, className = "", actions = null }) => (
    <div className={`flex justify-between items-center bg-blue-100 border border-black pr-1 ${className}`}>
        <div className="flex-1 text-center font-bold text-sm py-1">
            <DPRLayoutText value={title} onEdit={onEdit} multiline={false} />
        </div>
        {actions}
    </div>
);

// <th> cells for a header list. onEditText(index, value) makes each one editable.
export const DPRHeaderCells = ({ headers = [], thClassName = "", onEditText }) =>
    headers.map((header, i) => (
        <th key={i} className={`border border-black ${thClassName} ${header.width || ''}`} colSpan={header.colSpan || 1}>
            <DPRLayoutText value={header.text} onEdit={onEditText ? (v) => onEditText(i, v) : null} />
        </th>
    ));

// Quality (Defect Summary) body. renderValue(sectionName, fieldIndex) renders the value
// cell for a field; onEditLabel(path, value) with path { section, field? } edits labels.
export const DPRQualityRows = ({ sections = [], renderValue, onEditLabel }) => (
    <tbody>
        {sections.map((section) => (
            <React.Fragment key={section.name}>
                <tr>
                    <th colSpan={2} className="border border-black p-1 bg-gray-100">
                        <DPRLayoutText
                            value={section.label}
                            onEdit={onEditLabel ? (v) => onEditLabel({ section: section.name }, v) : null}
                            multiline={false}
                        />
                    </th>
                </tr>
                {section.fields.map((fieldLabel, idx) => (
                    <tr key={idx}>
                        <td className="border border-black p-1">
                            <DPRLayoutText
                                value={fieldLabel}
                                onEdit={onEditLabel ? (v) => onEditLabel({ section: section.name, field: idx }, v) : null}
                                multiline={false}
                            />
                        </td>
                        {renderValue(section.name, idx)}
                    </tr>
                ))}
            </React.Fragment>
        ))}
    </tbody>
);

// Down Time rows (without the header and total row). renderValues(key) returns the value
// <td>s for a data key; onEditLabel(path, value) with path { key } or { group } edits labels,
// where `group` is the index of a grouped row.
export const DPRDownTimeRows = ({ rows = [], renderValues, onEditLabel }) => (
    <>
        {rows.map((row, rowIdx) => {
            if (!row.children) {
                return (
                    <tr key={row.key} className="h-[18px]">
                        <td className="border border-black px-1" colSpan={2}>
                            <DPRLayoutText value={row.label} onEdit={onEditLabel ? (v) => onEditLabel({ key: row.key }, v) : null} multiline={false} />
                        </td>
                        {renderValues(row.key)}
                    </tr>
                );
            }
            return row.children.map((child, childIdx) => (
                <tr key={child.key}>
                    {childIdx === 0 && (
                        <td className="border border-black px-1 w-24" rowSpan={row.children.length}>
                            <DPRLayoutText value={row.label} onEdit={onEditLabel ? (v) => onEditLabel({ group: rowIdx }, v) : null} />
                        </td>
                    )}
                    <td className="border border-black px-1">
                        <DPRLayoutText value={child.label} onEdit={onEditLabel ? (v) => onEditLabel({ key: child.key }, v) : null} multiline={false} />
                    </td>
                    {renderValues(child.key)}
                </tr>
            ));
        })}
    </>
);
