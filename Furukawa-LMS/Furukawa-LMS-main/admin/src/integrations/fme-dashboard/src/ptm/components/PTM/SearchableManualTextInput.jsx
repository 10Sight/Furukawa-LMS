import React, { useContext, useMemo, useRef, useState } from 'react';
import { ManualInputOptionsContext } from './ManualInputBox';

export default function SearchableManualTextInput({ value = '', onChange, placeholder = '', className = '', dataCol, ...props }) {
  const optionsByColumn = useContext(ManualInputOptionsContext);
  const options = optionsByColumn[dataCol] || [];
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const filteredOptions = useMemo(() => {
    const term = query.trim().toLowerCase();
    return options.filter((option) => option.toLowerCase().includes(term));
  }, [options, query]);

  const choose = (option) => {
    onChange?.({ target: { value: option } });
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div
      ref={rootRef}
      className="relative min-w-0 flex-1"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) window.setTimeout(() => setIsOpen(false), 0);
      }}
    >
      <input
        {...props}
        type="text"
        value={value}
        placeholder={placeholder}
        data-col={dataCol}
        onChange={(event) => {
          onChange?.(event);
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setQuery('');
          setIsOpen(true);
        }}
        onClick={() => setIsOpen(true)}
        className={`${className} w-full`}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
      />
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-56 rounded-md border border-slate-300 bg-white p-1.5 shadow-lg">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsOpen(false);
              if (event.key === 'Enter' && filteredOptions[0]) {
                event.preventDefault();
                choose(filteredOptions[0]);
              }
            }}
            placeholder="Search saved values..."
            aria-label={`Search ${placeholder || 'values'}`}
            className="mb-1.5 w-full rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          />
          <div role="listbox" className="max-h-40 overflow-y-auto">
            {filteredOptions.length ? filteredOptions.map((option) => (
              <button key={option} type="button" role="option" aria-selected={option === value} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)} className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-blue-50">{option}</button>
            )) : <div className="px-2 py-2 text-xs text-slate-500">No matching values</div>}
          </div>
        </div>
      )}
    </div>
  );
}
