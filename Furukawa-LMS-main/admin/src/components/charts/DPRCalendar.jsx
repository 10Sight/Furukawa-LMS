import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Formats a Date using local calendar fields, avoiding the UTC day-shift toISOString() causes in IST.
const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const DPRCalendar = ({ selectedDate, onDateSelect, filledDates = [], viewMonth, viewYear, onMonthChange }) => {
    const today = formatDate(new Date());
    const filledSet = useMemo(() => new Set(filledDates), [filledDates]);

    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells = [];

    // Leading days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        const m = viewMonth === 0 ? 11 : viewMonth - 1;
        const y = viewMonth === 0 ? viewYear - 1 : viewYear;
        cells.push({ day: d, month: m, year: y, current: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, month: viewMonth, year: viewYear, current: true });
    }

    // Trailing days to fill remaining grid rows (always 6 rows = 42 cells)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
        const m = viewMonth === 11 ? 0 : viewMonth + 1;
        const y = viewMonth === 11 ? viewYear + 1 : viewYear;
        cells.push({ day: d, month: m, year: y, current: false });
    }

    const handlePrev = () => {
        if (viewMonth === 0) onMonthChange(11, viewYear - 1);
        else onMonthChange(viewMonth - 1, viewYear);
    };

    const handleNext = () => {
        if (viewMonth === 11) onMonthChange(0, viewYear + 1);
        else onMonthChange(viewMonth + 1, viewYear);
    };

    return (
        <div className="select-none w-full">
            {/* Month / Year header */}
            <div className="flex items-center justify-between mb-3 px-1">
                <button
                    onClick={handlePrev}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-wide">
                    {MONTHS[viewMonth]} {viewYear}
                </span>
                <button
                    onClick={handleNext}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => (
                    <div key={d} className="text-center text-[9px] font-bold text-slate-400 dark:text-slate-500 py-0.5">
                        {d}
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((cell, i) => {
                    const dateStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
                    const isToday = dateStr === today;
                    const isSelected = dateStr === selectedDate;
                    const isFilled = filledSet.has(dateStr);

                    return (
                        <button
                            key={i}
                            onClick={() => onDateSelect(dateStr)}
                            className={[
                                'relative flex flex-col items-center justify-center py-1 mx-0.5 rounded-lg text-xs font-semibold transition-all',
                                isSelected
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : isToday
                                        ? 'border border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                        : cell.current
                                            ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                                            : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40',
                            ].join(' ')}
                        >
                            <span className="leading-none">{cell.day}</span>
                            {/* Filled-date badge dot */}
                            {isFilled && (
                                <span
                                    className={[
                                        'absolute bottom-0.5 w-1 h-1 rounded-full',
                                        isSelected ? 'bg-white/70' : 'bg-orange-500',
                                    ].join(' ')}
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 px-1">
                <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="w-2.5 h-2.5 rounded border border-blue-500 bg-blue-50 dark:bg-blue-900/20 inline-block" />
                    Today
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                    Data saved
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="w-2.5 h-2.5 rounded bg-blue-600 inline-block" />
                    Selected
                </span>
            </div>
        </div>
    );
};

export default DPRCalendar;
