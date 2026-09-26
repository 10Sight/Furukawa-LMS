// Modal dialogs for the spreadsheet: F1 cheat sheet, Go To (Ctrl+G), Paste
// Special (Ctrl+Alt+V), Format Cells (Ctrl+1), Insert/Delete (Ctrl++ / Ctrl+-)
// and Unhide Sheet. Each is presentational — it collects a choice and hands
// it back through a callback; ExcelClone owns the sheet mutations.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IconCopy, IconSearch, IconArrowRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { FUNCTION_CATALOG, FUNCTION_CATEGORIES, SHORTCUT_CATALOG, FORMULA_BASICS } from "./formulaCatalog";
import { applyNumberFormat } from "./formulaEngine";

// Shared chrome: Escape closes, Enter confirms (outside multi-line fields),
// and keystrokes never bubble up to the grid's shortcut handler behind it —
// React events travel through portals, so without this typing "a" in a
// dialog input would also reach the sheet.
const DialogShell = ({ open, onOpenChange, title, description, className, onSubmit, children }) => {
    if (!open) return null;
    return (
        <Dialog open={open} onOpenChange={onOpenChange} className={className}>
            <DialogContent
                data-excel-dialog=""
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Escape") { e.preventDefault(); onOpenChange(false); }
                    else if (e.key === "Enter" && onSubmit && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "BUTTON") {
                        e.preventDefault();
                        onSubmit();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
};

const DialogButtons = ({ onCancel, onConfirm, confirmLabel = "OK", confirmDisabled }) => (
    <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" size="sm" className="cursor-pointer" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white" onClick={onConfirm} disabled={confirmDisabled}>{confirmLabel}</Button>
    </div>
);

const RadioList = ({ name, value, onChange, options, columns = 1 }) => (
    <div className={cn("grid gap-1", columns === 2 && "grid-cols-2")}>
        {options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer px-1 py-0.5 rounded hover:bg-slate-50">
                <input type="radio" name={name} className="accent-indigo-600" checked={value === opt.value} onChange={() => onChange(opt.value)} />
                {opt.label}
            </label>
        ))}
    </div>
);

const Kbd = ({ children }) => (
    <kbd className="inline-block px-1.5 py-0.5 text-[11px] font-mono font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded shadow-[0_1px_0_#cbd5e1] whitespace-nowrap">{children}</kbd>
);

// "Ctrl+Shift+S / Ctrl+O" -> <Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>… per alternative.
const KeyCombo = ({ keys }) => (
    <span className="flex flex-wrap items-center gap-1">
        {keys.split(" / ").map((alt, i) => (
            <React.Fragment key={i}>
                {i > 0 && <span className="text-[11px] text-slate-400">or</span>}
                <span className="flex items-center gap-0.5">
                    {alt.split(/(?<=[^+])\+(?=.)/).map((part, j) => (
                        <React.Fragment key={j}>
                            {j > 0 && <span className="text-[10px] text-slate-400">+</span>}
                            <Kbd>{part.trim()}</Kbd>
                        </React.Fragment>
                    ))}
                </span>
            </React.Fragment>
        ))}
    </span>
);

const copyText = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    } catch {
        toast.error("Couldn't access the clipboard.");
    }
};

// ---------------------------------------------------------------------------
// F1 — cheat sheet

