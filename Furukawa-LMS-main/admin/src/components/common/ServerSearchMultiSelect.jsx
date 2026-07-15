import React, { useEffect, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconChevronDown, IconSearch, IconX, IconLoader } from "@tabler/icons-react";
import { useDebounce } from "@/hooks/useDebounce";

const defaultUnwrap = (data) => data?.data?.quizzes || data?.data || [];

/**
 * Multi-select combobox backed by a server-side, debounced search — for large option sets
 * (test papers, evaluation tests) where loading everything up front isn't practical.
 *
 * `useSearchQuery` is a `useLazyXQuery` hook (e.g. useLazyGetAllQuizzesQuery); it's called here
 * so each instance gets its own independent query/loading state instead of sharing one across
 * every row+field on the page.
 */
const ServerSearchMultiSelect = ({
    selectedIds = [],
    onChange,
    useSearchQuery,
    fixedParams = {},
    disabled = false,
    placeholder = "Select...",
    getOptionId = (o) => String(o.id),
    getOptionLabel = (o) => o.title,
    unwrapResults = defaultUnwrap,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 400);
    const [trigger, { data, isFetching }] = useSearchQuery();
    const [labelCache, setLabelCache] = useState({});

    const fixedParamsKey = JSON.stringify(fixedParams);

    // Live search while the popover is open
    useEffect(() => {
        if (!open) return;
        trigger({ ...fixedParams, search: debouncedSearch, limit: 20 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, debouncedSearch, fixedParamsKey]);

    // Warm labels for pre-existing selections once, so chips show real titles without opening the popover
    useEffect(() => {
        if (selectedIds.length === 0) return;
        const missing = selectedIds.filter((id) => !labelCache[id]);
        if (missing.length === 0) return;
        trigger({ ...fixedParams, limit: 50 })
            .unwrap()
            .then((res) => {
                const options = unwrapResults(res) || [];
                if (options.length === 0) return;
                setLabelCache((prev) => {
                    const next = { ...prev };
                    options.forEach((o) => { next[getOptionId(o)] = getOptionLabel(o); });
                    return next;
                });
            })
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIds.join(","), fixedParamsKey]);

    // Cache every option seen from any search result, so labels survive after the search term changes
    useEffect(() => {
        const options = unwrapResults(data) || [];
        if (options.length === 0) return;
        setLabelCache((prev) => {
            const next = { ...prev };
            options.forEach((o) => { next[getOptionId(o)] = getOptionLabel(o); });
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const toggleId = (id) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter((v) => v !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const clearAll = (e) => {
        e.stopPropagation();
        onChange([]);
    };

    const options = open ? (unwrapResults(data) || []) : [];

    const triggerLabel =
        selectedIds.length === 0
            ? placeholder
            : selectedIds.length === 1
                ? (labelCache[selectedIds[0]] || `#${selectedIds[0]}`)
                : `${selectedIds.length} selected`;

    return (
        <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className="w-full min-w-[170px] h-9 justify-between font-normal text-sm bg-white cursor-pointer disabled:cursor-not-allowed"
                >
                    <span className="truncate flex items-center gap-1.5">
                        <span className="truncate">{triggerLabel}</span>
                        {selectedIds.length > 1 && (
                            <Badge variant="secondary" className="px-1.5 py-0 shrink-0">{selectedIds.length}</Badge>
                        )}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                        {selectedIds.length > 0 && !disabled && (
                            <IconX className="w-3.5 h-3.5 text-slate-400 hover:text-slate-700 cursor-pointer" onClick={clearAll} />
                        )}
                        <IconChevronDown className="w-4 h-4 text-slate-400" />
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
                <div className="relative mb-2">
                    <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        className="h-8 pl-8 text-sm"
                        autoFocus
                    />
                    {isFetching && <IconLoader className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />}
                </div>

                {selectedIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2 max-h-20 overflow-y-auto">
                        {selectedIds.map((id) => (
                            <Badge key={id} variant="secondary" className="gap-1 pr-1 font-normal">
                                <span className="truncate max-w-[140px]">{labelCache[id] || `#${id}`}</span>
                                <IconX
                                    className="w-3 h-3 cursor-pointer hover:text-slate-900"
                                    onClick={() => toggleId(id)}
                                />
                            </Badge>
                        ))}
                    </div>
                )}

                <div className="max-h-56 overflow-y-auto space-y-0.5">
                    {!isFetching && options.length === 0 && (
                        <div className="text-xs text-slate-400 px-1 py-2 text-center">
                            {search ? "No matches" : "No options"}
                        </div>
                    )}
                    {options.map((option) => {
                        const id = getOptionId(option);
                        return (
                            <label
                                key={id}
                                className="flex items-center gap-2 px-1.5 py-1.5 rounded hover:bg-slate-50 cursor-pointer text-sm"
                            >
                                <Checkbox
                                    checked={selectedIds.includes(id)}
                                    onCheckedChange={() => toggleId(id)}
                                    className="cursor-pointer"
                                />
                                <span className="truncate">{getOptionLabel(option)}</span>
                            </label>
                        );
                    })}
                </div>

                {selectedIds.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onChange([])}
                        className="text-xs text-blue-600 hover:underline mt-2 px-1 cursor-pointer"
                    >
                        Clear selection
                    </button>
                )}
            </PopoverContent>
        </Popover>
    );
};

export default ServerSearchMultiSelect;
