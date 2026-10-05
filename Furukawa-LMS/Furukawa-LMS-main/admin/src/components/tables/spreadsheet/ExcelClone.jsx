import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useDeferredValue, forwardRef, useImperativeHandle } from "react";
import { toast } from "sonner";
import { Button } from "@/components/common/ui/button.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/common/ui/popover.jsx";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from "@/components/common/ui/context-menu.jsx";
import { Checkbox } from "@/components/forms/primitives/checkbox.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/common/ui/dialog.jsx";
import { Progress } from "@/components/common/ui/progress.jsx";
import {
    IconBold, IconItalic, IconUnderline, IconStrikethrough,
    IconAlignLeft, IconAlignCenter, IconAlignRight, IconDownload, IconUpload, IconDeviceFloppy, IconLoader2, IconTable, IconPlus, IconMinus,
    IconArrowBackUp, IconArrowForwardUp, IconSearch, IconX, IconBorderAll,
    IconCopy, IconClipboard, IconBrush, IconPercentage,
    IconBorderOuter, IconSortAscending, IconSortDescending, IconRowInsertTop, IconRowInsertBottom,
    IconColumnInsertLeft, IconColumnInsertRight, IconRowRemove, IconColumnRemove, IconTrash,
    IconSum, IconChevronDown, IconChevronUp, IconLayoutAlignTop, IconLayoutAlignMiddle,
    IconLayoutAlignBottom, IconTextWrap, IconCheck, IconBorderBottom, IconBorderNone, IconBorderRight, IconBorderLeft,
    IconFilter, IconFilterFilled, IconPhoto, IconTriangleSquareCircle, IconVideo, IconCrop, IconPencil,
    IconHelpCircle, IconMathFunction, IconEye, IconEyeOff, IconPrinter, IconClipboardList, IconMaximize, IconMinimize,
    IconScissors, IconClipboardText, IconBorderTop, IconBucketDroplet, IconTextOrientation, IconIndentDecrease, IconIndentIncrease,
    IconArrowAutofitWidth, IconCash, IconTablePlus, IconTableMinus, IconTableOptions, IconArrowBarToDown, IconArrowBarToRight,
    IconEraser, IconClearFormatting, IconReplace, IconArrowForward, IconLayoutGrid
} from "@tabler/icons-react";
import {
    useGetDailyMeetingSheetQuery, useSaveDailyMeetingSheetMutation,
    useGetDailyMorningMeetingDetailQuery, useSaveDailyMorningMeetingSheetMutation,
    useSaveDailyMorningMeetingSheetPatchMutation
} from "@/services/api/DepartmentApi.js";
import {
    getCellId, parseCellRef, indexToCol, expandRange, buildRawValueGrid, adjustFormula, extrapolateSeries,
    evaluateSheet, extractFormulaReferences, cycleReferenceAt, isFormula, cellPosOf, CELL_POS_STRIDE
} from "../../../utils/spreadsheets/formulaEngine.js";
import { patternWithDecimals } from "../../../constants/spreadsheets/numberFormatCatalog.js";
import { parseDateTimeText } from "../../../utils/spreadsheets/formulaValues.js";
import { CheatSheetDialog, GoToDialog, PasteSpecialDialog, FormatCellsDialog, InsertDeleteDialog, UnhideSheetDialog } from "./ExcelDialogs.jsx";
import { PIVOT_AGGREGATIONS, AGG_LABELS, getPivotSourceFields, recomputePivotSheets, renamePivotSourceReferences } from "../../../utils/spreadsheets/pivotEngine.js";
import { applyWorkbookUpdate, applyHistoryRecord, plainOf } from "../../../utils/spreadsheets/workbookUpdate.js";
import { diffWorkbook } from "./workbookDiff.js";
import { rebaseSnapshot } from "../../../utils/spreadsheets/workbookSync.js";
import { useSheetLiveSync, newClientId } from "./useSheetLiveSync.js";
import { cn } from "@/utils/classNames.js";
import FullScreenFrame from "./FullScreenFrame.jsx";
import {
    RibbonGroup, RibbonStack, RibbonRow, RibbonDivider, RibbonBtn, RibbonDropdown, RibbonSplit,
    MenuItem, MenuSeparator, MenuHeader, MenuClose, ColorSplitButton, RibbonCombo,
    CondFormatIcon, FormatTableIcon, CellStylesIcon, SortFilterIcon, DecimalIcon,
} from "./ribbonParts.jsx";

const DEFAULT_ROW_COUNT = 30;
const DEFAULT_COLUMN_COUNT = 15;
const DEFAULT_SHEET_NAME = "Sheet 1";
const DEFAULT_COLUMN_WIDTH = 96;
const DEFAULT_ROW_HEIGHT = 28;
const MIN_COLUMN_WIDTH = 40;
const MIN_ROW_HEIGHT = 20;
const ROW_HEADER_WIDTH = 40;
const HEADER_ROW_HEIGHT = 28; // matches the sticky column-header <th> row's h-7
const MEDIA_MIN_SIZE = 40;
const ROW_VIRTUALIZATION_BUFFER = 10;
const COL_VIRTUALIZATION_BUFFER = 4;
// Used for the visible-column window until the grid's width has been measured.
const UNMEASURED_VIEWPORT_WIDTH = 2400;
const IO_CHUNK_SIZE = 250; // rows processed per batch during import/export, between UI-yielding pauses
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
const DEFAULT_FONT_SIZE = 12; // the grid's text-xs
const FONT_FAMILIES = [
    "Aptos Narrow", "Aptos", "Arial", "Calibri", "Cambria", "Candara", "Consolas", "Courier New",
    "Georgia", "Segoe UI", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana",
];
const MAX_INDENT = 15;
// Alignment > Orientation menu. `rotation` is stored like ExcelJS's textRotation:
// degrees counter-clockwise (-90..90) or "vertical" for stacked text.
const ORIENTATION_OPTIONS = [
    { value: 45, label: "Angle Counterclockwise" },
    { value: -45, label: "Angle Clockwise" },
    { value: "vertical", label: "Vertical Text" },
    { value: 90, label: "Rotate Text Up" },
    { value: -90, label: "Rotate Text Down" },
];
// An undo step for an ordinary edit holds only the cells it changed (see
// workbookUpdate.js). A bulk step — an import, a sort, a format applied to
// thousands of cells, an inserted row — keeps the whole previous sheet, which
// on a sheet with several hundred thousand cells is tens of MB; this cap
// bounds how many of those can pile up.
const HISTORY_LIMIT = 10;
const DATA_BROADCAST_DEBOUNCE_MS = 120;
const CHART_SAVE_DEBOUNCE_MS = 800;
// A patch bigger than this (as JSON) is sent as a full workbook save instead.
const MAX_PATCH_CHARS = 1024 * 1024;
// With autosave on, unsaved edits are saved this long after the last one.
const AUTOSAVE_DELAY_MS = 3000;
// How many times a save that someone else's save got in ahead of is rebuilt on top of
// theirs and sent again (live co-editing only) before it is reported as failed.
const MAX_SAVE_RETRIES = 3;
// True when `live` holds nothing that isn't already in `saved` (see workbookDiff.js).
const isWorkbookSaved = (saved, live) => {
    if (!saved || !live) return false;
    if (saved === live) return true;
    const pending = diffWorkbook(saved, live);
    return !!pending && Object.keys(pending.sheets).length === 0;
};
// Above this many selected cells, the status-bar totals walk the sheet's
// filled cells instead of every cell of the selection.
const SELECTION_SCAN_LIMIT = 20000;
const NUMBER_FORMATS = [
    { value: "general", label: "General" },
    { value: "number", label: "Number" },
    { value: "currency", label: "Currency" },
    { value: "accounting", label: "Accounting" },
    { value: "percentage", label: "Percentage" },
    { value: "comma", label: "Comma" },
    { value: "scientific", label: "Scientific" },
    { value: "date", label: "Date" },
    { value: "time", label: "Time" },
    { value: "datetime", label: "Date & Time" },
    { value: "text", label: "Text" },
];
// Categories only Format Cells can set (they need a format code).
const NUMBER_FORMAT_LABELS = { fraction: "Fraction", special: "Special", custom: "Custom" };
// Home > Borders menu. Edge presets outline the selection rectangle (like
// Excel), "all" borders every cell, "none" clears.
const BORDER_PRESETS = [
    { key: "bottom", label: "Bottom Border", icon: IconBorderBottom },
    { key: "top", label: "Top Border", icon: IconBorderTop },
    { key: "left", label: "Left Border", icon: IconBorderLeft },
    { key: "right", label: "Right Border", icon: IconBorderRight },
    null,
    { key: "none", label: "No Border", icon: IconBorderNone },
    { key: "all", label: "All Borders", icon: IconBorderAll },
    { key: "outside", label: "Outside Borders", icon: IconBorderOuter },
    { key: "thickOutside", label: "Thick Outside Borders", icon: IconBorderOuter, weight: "thick" },
];
const BORDER_WEIGHTS = [
    { value: "thin", label: "Thin" },
    { value: "thick", label: "Thick" },
    { value: "double", label: "Double" },
];
const CELL_STYLE_PRESETS = [
    { key: "heading", label: "Heading", style: { bold: true, fontSize: 14, bg: "#e0e7ff", color: undefined } },
    { key: "good", label: "Good", style: { bg: "#dcfce7", color: "#166534" } },
    { key: "bad", label: "Bad", style: { bg: "#fee2e2", color: "#991b1b" } },
    { key: "neutral", label: "Neutral", style: { bg: "#fef9c3", color: "#854d0e" } },
    { key: "total", label: "Total", style: { bold: true, border: { top: "thick" } } },
];
const AUTOSUM_FUNCS = ["SUM", "AVERAGE", "COUNT", "MAX", "MIN"];

// "Format as Table" style gallery — header color + alternating row bands,
// mirroring Excel's Table Styles picker. All header text is white so the
// filter-chevron button can use one fixed icon color across every preset.
const TABLE_STYLE_PRESETS = [
    { key: "indigo", label: "Indigo", header: { bg: "#4f46e5", color: "#ffffff" }, bandA: "#ffffff", bandB: "#eef2ff", border: "#c7d2fe" },
    { key: "slate", label: "Slate", header: { bg: "#334155", color: "#ffffff" }, bandA: "#ffffff", bandB: "#f1f5f9", border: "#cbd5e1" },
    { key: "emerald", label: "Emerald", header: { bg: "#047857", color: "#ffffff" }, bandA: "#ffffff", bandB: "#ecfdf5", border: "#a7f3d0" },
    { key: "amber", label: "Amber", header: { bg: "#b45309", color: "#ffffff" }, bandA: "#ffffff", bandB: "#fffbeb", border: "#fde68a" },
    { key: "rose", label: "Rose", header: { bg: "#be123c", color: "#ffffff" }, bandA: "#ffffff", bandB: "#fff1f2", border: "#fecdd3" },
    { key: "sky", label: "Sky", header: { bg: "#0369a1", color: "#ffffff" }, bandA: "#ffffff", bandB: "#f0f9ff", border: "#bae6fd" },
    { key: "violet", label: "Violet", header: { bg: "#6d28d9", color: "#ffffff" }, bandA: "#ffffff", bandB: "#f5f3ff", border: "#ddd6fe" },
    { key: "mono", label: "Minimal", header: { bg: "#0f172a", color: "#ffffff" }, bandA: "#ffffff", bandB: "#ffffff", border: "#e2e8f0" },
];

const TableStyleSwatch = ({ preset }) => (
    <div className="w-full h-8 rounded overflow-hidden flex flex-col border" style={{ borderColor: preset.border }}>
        <div style={{ background: preset.header.bg, height: "34%" }} />
        <div style={{ background: preset.bandB, height: "33%" }} />
        <div style={{ background: preset.bandA, height: "33%" }} />
    </div>
);

// Drag-select auto-scroll: how close to the grid's right/bottom edge the
// pointer must be, how far each tick scrolls, and how much the sheet grows
// when the drag reaches its end.
const DRAG_SCROLL_EDGE = 20;
const DRAG_SCROLL_INTERVAL_MS = 50;
const DRAG_SCROLL_STEP_X = 60;
const DRAG_SCROLL_STEP_Y = 30;
const DRAG_GROW_ROWS = 10;
const DRAG_GROW_COLUMNS = 5;
const DRAG_GROW_INTERVAL_MS = 300;

const emptySheet = () => ({ cells: {}, rowCount: DEFAULT_ROW_COUNT, columnCount: DEFAULT_COLUMN_COUNT, conditionalRules: [], merges: [], columnWidths: {}, rowHeights: {}, tables: [], media: [] });
const EMPTY_LIST = Object.freeze([]); // stable fallback for optional per-sheet arrays, so memo deps don't churn

// Excel caps sheet names at 31 chars, forbids : \ / ? * [ ] and compares
// names case-insensitively. Used on both import (so a workbook's tab names
// become valid, unique `sheets` keys) and export (since in-app renames aren't
// held to Excel's rules and ExcelJS throws on an invalid/duplicate name).
// `usedNames` holds lowercased names already taken and is updated in place.
const EXCEL_SHEET_NAME_MAX = 31;
const toUniqueExcelSheetName = (name, usedNames) => {
    const cleanName = String(name || "").replace(/[:\\/?*[\]]/g, "_").trim().slice(0, EXCEL_SHEET_NAME_MAX) || "Sheet";
    let uniqueName = cleanName;
    for (let n = 1; usedNames.has(uniqueName.toLowerCase()); n++) {
        const suffix = ` (${n})`;
        uniqueName = `${cleanName.slice(0, EXCEL_SHEET_NAME_MAX - suffix.length)}${suffix}`;
    }
    usedNames.add(uniqueName.toLowerCase());
    return uniqueName;
};

// Prompts for the source sheet + range before a new PivotTable sheet is
// created — re-seeded from `defaultSourceSheet`/`defaultSourceRange` (the
// caller's current selection) every time it's opened.
const CreatePivotDialog = ({ open, onOpenChange, sheetNames, defaultSourceSheet, defaultSourceRange, onCreate }) => {
    const [sourceSheet, setSourceSheet] = useState(defaultSourceSheet);
    const [sourceRange, setSourceRange] = useState(defaultSourceRange);

    useEffect(() => {
        if (open) { setSourceSheet(defaultSourceSheet); setSourceRange(defaultSourceRange); }
    }, [open, defaultSourceSheet, defaultSourceRange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Create PivotTable</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-1">
                    <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Source Sheet</label>
                        <select
                            className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white cursor-pointer"
                            value={sourceSheet}
                            onChange={(e) => setSourceSheet(e.target.value)}
                        >
                            {sheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Source Range</label>
                        <input
                            className="w-full h-8 text-xs border border-slate-200 rounded px-2"
                            placeholder="e.g. A1:D15"
                            value={sourceRange}
                            onChange={(e) => setSourceRange(e.target.value.toUpperCase())}
                        />
                    </div>
                    <p className="text-[11px] text-slate-400">
                        The first row of the range is used as field headers. A new sheet will be created for the PivotTable.
                    </p>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" className="h-8 cursor-pointer" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button size="sm" className="h-8 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => onCreate(sourceSheet, sourceRange)}>Create</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// Right-side "PivotTable Fields" panel shown while a Pivot Sheet is active.
// Each field gets three independent toggle pills (Row / Column / Value) —
// mirroring Excel's field list checkboxes rather than a single-zone picker,
// so a field can drive both a row and column grouping if the user wants
// that. Checking Value shows an aggregation dropdown for that field.
const PivotPanel = ({ pivotConfig, sourceFields, onToggleZone, onChangeAgg, onClose }) => {
    const valueEntry = (field) => pivotConfig.values.find((v) => v.field === field);

    return (
        <div className="w-64 shrink-0 border border-slate-200 rounded-lg bg-white flex flex-col" style={{ maxHeight: 560 }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
                <span className="text-xs font-semibold text-slate-700">PivotTable Fields</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={onClose} title="Close">
                    <IconX className="w-3.5 h-3.5" />
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {sourceFields.map(({ name, isNumeric }) => (
                    <div key={name} className="border border-slate-100 rounded-lg p-2">
                        <div className="text-xs font-medium text-slate-800 truncate mb-1.5" title={name}>{name}</div>
                        <div className="flex gap-1 flex-wrap">
                            <button
                                type="button"
                                className={cn(
                                    "text-[10px] px-2 py-1 rounded-full border cursor-pointer transition-colors",
                                    pivotConfig.rows.includes(name) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                )}
                                onClick={() => onToggleZone(name, "rows", isNumeric)}
                            >
                                Row
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    "text-[10px] px-2 py-1 rounded-full border cursor-pointer transition-colors",
                                    pivotConfig.cols.includes(name) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                )}
                                onClick={() => onToggleZone(name, "cols", isNumeric)}
                            >
                                Column
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    "text-[10px] px-2 py-1 rounded-full border cursor-pointer transition-colors",
                                    valueEntry(name) ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                )}
                                onClick={() => onToggleZone(name, "values", isNumeric)}
                            >
                                Value
                            </button>
                        </div>
                        {valueEntry(name) && (
                            <select
                                className="mt-1.5 w-full h-6 text-[10px] border border-slate-200 rounded px-1 bg-white text-slate-700 cursor-pointer"
                                value={valueEntry(name).agg}
                                onChange={(e) => onChangeAgg(name, e.target.value)}
                            >
                                {PIVOT_AGGREGATIONS.map((a) => <option key={a} value={a}>{AGG_LABELS[a]}</option>)}
                            </select>
                        )}
                    </div>
                ))}
                {sourceFields.length === 0 && (
                    <div className="text-[11px] text-slate-400 text-center py-6">No fields found in the source range.</div>
                )}
            </div>
        </div>
    );
};

const isBlankCell = (cell) => {
    if (!cell) return true;
    const { value, ...styles } = cell;
    const hasValue = value !== undefined && value !== null && value !== "";
    const hasStyle = Object.values(styles).some(Boolean);
    return !hasValue && !hasStyle;
};

const rotationStyleFor = (rotation) => {
    if (rotation === "vertical") return { writingMode: "vertical-rl", textOrientation: "upright" };
    if (rotation === 90) return { writingMode: "vertical-rl", transform: "rotate(180deg)" };
    if (rotation === -90) return { writingMode: "vertical-rl" };
    if (typeof rotation === "number" && rotation !== 0) return { transform: `rotate(${-rotation}deg)` };
    return null;
};
const cellStyleFor = (cell) => ({
    fontWeight: cell?.bold ? "bold" : "normal",
    fontStyle: cell?.italic ? "italic" : "normal",
    textDecoration: [cell?.underline && "underline", cell?.strike && "line-through"].filter(Boolean).join(" ") || "none",
    textDecorationStyle: cell?.underline === "double" ? "double" : undefined,
    textAlign: cell?.align || "left",
    color: cell?.color || undefined,
    fontSize: cell?.fontSize ? `${cell.fontSize}px` : undefined,
    fontFamily: cell?.fontFamily ? `${cell.fontFamily}, sans-serif` : undefined,
    // Each indent level is ~one character width, on the side the text is aligned to.
    ...(cell?.indent ? { [cell.align === "right" ? "paddingRight" : "paddingLeft"]: `${6 + cell.indent * 9}px` } : null),
    ...rotationStyleFor(cell?.rotation),
});

const BORDER_COLOR = "#334155";
const borderWidthFor = (style) => (style === "thick" ? 3 : style === "double" ? 3 : 1);
const borderCssStyleFor = (style) => (style === "double" ? "double" : "solid");

// Renders custom cell borders as absolutely-positioned overlay divs rather
// than actual `border-*` styles on the <td>. The grid's <table> uses
// border-collapse, which merges each shared edge between adjacent cells and
// resolves the conflict itself (roughly: the upper/left cell's edge wins) —
// so a per-cell `border-top`/`border-left` override on plain table borders
// only reliably shows up on the bottom/right edges. An overlay sidesteps
// collapse entirely since it isn't a table border at all.
const CellBorderOverlay = ({ border }) => {
    if (!border) return null;
    return (
        <>
            {border.top && (
                <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ borderTopStyle: borderCssStyleFor(border.top), borderTopWidth: borderWidthFor(border.top), borderTopColor: BORDER_COLOR }} />
            )}
            {border.bottom && (
                <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ borderBottomStyle: borderCssStyleFor(border.bottom), borderBottomWidth: borderWidthFor(border.bottom), borderBottomColor: BORDER_COLOR }} />
            )}
            {border.left && (
                <div className="absolute top-0 bottom-0 left-0 pointer-events-none" style={{ borderLeftStyle: borderCssStyleFor(border.left), borderLeftWidth: borderWidthFor(border.left), borderLeftColor: BORDER_COLOR }} />
            )}
            {border.right && (
                <div className="absolute top-0 bottom-0 right-0 pointer-events-none" style={{ borderRightStyle: borderCssStyleFor(border.right), borderRightWidth: borderWidthFor(border.right), borderRightColor: BORDER_COLOR }} />
            )}
        </>
    );
};

const SELECTION_BORDER_COLOR = "#4f46e5"; // indigo-600, matching the app's existing accent

// Draws a solid border only on whichever outer edges of a multi-cell
// selection this particular cell sits on, so the range reads as one bordered
// block (like Excel) instead of just a flat tint. Built the same way as
// CellBorderOverlay — per-cell absolutely-positioned divs — so it never
// collides with the table's border-collapse behavior.
const SelectionRangeBorder = ({ top, bottom, left, right, color = SELECTION_BORDER_COLOR }) => {
    if (!top && !bottom && !left && !right) return null;
    return (
        <div
            className="absolute inset-0 pointer-events-none"
            style={{
                boxShadow: [
                    top && `inset 0 2px 0 0 ${color}`,
                    bottom && `inset 0 -2px 0 0 ${color}`,
                    left && `inset 2px 0 0 0 ${color}`,
                    right && `inset -2px 0 0 0 ${color}`
                ].filter(Boolean).join(", ")
            }}
        />
    );
};

const rangeBounds = (range) => {
    const s = parseCellRef(range.start), e = parseCellRef(range.end);
    if (!s || !e) return null;
    return {
        minRow: Math.min(s.row, e.row), maxRow: Math.max(s.row, e.row),
        minCol: Math.min(s.col, e.col), maxCol: Math.max(s.col, e.col)
    };
};

const escapeRegex =(s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Excel-style "point mode" reference coloring: each unique cell/range mentioned
// in a formula gets one consistent color, reused for that reference's grid
// highlight and its colored text in the editor. Cycled, not derived from the
// dataviz categorical palette — this is transient editing chrome, not a chart.
const FORMULA_REF_COLORS = ["#4f46e5", "#059669", "#d97706", "#db2777", "#0891b2", "#7c3aed", "#dc2626", "#65a30d"];

// Splits a formula string into colored/uncolored segments for the read-only
// backdrop behind the (text-transparent) edit input, and returns the color
// assigned to each unique reference so the grid overlay can reuse the same
// colors. Uses the engine's own position-preserving lexer, so text inside
// quotes and function names like LOG10 are never mistaken for references,
// and segments line up character-for-character with what was typed.
const tokenizeFormulaForDisplay = (text) => {
    if (!text || !text.trim().startsWith("=")) return { segments: [{ text, color: null }], refColorMap: {} };
    const segments = [];
    const refColorMap = {};
    let colorIdx = 0;
    let lastIndex = 0;
    for (const ref of extractFormulaReferences(text)) {
        if (ref.start > lastIndex) segments.push({ text: text.slice(lastIndex, ref.start), color: null });
        if (!refColorMap[ref.key]) refColorMap[ref.key] = FORMULA_REF_COLORS[colorIdx++ % FORMULA_REF_COLORS.length];
        segments.push({ text: ref.text, color: refColorMap[ref.key] });
        lastIndex = ref.end;
    }
    if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), color: null });
    return { segments, refColorMap };
};

// `mono` must match whichever font class the real (transparent-text) input
// underneath is using — sans for the in-cell editor, mono for the formula bar
// — or the colored characters here drift out of alignment with the invisible
// caret/text in the input on top of it.
const FormulaTextOverlay = ({ text, mono = false, className }) => {
    const { segments } = tokenizeFormulaForDisplay(text);
    return (
        <div aria-hidden="true" className={cn("absolute inset-0 whitespace-pre overflow-hidden pointer-events-none", mono && "font-mono", className)}>
            {segments.map((seg, i) => <span key={i} style={{ color: seg.color || "#0f172a" }}>{seg.text}</span>)}
        </div>
    );
};


// Finds the largest cumulative-offset index whose offset is <= px, i.e. which
// row/column band a pixel coordinate falls inside — used to place a media
// item (row/col + offset -> px) and re-anchor it on drag release (px ->
// row/col + offset), and to drive row virtualization's scroll-position ->
// row-index lookup. Binary search since `offsets` can have thousands of
// entries once a sheet has thousands of rows.
const bandIndexForPixel = (offsets, px) => {
    let lo = 0, hi = offsets.length - 2;
    if (hi < 0) return 0;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (offsets[mid] <= px) lo = mid; else hi = mid - 1;
    }
    return lo;
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Excel-style duplicate-name suffixing: "Sheet 1" -> "Sheet 1 (1)"; copying an
// already-suffixed sheet bumps the number ("Sheet 1 (1)" -> "Sheet 1 (2)")
// rather than nesting another suffix onto it, and either way skips forward
// past any names already taken.
const getDuplicateSheetName = (originalName, existingNames) => {
    const match = originalName.match(/^(.*?)\s*\((\d+)\)$/);
    let baseName = originalName;
    let counter = 1;
    if (match) {
        baseName = match[1];
        counter = parseInt(match[2], 10) + 1;
    }

    let newName = `${baseName} (${counter})`;
    while (existingNames.includes(newName)) {
        counter++;
        newName = `${baseName} (${counter})`;
    }
    return newName;
};

const MIN_CROP_FRACTION = 0.1;
const DEFAULT_CROP = { x: 0, y: 0, w: 1, h: 1 };

// Non-destructive crop: `crop` is the {x,y,w,h} fraction (0-1) of the media
// box that stays visible. Rendered by oversizing the media to `1/w` x `1/h`
// of the box and shifting it by `-x/w`, `-y/h` so that sub-rectangle exactly
// fills the (overflow: hidden) box — same trick as a CSS sprite/zoom-pan, no
// canvas or re-encoding involved, so it's instant and reversible.
const mediaCropStyle = (crop) => ({
    position: "absolute",
    left: `${-(crop.x / crop.w) * 100}%`,
    top: `${-(crop.y / crop.h) * 100}%`,
    width: `${(1 / crop.w) * 100}%`,
    height: `${(1 / crop.h) * 100}%`,
    maxWidth: "none",
    maxHeight: "none",
});

// --- Insert > Shapes ---
// A shape is a floating media item (`type: "shape"`) drawn from the SVG
// markup below on a 100x100 canvas that stretches to the item's box, so it
// moves, resizes and deletes exactly like a picture.
const SHAPE_DEFAULT_FILL = "#4472C4";
const SHAPE_STROKE = "#2F528F";
const SHAPE_DEFAULT_SIZE = 120;
const shapePolygon = (points) => `<polygon points="${points}"/>`;
const starPoints = (tips, innerRatio) => Array.from({ length: tips * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? 48 : 48 * innerRatio;
    const angle = (Math.PI * i) / tips - Math.PI / 2;
    return `${(50 + radius * Math.cos(angle)).toFixed(1)},${(50 + radius * Math.sin(angle)).toFixed(1)}`;
}).join(" ");
const SHAPE_GROUPS = [
    { label: "Lines", shapes: [
        { key: "line", label: "Line", line: true, body: '<line x1="3" y1="3" x2="97" y2="97"/>' },
    ] },
    { label: "Rectangles", shapes: [
        { key: "rect", label: "Rectangle", body: '<rect x="2" y="2" width="96" height="96"/>' },
        { key: "roundRect", label: "Rounded Rectangle", body: '<rect x="2" y="2" width="96" height="96" rx="14" ry="14"/>' },
    ] },
    { label: "Basic Shapes", shapes: [
        { key: "ellipse", label: "Oval", body: '<ellipse cx="50" cy="50" rx="48" ry="48"/>' },
        { key: "triangle", label: "Isosceles Triangle", body: shapePolygon("50,2 98,98 2,98") },
        { key: "rightTriangle", label: "Right Triangle", body: shapePolygon("2,2 98,98 2,98") },
        { key: "diamond", label: "Diamond", body: shapePolygon("50,2 98,50 50,98 2,50") },
        { key: "parallelogram", label: "Parallelogram", body: shapePolygon("25,2 98,2 75,98 2,98") },
        { key: "trapezoid", label: "Trapezoid", body: shapePolygon("25,2 75,2 98,98 2,98") },
        { key: "pentagon", label: "Pentagon", body: shapePolygon("50,2 98,38 80,98 20,98 2,38") },
        { key: "hexagon", label: "Hexagon", body: shapePolygon("25,2 75,2 98,50 75,98 25,98 2,50") },
        { key: "octagon", label: "Octagon", body: shapePolygon("30,2 70,2 98,30 98,70 70,98 30,98 2,70 2,30") },
        { key: "cross", label: "Cross", body: shapePolygon("35,2 65,2 65,35 98,35 98,65 65,65 65,98 35,98 35,65 2,65 2,35 35,35") },
    ] },
    { label: "Block Arrows", shapes: [
        { key: "arrowRight", label: "Arrow: Right", body: shapePolygon("2,30 60,30 60,5 98,50 60,95 60,70 2,70") },
        { key: "arrowLeft", label: "Arrow: Left", body: shapePolygon("98,30 40,30 40,5 2,50 40,95 40,70 98,70") },
        { key: "arrowUp", label: "Arrow: Up", body: shapePolygon("30,98 30,40 5,40 50,2 95,40 70,40 70,98") },
        { key: "arrowDown", label: "Arrow: Down", body: shapePolygon("30,2 30,60 5,60 50,98 95,60 70,60 70,2") },
        { key: "arrowLeftRight", label: "Arrow: Left-Right", body: shapePolygon("2,50 28,10 28,32 72,32 72,10 98,50 72,90 72,68 28,68 28,90") },
        { key: "chevron", label: "Arrow: Chevron", body: shapePolygon("2,2 65,2 98,50 65,98 2,98 35,50") },
    ] },
    { label: "Stars and Banners", shapes: [
        { key: "star4", label: "Star: 4 Points", body: shapePolygon(starPoints(4, 0.4)) },
        { key: "star5", label: "Star: 5 Points", body: shapePolygon(starPoints(5, 0.4)) },
        { key: "star8", label: "Star: 8 Points", body: shapePolygon(starPoints(8, 0.6)) },
    ] },
    { label: "Callouts", shapes: [
        { key: "callout", label: "Speech Bubble: Rectangle", body: shapePolygon("2,2 98,2 98,70 45,70 20,98 25,70 2,70") },
    ] },
];
const SHAPES_BY_KEY = Object.fromEntries(SHAPE_GROUPS.flatMap((g) => g.shapes).map((shape) => [shape.key, shape]));