export const CheatSheetDialog = ({ open, onOpenChange, onInsertFormula, canInsert }) => {
    const [tab, setTab] = useState("functions");
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("All");
    const searchRef = useRef(null);

    useEffect(() => {
        if (open) requestAnimationFrame(() => searchRef.current?.focus());
    }, [open]);

    const q = query.trim().toLowerCase();
    const functions = useMemo(() => FUNCTION_CATALOG.filter((f) =>
        (category === "All" || f.category === category)
        && (!q || f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.syntax.toLowerCase().includes(q))
    ), [q, category]);
    const shortcutGroups = useMemo(() => {
        const groups = new Map();
        for (const s of SHORTCUT_CATALOG) {
            if (q && !s.keys.toLowerCase().includes(q) && !s.action.toLowerCase().includes(q)) continue;
            if (!groups.has(s.category)) groups.set(s.category, []);
            groups.get(s.category).push(s);
        }
        return [...groups];
    }, [q]);

    return (
        <DialogShell open={open} onOpenChange={onOpenChange} title="Excel Cheat Sheet" description="Shortcuts, formula syntax and every supported function." className="max-w-4xl">
            <div className="relative mb-3">
                <IconSearch className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                    ref={searchRef}
                    className="w-full h-9 text-sm border border-slate-200 rounded-md pl-8 pr-2 outline-none focus:border-indigo-400"
                    placeholder="Search functions and shortcuts… (e.g. lookup, date, Ctrl+D)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>
            <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="bg-slate-100">
                    <TabsTrigger value="functions" className="cursor-pointer">Functions ({FUNCTION_CATALOG.length})</TabsTrigger>
                    <TabsTrigger value="shortcuts" className="cursor-pointer">Shortcuts</TabsTrigger>
                    <TabsTrigger value="basics" className="cursor-pointer">Formula Basics</TabsTrigger>
                </TabsList>

                <TabsContent value="functions" className="mt-2">
                    <div className="flex flex-wrap gap-1 mb-2">
                        {["All", ...FUNCTION_CATEGORIES].map((c) => (
                            <button
                                key={c}
                                onClick={() => setCategory(c)}
                                className={cn(
                                    "text-[11px] px-2 py-0.5 rounded-full border cursor-pointer",
                                    category === c ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                    <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-md">
                        {functions.length === 0 && <div className="text-sm text-slate-400 text-center py-8">No functions match "{query}".</div>}
                        {functions.map((f) => (
                            <div key={f.name} className="px-3 py-2 hover:bg-slate-50/70">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-baseline gap-2 flex-wrap">
                                            <span className="font-mono font-semibold text-sm text-indigo-700">{f.name}</span>
                                            <span className="text-[10px] uppercase tracking-wide text-slate-400">{f.category}</span>
                                        </div>
                                        <div className="font-mono text-[11px] text-slate-500 break-words">{f.syntax}</div>
                                        <div className="text-xs text-slate-700 mt-0.5">{f.description}</div>
                                        <code className="inline-block mt-1 text-[11px] font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded break-all">{f.example}</code>
                                    </div>
                                    <div className="flex flex-col gap-1 shrink-0">
                                        <Button variant="outline" size="sm" className="h-7 text-[11px] cursor-pointer" onClick={() => copyText(f.example)} title="Copy the example formula">
                                            <IconCopy className="w-3.5 h-3.5" /> Copy
                                        </Button>
                                        {canInsert && (
                                            <Button size="sm" className="h-7 text-[11px] cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => onInsertFormula(f.example)} title="Put this formula into the active cell for editing">
                                                <IconArrowRight className="w-3.5 h-3.5" /> Insert
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="shortcuts" className="mt-2">
                    <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
                        {shortcutGroups.length === 0 && <div className="text-sm text-slate-400 text-center py-8">No shortcuts match "{query}".</div>}
                        {shortcutGroups.map(([group, items]) => (
                            <div key={group}>
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{group}</div>
                                <div className="divide-y divide-slate-100 border border-slate-100 rounded-md">
                                    {items.map((s) => (
                                        <div key={s.keys + s.action} className="flex items-center justify-between gap-4 px-3 py-1.5">
                                            <span className="text-xs text-slate-700">{s.action}</span>
                                            <KeyCombo keys={s.keys} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="basics" className="mt-2">
                    <div className="max-h-[60vh] overflow-y-auto grid sm:grid-cols-2 gap-3">
                        {FORMULA_BASICS.map((section) => (
                            <div key={section.title} className="border border-slate-100 rounded-md p-3">
                                <div className="text-xs font-semibold text-slate-800 mb-1.5">{section.title}</div>
                                <ul className="space-y-1">
                                    {section.items.map((item) => <li key={item} className="text-xs text-slate-600 font-mono">{item}</li>)}
                                </ul>
                            </div>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </DialogShell>
    );
};

// ---------------------------------------------------------------------------
// Ctrl+G / F5 — Go To

export const GoToDialog = ({ open, onOpenChange, onGo, defaultValue }) => {
    const [value, setValue] = useState("");
    const [error, setError] = useState("");
    const inputRef = useRef(null);
    useEffect(() => {
        if (!open) return;
        setValue(defaultValue || "");
        setError("");
        requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
    }, [open, defaultValue]);

    const submit = () => {
        const problem = onGo(value);
        if (problem) setError(problem);
        else onOpenChange(false);
    };

    return (
        <DialogShell open={open} onOpenChange={onOpenChange} title="Go To" description="A cell (Z100) or a range (B2:F10)." onSubmit={submit}>
            <input
                ref={inputRef}
                className="w-full h-9 text-sm font-mono border border-slate-200 rounded-md px-2 outline-none focus:border-indigo-400 uppercase"
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(""); }}
                placeholder="A1"
            />
            {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
            <DialogButtons onCancel={() => onOpenChange(false)} onConfirm={submit} confirmDisabled={!value.trim()} />
        </DialogShell>
    );
};

// ---------------------------------------------------------------------------
// Ctrl+Alt+V — Paste Special

const PASTE_OPTIONS = [
    { value: "all", label: "All" },
    { value: "formulas", label: "Formulas" },
    { value: "values", label: "Values" },
    { value: "formats", label: "Formats" },
];
const OPERATION_OPTIONS = [
    { value: "none", label: "None" },
    { value: "add", label: "Add" },
    { value: "subtract", label: "Subtract" },
    { value: "multiply", label: "Multiply" },
    { value: "divide", label: "Divide" },
];

export const PasteSpecialDialog = ({ open, onOpenChange, onApply }) => {
    const [paste, setPaste] = useState("all");
    const [operation, setOperation] = useState("none");
    const [skipBlanks, setSkipBlanks] = useState(false);
    const [transpose, setTranspose] = useState(false);
    useEffect(() => {
        if (open) { setPaste("all"); setOperation("none"); setSkipBlanks(false); setTranspose(false); }
    }, [open]);

    const submit = () => { onApply({ paste, operation, skipBlanks, transpose }); onOpenChange(false); };
    return (
        <DialogShell open={open} onOpenChange={onOpenChange} title="Paste Special" onSubmit={submit} className="max-w-lg">
            <div className="grid grid-cols-2 gap-4">
                <fieldset>
                    <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Paste</legend>
                    <RadioList name="paste" value={paste} onChange={setPaste} options={PASTE_OPTIONS} />
                </fieldset>
                <fieldset>
                    <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Operation</legend>
                    <RadioList name="operation" value={operation} onChange={setOperation} options={OPERATION_OPTIONS} />
                </fieldset>
            </div>
            <div className="flex gap-6 pt-3 mt-3 border-t border-slate-100">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><Checkbox checked={skipBlanks} onCheckedChange={(v) => setSkipBlanks(!!v)} /> Skip blanks</label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><Checkbox checked={transpose} onCheckedChange={(v) => setTranspose(!!v)} /> Transpose</label>
            </div>
            <DialogButtons onCancel={() => onOpenChange(false)} onConfirm={submit} />
        </DialogShell>
    );
};

// ---------------------------------------------------------------------------
// Ctrl+1 — Format Cells

const DECIMAL_FORMATS = new Set(["number", "comma", "currency", "accounting", "percentage", "scientific"]);
const BORDER_SIDES = ["top", "bottom", "left", "right"];

export const FormatCellsDialog = ({ open, onOpenChange, cell, sampleValue, numberFormats, fontFamilies, fontSizes, borderWeights, onApply }) => {
    const [tab, setTab] = useState("number");
    const [draft, setDraft] = useState({});
    const touched = useRef(new Set());

    useEffect(() => {
        if (!open) return;
        touched.current = new Set();
        setDraft({
            numberFormat: cell?.numberFormat || "general",
            decimalPlaces: cell?.decimalPlaces ?? 2,
            align: cell?.align || "",
            valign: cell?.valign || "middle",
            wrap: !!cell?.wrap,
            fontFamily: cell?.fontFamily || "",
            fontSize: cell?.fontSize || "",
            bold: !!cell?.bold,
            italic: !!cell?.italic,
            underline: !!cell?.underline,
            strike: !!cell?.strike,
            color: cell?.color || "#0f172a",
            bg: cell?.bg || "",
            border: { ...(cell?.border || {}) },
            borderWeight: Object.values(cell?.border || {})[0] || "thin",
        });
    }, [open, cell]);

    const set = (field, value) => {
        touched.current.add(field);
        setDraft((d) => ({ ...d, [field]: value }));
    };

    const submit = () => {
        const patch = {};
        for (const field of touched.current) {
            const v = draft[field];
            switch (field) {
                case "numberFormat": patch.numberFormat = v === "general" ? undefined : v; break;
                case "decimalPlaces": patch.decimalPlaces = Math.max(0, Math.min(10, Number(v) || 0)); break;
                case "align": patch.align = v || undefined; break;
                case "fontFamily": patch.fontFamily = v || undefined; break;
                case "fontSize": patch.fontSize = v ? Number(v) : undefined; break;
                case "bg": patch.bg = v || undefined; break;
                case "border":
                case "borderWeight": {
                    const sides = {};
                    for (const side of BORDER_SIDES) if (draft.border[side]) sides[side] = draft.borderWeight;
                    patch.border = Object.keys(sides).length ? sides : undefined;
                    break;
                }
                default: patch[field] = v;
            }
        }
        onApply(patch);
        onOpenChange(false);
    };

    const preview = useMemo(() => {
        const n = typeof sampleValue === "number" ? sampleValue : 1234.5678;
        const fmt = draft.numberFormat === "text" ? null : draft.numberFormat;
        return draft.numberFormat === "text" ? String(sampleValue ?? "1234.5678") : applyNumberFormat(n, { numberFormat: fmt, decimalPlaces: draft.decimalPlaces });
    }, [draft.numberFormat, draft.decimalPlaces, sampleValue]);

    const field = "h-8 text-sm border border-slate-200 rounded-md px-2 bg-white outline-none focus:border-indigo-400";
    return (
        <DialogShell open={open} onOpenChange={onOpenChange} title="Format Cells" onSubmit={submit} className="max-w-xl">
            <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="bg-slate-100">
                    {["number", "alignment", "font", "border", "fill"].map((t) => (
                        <TabsTrigger key={t} value={t} className="capitalize cursor-pointer">{t}</TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="number" className="mt-3 space-y-3">
                    <div className="grid grid-cols-[160px_1fr] gap-4">
                        <div className="border border-slate-200 rounded-md max-h-56 overflow-y-auto">
                            {numberFormats.map((f) => (
                                <button
                                    key={f.value}
                                    className={cn("w-full text-left text-sm px-2.5 py-1.5 cursor-pointer", draft.numberFormat === f.value ? "bg-indigo-600 text-white" : "hover:bg-slate-50 text-slate-700")}
                                    onClick={() => set("numberFormat", f.value)}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                        <div className="space-y-3">
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Sample</div>
                                <div className="h-9 px-3 flex items-center border border-slate-200 rounded-md bg-slate-50 font-mono text-sm">{preview}</div>
                            </div>
                            {DECIMAL_FORMATS.has(draft.numberFormat) && (
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    Decimal places
                                    <input type="number" min={0} max={10} className={cn(field, "w-20")} value={draft.decimalPlaces} onChange={(e) => set("decimalPlaces", e.target.value)} />
                                </label>
                            )}
                            <p className="text-xs text-slate-500">
                                {draft.numberFormat === "date" && "Shows date serials (e.g. from =TODAY()) as yyyy-mm-dd."}
                                {draft.numberFormat === "time" && "Shows the time part as hh:mm:ss."}
                                {draft.numberFormat === "datetime" && "Shows yyyy-mm-dd hh:mm."}
                                {draft.numberFormat === "text" && "Shows exactly what was typed."}
                                {draft.numberFormat === "general" && "No specific number format."}
                            </p>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="alignment" className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                        <label className="text-sm text-slate-700 space-y-1">
                            <div>Horizontal</div>
                            <select className={cn(field, "w-full")} value={draft.align} onChange={(e) => set("align", e.target.value)}>
                                <option value="">General</option>
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                            </select>
                        </label>
                        <label className="text-sm text-slate-700 space-y-1">
                            <div>Vertical</div>
                            <select className={cn(field, "w-full")} value={draft.valign} onChange={(e) => set("valign", e.target.value)}>
                                <option value="top">Top</option>
                                <option value="middle">Middle</option>
                                <option value="bottom">Bottom</option>
                            </select>
                        </label>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><Checkbox checked={draft.wrap} onCheckedChange={(v) => set("wrap", !!v)} /> Wrap text</label>
                </TabsContent>

                <TabsContent value="font" className="mt-3 space-y-3">
                    <div className="grid grid-cols-[1fr_100px] gap-4">
                        <label className="text-sm text-slate-700 space-y-1">
                            <div>Font</div>
                            <select className={cn(field, "w-full")} value={draft.fontFamily} onChange={(e) => set("fontFamily", e.target.value)}>
                                <option value="">Default</option>
                                {fontFamilies.map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </label>
                        <label className="text-sm text-slate-700 space-y-1">
                            <div>Size</div>
                            <select className={cn(field, "w-full")} value={draft.fontSize} onChange={(e) => set("fontSize", e.target.value)}>
                                <option value="">Default</option>
                                {fontSizes.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        {[["bold", "Bold"], ["italic", "Italic"], ["underline", "Underline"], ["strike", "Strikethrough"]].map(([key, label]) => (
                            <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><Checkbox checked={draft[key]} onCheckedChange={(v) => set(key, !!v)} /> {label}</label>
                        ))}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                        Color <input type="color" className="w-8 h-8 cursor-pointer" value={draft.color} onChange={(e) => set("color", e.target.value)} />
                    </label>
                </TabsContent>

                <TabsContent value="border" className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => set("border", {})}>None</Button>
                        <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => set("border", { top: true, bottom: true, left: true, right: true })}>All sides</Button>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        {BORDER_SIDES.map((side) => (
                            <label key={side} className="flex items-center gap-2 text-sm text-slate-700 capitalize cursor-pointer">
                                <Checkbox checked={!!draft.border?.[side]} onCheckedChange={(v) => set("border", { ...draft.border, [side]: !!v })} /> {side}
                            </label>
                        ))}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                        Weight
                        <select className={field} value={draft.borderWeight} onChange={(e) => set("borderWeight", e.target.value)}>
                            {borderWeights.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                        </select>
                    </label>
                    <p className="text-xs text-slate-500">Applied to each selected cell.</p>
                </TabsContent>

                <TabsContent value="fill" className="mt-3 space-y-3">
                    <div className="flex items-center gap-3">
                        <input type="color" className="w-10 h-10 cursor-pointer" value={draft.bg || "#ffffff"} onChange={(e) => set("bg", e.target.value)} />
                        <div className="w-24 h-10 rounded-md border border-slate-200" style={{ backgroundColor: draft.bg || "transparent" }} />
                        <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => set("bg", "")}>No fill</Button>
                    </div>
                </TabsContent>
            </Tabs>
            <DialogButtons onCancel={() => onOpenChange(false)} onConfirm={submit} />
        </DialogShell>
    );
};

// ---------------------------------------------------------------------------
// Ctrl++ / Ctrl+- when the selection isn't whole rows/columns

export const InsertDeleteDialog = ({ open, mode, onOpenChange, onChoose }) => {
    const [kind, setKind] = useState("rows");
    useEffect(() => { if (open) setKind("rows"); }, [open]);
    const submit = () => { onChoose(kind); onOpenChange(false); };
    return (
        <DialogShell open={open} onOpenChange={onOpenChange} title={mode === "delete" ? "Delete" : "Insert"} onSubmit={submit} className="max-w-xs">
            <RadioList
                name="insert-delete"
                value={kind}
                onChange={setKind}
                options={[{ value: "rows", label: "Entire row" }, { value: "cols", label: "Entire column" }]}
            />
            <DialogButtons onCancel={() => onOpenChange(false)} onConfirm={submit} />
        </DialogShell>
    );
};

// ---------------------------------------------------------------------------
// Alt+O, H, U — Unhide sheet

export const UnhideSheetDialog = ({ open, onOpenChange, hiddenSheets, onUnhide }) => {
    const [selected, setSelected] = useState(null);
    useEffect(() => { if (open) setSelected(hiddenSheets[0] ?? null); }, [open, hiddenSheets]);
    const submit = () => { if (selected) { onUnhide(selected); onOpenChange(false); } };
    return (
        <DialogShell open={open} onOpenChange={onOpenChange} title="Unhide Sheet" onSubmit={submit} className="max-w-xs">
            {hiddenSheets.length === 0 ? (
                <p className="text-sm text-slate-500">No sheets are hidden.</p>
            ) : (
                <div className="border border-slate-200 rounded-md max-h-56 overflow-y-auto">
                    {hiddenSheets.map((name) => (
                        <button
                            key={name}
                            className={cn("w-full text-left text-sm px-2.5 py-1.5 cursor-pointer", selected === name ? "bg-indigo-600 text-white" : "hover:bg-slate-50 text-slate-700")}
                            onClick={() => setSelected(name)}
                            onDoubleClick={() => { onUnhide(name); onOpenChange(false); }}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            )}
            <DialogButtons onCancel={() => onOpenChange(false)} onConfirm={submit} confirmDisabled={!selected} />
        </DialogShell>
    );
};
