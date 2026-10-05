// Conditional Formatting UI: the ribbon menu (Highlight Cells Rules, Top/Bottom
// Rules, Data Bars, Color Scales, Icon Sets, New Rule, Clear Rules, Manage
// Rules), the small "Greater Than…"-style dialogs, the New / Edit Formatting
// Rule dialog and the Rules Manager. Presentational like the other dialogs —
// ExcelClone owns the sheet mutations; the rule engine lives in
// utils/spreadsheets/conditionalFormat.js.

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/common/ui/button.jsx";
import { Checkbox } from "@/components/forms/primitives/checkbox.jsx";
import { IconPlus, IconEraser, IconClipboardList, IconPencil, IconX, IconCopy, IconChevronUp, IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/utils/classNames.js";
import { DialogShell } from "./ExcelDialogs.jsx";
import { MenuItem, MenuSeparator, MenuSub, MenuHeader, MenuClose } from "./ribbonParts.jsx";
import {
    ICON_SETS, DATE_PERIODS, VISUAL_RULE_TYPES, TYPE_DEFAULTS, CATEGORY_DEFAULT_TYPE, blankRule, describeRule, newRuleId, ruleTouchesBounds, parseRangesText, formatRangesText,
} from "../../../utils/spreadsheets/conditionalFormat.js";

// ---------------------------------------------------------------------------
// Icon-set glyphs

const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
    const angle = (-90 + i * 36) * (Math.PI / 180);
    const r = i % 2 === 0 ? 6.8 : 2.9;
    return [+(8 + r * Math.cos(angle)).toFixed(2), +(8.4 + r * Math.sin(angle)).toFixed(2)];
});
const starPath = (indices) => indices.map((i) => STAR_POINTS[i].join(",")).join(" ");
const ARROW_ROTATION = { arrowUp: 0, arrowUpRight: 45, arrowRight: 90, arrowDownRight: 135, arrowDown: 180 };
const PIE_END = { 1: "14,8", 2: "8,14", 3: "2,8" };
const EMPTY = "#c8c8c8";

export const CfIcon = ({ set, index, className = "w-3.5 h-3.5" }) => {
    const [shape, color] = (ICON_SETS[set] || ICON_SETS["3Arrows"]).icons[index] || [];
    if (!shape) return null;
    let body;
    if (shape in ARROW_ROTATION) body = <path d="M8 1.5l5.5 5.5h-3.3v7.5H5.8V7H2.5z" fill={color} transform={`rotate(${ARROW_ROTATION[shape]} 8 8)`} />;
    else if (shape === "triangleUp") body = <path d="M8 2.5l6.5 11h-13z" fill={color} />;
    else if (shape === "triangleDown") body = <path d="M8 13.5l6.5-11h-13z" fill={color} />;
    else if (shape === "dash") body = <rect x="2" y="6.2" width="12" height="3.6" rx="0.5" fill={color} />;
    else if (shape === "circle") body = <circle cx="8" cy="8" r="6.2" fill={color} />;
    else if (shape === "diamond") body = <path d="M8 1.2l6.8 6.8L8 14.8 1.2 8z" fill={color} />;
    else if (shape === "check") body = <><circle cx="8" cy="8" r="6.5" fill={color} /><path d="M4.6 8.3l2.3 2.3 4.5-5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>;
    else if (shape === "exclaim") body = <><circle cx="8" cy="8" r="6.5" fill={color} /><rect x="7.1" y="3.8" width="1.8" height="5.2" rx="0.6" fill="#fff" /><circle cx="8" cy="11.4" r="1.05" fill="#fff" /></>;
    else if (shape === "cross") body = <><circle cx="8" cy="8" r="6.5" fill={color} /><path d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></>;
    else if (shape === "flag") body = <><path d="M3.5 1.5v13" stroke="#555" strokeWidth="1.3" strokeLinecap="round" /><path d="M4.2 2.3h8.6l-2.2 3 2.2 3H4.2z" fill={color} /></>;
    else if (shape.startsWith("star")) {
        body = (
            <>
                <polygon points={starPath([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])} fill={shape === "star" ? color : "#fff"} stroke={color} strokeWidth="0.9" strokeLinejoin="round" />
                {shape === "starHalf" && <polygon points={starPath([0, 5, 6, 7, 8, 9])} fill={color} />}
            </>
        );
    } else if (shape.startsWith("bars")) {
        const filled = Number(shape.slice(4));
        body = [0, 1, 2, 3].map((i) => <rect key={i} x={1.2 + i * 3.6} y={14.5 - (4 + i * 3)} width="2.8" height={4 + i * 3} fill={i < filled ? color : EMPTY} />);
    } else if (shape.startsWith("pie")) {
        const quarters = Number(shape.slice(3));
        body = (
            <>
                <circle cx="8" cy="8" r="6" fill={quarters === 4 ? color : "#fff"} stroke={color} strokeWidth="1.1" />
                {PIE_END[quarters] && <path d={`M8 8L8 2A6 6 0 ${quarters === 3 ? 1 : 0} 1 ${PIE_END[quarters]}Z`} fill={color} />}
            </>
        );
    }
    return <svg viewBox="0 0 16 16" className={cn("shrink-0", className)} aria-hidden="true">{body}</svg>;
};

// ---------------------------------------------------------------------------
// Presets

const HIGHLIGHT_FORMATS = [
    { key: "lightRedDarkRed", label: "Light Red Fill with Dark Red Text", format: { bg: "#ffc7ce", color: "#9c0006" } },
    { key: "yellowDarkYellow", label: "Yellow Fill with Dark Yellow Text", format: { bg: "#ffeb9c", color: "#9c5700" } },
    { key: "greenDarkGreen", label: "Green Fill with Dark Green Text", format: { bg: "#c6efce", color: "#006100" } },
    { key: "lightRed", label: "Light Red Fill", format: { bg: "#ffc7ce" } },
    { key: "redText", label: "Red Text", format: { color: "#9c0006" } },
    { key: "redBorder", label: "Red Border", format: { borderColor: "#9c0006" } },
];

