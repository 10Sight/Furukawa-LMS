import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Printer, Lock, Check } from 'lucide-react';
import fmeLogo from './assets/suggestionChecksheetLogo.png';

export default function SuggestionChecksheetDetail({ item, onBack, onSave }) {
  const [formData, setFormData] = useState({
    unit: item?.unit || 'Bawal',
    date: item?.date || new Date().toISOString().slice(0, 10),
    department: item?.department || '',
    section: item?.section || '',
    lineArea: item?.lineArea || item?.employeeCode || '',
    employeeName: item?.submittedBy || '',
    categoryP: !!item?.categoryP || item?.category === 'Productivity',
    categoryQ: !!item?.categoryQ || item?.category === 'Quality',
    categoryC: !!item?.categoryC || item?.category === 'Cost Reduction' || item?.category === 'Cost',
    categoryD: !!item?.categoryD || item?.category === 'Delivery',
    categoryM: !!item?.categoryM || item?.category === 'Maintenance' || item?.category === 'Morale',
    categoryS: !!item?.categoryS || item?.category === 'Safety',
    category5S: !!item?.category5S || item?.category === '5S' || item?.category === "5'S",
    problemText: item?.problemText !== undefined ? item.problemText : (item?.description || ''),
    suggestionText: item?.suggestionText || '',
    rejectedAccepted: item?.rejectedAccepted || (item?.status === 'Rejected' ? 'REJECTED' : item?.status === 'Approved' ? 'ACCEPTED' : ''),
    reasonIfRejected:
      item?.reasonIfRejected ||
      (Array.isArray(item?.reasonLines) ? item.reasonLines.filter(Boolean).join(' ') : '') ||
      '',
    targetDate: item?.targetDate || '',
    dateOfImplementation: item?.dateOfImplementation || '',
    lineLeaderSign1: item?.lineLeaderSign1 || '',
    lineLeaderSign2: item?.lineLeaderSign2 || '',
    approvalDate: item?.approvalDate || '',
    costSaving: item?.costSaving || '',
    benefitDetails: item?.benefitStatusDetails || item?.benefitDetails || '',
  });

  const [activeCellId, setActiveCellId] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Category toggle
  const handleToggleCategory = (catKey) => {
    setFormData((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }));
  };

  // Allows Shift+Enter for new line without accidental form submission
  const handleWrapInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        e.stopPropagation();
      } else {
        e.stopPropagation();
      }
    }
  };

  // Save form
  const handleSaveForm = (e) => {
    if (e) e.preventDefault();
    if (onSave) {
      onSave({
        ...item,
        ...formData,
        unit: formData.unit || item?.unit || 'Bawal',
        submittedBy: formData.employeeName,
        department: formData.department,
        section: formData.section,
        lineArea: formData.lineArea,
        date: formData.date,
        problemText: formData.problemText,
        suggestionText: formData.suggestionText,
        description: (formData.problemText || '').slice(0, 120) + '...',
      });
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="suggestion-checksheet-root flex flex-col gap-3 w-full pb-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap justify-between items-center bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs no-print gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Suggestion Checksheet</span>
        </button>

        {saveSuccess && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 py-1 px-3 text-xs rounded-full inline-flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Checksheet saved successfully!</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
            onClick={handleSaveForm}
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Save Checksheet</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            onClick={() => window.print()}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Full-Width Responsive Checksheet Document */}
      <form onSubmit={handleSaveForm} className="w-full pb-10">
        <div
          className="bg-white checksheet-print-area w-full"
          style={{
            border: '2px solid #000000',
            fontFamily: "'Times New Roman', Times, serif",
            color: '#000000',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            width: '100%',
            minWidth: '820px',
            maxWidth: '100%'
          }}
        >
          {/* Row 1: Logo & Company Name */}
          <div
            className="flex items-center justify-between px-4 py-2 border-b-2 border-black"
            style={{ minHeight: '68px' }}
          >
            <div style={{ width: '220px' }} className="flex items-center">
              <img
                src={fmeLogo}
                alt="Fme Logo"
                style={{ maxHeight: '54px', maxWidth: '200px', objectFit: 'contain' }}
              />
            </div>

            <div className="text-center flex-1">
              <h2
                className="text-xl md:text-2xl font-bold tracking-tight mb-0"
                style={{
                  textDecoration: 'underline',
                  textUnderlineOffset: '4px',
                  letterSpacing: '0.5px',
                  fontFamily: "'Times New Roman', Times, serif",
                }}
              >
                Furukawa Minda Electric Pvt. Ltd.
              </h2>
            </div>

            <div style={{ width: '220px' }}></div>
          </div>

          {/* Row 2: SUGGESTION FORMAT & UNIT */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-black bg-white">
            <div style={{ width: '220px' }} className="flex items-center text-sm font-bold">
              <span className="font-bold mr-1.5">UNIT:-</span>
              <span className="font-semibold text-black">{formData.unit || item?.unit || 'Bawal'}</span>
            </div>

            <div className="text-center flex-1">
              <h3
                className="text-lg md:text-xl font-bold tracking-wider mb-0"
                style={{
                  letterSpacing: '1.5px',
                  fontFamily: "'Times New Roman', Times, serif",
                }}
              >
                SUGGESTION FORMAT
              </h3>
            </div>

            <div style={{ width: '220px' }}></div>
          </div>

          {/* Row 3: Checkbox Blocks P Q C D M S 5'S */}
          <div
            className="flex justify-end items-center px-4 py-1.5 border-b border-black gap-3 text-sm font-bold bg-white"
          >
            {[
              { key: 'categoryP', label: 'P' },
              { key: 'categoryQ', label: 'Q' },
              { key: 'categoryC', label: 'C' },
              { key: 'categoryD', label: 'D' },
              { key: 'categoryM', label: 'M' },
              { key: 'categoryS', label: 'S' },
              { key: 'category5S', label: "5'S" },
            ].map((cat) => (
              <div
                key={cat.key}
                className="flex items-center gap-1.5 cursor-pointer select-none"
                onClick={() => handleToggleCategory(cat.key)}
                title={`Toggle ${cat.label}`}
              >
                <span>{cat.label}</span>
                <div
                  style={{
                    width: '30px',
                    height: '18px',
                    border: '2px solid #000000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    lineHeight: '1',
                    fontWeight: 'bold',
                  }}
                >
                  {formData[cat.key] ? '✓' : ''}
                </div>
              </div>
            ))}
          </div>

          {/* Row 4: DATE:- and Employee Name / ID : in same row */}
          <div className="flex items-stretch border-b border-black text-sm">
            {/* DATE */}
            <div className="flex items-center px-3 py-1.5 border-r border-black" style={{ width: '35%' }}>
              <span className="font-bold whitespace-nowrap mr-2">DATE:-</span>
              <input
                type="text"
                className="excel-cell-input flex-1"
                style={{
                  border: activeCellId === 'date' ? '2px solid #217346' : '1px solid transparent',
                }}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                onFocus={() => setActiveCellId('date')}
                onBlur={() => setActiveCellId(null)}
                placeholder="YYYY-MM-DD"
              />
            </div>

            {/* Employee Name / ID : */}
            <div className="flex items-center px-3 py-1.5 flex-1" style={{ width: '65%' }}>
              <span className="font-bold whitespace-nowrap mr-2">Employee Name / ID :</span>
              <input
                type="text"
                className="excel-cell-input flex-1"
                style={{
                  border: activeCellId === 'empName' ? '2px solid #217346' : '1px solid transparent',
                }}
                value={formData.employeeName}
                onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                onFocus={() => setActiveCellId('empName')}
                onBlur={() => setActiveCellId(null)}
                placeholder="Enter Employee Name / ID"
              />
            </div>
          </div>

          {/* Row 5: DEPARTMENT:-, SECTION:-, and Line / Area : in same row */}
          <div className="flex items-stretch border-b border-black text-sm">
            {/* DEPARTMENT (Freezed / Non-editable) */}
            <div
              className="flex items-center px-3 py-1.5 border-r border-black bg-slate-50"
              style={{ width: '33.33%' }}
              title="Department is freezed after checksheet creation"
            >
              <span className="font-bold whitespace-nowrap mr-2">DEPARTMENT:-</span>
              <input
                type="text"
                className="excel-cell-input flex-1 bg-transparent text-slate-800 cursor-not-allowed"
                value={formData.department}
                readOnly
              />
              <Lock className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" title="Freezed (non-editable)" />
            </div>

            {/* SECTION (Freezed / Non-editable) */}
            <div
              className="flex items-center px-3 py-1.5 border-r border-black bg-slate-50"
              style={{ width: '33.33%' }}
              title="Section is freezed after checksheet creation"
            >
              <span className="font-bold whitespace-nowrap mr-2">SECTION:-</span>
              <input
                type="text"
                className="excel-cell-input flex-1 bg-transparent text-slate-800 cursor-not-allowed"
                value={formData.section}
                readOnly
              />
              <Lock className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" title="Freezed (non-editable)" />
            </div>

            {/* Line / Area : (Freezed) */}
            <div
              className="flex items-center px-3 py-1.5 flex-1 bg-slate-50"
              style={{ width: '33.34%' }}
              title="Line / Area is freezed after checksheet creation"
            >
              <span className="font-bold whitespace-nowrap mr-2">Line / Area :</span>
              <input
                type="text"
                className="excel-cell-input flex-1 bg-transparent text-slate-800 cursor-not-allowed"
                value={formData.lineArea}
                readOnly
              />
              <Lock className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" title="Freezed (non-editable)" />
            </div>
          </div>

          {/* Section 1 Header: PROBLEM NAME / PROBLEM IN CURRENT PROCESS OR METHOD : */}
          <div
            className="px-3 py-1.5 border-b border-black font-bold text-sm bg-white"
            style={{ textDecoration: 'underline' }}
          >
            PROBLEM NAME / PROBLEM IN CURRENT PROCESS OR METHOD :
          </div>

          {/* Section 1 Input */}
          <div className="w-full border-b border-black bg-white p-2">
            <textarea
              className="w-full p-2.5 border border-slate-200 rounded-xs text-sm leading-relaxed text-black bg-white focus:outline-none"
              rows="6"
              wrap="soft"
              style={{
                fontFamily: "'Times New Roman', Times, serif",
                fontSize: '1rem',
                border: activeCellId === 'problemText' ? '2px solid #217346' : '1px solid #cbd5e1',
                resize: 'vertical',
                minHeight: '160px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
              value={formData.problemText}
              onChange={(e) => setFormData({ ...formData, problemText: e.target.value })}
              onKeyDown={handleWrapInputKeyDown}
              onFocus={() => setActiveCellId('problemText')}
              onBlur={() => setActiveCellId(null)}
              placeholder="Describe the problem in current process or method (Press Shift + Enter for new line)..."
            />
          </div>

          {/* Section 2 Header: YOUR VALUABLE SUGGESTION TO IMPROVE THE CURRENT SITUATION */}
          <div
            className="px-3 py-1.5 border-b border-black font-bold text-sm bg-white"
            style={{ textDecoration: 'underline' }}
          >
            YOUR VALUABLE SUGGESTION TO IMPROVE THE CURRENT SITUATION (Give calculation if required):
          </div>

          {/* Section 2 Input */}
          <div className="w-full border-b border-black bg-white p-2">
            <textarea
              className="w-full p-2.5 border border-slate-200 rounded-xs text-sm leading-relaxed text-black bg-white focus:outline-none"
              rows="7"
              wrap="soft"
              style={{
                fontFamily: "'Times New Roman', Times, serif",
                fontSize: '1rem',
                border: activeCellId === 'suggestionText' ? '2px solid #217346' : '1px solid #cbd5e1',
                resize: 'vertical',
                minHeight: '180px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
              value={formData.suggestionText}
              onChange={(e) => setFormData({ ...formData, suggestionText: e.target.value })}
              onKeyDown={handleWrapInputKeyDown}
              onFocus={() => setActiveCellId('suggestionText')}
              onBlur={() => setActiveCellId(null)}
              placeholder="Enter your valuable suggestion to improve the current situation (Press Shift + Enter for new line)..."
            />
          </div>

          {/* Section 3: Bottom Review Table (Down of the Sheet) */}
          <div className="w-full border-b border-black bg-white">
            <div className="grid grid-cols-4 divide-x divide-black">
              {/* Column 1: REJECTED / ACCEPTED */}
              <div className="flex flex-col justify-between" style={{ minHeight: '160px' }}>
                <div className="border-b border-black p-2 text-center font-bold text-xs md:text-sm">
                  REJECTED / ACCEPTED
                </div>
                <div className="p-2 text-center my-auto">
                  <select
                    className="w-full text-center font-bold border-0 bg-transparent text-base cursor-pointer focus:outline-none"
                    style={{
                      fontFamily: "'Times New Roman', Times, serif",
                      color: formData.rejectedAccepted === 'ACCEPTED' ? '#15803d' : formData.rejectedAccepted === 'REJECTED' ? '#b91c1c' : '#64748b',
                      backgroundColor: activeCellId === 'decision' ? '#f0fdf4' : 'transparent',
                    }}
                    value={formData.rejectedAccepted}
                    onChange={(e) => setFormData({ ...formData, rejectedAccepted: e.target.value })}
                    onFocus={() => setActiveCellId('decision')}
                    onBlur={() => setActiveCellId(null)}
                  >
                    <option value="">-- Select Decision --</option>
                    <option value="ACCEPTED">ACCEPTED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
                <div className="p-2 border-t border-black">
                  <div className="font-bold text-xs">Concerned Line Leader Sign.</div>
                  <input
                    type="text"
                    className="excel-cell-input mt-1"
                    style={{
                      border: activeCellId === 'sign1' ? '2px solid #217346' : '1px solid transparent',
                    }}
                    value={formData.lineLeaderSign1}
                    onChange={(e) => setFormData({ ...formData, lineLeaderSign1: e.target.value })}
                    onFocus={() => setActiveCellId('sign1')}
                    onBlur={() => setActiveCellId(null)}
                    placeholder="Sign / Name"
                  />
                </div>
                <div className="p-2 border-t border-black flex items-center gap-1">
                  <span className="font-bold text-xs whitespace-nowrap">Date :</span>
                  <input
                    type="text"
                    className="excel-cell-input"
                    style={{
                      border: activeCellId === 'signDate' ? '2px solid #217346' : '1px solid transparent',
                    }}
                    value={formData.approvalDate}
                    onChange={(e) => setFormData({ ...formData, approvalDate: e.target.value })}
                    onFocus={() => setActiveCellId('signDate')}
                    onBlur={() => setActiveCellId(null)}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </div>

              {/* Column 2: Reason if Rejected */}
              <div className="flex flex-col" style={{ minHeight: '160px' }}>
                <div className="border-b border-black p-2 font-bold text-xs md:text-sm text-[#004b91]">
                  Reason if Rejected
                </div>
                <div className="p-2 flex-1 flex flex-col">
                  <textarea
                    className="excel-cell-input w-full flex-1 p-2 bg-transparent focus:outline-none"
                    style={{
                      border: activeCellId === 'reason' ? '2px solid #217346' : '1px solid transparent',
                      resize: 'none',
                      fontFamily: "'Times New Roman', Times, serif",
                      lineHeight: '1.5',
                    }}
                    value={formData.reasonIfRejected}
                    onChange={(e) => setFormData({ ...formData, reasonIfRejected: e.target.value })}
                    onFocus={() => setActiveCellId('reason')}
                    onBlur={() => setActiveCellId(null)}
                    placeholder="Enter reason if rejected..."
                  />
                </div>
              </div>

              {/* Column 3: Implementation Status */}
              <div className="flex flex-col justify-between" style={{ minHeight: '160px' }}>
                <div className="border-b border-black p-2 font-bold text-xs md:text-sm">
                  Implementation Status
                </div>
                <div className="p-2 border-b border-black">
                  <div className="font-bold text-xs">Target Date :</div>
                  <input
                    type="text"
                    className="excel-cell-input mt-1"
                    style={{
                      border: activeCellId === 'targetDate' ? '2px solid #217346' : '1px solid transparent',
                    }}
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                    onFocus={() => setActiveCellId('targetDate')}
                    onBlur={() => setActiveCellId(null)}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div className="p-2 border-b border-black">
                  <div className="font-bold text-xs">Date of Implementation :</div>
                  <input
                    type="text"
                    className="excel-cell-input mt-1"
                    style={{
                      border: activeCellId === 'implDate' ? '2px solid #217346' : '1px solid transparent',
                    }}
                    value={formData.dateOfImplementation}
                    onChange={(e) => setFormData({ ...formData, dateOfImplementation: e.target.value })}
                    onFocus={() => setActiveCellId('implDate')}
                    onBlur={() => setActiveCellId(null)}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div className="p-2">
                  <div className="font-bold text-xs">Concerned Line Leader Sign.</div>
                  <input
                    type="text"
                    className="excel-cell-input mt-1"
                    style={{
                      border: activeCellId === 'sign2' ? '2px solid #217346' : '1px solid transparent',
                    }}
                    value={formData.lineLeaderSign2}
                    onChange={(e) => setFormData({ ...formData, lineLeaderSign2: e.target.value })}
                    onFocus={() => setActiveCellId('sign2')}
                    onBlur={() => setActiveCellId(null)}
                    placeholder="Sign / Name"
                  />
                </div>
              </div>

              {/* Column 4: Benefit Status & Cost Saving */}
              <div className="flex flex-col justify-between" style={{ minHeight: '160px' }}>
                {/* Benefit Status */}
                <div className="flex flex-col flex-1">
                  <div className="border-b border-black p-2 font-bold text-xs md:text-sm">
                    Benefit Status
                  </div>
                  <div className="p-2 flex-1 flex items-center">
                    <input
                      type="text"
                      className="excel-cell-input w-full"
                      style={{
                        border: activeCellId === 'benefitDetails' ? '2px solid #217346' : '1px solid transparent',
                      }}
                      value={formData.benefitDetails}
                      onChange={(e) => setFormData({ ...formData, benefitDetails: e.target.value })}
                      onFocus={() => setActiveCellId('benefitDetails')}
                      onBlur={() => setActiveCellId(null)}
                      placeholder="Enter Benefit Status..."
                    />
                  </div>
                </div>

                {/* Cost Saving */}
                <div className="border-t border-black flex flex-col flex-1">
                  <div className="border-b border-black p-2 font-bold text-xs md:text-sm">
                    Cost Saving
                  </div>
                  <div className="p-2 flex-1 flex items-center">
                    <input
                      type="text"
                      className="excel-cell-input w-full font-bold text-emerald-700"
                      style={{
                        border: activeCellId === 'costSaving' ? '2px solid #217346' : '1px solid transparent',
                      }}
                      value={formData.costSaving}
                      onChange={(e) => setFormData({ ...formData, costSaving: e.target.value })}
                      onFocus={() => setActiveCellId('costSaving')}
                      onBlur={() => setActiveCellId(null)}
                      placeholder="Enter Cost Saving (e.g. ₹ 1,20,000 / Year)..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Document Reference Footer */}
          <div className="flex justify-between items-center px-4 py-1.5 font-bold text-xs tracking-wider bg-white">
            <div>FRM/ASSY/016</div>
            <div>REV:00/08.10.2012</div>
          </div>
        </div>
      </form>
    </div>
  );
}

