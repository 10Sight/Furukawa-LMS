import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Send,
  X,
  Check,
  Loader2,
  FileSpreadsheet,
  Info,
  Plus,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

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
  onSendSuccess
}) {
  const [toInput, setToInput] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [ccEmails, setCcEmails] = useState(['']);
  const [showCc, setShowCc] = useState(true);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [includeExcel, setIncludeExcel] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const ccInputsRef = useRef([]);

  // When modal opens, all input fields are reset to blank as requested
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
    setSubject('');
    setMessage('');
  }, [isOpen]);

  if (!isOpen) return null;

  const addRecipient = (email) => {
    const raw = email !== undefined ? email : toInput;
    if (!raw) return;
    const parts = raw.split(/[,;\s]+/).map(s => s.trim().replace(/[,;]$/, '')).filter(Boolean);
    if (parts.length === 0) return;
    setRecipients(prev => {
      const next = [...prev];
      parts.forEach(p => {
        if (!next.includes(p)) next.push(p);
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

  const handleSend = () => {
    if (recipients.length === 0 && !toInput.trim()) {
      toast.error('Please enter at least one recipient email address.');
      return;
    }

    const finalRecipients = [...recipients];
    if (toInput.trim() && !finalRecipients.includes(toInput.trim())) {
      finalRecipients.push(toInput.trim());
    }

    const finalCcList = ccEmails.map(e => e.trim()).filter(Boolean);

    setSending(true);

    // Frontend send simulation
    setTimeout(() => {
      setSending(false);
      setSentSuccess(true);
      toast.success(`Mail sent successfully to ${finalRecipients.join(', ')}`);

      if (typeof onSendSuccess === 'function') {
        onSendSuccess({
          recipients: finalRecipients,
          cc: finalCcList,
          subject,
          message,
          attachments: [
            includeExcel ? `${getAttachmentBaseName()}.xlsx` : null
          ].filter(Boolean)
        });
      }

      setTimeout(() => {
        onClose();
      }, 900);
    }, 1000);
  };

  const getAttachmentBaseName = () => {
    const dateStr = metadata.auditDate || metadata.date || new Date().toISOString().slice(0, 10);
    if (formType === 'pdca') return `PDCA_Observation_${dateStr}`;
    if (formType === 'cc') return `CC_LPA_CheckSheet_${dateStr}`;
    return `Assembly_LPA_CheckSheet_${dateStr}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
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
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
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
              {!showCc && (
                <button
                  type="button"
                  onClick={handleOpenCcSection}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold text-[11px] cursor-pointer"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                  <span>Add CC</span>
                </button>
              )}
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
                type="email"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                onKeyDown={handleKeyDownTo}
                onBlur={() => toInput.trim() && addRecipient()}
                placeholder={recipients.length === 0 ? "Type recipient email and press Enter..." : "Add more emails..."}
                className="flex-1 min-w-[160px] border-none outline-none text-xs text-slate-800 bg-transparent px-1 py-0.5 placeholder:text-slate-400"
              />
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
                    {ccEmails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCcRow(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remove this CC"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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

          {/* Subject Field */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 font-medium placeholder:text-slate-400"
            />
          </div>

          {/* Attachments Card */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Attachments
            </label>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="min-w-0 truncate">
                  <div className="font-semibold text-slate-800 truncate text-xs">
                    {getAttachmentBaseName()}.xlsx
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Auto-generated spreadsheet report (~42 KB)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Check className="w-3 h-3 stroke-[3]" />
                  Attached
                </span>
              </div>
            </div>
          </div>

          {/* Message Body Field */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Message Body
            </label>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type message body here..."
              className="w-full p-3 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 leading-relaxed resize-y bg-white placeholder:text-slate-400 font-normal"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>Emails sent with authoritative audit score attachments</span>
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
    </div>
  );
}
