import React, { useState, useEffect } from 'react';
import { Clock, X, ChevronUp, ChevronDown, Check, RotateCcw } from 'lucide-react';

export default function StdDurationWatchModal({
  isOpen,
  initialValue = '',
  onClose,
  onSave,
  anchorPosition = null,
}) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const str = String(initialValue || '').trim();
    if (str.includes(':')) {
      const parts = str.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      setHours(Number.isFinite(h) ? Math.min(99, Math.max(0, h)) : 0);
      setMinutes(Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0);
    } else {
      const num = parseInt(str, 10);
      if (Number.isFinite(num)) {
        setHours(Math.min(99, Math.max(0, num)));
        setMinutes(0);
      } else {
        setHours(0);
        setMinutes(15);
      }
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const incrementHours = () => setHours((h) => (h >= 99 ? 0 : h + 1));
  const decrementHours = () => setHours((h) => (h <= 0 ? 99 : h - 1));

  const incrementMinutes = () => setMinutes((m) => (m >= 59 ? 0 : m + 1));
  const decrementMinutes = () => setMinutes((m) => (m <= 0 ? 59 : m - 1));

  const handleApplyPreset = (h, m) => {
    setHours(h);
    setMinutes(m);
  };

  const handleNow = () => {
    const now = new Date();
    setHours(now.getHours());
    setMinutes(now.getMinutes());
  };

  const handleClear = () => {
    setHours(0);
    setMinutes(0);
    onSave('');
    onClose();
  };

  const handleSave = () => {
    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    onSave(formatted);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px] p-4 select-none"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[320px] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Watch Header matching Screenshot 1 */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight">Std. Duration Watch</h3>
              <p className="text-[10px] text-blue-100 font-medium">Max 99:99 hrs</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Counter Display */}
        <div className="p-5 pb-4">
          <div className="flex items-center justify-center gap-4 py-2">
            {/* Hours */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={incrementHours}
                className="w-10 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                title="Increase Hours"
              >
                <ChevronUp className="w-5 h-5 stroke-[2.5]" />
              </button>
              <div className="my-1.5 flex flex-col items-center justify-center w-16 h-14 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-inner">
                <span className="text-3xl font-black text-slate-800 tracking-tight font-mono">
                  {String(hours).padStart(2, '0')}
                </span>
                <span className="text-[9px] font-bold text-slate-400 tracking-wider -mt-1 uppercase">HRS</span>
              </div>
              <button
                type="button"
                onClick={decrementHours}
                className="w-10 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                title="Decrease Hours"
              >
                <ChevronDown className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Separator Colon */}
            <div className="text-3xl font-black text-slate-400 -mt-2">:</div>

            {/* Minutes */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={incrementMinutes}
                className="w-10 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                title="Increase Minutes"
              >
                <ChevronUp className="w-5 h-5 stroke-[2.5]" />
              </button>
              <div className="my-1.5 flex flex-col items-center justify-center w-16 h-14 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-inner">
                <span className="text-3xl font-black text-slate-800 tracking-tight font-mono">
                  {String(minutes).padStart(2, '0')}
                </span>
                <span className="text-[9px] font-bold text-slate-400 tracking-wider -mt-1 uppercase">MIN</span>
              </div>
              <button
                type="button"
                onClick={decrementMinutes}
                className="w-10 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                title="Decrease Minutes"
              >
                <ChevronDown className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Quick Presets matching screenshot */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
              <span>Quick Presets:</span>
              <button
                type="button"
                onClick={handleNow}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
              >
                <Clock className="w-3 h-3" />
                <span>Now</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '15m', h: 0, m: 15 },
                { label: '30m', h: 0, m: 30 },
                { label: '1h', h: 1, m: 0 },
                { label: '2h', h: 2, m: 0 },
                { label: '4h', h: 4, m: 0 },
              ].map((p) => {
                const isSelected = hours === p.h && minutes === p.m;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleApplyPreset(p.h, p.m)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Secondary Preset Times (from screenshot) */}
            <div className="flex gap-1.5 mt-2">
              {[
                { label: '18:35', h: 18, m: 35 },
                { label: '19:56', h: 19, m: 56 },
              ].map((p) => {
                const isSelected = hours === p.h && minutes === p.m;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleApplyPreset(p.h, p.m)}
                    className={`px-3 py-1 text-xs font-mono font-medium rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Set Time</span>
          </button>
        </div>
      </div>
    </div>
  );
}

