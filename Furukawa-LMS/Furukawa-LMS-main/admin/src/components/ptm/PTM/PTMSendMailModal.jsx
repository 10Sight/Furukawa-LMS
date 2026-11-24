import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Send,
  X,
  Check,
  Loader2,
  Info,
  Plus,
  Trash2,
} from 'lucide-react';
import { ptmMailApi } from '../../../pages/ptm/services/api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ptm-mail-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * PTMSendMailModal
 * Dedicated email modal for PTM sheets with identical functionality to the PDCA mail modal:
 *  - To (Recipients) chip input
 *  - Multi-row CC support
 *  - Default To & CC management (Add / Attach / Remove Default Mails)
 *  - Remarks & PTM metrics email dispatch
 */
export default function PTMSendMailModal({
  isOpen,
  onClose,
  ptmSheet = null,
  title = 'PTM Sheet',
  onSendSuccess,
  onNotify,
}) {
  const [toInput, setToInput] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [ccEmails, setCcEmails] = useState(['']);
  const [showCc, setShowCc] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [showDefaultMailPopup, setShowDefaultMailPopup] = useState(false);
  const [defaultToEmails, setDefaultToEmails] = useState([]);
  const [defaultCcEmails, setDefaultCcEmails] = useState([]);
  const [defaultToDraft, setDefaultToDraft] = useState([]);
  const [defaultCcDraft, setDefaultCcDraft] = useState([]);
  const [defaultMailsLoading, setDefaultMailsLoading] = useState(false);
  const [defaultMailsSaving, setDefaultMailsSaving] = useState(false);
  const [attachedDefaultToEmails, setAttachedDefaultToEmails] = useState([]);
  const [attachedDefaultCcEmails, setAttachedDefaultCcEmails] = useState([]);

  const ccInputsRef = useRef([]);
  const requestInFlightRef = useRef(false);
  const idempotencyKeyRef = useRef('');
  const toInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setSending(false);
      setSentSuccess(false);
      requestInFlightRef.current = false;
      idempotencyKeyRef.current = '';
      setShowDefaultMailPopup(false);
      return undefined;
    }

    idempotencyKeyRef.current = createIdempotencyKey();
    setToInput('');
    setRecipients([]);
    setCcEmails(['']);
    setShowCc(false);
    setRemarks('');
    setErrorMessage('');
    setAttachedDefaultToEmails([]);
    setAttachedDefaultCcEmails([]);

    let active = true;
    setDefaultMailsLoading(true);
    ptmMailApi
      .getDefaultMailRecipients()
      .then((result) => {
        if (!active) return;
        const to = Array.isArray(result?.to) ? result.to : [];
        const cc = Array.isArray(result?.cc) ? result.cc : [];
        setDefaultToEmails(to);
        setDefaultCcEmails(cc);
        setDefaultToDraft(to);
        setDefaultCcDraft(cc);
      })
      .catch(() => {
        if (active) {
          setDefaultToEmails([]);
          setDefaultCcEmails([]);
        }
      })
      .finally(() => {
        if (active) setDefaultMailsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const notify = (type, message) => {
    if (type === 'error') {
      setErrorMessage(message);
      onNotify?.(`⚠️ ${message}`);
    } else {
      setErrorMessage('');
      onNotify?.(message);
    }
  };

  const addRecipient = (rawValue = toInput) => {
    const parts = String(rawValue || '')
      .split(/[,;\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!parts.length) return;

    const invalid = parts.find((email) => !EMAIL_PATTERN.test(email));
    if (invalid) {
      notify('error', `Please enter a valid email address: ${invalid}`);
      return;
    }

    setRecipients((prev) => {
      const next = [...prev];
      const existing = new Set(next.map((e) => e.toLowerCase()));
      parts.forEach((email) => {
        if (!existing.has(email.toLowerCase())) {
          next.push(email);
          existing.add(email.toLowerCase());
        }
      });
      return next;
    });
    setToInput('');
  };

  const removeRecipient = (index) => {
    setRecipients((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleKeyDownTo = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault();
      addRecipient();
    } else if (e.key === 'Backspace' && !toInput && recipients.length > 0) {
      setRecipients((prev) => prev.slice(0, -1));
    }
  };

  const openDefaultMailPopup = () => {
    setDefaultToDraft(defaultToEmails.length ? [...defaultToEmails] : ['']);
    setDefaultCcDraft(defaultCcEmails.length ? [...defaultCcEmails] : ['']);
    setShowDefaultMailPopup(true);
  };

  const addDefaultEmailDraft = (target) => {
    const setDraft = target === 'cc' ? setDefaultCcDraft : setDefaultToDraft;
    setDraft((current) => [...current, '']);
  };

  const changeDefaultEmailDraft = (target, index, value) => {
    const setDraft = target === 'cc' ? setDefaultCcDraft : setDefaultToDraft;
    setDraft((current) => current.map((item, rowIndex) => (rowIndex === index ? value : item)));
  };

  const removeDefaultEmailDraft = (target, index) => {
    const setDraft = target === 'cc' ? setDefaultCcDraft : setDefaultToDraft;
    setDraft((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const saveDefaultEmails = async () => {
    const to = [...new Set(defaultToDraft.map((email) => email.trim().toLowerCase()).filter(Boolean))];
    const cc = [...new Set(defaultCcDraft.map((email) => email.trim().toLowerCase()).filter(Boolean))];
    const invalidEmail = [...defaultToDraft, ...defaultCcDraft]
      .map((email) => email.trim())
      .find((email) => email && !EMAIL_PATTERN.test(email));
    if (invalidEmail) {
      notify('error', `Enter a valid email address: ${invalidEmail}`);
      return;
    }
    const hasDuplicate = (addresses) => {
      const values = addresses.map((email) => email.trim().toLowerCase()).filter(Boolean);
      return new Set(values).size !== values.length;
    };
    if (hasDuplicate(defaultToDraft) || hasDuplicate(defaultCcDraft)) {
      notify('error', 'Remove duplicate addresses within the To or CC list before saving.');
      return;
    }

    setDefaultMailsSaving(true);
    try {
      const result = await ptmMailApi.saveDefaultMailRecipients(to, cc);
      const savedTo = Array.isArray(result?.to) ? result.to : to;
      const savedCc = Array.isArray(result?.cc) ? result.cc : cc;
      setDefaultToEmails(savedTo);
      setDefaultCcEmails(savedCc);
      setDefaultToDraft(savedTo);
      setDefaultCcDraft(savedCc);
      setShowDefaultMailPopup(false);
      notify('success', 'Default To and CC addresses saved.');
    } catch (error) {
      notify('error', error?.message || 'Could not save default email addresses.');
    } finally {
      setDefaultMailsSaving(false);
    }
  };

  const addDefaultEmailsToRecipients = () => {
    if (defaultMailsLoading) return;
    const to = defaultToEmails;
    const cc = defaultCcEmails;
    const hasDefaults = to.length > 0 || cc.length > 0;
    const addedTo = to.filter((email) => !recipients.some((existing) => existing.trim().toLowerCase() === email.toLowerCase()));
    const currentCc = ccEmails.flatMap((value) => value.split(/[,;\s]+/).map((email) => email.trim()).filter(Boolean));
    const addedCc = cc.filter((email) => !currentCc.some((existing) => existing.toLowerCase() === email.toLowerCase()));

    if (to.length) {
      setRecipients((current) => {
        const next = [...current];
        const existing = new Set(next.map((email) => email.toLowerCase()));
        to.forEach((email) => {
          if (!existing.has(email.toLowerCase())) {
            next.push(email);
            existing.add(email.toLowerCase());
          }
        });
        return next;
      });
    }
    if (cc.length) {
      setShowCc(true);
      setCcEmails((current) => {
        const next = current.flatMap((value) => value.split(/[,;\s]+/).map((email) => email.trim()).filter(Boolean));
        const existing = new Set(next.map((email) => email.toLowerCase()));
        cc.forEach((email) => {
          if (!existing.has(email.toLowerCase())) {
            next.push(email);
            existing.add(email.toLowerCase());
          }
        });
        return next.length ? next : [''];
      });
    }
    setAttachedDefaultToEmails((current) => [...new Set([...current, ...addedTo.map((email) => email.toLowerCase())])]);
    setAttachedDefaultCcEmails((current) => [...new Set([...current, ...addedCc.map((email) => email.toLowerCase())])]);
    if (hasDefaults) notify('success', 'Saved default To and CC addresses added to their matching fields.');
    else notify('info', 'No default To or CC addresses are configured.');
  };

  const removeAttachedDefaultEmails = () => {
    const toSet = new Set(attachedDefaultToEmails);
    const ccSet = new Set(attachedDefaultCcEmails);
    setRecipients((current) => current.filter((email) => !toSet.has(email.trim().toLowerCase())));
    setCcEmails((current) => {
      const remaining = current
        .flatMap((value) => value.split(/[,;\s]+/).map((email) => email.trim()).filter(Boolean))
        .filter((email) => !ccSet.has(email.toLowerCase()));
      return remaining.length ? remaining : [''];
    });
    setAttachedDefaultToEmails([]);
    setAttachedDefaultCcEmails([]);
    notify('success', 'Attached default addresses removed.');
  };

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
    if (value.includes(',') || value.includes(';')) {
      const parts = value.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
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
    setErrorMessage('');
    if (!ptmSheet) {
      notify('error', 'No PTM sheet is selected.');
      return;
    }

    const parsedInput = toInput.trim() ? toInput.split(/[,;\s]+/).filter(Boolean) : [];
    const finalRecipients = [...new Set([...recipients, ...parsedInput])];
    if (recipients.length === 0 && !toInput.trim()) {
      notify('error', 'Please enter at least one recipient email address.');
      return;
    }
    const invalidEmail = finalRecipients.find((email) => !EMAIL_PATTERN.test(email));
    if (invalidEmail) {
      notify('error', `Please enter a valid email address: ${invalidEmail}`);
      return;
    }
    if (!finalRecipients.length) {
      notify('error', 'Please enter at least one recipient email address.');
      return;
    }

    const finalCcList = ccEmails.map((e) => e.trim()).filter(Boolean);
    const invalidCcEmail = finalCcList.find((email) => !EMAIL_PATTERN.test(email));
    if (invalidCcEmail) {
      notify('error', `Please enter a valid CC email address: ${invalidCcEmail}`);
      return;
    }

    requestInFlightRef.current = true;
    setSending(true);
    try {
      const rawRows = Array.isArray(ptmSheet.rows) ? ptmSheet.rows : [];
      let inProgress = 0;
      let done = 0;
      let delay = 0;
      let notStarted = 0;

      rawRows.forEach((r) => {
        if (!r) return;
        const hasData = Boolean(
          r.phaseName || r.reqNo || r.customerEvent || r.activity || r.deliverable || r.startDatePlan || r.endDatePlan || r.status
        );
        if (!hasData) return;

        const rawStatus = String(r.status || '').trim().toLowerCase();
        const hitMiss = String(r.hitMiss || '').trim().toUpperCase();

        if (rawStatus === 'done' || rawStatus === 'closed') {
          done += 1;
        } else if (rawStatus === 'delay' || rawStatus === 'delayed' || hitMiss === 'MISS') {
          delay += 1;
        } else if (
          rawStatus === 'in-progress' ||
          rawStatus === 'in progress' ||
          rawStatus === 'in - progress' ||
          rawStatus === 'in- progress'
        ) {
          inProgress += 1;
        } else {
          notStarted += 1;
        }
      });

      const emailPayload = {
        to: finalRecipients,
        cc: finalCcList,
        remarks,
        portalBaseUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
        ptmSheet: {
          id: ptmSheet.id,
          sheetKey: ptmSheet.sheetKey,
          topic: ptmSheet.topic || ptmSheet.title || title,
          title: ptmSheet.title || ptmSheet.topic || title,
          unit: ptmSheet.unit || '',
          rows: rawRows,
          metrics: { inProgress, done, delay, notStarted },
        },
      };

      const providerResult = await ptmMailApi.sendEmail(emailPayload, idempotencyKeyRef.current);
      setSentSuccess(true);
      notify('success', `Email accepted by the mail service for ${finalRecipients.join(', ')}`);
      if (typeof onSendSuccess === 'function') {
        try {
          onSendSuccess({ recipients: finalRecipients, cc: finalCcList, remarks, providerResult });
        } catch (callbackError) {
          console.error('Email was accepted, but the post-send callback failed.', callbackError);
        }
      }
      setTimeout(onClose, 900);
    } catch (error) {
      const message = error?.message || 'Email could not be sent. Please try again.';
      notify('error', message);
    } finally {
      setSending(false);
      requestInFlightRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        style={{ minHeight: 'min(620px, 90vh)' }}
        className="w-full max-w-3xl max-h-[96vh] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ptm-send-mail-modal-title"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 id="ptm-send-mail-modal-title" className="text-sm font-bold text-slate-800 flex items-center gap-2">
                Send Email
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  PTM Report
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
              onClick={openDefaultMailPopup}
              disabled={sending || defaultMailsLoading}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg whitespace-nowrap disabled:opacity-50 cursor-pointer"
              title="Manage saved default To and CC addresses"
            >
              Add Default Mails
            </button>
            <button
              type="button"
              onClick={addDefaultEmailsToRecipients}
              disabled={sending || defaultMailsLoading || (!defaultToEmails.length && !defaultCcEmails.length)}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg whitespace-nowrap disabled:opacity-50 cursor-pointer"
              title="Attach saved default addresses to their matching fields"
            >
              Attach Default Mails
            </button>
            <button
              type="button"
              onClick={removeAttachedDefaultEmails}
              disabled={sending || (!attachedDefaultToEmails.length && !attachedDefaultCcEmails.length)}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg whitespace-nowrap disabled:opacity-50 cursor-pointer"
              title="Remove addresses attached by Attach Default Mails"
            >
              Remove Default Mails
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
          {errorMessage && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {errorMessage}
            </div>
          )}
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
                placeholder={recipients.length === 0 ? 'Type recipient email and press Enter...' : 'Add more emails...'}
                className="flex-1 min-w-[160px] border-none outline-none text-xs text-slate-800 bg-transparent px-1 py-0.5 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => (toInput.trim() ? addRecipient() : toInputRef.current?.focus())}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                title="Add another To recipient"
              >
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
                  {ccEmails.filter((e) => e.trim()).length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700">
                      {ccEmails.filter((e) => e.trim()).length}
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

              <div className="space-y-1.5">
                {ccEmails.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      ref={(el) => (ccInputsRef.current[idx] = el)}
                      type="email"
                      value={email}
                      onChange={(e) => handleCcChange(idx, e.target.value)}
                      onKeyDown={(e) => handleCcKeyDown(idx, e)}
                      placeholder={idx === 0 ? 'Type CC email...' : `Type CC email ${idx + 1}...`}
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
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate max-w-md">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">
              {`Attached: ${ptmSheet?.topic || ptmSheet?.title || title || 'Current PTM Sheet'}`}
            </span>
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/30" role="presentation">
          <section
            style={{ minHeight: 'min(480px, 85vh)' }}
            className="w-full max-w-xl max-h-[92vh] rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ptm-default-mails-title"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h3 id="ptm-default-mails-title" className="text-sm font-bold text-slate-800">Default mail recipients</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">Manage To and CC defaults separately. Save both lists together.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDefaultMailPopup(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                aria-label="Close default email addresses"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-4 flex-1">
              {[
                { target: 'to', title: 'Default Recipients (To)', draft: defaultToDraft },
                { target: 'cc', title: 'Default CC', draft: defaultCcDraft },
              ].map(({ target, title: sectionTitle, draft }) => (
                <section key={target} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <h4 className="text-xs font-bold text-slate-700">{sectionTitle}</h4>
                  {defaultMailsLoading ? (
                    <p className="py-2 text-xs text-slate-500">Loading saved addresses…</p>
                  ) : (
                    <div className="max-h-40 space-y-1.5 overflow-y-auto">
                      {draft.map((email, index) => (
                        <div key={`${target}-${index}`} className="flex items-center gap-2">
                          <input
                            type="email"
                            value={email}
                            onChange={(event) => changeDefaultEmailDraft(target, index, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                addDefaultEmailDraft(target);
                              }
                            }}
                            placeholder={`Enter ${target.toUpperCase()} email address`}
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => removeDefaultEmailDraft(target, index)}
                            className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                            title={`Remove ${target.toUpperCase()} address`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => addDefaultEmailDraft(target)}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Mail
                  </button>
                </section>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-[11px] text-slate-500">Saved To and CC defaults are added to their matching fields when you click Attach Default Mails.</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDefaultMailPopup(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDefaultEmails}
                  disabled={defaultMailsLoading || defaultMailsSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
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
