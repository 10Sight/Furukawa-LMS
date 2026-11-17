import React, { useState } from 'react';
import { Check } from 'lucide-react';

const INITIAL_READING_ROWS = [
  { sNo: '1', standardReading: '', observedReading: '', deviation: '' },
  { sNo: '2', standardReading: '', observedReading: '', deviation: '' },
  { sNo: '4', standardReading: '', observedReading: '', deviation: '' },
  { sNo: '4', standardReading: '', observedReading: '', deviation: '' },
  { sNo: '5', standardReading: '', observedReading: '', deviation: '' }
];

export default function FormatChecksheet({ document = {}, onSave = () => {} }) {
  const storageKey = `cal_checksheet_${document.id || 'DOC-CAL-05-FORMAT'}`;

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
      modelNo: '',
      srNo: '',
      range: '',
      leastCount: '',
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
      descriptionOfMaster: '',
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

  // 3. 1. Appreance (matching exact typo from screenshot)
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
      remark: ''
    };
  });

  // 4. Calibration Readings Table (4 Columns: S. No., Standard Reading (mm), Observed Reading (mm), Deviation (mm))
  const [readings, setReadings] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_readings`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return INITIAL_READING_ROWS;
  });

  // 5. Acceptance Criteria & Status
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_acceptance`);
      if (saved !== null) return saved;
    } catch {
      /* ignore */
    }
    return '';
  });

  const [status, setStatus] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_status`);
      if (saved !== null) return saved;
    } catch {
      /* ignore */
    }
    return '';
  });

  // 6. Signatures & Footer Details
  const [footerInfo, setFooterInfo] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_footer`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      preparedBy: '',
      checkedBy: '',
      reviewBy: '',
      approvedBy: '',
      docCode: 'FRM-WH-QA-082',
      revNo: 'REV NO.-02',
      revDate: 'Rev. Date - 07.03.19',
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
      localStorage.setItem(`${storageKey}_acceptance`, acceptanceCriteria);
      localStorage.setItem(`${storageKey}_status`, status);
      localStorage.setItem(`${storageKey}_footer`, JSON.stringify(footerInfo));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
    onSave({ instrumentInfo, masterInfo, appearance, readings, acceptanceCriteria, status, footerInfo });
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
      <div className="w-full max-w-[1240px] bg-white border-2 border-black shadow-md overflow-x-auto text-black font-sans text-xs">
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
            <div className="col-span-2 p-1.5 font-normal flex items-center">Calibration Date :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="date"
                value={instrumentInfo.calibrationDate}
                onChange={(e) => updateInstrumentInfo('calibrationDate', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
            <div className="col-span-2 p-1.5 font-normal flex items-center">Calibration Due Date :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="date"
                value={instrumentInfo.calibrationDueDate}
                onChange={(e) => updateInstrumentInfo('calibrationDueDate', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
            <div className="col-span-2 p-1.5 font-normal flex items-center">Calibration Procedure :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={instrumentInfo.calibrationProcedure}
                onChange={(e) => updateInstrumentInfo('calibrationProcedure', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
          </div>

          {/* Row 3: Make | Model No. | Sr. No. */}
          <div className="grid grid-cols-12 min-h-[30px] divide-x divide-black">
            <div className="col-span-2 p-1.5 font-normal flex items-center">Make :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={instrumentInfo.make}
                onChange={(e) => updateInstrumentInfo('make', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
            <div className="col-span-2 p-1.5 font-normal flex items-center">Model No. :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={instrumentInfo.modelNo}
                onChange={(e) => updateInstrumentInfo('modelNo', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
            <div className="col-span-2 p-1.5 font-normal flex items-center">Sr. No. :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={instrumentInfo.srNo}
                onChange={(e) => updateInstrumentInfo('srNo', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
          </div>

          {/* Row 4: Range | Least Count | Location */}
          <div className="grid grid-cols-12 min-h-[30px] divide-x divide-black">
            <div className="col-span-2 p-1.5 font-normal flex items-center">Range :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={instrumentInfo.range}
                onChange={(e) => updateInstrumentInfo('range', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
            <div className="col-span-2 p-1.5 font-normal flex items-center">Least Count :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={instrumentInfo.leastCount}
                onChange={(e) => updateInstrumentInfo('leastCount', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
            <div className="col-span-2 p-1.5 font-normal flex items-center">Location :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={instrumentInfo.location}
                onChange={(e) => updateInstrumentInfo('location', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
          </div>

          {/* Row 5: Temperature | Humidity | Report No */}
          <div className="grid grid-cols-12 min-h-[30px] divide-x divide-black">
            <div className="col-span-2 p-1.5 font-normal flex items-center">Temperature(°C) :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={instrumentInfo.temperature}
                onChange={(e) => updateInstrumentInfo('temperature', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
            <div className="col-span-2 p-1.5 font-normal flex items-center">Humidity(%)</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={instrumentInfo.humidity}
                onChange={(e) => updateInstrumentInfo('humidity', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
            <div className="col-span-2 p-1.5 font-normal flex items-center">Report No:</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={instrumentInfo.reportNo}
                onChange={(e) => updateInstrumentInfo('reportNo', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
          </div>
        </div>

        {/* ── 2. Master Instrument Used Details Block ── */}
        <div className="w-full min-w-[1100px] border-b-2 border-black divide-y divide-black text-[11px]">
          {/* Row 1: Description of Master Used */}
          <div className="grid grid-cols-12 min-h-[30px]">
            <div className="col-span-2 p-1.5 font-normal border-r border-black flex items-center">
              Description of Master Used :
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

          {/* Row 2: Master Calibration Date | Calibration Due Date | Calibration Procedure */}
          <div className="grid grid-cols-12 min-h-[30px] divide-x divide-black">
            <div className="col-span-2 p-1.5 font-normal flex items-center">Calibration Date :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="date"
                value={masterInfo.calibrationDate}
                onChange={(e) => updateMasterInfo('calibrationDate', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
            <div className="col-span-2 p-1.5 font-normal flex items-center">Calibration Due Date :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="date"
                value={masterInfo.calibrationDueDate}
                onChange={(e) => updateMasterInfo('calibrationDueDate', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
            <div className="col-span-2 p-1.5 font-normal flex items-center">Calibration Procedure :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={masterInfo.calibrationProcedure}
                onChange={(e) => updateMasterInfo('calibrationProcedure', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
          </div>

          {/* Row 3: Master Make | Model No. | Sr. No. */}
          <div className="grid grid-cols-12 min-h-[30px] divide-x divide-black">
            <div className="col-span-2 p-1.5 font-normal flex items-center">Make :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={masterInfo.make}
                onChange={(e) => updateMasterInfo('make', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
            <div className="col-span-2 p-1.5 font-normal flex items-center">Model No. :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={masterInfo.modelNo}
                onChange={(e) => updateMasterInfo('modelNo', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
            <div className="col-span-2 p-1.5 font-normal flex items-center">Sr. No. :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={masterInfo.srNo}
                onChange={(e) => updateMasterInfo('srNo', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
          </div>

          {/* Row 4: Master Range/Size | Least Count/Grade | Location */}
          <div className="grid grid-cols-12 min-h-[30px] divide-x divide-black">
            <div className="col-span-2 p-1.5 font-normal flex items-center">Range/Size :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={masterInfo.rangeSize}
                onChange={(e) => updateMasterInfo('rangeSize', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
            <div className="col-span-2 p-1.5 font-normal flex items-center">Least Count/Grade :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={masterInfo.leastCountGrade}
                onChange={(e) => updateMasterInfo('leastCountGrade', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
            <div className="col-span-2 p-1.5 font-normal flex items-center">Location :</div>
            <div className="col-span-2 p-1 flex items-center">
              <input
                type="text"
                value={masterInfo.location}
                onChange={(e) => updateMasterInfo('location', e.target.value)}
                className="w-full bg-transparent focus:outline-none font-medium px-1"
              />
            </div>
          </div>
        </div>

        {/* ── 3. Appearance Section (1. Appreance) ── */}
        <div className="w-full min-w-[1100px] border-b-2 border-black text-[11px]">
          <div className="p-1 px-2 font-bold border-b border-black">1. Appreance</div>
          <div className="grid grid-cols-12 divide-x divide-black min-h-[28px] border-b border-black bg-white font-bold text-center">
            <div className="col-span-1 p-1">S.NO.</div>
            <div className="col-span-5 p-1">Standard</div>
            <div className="col-span-3 p-1">Observed</div>
            <div className="col-span-3 p-1">Remark</div>
          </div>
          <div className="grid grid-cols-12 divide-x divide-black min-h-[34px]">
            <div className="col-span-1 p-1 text-center font-medium select-none flex items-center justify-center">
              {appearance.sNo}
            </div>
            <div className="col-span-5 p-1 flex items-center">
              <input
                type="text"
                value={appearance.standard}
                onChange={(e) => setAppearance((prev) => ({ ...prev, standard: e.target.value }))}
                className="w-full bg-transparent focus:outline-none px-1"
              />
            </div>
            <div className="col-span-3 p-1 flex items-center">
              <input
                type="text"
                value={appearance.observed}
                onChange={(e) => setAppearance((prev) => ({ ...prev, observed: e.target.value }))}
                className="w-full bg-transparent focus:outline-none px-1"
              />
            </div>
            <div className="col-span-3 p-1 flex items-center">
              <input
                type="text"
                value={appearance.remark}
                onChange={(e) => setAppearance((prev) => ({ ...prev, remark: e.target.value }))}
                className="w-full bg-transparent focus:outline-none px-1"
              />
            </div>
          </div>
        </div>

        {/* ── 4. Results Section (4 Columns: S. No., Standard Reading, Observed Reading, Deviation) ── */}
        <div className="w-full min-w-[1100px] border-b-2 border-black text-[11px]">
          <div className="p-1 px-2 font-bold border-b border-black">Results :</div>
          <table className="w-full border-collapse table-fixed">
            <colgroup>
              <col style={{ width: '80px' }} />
              <col style={{ width: '400px' }} />
              <col style={{ width: '320px' }} />
              <col style={{ width: '300px' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-black text-center font-bold bg-white leading-tight">
                <th className="p-1.5 border-r border-black font-bold">S. No.</th>
                <th className="p-1.5 border-r border-black font-bold">Standard Reading (mm)</th>
                <th className="p-1.5 border-r border-black font-bold">Observed Reading (mm)</th>
                <th className="p-1.5 font-bold">Deviation (mm)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black bg-white">
              {readings.map((row, idx) => (
                <tr key={idx} className="border-b border-black min-h-[28px] hover:bg-slate-50/50">
                  <td className="p-1 border-r border-black text-center font-medium select-none">
                    {row.sNo}
                  </td>
                  <td className="p-1 border-r border-black">
                    <input
                      type="text"
                      value={row.standardReading}
                      onChange={(e) => updateReadingRow(idx, 'standardReading', e.target.value)}
                      className="w-full bg-transparent focus:outline-none px-1"
                    />
                  </td>
                  <td className="p-1 border-r border-black">
                    <input
                      type="text"
                      value={row.observedReading}
                      onChange={(e) => updateReadingRow(idx, 'observedReading', e.target.value)}
                      className="w-full bg-transparent focus:outline-none px-1"
                    />
                  </td>
                  <td className="p-1 text-center">
                    <input
                      type="text"
                      value={row.deviation}
                      onChange={(e) => updateReadingRow(idx, 'deviation', e.target.value)}
                      className="w-full text-center bg-transparent focus:outline-none px-1 font-mono"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 5. Acceptance Criteria & Status Section ── */}
        <div className="w-full min-w-[1100px] border-b-2 border-black p-3 px-4 bg-white text-[11px] min-h-[90px] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="font-bold mr-2 whitespace-nowrap">Acceptance Criteria :</span>
              <input
                type="text"
                value={acceptanceCriteria}
                onChange={(e) => setAcceptanceCriteria(e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium"
              />
            </div>
            <div className="flex items-center">
              <span className="font-bold mr-2 whitespace-nowrap">Status :</span>
              <input
                type="text"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium"
              />
            </div>
          </div>
        </div>

        {/* ── 6. Signatures Row (4 Columns) ── */}
        <div className="w-full min-w-[1100px] border-b-2 border-black grid grid-cols-4 divide-x divide-black bg-white text-[11px]">
          <div className="p-2 min-h-[50px] flex items-center">
            <span className="font-bold mr-2 whitespace-nowrap">Prepared by :</span>
            <input
              type="text"
              value={footerInfo.preparedBy}
              onChange={(e) => setFooterInfo((prev) => ({ ...prev, preparedBy: e.target.value }))}
              className="w-full bg-transparent border-none focus:outline-none font-medium"
            />
          </div>
          <div className="p-2 min-h-[50px] flex items-center">
            <span className="font-bold mr-2 whitespace-nowrap">Checked By :</span>
            <input
              type="text"
              value={footerInfo.checkedBy}
              onChange={(e) => setFooterInfo((prev) => ({ ...prev, checkedBy: e.target.value }))}
              className="w-full bg-transparent border-none focus:outline-none font-medium"
            />
          </div>
          <div className="p-2 min-h-[50px] flex items-center">
            <span className="font-bold mr-2 whitespace-nowrap">Reviewed By :</span>
            <input
              type="text"
              value={footerInfo.reviewBy}
              onChange={(e) => setFooterInfo((prev) => ({ ...prev, reviewBy: e.target.value }))}
              className="w-full bg-transparent border-none focus:outline-none font-medium"
            />
          </div>
          <div className="p-2 min-h-[50px] flex items-center">
            <span className="font-bold mr-2 whitespace-nowrap">Approved By:</span>
            <input
              type="text"
              value={footerInfo.approvedBy}
              onChange={(e) => setFooterInfo((prev) => ({ ...prev, approvedBy: e.target.value }))}
              className="w-full bg-transparent border-none focus:outline-none font-medium"
            />
          </div>
        </div>

        {/* ── 7. Footer Metadata Row ── */}
        <div className="w-full min-w-[1100px] grid grid-cols-12 bg-white text-[10px] font-bold p-1 px-3">
          <div className="col-span-3 text-left">{footerInfo.docCode}</div>
          <div className="col-span-3 text-center">{footerInfo.revNo}</div>
          <div className="col-span-3 text-center">{footerInfo.revDate}</div>
          <div className="col-span-3 text-right">{footerInfo.pageInfo}</div>
        </div>

        {/* Hidden button to allow external save trigger */}
        <button id="cal-checksheet-save-btn" type="button" onClick={handleSave} className="hidden" />
      </div>
    </div>
  );
}
