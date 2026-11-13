import React, { useEffect, useState } from "react";
import { IconAlertTriangle, IconCheck, IconFileSpreadsheet } from "@tabler/icons-react";
import { Button } from "@/components/common/ui/button.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/common/ui/dialog.jsx";
import { cn } from "@/utils/classNames.js";
import { formatDate } from "@/utils/itAccessControlColumns.js";

// Preview of an Excel import (utils/itAccessControlImport.js buildImportPlan). Apply only merges the
// changes into the page's unsaved edits; nothing is saved until the user clicks Save changes.

const show = (key, v) => (v ? (/Date$/.test(key) ? formatDate(v) : v) : "—");

const Table = ({ head, children }) => (
    <table className="w-full text-xs">
        <thead>
            <tr className="text-left text-slate-500 border-b">
                {head.map((h) => <th key={h} className="py-1.5 pr-3 font-semibold">{h}</th>)}
            </tr>
        </thead>
        <tbody className="text-slate-700">{children}</tbody>
    </table>
);

const Empty = ({ children }) => <p className="text-sm text-slate-500 py-6 text-center">{children}</p>;

const COLUMN_STATUS = {
    id: { label: "Employee Id — used to match", tone: "bg-slate-100 text-slate-700" },
    matched: { label: "matched", tone: "bg-emerald-100 text-emerald-800" },
    suggested: { label: "suggested — please check", tone: "bg-amber-100 text-amber-800" },
    manual: { label: "your choice", tone: "bg-blue-100 text-blue-800" },
    readonly: { label: "employee record — not imported", tone: "bg-slate-100 text-slate-600" },
    unknown: { label: "not imported", tone: "bg-red-100 text-red-700" },
    skipped: { label: "left out", tone: "bg-slate-100 text-slate-600" },
    duplicate: { label: "duplicate column — not imported", tone: "bg-red-100 text-red-700" },
};
const MAPPABLE = new Set(["suggested", "manual", "unknown", "skipped", "duplicate"]);

function ColumnsTab({ plan, fields, onMappingChange }) {
    const importable = fields.filter((f) => f.importable !== false);
    const labelOf = (key) => importable.find((f) => f.key === key)?.label || key;
    const taken = new Set(plan.columns.filter((c) => ["matched", "manual", "suggested"].includes(c.status)).map((c) => c.fieldKey));

    return (
        <Table head={["Excel header", "Imported into", "Status"]}>
            {plan.columns.map((c) => {
                const status = COLUMN_STATUS[c.status] || COLUMN_STATUS.unknown;
                const editable = onMappingChange && MAPPABLE.has(c.status);
                const current = ["matched", "manual", "suggested"].includes(c.status) ? c.fieldKey : "";
                return (
                    <tr key={c.col} className="border-b last:border-0 align-middle">
                        <td className="py-1.5 pr-3 font-medium">{c.header}</td>
                        <td className="py-1.5 pr-3">
                            {editable ? (
                                <select
                                    value={current || ""}
                                    onChange={(e) => onMappingChange(c.norm, e.target.value)}
                                    className="h-7 rounded border border-slate-300 bg-white px-1.5 text-xs"
                                    aria-label={`Import "${c.header}" into`}
                                >
                                    <option value="">— not imported —</option>
                                    {importable
                                        .filter((f) => f.key === current || !taken.has(f.key))
                                        .map((f) => (
                                            <option key={f.key} value={f.key}>
                                                {f.label}{f.key === c.suggestedKey ? " (suggested)" : ""}
                                            </option>
                                        ))}
                                </select>
                            ) : (
                                <span className={current ? "" : "text-slate-400"}>{current ? labelOf(current) : "—"}</span>
                            )}
                        </td>
                        <td className="py-1.5 pr-3">
                            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", status.tone)}>{status.label}</span>
                        </td>
                    </tr>
                );
            })}
        </Table>
    );
}

