import React, { useMemo, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconChevronDown, IconSearch, IconX } from "@tabler/icons-react";

// Reusable cascading-friendly multi-select dropdown filter.
// `options` is a list of { id, name } and `selectedValues` is an array of string ids.
const MultiSelectFilter = ({
  label,
  placeholder = "All",
  options = [],
  selectedValues = [],
  onChange,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter((o) => o.name?.toLowerCase().includes(q));
  }, [options, search]);

  const toggleValue = (id) => {
    if (selectedValues.includes(id)) {
      onChange(selectedValues.filter((v) => v !== id));
    } else {
      onChange([...selectedValues, id]);
    }
  };

  const clearAll = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  const triggerLabel =
    selectedValues.length === 0
      ? placeholder
      : selectedValues.length === 1
      ? options.find((o) => o.id === selectedValues[0])?.name || `1 selected`
      : `${selectedValues.length} selected`;

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-9 w-full justify-between font-normal text-sm"
        >
          <span className="truncate flex items-center gap-1.5">
            {triggerLabel}
            {selectedValues.length > 1 && (
              <Badge variant="secondary" className="px-1.5 py-0">{selectedValues.length}</Badge>
            )}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {selectedValues.length > 0 && (
              <IconX className="w-3.5 h-3.5 text-gray-400 hover:text-gray-700" onClick={clearAll} />
            )}
            <IconChevronDown className="w-4 h-4 text-gray-400" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        {label && <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 px-1">{label}</div>}
        {options.length > 6 && (
          <div className="relative mb-2">
            <IconSearch className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="h-8 pl-7 text-sm"
            />
          </div>
        )}
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {filteredOptions.length === 0 && (
            <div className="text-xs text-gray-400 px-1 py-2 text-center">No options</div>
          )}
          {filteredOptions.map((option) => (
            <label
              key={option.id}
              className="flex items-center gap-2 px-1.5 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm"
            >
              <Checkbox
                checked={selectedValues.includes(option.id)}
                onCheckedChange={() => toggleValue(option.id)}
              />
              <span className="truncate">{option.name}</span>
            </label>
          ))}
        </div>
        {selectedValues.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-blue-600 hover:underline mt-2 px-1"
          >
            Clear selection
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default MultiSelectFilter;
