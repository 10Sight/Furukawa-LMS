import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, Check, Layers, FileText, Paperclip, X } from 'lucide-react';
import CalendarDateInput from './CalendarDateInput';
import SearchableLeaderInput from './SearchableLeaderInput';
import { ptmTemplateApi } from '../../../pages/ptm/services/api';
import { PTM_TEMPLATE_PHASES } from '../../../pages/ptm/data/ptmTemplates';

const RANK_OPTIONS = ['A', 'B', 'C1 & C2', 'S', 'Not - Applicable'].map((r) => ({ value: r, label: r }));

const HEADER_PHASE_OPTIONS = [
  '1: Plan & Define',
  '2: Product & Process Design',
  '3: Process & Development',
  '4: Product & Process Validation',
  '5: Feedback & Corrective Action',
  'Not - Applicable',
  'Other',
];

const mapHeaderRanksToKeys = (ranks) => {
  const keys = new Set();
  ranks.forEach((r) => {
    const val = String(r || '').trim().toUpperCase();
    if (val === 'A') keys.add('rankA');
    else if (val === 'B') keys.add('rankB');
    else if (val === 'C1 & C2' || val === 'C1' || val === 'C2') keys.add('rankC');
    else if (val === 'S') keys.add('rankS');
  });
  return Array.from(keys);
};

const formatDotDateDDMMYYYY = (value, fallback = '') => {
  const raw = String(value || '').trim() || fallback;
  if (!raw) return '';
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
  }
  const dmyMatch = raw.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2}|\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
    return `${day}.${month}.${year}`;
  }
  return raw;
};

const MILESTONE_COLUMNS = [
  { key: 'DPT', label: 'DPT' },
  { key: 'PPT', label: 'PPT' },
  { key: 'MPT', label: 'MPT' },
  { key: 'PILOT', label: 'PILOT' },
  { key: 'SOP', label: 'SOP' },
];

const extractDateForPicker = (value) => {
  const text = String(value || '').trim();
  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return isoMatch[0];

  const dmyMatch = text.match(/\b(\d{1,2})[-./](\d{1,2})[-./](\d{2}|\d{4})\b/);
  if (!dmyMatch) return '';
  const [, day, month, rawYear] = dmyMatch;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const mergePickerDateWithText = (isoDate, currentValue) => {
  if (!isoDate) return currentValue || '';
  const [year, month, day] = isoDate.split('-');
  const formattedDate = `${day}-${month}-${year}`;
  const current = String(currentValue || '').trim();
  if (!current) return formattedDate;

  // If current value is purely a date, replace it with the newly selected date
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(current) ||
    /^\d{1,2}[-./]\d{1,2}[-./](\d{2}|\d{4})$/.test(current) ||
    /^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/.test(current)
  ) {
    return formattedDate;
  }

  // If current value contains an embedded date + manual text, update the date and keep the text
  const dateTokenRegex = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[-./]\d{1,2}[-./](?:\d{2}|\d{4})|\d{1,2}-[A-Za-z]{3}-\d{2,4})\b/;
  if (dateTokenRegex.test(current)) {
    return current.replace(dateTokenRegex, formattedDate);
  }

  // Otherwise, current value is manual text only — combine the selected date and existing text
  return `${formattedDate}\n${current}`;
};

const formatThreeWordsPerLine = (text) => {
  if (!text) return '';
  return String(text)
    .split('\n')
    .map((line) => {
      const tokens = line.trim().split(/\s+/).filter(Boolean);
      if (tokens.length <= 3) return line;
      const chunks = [];
      for (let i = 0; i < tokens.length; i += 3) {
        chunks.push(tokens.slice(i, i + 3).join(' '));
      }
      return chunks.join('\n');
    })
    .join('\n');
};

const getMilestoneCellAutoWidthPx = (value) => {
  const lines = String(value || '').split('\n');
  const longestLineChars = lines.reduce((maxLen, line) => Math.max(maxLen, line.length), 0);
  return Math.max(96, Math.ceil(longestLineChars * 7.6) + 32);
};

const formatDDMMYYYYFromIso = (isoDate) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
};

const stripDateTokenFromMilestoneText = (value) => {
  const raw = String(value || '');
  const dateTokenRegex = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[-./]\d{1,2}[-./](?:\d{2}|\d{4})|\d{1,2}-[A-Za-z]{3}-\d{2,4})\b/;
  if (!dateTokenRegex.test(raw)) return raw;
  return raw
    .replace(dateTokenRegex, '')
    .replace(/^\s*\n/, '')
    .trimStart();
};