const DATA_BAR_COLORS = [
    ["Blue", "#638ec6"], ["Green", "#63c384"], ["Red", "#ff555a"], ["Orange", "#ffb628"], ["Light Blue", "#008aef"], ["Purple", "#d6007b"],
];

// Colours run from the lowest value to the highest.
const COLOR_SCALES = [
    ["Green - Yellow - Red", ["#f8696b", "#ffeb84", "#63be7b"]],
    ["Red - Yellow - Green", ["#63be7b", "#ffeb84", "#f8696b"]],
    ["Green - White - Red", ["#f8696b", "#fcfcff", "#63be7b"]],
    ["Red - White - Green", ["#63be7b", "#fcfcff", "#f8696b"]],
    ["Blue - White - Red", ["#f8696b", "#fcfcff", "#5a8ac6"]],
    ["Red - White - Blue", ["#5a8ac6", "#fcfcff", "#f8696b"]],
    ["White - Red", ["#f8696b", "#fcfcff"]],
    ["Red - White", ["#fcfcff", "#f8696b"]],
    ["Green - White", ["#fcfcff", "#63be7b"]],
    ["White - Green", ["#63be7b", "#fcfcff"]],
    ["Green - Yellow", ["#ffef9c", "#63be7b"]],
    ["Yellow - Green", ["#63be7b", "#ffef9c"]],
];

const ICON_SET_GROUPS = ["Directional", "Shapes", "Indicators", "Ratings"];

const barBackground = (color, gradient) => (gradient ? `linear-gradient(90deg, ${color}, ${color}22)` : color);

// ---------------------------------------------------------------------------
// Ribbon menu

const glyph = (children) => <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">{children}</svg>;
const GRID = <path d="M2.5 3.5h19v17h-19zM2.5 9.2h19M2.5 14.8h19M8.8 3.5v17M15.2 3.5v17" stroke="#64748b" strokeWidth="1" />;
const HighlightGlyph = glyph(<><rect x="2.5" y="3.5" width="19" height="17" fill="#fff" /><rect x="8.8" y="9.2" width="6.4" height="5.6" fill="#f8a5a5" />{GRID}<path d="M16.5 15.5l5 2.5-5 2.5z" fill="#334155" /></>);
const TopBottomGlyph = glyph(<><rect x="2.5" y="3.5" width="19" height="17" fill="#fff" /><rect x="2.5" y="3.5" width="19" height="5.7" fill="#fbbf24" />{GRID}<path d="M12 18.5v-7m-2.6 2.6L12 11.5l2.6 2.6" stroke="#b45309" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>);
const DataBarGlyph = glyph(<><rect x="2.5" y="3.5" width="19" height="17" fill="#fff" stroke="#64748b" /><rect x="4" y="5.5" width="13" height="3.4" fill="#5b8dd6" /><rect x="4" y="10.3" width="7" height="3.4" fill="#5b8dd6" /><rect x="4" y="15.1" width="10" height="3.4" fill="#5b8dd6" /></>);
const ColorScaleGlyph = glyph(<><rect x="2.5" y="3.5" width="19" height="5.7" fill="#63be7b" /><rect x="2.5" y="9.2" width="19" height="5.6" fill="#ffeb84" /><rect x="2.5" y="14.8" width="19" height="5.7" fill="#f8696b" /><rect x="2.5" y="3.5" width="19" height="17" stroke="#64748b" /></>);
const IconSetGlyph = glyph(<><rect x="2.5" y="3.5" width="19" height="17" fill="#fff" stroke="#64748b" /><circle cx="6.5" cy="7.3" r="1.9" fill="#3f9c35" /><circle cx="6.5" cy="12" r="1.9" fill="#e6a700" /><circle cx="6.5" cy="16.7" r="1.9" fill="#d13438" /><path d="M10.5 7.3h8M10.5 12h8M10.5 16.7h8" stroke="#94a3b8" strokeWidth="1.3" /></>);

const GalleryTile = ({ title, onClick, children, className }) => (
    <button
        type="button"
        title={title}
        onClick={onClick}
        className={cn("rounded-sm border border-transparent hover:border-amber-400 hover:bg-amber-50 cursor-pointer p-1 flex items-center justify-center", className)}
    >
        {children}
    </button>
);

