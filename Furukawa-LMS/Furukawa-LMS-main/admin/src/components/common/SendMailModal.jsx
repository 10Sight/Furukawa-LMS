import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Send,
  X,
  Check,
  Loader2,
  Info,
  Plus,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { usePDCA } from '@hooks/pdca/usePDCA.js';
import { listLPAWorkbooks } from '../../pages/lpa/lpaStore.js';
import lpaApi from '../../services/api/lpaApi.js';

/**
 * SendMailModal
 * Clean frontend email modal with blank input fields & multi-CC support:
 *  - LPA Assembly Form
 *  - LPA C&C Form
 *  - PDCA / LPA Observation Form
 */
export default function SendMailModal({
  isOpen,
  onClose,
  formType = 'assembly', // 'assembly' | 'cc' | 'pdca'
  title = 'LPA Check Sheet',
  metadata = {},
  pdcaLabel = 'PDCA',
  assemblySheets: suppliedAssemblySheets,
  pdcaSheets: suppliedPdcaSheets,
  onViewAssemblySheet,
  onViewPDCASheet,
  onSendSuccess
}) {
  const navigate = useNavigate();
  const { data: contextPdcaSheets = [], userContext } = usePDCA();
  const [toInput, setToInput] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [ccEmails, setCcEmails] = useState(['']);
  const [showCc, setShowCc] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [assemblyRecords, setAssemblyRecords] = useState([]);
  const [assemblySelection, setAssemblySelection] = useState('');
  const [pdcaSelection, setPdcaSelection] = useState('');
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [showDefaultMailPopup, setShowDefaultMailPopup] = useState(false);
  const [defaultToEmails, setDefaultToEmails] = useState([]);
  const [defaultCcEmails, setDefaultCcEmails] = useState([]);
  const [defaultToDraft, setDefaultToDraft] = useState([]);
  const [defaultCcDraft, setDefaultCcDraft] = useState([]);
  const [defaultToInput, setDefaultToInput] = useState('');
  const [defaultCcInput, setDefaultCcInput] = useState('');
  const [defaultMailsLoading, setDefaultMailsLoading] = useState(false);
  const [defaultMailsSaving, setDefaultMailsSaving] = useState(false);
  const ccInputsRef = useRef([]);
  const requestInFlightRef = useRef(false);
  const idempotencyKeyRef = useRef('');
  const toInputRef = useRef(null);

  // When modal opens, all input fields are reset to blank, CC is optional/hidden by default
  useEffect(() => {
    if (!isOpen) {
      setSending(false);
      setSentSuccess(false);
      return;
    }
    setToInput('');
    setRecipients([]);
    setCcEmails(['']);
    setShowCc(true);
    setRemarks('');
    setAssemblySelection('');
    setPdcaSelection('');
    setShowDefaultMailPopup(false);
    requestInFlightRef.current = false;
    idempotencyKeyRef.current = window.crypto?.randomUUID?.() || `mail-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    setDefaultMailsLoading(true);
    lpaApi.getDefaultMailRecipients()
      .then((result) => {
        if (!active) return;
        const to = Array.isArray(result?.to) ? result.to : (Array.isArray(result?.emails) ? result.emails : []);
        const cc = Array.isArray(result?.cc) ? result.cc : [];
        setDefaultToEmails(to);
        setDefaultCcEmails(cc);
      })
      .catch((error) => {
        if (active) toast.error(error.response?.data?.message || 'Could not load saved default email addresses.');
      })
      .finally(() => { if (active) setDefaultMailsLoading(false); });
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || Array.isArray(suppliedAssemblySheets)) return undefined;
    let active = true;
    setSheetsLoading(true);
    listLPAWorkbooks(userContext?.user?.id || userContext?.user?._id || 'current')
      .then((records) => { if (active) setAssemblyRecords(Array.isArray(records) ? records : []); })
      .catch(() => { if (active) setAssemblyRecords([]); })
      .finally(() => { if (active) setSheetsLoading(false); });
    return () => { active = false; };
  }, [isOpen, suppliedAssemblySheets, userContext?.user?.id, userContext?.user?._id]);

  const selectedSection = String(metadata.section || metadata.sectionName || metadata.category || (formType === 'cc' ? 'cc' : 'assembly')).toLowerCase().includes('cc') ? 'cc' : 'assembly';
  const assemblySheetLabel = selectedSection === 'cc' ? 'LPA C&C Sheet' : 'LPA Assembly Sheet';
  const assemblyOptions = (Array.isArray(suppliedAssemblySheets) ? suppliedAssemblySheets : assemblyRecords)
    .filter((record) => record && record.section === selectedSection && !record.sampleData)
    .flatMap((record) => (Array.isArray(record.sheets) ? record.sheets : []).map((sheet, sheetIndex) => ({
      key: `${record.id}::${sheetIndex}`,
      record,
      sheet,
      sheetIndex,
      label: [sheet.name || `Sheet ${sheetIndex + 1}`, record.unit, record.auditDate || record.date].filter(Boolean).join(' · ')
    })));
  const pdcaOptions = (Array.isArray(suppliedPdcaSheets) ? suppliedPdcaSheets : contextPdcaSheets)
    .filter((sheet) => sheet && (sheet.id || sheet._id))
    .map((sheet, index) => ({
      key: `${sheet.source === 'lpa' ? 'lpa-' : ''}${sheet.id || sheet._id}-${index}`,
      sheet,
      label: [sheet.topic || sheet.title || 'PDCA Sheet', sheet.plant || sheet.unit, sheet.date].filter(Boolean).join(' · ')
    }));
  const selectedAssembly = assemblyOptions.find((option) => option.key === assemblySelection);
  const selectedPdca = pdcaOptions.find((option) => option.key === pdcaSelection);

  const openAssemblySheet = () => {
    if (!selectedAssembly) return;
    if (typeof onViewAssemblySheet === 'function') {
      onViewAssemblySheet(selectedAssembly);
      return;
    }
    const target = `/cms/lpa?viewWorkbookId=${encodeURIComponent(selectedAssembly.record.id)}&sheetIndex=${selectedAssembly.sheetIndex}`;
    if (window.location.pathname.includes('cms-dashboard')) window.open(target, '_blank', 'noopener,noreferrer');
    else navigate(target);
  };

  const openPdcaSheet = () => {
    if (!selectedPdca) return;
    if (typeof onViewPDCASheet === 'function') {
      onViewPDCASheet(selectedPdca.sheet);
      return;
    }
    const id = selectedPdca.sheet.id || selectedPdca.sheet._id;
    if (window.location.pathname.includes('cms-dashboard')) navigate(`/sheet/${encodeURIComponent(id)}`);
    else navigate(`/cms/pdca?sheet=${encodeURIComponent(id)}`);
  };

  if (!isOpen) return null;

  const addRecipient = (email) => {
    const raw = email !== undefined ? email : toInput;
    if (!raw) return;
    const parts = raw.split(/[,;\s]+/).map(s => s.trim().replace(/[,;]$/, '')).filter(Boolean);
    if (parts.length === 0) return;
    setRecipients(prev => {
      const next = [...prev];
      const existing = new Set(next.map((entry) => entry.toLowerCase()));
      parts.forEach(p => {
        if (!existing.has(p.toLowerCase())) {
          next.push(p);
          existing.add(p.toLowerCase());
        }
      });
      return next;
    });
    setToInput('');
  };

  const removeRecipient = (index) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const handleKeyDownTo = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addRecipient();
    }
  };

  const openDefaultMailPopup = () => {
    setDefaultToDraft(defaultToEmails);
    setDefaultCcDraft(defaultCcEmails);
    setDefaultToInput('');
    setDefaultCcInput('');
    setShowDefaultMailPopup(true);
  };

  const addDefaultEmailDraft = (target) => {
    const isCc = target === 'cc';
    const input = isCc ? defaultCcInput : defaultToInput;
    const draft = isCc ? defaultCcDraft : defaultToDraft;
    const email = input.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email address.');
      return;
    }
    if (draft.some((entry) => entry.toLowerCase() === email)) {
      toast.error(`That email address is already in the default ${target.toUpperCase()} list.`);
      return;
    }
    if (isCc) {
      setDefaultCcDraft((current) => [...current, email]);
      setDefaultCcInput('');
    } else {
      setDefaultToDraft((current) => [...current, email]);
      setDefaultToInput('');
    }
  };

  const saveDefaultEmails = async () => {
    if (defaultToInput.trim() || defaultCcInput.trim()) {
      toast.error('Add or clear both pending email addresses before saving.');
      return;
    }
    const to = [...new Set(defaultToDraft.map((email) => email.trim().toLowerCase()).filter(Boolean))];
    const cc = [...new Set(defaultCcDraft.map((email) => email.trim().toLowerCase()).filter(Boolean))];
    const invalidEmail = [...to, ...cc].find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (invalidEmail) {
      toast.error(`Enter a valid email address: ${invalidEmail}`);
      return;
    }
    setDefaultMailsSaving(true);
    try {
      const result = await lpaApi.saveDefaultMailRecipients(to, cc);
      const savedTo = Array.isArray(result?.to) ? result.to : to;
      const savedCc = Array.isArray(result?.cc) ? result.cc : cc;
      setDefaultToEmails(savedTo);
      setDefaultCcEmails(savedCc);
      setDefaultToDraft(savedTo);
      setDefaultCcDraft(savedCc);
      setShowDefaultMailPopup(false);
      toast.success('Default To and CC addresses saved.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save default email addresses.');
    } finally {
      setDefaultMailsSaving(false);
    }
  };

  const addDefaultEmailsToRecipients = () => {
    const hasDefaults = defaultToEmails.length > 0 || defaultCcEmails.length > 0;
    if (defaultToEmails.length) {
      setRecipients((current) => {
        const next = [...current];
        const existing = new Set(next.map((email) => email.toLowerCase()));
        defaultToEmails.forEach((email) => {
          if (!existing.has(email.toLowerCase())) {
            next.push(email);
            existing.add(email.toLowerCase());
          }
        });
        return next;
      });
    }
    if (defaultCcEmails.length) {
      setShowCc(true);
      setCcEmails((current) => {
        const next = current.flatMap((value) => value.split(/[,;\s]+/).map((email) => email.trim()).filter(Boolean));
        const existing = new Set(next.map((email) => email.toLowerCase()));
        defaultCcEmails.forEach((email) => {
          if (!existing.has(email.toLowerCase())) {
            next.push(email);
            existing.add(email.toLowerCase());
          }
        });
        return next.length ? next : [''];
      });
    }
    if (hasDefaults) toast.success('Saved default To and CC addresses added to their matching fields.');
  };

  // Multiple CC handlers
  const handleAddCcRow = () => {
    setShowCc(true);
    setCcEmails((prev) => {
      const next = [...prev, ''];
      setTimeout(() => {
        const lastInput = ccInputsRef.current[next.length - 1];
        if (lastInput) lastInput.focus();
      }, 50);
      return next;
    });
  };

  const handleRemoveCcRow = (index) => {
    setCcEmails((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [''];
    });
  };

  const handleRemoveCcSection = () => {
    setShowCc(false);
    setCcEmails(['']);
  };

  const handleOpenCcSection = () => {
    setShowCc(true);
    setTimeout(() => {
      const firstInput = ccInputsRef.current[0];
      if (firstInput) firstInput.focus();
    }, 50);
  };

  const handleCcChange = (index, value) => {
    // If user pastes comma/semicolon-separated emails, split into multiple rows
    if (value.includes(',') || value.includes(';')) {
      const parts = value.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      if (parts.length > 1) {
        setCcEmails((prev) => {
          const next = [...prev];
          next.splice(index, 1, ...parts);
          return next;
        });
        return;
      }
    }
    setCcEmails((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleCcKeyDown = (index, e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (index === ccEmails.length - 1) {
        handleAddCcRow();
      } else if (ccInputsRef.current[index + 1]) {
        ccInputsRef.current[index + 1].focus();
      }
    }
  };

  const handleSend = async () => {
    if (requestInFlightRef.current || sentSuccess) return;
    if (!selectedAssembly) {
      toast.error('Please select an Assembly sheet before sending the email.');
      return;
    }
    if (!selectedPdca) {
      toast.error('Please select a PDCA sheet before sending the email.');
      return;
    }
    const parsedInput = toInput.trim() ? toInput.split(/[,;\s]+/).filter(Boolean) : [];
    const finalRecipients = [...new Set([...recipients, ...parsedInput])];
    if (recipients.length === 0 && !toInput.trim()) {
      toast.error('Please enter at least one recipient email address.');
      return;
    }
    const invalidEmail = finalRecipients.find(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (invalidEmail) {
      toast.error(`Please enter a valid email address: ${invalidEmail}`);
      return;
    }
    if (!finalRecipients.length) {
      toast.error('Please enter at least one recipient email address.');
      return;
    }

    const finalCcList = ccEmails.map(e => e.trim()).filter(Boolean);
    const invalidCcEmail = finalCcList.find(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (invalidCcEmail) {
      toast.error(`Please enter a valid CC email address: ${invalidCcEmail}`);
      return;
    }

    requestInFlightRef.current = true;
    setSending(true);
    try {
      const selectedAssemblyPayload = {
        workbookId: selectedAssembly.record.id || selectedAssembly.record._id,
        sheetIndex: selectedAssembly.sheetIndex,
        section: selectedSection,
        name: selectedAssembly.sheet.name || `Sheet ${selectedAssembly.sheetIndex + 1}`,
        unit: selectedAssembly.record.unit || '',
        date: selectedAssembly.record.auditDate || selectedAssembly.record.date || ''
      };
      const selectedPdcaPayload = {
        id: selectedPdca.sheet.id || selectedPdca.sheet._id,
        source: selectedPdca.sheet.source === 'lpa' ? 'lpa' : 'pdca',
        name: selectedPdca.sheet.topic || selectedPdca.sheet.title || 'PDCA Sheet',
        section: selectedPdca.sheet.section || selectedSection,
        unit: selectedPdca.sheet.plant || selectedPdca.sheet.unit || '',
        date: selectedPdca.sheet.date || ''
      };
      const providerResult = await lpaApi.sendEmail({
        to: finalRecipients,
        cc: finalCcList,
        remarks,
        assemblySheet: selectedAssemblyPayload,
        pdcaSheet: selectedPdcaPayload
      }, idempotencyKeyRef.current);

      setSentSuccess(true);
      toast.success(`Email accepted by the mail service for ${finalRecipients.join(', ')}`);
      if (typeof onSendSuccess === 'function') {
        try {
          onSendSuccess({
            recipients: finalRecipients,
            cc: finalCcList,
            remarks,
            assemblySheet: { ...selectedAssemblyPayload, data: selectedAssembly.sheet },
            pdcaSheet: selectedPdcaPayload.id,
            pdcaSheetData: selectedPdca.sheet,
            providerResult
          });
        } catch (callbackError) {
          console.error('Email was accepted, but the post-send callback failed.', callbackError);
        }
      }
      setTimeout(onClose, 900);
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Email could not be sent. Please try again.';
      toast.error(message);
    } finally {
      setSending(false);
      requestInFlightRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        style={{ minHeight: 'min(620px, 90vh)' }}
        className="w-full max-w-3xl max-h-[96vh] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-mail-modal-title"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 id="send-mail-modal-title" className="text-sm font-bold text-slate-800 flex items-center gap-2">
                Send Email
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {formType === 'pdca' ? 'PDCA Report' : formType === 'cc' ? 'C&C LPA' : 'Assembly LPA'}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Email this completed sheet directly to team members.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { openDefaultMailPopup(); addDefaultEmailsToRecipients(); }}
              disabled={sending || defaultMailsLoading}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg whitespace-nowrap disabled:opacity-50"
              title="Manage saved default To and CC addresses"
            >
              Add Default Mails
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          {/* TO Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <span>To (Recipients)</span>
                <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                {!showCc && (
                  <button
                    type="button"
                    onClick={handleOpenCcSection}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-0.5 rounded-md font-semibold text-xs border border-transparent hover:border-blue-200 transition-all cursor-pointer"
                    title="Add CC recipients (optional)"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Add CC</span>
                  </button>
                )}
              </div>
            </div>

            {/* Recipient Pills + Input Box */}
            <div className="min-h-[38px] p-1.5 border border-slate-300 rounded-lg bg-white flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-600 transition-all">
              {recipients.map((email, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-md text-xs font-medium"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeRecipient(idx)}
                    className="text-blue-400 hover:text-blue-700 p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                ref={toInputRef}
                type="email"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                onKeyDown={handleKeyDownTo}
                onBlur={() => toInput.trim() && addRecipient()}
                placeholder={recipients.length === 0 ? "Type recipient email and press Enter..." : "Add more emails..."}
                className="flex-1 min-w-[160px] border-none outline-none text-xs text-slate-800 bg-transparent px-1 py-0.5 placeholder:text-slate-400"
              />
              <button type="button" onClick={() => toInput.trim() ? addRecipient() : toInputRef.current?.focus()} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800" title="Add another To recipient">
                <Plus className="w-3.5 h-3.5" />Add Mail
              </button>
            </div>
          </div>

          {/* CC Field (Multi-CC with Rows & Add More Button) */}
          {showCc && (
            <div className="animate-in fade-in duration-100 bg-slate-50/70 p-3 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="font-semibold text-slate-700">CC (Carbon Copy)</label>
                  {ccEmails.filter(e => e.trim()).length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700">
                      {ccEmails.filter(e => e.trim()).length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleAddCcRow}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold text-[11px] cursor-pointer"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>Add Another CC</span>
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={handleRemoveCcSection}
                    className="text-slate-400 hover:text-rose-600 text-[11px] cursor-pointer transition-colors"
                  >
                    Remove CC
                  </button>
                </div>
              </div>

              {/* Multiple CC Input Rows */}
              <div className="space-y-1.5">
                {ccEmails.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      ref={(el) => (ccInputsRef.current[idx] = el)}
                      type="email"
                      value={email}
                      onChange={(e) => handleCcChange(idx, e.target.value)}
                      onKeyDown={(e) => handleCcKeyDown(idx, e)}
                      placeholder={idx === 0 ? "Type CC email..." : `Type CC email ${idx + 1}...`}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 placeholder:text-slate-400 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCcRow(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove this CC"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add another CC Button */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={handleAddCcRow}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-100/60 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Add another CC</span>
                </button>
              </div>
            </div>
          )}

          {/* Remarks Field */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Remarks
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add remarks for the email..."
              rows={2}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 font-medium placeholder:text-slate-400 resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label htmlFor="mail-assembly-sheet" className="block font-semibold text-slate-700 mb-1.5">
                {assemblySheetLabel} <span className="text-red-500">*</span>
              </label>
              <select
                id="mail-assembly-sheet"
                required
                value={assemblySelection}
                onChange={(event) => setAssemblySelection(event.target.value)}
                className="w-full min-w-0 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                <option value="">{sheetsLoading ? 'Loading sheets…' : `Select a ${assemblySheetLabel}…`}</option>
                {assemblyOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
              {selectedAssembly && (
                <button type="button" onClick={openAssemblySheet} className="mt-1.5 text-blue-600 hover:text-blue-800 hover:underline font-semibold">
                  View Sheet
                </button>
              )}
            </div>

            <div className="min-w-0">
              <label htmlFor="mail-pdca-sheet" className="block font-semibold text-slate-700 mb-1.5">
                {pdcaLabel} <span className="text-red-500">*</span>
              </label>
              <select
                id="mail-pdca-sheet"
                required
                value={pdcaSelection}
                onChange={(event) => setPdcaSelection(event.target.value)}
                className="w-full min-w-0 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                <option value="">Select a {pdcaLabel} sheet…</option>
                {pdcaOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
              {selectedPdca && (
                <button type="button" onClick={openPdcaSheet} className="mt-1.5 text-blue-600 hover:text-blue-800 hover:underline font-semibold">
                  View Sheet
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>Select the requested sheets before sending the email</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 border border-slate-300 bg-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || sentSuccess}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-75"
            >
              {sending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending Mail...</span>
                </>
              ) : sentSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Mail Sent!</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Mail</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      {showDefaultMailPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/30" role="presentation">
          <section style={{ minHeight: 'min(480px, 85vh)' }} className="w-full max-w-xl max-h-[92vh] rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="default-mails-title">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h3 id="default-mails-title" className="text-sm font-bold text-slate-800">Default mail recipients</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">Manage To and CC defaults separately. Save both lists together.</p>
              </div>
              <button type="button" onClick={() => setShowDefaultMailPopup(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close default email addresses">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-4 flex-1">
              {[
                { target: 'to', title: 'Default Recipients (To)', draft: defaultToDraft, setDraft: setDefaultToDraft, input: defaultToInput, setInput: setDefaultToInput },
                { target: 'cc', title: 'Default CC', draft: defaultCcDraft, setDraft: setDefaultCcDraft, input: defaultCcInput, setInput: setDefaultCcInput }
              ].map(({ target, title: sectionTitle, draft, setDraft, input, setInput }) => (
                <section key={target} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <h4 className="text-xs font-bold text-slate-700">{sectionTitle}</h4>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addDefaultEmailDraft(target); } }}
                      placeholder={`Enter ${target.toUpperCase()} email address`}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button type="button" onClick={() => addDefaultEmailDraft(target)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                      <Plus className="h-3.5 w-3.5" /> Add Mail
                    </button>
                  </div>
                  <div className="max-h-36 space-y-1.5 overflow-y-auto">
                    {defaultMailsLoading ? <p className="py-2 text-xs text-slate-500">Loading saved addresses…</p> : draft.length ? draft.map((email, index) => (
                      <div key={`${email}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                        <span className="break-all">{email}</span>
                        <button type="button" onClick={() => setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="ml-2 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title={`Remove ${target.toUpperCase()} address`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )) : <p className="py-2 text-xs text-slate-500">No default addresses saved yet.</p>}
                  </div>
                </section>
              ))}
              </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-[11px] text-slate-500">Saved To and CC defaults are added to their matching fields when you click Add Default Mails.</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowDefaultMailPopup(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="button" onClick={saveDefaultEmails} disabled={defaultMailsLoading || defaultMailsSaving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {defaultMailsSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