function MilestoneDateTextCell({ value = '', onChange, ariaLabel, rowIdx, colKey }) {
  const pickerRef = useRef(null);
  const textareaRef = useRef(null);
  const isoDate = extractDateForPicker(value);
  const displayDate = formatDDMMYYYYFromIso(isoDate);
  const noteText = stripDateTokenFromMilestoneText(value);
  const autoWidthPx = getMilestoneCellAutoWidthPx(value);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(22, el.scrollHeight)}px`;
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === ' ') {
      const el = e.currentTarget;
      const selectionStart = el.selectionStart ?? String(noteText).length;
      const selectionEnd = el.selectionEnd ?? selectionStart;
      const lastNewlineIdx = String(noteText).lastIndexOf('\n', Math.max(0, selectionStart - 1));
      const lineBeforeCursor = String(noteText).slice(lastNewlineIdx + 1, selectionStart);
      const wordsOnCurrentLine = lineBeforeCursor.trim().split(/\s+/).filter(Boolean);

      // After 3 words on the current line, pressing Space navigates directly to the next line
      if (wordsOnCurrentLine.length >= 3) {
        e.preventDefault();
        const nextNote = `${String(noteText).slice(0, selectionStart)}\n${String(noteText).slice(selectionEnd)}`;
        onChange(displayDate ? `${displayDate}\n${nextNote}` : nextNote);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            const nextCursorPos = selectionStart + 1;
            textareaRef.current.selectionStart = nextCursorPos;
            textareaRef.current.selectionEnd = nextCursorPos;
            adjustHeight();
          }
        });
        return;
      }
    }
    if (e.key === 'Enter' && e.shiftKey) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (typeof rowIdx === 'number' && colKey) {
        const nextCell = document.querySelector(
          `textarea[data-milestone-row="${rowIdx + 1}"][data-milestone-col="${colKey}"]`
        );
        if (nextCell) {
          nextCell.focus();
        }
      }
    }
  };

  const openDatePicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      el.showPicker();
    } else {
      el.click();
    }
  };

  return (
    <div
      className="relative flex flex-col items-stretch justify-start w-full h-full min-h-[56px] py-0.5 px-1"
      style={{ width: `${autoWidthPx}px`, minWidth: `${autoWidthPx}px` }}
    >
      {/* Top Date Row + Horizontal Divider */}
      <div className="relative flex items-center justify-center gap-1 min-h-[22px] pb-0.5 border-b border-slate-300">
        <input
          ref={pickerRef}
          type="date"
          value={isoDate}
          onChange={(event) => {
            const nextVal = mergePickerDateWithText(event.target.value, value);
            onChange(nextVal);
          }}
          aria-label={`${ariaLabel} calendar picker`}
          className="sr-only"
          tabIndex={-1}
        />
        {displayDate ? (
          <>
            <button
              type="button"
              onClick={openDatePicker}
              title="Click date to change"
              className="text-[11px] font-bold font-mono text-slate-900 hover:text-blue-700 hover:underline cursor-pointer leading-tight"
            >
              {displayDate}
            </button>
            <button
              type="button"
              onClick={() => onChange(noteText)}
              title="Remove date"
              aria-label={`Remove date for ${ariaLabel}`}
              className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer leading-none shrink-0"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={openDatePicker}
            title="Select date from calendar"
            aria-label={`Select date for ${ariaLabel}`}
            className="inline-flex items-center justify-center h-5 w-6 rounded hover:bg-slate-100 cursor-pointer"
          >
            <CalendarDays
              aria-hidden="true"
              className="h-3.5 w-3.5 text-slate-400"
            />
          </button>
        )}
      </div>

      {/* Bottom Input Text */}
      <textarea
        ref={textareaRef}
        rows={1}
        value={noteText}
        onChange={(e) => {
          const formattedNote = formatThreeWordsPerLine(e.target.value);
          onChange(displayDate ? (formattedNote ? `${displayDate}\n${formattedNote}` : displayDate) : formattedNote);
          adjustHeight();
        }}
        onKeyDown={handleKeyDown}
        data-milestone-row={rowIdx}
        data-milestone-col={colKey}
        aria-label={ariaLabel}
        className="w-full bg-transparent outline-none text-slate-900 text-center focus:bg-blue-50/50 rounded px-1 pt-0.5 text-[11.5px] font-medium resize-none overflow-hidden whitespace-pre-wrap break-words leading-snug"
      />
    </div>
  );
}

export default function PTMHeader({
  headerInfo,
  setHeaderInfo,
  projectLeaderOptions = [],
  isMerged = false,
  formActions,
  readOnly = false,
  sheetTopic = '',
  sheetDescription = '',
  onBulkFillRank,
  onBulkFillPhase,
  onOpenPhaseAttachment,
}) {
  const [rankDropdownOpen, setRankDropdownOpen] = useState(false);
  const rankDropdownRef = useRef(null);
  const [phaseDropdownOpen, setPhaseDropdownOpen] = useState(false);
  const phaseDropdownRef = useRef(null);
  const [isProjectLeaderOpen, setIsProjectLeaderOpen] = useState(false);
  const [projectLeaderSearch, setProjectLeaderSearch] = useState('');
  const projectLeaderDropdownRef = useRef(null);
  const [templatePhases, setTemplatePhases] = useState(PTM_TEMPLATE_PHASES);
  const [isCustomPhaseMode, setIsCustomPhaseMode] = useState(() => {
    const p = String(headerInfo?.phase || '').trim();
    return Boolean(p && !HEADER_PHASE_OPTIONS.slice(0, -1).includes(p));
  });

  useEffect(() => {
    let cancelled = false;
    ptmTemplateApi
      .getPhases()
      .then((res) => {
        if (!cancelled && res?.success && Array.isArray(res.data) && res.data.length > 0) {
          setTemplatePhases(res.data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [phaseDropdownOpen]);

  useEffect(() => {
    const p = String(headerInfo?.phase || '').trim();
    if (!p) return;
    const presetLabels = [...templatePhases.map((item) => item.label), 'Not - Applicable'];
    if (presetLabels.includes(p)) {
      setIsCustomPhaseMode(false);
    }
  }, [templatePhases, headerInfo?.phase]);

  useEffect(() => {
    if (!rankDropdownOpen && !phaseDropdownOpen && !isProjectLeaderOpen) return;
    const handleOutside = (e) => {
      if (rankDropdownRef.current && !rankDropdownRef.current.contains(e.target)) {
        setRankDropdownOpen(false);
      }
      if (phaseDropdownRef.current && !phaseDropdownRef.current.contains(e.target)) {
        setPhaseDropdownOpen(false);
      }
      if (projectLeaderDropdownRef.current && !projectLeaderDropdownRef.current.contains(e.target)) {
        setIsProjectLeaderOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [rankDropdownOpen, phaseDropdownOpen, isProjectLeaderOpen]);

  const handleChange = (field, val) => {
    if (readOnly) return;
    setHeaderInfo((prev) => ({
      ...prev,
      [field]: val,
    }));
  };

  return (
    <div className={`ptm-header relative bg-white select-none ${isMerged ? 'border-b border-[#64748B]' : 'rounded-xl border border-[#64748B] shadow-sm overflow-hidden mb-4'}`}>
      {formActions}

      {/* Grid containing the exact header sections from the spreadsheet image */}
      <div className={`w-full grid grid-cols-[4fr_3fr_2fr_minmax(620px,auto)_minmax(210px,1fr)] divide-x divide-[#64748B] ${readOnly ? 'pointer-events-none opacity-95' : ''}`}>

        {/* Section 1: Left Form Info — inline label+input with soft blue & rank amber accents */}
        <div className="[&_*]:!text-black bg-white text-sm border-r border-[#64748B]">
          <table className="w-full h-full border-collapse text-[13px]" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              {/* Left half: Model + APQP (65%) | Right half: Rank label (20%) + Rank value (15%) */}
              <col style={{ width: '40%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <tbody>
              {/* Colored top header row aligned with Program Identification below */}
              <tr className="border-b border-[#64748B]" style={{ height: '26px' }}>
                <td colSpan={4} className="bg-white px-2.5 py-1 align-middle">
                  <div className="flex items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-3 min-w-0">
                      {sheetTopic && (
                        <span className="font-extrabold text-[#1E40AF] text-xs sm:text-sm truncate" title={`Topic: ${sheetTopic}`}>
                          {sheetTopic}
                        </span>
                      )}
                      {sheetDescription && (
                        <span className="font-medium text-slate-600 text-xs truncate border-l border-slate-300 pl-3" title={`Description: ${sheetDescription}`}>
                          {sheetDescription}
                        </span>
                      )}
                    </div>
                    <span className="font-extrabold text-slate-800 tracking-wide font-mono text-base whitespace-nowrap text-center flex-1">
                      {(headerInfo.formTitle || 'FRM-WH-DD-006 Project Tracking Matrix Rev. 17').replace(/\s*\([^)]*\)\s*$/, '') || 'FRM-WH-DD-006 Project Tracking Matrix Rev. 17'}
                    </span>
                  </div>
                </td>
              </tr>

              {/* Row: Model (inline) | Rank label + value */}
              <tr className="border-b border-[#64748B]">
                <td className="px-2.5 py-1.5 align-middle bg-white" colSpan={2}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-[#2C5282] text-xs sm:text-[13px] whitespace-nowrap">
                      Model: <span className="text-red-500 font-bold">*</span>
                    </span>
                    <input
                      type="text"
                      value={headerInfo.model || ''}
                      onChange={(e) => handleChange('model', e.target.value)}
                      className={`font-bold text-slate-900 outline-none text-sm min-w-0 flex-1 px-1.5 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-400 ${!String(headerInfo.model || '').trim() ? 'bg-red-50/70 ring-1 ring-inset ring-red-400 placeholder:text-red-400' : 'bg-transparent'}`}
                      placeholder="Required..."
                    />
                  </div>
                </td>
                <td className="border-l border-[#64748B] px-2 py-1.5 align-middle text-right bg-white">
                  <span className="font-bold text-[#975A16] text-xs sm:text-[13px] whitespace-nowrap">
                    Rank: <span className="text-red-500 font-bold">*</span>
                  </span>
                </td>
                <td className="px-2 py-1.5 align-middle bg-white relative">
                  {(() => {
                    const selectedRanks = Array.isArray(headerInfo.rank)
                      ? headerInfo.rank
                      : String(headerInfo.rank || '')
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean);
                    const toggleRank = (val) => {
                      let next;
                      if (val === 'Not - Applicable') {
                        next = selectedRanks.includes(val) ? [] : ['Not - Applicable'];
                      } else {
                        const filtered = selectedRanks.filter((r) => r !== 'Not - Applicable');
                        next = filtered.includes(val)
                          ? filtered.filter((r) => r !== val)
                          : [...filtered, val];
                      }
                      handleChange('rank', next.join(', '));
                    };
                    const applyRankSymbol = (symbolVal) => {
                      const rankKeys = mapHeaderRanksToKeys(selectedRanks);
                      if (onBulkFillRank && rankKeys.length > 0) {
                        onBulkFillRank(rankKeys, symbolVal);
                      }
                      setRankDropdownOpen(false);
                    };

                    return (
                      <div ref={rankDropdownRef} className="relative w-full">
                        <button
                          type="button"
                          disabled={readOnly}
                          aria-label="Rank"
                          aria-haspopup="listbox"
                          aria-expanded={rankDropdownOpen}
                          onClick={() => setRankDropdownOpen((prev) => !prev)}
                          title={selectedRanks.length ? selectedRanks.join(', ') : 'Select Rank'}
                          className={`w-full flex items-center justify-between gap-1 cursor-pointer font-bold text-[#975A16] outline-none text-sm px-1.5 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-amber-400 ${!selectedRanks.length ? 'bg-red-50/70 ring-1 ring-inset ring-red-400' : 'bg-transparent'}`}
                        >
                          <span className="truncate">{selectedRanks.length ? selectedRanks.join(', ') : '—'}</span>
                          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${rankDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {rankDropdownOpen && (
                          <div className="absolute right-0 top-full mt-1 z-[120] w-52 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl text-left">
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Select Rank
                            </div>
                            <div className="space-y-0.5">
                              {RANK_OPTIONS.map((opt) => {
                                const checked = selectedRanks.includes(opt.value);
                                return (
                                  <label
                                    key={opt.value}
                                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer ${
                                      checked ? 'bg-amber-50 text-amber-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleRank(opt.value)}
                                      className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                    />
                                    <span>{opt.label}</span>
                                  </label>
                                );
                              })}
                            </div>

                            {selectedRanks.length > 0 && (
                              <div className="mt-1.5 pt-1.5 border-t border-slate-200">
                                <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Fill Selected Rank Column
                                </div>
                                <button
                                  type="button"
                                  onClick={() => applyRankSymbol('applicable')}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-semibold text-slate-800 hover:bg-amber-50 cursor-pointer"
                                >
                                  <span className="inline-block w-3.5 h-3.5 bg-black rounded-xs shrink-0" />
                                  <span>Applicable</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyRankSymbol('if_required')}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-semibold text-slate-800 hover:bg-amber-50 cursor-pointer"
                                >
                                  <span className="inline-block w-3.5 h-3.5 border-2 border-black bg-white rounded-xs shrink-0" />
                                  <span>If Required</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyRankSymbol('')}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 text-slate-400 font-bold shrink-0">—</span>
                                  <span>Blank</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </td>
              </tr>

              {/* Row: APQP Leader (inline) | Phase label + value */}
              <tr className="border-b border-[#64748B]">
                <td className="px-2.5 py-1.5 align-middle bg-white" colSpan={2}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-[#2C5282] text-xs sm:text-[13px] whitespace-nowrap">
                      APQP / Activity Leader: <span className="text-red-500 font-bold">*</span>
                    </span>
                    <SearchableLeaderInput
                      value={headerInfo.apqpLeader || ''}
                      onChange={(e) => handleChange('apqpLeader', e.target.value)}
                      options={projectLeaderOptions}
                      id="apqp-leader"
                      className={`w-full select-text cursor-text font-bold text-slate-900 outline-none text-sm min-w-0 px-1.5 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-400 ${!String(headerInfo.apqpLeader || '').trim() ? 'bg-red-50/70 ring-1 ring-inset ring-red-400 placeholder:text-red-400' : 'bg-transparent'}`}
                      placeholder="Required..."
                    />
                  </div>
                </td>
                <td className="border-l border-[#64748B] px-2 py-1.5 align-middle text-right bg-white">
                  <span className="font-bold text-[#2C5282] text-xs sm:text-[13px] whitespace-nowrap">
                    Phase: <span className="text-red-500 font-bold">*</span>
                  </span>
                </td>
                <td className="px-2 py-1.5 align-middle bg-white relative">
                  {(() => {
                    const currentPhase = String(headerInfo.phase || '').trim();
                    const activePhases = Array.isArray(headerInfo.phases) && headerInfo.phases.length > 0
                      ? headerInfo.phases.map((p) => String(p || '').trim()).filter(Boolean)
                      : (currentPhase
                          ? currentPhase.split(',').map((s) => s.trim()).filter(Boolean)
                          : []);
                    const templatePhaseLabels = templatePhases.map((p) => p.label);
                    const phaseOptions = [...templatePhaseLabels, 'Not - Applicable', 'Other'];
                    const isPreset = phaseOptions.slice(0, -1).includes(currentPhase);
                    const isTemplateCapablePhase = templatePhaseLabels.includes(currentPhase);
                    const isHeaderPhaseFrozen = !isCustomPhaseMode && activePhases.length > 0 && !phaseDropdownOpen;
                    const displayPhase = isCustomPhaseMode
                      ? 'Other (Manual Input)'
                      : (activePhases.length === 1
                          ? activePhases[0]
                          : (isPreset ? currentPhase : 'Select Phase...'));

                    const handleSelectPhaseOption = (opt) => {
                      if (opt === 'Other') {
                        setIsCustomPhaseMode(true);
                        setHeaderInfo((prev) => ({ ...prev, phase: '', phases: [] }));
                        setPhaseDropdownOpen(false);
                      } else {
                        setIsCustomPhaseMode(false);
                        setHeaderInfo((prev) => ({ ...prev, phase: opt, phases: [opt] }));
                        if (onBulkFillPhase && opt) {
                          onBulkFillPhase(opt);
                        }
                        if (!templatePhaseLabels.includes(opt)) {
                          setPhaseDropdownOpen(false);
                        }
                      }
                    };

                    const handleRemoveHeaderPhase = (phaseToRemove) => {
                      if (readOnly) return;
                      const nextPhases = activePhases.filter((p) => p !== phaseToRemove);
                      setIsCustomPhaseMode(false);
                      setPhaseDropdownOpen(false);
                      setHeaderInfo((prev) => ({
                        ...prev,
                        phases: nextPhases,
                        phase: nextPhases.join(', '),
                      }));
                    };

                    return (
                      <div ref={phaseDropdownRef} className="relative flex flex-col gap-1 w-full">
                        {isHeaderPhaseFrozen ? (
                          <div className="w-full flex items-center justify-between gap-1 px-1.5 py-1 rounded-md bg-slate-50/80 border border-slate-200/80">
                            {activePhases.length === 1 ? (
                              <>
                                <span
                                  title={activePhases[0]}
                                  className="truncate font-bold text-xs text-slate-900 select-none"
                                >
                                  {activePhases[0]}
                                </span>
                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveHeaderPhase(activePhases[0])}
                                    title={`Remove ${activePhases[0]}`}
                                    aria-label={`Remove ${activePhases[0]}`}
                                    className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1 w-full">
                                {activePhases.map((ph) => (
                                  <span
                                    key={ph}
                                    title={ph}
                                    className="inline-flex items-center gap-1 rounded bg-white border border-slate-200 px-1.5 py-0.5 text-[11px] font-bold text-slate-800 max-w-full"
                                  >
                                    <span className="truncate max-w-[140px]">{ph}</span>
                                    {!readOnly && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveHeaderPhase(ph)}
                                        title={`Remove ${ph}`}
                                        aria-label={`Remove ${ph}`}
                                        className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0 leading-none"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={readOnly}
                            aria-label="Phase"
                            aria-haspopup="listbox"
                            aria-expanded={phaseDropdownOpen}
                            onClick={() => setPhaseDropdownOpen((prev) => !prev)}
                            title={currentPhase || 'Select Phase'}
                            className={`w-full flex items-center justify-between gap-1.5 cursor-pointer font-bold outline-none text-xs px-1.5 py-1 rounded-md transition-colors ${
                              phaseDropdownOpen
                                ? 'bg-blue-50/80 ring-1 ring-blue-400 !text-blue-800'
                                : !currentPhase
                                  ? 'bg-red-50/70 ring-1 ring-inset ring-red-400 text-red-700 hover:bg-red-50'
                                  : 'bg-transparent hover:bg-slate-50 text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-400'
                            }`}
                          >
                            <span className="truncate">{displayPhase}</span>
                            <ChevronDown className={`h-3.5 w-3.5 shrink-0 !text-slate-500 transition-transform duration-200 ${phaseDropdownOpen ? 'rotate-180 !text-blue-600' : ''}`} />
                          </button>
                        )}

                        {phaseDropdownOpen && (
                          <div className="absolute right-0 top-full mt-1.5 z-[120] w-72 rounded-xl border border-slate-200/90 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.14)] overflow-hidden text-left">
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50/90 border-b border-slate-100">
                              <Layers className="w-3.5 h-3.5 !text-blue-600 shrink-0" />
                              <span className="text-[11px] font-bold uppercase tracking-wider !text-slate-500">
                                Select Phase
                              </span>
                            </div>

                            <div className="p-1.5 space-y-0.5 max-h-64 overflow-y-auto">
                              {phaseOptions.map((opt, idx) => {
                                const isSelected = opt === 'Other' ? isCustomPhaseMode : (!isCustomPhaseMode && currentPhase === opt);
                                const phaseNumMatch = opt.match(/^(\d+)\s*:\s*(.+)$/);
                                const isDividerBefore = opt === 'Not - Applicable';
                                return (
                                  <React.Fragment key={opt}>
                                    {isDividerBefore && <div className="my-1 border-t border-slate-100" />}
                                    <button
                                      type="button"
                                      onClick={() => handleSelectPhaseOption(opt)}
                                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                                        isSelected
                                          ? 'bg-blue-50 !text-blue-700 font-bold'
                                          : 'hover:bg-slate-50 !text-slate-700 font-medium'
                                      }`}
                                    >
                                      <span className="flex items-center gap-2 min-w-0">
                                        {phaseNumMatch ? (
                                          <span
                                            className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-extrabold shrink-0 ${
                                              isSelected
                                                ? 'bg-blue-600 !text-white'
                                                : 'bg-slate-100 !text-slate-600'
                                            }`}
                                          >
                                            {phaseNumMatch[1]}
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold shrink-0 bg-slate-100 !text-slate-500">
                                            {opt === 'Other' ? '✎' : '—'}
                                          </span>
                                        )}
                                        <span className="truncate">
                                          {opt === 'Other'
                                            ? 'Other (Manual Input)'
                                            : phaseNumMatch
                                              ? phaseNumMatch[2]
                                              : opt}
                                        </span>
                                      </span>
                                      {isSelected && <Check className="w-3.5 h-3.5 !text-blue-600 shrink-0" />}
                                    </button>
                                  </React.Fragment>
                                );
                              })}
                            </div>

                            {!readOnly && isTemplateCapablePhase && (
                              <div className="bg-slate-50/80 border-t border-slate-200/80 p-2 space-y-1.5">
                                <div className="px-1 text-[10px] font-bold uppercase tracking-wider !text-slate-500">
                                  Sheet Data Option
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onBulkFillPhase && currentPhase) {
                                        onBulkFillPhase(currentPhase);
                                      }
                                      setPhaseDropdownOpen(false);
                                    }}
                                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold !text-slate-700 hover:bg-slate-100 shadow-2xs transition-colors cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5 !text-slate-500 shrink-0" />
                                    <span>Blank</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPhaseDropdownOpen(false);
                                      onOpenPhaseAttachment?.(currentPhase);
                                    }}
                                    className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold !text-white hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
                                  >
                                    <Paperclip className="w-3.5 h-3.5 !text-white shrink-0" />
                                    <span>Add Attachment</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {isCustomPhaseMode && (
                          <input
                            type="text"
                            value={headerInfo.phase || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleChange('phase', val);
                              if (onBulkFillPhase) {
                                onBulkFillPhase(val);
                              }
                            }}
                            placeholder="Enter phase..."
                            className="w-full select-text cursor-text font-bold text-slate-900 outline-none bg-slate-50 border border-slate-300 text-xs px-1.5 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-400"
                          />
                        )}
                      </div>
                    );
                  })()}
                </td>
              </tr>

              {/* Row: Project Leader (checkbox multi-select, full width) */}
              <tr className="border-b border-[#64748B]">
                <td className="px-2.5 py-1.5 align-middle bg-white" colSpan={4}>
                  {(() => {
                    const selectedLeaders = Array.isArray(headerInfo.projectLeaders) && headerInfo.projectLeaders.length > 0
                      ? headerInfo.projectLeaders.map((l) => String(l || '').trim()).filter(Boolean)
                      : String(headerInfo.projectLeader || '')
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean);

                    const uniqueOptions = [...new Set([
                      ...selectedLeaders,
                      ...(Array.isArray(projectLeaderOptions) ? projectLeaderOptions : []),
                    ].map((o) => String(o || '').trim()).filter(Boolean))];

                    const q = projectLeaderSearch.trim().toLowerCase();
                    const filteredLeaderOptions = q
                      ? uniqueOptions.filter((o) => o.toLowerCase().includes(q))
                      : uniqueOptions;

                    const toggleLeader = (leaderName) => {
                      const exists = selectedLeaders.includes(leaderName);
                      const nextLeaders = exists
                        ? selectedLeaders.filter((l) => l !== leaderName)
                        : [...selectedLeaders, leaderName];
                      setHeaderInfo((prev) => ({
                        ...prev,
                        projectLeaders: nextLeaders,
                        projectLeader: nextLeaders.join(', '),
                      }));
                    };

                    return (
                      <div ref={projectLeaderDropdownRef} className="relative flex items-center gap-1.5">
                        <span className="font-bold text-[#2C5282] text-xs sm:text-[13px] whitespace-nowrap">
                          Project Leader: <span className="text-red-500 font-bold">*</span>
                        </span>
                        <button
                          type="button"
                          id="project-leader"
                          disabled={readOnly}
                          onClick={() => !readOnly && setIsProjectLeaderOpen((prev) => !prev)}
                          className={`flex-1 min-w-0 flex items-center justify-between gap-2 text-left font-bold text-slate-900 text-sm px-2 py-1 rounded border transition-colors ${
                            readOnly
                              ? 'border-transparent bg-transparent cursor-default'
                              : !selectedLeaders.length
                                ? 'bg-red-50/70 border-red-300 text-red-500 cursor-pointer'
                                : 'bg-white border-slate-300 hover:border-blue-400 cursor-pointer'
                          }`}
                        >
                          <span className="truncate">
                            {selectedLeaders.length > 0 ? selectedLeaders.join(', ') : 'Select Project Leader(s)...'}
                          </span>
                          {!readOnly && <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                        </button>

                        {isProjectLeaderOpen && !readOnly && (
                          <div className="absolute left-28 top-full mt-1 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-2.5 text-xs">
                            <input
                              type="text"
                              value={projectLeaderSearch}
                              onChange={(e) => setProjectLeaderSearch(e.target.value)}
                              placeholder="Search project leader..."
                              className="w-full mb-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
                            />
                            <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
                              {filteredLeaderOptions.map((opt) => {
                                const checked = selectedLeaders.includes(opt);
                                return (
                                  <label
                                    key={opt}
                                    className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer select-none ${
                                      checked ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleLeader(opt)}
                                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span className="truncate">{opt}</span>
                                  </label>
                                );
                              })}
                              {filteredLeaderOptions.length === 0 && (
                                <div className="py-2 text-center text-slate-400">No leaders found</div>
                              )}
                            </div>
                            {selectedLeaders.length > 0 && (
                              <div className="pt-2 mt-1.5 border-t border-slate-100 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHeaderInfo((prev) => ({ ...prev, projectLeaders: [], projectLeader: '' }));
                                  }}
                                  className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 cursor-pointer"
                                >
                                  Clear All
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </td>
              </tr>

              {/* Row: Review Date (inline, full width) */}
              <tr>
                <td className="px-2.5 py-1.5 align-middle bg-white" colSpan={4}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-[#2C5282] text-xs sm:text-[13px] whitespace-nowrap">
                      Review Date: <span className="text-red-500 font-bold">*</span>
                    </span>
                    <CalendarDateInput
                      value={headerInfo.reviewDate || ''}
                      onChange={(e) => handleChange('reviewDate', e.target.value)}
                      containerClassName="w-fit flex-none"
                      className={`w-[15ch] font-semibold text-slate-800 outline-none text-sm px-1.5 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-400 ${!String(headerInfo.reviewDate || '').trim() ? 'bg-red-50/70 ring-1 ring-inset ring-red-400' : 'bg-transparent'}`}
                      placeholder=""
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Legend / Symbol Guidance — matching section colors and enlarged bold symbols */}
        <div className="[&_*]:!text-black bg-white">
          <table className="w-full h-full border-collapse text-[13px]" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '22%' }} />  {/* "Legend" label cell */}
              <col style={{ width: '22%' }} />  {/* Activity / Rank / Deptt labels */}
              <col style={{ width: '14%' }} />  {/* Symbol */}
              <col style={{ width: '42%' }} />  {/* Description */}
            </colgroup>
            <tbody>
              {/* Top empty row with header tint */}
              <tr className="border-b border-[#64748B]" style={{ height: '26px' }}>
                <td colSpan={4}></td>
              </tr>

              {/* Row 1: Legend (rowSpan 5) | Activity | ◆ | Critical Activity */}
              <tr className="border-b border-[#64748B]">
                <td
                  className="border-r border-[#64748B] text-center font-extrabold text-[#2C5282] uppercase tracking-wider align-middle text-xs sm:text-[13px] px-1"
                  rowSpan={5}
                  style={{ verticalAlign: 'middle' }}
                >
                  Legend
                </td>
                <td className="border-r border-[#64748B] px-2 py-1 font-bold text-[#4A5568] align-middle text-xs sm:text-[13px]">Activity</td>
                <td className="border-r border-[#64748B] px-1 py-1 text-center align-middle"><svg aria-hidden="true" viewBox="0 0 16 16" className="mx-auto h-4 w-4 fill-black"><path d="M8 1 15 8 8 15 1 8z" /></svg></td>
                <td className="px-2 py-1 text-slate-700 font-medium align-middle bg-white text-xs sm:text-[13px]">Critical Activity</td>
              </tr>

              {/* Row 2: Rank | ■ | Applicable */}
              <tr className="border-b border-[#64748B]">
                <td className="border-r border-[#64748B] px-2 py-1 font-bold text-[#975A16] align-middle text-xs sm:text-[13px]" rowSpan={2}>Rank</td>
                <td className="border-r border-[#64748B] px-1 py-1 text-center align-middle"><svg aria-hidden="true" viewBox="0 0 16 16" className="mx-auto h-4 w-4 fill-black"><rect x="1" y="1" width="14" height="14" /></svg></td>
                <td className="px-2 py-1 text-slate-700 font-medium align-middle text-xs sm:text-[13px]">Applicable</td>
              </tr>

              {/* Row 3: (Rank cont.) | □ | If Required */}
              <tr className="border-b border-[#64748B]">
                <td className="border-r border-[#64748B] px-1 py-1 text-center align-middle"><svg aria-hidden="true" viewBox="0 0 16 16" className="mx-auto h-4 w-4 fill-none stroke-black" strokeWidth="1.5"><rect x="1.75" y="1.75" width="12.5" height="12.5" /></svg></td>
                <td className="px-2 py-1 text-slate-700 font-medium align-middle text-xs sm:text-[13px]">If Required</td>
              </tr>

              {/* Row 4: Deptt | ● | Owner */}
              <tr className="border-b border-[#64748B]">
                <td className="border-r border-[#64748B] px-2 py-1 font-bold text-[#276749] align-middle text-xs sm:text-[13px]" rowSpan={2}>Deptt</td>
                <td className="border-r border-[#64748B] px-1 py-1 text-center align-middle"><svg aria-hidden="true" viewBox="0 0 16 16" className="mx-auto h-4 w-4 fill-black"><circle cx="8" cy="8" r="7" /></svg></td>
                <td className="px-2 py-1 text-slate-700 font-medium align-middle text-xs sm:text-[13px]">Owner</td>
              </tr>

              {/* Row 5: (Deptt cont.) | ○ | Support/Co-owner */}
              <tr>
                <td className="border-r border-[#64748B] px-1 py-1 text-center align-middle"><svg aria-hidden="true" viewBox="0 0 16 16" className="mx-auto h-4 w-4 fill-none stroke-black" strokeWidth="1.5"><circle cx="8" cy="8" r="6.25" /></svg></td>
                <td className="px-2 py-1 text-slate-700 font-medium align-middle text-xs sm:text-[13px]">Support/Co-owner</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 3: Notes — bordered table rows with professional header & styling */}
        <div className="bg-white text-xs">
          <table className="w-full h-full border-collapse text-xs">
            <tbody>
              <tr className="border-b border-[#64748B]" style={{ height: '26px' }}>
                <td className="px-2.5 font-extrabold text-[#1E40AF] uppercase tracking-wider text-xs sm:text-[13px] align-middle bg-[#EEF4FA]">
                  Notes:
                </td>
              </tr>
              <tr className="border-b border-[#64748B] hover:bg-[#F8FAFC] transition-colors">
                <td className="px-2.5 py-1 text-slate-700 leading-normal align-top text-[12px]">
                  1. Revision history: need to be updated if customer milestone change.
                </td>
              </tr>
              <tr className="border-b border-[#64748B] hover:bg-[#F8FAFC] transition-colors">
                <td className="px-2.5 py-1 text-slate-700 leading-normal align-top text-[12px]">
                  2. New PTM to be prepared if new model is introduced (Split) by customer.
                </td>
              </tr>
              <tr className="border-b border-[#64748B] hover:bg-[#F8FAFC] transition-colors">
                <td className="px-2.5 py-1 text-slate-700 leading-normal align-top text-[12px]">
                  3. CFT members to be as per AIAG Manual &amp; FAS standard if change.
                </td>
              </tr>
              <tr className="hover:bg-[#F8FAFC] transition-colors">
                <td className="px-2.5 py-1 text-slate-700 leading-normal align-top text-[12px]">
                  4. PTM to be reviewed once per annum with APQP procedure.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 4: Milestones (DPT, PPT, MPT, PILOT, SOP) — Excel reference section */}
        <div className="[&_*]:!text-black bg-white text-xs">
          <table className="w-full h-full border-collapse text-xs" style={{ tableLayout: 'auto' }}>
            <tbody>
              {/* Column Headers: blank | DPT | PPT | MPT | PILOT | SOP */}
              <tr className="border-b border-[#64748B]" style={{ height: '28px' }}>
                <td className="border-r border-[#64748B] px-1.5 py-1.5 min-w-[125px] bg-white"></td>
                {MILESTONE_COLUMNS.map((col, idx) => (
                  <td
                    key={col.key}
                    className={`${idx < MILESTONE_COLUMNS.length - 1 ? 'border-r border-[#64748B]' : ''} w-auto min-w-[96px] px-1 py-1.5 text-center font-bold text-slate-900 bg-white align-middle text-xs`}
                  >
                    {col.label}
                  </td>
                ))}
              </tr>
              {/* Row 1: Customer Milestones (MRD Date) */}
              <tr className="border-b border-[#64748B]" style={{ height: '56px' }}>
                <td className="border-r border-[#64748B] px-1.5 py-2.5 min-w-[125px] whitespace-nowrap text-left align-middle bg-white text-slate-900 font-medium leading-tight text-[11px]">
                  <div>Customer Milestones</div>
                  <div>(MRD Date)</div>
                </td>
                {MILESTONE_COLUMNS.map((col, idx) => {
                  const fieldKey = `milestoneCustomer${col.key}`;
                  return (
                    <td
                      key={col.key}
                      className={`${idx < MILESTONE_COLUMNS.length - 1 ? 'border-r border-[#64748B]' : ''} w-auto min-w-[96px] p-0.5 align-middle bg-white`}
                    >
                      <MilestoneDateTextCell
                        value={headerInfo[fieldKey] || ''}
                        onChange={(val) => handleChange(fieldKey, val)}
                        rowIdx={0}
                        colKey={col.key}
                        ariaLabel={`Customer Milestones (MRD Date) - ${col.label}`}
                      />
                    </td>
                  );
                })}
              </tr>
              {/* Row 2: Internal Milestones (QA Inspection) */}
              <tr style={{ height: '56px' }}>
                <td className="border-r border-[#64748B] px-1.5 py-2.5 min-w-[125px] whitespace-nowrap text-left align-middle bg-white text-slate-900 font-medium leading-tight text-[11px]">
                  <div>Internal Milestones</div>
                  <div>(QA Inspection)</div>
                </td>
                {MILESTONE_COLUMNS.map((col, idx) => {
                  const fieldKey = `milestoneInternal${col.key}`;
                  return (
                    <td
                      key={col.key}
                      className={`${idx < MILESTONE_COLUMNS.length - 1 ? 'border-r border-[#64748B]' : ''} w-auto min-w-[96px] p-0.5 align-middle bg-white`}
                    >
                      <MilestoneDateTextCell
                        value={headerInfo[fieldKey] || ''}
                        onChange={(val) => handleChange(fieldKey, val)}
                        rowIdx={1}
                        colKey={col.key}
                        ariaLabel={`Internal Milestones (QA Inspection) - ${col.label}`}
                      />
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 5: Document Metadata — frozen / non-editable */}
        <div className="bg-[#F4F7FA] flex flex-col justify-center px-1.5 py-1 select-none border-r border-[#64748B]">
          <table className="w-full border border-[#64748B] text-xs bg-white rounded-xs overflow-hidden shadow-2xs">
            <tbody>
              <tr className="border-b border-[#64748B]">
                <td className="px-1 py-0.5 font-bold text-[#2C5282] bg-[#EEF4FA] whitespace-nowrap text-[11px]">Doc No.:</td>
                <td className="px-1.5 py-0.5 font-mono font-bold text-xs text-slate-800 bg-white">
                  {headerInfo.docNo || 'FRM-DD-WH-006'}
                </td>
              </tr>
              <tr className="border-b border-[#64748B]">
                <td className="px-1 py-0.5 font-bold text-[#2C5282] bg-[#EEF4FA] whitespace-nowrap text-[11px]">Rev No.:</td>
                <td className="px-1.5 py-0.5 font-bold text-xs text-slate-800 bg-white">
                  {headerInfo.revNo || '17'}
                </td>
              </tr>
              <tr className="border-b border-[#64748B]">
                <td className="px-1 py-0.5 font-bold text-[#2C5282] bg-[#EEF4FA] whitespace-nowrap text-[11px]">Issue Date:</td>
                <td className="px-1.5 py-0.5 font-bold text-xs text-slate-700 bg-white whitespace-nowrap">
                  {formatDotDateDDMMYYYY(headerInfo.issueDate, '07.11.2013')}
                </td>
              </tr>
              <tr className="bg-[#FEF08A] font-bold text-amber-950">
                <td className="px-1 py-1 font-extrabold border-r border-amber-300 whitespace-nowrap text-[11px]">Rev. Date:</td>
                <td className="px-1.5 py-1 font-extrabold text-xs text-amber-950 whitespace-nowrap">
                  {formatDotDateDDMMYYYY(headerInfo.revDate, '17.10.2023')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
