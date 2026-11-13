import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import {
    IconAlertTriangle, IconDeviceFloppy, IconDownload, IconFileSpreadsheet, IconHistory, IconLoader2, IconRefresh, IconSearch, IconUpload, IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/common/ui/button.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/common/ui/dialog.jsx";
import { cn } from "@/utils/classNames.js";
import {
    useGetItAccessRegisterQuery, useSaveItAccessRegisterMutation, useGetItAccessHistoryQuery,
} from "@/services/api/ITAccessControlApi.js";
import {
    buildColumnGroups, canEnterManualDepartment, cellValue, effectiveLocation, formatDate, manualDepartmentValue,
} from "@/utils/itAccessControlColumns.js";
import { exportItAccessControlRegister } from "@/utils/itAccessControlExcelExport.js";
import { buildImportPlan, readImportWorkbook, ImportError } from "@/utils/itAccessControlImport.js";
import ImportPreviewDialog from "@/pages/meetings/components/it-access/ImportPreviewDialog.jsx";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

// Column mappings chosen in the import preview, per normalized header text, kept in this browser
// so the next file with the same headers maps itself: { [header]: fieldKey | "" (left out) }.
const MAPPINGS_STORAGE_KEY = "itac-import-column-mappings";
const loadSavedMappings = () => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(MAPPINGS_STORAGE_KEY) || "{}");
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
};
const saveMappings = (mappings) => {
    try {
        window.localStorage.setItem(MAPPINGS_STORAGE_KEY, JSON.stringify(mappings));
    } catch {
        // storage unavailable (private window): mappings still apply to this import
    }
};

// IT Access Control Register (MIS Portal). Lists every ST employee (leavers included) with the
// access recorded for them. Columns come from the server (utils/itAccessControlFields.js).
// - Blank means "not recorded yet", never "No".
// - Edits are kept per cell until "Save changes"; a save is rejected (409) when someone else saved
//   one of the same rows after this page loaded.
// - Leavers whose Email or AD deletion is not recorded are flagged "Removal pending".

// Mirrors the admin check in MisPortalHub.jsx; the server re-checks every request.
const isAdmin = (user) => (
    user?.role === "SUPERADMIN" || user?.role === "ADMIN" || user?.isAdmin === 1 || user?.isAdmin === true
);
const hasPermission = (user, permission) => isAdmin(user) || !!user?.customRole?.permissions?.includes(permission);

// Sticky identity columns: Sr No, Employee Id, Employee Name.
const STICKY = [
    { width: 52, left: 0 },
    { width: 104, left: 52 },
    { width: 200, left: 156 },
];
const STICKY_KEYS = ["empId", "fullName"];

const STATUS_FILTERS = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "left", label: "Left" },
    { key: "pending", label: "Removal pending" },
    { key: "unrecorded", label: "Not recorded" },
];

const valueTone = (value, darkMode) => {
    if (value === "Yes") return darkMode ? "text-emerald-300" : "text-emerald-700";
    if (value === "No") return darkMode ? "text-slate-400" : "text-slate-500";
    return darkMode ? "text-slate-200" : "text-slate-800";
};