// The shape as an SVG image URL — used for the grid, the Shapes menu and the
// Excel export alike. The outline keeps its thickness however the box is stretched.
const shapeDataUrl = (item, width = SHAPE_DEFAULT_SIZE, height = SHAPE_DEFAULT_SIZE) => {
    const shape = SHAPES_BY_KEY[item.shape] || SHAPES_BY_KEY.rect;
    const fill = item.fill || SHAPE_DEFAULT_FILL;
    const paint = shape.line
        ? `fill="none" stroke="${fill}" stroke-width="2.5" stroke-linecap="round"`
        : `fill="${fill}" stroke="${SHAPE_STROKE}" stroke-width="1.5" stroke-linejoin="round"`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" width="${width}" height="${height}">`
        + `<style>*{vector-effect:non-scaling-stroke}</style><g ${paint}>${shape.body}</g></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// Floating image/video/shape box, anchored to a grid cell (row/col + pixel offset)
// rather than an absolute page position, so it tracks column/row resizes the
// way Excel's floating objects do. Drag/resize use local component state and
// window listeners scoped to the active gesture (added on pointerdown, torn
// down on pointerup) so idle media items cost nothing, and commit back to the
// sheet (via onUpdate) only once the gesture ends — keeping every intermediate
// frame a cheap local re-render instead of an undo-history-producing update.
const DraggableMedia = ({ item, colOffsets, rowOffsets, columnCount, rowCount, onUpdate, onDelete, readOnly, zoom, isSelected, onSelect }) => {
    const [dragOffset, setDragOffset] = useState(null); // { dx, dy } while actively dragging
    const [resizeDelta, setResizeDelta] = useState(null); // { dw, dh } while actively resizing
    const [isCropping, setIsCropping] = useState(false);
    const [cropDraft, setCropDraft] = useState(null); // { x, y, w, h } fractions, only set while isCropping
    const gestureRef = useRef(null);

    const baseLeft = (colOffsets[item.col] ?? colOffsets[0]) + (item.offsetX || 0);
    const baseTop = (rowOffsets[item.row] ?? rowOffsets[0]) + (item.offsetY || 0);
    const baseWidth = item.width || 280;
    const baseHeight = item.height || 200;

    const left = baseLeft + (dragOffset?.dx || 0);
    const top = baseTop + (dragOffset?.dy || 0);
    const width = Math.max(MEDIA_MIN_SIZE, baseWidth + (resizeDelta?.dw || 0));
    const height = Math.max(MEDIA_MIN_SIZE, baseHeight + (resizeDelta?.dh || 0));

    const startDrag = useCallback((e) => {
        e.stopPropagation();
        onSelect?.();
        if (readOnly) return;
        e.preventDefault();
        gestureRef.current = { startX: e.clientX, startY: e.clientY };
        const onMove = (ev) => {
            setDragOffset({ dx: (ev.clientX - gestureRef.current.startX) / zoom, dy: (ev.clientY - gestureRef.current.startY) / zoom });
        };
        const onUp = (ev) => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            const dx = (ev.clientX - gestureRef.current.startX) / zoom;
            const dy = (ev.clientY - gestureRef.current.startY) / zoom;
            gestureRef.current = null;
            setDragOffset(null);
            if (dx === 0 && dy === 0) return;
            const newLeft = Math.max(colOffsets[0], baseLeft + dx);
            const newTop = Math.max(rowOffsets[0], baseTop + dy);
            const col = Math.min(columnCount - 1, bandIndexForPixel(colOffsets, newLeft));
            const row = Math.min(rowCount - 1, bandIndexForPixel(rowOffsets, newTop));
            onUpdate({ row, col, offsetX: Math.max(0, newLeft - colOffsets[col]), offsetY: Math.max(0, newTop - rowOffsets[row]) });
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, [readOnly, baseLeft, baseTop, colOffsets, rowOffsets, columnCount, rowCount, onUpdate, zoom, onSelect]);

    const startResize = useCallback((e) => {
        if (readOnly) return;
        e.preventDefault();
        e.stopPropagation();
        gestureRef.current = { startX: e.clientX, startY: e.clientY };
        const onMove = (ev) => {
            setResizeDelta({ dw: (ev.clientX - gestureRef.current.startX) / zoom, dh: (ev.clientY - gestureRef.current.startY) / zoom });
        };
        const onUp = (ev) => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            const dw = (ev.clientX - gestureRef.current.startX) / zoom;
            const dh = (ev.clientY - gestureRef.current.startY) / zoom;
            gestureRef.current = null;
            setResizeDelta(null);
            if (dw === 0 && dh === 0) return;
            onUpdate({ width: Math.max(MEDIA_MIN_SIZE, baseWidth + dw), height: Math.max(MEDIA_MIN_SIZE, baseHeight + dh) });
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, [readOnly, baseWidth, baseHeight, onUpdate, zoom]);

    const openCrop = useCallback((e) => {
        e.stopPropagation();
        setCropDraft(item.crop || DEFAULT_CROP);
        setIsCropping(true);
    }, [item.crop]);

    const commitCrop = useCallback((e) => {
        e.stopPropagation();
        onUpdate({ crop: cropDraft });
        setIsCropping(false);
        setCropDraft(null);
    }, [cropDraft, onUpdate]);

    const cancelCrop = useCallback((e) => {
        e.stopPropagation();
        setIsCropping(false);
        setCropDraft(null);
    }, []);

    // Drags one edge of the crop rectangle, keeping the opposite edge fixed.
    // Deltas are converted from px to box-relative fractions using the box's
    // own (un-resizing, since resize is disabled while cropping) width/height.
    const startEdgeDrag = useCallback((edge) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY;
        const startCrop = cropDraft;
        const onMove = (ev) => {
            const dxFrac = (ev.clientX - startX) / (baseWidth * zoom);
            const dyFrac = (ev.clientY - startY) / (baseHeight * zoom);
            setCropDraft(() => {
                let { x, y, w, h } = startCrop;
                if (edge === "left") {
                    const newX = clamp(startCrop.x + dxFrac, 0, startCrop.x + startCrop.w - MIN_CROP_FRACTION);
                    x = newX; w = startCrop.w - (newX - startCrop.x);
                } else if (edge === "right") {
                    w = clamp(startCrop.w + dxFrac, MIN_CROP_FRACTION, 1 - startCrop.x);
                } else if (edge === "top") {
                    const newY = clamp(startCrop.y + dyFrac, 0, startCrop.y + startCrop.h - MIN_CROP_FRACTION);
                    y = newY; h = startCrop.h - (newY - startCrop.y);
                } else if (edge === "bottom") {
                    h = clamp(startCrop.h + dyFrac, MIN_CROP_FRACTION, 1 - startCrop.y);
                }
                return { x, y, w, h };
            });
        };
        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, [cropDraft, baseWidth, baseHeight, zoom]);

    return (
        <div
            className="absolute group"
            style={{ left, top, width, height, zIndex: isCropping ? 50 : 15 }}
        >
            <div
                className={cn(
                    "relative w-full h-full border rounded",
                    // A shape shows the cells behind it; pictures sit on white.
                    item.type === "shape" ? "bg-transparent" : "overflow-hidden bg-white",
                    isSelected ? "border-indigo-500 ring-2 ring-indigo-500 ring-offset-1" : "border-transparent group-hover:border-indigo-400"
                )}
            >
                {isSelected && !isCropping && (
                    <>
                        <div className="absolute -left-1 -top-1 w-2 h-2 bg-indigo-600 rounded-sm z-20 pointer-events-none" />
                        <div className="absolute -right-1 -top-1 w-2 h-2 bg-indigo-600 rounded-sm z-20 pointer-events-none" />
                        <div className="absolute -left-1 -bottom-1 w-2 h-2 bg-indigo-600 rounded-sm z-20 pointer-events-none" />
                        <div className="absolute -right-1 -bottom-1 w-2 h-2 bg-indigo-600 rounded-sm z-20 pointer-events-none" />
                    </>
                )}
                {!isCropping && (item.type === "shape" ? (
                    <img
                        src={shapeDataUrl(item)}
                        alt=""
                        draggable={false}
                        className={cn("w-full h-full select-none", !readOnly && "cursor-move")}
                        onMouseDown={startDrag}
                    />
                ) : item.type === "image" ? (
                    <img
                        src={item.src}
                        alt=""
                        draggable={false}
                        className={cn("select-none", !readOnly && "cursor-move", item.crop ? undefined : "w-full h-full object-contain")}
                        style={item.crop ? mediaCropStyle(item.crop) : undefined}
                        onMouseDown={startDrag}
                    />
                ) : (
                    <>
                        <video
                            src={item.src}
                            controls
                            className={cn("bg-black", item.crop ? undefined : "w-full h-full")}
                            style={item.crop ? mediaCropStyle(item.crop) : undefined}
                        />
                        {!readOnly && (
                            <div
                                onMouseDown={startDrag}
                                className="absolute inset-x-0 top-0 h-4 bg-slate-900/0 group-hover:bg-slate-900/20 cursor-move z-10"
                                title="Drag to move"
                            />
                        )}
                    </>
                ))}

                {isCropping && cropDraft && (
                    <div className="absolute inset-0 bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>
                        {item.type === "image" ? (
                            <img src={item.src} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain opacity-35 select-none pointer-events-none" />
                        ) : (
                            <video src={item.src} muted className="absolute inset-0 w-full h-full object-contain opacity-35 pointer-events-none" />
                        )}
                        <div
                            className="absolute border-2 border-indigo-400 bg-indigo-400/10"
                            style={{ left: `${cropDraft.x * 100}%`, top: `${cropDraft.y * 100}%`, width: `${cropDraft.w * 100}%`, height: `${cropDraft.h * 100}%` }}
                        >
                            <div onMouseDown={startEdgeDrag("left")} className="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 cursor-ew-resize bg-indigo-500/70 hover:bg-indigo-500" title="Drag to adjust left edge" />
                            <div onMouseDown={startEdgeDrag("right")} className="absolute right-0 top-0 bottom-0 w-1.5 -mr-0.5 cursor-ew-resize bg-indigo-500/70 hover:bg-indigo-500" title="Drag to adjust right edge" />
                            <div onMouseDown={startEdgeDrag("top")} className="absolute top-0 left-0 right-0 h-1.5 -mt-0.5 cursor-ns-resize bg-indigo-500/70 hover:bg-indigo-500" title="Drag to adjust top edge" />
                            <div onMouseDown={startEdgeDrag("bottom")} className="absolute bottom-0 left-0 right-0 h-1.5 -mb-0.5 cursor-ns-resize bg-indigo-500/70 hover:bg-indigo-500" title="Drag to adjust bottom edge" />
                        </div>
                        <div className="absolute top-1 right-1 flex gap-1 z-10">
                            <button onMouseDown={(e) => e.stopPropagation()} onClick={cancelCrop} className="w-6 h-6 flex items-center justify-center rounded bg-white/90 text-slate-500 hover:text-red-600 hover:bg-white cursor-pointer" title="Cancel crop">
                                <IconX className="w-4 h-4" />
                            </button>
                            <button onMouseDown={(e) => e.stopPropagation()} onClick={commitCrop} className="w-6 h-6 flex items-center justify-center rounded bg-white/90 text-green-600 hover:bg-white cursor-pointer" title="Apply crop">
                                <IconCheck className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {!readOnly && !isCropping && (
                    <>
                        {item.type === "shape" ? (
                            <input
                                type="color"
                                value={item.fill || SHAPE_DEFAULT_FILL}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) => onUpdate({ fill: e.target.value })}
                                className="absolute top-0.5 right-6 w-5 h-5 p-0 border-0 rounded bg-white/90 opacity-0 group-hover:opacity-100 cursor-pointer z-20"
                                title="Shape color"
                            />
                        ) : (
                            <button
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={openCrop}
                                className="absolute top-0.5 right-6 w-5 h-5 flex items-center justify-center rounded bg-white/90 text-slate-500 hover:text-indigo-600 hover:bg-white opacity-0 group-hover:opacity-100 cursor-pointer z-20"
                                title="Crop"
                            >
                                <IconCrop className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={onDelete}
                            className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded bg-white/90 text-slate-500 hover:text-red-600 hover:bg-white opacity-0 group-hover:opacity-100 cursor-pointer z-20"
                            title="Remove"
                        >
                            <IconX className="w-3.5 h-3.5" />
                        </button>
                        <div
                            onMouseDown={startResize}
                            className="absolute right-0 bottom-0 w-3 h-3 bg-indigo-600 cursor-nwse-resize opacity-0 group-hover:opacity-100 z-20"
                            title="Drag to resize"
                        />
                    </>
                )}
            </div>
        </div>
    );
};

// --- ExcelJS import/export helpers ---
// SheetJS (the previous import path) only round-trips raw values — no colors,
// fonts, alignment, borders, number formats, merges, or column/row sizing.
// ExcelJS exposes all of that per-cell, so import can approximate the source
// file's look instead of dumping it as a bare grid of strings.

// Modern Office theme palette (Background1/Text1/Background2/Text2/Accent1-6).
// A themed cell color only carries a {theme, tint} pair — ExcelJS doesn't
// surface the workbook's actual custom theme XML through the basic cell API —
// so this approximates with the standard Office default palette, which is
// right for the large majority of real files (those that don't customize it).
const EXCEL_THEME_COLORS = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47"];

// Blends a #RRGGBB color toward white (tint > 0) or black (tint < 0) using
// Excel's own tint formula, so a themed color with a lighter/darker shade
// applied in the source file still looks approximately right after import.
const applyTint = (hex, tint) => {
    if (!tint) return hex;
    const num = parseInt(hex, 16);
    const channels = [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff].map((c) => {
        const blended = tint > 0 ? c * (1 - tint) + 255 * tint : c * (1 + tint);
        return Math.max(0, Math.min(255, Math.round(blended)));
    });
    return channels.map((c) => c.toString(16).padStart(2, "0")).join("");
};

// Resolves an ExcelJS color object ({argb}, {theme, tint}, or unset) to a
// "#RRGGBB" string, or null if the cell doesn't specify a color at all.
const parseExcelColor = (colorObj) => {
    if (!colorObj) return null;
    if (colorObj.argb) return `#${colorObj.argb.slice(-6)}`;
    if (colorObj.theme !== undefined) return `#${applyTint(EXCEL_THEME_COLORS[colorObj.theme] || "000000", colorObj.tint || 0)}`;
    return null;
};

// Excel's richer border-style vocabulary collapses onto this app's three
// weights: "double" stays "double", medium-and-bolder styles read as "thick",
// everything else (thin, hair, dotted, dashed variants) reads as "thin".
const mapBorderStyle = (excelStyle) => {
    if (!excelStyle) return null;
    if (excelStyle === "double") return "double";
    if (["medium", "thick", "mediumDashed", "mediumDashDot", "mediumDashDotDot", "slantDashDot"].includes(excelStyle)) return "thick";
    return "thin";
};