// `onQuick(kind)` opens a small rule dialog, `onAddRule(partial)` applies a
// preset to the selection straight away, `onNewRule(category)` opens the full
// rule dialog, `onClear("selection" | "sheet")`, `onManage()`.
export const ConditionalFormatMenu = ({ onQuick, onAddRule, onNewRule, onClear, onManage }) => (
    <>
        <MenuSub icon={HighlightGlyph} label="Highlight Cells Rules">
            <MenuItem label="Greater Than..." onClick={() => onQuick("gt")} />
            <MenuItem label="Less Than..." onClick={() => onQuick("lt")} />
            <MenuItem label="Between..." onClick={() => onQuick("between")} />
            <MenuItem label="Equal To..." onClick={() => onQuick("eq")} />
            <MenuItem label="Text that Contains..." onClick={() => onQuick("text")} />
            <MenuItem label="A Date Occurring..." onClick={() => onQuick("date")} />
            <MenuItem label="Duplicate Values..." onClick={() => onQuick("duplicate")} />
            <MenuSeparator />
            <MenuItem label="More Rules..." onClick={() => onNewRule("contain")} />
        </MenuSub>
        <MenuSub icon={TopBottomGlyph} label="Top/Bottom Rules">
            <MenuItem label="Top 10 Items..." onClick={() => onQuick("top")} />
            <MenuItem label="Top 10 %..." onClick={() => onQuick("topPct")} />
            <MenuItem label="Bottom 10 Items..." onClick={() => onQuick("bottom")} />
            <MenuItem label="Bottom 10 %..." onClick={() => onQuick("bottomPct")} />
            <MenuItem label="Above Average..." onClick={() => onQuick("above")} />
            <MenuItem label="Below Average..." onClick={() => onQuick("below")} />
            <MenuSeparator />
            <MenuItem label="More Rules..." onClick={() => onNewRule("rank")} />
        </MenuSub>
        <MenuSeparator />
        <MenuSub icon={DataBarGlyph} label="Data Bars" contentClassName="w-52">
            <MenuClose>{(close) => (
                <>
                    {[["Gradient Fill", true], ["Solid Fill", false]].map(([heading, gradient]) => (
                        <React.Fragment key={heading}>
                            <MenuHeader>{heading}</MenuHeader>
                            <div className="grid grid-cols-3 gap-1 px-1 pb-1">
                                {DATA_BAR_COLORS.map(([name, color]) => (
                                    <GalleryTile key={name} title={`${name} Data Bar`} onClick={() => { close(); onAddRule({ type: "dataBar", color, gradient }); }}>
                                        <span className="w-12 h-8 border border-slate-300 bg-white flex flex-col justify-around p-0.5">
                                            {[1, 0.55, 0.8].map((w, i) => <span key={i} className="h-1.5" style={{ width: `${w * 100}%`, background: barBackground(color, gradient) }} />)}
                                        </span>
                                    </GalleryTile>
                                ))}
                            </div>
                        </React.Fragment>
                    ))}
                </>
            )}</MenuClose>
            <MenuSeparator />
            <MenuItem label="More Rules..." onClick={() => onNewRule("values:dataBar")} />
        </MenuSub>
        <MenuSub icon={ColorScaleGlyph} label="Color Scales" contentClassName="w-56">
            <MenuClose>{(close) => (
                <div className="grid grid-cols-4 gap-1 p-1">
                    {COLOR_SCALES.map(([name, colors]) => (
                        <GalleryTile key={name} title={`${name} Color Scale`} onClick={() => { close(); onAddRule({ type: "colorScale", colors }); }}>
                            <span className="w-9 h-9 border border-slate-300 flex flex-col">
                                {[...colors].reverse().map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
                            </span>
                        </GalleryTile>
                    ))}
                </div>
            )}</MenuClose>
            <MenuSeparator />
            <MenuItem label="More Rules..." onClick={() => onNewRule("values:colorScale")} />
        </MenuSub>
        <MenuSub icon={IconSetGlyph} label="Icon Sets" contentClassName="w-64">
            <MenuClose>{(close) => (
                <>
                    {ICON_SET_GROUPS.map((group) => (
                        <React.Fragment key={group}>
                            <MenuHeader>{group}</MenuHeader>
                            <div className="grid grid-cols-2 gap-1 px-1 pb-1">
                                {Object.entries(ICON_SETS).filter(([, set]) => set.group === group).map(([key, set]) => (
                                    <GalleryTile key={key} title={set.label} className="justify-start gap-1 px-1.5" onClick={() => { close(); onAddRule({ type: "iconSet", set: key }); }}>
                                        {set.icons.map((_, i) => <CfIcon key={i} set={key} index={i} className="w-4 h-4" />)}
                                    </GalleryTile>
                                ))}
                            </div>
                        </React.Fragment>
                    ))}
                </>
            )}</MenuClose>
            <MenuSeparator />
            <MenuItem label="More Rules..." onClick={() => onNewRule("values:iconSet")} />
        </MenuSub>
        <MenuSeparator />
        <MenuItem icon={IconPlus} label="New Rule..." onClick={() => onNewRule()} />
        <MenuSub icon={<IconEraser className="w-4 h-4 text-slate-600" strokeWidth={1.5} />} label="Clear Rules">
            <MenuItem label="Clear Rules from Selected Cells" onClick={() => onClear("selection")} />
            <MenuItem label="Clear Rules from Entire Sheet" onClick={() => onClear("sheet")} />
        </MenuSub>
        <MenuItem icon={IconClipboardList} label="Manage Rules..." onClick={onManage} />
    </>
);

// ---------------------------------------------------------------------------
// Format preview and editor

const INPUT = "h-8 text-sm border border-slate-300 rounded px-2 outline-none focus:border-indigo-500 bg-white";
const SELECT = cn(INPUT, "cursor-pointer");

export const RuleFormatPreview = ({ rule, className }) => {
    if (rule.type === "dataBar") {
        return (
            <div className={cn("h-7 border border-slate-300 bg-white p-0.5", className)}>
                <div className="h-full w-3/4" style={{ background: barBackground(rule.color || "#638ec6", rule.gradient) }} />
            </div>
        );
    }
    if (rule.type === "colorScale") {
        return <div className={cn("h-7 border border-slate-300", className)} style={{ background: `linear-gradient(90deg, ${(rule.colors || []).join(", ")})` }} />;
    }
    if (rule.type === "iconSet") {
        const set = ICON_SETS[rule.set] || ICON_SETS["3Arrows"];
        const order = set.icons.map((_, i) => (rule.reverse ? set.icons.length - 1 - i : i));
        return (
            <div className={cn("h-7 border border-slate-300 bg-white flex items-center gap-1 px-1.5", className)}>
                {order.map((i) => <CfIcon key={i} set={rule.set} index={i} className="w-4 h-4" />)}
            </div>
        );
    }
    const f = rule.format || {};
    const isSet = Object.values(f).some((v) => v !== undefined && v !== null && v !== "" && v !== false);
    return (
        <div
            className={cn("h-7 border border-slate-300 flex items-center justify-center text-xs px-2 truncate", className)}
            style={{
                backgroundColor: f.bg || "#fff",
                color: f.color || "#0f172a",
                fontWeight: f.bold ? "bold" : undefined,
                fontStyle: f.italic ? "italic" : undefined,
                textDecoration: [f.underline && "underline", f.strike && "line-through"].filter(Boolean).join(" ") || undefined,
                boxShadow: f.borderColor ? `inset 0 0 0 1.5px ${f.borderColor}` : undefined,
            }}
        >
            {isSet ? "AaBbCcYyZz" : <span className="text-slate-400">No Format Set</span>}
        </div>
    );
};

const ColorField = ({ label, value, fallback, onChange }) => (
    <div className="flex items-center gap-1.5 text-xs text-slate-700">
        <span className="w-14 shrink-0">{label}</span>
        <input type="color" className="w-8 h-6 cursor-pointer p-0 border border-slate-300 rounded-sm bg-white" value={value || fallback} onChange={(e) => onChange(e.target.value)} />
        {value
            ? <button type="button" className="text-[11px] text-indigo-600 hover:underline cursor-pointer" onClick={() => onChange(undefined)}>None</button>
            : <span className="text-[11px] text-slate-400">None</span>}
    </div>
);

const FormatEditor = ({ value, onChange }) => {
    const f = value || {};
    const set = (key, v) => {
        const next = { ...f };
        if (v === undefined || v === false) delete next[key]; else next[key] = v;
        onChange(next);
    };
    const toggle = (key, label, className) => (
        <button
            type="button"
            title={label}
            onClick={() => set(key, !f[key])}
            className={cn("w-7 h-7 rounded-sm border text-sm cursor-pointer", f[key] ? "bg-slate-200 border-slate-400" : "bg-white border-slate-300 hover:bg-slate-100", className)}
        >
            {label[0]}
        </button>
    );
    return (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-3 border border-slate-200 rounded-md bg-slate-50">
            <ColorField label="Fill" value={f.bg} fallback="#ffffff" onChange={(v) => set("bg", v)} />
            <ColorField label="Font" value={f.color} fallback="#000000" onChange={(v) => set("color", v)} />
            <ColorField label="Border" value={f.borderColor} fallback="#000000" onChange={(v) => set("borderColor", v)} />
            <div className="flex items-center gap-1 text-xs text-slate-700">
                <span className="w-14 shrink-0">Style</span>
                {toggle("bold", "Bold", "font-bold")}
                {toggle("italic", "Italic", "italic")}
                {toggle("underline", "Underline", "underline")}
                {toggle("strike", "Strikethrough", "line-through")}
            </div>
        </div>
    );
};

const DialogFooter = ({ children }) => <div className="flex justify-end gap-2 pt-4">{children}</div>;
const PrimaryButton = (props) => <Button size="sm" className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white min-w-20" {...props} />;
const PlainButton = (props) => <Button size="sm" variant="outline" className="cursor-pointer min-w-20" {...props} />;

// ---------------------------------------------------------------------------
// Highlight Cells / Top-Bottom quick dialogs

const QUICK_RULES = {
    gt: { title: "Greater Than", prompt: "Format cells that are GREATER THAN:", fields: ["value"], build: (v) => ({ type: "cellIs", operator: "gt", value: v.value }) },
    lt: { title: "Less Than", prompt: "Format cells that are LESS THAN:", fields: ["value"], build: (v) => ({ type: "cellIs", operator: "lt", value: v.value }) },
    between: { title: "Between", prompt: "Format cells that are BETWEEN:", fields: ["value", "value2"], build: (v) => ({ type: "cellIs", operator: "between", value: v.value, value2: v.value2 }) },
    eq: { title: "Equal To", prompt: "Format cells that are EQUAL TO:", fields: ["value"], build: (v) => ({ type: "cellIs", operator: "eq", value: v.value }) },
    text: { title: "Text That Contains", prompt: "Format cells that contain the text:", fields: ["value"], build: (v) => ({ type: "text", operator: "contains", text: v.value }) },
    date: { title: "A Date Occurring", prompt: "Format cells that contain a date occurring:", fields: ["period"], build: (v) => ({ type: "date", period: v.period }) },
    duplicate: { title: "Duplicate Values", prompt: "Format cells that contain:", fields: ["dupe"], build: (v) => ({ type: v.dupe }) },
    top: { title: "Top 10 Items", prompt: "Format cells that rank in the TOP:", fields: ["rank"], build: (v) => ({ type: "top", rank: v.rank }) },
    topPct: { title: "Top 10%", prompt: "Format cells that rank in the TOP:", fields: ["rank"], percent: true, build: (v) => ({ type: "top", rank: v.rank, percent: true }) },
    bottom: { title: "Bottom 10 Items", prompt: "Format cells that rank in the BOTTOM:", fields: ["rank"], build: (v) => ({ type: "top", rank: v.rank, bottom: true }) },
    bottomPct: { title: "Bottom 10%", prompt: "Format cells that rank in the BOTTOM:", fields: ["rank"], percent: true, build: (v) => ({ type: "top", rank: v.rank, bottom: true, percent: true }) },
    above: { title: "Above Average", prompt: "Format cells that are ABOVE AVERAGE:", fields: [], build: () => ({ type: "average", mode: "above" }) },
    below: { title: "Below Average", prompt: "Format cells that are BELOW AVERAGE:", fields: [], build: () => ({ type: "average", mode: "below" }) },
};

// `kind` is a key of QUICK_RULES, or null while closed.
export const QuickRuleDialog = ({ kind, onOpenChange, onApply }) => {
    const config = QUICK_RULES[kind];
    const [values, setValues] = useState({});
    const [presetKey, setPresetKey] = useState(HIGHLIGHT_FORMATS[0].key);
    const [customFormat, setCustomFormat] = useState({});
    useEffect(() => {
        if (!kind) return;
        setValues({ value: "", value2: "", period: "yesterday", dupe: "duplicate", rank: 10 });
        setPresetKey(HIGHLIGHT_FORMATS[0].key);
        setCustomFormat({ bg: "#ffc7ce", color: "#9c0006" });
    }, [kind]);
    if (!config) return null;

    const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
    const format = presetKey === "custom" ? customFormat : HIGHLIGHT_FORMATS.find((p) => p.key === presetKey)?.format;
    const submit = () => {
        const missing = config.fields.some((field) => (field === "value" || field === "value2") && String(values[field]).trim() === "");
        if (missing) { toast.error("Enter a value for the rule."); return; }
        const rank = Math.floor(Number(values.rank));
        if (config.fields.includes("rank") && !(rank >= 1 && (!config.percent || rank <= 100))) {
            toast.error(config.percent ? "Enter a percentage from 1 to 100." : "Enter a whole number of 1 or more.");
            return;
        }
        onApply({ ...config.build({ ...values, value: String(values.value).trim(), value2: String(values.value2).trim(), rank }), format });
        onOpenChange(false);
    };

    return (
        <DialogShell open onOpenChange={onOpenChange} title={config.title} onSubmit={submit} className="max-w-xl">
            <p className="text-sm text-slate-700 mb-2">{config.prompt}</p>
            <div className="flex flex-wrap items-center gap-2">
                {config.fields.includes("value") && <input autoFocus className={cn(INPUT, "flex-1 min-w-24")} value={values.value ?? ""} onChange={set("value")} />}
                {config.fields.includes("value2") && <><span className="text-sm text-slate-600">and</span><input className={cn(INPUT, "flex-1 min-w-24")} value={values.value2 ?? ""} onChange={set("value2")} /></>}
                {config.fields.includes("period") && (
                    <select autoFocus className={cn(SELECT, "flex-1")} value={values.period} onChange={set("period")}>
                        {DATE_PERIODS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                )}
                {config.fields.includes("dupe") && (
                    <select autoFocus className={SELECT} value={values.dupe} onChange={set("dupe")}>
                        <option value="duplicate">Duplicate</option>
                        <option value="unique">Unique</option>
                    </select>
                )}
                {config.fields.includes("rank") && (
                    <>
                        <input autoFocus type="number" min="1" max={config.percent ? 100 : undefined} className={cn(INPUT, "w-20")} value={values.rank ?? 10} onChange={set("rank")} />
                        {config.percent && <span className="text-sm text-slate-600">%</span>}
                    </>
                )}
                <span className="text-sm text-slate-600">{config.fields.includes("dupe") ? "values with" : "with"}</span>
                <select className={cn(SELECT, "flex-1 min-w-48")} value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
                    {HIGHLIGHT_FORMATS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                    <option value="custom">Custom Format...</option>
                </select>
            </div>
            {presetKey === "custom" && <div className="mt-3"><FormatEditor value={customFormat} onChange={setCustomFormat} /></div>}
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                Preview: <RuleFormatPreview rule={{ format }} className="w-36" />
            </div>
            <DialogFooter>
                <PrimaryButton onClick={submit}>OK</PrimaryButton>
                <PlainButton onClick={() => onOpenChange(false)}>Cancel</PlainButton>
            </DialogFooter>
        </DialogShell>
    );
};

// ---------------------------------------------------------------------------
// New / Edit Formatting Rule

const RULE_CATEGORIES = [
    ["values", "Format all cells based on their values"],
    ["contain", "Format only cells that contain"],
    ["rank", "Format only top or bottom ranked values"],
    ["average", "Format only values that are above or below average"],
    ["unique", "Format only unique or duplicate values"],
];
const CATEGORY_OF_TYPE = {
    dataBar: "values", colorScale: "values", iconSet: "values",
    cellIs: "contain", text: "contain", date: "contain", blanks: "contain", noBlanks: "contain", errors: "contain", noErrors: "contain",
    top: "rank", average: "average", duplicate: "unique", unique: "unique",
};
const CONTAIN_TYPES = [
    ["cellIs", "Cell Value"], ["text", "Specific Text"], ["date", "Dates Occurring"],
    ["blanks", "Blanks"], ["noBlanks", "No Blanks"], ["errors", "Errors"], ["noErrors", "No Errors"],
];
const CELL_IS_OPERATORS = [
    ["between", "between"], ["notBetween", "not between"], ["eq", "equal to"], ["neq", "not equal to"],
    ["gt", "greater than"], ["lt", "less than"], ["gte", "greater than or equal to"], ["lte", "less than or equal to"],
];
const TEXT_OPERATORS = [["contains", "containing"], ["notContains", "not containing"], ["beginsWith", "beginning with"], ["endsWith", "ending with"]];
const AVERAGE_MODES = [["above", "above"], ["below", "below"], ["equalAbove", "equal or above"], ["equalBelow", "equal or below"]];

// Keeps only what the rule's type uses, so switching types never leaves stale settings behind.
const finalizeRule = (draft) => {
    const base = { id: draft.id, type: draft.type, ranges: draft.ranges };
    if (draft.byDisplay) base.byDisplay = true;
    switch (draft.type) {
        case "dataBar": return { ...base, color: draft.color || "#638ec6", gradient: !!draft.gradient };
        case "colorScale": return { ...base, colors: draft.colors };
        case "iconSet": return { ...base, set: draft.set, ...(draft.reverse ? { reverse: true } : null) };
        default: break;
    }
    const rule = { ...base, format: draft.format || {}, ...(draft.stopIfTrue ? { stopIfTrue: true } : null) };
    switch (draft.type) {
        case "cellIs": {
            const two = draft.operator === "between" || draft.operator === "notBetween";
            return { ...rule, operator: draft.operator, value: String(draft.value ?? "").trim(), ...(two ? { value2: String(draft.value2 ?? "").trim() } : null) };
        }
        case "text": return { ...rule, operator: draft.operator, text: String(draft.text ?? "") };
        case "date": return { ...rule, period: draft.period };
        case "top": return { ...rule, rank: Math.floor(Number(draft.rank)), ...(draft.bottom ? { bottom: true } : null), ...(draft.percent ? { percent: true } : null) };
        case "average": return { ...rule, mode: draft.mode };
        default: return rule;
    }
};

const problemWith = (draft) => {
    if (draft.type === "cellIs") {
        if (String(draft.value ?? "").trim() === "") return "Enter a value for the rule.";
        if ((draft.operator === "between" || draft.operator === "notBetween") && String(draft.value2 ?? "").trim() === "") return "Enter both values for the rule.";
    }
    if (draft.type === "text" && String(draft.text ?? "") === "") return "Enter the text to look for.";
    if (draft.type === "top") {
        const rank = Math.floor(Number(draft.rank));
        if (!(rank >= 1) || (draft.percent && rank > 100)) return draft.percent ? "Enter a percentage from 1 to 100." : "Enter a whole number of 1 or more.";
    }
    return null;
};

// The body shared by the New Rule dialog and the Rules Manager's edit view.
const RuleEditorForm = ({ initialRule, onSave, onCancel }) => {
    const [draft, setDraft] = useState(initialRule);
    const category = CATEGORY_OF_TYPE[draft.type] || "contain";
    const patch = (changes) => setDraft((d) => ({ ...d, ...changes }));
    const setType = (type) => setDraft((d) => (d.type === type ? d : { ...d, ...TYPE_DEFAULTS[type], type }));
    const field = (key) => (e) => patch({ [key]: e.target.value });
    const isVisual = VISUAL_RULE_TYPES.has(draft.type);
    const scaleStyle = draft.type === "colorScale" ? (draft.colors?.length === 3 ? "scale3" : "scale2") : draft.type;

    const setScaleStyle = (style) => {
        if (style === "scale2") setDraft((d) => ({ ...d, type: "colorScale", colors: [d.colors?.[0] || "#f8696b", d.colors?.[d.colors.length - 1] || "#63be7b"] }));
        else if (style === "scale3") setDraft((d) => ({ ...d, type: "colorScale", colors: [d.colors?.[0] || "#f8696b", "#ffeb84", d.colors?.[d.colors.length - 1] || "#63be7b"] }));
        else setType(style);
    };
    const setScaleColor = (index, color) => setDraft((d) => ({ ...d, colors: d.colors.map((c, i) => (i === index ? color : c)) }));

    const save = () => {
        const problem = problemWith(draft);
        if (problem) { toast.error(problem); return; }
        onSave(finalizeRule(draft));
    };

    return (
        <div onKeyDown={(e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); save(); } }}>
            <div className="text-xs font-semibold text-slate-600 mb-1">Select a Rule Type:</div>
            <div className="border border-slate-300 rounded-sm bg-white">
                {RULE_CATEGORIES.map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => { if (key !== category) setType(CATEGORY_DEFAULT_TYPE[key]); }}
                        className={cn("w-full text-left text-sm px-2 py-1 cursor-pointer", key === category ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100")}
                    >
                        ► {label}
                    </button>
                ))}
                <div className="w-full text-left text-sm px-2 py-1 text-slate-400" title="Formula rules aren't supported yet">► Use a formula to determine which cells to format</div>
            </div>

            <div className="text-xs font-semibold text-slate-600 mt-4 mb-1">Edit the Rule Description:</div>
            <div className="border border-slate-300 rounded-sm p-3 space-y-3">
                {category === "values" && (
                    <>
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                            <span className="w-24 shrink-0">Format Style:</span>
                            <select className={SELECT} value={scaleStyle} onChange={(e) => setScaleStyle(e.target.value)}>
                                <option value="scale2">2-Color Scale</option>
                                <option value="scale3">3-Color Scale</option>
                                <option value="dataBar">Data Bar</option>
                                <option value="iconSet">Icon Sets</option>
                            </select>
                        </div>
                        {draft.type === "colorScale" && (
                            <div className="flex items-center gap-6 text-sm text-slate-700">
                                {draft.colors.map((color, i) => (
                                    <label key={i} className="flex items-center gap-1.5">
                                        {i === 0 ? "Minimum" : i === draft.colors.length - 1 ? "Maximum" : "Midpoint"}
                                        <input type="color" className="w-8 h-6 cursor-pointer p-0 border border-slate-300 rounded-sm" value={color} onChange={(e) => setScaleColor(i, e.target.value)} />
                                    </label>
                                ))}
                            </div>
                        )}
                        {draft.type === "dataBar" && (
                            <div className="flex items-center gap-6 text-sm text-slate-700">
                                <label className="flex items-center gap-1.5">
                                    Fill
                                    <select className={SELECT} value={draft.gradient ? "gradient" : "solid"} onChange={(e) => patch({ gradient: e.target.value === "gradient" })}>
                                        <option value="gradient">Gradient Fill</option>
                                        <option value="solid">Solid Fill</option>
                                    </select>
                                </label>
                                <label className="flex items-center gap-1.5">
                                    Color
                                    <input type="color" className="w-8 h-6 cursor-pointer p-0 border border-slate-300 rounded-sm" value={draft.color || "#638ec6"} onChange={field("color")} />
                                </label>
                            </div>
                        )}
                        {draft.type === "iconSet" && (
                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
                                <label className="flex items-center gap-1.5">
                                    Icon Style
                                    <select className={SELECT} value={draft.set} onChange={field("set")}>
                                        {Object.entries(ICON_SETS).map(([key, set]) => <option key={key} value={key}>{set.label}</option>)}
                                    </select>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox checked={!!draft.reverse} onCheckedChange={(v) => patch({ reverse: !!v })} /> Reverse Icon Order
                                </label>
                            </div>
                        )}
                    </>
                )}

                {category === "contain" && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                        <span>Format only cells with:</span>
                        <select className={SELECT} value={draft.type} onChange={(e) => setType(e.target.value)}>
                            {CONTAIN_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                        {draft.type === "cellIs" && (
                            <>
                                <select className={SELECT} value={draft.operator} onChange={field("operator")}>
                                    {CELL_IS_OPERATORS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                                </select>
                                <input className={cn(INPUT, "w-28")} value={draft.value ?? ""} onChange={field("value")} />
                                {(draft.operator === "between" || draft.operator === "notBetween") && (
                                    <><span>and</span><input className={cn(INPUT, "w-28")} value={draft.value2 ?? ""} onChange={field("value2")} /></>
                                )}
                            </>
                        )}
                        {draft.type === "text" && (
                            <>
                                <select className={SELECT} value={draft.operator} onChange={field("operator")}>
                                    {TEXT_OPERATORS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                                </select>
                                <input className={cn(INPUT, "w-40")} value={draft.text ?? ""} onChange={field("text")} />
                            </>
                        )}
                        {draft.type === "date" && (
                            <select className={SELECT} value={draft.period} onChange={field("period")}>
                                {DATE_PERIODS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select>
                        )}
                    </div>
                )}

                {category === "rank" && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                        <span>Format values that rank in the:</span>
                        <select className={SELECT} value={draft.bottom ? "bottom" : "top"} onChange={(e) => patch({ bottom: e.target.value === "bottom" })}>
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                        </select>
                        <input type="number" min="1" className={cn(INPUT, "w-20")} value={draft.rank ?? 10} onChange={field("rank")} />
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={!!draft.percent} onCheckedChange={(v) => patch({ percent: !!v })} /> % of the selected range
                        </label>
                    </div>
                )}

                {category === "average" && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                        <span>Format values that are:</span>
                        <select className={SELECT} value={draft.mode} onChange={field("mode")}>
                            {AVERAGE_MODES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                        <span>the average for the selected range</span>
                    </div>
                )}

                {category === "unique" && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                        <span>Format all:</span>
                        <select className={SELECT} value={draft.type} onChange={(e) => setType(e.target.value)}>
                            <option value="duplicate">duplicate</option>
                            <option value="unique">unique</option>
                        </select>
                        <span>values in the selected range</span>
                    </div>
                )}

                {!isVisual && <FormatEditor value={draft.format} onChange={(format) => patch({ format })} />}
                <div className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="w-16 shrink-0">Preview:</span>
                    <RuleFormatPreview rule={draft} className="w-44" />
                </div>
            </div>

            <DialogFooter>
                <PrimaryButton onClick={save}>OK</PrimaryButton>
                <PlainButton onClick={onCancel}>Cancel</PlainButton>
            </DialogFooter>
        </div>
    );
};

// `rule` is the rule to start from (see blankRule), or null while closed.
export const NewRuleDialog = ({ rule, onOpenChange, onApply }) => {
    if (!rule) return null;
    return (
        <DialogShell open onOpenChange={onOpenChange} title="New Formatting Rule" className="max-w-2xl">
            <RuleEditorForm initialRule={rule} onSave={(saved) => { onApply(saved); onOpenChange(false); }} onCancel={() => onOpenChange(false)} />
        </DialogShell>
    );
};

// ---------------------------------------------------------------------------
// Conditional Formatting Rules Manager

const SELECTION_SCOPE = "__selection__";

const AppliesToInput = ({ ranges, onCommit }) => {
    const text = formatRangesText(ranges);
    const [draft, setDraft] = useState(text);
    useEffect(() => { setDraft(text); }, [text]);
    const commit = () => {
        if (draft.trim().toUpperCase() === text) { setDraft(text); return; }
        const parsed = parseRangesText(draft);
        if (!parsed) { toast.error("Enter a range like A1:D20."); setDraft(text); return; }
        onCommit(parsed);
    };
    return (
        <input
            className="w-full h-7 text-xs font-mono border border-slate-300 rounded-sm px-1.5 outline-none focus:border-indigo-500 bg-white uppercase"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
        />
    );
};

const ToolButton = ({ icon: Icon, children, ...props }) => (
    <button
        type="button"
        className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs border border-slate-300 rounded-sm bg-white text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-40 disabled:cursor-default disabled:hover:bg-white"
        {...props}
    >
        {Icon && <Icon className="w-4 h-4" strokeWidth={1.5} />}
        {children}
    </button>
);

// rulesBySheet: { sheetName: rule[] } for every sheet, already normalized.
// selectionBounds: the areas of the current selection; selectionRanges: the same as ranges.
// onCommit(rulesBySheet) receives the edited map (unchanged sheets keep their array).
export const RulesManagerDialog = ({ open, onOpenChange, rulesBySheet, activeSheetName, selectionBounds, selectionRanges, onCommit }) => {
    const [draft, setDraft] = useState({});
    const [scope, setScope] = useState(SELECTION_SCOPE);
    const [selectedId, setSelectedId] = useState(null);
    const [editing, setEditing] = useState(null); // { rule, isNew }
    const [dirty, setDirty] = useState(false);

    // Loaded once per opening: the draft is what OK / Apply write back.
    useEffect(() => {
        if (!open) return;
        setDraft(rulesBySheet);
        setScope(SELECTION_SCOPE);
        setSelectedId(null);
        setEditing(null);
        setDirty(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const sheetName = scope === SELECTION_SCOPE ? activeSheetName : scope;
    const sheetRules = useMemo(() => draft[sheetName] || [], [draft, sheetName]);
    const visible = useMemo(
        () => (scope === SELECTION_SCOPE ? sheetRules.filter((rule) => ruleTouchesBounds(rule, selectionBounds)) : sheetRules),
        [scope, sheetRules, selectionBounds]
    );
    const selected = visible.find((rule) => rule.id === selectedId) || null;
    const selectedPos = selected ? visible.indexOf(selected) : -1;

    const setSheetRules = (updater) => {
        setDraft((d) => ({ ...d, [sheetName]: updater(d[sheetName] || []) }));
        setDirty(true);
    };
    const patchRule = (id, changes) => setSheetRules((rules) => rules.map((rule) => (rule.id === id ? { ...rule, ...changes } : rule)));
    const removeSelected = () => { setSheetRules((rules) => rules.filter((rule) => rule.id !== selectedId)); setSelectedId(null); };
    const duplicateSelected = () => {
        const copy = { ...selected, id: newRuleId() };
        setSheetRules((rules) => { const i = rules.findIndex((rule) => rule.id === selectedId); return [...rules.slice(0, i + 1), copy, ...rules.slice(i + 1)]; });
        setSelectedId(copy.id);
    };
    // Swaps with the neighbouring rule shown in the list, wherever that sits on the sheet.
    const move = (step) => {
        const other = visible[selectedPos + step];
        if (!other) return;
        setSheetRules((rules) => {
            const next = [...rules];
            const a = next.findIndex((rule) => rule.id === selectedId), b = next.findIndex((rule) => rule.id === other.id);
            [next[a], next[b]] = [next[b], next[a]];
            return next;
        });
    };
    const saveEdited = (rule) => {
        if (editing.isNew) setSheetRules((rules) => [rule, ...rules]);
        else setSheetRules((rules) => rules.map((r) => (r.id === rule.id ? rule : r)));
        setSelectedId(rule.id);
        setEditing(null);
    };
    const commit = () => { onCommit(draft); setDirty(false); };

    if (!open) return null;
    if (editing) {
        return (
            <DialogShell open onOpenChange={() => setEditing(null)} title={editing.isNew ? "New Formatting Rule" : "Edit Formatting Rule"} className="max-w-2xl">
                <RuleEditorForm initialRule={editing.rule} onSave={saveEdited} onCancel={() => setEditing(null)} />
            </DialogShell>
        );
    }

    return (
        <DialogShell open onOpenChange={onOpenChange} title="Conditional Formatting Rules Manager" className="max-w-4xl">
            <label className="flex items-center gap-2 text-sm text-slate-700 mb-3">
                Show formatting rules for:
                <select className={cn(SELECT, "min-w-44")} value={scope} onChange={(e) => { setScope(e.target.value); setSelectedId(null); }}>
                    <option value={SELECTION_SCOPE}>Current Selection</option>
                    <option value={activeSheetName}>This Worksheet</option>
                    {Object.keys(rulesBySheet).filter((name) => name !== activeSheetName).map((name) => <option key={name} value={name}>Sheet: {name}</option>)}
                </select>
            </label>

            <div className="border border-slate-300 rounded-sm">
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 border-b border-slate-200 bg-slate-50">
                    <ToolButton icon={IconPlus} onClick={() => setEditing({ isNew: true, rule: { ...blankRule(), id: newRuleId(), ranges: selectionRanges } })}>New Rule...</ToolButton>
                    <ToolButton icon={IconPencil} disabled={!selected} onClick={() => setEditing({ isNew: false, rule: selected })}>Edit Rule...</ToolButton>
                    <ToolButton icon={IconX} disabled={!selected} onClick={removeSelected}>Delete Rule</ToolButton>
                    <ToolButton icon={IconCopy} disabled={!selected} onClick={duplicateSelected}>Duplicate Rule</ToolButton>
                    <ToolButton icon={IconChevronUp} disabled={selectedPos <= 0} onClick={() => move(-1)} title="Move Up" />
                    <ToolButton icon={IconChevronDown} disabled={selectedPos < 0 || selectedPos >= visible.length - 1} onClick={() => move(1)} title="Move Down" />
                </div>
                <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.3fr)_5rem] text-xs text-slate-600 border-b border-slate-200">
                    <div className="px-2 py-1.5 border-r border-slate-200">Rule (applied in order shown)</div>
                    <div className="px-2 py-1.5 border-r border-slate-200">Format</div>
                    <div className="px-2 py-1.5 border-r border-slate-200">Applies to</div>
                    <div className="px-2 py-1.5">Stop If True</div>
                </div>
                <div className="h-56 overflow-y-auto bg-white">
                    {visible.length === 0 && (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400">
                            {scope === SELECTION_SCOPE ? "No rules apply to the current selection." : "This sheet has no conditional formatting rules."}
                        </div>
                    )}
                    {visible.map((rule) => (
                        <div
                            key={rule.id}
                            onClick={() => setSelectedId(rule.id)}
                            onDoubleClick={() => setEditing({ isNew: false, rule })}
                            className={cn(
                                "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.3fr)_5rem] items-center border-b border-slate-100 cursor-pointer",
                                rule.id === selectedId ? "bg-indigo-50 outline outline-1 -outline-offset-1 outline-indigo-400" : "hover:bg-slate-50"
                            )}
                        >
                            <div className="px-2 py-1.5 text-xs text-slate-800 truncate" title={describeRule(rule)}>{describeRule(rule)}</div>
                            <div className="px-2 py-1.5"><RuleFormatPreview rule={rule} /></div>
                            <div className="px-2 py-1.5"><AppliesToInput ranges={rule.ranges} onCommit={(ranges) => patchRule(rule.id, { ranges })} /></div>
                            <div className="px-2 py-1.5 flex justify-center" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                    checked={!!rule.stopIfTrue}
                                    disabled={VISUAL_RULE_TYPES.has(rule.type)}
                                    onCheckedChange={(v) => patchRule(rule.id, { stopIfTrue: v ? true : undefined })}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <DialogFooter>
                <PrimaryButton onClick={() => { commit(); onOpenChange(false); }}>OK</PrimaryButton>
                <PlainButton onClick={() => onOpenChange(false)}>Close</PlainButton>
                <PlainButton onClick={commit} disabled={!dirty}>Apply</PlainButton>
            </DialogFooter>
        </DialogShell>
    );
};
