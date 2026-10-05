import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Calendar, ArrowLeft, FileText, AlertTriangle } from "lucide-react";
import { IconLoader2 } from "@tabler/icons-react";
import { getMediaUrl } from "@/utils/mediaUtils.js";

// Adapted from the PPT FME prototype's PresentationViewerPage.jsx, driven by
// the server's canonical `slides: [{ slideIndex, url }]` shape (see
// monthlyReportRecord.controller.js's formatRecordRow) instead of the
// prototype's local-state highResImages/slides dual-shape.
//
// Slide URLs come back from the API as relative `/uploads/...` paths, which
// resolve against whatever origin is currently loaded — the Vite dev server
// (e.g. :5174), not the Express server that actually serves them (:3000).
// getMediaUrl() prefixes them with the API's BASE_URL, same as every other
// uploaded-file render in this app (see admin/src/utils/mediaUtils.js).
export default function PresentationViewer({ record, onBack }) {
    const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const slides = record?.slides || [];
    const totalSlides = slides.length;
    const currentSlideUrl = getMediaUrl(slides[currentSlideIdx]?.url);

    const toggleFullscreen = () => {
        if (!isFullscreen) {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen && document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onFsChange);
        return () => document.removeEventListener("fullscreenchange", onFsChange);
    }, []);

    const handleNext = () => setCurrentSlideIdx((prev) => Math.min(prev + 1, totalSlides - 1));
    const handlePrev = () => setCurrentSlideIdx((prev) => Math.max(prev - 1, 0));

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); handleNext(); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); handlePrev(); }
            else if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSlideIdx, totalSlides, isFullscreen]);

    if (record?.conversionStatus === "PENDING" || record?.conversionStatus === "PROCESSING") {
        return (
            <div className="flex flex-col gap-4 flex-1 min-h-0">
                <ViewerHeader record={record} onBack={onBack} />
                <div className="flex flex-col items-center justify-center flex-1 bg-white border border-slate-200 rounded-2xl py-24">
                    <IconLoader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
                    <p className="text-sm font-semibold text-slate-700">Converting slides…</p>
                    <p className="text-xs text-slate-500 mt-1">This can take up to a minute for large presentations.</p>
                </div>
            </div>
        );
    }

    if (record?.conversionStatus === "FAILED") {
        return (
            <div className="flex flex-col gap-4 flex-1 min-h-0">
                <ViewerHeader record={record} onBack={onBack} />
                <div className="flex flex-col items-center justify-center flex-1 bg-white border border-rose-200 rounded-2xl py-24 text-center px-6">
                    <AlertTriangle className="w-8 h-8 text-rose-500 mb-3" />
                    <p className="text-sm font-semibold text-rose-700">Slide conversion failed</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md">{record.conversionError || "Please delete this record and try uploading again."}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col gap-4 flex-1 min-h-0 ${isFullscreen ? "fixed inset-0 z-[999999] bg-black m-0 p-0 w-screen h-screen overflow-hidden" : ""}`}>
            {!isFullscreen && (
                <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-xl border border-slate-200 shadow-sm">
                    <ViewerHeaderContent record={record} onBack={onBack} />
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                            Slide {currentSlideIdx + 1} of {totalSlides}
                        </span>
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-bold shadow-md transition-all cursor-pointer"
                            onClick={toggleFullscreen}
                            title="Fullscreen Presentation Mode (Esc to exit)"
                        >
                            <Maximize2 size={15} />
                            <span>Fullscreen</span>
                        </button>
                    </div>
                </div>
            )}

            <div className={`flex-1 flex flex-col min-w-0 ${isFullscreen ? "w-screen h-screen m-0 p-0" : "h-full"}`}>
                <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col ${isFullscreen ? "h-full w-full rounded-none border-none bg-black m-0 p-0" : ""}`}>
                    <div className={`flex items-center justify-center relative ${isFullscreen ? "h-screen w-screen p-0 bg-black min-h-0 overflow-hidden" : "bg-slate-900 min-h-[480px] p-6"}`}>
                        <div
                            className={`flex items-center justify-center overflow-hidden ${isFullscreen ? "w-screen h-screen max-w-none max-h-none rounded-none shadow-none bg-black" : "w-[980px] max-w-full aspect-video bg-white rounded-md shadow-2xl"}`}
                        >
                            {currentSlideUrl ? (
                                <img
                                    src={currentSlideUrl}
                                    alt={`Slide ${currentSlideIdx + 1}`}
                                    className={`block ${isFullscreen ? "w-auto h-auto max-w-full max-h-full object-contain" : "w-full h-full object-contain"}`}
                                />
                            ) : (
                                <div className="text-slate-400 text-sm">No slides available</div>
                            )}
                        </div>

                        {totalSlides > 0 && (
                            <div className={`absolute left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900/90 backdrop-blur-md border border-white/20 shadow-2xl z-50 ${isFullscreen ? "bottom-8" : "bottom-5"}`}>
                                <button
                                    type="button"
                                    className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    disabled={currentSlideIdx === 0}
                                    onClick={handlePrev}
                                    title="Previous Slide (Left Arrow)"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="text-sm font-extrabold text-white min-w-[70px] text-center select-none tracking-wide">
                                    {currentSlideIdx + 1} / {totalSlides}
                                </span>
                                <button
                                    type="button"
                                    className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    disabled={currentSlideIdx === totalSlides - 1}
                                    onClick={handleNext}
                                    title="Next Slide (Right Arrow)"
                                >
                                    <ChevronRight size={20} />
                                </button>
                                {isFullscreen && (
                                    <button
                                        type="button"
                                        className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-rose-600 transition-all ml-1"
                                        onClick={toggleFullscreen}
                                        title="Exit Fullscreen (Esc)"
                                    >
                                        <Minimize2 size={18} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {!isFullscreen && totalSlides > 0 && (
                        <div className="flex gap-3 overflow-x-auto p-4 bg-white border-t border-slate-100">
                            {slides.map((slide, idx) => {
                                const active = idx === currentSlideIdx;
                                return (
                                    <div key={slide.slideIndex} className="w-[110px] min-w-[110px] cursor-pointer flex flex-col gap-1 select-none" onClick={() => setCurrentSlideIdx(idx)}>
                                        <div className={`aspect-video rounded border overflow-hidden bg-slate-50 transition-all ${active ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm" : "border-slate-200 hover:border-slate-400"}`}>
                                            <img src={getMediaUrl(slide.url)} alt={`Slide ${idx + 1}`} className="w-full h-full object-contain" loading="lazy" />
                                        </div>
                                        <span className={`text-[11px] text-center ${active ? "text-indigo-600 font-bold" : "text-slate-500 font-medium"}`}>
                                            Slide {idx + 1}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ViewerHeaderContent({ record, onBack }) {
    return (
        <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer">
                <ArrowLeft size={14} />
                <span>Back to Records</span>
            </button>
            <span className="text-slate-300">|</span>
            <div>
                <h2 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                    <FileText size={15} className="text-indigo-600" />
                    <span>{record?.title}</span>
                    <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1">
                        <Calendar size={11} /> {record?.month} {record?.year}
                    </span>
                </h2>
            </div>
        </div>
    );
}

// Same header content, used standalone for the PENDING/PROCESSING/FAILED states
// (which skip the fullscreen-aware wrapper entirely).
function ViewerHeader({ record, onBack }) {
    return (
        <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-xl border border-slate-200 shadow-sm">
            <ViewerHeaderContent record={record} onBack={onBack} />
        </div>
    );
}
