import React, { useState } from 'react';
import { Check } from 'lucide-react';
import SignatureApprovalControl from './SignatureApprovalControl';

export default function InstrumentScrapReportChecksheet({ document = {}, onSave = () => {} }) {
  const storageKey = `cal_checksheet_${document.id || 'DOC-CAL-08'}`;

  // Top Section Info
  const [headerInfo, setHeaderInfo] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_header`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      reportNo: '',
      date: new Date().toISOString().slice(0, 10),
      sectionDepartment: document.department ? `${document.department}${document.section ? ' / ' + document.section : ''}` : '',
      instrumentName: '',
      controlNumber: ''
    };
  });

  // Middle Section (Reason for Scraping & Calibration report attachment)
  const [scrapInfo, setScrapInfo] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_scrap`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      reasonForScraping: '',
      reportAttachedOrNot: ''
    };
  });

  // Signatures Block (Prepared by, Reviewed By Lab Incharge, Approved By QA Head)
  const [signatures, setSignatures] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_sigs`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      preparedBySign: '',
      preparedByDate: '',
      reviewedBySign: '',
      reviewedByDate: '',
      approvedBySign: '',
      approvedByDate: ''
    };
  });

  // Footer Metadata
  const [footerInfo, setFooterInfo] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_footer`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      docCode: 'FRM-WH-QA-098',
      revNo: 'Rev. No.02',
      revDate: 'Rev. Date: 08.03.19',
      pageInfo: 'Page: 1 of 1'
    };
  });

  const [saveToast, setSaveToast] = useState(false);

  const updateHeader = (field, val) => {
    setHeaderInfo((prev) => ({ ...prev, [field]: val }));
  };

  const updateScrap = (field, val) => {
    setScrapInfo((prev) => ({ ...prev, [field]: val }));
  };

  const updateSig = (field, val) => {
    setSignatures((prev) => ({ ...prev, [field]: val }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem(`${storageKey}_header`, JSON.stringify(headerInfo));
      localStorage.setItem(`${storageKey}_scrap`, JSON.stringify(scrapInfo));
      localStorage.setItem(`${storageKey}_sigs`, JSON.stringify(signatures));
      localStorage.setItem(`${storageKey}_footer`, JSON.stringify(footerInfo));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
    onSave({ headerInfo, scrapInfo, signatures, footerInfo });
  };

  return (
    <div className="w-full flex flex-col items-center pb-12 select-text">
      {saveToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Checksheet saved successfully!</span>
        </div>
      )}

      {/* ── Checksheet Canvas (Exact replica of image) ── */}
      <div className="w-[950px] max-w-[950px] shrink-0 bg-white border-2 border-black shadow-md text-black font-sans text-xs">
        {/* Top-Right Company Banner */}
        <div className="w-full min-w-[780px] flex justify-end p-1 px-3 bg-white font-bold text-xs sm:text-sm">
          <span>FURUKAWA MINDA ELECTRIC PVT. LTD.</span>
        </div>

        {/* Report Title */}
        <div className="w-full min-w-[780px] border-t-2 border-b-2 border-black p-2.5 text-center font-bold text-base sm:text-lg tracking-wide bg-white">
          INSTRUMENT SCRAP REPORT
        </div>

        {/* ── Section 1: Header / Instrument Identification ── */}
        <div className="w-full min-w-[780px] border-b-2 border-black p-3 px-4 bg-white text-[11px]">
          {/* Top-Right: REPORT NO. & DATE */}
          <div className="flex justify-end mb-2">
            <div className="w-56 space-y-1">
              <div className="flex items-center">
                <span className="font-bold whitespace-nowrap mr-2">REPORT NO. :</span>
                <input
                  type="text"
                  value={headerInfo.reportNo}
                  onChange={(e) => updateHeader('reportNo', e.target.value)}
                  className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium"
                />
              </div>
              <div className="flex items-center">
                <span className="font-bold whitespace-nowrap mr-2">DATE :</span>
                <input
                  type="date"
                  value={headerInfo.date}
                  onChange={(e) => updateHeader('date', e.target.value)}
                  className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium"
                />
              </div>
            </div>
          </div>

          {/* Left Fields: 1. SECTION / DEPARTMENT, 2. INSTRUMENT NAME, 3. CONTROL NUMBER */}
          <div className="space-y-3">
            {/* Field 1 */}
            <div className="flex items-center">
              <span className="font-bold whitespace-nowrap mr-2">1. SECTION / DEPARTMENT :-</span>
              <input
                type="text"
                value={headerInfo.sectionDepartment}
                onChange={(e) => updateHeader('sectionDepartment', e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium"
              />
            </div>

            {/* Field 2 */}
            <div className="flex items-center">
              <span className="font-bold whitespace-nowrap mr-2">2. INSTRUMENT NAME :-</span>
              <input
                type="text"
                value={headerInfo.instrumentName}
                onChange={(e) => updateHeader('instrumentName', e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium"
              />
            </div>

            {/* Field 3 */}
            <div className="flex items-center">
              <span className="font-bold whitespace-nowrap mr-2">3. CONTROL NUMBER :-</span>
              <input
                type="text"
                value={headerInfo.controlNumber}
                onChange={(e) => updateHeader('controlNumber', e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium"
              />
            </div>
          </div>
        </div>

        {/* ── Section 2: Reason For Scraping (Large Textarea Area) ── */}
        <div className="w-full min-w-[780px] border-b-2 border-black p-3.5 px-4 bg-white text-[11px] flex flex-col justify-between min-h-[240px]">
          <div>
            {/* Header: Underlined REASON FOR SCRAPING :- */}
            <div className="mb-2">
              <span className="font-bold underline text-xs">REASON FOR SCRAPING :-</span>
            </div>

            {/* Large Textarea for Reason */}
            <textarea
              rows={7}
              value={scrapInfo.reasonForScraping}
              onChange={(e) => updateScrap('reasonForScraping', e.target.value)}
              className="w-full bg-transparent resize-y border-none focus:outline-none text-[11px] leading-relaxed font-normal"
            />
          </div>

          {/* Bottom of Middle Section: Calibration & dimension report attaced or not: */}
          <div className="flex items-center pt-4">
            <span className="font-normal whitespace-nowrap mr-2">
              Calibration & dimension report attaced or not:
            </span>
            <input
              type="text"
              value={scrapInfo.reportAttachedOrNot}
              onChange={(e) => updateScrap('reportAttachedOrNot', e.target.value)}
              className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium"
            />
          </div>
        </div>

        {/* ── Section 3: Signature Block (3 Signatories) ── */}
        <div className="w-full min-w-[780px] border-b-2 border-black p-3 px-4 grid grid-cols-3 gap-6 bg-white text-[11px]">
          {/* Signatory 1: Prepared by */}
          <div className="space-y-1.5 flex flex-col justify-between min-h-[75px]">
            <div className="font-bold">Prepared by</div>
            <div className="space-y-1">
              <div className="flex items-center">
                <span className="font-bold whitespace-nowrap mr-2">Sign :-</span>
                <input
                  type="text"
                  value={signatures.preparedBySign}
                  onChange={(e) => updateSig('preparedBySign', e.target.value)}
                  className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium"
                />
              </div>
              <div className="flex items-center">
                <span className="font-bold whitespace-nowrap mr-2">Date :-</span>
                <input
                  type="text"
                  value={signatures.preparedByDate}
                  onChange={(e) => updateSig('preparedByDate', e.target.value)}
                  className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium"
                />
              </div>
            </div>
          </div>

          {/* Signatory 2: Reviewed By Lab Incharge: */}
          <div className="space-y-1.5 flex flex-col justify-between min-h-[75px]">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div>
                <div className="font-bold">Reviewed By</div>
                <div className="font-bold">Lab Incharge:</div>
              </div>
              <SignatureApprovalControl
                status={signatures.reviewedBy_status || 'pending'}
                onApprove={() => updateSig('reviewedBy_status', 'approved')}
                onReject={() => updateSig('reviewedBy_status', 'rejected')}
                onReset={() => updateSig('reviewedBy_status', 'pending')}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center">
                <span className="font-bold whitespace-nowrap mr-2">Sign :-</span>
                <input
                  type="text"
                  value={signatures.reviewedBySign}
                  onChange={(e) => updateSig('reviewedBySign', e.target.value)}
                  className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium"
                />
              </div>
              <div className="flex items-center">
                <span className="font-bold whitespace-nowrap mr-2">Date :-</span>
                <input
                  type="text"
                  value={signatures.reviewedByDate}
                  onChange={(e) => updateSig('reviewedByDate', e.target.value)}
                  className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium"
                />
              </div>
            </div>
          </div>

          {/* Signatory 3: Approved By QA Head: */}
          <div className="space-y-1.5 flex flex-col justify-between min-h-[75px]">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div>
                <div className="font-bold">Approved By</div>
                <div className="font-bold">QA Head:</div>
              </div>
              <SignatureApprovalControl
                status={signatures.approvedBy_status || 'pending'}
                onApprove={() => updateSig('approvedBy_status', 'approved')}
                onReject={() => updateSig('approvedBy_status', 'rejected')}
                onReset={() => updateSig('approvedBy_status', 'pending')}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center">
                <span className="font-bold whitespace-nowrap mr-2">Sign :-</span>
                <input
                  type="text"
                  value={signatures.approvedBySign}
                  onChange={(e) => updateSig('approvedBySign', e.target.value)}
                  className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium"
                />
              </div>
              <div className="flex items-center">
                <span className="font-bold whitespace-nowrap mr-2">Date :-</span>
                <input
                  type="text"
                  value={signatures.approvedByDate}
                  onChange={(e) => updateSig('approvedByDate', e.target.value)}
                  className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 4: Footer Metadata Row ── */}
        <div className="w-full min-w-[780px] grid grid-cols-12 bg-white text-[10px] font-bold p-1 px-3">
          <div className="col-span-3 text-left">
            {footerInfo.docCode}
          </div>
          <div className="col-span-3 text-center">
            {footerInfo.revNo}
          </div>
          <div className="col-span-3 text-center">
            {footerInfo.revDate}
          </div>
          <div className="col-span-3 text-right">
            {footerInfo.pageInfo}
          </div>
        </div>

        {/* Hidden button to allow external save trigger */}
        <button id="cal-checksheet-save-btn" type="button" onClick={handleSave} className="hidden" />
      </div>
    </div>
  );
}
