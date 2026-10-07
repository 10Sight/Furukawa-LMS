import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/common/ui/popover.jsx";
import { IconChevronDown, IconChevronRight, IconArrowDownRight, IconCheck } from "@tabler/icons-react";
import { cn } from "@/utils/classNames.js";

// Building blocks for the Excel-style Home ribbon: groups with a bottom label and
// a dialog-launcher corner button, small/large icon buttons, split buttons
// (action + chevron menu), dropdown menus, the Office colour palette and the
// editable font name / size combo boxes.

const HOVER = "hover:bg-slate-200/70 active:bg-slate-300/70";
const ACTIVE = "bg-slate-300/70 ring-1 ring-inset ring-slate-400/60";

export const RibbonGroup = ({ label, onLauncher, launcherTitle, children, className }) => (
    <div className="relative flex flex-col shrink-0 px-2 pt-1.5 pb-1 border-r border-slate-200 last:border-r-0">
        <div className={cn("flex items-stretch gap-1 h-[74px]", className)}>{children}</div>
        <div className="h-4 flex items-center justify-center text-[11px] text-slate-500 leading-none select-none">{label}</div>
        {onLauncher && (
            <button
                type="button"
                className={cn("absolute right-0.5 bottom-0.5 p-0.5 rounded-sm text-slate-500 cursor-pointer", HOVER)}
                onClick={onLauncher}
                title={launcherTitle || `${label} settings`}
            >
                <IconArrowDownRight className="w-3 h-3" strokeWidth={1.75} />
            </button>
        )}
    </div>
);

// A column of up to three small rows inside a group.
export const RibbonStack = ({ children, className }) => (
    <div className={cn("flex flex-col justify-between py-0.5", className)}>{children}</div>
);
export const RibbonRow = ({ children, className }) => (
    <div className={cn("flex items-center gap-0.5 h-6", className)}>{children}</div>
);
export const RibbonDivider = () => <div className="w-px self-stretch my-1 bg-slate-200 mx-0.5" />;

// `large` fills the group's height with the icon stacked over its label.
export const RibbonBtn = React.forwardRef(({ active, large, className, children, ...props }, ref) => (
    <button
        ref={ref}
        type="button"
        className={cn(
            "inline-flex items-center rounded-sm text-slate-700 cursor-pointer disabled:opacity-35 disabled:cursor-default disabled:hover:bg-transparent",
            large ? "h-full flex-col justify-start gap-0.5 px-1.5 pt-1 pb-0.5" : "h-6 min-w-6 px-1 justify-center gap-1",
            HOVER,
            active && ACTIVE,
            className
        )}
        {...props}
    >
        {children}
    </button>
));
RibbonBtn.displayName = "RibbonBtn";

// Closes the enclosing dropdown after a menu item runs.
const MenuCloseContext = createContext(() => {});

// Button that opens a menu. `trigger` renders the button's face; the chevron is added.
export const RibbonDropdown = ({ title, trigger, children, contentClassName, align = "start", buttonClassName, large, disabled }) => {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    title={title}
                    disabled={disabled}
                    className={cn(
                        "inline-flex items-center rounded-sm text-slate-700 cursor-pointer disabled:opacity-35 disabled:cursor-default",
                        HOVER,
                        open && ACTIVE,
                        large ? "flex-col justify-start gap-0.5 px-1.5 pt-1 pb-0.5 h-full" : "h-6 gap-0.5 px-1",
                        buttonClassName
                    )}
                >
                    {trigger}
                    {!large && <IconChevronDown className="w-3 h-3 text-slate-500 shrink-0" />}
                </button>
            </PopoverTrigger>
            <PopoverContent className={cn("w-56 p-1 bg-white border border-slate-200 shadow-lg rounded-md", contentClassName)} align={align}>
                <MenuCloseContext.Provider value={() => setOpen(false)}>{children}</MenuCloseContext.Provider>
            </PopoverContent>
        </Popover>
    );
};