const EditableCell = ({ column, value, placeholder, dirty, canEdit, darkMode, onChange }) => {
    const base = cn(
        "w-full bg-transparent text-xs text-center rounded px-1 py-1 outline-none focus:ring-2 focus:ring-blue-500",
        valueTone(value, darkMode),
        !canEdit && "pointer-events-none",
    );
    if (column.type === "date") {
        if (!canEdit) return <span className="text-xs">{formatDate(value) || "—"}</span>;
        return (
            <input
                type="date"
                value={value || ""}
                onChange={(e) => onChange(e.target.value || null)}
                className={cn(base, "min-w-[124px]", darkMode && "[color-scheme:dark]", dirty && "font-semibold")}
            />
        );
    }
    if (!canEdit) {
        return <span className={cn("text-xs", valueTone(value, darkMode), !value && placeholder && "italic opacity-70")}>{value || placeholder || "—"}</span>;
    }
    return (
        <select
            value={value || ""}
            onChange={(e) => onChange(e.target.value || null)}
            className={cn(base, "cursor-pointer", !value && "opacity-70 italic", dirty && "font-semibold not-italic opacity-100")}
            aria-label={column.label}
        >
            <option value="">{placeholder || "—"}</option>
            {column.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
    );
};

const DEPARTMENT_DATALIST_ID = "itac-department-names";

// Department: the users-table value is read-only. Only when it is blank can an editor type one;
// that text is stored on the register (never in users) and tagged "manual".
const DepartmentCell = ({ row, rowEdits, canEdit, darkMode, onChange }) => {
    if (!canEnterManualDepartment(row)) {
        return <span className="text-xs" title={row.department}>{row.department}</span>;
    }
    const value = manualDepartmentValue(row, rowEdits) ?? "";
    const tag = (
        <span className={cn("shrink-0 text-[9px] font-bold uppercase px-1 rounded", darkMode ? "bg-sky-900/60 text-sky-200" : "bg-sky-100 text-sky-700")}>manual</span>
    );
    if (!canEdit) {
        return value
            ? <span className="flex items-center gap-1 text-xs">{value}{tag}</span>
            : <span className="text-xs text-slate-400">—</span>;
    }
    return (
        <div className="flex items-center gap-1">
            <input
                type="text"
                value={value}
                maxLength={100}
                list={DEPARTMENT_DATALIST_ID}
                placeholder="Add department…"
                onChange={(e) => onChange(e.target.value)}
                onBlur={(e) => {
                    const tidy = e.target.value.replace(/\s+/g, " ").trim();
                    if (tidy !== e.target.value) onChange(tidy);
                }}
                className={cn(
                    "w-full min-w-[120px] bg-transparent text-xs rounded px-1 py-1 outline-none border border-dashed focus:ring-2 focus:ring-blue-500",
                    darkMode ? "border-slate-600 placeholder:text-slate-500" : "border-slate-300 placeholder:text-slate-400",
                )}
                aria-label={`Department for ${row.empId}`}
            />
            {value && tag}
        </div>
    );
};

const RegisterRow = memo(function RegisterRow({ row, index, columns, rowEdits, canEdit, darkMode, onCellChange, onShowHistory }) {
    const isDirty = !!rowEdits && Object.keys(rowEdits).length > 0;
    const rowBg = row.pendingRemoval
        ? (darkMode ? "bg-red-950/40" : "bg-red-50")
        : (darkMode ? "bg-slate-900" : "bg-white");
    const cellBorder = darkMode ? "border-slate-700" : "border-slate-300";
    const stickyBg = row.pendingRemoval ? (darkMode ? "bg-[#2a1416]" : "bg-red-50") : (darkMode ? "bg-slate-900" : "bg-white");

    return (
        <tr className={cn(rowBg, "group")}>
            <td
                className={cn("sticky z-10 border px-1 py-1 text-center text-xs", cellBorder, stickyBg, isDirty && "shadow-[inset_3px_0_0_0_#f59e0b]")}
                style={{ left: STICKY[0].left, minWidth: STICKY[0].width, maxWidth: STICKY[0].width }}
            >
                {index + 1}
            </td>
            {columns.map((column) => {
                const stickyIndex = STICKY_KEYS.indexOf(column.key);
                const sticky = stickyIndex >= 0 ? STICKY[stickyIndex + 1] : null;
                const value = cellValue(row, column, rowEdits);
                const dirty = !!rowEdits && Object.prototype.hasOwnProperty.call(rowEdits, column.manualKey || column.key);

                let content;
                if (column.key === "fullName") {
                    content = (
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate text-xs font-medium" title={value}>{value}</span>
                            {row.hasLeft && (
                                <span className={cn("shrink-0 text-[9px] font-bold uppercase px-1 rounded", darkMode ? "bg-red-900/60 text-red-200" : "bg-red-100 text-red-700")}>Left</span>
                            )}
                            <button
                                type="button"
                                onClick={() => onShowHistory(row)}
                                className={cn("ml-auto shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 rounded p-0.5", darkMode ? "hover:bg-slate-700" : "hover:bg-slate-100")}
                                title="Change history"
                                aria-label={`Change history for ${row.empId}`}
                            >
                                <IconHistory size={14} />
                            </button>
                        </div>
                    );
                } else if (column.manualKey) {
                    content = (
                        <DepartmentCell
                            row={row}
                            rowEdits={rowEdits}
                            canEdit={canEdit}
                            darkMode={darkMode}
                            onChange={(next) => onCellChange(row, column.manualKey, next === "" ? null : next)}
                        />
                    );
                } else if (column.readOnly) {
                    content = <span className="text-xs whitespace-nowrap">{column.type === "date" ? (formatDate(value) || "—") : (value || "—")}</span>;
                } else {
                    content = (
                        <EditableCell
                            column={column}
                            value={value}
                            placeholder={column.key === "location" && row.defaultLocation ? `${row.defaultLocation} (plant)` : null}
                            dirty={dirty}
                            canEdit={canEdit}
                            darkMode={darkMode}
                            onChange={(next) => onCellChange(row, column.key, next)}
                        />
                    );
                }

                return (
                    <td
                        key={column.key}
                        className={cn(
                            "border px-1.5 py-0.5",
                            cellBorder,
                            column.readOnly ? "text-left" : "text-center",
                            sticky && cn("sticky z-10", stickyBg),
                            dirty && (darkMode ? "bg-amber-900/40" : "bg-amber-100"),
                        )}
                        style={sticky ? { left: sticky.left, minWidth: sticky.width, maxWidth: sticky.width } : undefined}
                    >
                        {content}
                    </td>
                );
            })}
        </tr>
    );
});

function HistoryDialog({ row, fieldLabels, onClose }) {
    const { data, isFetching, isError } = useGetItAccessHistoryQuery(row?.userId, { skip: !row });
    const history = data?.data?.history || [];
    const show = (key, v) => (v ? (/Date$/.test(key) ? formatDate(v) : v) : "—");

    return (
        <Dialog open={!!row} onOpenChange={(open) => !open && onClose()} className="max-w-2xl">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Change history — {row?.empId} {row?.fullName}</DialogTitle>
                    <DialogDescription>Every saved change to this employee&apos;s access, newest first.</DialogDescription>
                </DialogHeader>
                <div className="mt-4 max-h-[60vh] overflow-y-auto">
                    {isFetching && <div className="flex justify-center py-8"><IconLoader2 className="animate-spin" /></div>}
                    {isError && <p className="text-sm text-red-600">Could not load the history.</p>}
                    {!isFetching && !isError && !history.length && <p className="text-sm text-slate-500 py-6 text-center">No changes have been saved yet.</p>}
                    {!isFetching && history.length > 0 && (
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-left text-slate-500 border-b">
                                    <th className="py-1.5 pr-2">When</th>
                                    <th className="py-1.5 pr-2">Field</th>
                                    <th className="py-1.5 pr-2">Change</th>
                                    <th className="py-1.5">By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h) => (
                                    <tr key={h.id} className="border-b last:border-0 text-slate-700">
                                        <td className="py-1.5 pr-2 whitespace-nowrap">{new Date(h.changedAt).toLocaleString("en-IN")}</td>
                                        <td className="py-1.5 pr-2">{fieldLabels[h.field] || h.field}</td>
                                        <td className="py-1.5 pr-2">{show(h.field, h.oldValue)} → <span className="font-semibold">{show(h.field, h.newValue)}</span></td>
                                        <td className="py-1.5">
                                            {h.changedByName || "—"}
                                            {h.source?.startsWith("import:") && (
                                                <span className="block text-[10px] text-slate-500" title={h.source.slice(7)}>via import ({h.source.slice(7)})</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function ITAccessControlSheet() {
    const { user } = useSelector((state) => state.auth);
    const { darkMode } = useSelector((state) => state.theme);
    const canRead = hasPermission(user, "it_access_control:read");
    const canEdit = hasPermission(user, "it_access_control:update");

    const { data, isLoading, isFetching, isError, refetch } = useGetItAccessRegisterQuery(undefined, { skip: !canRead });
    const [saveRegister, { isLoading: isSaving }] = useSaveItAccessRegisterMutation();

    const register = data?.data;
    const rows = useMemo(() => register?.rows || [], [register]);
    const groups = useMemo(() => buildColumnGroups(register?.fields, register?.groups), [register]);
    const columns = useMemo(() => groups.flatMap((g) => g.columns), [groups]);
    const fieldLabels = useMemo(() => Object.fromEntries((register?.fields || []).map((f) => [f.key, f.label])), [register]);

    // { [userId]: { [fieldKey]: value } } — only cells that differ from the saved value.
    const [edits, setEdits] = useState({});
    const [conflict, setConflict] = useState(null);
    const [historyRow, setHistoryRow] = useState(null);
    const [search, setSearch] = useState("");
    const [department, setDepartment] = useState("");
    const [location, setLocation] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [exporting, setExporting] = useState(false);

    // Excel import: `preview` is the open preview dialog; `importInfo` describes the applied import
    // until it is saved or discarded (banner, "changed rows only" filter, history source).
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [preview, setPreview] = useState(null); // { plan, fileName, tab, applied }
    const [importInfo, setImportInfo] = useState(null); // { plan, fileName }
    const [changedOnly, setChangedOnly] = useState(false);

    const dirtyRowCount = Object.keys(edits).length;

    const clearImport = () => {
        setImportInfo(null);
        setChangedOnly(false);
    };

    useEffect(() => {
        if (!dirtyRowCount) return undefined;
        const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirtyRowCount]);

    const onCellChange = useCallback((row, key, value) => {
        setEdits((prev) => {
            const saved = row.values?.[key] ?? null;
            const rowEdits = { ...(prev[row.userId] || {}) };
            if ((value ?? null) === saved) delete rowEdits[key];
            else rowEdits[key] = value ?? null;
            const next = { ...prev };
            if (Object.keys(rowEdits).length) next[row.userId] = rowEdits;
            else delete next[row.userId];
            return next;
        });
    }, []);

    // Each department separately: an employee in two departments is listed under both.
    const departments = useMemo(() => [...new Set(rows.flatMap((r) => r.departmentList || []))].sort(), [rows]);
    // Suggestions for typing a manual department: names from the users table only.
    const userDepartments = useMemo(
        () => [...new Set(rows.filter((r) => r.departmentSource === "users").flatMap((r) => r.departmentList || []))].sort(),
        [rows],
    );
    const locationOptions = useMemo(() => (register?.fields || []).find((f) => f.key === "location")?.options || [], [register]);

    const counts = useMemo(() => ({
        total: rows.length,
        active: rows.filter((r) => !r.hasLeft).length,
        left: rows.filter((r) => r.hasLeft).length,
        pending: rows.filter((r) => r.pendingRemoval).length,
        unrecorded: rows.filter((r) => !r.version).length,
    }), [rows]);

    const visibleRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (q && !r.empId.toLowerCase().includes(q) && !r.fullName.toLowerCase().includes(q)) return false;
            if (department && !(r.departmentList || []).includes(department)) return false;
            if (location && effectiveLocation(r, edits[r.userId]) !== location) return false;
            if (statusFilter === "active" && r.hasLeft) return false;
            if (statusFilter === "left" && !r.hasLeft) return false;
            if (statusFilter === "pending" && !r.pendingRemoval) return false;
            if (statusFilter === "unrecorded" && r.version) return false;
            if (changedOnly && !edits[r.userId]) return false;
            return true;
        });
    }, [rows, search, department, location, statusFilter, edits, changedOnly]);

    const handleSave = async () => {
        const byId = new Map(rows.map((r) => [r.userId, r]));
        const payload = Object.entries(edits).map(([userId, values]) => ({
            userId: Number(userId),
            version: byId.get(Number(userId))?.version ?? 0,
            values,
        }));
        try {
            // Tags the whole save (including any cells edited by hand after the import).
            const source = importInfo ? `import:${importInfo.fileName}` : null;
            const res = await saveRegister({ rows: payload, source }).unwrap();
            setEdits({});
            setConflict(null);
            clearImport();
            const { saved = 0, changes = 0 } = res?.data || {};
            toast.success(saved ? `Saved ${changes} change${changes === 1 ? "" : "s"} for ${saved} employee${saved === 1 ? "" : "s"}` : "Nothing to save");
        } catch (error) {
            const status = error?.status ?? error?.statuscode ?? error?.data?.statuscode;
            const message = error?.data?.message || error?.message || "Could not save the changes";
            if (status === 409) setConflict(message);
            toast.error(message);
        }
    };

    const discardAndReload = () => {
        setEdits({});
        setConflict(null);
        clearImport();
        refetch();
    };

    const discardEdits = () => {
        setEdits({});
        clearImport();
    };

    const handleImportFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = ""; // choosing the same file again still fires onChange
        if (!file || !register) return;
        if (!/\.xlsx$/i.test(file.name)) {
            toast.error("Choose an Excel .xlsx file (use Export to Excel for the template).");
            return;
        }
        if (file.size > MAX_IMPORT_BYTES) {
            toast.error("The file is larger than 5 MB.");
            return;
        }
        setImporting(true);
        try {
            const mod = await import("exceljs");
            const ExcelJS = mod.Workbook ? mod : (mod.default || mod);
            const { matrix } = await readImportWorkbook(ExcelJS, await file.arrayBuffer());
            const mappings = loadSavedMappings();
            const plan = buildImportPlan({ matrix, fields: register.fields, rows, mappings });
            const needsColumns = plan.missingFields.length > 0 && plan.columns.some((c) => ["unknown", "suggested"].includes(c.status));
            setPreview({ plan, matrix, mappings, fileName: file.name, tab: needsColumns ? "columns" : "changes", applied: false });
            if (plan.notInFile.length) {
                const n = plan.notInFile.length;
                toast.warning(`${n} employee${n === 1 ? " is" : "s are"} on the register but not in this file`, {
                    description: "Their access will not be changed.",
                    action: { label: "View", onClick: () => setPreview((p) => (p ? { ...p, tab: "notInFile" } : p)) },
                });
            }
        } catch (error) {
            if (!(error instanceof ImportError)) console.error(error);
            toast.error(error instanceof ImportError ? error.message : "Could not read the Excel file.");
        } finally {
            setImporting(false);
        }
    };

    // A header mapped (or left out) in the preview: remembered for next time, plan rebuilt now.
    const changeColumnMapping = (norm, fieldKey) => {
        if (!preview?.matrix) return;
        const mappings = { ...preview.mappings, [norm]: fieldKey };
        saveMappings({ ...loadSavedMappings(), [norm]: fieldKey });
        try {
            const plan = buildImportPlan({ matrix: preview.matrix, fields: register.fields, rows, mappings });
            setPreview((p) => (p ? { ...p, plan, mappings, tab: "columns" } : p));
        } catch (error) {
            toast.error(error instanceof ImportError ? error.message : "Could not apply that column choice.");
        }
    };

    const applyImport = () => {
        if (!preview) return;
        const { plan, fileName } = preview;
        setEdits(plan.edits); // import is only allowed with no unsaved edits, so nothing is overwritten
        setImportInfo({ plan, fileName });
        setChangedOnly(true);
        setPreview(null);
        toast.success(`${plan.changes.length} change${plan.changes.length === 1 ? "" : "s"} applied. Review the highlighted cells, then Save changes.`);
    };

    const handleExport = async () => {
        if (!register) return;
        setExporting(true);
        try {
            await exportItAccessControlRegister(register, visibleRows);
            if (dirtyRowCount) toast.info("The export has saved values only. Unsaved edits are not in the file.");
        } catch (error) {
            console.error(error);
            toast.error("Could not create the Excel file");
        } finally {
            setExporting(false);
        }
    };

    const panel = darkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900";
    const input = cn("h-9 rounded-md border px-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500", darkMode ? "bg-slate-800 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-800");
    const headBorder = darkMode ? "border-slate-600" : "border-slate-400";
    const groupHead = darkMode ? "bg-slate-800 text-slate-100" : "bg-[#D9E1F2] text-slate-900";
    const colHead = darkMode ? "bg-slate-800/90 text-slate-200" : "bg-slate-100 text-slate-800";

    if (!canRead) {
        return (
            <div className="max-w-xl mx-auto py-16 px-4 text-center text-sm text-slate-500">
                You do not have access to the IT Access Control Register. Contact an administrator if you believe this is a mistake.
            </div>
        );
    }

    return (
        <div className="py-4 px-2 sm:px-4 space-y-3">
            <div className="rounded-lg bg-[#1F3864] text-white px-4 py-3 flex flex-wrap items-center gap-3">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">IT Access Control Register</h1>
                <span className="text-xs text-blue-100">ST staff · {register?.empIdPrefix || "ST"}* employee IDs</span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    {canEdit && dirtyRowCount > 0 && (
                        <>
                            <span className="text-xs text-amber-200">{dirtyRowCount} row{dirtyRowCount === 1 ? "" : "s"} changed</span>
                            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={discardEdits} disabled={isSaving}>
                                <IconX size={16} /> Discard
                            </Button>
                            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-900" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <IconLoader2 size={16} className="animate-spin" /> : <IconDeviceFloppy size={16} />} Save changes
                            </Button>
                        </>
                    )}
                    <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => refetch()} disabled={isFetching || dirtyRowCount > 0} title={dirtyRowCount ? "Save or discard your changes first" : "Reload"}>
                        <IconRefresh size={16} className={isFetching ? "animate-spin" : ""} />
                    </Button>
                    {canEdit && (
                        <>
                            <input ref={fileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleImportFile} />
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!register || importing || dirtyRowCount > 0}
                                title={dirtyRowCount ? "Save or discard your changes first" : "Update access from an Excel file, matched by Employee Id"}
                            >
                                {importing ? <IconLoader2 size={16} className="animate-spin" /> : <IconUpload size={16} />} Import Excel
                            </Button>
                        </>
                    )}
                    <Button size="sm" variant="secondary" onClick={handleExport} disabled={!register || exporting}>
                        {exporting ? <IconLoader2 size={16} className="animate-spin" /> : <IconDownload size={16} />} Export to Excel
                    </Button>
                </div>
            </div>

            {conflict && (
                <div className={cn("rounded-lg border px-4 py-3 flex flex-wrap items-center gap-3 text-sm", darkMode ? "border-red-800 bg-red-950/50 text-red-200" : "border-red-200 bg-red-50 text-red-800")}>
                    <IconAlertTriangle size={18} className="shrink-0" />
                    <span className="flex-1 min-w-[200px]">{conflict}</span>
                    <Button size="sm" variant="destructive" onClick={discardAndReload}>Reload and discard my changes</Button>
                </div>
            )}

            {importInfo && dirtyRowCount > 0 && (
                <div className={cn("rounded-lg border px-4 py-2.5 flex flex-wrap items-center gap-3 text-sm", darkMode ? "border-emerald-800 bg-emerald-950/40 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-900")}>
                    <IconFileSpreadsheet size={18} className="shrink-0" />
                    <span className="flex-1 min-w-[220px]">
                        Imported from <b>{importInfo.fileName}</b>: {importInfo.plan.changes.length} change{importInfo.plan.changes.length === 1 ? "" : "s"} in {importInfo.plan.changedRowCount} row{importInfo.plan.changedRowCount === 1 ? "" : "s"}. Not saved yet — review, then Save changes.
                        {importInfo.plan.notInFile.length > 0 && (
                            <button
                                type="button"
                                className={cn("ml-2 inline-flex items-center gap-1 text-xs font-semibold underline", darkMode ? "text-amber-300" : "text-amber-700")}
                                onClick={() => setPreview({ plan: importInfo.plan, fileName: importInfo.fileName, tab: "notInFile", applied: true })}
                            >
                                <IconAlertTriangle size={13} /> {importInfo.plan.notInFile.length} register employee{importInfo.plan.notInFile.length === 1 ? "" : "s"} not in file
                            </button>
                        )}
                    </span>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                        <input type="checkbox" checked={changedOnly} onChange={(e) => setChangedOnly(e.target.checked)} />
                        Show changed rows only
                    </label>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {[
                    { key: "all", label: "Total ST staff", value: counts.total },
                    { key: "active", label: "Active", value: counts.active },
                    { key: "left", label: "Left", value: counts.left },
                    { key: "pending", label: "Left — Email/AD removal pending", value: counts.pending, alert: counts.pending > 0 },
                    { key: "unrecorded", label: "Not recorded yet", value: counts.unrecorded },
                ].map((c) => (
                    <button
                        key={c.key}
                        type="button"
                        onClick={() => setStatusFilter(c.key)}
                        className={cn(
                            "rounded-lg border px-3 py-2 text-left transition",
                            panel,
                            statusFilter === c.key && "ring-2 ring-blue-500",
                            c.alert && (darkMode ? "border-red-800" : "border-red-300"),
                        )}
                    >
                        <div className={cn("text-xl font-bold", c.alert && "text-red-600")}>{c.value}</div>
                        <div className={cn("text-[11px] leading-tight", darkMode ? "text-slate-400" : "text-slate-500")}>{c.label}</div>
                    </button>
                ))}
            </div>

            <div className={cn("rounded-lg border p-2 flex flex-wrap items-center gap-2", panel)}>
                <div className="relative flex-1 min-w-[200px]">
                    <IconSearch size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search Employee Id or Name"
                        className={cn(input, "w-full pl-8")}
                    />
                </div>
                <select value={department} onChange={(e) => setDepartment(e.target.value)} className={input} aria-label="Department">
                    <option value="">All departments</option>
                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={location} onChange={(e) => setLocation(e.target.value)} className={input} aria-label="Location">
                    <option value="">All locations</option>
                    {locationOptions.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={input} aria-label="Status">
                    {STATUS_FILTERS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <span className={cn("text-xs ml-auto", darkMode ? "text-slate-400" : "text-slate-500")}>
                    Showing {visibleRows.length} of {rows.length}
                </span>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16"><IconLoader2 className="animate-spin text-slate-400" size={28} /></div>
            ) : isError ? (
                <div className="text-center py-12 text-sm text-red-600">
                    Could not load the register. <button type="button" className="underline" onClick={() => refetch()}>Try again</button>
                </div>
            ) : (
                <div className={cn("rounded-lg border overflow-auto max-h-[calc(100vh-300px)]", darkMode ? "border-slate-700" : "border-slate-300")}>
                    <table className={cn("border-separate border-spacing-0 text-xs", darkMode ? "text-slate-200" : "text-slate-800")}>
                        <thead className="sticky top-0 z-20">
                            <tr>
                                <th
                                    rowSpan={2}
                                    className={cn("sticky left-0 z-30 border px-1 py-2 font-semibold", headBorder, groupHead)}
                                    style={{ minWidth: STICKY[0].width, maxWidth: STICKY[0].width }}
                                >
                                    Sr No
                                </th>
                                {groups.map((g) => (
                                    <th
                                        key={g.key}
                                        colSpan={g.columns.length}
                                        className={cn("border px-2 py-1.5 font-bold text-center", headBorder, groupHead)}
                                    >
                                        {g.label}
                                    </th>
                                ))}
                            </tr>
                            <tr>
                                {columns.map((column) => {
                                    const stickyIndex = STICKY_KEYS.indexOf(column.key);
                                    const sticky = stickyIndex >= 0 ? STICKY[stickyIndex + 1] : null;
                                    return (
                                        <th
                                            key={column.key}
                                            className={cn(
                                                "border px-1.5 py-1.5 font-semibold align-bottom leading-tight",
                                                headBorder,
                                                colHead,
                                                column.accent === "red" && "text-red-600",
                                                sticky && "sticky z-30",
                                                !sticky && "min-w-[84px]",
                                            )}
                                            style={sticky ? { left: sticky.left, minWidth: sticky.width, maxWidth: sticky.width } : undefined}
                                        >
                                            {column.label}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {visibleRows.map((row, index) => (
                                <RegisterRow
                                    key={row.userId}
                                    row={row}
                                    index={index}
                                    columns={columns}
                                    rowEdits={edits[row.userId]}
                                    canEdit={canEdit}
                                    darkMode={darkMode}
                                    onCellChange={onCellChange}
                                    onShowHistory={setHistoryRow}
                                />
                            ))}
                            {!visibleRows.length && (
                                <tr>
                                    <td colSpan={columns.length + 1} className="text-center py-10 text-slate-500">
                                        {rows.length ? "No employees match these filters." : `No employees with an Employee Id starting with "${register?.empIdPrefix || "ST"}".`}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <datalist id={DEPARTMENT_DATALIST_ID}>
                {userDepartments.map((d) => <option key={d} value={d} />)}
            </datalist>
            <HistoryDialog row={historyRow} fieldLabels={fieldLabels} onClose={() => setHistoryRow(null)} />
            <ImportPreviewDialog
                plan={preview?.plan || null}
                fileName={preview?.fileName}
                initialTab={preview?.tab}
                applied={!!preview?.applied}
                fields={register?.fields || []}
                onMappingChange={preview?.applied ? undefined : changeColumnMapping}
                onApply={applyImport}
                onClose={() => setPreview(null)}
            />
        </div>
    );
}
