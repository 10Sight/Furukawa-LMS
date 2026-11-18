import React, { useState } from 'react';
import { Check } from 'lucide-react';
import SignatureApprovalControl from './SignatureApprovalControl';

const INITIAL_HISTORY_ROWS = 10;

export default function HistoryCardChecksheet({ document = {}, onSave = () => {} }) {
  const storageKey = `cal_checksheet_${document.id || 'DOC-CAL-06'}`;

  // Top Specifications Block (Matching exact texts from screenshot)
  const [specs, setSpecs] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_specs`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      manufactureOfInstruments: '',
      yearOfPurchase: '',
      rangeOfInstrument: '',
      instrumentsName: '',
      instrumentNo: '',
      usageLocation: document.section || '',
      leastCount: '',
      acceptanceCriteria: '',
      specialInstruction: ''
    };
  });

  // Main History Records Table (9 Columns with S.No. and borders, clean white canvas)
  const [historyRows, setHistoryRows] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_rows`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, INITIAL_HISTORY_ROWS);
        }
      }
    } catch {
      /* ignore */
    }
    return Array.from({ length: INITIAL_HISTORY_ROWS }, () => ({
      date: '',
      calibrationReportNo: '',
      calibrationDueDate: '',
      calibrationDoneBy: '',
      result: '',
      instrumentCondition: '',
      inspectedBy: '',
      remarks: ''
    }));
  });

  // Footer Format Metadata (Matching screenshot exact labels)
  const [footerInfo, setFooterInfo] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_footer`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      preparedBy: '',
      approvedBy: '',
      docCode: 'FRM-WH-QA-038',
      revNo: 'Rev. No.01',
      revDate: 'Rev. Date: 07.03.19',
      pageInfo: 'Page: 1 of 1'
    };
  });

  const [saveToast, setSaveToast] = useState(false);

  const updateSpecField = (field, val) => {
    setSpecs((prev) => ({ ...prev, [field]: val }));
  };

  const updateHistoryRow = (index, field, val) => {
    setHistoryRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleSave = () => {
    try {
      localStorage.setItem(`${storageKey}_specs`, JSON.stringify(specs));
      localStorage.setItem(`${storageKey}_rows`, JSON.stringify(historyRows));
      localStorage.setItem(`${storageKey}_footer`, JSON.stringify(footerInfo));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
    onSave({ specs, historyRows, footerInfo });
  };

  return (
    <div className="w-full flex flex-col items-center pb-12 select-text">
      {saveToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Checksheet saved successfully!</span>
        </div>
      )}

      {/* ── Checksheet Canvas (Exact replica of image, pure white, no extra borders) ── */}
      <div className="w-[1240px] max-w-[1240px] shrink-0 bg-white border-2 border-black shadow-md text-black font-sans text-xs">
        {/* Document Title Header */}
        <div className="w-full min-w-[1050px] border-b-2 border-black p-2 text-center font-bold text-sm sm:text-base tracking-wide bg-white">
          CALIBRATION HISTORY CARD
        </div>

        {/* ── 1. Top Instrument Specifications Block (Open layout, no vertical borders) ── */}
        <div className="w-full min-w-[1050px] p-2.5 px-3.5 bg-white text-[11px]">
          {/* Row 1: Manufactrure of Instruments: | Year of purchase: | Range of Instrument */}
          <div className="flex items-center gap-8 py-1">
            <div className="flex items-center flex-1 min-w-0">
              <span className="font-bold whitespace-nowrap mr-2">Manufactrure of Instruments:</span>
              <input
                type="text"
                value={specs.manufactureOfInstruments}
                onChange={(e) => updateSpecField('manufactureOfInstruments', e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-normal"
              />
            </div>
            <div className="flex items-center flex-1 min-w-0">
              <span className="font-bold whitespace-nowrap mr-2">Year of purchase:</span>
              <input
                type="text"
                value={specs.yearOfPurchase}
                onChange={(e) => updateSpecField('yearOfPurchase', e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-normal"
              />
            </div>
            <div className="flex items-center flex-1 min-w-0">
              <span className="font-bold whitespace-nowrap mr-2">Range of Instrument</span>
              <input
                type="text"
                value={specs.rangeOfInstrument}
                onChange={(e) => updateSpecField('rangeOfInstrument', e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-normal"
              />
            </div>
          </div>

          {/* Row 2: Instruments Name: | Instrument No. | Usage location | Least count | Acceptance criteria */}
          <div className="flex items-center gap-6 py-1 pt-1.5">
            <div className="flex items-center flex-1 min-w-0">
              <span className="font-bold whitespace-nowrap mr-2">Instruments Name:</span>
              <input
                type="text"
                value={specs.instrumentsName}
                onChange={(e) => updateSpecField('instrumentsName', e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-normal"
              />
            </div>
            <div className="flex items-center flex-1 min-w-0">
              <span className="font-bold whitespace-nowrap mr-2">Instrument No.</span>
              <input
                type="text"
                value={specs.instrumentNo}
                onChange={(e) => updateSpecField('instrumentNo', e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-normal"
              />
            </div>
            <div className="flex items-center flex-1 min-w-0">
              <span className="font-bold whitespace-nowrap mr-2">Usage location</span>
              <input
                type="text"
                value={specs.usageLocation}
                onChange={(e) => updateSpecField('usageLocation', e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-normal"
              />
            </div>
            <div className="flex items-center flex-1 min-w-0">
              <span className="font-bold whitespace-nowrap mr-2">Least count</span>
              <input
                type="text"
                value={specs.leastCount}
                onChange={(e) => updateSpecField('leastCount', e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-normal"
              />
            </div>
            <div className="flex items-center flex-1 min-w-0">
              <span className="font-bold whitespace-nowrap mr-2">Acceptance criteria</span>
              <textarea
                rows={1}
                value={specs.acceptanceCriteria}
                onChange={(e) => updateSpecField('acceptanceCriteria', e.target.value)}
                className="flex-1 bg-transparent border-none resize-none focus:outline-none text-[11px] font-normal"
              />
            </div>
          </div>
        </div>

        {/* Row 3: Special Instruction : (Divided by solid horizontal lines, multi-line textarea for long input) */}
        <div className="w-full min-w-[1050px] border-t-2 border-b-2 border-black p-2.5 px-3.5 bg-white">
          <div className="flex flex-col w-full">
            <span className="font-bold whitespace-nowrap text-[11px] mb-1">Special Instruction :</span>
            <textarea
              rows={2}
              value={specs.specialInstruction}
              onChange={(e) => updateSpecField('specialInstruction', e.target.value)}
              className="w-full bg-transparent resize-y border-none focus:outline-none text-[11px] font-normal leading-relaxed min-h-[46px]"
            />
          </div>
        </div>

        {/* ── 2. Calibration History Table (9 Columns with S.No. and borders) ── */}
        <div className="w-full min-w-[1050px]">
          <table className="w-full border-collapse text-[11px] table-fixed">
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '7.5%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '26.5%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr className="border-b-2 border-black text-center font-normal bg-white leading-tight">
                <th className="p-2 border-r border-black font-normal align-middle">S.No.</th>
                <th className="p-2 border-r border-black font-normal align-middle">Date</th>
                <th className="p-2 border-r border-black font-normal align-middle">Calibration<br />report no.</th>
                <th className="p-2 border-r border-black font-normal align-middle">Calibration<br />Due date</th>
                <th className="p-2 border-r border-black font-normal align-middle">Calibration<br />done by</th>
                <th className="p-2 border-r border-black font-normal align-middle">Result</th>
                <th className="p-2 border-r border-black font-normal align-middle">Instrument condition</th>
                <th className="p-2 border-r border-black font-normal align-middle">Inspected by</th>
                <th className="p-2 font-normal align-middle">Remarks</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {historyRows.map((row, idx) => (
                <tr key={idx} className="border-b border-black hover:bg-slate-50/40">
                  {/* S.No. */}
                  <td className="p-0 border-r border-black text-center font-semibold text-slate-800">
                    {idx + 1}
                  </td>

                  {/* Date */}
                  <td className="p-0 border-r border-black text-center">
                    <input
                      type="text"
                      value={row.date}
                      onChange={(e) => updateHistoryRow(idx, 'date', e.target.value)}
                      className="w-full h-7 px-1 text-center bg-transparent border-none text-[11px] focus:outline-none"
                    />
                  </td>

                  {/* Calibration report no. */}
                  <td className="p-0 border-r border-black text-center">
                    <input
                      type="text"
                      value={row.calibrationReportNo}
                      onChange={(e) => updateHistoryRow(idx, 'calibrationReportNo', e.target.value)}
                      className="w-full h-7 px-1 text-center bg-transparent border-none text-[11px] focus:outline-none"
                    />
                  </td>

                  {/* Calibration Due date */}
                  <td className="p-0 border-r border-black text-center">
                    <input
                      type="text"
                      value={row.calibrationDueDate}
                      onChange={(e) => updateHistoryRow(idx, 'calibrationDueDate', e.target.value)}
                      className="w-full h-7 px-1 text-center bg-transparent border-none text-[11px] focus:outline-none"
                    />
                  </td>

                  {/* Calibration done by */}
                  <td className="p-0 border-r border-black text-center">
                    <input
                      type="text"
                      value={row.calibrationDoneBy}
                      onChange={(e) => updateHistoryRow(idx, 'calibrationDoneBy', e.target.value)}
                      className="w-full h-7 px-1 text-center bg-transparent border-none text-[11px] focus:outline-none"
                    />
                  </td>

                  {/* Result */}
                  <td className="p-0 border-r border-black text-center">
                    <input
                      type="text"
                      value={row.result}
                      onChange={(e) => updateHistoryRow(idx, 'result', e.target.value)}
                      className="w-full h-7 px-1 text-center bg-transparent border-none text-[11px] focus:outline-none"
                    />
                  </td>

                  {/* Instrument condition (Textarea for long notes) */}
                  <td className="p-0 border-r border-black">
                    <textarea
                      rows={1}
                      value={row.instrumentCondition}
                      onChange={(e) => updateHistoryRow(idx, 'instrumentCondition', e.target.value)}
                      className="w-full h-full min-h-[28px] px-2 py-1 bg-transparent border-none resize-none focus:outline-none text-[11px] leading-tight"
                    />
                  </td>

                  {/* Inspected by */}
                  <td className="p-0 border-r border-black text-center">
                    <input
                      type="text"
                      value={row.inspectedBy}
                      onChange={(e) => updateHistoryRow(idx, 'inspectedBy', e.target.value)}
                      className="w-full h-7 px-1 text-center bg-transparent border-none text-[11px] focus:outline-none"
                    />
                  </td>

                  {/* Remarks (Textarea for notes) */}
                  <td className="p-0 text-center">
                    <textarea
                      rows={1}
                      value={row.remarks}
                      onChange={(e) => updateHistoryRow(idx, 'remarks', e.target.value)}
                      className="w-full h-full min-h-[28px] px-1 py-1 text-center bg-transparent border-none resize-none focus:outline-none text-[11px] leading-tight"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Signatures Row ── */}
        <div className="w-full min-w-[1050px] border-t-2 border-black grid grid-cols-2 divide-x-2 divide-black bg-white text-[11px]">
          <div className="p-2 flex items-center">
            <span className="font-bold mr-2 whitespace-nowrap">Prepared By:</span>
            <input
              type="text"
              value={footerInfo.preparedBy || ''}
              onChange={(e) => setFooterInfo((prev) => ({ ...prev, preparedBy: e.target.value }))}
              className="w-full bg-transparent border-none focus:outline-none font-medium"
            />
          </div>
          <div className="p-2 flex items-center justify-between gap-2">
            <div className="flex items-center min-w-0 flex-1">
              <span className="font-bold mr-2 whitespace-nowrap">Approved By:</span>
              <input
                type="text"
                value={footerInfo.approvedBy || ''}
                onChange={(e) => setFooterInfo((prev) => ({ ...prev, approvedBy: e.target.value }))}
                className="w-full bg-transparent border-none focus:outline-none font-medium"
              />
            </div>
            <SignatureApprovalControl
              status={footerInfo.approvedBy_status || 'pending'}
              onApprove={() => setFooterInfo((prev) => ({ ...prev, approvedBy_status: 'approved' }))}
              onReject={() => setFooterInfo((prev) => ({ ...prev, approvedBy_status: 'rejected' }))}
              onReset={() => setFooterInfo((prev) => ({ ...prev, approvedBy_status: 'pending' }))}
            />
          </div>
        </div>

        {/* ── 3. Footer Metadata Row (Matching Screenshot Exactly) ── */}
        <div className="w-full min-w-[1050px] grid grid-cols-12 border-t-2 border-black bg-white text-[10px] font-bold p-1 px-3">
          <div className="col-span-3 flex items-center justify-start text-black">
            {footerInfo.docCode}
          </div>
          <div className="col-span-3 flex items-center justify-center text-black">
            {footerInfo.revNo}
          </div>
          <div className="col-span-3 flex items-center justify-center text-black">
            {footerInfo.revDate}
          </div>
          <div className="col-span-3 flex items-center justify-end text-black pr-1">
            {footerInfo.pageInfo}
          </div>
        </div>

        {/* Hidden button to allow external save trigger */}
        <button id="cal-checksheet-save-btn" type="button" onClick={handleSave} className="hidden" />
      </div>
    </div>
  );
}
