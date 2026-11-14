import React, { useLayoutEffect, useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import CalendarDateInput from './CalendarDateInput';
import SearchableLeaderInput from './SearchableLeaderInput';

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

function MilestoneDateTextCell({ value = '', onChange, ariaLabel, rowIdx, colKey }) {
  const pickerRef = useRef(null);
  const textareaRef = useRef(null);
  const autoWidthPx = getMilestoneCellAutoWidthPx(value);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(24, el.scrollHeight)}px`;
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === ' ') {
      const el = e.currentTarget;
      const selectionStart = el.selectionStart ?? String(value).length;
      const selectionEnd = el.selectionEnd ?? selectionStart;
      const lastNewlineIdx = String(value).lastIndexOf('\n', Math.max(0, selectionStart - 1));
      const lineBeforeCursor = String(value).slice(lastNewlineIdx + 1, selectionStart);
      const wordsOnCurrentLine = lineBeforeCursor.trim().split(/\s+/).filter(Boolean);

      // After 3 words on the current line, pressing Space navigates directly to the next line
      if (wordsOnCurrentLine.length >= 3) {
        e.preventDefault();
        const nextValue = `${String(value).slice(0, selectionStart)}\n${String(value).slice(selectionEnd)}`;
        onChange(nextValue);
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
      // Allow Shift + Enter to insert a newline (\n) and move cursor to the next line
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

  return (
    <div
      className="relative flex items-center w-full h-full min-h-[28px]"
      style={{ width: `${autoWidthPx}px`, minWidth: `${autoWidthPx}px` }}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => {
          const formatted = formatThreeWordsPerLine(e.target.value);
          onChange(formatted);
          adjustHeight();
        }}
        onKeyDown={handleKeyDown}
        data-milestone-row={rowIdx}
        data-milestone-col={colKey}
        aria-label={ariaLabel}
        className="w-full bg-transparent outline-none text-slate-900 text-center focus:bg-blue-50/50 rounded pl-1 pr-5 py-1 text-[11.5px] font-medium resize-none overflow-hidden whitespace-pre-wrap break-words leading-snug"
      />
      <CalendarDays
        aria-hidden="true"
        className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
      />
      <input
        ref={pickerRef}
        type="date"
        value={extractDateForPicker(value)}
        onClick={(event) => event.currentTarget.showPicker?.()}
        onChange={(event) => {
          const nextVal = mergePickerDateWithText(event.target.value, value);
          onChange(nextVal);
        }}
        aria-label={`${ariaLabel} calendar picker`}
        title="Select date from calendar (can be combined with manual text)"
        className="absolute right-0 top-1/2 h-6 w-5 -translate-y-1/2 cursor-pointer opacity-0"
        tabIndex={-1}
      />
    </div>
  );
}

export default function PTMHeader({ headerInfo, setHeaderInfo, projectLeaderOptions = [], isMerged = false, formActions }) {
  const handleChange = (field, val) => {
    setHeaderInfo((prev) => ({
      ...prev,
      [field]: val,
    }));
  };

  return (
    <div className={`ptm-header relative bg-white select-none ${isMerged ? 'border-b border-[#64748B]' : 'rounded-xl border border-[#64748B] shadow-sm overflow-hidden mb-4'}`}>
      {formActions}

      {/* Grid containing the exact header sections from the spreadsheet image */}
      <div className="w-full grid grid-cols-[4fr_3fr_2fr_minmax(620px,auto)_minmax(210px,1fr)] divide-x divide-[#64748B]">
        
        {/* Section 1: Left Form Info — inline label+input with soft blue & rank amber accents */}
        <div className="[&_*]:!text-black bg-white text-sm border-r border-[#64748B]">
          <table className="w-full h-full border-collapse text-[13px]" style={{tableLayout:'fixed'}}>
            <colgroup>
              {/* Left half: Model + APQP (65%) | Right half: Rank label (20%) + Rank value (15%) */}
              <col style={{width:'40%'}} />
              <col style={{width:'25%'}} />
              <col style={{width:'20%'}} />
              <col style={{width:'15%'}} />
            </colgroup>
            <tbody>
              {/* Colored top header row aligned with Program Identification below */}
              <tr className="border-b border-[#64748B]" style={{height:'26px'}}>
                <td colSpan={4} className="bg-white px-2.5 align-middle">
                  <span className="font-extrabold text-slate-800 tracking-wide font-mono text-base">
                    {(headerInfo.formTitle || 'FRM-WH-DD-006 Project Tracking Matrix Rev. 17').replace(/\s*\([^)]*\)\s*$/, '') || 'FRM-WH-DD-006 Project Tracking Matrix Rev. 17'}
                  </span>
                </td>
              </tr>

              {/* Row: Model (inline) | Rank label + value */}
              <tr className="border-b border-[#64748B]">
                <td className="px-2.5 py-1.5 align-middle bg-white" colSpan={2}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-[#2C5282] text-xs sm:text-[13px] whitespace-nowrap">Model:</span>
                    <input
                      type="text"
                      value={headerInfo.model || ''}
                      onChange={(e) => handleChange('model', e.target.value)}
                      className="font-bold text-slate-900 outline-none bg-transparent text-sm min-w-0 flex-1 px-1 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-400"
                      placeholder=""
                    />
                  </div>
                </td>
                <td className="border-l border-[#64748B] px-2 py-1.5 align-middle text-right bg-white">
                  <span className="font-bold text-[#975A16] text-xs sm:text-[13px] whitespace-nowrap">Rank:</span>
                </td>
                <td className="px-2 py-1.5 align-middle bg-white">
                  <select
                    value={headerInfo.rank ?? ''}
                    onChange={(e) => handleChange('rank', e.target.value)}
                    aria-label="Rank"
                    className="w-full cursor-pointer font-bold text-[#975A16] outline-none bg-transparent text-sm px-1 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="">—</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C1">C1</option>
                    <option value="C2">C2</option>
                    <option value="S">S</option>
                  </select>
                </td>
              </tr>

              {/* Row: APQP Leader (inline) | Phase label + value */}
              <tr className="border-b border-[#64748B]">
                <td className="px-2.5 py-1.5 align-middle bg-white" colSpan={2}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-[#2C5282] text-xs sm:text-[13px] whitespace-nowrap">APQP Leader:</span>
                    <SearchableLeaderInput
                      value={headerInfo.apqpLeader || ''}
                      onChange={(e) => handleChange('apqpLeader', e.target.value)}
                      options={projectLeaderOptions}
                      id="apqp-leader"
                      className="w-full select-text cursor-text font-bold text-slate-900 outline-none bg-transparent text-sm min-w-0 px-1 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-400"
                      placeholder=""
                    />
                  </div>
                </td>
                <td className="border-l border-[#64748B] px-2 py-1.5 align-middle text-right bg-white">
                  <span className="font-bold text-[#2C5282] text-xs sm:text-[13px] whitespace-nowrap">Phase:</span>
                </td>
                <td className="px-2 py-1.5 align-middle bg-white">
                  <input
                    type="text"
                    value={headerInfo.phase ?? ''}
                    onChange={(e) => handleChange('phase', e.target.value)}
                    className="w-full select-text cursor-text font-bold text-slate-900 outline-none bg-transparent text-sm px-1 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-400"
                    placeholder="1"
                  />
                </td>
              </tr>

              {/* Row: Project Leader (inline, full width) */}
              <tr className="border-b border-[#64748B]">
                <td className="px-2.5 py-1.5 align-middle bg-white" colSpan={4}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-[#2C5282] text-xs sm:text-[13px] whitespace-nowrap">Project Leader:</span>
                    <SearchableLeaderInput
                      value={headerInfo.projectLeader || ''}
                      onChange={(e) => handleChange('projectLeader', e.target.value)}
                      options={projectLeaderOptions}
                      id="project-leader"
                      className="w-full select-text cursor-text font-bold text-slate-900 outline-none bg-transparent text-sm min-w-0 px-1 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-400"
                      placeholder="Shiva Chaudhary"
                    />
                  </div>
                </td>
              </tr>

              {/* Row: Review Date (inline, full width) */}
              <tr>
                <td className="px-2.5 py-1.5 align-middle bg-white" colSpan={4}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-[#2C5282] text-xs sm:text-[13px] whitespace-nowrap">Review Date:</span>
                    <CalendarDateInput
                      value={headerInfo.reviewDate || ''}
                      onChange={(e) => handleChange('reviewDate', e.target.value)}
                      containerClassName="w-fit flex-none"
                      className="w-[15ch] font-semibold text-slate-800 outline-none bg-transparent text-sm px-1 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-400"
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
          <table className="w-full h-full border-collapse text-[13px]" style={{tableLayout:'fixed'}}>
            <colgroup>
              <col style={{width:'22%'}} />  {/* "Legend" label cell */}
              <col style={{width:'22%'}} />  {/* Activity / Rank / Deptt labels */}
              <col style={{width:'14%'}} />  {/* Symbol */}
              <col style={{width:'42%'}} />  {/* Description */}
            </colgroup>
            <tbody>
              {/* Top empty row with header tint */}
              <tr className="border-b border-[#64748B]" style={{height:'26px'}}>
                <td colSpan={4}></td>
              </tr>

              {/* Row 1: Legend (rowSpan 5) | Activity | ◆ | Critical Activity */}
              <tr className="border-b border-[#64748B]">
                <td
                  className="border-r border-[#64748B] text-center font-extrabold text-[#2C5282] uppercase tracking-wider align-middle text-xs sm:text-[13px] px-1"
                  rowSpan={5}
                  style={{verticalAlign:'middle'}}
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
              <tr className="border-b border-[#64748B]" style={{height:'26px'}}>
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
          <table className="w-full h-full border-collapse text-xs" style={{tableLayout:'auto'}}>
            <tbody>
              {/* Top row — aligns height with other sections */}
              <tr className="border-b border-[#64748B]" style={{height:'26px'}}>
                <td colSpan={6} className="bg-white"></td>
              </tr>
              {/* Column Headers: blank | DPT | PPT | MPT | PILOT | SOP */}
              <tr className="border-b border-[#64748B]">
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
              <tr className="border-b border-[#64748B]">
                <td className="border-r border-[#64748B] px-1.5 py-1 min-w-[125px] whitespace-nowrap text-left align-middle bg-white text-slate-900 font-medium leading-tight text-[11px]">
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
              <tr className="border-b border-[#64748B]">
                <td className="border-r border-[#64748B] px-1.5 py-1 min-w-[125px] whitespace-nowrap text-left align-middle bg-white text-slate-900 font-medium leading-tight text-[11px]">
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
              {/* Row 3: Additional Milestone Row matching Excel reference */}
              <tr>
                <td className="border-r border-[#64748B] px-1.5 py-1 min-w-[125px] whitespace-nowrap text-left align-middle bg-white text-slate-900 font-medium leading-tight text-[11px]">
                </td>
                {MILESTONE_COLUMNS.map((col, idx) => {
                  const fieldKey = `milestoneExtra${col.key}`;
                  return (
                    <td
                      key={col.key}
                      className={`${idx < MILESTONE_COLUMNS.length - 1 ? 'border-r border-[#64748B]' : ''} w-auto min-w-[96px] p-0.5 align-middle bg-white`}
                    >
                      <MilestoneDateTextCell
                        value={headerInfo[fieldKey] || ''}
                        onChange={(val) => handleChange(fieldKey, val)}
                        rowIdx={2}
                        colKey={col.key}
                        ariaLabel={`Additional Milestone - ${col.label}`}
                      />
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 5: Document Metadata — compact with polished header styling */}
        <div className="bg-[#F4F7FA] flex flex-col justify-center px-1.5 py-1">
          <table className="w-full border border-[#64748B] text-xs bg-white rounded-xs overflow-hidden shadow-2xs">
            <tbody>
              <tr className="border-b border-[#64748B]">
                <td className="px-1 py-0.5 font-bold text-[#2C5282] bg-[#EEF4FA] whitespace-nowrap text-[11px]">Doc No.:</td>
                <td className="px-1.5 py-0.5 font-mono text-slate-800 bg-white">
                  <input
                    type="text"
                    value={headerInfo.docNo || 'FRM-DD-WH-006'}
                    onChange={(e) => handleChange('docNo', e.target.value)}
                    className="w-full bg-transparent outline-none font-mono font-bold text-xs"
                  />
                </td>
              </tr>
              <tr className="border-b border-[#64748B]">
                <td className="px-1 py-0.5 font-bold text-[#2C5282] bg-[#EEF4FA] whitespace-nowrap text-[11px]">Rev No.:</td>
                <td className="px-1.5 py-0.5 font-bold text-slate-800 bg-white">
                  <input
                    type="text"
                    value={headerInfo.revNo || '17'}
                    onChange={(e) => handleChange('revNo', e.target.value)}
                    className="w-full bg-transparent outline-none font-bold text-xs"
                  />
                </td>
              </tr>
              <tr className="border-b border-[#64748B]">
                <td className="px-1 py-0.5 font-bold text-[#2C5282] bg-[#EEF4FA] whitespace-nowrap text-[11px]">Issue Date:</td>
                <td className="px-1.5 py-0.5 text-slate-700 bg-white">
                  <CalendarDateInput
                    value={headerInfo.issueDate || '07.11.2013'}
                    onChange={(e) => handleChange('issueDate', e.target.value)}
                    className="w-full bg-transparent outline-none font-bold text-xs"
                  />
                </td>
              </tr>
              <tr className="bg-[#FEF08A] font-bold text-amber-950">
                <td className="px-1 py-1 font-extrabold border-r border-amber-300 whitespace-nowrap text-[11px]">Rev. Date:</td>
                <td className="px-1 py-1">
                  <CalendarDateInput
                    value={headerInfo.revDate || '17.10.23'}
                    onChange={(e) => handleChange('revDate', e.target.value)}
                    className="w-full bg-transparent outline-none font-extrabold text-xs text-amber-950"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
