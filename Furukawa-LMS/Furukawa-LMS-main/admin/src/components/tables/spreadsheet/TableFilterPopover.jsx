// The AutoFilter dropdown of a table's header cell: sort the table by the
// column, filter it by a condition or by ticking the values to keep. One is
// rendered for the whole grid, placed at the header button that opened it, so it
// does not depend on that cell staying drawn while the grid scrolls. It keeps the
// choices being made to itself and hands back the filter to store; ExcelClone
// owns the sheet.

import React, { useMemo, useState } from "react";
import { Button } from "@/components/common/ui/button.jsx";
import { Checkbox } from "@/components/forms/primitives/checkbox.jsx";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/common/ui/popover.jsx";
import { IconSortAscending, IconSortDescending, IconFilterOff } from "@tabler/icons-react";
import { cn } from "@/utils/classNames.js";
import { FILTER_CONDITIONS, isFilterActive, shownValuesOf, valueFilterFor } from "../../../utils/spreadsheets/tableFilter.js";

// A column of names or ids can hold thousands of different values; past this
// many the list asks to be narrowed by search rather than drawing them all.
const MAX_LISTED_VALUES = 200;

const TableFilterPopover = ({ anchorRect, title, values, filter, canSort, onSort, onApply, onClose }) => {
    const allValues = useMemo(() => values.map((v) => v.value), [values]);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(() => new Set(shownValuesOf(filter, allValues)));
    const [conditionType, setConditionType] = useState(filter?.condition?.type ?? "none");
    const [conditionValue, setConditionValue] = useState(filter?.condition?.value ?? "");
    const anchorRef = useMemo(() => ({ current: { getBoundingClientRect: () => anchorRect } }), [anchorRect]);

    const condition = FILTER_CONDITIONS.find((c) => c.type === conditionType);
    const conditionFilter = condition ? { condition: { type: condition.type, ...(condition.input && { value: conditionValue.trim() }) } } : null;
    const conditionReady = !conditionFilter || isFilterActive(conditionFilter);

    const matches = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? values.filter((v) => v.value.toLowerCase().includes(q)) : values;
    }, [values, search]);
    const listed = matches.length > MAX_LISTED_VALUES ? matches.slice(0, MAX_LISTED_VALUES) : matches;

    const toggle = (value) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(value)) next.delete(value); else next.add(value);
        return next;
    });
    // Select all / Clear act on what the search matches, leaving the rest as ticked.
    const setMatches = (ticked) => setSelected((prev) => {
        const next = new Set(prev);
        for (const { value } of matches) { if (ticked) next.add(value); else next.delete(value); }
        return next;
    });

    const canApply = conditionFilter ? conditionReady : selected.size > 0;
    const apply = () => {
        if (!canApply) return;
        onApply(conditionFilter ?? valueFilterFor(allValues, selected));
    };
    const applyOnEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } };

    const sortButton = (direction, Icon, label) => (
        <button
            className="flex items-center gap-2 w-full px-1.5 py-1 text-xs text-slate-700 rounded hover:bg-slate-100 cursor-pointer"
            onClick={() => onSort(direction)}
        >
            <Icon className="w-3.5 h-3.5 text-slate-500" /> {label}
        </button>
    );

    return (
        <Popover open onOpenChange={(open) => { if (!open) onClose(); }}>
            <PopoverAnchor virtualRef={anchorRef} />
            <PopoverContent
                className="w-64 p-2 bg-white border border-slate-200 shadow-md rounded-lg space-y-2"
                align="start"
                onMouseDown={(e) => e.stopPropagation()}
                // Typing here must not reach the grid's shortcut handler behind it.
                onKeyDown={(e) => e.stopPropagation()}
            >
                <div className="px-0.5 text-[11px] font-semibold text-slate-500 truncate">{title}</div>
                {canSort && (
                    <div className="border-b border-slate-100 pb-1.5">
                        {sortButton("asc", IconSortAscending, "Sort A to Z")}
                        {sortButton("desc", IconSortDescending, "Sort Z to A")}
                    </div>
                )}
                <div className="space-y-1">
                    <div className="px-0.5 text-[11px] text-slate-500">Filter by condition</div>
                    <select
                        className="w-full h-7 text-xs border border-slate-200 rounded px-1.5 bg-white cursor-pointer"
                        value={conditionType}
                        onChange={(e) => setConditionType(e.target.value)}
                    >
                        <option value="none">None</option>
                        {FILTER_CONDITIONS.map((c) => <option key={c.type} value={c.type}>{c.label}</option>)}
                    </select>
                    {condition?.input && (
                        <input
                            autoFocus
                            className={cn("w-full h-7 text-xs border rounded px-2", conditionReady || conditionValue.trim() === "" ? "border-slate-200" : "border-red-300")}
                            placeholder={condition.input === "number" ? "Number" : "Text"}
                            value={conditionValue}
                            onChange={(e) => setConditionValue(e.target.value)}
                            onKeyDown={applyOnEnter}
                        />
                    )}
                </div>
                {!condition && (
                    <div className="space-y-1">
                        <div className="px-0.5 text-[11px] text-slate-500">Filter by values</div>
                        <input
                            className="w-full h-7 text-xs border border-slate-200 rounded px-2"
                            placeholder="Search values…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={applyOnEnter}
                        />
                        <div className="flex items-center justify-between text-[11px] text-indigo-600 px-0.5">
                            <button className="hover:underline cursor-pointer" onClick={() => setMatches(true)}>Select all{search.trim() ? ` ${matches.length}` : ""}</button>
                            <button className="hover:underline cursor-pointer" onClick={() => setMatches(false)}>Clear</button>
                        </div>
                        <div className="max-h-44 overflow-y-auto space-y-1 border border-slate-100 rounded p-1.5">
                            {listed.map(({ value, count }) => (
                                <label key={value} className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox checked={selected.has(value)} onCheckedChange={() => toggle(value)} />
                                    <span className="text-xs text-slate-700 truncate flex-1">{value === "" ? "(Blanks)" : value}</span>
                                    <span className="text-[10px] text-slate-400 tabular-nums">{count}</span>
                                </label>
                            ))}
                            {matches.length === 0 && <div className="text-[11px] text-slate-400 text-center py-2">No matches</div>}
                            {matches.length > listed.length && (
                                <div className="text-[11px] text-slate-400 text-center py-1">
                                    Showing the first {MAX_LISTED_VALUES} of {matches.length} values — search to narrow down
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-1.5 pt-1">
                    {isFilterActive(filter) && (
                        <Button size="sm" variant="ghost" className="h-7 px-1.5 text-xs cursor-pointer text-slate-600" onClick={() => onApply(null)} title="Remove this column's filter">
                            <IconFilterOff className="w-3.5 h-3.5" /> Clear filter
                        </Button>
                    )}
                    <div className="flex-1" />
                    <Button size="sm" variant="outline" className="h-7 text-xs cursor-pointer" onClick={onClose}>Cancel</Button>
                    <Button size="sm" className="h-7 text-xs cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white" onClick={apply} disabled={!canApply}>Apply</Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default TableFilterPopover;
