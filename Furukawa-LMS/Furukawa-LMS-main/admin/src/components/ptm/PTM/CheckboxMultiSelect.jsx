import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export default function CheckboxMultiSelect({
  value = [],
  options = [],
  onChange,
  disabled = false,
  placeholder,
  renderTrigger = null
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const selected = Array.isArray(value) ? value.map(String) : (value ? [String(value)] : []);
  const selectedLabels = selected.map(item => options.find(option => String(option.value) === item)?.label || item);
  const label = selectedLabels.length ? selectedLabels.join(', ') : placeholder;

  const updateMenuPosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportPadding = 8;
    const width = Math.min(Math.max(rect.width, 176), window.innerWidth - viewportPadding * 2);
    const left = Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - width - viewportPadding));
    const expectedHeight = Math.min(208, Math.max(48, options.length * 32 + 12));
    const viewportHeight = Math.max(
      window.innerHeight || 0,
      document.documentElement.clientHeight || 0,
      window.visualViewport?.height || 0
    );
    const spaceBelow = viewportHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openAbove = spaceBelow < expectedHeight && spaceAbove >= expectedHeight;
    const maxHeight = Math.max(32, Math.min(208, openAbove ? spaceAbove : spaceBelow));
    const renderedHeight = Math.min(expectedHeight, maxHeight);
    const requestedTop = openAbove ? rect.top - renderedHeight - 4 : rect.bottom + 4;
    const top = Math.max(viewportPadding, Math.min(requestedTop, viewportHeight - renderedHeight - viewportPadding));
    setMenuPosition({ left, width, maxHeight, top });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const closeOnOutsideClick = event => {
      if (!buttonRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = event => { if (event.key === 'Escape') setOpen(false); };
    const closeOnScroll = event => {
      if (menuRef.current && event?.target && menuRef.current.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', closeOnScroll, true);
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', closeOnScroll, true);
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, options.length]);

  return (
    <div className="w-full min-w-0" data-required-action-allowed="true">
      {renderTrigger ? (
        renderTrigger({ open, setOpen, label, selected, buttonRef })
      ) : selectedLabels.length > 1 ? (
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(current => !current)}
          title={selectedLabels.join('\n')}
          className={`flex flex-col w-full rounded-md border text-left leading-tight transition-colors border-blue-200 bg-blue-50/40 text-slate-800 divide-y divide-blue-200/70 overflow-hidden cursor-pointer ${open ? 'border-blue-400 ring-1 ring-blue-100' : 'hover:border-blue-300 hover:bg-blue-50/70'} disabled:cursor-default disabled:opacity-60`}
        >
          {selectedLabels.map((lbl, idx) => (
            <div key={idx} className="flex items-center justify-between gap-1 px-1.5 py-1 text-[11px] font-medium text-slate-800 text-left min-h-[22px]">
              <span className="min-w-0 flex-1 truncate">{lbl}</span>
              {idx === 0 && (
                <span className="flex items-center gap-0.5 shrink-0 ml-1">
                  <span className="rounded-full bg-blue-100 px-1 py-0.2 text-[9px] font-semibold text-blue-700">({selectedLabels.length})</span>
                  <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${open ? 'rotate-180 text-blue-600' : ''}`} />
                </span>
              )}
            </div>
          ))}
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(current => !current)}
          title={label}
          className={`flex w-full min-h-[26px] items-center justify-between gap-1 rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight transition-colors cursor-pointer ${selected.length ? 'border-blue-200 bg-blue-50/60 text-slate-800' : 'border-slate-200 bg-white text-slate-500'} ${open ? 'border-blue-400 ring-1 ring-blue-100' : 'hover:border-blue-300 hover:bg-blue-50/40'} disabled:cursor-default disabled:opacity-60`}
        >
          <span className="min-w-0 flex-1 truncate font-medium">{label || placeholder}</span>
          <ChevronDown className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180 text-blue-600' : ''}`} />
        </button>
      )}
      {open && menuPosition && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-multiselectable="true"
          className="overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 text-left shadow-[0_12px_32px_rgba(15,23,42,0.2)] ring-1 ring-slate-900/5"
          style={{ position: 'fixed', zIndex: 10000, top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, maxHeight: menuPosition.maxHeight }}
        >
          {options.map(option => {
            const optionValue = String(option.value);
            const checked = selected.includes(optionValue);
            return (
              <label key={optionValue} className={`flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors ${checked ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'}`}>
                <input
                  className="h-3.5 w-3.5 shrink-0 accent-blue-600"
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChange(checked ? selected.filter(item => item !== optionValue) : [...selected, optionValue])}
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </label>
            );
          })}
          {options.length === 0 && <div className="px-2 py-2 text-[10px] text-slate-400">No options available</div>}
        </div>,
        document.body
      )}
    </div>
  );
}

