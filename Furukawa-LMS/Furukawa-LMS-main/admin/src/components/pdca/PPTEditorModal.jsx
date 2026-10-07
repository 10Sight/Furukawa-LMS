import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Check, 
  Presentation, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Layout
} from 'lucide-react';

export default function PPTEditorModal({
  isOpen,
  fileName,
  fileData,
  onSave,
  onClose,
  title = "Edit PowerPoint Slides"
}) {
  if (!isOpen) return null;

  const [presentationTitle, setPresentationTitle] = useState(fileName || 'Audit_Presentation.pptx');
  const [slides, setSlides] = useState([
    {
      id: 1,
      title: 'Problem Description & Initial Condition',
      content: 'Line 3 stamping station showed abnormal vibration. Cycle time increased by 14% over baseline threshold.',
      speakerNotes: 'Presented to Maintenance Supervisor on Shift A.',
      bgColor: 'bg-amber-50'
    },
    {
      id: 2,
      title: 'Root Cause & 5-Why Breakdown',
      content: '1. Why? Hydraulic pressure fluctuation.\n2. Why? Valve solenoid seal worn out.\n3. Why? Scheduled maintenance delayed by 2 weeks.',
      speakerNotes: 'Preventive maintenance schedule revised.',
      bgColor: 'bg-orange-50'
    },
    {
      id: 3,
      title: 'Implemented Countermeasure & Verification',
      content: 'Installed new heavy-duty valve seals. Pressure calibrated to 180 bar. Vibration tests confirmed within ISO tolerance.',
      speakerNotes: 'Signed off by Department Head.',
      bgColor: 'bg-emerald-50'
    }
  ]);

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const activeSlide = slides[activeSlideIndex] || slides[0];

  const handleUpdateActiveSlide = (field, val) => {
    setSlides((prev) => {
      const copy = [...prev];
      copy[activeSlideIndex] = { ...copy[activeSlideIndex], [field]: val };
      return copy;
    });
  };

  const handleAddSlide = () => {
    const newSlide = {
      id: Date.now(),
      title: `Slide ${slides.length + 1} - Action Item`,
      content: 'Enter slide contents, bullet points, or audit findings...',
      speakerNotes: '',
      bgColor: 'bg-slate-50'
    };
    setSlides([...slides, newSlide]);
    setActiveSlideIndex(slides.length);
  };

  const handleDeleteSlide = (idx) => {
    if (slides.length <= 1) return;
    const filtered = slides.filter((_, i) => i !== idx);
    setSlides(filtered);
    setActiveSlideIndex(Math.max(0, idx - 1));
  };

  const handleSave = () => {
    onSave({
      fileName: presentationTitle,
      slides
    });
    onClose();
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
              <Presentation className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                {title}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                  PowerPoint Slide Deck Editor
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 font-mono truncate max-w-md">
                {presentationTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddSlide}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-amber-600" />
              <span>Add Slide</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Slide Workspace: Sidebar Thumbnails + Main Slide Canvas Editor */}
        <div className="flex flex-1 overflow-hidden">
          {/* Thumbnails list */}
          <div className="w-48 bg-slate-50 border-r border-slate-200 p-3 overflow-y-auto space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Slides ({slides.length})
            </span>
            {slides.map((s, idx) => (
              <div
                key={s.id}
                onClick={() => setActiveSlideIndex(idx)}
                className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                  idx === activeSlideIndex
                    ? 'border-amber-500 bg-white shadow-sm ring-1 ring-amber-500'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span className="font-bold">#{idx + 1}</span>
                  {slides.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSlide(idx);
                      }}
                      className="hover:text-rose-600 p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] font-semibold text-slate-700 truncate">{s.title || 'Untitled'}</p>
                <p className="text-[9px] text-slate-400 truncate mt-0.5">{s.content || 'No text'}</p>
              </div>
            ))}
          </div>

          {/* Active Slide Editor Canvas */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-100/50">
            {/* Visual Slide Box */}
            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-md p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Slide Headline
                </label>
                <input
                  type="text"
                  value={activeSlide.title}
                  onChange={(e) => handleUpdateActiveSlide('title', e.target.value)}
                  placeholder="Slide Headline..."
                  className="w-full text-base font-bold text-slate-900 border-b border-slate-200 pb-1 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Slide Content & Action Points
                </label>
                <textarea
                  rows={6}
                  value={activeSlide.content}
                  onChange={(e) => handleUpdateActiveSlide('content', e.target.value)}
                  placeholder="Enter presentation content, bullet points, findings..."
                  className="w-full text-xs text-slate-700 leading-relaxed p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-1 focus:ring-amber-500 resize-none"
                />
              </div>
            </div>

            {/* Speaker Notes */}
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Speaker / Meeting Notes (Internal)
              </label>
              <input
                type="text"
                value={activeSlide.speakerNotes || ''}
                onChange={(e) => handleUpdateActiveSlide('speakerNotes', e.target.value)}
                placeholder="Add meeting notes or discussion points..."
                className="w-full text-xs text-slate-700 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              disabled={activeSlideIndex <= 0}
              onClick={() => setActiveSlideIndex(activeSlideIndex - 1)}
              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-500 font-medium">
              Slide {activeSlideIndex + 1} of {slides.length}
            </span>
            <button
              disabled={activeSlideIndex >= slides.length - 1}
              onClick={() => setActiveSlideIndex(activeSlideIndex + 1)}
              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-md shadow-amber-600/20 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Save Presentation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