// Excel split button: the face runs the default action, the chevron opens the menu.
export const RibbonSplit = ({ title, menuTitle, onClick, face, children, active, disabled, contentClassName, align = "start", large }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className={cn("inline-flex rounded-sm group", large ? "flex-col h-full" : "items-stretch h-6", open && ACTIVE)}>
            <button
                type="button"
                title={title}
                disabled={disabled}
                onClick={onClick}
                className={cn(
                    "inline-flex items-center justify-center text-slate-700 cursor-pointer disabled:opacity-35 disabled:cursor-default",
                    HOVER,
                    active && ACTIVE,
                    large ? "flex-1 flex-col gap-0.5 px-1.5 pt-1 rounded-t-sm" : "px-1 rounded-l-sm"
                )}
            >
                {face}
            </button>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        title={menuTitle || title}
                        disabled={disabled}
                        className={cn(
                            "inline-flex items-center justify-center text-slate-500 cursor-pointer disabled:opacity-35 disabled:cursor-default",
                            HOVER,
                            large ? "px-1.5 pb-0.5 rounded-b-sm" : "px-0.5 rounded-r-sm"
                        )}
                    >
                        <IconChevronDown className="w-3 h-3" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className={cn("w-56 p-1 bg-white border border-slate-200 shadow-lg rounded-md", contentClassName)} align={align}>
                    <MenuCloseContext.Provider value={() => setOpen(false)}>{children}</MenuCloseContext.Provider>
                </PopoverContent>
            </Popover>
        </div>
    );
};

export const MenuItem = ({ icon: Icon, label, shortcut, onClick, disabled, checked, style }) => {
    const close = useContext(MenuCloseContext);
    return (
        <button
            type="button"
            disabled={disabled}
            className="w-full flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded-sm hover:bg-slate-100 text-slate-700 cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-default"
            onClick={() => { close(); onClick?.(); }}
        >
            <span className="w-4 h-4 shrink-0 inline-flex items-center justify-center text-slate-600">
                {checked ? <IconCheck className="w-3.5 h-3.5" /> : Icon ? <Icon className="w-4 h-4" strokeWidth={1.5} /> : null}
            </span>
            <span className="flex-1 truncate" style={style}>{label}</span>
            {shortcut && <span className="text-[10px] text-slate-400 font-mono shrink-0">{shortcut}</span>}
        </button>
    );
};
// A menu row that opens a flyout to its right, on hover or click. Items inside
// still close the whole dropdown, since the flyout shares its close context.
export const MenuSub = ({ icon, label, children, contentClassName }) => {
    const [open, setOpen] = useState(false);
    const timer = useRef(null);
    const show = () => { clearTimeout(timer.current); setOpen(true); };
    const hideSoon = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 180); };
    useEffect(() => () => clearTimeout(timer.current), []);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn("w-full flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded-sm hover:bg-slate-100 text-slate-700 cursor-pointer", open && "bg-slate-100")}
                    onMouseEnter={show}
                    onMouseLeave={hideSoon}
                    // Hovering already opened it; a click must not toggle it shut.
                    onClick={(e) => { e.preventDefault(); show(); }}
                >
                    {icon !== undefined && <span className="shrink-0 inline-flex items-center justify-center">{icon}</span>}
                    <span className="flex-1 truncate">{label}</span>
                    <IconChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="right"
                align="start"
                sideOffset={2}
                className={cn("w-56 p-1 bg-white border border-slate-200 shadow-lg rounded-md", contentClassName)}
                onMouseEnter={show}
                onMouseLeave={hideSoon}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                {children}
            </PopoverContent>
        </Popover>
    );
};
export const MenuSeparator = () => <div className="my-1 border-t border-slate-100" />;
export const MenuHeader = ({ children }) => (
    <div className="px-2 pt-1.5 pb-1 text-[11px] font-semibold text-slate-500 bg-slate-50 -mx-1 first:-mt-1 mb-1">{children}</div>
);
// Render-prop that hands custom menu content (forms, galleries) a `close` callback.
export const MenuClose = ({ children }) => children(useContext(MenuCloseContext));

// --- Excel-style glyphs tabler has no close match for ---

