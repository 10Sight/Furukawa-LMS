import React, { useState, useEffect, useRef } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Click-to-edit text: renders as plain text until clicked, then swaps to an
// autofocused input (or textarea when `multiline`). Enter/blur commits (only if
// the value actually changed), Escape reverts. In multiline mode Enter inserts a
// newline instead of committing — only blur/Escape end editing there, and the
// textarea auto-grows to fit its content instead of staying a cramped fixed
// height. Keystrokes stay in local `draft` state so typing never triggers a
// parent re-render — only the commit does. `disabled` renders the plain
// read-only span unconditionally, ignoring clicks.
export const EditableCell = ({ value, onCommit, placeholder = '', className = '', inputClassName = '', multiline = false, disabled = false }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value ?? '');
    const textareaRef = useRef(null);

    useEffect(() => {
        if (!editing) setDraft(value ?? '');
    }, [value, editing]);

    useEffect(() => {
        if (multiline && editing && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [multiline, editing, draft]);

    const commit = () => {
        setEditing(false);
        if (draft !== value) onCommit(draft);
    };
    const cancel = () => {
        setDraft(value ?? '');
        setEditing(false);
    };

    if (editing && !disabled) {
        if (multiline) {
            return (
                <textarea
                    ref={textareaRef}
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commit}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); cancel(); } }}
                    className={`w-full bg-yellow-50 outline-none border border-blue-400 rounded-sm px-0.5 resize-y overflow-hidden ${inputClassName}`}
                />
            );
        }
        return (
            <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commit(); }
                    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                }}
                className={`w-full bg-yellow-50 outline-none border border-blue-400 rounded-sm px-0.5 ${inputClassName}`}
            />
        );
    }
    return (
        <span
            role={disabled ? undefined : "button"}
            tabIndex={disabled ? undefined : 0}
            onClick={disabled ? undefined : () => setEditing(true)}
            onKeyDown={disabled ? undefined : (e) => { if (e.key === 'Enter') setEditing(true); }}
            title={disabled ? undefined : "Click to edit"}
            className={`${disabled ? '' : 'cursor-text hover:bg-yellow-50 hover:outline hover:outline-1 hover:outline-blue-300'} rounded-sm px-0.5 whitespace-pre-line ${className}`}
        >
            {value || placeholder}
        </span>
    );
};

// Click-to-edit dropdown: renders as a small badge showing the current option's
// label until clicked, then swaps to a shadcn Select that auto-opens. Picking a
// value commits immediately and closes back to badge view.
export const EditableSelect = ({ value, options, onCommit, placeholder = 'Select', className = '' }) => {
    const [editing, setEditing] = useState(false);
    const current = options.find((o) => o.value === value);

    if (editing) {
        return (
            <Select
                defaultOpen
                value={value ?? ''}
                onValueChange={(v) => { onCommit(v); setEditing(false); }}
                onOpenChange={(open) => { if (!open) setEditing(false); }}
            >
                <SelectTrigger className={`h-6 text-[10px] ${className}`} onClick={(e) => e.stopPropagation()}>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((o) => (
                        <SelectItem key={o.value || 'standard'} value={o.value || 'standard'}>{o.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    }
    return (
        <span
            role="button"
            tabIndex={0}
            onClick={() => setEditing(true)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditing(true); }}
            title="Click to change"
            className={`cursor-pointer hover:bg-yellow-50 hover:outline hover:outline-1 hover:outline-blue-300 rounded-sm px-1 ${className}`}
        >
            {current?.label || placeholder}
        </span>
    );
};
