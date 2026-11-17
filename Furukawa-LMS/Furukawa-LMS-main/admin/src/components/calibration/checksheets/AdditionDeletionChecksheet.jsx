import React, { useState } from 'react';
import { Check } from 'lucide-react';

export default function AdditionDeletionChecksheet({ document = {}, onSave = () => {} }) {
  const [formData, setFormData] = useState(() => {
    // Attempt to load previously saved checksheet data from localStorage
    const storageKey = `cal_checksheet_${document.id || 'DOC-CAL-02'}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }

    return {
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      requestType: 'Addition', // 'Addition' | 'Deletion' | ''
      instrumentName: '',
      instrumentSrNo: '',
      make: '',
      typeOfMeasurement: '',
      location: document.section || '',
      leastCount: '',
      range: '',
      dateOfPurchase: '',
      acceptanceCriteria: '',
      reason: '',
      // if Applicable
      warranty: '', // 'Yes' | 'No' | ''
      warrantyValidity: '',
      amc: '', // 'Yes' | 'No' | ''
      amcValidity: '',
      manual: '', // 'Yes' | 'No' | ''
      manualRevision: '',
      calibrationCertificate: '', // 'Yes' | 'No' | ''
      calibrationCertificateValidity: '',
      // Bottom Signatures
      deptt: document.department || 'Quality',
      requestedBy: '',
      approvedBy: ''
    };
  });

  const [saveToast, setSaveToast] = useState(false);

  const updateField = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleSave = () => {
    const storageKey = `cal_checksheet_${document.id || 'DOC-CAL-02'}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(formData));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
    onSave(formData);
  };

  return (
    <div className="w-full flex flex-col items-center pb-12 select-text">
      {saveToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Checksheet saved successfully!</span>
        </div>
      )}

      {/* Main Form Sheet Box */}
      <div
        className="bg-white text-black shadow-lg rounded-none w-full max-w-4xl p-6 sm:p-10"
        style={{
          border: '2px solid #000000',
          fontFamily: "'Calibri', 'Arial', sans-serif"
        }}
      >
        {/* Top Company Name (Right Aligned) */}
        <div className="text-right text-xs sm:text-sm font-black tracking-wide uppercase mb-1">
          FURUKAWA MINDA ELECTRIC PVT. LTD.
        </div>

        {/* ── Table Container ───────────────────────────────────── */}
        <div className="border-2 border-black w-full overflow-hidden text-xs sm:text-sm">
          {/* Header Row: Title & Date/Time */}
          <div className="grid grid-cols-12 border-b-2 border-black">
            {/* Title Block */}
            <div className="col-span-9 flex flex-col items-center justify-center p-3 text-center border-r-2 border-black bg-white">
              <h1 className="text-base sm:text-xl font-black leading-tight tracking-tight">
                New Instrument addition/deletion
              </h1>
              <h2 className="text-base sm:text-xl font-black leading-tight tracking-tight mt-0.5">
                Request Form
              </h2>
            </div>

            {/* Date / Time Block */}
            <div className="col-span-3 flex flex-col divide-y-2 divide-black text-xs">
              <div className="flex items-center p-1.5 min-h-[34px]">
                <span className="font-semibold w-12 text-slate-800">Date:</span>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateField('date', e.target.value)}
                  className="w-full bg-transparent px-1 py-0.5 text-xs font-semibold focus:outline-none focus:bg-blue-50/50"
                />
              </div>
              <div className="flex items-center p-1.5 min-h-[34px]">
                <span className="font-semibold w-12 text-slate-800">Time:</span>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => updateField('time', e.target.value)}
                  className="w-full bg-transparent px-1 py-0.5 text-xs font-semibold focus:outline-none focus:bg-blue-50/50"
                />
              </div>
            </div>
          </div>

          {/* Row 1: Instrument (Mark √ tick) -> Addition vs Deletion */}
          <div className="grid grid-cols-12 border-b border-black min-h-[44px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex flex-col justify-center">
              <span>Instrument</span>
              <span className="text-[11px] font-normal text-slate-600">(Mark √ tick)</span>
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              {/* Addition */}
              <div
                onClick={() => updateField('requestType', 'Addition')}
                className="flex items-center justify-start gap-4 px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <span className="font-bold text-slate-900">Addition</span>
                <div className="w-5 h-5 border-2 border-black flex items-center justify-center bg-white">
                  {formData.requestType === 'Addition' && (
                    <Check className="w-4 h-4 stroke-[3] text-black" />
                  )}
                </div>
              </div>
              {/* Deletion */}
              <div
                onClick={() => updateField('requestType', 'Deletion')}
                className="flex items-center justify-start gap-4 px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <span className="font-bold text-slate-900">Deletion</span>
                <div className="w-5 h-5 border-2 border-black flex items-center justify-center bg-white">
                  {formData.requestType === 'Deletion' && (
                    <Check className="w-4 h-4 stroke-[3] text-black" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Instrument Name */}
          <div className="grid grid-cols-12 border-b border-black min-h-[38px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex items-center">
              Instrument Name
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <input
                type="text"
                value={formData.instrumentName}
                onChange={(e) => updateField('instrumentName', e.target.value)}
                className="col-span-2 w-full px-3 py-1.5 bg-transparent font-medium focus:outline-none focus:bg-blue-50/50"
              />
            </div>
          </div>

          {/* Row 3: Instrument Sr. No */}
          <div className="grid grid-cols-12 border-b border-black min-h-[38px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex items-center">
              Instrument Sr. No
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <input
                type="text"
                value={formData.instrumentSrNo}
                onChange={(e) => updateField('instrumentSrNo', e.target.value)}
                className="col-span-2 w-full px-3 py-1.5 bg-transparent font-medium focus:outline-none focus:bg-blue-50/50"
              />
            </div>
          </div>

          {/* Row 4: Make */}
          <div className="grid grid-cols-12 border-b border-black min-h-[38px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex items-center">
              Make
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <input
                type="text"
                value={formData.make}
                onChange={(e) => updateField('make', e.target.value)}
                className="col-span-2 w-full px-3 py-1.5 bg-transparent font-medium focus:outline-none focus:bg-blue-50/50"
              />
            </div>
          </div>

          {/* Row 5: Type of Measurement */}
          <div className="grid grid-cols-12 border-b border-black min-h-[38px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex items-center">
              Type of Measurement
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <input
                type="text"
                value={formData.typeOfMeasurement}
                onChange={(e) => updateField('typeOfMeasurement', e.target.value)}
                className="col-span-2 w-full px-3 py-1.5 bg-transparent font-medium focus:outline-none focus:bg-blue-50/50"
              />
            </div>
          </div>

          {/* Row 6: Location */}
          <div className="grid grid-cols-12 border-b border-black min-h-[38px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex items-center">
              Location
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <input
                type="text"
                value={formData.location}
                onChange={(e) => updateField('location', e.target.value)}
                className="col-span-2 w-full px-3 py-1.5 bg-transparent font-medium focus:outline-none focus:bg-blue-50/50"
              />
            </div>
          </div>

          {/* Row 7: Least Count */}
          <div className="grid grid-cols-12 border-b border-black min-h-[38px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex items-center">
              Least Count
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <input
                type="text"
                value={formData.leastCount}
                onChange={(e) => updateField('leastCount', e.target.value)}
                className="col-span-2 w-full px-3 py-1.5 bg-transparent font-medium focus:outline-none focus:bg-blue-50/50"
              />
            </div>
          </div>

          {/* Row 8: Range */}
          <div className="grid grid-cols-12 border-b border-black min-h-[38px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex items-center">
              Range
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <input
                type="text"
                value={formData.range}
                onChange={(e) => updateField('range', e.target.value)}
                className="col-span-2 w-full px-3 py-1.5 bg-transparent font-medium focus:outline-none focus:bg-blue-50/50"
              />
            </div>
          </div>

          {/* Row 9: Date Of purchase */}
          <div className="grid grid-cols-12 border-b border-black min-h-[38px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex items-center">
              Date Of purchase
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <input
                type="date"
                value={formData.dateOfPurchase}
                onChange={(e) => updateField('dateOfPurchase', e.target.value)}
                className="col-span-2 w-full px-3 py-1.5 bg-transparent font-medium focus:outline-none focus:bg-blue-50/50"
              />
            </div>
          </div>

          {/* Row 10: Acceptance criteria */}
          <div className="grid grid-cols-12 border-b border-black min-h-[38px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex items-center">
              Acceptance criteria
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <input
                type="text"
                value={formData.acceptanceCriteria}
                onChange={(e) => updateField('acceptanceCriteria', e.target.value)}
                className="col-span-2 w-full px-3 py-1.5 bg-transparent font-medium focus:outline-none focus:bg-blue-50/50"
              />
            </div>
          </div>

          {/* Row 11: Reason (addition/deletion) */}
          <div className="grid grid-cols-12 border-b-2 border-black min-h-[72px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex flex-col justify-start">
              <span>Reason</span>
              <span className="text-[11px] font-normal text-slate-600">(addition/deletion)</span>
            </div>
            <div className="col-span-9 p-2">
              <textarea
                rows={3}
                value={formData.reason}
                onChange={(e) => updateField('reason', e.target.value)}
                className="w-full h-full bg-transparent resize-none focus:outline-none focus:bg-blue-50/50 text-xs sm:text-sm font-medium"
              />
            </div>
          </div>

          {/* Row 12: if Applicable Section Header */}
          <div className="p-1.5 font-bold border-b border-black bg-white text-xs sm:text-sm tracking-wide">
            if Applicable
          </div>

          {/* Row 13: Warranty (Mark √ tick) -> Yes vs No */}
          <div className="grid grid-cols-12 border-b border-black min-h-[40px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex flex-col justify-center">
              <span>Warranty</span>
              <span className="text-[11px] font-normal text-slate-600">(Mark √ tick)</span>
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <div
                onClick={() => updateField('warranty', 'Yes')}
                className="flex items-center justify-start gap-4 px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <span className="font-bold">Yes</span>
                <div className="w-5 h-5 border-2 border-black flex items-center justify-center bg-white">
                  {formData.warranty === 'Yes' && (
                    <Check className="w-4 h-4 stroke-[3] text-black" />
                  )}
                </div>
              </div>
              <div
                onClick={() => updateField('warranty', 'No')}
                className="flex items-center justify-start gap-4 px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <span className="font-bold">No.</span>
                <div className="w-5 h-5 border-2 border-black flex items-center justify-center bg-white">
                  {formData.warranty === 'No' && (
                    <Check className="w-4 h-4 stroke-[3] text-black" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 14: Warranty (Validity) */}
          <div className="grid grid-cols-12 border-b border-black min-h-[38px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex items-center">
              Warranty (Validity)
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <input
                type="text"
                value={formData.warrantyValidity}
                onChange={(e) => updateField('warrantyValidity', e.target.value)}
                className="col-span-2 w-full px-3 py-1.5 bg-transparent font-medium focus:outline-none focus:bg-blue-50/50"
              />
            </div>
          </div>

          {/* Row 15: AMC (Mark √ tick) -> Yes vs No */}
          <div className="grid grid-cols-12 border-b border-black min-h-[40px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex flex-col justify-center">
              <span>AMC</span>
              <span className="text-[11px] font-normal text-slate-600">(Mark √ tick)</span>
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <div
                onClick={() => updateField('amc', 'Yes')}
                className="flex items-center justify-start gap-4 px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <span className="font-bold">Yes</span>
                <div className="w-5 h-5 border-2 border-black flex items-center justify-center bg-white">
                  {formData.amc === 'Yes' && <Check className="w-4 h-4 stroke-[3] text-black" />}
                </div>
              </div>
              <div
                onClick={() => updateField('amc', 'No')}
                className="flex items-center justify-start gap-4 px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <span className="font-bold">No.</span>
                <div className="w-5 h-5 border-2 border-black flex items-center justify-center bg-white">
                  {formData.amc === 'No' && <Check className="w-4 h-4 stroke-[3] text-black" />}
                </div>
              </div>
            </div>
          </div>

          {/* Row 16: AMC (Validity) */}
          <div className="grid grid-cols-12 border-b border-black min-h-[38px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex items-center">
              AMC (Validity)
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <input
                type="text"
                value={formData.amcValidity}
                onChange={(e) => updateField('amcValidity', e.target.value)}
                className="col-span-2 w-full px-3 py-1.5 bg-transparent font-medium focus:outline-none focus:bg-blue-50/50"
              />
            </div>
          </div>

          {/* Row 17: Manual (Mark √ tick) -> Yes vs No */}
          <div className="grid grid-cols-12 border-b border-black min-h-[40px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex flex-col justify-center">
              <span>Manual</span>
              <span className="text-[11px] font-normal text-slate-600">(Mark √ tick)</span>
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <div
                onClick={() => updateField('manual', 'Yes')}
                className="flex items-center justify-start gap-4 px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <span className="font-bold">Yes</span>
                <div className="w-5 h-5 border-2 border-black flex items-center justify-center bg-white">
                  {formData.manual === 'Yes' && (
                    <Check className="w-4 h-4 stroke-[3] text-black" />
                  )}
                </div>
              </div>
              <div
                onClick={() => updateField('manual', 'No')}
                className="flex items-center justify-start gap-4 px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <span className="font-bold">No.</span>
                <div className="w-5 h-5 border-2 border-black flex items-center justify-center bg-white">
                  {formData.manual === 'No' && (
                    <Check className="w-4 h-4 stroke-[3] text-black" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 18: Manual (Revision) */}
          <div className="grid grid-cols-12 border-b border-black min-h-[38px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex items-center">
              Manual (Revision)
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <input
                type="text"
                value={formData.manualRevision}
                onChange={(e) => updateField('manualRevision', e.target.value)}
                className="col-span-2 w-full px-3 py-1.5 bg-transparent font-medium focus:outline-none focus:bg-blue-50/50"
              />
            </div>
          </div>

          {/* Row 19: Calibration Certificate (Mark √ tick) -> Yes vs No */}
          <div className="grid grid-cols-12 border-b border-black min-h-[40px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex flex-col justify-center">
              <span>Calibration Certificate</span>
              <span className="text-[11px] font-normal text-slate-600">(Mark √ tick)</span>
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <div
                onClick={() => updateField('calibrationCertificate', 'Yes')}
                className="flex items-center justify-start gap-4 px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <span className="font-bold">Yes</span>
                <div className="w-5 h-5 border-2 border-black flex items-center justify-center bg-white">
                  {formData.calibrationCertificate === 'Yes' && (
                    <Check className="w-4 h-4 stroke-[3] text-black" />
                  )}
                </div>
              </div>
              <div
                onClick={() => updateField('calibrationCertificate', 'No')}
                className="flex items-center justify-start gap-4 px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <span className="font-bold">No.</span>
                <div className="w-5 h-5 border-2 border-black flex items-center justify-center bg-white">
                  {formData.calibrationCertificate === 'No' && (
                    <Check className="w-4 h-4 stroke-[3] text-black" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 20: Calibration Certificate(Validity) */}
          <div className="grid grid-cols-12 border-b-2 border-black min-h-[38px]">
            <div className="col-span-3 p-2 font-bold border-r border-black flex items-center">
              Calibration Certificate(Validity)
            </div>
            <div className="col-span-9 grid grid-cols-2 divide-x divide-dashed divide-black">
              <input
                type="text"
                value={formData.calibrationCertificateValidity}
                onChange={(e) => updateField('calibrationCertificateValidity', e.target.value)}
                className="col-span-2 w-full px-3 py-1.5 bg-transparent font-medium focus:outline-none focus:bg-blue-50/50"
              />
            </div>
          </div>

          {/* Row 21: Deptt, REQUESTED BY, APPROVED BY */}
          <div className="grid grid-cols-12 border-b-2 border-black min-h-[46px] divide-x-2 divide-black">
            {/* Deptt */}
            <div className="col-span-3 p-2 flex items-center">
              <span className="font-bold mr-1.5">Deptt:</span>
              <input
                type="text"
                value={formData.deptt}
                onChange={(e) => updateField('deptt', e.target.value)}
                className="w-full bg-transparent font-semibold focus:outline-none"
              />
            </div>

            {/* REQUESTED BY */}
            <div className="col-span-5 p-2 flex items-center">
              <span className="font-bold mr-1.5 whitespace-nowrap">REQUESTED BY:</span>
              <input
                type="text"
                value={formData.requestedBy}
                onChange={(e) => updateField('requestedBy', e.target.value)}
                className="w-full bg-transparent font-semibold focus:outline-none"
              />
            </div>

            {/* APPROVED BY: Dept. Head */}
            <div className="col-span-4 p-2 flex flex-col justify-center">
              <div className="font-bold">APPROVED BY:</div>
              <div className="flex items-center text-xs font-semibold text-slate-700">
                <span className="mr-1">Dept. Head:</span>
                <input
                  type="text"
                  value={formData.approvedBy}
                  onChange={(e) => updateField('approvedBy', e.target.value)}
                  className="w-full bg-transparent font-medium focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Row 22: Footer Document Metadata */}
          <div className="grid grid-cols-12 text-xs font-bold divide-x-2 divide-black bg-white">
            <div className="col-span-3 p-1.5 flex items-center">
              FRM-WH-QA-216
            </div>
            <div className="col-span-3 p-1.5 flex items-center">
              Rev: 00
            </div>
            <div className="col-span-3 p-1.5 flex items-center">
              Issue Date: 18.04.19
            </div>
            <div className="col-span-3 p-1.5 flex items-center justify-end pr-3">
              Page: 1 of 1
            </div>
          </div>
        </div>

        {/* Hidden button to allow external save trigger from top navbar */}
        <button id="cal-checksheet-save-btn" type="button" onClick={handleSave} className="hidden" />
      </div>
    </div>
  );
}
