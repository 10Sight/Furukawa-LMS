import React, { useMemo, useRef, useState } from 'react';

export default function SearchableLeaderInput({ value, onChange, options, className, placeholder, id }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const filteredOptions = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();
    return options.filter((name) => !searchTerm || name.toLowerCase().includes(searchTerm));
  }, [options, query, value]);

  const choose = (name) => {
    onChange({ target: { value: name } });
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className="relative min-w-0 flex-1"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) {
          window.setTimeout(() => setIsOpen(false), 0);
        }
      }}
    >
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event);
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setQuery('');
          setIsOpen(true);
        }}
        onClick={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsOpen(false);
          if (event.key === 'ArrowDown' && filteredOptions[0]) {
            event.preventDefault();
            choose(filteredOptions[0]);
          }
        }}
        className={className}
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={`${id}-options`}
      />
      {isOpen && (
        <div className="absolute left-0 top-full z-40 mt-1 w-full min-w-56 rounded-md border border-slate-300 bg-white p-1.5 shadow-lg">
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
            placeholder="Search by name..."
            aria-label={`Search ${placeholder || 'people'}`}
            className="mb-1.5 w-full rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          />
          <div id={`${id}-options`} role="listbox" className="max-h-40 overflow-y-auto">
            {filteredOptions.length ? filteredOptions.map((name) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={name === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(name)}
                className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-blue-50"
              >
                {name}
              </button>
            )) : (
              <div className="px-2 py-2 text-xs text-slate-500">No matching names</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
