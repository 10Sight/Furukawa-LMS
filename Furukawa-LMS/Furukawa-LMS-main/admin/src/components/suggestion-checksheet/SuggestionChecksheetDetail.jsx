import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { ArrowLeft, CheckCircle2, Printer, Lock, Check, AlertCircle, Calendar } from 'lucide-react';
import fmeLogo from './assets/suggestionChecksheetLogo.png';

function normalizeDateToYMD(val) {
  if (!val) return '';
  const trimmed = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return '';
}

export default function SuggestionChecksheetDetail({ item, onBack, onSave }) {
  const authUser = useSelector((state) => state.auth?.user);
  const currentUserName =
    authUser?.fullName ||
    authUser?.name ||
    authUser?.userName ||
    (authUser?.empId ? `EMP: ${authUser.empId}` : 'Line Leader');

  const getTodayDateStr = () => new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    unit: item?.unit || 'Bawal',
    date: normalizeDateToYMD(item?.date) || getTodayDateStr(),
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
    targetDate: normalizeDateToYMD(item?.targetDate) || '',
    dateOfImplementation: normalizeDateToYMD(item?.dateOfImplementation) || '',
    lineLeaderSign1: item?.lineLeaderSign1 || '',
    lineLeaderSign2: item?.lineLeaderSign2 || '',
    approvalDate: normalizeDateToYMD(item?.approvalDate) || '',
    costSaving: item?.costSaving || '',
    benefitDetails: item?.benefitStatusDetails || item?.benefitDetails || '',
  });

  const [activeCellId, setActiveCellId] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Freezing states
  const isAccepted = formData.rejectedAccepted === 'ACCEPTED';
  const isRejected = formData.rejectedAccepted === 'REJECTED';

  // Toggle category checkbox
  const handleToggleCategory = (catKey) => {
    setFormData((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }));
  };

  // Keyboard navigation
  const handleWrapInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
    }
  };

  // Decision change (ACCEPTED / REJECTED)
  const handleDecisionChange = (decision) => {
    setErrorMessage('');
    const today = getTodayDateStr();

    setFormData((prev) => {
      if (decision === 'ACCEPTED') {
        return {
          ...prev,
          rejectedAccepted: 'ACCEPTED',
          // Auto fill Concerned Line Leader Sign. and Date through login info
          lineLeaderSign1: prev.lineLeaderSign1 || currentUserName,
          approvalDate: prev.approvalDate || today,
        };
      } else if (decision === 'REJECTED') {
        return {
          ...prev,
          rejectedAccepted: 'REJECTED',
          // Auto fill Concerned Line Leader Sign. and Date through login info
          lineLeaderSign1: prev.lineLeaderSign1 || currentUserName,
          approvalDate: prev.approvalDate || today,
        };
      } else {
        return {
          ...prev,
          rejectedAccepted: '',
        };
      }
    });
  };

  // When Date of Implementation is filled -> Auto fill Concerned Line Leader Sign. (Sign 2) through login info
  const handleDateOfImplementationChange = (val) => {
    setErrorMessage('');
    setFormData((prev) => ({
      ...prev,
      dateOfImplementation: val,
      lineLeaderSign2: val ? (prev.lineLeaderSign2 || currentUserName) : prev.lineLeaderSign2,
    }));
  };

  // Save form with mandatory validations
  const handleSaveForm = (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    // Rule 1: Accepted -> Target Date is MANDATORY
    if (formData.rejectedAccepted === 'ACCEPTED') {
      if (!formData.targetDate || !formData.targetDate.trim()) {
        const msg = 'Implementation Status Target Date is mandatory when Suggestion is Accepted.';
        setErrorMessage(msg);
        alert(msg);
        return;
      }
    }

    // Rule 2: Rejected -> Reason if Rejected is MANDATORY
    if (formData.rejectedAccepted === 'REJECTED') {
      if (!formData.reasonIfRejected || !formData.reasonIfRejected.trim()) {
        const msg = 'Reason if Rejected is mandatory when Suggestion is Rejected.';
        setErrorMessage(msg);
        alert(msg);
        return;
      }
    }

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
        status:
          formData.rejectedAccepted === 'ACCEPTED'
            ? 'Approved'
            : formData.rejectedAccepted === 'REJECTED'
            ? 'Rejected'
            : item?.status || 'Pending',
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

        {errorMessage && (
          <div className="bg-red-50 text-red-800 border border-red-200 py-1 px-3 text-xs rounded-full inline-flex items-center gap-1.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
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
            {/* DATE (with Calendar Picker) */}
            <div className="flex items-center px-3 py-1.5 border-r border-black" style={{ width: '35%' }}>
              <span className="font-bold whitespace-nowrap mr-2">DATE:-</span>
              <input
                type="date"
                className="excel-cell-input flex-1 cursor-pointer bg-transparent"
                style={{
                  border: activeCellId === 'date' ? '2px solid #217346' : '1px solid transparent',
                  fontFamily: "'Times New Roman', Times, serif",
                }}
                value={normalizeDateToYMD(formData.date)}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                onFocus={() => setActiveCellId('date')}
                onBlur={() => setActiveCellId(null)}
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
              <div className="flex flex-col justify-between" style={{ minHeight: '170px' }}>
                <div className="border-b border-black p-2 text-center font-bold text-xs md:text-sm">
                  REJECTED / ACCEPTED
                </div>
                <div className="p-2 text-center my-auto">
                  <select
                    className="w-full text-center font-bold border-0 bg-transparent text-base cursor-pointer focus:outline-none"
                    style={{
                      fontFamily: "'Times New Roman', Times, serif",
                      color:
                        formData.rejectedAccepted === 'ACCEPTED'
                          ? '#15803d'
                          : formData.rejectedAccepted === 'REJECTED'
                          ? '#b91c1c'
                          : '#64748b',
                      backgroundColor: activeCellId === 'decision' ? '#f0fdf4' : 'transparent',
                    }}
                    value={formData.rejectedAccepted}
                    onChange={(e) => handleDecisionChange(e.target.value)}
                    onFocus={() => setActiveCellId('decision')}
                    onBlur={() => setActiveCellId(null)}
                  >
                    <option value="">-- Select Decision --</option>
                    <option value="ACCEPTED">ACCEPTED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>

                {/* Concerned Line Leader Sign. (Auto filled by login info on ACCEPTED/REJECTED) */}
                <div className="p-2 border-t border-black bg-white">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">Concerned Line Leader Sign.</span>
                    {formData.rejectedAccepted && (
                      <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                        Auto-filled
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    className="excel-cell-input mt-1 font-semibold"
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

                {/* Date : (Auto filled on ACCEPTED/REJECTED + Calendar Picker) */}
                <div className="p-2 border-t border-black flex items-center gap-1.5 bg-white">
                  <span className="font-bold text-xs whitespace-nowrap">Date :</span>
                  <input
                    type="date"
                    className="excel-cell-input flex-1 cursor-pointer bg-transparent"
                    style={{
                      border: activeCellId === 'signDate' ? '2px solid #217346' : '1px solid transparent',
                      fontFamily: "'Times New Roman', Times, serif",
                    }}
                    value={normalizeDateToYMD(formData.approvalDate)}
                    onChange={(e) => setFormData({ ...formData, approvalDate: e.target.value })}
                    onFocus={() => setActiveCellId('signDate')}
                    onBlur={() => setActiveCellId(null)}
                  />
                </div>
              </div>

              {/* Column 2: Reason if Rejected (Freezed if ACCEPTED, Mandatory if REJECTED) */}
              <div
                className={`flex flex-col transition-colors ${
                  isAccepted ? 'bg-slate-100 opacity-75' : 'bg-white'
                }`}
                style={{ minHeight: '170px' }}
              >
                <div className="border-b border-black p-2 font-bold text-xs md:text-sm flex items-center justify-between text-[#004b91]">
                  <span>Reason if Rejected</span>
                  {isAccepted && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-semibold bg-slate-200 px-1.5 py-0.5 rounded">
                      <Lock className="w-3 h-3" /> Freezed
                    </span>
                  )}
                  {isRejected && (
                    <span className="text-[11px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">
                      * Mandatory
                    </span>
                  )}
                </div>
                <div className="p-2 flex-1 flex flex-col">
                  <textarea
                    disabled={isAccepted}
                    className={`excel-cell-input w-full flex-1 p-2 focus:outline-none ${
                      isAccepted
                        ? 'bg-transparent text-slate-500 cursor-not-allowed italic'
                        : 'bg-transparent text-black'
                    }`}
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
                    placeholder={
                      isAccepted
                        ? 'Freezed (Suggestion is Accepted)'
                        : isRejected
                        ? 'Enter reason for rejection (* Required)...'
                        : 'Enter reason if rejected...'
                    }
                  />
                </div>
              </div>

              {/* Column 3: Implementation Status (Freezed if REJECTED, Target Date Mandatory if ACCEPTED) */}
              <div
                className={`flex flex-col justify-between transition-colors ${
                  isRejected ? 'bg-slate-100 opacity-75' : 'bg-white'
                }`}
                style={{ minHeight: '170px' }}
              >
                <div className="border-b border-black p-2 font-bold text-xs md:text-sm flex items-center justify-between">
                  <span>Implementation Status</span>
                  {isRejected && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-semibold bg-slate-200 px-1.5 py-0.5 rounded">
                      <Lock className="w-3 h-3" /> Freezed
                    </span>
                  )}
                </div>

                {/* Target Date (with Calendar Picker; Mandatory when ACCEPTED) */}
                <div className="p-2 border-b border-black">
                  <div className="flex items-center justify-between font-bold text-xs">
                    <span>Target Date :</span>
                    {isAccepted && (
                      <span className="text-[10px] text-red-600 font-bold bg-red-50 px-1 rounded">
                        * Mandatory
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    disabled={isRejected}
                    className={`excel-cell-input mt-1 cursor-pointer w-full bg-transparent ${
                      isRejected ? 'cursor-not-allowed text-slate-500' : ''
                    }`}
                    style={{
                      border: activeCellId === 'targetDate' ? '2px solid #217346' : '1px solid transparent',
                      fontFamily: "'Times New Roman', Times, serif",
                    }}
                    value={normalizeDateToYMD(formData.targetDate)}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                    onFocus={() => setActiveCellId('targetDate')}
                    onBlur={() => setActiveCellId(null)}
                  />
                </div>

                {/* Date of Implementation (with Calendar Picker; fills Sign 2 when entered) */}
                <div className="p-2 border-b border-black">
                  <div className="font-bold text-xs">Date of Implementation :</div>
                  <input
                    type="date"
                    disabled={isRejected}
                    className={`excel-cell-input mt-1 cursor-pointer w-full bg-transparent ${
                      isRejected ? 'cursor-not-allowed text-slate-500' : ''
                    }`}
                    style={{
                      border: activeCellId === 'implDate' ? '2px solid #217346' : '1px solid transparent',
                      fontFamily: "'Times New Roman', Times, serif",
                    }}
                    value={normalizeDateToYMD(formData.dateOfImplementation)}
                    onChange={(e) => handleDateOfImplementationChange(e.target.value)}
                    onFocus={() => setActiveCellId('implDate')}
                    onBlur={() => setActiveCellId(null)}
                  />
                </div>

                {/* Concerned Line Leader Sign. (Auto filled when Date of Implementation is entered) */}
                <div className="p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">Concerned Line Leader Sign.</span>
                    {formData.dateOfImplementation && !isRejected && (
                      <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                        Auto-filled
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    disabled={isRejected}
                    className={`excel-cell-input mt-1 font-semibold ${
                      isRejected ? 'cursor-not-allowed text-slate-500 bg-transparent' : ''
                    }`}
                    style={{
                      border: activeCellId === 'sign2' ? '2px solid #217346' : '1px solid transparent',
                    }}
                    value={formData.lineLeaderSign2}
                    onChange={(e) => setFormData({ ...formData, lineLeaderSign2: e.target.value })}
                    onFocus={() => setActiveCellId('sign2')}
                    onBlur={() => setActiveCellId(null)}
                    placeholder={isRejected ? 'Freezed (Rejected)' : 'Sign / Name'}
                  />
                </div>
              </div>

              {/* Column 4: Benefit Status & Cost Saving (Freezed if REJECTED) */}
              <div
                className={`flex flex-col justify-between transition-colors ${
                  isRejected ? 'bg-slate-100 opacity-75' : 'bg-white'
                }`}
                style={{ minHeight: '170px' }}
              >
                {/* Benefit Status */}
                <div className="flex flex-col flex-1">
                  <div className="border-b border-black p-2 font-bold text-xs md:text-sm flex items-center justify-between">
                    <span>Benefit Status</span>
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-semibold bg-slate-200 px-1.5 py-0.5 rounded">
                        <Lock className="w-3 h-3" /> Freezed
                      </span>
                    )}
                  </div>
                  <div className="p-2 flex-1 flex items-center">
                    <input
                      type="text"
                      disabled={isRejected}
                      className={`excel-cell-input w-full ${
                        isRejected ? 'cursor-not-allowed text-slate-500 bg-transparent' : ''
                      }`}
                      style={{
                        border: activeCellId === 'benefitDetails' ? '2px solid #217346' : '1px solid transparent',
                      }}
                      value={formData.benefitDetails}
                      onChange={(e) => setFormData({ ...formData, benefitDetails: e.target.value })}
                      onFocus={() => setActiveCellId('benefitDetails')}
                      onBlur={() => setActiveCellId(null)}
                      placeholder={isRejected ? 'Freezed (Rejected)' : 'Enter Benefit Status...'}
                    />
                  </div>
                </div>

                {/* Cost Saving */}
                <div className="border-t border-black flex flex-col flex-1">
                  <div className="border-b border-black p-2 font-bold text-xs md:text-sm flex items-center justify-between">
                    <span>Cost Saving</span>
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-semibold bg-slate-200 px-1.5 py-0.5 rounded">
                        <Lock className="w-3 h-3" /> Freezed
                      </span>
                    )}
                  </div>
                  <div className="p-2 flex-1 flex items-center">
                    <input
                      type="text"
                      disabled={isRejected}
                      className={`excel-cell-input w-full font-bold ${
                        isRejected ? 'cursor-not-allowed text-slate-500 bg-transparent' : 'text-emerald-700'
                      }`}
                      style={{
                        border: activeCellId === 'costSaving' ? '2px solid #217346' : '1px solid transparent',
                      }}
                      value={formData.costSaving}
                      onChange={(e) => setFormData({ ...formData, costSaving: e.target.value })}
                      onFocus={() => setActiveCellId('costSaving')}
                      onBlur={() => setActiveCellId(null)}
                      placeholder={isRejected ? 'Freezed (Rejected)' : 'Enter Cost Saving (e.g. ₹ 1,20,000 / Year)...'}
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
