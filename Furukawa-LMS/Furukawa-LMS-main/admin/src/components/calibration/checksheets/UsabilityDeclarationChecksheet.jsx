import React, { useState } from 'react';
import { Check } from 'lucide-react';

const INITIAL_ROWS = 6;

export default function UsabilityDeclarationChecksheet({ document = {}, onSave = () => {} }) {
  const storageKey = `cal_checksheet_${document.id || 'DOC-CAL-09'}`;

  // Top Month state
  const [month, setMonth] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_month`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  });

  // Table rows (10 columns matching screenshot exactly)
  const [rows, setRows] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_rows`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return Array.from({ length: INITIAL_ROWS }, (_, i) => ({
      sn: i + 1,
      instrumentName: '',
      instrumentIdNumber: '',
      instrumentLocation: document.section || '',
      instrumentUsableCondition: '',
      availabilitiesCalibrationSticker: '',
      dueDateOfCalibration: '',
      reasonIfNotUsable: '',
      isInformationGivenToLab: '',
      informationToLabGivenDate: ''
    }));
  });

  // Signatures below table
  const [signatures, setSignatures] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_sigs`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      signAreaInCharge: '',
      signDeptHead: ''
    };
  });

  // Footer metadata
  const [footerInfo, setFooterInfo] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_footer`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      docCode: 'FRM-WH-QA-208',
      revNo: 'Rev: 01',
      issueDate: 'Issue Date: 01.08.23',
      pageInfo: 'Page: 1 of 1'
    };
  });

  const [saveToast, setSaveToast] = useState(false);

  const updateRow = (index, field, val) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const updateSignature = (field, val) => {
    setSignatures((prev) => ({ ...prev, [field]: val }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem(`${storageKey}_month`, JSON.stringify(month));
      localStorage.setItem(`${storageKey}_rows`, JSON.stringify(rows));
      localStorage.setItem(`${storageKey}_sigs`, JSON.stringify(signatures));
      localStorage.setItem(`${storageKey}_footer`, JSON.stringify(footerInfo));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
    onSave({ month, rows, signatures, footerInfo });
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
      <div className="w-full max-w-[1300px] bg-white border-2 border-black shadow-md overflow-x-auto text-black font-sans text-xs">
        {/* Table Structure */}
        <table className="w-full border-collapse text-[11px] table-fixed min-w-[1150px]">
          <colgroup>
            {/* Col 1: S.N. */}
            <col style={{ width: '4%' }} />
            {/* Col 2: Instrument Name */}
            <col style={{ width: '14.5%' }} />
            {/* Col 3: Instrument ID number */}
            <col style={{ width: '10.5%' }} />
            {/* Col 4: Instrument Location */}
            <col style={{ width: '13%' }} />
            {/* Col 5: Instrument under usable condition (Y/N) */}
            <col style={{ width: '8.5%' }} />
            {/* Col 6: Availibities of Calibration sticker on instruments (Y/N) */}
            <col style={{ width: '9%' }} />
            {/* Col 7: due date of calibration */}
            <col style={{ width: '11.5%' }} />
            {/* Col 8: If inst. not usable condition/ Calibration sticker not available (write the reason) */}
            <col style={{ width: '11.5%' }} />
            {/* Col 9: Is Information given to lab? (Y/N) */}
            <col style={{ width: '8.5%' }} />
            {/* Col 10: Information to lab given date */}
            <col style={{ width: '9%' }} />
          </colgroup>

          {/* ── Top Header Rows ── */}
          <thead>
            {/* Row 1: Title (Declaration for instrument usable condition(STORE)) + Month Block */}
            <tr className="border-b-2 border-black bg-white">
              <th
                colSpan={8}
                className="p-2 text-center font-bold text-xs sm:text-sm border-r-2 border-black tracking-wide align-middle"
              >
                Declaration for instrument usable condition(STORE)
              </th>
              <th className="p-2 text-center font-bold text-xs border-r border-black align-middle">
                Month
              </th>
              <th className="p-1 text-center font-bold text-xs align-middle">
                <input
                  type="text"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full text-center bg-transparent border-none font-bold focus:outline-none text-xs"
                />
              </th>
            </tr>

            {/* Row 2: 10 Main Column Headers */}
            <tr className="border-b-2 border-black text-center font-normal bg-white leading-tight">
              <th className="p-2 border-r border-black align-middle font-normal">S.N.</th>
              <th className="p-2 border-r border-black align-middle font-normal">Instrument Name</th>
              <th className="p-2 border-r border-black align-middle font-normal">Instrument ID number</th>
              <th className="p-2 border-r border-black align-middle font-normal">Instrument Location</th>
              <th className="p-2 border-r border-black align-middle font-normal">
                Instrument under<br />usable condition<br />(Y/N)
              </th>
              <th className="p-2 border-r border-black align-middle font-normal">
                Availibities of<br />Calibration<br />sticker on<br />instruments (Y/N)
              </th>
              <th className="p-2 border-r border-black align-middle font-normal">due date of calibration</th>
              <th className="p-2 border-r border-black align-middle font-normal">
                If inst. not usable<br />condition/ Calibration<br />sticker not available<br />(write the reason)
              </th>
              <th className="p-2 border-r border-black align-middle font-normal">
                Is Information<br />given to lab? (Y/N)
              </th>
              <th className="p-2 align-middle font-normal">
                Information to<br />lab given date
              </th>
            </tr>
          </thead>

          {/* ── Table Body Rows ── */}
          <tbody className="bg-white divide-y divide-black">
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-black min-h-[58px] hover:bg-slate-50/40">
                {/* 1. S.N. */}
                <td className="p-2 border-r border-black text-center font-medium select-none align-middle">
                  {row.sn}
                </td>

                {/* 2. Instrument Name */}
                <td className="p-2 border-r border-black align-middle">
                  <textarea
                    rows={2}
                    value={row.instrumentName}
                    onChange={(e) => updateRow(idx, 'instrumentName', e.target.value)}
                    className="w-full bg-transparent border-none resize-none focus:outline-none text-[11px] leading-tight"
                  />
                </td>

                {/* 3. Instrument ID number */}
                <td className="p-2 border-r border-black align-middle text-center">
                  <input
                    type="text"
                    value={row.instrumentIdNumber}
                    onChange={(e) => updateRow(idx, 'instrumentIdNumber', e.target.value)}
                    className="w-full text-center bg-transparent border-none focus:outline-none text-[11px]"
                  />
                </td>

                {/* 4. Instrument Location */}
                <td className="p-2 border-r border-black align-middle">
                  <input
                    type="text"
                    value={row.instrumentLocation}
                    onChange={(e) => updateRow(idx, 'instrumentLocation', e.target.value)}
                    className="w-full bg-transparent border-none focus:outline-none text-[11px]"
                  />
                </td>

                {/* 5. Instrument under usable condition (Y/N) */}
                <td className="p-2 border-r border-black align-middle text-center">
                  <input
                    type="text"
                    value={row.instrumentUsableCondition}
                    onChange={(e) => updateRow(idx, 'instrumentUsableCondition', e.target.value)}
                    className="w-full text-center bg-transparent border-none focus:outline-none text-[11px]"
                  />
                </td>

                {/* 6. Availibities of Calibration sticker on instruments (Y/N) */}
                <td className="p-2 border-r border-black align-middle text-center">
                  <input
                    type="text"
                    value={row.availabilitiesCalibrationSticker}
                    onChange={(e) => updateRow(idx, 'availabilitiesCalibrationSticker', e.target.value)}
                    className="w-full text-center bg-transparent border-none focus:outline-none text-[11px]"
                  />
                </td>

                {/* 7. due date of calibration */}
                <td className="p-2 border-r border-black align-middle text-center">
                  <input
                    type="date"
                    value={row.dueDateOfCalibration}
                    onChange={(e) => updateRow(idx, 'dueDateOfCalibration', e.target.value)}
                    className="w-full text-center bg-transparent border-none focus:outline-none text-[11px]"
                  />
                </td>

                {/* 8. If inst. not usable condition/ Calibration sticker not available (write the reason) */}
                <td className="p-2 border-r border-black align-middle">
                  <textarea
                    rows={2}
                    value={row.reasonIfNotUsable}
                    onChange={(e) => updateRow(idx, 'reasonIfNotUsable', e.target.value)}
                    className="w-full bg-transparent border-none resize-none focus:outline-none text-[11px] leading-tight"
                  />
                </td>

                {/* 9. Is Information given to lab? (Y/N) */}
                <td className="p-2 border-r border-black align-middle text-center">
                  <input
                    type="text"
                    value={row.isInformationGivenToLab}
                    onChange={(e) => updateRow(idx, 'isInformationGivenToLab', e.target.value)}
                    className="w-full text-center bg-transparent border-none focus:outline-none text-[11px]"
                  />
                </td>

                {/* 10. Information to lab given date */}
                <td className="p-2 align-middle text-center">
                  <input
                    type="date"
                    value={row.informationToLabGivenDate}
                    onChange={(e) => updateRow(idx, 'informationToLabGivenDate', e.target.value)}
                    className="w-full text-center bg-transparent border-none focus:outline-none text-[11px]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Signatures Row Below Table ── */}
        <div className="w-full min-w-[1150px] border-t-2 border-b-2 border-black p-2 px-6 flex items-center justify-between bg-white text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-normal">Sign of area in-charge</span>
            <input
              type="text"
              value={signatures.signAreaInCharge}
              onChange={(e) => updateSignature('signAreaInCharge', e.target.value)}
              className="bg-transparent border-b border-black/40 focus:outline-none px-1 text-[11px] min-w-[140px]"
            />
          </div>
          <div className="flex items-center gap-2 pr-6">
            <span className="font-normal">Sign of Dept. Head.</span>
            <input
              type="text"
              value={signatures.signDeptHead}
              onChange={(e) => updateSignature('signDeptHead', e.target.value)}
              className="bg-transparent border-b border-black/40 focus:outline-none px-1 text-[11px] min-w-[140px]"
            />
          </div>
        </div>

        {/* ── Footer Metadata Row ── */}
        <div className="w-full min-w-[1150px] grid grid-cols-12 bg-white text-[10px] font-bold p-1 px-3">
          <div className="col-span-3 text-left">
            {footerInfo.docCode}
          </div>
          <div className="col-span-3 text-center">
            {footerInfo.revNo}
          </div>
          <div className="col-span-3 text-center">
            {footerInfo.issueDate}
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
