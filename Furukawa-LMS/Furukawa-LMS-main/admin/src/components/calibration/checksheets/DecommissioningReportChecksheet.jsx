import React, { useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import SignatureApprovalControl from './SignatureApprovalControl';

const INITIAL_TABLE1_ROWS = 5;
const INITIAL_TABLE2_ROWS = 6;

export default function DecommissioningReportChecksheet({ document = {}, onSave = () => {} }) {
  const storageKey = `cal_checksheet_${document.id || 'DOC-CAL-07'}`;

  // 1. Top Header Info
  const [headerInfo, setHeaderInfo] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_header`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      from: 'QA LAB',
      to: 'USER DEPTT HEAD',
      location: document.section || '',
      machineNo: '',
      date: new Date().toISOString().slice(0, 10)
    };
  });

  // 2. Table 1: Instruments / Gauges Found Out of Calibration
  const [table1Rows, setTable1Rows] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_table1`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return Array.from({ length: INITIAL_TABLE1_ROWS }, (_, i) => ({
      sNo: i + 1,
      instrumentGaugeNo: '',
      description: '',
      deptt: '',
      whetherRepairable: ''
    }));
  });

  // 3. Middle Signatures (PRD & Quality)
  const [signatures1, setSignatures1] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_sig1`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      shiftInchargePrd: '',
      hodPrd: '',
      shiftInchargeQuality: '',
      hodQuality: ''
    };
  });

  // 4. Table 2: Post-decommissioning Inspection & Action Taken
  const [table2Rows, setTable2Rows] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_table2`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return Array.from({ length: INITIAL_TABLE2_ROWS }, (_, i) => ({
      sNo: i + 1,
      descriptionOfParts: '',
      whetherDiscrepancy: '',
      actionTaken: ''
    }));
  });

  // 5. Bottom Signatures & Footer Metadata
  const [bottomSignatures, setBottomSignatures] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_sig2`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      qaLabEngineer: '',
      qaLabIncharge: ''
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
      docCode: 'FRM-WH-QA-124',
      revNo: 'Rev: 03',
      revDate: 'Rev Date: 12.03.2024',
      pageInfo: 'Page: 1 of 1'
    };
  });

  const [saveToast, setSaveToast] = useState(false);

  const updateHeader = (field, val) => {
    setHeaderInfo((prev) => ({ ...prev, [field]: val }));
  };

  const updateTable1 = (index, field, val) => {
    setTable1Rows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const updateTable2 = (index, field, val) => {
    setTable2Rows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const updateSig1 = (field, val) => {
    setSignatures1((prev) => ({ ...prev, [field]: val }));
  };

  const updateSig2 = (field, val) => {
    setBottomSignatures((prev) => ({ ...prev, [field]: val }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem(`${storageKey}_header`, JSON.stringify(headerInfo));
      localStorage.setItem(`${storageKey}_table1`, JSON.stringify(table1Rows));
      localStorage.setItem(`${storageKey}_sig1`, JSON.stringify(signatures1));
      localStorage.setItem(`${storageKey}_table2`, JSON.stringify(table2Rows));
      localStorage.setItem(`${storageKey}_sig2`, JSON.stringify(bottomSignatures));
      localStorage.setItem(`${storageKey}_footer`, JSON.stringify(footerInfo));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
    onSave({ headerInfo, table1Rows, signatures1, table2Rows, bottomSignatures, footerInfo });
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
      <div className="w-[1100px] max-w-[1100px] shrink-0 bg-white border-2 border-black shadow-md text-black font-sans text-xs">
        {/* Top-Right Company Banner */}
        <div className="w-full min-w-[900px] flex justify-end p-1 px-3 bg-white font-bold text-xs sm:text-sm">
          <span>FURUKAWA MINDA ELECTRIC PVT. LTD.</span>
        </div>

        {/* Report Title */}
        <div className="w-full min-w-[900px] border-t-2 border-b-2 border-black p-2 text-center font-bold text-sm sm:text-base tracking-wide bg-white">
          INSTRUMENT / GAUGE DECOMMISSIONING REPORT
        </div>

        {/* ── 1. Header Information Block (2 Rows) ── */}
        <div className="w-full min-w-[900px] border-b-2 border-black divide-y divide-black text-[11px]">
          {/* Row 1: FROM : QA LAB | Location | DATE : */}
          <div className="grid grid-cols-12 min-h-[32px] divide-x divide-black">
            {/* FROM */}
            <div className="col-span-3 p-1.5 flex items-center font-bold">
              <span className="mr-1 whitespace-nowrap">FROM :</span>
              <input
                type="text"
                value={headerInfo.from}
                onChange={(e) => updateHeader('from', e.target.value)}
                className="w-full bg-transparent font-bold focus:outline-none"
              />
            </div>
            {/* Location Label */}
            <div className="col-span-2 p-1.5 flex items-center font-normal">
              Location
            </div>
            {/* Location Value */}
            <div className="col-span-4 p-1 flex items-center">
              <input
                type="text"
                value={headerInfo.location}
                onChange={(e) => updateHeader('location', e.target.value)}
                className="w-full bg-transparent font-medium focus:outline-none"
              />
            </div>
            {/* DATE */}
            <div className="col-span-3 p-1.5 flex items-center font-bold">
              <span className="mr-1 whitespace-nowrap">DATE :</span>
              <input
                type="date"
                value={headerInfo.date}
                onChange={(e) => updateHeader('date', e.target.value)}
                className="w-full bg-transparent font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* Row 2: TO : USER DEPTT HEAD | Machine No. */}
          <div className="grid grid-cols-12 min-h-[32px] divide-x divide-black">
            {/* TO */}
            <div className="col-span-3 p-1.5 flex items-center font-bold">
              <span className="mr-1 whitespace-nowrap">TO :</span>
              <input
                type="text"
                value={headerInfo.to}
                onChange={(e) => updateHeader('to', e.target.value)}
                className="w-full bg-transparent font-bold focus:outline-none"
              />
            </div>
            {/* Machine No. Label */}
            <div className="col-span-2 p-1.5 flex items-center font-normal">
              Machine No.
            </div>
            {/* Machine No. Value */}
            <div className="col-span-7 p-1 flex items-center">
              <input
                type="text"
                value={headerInfo.machineNo}
                onChange={(e) => updateHeader('machineNo', e.target.value)}
                className="w-full bg-transparent font-medium focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ── 2. Notice Text 1 ── */}
        <div className="w-full min-w-[900px] p-2 text-[11px] font-normal border-b-2 border-black bg-white">
          Please note that following instruments/Gauges are found out of calibration as laid standards.
        </div>

        {/* ── 3. Table 1: Instruments / Gauges Found Out of Calibration ── */}
        <div className="w-full min-w-[900px] border-b-2 border-black">
          <table className="w-full border-collapse text-[11px] table-fixed">
            <colgroup>
              <col style={{ width: '60px' }} />
              <col style={{ width: '200px' }} />
              <col style={{ width: '290px' }} />
              <col style={{ width: '190px' }} />
              <col style={{ width: '160px' }} />
            </colgroup>
            <thead>
              <tr className="border-b-2 border-black text-center font-bold bg-white leading-tight">
                <th className="p-2 border-r border-black align-middle font-bold">S.No.</th>
                <th className="p-2 border-r border-black align-middle font-bold">Instrument/gauge<br />No</th>
                <th className="p-2 border-r border-black align-middle font-bold">Description</th>
                <th className="p-2 border-r border-black align-middle font-bold">Deptt.</th>
                <th className="p-2 align-middle font-bold">Whether<br />Repairable<br />[ Yes / No ]</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/70 bg-white">
              {table1Rows.map((row, idx) => (
                <tr key={idx} className="border-b border-black min-h-[36px] hover:bg-slate-50/50">
                  <td className="p-1 border-r border-black text-center font-medium select-none">
                    {row.sNo}
                  </td>
                  <td className="p-1 border-r border-black">
                    <input
                      type="text"
                      value={row.instrumentGaugeNo}
                      onChange={(e) => updateTable1(idx, 'instrumentGaugeNo', e.target.value)}
                      className="w-full bg-transparent focus:outline-none px-1"
                    />
                  </td>
                  <td className="p-1 border-r border-black">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) => updateTable1(idx, 'description', e.target.value)}
                      className="w-full bg-transparent focus:outline-none px-1"
                    />
                  </td>
                  <td className="p-1 border-r border-black">
                    <input
                      type="text"
                      value={row.deptt}
                      onChange={(e) => updateTable1(idx, 'deptt', e.target.value)}
                      className="w-full bg-transparent focus:outline-none px-1"
                    />
                  </td>
                  <td className="p-1 text-center">
                    <input
                      type="text"
                      value={row.whetherRepairable}
                      onChange={(e) => updateTable1(idx, 'whetherRepairable', e.target.value)}
                      className="w-full text-center bg-transparent focus:outline-none px-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 4. Notice Text 2 ── */}
        <div className="w-full min-w-[900px] p-2 text-[11px] font-normal border-b-2 border-black bg-white leading-normal">
          Please check the validity of inspection done with above instrument/gauge after decommissioning & fill -up the details in the following table & return to calibration deptt. Incase of discrepancies found get more lot checked
        </div>

        {/* ── 5. Signatures Block 1 (4 Signatures) ── */}
        <div className="w-full min-w-[900px] grid grid-cols-4 border-b-2 border-black divide-x divide-black text-[11px] bg-white">
          {/* Shift Incharge (PRD) */}
          <div className="p-2 space-y-1 min-h-[55px] flex flex-col justify-between">
            <div className="flex items-center">
              <span className="font-bold mr-1">Sign:</span>
              <input
                type="text"
                value={signatures1.shiftInchargePrd}
                onChange={(e) => updateSig1('shiftInchargePrd', e.target.value)}
                className="w-full bg-transparent font-medium focus:outline-none text-[11px]"
              />
            </div>
            <div className="font-bold">Shift Incharge (PRD)</div>
          </div>

          {/* HOD (PRD) */}
          <div className="p-2 space-y-1 min-h-[55px] flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center min-w-0">
                <span className="font-bold mr-1 shrink-0">Sign:</span>
                <input
                  type="text"
                  value={signatures1.hodPrd}
                  onChange={(e) => updateSig1('hodPrd', e.target.value)}
                  className="w-20 bg-transparent font-medium focus:outline-none text-[11px]"
                />
              </div>
              <SignatureApprovalControl
                status={signatures1.hodPrd_status || 'pending'}
                onApprove={() => updateSig1('hodPrd_status', 'approved')}
                onReject={() => updateSig1('hodPrd_status', 'rejected')}
                onReset={() => updateSig1('hodPrd_status', 'pending')}
              />
            </div>
            <div className="font-bold">HOD (PRD)</div>
          </div>

          {/* Shift Incharge (Quality) */}
          <div className="p-2 space-y-1 min-h-[55px] flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center min-w-0">
                <span className="font-bold mr-1 shrink-0">Sign:</span>
                <input
                  type="text"
                  value={signatures1.shiftInchargeQuality}
                  onChange={(e) => updateSig1('shiftInchargeQuality', e.target.value)}
                  className="w-20 bg-transparent font-medium focus:outline-none text-[11px]"
                />
              </div>
              <SignatureApprovalControl
                status={signatures1.shiftInchargeQuality_status || 'pending'}
                onApprove={() => updateSig1('shiftInchargeQuality_status', 'approved')}
                onReject={() => updateSig1('shiftInchargeQuality_status', 'rejected')}
                onReset={() => updateSig1('shiftInchargeQuality_status', 'pending')}
              />
            </div>
            <div className="font-bold">Shift Incharge (Quality)</div>
          </div>

          {/* HOD (Quality) */}
          <div className="p-2 space-y-1 min-h-[55px] flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center min-w-0">
                <span className="font-bold mr-1 shrink-0">Sign:</span>
                <input
                  type="text"
                  value={signatures1.hodQuality}
                  onChange={(e) => updateSig1('hodQuality', e.target.value)}
                  className="w-20 bg-transparent font-medium focus:outline-none text-[11px]"
                />
              </div>
              <SignatureApprovalControl
                status={signatures1.hodQuality_status || 'pending'}
                onApprove={() => updateSig1('hodQuality_status', 'approved')}
                onReject={() => updateSig1('hodQuality_status', 'rejected')}
                onReset={() => updateSig1('hodQuality_status', 'pending')}
              />
            </div>
            <div className="font-bold">HOD (Quality)</div>
          </div>
        </div>

        {/* ── 6. Table 2: Post-decommissioning Inspection & Action Taken ── */}
        <div className="w-full min-w-[900px] border-b-2 border-black">
          <table className="w-full border-collapse text-[11px] table-fixed">
            <colgroup>
              <col style={{ width: '65px' }} />
              <col style={{ width: '370px' }} />
              <col style={{ width: '155px' }} />
              <col style={{ width: '310px' }} />
            </colgroup>
            <thead>
              <tr className="border-b-2 border-black text-center font-bold bg-white leading-tight">
                <th className="p-2 border-r border-black align-middle font-bold">S.NO<br />-</th>
                <th className="p-2 border-r border-black align-middle font-bold">DESCRIPTION OF<br />PARTS/TOOLS/FIXTURES<br />INSPECTED</th>
                <th className="p-2 border-r border-black align-middle font-bold">WHETHER<br />ANY<br />DISCREPANC<br />Y OBSERVED</th>
                <th className="p-2 align-middle font-bold">IF YES, ACTION TAKEN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/70 bg-white">
              {table2Rows.map((row, idx) => (
                <tr key={idx} className="border-b border-black min-h-[36px] hover:bg-slate-50/50">
                  <td className="p-1 border-r border-black text-center font-medium select-none">
                    {row.sNo}
                  </td>
                  <td className="p-1 border-r border-black">
                    <input
                      type="text"
                      value={row.descriptionOfParts}
                      onChange={(e) => updateTable2(idx, 'descriptionOfParts', e.target.value)}
                      className="w-full bg-transparent focus:outline-none px-1"
                    />
                  </td>
                  <td className="p-1 border-r border-black text-center">
                    <input
                      type="text"
                      value={row.whetherDiscrepancy}
                      onChange={(e) => updateTable2(idx, 'whetherDiscrepancy', e.target.value)}
                      className="w-full text-center bg-transparent focus:outline-none px-1"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      value={row.actionTaken}
                      onChange={(e) => updateTable2(idx, 'actionTaken', e.target.value)}
                      className="w-full bg-transparent focus:outline-none px-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 7. Bottom Signatures Row 2 ── */}
        <div className="w-full min-w-[900px] border-b-2 border-black p-3 px-6 flex items-center justify-between bg-white text-[11px] font-bold">
          <div className="flex items-center gap-2">
            <span>QA Lab Engineer:</span>
            <input
              type="text"
              value={bottomSignatures.qaLabEngineer}
              onChange={(e) => updateSig2('qaLabEngineer', e.target.value)}
              className="bg-transparent font-medium border-b border-black/40 focus:outline-none px-1 min-w-[140px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span>QA Lab Incharge:</span>
            <input
              type="text"
              value={bottomSignatures.qaLabIncharge}
              onChange={(e) => updateSig2('qaLabIncharge', e.target.value)}
              className="bg-transparent font-medium border-b border-black/40 focus:outline-none px-1 min-w-[140px]"
            />
            <SignatureApprovalControl
              status={bottomSignatures.qaLabIncharge_status || 'pending'}
              onApprove={() => updateSig2('qaLabIncharge_status', 'approved')}
              onReject={() => updateSig2('qaLabIncharge_status', 'rejected')}
              onReset={() => updateSig2('qaLabIncharge_status', 'pending')}
            />
          </div>
        </div>

        {/* ── 8. Process Flow Block & Footer Metadata ── */}
        <div className="w-full min-w-[900px] bg-white text-[11px]">
          {/* Process Flow Diagram */}
          <div className="p-2.5 px-4 flex flex-wrap items-center gap-3 border-b border-black">
            <span className="font-bold text-xs whitespace-nowrap">Process Flow:</span>
            <div className="flex flex-wrap items-center gap-2 font-semibold text-[10px]">
              {/* Box 1 */}
              <div className="border border-black px-3 py-1.5 bg-white text-center">
                QA LAB Deptt.
              </div>
              <ArrowRight className="w-4 h-4 text-black stroke-[2]" />

              {/* Box 2 */}
              <div className="border border-black px-3 py-1.5 bg-white text-center">
                User Deptt.
              </div>
              <ArrowRight className="w-4 h-4 text-black stroke-[2]" />

              {/* Box 3 */}
              <div className="border border-black px-3 py-1 bg-white text-center leading-tight">
                Head QA<br />(for approval)
              </div>
              <ArrowRight className="w-4 h-4 text-black stroke-[2]" />

              {/* Box 4 */}
              <div className="border border-black px-3 py-1.5 bg-white text-center">
                QA LAB Deptt.
              </div>
            </div>
          </div>

          {/* Footer Metadata Row */}
          <div className="grid grid-cols-12 text-[10px] font-bold p-1 px-3">
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
        </div>

        {/* Hidden button to allow external save trigger */}
        <button id="cal-checksheet-save-btn" type="button" onClick={handleSave} className="hidden" />
      </div>
    </div>
  );
}
