import { useState, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  isBefore,
  isAfter,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, MousePointer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SHIFTS = [
  { key: "A", label: "Shift A", className: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "B", label: "Shift B", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "C", label: "Shift C", className: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "G", label: "General", className: "bg-amber-50 text-amber-700 border-amber-200" },
];

const shiftStyle = (key) => SHIFTS.find((s) => s.key === key)?.className || "";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * @param {{ schedule: Object, onChange: (schedule: Object) => void }} props
 * schedule: { "yyyy-MM-dd": "A"|"B"|"C"|"G" }
 */
export default function ShiftScheduler({ schedule = {}, onChange }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [mode, setMode] = useState("range"); // "range" | "individual"
  const [selectedDates, setSelectedDates] = useState([]); // dates being worked on
  const [rangeAnchor, setRangeAnchor] = useState(null); // first click in range mode
  const [pendingShift, setPendingShift] = useState("A");

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  });

  const fmt = (d) => format(d, "yyyy-MM-dd");

  const isSelected = (d) => selectedDates.includes(fmt(d));

  const handleDayClick = useCallback(
    (day) => {
      const key = fmt(day);
      if (mode === "individual") {
        setSelectedDates((prev) =>
          prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
        setRangeAnchor(null);
      } else {
        if (!rangeAnchor) {
          setRangeAnchor(key);
          setSelectedDates([key]);
        } else {
          const anchor = parseISO(rangeAnchor);
          const clicked = day;
          const [start, end] = isBefore(anchor, clicked)
            ? [anchor, clicked]
            : [clicked, anchor];
          const range = eachDayOfInterval({ start, end }).map(fmt).filter((k) => k >= todayStr);
          setSelectedDates(range);
          setRangeAnchor(null);
        }
      }
    },
    [mode, rangeAnchor]
  );

  const applyShift = () => {
    if (selectedDates.length === 0) return;
    const updated = { ...schedule };
    selectedDates.forEach((d) => {
      updated[d] = pendingShift;
    });
    onChange(updated);
    setSelectedDates([]);
    setRangeAnchor(null);
  };

  const clearShift = () => {
    if (selectedDates.length === 0) return;
    const updated = { ...schedule };
    selectedDates.forEach((d) => delete updated[d]);
    onChange(updated);
    setSelectedDates([]);
    setRangeAnchor(null);
  };

  const clearAll = () => {
    const pastShifts = Object.fromEntries(
      Object.entries(schedule).filter(([k]) => k < todayStr)
    );
    onChange(pastShifts);
    setSelectedDates([]);
    setRangeAnchor(null);
  };

  return (
    <div className="border rounded-xl p-4 bg-white space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-800 w-32 text-center">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentMonth(new Date())}
            className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            Today
          </button>

          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => { setMode("range"); setSelectedDates([]); setRangeAnchor(null); }}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-all",
                mode === "range" ? "bg-white shadow-sm text-gray-800 font-medium" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Calendar className="w-3 h-3" />
              Range
            </button>
            <button
              type="button"
              onClick={() => { setMode("individual"); setSelectedDates([]); setRangeAnchor(null); }}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-all",
                mode === "individual" ? "bg-white shadow-sm text-gray-800 font-medium" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <MousePointer className="w-3 h-3" />
              Pick
            </button>
          </div>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="text-center text-xs font-medium text-gray-400 py-1">
            {h}
          </div>
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const key = fmt(day);
          const inMonth = isSameMonth(day, currentMonth);
          const isPast = key < todayStr;
          const scheduled = schedule[key];
          const selected = isSelected(day);
          const todayFlag = isToday(day);
          const isAnchor = rangeAnchor === key;

          return (
            <button
              type="button"
              key={key}
              onClick={() => inMonth && !isPast && handleDayClick(day)}
              disabled={!inMonth || isPast}
              className={cn(
                "relative flex flex-col items-center justify-start rounded-lg py-1.5 min-h-[48px] transition-all select-none",
                !inMonth && "opacity-0 pointer-events-none",
                isPast && "opacity-50 cursor-not-allowed bg-gray-50/50",
                inMonth && !isPast && !selected && "hover:bg-gray-50 cursor-pointer",
                selected && "bg-gray-900 text-white",
                isAnchor && "ring-2 ring-gray-900 ring-offset-1",
                todayFlag && !selected && "ring-1 ring-blue-400"
              )}
            >
              <span className={cn(
                "text-xs font-medium leading-none",
                isPast ? "text-gray-400" : selected ? "text-white" : todayFlag ? "text-blue-600 font-bold" : "text-gray-700"
              )}>
                {format(day, "d")}
              </span>
              {scheduled && (
                <span className={cn(
                  "mt-1 text-[9px] font-semibold px-1 py-0.5 rounded border leading-none",
                  selected
                    ? "bg-white/20 text-white border-white/30"
                    : isPast
                    ? "opacity-60 " + shiftStyle(scheduled)
                    : shiftStyle(scheduled)
                )}>
                  {scheduled}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="border-t pt-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Shift:</span>
          {SHIFTS.map((s) => (
            <button
              type="button"
              key={s.key}
              onClick={() => setPendingShift(s.key)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border font-medium transition-all",
                s.className,
                pendingShift === s.key ? "ring-2 ring-offset-1 ring-gray-400 shadow-sm" : "opacity-70 hover:opacity-100"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={applyShift}
            disabled={selectedDates.length === 0}
            className="text-xs h-7"
          >
            Apply to {selectedDates.length || 0} date{selectedDates.length !== 1 ? "s" : ""}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={clearShift}
            disabled={selectedDates.length === 0}
            className="text-xs h-7"
          >
            Clear Selected
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearAll}
            className="text-xs h-7 text-red-500 hover:text-red-600 hover:bg-red-50 ml-auto"
          >
            Clear All
          </Button>
        </div>

        {/* Hint */}
        {rangeAnchor && (
          <p className="text-xs text-blue-600 bg-blue-50 rounded-md px-2 py-1">
            Range start selected — click an end date to complete the range
          </p>
        )}
        {selectedDates.length > 0 && !rangeAnchor && (
          <p className="text-xs text-gray-400">
            {selectedDates.length} date{selectedDates.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      {/* Shift legend */}
      <div className="flex flex-wrap gap-2 border-t pt-3">
        {SHIFTS.map((s) => {
          const count = Object.values(schedule).filter((v) => v === s.key).length;
          return (
            <span key={s.key} className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", s.className)}>
              {s.label}: {count} day{count !== 1 ? "s" : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}
