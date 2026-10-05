import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconMinimize } from "@tabler/icons-react";
import { Button } from "@/components/common/ui/button.jsx";

// Hosts `children` either inline or in a full-screen overlay portaled to <body>
// (so it covers the sidebar and navbar, like the monitoring sheets' full-screen
// view). The children always render into one detached DOM node that is *moved*
// between the inline slot and the overlay, rather than being re-rendered in a
// new place — so toggling never remounts them and nothing is lost (selection,
// undo history, an open cell edit, scroll listeners bound to refs).
export default function FullScreenFrame({ isFullScreen, onExit, title, icon: Icon, children }) {
    const [host] = useState(() => document.createElement("div"));
    const inlineSlotRef = useRef(null);
    const overlaySlotRef = useRef(null);

    useLayoutEffect(() => {
        const target = isFullScreen ? overlaySlotRef.current : inlineSlotRef.current;
        if (!target) return;
        host.className = isFullScreen ? "h-full w-full flex flex-col" : "w-full";
        target.appendChild(host);
    }, [isFullScreen, host]);
    useEffect(() => () => host.remove(), [host]);

    // Escape exits — but not while a dialog/popover/menu is open (Escape is closing
    // that instead), while typing in a field, or when the children already handled it.
    useEffect(() => {
        if (!isFullScreen) return;
        const onKeyDown = (e) => {
            if (e.key !== "Escape" || e.defaultPrevented) return;
            const target = e.target;
            if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)) return;
            if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]')) return;
            onExit();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isFullScreen, onExit]);

    // Stop the page underneath from scrolling while the overlay is open.
    useEffect(() => {
        if (!isFullScreen) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previous; };
    }, [isFullScreen]);

    return (
        <>
            <div ref={inlineSlotRef} className={isFullScreen ? "hidden" : "w-full"} />
            {isFullScreen && createPortal(
                <div className="fixed inset-0 z-50 bg-slate-100 w-screen h-screen flex flex-col animate-in fade-in duration-200">
                    <div className="shrink-0 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm print:hidden">
                        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 min-w-0">
                                {Icon && <Icon className="w-5 h-5 text-indigo-600 shrink-0" />}
                                <span className="text-sm font-bold text-slate-800 truncate">{title}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className="hidden sm:inline text-[11px] text-slate-400">
                                    Press <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 font-mono text-[10px] text-slate-500">Esc</kbd> to exit
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 cursor-pointer text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                                    onClick={onExit}
                                >
                                    <IconMinimize className="w-4 h-4" />
                                    Exit Full Screen
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div ref={overlaySlotRef} className="flex-1 min-h-0 p-3 sm:p-4 flex flex-col" />
                </div>,
                document.body
            )}
            {createPortal(children, host)}
        </>
    );
}
