import React, { useState, useEffect, useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
    IconBold, IconItalic, IconUnderline, IconStrikethrough,
    IconAlignLeft, IconAlignCenter, IconAlignRight, IconPalette,
    IconDownload, IconUpload, IconDeviceFloppy, IconLoader2, IconTable, IconPlus,
    IconArrowBackUp, IconArrowForwardUp, IconSearch, IconX, IconBorderAll,
    IconCopy, IconCut, IconClipboard, IconBrush, IconCurrencyDollar, IconPercentage,
    IconBorderOuter, IconSortAscending, IconSortDescending, IconRowInsertTop, IconRowInsertBottom,
    IconColumnInsertLeft, IconColumnInsertRight, IconRowRemove, IconColumnRemove, IconTrash,
    IconSum, IconChevronDown, IconChevronUp, IconLayoutAlignTop, IconLayoutAlignMiddle,
    IconLayoutAlignBottom, IconTextWrap, IconCheck, IconBorderBottom, IconBorderNone, IconBorderRight, IconBorderLeft,
    IconFilter, IconFilterFilled
} from "@tabler/icons-react";
import {
    useGetDailyMeetingSheetQuery, useSaveDailyMeetingSheetMutation,
    useGetDailyMorningMeetingDetailQuery, useSaveDailyMorningMeetingSheetMutation
} from "@/Redux/AllApi/DepartmentApi";
import { getCellId, parseCellRef, indexToCol, expandRange, buildDisplayGrid, adjustFormula, extrapolateSeries } from "./formulaEngine";
import { cn } from "@/lib/utils";