// `applied`: reopened from the page banner after Apply — read-only, no Apply button.
// `onMappingChange(normHeader, fieldKey | "")`: set while previewing; the page rebuilds the plan.
export default function ImportPreviewDialog({ plan, fileName, initialTab = "changes", applied = false, fields = [], onMappingChange, onApply, onClose }) {
    const [tab, setTab] = useState(initialTab);
    useEffect(() => { if (plan) setTab(initialTab); }, [plan, initialTab]);
    if (!plan) return null;

    const problemCount = plan.invalid.length + plan.duplicates.filter((d) => d.conflicting).length + plan.blankIdRows.length;
    const columnAttention = plan.columns.filter((c) => c.status === "suggested" || c.status === "unknown").length;
    const tabs = [
        { key: "columns", label: "Columns", count: plan.columns.length, warn: columnAttention > 0 || plan.missingFields.length > 0 },
        { key: "changes", label: "Changes", count: plan.changes.length },
        { key: "notOnRegister", label: "Not on register", count: plan.notOnRegister.length, warn: plan.notOnRegister.length > 0 },
        { key: "notInFile", label: "Not in file", count: plan.notInFile.length, warn: plan.notInFile.length > 0 },
        { key: "problems", label: "Problems", count: problemCount, warn: problemCount > 0 },
    ];

    return (
        <Dialog open={!!plan} onOpenChange={(open) => !open && onClose()} className="max-w-4xl">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconFileSpreadsheet size={20} className="text-emerald-600" /> Import preview — {fileName}
                    </DialogTitle>
                    <DialogDescription>
                        Matched {plan.matchedCount} employee{plan.matchedCount === 1 ? "" : "s"} by Employee Id ·{" "}
                        <b>{plan.changes.length}</b> change{plan.changes.length === 1 ? "" : "s"} in {plan.changedRowCount} row{plan.changedRowCount === 1 ? "" : "s"} ·{" "}
                        {plan.unchangedCells} already up to date. Blank cells keep the saved value. Name, Role, Department and the joining/leaving dates are never imported.
                    </DialogDescription>
                </DialogHeader>

                {plan.missingFields.length > 0 && (
                    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex gap-2">
                        <IconAlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <div>
                            <b>No column found for:</b> {plan.missingFields.join(", ")}.{" "}
                            These fields will not be updated.
                            {onMappingChange && plan.columns.some((c) => MAPPABLE.has(c.status)) && (
                                <> If the file has them under another name, choose it on the{" "}
                                    <button type="button" className="underline font-semibold" onClick={() => setTab("columns")}>Columns</button> tab.
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="mt-4 flex flex-wrap gap-1 border-b">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={cn(
                                "px-3 py-1.5 text-sm -mb-px border-b-2",
                                tab === t.key ? "border-blue-600 text-blue-700 font-semibold" : "border-transparent text-slate-600 hover:text-slate-900",
                            )}
                        >
                            {t.label}
                            <span className={cn("ml-1.5 text-[11px] px-1.5 rounded-full", t.warn ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600")}>{t.count}</span>
                        </button>
                    ))}
                </div>

                <div className="mt-3 max-h-[50vh] overflow-y-auto">
                    {tab === "columns" && <ColumnsTab plan={plan} fields={fields} onMappingChange={onMappingChange} />}

                    {tab === "changes" && (plan.changes.length ? (
                        <Table head={["Excel row", "Employee", "Field", "Current", "New"]}>
                            {plan.changes.map((c) => (
                                <tr key={`${c.userId}-${c.key}`} className="border-b last:border-0">
                                    <td className="py-1.5 pr-3">{c.rowNumber}</td>
                                    <td className="py-1.5 pr-3 whitespace-nowrap">{c.empId} · {c.fullName}</td>
                                    <td className="py-1.5 pr-3">{c.label}</td>
                                    <td className="py-1.5 pr-3 text-slate-500">{show(c.key, c.from)}</td>
                                    <td className="py-1.5 pr-3 font-semibold">{show(c.key, c.to)}</td>
                                </tr>
                            ))}
                        </Table>
                    ) : <Empty>The file has no changes compared with the saved register.</Empty>)}

                    {tab === "notOnRegister" && (plan.notOnRegister.length ? (
                        <>
                            <p className="text-xs text-slate-500 mb-2">These Employee Ids are not ST employees on the register (unknown, deleted or a different prefix). Their rows were skipped.</p>
                            <Table head={["Excel row", "Employee Id"]}>
                                {plan.notOnRegister.map((r) => (
                                    <tr key={r.empId} className="border-b last:border-0">
                                        <td className="py-1.5 pr-3">{r.rowNumber}</td>
                                        <td className="py-1.5 pr-3">{r.empId}</td>
                                    </tr>
                                ))}
                            </Table>
                        </>
                    ) : <Empty>Every Employee Id in the file is on the register.</Empty>)}

                    {tab === "notInFile" && (plan.notInFile.length ? (
                        <>
                            <p className="text-xs text-slate-500 mb-2">These register employees are not in the file. Their access is not changed by this import.</p>
                            <Table head={["Employee Id", "Name", "Department", "Status"]}>
                                {plan.notInFile.map((r) => (
                                    <tr key={r.userId} className="border-b last:border-0">
                                        <td className="py-1.5 pr-3">{r.empId}</td>
                                        <td className="py-1.5 pr-3">{r.fullName}</td>
                                        <td className="py-1.5 pr-3">{r.department || "—"}</td>
                                        <td className="py-1.5 pr-3">
                                            {r.hasLeft
                                                ? <span className="text-[10px] font-bold uppercase px-1 rounded bg-red-100 text-red-700">Left</span>
                                                : "Active"}
                                        </td>
                                    </tr>
                                ))}
                            </Table>
                        </>
                    ) : <Empty>Every register employee is in the file.</Empty>)}

                    {tab === "problems" && (
                        <div className="space-y-4">
                            {!problemCount && !plan.ignoredColumns.length && !plan.duplicates.length && <Empty>No problems found.</Empty>}
                            {plan.invalid.length > 0 && (
                                <section>
                                    <h4 className="text-xs font-semibold text-slate-700 mb-1">Invalid values (cell skipped, rest of the row imported)</h4>
                                    <Table head={["Excel row", "Employee Id", "Column", "Value", "Problem"]}>
                                        {plan.invalid.map((e, i) => (
                                            <tr key={i} className="border-b last:border-0">
                                                <td className="py-1.5 pr-3">{e.rowNumber}</td>
                                                <td className="py-1.5 pr-3">{e.empId}</td>
                                                <td className="py-1.5 pr-3">{e.column}</td>
                                                <td className="py-1.5 pr-3 font-mono">{e.value}</td>
                                                <td className="py-1.5 pr-3 text-red-700">{e.reason}</td>
                                            </tr>
                                        ))}
                                    </Table>
                                </section>
                            )}
                            {plan.duplicates.length > 0 && (
                                <section>
                                    <h4 className="text-xs font-semibold text-slate-700 mb-1">Employee Id in more than one row</h4>
                                    <ul className="text-xs text-slate-700 space-y-0.5">
                                        {plan.duplicates.map((d) => (
                                            <li key={d.empId}>
                                                {d.empId} (rows {d.rowNumbers.join(", ")}) —{" "}
                                                {d.conflicting ? <span className="text-red-700">different values, employee skipped</span> : "same values, imported once"}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                            {plan.blankIdRows.length > 0 && (
                                <section>
                                    <h4 className="text-xs font-semibold text-slate-700 mb-1">Rows without an Employee Id (skipped)</h4>
                                    <p className="text-xs text-slate-700">Excel rows {plan.blankIdRows.join(", ")}</p>
                                </section>
                            )}
                            {plan.ignoredColumns.length > 0 && (
                                <section>
                                    <h4 className="text-xs font-semibold text-slate-700 mb-1">Columns not imported</h4>
                                    <ul className="text-xs text-slate-700 space-y-0.5">
                                        {plan.ignoredColumns.map((c, i) => <li key={i}><b>{c.header}</b> — {c.reason}</li>)}
                                    </ul>
                                </section>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-4 flex items-center gap-2">
                    {(plan.notInFile.length > 0 || problemCount > 0) && (
                        <span className="mr-auto flex items-center gap-1.5 text-xs text-amber-700">
                            <IconAlertTriangle size={14} />
                            {plan.notInFile.length > 0 && `${plan.notInFile.length} register employee${plan.notInFile.length === 1 ? "" : "s"} not in file`}
                            {plan.notInFile.length > 0 && problemCount > 0 && " · "}
                            {problemCount > 0 && `${problemCount} problem${problemCount === 1 ? "" : "s"}`}
                        </span>
                    )}
                    <Button variant="outline" onClick={onClose}>{applied ? "Close" : "Cancel"}</Button>
                    {!applied && (
                        <Button onClick={onApply} disabled={!plan.changes.length}>
                            <IconCheck size={16} /> Apply {plan.changes.length} change{plan.changes.length === 1 ? "" : "s"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
