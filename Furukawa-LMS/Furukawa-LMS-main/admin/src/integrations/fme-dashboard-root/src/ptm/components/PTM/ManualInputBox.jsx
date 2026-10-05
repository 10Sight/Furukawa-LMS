import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';

export const ManualInputOptionsContext = createContext({});

export default function ManualInputBox({
  value = '',
  onChange,
  onKeyDown,
  placeholder = '',
  className = '',
  dataRow,
  dataCol,
  'data-row': dataRowAttr,
  'data-col': dataColAttr,
  defaultHeight = 34,
  options: providedOptions,
  ...props
}) {
  const textareaRef = useRef(null);
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const optionsByColumn = useContext(ManualInputOptionsContext);
  const rowAttr = dataRow !== undefined ? dataRow : dataRowAttr;
  const colAttr = dataCol !== undefined ? dataCol : dataColAttr;
  const options = providedOptions || optionsByColumn[colAttr] || [];
  const filteredOptions = useMemo(() => {
    const term = query.trim().toLowerCase();
    return options.filter((option) => String(option).toLowerCase().includes(term));
  }, [options, query]);

  const growToFit = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const contentHeight = Math.max(defaultHeight, el.scrollHeight);
    el.style.height = `${contentHeight}px`;
  }, [defaultHeight]);

  useLayoutEffect(() => {
    growToFit();
  }, [value, growToFit]);

  const chooseOption = (option) => {
    onChange?.({ target: { value: option } });
    setQuery('');
    setIsOpen(false);
    requestAnimationFrame(growToFit);
  };

  const handleKeyDownInternal = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onKeyDown?.(event);
      return;
    }
    onKeyDown?.(event);
    if (event.key === 'Enter' && event.shiftKey) requestAnimationFrame(growToFit);
  };

  return (
    <div
      ref={rootRef}
      className="relative min-w-0"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) {
          window.setTimeout(() => setIsOpen(false), 0);
        }
      }}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={value ?? ''}
        onChange={(event) => {
          onChange?.(event);
          requestAnimationFrame(growToFit);
        }}
        onKeyDown={handleKeyDownInternal}
        onInput={growToFit}
        onFocus={() => {
          if (!props.readOnly) {
            setQuery('');
            setIsOpen(true);
          }
        }}
        onClick={() => {
          if (!props.readOnly) setIsOpen(true);
        }}
        data-row={rowAttr}
        data-col={colAttr}
        placeholder={placeholder}
        className={`manual-input-box block w-full resize-none overflow-hidden whitespace-pre-wrap break-words ${className}`}
        style={{
          height: `${defaultHeight}px`,
          minHeight: `${defaultHeight}px`,
          overflow: 'hidden',
          resize: 'none',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
        role={!props.readOnly ? 'combobox' : undefined}
        aria-autocomplete={!props.readOnly ? 'list' : undefined}
        aria-expanded={isOpen}
        {...props}
      />
      {isOpen && !props.readOnly && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-56 rounded-md border border-slate-300 bg-white p-1.5 shadow-lg">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsOpen(false);
              if (event.key === 'Enter' && filteredOptions[0]) {
                event.preventDefault();
                chooseOption(filteredOptions[0]);
                textareaRef.current?.focus();
              }
            }}
            placeholder="Search saved values..."
            aria-label={`Search ${placeholder || 'values'}`}
            className="mb-1.5 w-full rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          />
          <div role="listbox" className="max-h-40 overflow-y-auto">
            {filteredOptions.length ? filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseOption(option)}
                className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-blue-50"
              >
                {option}
              </button>
            )) : <div className="px-2 py-2 text-xs text-slate-500">No matching values</div>}
          </div>
        </div>
      )}
    </div>
  );
}
