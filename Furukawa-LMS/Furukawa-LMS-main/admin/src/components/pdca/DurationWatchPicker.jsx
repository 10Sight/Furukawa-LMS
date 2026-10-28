import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ChevronUp, ChevronDown, Check, X, RotateCcw } from 'lucide-react';

/**
 * DurationWatchPicker
 * Modern watch/time selector allowing HH:MM duration selection up to 99:99 hrs
 */
export default function DurationWatchPicker({
  isOpen,
  onClose,
  initialValue = '',
  onSelect,
  anchorRect = null
}) {
  // Parse initial value (e.g., "18:35", "19:56", "22 min", "22", or "00:00")
  const parseInitialTime = (val) => {
    if (!val) return { hours: 0, minutes: 0 };
    const str = String(val).trim();
    const colonMatch = str.match(/^(\d{1,2}):(\d{1,2})/);
    if (colonMatch) {
      return {
        hours: Math.min(99, Math.max(0, parseInt(colonMatch[1], 10) || 0)),
        minutes: Math.min(99, Math.max(0, parseInt(colonMatch[2], 10) || 0))
      };
    }
    // Numeric minutes fallback (e.g. "90 min" -> 1 hr 30 min, or "45")
    const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      if (num < 60) {
        return { hours: 0, minutes: num };
      }
      return {
        hours: Math.min(99, Math.floor(num / 60)),
        minutes: num % 60
      };
    }
    return { hours: 0, minutes: 0 };
  };

  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const parsed = parseInitialTime(initialValue);
      setHours(parsed.hours);
      setMinutes(parsed.minutes);
    }
  }, [isOpen, initialValue]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      } else if (e.key === 'Enter') {
        e.stopPropagation();
        handleApply();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, hours, minutes]);

  if (!isOpen) return null;

  const pad = (n) => String(n).padStart(2, '0');

  const handleApply = (e) => {
    e?.stopPropagation?.();
    const formatted = `${pad(hours)}:${pad(minutes)}`;
    onSelect(formatted);
    onClose?.();
  };

  const handleClear = (e) => {
    e?.stopPropagation?.();
    onSelect('');
    onClose?.();
  };

  const handleSetCurrentTime = (e) => {
    e?.stopPropagation?.();
    const now = new Date();
    setHours(now.getHours());
    setMinutes(now.getMinutes());
  };

  const adjustHours = (delta) => {
    setHours((prev) => {
      const next = prev + delta;
      if (next < 0) return 99;
      if (next > 99) return 0;
      return next;
    });
  };

  const adjustMinutes = (delta) => {
    setMinutes((prev) => {
      const next = prev + delta;
      if (next < 0) return 59;
      if (next > 99) return 0;
      return next;
    });
  };

  const presets = [
    { label: '15m', h: 0, m: 15 },
    { label: '30m', h: 0, m: 30 },
    { label: '1h', h: 1, m: 0 },
    { label: '2h', h: 2, m: 0 },
    { label: '4h', h: 4, m: 0 },
    { label: '18:35', h: 18, m: 35 },
    { label: '19:56', h: 19, m: 56 }
  ];

  // Calculate popover positioning near anchorRect if provided
  let style = {};
  if (anchorRect && typeof window !== 'undefined') {
    const popoverWidth = 280;
    const popoverHeight = 360;
    let left = anchorRect.left + anchorRect.width / 2 - popoverWidth / 2;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    if (left < 16) left = 16;

    let top = anchorRect.bottom + 6;
    if (top + popoverHeight > window.innerHeight - 16) {
      top = Math.max(16, anchorRect.top - popoverHeight - 6);
    }

    style = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 99999
    };
  }

  return createPortal(
    <div
      data-duration-picker="true"
      data-required-action-allowed="true"
      className="fixed inset-0 z-[99999] bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 sm:p-0 sm:block"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onClose?.();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onClose?.();
        }
      }}
    >
      <div
        ref={popoverRef}
        data-duration-picker="true"
        data-required-action-allowed="true"
        style={anchorRect ? style : undefined}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[280px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Top Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white flex items-center justify-between shadow-sm select-none">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-200" />
            <div>
              <h4 className="text-xs font-bold tracking-wide">Std. Duration Watch</h4>
              <p className="text-[10px] text-blue-100 font-medium">Max 99:99 hrs</p>
            </div>
          </div>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Big Digital Watch Display & Controls */}
          <div className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 rounded-xl py-3 px-2 select-none">
            {/* Hours Column */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  adjustHours(1);
                }}
                className="w-10 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center shadow-2xs transition-all cursor-pointer active:scale-95"
                title="Increase Hours"
              >
                <ChevronUp className="w-4 h-4 stroke-[2.5]" />
              </button>
              <input
                type="number"
                min="0"
                max="99"
                value={pad(hours)}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  if (raw === '') {
                    setHours(0);
                    return;
                  }
                  const val = parseInt(raw, 10);
                  if (!isNaN(val)) setHours(Math.min(99, Math.max(0, val)));
                }}
                className="w-14 text-center text-2xl font-black text-slate-800 bg-transparent outline-none py-1 tabular-nums focus:bg-white focus:rounded cursor-text"
                title="Hours"
              />
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">HRS</span>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  adjustHours(-1);
                }}
                className="w-10 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center shadow-2xs transition-all cursor-pointer active:scale-95 mt-1"
                title="Decrease Hours"
              >
                <ChevronDown className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Colon Separator */}
            <div className="text-2xl font-black text-slate-400 pb-5 select-none">:</div>

            {/* Minutes Column */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  adjustMinutes(1);
                }}
                className="w-10 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center shadow-2xs transition-all cursor-pointer active:scale-95"
                title="Increase Minutes"
              >
                <ChevronUp className="w-4 h-4 stroke-[2.5]" />
              </button>
              <input
                type="number"
                min="0"
                max="99"
                value={pad(minutes)}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  if (raw === '') {
                    setMinutes(0);
                    return;
                  }
                  const val = parseInt(raw, 10);
                  if (!isNaN(val)) setMinutes(Math.min(99, Math.max(0, val)));
                }}
                className="w-14 text-center text-2xl font-black text-slate-800 bg-transparent outline-none py-1 tabular-nums focus:bg-white focus:rounded cursor-text"
                title="Minutes"
              />
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">MIN</span>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  adjustMinutes(-1);
                }}
                className="w-10 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center shadow-2xs transition-all cursor-pointer active:scale-95 mt-1"
                title="Decrease Minutes"
              >
                <ChevronDown className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1.5 px-0.5 select-none">
              <span>Quick Presets:</span>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleSetCurrentTime}
                className="text-blue-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                title="Set to current device time"
              >
                <Clock className="w-3 h-3" />
                <span>Now</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setHours(p.h);
                    setMinutes(p.m);
                  }}
                  className={`px-2 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                    hours === p.h && minutes === p.m
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleClear}
              className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleApply}
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs hover:shadow transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Set Time</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
