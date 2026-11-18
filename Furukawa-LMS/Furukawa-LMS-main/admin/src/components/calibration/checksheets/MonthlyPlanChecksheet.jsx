import React, { useState } from 'react';
import { Check } from 'lucide-react';
import SignatureApprovalControl from './SignatureApprovalControl';

const SUNDAYS_AUG_2026 = [2, 9, 16, 23, 30];
const DAYS_IN_MONTH = 31;
const INITIAL_INSTRUMENT_COUNT = 15;

export default function MonthlyPlanChecksheet({ document = {}, onSave = () => {} }) {
  const storageKey = `cal_checksheet_${document.id || 'DOC-CAL-04'}`;

  const [title, setTitle] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_title`);
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    return 'Aug-2026 _Inhouse Calibration Plan';
  });

  const [footerInfo, setFooterInfo] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_footer`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      preparedBy: 'Ujjawal Kumar',
      docCode: 'FRM-WH-QA-210',
      checkedBy: 'Alok Singh',
      revNo: '00',
      reviewedBy: 'Vikas Phogat',
      revDate: '00',
      approvedBy: 'Arvind Chauhan',
      issueDate: '11.10.2022'
    };
  });

  const [instruments, setInstruments] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_instruments`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return Array.from({ length: INITIAL_INSTRUMENT_COUNT }, (_, i) => ({
      sNo: i + 1,
      instrumentName: '',
      instrumentNo: '',
      make: '',
      location: '',
      leastCount: '',
      range: '',
      frequency: '',
      dueDate: '',
      planDays: Array(DAYS_IN_MONTH).fill(''),
      actualDays: Array(DAYS_IN_MONTH).fill('')
    }));
  });

  const [saveToast, setSaveToast] = useState(false);

  const updateInstrumentField = (index, field, val) => {
    setInstruments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const updateDayCell = (index, type, dayIndex, val) => {
    setInstruments((prev) => {
      const next = [...prev];
      const targetDays = type === 'plan' ? [...next[index].planDays] : [...next[index].actualDays];
      targetDays[dayIndex] = val;
      if (type === 'plan') {
        next[index] = { ...next[index], planDays: targetDays };
      } else {
        next[index] = { ...next[index], actualDays: targetDays };
      }
      return next;
    });
  };

  const toggleDaySymbol = (index, type, dayIndex) => {
    setInstruments((prev) => {
      const next = [...prev];
      const targetDays = type === 'plan' ? [...next[index].planDays] : [...next[index].actualDays];
      const current = targetDays[dayIndex];
      const symbol = type === 'plan' ? 'O' : '●';
      targetDays[dayIndex] = current ? '' : symbol;
      if (type === 'plan') {
        next[index] = { ...next[index], planDays: targetDays };
      } else {
        next[index] = { ...next[index], actualDays: targetDays };
      }
      return next;
    });
  };

  const handleSave = () => {
    try {
      localStorage.setItem(`${storageKey}_title`, title);
      localStorage.setItem(`${storageKey}_footer`, JSON.stringify(footerInfo));
      localStorage.setItem(`${storageKey}_instruments`, JSON.stringify(instruments));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
    onSave({ title, footerInfo, instruments });
  };

  return (
    <div className="w-full flex flex-col items-center pb-12 select-text">
      {saveToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Checksheet saved successfully!</span>
        </div>
      )}

      {/* ── Checksheet Canvas ── */}
      <div className="w-[1520px] max-w-[1520px] shrink-0 bg-white border border-black shadow-md text-black font-sans text-xs">
        {/* Top Bar with Title and Legends Box (Matching Screenshot 2 & 3) */}
        <div className="w-full min-w-[1440px] px-4 py-2 bg-white flex items-end justify-between border-b border-black">
          {/* Centered Document Title */}
          <div className="flex-1 flex justify-center pl-32">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-bold text-sm sm:text-base text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:outline-none focus:border-slate-500 max-w-lg"
            />
          </div>

          {/* Legends Box */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-black">Legends</span>
            <table className="border-collapse border border-black text-[10px]">
              <tbody>
                <tr className="border-b border-black">
                  <td className="px-2 py-0.5 font-bold border-r border-black bg-white">Plan</td>
                  <td className="px-2 py-0.5 text-center font-bold bg-white">O</td>
                </tr>
                <tr>
                  <td className="px-2 py-0.5 font-bold border-r border-black bg-white">Actual</td>
                  <td className="px-2 py-0.5 text-center font-bold bg-white">●</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Main Spreadsheet Table ── */}
        <table className="w-full min-w-[1440px] border-collapse border border-black table-fixed text-[11px]">
          {/* Colgroup defining exact widths */}
          <colgroup>
            <col style={{ width: '38px' }} />
            <col style={{ width: '150px' }} />
            <col style={{ width: '105px' }} />
            <col style={{ width: '85px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '80px' }} />
            <col style={{ width: '80px' }} />
            <col style={{ width: '75px' }} />
            <col style={{ width: '85px' }} />
            <col style={{ width: '55px' }} />
            {Array.from({ length: DAYS_IN_MONTH }, (_, i) => (
              <col key={i} style={{ width: '22px' }} />
            ))}
          </colgroup>

          {/* Table Header Row (Peach #FCE4D6 & Sunday Yellow #FFC000) */}
          <thead>
            <tr className="bg-[#FCE4D6] border-b border-black text-black text-center font-bold">
              <th className="p-1 border-r border-black font-bold">S.No</th>
              <th className="p-1 border-r border-black font-bold text-left px-2">Instrument Name</th>
              <th className="p-1 border-r border-black font-bold text-left px-2">Instrument No</th>
              <th className="p-1 border-r border-black font-bold">Make</th>
              <th className="p-1 border-r border-black font-bold">Location</th>
              <th className="p-1 border-r border-black font-bold">Least Count</th>
              <th className="p-1 border-r border-black font-bold">Range</th>
              <th className="p-1 border-r border-black font-bold">Frequency</th>
              <th className="p-1 border-r border-black font-bold">due date</th>
              <th className="p-1 border-r border-black font-bold">Plan</th>
              {Array.from({ length: DAYS_IN_MONTH }, (_, i) => {
                const day = i + 1;
                const isSunday = SUNDAYS_AUG_2026.includes(day);
                return (
                  <th
                    key={day}
                    className={`p-0.5 border-r border-black text-center font-bold select-none ${
                      isSunday ? 'bg-[#FFC000]' : 'bg-[#FCE4D6]'
                    }`}
                  >
                    {day}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body with 2 Rows per Instrument: Plan and Actual */}
          <tbody className="bg-white">
            {instruments.map((inst, idx) => (
              <React.Fragment key={idx}>
                {/* ── Sub-row 1: Instrument Info + Plan Row ── */}
                <tr className="border-b border-black/50 hover:bg-slate-50/50">
                  {/* S.No */}
                  <td rowSpan={2} className="p-0 border-r border-black text-center font-medium bg-white align-middle select-none">
                    {inst.sNo}
                  </td>

                  {/* Instrument Name */}
                  <td rowSpan={2} className="p-0 border-r border-black bg-white align-middle">
                    <input
                      type="text"
                      value={inst.instrumentName}
                      onChange={(e) => updateInstrumentField(idx, 'instrumentName', e.target.value)}
                      className="w-full px-1.5 py-1 bg-transparent text-[11px] text-black focus:outline-none"
                    />
                  </td>

                  {/* Instrument No */}
                  <td rowSpan={2} className="p-0 border-r border-black bg-white align-middle">
                    <input
                      type="text"
                      value={inst.instrumentNo}
                      onChange={(e) => updateInstrumentField(idx, 'instrumentNo', e.target.value)}
                      className="w-full px-1.5 py-1 bg-transparent text-[11px] text-black focus:outline-none"
                    />
                  </td>

                  {/* Make */}
                  <td rowSpan={2} className="p-0 border-r border-black bg-white align-middle">
                    <input
                      type="text"
                      value={inst.make}
                      onChange={(e) => updateInstrumentField(idx, 'make', e.target.value)}
                      className="w-full px-1.5 py-1 bg-transparent text-[11px] text-black focus:outline-none text-center"
                    />
                  </td>

                  {/* Location */}
                  <td rowSpan={2} className="p-0 border-r border-black bg-white align-middle">
                    <input
                      type="text"
                      value={inst.location}
                      onChange={(e) => updateInstrumentField(idx, 'location', e.target.value)}
                      className="w-full px-1.5 py-1 bg-transparent text-[11px] text-black focus:outline-none text-center"
                    />
                  </td>

                  {/* Least Count */}
                  <td rowSpan={2} className="p-0 border-r border-black bg-white align-middle">
                    <input
                      type="text"
                      value={inst.leastCount}
                      onChange={(e) => updateInstrumentField(idx, 'leastCount', e.target.value)}
                      className="w-full px-1.5 py-1 bg-transparent text-[11px] text-black focus:outline-none text-center"
                    />
                  </td>

                  {/* Range */}
                  <td rowSpan={2} className="p-0 border-r border-black bg-white align-middle">
                    <input
                      type="text"
                      value={inst.range}
                      onChange={(e) => updateInstrumentField(idx, 'range', e.target.value)}
                      className="w-full px-1.5 py-1 bg-transparent text-[11px] text-black focus:outline-none text-center"
                    />
                  </td>

                  {/* Frequency */}
                  <td rowSpan={2} className="p-0 border-r border-black bg-white align-middle">
                    <input
                      type="text"
                      value={inst.frequency}
                      onChange={(e) => updateInstrumentField(idx, 'frequency', e.target.value)}
                      className="w-full px-1.5 py-1 bg-transparent text-[11px] text-black focus:outline-none text-center"
                    />
                  </td>

                  {/* due date */}
                  <td rowSpan={2} className="p-0 border-r border-black bg-white align-middle">
                    <input
                      type="text"
                      value={inst.dueDate}
                      onChange={(e) => updateInstrumentField(idx, 'dueDate', e.target.value)}
                      className="w-full px-1.5 py-1 bg-transparent text-[11px] text-black focus:outline-none text-center"
                    />
                  </td>

                  {/* Plan Indicator Label */}
                  <td className="p-0 border-r border-black text-center font-semibold text-[10px] bg-slate-50 select-none">
                    Plan
                  </td>

                  {/* 31 Days for Plan */}
                  {Array.from({ length: DAYS_IN_MONTH }, (_, dIdx) => (
                    <td
                      key={dIdx}
                      onClick={() => toggleDaySymbol(idx, 'plan', dIdx)}
                      className="p-0 border-r border-black text-center align-middle cursor-pointer hover:bg-slate-100/80 transition-colors"
                    >
                      <input
                        type="text"
                        value={inst.planDays[dIdx] || ''}
                        onChange={(e) => updateDayCell(idx, 'plan', dIdx, e.target.value)}
                        className="w-full h-full text-center bg-transparent text-[11px] font-bold focus:outline-none"
                      />
                    </td>
                  ))}
                </tr>

                {/* ── Sub-row 2: Actual Row ── */}
                <tr className="border-b-2 border-black hover:bg-slate-50/50">
                  {/* Actual Indicator Label */}
                  <td className="p-0 border-r border-black text-center font-semibold text-[10px] bg-slate-50 select-none">
                    Actual
                  </td>

                  {/* 31 Days for Actual */}
                  {Array.from({ length: DAYS_IN_MONTH }, (_, dIdx) => (
                    <td
                      key={dIdx}
                      onClick={() => toggleDaySymbol(idx, 'actual', dIdx)}
                      className="p-0 border-r border-black text-center align-middle cursor-pointer hover:bg-slate-100/80 transition-colors"
                    >
                      <input
                        type="text"
                        value={inst.actualDays[dIdx] || ''}
                        onChange={(e) => updateDayCell(idx, 'actual', dIdx, e.target.value)}
                        className="w-full h-full text-center bg-transparent text-[11px] font-bold focus:outline-none"
                      />
                    </td>
                  ))}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {/* ── Document Footer Section (Matching Screenshot 3 & 4) ── */}
        <div className="w-full min-w-[1440px] grid grid-cols-4 border-t-2 border-black bg-white text-[11px] font-bold divide-x-2 divide-black">
          {/* Column 1: Prepared By */}
          <div className="p-2 space-y-1">
            <div className="flex items-center">
              <span className="text-black mr-1">Prepared By:</span>
              <input
                type="text"
                value={footerInfo.preparedBy}
                onChange={(e) => setFooterInfo((prev) => ({ ...prev, preparedBy: e.target.value }))}
                className="bg-transparent font-bold focus:outline-none"
              />
            </div>
            <div className="text-[10px] font-bold text-black">{footerInfo.docCode}</div>
          </div>

          {/* Column 2: Checked By */}
          <div className="p-2 space-y-1">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center min-w-0">
                <span className="text-black mr-1 shrink-0">Checked By :</span>
                <input
                  type="text"
                  value={footerInfo.checkedBy}
                  onChange={(e) => setFooterInfo((prev) => ({ ...prev, checkedBy: e.target.value }))}
                  className="bg-transparent font-bold focus:outline-none w-24"
                />
              </div>
              <SignatureApprovalControl
                status={footerInfo.checkedBy_status || 'pending'}
                onApprove={() => setFooterInfo((prev) => ({ ...prev, checkedBy_status: 'approved' }))}
                onReject={() => setFooterInfo((prev) => ({ ...prev, checkedBy_status: 'rejected' }))}
                onReset={() => setFooterInfo((prev) => ({ ...prev, checkedBy_status: 'pending' }))}
              />
            </div>
            <div className="text-[10px] font-bold text-black">REV :- {footerInfo.revNo}</div>
          </div>

          {/* Column 3: Reviewed By */}
          <div className="p-2 space-y-1">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center min-w-0">
                <span className="text-black mr-1 shrink-0">Reviewed By:</span>
                <input
                  type="text"
                  value={footerInfo.reviewedBy}
                  onChange={(e) => setFooterInfo((prev) => ({ ...prev, reviewedBy: e.target.value }))}
                  className="bg-transparent font-bold focus:outline-none w-24"
                />
              </div>
              <SignatureApprovalControl
                status={footerInfo.reviewedBy_status || 'pending'}
                onApprove={() => setFooterInfo((prev) => ({ ...prev, reviewedBy_status: 'approved' }))}
                onReject={() => setFooterInfo((prev) => ({ ...prev, reviewedBy_status: 'rejected' }))}
                onReset={() => setFooterInfo((prev) => ({ ...prev, reviewedBy_status: 'pending' }))}
              />
            </div>
            <div className="text-[10px] font-bold text-black">REV DATE:- {footerInfo.revDate}</div>
          </div>

          {/* Column 4: Approved By */}
          <div className="p-2 space-y-1">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center min-w-0">
                <span className="text-black mr-1 shrink-0">Approved By:</span>
                <input
                  type="text"
                  value={footerInfo.approvedBy}
                  onChange={(e) => setFooterInfo((prev) => ({ ...prev, approvedBy: e.target.value }))}
                  className="bg-transparent font-bold focus:outline-none w-24"
                />
              </div>
              <SignatureApprovalControl
                status={footerInfo.approvedBy_status || 'pending'}
                onApprove={() => setFooterInfo((prev) => ({ ...prev, approvedBy_status: 'approved' }))}
                onReject={() => setFooterInfo((prev) => ({ ...prev, approvedBy_status: 'rejected' }))}
                onReset={() => setFooterInfo((prev) => ({ ...prev, approvedBy_status: 'pending' }))}
              />
            </div>
            <div className="text-[10px] font-bold text-black">ISSUE DATE {footerInfo.issueDate}</div>
          </div>
        </div>

        {/* Hidden button to allow external save trigger */}
        <button id="cal-checksheet-save-btn" type="button" onClick={handleSave} className="hidden" />
      </div>
    </div>
  );
}