export const CondFormatIcon = ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 20 20" className={className} fill="none">
        <rect x="2.5" y="2.5" width="15" height="15" fill="#fff" stroke="#64748b" />
        <rect x="3" y="3" width="7" height="4.5" fill="#e34948" />
        <rect x="10" y="7.5" width="7" height="5" fill="#2a78d6" />
        <rect x="3" y="12.5" width="7" height="4.5" fill="#e34948" opacity=".55" />
        <path d="M2.5 7.5h15M2.5 12.5h15M10 2.5v15" stroke="#64748b" />
    </svg>
);
export const FormatTableIcon = ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 20 20" className={className} fill="none">
        <rect x="2.5" y="2.5" width="15" height="15" fill="#fff" stroke="#64748b" />
        <rect x="3" y="3" width="14" height="4" fill="#2a78d6" />
        <rect x="3" y="11" width="14" height="3" fill="#dbeafe" />
        <path d="M2.5 7.5h15M2.5 11h15M2.5 14h15M8 2.5v15M12.5 2.5v15" stroke="#64748b" />
    </svg>
);
export const CellStylesIcon = ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 20 20" className={className} fill="none">
        <rect x="2.5" y="5.5" width="11" height="8" fill="#fde68a" stroke="#64748b" />
        <rect x="6.5" y="9.5" width="11" height="8" fill="#bfdbfe" stroke="#64748b" />
        <path d="M15 2.5l2.5 2.5-4 4-2.5-.2.2-2.3z" fill="#475569" />
    </svg>
);
export const SortFilterIcon = ({ className = "w-7 h-7" }) => (
    <svg viewBox="0 0 28 28" className={className} fill="none" stroke="#334155" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <text x="2" y="11" fontSize="10" fontWeight="600" fill="#2a78d6" stroke="none" fontFamily="Segoe UI, sans-serif">A</text>
        <text x="2.5" y="23" fontSize="10" fontWeight="600" fill="#334155" stroke="none" fontFamily="Segoe UI, sans-serif">Z</text>
        <path d="M11 5v17m-2.5-2.5L11 22l2.5-2.5" />
        <path d="M15 6h11l-4.2 5.5V18l-2.6 1.5v-8z" />
    </svg>
);
// Excel's two-line "←0 / .00" decimal glyphs.
export const DecimalIcon = ({ increase }) => (
    <span className="flex flex-col items-center text-[8px] leading-[9px] font-semibold text-slate-700 tabular-nums">
        {increase ? <><span><span className="text-blue-600">←</span>0</span><span>.00</span></> : <><span>.00</span><span><span className="text-blue-600">→</span>0</span></>}
    </span>
);

// --- Office colour palette ---

const THEME_COLORS = ["#FFFFFF", "#000000", "#E8E8E8", "#0E2841", "#156082", "#E97132", "#196B24", "#0F9ED5", "#A02B93", "#4EA72E"];
const STANDARD_COLORS = ["#C00000", "#FF0000", "#FFC000", "#FFFF00", "#92D050", "#00B050", "#00B0F0", "#0070C0", "#002060", "#7030A0"];

// t > 0 mixes toward white, t < 0 toward black.
const shade = (hex, t) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(t >= 0 ? c + (255 - c) * t : c * (1 + t)));
    return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
};
// The five tint/shade rows under each theme colour, as Excel builds them.
const themeVariants = (hex, i) => {
    if (i === 0 || i === 2) return [-0.05, -0.15, -0.25, -0.35, -0.5].map((t) => shade(hex, t));
    if (i === 1) return [0.5, 0.35, 0.25, 0.15, 0.05].map((t) => shade(hex, t));
    return [0.8, 0.6, 0.4, -0.25, -0.5].map((t) => shade(hex, t));
};

const Swatch = ({ color, onPick }) => {
    const close = useContext(MenuCloseContext);
    return (
        <button
            type="button"
            title={color}
            className="w-4 h-4 border border-slate-300/80 hover:outline hover:outline-2 hover:outline-amber-400 cursor-pointer"
            style={{ backgroundColor: color }}
            onClick={() => { close(); onPick(color); }}
        />
    );
};

