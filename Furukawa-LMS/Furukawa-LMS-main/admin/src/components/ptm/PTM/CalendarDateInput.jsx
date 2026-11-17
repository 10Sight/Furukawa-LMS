import React, { useRef } from 'react';
import { CalendarDays } from 'lucide-react';

const toPickerValue = (value) => {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const match = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2}|\d{4})$/);
  if (!match) return '';
  const [, day, month, rawYear] = match;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const fromPickerValue = (value, currentValue) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  const current = String(currentValue || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(current)) return value;
  const currentFormat = current.match(/^\d{1,2}([./-])\d{1,2}\1(\d{2}|\d{4})$/);
  const separator = currentFormat?.[1] || '-';
  const formattedYear = (currentFormat?.[2]?.length === 4) ? year : year.slice(-2);
  return `${day}${separator}${month}${separator}${formattedYear}`;
};

export default function CalendarDateInput({
  value = '',
  onChange,
  className = '',
  containerClassName = '',
  disabled = false,
  ...props
}) {
  const pickerRef = useRef(null);

  const handleOpenPicker = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    try {
      pickerRef.current?.showPicker?.();
    } catch {
      pickerRef.current?.focus();
    }
  };

  return (
    <div className={`relative min-w-[112px] flex items-center ${containerClassName || 'flex-1'}`}>
      <input
        type="text"
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`${className} min-w-[112px] pr-7 whitespace-nowrap`}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={handleOpenPicker}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer flex items-center justify-center rounded disabled:pointer-events-none disabled:opacity-50"
        title="Choose date from calendar"
      >
        <CalendarDays className="h-3.5 w-3.5 pointer-events-none" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={toPickerValue(value)}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw && onChange) {
            onChange({ target: { value: fromPickerValue(raw, value) } });
          }
        }}
        aria-label="Choose date from calendar"
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}