const DEFAULT_ROW_COUNT = 30;
const DEFAULT_COLUMN_COUNT = 15;
const DEFAULT_SHEET_NAME = "Sheet 1";
const DEFAULT_COLUMN_WIDTH = 96;
const DEFAULT_ROW_HEIGHT = 28;
const MIN_COLUMN_WIDTH = 40;
const MIN_ROW_HEIGHT = 20;
const ROW_HEADER_WIDTH = 40;
const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24];
const FONT_FAMILIES = ["Aptos Narrow", "Calibri", "Arial", "Segoe UI"];
const HISTORY_LIMIT = 100;
const NUMBER_FORMATS = [
    { value: "general", label: "General" },
    { value: "number", label: "Number" },
    { value: "currency", label: "Currency" },
    { value: "accounting", label: "Accounting" },
    { value: "percentage", label: "Percentage" },
    { value: "comma", label: "Comma" },
];
const BORDER_SIDE_OPTIONS = [
    { key: "all", label: "All Borders", icon: IconBorderAll, sides: ["top", "bottom", "left", "right"] },
    { key: "right", label: "Right Border", icon: IconBorderRight, sides: ["right"] },
    { key: "left", label: "Left Border", icon: IconBorderLeft, sides: ["left"] },
    { key: "bottom", label: "Bottom Border", icon: IconBorderBottom, sides: ["bottom"] },
    { key: "none", label: "No Border", icon: IconBorderNone, sides: [] },
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

const emptySheet = () => ({ cells: {}, rowCount: DEFAULT_ROW_COUNT, columnCount: DEFAULT_COLUMN_COUNT, conditionalRules: [], merges: [], columnWidths: {}, rowHeights: {}, tables: [] });

const isBlankCell = (cell) => {
    if (!cell) return true;
    const { value, ...styles } = cell;
    const hasValue = value !== undefined && value !== null && value !== "";
    const hasStyle = Object.values(styles).some(Boolean);
    return !hasValue && !hasStyle;
};

const cellStyleFor = (cell) => ({
    fontWeight: cell?.bold ? "bold" : "normal",
    fontStyle: cell?.italic ? "italic" : "normal",
    textDecoration: [cell?.underline && "underline", cell?.strike && "line-through"].filter(Boolean).join(" ") || "none",
    textAlign: cell?.align || "left",
    color: cell?.color || undefined,
    fontSize: cell?.fontSize ? `${cell.fontSize}px` : undefined,
    fontFamily: cell?.fontFamily ? `${cell.fontFamily}, sans-serif` : undefined,
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

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Excel-style "point mode" reference coloring: each unique cell/range mentioned
// in a formula gets one consistent color, reused for that reference's grid
// highlight and its colored text in the editor. Cycled, not derived from the
// dataviz categorical palette — this is transient editing chrome, not a chart.
const FORMULA_REF_COLORS = ["#4f46e5", "#059669", "#d97706", "#db2777", "#0891b2", "#7c3aed", "#dc2626", "#65a30d"];
const FORMULA_REF_TOKEN_RE = /\$?[A-Za-z]+\$?[0-9]+(?::\$?[A-Za-z]+\$?[0-9]+)?/g;

// Splits a formula string into colored/uncolored segments for the read-only
// backdrop behind the (text-transparent) edit input, and returns the color
// assigned to each unique reference so the grid overlay can reuse the same
// colors. Position-preserving (unlike formulaEngine's tokenize, which
// uppercases/strips whitespace) so the segments line up character-for-character
// with what the user actually typed.
const tokenizeFormulaForDisplay = (text) => {
    if (!text || !text.trim().startsWith("=")) return { segments: [{ text, color: null }], refColorMap: {} };
    const segments = [];
    const refColorMap = {};
    let colorIdx = 0;
    let lastIndex = 0;
    let match;
    FORMULA_REF_TOKEN_RE.lastIndex = 0;
    while ((match = FORMULA_REF_TOKEN_RE.exec(text)) !== null) {
        const raw = match[0];
        if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), color: null });
        const key = raw.toUpperCase().replace(/\$/g, "");
        if (!refColorMap[key]) refColorMap[key] = FORMULA_REF_COLORS[colorIdx++ % FORMULA_REF_COLORS.length];
        segments.push({ text: raw, color: refColorMap[key] });
        lastIndex = match.index + raw.length;
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

const RibbonGroup = ({ label, children }) => (
    <div className="flex flex-col items-center gap-1 px-2 py-1.5 border-r border-slate-200 last:border-r-0">
        <div className="flex items-center gap-0.5">{children}</div>
        <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">{label}</span>
    </div>
);

const ExcelClone = forwardRef(function ExcelClone({ sectionId, meetingId, readOnly = false, onDataChange }, ref) {
    const { data: sectionSheetData, isLoading: isSectionLoading } = useGetDailyMeetingSheetQuery(sectionId, { skip: !sectionId || !!meetingId });
    const { data: meetingSheetData, isLoading: isMeetingLoading } = useGetDailyMorningMeetingDetailQuery(meetingId, { skip: !meetingId });
    const [saveSectionSheet, { isLoading: isSavingSection }] = useSaveDailyMeetingSheetMutation();
    const [saveMeetingSheet, { isLoading: isSavingMeeting }] = useSaveDailyMorningMeetingSheetMutation();

    const sheetData = meetingId ? meetingSheetData : sectionSheetData;
    const isLoading = meetingId ? isMeetingLoading : isSectionLoading;
    const isSaving = meetingId ? isSavingMeeting : isSavingSection;

    const [sheets, setSheets] = useState({ [DEFAULT_SHEET_NAME]: emptySheet() });
    const [activeSheetName, setActiveSheetName] = useState(DEFAULT_SHEET_NAME);
    const [isDirty, setIsDirty] = useState(false);
    const loadedRef = useRef(false);

    const [activeCell, setActiveCell] = useState("A1");
    const [selection, setSelection] = useState({ start: "A1", end: "A1" });
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState("");
    const [hoveredCell, setHoveredCell] = useState(null);
    const [gridlinesVisible, setGridlinesVisible] = useState(true);
    const [isFormulaBarExpanded, setIsFormulaBarExpanded] = useState(false);
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

    const [tableStylePopoverOpen, setTableStylePopoverOpen] = useState(false);
    const [selectedTableStyleKey, setSelectedTableStyleKey] = useState(TABLE_STYLE_PRESETS[0].key);
    const [tableFiltersEnabled, setTableFiltersEnabled] = useState(true);
    const [filterPopover, setFilterPopover] = useState(null); // { tableId, colIdx }
    const [filterDraft, setFilterDraft] = useState(null); // { search, selected: Set<string>, allValues: string[] }

    const [resizePreview, setResizePreview] = useState(null); // { type: 'col'|'row', index, size }

    const isSelecting = useRef(false);
    const isFilling = useRef(false);
    const fileInputRef = useRef(null);
    const fillSourceRange = useRef(null);
    const resizeRef = useRef(null); // { type, index, startPos, startSize, currentSize }
    const gridContainerRef = useRef(null);

    // Formula "point mode" — clicking/dragging cells while typing a formula
    // inserts their reference instead of committing the edit and navigating away.
    const cellEditInputRef = useRef(null);
    const formulaBarInputRef = useRef(null);
    const activeEditInputRef = useRef(null); // whichever of the two above last had focus
    const cursorPosRef = useRef({ start: 0, end: 0 });
    const isPointingFormula = useRef(false);
    const pointModeAnchor = useRef(null); // cellId the point-mode drag started from
    const formulaInsertRange = useRef(null); // { start, end } in editValue currently occupied by the last-inserted reference

    const historyPast = useRef([]);
    const historyFuture = useRef([]);
    const [, setHistoryTick] = useState(0);
    const bumpHistory = useCallback(() => setHistoryTick((t) => t + 1), []);

    useEffect(() => {
        if (sheetData?.data && !loadedRef.current) {
            const loadedSheets = sheetData.data.sheets && Object.keys(sheetData.data.sheets).length > 0
                ? sheetData.data.sheets
                : { [DEFAULT_SHEET_NAME]: emptySheet() };
            setSheets(loadedSheets);
            setActiveSheetName(sheetData.data.activeSheet && loadedSheets[sheetData.data.activeSheet] ? sheetData.data.activeSheet : Object.keys(loadedSheets)[0]);
            loadedRef.current = true;
            historyPast.current = [];
            historyFuture.current = [];
            bumpHistory();
        }
    }, [sheetData, bumpHistory]);

    // Reset load-guard and local state when switching to a different section's sheet.
    useEffect(() => {
        loadedRef.current = false;
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
    }, [sectionId, meetingId, bumpHistory]);

    const activeSheet = sheets[activeSheetName] || emptySheet();
    const cells = activeSheet.cells;
    const rowCount = activeSheet.rowCount;
    const columnCount = activeSheet.columnCount;
    const conditionalRules = activeSheet.conditionalRules || [];
    const merges = activeSheet.merges || [];
    const columnWidths = activeSheet.columnWidths || {};
    const rowHeights = activeSheet.rowHeights || {};
    const tables = activeSheet.tables || [];

    const columns = useMemo(() => Array.from({ length: columnCount }, (_, i) => indexToCol(i)), [columnCount]);
    const rows = useMemo(() => Array.from({ length: rowCount }, (_, i) => i), [rowCount]);
    const displayGrid = useMemo(() => buildDisplayGrid(cells), [cells]);

    // Broadcasts the live sheet + evaluated values to the parent (e.g. ExcelGraph)
    // on every change, so a chart above the grid can re-render as the user types.
    // `selection` rides along too, so the chart's "Use Selection" action can read
    // whatever range the user currently has drag-selected in the grid.
    useEffect(() => {
        if (!onDataChange) return;
        onDataChange({ sheets, activeSheetName, displayGrid, rowCount, columnCount, selection, activeCell });
    }, [sheets, activeSheetName, displayGrid, rowCount, columnCount, selection, activeCell, onDataChange]);

    const selectedCellIds = useMemo(() => new Set(expandRange(selection.start, selection.end)), [selection]);
    const selectionBounds = useMemo(() => {
        const s = parseCellRef(selection.start), e = parseCellRef(selection.end);
        if (!s || !e) return null;
        return {
            minRow: Math.min(s.row, e.row), maxRow: Math.max(s.row, e.row),
            minCol: Math.min(s.col, e.col), maxCol: Math.max(s.col, e.col)
        };
    }, [selection]);

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

    // Excel-style AutoFilter: a row is hidden if it sits in some table's data
    // range and fails at least one of that table's active column filters. Row
    // numbers aren't renumbered — the row is simply skipped when rendering,
    // same as Excel's filtered view.
    const hiddenRowSet = useMemo(() => {
        const hidden = new Set();
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
    }, [tables, displayGrid]);

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

    // Deep-clones the whole workbook before mutating, so the snapshot pushed
    // onto the undo stack a moment ago can never be corrupted by an in-place
    // edit to the "current" state that shares the same nested objects.
    const updateSheets = useCallback((updater) => {
        historyPast.current.push(sheets);
        if (historyPast.current.length > HISTORY_LIMIT) historyPast.current.shift();
        historyFuture.current = [];
        bumpHistory();

        setSheets((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            updater(next);
            return next;
        });
        setIsDirty(true);
    }, [sheets, bumpHistory]);

    const mutateActiveCells = useCallback((mutator) => {
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            if (!sheet) return;
            mutator(sheet.cells);
        });
    }, [updateSheets, activeSheetName]);

    // --- Column/row resize (drag handles on the headers) ---

    const widthForCol = useCallback((colIdx) => (
        resizePreview?.type === "col" && resizePreview.index === colIdx ? resizePreview.size : (columnWidths[colIdx] || DEFAULT_COLUMN_WIDTH)
    ), [resizePreview, columnWidths]);

    const heightForRow = useCallback((rowIdx) => (
        resizePreview?.type === "row" && resizePreview.index === rowIdx ? resizePreview.size : (rowHeights[rowIdx] || DEFAULT_ROW_HEIGHT)
    ), [resizePreview, rowHeights]);

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
            const delta = r.type === "col" ? e.clientX - r.startPos : e.clientY - r.startPos;
            const min = r.type === "col" ? MIN_COLUMN_WIDTH : MIN_ROW_HEIGHT;
            const newSize = Math.max(min, r.startSize + delta);
            resizeRef.current = { ...r, currentSize: newSize };
            setResizePreview({ type: r.type, index: r.index, size: newSize });
        };
        const onMouseUp = () => {
            const r = resizeRef.current;
            if (!r) return;
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
    }, [updateSheets, activeSheetName]);

    const undo = useCallback(() => {
        if (historyPast.current.length === 0) return;
        const prevSnapshot = historyPast.current.pop();
        historyFuture.current.push(sheets);
        if (historyFuture.current.length > HISTORY_LIMIT) historyFuture.current.shift();
        setSheets(prevSnapshot);
        setIsDirty(true);
        bumpHistory();
    }, [sheets, bumpHistory]);

    const redo = useCallback(() => {
        if (historyFuture.current.length === 0) return;
        const nextSnapshot = historyFuture.current.pop();
        historyPast.current.push(sheets);
        if (historyPast.current.length > HISTORY_LIMIT) historyPast.current.shift();
        setSheets(nextSnapshot);
        setIsDirty(true);
        bumpHistory();
    }, [sheets, bumpHistory]);

    const commitEdit = useCallback(() => {
        if (!editingCell) return;
        const cellId = editingCell;
        const value = editValue;
        mutateActiveCells((next) => {
            const merged = { ...(next[cellId] || {}), value };
            if (isBlankCell(merged)) delete next[cellId];
            else next[cellId] = merged;
        });
        setEditingCell(null);
        setEditValue("");
        formulaInsertRange.current = null;
    }, [editingCell, editValue, mutateActiveCells]);

    const startEditing = useCallback((cellId, initialValue) => {
        setActiveCell(cellId);
        setSelection({ start: cellId, end: cellId });
        setEditingCell(cellId);
        setEditValue(initialValue !== undefined ? initialValue : (cells[cellId]?.value ?? ""));
        formulaInsertRange.current = null;
    }, [cells]);

    const cancelEdit = useCallback(() => {
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
        const { minRow, maxRow, minCol, maxCol } = selectionBounds;
        const cellsByRelPos = {};
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const id = getCellId(r, c);
                if (cells[id]) cellsByRelPos[`${r - minRow},${c - minCol}`] = cells[id];
            }
        }
        setClipboard({ cellsByRelPos, height: maxRow - minRow + 1, width: maxCol - minCol + 1, type, sourceBounds: selectionBounds });
    }, [selectionBounds, cells]);

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
        const onKeyDown = (e) => {
            const tag = document.activeElement?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;
            if (!(e.ctrlKey || e.metaKey)) return;
            const key = e.key.toLowerCase();
            if (key === "c") { e.preventDefault(); copySelection("copy"); return; }
            if (readOnly) return;
            if (key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
            else if (key === "y" || (key === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
            else if (key === "x") { e.preventDefault(); copySelection("cut"); }
            else if (key === "v") { e.preventDefault(); handlePaste(); }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [undo, redo, copySelection, handlePaste, readOnly]);

    const handleCellMouseDown = useCallback((cellId) => {
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
        setActiveCell(cellId);
        setSelection({ start: cellId, end: cellId });
    }, [editingCell, editValue, commitEdit, formatPainterStyle, mutateActiveCells, insertFormulaReference]);

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
            setSelection((prev) => ({ ...prev, end: cellId }));
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

    const selectRow = useCallback((rowIdx) => {
        if (editingCell) commitEdit();
        const start = getCellId(rowIdx, 0);
        const end = getCellId(rowIdx, columnCount - 1);
        setActiveCell(start);
        setSelection({ start, end });
    }, [columnCount, editingCell, commitEdit]);

    const selectColumn = useCallback((colIdx) => {
        if (editingCell) commitEdit();
        const start = getCellId(0, colIdx);
        const end = getCellId(rowCount - 1, colIdx);
        setActiveCell(start);
        setSelection({ start, end });
    }, [rowCount, editingCell, commitEdit]);

    // Keyboard navigation over the grid: arrows move/extend selection, Enter/F2
    // or a printable keypress opens the cell editor, matching common
    // spreadsheet muscle memory without pulling in a grid library.
    const handleGridKeyDown = useCallback((e) => {
        if (editingCell) return;
        const ref = /^([A-Z]+)(\d+)$/.exec(activeCell);
        if (!ref) return;
        const colLetters = ref[1];
        const rowIdx = parseInt(ref[2], 10) - 1;
        const colIdx = columns.indexOf(colLetters);

        const clamp = (v, max) => Math.max(0, Math.min(max - 1, v));
        let nextRow = rowIdx, nextCol = colIdx, handled = false;

        if (e.key === "ArrowUp") { nextRow = clamp(rowIdx - 1, rowCount); handled = true; }
        else if (e.key === "ArrowDown") { nextRow = clamp(rowIdx + 1, rowCount); handled = true; }
        else if (e.key === "ArrowLeft") { nextCol = clamp(colIdx - 1, columnCount); handled = true; }
        else if (e.key === "ArrowRight") { nextCol = clamp(colIdx + 1, columnCount); handled = true; }
        else if (e.key === "Tab") { nextCol = clamp(colIdx + (e.shiftKey ? -1 : 1), columnCount); handled = true; }
        else if (!readOnly && (e.key === "Enter" || e.key === "F2")) {
            startEditing(activeCell);
            e.preventDefault();
            return;
        } else if (!readOnly && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            startEditing(activeCell, e.key);
            e.preventDefault();
            return;
        }

        if (!handled) return;
        e.preventDefault();
        // A merge only renders one <td>, at its anchor — redirect off any
        // covered cell arrow-key navigation would otherwise land on, since
        // there's nothing there to select or show an active outline on.
        const nextId = resolveToAnchor(getCellId(nextRow, nextCol));
        setActiveCell(nextId);
        if (e.shiftKey && e.key !== "Tab") {
            setSelection((prev) => ({ start: prev.start, end: nextId }));
        } else {
            setSelection({ start: nextId, end: nextId });
        }
    }, [activeCell, columns, rowCount, columnCount, editingCell, startEditing, resolveToAnchor, readOnly]);

    const applyToSelection = useCallback((mutator) => {
        const ids = expandRange(selection.start, selection.end);
        mutateActiveCells((next) => {
            for (const id of ids) {
                const merged = mutator({ ...(next[id] || {}) }, id);
                if (isBlankCell(merged)) delete next[id];
                else next[id] = merged;
            }
        });
    }, [selection, mutateActiveCells]);

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
        if (!selectionBounds) return;
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
            const newIds = new Set(expandRange(rangeStart, rangeEnd));
            sheet.merges = sheet.merges.filter((m) => !expandRange(m.start, m.end).some((id) => newIds.has(id)));
            sheet.merges.push({ start: rangeStart, end: rangeEnd });

            for (const id of newIds) {
                if (id === rangeStart) continue;
                delete sheet.cells[id];
            }
            const anchor = { ...(sheet.cells[rangeStart] || {}), align: "center", valign: sheet.cells[rangeStart]?.valign || "middle" };
            sheet.cells[rangeStart] = anchor;
        });
        setActiveCell(rangeStart);
        setSelection({ start: rangeStart, end: rangeEnd });
    };
    const setFontSize = (fontSize) => applyToSelection((cell) => ({ ...cell, fontSize: fontSize ? Number(fontSize) : undefined }));
    const setFontFamily = (fontFamily) => applyToSelection((cell) => ({ ...cell, fontFamily: fontFamily || undefined }));
    const setBg = (bg) => applyToSelection((cell) => ({ ...cell, bg }));
    const setColor = (color) => applyToSelection((cell) => ({ ...cell, color }));
    const setNumberFormat = (fmt) => applyToSelection((cell) => ({ ...cell, numberFormat: fmt === "general" ? undefined : fmt }));
    const adjustDecimals = (delta) => applyToSelection((cell) => ({
        ...cell,
        decimalPlaces: Math.max(0, (cell.decimalPlaces !== undefined ? cell.decimalPlaces : 2) + delta)
    }));
    const applyBorderSides = (option) => {
        if (option.sides.length === 0) {
            applyToSelection((cell) => ({ ...cell, border: undefined }));
            return;
        }
        const borderObj = Object.fromEntries(option.sides.map((s) => [s, borderWeight]));
        applyToSelection((cell) => ({ ...cell, border: borderObj }));
    };
    const applyCellStylePreset = (preset) => applyToSelection((cell) => ({ ...cell, ...preset.style }));

    // Formats the current selection as a table: colors its first row as a header
    // and bands the remaining rows, using the chosen style preset. Registers a
    // `table` entry (range + style + filter state) on the sheet so the header
    // row can offer AutoFilter dropdowns when `filtersEnabled` is on. Re-applying
    // over the same exact range updates that table in place instead of stacking
    // a duplicate.
    const applyTable = (presetKey, filtersEnabled) => {
        if (!selectionBounds) return;
        const preset = TABLE_STYLE_PRESETS.find((p) => p.key === presetKey) || TABLE_STYLE_PRESETS[0];
        const { minRow, maxRow, minCol, maxCol } = selectionBounds;
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
    // Note: shifts cell values and formatting correctly, but does not rewrite
    // formulas elsewhere on the sheet that reference the shifted cells —
    // matching a plain insert/delete, not Excel's full reference-repair.

    const insertRowAt = (rowIdx) => {
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            const newCells = {};
            for (const id of Object.keys(sheet.cells)) {
                const ref = parseCellRef(id);
                const newRow = ref.row >= rowIdx ? ref.row + 1 : ref.row;
                newCells[getCellId(newRow, ref.col)] = sheet.cells[id];
            }
            sheet.cells = newCells;
            sheet.rowCount += 1;
        });
    };
    const deleteRowAt = (rowIdx) => {
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            const newCells = {};
            for (const id of Object.keys(sheet.cells)) {
                const ref = parseCellRef(id);
                if (ref.row === rowIdx) continue;
                const newRow = ref.row > rowIdx ? ref.row - 1 : ref.row;
                newCells[getCellId(newRow, ref.col)] = sheet.cells[id];
            }
            sheet.cells = newCells;
            sheet.rowCount = Math.max(1, sheet.rowCount - 1);
        });
    };
    const insertColumnAt = (colIdx) => {
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            const newCells = {};
            for (const id of Object.keys(sheet.cells)) {
                const ref = parseCellRef(id);
                const newCol = ref.col >= colIdx ? ref.col + 1 : ref.col;
                newCells[getCellId(ref.row, newCol)] = sheet.cells[id];
            }
            sheet.cells = newCells;
            sheet.columnCount += 1;
        });
    };
    const deleteColumnAt = (colIdx) => {
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            const newCells = {};
            for (const id of Object.keys(sheet.cells)) {
                const ref = parseCellRef(id);
                if (ref.col === colIdx) continue;
                const newCol = ref.col > colIdx ? ref.col - 1 : ref.col;
                newCells[getCellId(ref.row, newCol)] = sheet.cells[id];
            }
            sheet.cells = newCells;
            sheet.columnCount = Math.max(1, sheet.columnCount - 1);
        });
    };

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
        if (!selectionBounds) return;
        const { minRow, maxRow, minCol, maxCol } = selectionBounds;
        const sortCol = minCol;
        updateSheets((next) => {
            const sheet = next[activeSheetName];
            const rowsData = [];
            for (let r = minRow; r <= maxRow; r++) {
                const rowCells = {};
                for (let c = minCol; c <= maxCol; c++) rowCells[c] = sheet.cells[getCellId(r, c)];
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

    // --- Find & replace (active sheet only) ---

    const matches = useMemo(() => {
        if (!findText) return [];
        const needle = findText.toLowerCase();
        return Object.keys(cells).filter((id) => String(cells[id]?.value ?? "").toLowerCase().includes(needle)).sort();
    }, [cells, findText]);

    useEffect(() => { setMatchIndex(0); }, [findText, activeSheetName]);

    const goToMatch = (idx) => {
        if (matches.length === 0) return;
        const wrapped = ((idx % matches.length) + matches.length) % matches.length;
        setMatchIndex(wrapped);
        const id = matches[wrapped];
        setActiveCell(id);
        setSelection({ start: id, end: id });
    };
    const findNext = () => goToMatch(matchIndex + 1);

    const replaceOne = () => {
        if (matches.length === 0) return;
        const id = matches[matchIndex];
        const re = new RegExp(escapeRegex(findText), "i");
        mutateActiveCells((next) => {
            const current = String(next[id]?.value ?? "");
            const merged = { ...(next[id] || {}), value: current.replace(re, replaceText) };
            if (isBlankCell(merged)) delete next[id]; else next[id] = merged;
        });
        findNext();
    };

    const replaceAll = () => {
        if (matches.length === 0) return;
        const re = new RegExp(escapeRegex(findText), "gi");
        const count = matches.length;
        mutateActiveCells((next) => {
            for (const id of matches) {
                const current = String(next[id]?.value ?? "");
                const merged = { ...(next[id] || {}), value: current.replace(re, replaceText) };
                if (isBlankCell(merged)) delete next[id]; else next[id] = merged;
            }
        });
        toast.success(`Replaced ${count} match${count === 1 ? "" : "es"}.`);
    };

    // --- Save / export / import ---

    const handleSave = async () => {
        try {
            if (meetingId) {
                await saveMeetingSheet({ meetingId, sheets, activeSheet: activeSheetName }).unwrap();
            } else {
                await saveSectionSheet({ sectionId, sheets, activeSheet: activeSheetName }).unwrap();
            }
            setIsDirty(false);
            toast.success("Spreadsheet saved successfully!");
        } catch (err) {
            toast.error("Failed to save spreadsheet. Please try again.");
        }
    };

    // Charts live under sheets[activeSheetName].charts (one sheet can hold several,
    // one per table), so persisting them reuses the same save-the-whole-workbook
    // endpoint as a normal cell edit — no separate backend route needed. Bypasses
    // the undo history (chart settings aren't something a user expects Ctrl+Z to
    // touch) and saves immediately so the chart layout survives a refresh without
    // the user hitting Save.
    const persistCharts = useCallback(async (charts) => {
        if (readOnly) return;
        const nextSheets = JSON.parse(JSON.stringify(sheets));
        if (!nextSheets[activeSheetName]) return;
        nextSheets[activeSheetName].charts = charts;
        setSheets(nextSheets);
        try {
            if (meetingId) {
                await saveMeetingSheet({ meetingId, sheets: nextSheets, activeSheet: activeSheetName }).unwrap();
            } else {
                await saveSectionSheet({ sectionId, sheets: nextSheets, activeSheet: activeSheetName }).unwrap();
            }
            setIsDirty(false);
        } catch (err) {
            toast.error("Failed to save chart settings.");
        }
    }, [sheets, activeSheetName, sectionId, meetingId, readOnly, saveSectionSheet, saveMeetingSheet]);

    useImperativeHandle(ref, () => ({
        updateCharts: persistCharts,
    }), [persistCharts]);

    const handleExport = async () => {
        const XLSX = await import("xlsx");
        const aoa = rows.map((r) => columns.map((_, c) => {
            const id = getCellId(r, c);
            return displayGrid[id] ?? "";
        }));
        const worksheet = XLSX.utils.aoa_to_sheet(aoa);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, activeSheetName.slice(0, 31));
        XLSX.writeFile(workbook, `daily-meeting-section-${sectionId}-${activeSheetName}.xlsx`);
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleImportFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const XLSX = await import("xlsx");
                const workbook = XLSX.read(evt.target.result, { type: "array" });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

                const importedCells = {};
                let maxRow = 0, maxCol = 0;
                aoa.forEach((rowArr, rIdx) => {
                    rowArr.forEach((val, cIdx) => {
                        if (val === "" || val === null || val === undefined) return;
                        importedCells[getCellId(rIdx, cIdx)] = { value: String(val) };
                        maxRow = Math.max(maxRow, rIdx + 1);
                        maxCol = Math.max(maxCol, cIdx + 1);
                    });
                });

                updateSheets((next) => {
                    next[activeSheetName] = {
                        cells: importedCells,
                        rowCount: Math.max(DEFAULT_ROW_COUNT, maxRow),
                        columnCount: Math.max(DEFAULT_COLUMN_COUNT, maxCol),
                        conditionalRules: [],
                        merges: [],
                        columnWidths: {},
                        rowHeights: {}
                    };
                });
                toast.success("Spreadsheet imported. Click Save to persist it.");
            } catch (err) {
                toast.error("Failed to read the Excel file.");
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = "";
    };

    const ribbonBtnClass = (active) => cn("h-7 w-7 cursor-pointer", active && "bg-indigo-100 text-indigo-700 hover:bg-indigo-100");

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <IconLoader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="w-full">
            {!readOnly && (
            <>
            {/* Quick access row */}
            <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-slate-200 bg-white rounded-t-lg">
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 cursor-pointer">
                    {isSaving ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconDeviceFloppy className="w-4 h-4" />}
                    Save{isDirty ? " *" : ""}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={undo} disabled={historyPast.current.length === 0} title="Undo (Ctrl+Z)">
                    <IconArrowBackUp className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={redo} disabled={historyFuture.current.length === 0} title="Redo (Ctrl+Y)">
                    <IconArrowForwardUp className="w-4 h-4" />
                </Button>
                <div className="flex-1" />
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
                <Button variant="outline" size="sm" className="h-8 cursor-pointer" onClick={handleImportClick} title="Import from Excel">
                    <IconUpload className="w-4 h-4" /> Import
                </Button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
                <Button variant="outline" size="sm" className="h-8 cursor-pointer" onClick={handleExport} title="Export to Excel">
                    <IconDownload className="w-4 h-4" /> Export
                </Button>
            </div>

            {/* Ribbon */}
            <div className="flex flex-wrap items-start border-b border-slate-200 bg-slate-50/60 overflow-x-auto">
                <RibbonGroup label="Clipboard">
                    <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => copySelection("copy")} title="Copy (Ctrl+C)"><IconCopy className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => copySelection("cut")} title="Cut (Ctrl+X)"><IconCut className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={handlePaste} disabled={!clipboard} title="Paste (Ctrl+V)"><IconClipboard className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className={ribbonBtnClass(!!formatPainterStyle)} onClick={activateFormatPainter} title="Format Painter — click a cell to apply"><IconBrush className="w-4 h-4" /></Button>
                </RibbonGroup>

                <RibbonGroup label="Font">
                    <select className="h-7 text-[11px] border border-slate-200 rounded px-1 bg-white text-slate-700 w-24 cursor-pointer" value={activeCellData?.fontFamily || ""} onChange={(e) => setFontFamily(e.target.value)} title="Font family">
                        <option value="">Default</option>
                        {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select className="h-7 text-[11px] border border-slate-200 rounded px-1 bg-white text-slate-700 w-12 cursor-pointer" value={activeCellData?.fontSize || ""} onChange={(e) => setFontSize(e.target.value)} title="Font size">
                        <option value="">Size</option>
                        {FONT_SIZES.map((sz) => <option key={sz} value={sz}>{sz}</option>)}
                    </select>
                    <Button variant="ghost" size="icon" className={ribbonBtnClass(!!activeCellData?.bold)} onClick={() => toggleStyle("bold")} title="Bold"><IconBold className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className={ribbonBtnClass(!!activeCellData?.italic)} onClick={() => toggleStyle("italic")} title="Italic"><IconItalic className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className={ribbonBtnClass(!!activeCellData?.underline)} onClick={() => toggleStyle("underline")} title="Underline"><IconUnderline className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className={ribbonBtnClass(!!activeCellData?.strike)} onClick={() => toggleStyle("strike")} title="Strikethrough"><IconStrikethrough className="w-4 h-4" /></Button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" title="Borders"><IconBorderOuter className="w-4 h-4" /></Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2 bg-white border border-slate-200 shadow-md rounded-lg space-y-2" align="start">
                            <div>
                                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 mb-1">Weight</div>
                                <div className="flex gap-1">
                                    {BORDER_WEIGHTS.map((w) => (
                                        <button
                                            key={w.value}
                                            className={cn(
                                                "flex-1 text-[11px] px-1.5 py-1 rounded border cursor-pointer",
                                                borderWeight === w.value ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                            )}
                                            onClick={() => setBorderWeight(w.value)}
                                        >
                                            {w.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="border-t border-slate-100 pt-1.5">
                                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 mb-1">Apply To</div>
                                {BORDER_SIDE_OPTIONS.map((opt) => (
                                    <button key={opt.key} className="w-full flex items-center gap-1.5 text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer" onClick={() => applyBorderSides(opt)}>
                                        <opt.icon className="w-3.5 h-3.5 shrink-0" />
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                    <label className="flex items-center h-7 px-1 rounded hover:bg-slate-100 cursor-pointer" title="Font color">
                        <IconPalette className="w-4 h-4 text-slate-600" />
                        <input type="color" className="w-4 h-4 border-0 p-0 bg-transparent cursor-pointer" value={activeCellData?.color || "#0f172a"} onChange={(e) => setColor(e.target.value)} />
                    </label>
                    <label className="flex items-center gap-0.5 h-7 px-1 rounded hover:bg-slate-100 cursor-pointer" title="Fill color">
                        <div className="w-3.5 h-3.5 rounded-sm border border-slate-300" style={{ backgroundColor: activeCellData?.bg || "#ffffff" }} />
                        <input type="color" className="w-4 h-4 border-0 p-0 bg-transparent cursor-pointer" value={activeCellData?.bg || "#ffffff"} onChange={(e) => setBg(e.target.value)} />
                    </label>
                </RibbonGroup>

                <RibbonGroup label="Alignment">
                    <Button variant="ghost" size="icon" className={ribbonBtnClass(activeCellData?.valign === "top")} onClick={() => setValign("top")} title="Align top"><IconLayoutAlignTop className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className={ribbonBtnClass(!activeCellData?.valign || activeCellData?.valign === "middle")} onClick={() => setValign("middle")} title="Align middle"><IconLayoutAlignMiddle className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className={ribbonBtnClass(activeCellData?.valign === "bottom")} onClick={() => setValign("bottom")} title="Align bottom"><IconLayoutAlignBottom className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className={ribbonBtnClass(activeCellData?.align === "left" || !activeCellData?.align)} onClick={() => setAlign("left")} title="Align left"><IconAlignLeft className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className={ribbonBtnClass(activeCellData?.align === "center")} onClick={() => setAlign("center")} title="Align center"><IconAlignCenter className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className={ribbonBtnClass(activeCellData?.align === "right")} onClick={() => setAlign("right")} title="Align right"><IconAlignRight className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className={ribbonBtnClass(!!activeCellData?.wrap)} onClick={toggleWrap} title="Wrap text"><IconTextWrap className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] px-1.5 cursor-pointer" onClick={mergeCenter} title="Merge & Center — merges the selection into one cell; click again to unmerge">Merge</Button>
                </RibbonGroup>

                <RibbonGroup label="Number">
                    <select className="h-7 text-[11px] border border-slate-200 rounded px-1 bg-white text-slate-700 w-24 cursor-pointer" value={activeCellData?.numberFormat || "general"} onChange={(e) => setNumberFormat(e.target.value)} title="Number format">
                        {NUMBER_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => setNumberFormat("currency")} title="Currency"><IconCurrencyDollar className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => setNumberFormat("percentage")} title="Percent"><IconPercentage className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 text-xs font-semibold cursor-pointer" onClick={() => setNumberFormat("comma")} title="Comma">,</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => adjustDecimals(1)} title="Increase decimal"><IconChevronUp className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => adjustDecimals(-1)} title="Decrease decimal"><IconChevronDown className="w-3.5 h-3.5" /></Button>
                </RibbonGroup>

                <RibbonGroup label="Styles">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-[11px] px-1.5 cursor-pointer" title="Conditional formatting">Cond. Format</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-60 p-2 bg-white border border-slate-200 shadow-md rounded-lg space-y-2" align="start">
                            <div className="text-[11px] font-semibold text-slate-600">Highlight cells in selection where value:</div>
                            <div className="flex items-center gap-1">
                                <select className="h-7 text-xs border border-slate-200 rounded px-1 cursor-pointer" value={condOperator} onChange={(e) => setCondOperator(e.target.value)}>
                                    <option value=">">&gt;</option>
                                    <option value="<">&lt;</option>
                                    <option value=">=">&ge;</option>
                                    <option value="<=">&le;</option>
                                    <option value="=">=</option>
                                </select>
                                <input type="number" className="h-7 text-xs border border-slate-200 rounded px-1.5 w-16" value={condThreshold} onChange={(e) => setCondThreshold(e.target.value)} placeholder="value" />
                                <input type="color" className="w-6 h-6" value={condColor} onChange={(e) => setCondColor(e.target.value)} />
                            </div>
                            <div className="flex gap-1.5">
                                <Button size="sm" className="h-7 text-xs flex-1 cursor-pointer" onClick={addConditionalRule}>Apply</Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs cursor-pointer" onClick={clearConditionalRules}>Clear All</Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Popover open={tableStylePopoverOpen} onOpenChange={setTableStylePopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-[11px] px-1.5 cursor-pointer" title="Format as table"><IconTable className="w-4 h-4" /> Table</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2 bg-white border border-slate-200 shadow-md rounded-lg space-y-2" align="start">
                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Table Style</div>
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
                                <span className="text-xs text-slate-700 select-none">Enable column filters</span>
                            </label>
                            <Button
                                size="sm"
                                className="w-full h-7 text-xs cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white"
                                onClick={() => { applyTable(selectedTableStyleKey, tableFiltersEnabled); setTableStylePopoverOpen(false); }}
                            >
                                Apply
                            </Button>
                        </PopoverContent>
                    </Popover>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-[11px] px-1.5 cursor-pointer" title="Cell styles">Cell Styles</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-1 bg-white border border-slate-200 shadow-md rounded-lg" align="start">
                            {CELL_STYLE_PRESETS.map((preset) => (
                                <button key={preset.key} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer" onClick={() => applyCellStylePreset(preset)}>
                                    {preset.label}
                                </button>
                            ))}
                        </PopoverContent>
                    </Popover>
                </RibbonGroup>

                <RibbonGroup label="Cells">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-[11px] px-1.5 cursor-pointer" title="Insert"><IconRowInsertBottom className="w-4 h-4" /> Insert</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-44 p-1 bg-white border border-slate-200 shadow-md rounded-lg" align="start">
                            <button className="w-full flex items-center gap-1.5 text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer" onClick={() => insertRowAt(parseCellRef(activeCell).row)}><IconRowInsertTop className="w-3.5 h-3.5" /> Row Above</button>
                            <button className="w-full flex items-center gap-1.5 text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer" onClick={() => insertRowAt(parseCellRef(activeCell).row + 1)}><IconRowInsertBottom className="w-3.5 h-3.5" /> Row Below</button>
                            <button className="w-full flex items-center gap-1.5 text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer" onClick={() => insertColumnAt(parseCellRef(activeCell).col)}><IconColumnInsertLeft className="w-3.5 h-3.5" /> Column Left</button>
                            <button className="w-full flex items-center gap-1.5 text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer" onClick={() => insertColumnAt(parseCellRef(activeCell).col + 1)}><IconColumnInsertRight className="w-3.5 h-3.5" /> Column Right</button>
                        </PopoverContent>
                    </Popover>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-[11px] px-1.5 cursor-pointer" title="Delete"><IconTrash className="w-4 h-4" /> Delete</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-1 bg-white border border-slate-200 shadow-md rounded-lg" align="start">
                            <button className="w-full flex items-center gap-1.5 text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer" onClick={() => deleteRowAt(parseCellRef(activeCell).row)}><IconRowRemove className="w-3.5 h-3.5" /> Delete Row</button>
                            <button className="w-full flex items-center gap-1.5 text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer" onClick={() => deleteColumnAt(parseCellRef(activeCell).col)}><IconColumnRemove className="w-3.5 h-3.5" /> Delete Column</button>
                        </PopoverContent>
                    </Popover>
                    <Button variant="outline" size="sm" className="h-7 text-[11px] px-1.5 cursor-pointer" onClick={() => updateSheets((next) => { next[activeSheetName].columnCount += 1; })} title="Add column at end"><IconPlus className="w-3.5 h-3.5" /> Col</Button>
                    <Button variant="outline" size="sm" className="h-7 text-[11px] px-1.5 cursor-pointer" onClick={() => updateSheets((next) => { next[activeSheetName].rowCount += 1; })} title="Add row at end"><IconPlus className="w-3.5 h-3.5" /> Row</Button>
                </RibbonGroup>

                <RibbonGroup label="Editing">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-[11px] px-1.5 cursor-pointer" title="AutoSum"><IconSum className="w-4 h-4" /> AutoSum</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-32 p-1 bg-white border border-slate-200 shadow-md rounded-lg" align="start">
                            {AUTOSUM_FUNCS.map((fn) => (
                                <button key={fn} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer" onClick={() => insertAutoSum(fn)}>{fn}</button>
                            ))}
                        </PopoverContent>
                    </Popover>
                    <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => sortSelection("asc")} title="Sort ascending by leftmost column"><IconSortAscending className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => sortSelection("desc")} title="Sort descending by leftmost column"><IconSortDescending className="w-4 h-4" /></Button>
                    <Button
                        variant="ghost" size="sm" className={cn("h-7 text-[11px] px-1.5 cursor-pointer", showFindReplace && "bg-indigo-100 text-indigo-700 hover:bg-indigo-100")}
                        onClick={() => setShowFindReplace((v) => !v)} title="Find & Select"
                    >
                        <IconSearch className="w-4 h-4" /> Find
                    </Button>
                </RibbonGroup>
            </div>
            </>
            )}

            {/* Find & replace panel */}
            {showFindReplace && (
                <div className="flex flex-wrap items-center gap-2 px-2 py-2 border-b border-slate-200 bg-amber-50/60">
                    <IconSearch className="w-4 h-4 text-slate-500 shrink-0" />
                    <input
                        className="h-7 text-xs border border-slate-200 rounded px-2 w-40"
                        placeholder="Find"
                        value={findText}
                        onChange={(e) => setFindText(e.target.value)}
                    />
                    <input
                        className="h-7 text-xs border border-slate-200 rounded px-2 w-40"
                        placeholder="Replace with"
                        value={replaceText}
                        onChange={(e) => setReplaceText(e.target.value)}
                    />
                    <span className="text-[11px] text-slate-500 w-16">{matches.length ? `${matchIndex + 1}/${matches.length}` : "0 matches"}</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer" onClick={findNext} disabled={!matches.length}>Find Next</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer" onClick={replaceOne} disabled={!matches.length}>Replace</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer" onClick={replaceAll} disabled={!matches.length}>Replace All</Button>
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
                        onFocus={(e) => { activeEditInputRef.current = e.target; if (!readOnly && editingCell !== activeCell) startEditing(activeCell); }}
                        onChange={(e) => { setEditValue(e.target.value); formulaInsertRange.current = null; }}
                        onSelect={(e) => { cursorPosRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd }; }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) { commitEdit(); e.preventDefault(); }
                            else if (e.key === "Escape") cancelEdit();
                        }}
                        onBlur={commitEdit}
                        placeholder="Enter a value or formula, e.g. =SUM(A1:A5)"
                    />
                ) : (
                    <div className="relative flex-1">
                        {editingCell === activeCell && isEditingFormula && <FormulaTextOverlay text={editValue} mono className="px-1 py-1" />}
                        <input
                            ref={formulaBarInputRef}
                            className={cn(
                                "w-full text-xs font-mono outline-none px-1 py-1",
                                editingCell === activeCell && isEditingFormula && "bg-transparent text-transparent caret-slate-900"
                            )}
                            readOnly={readOnly}
                            value={editingCell === activeCell ? editValue : (cells[activeCell]?.value ?? "")}
                            onFocus={(e) => { activeEditInputRef.current = e.target; if (!readOnly && editingCell !== activeCell) startEditing(activeCell); }}
                            onChange={(e) => { setEditValue(e.target.value); formulaInsertRange.current = null; }}
                            onSelect={(e) => { cursorPosRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd }; }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") { commitEdit(); e.preventDefault(); }
                                else if (e.key === "Escape") cancelEdit();
                            }}
                            onBlur={commitEdit}
                            placeholder="Enter a value or formula, e.g. =SUM(A1:A5)"
                        />
                    </div>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 cursor-pointer" onClick={() => setIsFormulaBarExpanded((v) => !v)} title="Expand/collapse formula bar">
                    {isFormulaBarExpanded ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                </Button>
            </div>

            {/* Grid */}
            <div
                ref={gridContainerRef}
                className="overflow-auto border border-slate-200 outline-none select-none"
                style={{ maxHeight: 560 }}
                tabIndex={0}
                onKeyDown={handleGridKeyDown}
                onMouseLeave={() => setHoveredCell(null)}
            >
                <table
                    className="border-collapse"
                    style={{ tableLayout: "fixed", width: ROW_HEADER_WIDTH + columns.reduce((sum, _, colIdx) => sum + widthForCol(colIdx), 0) }}
                >
                    <thead>
                        <tr>
                            <th className="sticky top-0 left-0 z-30 bg-slate-100 border border-slate-200 h-7" style={{ width: ROW_HEADER_WIDTH }} />
                            {columns.map((c, colIdx) => (
                                <th
                                    key={c}
                                    onClick={() => selectColumn(colIdx)}
                                    className={cn(
                                        "sticky top-0 z-20 border border-slate-200 text-[11px] font-semibold h-7 cursor-pointer hover:bg-slate-200 relative",
                                        (hoveredCell?.col === colIdx || (selectionBounds && colIdx >= selectionBounds.minCol && colIdx <= selectionBounds.maxCol))
                                            ? "bg-indigo-100 text-indigo-700"
                                            : "bg-slate-100 text-slate-600"
                                    )}
                                    style={{ width: widthForCol(colIdx) }}
                                >
                                    {c}
                                    <div
                                        onMouseDown={(e) => startColumnResize(e, colIdx)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-400/60 z-10"
                                        title="Drag to resize column"
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((rowIdx) => {
                            if (hiddenRowSet.has(rowIdx)) return null;
                            return (
                            <tr key={rowIdx}>
                                <td
                                    onClick={() => selectRow(rowIdx)}
                                    className={cn(
                                        "sticky left-0 z-10 border border-slate-200 text-[11px] font-semibold text-center cursor-pointer hover:bg-slate-200 relative",
                                        (hoveredCell?.row === rowIdx || (selectionBounds && rowIdx >= selectionBounds.minRow && rowIdx <= selectionBounds.maxRow))
                                            ? "bg-indigo-100 text-indigo-700"
                                            : "bg-slate-100 text-slate-500"
                                    )}
                                    style={{ width: ROW_HEADER_WIDTH, height: heightForRow(rowIdx) }}
                                >
                                    {rowIdx + 1}
                                    <div
                                        onMouseDown={(e) => startRowResize(e, rowIdx)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize hover:bg-indigo-400/60 z-10"
                                        title="Drag to resize row"
                                    />
                                </td>
                                {columns.map((_, colIdx) => {
                                    const cellId = getCellId(rowIdx, colIdx);
                                    const merge = mergeMap[cellId];
                                    // Cells covered by a merge but not its anchor render nothing —
                                    // the anchor's <td> below spans over them via colSpan/rowSpan.
                                    if (merge && merge.start !== cellId) return null;

                                    const cell = cells[cellId];
                                    const isActive = activeCell === cellId;
                                    const isInRange = selectedCellIds.has(cellId);
                                    const isEditing = editingCell === cellId;
                                    const isFillCorner = selectionBounds && rowIdx === selectionBounds.maxRow && colIdx === selectionBounds.maxCol;
                                    const isFillPreviewCell = fillPreviewCellIds.has(cellId);
                                    const conditionalBg = conditionalBgMap[cellId];
                                    const mergeSpan = merge ? (() => {
                                        const s = parseCellRef(merge.start), e = parseCellRef(merge.end);
                                        return { rowSpan: e.row - s.row + 1, colSpan: e.col - s.col + 1 };
                                    })() : null;
                                    // Perimeter border for a multi-cell selection: only true on the
                                    // outer-facing sides of the selection rectangle, accounting for
                                    // this cell's merge span if it has one.
                                    const isMultiSelection = selectionBounds && (selectionBounds.minRow !== selectionBounds.maxRow || selectionBounds.minCol !== selectionBounds.maxCol);
                                    const spanRowEnd = rowIdx + (mergeSpan?.rowSpan || 1) - 1;
                                    const spanColEnd = colIdx + (mergeSpan?.colSpan || 1) - 1;
                                    const selectionEdges = isMultiSelection && isInRange ? {
                                        top: rowIdx === selectionBounds.minRow,
                                        bottom: spanRowEnd === selectionBounds.maxRow,
                                        left: colIdx === selectionBounds.minCol,
                                        right: spanColEnd === selectionBounds.maxCol
                                    } : null;
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
                                            onMouseDown={() => handleCellMouseDown(cellId)}
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
                                                            className="absolute right-0.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded hover:bg-black/10 z-10 text-white/90 cursor-pointer"
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
                                                    {isEditingFormula && <FormulaTextOverlay text={editValue} className="px-1.5 text-xs" />}
                                                    <input
                                                    ref={cellEditInputRef}
                                                    autoFocus
                                                    className={cn(
                                                        "w-full h-full px-1.5 text-xs outline-none border-none relative",
                                                        // A solid background here would paint over the colored-reference
                                                        // overlay sitting behind this (otherwise text-transparent) input —
                                                        // the <td> beneath already supplies the white backdrop.
                                                        isEditingFormula ? "bg-transparent text-transparent caret-slate-900" : "bg-white"
                                                    )}
                                                    value={editValue}
                                                    onChange={(e) => { setEditValue(e.target.value); formulaInsertRange.current = null; }}
                                                    onSelect={(e) => { cursorPosRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd }; }}
                                                    onFocus={(e) => { activeEditInputRef.current = e.target; }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            commitEdit();
                                                            const nextRow = Math.min(rowCount - 1, rowIdx + 1);
                                                            const nextId = resolveToAnchor(getCellId(nextRow, colIdx));
                                                            setActiveCell(nextId);
                                                            setSelection({ start: nextId, end: nextId });
                                                            // This input is about to unmount now that editing has ended, and
                                                            // nothing else claims focus — without this, focus falls off the
                                                            // page entirely and neither typing nor arrow-key navigation does
                                                            // anything until the user manually clicks a cell again.
                                                            gridContainerRef.current?.focus();
                                                            e.preventDefault();
                                                        } else if (e.key === "Tab") {
                                                            commitEdit();
                                                            const nextCol = Math.min(columnCount - 1, colIdx + 1);
                                                            const nextId = resolveToAnchor(getCellId(rowIdx, nextCol));
                                                            setActiveCell(nextId);
                                                            setSelection({ start: nextId, end: nextId });
                                                            gridContainerRef.current?.focus();
                                                            e.preventDefault();
                                                        } else if (e.key === "Escape") {
                                                            cancelEdit();
                                                            gridContainerRef.current?.focus();
                                                        }
                                                    }}
                                                    onBlur={commitEdit}
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className={cn("px-1.5 text-xs", cell?.wrap ? "whitespace-normal break-words overflow-hidden" : "truncate")}
                                                    style={cellStyleFor(cell)}
                                                >
                                                    {displayGrid[cellId] ?? ""}
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
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Sheet tabs */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-t border-slate-200 bg-slate-50 rounded-b-lg overflow-x-auto">
                {Object.keys(sheets).map((name) => (
                    <div
                        key={name}
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
                        {!readOnly && Object.keys(sheets).length > 1 && renamingSheet !== name && (
                            <button
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); deleteSheet(name); }}
                                title="Delete sheet"
                            >
                                <IconX className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                ))}
                {!readOnly && (
                <button className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 shrink-0 cursor-pointer" onClick={addSheet} title="Add sheet">
                    <IconPlus className="w-4 h-4" />
                </button>
                )}
            </div>
        </div>
    );
});

export default ExcelClone;
