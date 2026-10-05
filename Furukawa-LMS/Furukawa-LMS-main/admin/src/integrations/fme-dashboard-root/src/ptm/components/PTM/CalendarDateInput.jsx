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
  const formattedYear = currentFormat?.[2]?.length === 2 ? year.slice(-2) : year;
  return `${day}${separator}${month}${separator}${formattedYear}`;
};

export default function CalendarDateInput({
  value = '',
  onChange,
  className = '',
  containerClassName = '',
  ...props
}) {
  const pickerRef = useRef(null);

  return (
    <div className={`relative min-w-0 ${containerClassName || 'flex-1'}`}>
      <input
        type="text"
        value={value}
        onChange={onChange}
        className={`${className} pr-6`}
        {...props}
      />
      <CalendarDays
        aria-hidden="true"
        className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
      />
      <input
        ref={pickerRef}
        type="date"
        value={toPickerValue(value)}
        onChange={(event) =>
          onChange({ target: { value: fromPickerValue(event.target.value, value) } })
        }
        aria-label="Choose date from calendar"
        className="absolute right-0 top-1/2 h-6 w-6 -translate-y-1/2 cursor-pointer opacity-0"
        tabIndex={-1}
      />
    </div>
  );
}