// Classifies an Excel number-format code string into this app's presets by
// pattern, not an exhaustive lookup — real files use a huge variety of custom
// format codes, so this only needs to catch the common shapes.
const mapNumberFormat = (numFmt) => {
    if (!numFmt || numFmt === "General") return undefined;
    if (numFmt === "@") return "text";
    if (/E[+-]0/i.test(numFmt)) return "scientific";
    const unquoted = numFmt.replace(/"[^"]*"|\\./g, ""); // drop quoted/escaped literals before looking for date letters
    const hasDate = /[yd]/i.test(unquoted) || /m{3,}/i.test(unquoted);
    const hasTime = /[hs]/i.test(unquoted);
    if (hasDate && hasTime) return "datetime";
    if (hasDate) return "date";
    if (hasTime) return "time";
    if (numFmt.includes("%")) return "percentage";
    if (/[$€£¥]/.test(numFmt)) return "currency";
    if (numFmt.includes(",")) return "comma";
    if (/^[0#.]+$/.test(numFmt.replace(/;.*/, ""))) return "number";
    return undefined;
};

const getDecimalPlaces = (numFmt) => {
    if (!numFmt) return undefined;
    const match = numFmt.match(/\.([0#]+)/);
    return match ? match[1].length : 0;
};

// Hands control back to the browser for a frame so a progress-bar state
// update set just before this actually paints, instead of getting batched
// away behind a long synchronous run of row-processing work.
const yieldToUI = () => new Promise((resolve) => requestAnimationFrame(resolve));

const excelDateToLocalString = (date) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// Reduces an ExcelJS cell's `.value` (primitive, formula object, rich text,
// hyperlink, error, or Date) to the plain string this app's cell model stores.
const extractExcelCellValue = (cell) => {
    const v = cell.value;
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return excelDateToLocalString(v);
    if (typeof v === "object") {
        if (v.formula !== undefined) return `=${v.formula}`;
        // A formula filled down/across in Excel is saved once on its first
        // cell; the rest only point at it (`sharedFormula`). ExcelJS's
        // `cell.formula` rebuilds each one with its references shifted. If it
        // can't, keep the value Excel last calculated rather than a blank.
        if (v.sharedFormula !== undefined) {
            let formula;
            try { formula = cell.formula; } catch { formula = undefined; }
            if (formula) return `=${formula}`;
            const result = v.result;
            if (result === null || result === undefined) return "";
            if (result instanceof Date) return excelDateToLocalString(result);
            return typeof result === "object" ? String(result.error ?? "") : String(result);
        }
        if (v.richText) return v.richText.map((r) => r.text).join("");
        if (v.text !== undefined) return String(v.text);
        if (v.error) return String(v.error);
        return "";
    }
    return String(v);
};

// Reduces an ExcelJS cell's font/fill/alignment/border/numFmt into this app's
// flat per-cell style fields (see cellStyleFor / CellBorderOverlay above).
const extractExcelCellStyle = (cell) => {
    const style = {};
    const font = cell.font;
    if (font) {
        if (font.bold) style.bold = true;
        if (font.italic) style.italic = true;
        if (font.underline) style.underline = font.underline === "double" ? "double" : true;
        if (font.strike) style.strike = true;
        if (font.size) style.fontSize = Math.round(font.size);
        if (font.name) style.fontFamily = font.name;
        const color = parseExcelColor(font.color);
        if (color) style.color = color;
    }
    const fill = cell.fill;
    if (fill && fill.type === "pattern" && fill.pattern === "solid") {
        const bg = parseExcelColor(fill.fgColor);
        if (bg) style.bg = bg;
    }
    const alignment = cell.alignment;
    if (alignment) {
        if (["left", "center", "right"].includes(alignment.horizontal)) style.align = alignment.horizontal;
        if (["top", "middle", "bottom"].includes(alignment.vertical)) style.valign = alignment.vertical;
        if (alignment.wrapText) style.wrap = true;
        if (alignment.indent) style.indent = Math.min(MAX_INDENT, alignment.indent);
        if (alignment.textRotation === "vertical" || (typeof alignment.textRotation === "number" && alignment.textRotation !== 0)) {
            style.rotation = alignment.textRotation;
        }
    }
    const border = cell.border;
    if (border) {
        const b = {};
        for (const side of ["top", "bottom", "left", "right"]) {
            const mapped = border[side] && mapBorderStyle(border[side].style);
            if (mapped) b[side] = mapped;
        }
        if (Object.keys(b).length > 0) style.border = b;
    }
    const mappedFmt = mapNumberFormat(cell.numFmt);
    if (mappedFmt) {
        style.numberFormat = mappedFmt;
        style.decimalPlaces = getDecimalPlaces(cell.numFmt);
    }
    return style;
};

// Whether an imported style holds anything beyond a font name/size.
const hasOwnFormatting = (style) => {
    for (const key in style) if (key !== "fontFamily" && key !== "fontSize") return true;
    return false;
};

// --- Floating images <-> Excel pictures ---
// Excel anchors a picture to a cell plus an offset in EMUs (English Metric
// Units, 9525 per 96-dpi pixel); this app anchors media to a cell plus a
// pixel offset, so conversion is just unit scaling around the same cell.

const EMU_PER_PX = 9525;
const MEDIA_MAX_BYTES = 8 * 1024 * 1024; // sheets are stored as JSON, so embedded media rides along as base64 — keep it bounded
// Formats a browser can render in an <img>; EMF/WMF/TIFF pictures (common
// for pasted Office clip art) are skipped on import since they'd show broken.
const IMPORTABLE_IMAGE_MIME = { png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", webp: "image/webp", svg: "image/svg+xml" };

const newMediaId = () => `media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const bytesToDataUrl = (bytes, mime) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([bytes], { type: mime }));
});

// Pixel distance from the sheet's top/left edge to the start of band `index`.
const bandStartPx = (index, sizeFor) => {
    let px = 0;
    for (let i = 0; i < index; i++) px += sizeFor(i);
    return px;
};

// Inverse of bandStartPx: which band a pixel position falls in, and how far
// into it — clamped to the last band so an overhang stays anchored in-sheet.
const pxToBandAnchor = (px, sizeFor, count) => {
    let index = 0, start = 0;
    while (index < count - 1 && start + sizeFor(index) <= px) {
        start += sizeFor(index);
        index++;
    }
    return { index, offsetPx: Math.max(0, px - start) };
};

// Reads a worksheet's floating pictures into this app's media items.
// `colWidthPx`/`rowHeightPx` are the imported sheet's own sizes, used to turn
// a two-cell anchor (tl + br, no explicit size) into a pixel width/height.
const extractWorksheetImages = async (workbook, worksheet, colWidthPx, rowHeightPx) => {
    const media = [];
    let skippedUnsupported = 0, skippedTooLarge = 0, maxRow = 0, maxCol = 0;
    const srcCache = new Map(); // one picture can be placed several times

    for (const image of worksheet.getImages()) {
        const tl = image.range?.tl;
        const medium = workbook.getImage(image.imageId);
        if (!tl || !medium) continue;

        let src = srcCache.get(image.imageId);
        if (src === undefined) {
            src = null;
            const mime = IMPORTABLE_IMAGE_MIME[String(medium.extension || "").toLowerCase()];
            const byteLength = medium.buffer ? medium.buffer.length : Math.floor(((medium.base64 || "").length * 3) / 4);
            if (!mime || (!medium.buffer && !medium.base64)) skippedUnsupported++;
            else if (byteLength > MEDIA_MAX_BYTES) skippedTooLarge++;
            else if (medium.buffer) src = await bytesToDataUrl(medium.buffer, mime);
            else src = medium.base64.startsWith("data:") ? medium.base64 : `data:${mime};base64,${medium.base64}`;
            srcCache.set(image.imageId, src);
        }
        if (!src) continue;

        const offsetX = (tl.nativeColOff || 0) / EMU_PER_PX;
        const offsetY = (tl.nativeRowOff || 0) / EMU_PER_PX;
        let width, height;
        if (image.range.ext?.width && image.range.ext?.height) {
            ({ width, height } = image.range.ext);
        } else if (image.range.br) {
            const br = image.range.br;
            width = bandStartPx(br.nativeCol, colWidthPx) + (br.nativeColOff || 0) / EMU_PER_PX - bandStartPx(tl.nativeCol, colWidthPx) - offsetX;
            height = bandStartPx(br.nativeRow, rowHeightPx) + (br.nativeRowOff || 0) / EMU_PER_PX - bandStartPx(tl.nativeRow, rowHeightPx) - offsetY;
        }

        media.push({
            id: newMediaId(),
            type: "image",
            src,
            row: tl.nativeRow,
            col: tl.nativeCol,
            offsetX: Math.round(offsetX),
            offsetY: Math.round(offsetY),
            width: Math.max(MEDIA_MIN_SIZE, Math.round(width || 280)),
            height: Math.max(MEDIA_MIN_SIZE, Math.round(height || 200)),
        });
        maxRow = Math.max(maxRow, tl.nativeRow + 1);
        maxCol = Math.max(maxCol, tl.nativeCol + 1);
    }
    return { media, skippedUnsupported, skippedTooLarge, maxRow, maxCol };
};

const loadImageElement = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    // Remote URLs need CORS approval or the canvas below is tainted and
    // toDataURL throws; data: URLs are same-origin and don't need it.
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
});

const canvasPng = (img, sx, sy, sw, sh) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sw));
    canvas.height = Math.max(1, Math.round(sh));
    canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
};

// Turns an image media item into something ExcelJS can embed, matching how
// the grid draws it: Excel stretches a picture to its box, so a cropped item
// (which the grid stretches to fill the box) is cut down to its crop region
// first, and an uncropped one (drawn object-contain) is shrunk to its
// letterboxed size and shifted by (dx, dy) to where it actually shows.
// ExcelJS only embeds PNG/JPEG/GIF, so anything else is re-encoded as PNG.
// Returns null for items that can't be exported (video, a remote image
// without CORS, a broken src).
const prepareImageForExport = async (item) => {
    // A shape goes out as a picture of itself at its current size.
    if (item.type === "shape") {
        const width = item.width || SHAPE_DEFAULT_SIZE, height = item.height || SHAPE_DEFAULT_SIZE;
        return prepareImageForExport({ ...item, type: "image", crop: undefined, width, height, src: shapeDataUrl(item, width, height) });
    }
    if (item.type !== "image" || !item.src) return null;
    try {
        const img = await loadImageElement(item.src);
        const boxW = item.width || 280;
        const boxH = item.height || 200;
        const naturalW = img.naturalWidth || boxW;
        const naturalH = img.naturalHeight || boxH;
        const crop = item.crop;

        if (crop && (crop.x !== 0 || crop.y !== 0 || crop.w !== 1 || crop.h !== 1)) {
            const base64 = canvasPng(img, crop.x * naturalW, crop.y * naturalH, crop.w * naturalW, crop.h * naturalH);
            return { base64, extension: "png", width: boxW, height: boxH, dx: 0, dy: 0 };
        }

        const scale = Math.min(boxW / naturalW, boxH / naturalH);
        const width = naturalW * scale, height = naturalH * scale;
        const directFormat = /^data:image\/(png|jpe?g|gif);base64,/i.exec(item.src);
        const base64 = directFormat ? item.src : canvasPng(img, 0, 0, naturalW, naturalH);
        const extension = directFormat ? directFormat[1].toLowerCase().replace("jpg", "jpeg") : "png";
        return { base64, extension, width, height, dx: (boxW - width) / 2, dy: (boxH - height) / 2 };
    } catch {
        return null;
    }
};

const ExcelClone = forwardRef(function ExcelClone({ sectionId, meetingId, readOnly = false, onDataChange }, ref) {
    const { data: sectionSheetData, isLoading: isSectionLoading } = useGetDailyMeetingSheetQuery(sectionId, { skip: !sectionId || !!meetingId });
    const { data: meetingSheetData, isLoading: isMeetingLoading, refetch: refetchMeeting } = useGetDailyMorningMeetingDetailQuery(meetingId, { skip: !meetingId });
    const [saveSectionSheet, { isLoading: isSavingSection }] = useSaveDailyMeetingSheetMutation();
    const [saveMeetingSheet, { isLoading: isSavingMeetingFull }] = useSaveDailyMorningMeetingSheetMutation();
    const [saveMeetingSheetPatch, { isLoading: isSavingMeetingPatch }] = useSaveDailyMorningMeetingSheetPatchMutation();
    const isSavingMeeting = isSavingMeetingFull || isSavingMeetingPatch;

    const sheetData = meetingId ? meetingSheetData : sectionSheetData;
    const isLoading = meetingId ? isMeetingLoading : isSectionLoading;
    const isSaving = meetingId ? isSavingMeeting : isSavingSection;

    const [sheets, setSheetsState] = useState({ [DEFAULT_SHEET_NAME]: emptySheet() });
    const [activeSheetName, setActiveSheetName] = useState(DEFAULT_SHEET_NAME);
    const [isDirty, setIsDirty] = useState(false);
    const loadedRef = useRef(false);
    const prevIdsRef = useRef({ sectionId, meetingId });
    // What the server offers for the meeting that is loaded (see the load effect).
    const [sheetFeatures, setSheetFeatures] = useState({ liveSync: false, autosave: false });
    const [reloadNonce, setReloadNonce] = useState(0); // bumped to load the workbook again

    const [activeCell, setActiveCell] = useState("A1");
    // `selection` is the active range (fill handle, paste target, bounds-based
    // commands). `extraRanges` holds the earlier ranges of a Ctrl+click
    // multi-selection. Plain setSelection() drops them, so every existing
    // caller keeps its single-range behavior; only the Ctrl/Shift paths use
    // setSelectionRaw to move the active range while keeping the others.
    const [selection, setSelectionRaw] = useState({ start: "A1", end: "A1" });
    const [extraRanges, setExtraRanges] = useState([]);
    const setSelection = useCallback((value) => {
        setExtraRanges((prev) => (prev.length ? [] : prev));
        setSelectionRaw(value);
    }, []);
    const [selectedMediaId, setSelectedMediaId] = useState(null);
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState("");
    const [hoveredCell, setHoveredCell] = useState(null);
    const [gridlinesVisible, setGridlinesVisible] = useState(true);
    const [isFormulaBarExpanded, setIsFormulaBarExpanded] = useState(false);
    const [isToolbarExpanded, setIsToolbarExpanded] = useState(true);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [coordInputValue, setCoordInputValue] = useState("A1");

    const [fillPreview, setFillPreview] = useState(null); // { axis: 'vertical'|'horizontal', extraCount }
    const [renamingSheet, setRenamingSheet] = useState(null);
    const [renameValue, setRenameValue] = useState("");

    const [showFindReplace, setShowFindReplace] = useState(false);
    const [findText, setFindText] = useState("");
    const [replaceText, setReplaceText] = useState("");
    const [matchIndex, setMatchIndex] = useState(0);

    const [clipboard, setClipboard] = useState(null); // { cellsByRelPos, height, width, type, sourceBounds }
    const [formatPainterStyle, setFormatPainterStyle] = useState(null);
    const [borderWeight, setBorderWeight] = useState("thin");
    const [condOperator, setCondOperator] = useState(">");
    const [condThreshold, setCondThreshold] = useState("");
    const [condColor, setCondColor] = useState("#fef08a");

    const [selectedTableStyleKey, setSelectedTableStyleKey] = useState(TABLE_STYLE_PRESETS[0].key);
    const [tableFiltersEnabled, setTableFiltersEnabled] = useState(true);
    const [filterPopover, setFilterPopover] = useState(null); // { tableId, colIdx }
    const [filterDraft, setFilterDraft] = useState(null); // { search, selected: Set<string>, allValues: string[] }

    const [resizePreview, setResizePreview] = useState(null); // { type: 'col'|'row', index, size }

    const [createPivotDialogOpen, setCreatePivotDialogOpen] = useState(false);
    const [pivotPanelOpen, setPivotPanelOpen] = useState(true);

    // Keyboard-driven dialogs & view toggles.
    const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
    const [goToOpen, setGoToOpen] = useState(false);
    const [pasteSpecialOpen, setPasteSpecialOpen] = useState(false);
    const [formatCellsOpen, setFormatCellsOpen] = useState(false);
    const [formatCellsTab, setFormatCellsTab] = useState(null);
    const [ribbonTab, setRibbonTab] = useState("home"); // "home" | "insert"
    // Last colours picked, applied by the split buttons' faces (Excel starts with yellow fill / red font).
    const [lastFillColor, setLastFillColor] = useState("#FFFF00");
    const [lastFontColor, setLastFontColor] = useState("#FF0000");
    const [insertDeleteMode, setInsertDeleteMode] = useState(null); // "insert" | "delete" | null
    const [unhideSheetOpen, setUnhideSheetOpen] = useState(false);
    const [showFormulas, setShowFormulas] = useState(false); // Ctrl+`
    const [recalcSeed, setRecalcSeed] = useState(0); // F9 bumps this to re-roll RAND and refresh NOW/TODAY
    const [findOptions, setFindOptions] = useState({ matchCase: false, entireCell: false, allSheets: false });
    const findInputRef = useRef(null);
    const replaceInputRef = useRef(null);
    // Alt-key "key tip" sequences (Alt+H, W …): the letters typed so far and
    // when the sequence started, so a stale half-typed sequence expires.
    const keyTipRef = useRef(null); // { keys: string, at: number } | null

    // Grid zoom, applied via CSS `zoom` directly on gridContainerRef (the
    // scroll container itself, not a child wrapper). Because the scaled
    // element and the scrollable element are one and the same, its own
    // scrollTop/scrollLeft/clientHeight/clientWidth stay in the same authored,
    // unzoomed coordinate space as rowOffsets/colOffsets/cell sizes — no
    // conversion needed there. The only places that still need to know about
    // `zoom` explicitly are ones converting real screen pixels (mouse-drag
    // deltas for resize/media gestures) into that authored space.
    const [zoom, setZoom] = useState(1.0); // 1.0 = 100%
    const handleZoomIn = useCallback(() => {
        setZoom((prev) => Math.min(4.0, Math.round((prev + 0.1) * 10) / 10));
    }, []);
    const handleZoomOut = useCallback(() => {
        setZoom((prev) => Math.max(0.1, Math.round((prev - 0.1) * 10) / 10));
    }, []);

    // Row virtualization: only rows within [scrollTop, scrollTop+viewportHeight]
    // (plus a buffer) are rendered, so a 5000+-row sheet doesn't put 5000+ <tr>s
    // in the DOM. Tracked as state (not read straight off the DOM at render time)
    // so scrolling/resizing the container actually triggers a re-render.
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [viewportWidth, setViewportWidth] = useState(0);
    const lastScrolledCellRef = useRef(null); // last activeCell we auto-scrolled into view, so a resize-triggered rowOffsets/colOffsets change doesn't re-trigger a scroll jump

    // Import/export progress dialog. { title, label, current, total } | null —
    // total === 0 means an indeterminate phase (spinner only), since ExcelJS
    // doesn't expose progress callbacks for its own parse/write step.
    const [ioProgress, setIoProgress] = useState(null);

    const [imagePopoverOpen, setImagePopoverOpen] = useState(false);
    const [videoPopoverOpen, setVideoPopoverOpen] = useState(false);
    const [shapesPopoverOpen, setShapesPopoverOpen] = useState(false);
    const [imageUrlDraft, setImageUrlDraft] = useState("");
    const [videoUrlDraft, setVideoUrlDraft] = useState("");
    const mediaImageInputRef = useRef(null);
    const mediaVideoInputRef = useRef(null);

    const isSelecting = useRef(false);
    const isSelectingRowHeader = useRef(false);
    const isSelectingColHeader = useRef(false);
    const headerSelectAnchor = useRef(null);
    const isFilling = useRef(false);
    const fileInputRef = useRef(null);
    const fillSourceRange = useRef(null);
    const resizeRef = useRef(null); // { type, index, startPos, startSize, currentSize }
    const gridContainerRef = useRef(null);
    const rootRef = useRef(null);

    // Formula "point mode" — clicking/dragging cells while typing a formula
    // inserts their reference instead of committing the edit and navigating away.
    const cellEditInputRef = useRef(null);
    const formulaBarInputRef = useRef(null);
    const activeEditInputRef = useRef(null); // whichever of the two above last had focus
    const cursorPosRef = useRef({ start: 0, end: 0 });
    const isPointingFormula = useRef(false);
    const pointModeAnchor = useRef(null); // cellId the point-mode drag started from
    const formulaInsertRange = useRef(null); // { start, end } in editValue currently occupied by the last-inserted reference
    const editSessionRef = useRef(null); // cell id of the edit in progress; cleared the moment it's committed or cancelled
    const editOriginRef = useRef("cell"); // where the current edit started: "cell" or the formula "bar"

    const historyPast = useRef([]);
    const historyFuture = useRef([]);
    const [, setHistoryTick] = useState(0);
    const bumpHistory = useCallback(() => setHistoryTick((t) => t + 1), []);

    // Latest values for the debounced chart save below, which fires from a
    // timer (or on unmount) and so can't rely on a render's closure.
    // The one way `sheets` is ever changed, so sheetsRef always holds the latest
    // workbook synchronously. Updates are computed from it on the spot instead
    // of in a state-updater callback: that lets each update return its own undo
    // record, and lets two updates in the same tick build on one another.
    const sheetsRef = useRef(sheets);
    const setSheets = useCallback((next) => {
        sheetsRef.current = next;
        setSheetsState(next);
    }, []);
    const saveFnsRef = useRef({ saveSectionSheet, saveMeetingSheet, saveMeetingSheetPatch });
    saveFnsRef.current = { saveSectionSheet, saveMeetingSheet, saveMeetingSheetPatch };
    const chartSaveRef = useRef(null); // { timer, meetingId, sectionId, activeSheet } | null
    const broadcastNowRef = useRef(false); // next onDataChange skips the debounce (chart edits)

    // Saves the workbook for a queued chart change right away. The target ids
    // are the ones captured when the change was queued, so a flush triggered
    // by switching meetings still writes to the meeting the chart belongs to.
    // A meeting's sheet carries a server-side `version` that every save bumps;
    // sending the one this grid loaded lets the server reject a save that would
    // overwrite another tab's/user's newer copy (409). Saves run one at a time
    // so a queued chart save and a manual Save can't race each other and trip
    // that check against their own previous write.
    //
    // When the server offers it, a meeting save sends a patch — just the cells and
    // sheet settings that differ from the workbook the server holds — instead of
    // the whole workbook. That workbook is tracked per meeting next to its version:
    // set when the sheet loads, moved forward by each successful save. Anything a
    // patch can't express (sheets added/removed/renamed, a bulk rewrite) and any
    // patch the server won't take is saved in full, exactly as before.
    const meetingVersionsRef = useRef({}); // meetingId -> last version seen from the server
    // With live co-editing on (see useSheetLiveSync.js), other people's saves arrive
    // while this grid is open and move that tracked workbook and version forward too.
    // They go through the same queue as the saves here, so the two never interleave.
    // And a save that finds someone else got in first is no longer simply refused: what
    // they saved is fetched and taken in, the workbook being saved is carried over it
    // (keeping this user's changes), and the save is sent again.
    const savedWorkbooksRef = useRef({}); // meetingId -> { sheets, patchSave, liveSync }: the workbook at that version
    const saveQueueRef = useRef(Promise.resolve());
    const clientIdRef = useRef(null); // names this grid in its saves; see useSheetLiveSync.js
    if (!clientIdRef.current) clientIdRef.current = newClientId();
    const catchUpRef = useRef(null); // set below, once the live-sync hook has run
    const enqueueSaveTask = useCallback((task) => {
        const result = saveQueueRef.current.then(task, task);
        saveQueueRef.current = result.catch(() => {});
        return result;
    }, []);
    const saveWorkbook = useCallback(({ meetingId: targetMeetingId, sectionId: targetSectionId, sheets, activeSheet }) => {
        const run = async () => {
            let snapshot = sheets;
            if (!targetMeetingId) {
                return saveFnsRef.current.saveSectionSheet({ sectionId: targetSectionId, sheets: snapshot, activeSheet }).unwrap();
            }
            const clientId = clientIdRef.current;

            let res = null;
            for (let attempt = 0; ; attempt++) {
                const version = meetingVersionsRef.current[targetMeetingId];
                const saved = savedWorkbooksRef.current[targetMeetingId];
                try {
                    res = null;
                    if (saved?.patchSave && version != null) {
                        let patch = diffWorkbook(saved.sheets, snapshot, { activeSheet });
                        // e.g. an embedded image: that's a full save's worth of bytes anyway.
                        if (patch && JSON.stringify(patch).length > MAX_PATCH_CHARS) patch = null;
                        if (patch) {
                            try {
                                res = await saveFnsRef.current.saveMeetingSheetPatch({
                                    meetingId: targetMeetingId, patch, version, sheets: snapshot, activeSheet, clientId
                                }).unwrap();
                            } catch (err) {
                                // Rejected as a patch (not as a save): send the whole workbook.
                                // A version conflict or a network failure is a real failure.
                                if (![400, 404, 413].includes(err?.status)) throw err;
                            }
                        }
                    }
                    if (!res) {
                        res = await saveFnsRef.current.saveMeetingSheet({
                            meetingId: targetMeetingId, sheets: snapshot, activeSheet, version, clientId
                        }).unwrap();
                    }
                    break;
                } catch (err) {
                    // 409: someone else saved first. Take in what they saved and try
                    // again on top of it — unless that isn't possible (live co-editing
                    // is off, or they replaced the whole workbook), which is a failure
                    // the user has to resolve by reloading, as it always was.
                    if (err?.status !== 409 || !saved?.liveSync || !catchUpRef.current || attempt >= MAX_SAVE_RETRIES) throw err;
                    let missed = null;
                    try {
                        missed = await catchUpRef.current(targetMeetingId);
                    } catch {
                        throw err;
                    }
                    if (!missed) throw err;
                    snapshot = rebaseSnapshot(snapshot, saved.sheets, missed);
                }
            }
            if (res?.data?.version != null) meetingVersionsRef.current[targetMeetingId] = res.data.version;
            const tracked = savedWorkbooksRef.current[targetMeetingId];
            if (tracked) savedWorkbooksRef.current[targetMeetingId] = { ...tracked, sheets: snapshot };
            return res;
        };
        return enqueueSaveTask(run);
    }, [enqueueSaveTask]);
    // Whether everything in `snapshot` (a workbook that was just saved) is all there is
    // to save: nothing was edited meanwhile. With live co-editing the workbook on
    // screen can have moved on without any new edit — by taking in other people's
    // saves — so for a meeting this compares against what the server now holds.
    const nothingLeftToSave = useCallback((snapshot, targetMeetingId) => (
        sheetsRef.current === snapshot
        || (!!targetMeetingId && isWorkbookSaved(savedWorkbooksRef.current[targetMeetingId]?.sheets, sheetsRef.current))
    ), []);
    const saveErrorMessage = (err, fallback) => (err?.status === 409 && err.message ? err.message : fallback);

    const flushChartSave = useCallback(async () => {
        const pending = chartSaveRef.current;
        if (!pending) return;
        clearTimeout(pending.timer);
        chartSaveRef.current = null;
        const snapshot = sheetsRef.current;
        try {
            await saveWorkbook({ meetingId: pending.meetingId, sectionId: pending.sectionId, sheets: snapshot, activeSheet: pending.activeSheet });
            // Edits made while the request was in flight are still unsaved.
            if (nothingLeftToSave(snapshot, pending.meetingId)) setIsDirty(false);
        } catch (err) {
            toast.error(saveErrorMessage(err, "Failed to save chart settings."));
        }
    }, [saveWorkbook, nothingLeftToSave]);

    // Don't drop a queued chart save when the grid unmounts mid-debounce.
    useEffect(() => () => { flushChartSave(); }, [flushChartSave]);

    useEffect(() => {
        if (sheetData?.data && !loadedRef.current) {
            const loadedSheets = sheetData.data.sheets && Object.keys(sheetData.data.sheets).length > 0
                ? sheetData.data.sheets
                : { [DEFAULT_SHEET_NAME]: emptySheet() };
            // Older saved sheets predate the `media` field — backfill it so
            // `.map`/`.push` on sheet.media never has to null-check callers.
            const sanitizedSheets = Object.fromEntries(
                Object.entries(loadedSheets).map(([name, sheet]) => [name, { ...sheet, media: sheet.media || [] }])
            );
            setSheets(sanitizedSheets);
            setActiveSheetName(sheetData.data.activeSheet && sanitizedSheets[sheetData.data.activeSheet] ? sheetData.data.activeSheet : Object.keys(sanitizedSheets)[0]);
            // Taken only at load: a later background refetch must not move the
            // version forward while the grid still holds the older sheets.
            if (meetingId && sheetData.data.version != null) meetingVersionsRef.current[meetingId] = sheetData.data.version;
            // Likewise the workbook patches are diffed against: what the server holds at that version.
            const capabilities = (meetingId && sheetData.data.capabilities) || {};
            const patchSave = !!capabilities.patchSave;
            // Both of these build on patch saves: without them every save is the whole workbook.
            const liveSync = patchSave && !!capabilities.liveSync;
            const autosave = patchSave && !!capabilities.autosave;
            if (meetingId) savedWorkbooksRef.current[meetingId] = { sheets: sanitizedSheets, patchSave, liveSync };
            setSheetFeatures({ liveSync, autosave });
            loadedRef.current = true;
            historyPast.current = [];
            historyFuture.current = [];
            bumpHistory();
        }
    }, [sheetData, bumpHistory, meetingId, setSheets, reloadNonce]);

    // Reset load-guard and local state only when switching to a DIFFERENT
    // section's sheet/meeting on an already-mounted instance. Without the
    // prevIdsRef guard this fired unconditionally on mount too — and since
    // RTK Query can already have this meeting's data cached (no network
    // round trip), the load effect above and this one could both fire in the
    // same commit, with this one running second and wiping out what was just
    // loaded, so a saved sheet appeared blank the next time it was opened.
    useEffect(() => {
        const prev = prevIdsRef.current;
        if (prev.sectionId !== sectionId || prev.meetingId !== meetingId) {
            flushChartSave();
            loadedRef.current = false;
            setSheetFeatures({ liveSync: false, autosave: false });
            setIsDirty(false);
            setActiveCell("A1");
            setSelection({ start: "A1", end: "A1" });
            setEditingCell(null);
            setClipboard(null);
            setFormatPainterStyle(null);
            setSheets({ [DEFAULT_SHEET_NAME]: emptySheet() });
            setActiveSheetName(DEFAULT_SHEET_NAME);
            historyPast.current = [];
            historyFuture.current = [];
            bumpHistory();
            prevIdsRef.current = { sectionId, meetingId };
        }
    }, [sectionId, meetingId, bumpHistory, flushChartSave, setSheets]);

    // --- Live co-editing ---

    // Someone replaced the whole workbook (or too much was missed to catch up on): it
    // has to be loaded again. Done at once when nothing here is unsaved; otherwise the
    // user decides, since reloading drops their unsaved edits.
    const handleReloadNeeded = useCallback(({ userName } = {}) => {
        const targetMeetingId = meetingId;
        if (!targetMeetingId) return;
        const reload = async () => {
            try {
                await refetchMeeting();
            } catch {
                return;
            }
            if (prevIdsRef.current.meetingId !== targetMeetingId) return; // moved on meanwhile
            loadedRef.current = false;
            setIsDirty(false);
            setReloadNonce((n) => n + 1);
        };
        if (isWorkbookSaved(savedWorkbooksRef.current[targetMeetingId]?.sheets, sheetsRef.current)) {
            reload();
            return;
        }
        toast.warning(`${userName || "Someone"} saved changes that replaced this whole spreadsheet.`, {
            id: `sheet-reload-${targetMeetingId}`,
            description: "Reload to get them. Your unsaved edits here will be lost.",
            duration: Infinity,
            action: { label: "Reload", onClick: reload },
        });
    }, [meetingId, refetchMeeting]);

    const livePosition = useMemo(
        () => ({ sheet: activeSheetName, cell: activeCell, start: selection.start, end: selection.end }),
        [activeSheetName, activeCell, selection]
    );
    const { peers: livePeers, catchUpNow } = useSheetLiveSync({
        enabled: !!meetingId && sheetFeatures.liveSync,
        meetingId,
        clientId: clientIdRef.current,
        meetingVersionsRef, savedWorkbooksRef, sheetsRef, setSheets,
        enqueue: enqueueSaveTask,
        onReloadNeeded: handleReloadNeeded,
        position: livePosition,
    });
    catchUpRef.current = catchUpNow;

    // --- Autosave ---

    // Saves a few seconds after the last edit, when the server offers it. Only edits
    // that go as a small patch are saved this way; one that needs the whole workbook
    // sent (a sheet added or renamed, a very large paste) waits for the Save button.
    const autosaveFailedRef = useRef(false);
    useEffect(() => {
        if (readOnly || !meetingId || !sheetFeatures.autosave || !isDirty) return undefined;
        const timer = setTimeout(async () => {
            const snapshot = sheetsRef.current;
            const saved = savedWorkbooksRef.current[meetingId];
            if (!saved) return;
            const pending = diffWorkbook(saved.sheets, snapshot);
            if (!pending) return;
            if (Object.keys(pending.sheets).length === 0) {
                setIsDirty(false);
                return;
            }
            if (JSON.stringify(pending).length > MAX_PATCH_CHARS) return;
            try {
                await saveWorkbook({ meetingId, sectionId, sheets: snapshot, activeSheet: activeSheetName });
                autosaveFailedRef.current = false;
                if (nothingLeftToSave(snapshot, meetingId)) setIsDirty(false);
            } catch (err) {
                // Said once, not after every edit; the next edit tries again quietly.
                if (!autosaveFailedRef.current) {
                    toast.error(saveErrorMessage(err, "Autosave failed. Your changes are still here — use Save to try again."));
                }
                autosaveFailedRef.current = true;
            }
        }, AUTOSAVE_DELAY_MS);
        return () => clearTimeout(timer);
    }, [readOnly, meetingId, sectionId, sheetFeatures.autosave, isDirty, sheets, activeSheetName, saveWorkbook, nothingLeftToSave]);

    // Undo/redo restore `sheets` but not `activeSheetName`, so undoing an
    // import, rename, or new sheet can leave the active name pointing at a
    // sheet that no longer exists — fall back to the first tab instead of
    // rendering a blank, unsaveable placeholder grid.
    useEffect(() => {
        if (!sheets[activeSheetName]) {
            const firstSheetName = Object.keys(sheets)[0];
            if (firstSheetName) setActiveSheetName(firstSheetName);
        }
    }, [sheets, activeSheetName]);

    const activeSheet = sheets[activeSheetName] || emptySheet();
    const cells = activeSheet.cells;
    const rowCount = activeSheet.rowCount;
    const columnCount = activeSheet.columnCount;
    const conditionalRules = activeSheet.conditionalRules || [];
    const merges = activeSheet.merges || [];
    const columnWidths = activeSheet.columnWidths || {};
    const rowHeights = activeSheet.rowHeights || {};
    const tables = activeSheet.tables || [];
    const media = activeSheet.media || [];
    const hiddenRows = activeSheet.hiddenRows || EMPTY_LIST; // manually hidden (Ctrl+9), unlike filter-hidden rows
    const hiddenCols = activeSheet.hiddenCols || EMPTY_LIST;
    const pivotConfig = activeSheet.pivotConfig || null;
    // Pivot sheets are fully computed from their source — direct cell edits,
    // ribbon formatting, merges, sorting, and structural row/col changes are
    // all disabled on them, matching Excel's own pivot table protection.
    const isSheetReadOnly = readOnly || !!pivotConfig;

    const columns = useMemo(() => Array.from({ length: columnCount }, (_, i) => indexToCol(i)), [columnCount]);
    const rows = useMemo(() => Array.from({ length: rowCount }, (_, i) => i), [rowCount]);
    // One evaluation feeds both the formatted grid text and the raw values
    // (status-bar totals, Paste Values). `recalcSeed` changes only on F9.
    const evaluation = useMemo(() => evaluateSheet(cells, { seed: recalcSeed }), [cells, recalcSeed]);
    const displayGrid = evaluation.display;
    const rawGrid = evaluation.raw;
    const hiddenColSet = useMemo(() => new Set(hiddenCols), [hiddenCols]);
    const manualHiddenRowSet = useMemo(() => new Set(hiddenRows), [hiddenRows]);

    // Broadcasts the live sheet + evaluated values to the parent (e.g. ExcelGraph),
    // so a chart above the grid can re-render as the user types.
    // `selection` rides along too, so the chart's "Use Selection" action can read
    // whatever range the user currently has drag-selected in the grid.
    // Debounced: a drag-select or held arrow key changes the selection many
    // times a second, and each broadcast re-renders the parent and its charts.
    // Chart edits skip the debounce — ExcelGraph builds its next chart list
    // from this snapshot, so it must not lag behind the change it just made.
    useEffect(() => {
        if (!onDataChange) return;
        // `selection` stays the active range for existing consumers; `ranges`
        // lists every range of a Ctrl+click multi-selection (active one last).
        const snapshot = { sheets, activeSheetName, displayGrid, rowCount, columnCount, selection, ranges: [...extraRanges, selection], activeCell };
        if (broadcastNowRef.current) {
            broadcastNowRef.current = false;
            onDataChange(snapshot);
            return;
        }
        const timer = setTimeout(() => onDataChange(snapshot), DATA_BROADCAST_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [sheets, activeSheetName, displayGrid, rowCount, columnCount, selection, extraRanges, activeCell, onDataChange]);

    // The selection is kept as rectangles only — never expanded into a list of
    // cell ids, which for a whole column or Ctrl+A on a large sheet would be
    // hundreds of thousands of strings rebuilt on every drag tick.
    const selectionBounds = useMemo(() => rangeBounds(selection), [selection]);
    const extraBounds = useMemo(() => extraRanges.map(rangeBounds).filter(Boolean), [extraRanges]);
    const allSelectionBounds = useMemo(() => (selectionBounds ? [...extraBounds, selectionBounds] : extraBounds), [extraBounds, selectionBounds]);
    const hasMultipleRanges = extraRanges.length > 0;
    const isCellSelected = (row, col) => {
        for (const b of allSelectionBounds) {
            if (row >= b.minRow && row <= b.maxRow && col >= b.minCol && col <= b.maxCol) return true;
        }
        return false;
    };

    // Maps every cell id covered by a merge (anchor included) to that merge,
    // so rendering can skip non-anchor cells and navigation can redirect off
    // of them (there's no <td> there any more to land on).
    const mergeMap = useMemo(() => {
        const map = {};
        for (const m of merges) {
            for (const id of expandRange(m.start, m.end)) map[id] = m;
        }
        return map;
    }, [merges]);

    const resolveToAnchor = useCallback((cellId) => {
        const merge = mergeMap[cellId];
        return merge ? merge.start : cellId;
    }, [mergeMap]);

    // Field list for the PivotTable panel — recomputed whenever the source
    // sheet's data or the pivot's own source range changes.
    const pivotSourceFields = useMemo(() => {
        if (!pivotConfig) return [];
        return getPivotSourceFields(sheets, pivotConfig.sourceSheet, pivotConfig.sourceRange, buildRawValueGrid);
    }, [pivotConfig, sheets]);

    // Re-show the fields panel whenever the user navigates onto a (different)
    // pivot sheet, even if they'd previously closed it on another one.
    useEffect(() => { if (pivotConfig) setPivotPanelOpen(true); }, [activeSheetName]); // eslint-disable-line react-hooks/exhaustive-deps

    // A media selection is scoped to the sheet it was made on — deselect when
    // switching away so a stray Delete press can't reach into another sheet.
    useEffect(() => { setSelectedMediaId(null); }, [activeSheetName]);

    // Excel-style AutoFilter: a row is hidden if it sits in some table's data
    // range and fails at least one of that table's active column filters. Row
    // numbers aren't renumbered — the row is simply skipped when rendering,
    // same as Excel's filtered view.
    const hiddenRowSet = useMemo(() => {
        const hidden = new Set(hiddenRows);
        for (const table of tables) {
            if (!table.filtersEnabled || !table.filters) continue;
            const activeFilters = Object.entries(table.filters).filter(([, vals]) => Array.isArray(vals));
            if (activeFilters.length === 0) continue;
            const s = parseCellRef(table.range.start), e = parseCellRef(table.range.end);
            if (!s || !e) continue;
            const minRow = Math.min(s.row, e.row), maxRow = Math.max(s.row, e.row);
            for (let r = minRow + 1; r <= maxRow; r++) {
                const isVisible = activeFilters.every(([colIdxStr, allowed]) => {
                    const val = String(displayGrid[getCellId(r, Number(colIdxStr))] ?? "");
                    return allowed.includes(val);
                });
                if (!isVisible) hidden.add(r);
            }
        }
        return hidden;
    }, [tables, displayGrid, hiddenRows]);

    const isEditingFormula = !!editingCell && editValue.trim().startsWith("=");

    // Maps every cell covered by a reference in the formula currently being
    // edited to that reference's color + which perimeter edges it sits on —
    // Excel's "range finder" highlighting, kept in sync with tokenizeFormulaForDisplay
    // so the grid border and the colored formula text always agree.
    const formulaRefBorderMap = useMemo(() => {
        const map = {};
        if (!isEditingFormula) return map;
        const { refColorMap } = tokenizeFormulaForDisplay(editValue);
        for (const [key, color] of Object.entries(refColorMap)) {
            const [startRef, endRef] = key.includes(":") ? key.split(":") : [key, key];
            const s = parseCellRef(startRef), e = parseCellRef(endRef);
            if (!s || !e) continue;
            const minRow = Math.min(s.row, e.row), maxRow = Math.max(s.row, e.row);
            const minCol = Math.min(s.col, e.col), maxCol = Math.max(s.col, e.col);
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    map[getCellId(r, c)] = { color, top: r === minRow, bottom: r === maxRow, left: c === minCol, right: c === maxCol };
                }
            }
        }
        return map;
    }, [isEditingFormula, editValue]);

    // Live conditional-formatting overlay: re-evaluated from the current display
    // values every render, so edits to referenced cells update highlighting
    // immediately instead of baking in a one-time static color.
    const conditionalBgMap = useMemo(() => {
        const map = {};
        for (const rule of conditionalRules) {
            for (const cellId of expandRange(rule.range[0], rule.range[1])) {
                const raw = displayGrid[cellId];
                const num = parseFloat(String(raw ?? "").replace(/[$,%]/g, ""));
                if (isNaN(num)) continue;
                const match = rule.operator === ">" ? num > rule.threshold
                    : rule.operator === "<" ? num < rule.threshold
                    : rule.operator === ">=" ? num >= rule.threshold
                    : rule.operator === "<=" ? num <= rule.threshold
                    : num === rule.threshold;
                if (match) map[cellId] = rule.color;
            }
        }
        return map;
    }, [conditionalRules, displayGrid]);

    // The updater mutates a draft of the workbook; only what it actually touches
    // is copied, and everything else is shared with the previous state — see
    // workbookUpdate.js. An updater must make every change through the draft
    // it is given, and must replace a cell (`cells[id] = {...}`) instead of
    // editing one in place. The undo stack holds change records, not copies of
    // the workbook.
    const updateSheets = useCallback((updater) => {
        // Every commit — a source-sheet edit, a pivot config change, an
        // import, a sheet rename — can affect a pivot sheet's output, so
        // recompute all of them rather than trying to track which commits
        // actually matter. Skipped outright when the workbook has none.
        const recomputePivots = (workbook) => {
            if (!Object.values(workbook).some((sheet) => sheet?.pivotConfig)) return workbook;
            const withPivots = { ...workbook };
            recomputePivotSheets(withPivots, buildRawValueGrid);
            return withPivots;
        };
        const { next, undo: record } = applyWorkbookUpdate(sheetsRef.current, updater, recomputePivots);
        if (!record) return; // the updater changed nothing

        historyPast.current.push(record);
        if (historyPast.current.length > HISTORY_LIMIT) historyPast.current.shift();
        historyFuture.current = [];
        bumpHistory();
        setSheets(next);
        setIsDirty(true);
    }, [bumpHistory, setSheets]);

    const mutateActiveCells = useCallback((mutator) => {
        if (isSheetReadOnly) return;
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            if (!sheet) return;
            mutator(sheet.cells);
        });
    }, [updateSheets, activeSheetName, isSheetReadOnly]);

    // --- PivotTable creation & field configuration ---

    const openCreatePivotDialog = () => {
        if (isSheetReadOnly) return;
        if (!selectionBounds || selectionBounds.maxRow - selectionBounds.minRow < 1 || selectionBounds.maxCol - selectionBounds.minCol < 1) {
            toast.error("Select a range of at least 2 rows and 2 columns to create a PivotTable.");
            return;
        }
        setCreatePivotDialogOpen(true);
    };

    const createPivotTable = (sourceSheet, sourceRange) => {
        const [startRef, endRef] = (sourceRange || "").includes(":") ? sourceRange.split(":") : [sourceRange, sourceRange];
        const rangeValid = !!(parseCellRef((startRef || "").trim().toUpperCase()) && parseCellRef((endRef || "").trim().toUpperCase()));
        if (!sourceSheet || !sheets[sourceSheet] || !rangeValid) {
            toast.error("Enter a valid source sheet and range, e.g. A1:D15.");
            return;
        }
        let n = 1;
        let name = `Pivot Table ${n}`;
        while (sheets[name]) { n += 1; name = `Pivot Table ${n}`; }
        updateSheets((next) => {
            next[name] = { ...emptySheet(), pivotConfig: { sourceSheet, sourceRange: sourceRange.trim().toUpperCase(), rows: [], cols: [], values: [] } };
        });
        setActiveSheetName(name);
        setCreatePivotDialogOpen(false);
        toast.success(`Created "${name}" — check fields in the panel to build it out.`);
    };

    const updatePivotConfig = useCallback((patch) => {
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            if (!sheet?.pivotConfig) return;
            const resolved = typeof patch === "function" ? patch(sheet.pivotConfig) : patch;
            sheet.pivotConfig = { ...sheet.pivotConfig, ...resolved };
        });
    }, [updateSheets, activeSheetName]);

    const togglePivotZone = useCallback((field, zone, isNumeric) => {
        updatePivotConfig((cfg) => {
            if (zone === "values") {
                const exists = cfg.values.some((v) => v.field === field);
                return { values: exists ? cfg.values.filter((v) => v.field !== field) : [...cfg.values, { field, agg: isNumeric ? "sum" : "count" }] };
            }
            const list = cfg[zone] || [];
            const exists = list.includes(field);
            return { [zone]: exists ? list.filter((f) => f !== field) : [...list, field] };
        });
    }, [updatePivotConfig]);

    const changePivotAgg = useCallback((field, agg) => {
        updatePivotConfig((cfg) => ({ values: cfg.values.map((v) => (v.field === field ? { ...v, agg } : v)) }));
    }, [updatePivotConfig]);

    // --- Column/row resize (drag handles on the headers) ---

    // Hidden rows/columns (manual or filtered) take no space, so the cumulative
    // offsets below — and everything positioned from them — skip over them.
    const widthForCol = useCallback((colIdx) => {
        if (hiddenColSet.has(colIdx)) return 0;
        return resizePreview?.type === "col" && resizePreview.index === colIdx ? resizePreview.size : (columnWidths[colIdx] || DEFAULT_COLUMN_WIDTH);
    }, [resizePreview, columnWidths, hiddenColSet]);

    const heightForRow = useCallback((rowIdx) => {
        if (hiddenRowSet.has(rowIdx)) return 0;
        return resizePreview?.type === "row" && resizePreview.index === rowIdx ? resizePreview.size : (rowHeights[rowIdx] || DEFAULT_ROW_HEIGHT);
    }, [resizePreview, rowHeights, hiddenRowSet]);

    // Cumulative pixel offsets per column/row (including the fixed header
    // width/height), used to place floating media at its anchor cell and to
    // re-derive that anchor after a drag. Recomputed whenever a column/row
    // resize (even a live in-progress one) changes widthForCol/heightForRow,
    // so media tracks resizes the same frame the grid does.
    const colOffsets = useMemo(() => {
        const offsets = [ROW_HEADER_WIDTH];
        for (let i = 0; i < columnCount; i++) offsets.push(offsets[offsets.length - 1] + widthForCol(i));
        return offsets;
    }, [columnCount, widthForCol]);

    const rowOffsets = useMemo(() => {
        const offsets = [HEADER_ROW_HEIGHT];
        for (let i = 0; i < rowCount; i++) offsets.push(offsets[offsets.length - 1] + heightForRow(i));
        return offsets;
    }, [rowCount, heightForRow]);

    // Keeps the scroll position and viewport size in sync with the actual DOM so
    // virtualization can compute which rows and columns are visible. A plain scroll
    // listener (not rAF-throttled) is fine here — each resulting re-render is cheap
    // since it only re-renders the visible slice of rows and columns, not the whole
    // sheet.
    // Re-run when loading finishes: while the sheet is loading a spinner is rendered
    // in place of the grid, so on a first open there is no grid element yet when this
    // first runs — and with nothing listening, the visible window never moved.
    useEffect(() => {
        const el = gridContainerRef.current;
        if (!el) return;
        const onScroll = () => {
            setScrollTop(el.scrollTop);
            setScrollLeft(el.scrollLeft);
        };
        el.addEventListener("scroll", onScroll, { passive: true });
        setScrollTop(el.scrollTop);
        setScrollLeft(el.scrollLeft);
        setViewportHeight(el.clientHeight);
        setViewportWidth(el.clientWidth);
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setViewportHeight(entry.contentRect.height);
                setViewportWidth(entry.contentRect.width);
            }
        });
        ro.observe(el);
        return () => {
            el.removeEventListener("scroll", onScroll);
            ro.disconnect();
        };
    }, [isLoading]);

    // Visible row window for virtualization: the scroll-position -> row-index
    // binary search, padded by a buffer, then widened to fully contain any
    // merge that pokes into the window — merges never overlap each other, so a
    // single pass over them is enough (widening from a merge can't make the
    // window newly overlap a second one it didn't already touch).
    const visibleRowRange = useMemo(() => {
        if (rowCount === 0) return { startRow: 0, endRow: -1 };
        const viewTop = scrollTop;
        const viewBottom = scrollTop + viewportHeight;
        let startRow = clamp(bandIndexForPixel(rowOffsets, viewTop) - ROW_VIRTUALIZATION_BUFFER, 0, rowCount - 1);
        let endRow = clamp(bandIndexForPixel(rowOffsets, viewBottom) + ROW_VIRTUALIZATION_BUFFER, 0, rowCount - 1);
        for (const m of merges) {
            const s = parseCellRef(m.start), e = parseCellRef(m.end);
            if (!s || !e) continue;
            const minRow = Math.min(s.row, e.row), maxRow = Math.max(s.row, e.row);
            if (maxRow >= startRow && minRow <= endRow) {
                startRow = Math.min(startRow, minRow);
                endRow = Math.max(endRow, maxRow);
            }
        }
        return { startRow, endRow };
    }, [scrollTop, viewportHeight, rowOffsets, rowCount, merges]);

    // Visible column window, the same idea across: only these columns get a <th> and
    // a <td> per row; the ones to either side are stood in for by a single spacer
    // cell of their combined width. Without it every row drew every column, so a
    // sheet's width — an imported file can claim thousands of columns — decided how
    // long each keystroke took.
    // Widened to fully contain any merge that reaches into the visible rows and
    // columns: a merge's cells are drawn by its top-left cell alone, so that cell
    // has to be among the ones rendered. Widening can bring a further merge into the
    // window (unlike with rows alone), hence the loop.
    const visibleColRange = useMemo(() => {
        if (columnCount === 0) return { startCol: 0, endCol: -1 };
        const viewLeft = scrollLeft;
        const viewRight = scrollLeft + (viewportWidth || UNMEASURED_VIEWPORT_WIDTH);
        let startCol = clamp(bandIndexForPixel(colOffsets, viewLeft) - COL_VIRTUALIZATION_BUFFER, 0, columnCount - 1);
        let endCol = clamp(bandIndexForPixel(colOffsets, viewRight) + COL_VIRTUALIZATION_BUFFER, 0, columnCount - 1);
        if (merges.length > 0) {
            const { startRow, endRow } = visibleRowRange;
            const inRows = [];
            for (const m of merges) {
                const s = parseCellRef(m.start), e = parseCellRef(m.end);
                if (!s || !e) continue;
                const minRow = Math.min(s.row, e.row), maxRow = Math.max(s.row, e.row);
                if (maxRow >= startRow && minRow <= endRow) inRows.push({ minCol: Math.min(s.col, e.col), maxCol: Math.max(s.col, e.col) });
            }
            for (let widened = true; widened;) {
                widened = false;
                for (const m of inRows) {
                    if (m.maxCol < startCol || m.minCol > endCol) continue;
                    if (m.minCol < startCol) { startCol = m.minCol; widened = true; }
                    if (m.maxCol > endCol) { endCol = Math.min(m.maxCol, columnCount - 1); widened = true; }
                }
            }
        }
        return { startCol, endCol };
    }, [scrollLeft, viewportWidth, colOffsets, columnCount, merges, visibleRowRange]);
    // The column indexes to render (hidden ones left out), and the widths of the
    // spacers standing in for the columns before and after them.
    const visibleCols = useMemo(() => {
        const list = [];
        for (let c = visibleColRange.startCol; c <= visibleColRange.endCol; c++) if (!hiddenColSet.has(c)) list.push(c);
        return list;
    }, [visibleColRange, hiddenColSet]);
    const leftSpacerWidth = visibleColRange.endCol < 0 ? 0 : colOffsets[visibleColRange.startCol] - colOffsets[0];
    const rightSpacerWidth = visibleColRange.endCol < 0 ? 0 : colOffsets[columnCount] - colOffsets[visibleColRange.endCol + 1];
    // Cells in a full-width row: the row header, the rendered columns and the spacers.
    const renderedColSpan = 1 + visibleCols.length + (leftSpacerWidth > 0 ? 1 : 0) + (rightSpacerWidth > 0 ? 1 : 0);

    // Keyboard navigation can move the active cell to a row/column that isn't
    // currently rendered at all (virtualized rows) or is just scrolled out of
    // view (columns, which aren't virtualized but can still be off-screen).
    // Guarded on activeCell itself (not just present in the deps array) so a
    // resize drag — which also changes rowOffsets/colOffsets — never jumps the
    // scroll position on its own.
    const scrollCellIntoView = useCallback((cellId) => {
        const el = gridContainerRef.current;
        const ref = parseCellRef(cellId);
        if (!el || !ref) return;

        const viewTop = el.scrollTop;
        const headerHeight = HEADER_ROW_HEIGHT;
        const rowStart = rowOffsets[ref.row];
        const rowEnd = rowOffsets[ref.row + 1];
        if (rowStart < viewTop + headerHeight) {
            el.scrollTop = Math.max(0, rowStart - headerHeight);
        } else if (rowEnd > viewTop + el.clientHeight) {
            el.scrollTop = rowEnd - el.clientHeight;
        }

        const viewLeft = el.scrollLeft;
        const headerWidth = ROW_HEADER_WIDTH;
        const colStart = colOffsets[ref.col];
        const colEnd = colOffsets[ref.col + 1];
        if (colStart < viewLeft + headerWidth) {
            el.scrollLeft = Math.max(0, colStart - headerWidth);
        } else if (colEnd > viewLeft + el.clientWidth) {
            el.scrollLeft = colEnd - el.clientWidth;
        }
    }, [rowOffsets, colOffsets]);

    useEffect(() => {
        if (lastScrolledCellRef.current === activeCell) return;
        lastScrolledCellRef.current = activeCell;
        scrollCellIntoView(activeCell);
    }, [activeCell, scrollCellIntoView]);

    const startColumnResize = useCallback((e, colIdx) => {
        e.preventDefault();
        e.stopPropagation();
        const startSize = columnWidths[colIdx] || DEFAULT_COLUMN_WIDTH;
        resizeRef.current = { type: "col", index: colIdx, startPos: e.clientX, startSize, currentSize: startSize };
        setResizePreview({ type: "col", index: colIdx, size: startSize });
    }, [columnWidths]);

    const startRowResize = useCallback((e, rowIdx) => {
        e.preventDefault();
        e.stopPropagation();
        const startSize = rowHeights[rowIdx] || DEFAULT_ROW_HEIGHT;
        resizeRef.current = { type: "row", index: rowIdx, startPos: e.clientY, startSize, currentSize: startSize };
        setResizePreview({ type: "row", index: rowIdx, size: startSize });
    }, [rowHeights]);

    useEffect(() => {
        const onMouseMove = (e) => {
            const r = resizeRef.current;
            if (!r) return;
            // e.clientX/Y are real screen pixels (the zoomed render); startSize
            // and the resulting preview size are authored, unzoomed pixels.
            const delta = (r.type === "col" ? e.clientX - r.startPos : e.clientY - r.startPos) / zoom;
            const min = r.type === "col" ? MIN_COLUMN_WIDTH : MIN_ROW_HEIGHT;
            const newSize = Math.max(min, r.startSize + delta);
            resizeRef.current = { ...r, currentSize: newSize };
            setResizePreview({ type: r.type, index: r.index, size: newSize });
        };
        const onMouseUp = () => {
            const r = resizeRef.current;
            if (!r) return;
            // A click on the handle without dragging (each half of a
            // double-click-to-fit) isn't a resize: leave the sheet untouched.
            if (r.currentSize === r.startSize) {
                resizeRef.current = null;
                setResizePreview(null);
                return;
            }
            updateSheets((next) => {
                const sheet = next[activeSheetName];
                if (r.type === "col") {
                    if (!sheet.columnWidths) sheet.columnWidths = {};
                    sheet.columnWidths[r.index] = r.currentSize;
                } else {
                    if (!sheet.rowHeights) sheet.rowHeights = {};
                    sheet.rowHeights[r.index] = r.currentSize;
                }
            });
            resizeRef.current = null;
            setResizePreview(null);
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [updateSheets, activeSheetName, zoom]);

    // --- Floating media (images/video) ---
    // Anchored to whatever cell is active at insert time, like Excel dropping
    // a picture near the current selection. Position/size then live on the
    // media item itself (row/col + pixel offset, width/height) and are only
    // ever touched again by a drag/resize gesture's onUpdate.

    // `extra` overrides the defaults — a shape passes its key and size here
    // and has no `src`.
    const handleInsertMedia = useCallback((type, src, extra) => {
        if (!src && type !== "shape") return;
        const anchor = parseCellRef(activeCell) || { row: 0, col: 0 };
        const newItem = {
            id: newMediaId(),
            type,
            src,
            row: anchor.row,
            col: anchor.col,
            offsetX: 8,
            offsetY: 8,
            width: 280,
            height: 200,
            ...extra,
        };
        setSelectedMediaId(newItem.id);
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            if (!sheet) return;
            if (!sheet.media) sheet.media = [];
            sheet.media.push(newItem);
        });
    }, [activeCell, activeSheetName, updateSheets]);

    const handleInsertMediaFile = useCallback((type, file) => {
        if (!file) return;
        if (file.size > MEDIA_MAX_BYTES) {
            toast.error("File is too large to embed (max 8MB).");
            return;
        }
        const reader = new FileReader();
        reader.onload = (evt) => handleInsertMedia(type, evt.target.result);
        reader.onerror = () => toast.error("Failed to read file.");
        reader.readAsDataURL(file);
    }, [handleInsertMedia]);

    const handleUpdateMedia = useCallback((id, patch) => {
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            const idx = (sheet?.media || []).findIndex((m) => m.id === id);
            if (idx === -1) return;
            sheet.media[idx] = { ...sheet.media[idx], ...patch };
        });
    }, [activeSheetName, updateSheets]);

    const handleDeleteMedia = useCallback((id) => {
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            if (!sheet?.media) return;
            sheet.media = sheet.media.filter((m) => m.id !== id);
        });
        setSelectedMediaId((prev) => (prev === id ? null : prev));
    }, [activeSheetName, updateSheets]);

    const undo = useCallback(() => {
        if (historyPast.current.length === 0) return;
        const { next, inverse } = applyHistoryRecord(sheetsRef.current, historyPast.current.pop());
        historyFuture.current.push(inverse);
        if (historyFuture.current.length > HISTORY_LIMIT) historyFuture.current.shift();
        setSheets(next);
        setIsDirty(true);
        bumpHistory();
    }, [bumpHistory, setSheets]);

    const redo = useCallback(() => {
        if (historyFuture.current.length === 0) return;
        const { next, inverse } = applyHistoryRecord(sheetsRef.current, historyFuture.current.pop());
        historyPast.current.push(inverse);
        if (historyPast.current.length > HISTORY_LIMIT) historyPast.current.shift();
        setSheets(next);
        setIsDirty(true);
        bumpHistory();
    }, [bumpHistory, setSheets]);

    const commitEdit = useCallback(() => {
        // editSessionRef guards against the editor's onBlur re-committing (or
        // committing after Escape): Enter/Tab/Esc end the session and move
        // focus to the grid in the same tick, and that blur still sees the
        // pre-update `editingCell` in its closure.
        if (!editingCell || editSessionRef.current !== editingCell) return;
        editSessionRef.current = null;
        const cellId = editingCell;
        const value = editValue;
        mutateActiveCells((next) => {
            const merged = { ...(next[cellId] || {}), value };
            // An Alt+Enter line break turns on Wrap Text, as in Excel, so the
            // second line is actually visible.
            if (typeof value === "string" && value.includes("\n") && !isFormula(value)) merged.wrap = true;
            if (isBlankCell(merged)) delete next[cellId];
            else next[cellId] = merged;
        });
        setEditingCell(null);
        setEditValue("");
        formulaInsertRange.current = null;
    }, [editingCell, editValue, mutateActiveCells]);

    // `origin` "bar" = started by focusing the formula bar, which must keep
    // focus (the in-cell editor skips its autoFocus in that case).
    const startEditing = useCallback((cellId, initialValue, origin = "cell") => {
        editOriginRef.current = origin;
        setActiveCell(cellId);
        // Typing into a multi-cell selection keeps it (for Ctrl+Enter);
        // editing a cell outside it collapses the selection to that cell.
        const ref = parseCellRef(cellId);
        const insideSelection = selectionBounds && ref
            && ref.row >= selectionBounds.minRow && ref.row <= selectionBounds.maxRow
            && ref.col >= selectionBounds.minCol && ref.col <= selectionBounds.maxCol;
        if (!insideSelection) setSelection({ start: cellId, end: cellId });
        if (isSheetReadOnly) {
            toast.info("This is a PivotTable — edit the source data instead.");
            return;
        }
        editSessionRef.current = cellId;
        setEditingCell(cellId);
        setEditValue(initialValue !== undefined ? initialValue : (cells[cellId]?.value ?? ""));
        formulaInsertRange.current = null;
    }, [cells, isSheetReadOnly, selectionBounds]);

    // A freshly opened in-cell editor puts the caret after the existing text
    // (or the character that was typed to open it), like Excel.
    useEffect(() => {
        if (!editingCell || editOriginRef.current === "bar") return;
        const el = cellEditInputRef.current;
        if (!el) return;
        const end = el.value.length;
        el.setSelectionRange(end, end);
        cursorPosRef.current = { start: end, end };
    }, [editingCell]);

    const cancelEdit = useCallback(() => {
        editSessionRef.current = null;
        setEditingCell(null);
        setEditValue("");
        formulaInsertRange.current = null;
    }, []);

    // Excel "point mode": inserts `refText` at the current cursor position (or
    // replaces the span occupied by the last point-mode insertion, so dragging
    // to extend a single cell into a range replaces "A1" with "A1:B3" in place
    // rather than accumulating text) and refocuses whichever input the user was
    // typing in, caret placed right after the inserted reference.
    const insertFormulaReference = useCallback((refText) => {
        setEditValue((prev) => {
            const range = formulaInsertRange.current;
            const start = range ? range.start : cursorPosRef.current.start;
            const end = range ? range.end : cursorPosRef.current.end;
            const next = prev.slice(0, start) + refText + prev.slice(end);
            const newEnd = start + refText.length;
            formulaInsertRange.current = { start, end: newEnd };
            cursorPosRef.current = { start: newEnd, end: newEnd };
            requestAnimationFrame(() => {
                const el = activeEditInputRef.current || cellEditInputRef.current;
                if (el) { el.focus(); el.setSelectionRange(newEnd, newEnd); }
            });
            return next;
        });
    }, []);

    // --- Clipboard ---

    const copySelection = useCallback((type) => {
        if (!selectionBounds) return;
        if (hasMultipleRanges) toast.info("Copy works on one range at a time — only the active range was copied.");
        const { minRow, maxRow, minCol, maxCol } = selectionBounds;
        const cellsByRelPos = {};
        // Evaluated values as of the copy, for Paste Special > Values —
        // including spilled cells, which have no entry in `cells` at all.
        const valuesByRelPos = {};
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const id = getCellId(r, c);
                if (cells[id]) cellsByRelPos[`${r - minRow},${c - minCol}`] = cells[id];
                const hasValue = cells[id]?.value !== undefined && cells[id].value !== "";
                if (rawGrid[id] !== undefined && (hasValue || evaluation.spillAnchors.has(id))) {
                    valuesByRelPos[`${r - minRow},${c - minCol}`] = rawGrid[id];
                }
            }
        }
        setClipboard({ cellsByRelPos, valuesByRelPos, height: maxRow - minRow + 1, width: maxCol - minCol + 1, type, sourceBounds: selectionBounds });
    }, [selectionBounds, hasMultipleRanges, cells, rawGrid, evaluation]);

    const handlePaste = useCallback(() => {
        if (!clipboard || !selectionBounds) return;
        const targetRow = selectionBounds.minRow, targetCol = selectionBounds.minCol;
        const src = clipboard.sourceBounds;
        const rowOffset = targetRow - src.minRow;
        const colOffset = targetCol - src.minCol;

        mutateActiveCells((next) => {
            for (let r = 0; r < clipboard.height; r++) {
                for (let c = 0; c < clipboard.width; c++) {
                    const sourceCell = clipboard.cellsByRelPos[`${r},${c}`];
                    const targetId = getCellId(targetRow + r, targetCol + c);
                    if (!sourceCell) { delete next[targetId]; continue; }
                    const sourceIsFormula = typeof sourceCell.value === "string" && sourceCell.value.trim().startsWith("=");
                    const newValue = sourceIsFormula ? adjustFormula(sourceCell.value, rowOffset, colOffset) : sourceCell.value;
                    next[targetId] = { ...sourceCell, value: newValue };
                }
            }
            if (clipboard.type === "cut") {
                for (let r = 0; r < clipboard.height; r++) {
                    for (let c = 0; c < clipboard.width; c++) {
                        delete next[getCellId(src.minRow + r, src.minCol + c)];
                    }
                }
            }
        });

        setSelection({
            start: getCellId(targetRow, targetCol),
            end: getCellId(targetRow + clipboard.height - 1, targetCol + clipboard.width - 1)
        });
        if (clipboard.type === "cut") setClipboard(null);
    }, [clipboard, selectionBounds, mutateActiveCells]);

    const activateFormatPainter = useCallback(() => {
        const { value, ...styles } = cells[activeCell] || {};
        setFormatPainterStyle(styles);
    }, [cells, activeCell]);

    useEffect(() => {
        if (readOnly) return;
        const onPaste = (e) => {
            if (!e.clipboardData) return;
            const items = e.clipboardData.items;
            let hasImage = false;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        e.preventDefault();
                        handleInsertMediaFile("image", file);
                        hasImage = true;
                        break;
                    }
                }
            }
            if (hasImage) return;

            const tag = document.activeElement?.tagName;
            if (tag !== "INPUT" && tag !== "TEXTAREA") {
                e.preventDefault();
                handlePaste();
            }
        };
        window.addEventListener("paste", onPaste);
        return () => window.removeEventListener("paste", onPaste);
    }, [handlePaste, handleInsertMediaFile, readOnly]);

    const handleCellMouseDown = useCallback((cellId, e) => {
        // Point mode: while typing a formula, clicking another cell inserts its
        // reference instead of committing the edit and navigating away — matches
        // Excel's click-to-build-a-formula behavior. Clicking back into the cell
        // actually being edited (editingCell === cellId) is a normal text-cursor
        // click, not a reference insert.
        if (editingCell && editingCell !== cellId && editValue.trim().startsWith("=")) {
            pointModeAnchor.current = cellId;
            isPointingFormula.current = true;
            insertFormulaReference(cellId);
            return;
        }
        if (editingCell && editingCell !== cellId) commitEdit();
        if (formatPainterStyle) {
            mutateActiveCells((next) => {
                const merged = { ...(next[cellId] || {}), ...formatPainterStyle };
                if (isBlankCell(merged)) delete next[cellId]; else next[cellId] = merged;
            });
            setFormatPainterStyle(null);
            return;
        }
        isSelecting.current = true;
        setSelectedMediaId(null);
        // Shift+click: stretch the active range to this cell; the active cell
        // and any other Ctrl-selected ranges stay as they are.
        if (e?.shiftKey) {
            e.preventDefault(); // no native text selection across the cells
            gridContainerRef.current?.focus();
            setSelectionRaw((prev) => ({ start: prev.start, end: cellId }));
            return;
        }
        if (e?.ctrlKey || e?.metaKey) {
            const isSingle = (r) => r.start === cellId && r.end === cellId;
            // Ctrl+click on an already-selected lone cell deselects it (as long
            // as another range remains to fall back on).
            if (extraRanges.length && isSingle(selection)) {
                const fallback = extraRanges[extraRanges.length - 1];
                isSelecting.current = false;
                setExtraRanges(extraRanges.slice(0, -1));
                setSelectionRaw(fallback);
                setActiveCell(fallback.start);
                return;
            }
            if (extraRanges.some(isSingle)) {
                isSelecting.current = false;
                setExtraRanges(extraRanges.filter((r) => !isSingle(r)));
                return;
            }
            setExtraRanges([...extraRanges, selection]);
            setActiveCell(cellId);
            setSelectionRaw({ start: cellId, end: cellId });
            return;
        }
        setActiveCell(cellId);
        setSelection({ start: cellId, end: cellId });
    }, [editingCell, editValue, commitEdit, formatPainterStyle, mutateActiveCells, insertFormulaReference, selection, extraRanges, setSelection]);

    const handleFillHandleMouseDown = useCallback((e) => {
        e.stopPropagation();
        e.preventDefault();
        if (editingCell) commitEdit();
        if (!selectionBounds) return;
        fillSourceRange.current = selectionBounds;
        isFilling.current = true;
        setFillPreview({ axis: null, extraCount: 0 });
    }, [editingCell, commitEdit, selectionBounds]);

    const handleCellMouseEnter = useCallback((cellId, e) => {
        const ref = parseCellRef(cellId);
        setHoveredCell(ref);

        if (isPointingFormula.current && e.buttons === 1 && pointModeAnchor.current) {
            const anchor = pointModeAnchor.current;
            insertFormulaReference(anchor === cellId ? cellId : `${anchor}:${cellId}`);
            return;
        }

        if (isFilling.current && e.buttons === 1) {
            const src = fillSourceRange.current;
            if (!src || !ref) return;
            const maxDRow = rowCount - 1 - src.maxRow;
            const maxDCol = columnCount - 1 - src.maxCol;
            const dRow = Math.max(0, Math.min(ref.row - src.maxRow, maxDRow));
            const dCol = Math.max(0, Math.min(ref.col - src.maxCol, maxDCol));
            if (dRow === 0 && dCol === 0) { setFillPreview({ axis: null, extraCount: 0 }); return; }
            if (dRow >= dCol) setFillPreview({ axis: "vertical", extraCount: dRow });
            else setFillPreview({ axis: "horizontal", extraCount: dCol });
            return;
        }
        if (isSelecting.current && e.buttons === 1) {
            setSelectionRaw((prev) => ({ ...prev, end: cellId }));
        }
    }, [rowCount, columnCount, insertFormulaReference]);

    // Fills the row/column extension implied by the current drag, copying
    // formatting from and (for a single formula source) shifting relative
    // refs off the cell each new cell's position maps back to under a
    // repeating pattern of the original selection's length.
    const applyFill = useCallback(() => {
        if (!fillPreview || !fillPreview.axis || fillPreview.extraCount <= 0) { setFillPreview(null); return; }
        const src = fillSourceRange.current;
        if (!src) { setFillPreview(null); return; }
        const { minRow, maxRow, minCol, maxCol } = src;
        const { axis, extraCount } = fillPreview;

        mutateActiveCells((sheetCells) => {
            const isNumericSource = (sourceCells) => sourceCells.length > 0 && sourceCells.every((c) => {
                const v = c?.value;
                return v !== undefined && v !== null && v !== "" && !isNaN(Number(v)) && !(typeof v === "string" && v.trim().startsWith("="));
            });

            if (axis === "vertical") {
                const patternLen = maxRow - minRow + 1;
                for (let col = minCol; col <= maxCol; col++) {
                    const sourceCellsForCol = [];
                    for (let r = minRow; r <= maxRow; r++) sourceCellsForCol.push(sheetCells[getCellId(r, col)]);
                    const seriesValues = isNumericSource(sourceCellsForCol)
                        ? extrapolateSeries(sourceCellsForCol.map((c) => c.value), extraCount)
                        : null;

                    for (let i = 1; i <= extraCount; i++) {
                        const targetRow = maxRow + i;
                        const targetId = getCellId(targetRow, col);
                        const sourceRow = minRow + ((i - 1) % patternLen);
                        const sourceCell = sheetCells[getCellId(sourceRow, col)] || {};
                        const sourceIsFormula = typeof sourceCell.value === "string" && sourceCell.value.trim().startsWith("=");

                        let newValue;
                        if (sourceIsFormula) newValue = adjustFormula(sourceCell.value, targetRow - sourceRow, 0);
                        else if (seriesValues) newValue = seriesValues[i - 1];
                        else newValue = sourceCell.value ?? "";

                        sheetCells[targetId] = { ...sourceCell, value: newValue };
                    }
                }
            } else {
                const patternLen = maxCol - minCol + 1;
                for (let row = minRow; row <= maxRow; row++) {
                    const sourceCellsForRow = [];
                    for (let c = minCol; c <= maxCol; c++) sourceCellsForRow.push(sheetCells[getCellId(row, c)]);
                    const seriesValues = isNumericSource(sourceCellsForRow)
                        ? extrapolateSeries(sourceCellsForRow.map((c) => c.value), extraCount)
                        : null;

                    for (let i = 1; i <= extraCount; i++) {
                        const targetCol = maxCol + i;
                        const targetId = getCellId(row, targetCol);
                        const sourceCol = minCol + ((i - 1) % patternLen);
                        const sourceCell = sheetCells[getCellId(row, sourceCol)] || {};
                        const sourceIsFormula = typeof sourceCell.value === "string" && sourceCell.value.trim().startsWith("=");

                        let newValue;
                        if (sourceIsFormula) newValue = adjustFormula(sourceCell.value, 0, targetCol - sourceCol);
                        else if (seriesValues) newValue = seriesValues[i - 1];
                        else newValue = sourceCell.value ?? "";

                        sheetCells[targetId] = { ...sourceCell, value: newValue };
                    }
                }
            }
        });

        setSelection(
            axis === "vertical"
                ? { start: getCellId(minRow, minCol), end: getCellId(maxRow + extraCount, maxCol) }
                : { start: getCellId(minRow, minCol), end: getCellId(maxRow, maxCol + extraCount) }
        );
        setFillPreview(null);
    }, [fillPreview, mutateActiveCells]);

    const applyFillRef = useRef(applyFill);
    useEffect(() => { applyFillRef.current = applyFill; }, [applyFill]);

    const fillPreviewCellIds = useMemo(() => {
        if (!fillPreview || !fillPreview.axis || fillPreview.extraCount <= 0) return new Set();
        const src = fillSourceRange.current;
        if (!src) return new Set();
        const ids = [];
        if (fillPreview.axis === "vertical") {
            for (let r = src.maxRow + 1; r <= src.maxRow + fillPreview.extraCount; r++) {
                for (let c = src.minCol; c <= src.maxCol; c++) ids.push(getCellId(r, c));
            }
        } else {
            for (let c = src.maxCol + 1; c <= src.maxCol + fillPreview.extraCount; c++) {
                for (let r = src.minRow; r <= src.maxRow; r++) ids.push(getCellId(r, c));
            }
        }
        return new Set(ids);
    }, [fillPreview]);

    useEffect(() => {
        const onMouseUp = () => {
            isSelecting.current = false;
            isSelectingRowHeader.current = false;
            isSelectingColHeader.current = false;
            headerSelectAnchor.current = null;
            isPointingFormula.current = false;
            pointModeAnchor.current = null;
            if (isFilling.current) {
                isFilling.current = false;
                applyFillRef.current();
            }
        };
        window.addEventListener("mouseup", onMouseUp);
        return () => window.removeEventListener("mouseup", onMouseUp);
    }, []);

    // Drag-selecting to (or past) the grid's edge keeps scrolling that way and
    // extends the selection to the cell under the pointer, like Excel. At the
    // end of the sheet it appends rows/columns so the drag can keep going —
    // in batches, so a long drag leaves a few undo steps rather than hundreds.
    const dragScrollState = useRef(null);
    dragScrollState.current = {
        rowOffsets, colOffsets, rowCount, columnCount, zoom,
        grow: readOnly || isSheetReadOnly ? null : (axis) => updateSheets((next) => {
            const sheet = next[activeSheetName];
            if (!sheet) return;
            if (axis === "row") sheet.rowCount += DRAG_GROW_ROWS;
            else sheet.columnCount += DRAG_GROW_COLUMNS;
        }),
    };
    useEffect(() => {
        let pointer = null, timer = null, lastGrowAt = 0;
        const stop = () => { clearInterval(timer); timer = null; };
        const tick = () => {
            const el = gridContainerRef.current;
            const state = dragScrollState.current;
            if (!el || !pointer || !isSelecting.current) { stop(); return; }
            const rect = el.getBoundingClientRect();
            const headerRight = rect.left + ROW_HEADER_WIDTH * state.zoom;
            const headerBottom = rect.top + HEADER_ROW_HEIGHT * state.zoom;
            const dx = pointer.x > rect.right - DRAG_SCROLL_EDGE ? 1 : pointer.x < headerRight ? -1 : 0;
            const dy = pointer.y > rect.bottom - DRAG_SCROLL_EDGE ? 1 : pointer.y < headerBottom ? -1 : 0;
            if (!dx && !dy) return;

            el.scrollLeft += dx * DRAG_SCROLL_STEP_X;
            el.scrollTop += dy * DRAG_SCROLL_STEP_Y;
            const atRightEnd = dx > 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
            const atBottomEnd = dy > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
            if (state.grow && (atRightEnd || atBottomEnd) && Date.now() - lastGrowAt > DRAG_GROW_INTERVAL_MS) {
                lastGrowAt = Date.now();
                if (atBottomEnd) state.grow("row");
                if (atRightEnd) state.grow("col");
            }

            // The cell under the pointer, held just inside the visible grid.
            const x = clamp(pointer.x, headerRight + 1, rect.right - DRAG_SCROLL_EDGE);
            const y = clamp(pointer.y, headerBottom + 1, rect.bottom - DRAG_SCROLL_EDGE);
            const col = clamp(bandIndexForPixel(state.colOffsets, (x - rect.left) / state.zoom + el.scrollLeft), 0, state.columnCount - 1);
            const row = clamp(bandIndexForPixel(state.rowOffsets, (y - rect.top) / state.zoom + el.scrollTop), 0, state.rowCount - 1);
            const id = getCellId(row, col);
            setSelectionRaw((prev) => (prev.end === id ? prev : { ...prev, end: id }));
        };
        const onMouseMove = (e) => {
            if (!isSelecting.current || e.buttons !== 1) { pointer = null; return; }
            pointer = { x: e.clientX, y: e.clientY };
            if (!timer) timer = setInterval(tick, DRAG_SCROLL_INTERVAL_MS);
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", stop);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", stop);
            stop();
        };
    }, []);

    // Header selections explicitly take keyboard focus (header mousedown is
    // preventDefault-ed so a drag doesn't start a text selection, which also
    // skips the browser's own focus move) so Delete/Backspace reach
    // handleKeyDown. They also drop any selected media item, which that
    // handler would otherwise delete instead of the selected cells' contents.
    // `extend` spans from headerSelectAnchor for a drag across headers.
    // `additive` (Ctrl+click on a header) keeps the current ranges and adds
    // this row/column as a new active range.
    const selectRow = useCallback((rowIdx, extend = false, additive = false) => {
        if (editingCell) commitEdit();
        const anchorRow = extend && headerSelectAnchor.current !== null ? headerSelectAnchor.current : rowIdx;
        const start = getCellId(Math.min(anchorRow, rowIdx), 0);
        const end = getCellId(Math.max(anchorRow, rowIdx), columnCount - 1);
        setSelectedMediaId(null);
        setActiveCell(start);
        if (additive) setExtraRanges((prev) => [...prev, selection]);
        if (extend || additive) setSelectionRaw({ start, end });
        else setSelection({ start, end });
        gridContainerRef.current?.focus();
    }, [columnCount, editingCell, commitEdit, selection, setSelection]);

    const selectColumn = useCallback((colIdx, extend = false, additive = false) => {
        if (editingCell) commitEdit();
        const anchorCol = extend && headerSelectAnchor.current !== null ? headerSelectAnchor.current : colIdx;
        const start = getCellId(0, Math.min(anchorCol, colIdx));
        const end = getCellId(rowCount - 1, Math.max(anchorCol, colIdx));
        setSelectedMediaId(null);
        setActiveCell(start);
        if (additive) setExtraRanges((prev) => [...prev, selection]);
        if (extend || additive) setSelectionRaw({ start, end });
        else setSelection({ start, end });
        gridContainerRef.current?.focus();
    }, [rowCount, editingCell, commitEdit, selection, setSelection]);

    const selectAllCells = useCallback(() => {
        if (editingCell) commitEdit();
        const start = getCellId(0, 0);
        const end = getCellId(rowCount - 1, columnCount - 1);
        setSelectedMediaId(null);
        setActiveCell(start);
        setSelection({ start, end });
        gridContainerRef.current?.focus();
    }, [rowCount, columnCount, editingCell, commitEdit]);

    const handleRowHeaderMouseDown = useCallback((rowIdx, e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        headerSelectAnchor.current = rowIdx;
        isSelectingRowHeader.current = true;
        selectRow(rowIdx, false, e.ctrlKey || e.metaKey);
    }, [selectRow]);

    const handleRowHeaderMouseEnter = useCallback((rowIdx) => {
        if (isSelectingRowHeader.current) selectRow(rowIdx, true);
    }, [selectRow]);

    const handleColHeaderMouseDown = useCallback((colIdx, e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        headerSelectAnchor.current = colIdx;
        isSelectingColHeader.current = true;
        selectColumn(colIdx, false, e.ctrlKey || e.metaKey);
    }, [selectColumn]);

    const handleColHeaderMouseEnter = useCallback((colIdx) => {
        if (isSelectingColHeader.current) selectColumn(colIdx, true);
    }, [selectColumn]);

    const applyToSelection = useCallback((mutator) => {
        mutateActiveCells((next) => {
            const current = plainOf(next);
            allSelectionBounds.forEach((b, i) => {
                for (let r = b.minRow; r <= b.maxRow; r++) {
                    for (let c = b.minCol; c <= b.maxCol; c++) {
                        // A cell inside two overlapping ranges is handled once, by the first.
                        let seen = false;
                        for (let j = 0; j < i && !seen; j++) {
                            const p = allSelectionBounds[j];
                            seen = r >= p.minRow && r <= p.maxRow && c >= p.minCol && c <= p.maxCol;
                        }
                        if (seen) continue;
                        const id = getCellId(r, c);
                        const merged = mutator({ ...(current[id] || {}) }, id);
                        if (isBlankCell(merged)) {
                            if (current[id]) delete next[id];
                            continue;
                        }
                        for (const key of Object.keys(merged)) if (merged[key] === undefined) delete merged[key];
                        next[id] = merged;
                    }
                }
            });
        });
    }, [allSelectionBounds, mutateActiveCells]);

    // Excel's Delete/Backspace: clears cell contents but leaves formatting
    // (colors, borders, alignment, ...) in place, matching applyToSelection's
    // own blank-cell cleanup so a fully-cleared, unstyled cell drops out of
    // the sparse `cells` map entirely.
    const clearSelectedCells = useCallback(() => {
        applyToSelection((cell) => ({ ...cell, value: undefined }));
    }, [applyToSelection]);

    const activeCellData = cells[activeCell];

    const toggleStyle = (key) => {
        const currentlyOn = !!activeCellData?.[key];
        applyToSelection((cell) => ({ ...cell, [key]: !currentlyOn }));
    };
    const setAlign = (align) => applyToSelection((cell) => ({ ...cell, align }));
    const setValign = (valign) => applyToSelection((cell) => ({ ...cell, valign }));
    const toggleWrap = () => {
        const currentlyOn = !!activeCellData?.wrap;
        applyToSelection((cell) => ({ ...cell, wrap: !currentlyOn }));
    };
    // Merges the current selection into one spanning cell (real colSpan/rowSpan,
    // not just alignment): the anchor (top-left) cell keeps its content and is
    // center-aligned; every other cell in the range is cleared, matching Excel's
    // own "merge discards the other cells' content" behavior. Clicking it again
    // on an already-merged range unmerges instead. Any existing merges that
    // overlap the new range are removed first so merges never overlap.
    const mergeCenter = () => {
        if (isSheetReadOnly) { toast.info("This is a PivotTable — edit the source data instead."); return; }
        if (!selectionBounds) return;
        if (hasMultipleRanges) { toast.error("Cannot merge multiple selections. Select a single block of cells."); return; }
        const { minRow, maxRow, minCol, maxCol } = selectionBounds;
        if (minRow === maxRow && minCol === maxCol) {
            setAlign("center");
            return;
        }
        const rangeStart = getCellId(minRow, minCol);
        const rangeEnd = getCellId(maxRow, maxCol);

        const existingExactMerge = merges.find((m) => m.start === rangeStart && m.end === rangeEnd);
        if (existingExactMerge) {
            updateSheets((next) => {
                const sheet = next[activeSheetName];
                sheet.merges = (sheet.merges || []).filter((m) => !(m.start === rangeStart && m.end === rangeEnd));
            });
            return;
        }

        updateSheets((next) => {
            const sheet = next[activeSheetName];
            if (!sheet.merges) sheet.merges = [];
            // Two rectangles share a cell exactly when they overlap on both axes.
            sheet.merges = sheet.merges.filter((m) => {
                const b = rangeBounds(m);
                return !b || b.maxRow < minRow || b.minRow > maxRow || b.maxCol < minCol || b.minCol > maxCol;
            });
            sheet.merges.push({ start: rangeStart, end: rangeEnd });

            const current = plainOf(sheet.cells);
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    const id = getCellId(r, c);
                    if (id !== rangeStart && current[id]) delete sheet.cells[id];
                }
            }
            const anchor = { ...(sheet.cells[rangeStart] || {}), align: "center", valign: sheet.cells[rangeStart]?.valign || "middle" };
            sheet.cells[rangeStart] = anchor;
        });
        setActiveCell(rangeStart);
        setSelection({ start: rangeStart, end: rangeEnd });
    };
    // Unmerge Cells: drops every existing merge whose bounding box overlaps
    // the current selection, regardless of whether the selection exactly
    // matches a merge's own range — mirrors Excel's dedicated "Unmerge Cells"
    // command. (mergeCenter's own toggle above only unmerges on an exact
    // start/end match.) The freed-up cells keep whatever content they already
    // had (only the merge anchor ever holds content after a merge), so no
    // cell data needs clearing here.
    const unmergeCells = useCallback(() => {
        if (!selectionBounds) return;
        const { minRow, maxRow, minCol, maxCol } = selectionBounds;

        const intersecting = merges.filter((m) => {
            const s = parseCellRef(m.start), e = parseCellRef(m.end);
            if (!s || !e) return false;
            const mMinRow = Math.min(s.row, e.row), mMaxRow = Math.max(s.row, e.row);
            const mMinCol = Math.min(s.col, e.col), mMaxCol = Math.max(s.col, e.col);
            return minRow <= mMaxRow && maxRow >= mMinRow && minCol <= mMaxCol && maxCol >= mMinCol;
        });

        if (intersecting.length === 0) {
            toast.info("No merged cells found in selection");
            return;
        }

        const removeIds = new Set(intersecting.map((m) => `${m.start}:${m.end}`));
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            sheet.merges = (sheet.merges || []).filter((m) => !removeIds.has(`${m.start}:${m.end}`));
        });
        toast.success(`Unmerged ${intersecting.length} cell range${intersecting.length === 1 ? "" : "s"}`);
    }, [selectionBounds, merges, activeSheetName, updateSheets]);
    const setFontSize = (fontSize) => {
        const n = Number(fontSize);
        if (fontSize !== "" && fontSize != null && !(n >= 1 && n <= 409)) { toast.error("Font size must be a number between 1 and 409."); return; }
        applyToSelection((cell) => ({ ...cell, fontSize: fontSize ? n : undefined }));
    };
    // Increase / Decrease Font Size step through the size list, like Excel.
    const stepFontSize = (dir) => {
        const current = activeCellData?.fontSize || DEFAULT_FONT_SIZE;
        const next = dir > 0 ? FONT_SIZES.find((sz) => sz > current) : [...FONT_SIZES].reverse().find((sz) => sz < current);
        if (next) setFontSize(next);
    };
    const setUnderlineStyle = (kind) => {
        const on = activeCellData?.underline === kind || (kind === true && activeCellData?.underline === true);
        applyToSelection((cell) => ({ ...cell, underline: on ? undefined : kind }));
    };
    const adjustIndent = (delta) => applyToSelection((cell) => {
        const indent = Math.max(0, Math.min(MAX_INDENT, (cell.indent || 0) + delta));
        return { ...cell, indent: indent || undefined, align: indent && cell.align === "center" ? "left" : cell.align };
    });
    const setRotation = (rotation) => {
        const same = activeCellData?.rotation === rotation;
        applyToSelection((cell) => ({ ...cell, rotation: same ? undefined : rotation }));
    };
    // Home > Clear: formats keep only the value; all drops the cell entirely.
    const clearFormats = () => { if (guardEditable()) applyToSelection((cell) => ({ value: cell.value })); };
    const clearAll = () => { if (guardEditable()) applyToSelection(() => ({})); };
    const setFontFamily = (fontFamily) => applyToSelection((cell) => ({ ...cell, fontFamily: fontFamily || undefined }));
    const setBg = (bg) => applyToSelection((cell) => ({ ...cell, bg }));
    const setColor = (color) => applyToSelection((cell) => ({ ...cell, color }));
    // The ribbon's quick formats replace any format code set through Format Cells.
    const setNumberFormat = (fmt) => applyToSelection((cell) => ({ ...cell, numberFormat: fmt === "general" ? undefined : fmt, numberPattern: undefined }));
    const adjustDecimals = (delta) => applyToSelection((cell) => {
        const decimalPlaces = Math.max(0, (cell.decimalPlaces !== undefined ? cell.decimalPlaces : 2) + delta);
        return {
            ...cell,
            decimalPlaces,
            numberPattern: cell.numberPattern ? patternWithDecimals(cell.numberPattern, decimalPlaces) : undefined,
        };
    });
    const applyBorderPreset = (preset) => {
        if (!guardEditable() || !selectionBounds) return;
        const weight = preset.weight || borderWeight;
        if (preset.key === "none") { applyToSelection((cell) => ({ ...cell, border: undefined })); return; }
        if (preset.key === "all") { applyToSelection((cell) => ({ ...cell, border: { top: weight, bottom: weight, left: weight, right: weight } })); return; }
        const edges = preset.key === "outside" || preset.key === "thickOutside" ? ["top", "bottom", "left", "right"] : [preset.key];
        applyToSelection((cell, id) => {
            const { row, col } = parseCellRef(id);
            // Each selected range is outlined on its own perimeter.
            const onEdge = { top: false, bottom: false, left: false, right: false };
            for (const b of allSelectionBounds) {
                if (row < b.minRow || row > b.maxRow || col < b.minCol || col > b.maxCol) continue;
                if (row === b.minRow) onEdge.top = true;
                if (row === b.maxRow) onEdge.bottom = true;
                if (col === b.minCol) onEdge.left = true;
                if (col === b.maxCol) onEdge.right = true;
            }
            const border = { ...(cell.border || {}) };
            for (const side of edges) if (onEdge[side]) border[side] = weight;
            return { ...cell, border: Object.keys(border).length ? border : undefined };
        });
    };
    const [lastBorderPreset, setLastBorderPreset] = useState(BORDER_PRESETS[0]);
    const applyCellStylePreset = (preset) => applyToSelection((cell) => ({ ...cell, ...preset.style }));

    // Formats the current selection as a table: colors its first row as a header
    // and bands the remaining rows, using the chosen style preset. Registers a
    // `table` entry (range + style + filter state) on the sheet so the header
    // row can offer AutoFilter dropdowns when `filtersEnabled` is on. Re-applying
    // over the same exact range updates that table in place instead of stacking
    // a duplicate.
    const applyTable = (presetKey, filtersEnabled, bounds = selectionBounds) => {
        if (isSheetReadOnly) { toast.info("This is a PivotTable — edit the source data instead."); return; }
        if (!bounds) return;
        const preset = TABLE_STYLE_PRESETS.find((p) => p.key === presetKey) || TABLE_STYLE_PRESETS[0];
        const { minRow, maxRow, minCol, maxCol } = bounds;
        const rangeStart = getCellId(minRow, minCol);
        const rangeEnd = getCellId(maxRow, maxCol);

        updateSheets((next) => {
            const sheet = next[activeSheetName];
            if (!sheet.tables) sheet.tables = [];
            const existing = sheet.tables.find((t) => t.range.start === rangeStart && t.range.end === rangeEnd);
            const tableId = existing?.id || `table-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
            const table = {
                id: tableId,
                range: { start: rangeStart, end: rangeEnd },
                styleKey: preset.key,
                filtersEnabled,
                filters: filtersEnabled ? (existing?.filters || {}) : {},
            };
            sheet.tables = sheet.tables.filter((t) => t.id !== tableId);
            sheet.tables.push(table);

            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    const id = getCellId(r, c);
                    const styled = r === minRow
                        ? { bold: true, bg: preset.header.bg, color: preset.header.color }
                        : { bg: (r - minRow) % 2 === 1 ? preset.bandB : preset.bandA, color: undefined, bold: false };
                    sheet.cells[id] = { ...(sheet.cells[id] || {}), ...styled };
                }
            }
        });
    };

    // --- AutoFilter (per-table column filter dropdowns) ---

    const getTableColumnValues = useCallback((table, colIdx) => {
        const s = parseCellRef(table.range.start), e = parseCellRef(table.range.end);
        if (!s || !e) return [];
        const minRow = Math.min(s.row, e.row), maxRow = Math.max(s.row, e.row);
        const values = new Set();
        for (let r = minRow + 1; r <= maxRow; r++) {
            values.add(String(displayGrid[getCellId(r, colIdx)] ?? ""));
        }
        return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [displayGrid]);

    const openColumnFilter = (table, colIdx) => {
        const allValues = getTableColumnValues(table, colIdx);
        const existing = table.filters?.[colIdx];
        const selected = new Set(Array.isArray(existing) ? existing : allValues);
        setFilterDraft({ search: "", selected, allValues });
        setFilterPopover({ tableId: table.id, colIdx });
    };

    const toggleFilterValue = (val) => {
        setFilterDraft((d) => {
            const next = new Set(d.selected);
            if (next.has(val)) next.delete(val); else next.add(val);
            return { ...d, selected: next };
        });
    };
    const selectAllFilterValues = () => setFilterDraft((d) => ({ ...d, selected: new Set(d.allValues) }));
    const clearAllFilterValues = () => setFilterDraft((d) => ({ ...d, selected: new Set() }));

    const applyColumnFilter = () => {
        if (!filterPopover || !filterDraft) return;
        const { tableId, colIdx } = filterPopover;
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            const table = (sheet.tables || []).find((t) => t.id === tableId);
            if (!table) return;
            if (!table.filters) table.filters = {};
            if (filterDraft.selected.size >= filterDraft.allValues.length) delete table.filters[colIdx];
            else table.filters[colIdx] = Array.from(filterDraft.selected);
        });
        setFilterPopover(null);
        setFilterDraft(null);
    };

    // --- Conditional formatting ---

    const addConditionalRule = () => {
        const threshold = parseFloat(condThreshold);
        if (isNaN(threshold)) { toast.error("Enter a numeric threshold."); return; }
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            if (!sheet.conditionalRules) sheet.conditionalRules = [];
            sheet.conditionalRules.push({ range: [selection.start, selection.end], operator: condOperator, threshold, color: condColor });
        });
        toast.success("Conditional formatting rule applied.");
    };
    const clearConditionalRules = () => {
        updateSheets((next) => { next[activeSheetName].conditionalRules = []; });
    };

    // --- Insert / delete rows & columns ---
    // Note: shifts cell values, formatting, sizes and hidden flags correctly,
    // but does not rewrite formulas elsewhere on the sheet that reference the
    // shifted cells — matching a plain insert/delete, not Excel's full
    // reference-repair.

    // Re-keys a sparse { index: value } map / index list after inserting
    // (count > 0) or deleting (count < 0) bands at `at`.
    const shiftIndexMap = (map, at, count) => {
        const out = {};
        for (const [k, v] of Object.entries(map || {})) {
            const i = Number(k);
            if (count < 0 && i >= at && i < at - count) continue;
            out[i >= at ? i + count : i] = v;
        }
        return out;
    };
    const shiftIndexList = (list, at, count) => {
        if (!list) return list;
        const out = list.filter((i) => !(count < 0 && i >= at && i < at - count)).map((i) => (i >= at ? i + count : i));
        return out.length ? out : undefined;
    };
    // Shifts the 1-D span [lo, hi] for an insert/delete at `at`. An insert
    // inside the span widens it; a delete trims the overlapped part. Returns
    // null when the whole span was deleted.
    const shiftSpan = (lo, hi, at, count) => {
        if (count > 0) {
            if (lo >= at) return [lo + count, hi + count];
            return [lo, hi >= at ? hi + count : hi];
        }
        const delEnd = at - count - 1;
        const overlap = Math.max(0, Math.min(hi, delEnd) - Math.max(lo, at) + 1);
        const remaining = hi - lo + 1 - overlap;
        if (remaining <= 0) return null;
        const newLo = lo < at ? lo : lo > delEnd ? lo + count : at;
        return [newLo, newLo + remaining - 1];
    };
    // Shifts a start/end cell-id range along `axis`; returns normalized
    // bounds or null when the range was deleted entirely.
    const shiftRange = (startId, endId, axis, at, count) => {
        const s = parseCellRef(startId);
        const e = parseCellRef(endId);
        if (!s || !e) return null;
        let minRow = Math.min(s.row, e.row), maxRow = Math.max(s.row, e.row);
        let minCol = Math.min(s.col, e.col), maxCol = Math.max(s.col, e.col);
        const span = axis === "row" ? shiftSpan(minRow, maxRow, at, count) : shiftSpan(minCol, maxCol, at, count);
        if (!span) return null;
        if (axis === "row") [minRow, maxRow] = span; else [minCol, maxCol] = span;
        return { minRow, maxRow, minCol, maxCol };
    };

    const shiftBands = (axis, at, count) => {
        if (!guardEditable()) return;
        const newRowCount = axis === "row" ? Math.max(1, rowCount + count) : rowCount;
        const newColumnCount = axis === "col" ? Math.max(1, columnCount + count) : columnCount;
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            const oldCells = plainOf(sheet.cells);
            const newCells = {};
            for (const id of Object.keys(oldCells)) {
                const ref = parseCellRef(id);
                const pos = axis === "row" ? ref.row : ref.col;
                if (count < 0 && pos >= at && pos < at - count) continue;
                const shifted = pos >= at ? pos + count : pos;
                newCells[axis === "row" ? getCellId(shifted, ref.col) : getCellId(ref.row, shifted)] = oldCells[id];
            }
            sheet.cells = newCells;
            if (axis === "row") {
                sheet.rowCount = Math.max(1, sheet.rowCount + count);
                sheet.rowHeights = shiftIndexMap(sheet.rowHeights, at, count);
                sheet.hiddenRows = shiftIndexList(sheet.hiddenRows, at, count);
            } else {
                sheet.columnCount = Math.max(1, sheet.columnCount + count);
                sheet.columnWidths = shiftIndexMap(sheet.columnWidths, at, count);
                sheet.hiddenCols = shiftIndexList(sheet.hiddenCols, at, count);
            }

            // Structural metadata anchored to cell coordinates moves with the
            // cells; anything whose range was deleted outright is dropped.
            const toIds = (b) => ({ start: getCellId(b.minRow, b.minCol), end: getCellId(b.maxRow, b.maxCol) });
            sheet.merges = (sheet.merges || []).flatMap((m) => {
                const b = shiftRange(m.start, m.end, axis, at, count);
                if (!b || (b.minRow === b.maxRow && b.minCol === b.maxCol)) return [];
                return [{ ...m, ...toIds(b) }];
            });
            sheet.tables = (sheet.tables || []).flatMap((t) => {
                const b = shiftRange(t.range.start, t.range.end, axis, at, count);
                if (!b) return [];
                // Filters are keyed by absolute column index.
                const filters = axis === "col" && t.filters ? shiftIndexMap(t.filters, at, count) : t.filters;
                return [{ ...t, range: toIds(b), filters }];
            });
            sheet.conditionalRules = (sheet.conditionalRules || []).flatMap((rule) => {
                const b = shiftRange(rule.range[0], rule.range[1], axis, at, count);
                if (!b) return [];
                const ids = toIds(b);
                return [{ ...rule, range: [ids.start, ids.end] }];
            });
            const key = axis === "row" ? "row" : "col";
            const limit = (axis === "row" ? sheet.rowCount : sheet.columnCount) - 1;
            sheet.media = (sheet.media || []).map((item) => {
                const pos = item[key] || 0;
                if (pos < at) return item;
                // Media anchored inside a deleted band snaps to the band's start.
                const shifted = count < 0 && pos < at - count ? at : pos + count;
                return { ...item, [key]: Math.max(0, Math.min(limit, shifted)) };
            });
        });

        // Keep the cursor and selection inside the resized grid.
        const clampId = (id) => {
            const ref = parseCellRef(id);
            if (!ref) return "A1";
            return getCellId(Math.min(ref.row, newRowCount - 1), Math.min(ref.col, newColumnCount - 1));
        };
        setActiveCell((prev) => clampId(prev));
        setSelection((prev) => ({ start: clampId(prev.start), end: clampId(prev.end) }));
    };
    const insertRows = (at, count = 1) => shiftBands("row", at, count);
    const deleteRows = (at, count = 1) => shiftBands("row", at, -Math.min(count, rowCount - 1));
    const insertColumns = (at, count = 1) => shiftBands("col", at, count);
    const deleteColumns = (at, count = 1) => shiftBands("col", at, -Math.min(count, columnCount - 1));
    const insertRowAt = (rowIdx) => insertRows(rowIdx, 1);
    const insertColumnAt = (colIdx) => insertColumns(colIdx, 1);

    // --- AutoSum & Sort ---

    const insertAutoSum = (fn) => {
        const ref = parseCellRef(activeCell);
        if (!ref) return;
        let r = ref.row - 1;
        const ids = [];
        while (r >= 0) {
            const id = getCellId(r, ref.col);
            if (!cells[id] || cells[id].value === undefined || cells[id].value === "") break;
            ids.unshift(id);
            r -= 1;
        }
        const formula = ids.length > 0 ? `=${fn}(${ids[0]}:${ids[ids.length - 1]})` : `=${fn}()`;
        startEditing(activeCell, formula);
    };

    // Sorts by raw cell value (not the rendered/formatted display), and — like
    // insert/delete — does not adjust formulas elsewhere that reference the
    // rows being reordered.
    const sortSelection = (direction) => {
        if (isSheetReadOnly) { toast.info("This is a PivotTable — edit the source data instead."); return; }
        if (!selectionBounds) return;
        if (hasMultipleRanges) { toast.error("Cannot sort multiple selections. Select a single block of cells."); return; }
        const { minRow, maxRow, minCol, maxCol } = selectionBounds;
        const sortCol = minCol;
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            const current = plainOf(sheet.cells);
            const rowsData = [];
            for (let r = minRow; r <= maxRow; r++) {
                const rowCells = {};
                for (let c = minCol; c <= maxCol; c++) rowCells[c] = current[getCellId(r, c)];
                rowsData.push(rowCells);
            }
            const keyFor = (rowCells) => {
                const v = rowCells[sortCol]?.value;
                const num = parseFloat(v);
                return isNaN(num) ? String(v ?? "").toLowerCase() : num;
            };
            rowsData.sort((a, b) => {
                const ka = keyFor(a), kb = keyFor(b);
                if (typeof ka === "number" && typeof kb === "number") return direction === "asc" ? ka - kb : kb - ka;
                return direction === "asc" ? String(ka).localeCompare(String(kb)) : String(kb).localeCompare(String(ka));
            });
            rowsData.forEach((rowCells, i) => {
                const targetRow = minRow + i;
                for (let c = minCol; c <= maxCol; c++) {
                    const id = getCellId(targetRow, c);
                    if (rowCells[c] === current[id]) continue; // already where it belongs
                    if (rowCells[c]) sheet.cells[id] = rowCells[c]; else delete sheet.cells[id];
                }
            });
        });
    };

    // --- Coordinate box ---

    useEffect(() => { setCoordInputValue(activeCell); }, [activeCell]);

    const jumpToCoord = () => {
        const target = coordInputValue.trim().toUpperCase();
        const ref = parseCellRef(target);
        if (!ref || ref.row < 0 || ref.row >= rowCount || ref.col < 0 || ref.col >= columnCount) {
            toast.error("Invalid cell reference.");
            setCoordInputValue(activeCell);
            return;
        }
        const anchored = resolveToAnchor(target);
        setActiveCell(anchored);
        setSelection({ start: anchored, end: anchored });
    };

    // --- Sheet tabs ---

    const addSheet = () => {
        let n = Object.keys(sheets).length + 1;
        let name = `Sheet ${n}`;
        while (sheets[name]) { n += 1; name = `Sheet ${n}`; }
        updateSheets((next) => { next[name] = emptySheet(); });
        setActiveSheetName(name);
    };

    // The duplicate starts out pointing at the very same (immutable) sheet
    // object as the original; the two only diverge as each is edited, since
    // an edit copies what it touches instead of changing it in place.
    const copySheet = (name) => {
        if (!sheets[name]) return;
        const newName = getDuplicateSheetName(name, Object.keys(sheets));
        updateSheets((next) => {
            next[newName] = plainOf(next[name]);
        });
        setActiveSheetName(newName);
        toast.success(`Sheet "${name}" duplicated as "${newName}"`);
    };

    const switchSheet = (name) => {
        if (editingCell) commitEdit();
        setActiveSheetName(name);
        setActiveCell("A1");
        setSelection({ start: "A1", end: "A1" });
    };

    const startRenameSheet = (name) => { setRenamingSheet(name); setRenameValue(name); };

    const commitRenameSheet = () => {
        const oldName = renamingSheet;
        const newName = renameValue.trim();
        setRenamingSheet(null);
        if (!oldName || !newName || newName === oldName) return;
        if (sheets[newName]) { toast.error("A sheet with that name already exists."); return; }
        updateSheets((next) => {
            next[newName] = next[oldName];
            delete next[oldName];
            renamePivotSourceReferences(next, oldName, newName);
        });
        if (activeSheetName === oldName) setActiveSheetName(newName);
    };

    const deleteSheet = (name) => {
        const names = Object.keys(sheets);
        if (names.length <= 1) { toast.error("A workbook needs at least one sheet."); return; }
        updateSheets((next) => { delete next[name]; });
        if (activeSheetName === name) {
            setActiveSheetName(names.find((n) => n !== name));
        }
    };

    // --- Find & replace ---
    // Searches what was typed (formula text, not results), like Excel's
    // default "Look in: Formulas". Options: match case, match the entire
    // cell, and search every visible sheet instead of just the active one.

    const findMatcher = useMemo(() => {
        if (!findText) return null;
        const { matchCase, entireCell } = findOptions;
        const needle = matchCase ? findText : findText.toLowerCase();
        return (text) => {
            const hay = matchCase ? text : text.toLowerCase();
            return entireCell ? hay === needle : hay.includes(needle);
        };
    }, [findText, findOptions]);

    const matches = useMemo(() => {
        if (!findMatcher) return [];
        const sheetNames = findOptions.allSheets ? Object.keys(sheets).filter((n) => !sheets[n].hidden) : [activeSheetName];
        const out = [];
        for (const name of sheetNames) {
            const sheetCells = sheets[name]?.cells || {};
            const ids = Object.keys(sheetCells).filter((id) => {
                const v = sheetCells[id]?.value;
                return v !== undefined && v !== null && v !== "" && findMatcher(String(v));
            });
            ids.sort((a, b) => {
                const ra = parseCellRef(a), rb = parseCellRef(b);
                return ra.row - rb.row || ra.col - rb.col;
            });
            for (const id of ids) out.push({ sheet: name, id });
        }
        return out;
    }, [sheets, activeSheetName, findMatcher, findOptions.allSheets]);

    useEffect(() => { setMatchIndex(0); }, [findText, findOptions]);

    const goToMatch = (idx) => {
        if (matches.length === 0) return;
        const wrapped = ((idx % matches.length) + matches.length) % matches.length;
        setMatchIndex(wrapped);
        const { sheet, id } = matches[wrapped];
        if (sheet !== activeSheetName) switchSheet(sheet);
        setActiveCell(id);
        setSelection({ start: id, end: id });
    };
    const findNext = () => goToMatch(matchIndex + 1);
    const findPrevious = () => goToMatch(matchIndex - 1);

    const replaceInText = (current, global) => {
        if (findOptions.entireCell) return replaceText;
        const re = new RegExp(escapeRegex(findText), `${global ? "g" : ""}${findOptions.matchCase ? "" : "i"}`);
        return current.replace(re, () => replaceText);
    };

    const replaceMatches = (targets) => {
        updateSheets((next) => {
            for (const { sheet, id } of targets) {
                const sheetObj = next[sheet];
                if (!sheetObj || sheetObj.pivotConfig) continue;
                const current = String(sheetObj.cells[id]?.value ?? "");
                const merged = { ...(sheetObj.cells[id] || {}), value: replaceInText(current, true) };
                if (isBlankCell(merged)) delete sheetObj.cells[id]; else sheetObj.cells[id] = merged;
            }
        });
    };

    const replaceOne = () => {
        if (readOnly || matches.length === 0) return;
        replaceMatches([matches[matchIndex]]);
        findNext();
    };

    const replaceAll = () => {
        if (readOnly || matches.length === 0) return;
        const count = matches.length;
        replaceMatches(matches);
        toast.success(`Replaced ${count} match${count === 1 ? "" : "es"}.`);
    };

    // --- Save / export / import ---

    const handleSave = async () => {
        // This saves the whole workbook, charts included — a queued chart save is redundant.
        if (chartSaveRef.current) {
            clearTimeout(chartSaveRef.current.timer);
            chartSaveRef.current = null;
        }
        try {
            await saveWorkbook({ meetingId, sectionId, sheets, activeSheet: activeSheetName });
            autosaveFailedRef.current = false;
            if (nothingLeftToSave(sheets, meetingId)) setIsDirty(false);
            toast.success("Spreadsheet saved successfully!");
        } catch (err) {
            toast.error(saveErrorMessage(err, "Failed to save spreadsheet. Please try again."));
        }
    };

    // Charts live under sheets[activeSheetName].charts (one sheet can hold several,
    // one per table), so persisting them reuses the same save-the-whole-workbook
    // endpoint as a normal cell edit — no separate backend route needed. Bypasses
    // the undo history (chart settings aren't something a user expects Ctrl+Z to
    // touch) and auto-saves so the chart layout survives a refresh without the
    // user hitting Save. The local state updates at once; the network save is
    // debounced so dragging a colour picker or flipping through chart types
    // sends one request instead of one per change.
    const persistCharts = useCallback((charts) => {
        if (readOnly) return;
        const current = sheetsRef.current;
        if (!current[activeSheetName]) return;
        broadcastNowRef.current = true;
        setSheets({ ...current, [activeSheetName]: { ...current[activeSheetName], charts } });
        clearTimeout(chartSaveRef.current?.timer);
        chartSaveRef.current = { meetingId, sectionId, activeSheet: activeSheetName, timer: setTimeout(flushChartSave, CHART_SAVE_DEBOUNCE_MS) };
    }, [activeSheetName, sectionId, meetingId, readOnly, flushChartSave, setSheets]);

    useImperativeHandle(ref, () => ({
        updateCharts: persistCharts,
    }), [persistCharts]);

    // Excel's column-width unit is "characters of the default font" rather
    // than pixels; ExcelJS surfaces widths/heights in those native units
    // (characters, points), so these two conversions are shared by both
    // import (Excel units -> px) and export (px -> Excel units). The 7px/char
    // + 5px padding and 96/72 dpi ratio are the standard approximations most
    // spreadsheet tooling uses for this — Excel doesn't expose an exact ratio.
    const excelWidthToPx = (chars) => Math.round(chars * 7 + 5);
    const pxToExcelWidth = (px) => Math.max(2, Math.round((px - 5) / 7));
    const excelHeightToPx = (points) => Math.round((points * 4) / 3);
    const pxToExcelHeight = (px) => Math.round((px * 3) / 4);

    // Writes every sheet in the workbook to its own worksheet, in tab order.
    const handleExport = async () => {
        setIoProgress({ title: "Exporting Spreadsheet", label: "Preparing workbook…", current: 0, total: 0 });
        try {
            const ExcelJS = (await import("exceljs")).default;
            const workbook = new ExcelJS.Workbook();
            const sheetEntries = Object.entries(sheets);
            const totalRows = sheetEntries.reduce((sum, [, s]) => sum + (s.rowCount || 0), 0);
            const usedNames = new Set();
            let processedRows = 0;
            let skippedMedia = 0;

            for (let sheetIdx = 0; sheetIdx < sheetEntries.length; sheetIdx++) {
                const [sheetName, sheet] = sheetEntries[sheetIdx];
                const worksheet = workbook.addWorksheet(toUniqueExcelSheetName(sheetName, usedNames));
                const sheetCells = sheet.cells || {};
                const progressLabel = `Writing sheet ${sheetIdx + 1} of ${sheetEntries.length} ("${sheetName}")…`;

                for (let r = 0; r < sheet.rowCount; r++) {
                    for (let c = 0; c < sheet.columnCount; c++) {
                        const cellData = sheetCells[getCellId(r, c)];
                        if (!cellData) continue;
                        const excelCell = worksheet.getCell(r + 1, c + 1);
                        const raw = cellData.value;

                        if (typeof raw === "string" && raw.trim().startsWith("=")) {
                            excelCell.value = { formula: raw.trim().slice(1) };
                        } else if (raw !== undefined && raw !== "" && String(raw).trim() !== "" && !isNaN(Number(raw))) {
                            excelCell.value = Number(raw);
                        } else if (raw !== undefined && raw !== "") {
                            excelCell.value = raw;
                        }

                        const font = {};
                        if (cellData.bold) font.bold = true;
                        if (cellData.italic) font.italic = true;
                        if (cellData.underline) font.underline = cellData.underline === "double" ? "double" : true;
                        if (cellData.strike) font.strike = true;
                        if (cellData.fontSize) font.size = cellData.fontSize;
                        if (cellData.fontFamily) font.name = cellData.fontFamily;
                        if (cellData.color) font.color = { argb: `FF${cellData.color.replace("#", "").toUpperCase()}` };
                        if (Object.keys(font).length > 0) excelCell.font = font;

                        if (cellData.bg) {
                            excelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${cellData.bg.replace("#", "").toUpperCase()}` } };
                        }

                        if (cellData.align || cellData.valign || cellData.wrap || cellData.indent || cellData.rotation) {
                            excelCell.alignment = {
                                horizontal: cellData.align, vertical: cellData.valign, wrapText: !!cellData.wrap,
                                ...(cellData.indent ? { indent: cellData.indent } : null),
                                ...(cellData.rotation ? { textRotation: cellData.rotation } : null),
                            };
                        }

                        if (cellData.border) {
                            const excelBorderStyle = (weight) => (weight === "thick" ? "medium" : weight === "double" ? "double" : "thin");
                            const b = {};
                            for (const side of ["top", "bottom", "left", "right"]) {
                                if (cellData.border[side]) b[side] = { style: excelBorderStyle(cellData.border[side]) };
                            }
                            excelCell.border = b;
                        }

                        if (cellData.numberFormat) {
                            const decimals = cellData.decimalPlaces !== undefined ? cellData.decimalPlaces : 2;
                            const decimalStr = decimals > 0 ? `.${"0".repeat(decimals)}` : "";
                            const fmtMap = {
                                number: `0${decimalStr}`,
                                comma: `#,##0${decimalStr}`,
                                currency: `"$"#,##0${decimalStr}`,
                                accounting: `"$"#,##0${decimalStr}`,
                                percentage: `0${decimalStr}%`,
                                scientific: `0${decimalStr}E+00`,
                                date: "yyyy-mm-dd",
                                time: "hh:mm:ss",
                                datetime: "yyyy-mm-dd hh:mm",
                                text: "@",
                            };
                            excelCell.numFmt = cellData.numberPattern || fmtMap[cellData.numberFormat] || "General";
                        }
                    }
                    processedRows++;
                    if ((r + 1) % IO_CHUNK_SIZE === 0 || r === sheet.rowCount - 1) {
                        setIoProgress({ title: "Exporting Spreadsheet", label: progressLabel, current: processedRows, total: totalRows });
                        await yieldToUI();
                    }
                }

                for (const [colIdxStr, width] of Object.entries(sheet.columnWidths || {})) {
                    worksheet.getColumn(Number(colIdxStr) + 1).width = pxToExcelWidth(width);
                }
                for (const [rowIdxStr, height] of Object.entries(sheet.rowHeights || {})) {
                    worksheet.getRow(Number(rowIdxStr) + 1).height = pxToExcelHeight(height);
                }
                for (const m of sheet.merges || []) {
                    try { worksheet.mergeCells(`${m.start}:${m.end}`); } catch { /* malformed range — skip it rather than fail the whole export */ }
                }
                for (const r of sheet.hiddenRows || []) worksheet.getRow(r + 1).hidden = true;
                for (const c of sheet.hiddenCols || []) worksheet.getColumn(c + 1).hidden = true;
                if (sheet.hidden) worksheet.state = "hidden";

                // Media is placed by absolute pixel position re-anchored against
                // this sheet's own sizes, since a drag can leave an item's offset
                // spanning past its anchor cell and Excel expects it within.
                const colWidthPx = (i) => sheet.columnWidths?.[i] || DEFAULT_COLUMN_WIDTH;
                const rowHeightPx = (i) => sheet.rowHeights?.[i] || DEFAULT_ROW_HEIGHT;
                for (const item of sheet.media || []) {
                    const prepared = await prepareImageForExport(item);
                    if (!prepared) { skippedMedia++; continue; }
                    const x = bandStartPx(item.col || 0, colWidthPx) + (item.offsetX || 0) + prepared.dx;
                    const y = bandStartPx(item.row || 0, rowHeightPx) + (item.offsetY || 0) + prepared.dy;
                    const colAnchor = pxToBandAnchor(x, colWidthPx, Math.max(sheet.columnCount, (item.col || 0) + 1));
                    const rowAnchor = pxToBandAnchor(y, rowHeightPx, Math.max(sheet.rowCount, (item.row || 0) + 1));
                    const imageId = workbook.addImage({ base64: prepared.base64, extension: prepared.extension });
                    worksheet.addImage(imageId, {
                        tl: {
                            nativeCol: colAnchor.index,
                            nativeColOff: Math.round(colAnchor.offsetPx * EMU_PER_PX),
                            nativeRow: rowAnchor.index,
                            nativeRowOff: Math.round(rowAnchor.offsetPx * EMU_PER_PX)
                        },
                        ext: { width: prepared.width, height: prepared.height },
                        editAs: "oneCell"
                    });
                }
            }

            // Open the exported file on the same tab the user was looking at.
            const activeTab = Math.max(0, sheetEntries.findIndex(([name]) => name === activeSheetName));
            workbook.views = [{ activeTab, firstSheet: 0, visibility: "visible" }];

            setIoProgress({ title: "Exporting Spreadsheet", label: "Generating file…", current: 0, total: 0 });
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = meetingId ? `daily-meeting-${meetingId}.xlsx` : `daily-meeting-section-${sectionId}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if (skippedMedia > 0) {
                toast.warning(`${skippedMedia} item${skippedMedia === 1 ? "" : "s"} (videos, or images that couldn't be loaded) ${skippedMedia === 1 ? "was" : "were"} left out of the Excel file.`);
            }
        } catch (err) {
            console.error("Excel export failed:", err);
            toast.error("Failed to export the spreadsheet.");
        } finally {
            setIoProgress(null);
        }
    };

    const handleImportClick = () => fileInputRef.current?.click();

    // Reads every worksheet into its own sheet and replaces the whole workbook
    // with them in a single updateSheets call, so one Ctrl+Z undoes the import.
    const handleImportFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIoProgress({ title: "Importing Spreadsheet", label: "Reading file…", current: 0, total: 0 });
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const ExcelJS = (await import("exceljs")).default;
                const workbook = new ExcelJS.Workbook();
                setIoProgress({ title: "Importing Spreadsheet", label: "Parsing workbook…", current: 0, total: 0 });
                await workbook.xlsx.load(evt.target.result);
                const worksheets = workbook.worksheets || [];
                if (worksheets.length === 0) throw new Error("No worksheet found in file");

                const totalRows = worksheets.reduce((sum, ws) => sum + (ws.rowCount || 0), 0);
                const importedSheets = {};
                const usedNames = new Set();
                let processedRows = 0;
                let importedImageCount = 0, skippedUnsupportedImages = 0, skippedLargeImages = 0;

                for (let wsIdx = 0; wsIdx < worksheets.length; wsIdx++) {
                    const worksheet = worksheets[wsIdx];
                    const sheetName = toUniqueExcelSheetName(worksheet.name || `Sheet ${wsIdx + 1}`, usedNames);
                    const progressLabel = `Reading sheet ${wsIdx + 1} of ${worksheets.length} ("${sheetName}")…`;
                    const importedCells = {};
                    const importedColumnWidths = {};
                    const importedRowHeights = {};
                    const importedHiddenRows = [];
                    const importedHiddenCols = [];
                    let maxRow = 0, maxCol = 0;

                    const sheetRows = worksheet.rowCount || 0;
                    setIoProgress({ title: "Importing Spreadsheet", label: progressLabel, current: processedRows, total: totalRows });
                    for (let rowNumber = 1; rowNumber <= sheetRows; rowNumber++) {
                        const row = worksheet.getRow(rowNumber);
                        const rIdx = rowNumber - 1;
                        if (row.height) importedRowHeights[rIdx] = excelHeightToPx(row.height);
                        if (row.hidden) importedHiddenRows.push(rIdx);
                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            const cIdx = colNumber - 1;
                            const value = extractExcelCellValue(cell);
                            const style = extractExcelCellStyle(cell);
                            // Sparse storage: an empty cell is kept only if it carries
                            // formatting of its own. Nearly every Excel cell names the
                            // workbook's default font, which on an empty cell shows
                            // nothing — keeping those would store a blank object for
                            // every cell of a large sheet's used range.
                            if (value === "" && !hasOwnFormatting(style)) return;
                            importedCells[getCellId(rIdx, cIdx)] = { value, ...style };
                            maxRow = Math.max(maxRow, rIdx + 1);
                            maxCol = Math.max(maxCol, cIdx + 1);
                        });
                        processedRows++;
                        if (rowNumber % IO_CHUNK_SIZE === 0 || rowNumber === sheetRows) {
                            setIoProgress({ title: "Importing Spreadsheet", label: progressLabel, current: processedRows, total: totalRows });
                            await yieldToUI();
                        }
                    }

                    const totalCols = Math.max(worksheet.columnCount || 0, maxCol);
                    for (let i = 0; i < totalCols; i++) {
                        const col = worksheet.getColumn(i + 1);
                        if (col?.width) importedColumnWidths[i] = excelWidthToPx(col.width);
                        if (col?.hidden) importedHiddenCols.push(i);
                    }

                    const importedMerges = [];
                    for (const range of worksheet.model?.merges || []) {
                        const [start, end] = range.split(":");
                        if (parseCellRef(start) && parseCellRef(end)) importedMerges.push({ start, end });
                    }

                    setIoProgress({ title: "Importing Spreadsheet", label: `Reading images in "${sheetName}"…`, current: processedRows, total: totalRows });
                    const images = await extractWorksheetImages(
                        workbook,
                        worksheet,
                        (i) => importedColumnWidths[i] || DEFAULT_COLUMN_WIDTH,
                        (i) => importedRowHeights[i] || DEFAULT_ROW_HEIGHT
                    );
                    skippedUnsupportedImages += images.skippedUnsupported;
                    skippedLargeImages += images.skippedTooLarge;
                    importedImageCount += images.media.length;

                    importedSheets[sheetName] = {
                        ...emptySheet(),
                        cells: importedCells,
                        // Grown to cover picture anchors too, since media is
                        // positioned off the grid's row/column offsets.
                        rowCount: Math.max(DEFAULT_ROW_COUNT, maxRow, images.maxRow),
                        columnCount: Math.max(DEFAULT_COLUMN_COUNT, maxCol, images.maxCol),
                        merges: importedMerges,
                        columnWidths: importedColumnWidths,
                        rowHeights: importedRowHeights,
                        media: images.media,
                        ...(importedHiddenRows.length && { hiddenRows: importedHiddenRows }),
                        ...(importedHiddenCols.length && { hiddenCols: importedHiddenCols }),
                        ...(worksheet.state && worksheet.state !== "visible" && { hidden: true }),
                    };
                }

                // A workbook always keeps at least one visible sheet. Settled
                // before the commit below, which freezes the imported sheets.
                const importedNames = Object.keys(importedSheets);
                if (importedNames.every((name) => importedSheets[name].hidden)) delete importedSheets[importedNames[0]].hidden;
                setEditingCell(null);
                updateSheets((next) => {
                    for (const name of Object.keys(next)) delete next[name];
                    Object.assign(next, importedSheets);
                });
                setActiveSheetName(importedNames.find((name) => !importedSheets[name].hidden));
                setActiveCell("A1");
                setSelection({ start: "A1", end: "A1" });
                setSelectedMediaId(null);

                const count = worksheets.length;
                const imageNote = importedImageCount > 0 ? ` and ${importedImageCount} image${importedImageCount === 1 ? "" : "s"}` : "";
                toast.success(`Imported ${count} sheet${count === 1 ? "" : "s"}${imageNote}. Click Save to persist ${count === 1 && !imageNote ? "it" : "them"}.`);
                if (skippedUnsupportedImages > 0) {
                    toast.warning(`${skippedUnsupportedImages} image${skippedUnsupportedImages === 1 ? " was" : "s were"} skipped — format not supported in the browser (e.g. EMF/WMF/TIFF).`);
                }
                if (skippedLargeImages > 0) {
                    toast.warning(`${skippedLargeImages} image${skippedLargeImages === 1 ? " was" : "s were"} skipped — larger than 8MB.`);
                }
            } catch (err) {
                console.error("Excel import failed:", err);
                toast.error("Failed to read the Excel file.");
            } finally {
                setIoProgress(null);
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = "";
    };

    // =====================================================================
    // Keyboard commands — Excel's shortcut set.
    //
    // One dispatcher (handleKeyDown) sits on the component root, so it sees
    // keys from the grid, the two cell editors and the ribbon alike; dialogs
    // stop their own keystrokes from bubbling up to it. Commands are plain
    // functions (not useCallback) because the dispatcher calls them at event
    // time, after every helper they depend on exists.
    // =====================================================================

    const focusGrid = () => requestAnimationFrame(() => gridContainerRef.current?.focus());

    // --- Full-screen view ---
    // FullScreenFrame moves the sheet's DOM between the page and a body-level
    // overlay, which resets the grid's scroll offset and drops focus — so the
    // offset is captured before the move and restored (and the grid refocused)
    // right after it. FullScreenFrame's own layout effect, which does the move,
    // runs before this one since it's a child.
    const savedGridScroll = useRef(null);
    const toggleFullScreen = useCallback((next) => {
        const el = gridContainerRef.current;
        savedGridScroll.current = el ? { top: el.scrollTop, left: el.scrollLeft } : null;
        setIsFullScreen((v) => (typeof next === "boolean" ? next : !v));
    }, []);
    const exitFullScreen = useCallback(() => toggleFullScreen(false), [toggleFullScreen]);
    useLayoutEffect(() => {
        const el = gridContainerRef.current;
        const saved = savedGridScroll.current;
        if (!el || !saved) return;
        el.scrollTop = saved.top;
        el.scrollLeft = saved.left;
        setScrollTop(el.scrollTop);
        setScrollLeft(el.scrollLeft);
        savedGridScroll.current = null;
        el.focus({ preventScroll: true });
    }, [isFullScreen]);

    // In full screen the grid fills whatever height is left under the ribbon /
    // formula bar and above the sheet tabs, instead of the fixed inline cap.
    const [gridAreaEl, setGridAreaEl] = useState(null);
    const [gridAreaHeight, setGridAreaHeight] = useState(0);
    useEffect(() => {
        if (!gridAreaEl || !isFullScreen) return;
        const update = () => setGridAreaHeight(gridAreaEl.clientHeight);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(gridAreaEl);
        return () => ro.disconnect();
    }, [gridAreaEl, isFullScreen]);
    // -2 for the grid wrapper's top/bottom border.
    const gridMaxHeight = isFullScreen && gridAreaHeight > 0 ? Math.max(120, gridAreaHeight - 2) : 560;

    const guardEditable = () => {
        if (readOnly) return false;
        if (isSheetReadOnly) { toast.info("This is a PivotTable — edit the source data instead."); return false; }
        return true;
    };

    const hasContentAt = (row, col) => {
        const v = displayGrid[getCellId(row, col)];
        return v !== undefined && v !== "";
    };
    const inSheet = (row, col) => row >= 0 && row < rowCount && col >= 0 && col < columnCount;
    const isBandVisible = (row, col) => !hiddenRowSet.has(row) && !hiddenColSet.has(col);

    // Next visible cell in a direction (hidden rows/columns are skipped).
    const nextVisible = (row, col, dRow, dCol) => {
        let r = row + dRow, c = col + dCol;
        while (inSheet(r, c) && !isBandVisible(r, c)) { r += dRow; c += dCol; }
        return inSheet(r, c) ? { row: r, col: c } : null;
    };
    const stepFrom = (row, col, dRow, dCol, steps = 1) => {
        let pos = { row, col };
        for (let i = 0; i < steps; i++) {
            const next = nextVisible(pos.row, pos.col, dRow, dCol);
            if (!next) break;
            pos = next;
        }
        return pos;
    };

    // Ctrl+Arrow: from inside a block of data, jump to its last filled cell;
    // otherwise jump to the next filled cell, or the sheet edge if none.
    const edgeFrom = (row, col, dRow, dCol) => {
        const first = nextVisible(row, col, dRow, dCol);
        if (!first) return { row, col };
        if (hasContentAt(row, col) && hasContentAt(first.row, first.col)) {
            let pos = first;
            for (;;) {
                const next = nextVisible(pos.row, pos.col, dRow, dCol);
                if (!next || !hasContentAt(next.row, next.col)) return pos;
                pos = next;
            }
        }
        let pos = first;
        for (;;) {
            if (hasContentAt(pos.row, pos.col)) return pos;
            const next = nextVisible(pos.row, pos.col, dRow, dCol);
            if (!next) return pos;
            pos = next;
        }
    };

    // Calls `visit(id, row, col)` for every cell that can show something: one
    // with a typed value or formula, or one a formula spills into. Position
    // filters belong in `visit` ahead of any displayGrid read, so a pass over a
    // large sheet only formats the cells it actually needs.
    const forEachFilledCell = (visit) => {
        const emit = (id) => {
            const pos = cellPosOf(id);
            if (pos >= 0) {
                const col = pos % CELL_POS_STRIDE;
                visit(id, (pos - col) / CELL_POS_STRIDE, col);
                return;
            }
            const ref = parseCellRef(id);
            if (ref) visit(id, ref.row, ref.col);
        };
        for (const id in cells) {
            const v = cells[id]?.value;
            if (v !== undefined && v !== null && v !== "") emit(id);
        }
        for (const id of evaluation.spillAnchors.keys()) emit(id);
    };

    const lastUsedCell = () => {
        let maxRow = 0, maxCol = 0;
        forEachFilledCell((id, row, col) => {
            if (row <= maxRow && col <= maxCol) return;
            if (displayGrid[id] === "") return;
            if (row > maxRow) maxRow = row;
            if (col > maxCol) maxCol = col;
        });
        return { row: Math.min(maxRow, rowCount - 1), col: Math.min(maxCol, columnCount - 1) };
    };

    // Excel's "current region": the block around a cell bounded by empty
    // rows and columns (Ctrl+A, Ctrl+L and Ctrl+Shift+L all start from it).
    const currentRegion = (row, col) => {
        let top = row, bottom = row, left = col, right = col;
        const anyContent = (r1, r2, c1, c2) => {
            for (let r = Math.max(0, r1); r <= Math.min(rowCount - 1, r2); r++) {
                for (let c = Math.max(0, c1); c <= Math.min(columnCount - 1, c2); c++) if (hasContentAt(r, c)) return true;
            }
            return false;
        };
        for (let changed = true; changed;) {
            changed = false;
            if (top > 0 && anyContent(top - 1, top - 1, left - 1, right + 1)) { top--; changed = true; }
            if (bottom < rowCount - 1 && anyContent(bottom + 1, bottom + 1, left - 1, right + 1)) { bottom++; changed = true; }
            if (left > 0 && anyContent(top - 1, bottom + 1, left - 1, left - 1)) { left--; changed = true; }
            if (right < columnCount - 1 && anyContent(top - 1, bottom + 1, right + 1, right + 1)) { right++; changed = true; }
        }
        return { minRow: top, maxRow: bottom, minCol: left, maxCol: right };
    };

    // Selects a rectangle; the active cell can sit anywhere inside it (Ctrl+A
    // keeps it where it was, like Excel).
    const selectBounds = ({ minRow, maxRow, minCol, maxCol }, activeId = getCellId(minRow, minCol)) => {
        setSelectedMediaId(null);
        setActiveCell(activeId);
        setSelection({ start: getCellId(minRow, minCol), end: getCellId(maxRow, maxCol) });
    };
    const isMultiSelection = !!selectionBounds && (selectionBounds.minRow !== selectionBounds.maxRow || selectionBounds.minCol !== selectionBounds.maxCol);

    // Moves the active cell, or with `extend` moves the selection's far corner
    // while the active cell stays put (Shift+Arrow semantics).
    const moveTo = (pos, extend) => {
        const id = resolveToAnchor(getCellId(pos.row, pos.col));
        if (extend) {
            setSelectionRaw((prev) => ({ start: prev.start, end: id }));
            scrollCellIntoView(id);
            return;
        }
        setSelectedMediaId(null);
        setActiveCell(id);
        setSelection({ start: id, end: id });
    };

    const pageRows = () => Math.max(1, Math.floor((gridContainerRef.current?.clientHeight || 400) / DEFAULT_ROW_HEIGHT) - 1);
    const pageCols = () => Math.max(1, Math.floor(((gridContainerRef.current?.clientWidth || 800) - ROW_HEADER_WIDTH) / DEFAULT_COLUMN_WIDTH) - 1);

    // Ctrl+D / Ctrl+R: copy the top row (or left column) across the rest of
    // the selection — or from the row above / column left of a single-row
    // (single-column) selection. Relative references shift like the fill handle.
    const fillFromEdge = (direction) => {
        if (!guardEditable() || !selectionBounds) return;
        let { minRow, maxRow, minCol, maxCol } = selectionBounds;
        const down = direction === "down";
        if (down ? minRow === maxRow : minCol === maxCol) {
            if (down ? minRow === 0 : minCol === 0) return;
            if (down) minRow -= 1; else minCol -= 1;
        }
        mutateActiveCells((next) => {
            for (let r = minRow; r <= maxRow; r++) {
                if (hiddenRowSet.has(r)) continue;
                for (let c = minCol; c <= maxCol; c++) {
                    const srcRow = down ? minRow : r, srcCol = down ? c : minCol;
                    if (r === srcRow && c === srcCol) continue;
                    const targetId = getCellId(r, c);
                    const source = next[getCellId(srcRow, srcCol)];
                    if (!source) { delete next[targetId]; continue; }
                    next[targetId] = { ...source, value: isFormula(source.value) ? adjustFormula(source.value, r - srcRow, c - srcCol) : source.value };
                }
            }
        });
    };

    // Ctrl+Enter: the entry goes into every selected cell, formulas adjusted
    // relative to the cell being edited.
    const commitEditToSelection = () => {
        if (!editingCell) return;
        if (!selectionBounds || !isMultiSelection) { commitEdit(); focusGrid(); return; }
        const origin = parseCellRef(editingCell);
        const value = editValue;
        const { minRow, maxRow, minCol, maxCol } = selectionBounds;
        editSessionRef.current = null;
        mutateActiveCells((next) => {
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    if (hiddenRowSet.has(r) || hiddenColSet.has(c)) continue;
                    const id = getCellId(r, c);
                    const v = isFormula(value) ? adjustFormula(value, r - origin.row, c - origin.col) : value;
                    const merged = { ...(next[id] || {}), value: v };
                    if (isBlankCell(merged)) delete next[id]; else next[id] = merged;
                }
            }
        });
        setEditingCell(null);
        setEditValue("");
        formulaInsertRange.current = null;
        focusGrid();
    };

    // Enter / Shift+Enter / Tab / Shift+Tab while editing.
    const commitAndMove = (dRow, dCol) => {
        const origin = parseCellRef(editingCell || activeCell);
        commitEdit();
        if (origin) moveTo(stepFrom(origin.row, origin.col, dRow, dCol), false);
        focusGrid();
    };

    const insertIntoEditor = (el, text) => {
        const start = el.selectionStart ?? editValue.length;
        const end = el.selectionEnd ?? start;
        setEditValue(editValue.slice(0, start) + text + editValue.slice(end));
        formulaInsertRange.current = null;
        requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + text.length, start + text.length); });
    };

    // --- Hide / unhide rows & columns ---

    const setHiddenBands = (key, indexes, hide) => {
        if (readOnly) return;
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            const set = new Set(sheet[key] || []);
            indexes.forEach((i) => (hide ? set.add(i) : set.delete(i)));
            if (set.size) sheet[key] = [...set].sort((a, b) => a - b);
            else delete sheet[key];
        });
    };
    const bandRange = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

    const hideSelectedRows = () => {
        if (readOnly || !selectionBounds) return;
        const { minRow, maxRow } = selectionBounds;
        const remaining = bandRange(0, rowCount - 1).filter((r) => (r < minRow || r > maxRow) && !hiddenRowSet.has(r));
        if (!remaining.length) { toast.error("You can't hide every row."); return; }
        setHiddenBands("hiddenRows", bandRange(minRow, maxRow), true);
        const landing = remaining.find((r) => r > maxRow) ?? remaining[remaining.length - 1];
        moveTo({ row: landing, col: parseCellRef(activeCell).col }, false);
    };
    const hideSelectedColumns = () => {
        if (readOnly || !selectionBounds) return;
        const { minCol, maxCol } = selectionBounds;
        const remaining = bandRange(0, columnCount - 1).filter((c) => (c < minCol || c > maxCol) && !hiddenColSet.has(c));
        if (!remaining.length) { toast.error("You can't hide every column."); return; }
        setHiddenBands("hiddenCols", bandRange(minCol, maxCol), true);
        const landing = remaining.find((c) => c > maxCol) ?? remaining[remaining.length - 1];
        moveTo({ row: parseCellRef(activeCell).row, col: landing }, false);
    };
    // Unhides any hidden rows/columns inside the selection — select across
    // the double-line marker (or the whole sheet) first, like Excel.
    const unhideSelectedRows = () => {
        if (!selectionBounds) return;
        const inside = hiddenRows.filter((r) => r >= selectionBounds.minRow - 1 && r <= selectionBounds.maxRow + 1);
        if (!inside.length) { toast.info("Select the rows on both sides of the hidden ones, then unhide."); return; }
        setHiddenBands("hiddenRows", inside, false);
    };
    const unhideSelectedColumns = () => {
        if (!selectionBounds) return;
        const inside = hiddenCols.filter((c) => c >= selectionBounds.minCol - 1 && c <= selectionBounds.maxCol + 1);
        if (!inside.length) { toast.info("Select the columns on both sides of the hidden ones, then unhide."); return; }
        setHiddenBands("hiddenCols", inside, false);
    };

    // --- AutoFit ---

    const measureCanvasRef = useRef(null);
    const measureTextWidth = (text, cell) => {
        if (!measureCanvasRef.current) measureCanvasRef.current = document.createElement("canvas").getContext("2d");
        const ctx = measureCanvasRef.current;
        ctx.font = `${cell?.italic ? "italic " : ""}${cell?.bold ? "bold " : ""}${cell?.fontSize || 12}px ${cell?.fontFamily ? `"${cell.fontFamily}", ` : ""}ui-sans-serif, system-ui, sans-serif`;
        return Math.max(0, ...String(text).split("\n").map((line) => ctx.measureText(line).width));
    };

    const autoFitColumnRange = (minCol, maxCol) => {
        if (readOnly) return;
        const widest = {};
        forEachFilledCell((id, row, col) => {
            if (col < minCol || col > maxCol || hiddenRowSet.has(row) || mergeMap[id]) return;
            const text = displayGrid[id];
            if (text === "") return;
            // Indent adds 9px of padding per level when the cell is drawn.
            const indent = (cells[id]?.indent || 0) * 9;
            widest[col] = Math.max(widest[col] || 0, measureTextWidth(text, cells[id]) + indent);
        });
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            sheet.columnWidths = { ...(sheet.columnWidths || {}) };
            for (let c = minCol; c <= maxCol; c++) {
                if (widest[c] === undefined) delete sheet.columnWidths[c];
                else sheet.columnWidths[c] = clamp(Math.ceil(widest[c]) + 16, MIN_COLUMN_WIDTH, 600);
            }
        });
    };

    const autoFitColumns = () => {
        if (!selectionBounds) return;
        autoFitColumnRange(selectionBounds.minCol, selectionBounds.maxCol);
    };

    // Double-clicking a column's right border fits it to its contents, like
    // Excel. When that column is part of a whole-column selection, every
    // selected column is fitted.
    const handleColumnBorderDoubleClick = (colIdx) => {
        const b = selectionBounds;
        const inColumnSelection = b && b.minRow === 0 && b.maxRow === rowCount - 1 && colIdx >= b.minCol && colIdx <= b.maxCol;
        if (inColumnSelection) autoFitColumnRange(b.minCol, b.maxCol);
        else autoFitColumnRange(colIdx, colIdx);
    };

    const autoFitRows = () => {
        if (readOnly || !selectionBounds) return;
        const { minRow, maxRow } = selectionBounds;
        const tallest = {};
        forEachFilledCell((id, row, col) => {
            if (row < minRow || row > maxRow || mergeMap[id]) return;
            const text = displayGrid[id];
            if (text === "") return;
            const cell = cells[id];
            const fontSize = cell?.fontSize || 12;
            let lines = 1;
            if (cell?.wrap) {
                const available = Math.max(20, (columnWidths[col] || DEFAULT_COLUMN_WIDTH) - 12);
                lines = String(text).split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(measureTextWidth(line, cell) / available)), 0);
            }
            tallest[row] = Math.max(tallest[row] || 0, Math.ceil(lines * fontSize * 1.35 + 10));
        });
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            sheet.rowHeights = { ...(sheet.rowHeights || {}) };
            for (let r = minRow; r <= maxRow; r++) {
                if (!tallest[r] || tallest[r] <= DEFAULT_ROW_HEIGHT) delete sheet.rowHeights[r];
                else sheet.rowHeights[r] = Math.max(MIN_ROW_HEIGHT, tallest[r]);
            }
        });
    };

    // --- Sheets: navigation, hide / unhide ---

    const visibleSheetNames = Object.keys(sheets).filter((name) => !sheets[name]?.hidden);
    const hiddenSheetNames = Object.keys(sheets).filter((name) => sheets[name]?.hidden);

    const switchSheetBy = (delta) => {
        if (visibleSheetNames.length < 2) return;
        const idx = visibleSheetNames.indexOf(activeSheetName);
        switchSheet(visibleSheetNames[(idx + delta + visibleSheetNames.length) % visibleSheetNames.length]);
        focusGrid();
    };

    const hideSheet = (name) => {
        if (readOnly) return;
        if (visibleSheetNames.length <= 1) { toast.error("A workbook needs at least one visible sheet."); return; }
        updateSheets((next) => { next[name].hidden = true; });
        if (name === activeSheetName) switchSheet(visibleSheetNames.find((n) => n !== name));
    };
    const unhideSheet = (name) => {
        if (readOnly) return;
        updateSheets((next) => { delete next[name].hidden; });
        switchSheet(name);
    };

    // --- Tables & AutoFilter ---

    const tableAt = (row, col) => tables.find((t) => {
        const s = parseCellRef(t.range.start), e = parseCellRef(t.range.end);
        return s && e && row >= Math.min(s.row, e.row) && row <= Math.max(s.row, e.row) && col >= Math.min(s.col, e.col) && col <= Math.max(s.col, e.col);
    });
    // The range a table/filter command acts on, like Excel: a single cell
    // grows to the data region around it; a selected header row (a slice such
    // as A1:D1, or the whole row via its row number) grows down to the last
    // contiguous data row; any taller selection is used exactly as selected.
    const regionForCommand = () => {
        const ref = parseCellRef(activeCell);
        if (!isMultiSelection) return currentRegion(ref.row, ref.col);
        if (selectionBounds.minRow !== selectionBounds.maxRow) return selectionBounds;
        const headerRow = selectionBounds.minRow;
        let { minCol, maxCol } = selectionBounds;
        if (minCol === 0 && maxCol === columnCount - 1) {
            // Whole row: narrow to the run of filled header cells around the
            // active column, or the first such run if that cell is empty.
            let start = hasContentAt(headerRow, ref.col) ? ref.col : -1;
            for (let c = 0; start < 0 && c < columnCount; c++) if (hasContentAt(headerRow, c)) start = c;
            if (start < 0) return selectionBounds;
            minCol = maxCol = start;
            while (minCol > 0 && hasContentAt(headerRow, minCol - 1)) minCol--;
            while (maxCol < columnCount - 1 && hasContentAt(headerRow, maxCol + 1)) maxCol++;
        }
        let maxRow = headerRow;
        const rowHasData = (r) => {
            for (let c = minCol; c <= maxCol; c++) if (hasContentAt(r, c)) return true;
            return false;
        };
        while (maxRow < rowCount - 1 && rowHasData(maxRow + 1)) maxRow++;
        return { minRow: headerRow, maxRow, minCol, maxCol };
    };

    // Ctrl+L / Ctrl+T: format the selection (or the data region around the
    // active cell) as a table with filter buttons.
    const formatAsTableShortcut = () => {
        if (!guardEditable()) return;
        const bounds = regionForCommand();
        if (bounds.minRow === bounds.maxRow) { toast.info("Select a range with a header row to format as a table."); return; }
        applyTable(selectedTableStyleKey, true, bounds);
        selectBounds(bounds);
    };

    // Ctrl+Shift+L: turn filter buttons on/off for the table under the
    // cursor, or add plain (unstyled) AutoFilter to the current region.
    const toggleAutoFilter = () => {
        if (!guardEditable()) return;
        const ref = parseCellRef(activeCell);
        const table = tableAt(ref.row, ref.col);
        if (table) {
            updateSheets((next) => {
                const sheet = next[activeSheetName];
                const t = (sheet.tables || []).find((x) => x.id === table.id);
                if (!t) return;
                // A plain AutoFilter is nothing but its filter buttons, so
                // turning it off removes it; a styled table just loses them.
                if (!t.styleKey && t.filtersEnabled) {
                    sheet.tables = sheet.tables.filter((x) => x.id !== table.id);
                    return;
                }
                t.filtersEnabled = !t.filtersEnabled;
                if (!t.filtersEnabled) t.filters = {};
            });
            return;
        }
        const bounds = regionForCommand();
        if (bounds.minRow === bounds.maxRow) { toast.info("Select a range with a header row to add filters."); return; }
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            if (!sheet.tables) sheet.tables = [];
            sheet.tables.push({
                id: `table-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                range: { start: getCellId(bounds.minRow, bounds.minCol), end: getCellId(bounds.maxRow, bounds.maxCol) },
                styleKey: null,
                filtersEnabled: true,
                filters: {},
            });
        });
    };

    // --- Insert / delete from the keyboard (Ctrl++ / Ctrl+-) ---

    const isFullRows = () => selectionBounds && selectionBounds.minCol === 0 && selectionBounds.maxCol === columnCount - 1;
    const isFullColumns = () => selectionBounds && selectionBounds.minRow === 0 && selectionBounds.maxRow === rowCount - 1;
    const runInsertDelete = (mode, kind) => {
        if (!selectionBounds) return;
        const { minRow, maxRow, minCol, maxCol } = selectionBounds;
        if (kind === "rows") (mode === "insert" ? insertRows : deleteRows)(minRow, maxRow - minRow + 1);
        else (mode === "insert" ? insertColumns : deleteColumns)(minCol, maxCol - minCol + 1);
    };
    const insertDeleteShortcut = (mode) => {
        if (!guardEditable() || !selectionBounds) return;
        if (isFullRows()) runInsertDelete(mode, "rows");
        else if (isFullColumns()) runInsertDelete(mode, "cols");
        else setInsertDeleteMode(mode);
    };

    // --- Formatting shortcuts ---

    const applyFormatShortcut = (numberFormat, decimalPlaces) => {
        if (!guardEditable()) return;
        applyToSelection((cell) => ({
            ...cell,
            numberFormat: numberFormat === "general" ? undefined : numberFormat,
            numberPattern: undefined,
            decimalPlaces: decimalPlaces ?? cell.decimalPlaces,
        }));
    };

    const applyFormatCellsPatch = (patch) => {
        if (!guardEditable()) return;
        applyToSelection((cell) => {
            const next = { ...cell, ...patch };
            for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
            return next;
        });
        focusGrid();
    };

    // --- Paste Special ---

    const applyPasteSpecial = ({ paste, operation, skipBlanks, transpose }) => {
        focusGrid();
        if (!clipboard) { toast.info("Copy some cells first (Ctrl+C)."); return; }
        if (clipboard.type === "cut") { toast.error("Paste Special works with copied cells, not cut ones."); return; }
        if (!guardEditable() || !selectionBounds) return;
        const { height, width, cellsByRelPos, valuesByRelPos = {}, sourceBounds } = clipboard;
        const outHeight = transpose ? width : height, outWidth = transpose ? height : width;
        const targetRow = selectionBounds.minRow, targetCol = selectionBounds.minCol;
        const OPS = {
            add: [(a, b) => a + b, "+"],
            subtract: [(a, b) => a - b, "-"],
            multiply: [(a, b) => a * b, "*"],
            divide: [(a, b) => (b === 0 ? null : a / b), "/"],
        };
        const asText = (v) => (v === true ? "TRUE" : v === false ? "FALSE" : v === null || v === undefined ? undefined : String(v));

        mutateActiveCells((next) => {
            for (let r = 0; r < outHeight; r++) {
                for (let c = 0; c < outWidth; c++) {
                    const [sr, sc] = transpose ? [c, r] : [r, c];
                    const key = `${sr},${sc}`;
                    const src = cellsByRelPos[key];
                    const srcValue = valuesByRelPos[key];
                    const srcIsBlank = (src?.value === undefined || src?.value === "") && srcValue === undefined;
                    if (skipBlanks && srcIsBlank) continue;

                    const tRow = targetRow + r, tCol = targetCol + c;
                    const id = getCellId(tRow, tCol);
                    const existing = next[id] || {};
                    const { value: _unused, ...srcFormat } = src || {};
                    let result;

                    if (paste === "formats") {
                        result = { ...srcFormat, value: existing.value };
                    } else {
                        let newValue;
                        if (paste === "values") newValue = asText(srcValue);
                        else if (src?.value !== undefined && src.value !== "") {
                            newValue = isFormula(src.value)
                                ? adjustFormula(src.value, tRow - (sourceBounds.minRow + sr), tCol - (sourceBounds.minCol + sc))
                                : src.value;
                        } else newValue = asText(srcValue); // spilled result: paste as a value

                        if (operation !== "none") {
                            if (typeof srcValue !== "number") continue; // text/blank sources leave the target alone
                            const [fn, symbol] = OPS[operation];
                            const targetRaw = existing.value;
                            if (isFormula(targetRaw)) {
                                newValue = `=(${String(targetRaw).trim().slice(1)})${symbol}${srcValue}`;
                            } else {
                                const current = targetRaw === undefined || targetRaw === "" ? 0 : Number(rawGrid[id]);
                                if (!Number.isFinite(current)) continue;
                                const combined = fn(current, srcValue);
                                if (combined === null) { newValue = "#DIV/0!"; }
                                else newValue = String(parseFloat(combined.toPrecision(15)));
                            }
                            result = { ...existing, value: newValue };
                        } else {
                            // "All" brings the source formatting along; formulas/values keep the target's.
                            result = paste === "all" ? { ...srcFormat, value: newValue } : { ...existing, value: newValue };
                        }
                    }
                    if (isBlankCell(result)) delete next[id]; else next[id] = result;
                }
            }
        });
        setSelection({ start: getCellId(targetRow, targetCol), end: getCellId(targetRow + outHeight - 1, targetCol + outWidth - 1) });
    };

    // --- Go To (Ctrl+G / F5) ---

    const goToReference = (text) => {
        const cleaned = String(text).trim().toUpperCase().replace(/\$/g, "");
        const [a, b = a] = cleaned.split(":");
        const s = parseCellRef(a || ""), e = parseCellRef(b || "");
        if (!s || !e) return "Enter a cell like B12 or a range like A1:D20.";
        const maxRow = Math.max(s.row, e.row), maxCol = Math.max(s.col, e.col);
        if (maxRow >= rowCount || maxCol >= columnCount) {
            if (readOnly || isSheetReadOnly) return `That's outside this sheet (last cell ${indexToCol(columnCount - 1)}${rowCount}).`;
            // Excel's grid is effectively unbounded — grow the sheet to reach it.
            updateSheets((next) => {
                const sheet = next[activeSheetName];
                sheet.rowCount = Math.max(sheet.rowCount, maxRow + 1);
                sheet.columnCount = Math.max(sheet.columnCount, maxCol + 1);
            });
        }
        const bounds = { minRow: Math.min(s.row, e.row), maxRow, minCol: Math.min(s.col, e.col), maxCol };
        selectBounds(bounds);
        requestAnimationFrame(() => scrollCellIntoView(getCellId(bounds.minRow, bounds.minCol)));
        focusGrid();
        return null;
    };

    // --- Print (Ctrl+P): just the used range of the active sheet ---

    const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    const printActiveSheet = () => {
        const { row: lastRow, col: lastCol } = lastUsedCell();
        const borderCss = (side, weight) => (weight ? `border-${side}:${weight === "thick" ? 2 : 1}px ${weight === "double" ? "double" : "solid"} #334155;` : "");
        let html = "<table><colgroup>";
        for (let c = 0; c <= lastCol; c++) if (!hiddenColSet.has(c)) html += `<col style="width:${widthForCol(c)}px">`;
        html += "</colgroup><tbody>";
        for (let r = 0; r <= lastRow; r++) {
            if (hiddenRowSet.has(r)) continue;
            html += `<tr style="height:${heightForRow(r)}px">`;
            for (let c = 0; c <= lastCol; c++) {
                if (hiddenColSet.has(c)) continue;
                const id = getCellId(r, c);
                const merge = mergeMap[id];
                if (merge && merge.start !== id) continue;
                const cell = cells[id];
                let spanAttrs = "";
                if (merge) {
                    const ms = parseCellRef(merge.start), me = parseCellRef(merge.end);
                    spanAttrs = ` rowspan="${me.row - ms.row + 1}" colspan="${me.col - ms.col + 1}"`;
                }
                const style = [
                    cell?.bold && "font-weight:bold;", cell?.italic && "font-style:italic;",
                    (cell?.underline || cell?.strike) && `text-decoration:${[cell.underline && "underline", cell.strike && "line-through"].filter(Boolean).join(" ")};`,
                    cell?.color && `color:${cell.color};`, cell?.bg && `background:${cell.bg};`,
                    cell?.fontSize && `font-size:${cell.fontSize}px;`, cell?.fontFamily && `font-family:${cell.fontFamily};`,
                    `text-align:${cell?.align || (typeof rawGrid[id] === "number" ? "right" : "left")};`,
                    `vertical-align:${cell?.valign || "middle"};`,
                    cell?.wrap ? "white-space:pre-wrap;" : "white-space:nowrap;",
                    ...["top", "bottom", "left", "right"].map((side) => borderCss(side, cell?.border?.[side])),
                ].filter(Boolean).join("");
                const text = showFormulas && isFormula(cell?.value) ? cell.value : (displayGrid[id] ?? "");
                html += `<td${spanAttrs} style="${style}">${escapeHtml(text)}</td>`;
            }
            html += "</tr>";
        }
        html += "</tbody></table>";

        const iframe = document.createElement("iframe");
        iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument;
        doc.open();
        doc.write(`<!doctype html><html><head><title>${escapeHtml(activeSheetName)}</title><style>
            body{font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;margin:16px;color:#0f172a}
            h1{font-size:14px;margin:0 0 8px}
            table{border-collapse:collapse;table-layout:fixed}
            td{padding:2px 6px;overflow:hidden;${gridlinesVisible ? "outline:1px solid #e2e8f0;" : ""}}
        </style></head><body><h1>${escapeHtml(activeSheetName)}</h1>${html}</body></html>`);
        doc.close();
        const cleanup = () => setTimeout(() => iframe.remove(), 500);
        iframe.contentWindow.addEventListener("afterprint", cleanup);
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(cleanup, 60000);
    };

    // --- Find panel openers ---

    const openFind = (focusReplace) => {
        setShowFindReplace(true);
        requestAnimationFrame(() => {
            const el = focusReplace && !readOnly ? replaceInputRef.current : findInputRef.current;
            el?.focus();
            el?.select();
        });
    };

    // --- Alt key tips (Alt+H, W · Alt+H, M, C · Alt+H, O, I/A · Alt+O, H, R/H/U) ---

    const KEY_TIP_TIMEOUT_MS = 3000;
    const [keyTipKeys, setKeyTipKeys] = useState(null);
    const KEY_TIP_COMMANDS = {
        HW: () => { if (guardEditable()) toggleWrap(); },
        HMC: () => { if (guardEditable()) mergeCenter(); },
        HOI: autoFitColumns,
        HOA: autoFitRows,
        OHR: () => { if (!readOnly) startRenameSheet(activeSheetName); },
        OHH: () => hideSheet(activeSheetName),
        OHU: () => { if (!readOnly) setUnhideSheetOpen(true); },
    };
    const endKeyTips = () => { keyTipRef.current = null; setKeyTipKeys(null); };
    const feedKeyTip = (letter) => {
        const keys = (keyTipRef.current?.keys || "") + letter;
        const command = KEY_TIP_COMMANDS[keys];
        if (command) { endKeyTips(); command(); return; }
        if (Object.keys(KEY_TIP_COMMANDS).some((k) => k.startsWith(keys))) {
            keyTipRef.current = { keys, at: Date.now() };
            setKeyTipKeys(keys);
            return;
        }
        endKeyTips();
    };

    const todayText = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const timeText = () => {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    // --- The dispatcher ---

    const handleKeyDown = (e) => {
        if (e.defaultPrevented || e.nativeEvent?.isComposing) return;
        const target = e.target;
        // Dialogs, open menus and dropdowns keep their own keyboard handling.
        if (target?.closest?.('[data-excel-dialog], [role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]')) return;

        const ctrl = e.ctrlKey || e.metaKey;
        const { shiftKey: shift, altKey: alt, key, code } = e;
        const handled = () => { e.preventDefault(); e.stopPropagation(); };
        const isEditor = target === cellEditInputRef.current || target === formulaBarInputRef.current;
        const isOtherField = !isEditor && (["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable);
        const onGrid = !!gridContainerRef.current && (target === gridContainerRef.current || gridContainerRef.current.contains(target)) && !isEditor;

        // Key-tip sequence in progress: plain letters continue it.
        if (keyTipRef.current && !ctrl) {
            if (Date.now() - keyTipRef.current.at > KEY_TIP_TIMEOUT_MS || key === "Escape") { endKeyTips(); if (key === "Escape") { handled(); return; } }
            else if (/^Key[A-Z]$/.test(code)) { handled(); feedKeyTip(code.slice(3)); return; }
            else if (!["Alt", "Shift", "Control", "Meta"].includes(key)) endKeyTips();
        }

        // ---- Workbook-level shortcuts: work from anywhere in the sheet ----
        if (key === "F1" && !ctrl && !shift) { handled(); setCheatSheetOpen(true); return; }
        if (key === "F1" && ctrl) { handled(); if (!readOnly) setIsToolbarExpanded((v) => !v); return; }
        if (ctrl && !alt && code === "KeyS") {
            handled();
            if (readOnly) return;
            if (editingCell) commitEdit();
            if (shift) handleExport(); else handleSave();
            return;
        }
        if (ctrl && !shift && !alt && code === "KeyP") { handled(); if (editingCell) commitEdit(); printActiveSheet(); return; }

        if (isOtherField) {
            // Other text fields (Name box, find inputs, sheet rename, ...) keep
            // their normal typing; only Ctrl+F/H jumps between find inputs.
            if (ctrl && !shift && (code === "KeyF" || code === "KeyH")) { handled(); openFind(code === "KeyH"); }
            return;
        }

        // ---- While editing a cell ----
        if (isEditor) {
            if (key === "Enter" && alt) { handled(); insertIntoEditor(target, "\n"); return; }
            if (key === "Enter" && ctrl) { handled(); commitEditToSelection(); return; }
            if (key === "Enter") { handled(); commitAndMove(shift ? -1 : 1, 0); return; }
            if (key === "Tab") { handled(); commitAndMove(0, shift ? -1 : 1); return; }
            if (key === "Escape") { handled(); cancelEdit(); focusGrid(); return; }
            if (key === "F4" && isFormula(editValue)) {
                handled();
                const result = cycleReferenceAt(editValue, target.selectionStart ?? editValue.length);
                if (result) {
                    setEditValue(result.text);
                    formulaInsertRange.current = null;
                    requestAnimationFrame(() => { target.focus(); target.setSelectionRange(result.start, result.end); });
                }
                return;
            }
            if (ctrl && code === "Semicolon") { handled(); insertIntoEditor(target, shift ? timeText() : todayText()); return; }
            return; // everything else is ordinary typing
        }

        const ref = parseCellRef(activeCell);
        if (!ref) return;
        const edit = !readOnly; // mutating commands are skipped entirely in view mode

        // ---- Shortcuts that work with focus on the grid or on a ribbon control ----
        if (ctrl && alt && !shift && code === "KeyV") { handled(); if (edit) setPasteSpecialOpen(true); return; }
        if (ctrl && !alt) {
            switch (code) {
                case "KeyC": if (!shift) { handled(); copySelection("copy"); return; } break;
                case "KeyX": if (!shift && edit) { handled(); copySelection("cut"); return; } break;
                case "KeyZ": if (edit) { handled(); if (shift) redo(); else undo(); return; } break;
                case "KeyY": if (!shift && edit) { handled(); redo(); return; } break;
                case "KeyF": handled(); if (shift) { if (edit) setFormatCellsOpen(true); } else openFind(false); return;
                case "KeyH": if (!shift) { handled(); openFind(true); return; } break;
                case "KeyG": if (!shift) { handled(); setGoToOpen(true); return; } break;
                case "KeyO": if (!shift) { handled(); if (edit) handleImportClick(); return; } break;
                case "KeyB": if (!shift) { handled(); if (guardEditable()) toggleStyle("bold"); return; } break;
                case "KeyI": if (!shift) { handled(); if (guardEditable()) toggleStyle("italic"); return; } break;
                case "KeyU": if (!shift) { handled(); if (guardEditable()) toggleStyle("underline"); return; } break;
                case "KeyD": if (!shift) { handled(); fillFromEdge("down"); return; } break;
                case "KeyR": if (!shift) { handled(); fillFromEdge("right"); return; } break;
                case "KeyL": handled(); if (shift) toggleAutoFilter(); else formatAsTableShortcut(); return;
                case "KeyT": if (!shift) { handled(); formatAsTableShortcut(); return; } break;
                case "KeyA": if (!shift) {
                    handled();
                    const region = currentRegion(ref.row, ref.col);
                    const regionIsCurrent = selectionBounds && region.minRow === selectionBounds.minRow && region.maxRow === selectionBounds.maxRow
                        && region.minCol === selectionBounds.minCol && region.maxCol === selectionBounds.maxCol;
                    const regionIsSingle = region.minRow === region.maxRow && region.minCol === region.maxCol;
                    if (regionIsCurrent || regionIsSingle) selectAllCells(); else selectBounds(region, activeCell);
                    return;
                } break;
                case "Backquote": handled(); if (shift) applyFormatShortcut("general"); else setShowFormulas((v) => !v); return;
                case "Digit1": handled(); if (shift) applyFormatShortcut("comma", 2); else if (edit) setFormatCellsOpen(true); return;
                case "Digit2": if (shift) { handled(); applyFormatShortcut("time"); return; } break;
                case "Digit3": if (shift) { handled(); applyFormatShortcut("date"); return; } break;
                case "Digit4": if (shift) { handled(); applyFormatShortcut("currency", 2); return; } break;
                case "Digit5": handled(); if (shift) applyFormatShortcut("percentage", 2); else if (guardEditable()) toggleStyle("strike"); return;
                case "Digit6": if (shift) { handled(); applyFormatShortcut("scientific", 2); return; } break;
                case "Digit9": handled(); if (shift) unhideSelectedRows(); else hideSelectedRows(); return;
                case "Digit0": handled(); if (shift) unhideSelectedColumns(); else hideSelectedColumns(); return;
                case "Equal": if (shift) { handled(); insertDeleteShortcut("insert"); return; } break;
                case "NumpadAdd": handled(); insertDeleteShortcut("insert"); return;
                case "Minus":
                case "NumpadSubtract": if (!shift) { handled(); insertDeleteShortcut("delete"); return; } break;
                case "Semicolon": handled(); if (guardEditable()) startEditing(activeCell, shift ? timeText() : todayText()); return;
                case "Space": handled(); if (shift) selectAllCells(); else selectColumn(ref.col); return;
                case "PageUp": handled(); switchSheetBy(-1); return;
                case "PageDown": handled(); switchSheetBy(1); return;
                default: break;
            }
        }
        if (ctrl && alt) {
            if (code === "PageUp") { handled(); switchSheetBy(-1); return; }
            if (code === "PageDown") { handled(); switchSheetBy(1); return; }
            if (code === "Digit9") { handled(); hideSelectedRows(); return; }
        }
        if (alt && !ctrl) {
            if (shift && code === "Digit5") { handled(); if (guardEditable()) toggleStyle("strike"); return; }
            if (shift && key === "F1") { handled(); if (edit) addSheet(); return; }
            if (!shift && code === "Equal") { handled(); if (guardEditable()) insertAutoSum("SUM"); return; }
            if (!shift && (code === "KeyH" || code === "KeyO")) {
                handled();
                keyTipRef.current = { keys: code.slice(3), at: Date.now() };
                setKeyTipKeys(code.slice(3));
                return;
            }
        }
        if (key === "F11" && shift) { handled(); if (edit) addSheet(); return; }
        if (key === "F9") { handled(); setRecalcSeed((s) => s + 1); return; }
        if (key === "F5" && !ctrl) { handled(); setGoToOpen(true); return; }

        // ---- Grid-only keys (arrows, typing, Enter, Delete…) ----
        if (!onGrid) return;

        const cursor = shift ? (parseCellRef(selection.end) || ref) : ref;
        const arrow = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[key];
        if (arrow && !alt) {
            handled();
            const pos = ctrl ? edgeFrom(cursor.row, cursor.col, arrow[0], arrow[1]) : stepFrom(cursor.row, cursor.col, arrow[0], arrow[1]);
            moveTo(pos, shift);
            return;
        }
        switch (key) {
            case "Home":
                handled();
                moveTo(ctrl ? { row: 0, col: 0 } : { row: cursor.row, col: 0 }, shift);
                return;
            case "End":
                if (ctrl) { handled(); moveTo(lastUsedCell(), shift); }
                return;
            case "PageDown":
            case "PageUp": {
                handled();
                const dir = key === "PageDown" ? 1 : -1;
                const pos = alt ? stepFrom(cursor.row, cursor.col, 0, dir, pageCols()) : stepFrom(cursor.row, cursor.col, dir, 0, pageRows());
                moveTo(pos, shift);
                if (shift) scrollCellIntoView(getCellId(pos.row, pos.col));
                return;
            }
            case "Tab":
                handled();
                moveTo(stepFrom(ref.row, ref.col, 0, shift ? -1 : 1), false);
                return;
            case "Enter":
                handled();
                if (alt || ctrl) return;
                moveTo(stepFrom(ref.row, ref.col, shift ? -1 : 1, 0), false);
                return;
            case "F2":
                handled();
                if (edit) startEditing(activeCell);
                return;
            case "Escape":
                handled();
                // Nothing left to clear → Escape leaves full screen, so a first
                // press collapses the selection and a second one exits.
                if (isFullScreen && selection.start === activeCell && selection.end === activeCell && !hasMultipleRanges
                    && clipboard?.type !== "cut" && !formatPainterStyle && !selectedMediaId) {
                    exitFullScreen();
                    return;
                }
                setSelection({ start: activeCell, end: activeCell });
                setClipboard((c) => (c?.type === "cut" ? null : c));
                setFormatPainterStyle(null);
                setSelectedMediaId(null);
                return;
            case "Delete":
            case "Backspace":
                handled();
                if (selectedMediaId) { if (edit) handleDeleteMedia(selectedMediaId); return; }
                if (edit && !isSheetReadOnly) clearSelectedCells();
                else if (edit) guardEditable();
                return;
            default: break;
        }
        if (key === " " && shift && !ctrl && !alt) { handled(); selectRow(ref.row); return; }
        if (edit && key.length === 1 && !ctrl && !alt) {
            handled();
            startEditing(activeCell, key);
        }
    };

    // Status bar: quick totals for a multi-cell selection (visible cells only).
    // Computed from a deferred copy of the selection, so totalling a very large
    // range never holds up the selection highlight itself while dragging.
    const statsBounds = useDeferredValue(allSelectionBounds);
    const selectionStats = useMemo(() => {
        const inEarlier = (row, col, upTo) => {
            for (let j = 0; j < upTo; j++) {
                const p = statsBounds[j];
                if (row >= p.minRow && row <= p.maxRow && col >= p.minCol && col <= p.maxCol) return true;
            }
            return false;
        };
        let area = 0;
        for (const b of statsBounds) area += (b.maxRow - b.minRow + 1) * (b.maxCol - b.minCol + 1);
        if (area < 2) return null;

        let count = 0, numericCount = 0, sum = 0, min = Infinity, max = -Infinity;
        const add = (id, row, col) => {
            if (hiddenRowSet.has(row) || hiddenColSet.has(col)) return;
            const typed = cells[id]?.value;
            if ((typed === undefined || typed === "") && !evaluation.spillAnchors.has(id)) return;
            const v = rawGrid[id];
            if (v === undefined) return;
            count++;
            if (typeof v === "number" && Number.isFinite(v)) {
                numericCount++;
                sum += v;
                if (v < min) min = v;
                if (v > max) max = v;
            }
        };
        if (area <= SELECTION_SCAN_LIMIT) {
            statsBounds.forEach((b, i) => {
                for (let r = b.minRow; r <= b.maxRow; r++) {
                    for (let c = b.minCol; c <= b.maxCol; c++) {
                        if (!inEarlier(r, c, i)) add(getCellId(r, c), r, c); // overlapping ranges count once
                    }
                }
            });
        } else {
            const visit = (id) => {
                const pos = cellPosOf(id);
                if (pos < 0) return;
                const col = pos % CELL_POS_STRIDE, row = (pos - col) / CELL_POS_STRIDE;
                if (inEarlier(row, col, statsBounds.length)) add(id, row, col);
            };
            for (const id in cells) visit(id);
            for (const id of evaluation.spillAnchors.keys()) if (!Object.prototype.hasOwnProperty.call(cells, id)) visit(id);
        }
        if (!count) return null;
        return { count, numericCount, sum, min, max, average: numericCount ? sum / numericCount : null };
    }, [statsBounds, rawGrid, cells, evaluation, hiddenRowSet, hiddenColSet]);
    const formatStat = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });


    const defaultPivotSourceRange = selectionBounds
        ? `${getCellId(selectionBounds.minRow, selectionBounds.minCol)}:${getCellId(selectionBounds.maxRow, selectionBounds.maxCol)}`
        : "";

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <IconLoader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <FullScreenFrame isFullScreen={isFullScreen} onExit={exitFullScreen} title="Spreadsheet" icon={IconTable}>
        <div
            className={cn("w-full", isFullScreen && "flex-1 min-h-0 flex flex-col [&>*]:shrink-0 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden")}
            ref={rootRef}
            onKeyDown={handleKeyDown}
        >
            {!readOnly && (
            <>
            {/* Quick access row */}
            <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-slate-200 bg-white rounded-t-lg">
                <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={undo} disabled={historyPast.current.length === 0} title="Undo (Ctrl+Z)">
                    <IconArrowBackUp className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={redo} disabled={historyFuture.current.length === 0} title="Redo (Ctrl+Y)">
                    <IconArrowForwardUp className="w-4 h-4" />
                </Button>
                <div className="flex-1" />
                {keyTipKeys && (
                    <span className="text-[11px] font-mono px-2 py-1 rounded bg-slate-800 text-white" title="Keep typing the key-tip letters (Esc cancels)">
                        Alt+{keyTipKeys.split("").join(", ")} …
                    </span>
                )}
                <Button
                    variant="ghost" size="sm" className={cn("h-8 cursor-pointer", showFormulas && "bg-indigo-100 text-indigo-700 hover:bg-indigo-100")}
                    onClick={() => setShowFormulas((v) => !v)} title="Show formulas instead of results (Ctrl+`)"
                >
                    <IconMathFunction className="w-4 h-4" /> Formulas
                </Button>
                <Button variant="ghost" size="sm" className="h-8 cursor-pointer" onClick={printActiveSheet} title="Print this sheet (Ctrl+P)">
                    <IconPrinter className="w-4 h-4" /> Print
                </Button>
                <Button
                    variant="ghost" size="sm" className={cn("h-8 cursor-pointer", !gridlinesVisible && "bg-indigo-100 text-indigo-700 hover:bg-indigo-100")}
                    onClick={() => setGridlinesVisible((v) => !v)} title="Toggle gridlines"
                >
                    <IconBorderAll className="w-4 h-4" /> Gridlines
                </Button>
                <Button
                    variant="ghost" size="sm" className={cn("h-8 cursor-pointer", showFindReplace && "bg-indigo-100 text-indigo-700 hover:bg-indigo-100")}
                    onClick={() => setShowFindReplace((v) => !v)} title="Find & replace"
                >
                    <IconSearch className="w-4 h-4" /> Find
                </Button>
                <Button variant="outline" size="sm" className="h-8 cursor-pointer" onClick={handleImportClick} disabled={!!ioProgress} title="Import from Excel">
                    <IconUpload className="w-4 h-4" /> Import
                </Button>
                <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleImportFile} />
                <Button variant="outline" size="sm" className="h-8 cursor-pointer" onClick={handleExport} disabled={!!ioProgress} title="Export to Excel">
                    <IconDownload className="w-4 h-4" /> Export
                </Button>
                <div className="w-[1px] h-6 bg-slate-200 mx-1 shrink-0" />
                <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-slate-500 hover:bg-slate-100 shrink-0" onClick={() => setCheatSheetOpen(true)} title="Shortcuts & functions cheat sheet (F1)">
                    <IconHelpCircle className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer text-slate-500 hover:bg-slate-100 shrink-0"
                    onClick={() => setIsToolbarExpanded((v) => !v)}
                    title={isToolbarExpanded ? "Collapse ribbon (Ctrl+F1)" : "Expand ribbon (Ctrl+F1)"}
                >
                    {isToolbarExpanded ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer text-slate-500 hover:bg-slate-100 shrink-0"
                    onClick={() => toggleFullScreen()}
                    title={isFullScreen ? "Exit full screen (Esc)" : "Full screen"}
                >
                    {isFullScreen ? <IconMinimize className="w-4 h-4" /> : <IconMaximize className="w-4 h-4" />}
                </Button>
            </div>

            {/* Ribbon tabs — Home mirrors Excel's Home tab; Insert holds PivotTable / media */}
            <div className="flex items-end gap-1 px-2 border-b border-slate-200 bg-white select-none">
                {[["home", "Home"], ["insert", "Insert"]].map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => { setRibbonTab(key); setIsToolbarExpanded(true); }}
                        className={cn(
                            "relative px-3 pt-1.5 pb-2 text-[13px] cursor-pointer rounded-t-sm hover:bg-slate-100",
                            ribbonTab === key && isToolbarExpanded ? "text-[#107C41] font-semibold" : "text-slate-600"
                        )}
                    >
                        {label}
                        {ribbonTab === key && isToolbarExpanded && <span className="absolute left-2 right-2 bottom-0 h-[3px] rounded-full bg-[#107C41]" />}
                    </button>
                ))}
            </div>

            {/* Ribbon */}
            <div className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden",
                isToolbarExpanded ? "max-h-[160px] opacity-100" : "max-h-0 opacity-0"
            )}>
            {ribbonTab === "home" ? (
            <div className="flex items-stretch border-b border-slate-200 bg-[#f8f8f8] overflow-x-auto themed-scrollbar">
                {/* File */}
                <RibbonGroup label="File">
                    <RibbonBtn large title="Save (Ctrl+S)" onClick={handleSave} disabled={isSaving}>
                        {isSaving
                            ? <IconLoader2 className="w-8 h-8 animate-spin text-indigo-600" strokeWidth={1.4} />
                            : <IconDeviceFloppy className="w-8 h-8 text-indigo-600" strokeWidth={1.4} />}
                        <span className="text-xs">{isSaving ? "Saving…" : `Save${isDirty ? " *" : ""}`}</span>
                    </RibbonBtn>
                </RibbonGroup>

                {/* Clipboard */}
                <RibbonGroup label="Clipboard" onLauncher={() => setPasteSpecialOpen(true)} launcherTitle="Paste Special (Ctrl+Alt+V)">
                    <RibbonSplit
                        large
                        title="Paste (Ctrl+V)"
                        onClick={handlePaste}
                        disabled={!clipboard}
                        face={<><IconClipboardText className="w-8 h-8 text-amber-700" strokeWidth={1.4} /><span className="text-xs">Paste</span></>}
                        menuTitle="Paste options"
                    >
                        <MenuItem icon={IconClipboard} label="Paste" shortcut="Ctrl+V" onClick={handlePaste} disabled={!clipboard} />
                        <MenuItem icon={IconClipboardList} label="Paste Special..." shortcut="Ctrl+Alt+V" onClick={() => setPasteSpecialOpen(true)} disabled={!clipboard} />
                    </RibbonSplit>
                    <RibbonStack>
                        <RibbonBtn title="Cut (Ctrl+X)" onClick={() => copySelection("cut")}><IconScissors className="w-4 h-4" strokeWidth={1.5} /></RibbonBtn>
                        <RibbonDropdown title="Copy (Ctrl+C)" trigger={<IconCopy className="w-4 h-4" strokeWidth={1.5} />}>
                            <MenuItem icon={IconCopy} label="Copy" shortcut="Ctrl+C" onClick={() => copySelection("copy")} />
                            <MenuItem icon={IconScissors} label="Cut" shortcut="Ctrl+X" onClick={() => copySelection("cut")} />
                        </RibbonDropdown>
                        <RibbonBtn title="Format Painter — click a cell to apply" active={!!formatPainterStyle} onClick={activateFormatPainter}>
                            <IconBrush className="w-4 h-4 text-amber-600" strokeWidth={1.5} />
                        </RibbonBtn>
                    </RibbonStack>
                </RibbonGroup>

                {/* Font */}
                <RibbonGroup label="Font" onLauncher={() => { setFormatCellsTab("font"); setFormatCellsOpen(true); }} launcherTitle="Format Cells: Font (Ctrl+Shift+F)">
                    <RibbonStack className="gap-1.5 justify-start pt-1">
                        <RibbonRow className="gap-1">
                            <RibbonCombo
                                className="w-[140px]"
                                title="Font"
                                value={activeCellData?.fontFamily || ""}
                                placeholder="Aptos Narrow"
                                options={FONT_FAMILIES}
                                onCommit={setFontFamily}
                                renderOption={(f) => <span style={{ fontFamily: `${f}, sans-serif` }} className="text-[13px]">{f}</span>}
                            />
                            <RibbonCombo
                                className="w-[58px]"
                                title="Font Size"
                                value={activeCellData?.fontSize ?? DEFAULT_FONT_SIZE}
                                options={FONT_SIZES}
                                onCommit={setFontSize}
                                inputMode="numeric"
                            />
                            <RibbonBtn title="Increase Font Size" onClick={() => stepFontSize(1)}>
                                <span className="text-[15px] leading-none text-slate-700">A<sup className="text-[9px] -top-1.5 relative">^</sup></span>
                            </RibbonBtn>
                            <RibbonBtn title="Decrease Font Size" onClick={() => stepFontSize(-1)}>
                                <span className="text-[12px] leading-none text-slate-700">A<sup className="text-[8px] relative -top-1">ˇ</sup></span>
                            </RibbonBtn>
                        </RibbonRow>
                        <RibbonRow className="gap-0.5">
                            <RibbonBtn title="Bold (Ctrl+B)" active={!!activeCellData?.bold} onClick={() => toggleStyle("bold")}><IconBold className="w-4 h-4" /></RibbonBtn>
                            <RibbonBtn title="Italic (Ctrl+I)" active={!!activeCellData?.italic} onClick={() => toggleStyle("italic")}><IconItalic className="w-4 h-4" /></RibbonBtn>
                            <RibbonSplit
                                title="Underline (Ctrl+U)"
                                active={!!activeCellData?.underline}
                                onClick={() => setUnderlineStyle(true)}
                                face={<IconUnderline className="w-4 h-4" />}
                                contentClassName="w-48"
                            >
                                <MenuItem label="Underline" checked={activeCellData?.underline === true} icon={IconUnderline} onClick={() => setUnderlineStyle(true)} />
                                <MenuItem label="Double Underline" checked={activeCellData?.underline === "double"} onClick={() => setUnderlineStyle("double")} style={{ textDecoration: "underline double" }} />
                                <MenuSeparator />
                                <MenuItem label="Strikethrough" checked={!!activeCellData?.strike} icon={IconStrikethrough} shortcut="Ctrl+5" onClick={() => toggleStyle("strike")} />
                            </RibbonSplit>
                            <RibbonDivider />
                            <RibbonSplit
                                title={lastBorderPreset.label}
                                onClick={() => applyBorderPreset(lastBorderPreset)}
                                face={<lastBorderPreset.icon className="w-4 h-4" strokeWidth={1.5} />}
                                menuTitle="Borders"
                            >
                                <MenuHeader>Borders</MenuHeader>
                                {BORDER_PRESETS.map((preset, i) => preset ? (
                                    <MenuItem key={preset.key} icon={preset.icon} label={preset.label} onClick={() => { setLastBorderPreset(preset); applyBorderPreset(preset); }} />
                                ) : <MenuSeparator key={`sep-${i}`} />)}
                                <MenuHeader>Line Style</MenuHeader>
                                {BORDER_WEIGHTS.map((w) => (
                                    <MenuItem key={w.value} label={w.label} checked={borderWeight === w.value} onClick={() => setBorderWeight(w.value)} />
                                ))}
                                <MenuSeparator />
                                <MenuItem icon={IconBorderAll} label="More Borders..." onClick={() => { setFormatCellsTab("border"); setFormatCellsOpen(true); }} />
                            </RibbonSplit>
                            <RibbonDivider />
                            <ColorSplitButton
                                title="Fill Color"
                                icon={<IconBucketDroplet className="w-4 h-4" strokeWidth={1.5} />}
                                color={lastFillColor}
                                value={activeCellData?.bg}
                                onApply={(c) => { setLastFillColor(c); setBg(c); }}
                                autoLabel="No Fill"
                                onAuto={() => setBg(undefined)}
                                autoIcon={IconX}
                            />
                            <ColorSplitButton
                                title="Font Color"
                                icon={<span className="text-[14px] font-semibold leading-[14px] text-slate-800">A</span>}
                                color={lastFontColor}
                                value={activeCellData?.color}
                                onApply={(c) => { setLastFontColor(c); setColor(c); }}
                                autoLabel="Automatic"
                                onAuto={() => setColor(undefined)}
                            />
                        </RibbonRow>
                    </RibbonStack>
                </RibbonGroup>

                {/* Alignment */}
                <RibbonGroup label="Alignment" onLauncher={() => { setFormatCellsTab("alignment"); setFormatCellsOpen(true); }} launcherTitle="Format Cells: Alignment">
                    <RibbonStack className="gap-1.5 justify-start pt-1">
                        <RibbonRow>
                            <RibbonBtn title="Top Align" active={activeCellData?.valign === "top"} onClick={() => setValign("top")}><IconLayoutAlignTop className="w-4 h-4" strokeWidth={1.5} /></RibbonBtn>
                            <RibbonBtn title="Middle Align" active={!activeCellData?.valign || activeCellData?.valign === "middle"} onClick={() => setValign("middle")}><IconLayoutAlignMiddle className="w-4 h-4" strokeWidth={1.5} /></RibbonBtn>
                            <RibbonBtn title="Bottom Align" active={activeCellData?.valign === "bottom"} onClick={() => setValign("bottom")}><IconLayoutAlignBottom className="w-4 h-4" strokeWidth={1.5} /></RibbonBtn>
                            <RibbonDropdown title="Orientation" trigger={<IconTextOrientation className="w-4 h-4 text-slate-700" strokeWidth={1.5} />} contentClassName="w-60">
                                {ORIENTATION_OPTIONS.map((o) => (
                                    <MenuItem key={o.value} label={o.label} checked={activeCellData?.rotation === o.value} onClick={() => setRotation(o.value)} />
                                ))}
                                <MenuSeparator />
                                <MenuItem icon={IconTextOrientation} label="Format Cell Alignment" onClick={() => { setFormatCellsTab("alignment"); setFormatCellsOpen(true); }} />
                            </RibbonDropdown>
                        </RibbonRow>
                        <RibbonRow>
                            <RibbonBtn title="Align Left" active={activeCellData?.align === "left" || !activeCellData?.align} onClick={() => setAlign("left")}><IconAlignLeft className="w-4 h-4" strokeWidth={1.5} /></RibbonBtn>
                            <RibbonBtn title="Center" active={activeCellData?.align === "center"} onClick={() => setAlign("center")}><IconAlignCenter className="w-4 h-4" strokeWidth={1.5} /></RibbonBtn>
                            <RibbonBtn title="Align Right" active={activeCellData?.align === "right"} onClick={() => setAlign("right")}><IconAlignRight className="w-4 h-4" strokeWidth={1.5} /></RibbonBtn>
                            <RibbonBtn title="Decrease Indent" disabled={!activeCellData?.indent} onClick={() => adjustIndent(-1)}><IconIndentDecrease className="w-4 h-4" strokeWidth={1.5} /></RibbonBtn>
                            <RibbonBtn title="Increase Indent" onClick={() => adjustIndent(1)}><IconIndentIncrease className="w-4 h-4" strokeWidth={1.5} /></RibbonBtn>
                        </RibbonRow>
                    </RibbonStack>
                    <RibbonDivider />
                    <RibbonStack className="gap-1.5 justify-start pt-1">
                        <RibbonRow>
                            <RibbonBtn title="Wrap Text" active={!!activeCellData?.wrap} onClick={toggleWrap}><IconTextWrap className="w-4 h-4" strokeWidth={1.5} /></RibbonBtn>
                        </RibbonRow>
                        <RibbonRow>
                            <RibbonSplit title="Merge & Center" onClick={mergeCenter} face={<IconArrowAutofitWidth className="w-4 h-4 text-blue-700" strokeWidth={1.5} />} menuTitle="Merge options" contentClassName="w-48">
                                <MenuItem icon={IconArrowAutofitWidth} label="Merge & Center" onClick={mergeCenter} />
                                <MenuItem icon={IconLayoutGrid} label="Unmerge Cells" onClick={unmergeCells} />
                            </RibbonSplit>
                        </RibbonRow>
                    </RibbonStack>
                </RibbonGroup>

                {/* Number */}
                <RibbonGroup label="Number" onLauncher={() => { setFormatCellsTab("number"); setFormatCellsOpen(true); }} launcherTitle="Format Cells: Number">
                    <RibbonStack className="gap-1 justify-start pt-1">
                        <RibbonDropdown
                            title="Number Format"
                            buttonClassName="w-[118px] justify-between border border-slate-300 bg-white hover:bg-white hover:border-slate-400"
                            trigger={<span className="flex-1 text-left text-xs text-slate-800 truncate">{NUMBER_FORMATS.find((f) => f.value === (activeCellData?.numberFormat || "general"))?.label || NUMBER_FORMAT_LABELS[activeCellData?.numberFormat] || "General"}</span>}
                            contentClassName="w-52 max-h-80 overflow-y-auto"
                        >
                            {NUMBER_FORMATS.map((f) => (
                                <MenuItem key={f.value} label={f.label} checked={(activeCellData?.numberFormat || "general") === f.value} onClick={() => setNumberFormat(f.value)} />
                            ))}
                            <MenuSeparator />
                            <MenuItem label="More Number Formats..." onClick={() => { setFormatCellsTab("number"); setFormatCellsOpen(true); }} />
                        </RibbonDropdown>
                        <RibbonRow className="gap-0.5">
                            <RibbonSplit title="Accounting Number Format" onClick={() => setNumberFormat("accounting")} face={<IconCash className="w-4 h-4 text-emerald-700" strokeWidth={1.5} />} contentClassName="w-52">
                                <MenuItem label="Accounting" checked={activeCellData?.numberFormat === "accounting"} onClick={() => setNumberFormat("accounting")} />
                                <MenuItem label="Currency" checked={activeCellData?.numberFormat === "currency"} onClick={() => setNumberFormat("currency")} />
                                <MenuSeparator />
                                <MenuItem label="More Accounting Formats..." onClick={() => { setFormatCellsTab("number"); setFormatCellsOpen(true); }} />
                            </RibbonSplit>
                            <RibbonBtn title="Percent Style (Ctrl+Shift+%)" onClick={() => setNumberFormat("percentage")}><IconPercentage className="w-4 h-4" strokeWidth={1.75} /></RibbonBtn>
                            <RibbonBtn title="Comma Style" onClick={() => setNumberFormat("comma")}><span className="text-[17px] font-bold leading-none -mt-1.5">,</span></RibbonBtn>
                        </RibbonRow>
                        <RibbonRow className="gap-0.5">
                            <RibbonBtn title="Increase Decimal" onClick={() => adjustDecimals(1)}><DecimalIcon increase /></RibbonBtn>
                            <RibbonBtn title="Decrease Decimal" onClick={() => adjustDecimals(-1)}><DecimalIcon /></RibbonBtn>
                        </RibbonRow>
                    </RibbonStack>
                </RibbonGroup>

                {/* Styles */}
                <RibbonGroup label="Styles">
                    <RibbonStack className="items-start">
                        <RibbonDropdown title="Conditional Formatting" trigger={<><CondFormatIcon /><span className="text-xs">Conditional Formatting</span></>} contentClassName="w-64 p-2">
                            <MenuClose>{(close) => (
                                <div className="space-y-2">
                                    <div className="text-[11px] font-semibold text-slate-600">Highlight Cells Rules — value is:</div>
                                    <div className="flex items-center gap-1">
                                        <select className="h-7 text-xs border border-slate-200 rounded px-1 cursor-pointer" value={condOperator} onChange={(e) => setCondOperator(e.target.value)}>
                                            <option value=">">Greater Than</option>
                                            <option value="<">Less Than</option>
                                            <option value=">=">Greater or Equal</option>
                                            <option value="<=">Less or Equal</option>
                                            <option value="=">Equal To</option>
                                        </select>
                                        <input type="number" className="h-7 text-xs border border-slate-200 rounded px-1.5 w-16" value={condThreshold} onChange={(e) => setCondThreshold(e.target.value)} placeholder="value" />
                                        <input type="color" className="w-6 h-6 cursor-pointer" value={condColor} onChange={(e) => setCondColor(e.target.value)} title="Highlight color" />
                                    </div>
                                    <div className="flex gap-1.5">
                                        <Button size="sm" className="h-7 text-xs flex-1 cursor-pointer" onClick={() => { addConditionalRule(); close(); }}>Apply</Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs cursor-pointer" onClick={() => { clearConditionalRules(); close(); }}>Clear Rules</Button>
                                    </div>
                                </div>
                            )}</MenuClose>
                        </RibbonDropdown>
                        <RibbonDropdown title="Format as Table (Ctrl+T)" trigger={<><FormatTableIcon /><span className="text-xs">Format as Table</span></>} contentClassName="w-64 p-2">
                            <MenuClose>{(close) => (
                                <div className="space-y-2">
                                    <div className="text-[11px] font-semibold text-slate-500">Table Styles</div>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {TABLE_STYLE_PRESETS.map((preset) => (
                                            <button
                                                key={preset.key}
                                                title={preset.label}
                                                onClick={() => setSelectedTableStyleKey(preset.key)}
                                                className={cn(
                                                    "rounded p-0.5 cursor-pointer border",
                                                    selectedTableStyleKey === preset.key ? "border-indigo-500 ring-1 ring-indigo-300" : "border-transparent hover:border-slate-200"
                                                )}
                                            >
                                                <TableStyleSwatch preset={preset} />
                                            </button>
                                        ))}
                                    </div>
                                    <label className="flex items-center gap-2 px-1 pt-1 cursor-pointer">
                                        <Checkbox checked={tableFiltersEnabled} onCheckedChange={(v) => setTableFiltersEnabled(!!v)} />
                                        <span className="text-xs text-slate-700 select-none">My table has filter buttons</span>
                                    </label>
                                    <Button
                                        size="sm"
                                        className="w-full h-7 text-xs cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white"
                                        onClick={() => { applyTable(selectedTableStyleKey, tableFiltersEnabled, regionForCommand()); close(); }}
                                    >
                                        Apply
                                    </Button>
                                </div>
                            )}</MenuClose>
                        </RibbonDropdown>
                        <RibbonDropdown title="Cell Styles" trigger={<><CellStylesIcon /><span className="text-xs">Cell Styles</span></>} contentClassName="w-72 p-2">
                            <MenuClose>{(close) => (
                                <div className="grid grid-cols-3 gap-1.5">
                                    {CELL_STYLE_PRESETS.map((preset) => (
                                        <button
                                            key={preset.key}
                                            className="h-8 px-2 text-xs text-left border border-slate-200 hover:outline hover:outline-2 hover:outline-amber-400 cursor-pointer truncate"
                                            style={{
                                                backgroundColor: preset.style.bg || "#fff",
                                                color: preset.style.color || "#0f172a",
                                                fontWeight: preset.style.bold ? 700 : 400,
                                                borderTop: preset.style.border?.top ? "2px solid #334155" : undefined,
                                            }}
                                            onClick={() => { applyCellStylePreset(preset); close(); }}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            )}</MenuClose>
                        </RibbonDropdown>
                    </RibbonStack>
                </RibbonGroup>

                {/* Cells */}
                <RibbonGroup label="Cells">
                    <RibbonStack className="items-start">
                        <RibbonSplit title="Insert (Ctrl++)" onClick={() => insertDeleteShortcut("insert")} disabled={isSheetReadOnly} face={<><IconTablePlus className="w-4 h-4 text-blue-700" strokeWidth={1.5} /><span className="text-xs ml-1">Insert</span></>}>
                            <MenuItem icon={IconTablePlus} label="Insert Cells..." shortcut="Ctrl++" onClick={() => setInsertDeleteMode("insert")} />
                            <MenuItem icon={IconRowInsertTop} label="Insert Sheet Rows" onClick={() => runInsertDelete("insert", "rows")} />
                            <MenuItem icon={IconColumnInsertLeft} label="Insert Sheet Columns" onClick={() => runInsertDelete("insert", "cols")} />
                            <MenuSeparator />
                            <MenuItem icon={IconRowInsertBottom} label="Insert Row Below" onClick={() => insertRowAt(parseCellRef(activeCell).row + 1)} />
                            <MenuItem icon={IconColumnInsertRight} label="Insert Column Right" onClick={() => insertColumnAt(parseCellRef(activeCell).col + 1)} />
                            <MenuItem icon={IconPlus} label="Add Row at End" onClick={() => updateSheets((next) => { next[activeSheetName].rowCount += 1; })} />
                            <MenuItem icon={IconPlus} label="Add Column at End" onClick={() => updateSheets((next) => { next[activeSheetName].columnCount += 1; })} />
                            <MenuSeparator />
                            <MenuItem icon={IconTable} label="Insert Sheet" shortcut="Shift+F11" onClick={addSheet} />
                        </RibbonSplit>
                        <RibbonSplit title="Delete (Ctrl+-)" onClick={() => insertDeleteShortcut("delete")} disabled={isSheetReadOnly} face={<><IconTableMinus className="w-4 h-4 text-red-600" strokeWidth={1.5} /><span className="text-xs ml-1">Delete</span></>}>
                            <MenuItem icon={IconTableMinus} label="Delete Cells..." shortcut="Ctrl+-" onClick={() => setInsertDeleteMode("delete")} />
                            <MenuItem icon={IconRowRemove} label="Delete Sheet Rows" onClick={() => runInsertDelete("delete", "rows")} />
                            <MenuItem icon={IconColumnRemove} label="Delete Sheet Columns" onClick={() => runInsertDelete("delete", "cols")} />
                            <MenuSeparator />
                            <MenuItem icon={IconTrash} label="Delete Sheet" onClick={() => deleteSheet(activeSheetName)} />
                        </RibbonSplit>
                        <RibbonDropdown title="Format" trigger={<><IconTableOptions className="w-4 h-4 text-slate-700" strokeWidth={1.5} /><span className="text-xs ml-1">Format</span></>} contentClassName="w-60">
                            <MenuHeader>Cell Size</MenuHeader>
                            <MenuItem label="AutoFit Row Height" shortcut="Alt+H, O, A" onClick={autoFitRows} />
                            <MenuItem label="AutoFit Column Width" shortcut="Alt+H, O, I" onClick={autoFitColumns} />
                            <MenuHeader>Visibility</MenuHeader>
                            <MenuItem label="Hide Rows" shortcut="Ctrl+9" onClick={hideSelectedRows} />
                            <MenuItem label="Unhide Rows" shortcut="Ctrl+Shift+9" onClick={unhideSelectedRows} />
                            <MenuItem label="Hide Columns" shortcut="Ctrl+0" onClick={hideSelectedColumns} />
                            <MenuItem label="Unhide Columns" shortcut="Ctrl+Shift+0" onClick={unhideSelectedColumns} />
                            <MenuHeader>Organize Sheets</MenuHeader>
                            <MenuItem label="Rename Sheet" shortcut="Alt+O, H, R" onClick={() => startRenameSheet(activeSheetName)} />
                            <MenuItem label="Hide Sheet" shortcut="Alt+O, H, H" onClick={() => hideSheet(activeSheetName)} />
                            <MenuItem label="Unhide Sheet..." shortcut="Alt+O, H, U" onClick={() => setUnhideSheetOpen(true)} disabled={hiddenSheetNames.length === 0} />
                            <MenuSeparator />
                            <MenuItem icon={IconTableOptions} label="Format Cells..." shortcut="Ctrl+1" onClick={() => setFormatCellsOpen(true)} />
                        </RibbonDropdown>
                    </RibbonStack>
                </RibbonGroup>

                {/* Editing */}
                <RibbonGroup label="Editing">
                    <RibbonStack className="items-start">
                        <RibbonSplit title="AutoSum (Alt+=)" onClick={() => insertAutoSum("SUM")} face={<IconSum className="w-4 h-4" strokeWidth={1.75} />} contentClassName="w-44">
                            {AUTOSUM_FUNCS.map((fn) => (
                                <MenuItem key={fn} label={fn === "SUM" ? "Sum" : fn === "AVERAGE" ? "Average" : fn === "COUNT" ? "Count Numbers" : fn === "MAX" ? "Max" : "Min"} onClick={() => insertAutoSum(fn)} />
                            ))}
                            <MenuSeparator />
                            <MenuItem label="More Functions... (VLOOKUP)" onClick={() => startEditing(activeCell, "=VLOOKUP(lookup_value, table_array, col_index_num, FALSE)")} />
                        </RibbonSplit>
                        <RibbonDropdown title="Fill" trigger={<IconArrowBarToDown className="w-4 h-4 text-blue-700" strokeWidth={1.5} />} contentClassName="w-44">
                            <MenuItem icon={IconArrowBarToDown} label="Down" shortcut="Ctrl+D" onClick={() => fillFromEdge("down")} />
                            <MenuItem icon={IconArrowBarToRight} label="Right" shortcut="Ctrl+R" onClick={() => fillFromEdge("right")} />
                        </RibbonDropdown>
                        <RibbonDropdown title="Clear" trigger={<IconEraser className="w-4 h-4 text-pink-500" strokeWidth={1.5} />} contentClassName="w-44">
                            <MenuItem icon={IconEraser} label="Clear All" onClick={clearAll} />
                            <MenuItem icon={IconClearFormatting} label="Clear Formats" onClick={clearFormats} />
                            <MenuItem label="Clear Contents" shortcut="Del" onClick={() => { if (guardEditable()) clearSelectedCells(); }} />
                        </RibbonDropdown>
                    </RibbonStack>
                    <RibbonDropdown large title="Sort & Filter" trigger={<><SortFilterIcon /><span className="text-xs leading-tight text-center">Sort &amp;<br />Filter <IconChevronDown className="w-3 h-3 inline text-slate-500" /></span></>} contentClassName="w-52">
                        <MenuItem icon={IconSortAscending} label="Sort A to Z" onClick={() => sortSelection("asc")} />
                        <MenuItem icon={IconSortDescending} label="Sort Z to A" onClick={() => sortSelection("desc")} />
                        <MenuSeparator />
                        <MenuItem icon={IconFilter} label="Filter" shortcut="Ctrl+Shift+L" onClick={toggleAutoFilter} />
                    </RibbonDropdown>
                    <RibbonDropdown large title="Find & Select" trigger={<><IconSearch className="w-7 h-7 text-slate-700" strokeWidth={1.4} /><span className="text-xs leading-tight text-center">Find &amp;<br />Select <IconChevronDown className="w-3 h-3 inline text-slate-500" /></span></>} contentClassName="w-48" align="end">
                        <MenuItem icon={IconSearch} label="Find..." shortcut="Ctrl+F" onClick={() => openFind(false)} />
                        <MenuItem icon={IconReplace} label="Replace..." shortcut="Ctrl+H" onClick={() => openFind(true)} disabled={readOnly} />
                        <MenuItem icon={IconArrowForward} label="Go To..." shortcut="Ctrl+G" onClick={() => setGoToOpen(true)} />
                    </RibbonDropdown>
                </RibbonGroup>
            </div>
            ) : (
            <div className="flex items-stretch border-b border-slate-200 bg-[#f8f8f8] overflow-x-auto themed-scrollbar">
                <RibbonGroup label="Tables">
                    <RibbonBtn
                        className="h-full flex-col px-2 gap-1"
                        title={isSheetReadOnly ? "Switch to a non-PivotTable sheet to insert a PivotTable" : "Insert PivotTable from the current selection"}
                        disabled={isSheetReadOnly}
                        onClick={openCreatePivotDialog}
                    >
                        <IconTable className="w-7 h-7 text-emerald-700" strokeWidth={1.4} />
                        <span className="text-xs">PivotTable</span>
                    </RibbonBtn>
                    <RibbonBtn className="h-full flex-col px-2 gap-1" title="Table (Ctrl+T)" onClick={() => applyTable(selectedTableStyleKey, true, regionForCommand())}>
                        <FormatTableIcon className="w-7 h-7" />
                        <span className="text-xs">Table</span>
                    </RibbonBtn>
                </RibbonGroup>
                <RibbonGroup label="Illustrations">
                    <Popover open={imagePopoverOpen} onOpenChange={setImagePopoverOpen}>
                        <PopoverTrigger asChild>
                            <RibbonBtn className="h-full flex-col px-2 gap-1" title="Insert picture">
                                <IconPhoto className="w-7 h-7 text-blue-700" strokeWidth={1.4} />
                                <span className="text-xs">Pictures <IconChevronDown className="w-3 h-3 inline text-slate-500" /></span>
                            </RibbonBtn>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2 bg-white border border-slate-200 shadow-md rounded-lg space-y-2" align="start">
                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Image URL</div>
                            <div className="flex gap-1">
                                <input
                                    className="flex-1 h-7 text-xs border border-slate-200 rounded px-2"
                                    placeholder="https://…"
                                    value={imageUrlDraft}
                                    onChange={(e) => setImageUrlDraft(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter" && imageUrlDraft.trim()) { handleInsertMedia("image", imageUrlDraft.trim()); setImageUrlDraft(""); setImagePopoverOpen(false); } }}
                                />
                                <Button size="sm" className="h-7 text-xs cursor-pointer" disabled={!imageUrlDraft.trim()} onClick={() => { handleInsertMedia("image", imageUrlDraft.trim()); setImageUrlDraft(""); setImagePopoverOpen(false); }}>Add</Button>
                            </div>
                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 pt-1">Or Upload</div>
                            <Button variant="outline" size="sm" className="w-full h-7 text-xs cursor-pointer" onClick={() => mediaImageInputRef.current?.click()}>
                                <IconUpload className="w-3.5 h-3.5" /> Choose Image File
                            </Button>
                            <input
                                ref={mediaImageInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleInsertMediaFile("image", f); setImagePopoverOpen(false); } e.target.value = ""; }}
                            />
                        </PopoverContent>
                    </Popover>
                    <Popover open={shapesPopoverOpen} onOpenChange={setShapesPopoverOpen}>
                        <PopoverTrigger asChild>
                            <RibbonBtn className="h-full flex-col px-2 gap-1" title="Insert shape">
                                <IconTriangleSquareCircle className="w-7 h-7 text-blue-700" strokeWidth={1.4} />
                                <span className="text-xs">Shapes <IconChevronDown className="w-3 h-3 inline text-slate-500" /></span>
                            </RibbonBtn>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 max-h-80 overflow-y-auto p-2 bg-white border border-slate-200 shadow-md rounded-lg space-y-2" align="start">
                            {SHAPE_GROUPS.map((group) => (
                                <div key={group.label}>
                                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 pb-1">{group.label}</div>
                                    <div className="grid grid-cols-8 gap-0.5">
                                        {group.shapes.map((shape) => (
                                            <button
                                                key={shape.key}
                                                type="button"
                                                title={shape.label}
                                                aria-label={shape.label}
                                                className="w-7 h-7 p-1 rounded-sm border border-transparent hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer"
                                                onClick={() => {
                                                    if (!guardEditable()) return;
                                                    handleInsertMedia("shape", null, { shape: shape.key, width: SHAPE_DEFAULT_SIZE, height: SHAPE_DEFAULT_SIZE });
                                                    setShapesPopoverOpen(false);
                                                }}
                                            >
                                                <img src={shapeDataUrl({ shape: shape.key })} alt="" className="w-full h-full" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </PopoverContent>
                    </Popover>
                </RibbonGroup>
                <RibbonGroup label="Media">
                    <Popover open={videoPopoverOpen} onOpenChange={setVideoPopoverOpen}>
                        <PopoverTrigger asChild>
                            <RibbonBtn className="h-full flex-col px-2 gap-1" title="Insert video">
                                <IconVideo className="w-7 h-7 text-red-600" strokeWidth={1.4} />
                                <span className="text-xs">Video <IconChevronDown className="w-3 h-3 inline text-slate-500" /></span>
                            </RibbonBtn>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2 bg-white border border-slate-200 shadow-md rounded-lg space-y-2" align="start">
                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Video URL</div>
                            <div className="flex gap-1">
                                <input
                                    className="flex-1 h-7 text-xs border border-slate-200 rounded px-2"
                                    placeholder="https://… (mp4, webm)"
                                    value={videoUrlDraft}
                                    onChange={(e) => setVideoUrlDraft(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter" && videoUrlDraft.trim()) { handleInsertMedia("video", videoUrlDraft.trim()); setVideoUrlDraft(""); setVideoPopoverOpen(false); } }}
                                />
                                <Button size="sm" className="h-7 text-xs cursor-pointer" disabled={!videoUrlDraft.trim()} onClick={() => { handleInsertMedia("video", videoUrlDraft.trim()); setVideoUrlDraft(""); setVideoPopoverOpen(false); }}>Add</Button>
                            </div>
                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 pt-1">Or Upload</div>
                            <Button variant="outline" size="sm" className="w-full h-7 text-xs cursor-pointer" onClick={() => mediaVideoInputRef.current?.click()}>
                                <IconUpload className="w-3.5 h-3.5" /> Choose Video File
                            </Button>
                            <input
                                ref={mediaVideoInputRef}
                                type="file"
                                accept="video/*"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleInsertMediaFile("video", f); setVideoPopoverOpen(false); } e.target.value = ""; }}
                            />
                        </PopoverContent>
                    </Popover>
                </RibbonGroup>
            </div>
            )}
            </div>
            </>
            )}

            {/* Find & replace panel */}
            {showFindReplace && (
                <div className="flex flex-wrap items-center gap-2 px-2 py-2 border-b border-slate-200 bg-amber-50/60">
                    <IconSearch className="w-4 h-4 text-slate-500 shrink-0" />
                    <input
                        ref={findInputRef}
                        className="h-7 text-xs border border-slate-200 rounded px-2 w-40"
                        placeholder="Find (Ctrl+F)"
                        value={findText}
                        onChange={(e) => setFindText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); if (e.shiftKey) findPrevious(); else findNext(); }
                            else if (e.key === "Escape") { setShowFindReplace(false); gridContainerRef.current?.focus(); }
                        }}
                    />
                    {!readOnly && (
                        <input
                            ref={replaceInputRef}
                            className="h-7 text-xs border border-slate-200 rounded px-2 w-40"
                            placeholder="Replace with (Ctrl+H)"
                            value={replaceText}
                            onChange={(e) => setReplaceText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); replaceOne(); }
                                else if (e.key === "Escape") { setShowFindReplace(false); gridContainerRef.current?.focus(); }
                            }}
                        />
                    )}
                    <span className="text-[11px] text-slate-500 w-16">{matches.length ? `${matchIndex + 1}/${matches.length}` : "0 matches"}</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer" onClick={findPrevious} disabled={!matches.length} title="Find previous (Shift+Enter)">Previous</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer" onClick={findNext} disabled={!matches.length} title="Find next (Enter)">Find Next</Button>
                    {!readOnly && (
                        <>
                            <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer" onClick={replaceOne} disabled={!matches.length}>Replace</Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer" onClick={replaceAll} disabled={!matches.length}>Replace All</Button>
                        </>
                    )}
                    {[["matchCase", "Match case"], ["entireCell", "Entire cell"], ["allSheets", "All sheets"]].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
                            <Checkbox checked={findOptions[key]} onCheckedChange={(v) => setFindOptions((o) => ({ ...o, [key]: !!v }))} />
                            {label}
                        </label>
                    ))}
                    <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto cursor-pointer" onClick={() => setShowFindReplace(false)}>
                        <IconX className="w-4 h-4" />
                    </Button>
                </div>
            )}

            {/* Formula bar */}
            <div className="flex items-start gap-1.5 px-2 py-1.5 border-b border-slate-200 bg-white">
                <input
                    className="text-xs font-mono font-semibold text-slate-600 w-16 h-7 shrink-0 border border-slate-200 rounded px-1.5 outline-none focus:border-indigo-400"
                    value={coordInputValue}
                    onChange={(e) => setCoordInputValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") jumpToCoord(); }}
                    onBlur={() => setCoordInputValue(activeCell)}
                    title="Type a cell reference and press Enter to jump there"
                />
                {!readOnly && (
                <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={cancelEdit} disabled={!editingCell} title="Cancel edit"><IconX className="w-3.5 h-3.5 text-red-500" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={commitEdit} disabled={!editingCell} title="Accept edit"><IconCheck className="w-3.5 h-3.5 text-green-600" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={() => startEditing(activeCell, "=SUM()")} title="Insert function"><span className="text-[10px] font-bold text-slate-500 italic">fx</span></Button>
                </div>
                )}
                {isFormulaBarExpanded ? (
                    // No colored-reference overlay here: this textarea wraps
                    // (unlike the single-line inputs below), and the overlay's
                    // whitespace-pre would drift out of alignment with wrapped
                    // lines. Point mode (click-to-insert-reference) still works.
                    <textarea
                        ref={formulaBarInputRef}
                        className="flex-1 text-xs font-mono outline-none px-1 py-1 border border-slate-200 rounded resize-none"
                        rows={3}
                        readOnly={readOnly}
                        value={editingCell === activeCell ? editValue : (cells[activeCell]?.value ?? "")}
                        onFocus={(e) => { activeEditInputRef.current = e.target; if (!readOnly && editingCell !== activeCell) startEditing(activeCell, undefined, "bar"); }}
                        onChange={(e) => { setEditValue(e.target.value); formulaInsertRange.current = null; }}
                        onSelect={(e) => { cursorPosRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd }; }}
                        onBlur={commitEdit}
                        placeholder="Enter a value or formula, e.g. =SUM(A1:A5)"
                    />
                ) : (
                    <div className="relative flex-1">
                        {editingCell === activeCell && isEditingFormula && <FormulaTextOverlay text={editValue} mono className="px-1 py-1 leading-4" />}
                        {/* One-line textarea rather than an input, so Alt+Enter can add a
                            line break here too; Enter/Tab/Esc/F4 go through handleKeyDown. */}
                        <textarea
                            ref={formulaBarInputRef}
                            rows={1}
                            wrap="off"
                            className={cn(
                                "block w-full text-xs leading-4 font-mono outline-none px-1 py-1 resize-none overflow-hidden",
                                editingCell === activeCell && isEditingFormula && "bg-transparent text-transparent caret-slate-900"
                            )}
                            readOnly={readOnly}
                            value={editingCell === activeCell ? editValue : (cells[activeCell]?.value ?? "")}
                            onFocus={(e) => { activeEditInputRef.current = e.target; if (!readOnly && editingCell !== activeCell) startEditing(activeCell, undefined, "bar"); }}
                            onChange={(e) => { setEditValue(e.target.value); formulaInsertRange.current = null; }}
                            onSelect={(e) => { cursorPosRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd }; }}
                            onBlur={commitEdit}
                            placeholder="Enter a value or formula, e.g. =SUM(A1:A5)"
                        />
                    </div>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 cursor-pointer" onClick={() => setIsFormulaBarExpanded((v) => !v)} title="Expand/collapse formula bar">
                    {isFormulaBarExpanded ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                </Button>
            </div>

            {/* Grid (+ PivotTable Fields panel, when a pivot sheet is active) */}
            <div ref={setGridAreaEl} className={cn("flex items-start gap-2", isFullScreen && "flex-1 min-h-0")}>
            <div className="border border-slate-200 rounded-lg overflow-hidden flex-1 min-w-0">
                <div
                    ref={gridContainerRef}
                    className="overflow-auto outline-none select-none"
                    style={{ maxHeight: gridMaxHeight / zoom, zoom }}
                    tabIndex={0}
                    onMouseLeave={() => setHoveredCell(null)}
                >
                <div className="relative">
                {/* Where the other people editing this meeting are (live co-editing):
                    their selection outlined in their colour, with their name. Below
                    the sticky headers (z-10 and up), and never in the way of the mouse. */}
                {livePeers.map((peer) => {
                    if (peer.sheet !== activeSheetName) return null;
                    const bounds = rangeBounds({ start: peer.start, end: peer.end });
                    if (!bounds || bounds.minRow >= rowCount || bounds.minCol >= columnCount) return null;
                    const maxRow = Math.min(bounds.maxRow, rowCount - 1);
                    const maxCol = Math.min(bounds.maxCol, columnCount - 1);
                    const top = rowOffsets[bounds.minRow];
                    const left = colOffsets[bounds.minCol];
                    return (
                        <div
                            key={peer.socketId}
                            className="absolute pointer-events-none z-[5]"
                            style={{
                                top, left,
                                width: colOffsets[maxCol + 1] - left,
                                height: rowOffsets[maxRow + 1] - top,
                                border: `2px solid ${peer.color}`,
                            }}
                        >
                            <span
                                className="absolute left-[-2px] px-1 text-[10px] leading-4 text-white whitespace-nowrap rounded-sm"
                                style={{ background: peer.color, ...(bounds.minRow === 0 ? { top: "100%" } : { bottom: "100%" }) }}
                            >
                                {peer.userName}
                            </span>
                        </div>
                    );
                })}
                {media.map((item) => (
                    <DraggableMedia
                        key={item.id}
                        item={item}
                        colOffsets={colOffsets}
                        rowOffsets={rowOffsets}
                        columnCount={columnCount}
                        rowCount={rowCount}
                        readOnly={readOnly}
                        zoom={zoom}
                        isSelected={selectedMediaId === item.id}
                        onSelect={() => {
                            setSelectedMediaId(item.id);
                            // Route Delete/Backspace through handleKeyDown, which
                            // requires the grid container to hold focus — clicking a
                            // media item (a non-focusable div) wouldn't move focus there
                            // on its own.
                            gridContainerRef.current?.focus();
                        }}
                        onUpdate={(patch) => handleUpdateMedia(item.id, patch)}
                        onDelete={() => handleDeleteMedia(item.id)}
                    />
                ))}
                <table
                    className="border-collapse"
                    style={{ tableLayout: "fixed", width: colOffsets[columnCount] }}
                >
                    <thead>
                        <tr>
                            <th
                                onClick={selectAllCells}
                                className="sticky top-0 left-0 z-30 bg-slate-100 border border-slate-200 h-7 cursor-pointer hover:bg-slate-200 select-none"
                                style={{ width: ROW_HEADER_WIDTH }}
                                title="Select all cells"
                            />
                            {/* In a fixed-layout table the first row sets every column's
                                width, so the spacers get theirs here; the body rows'
                                spacer cells just line up under them. */}
                            {leftSpacerWidth > 0 && <th key="left-spacer" style={{ width: leftSpacerWidth, padding: 0, border: "none" }} />}
                            {visibleCols.map((colIdx) => { const c = columns[colIdx]; return (
                                <th
                                    key={c}
                                    onMouseDown={(e) => handleColHeaderMouseDown(colIdx, e)}
                                    onMouseEnter={() => handleColHeaderMouseEnter(colIdx)}
                                    className={cn(
                                        "sticky top-0 z-20 border border-slate-200 text-[11px] font-semibold h-7 cursor-pointer hover:bg-slate-200 select-none",
                                        (hoveredCell?.col === colIdx || allSelectionBounds.some((b) => colIdx >= b.minCol && colIdx <= b.maxCol))
                                            ? "bg-indigo-100 text-indigo-700"
                                            : "bg-slate-100 text-slate-600",
                                        // Marks where hidden columns sit, like Excel's double line.
                                        hiddenColSet.has(colIdx - 1) && "border-l-2 border-l-indigo-400"
                                    )}
                                    style={{ width: widthForCol(colIdx) }}
                                    title={hiddenColSet.has(colIdx - 1) ? "Hidden column(s) to the left — select across them and press Ctrl+Shift+0 to unhide" : undefined}
                                >
                                    {c}
                                    <div
                                        onMouseDown={(e) => startColumnResize(e, colIdx)}
                                        onClick={(e) => e.stopPropagation()}
                                        onDoubleClick={(e) => { e.stopPropagation(); handleColumnBorderDoubleClick(colIdx); }}
                                        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-400/60 z-10"
                                        title="Drag to resize column · double-click to fit"
                                    />
                                </th>
                            ); })}
                            {rightSpacerWidth > 0 && <th key="right-spacer" style={{ width: rightSpacerWidth, padding: 0, border: "none" }} />}
                        </tr>
                    </thead>
                    <tbody>
                        {visibleRowRange.startRow > 0 && (
                            <tr key="top-spacer">
                                <td colSpan={renderedColSpan} style={{ height: rowOffsets[visibleRowRange.startRow] - rowOffsets[0], padding: 0, border: "none" }} />
                            </tr>
                        )}
                        {rows.slice(visibleRowRange.startRow, visibleRowRange.endRow + 1).map((rowIdx) => {
                            if (hiddenRowSet.has(rowIdx)) return null;
                            return (
                            <tr key={rowIdx}>
                                <td
                                    onMouseDown={(e) => handleRowHeaderMouseDown(rowIdx, e)}
                                    onMouseEnter={() => handleRowHeaderMouseEnter(rowIdx)}
                                    className={cn(
                                        "sticky left-0 z-10 border border-slate-200 text-[11px] font-semibold text-center cursor-pointer hover:bg-slate-200 select-none",
                                        (hoveredCell?.row === rowIdx || allSelectionBounds.some((b) => rowIdx >= b.minRow && rowIdx <= b.maxRow))
                                            ? "bg-indigo-100 text-indigo-700"
                                            : "bg-slate-100 text-slate-500",
                                        manualHiddenRowSet.has(rowIdx - 1) && "border-t-2 border-t-indigo-400"
                                    )}
                                    style={{ width: ROW_HEADER_WIDTH, height: heightForRow(rowIdx) }}
                                    title={manualHiddenRowSet.has(rowIdx - 1) ? "Hidden row(s) above — select across them and press Ctrl+Shift+9 to unhide" : undefined}
                                >
                                    {rowIdx + 1}
                                    <div
                                        onMouseDown={(e) => startRowResize(e, rowIdx)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize hover:bg-indigo-400/60 z-10"
                                        title="Drag to resize row"
                                    />
                                </td>
                                {leftSpacerWidth > 0 && <td key="left-spacer" style={{ padding: 0, border: "none" }} />}
                                {visibleCols.map((colIdx) => {
                                    const cellId = getCellId(rowIdx, colIdx);
                                    const merge = mergeMap[cellId];
                                    // Cells covered by a merge but not its anchor render nothing —
                                    // the anchor's <td> below spans over them via colSpan/rowSpan.
                                    if (merge && merge.start !== cellId) return null;

                                    const cell = cells[cellId];
                                    const isActive = activeCell === cellId;
                                    const isInRange = isCellSelected(rowIdx, colIdx);
                                    const isEditing = editingCell === cellId;
                                    const isFillCorner = selectionBounds && rowIdx === selectionBounds.maxRow && colIdx === selectionBounds.maxCol;
                                    const isFillPreviewCell = fillPreviewCellIds.has(cellId);
                                    const conditionalBg = conditionalBgMap[cellId];
                                    // Spans count only rendered rows/columns, so a merge that
                                    // covers hidden ones doesn't push the rest of the row over.
                                    const mergeSpan = merge ? (() => {
                                        const s = parseCellRef(merge.start), e = parseCellRef(merge.end);
                                        let rowSpan = 0, colSpan = 0;
                                        for (let r = s.row; r <= e.row; r++) if (!hiddenRowSet.has(r)) rowSpan++;
                                        for (let c = s.col; c <= e.col; c++) if (!hiddenColSet.has(c)) colSpan++;
                                        return { rowSpan: Math.max(1, rowSpan), colSpan: Math.max(1, colSpan), rowEnd: e.row, colEnd: e.col };
                                    })() : null;
                                    // Perimeter border for a multi-cell selection: only true on the
                                    // outer-facing sides of the selection rectangle, accounting for
                                    // this cell's merge span if it has one.
                                    const isMultiSelection = selectionBounds && (selectionBounds.minRow !== selectionBounds.maxRow || selectionBounds.minCol !== selectionBounds.maxCol);
                                    const spanRowEnd = mergeSpan ? mergeSpan.rowEnd : rowIdx;
                                    const spanColEnd = mergeSpan ? mergeSpan.colEnd : colIdx;
                                    const inActiveRange = rowIdx >= selectionBounds?.minRow && rowIdx <= selectionBounds?.maxRow
                                        && colIdx >= selectionBounds?.minCol && colIdx <= selectionBounds?.maxCol;
                                    let selectionEdges = isMultiSelection && inActiveRange ? {
                                        top: rowIdx === selectionBounds.minRow,
                                        bottom: spanRowEnd === selectionBounds.maxRow,
                                        left: colIdx === selectionBounds.minCol,
                                        right: spanColEnd === selectionBounds.maxCol
                                    } : null;
                                    // The other Ctrl-selected ranges each get their own perimeter.
                                    if (isInRange) {
                                        for (const b of extraBounds) {
                                            if (rowIdx < b.minRow || rowIdx > b.maxRow || colIdx < b.minCol || colIdx > b.maxCol) continue;
                                            selectionEdges = {
                                                top: selectionEdges?.top || rowIdx === b.minRow,
                                                bottom: selectionEdges?.bottom || spanRowEnd === b.maxRow,
                                                left: selectionEdges?.left || colIdx === b.minCol,
                                                right: selectionEdges?.right || spanColEnd === b.maxCol
                                            };
                                        }
                                    }
                                    const formulaRefEdges = formulaRefBorderMap[cellId];
                                    // AutoFilter dropdown: only the header row of a filter-enabled table gets one.
                                    const filterTable = tables.find((t) => {
                                        if (!t.filtersEnabled) return false;
                                        const ts = parseCellRef(t.range.start), te = parseCellRef(t.range.end);
                                        if (!ts || !te) return false;
                                        const tMinRow = Math.min(ts.row, te.row);
                                        const tMinCol = Math.min(ts.col, te.col), tMaxCol = Math.max(ts.col, te.col);
                                        return rowIdx === tMinRow && colIdx >= tMinCol && colIdx <= tMaxCol;
                                    });
                                    const columnHasActiveFilter = filterTable && Array.isArray(filterTable.filters?.[colIdx]);
                                    const isFilterOpenHere = filterPopover?.tableId === filterTable?.id && filterPopover?.colIdx === colIdx;

                                    return (
                                        <td
                                            key={cellId}
                                            rowSpan={mergeSpan?.rowSpan}
                                            colSpan={mergeSpan?.colSpan}
                                            onMouseDown={(e) => handleCellMouseDown(cellId, e)}
                                            onMouseEnter={(e) => handleCellMouseEnter(cellId, e)}
                                            onDoubleClick={readOnly ? undefined : () => startEditing(cellId)}
                                            className={cn(
                                                "p-0 relative",
                                                gridlinesVisible ? "border border-slate-200" : "border border-transparent",
                                                isActive && "outline outline-2 outline-indigo-500 -outline-offset-2",
                                                isFillPreviewCell && "outline outline-1 outline-dashed outline-indigo-400 -outline-offset-1",
                                                formatPainterStyle && "cursor-copy"
                                            )}
                                            style={{
                                                height: heightForRow(rowIdx),
                                                verticalAlign: cell?.valign || "middle",
                                                backgroundColor: conditionalBg || cell?.bg
                                            }}
                                        >
                                            <CellBorderOverlay border={cell?.border} />
                                            {isInRange && !isActive && (
                                                <div className="absolute inset-0 bg-indigo-500/15 pointer-events-none" />
                                            )}
                                            {selectionEdges && <SelectionRangeBorder {...selectionEdges} />}
                                            {formulaRefEdges && <SelectionRangeBorder {...formulaRefEdges} />}
                                            {filterTable && (
                                                <Popover open={isFilterOpenHere} onOpenChange={(open) => { if (!open) { setFilterPopover(null); setFilterDraft(null); } }}>
                                                    <PopoverTrigger asChild>
                                                        <button
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            onClick={(e) => { e.stopPropagation(); openColumnFilter(filterTable, colIdx); }}
                                                            className={cn(
                                                                "absolute right-0.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded hover:bg-black/10 z-10 cursor-pointer",
                                                                // Plain AutoFilter ranges (Ctrl+Shift+L) keep the cell's own
                                                                // header styling, so the icon can't assume a dark header.
                                                                filterTable.styleKey ? "text-white/90" : "text-slate-500"
                                                            )}
                                                            title="Filter this column"
                                                        >
                                                            {columnHasActiveFilter ? <IconFilterFilled className="w-3 h-3" /> : <IconFilter className="w-3 h-3" />}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-56 p-2 bg-white border border-slate-200 shadow-md rounded-lg space-y-2" align="start" onMouseDown={(e) => e.stopPropagation()}>
                                                        {filterDraft && (
                                                            <>
                                                                <input
                                                                    className="w-full h-7 text-xs border border-slate-200 rounded px-2"
                                                                    placeholder="Search values…"
                                                                    value={filterDraft.search}
                                                                    onChange={(e) => setFilterDraft((d) => ({ ...d, search: e.target.value }))}
                                                                />
                                                                <div className="flex items-center justify-between text-[11px] text-indigo-600 px-0.5">
                                                                    <button className="hover:underline cursor-pointer" onClick={selectAllFilterValues}>Select All</button>
                                                                    <button className="hover:underline cursor-pointer" onClick={clearAllFilterValues}>Clear</button>
                                                                </div>
                                                                <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-100 rounded p-1.5">
                                                                    {filterDraft.allValues
                                                                        .filter((v) => v.toLowerCase().includes(filterDraft.search.toLowerCase()))
                                                                        .map((val) => (
                                                                            <div key={val} className="flex items-center gap-2">
                                                                                <Checkbox checked={filterDraft.selected.has(val)} onCheckedChange={() => toggleFilterValue(val)} />
                                                                                <span className="text-xs text-slate-700 truncate">{val === "" ? "(Blank)" : val}</span>
                                                                            </div>
                                                                        ))}
                                                                    {filterDraft.allValues.filter((v) => v.toLowerCase().includes(filterDraft.search.toLowerCase())).length === 0 && (
                                                                        <div className="text-[11px] text-slate-400 text-center py-2">No matches</div>
                                                                    )}
                                                                </div>
                                                                <div className="flex justify-end gap-1.5 pt-1">
                                                                    <Button size="sm" variant="outline" className="h-7 text-xs cursor-pointer" onClick={() => { setFilterPopover(null); setFilterDraft(null); }}>Cancel</Button>
                                                                    <Button size="sm" className="h-7 text-xs cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white" onClick={applyColumnFilter}>Apply</Button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                            {isEditing ? (
                                                <div className="relative w-full h-full">
                                                    {isEditingFormula && <FormulaTextOverlay text={editValue} className="px-1.5 py-[6px] text-xs leading-4" />}
                                                    {/* A textarea (not an input) so Alt+Enter can add a line
                                                        break. Enter/Tab/Esc/F4/Ctrl+Enter are handled by the
                                                        sheet-level key handler (handleKeyDown). */}
                                                    <textarea
                                                    ref={cellEditInputRef}
                                                    autoFocus={editOriginRef.current !== "bar"}
                                                    rows={1}
                                                    wrap="off"
                                                    className={cn(
                                                        "block w-full h-full px-1.5 py-[6px] text-xs leading-4 outline-none border-none relative resize-none overflow-hidden",
                                                        // A solid background here would paint over the colored-reference
                                                        // overlay sitting behind this (otherwise text-transparent) input —
                                                        // the <td> beneath already supplies the white backdrop.
                                                        isEditingFormula ? "bg-transparent text-transparent caret-slate-900" : "bg-white"
                                                    )}
                                                    value={editValue}
                                                    onChange={(e) => { setEditValue(e.target.value); formulaInsertRange.current = null; }}
                                                    onSelect={(e) => { cursorPosRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd }; }}
                                                    onFocus={(e) => { activeEditInputRef.current = e.target; }}
                                                    onBlur={commitEdit}
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className={cn("px-1.5 text-xs", cell?.wrap ? "whitespace-pre-wrap break-words overflow-hidden" : "truncate")}
                                                    style={cellStyleFor(cell)}
                                                >
                                                    {showFormulas && isFormula(cell?.value) ? cell.value : (displayGrid[cellId] ?? "")}
                                                </div>
                                            )}
                                            {isFillCorner && !isEditing && !readOnly && (
                                                <div
                                                    onMouseDown={handleFillHandleMouseDown}
                                                    className="absolute -right-[3px] -bottom-[3px] w-[7px] h-[7px] bg-indigo-600 border border-white cursor-crosshair z-20"
                                                    title="Drag to fill"
                                                />
                                            )}
                                        </td>
                                    );
                                })}
                                {rightSpacerWidth > 0 && <td key="right-spacer" style={{ padding: 0, border: "none" }} />}
                            </tr>
                            );
                        })}
                        {visibleRowRange.endRow < rowCount - 1 && (
                            <tr key="bottom-spacer">
                                <td colSpan={renderedColSpan} style={{ height: rowOffsets[rowCount] - rowOffsets[visibleRowRange.endRow + 1], padding: 0, border: "none" }} />
                            </tr>
                        )}
                    </tbody>
                </table>
                </div>
                </div>
            </div>
            {pivotConfig && pivotPanelOpen && (
                <PivotPanel
                    pivotConfig={pivotConfig}
                    sourceFields={pivotSourceFields}
                    onToggleZone={togglePivotZone}
                    onChangeAgg={changePivotAgg}
                    onClose={() => setPivotPanelOpen(false)}
                />
            )}
            </div>

            {/* Sheet tabs + zoom controls */}
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-slate-200 bg-slate-50 rounded-b-lg select-none">
            <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
                {visibleSheetNames.map((name) => {
                    const tabBadge = (
                        <div
                            className={cn(
                                "group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border shrink-0",
                                name === activeSheetName
                                    ? "bg-white border-slate-300 text-indigo-700 shadow-sm"
                                    : "bg-transparent border-transparent text-slate-500 hover:bg-slate-100"
                            )}
                            onClick={() => switchSheet(name)}
                            onDoubleClick={readOnly ? undefined : () => startRenameSheet(name)}
                        >
                            {renamingSheet === name ? (
                                <input
                                    autoFocus
                                    className="w-20 text-xs px-1 py-0 border border-indigo-300 rounded outline-none"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") commitRenameSheet();
                                        else if (e.key === "Escape") setRenamingSheet(null);
                                    }}
                                    onBlur={commitRenameSheet}
                                />
                            ) : (
                                <span>{name}</span>
                            )}
                            {!readOnly && visibleSheetNames.length > 1 && renamingSheet !== name && (
                                <button
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); deleteSheet(name); }}
                                    title="Delete sheet"
                                >
                                    <IconX className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    );

                    if (readOnly) return <React.Fragment key={name}>{tabBadge}</React.Fragment>;

                    return (
                        <ContextMenu key={name}>
                            <ContextMenuTrigger asChild>{tabBadge}</ContextMenuTrigger>
                            <ContextMenuContent className="w-44">
                                <ContextMenuItem onClick={() => copySheet(name)} className="cursor-pointer">
                                    <IconCopy className="w-3.5 h-3.5" /> Copy Sheet
                                </ContextMenuItem>
                                <ContextMenuItem onClick={() => startRenameSheet(name)} className="cursor-pointer">
                                    <IconPencil className="w-3.5 h-3.5" /> Rename Sheet
                                </ContextMenuItem>
                                {visibleSheetNames.length > 1 && (
                                    <ContextMenuItem onClick={() => hideSheet(name)} className="cursor-pointer">
                                        <IconEyeOff className="w-3.5 h-3.5" /> Hide Sheet
                                    </ContextMenuItem>
                                )}
                                {hiddenSheetNames.length > 0 && (
                                    <ContextMenuItem onClick={() => setUnhideSheetOpen(true)} className="cursor-pointer">
                                        <IconEye className="w-3.5 h-3.5" /> Unhide Sheet…
                                    </ContextMenuItem>
                                )}
                                {Object.keys(sheets).length > 1 && (
                                    <>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem onClick={() => deleteSheet(name)} variant="destructive" className="cursor-pointer">
                                            <IconX className="w-3.5 h-3.5" /> Delete Sheet
                                        </ContextMenuItem>
                                    </>
                                )}
                            </ContextMenuContent>
                        </ContextMenu>
                    );
                })}
                {!readOnly && (
                <button className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 shrink-0 cursor-pointer" onClick={addSheet} title="Add sheet (Shift+F11)">
                    <IconPlus className="w-4 h-4" />
                </button>
                )}
            </div>

            {/* Status bar: quick totals for a multi-cell selection */}
            {selectionStats && (
                <div className="hidden md:flex items-center gap-3 shrink-0 text-[11px] text-slate-600 tabular-nums">
                    {selectionStats.average !== null && <span>Average: <b className="font-semibold">{formatStat(selectionStats.average)}</b></span>}
                    <span>Count: <b className="font-semibold">{selectionStats.count}</b></span>
                    {selectionStats.numericCount > 0 && selectionStats.numericCount !== selectionStats.count && <span>Numerical Count: <b className="font-semibold">{selectionStats.numericCount}</b></span>}
                    {selectionStats.numericCount > 0 && <span>Min: <b className="font-semibold">{formatStat(selectionStats.min)}</b></span>}
                    {selectionStats.numericCount > 0 && <span>Max: <b className="font-semibold">{formatStat(selectionStats.max)}</b></span>}
                    {selectionStats.numericCount > 0 && <span>Sum: <b className="font-semibold">{formatStat(selectionStats.sum)}</b></span>}
                </div>
            )}

            {/* Zoom controls */}
            <div className="flex items-center gap-2 shrink-0 border-l border-slate-200 pl-3 text-slate-500 text-xs">
                <button
                    className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.1}
                    title="Zoom out"
                >
                    <IconMinus className="w-3.5 h-3.5" />
                </button>
                <input
                    type="range"
                    min="0.1"
                    max="4.0"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-20 accent-indigo-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    title={`Zoom: ${Math.round(zoom * 100)}%`}
                />
                <button
                    className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                    onClick={handleZoomIn}
                    disabled={zoom >= 4.0}
                    title="Zoom in"
                >
                    <IconPlus className="w-3.5 h-3.5" />
                </button>
                <button
                    className="min-w-[40px] text-right font-medium hover:text-indigo-600 hover:underline cursor-pointer"
                    onClick={() => setZoom(1.0)}
                    title="Reset zoom to 100%"
                >
                    {Math.round(zoom * 100)}%
                </button>
                <button
                    className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
                    onClick={() => toggleFullScreen()}
                    title={isFullScreen ? "Exit full screen (Esc)" : "Full screen"}
                >
                    {isFullScreen ? <IconMinimize className="w-3.5 h-3.5" /> : <IconMaximize className="w-3.5 h-3.5" />}
                </button>
            </div>
            </div>

            {/* Import/export progress — non-dismissible while active; ExcelJS gives no
                progress callback for its own parse/write step, so those phases show an
                indeterminate spinner, while the row-by-row work this component chunks
                itself (see IO_CHUNK_SIZE) drives a real percentage. */}
            {ioProgress && (
                <Dialog open onOpenChange={() => {}}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader>
                            <DialogTitle>{ioProgress.title}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                            <p className="text-sm text-slate-600">{ioProgress.label}</p>
                            {ioProgress.total > 0 ? (
                                <>
                                    <Progress value={Math.round((ioProgress.current / ioProgress.total) * 100)} />
                                    <p className="text-xs text-slate-400 text-right">{ioProgress.current.toLocaleString()} / {ioProgress.total.toLocaleString()} rows</p>
                                </>
                            ) : (
                                <div className="flex justify-center py-2">
                                    <IconLoader2 className="w-5 h-5 animate-spin text-indigo-500" />
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            <CreatePivotDialog
                open={createPivotDialogOpen}
                onOpenChange={setCreatePivotDialogOpen}
                sheetNames={Object.keys(sheets)}
                defaultSourceSheet={activeSheetName}
                defaultSourceRange={defaultPivotSourceRange}
                onCreate={createPivotTable}
            />

            <CheatSheetDialog
                open={cheatSheetOpen}
                onOpenChange={(open) => { setCheatSheetOpen(open); if (!open) focusGrid(); }}
                canInsert={!readOnly && !isSheetReadOnly}
                onInsertFormula={(formula) => { setCheatSheetOpen(false); startEditing(activeCell, formula); }}
            />
            <GoToDialog
                open={goToOpen}
                onOpenChange={(open) => { setGoToOpen(open); if (!open) focusGrid(); }}
                defaultValue={selection.start === selection.end ? activeCell : `${selection.start}:${selection.end}`}
                onGo={goToReference}
            />
            <PasteSpecialDialog open={pasteSpecialOpen} onOpenChange={(open) => { setPasteSpecialOpen(open); if (!open) focusGrid(); }} onApply={applyPasteSpecial} />
            <FormatCellsDialog
                open={formatCellsOpen}
                onOpenChange={(open) => { setFormatCellsOpen(open); if (!open) { setFormatCellsTab(null); focusGrid(); } }}
                initialTab={formatCellsTab}
                cell={activeCellData}
                sampleValue={typeof rawGrid[activeCell] === "string" ? (parseDateTimeText(rawGrid[activeCell]) ?? rawGrid[activeCell]) : rawGrid[activeCell]}
                fontFamilies={FONT_FAMILIES}
                fontSizes={FONT_SIZES}
                borderWeights={BORDER_WEIGHTS}
                onApply={applyFormatCellsPatch}
            />
            <InsertDeleteDialog
                open={!!insertDeleteMode}
                mode={insertDeleteMode}
                onOpenChange={(open) => { if (!open) { setInsertDeleteMode(null); focusGrid(); } }}
                onChoose={(kind) => runInsertDelete(insertDeleteMode, kind)}
            />
            <UnhideSheetDialog
                open={unhideSheetOpen}
                onOpenChange={setUnhideSheetOpen}
                hiddenSheets={hiddenSheetNames}
                onUnhide={unhideSheet}
            />
        </div>
        </FullScreenFrame>
    );
});

export default ExcelClone;
