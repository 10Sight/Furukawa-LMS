import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
    ChevronLeft, ChevronRight, Maximize2, Minimize2,
    Calendar, ArrowLeft, FileText, AlertTriangle, X
} from "lucide-react";
import { IconLoader2 } from "@tabler/icons-react";
import { getMediaUrl } from "@/utils/mediaUtils.js";
import { cn } from "@/utils/classNames.js";

export default function PresentationViewer({ record, onBack }) {
    const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const [naturalSizes, setNaturalSizes] = useState({});
    const [controlsVisible, setControlsVisible] = useState(true);

    const viewerRef = useRef(null);
    const stageRef = useRef(null);
    const thumbRefs = useRef([]);
    const thumbnailsContainerRef = useRef(null);

    const slides = record?.slides || [];
    const totalSlides = slides.length;
    const safeSlideIdx = Math.min(Math.max(0, currentSlideIdx), Math.max(0, totalSlides - 1));
    const currentSlideUrl = slides[safeSlideIdx]?.url ? getMediaUrl(slides[safeSlideIdx].url) : "";

    // Slide aspect ratio: dimensions stored at conversion time, else the loaded
    // image's natural size (older records), else 16:9 until the image loads.
    const getSlideRatio = (idx) => {
        const slide = slides[idx];
        if (slide?.width > 0 && slide?.height > 0) return slide.width / slide.height;
        const natural = naturalSizes[idx];
        if (natural) return natural.width / natural.height;
        return 16 / 9;
    };
    const currentRatio = getSlideRatio(safeSlideIdx);

    // Largest box with the slide's own aspect ratio that fits inside the measured stage
    const fitWidth = Math.min(stageSize.width, stageSize.height * currentRatio);
    const slideBox = fitWidth > 0
        ? { width: Math.floor(fitWidth), height: Math.floor(fitWidth / currentRatio) }
        : null;

    const handleSlideImageLoad = (idx) => (e) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        if (!naturalWidth || !naturalHeight || naturalSizes[idx]) return;
        setNaturalSizes((prev) => ({ ...prev, [idx]: { width: naturalWidth, height: naturalHeight } }));
    };

    // Measure the space actually available to the slide (changes with sidebar
    // toggle, window resize and fullscreen) instead of guessing from 100vh.
    useEffect(() => {
        const el = stageRef.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setStageSize({ width, height });
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [totalSlides, record?.conversionStatus]);

    // In fullscreen, auto-hide the navigation pill after a short idle period
    useEffect(() => {
        if (!isFullscreen) {
            setControlsVisible(true);
            return;
        }
        let timer = setTimeout(() => setControlsVisible(false), 2500);
        const onMove = () => {
            setControlsVisible(true);
            clearTimeout(timer);
            timer = setTimeout(() => setControlsVisible(false), 2500);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("touchstart", onMove);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("touchstart", onMove);
        };
    }, [isFullscreen]);

    // Lock body scrolling while full-screen viewer is mounted
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    // Track native browser fullscreen changes
    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onFsChange);
        return () => document.removeEventListener("fullscreenchange", onFsChange);
    }, []);

    // Keyboard navigation (arrows, space, page up/down, home/end, escape)
    const handleNext = () => setCurrentSlideIdx((prev) => Math.min(prev + 1, totalSlides - 1));
    const handlePrev = () => setCurrentSlideIdx((prev) => Math.max(prev - 1, 0));

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA" || e.target?.isContentEditable) {
                return;
            }

            if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " " || e.key === "PageDown") {
                e.preventDefault();
                handleNext();
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
                e.preventDefault();
                handlePrev();
            } else if (e.key === "Home") {
                e.preventDefault();
                setCurrentSlideIdx(0);
            } else if (e.key === "End") {
                e.preventDefault();
                if (totalSlides > 0) setCurrentSlideIdx(totalSlides - 1);
            } else if (e.key === "Escape") {
                if (document.fullscreenElement) {
                    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                } else if (onBack) {
                    onBack();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSlideIdx, totalSlides, onBack]);

    // Automatically scroll the active thumbnail into view
    useEffect(() => {
        const activeThumbEl = thumbRefs.current[safeSlideIdx];
        if (activeThumbEl && thumbnailsContainerRef.current) {
            activeThumbEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }, [safeSlideIdx]);

    // Fullscreen only the viewer, which switches to a slide-only presentation layout
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            const el = viewerRef.current || document.documentElement;
            if (el.requestFullscreen) {
                el.requestFullscreen().catch(() => {});
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        }
    };

    const renderBodyContent = () => {
        if (record?.conversionStatus === "PENDING" || record?.conversionStatus === "PROCESSING") {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-md mb-4">
                        <IconLoader2 className="w-10 h-10 animate-spin text-indigo-600" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">Converting PowerPoint Slides…</h3>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-sm">
                        The slides are being extracted and prepared. This can take up to a minute for large presentations.
                    </p>
                </div>
            );
        }

        if (record?.conversionStatus === "FAILED") {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="p-5 rounded-2xl bg-white border border-rose-200 shadow-md mb-4 text-rose-500">
                        <AlertTriangle className="w-10 h-10" />
                    </div>
                    <h3 className="text-base font-bold text-rose-700">Slide Conversion Failed</h3>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-sm">
                        {record?.conversionError || "An error occurred while converting the PowerPoint file."}
                    </p>
                    <button
                        type="button"
                        onClick={onBack}
                        className="mt-5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                    >
                        Back to Records
                    </button>
                </div>
            );
        }

        if (!record || (totalSlides === 0 && !record.conversionStatus)) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-md mb-3">
                        <IconLoader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    </div>
                    <p className="text-xs text-slate-600 font-semibold">Loading presentation slides…</p>
                </div>
            );
        }

        if (totalSlides === 0) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm mb-3 text-slate-400">
                        <FileText className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No slides available</p>
                    <p className="text-xs text-slate-500 mt-1">This presentation does not have any converted slides.</p>
                </div>
            );
        }

        return (
            <div className={cn("flex-1 flex overflow-hidden min-h-0 relative", isFullscreen ? "bg-black" : "bg-slate-100")}>
                {/* Left Slide Thumbnails Sidebar (matches PowerPoint format with white/color theme) */}
                {isSidebarOpen && !isFullscreen && (
                    <aside className="w-48 sm:w-56 md:w-60 lg:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-0 select-none shadow-sm animate-in slide-in-from-left-4 duration-200 z-10">
                        {/* Section Header (like '▲ Untitled Section' in user image) */}
                        <div className="px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-700 font-semibold bg-slate-50/80">
                            <div className="flex items-center gap-1.5 truncate">
                                <span className="text-[10px] text-indigo-600 font-bold">▲</span>
                                <span className="truncate tracking-wide text-slate-800">
                                    {record?.folderName || record?.title || "Untitled Section"}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0">
                                {totalSlides}
                            </span>
                        </div>

                        {/* Vertical Scrollable Slide Thumbnails */}
                        <div
                            ref={thumbnailsContainerRef}
                            className="flex-1 overflow-y-auto px-3 py-3 space-y-3 slide-thumbs-light-scrollbar bg-slate-50/60"
                        >
                            {slides.map((slide, idx) => {
                                const active = idx === safeSlideIdx;
                                return (
                                    <div
                                        key={slide.slideIndex ?? idx}
                                        ref={(el) => (thumbRefs.current[idx] = el)}
                                        onClick={() => setCurrentSlideIdx(idx)}
                                        className="flex items-start gap-2.5 cursor-pointer group select-none"
                                    >
                                        {/* Slide Number */}
                                        <span
                                            className={cn(
                                                "w-5 text-right text-xs font-semibold pt-1 shrink-0 transition-colors",
                                                active ? "text-indigo-600 font-extrabold" : "text-slate-400 group-hover:text-slate-700"
                                            )}
                                        >
                                            {idx + 1}
                                        </span>

                                        {/* Slide Thumbnail Preview Card */}
                                        <div
                                            className={cn(
                                                "flex-1 min-w-0 rounded-md overflow-hidden bg-white transition-all duration-150 relative shadow-xs",
                                                active
                                                    ? "ring-2 ring-indigo-600 ring-offset-2 ring-offset-slate-50 shadow-md shadow-indigo-500/20"
                                                    : "outline outline-1 outline-slate-200 hover:outline-indigo-300 opacity-90 hover:opacity-100 hover:shadow-xs"
                                            )}
                                            style={{ aspectRatio: getSlideRatio(idx) }}
                                        >
                                            <img
                                                src={getMediaUrl(slide.url)}
                                                alt={`Slide ${idx + 1}`}
                                                className="block w-full h-full object-contain bg-white"
                                                loading="lazy"
                                                onLoad={handleSlideImageLoad(idx)}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </aside>
                )}

                {/* Right Main Area: slide stage + navigation row (controls never overlap the slide) */}
                <main
                    className={cn(
                        "flex-1 flex flex-col relative overflow-hidden min-h-0 min-w-0",
                        isFullscreen ? "bg-black" : "bg-slate-100"
                    )}
                >
                    <div className={cn("flex-1 flex items-center min-h-0 min-w-0", isFullscreen ? "p-0" : "px-1 sm:px-2 pt-3 sm:pt-5")}>
                        {/* Prev arrow sits beside the slide, not on top of it */}
                        {totalSlides > 1 && !isFullscreen && (
                            <button
                                type="button"
                                onClick={handlePrev}
                                disabled={safeSlideIdx === 0}
                                className="hidden sm:flex shrink-0 mx-1 md:mx-2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-indigo-600 items-center justify-center shadow-lg border border-slate-200/80 transition-all cursor-pointer disabled:opacity-0 disabled:pointer-events-none"
                                title="Previous Slide (← / ↑)"
                            >
                                <ChevronLeft size={22} />
                            </button>
                        )}

                        {/* Stage: measured by ResizeObserver; the slide is sized to fit it exactly */}
                        <div ref={stageRef} className="flex-1 h-full min-w-0 min-h-0 flex items-center justify-center">
                            {slideBox && (
                                <div
                                    className={cn(
                                        "relative bg-white overflow-hidden shrink-0",
                                        !isFullscreen && "shadow-2xl outline outline-1 outline-slate-200/90"
                                    )}
                                    style={{ width: slideBox.width, height: slideBox.height }}
                                >
                                    {currentSlideUrl ? (
                                        <img
                                            key={currentSlideUrl}
                                            src={currentSlideUrl}
                                            alt={`Slide ${safeSlideIdx + 1}`}
                                            className="block w-full h-full object-contain bg-white select-none pointer-events-none"
                                            draggable={false}
                                            onLoad={handleSlideImageLoad(safeSlideIdx)}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                                            No slide available
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {totalSlides > 1 && !isFullscreen && (
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={safeSlideIdx === totalSlides - 1}
                                className="hidden sm:flex shrink-0 mx-1 md:mx-2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-indigo-600 items-center justify-center shadow-lg border border-slate-200/80 transition-all cursor-pointer disabled:opacity-0 disabled:pointer-events-none"
                                title="Next Slide (→ / ↓ / Space)"
                            >
                                <ChevronRight size={22} />
                            </button>
                        )}
                    </div>

                    {/* Navigation Pill: its own row in normal view; floating + auto-hiding in fullscreen */}
                    {totalSlides > 0 && (
                        <div
                            className={cn(
                                "flex justify-center z-20",
                                isFullscreen
                                    ? cn(
                                        "absolute bottom-6 left-1/2 -translate-x-1/2 transition-opacity duration-300",
                                        controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
                                    )
                                    : "shrink-0 py-3 sm:py-4"
                            )}
                        >
                            <div className="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/95 text-slate-800 border border-slate-200 shadow-xl backdrop-blur-md">
                                <button
                                    type="button"
                                    onClick={handlePrev}
                                    disabled={safeSlideIdx === 0}
                                    className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center hover:bg-indigo-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                    title="Previous Slide (← / ↑)"
                                >
                                    <ChevronLeft size={18} />
                                </button>

                                <span className="text-xs sm:text-sm font-extrabold text-slate-800 min-w-[75px] sm:min-w-[90px] text-center select-none tracking-wide">
                                    {safeSlideIdx + 1} / {totalSlides}
                                </span>

                                <button
                                    type="button"
                                    onClick={handleNext}
                                    disabled={safeSlideIdx === totalSlides - 1}
                                    className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center hover:bg-indigo-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                    title="Next Slide (→ / ↓ / Space)"
                                >
                                    <ChevronRight size={18} />
                                </button>

                                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                                <button
                                    type="button"
                                    onClick={toggleFullscreen}
                                    className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 hidden sm:flex items-center justify-center hover:bg-slate-200 hover:text-slate-900 transition-all cursor-pointer"
                                    title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen View"}
                                >
                                    {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        );
    };

    return createPortal(
        <div
            ref={viewerRef}
            className={cn(
                "fixed inset-0 z-[70] text-slate-800 flex flex-col w-screen h-dvh overflow-hidden select-none animate-in fade-in duration-150",
                isFullscreen ? "bg-black" : "bg-slate-100"
            )}
        >
            <style>{`
                .slide-thumbs-light-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .slide-thumbs-light-scrollbar::-webkit-scrollbar-track {
                    background: #f1f5f9;
                }
                .slide-thumbs-light-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 9999px;
                }
                .slide-thumbs-light-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}</style>

            {/* Top Navigation Bar: Clean White with Theme Badges and Controls (hidden in presentation fullscreen) */}
            {!isFullscreen && (
                <header className="h-12 md:h-13 bg-white border-b border-slate-200 px-3 md:px-5 flex items-center justify-between shrink-0 gap-3 z-30 shadow-xs">
                    {/* Left: Back button & Title */}
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={onBack}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 active:bg-indigo-100 text-slate-700 hover:text-indigo-600 text-xs font-semibold border border-slate-200 transition-all cursor-pointer shadow-xs shrink-0"
                            title="Exit Presentation View (Esc)"
                        >
                            <ArrowLeft size={15} />
                            <span className="hidden sm:inline">Back to Records</span>
                        </button>

                        <div className="h-4 w-px bg-slate-200 shrink-0 hidden sm:block" />

                        <div className="flex items-center gap-2 truncate">
                            <FileText size={16} className="text-indigo-600 shrink-0 hidden sm:block" />
                            <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                                {record?.title || "Presentation"}
                            </span>
                            {(record?.month || record?.year) && (
                                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                                    <Calendar size={11} /> {record?.month} {record?.year}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Right: Controls & Actions */}
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        {totalSlides > 0 && (
                            <span className="text-xs font-medium text-slate-500 px-2 hidden md:inline">
                                Slide <strong className="text-slate-900 font-bold">{safeSlideIdx + 1}</strong> of {totalSlides}
                            </span>
                        )}

                        {/* Toggle thumbnails sidebar on/off */}
                        <button
                            type="button"
                            onClick={() => setIsSidebarOpen((prev) => !prev)}
                            className={cn(
                                "p-2 rounded-lg transition-colors cursor-pointer text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                                isSidebarOpen && "bg-slate-100 text-indigo-600"
                            )}
                            title={isSidebarOpen ? "Hide slide thumbnails" : "Show slide thumbnails"}
                        >
                            <ChevronLeft size={16} className={cn("transition-transform duration-200", !isSidebarOpen && "rotate-180")} />
                        </button>

                        {/* True Fullscreen Toggle */}
                        <button
                            type="button"
                            onClick={toggleFullscreen}
                            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen View"}
                        >
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>

                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={onBack}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-colors cursor-pointer"
                            title="Close Presentation (Esc)"
                        >
                            <X size={17} />
                        </button>
                    </div>
                </header>
            )}

            {/* Content Body */}
            {renderBodyContent()}
        </div>,
        document.body
    );
}
