import React, { useState } from 'react';
import { Check } from 'lucide-react';
import SignatureApprovalControl from './SignatureApprovalControl';

const INITIAL_ROW_COUNT = 35;

export default function HalfYearlyPlanChecksheet({ document = {}, onSave = () => {} }) {
  const storageKey = `cal_checksheet_${document.id || 'DOC-CAL-03'}`;

  const [headerInfo, setHeaderInfo] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_header`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      title: "Inhouse Calibration Plan Jul'26 To Dec'26",
      docCode: 'FRM-WH-QA-209',
      revNo: '01',
      revDate: '01-03-2024',
      issueDate: '01-07-2026',
      issueNo: '2',
      revisionIssueDate: '01-07-2026',
      calibrationSource: 'FME QA LAB'
    };
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
      checkedBy: 'Alok Singh',
      reviewedBy: 'Vikas Phogat',
      approvedBy: 'Arvind Chauhan'
    };
  });

  const [rows, setRows] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_rows`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return Array.from({ length: INITIAL_ROW_COUNT }, (_, i) => ({
      sNo: i + 1,
      instrumentName: '',
      identificationNo: '',
      make: '',
      location: '',
      leastCount: '',
      range: '',
      frequency: '',
      dueDate: '',
      doneDate: '',
      nextDueDate: '',
      remark: '',
      responsibility: ''
    }));
  });

  const [saveToast, setSaveToast] = useState(false);

  const updateHeader = (field, val) => {
    setHeaderInfo((prev) => ({ ...prev, [field]: val }));
  };

  const updateRow = (index, field, val) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleSave = () => {
    try {
      localStorage.setItem(`${storageKey}_header`, JSON.stringify(headerInfo));
      localStorage.setItem(`${storageKey}_rows`, JSON.stringify(rows));
      localStorage.setItem(`${storageKey}_footer`, JSON.stringify(footerInfo));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
    onSave({ headerInfo, rows, footerInfo });
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
      <div className="w-[1320px] max-w-[1320px] shrink-0 bg-white border-2 border-black shadow-md text-black font-sans text-xs">
        <table className="w-full min-w-[1240px] border-collapse border border-black table-fixed">
          {/* Column Sizing */}
          <colgroup>
            <col style={{ width: '42px' }} />
            <col style={{ width: '165px' }} />
            <col style={{ width: '145px' }} />
            <col style={{ width: '95px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '95px' }} />
            <col style={{ width: '85px' }} />
            <col style={{ width: '85px' }} />
            <col style={{ width: '85px' }} />
            <col style={{ width: '95px' }} />
            <col style={{ width: '135px' }} />
            <col style={{ width: '110px' }} />
          </colgroup>

          {/* ── 1. Yellow Header Block (Matches Screenshot 2 Exactly) ── */}
          <thead>
            {/* Header Row 1: Title (Yellow bg) & Top-Right Format Box */}
            <tr className="bg-[#FFFF00] border-b border-black">
              <th
                colSpan={11}
                className="p-2 border-r border-black text-center text-base sm:text-lg font-bold tracking-tight text-black align-middle"
              >
                <input
                  type="text"
                  value={headerInfo.title}
                  onChange={(e) => updateHeader('title', e.target.value)}
                  className="w-full bg-transparent text-center font-bold text-base sm:text-lg focus:outline-none focus:bg-yellow-200"
                />
              </th>
              {/* Top-Right Metadata Box */}
              <th colSpan={2} className="p-0 border-b border-black align-top bg-[#FFFF00]">
                <div className="text-[10px] text-left text-black font-semibold divide-y divide-black">
                  <div className="px-1.5 py-0.5 leading-tight font-bold">
                    <span>FRM-WH-QA-209</span>
                  </div>
                  <div className="px-1.5 py-0.5 leading-tight">
                    <span>Rev.No : {headerInfo.revNo}</span>
                  </div>
                  <div className="px-1.5 py-0.5 leading-tight">
                    <span>Rev.Date : {headerInfo.revDate}</span>
                  </div>
                </div>
              </th>
            </tr>

            {/* Header Row 2: Calibration plan Issue Date */}
            <tr className="bg-[#FFFF00] border-b border-black text-[11px] leading-tight">
              <td colSpan={2} className="p-1 px-1.5 font-normal border-r border-black whitespace-nowrap text-left">
                Calibration plan Issue Date :
              </td>
              <td colSpan={2} className="p-1 px-1.5 border-r border-black text-left">
                <input
                  type="text"
                  value={headerInfo.issueDate}
                  onChange={(e) => updateHeader('issueDate', e.target.value)}
                  className="w-full bg-transparent font-medium focus:outline-none focus:bg-yellow-200"
                />
              </td>
              <td colSpan={9} className="p-1 bg-[#FFFF00]" />
            </tr>

            {/* Header Row 3: Calibration plan Issue No */}
            <tr className="bg-[#FFFF00] border-b border-black text-[11px] leading-tight">
              <td colSpan={2} className="p-1 px-1.5 font-normal border-r border-black whitespace-nowrap text-left">
                Calibration plan Issue No:
              </td>
              <td colSpan={2} className="p-1 px-1.5 border-r border-black text-left">
                <input
                  type="text"
                  value={headerInfo.issueNo}
                  onChange={(e) => updateHeader('issueNo', e.target.value)}
                  className="w-full bg-transparent font-medium focus:outline-none focus:bg-yellow-200"
                />
              </td>
              <td colSpan={9} className="p-1 bg-[#FFFF00]" />
            </tr>

            {/* Header Row 4: Revision Issue Date */}
            <tr className="bg-[#FFFF00] border-b border-black text-[11px] leading-tight">
              <td colSpan={2} className="p-1 px-1.5 font-normal border-r border-black whitespace-nowrap text-left">
                Revision Issue Date:
              </td>
              <td colSpan={2} className="p-1 px-1.5 border-r border-black text-left">
                <input
                  type="text"
                  value={headerInfo.revisionIssueDate}
                  onChange={(e) => updateHeader('revisionIssueDate', e.target.value)}
                  className="w-full bg-transparent font-medium focus:outline-none focus:bg-yellow-200"
                />
              </td>
              <td colSpan={9} className="p-1 bg-[#FFFF00]" />
            </tr>

            {/* Header Row 5: Name of Calibration Source */}
            <tr className="bg-[#FFFF00] border-b-2 border-black text-[11px] leading-tight">
              <td colSpan={2} className="p-1 px-1.5 font-normal border-r border-black whitespace-nowrap text-left">
                Name of Calibration Source :
              </td>
              <td colSpan={2} className="p-1 px-1.5 border-r border-black text-left">
                <input
                  type="text"
                  value={headerInfo.calibrationSource}
                  onChange={(e) => updateHeader('calibrationSource', e.target.value)}
                  className="w-full bg-transparent font-semibold focus:outline-none focus:bg-yellow-200"
                />
              </td>
              <td colSpan={9} className="p-1 bg-[#FFFF00]" />
            </tr>

            {/* ── 2. Light Blue Column Headers Row (RGB: 155, 194, 230 / #9BC2E6) ── */}
            <tr className="bg-[#9BC2E6] border-b border-black text-[11px] font-bold text-black text-left">
              <th className="p-1.5 border-r border-black text-center font-bold">S.no</th>
              <th className="p-1.5 border-r border-black font-bold">Instrument Name</th>
              <th className="p-1.5 border-r border-black font-bold">Identification no</th>
              <th className="p-1.5 border-r border-black font-bold">Make</th>
              <th className="p-1.5 border-r border-black font-bold">Location</th>
              <th className="p-1.5 border-r border-black font-bold">Least Count</th>
              <th className="p-1.5 border-r border-black font-bold">Range</th>
              <th className="p-1.5 border-r border-black font-bold text-center">Frequency</th>
              <th className="p-1.5 border-r border-black font-bold text-center">Due date</th>
              <th className="p-1.5 border-r border-black font-bold text-center">Done Date</th>
              <th className="p-1.5 border-r border-black font-bold text-center">Next Due Date</th>
              <th className="p-1.5 border-r border-black font-bold">Remark</th>
              <th className="p-1.5 font-bold">Responsibility</th>
            </tr>
          </thead>

          {/* ── 3. Data Grid Rows (Excel Spreadsheet Grid) ── */}
          <tbody className="divide-y divide-black/80 bg-white">
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-black min-h-[22px] hover:bg-slate-50/70">
                {/* S.no */}
                <td className="p-0 border-r border-black text-center text-[11px] font-medium text-slate-800 bg-white select-none">
                  {row.sNo}
                </td>

                {/* Instrument Name */}
                <td className="p-0 border-r border-black">
                  <input
                    type="text"
                    value={row.instrumentName}
                    onChange={(e) => updateRow(idx, 'instrumentName', e.target.value)}
                    className="w-full h-full px-1.5 py-0.5 bg-transparent text-[11px] font-normal text-black focus:outline-none"
                  />
                </td>

                {/* Identification no */}
                <td className="p-0 border-r border-black">
                  <input
                    type="text"
                    value={row.identificationNo}
                    onChange={(e) => updateRow(idx, 'identificationNo', e.target.value)}
                    className="w-full h-full px-1.5 py-0.5 bg-transparent text-[11px] font-normal text-black focus:outline-none"
                  />
                </td>

                {/* Make */}
                <td className="p-0 border-r border-black">
                  <input
                    type="text"
                    value={row.make}
                    onChange={(e) => updateRow(idx, 'make', e.target.value)}
                    className="w-full h-full px-1.5 py-0.5 bg-transparent text-[11px] font-normal text-black focus:outline-none"
                  />
                </td>

                {/* Location */}
                <td className="p-0 border-r border-black">
                  <input
                    type="text"
                    value={row.location}
                    onChange={(e) => updateRow(idx, 'location', e.target.value)}
                    className="w-full h-full px-1.5 py-0.5 bg-transparent text-[11px] font-normal text-black focus:outline-none"
                  />
                </td>

                {/* Least Count */}
                <td className="p-0 border-r border-black">
                  <input
                    type="text"
                    value={row.leastCount}
                    onChange={(e) => updateRow(idx, 'leastCount', e.target.value)}
                    className="w-full h-full px-1.5 py-0.5 bg-transparent text-[11px] font-normal text-black focus:outline-none"
                  />
                </td>

                {/* Range */}
                <td className="p-0 border-r border-black">
                  <input
                    type="text"
                    value={row.range}
                    onChange={(e) => updateRow(idx, 'range', e.target.value)}
                    className="w-full h-full px-1.5 py-0.5 bg-transparent text-[11px] font-normal text-black focus:outline-none"
                  />
                </td>

                {/* Frequency */}
                <td className="p-0 border-r border-black">
                  <input
                    type="text"
                    value={row.frequency}
                    onChange={(e) => updateRow(idx, 'frequency', e.target.value)}
                    className="w-full h-full px-1.5 py-0.5 bg-transparent text-[11px] font-normal text-black text-center focus:outline-none"
                  />
                </td>

                {/* Due date */}
                <td className="p-0 border-r border-black">
                  <input
                    type="text"
                    value={row.dueDate}
                    onChange={(e) => updateRow(idx, 'dueDate', e.target.value)}
                    className="w-full h-full px-1.5 py-0.5 bg-transparent text-[11px] font-normal text-black text-center focus:outline-none"
                  />
                </td>

                {/* Done Date */}
                <td className="p-0 border-r border-black">
                  <input
                    type="text"
                    value={row.doneDate}
                    onChange={(e) => updateRow(idx, 'doneDate', e.target.value)}
                    className="w-full h-full px-1.5 py-0.5 bg-transparent text-[11px] font-normal text-black text-center focus:outline-none"
                  />
                </td>

                {/* Next Due Date */}
                <td className="p-0 border-r border-black">
                  <input
                    type="text"
                    value={row.nextDueDate}
                    onChange={(e) => updateRow(idx, 'nextDueDate', e.target.value)}
                    className="w-full h-full px-1.5 py-0.5 bg-transparent text-[11px] font-normal text-black text-center focus:outline-none"
                  />
                </td>

                {/* Remark */}
                <td className="p-0 border-r border-black">
                  <input
                    type="text"
                    value={row.remark}
                    onChange={(e) => updateRow(idx, 'remark', e.target.value)}
                    className="w-full h-full px-1.5 py-0.5 bg-transparent text-[11px] font-normal text-black focus:outline-none"
                  />
                </td>

                {/* Responsibility */}
                <td className="p-0">
                  <input
                    type="text"
                    value={row.responsibility}
                    onChange={(e) => updateRow(idx, 'responsibility', e.target.value)}
                    className="w-full h-full px-1.5 py-0.5 bg-transparent text-[11px] font-normal text-black focus:outline-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Document Footer Signatures Section ── */}
        <div className="w-full min-w-[1440px] grid grid-cols-4 border-t-2 border-black bg-white text-[11px] font-bold divide-x-2 divide-black">
          {/* Column 1: Prepared By */}
          <div className="p-2 space-y-1">
            <div className="flex items-center">
              <span className="text-black mr-1 whitespace-nowrap">Prepared By:</span>
              <input
                type="text"
                value={footerInfo.preparedBy}
                onChange={(e) => setFooterInfo((prev) => ({ ...prev, preparedBy: e.target.value }))}
                className="bg-transparent font-bold focus:outline-none w-full"
              />
            </div>
            <div className="text-[10px] font-bold text-black">{headerInfo.docCode}</div>
          </div>

          {/* Column 2: Checked By */}
          <div className="p-2 space-y-1">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center min-w-0">
                <span className="text-black mr-1 shrink-0 whitespace-nowrap">Checked By :</span>
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
            <div className="text-[10px] font-bold text-black">REV :- {headerInfo.revNo}</div>
          </div>

          {/* Column 3: Reviewed By */}
          <div className="p-2 space-y-1">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center min-w-0">
                <span className="text-black mr-1 shrink-0 whitespace-nowrap">Reviewed By:</span>
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
            <div className="text-[10px] font-bold text-black">REV DATE:- {headerInfo.revDate}</div>
          </div>

          {/* Column 4: Approved By */}
          <div className="p-2 space-y-1">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center min-w-0">
                <span className="text-black mr-1 shrink-0 whitespace-nowrap">Approved By:</span>
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
            <div className="text-[10px] font-bold text-black">ISSUE DATE {headerInfo.issueDate}</div>
          </div>
        </div>

        {/* Hidden button to trigger save */}
        <button id="cal-checksheet-save-btn" type="button" onClick={handleSave} className="hidden" />
      </div>
    </div>
  );
}
