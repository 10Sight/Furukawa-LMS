import React, { useId, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { Label } from "@/components/forms/primitives/label.jsx";
import { cn } from "@/utils/classNames.js";
import { EMAIL_RE, parseEmails, splitInput } from "@/components/forms/emailList.js";


/**
 * Chip/tag style editor for a comma-separated recipient list.
 * `value` / `onChange` use the same comma-separated string the API stores.
 */
export default function EmailChipInput({ label, value, onChange, placeholder, disabled = false, required = false }) {
    const inputId = useId();
    const errorId = `${inputId}-error`;
    const inputRef = useRef(null);
    const [draft, setDraft] = useState("");
    const [error, setError] = useState("");

    const emails = parseEmails(value);

    const commit = (text) => {
        const candidates = splitInput(text);
        if (candidates.length === 0) {
            setDraft("");
            setError("");
            return;
        }

        const seen = new Set(emails.map((e) => e.toLowerCase()));
        const added = [];
        const invalid = [];
        const duplicates = [];
        for (const candidate of candidates) {
            const key = candidate.toLowerCase();
            if (!EMAIL_RE.test(candidate)) invalid.push(candidate);
            else if (seen.has(key)) duplicates.push(candidate);
            else {
                seen.add(key);
                added.push(candidate);
            }
        }

        if (added.length) onChange([...emails, ...added].join(", "));
        // Keep invalid text in the box so the user can correct it instead of losing it.
        setDraft(invalid.join(", "));
        setError(
            invalid.length
                ? `Not a valid email: ${invalid.join(", ")}`
                : duplicates.length
                    ? `Already added: ${duplicates.join(", ")}`
                    : ""
        );
    };

    const removeAt = (index) => {
        onChange(emails.filter((_, i) => i !== index).join(", "));
        setError("");
    };

    const clearAll = () => {
        onChange("");
        setDraft("");
        setError("");
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" || e.key === "," || e.key === ";") {
            e.preventDefault();
            commit(draft);
        } else if (e.key === "Backspace" && draft === "" && emails.length > 0) {
            e.preventDefault();
            removeAt(emails.length - 1);
        }
    };

    const handleChange = (e) => {
        const next = e.target.value;
        // Pasted lists (or separators typed via IME/mobile keyboards) are committed immediately.
        if (/[,;\n\r]/.test(next)) commit(next);
        else {
            setDraft(next);
            if (error) setError("");
        }
    };

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <Label htmlFor={inputId} className="text-xs font-semibold text-gray-600">
                    {label}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                    {emails.length > 0 && <span className="ml-1.5 font-normal text-gray-400">({emails.length})</span>}
                </Label>
                {emails.length > 0 && !disabled && (
                    <button
                        type="button"
                        onClick={clearAll}
                        className="text-[11px] text-red-400 hover:text-red-600 underline"
                    >
                        Clear All
                    </button>
                )}
            </div>
            <div
                onClick={() => inputRef.current?.focus()}
                className={cn(
                    "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-white px-2 py-1.5 shadow-xs transition-[color,box-shadow] cursor-text",
                    "focus-within:border-blue-400 focus-within:ring-[3px] focus-within:ring-blue-400/30",
                    error && "border-red-300",
                    disabled && "pointer-events-none opacity-50"
                )}
            >
                {emails.map((email, index) => (
                    <span
                        key={`${email}-${index}`}
                        className="inline-flex max-w-full items-center gap-1 rounded-md border border-blue-200 bg-blue-50 py-0.5 pl-2 pr-1 text-xs text-blue-800"
                    >
                        <span className="truncate" title={email}>{email}</span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                removeAt(index);
                            }}
                            disabled={disabled}
                            aria-label={`Remove ${email}`}
                            className="rounded p-0.5 text-blue-400 hover:bg-blue-100 hover:text-red-600"
                        >
                            <IconX className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    id={inputId}
                    type="text"
                    inputMode="email"
                    autoComplete="off"
                    value={draft}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onBlur={() => commit(draft)}
                    disabled={disabled}
                    placeholder={emails.length ? "Add another..." : placeholder}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    className="min-w-[160px] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
                />
            </div>
            {error && (
                <p id={errorId} className="text-[11px] text-red-500">{error}</p>
            )}
        </div>
    );
}
