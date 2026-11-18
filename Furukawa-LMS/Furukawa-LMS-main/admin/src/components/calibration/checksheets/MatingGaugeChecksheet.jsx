import React, { useState } from 'react';
import { Check } from 'lucide-react';
import SignatureApprovalControl from './SignatureApprovalControl';

const INITIAL_READING_ROWS = 30;

export default function MatingGaugeChecksheet({ document = {}, onSave = () => { } }) {
  const storageKey = `cal_checksheet_${document.id || 'DOC-CAL-05'}`;

  // 1. Instrument Under Calibration Details
  const [instrumentInfo, setInstrumentInfo] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_inst_info`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      itemDescription: '',
      calibrationDate: new Date().toISOString().slice(0, 10),
      calibrationDueDate: '',
      calibrationProcedure: '',
      make: '',
      modelNo: '-',
      srNo: '',
      range: '',
      leastCount: '-',
      location: document.section || '',
      temperature: '',
      humidity: '',
      reportNo: ''
    };
  });

  // 2. Master Instrument Used Details
  const [masterInfo, setMasterInfo] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_master_info`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      descriptionOfMaster: 'Video Measuring machine',
      calibrationDate: '',
      calibrationDueDate: '',
      calibrationProcedure: '',
      make: '',
      modelNo: '',
      srNo: '',
      rangeSize: '',
      leastCountGrade: '',
      location: ''
    };
  });

  // 3. Appearance Row
  const [appearance, setAppearance] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_appearance`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      sNo: 'a.',
      standard: '',
      observed: '',
      remark: 'OK'
    };
  });

  // 4. Calibration Readings Table (with Deviation and Review column)
  const [readings, setReadings] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_readings`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return Array.from({ length: INITIAL_READING_ROWS }, (_, i) => ({
      sNo: i + 1,
      standardReading: '',
      observedReading: '',
      deviation: '0.000',
      review: 'OK'
    }));
  });

  // 5. Status & Footer Details
  const [status, setStatus] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_status`);
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    return 'OK';
  });

  const [footerInfo, setFooterInfo] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_footer`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      preparedBy: '',
      docCode: 'FRM-WH-QA-082',
      checkedBy: '',
      revNo: 'REV NO.-02',
      reviewBy: '',
      revDate: 'Rev. Date - 07.03.19',
      approvedBy: '',
      pageInfo: 'Page 1 of 1'
    };
  });

  const [saveToast, setSaveToast] = useState(false);

  const updateInstrumentInfo = (field, val) => {
    setInstrumentInfo((prev) => ({ ...prev, [field]: val }));
  };

  const updateMasterInfo = (field, val) => {
    setMasterInfo((prev) => ({ ...prev, [field]: val }));
  };

  const updateReadingRow = (index, field, val) => {
    setReadings((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: val };

      // Auto-calculate deviation if both standard and observed are numbers
      if (field === 'standardReading' || field === 'observedReading') {
        const stdNum = parseFloat(field === 'standardReading' ? val : row.standardReading);
        const obsNum = parseFloat(field === 'observedReading' ? val : row.observedReading);
        if (!isNaN(stdNum) && !isNaN(obsNum)) {
          const diff = obsNum - stdNum;
          row.deviation = diff.toFixed(3);
        } else if (!val && !row.standardReading && !row.observedReading) {
          row.deviation = '0.000';
        }
      }

      next[index] = row;
      return next;
    });
  };

  const handleSave = () => {
    try {
      localStorage.setItem(`${storageKey}_inst_info`, JSON.stringify(instrumentInfo));
      localStorage.setItem(`${storageKey}_master_info`, JSON.stringify(masterInfo));
      localStorage.setItem(`${storageKey}_appearance`, JSON.stringify(appearance));
      localStorage.setItem(`${storageKey}_readings`, JSON.stringify(readings));
      localStorage.setItem(`${storageKey}_status`, status);
      localStorage.setItem(`${storageKey}_footer`, JSON.stringify(footerInfo));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
    onSave({ instrumentInfo, masterInfo, appearance, readings, status, footerInfo });
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
      <div className="w-[1240px] max-w-[1240px] shrink-0 bg-white border-2 border-black shadow-md text-black font-sans text-xs">
        {/* Company Header */}
        <div className="w-full min-w-[1100px] border-b-2 border-black p-2 text-center font-bold text-sm sm:text-base tracking-wide bg-white">
          FURUKAWA MINDA ELECTRIC PVT. LTD.
        </div>

        {/* Report Title */}
        <div className="w-full min-w-[1100px] border-b-2 border-black p-1.5 text-center font-bold text-xs sm:text-sm tracking-wide bg-white">
          CALIBRATION REPORT
        </div>

        {/* ── 1. Instrument Under Calibration Details Block ── */}
        <div className="w-full min-w-[1100px] border-b-2 border-black divide-y divide-black text-[11px]">
          {/* Row 1: Item Description */}
          <div className="grid grid-cols-12 min-h-[30px]">
            <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
              Item Description :
            </div>
            <div className="col-span-10 p-1">
              <input
                type="text"
                value={instrumentInfo.itemDescription}
                onChange={(e) => updateInstrumentInfo('itemDescription', e.target.value)}
                className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* Row 2: Calibration Date | Calibration Due Date | Calibration Procedure */}
          <div className="grid grid-cols-12 min-h-[30px] divide-x divide-black">
            {/* Col 1 */}
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Calibration Date :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="date"
                  value={instrumentInfo.calibrationDate}
                  onChange={(e) => updateInstrumentInfo('calibrationDate', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
            {/* Col 2 */}
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Calibration Due Date :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="date"
                  value={instrumentInfo.calibrationDueDate}
                  onChange={(e) => updateInstrumentInfo('calibrationDueDate', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
            {/* Col 3 */}
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Calibration Procedure :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={instrumentInfo.calibrationProcedure}
                  onChange={(e) => updateInstrumentInfo('calibrationProcedure', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Make | Model No. | Sr. No. */}
          <div className="grid grid-cols-12 min-h-[30px] divide-x divide-black">
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Make :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={instrumentInfo.make}
                  onChange={(e) => updateInstrumentInfo('make', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Model No. :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={instrumentInfo.modelNo}
                  onChange={(e) => updateInstrumentInfo('modelNo', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Sr. No. :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={instrumentInfo.srNo}
                  onChange={(e) => updateInstrumentInfo('srNo', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Row 4: Range | Least Count | Location */}
          <div className="grid grid-cols-12 min-h-[30px] divide-x divide-black">
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Range :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={instrumentInfo.range}
                  onChange={(e) => updateInstrumentInfo('range', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Least Count :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={instrumentInfo.leastCount}
                  onChange={(e) => updateInstrumentInfo('leastCount', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Location :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={instrumentInfo.location}
                  onChange={(e) => updateInstrumentInfo('location', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Row 5: Temperature(°C) | Humidity (%) | Report no. */}
          <div className="grid grid-cols-12 min-h-[30px] divide-x divide-black">
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Temperature(°C) :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={instrumentInfo.temperature}
                  onChange={(e) => updateInstrumentInfo('temperature', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Humidity (%)
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={instrumentInfo.humidity}
                  onChange={(e) => updateInstrumentInfo('humidity', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Report no.
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={instrumentInfo.reportNo}
                  onChange={(e) => updateInstrumentInfo('reportNo', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. Master Instrument Used Details Block ── */}
        <div className="w-full min-w-[1100px] border-b-2 border-black divide-y divide-black text-[11px]">
          {/* Row 1: Description of Master Used */}
          <div className="grid grid-cols-12 min-h-[30px]">
            <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
              Description of Master Used:
            </div>
            <div className="col-span-10 p-1">
              <input
                type="text"
                value={masterInfo.descriptionOfMaster}
                onChange={(e) => updateMasterInfo('descriptionOfMaster', e.target.value)}
                className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* Row 2: Calibration Date | Calibration Due Date | Calibration Procedure */}
          <div className="grid grid-cols-12 min-h-[30px] divide-x divide-black">
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Calibration Date :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="date"
                  value={masterInfo.calibrationDate}
                  onChange={(e) => updateMasterInfo('calibrationDate', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Calibration Due Date :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="date"
                  value={masterInfo.calibrationDueDate}
                  onChange={(e) => updateMasterInfo('calibrationDueDate', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Calibration Procedure :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={masterInfo.calibrationProcedure}
                  onChange={(e) => updateMasterInfo('calibrationProcedure', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Make | Model No. | Sr. No. */}
          <div className="grid grid-cols-12 min-h-[30px] divide-x divide-black">
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Make :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={masterInfo.make}
                  onChange={(e) => updateMasterInfo('make', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Model No. :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={masterInfo.modelNo}
                  onChange={(e) => updateMasterInfo('modelNo', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Sr. No. :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={masterInfo.srNo}
                  onChange={(e) => updateMasterInfo('srNo', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Row 4: Range/Size | Least Count/Grade | Location */}
          <div className="grid grid-cols-12 min-h-[30px] divide-x divide-black">
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Range/Size :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={masterInfo.rangeSize}
                  onChange={(e) => updateMasterInfo('rangeSize', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Least Count/Grade :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={masterInfo.leastCountGrade}
                  onChange={(e) => updateMasterInfo('leastCountGrade', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
            <div className="col-span-4 grid grid-cols-5">
              <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
                Location :
              </div>
              <div className="col-span-3 p-1">
                <input
                  type="text"
                  value={masterInfo.location}
                  onChange={(e) => updateMasterInfo('location', e.target.value)}
                  className="w-full h-full px-1.5 bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. 1. Appearance Section Header & Table ── */}
        <div className="w-full min-w-[1100px] border-b-2 border-black">
          <div className="p-1 px-2 font-bold text-xs bg-white">1. Appearance</div>
          <table className="w-full border-t border-black border-collapse text-[11px] table-fixed">
            <colgroup>
              <col style={{ width: '90px' }} />
              <col style={{ width: '290px' }} />
              <col style={{ width: '310px' }} />
              <col style={{ width: '410px' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-black text-center font-normal bg-white">
                <th className="p-1.5 border-r border-black font-normal">S. No.</th>
                <th className="p-1.5 border-r border-black font-normal">Standard</th>
                <th className="p-1.5 border-r border-black font-normal">Observed</th>
                <th className="p-1.5 font-normal">Remark</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black min-h-[32px]">
                <td className="p-1 border-r border-black text-center font-medium">{appearance.sNo}</td>
                <td className="p-1 border-r border-black">
                  <input
                    type="text"
                    value={appearance.standard}
                    onChange={(e) => setAppearance((prev) => ({ ...prev, standard: e.target.value }))}
                    className="w-full px-1.5 py-0.5 bg-transparent focus:outline-none"
                  />
                </td>
                <td className="p-1 border-r border-black">
                  <input
                    type="text"
                    value={appearance.observed}
                    onChange={(e) => setAppearance((prev) => ({ ...prev, observed: e.target.value }))}
                    className="w-full px-1.5 py-0.5 bg-transparent focus:outline-none"
                  />
                </td>
                <td className="p-1">
                  <input
                    type="text"
                    value={appearance.remark}
                    onChange={(e) => setAppearance((prev) => ({ ...prev, remark: e.target.value }))}
                    className="w-full px-1.5 py-0.5 bg-transparent focus:outline-none"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── 4. Main Calibration Readings Table ── */}
        <div className="w-full min-w-[1100px] border-b-2 border-black">
          <table className="w-full border-collapse text-[11px] table-fixed">
            <colgroup>
              <col style={{ width: '90px' }} />
              <col style={{ width: '290px' }} />
              <col style={{ width: '310px' }} />
              <col style={{ width: '310px' }} />
              <col style={{ width: '100px' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-black text-center font-normal bg-white">
                <th className="p-1.5 border-r border-black font-normal">S. No.</th>
                <th className="p-1.5 border-r border-black font-normal">Standard Reading (mm)</th>
                <th className="p-1.5 border-r border-black font-normal">Observed Reading (mm)</th>
                <th className="p-1.5 border-r border-black font-normal">Deviation (mm)</th>
                {/* Extra column at the right side of deviation named "Review" as in 4th ss */}
                <th className="p-1.5 font-normal bg-slate-50">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/70 bg-white">
              {readings.map((row, idx) => (
                <tr key={idx} className="border-b border-black min-h-[22px] hover:bg-slate-50/50">
                  {/* S. No. */}
                  <td className="p-0 border-r border-black text-center font-medium bg-white select-none">
                    {/* Empty or index as shown in screenshot */}
                  </td>

                  {/* Standard Reading (mm) with ± prefix */}
                  <td className="p-0 border-r border-black">
                    <div className="flex items-center px-1">
                      <span className="font-bold mr-1 select-none text-slate-700">±</span>
                      <input
                        type="text"
                        value={row.standardReading}
                        onChange={(e) => updateReadingRow(idx, 'standardReading', e.target.value)}
                        className="w-full py-0.5 bg-transparent text-[11px] focus:outline-none"
                      />
                    </div>
                  </td>

                  {/* Observed Reading (mm) */}
                  <td className="p-0 border-r border-black">
                    <input
                      type="text"
                      value={row.observedReading}
                      onChange={(e) => updateReadingRow(idx, 'observedReading', e.target.value)}
                      className="w-full px-2 py-0.5 bg-transparent text-[11px] focus:outline-none"
                    />
                  </td>

                  {/* Deviation (mm) - Default 0.000 or calculated */}
                  <td className="p-0 border-r border-black text-center font-normal">
                    <input
                      type="text"
                      value={row.deviation}
                      onChange={(e) => updateReadingRow(idx, 'deviation', e.target.value)}
                      className="w-full py-0.5 text-center bg-transparent text-[11px] focus:outline-none"
                    />
                  </td>

                  {/* Review Column (Right side of deviation, default OK, as shown in 4th ss) */}
                  <td className="p-0 text-center font-normal bg-slate-50/60">
                    <input
                      type="text"
                      value={row.review}
                      onChange={(e) => updateReadingRow(idx, 'review', e.target.value)}
                      className="w-full py-0.5 text-center bg-transparent text-[11px] font-semibold text-slate-800 focus:outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 5. Status Section ── */}
        <div className="w-full min-w-[1100px] border-b-2 border-black p-2 min-h-[80px] bg-white">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-black">Status :</span>
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-transparent font-semibold text-xs text-black focus:outline-none max-w-xs"
            />
          </div>
        </div>

        {/* ── 6. Document Footer Approvals Section (Matching Screenshot 3) ── */}
        <div className="w-full min-w-[1100px] grid grid-cols-4 border-t border-black bg-white text-[11px] divide-x-2 divide-black">
          {/* Column 1: Prepared by */}
          <div className="p-2 space-y-1">
            <div className="flex items-center">
              <span className="text-black mr-1">Prepared by :</span>
              <input
                type="text"
                value={footerInfo.preparedBy}
                onChange={(e) => setFooterInfo((prev) => ({ ...prev, preparedBy: e.target.value }))}
                className="bg-transparent font-medium focus:outline-none"
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
                  className="bg-transparent font-medium focus:outline-none w-24"
                />
              </div>
              <SignatureApprovalControl
                status={footerInfo.checkedBy_status || 'pending'}
                onApprove={() => setFooterInfo((prev) => ({ ...prev, checkedBy_status: 'approved' }))}
                onReject={() => setFooterInfo((prev) => ({ ...prev, checkedBy_status: 'rejected' }))}
                onReset={() => setFooterInfo((prev) => ({ ...prev, checkedBy_status: 'pending' }))}
              />
            </div>
            <div className="text-[10px] font-bold text-black">{footerInfo.revNo}</div>
          </div>

          {/* Column 3: Review By */}
          <div className="p-2 space-y-1">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center min-w-0">
                <span className="text-black mr-1 shrink-0">Review By :</span>
                <input
                  type="text"
                  value={footerInfo.reviewBy}
                  onChange={(e) => setFooterInfo((prev) => ({ ...prev, reviewBy: e.target.value }))}
                  className="bg-transparent font-medium focus:outline-none w-24"
                />
              </div>
              <SignatureApprovalControl
                status={footerInfo.reviewBy_status || 'pending'}
                onApprove={() => setFooterInfo((prev) => ({ ...prev, reviewBy_status: 'approved' }))}
                onReject={() => setFooterInfo((prev) => ({ ...prev, reviewBy_status: 'rejected' }))}
                onReset={() => setFooterInfo((prev) => ({ ...prev, reviewBy_status: 'pending' }))}
              />
            </div>
            <div className="text-[10px] font-bold text-black">{footerInfo.revDate}</div>
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
                  className="bg-transparent font-medium focus:outline-none w-24"
                />
              </div>
              <SignatureApprovalControl
                status={footerInfo.approvedBy_status || 'pending'}
                onApprove={() => setFooterInfo((prev) => ({ ...prev, approvedBy_status: 'approved' }))}
                onReject={() => setFooterInfo((prev) => ({ ...prev, approvedBy_status: 'rejected' }))}
                onReset={() => setFooterInfo((prev) => ({ ...prev, approvedBy_status: 'pending' }))}
              />
            </div>
            <div className="text-[10px] font-bold text-black">{footerInfo.pageInfo}</div>
          </div>
        </div>

        {/* Hidden button to allow external save trigger */}
        <button id="cal-checksheet-save-btn" type="button" onClick={handleSave} className="hidden" />
      </div>
    </div>
  );
}