export const ColorPalette = ({ onPick, autoLabel, onAuto, autoIcon: AutoIcon, value }) => {
    const close = useContext(MenuCloseContext);
    return (
        <div className="w-[214px]">
            <button
                type="button"
                className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-sm hover:bg-slate-100 text-slate-700 cursor-pointer"
                onClick={() => { close(); onAuto(); }}
            >
                {AutoIcon ? <AutoIcon className="w-4 h-4 text-slate-500" /> : <span className="w-4 h-4 bg-black border border-slate-300" />}
                {autoLabel}
            </button>
            <MenuHeader>Theme Colors</MenuHeader>
            <div className="px-1.5 grid grid-cols-10 gap-x-[5px]">
                {THEME_COLORS.map((c) => <Swatch key={c} color={c} onPick={onPick} />)}
            </div>
            <div className="px-1.5 mt-1 grid grid-cols-10 gap-x-[5px]">
                {THEME_COLORS.map((c, i) => (
                    <div key={c} className="flex flex-col">
                        {themeVariants(c, i).map((v) => <Swatch key={v} color={v} onPick={onPick} />)}
                    </div>
                ))}
            </div>
            <MenuHeader>Standard Colors</MenuHeader>
            <div className="px-1.5 grid grid-cols-10 gap-x-[5px]">
                {STANDARD_COLORS.map((c) => <Swatch key={c} color={c} onPick={onPick} />)}
            </div>
            <MenuSeparator />
            <label className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-sm hover:bg-slate-100 text-slate-700 cursor-pointer">
                <span className="w-4 h-4 rounded-sm" style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }} />
                More Colors...
                <input type="color" className="sr-only" value={value || "#000000"} onChange={(e) => onPick(e.target.value)} />
            </label>
        </div>
    );
};

// Split button whose face applies the last-picked colour (shown as a bar under the icon).
export const ColorSplitButton = ({ title, icon, color, onApply, autoLabel, onAuto, autoIcon, value }) => (
    <RibbonSplit
        title={title}
        onClick={() => onApply(color)}
        face={
            <span className="flex flex-col items-center leading-none">
                {icon}
                <span className="block w-4 h-[4px] -mt-px" style={{ backgroundColor: color }} />
            </span>
        }
        contentClassName="w-auto p-1"
    >
        <ColorPalette onPick={onApply} autoLabel={autoLabel} onAuto={onAuto} autoIcon={autoIcon} value={value} />
    </RibbonSplit>
);

// Editable combo box (font name / size): type a value and press Enter, or pick from the list.
export const RibbonCombo = ({ value, placeholder, options, onCommit, className, title, renderOption, inputMode }) => {
    const [draft, setDraft] = useState(value ?? "");
    const [open, setOpen] = useState(false);
    useEffect(() => { setDraft(value ?? ""); }, [value]);
    const commit = (v) => { if (String(v) !== String(value ?? "")) onCommit(v); };
    return (
        <Popover open={open} onOpenChange={setOpen}>
            {/* The list hangs off the whole box (not just the chevron), so it
                lines up with it and is exactly as wide unless an option needs more. */}
            <PopoverAnchor asChild>
            <div className={cn("flex items-stretch h-6 border border-slate-300 rounded-sm bg-white hover:border-slate-400 focus-within:border-indigo-500", className)} title={title}>
                <input
                    className="flex-1 min-w-0 px-1.5 text-xs text-slate-800 bg-transparent outline-none"
                    value={draft}
                    placeholder={placeholder}
                    inputMode={inputMode}
                    onChange={(e) => setDraft(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => setDraft(value ?? "")}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); commit(draft.trim()); e.currentTarget.blur(); }
                        else if (e.key === "Escape") { setDraft(value ?? ""); e.currentTarget.blur(); }
                    }}
                />
                <PopoverTrigger asChild>
                    <button type="button" className="px-0.5 border-l border-transparent hover:border-slate-300 hover:bg-slate-100 text-slate-500 cursor-pointer">
                        <IconChevronDown className="w-3.5 h-3.5" />
                    </button>
                </PopoverTrigger>
            </div>
            </PopoverAnchor>
            <PopoverContent className="w-auto min-w-[var(--radix-popover-trigger-width)] max-h-72 overflow-y-auto p-1 bg-white border border-slate-200 shadow-lg rounded-md" align="start">
                {options.map((opt) => (
                    <button
                        key={opt}
                        type="button"
                        className={cn(
                            "w-full text-left text-xs px-2 py-1 rounded-sm hover:bg-slate-100 text-slate-700 cursor-pointer whitespace-nowrap",
                            String(opt) === String(value) && "bg-slate-100 font-semibold"
                        )}
                        onClick={() => { setOpen(false); commit(opt); }}
                    >
                        {renderOption ? renderOption(opt) : opt}
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    );
};
