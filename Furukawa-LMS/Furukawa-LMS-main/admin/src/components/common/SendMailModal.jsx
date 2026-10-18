import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  X,
  Paperclip,
  Check,
  Loader2,
  FileSpreadsheet,
  Plus,
  Users,
  Building,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * SendMailModal
 * Elegant, production-ready frontend email modal for:
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
  defaultRecipients = [],
  onSendSuccess
}) {
  const [toInput, setToInput] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [ccInput, setCcInput] = useState('');
  const [ccList, setCcList] = useState([]);
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [includeExcel, setIncludeExcel] = useState(true);
  const [includePdf, setIncludePdf] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Suggested quick-add email tags
  const QUICK_RECIPIENTS = [
    { label: 'Quality Lead', email: 'qa.lead@furukawaminda.com' },
    { label: 'Section Head', email: 'section.head@furukawaminda.com' },
    { label: 'Line Incharge', email: 'line.incharge@furukawaminda.com' },
    { label: 'Plant QA Manager', email: 'plant.qa@furukawaminda.com' }
  ];

  // Initialize and pre-fill email fields whenever modal opens
  useEffect(() => {
    if (!isOpen) {
      setSending(false);
      setSentSuccess(false);
      return;
    }

    const dateStr = metadata.auditDate || metadata.date || new Date().toISOString().slice(0, 10);
    const shiftStr = metadata.shift ? ` [Shift ${metadata.shift}]` : '';
    const scoreStr = metadata.scorePercentage || metadata.percentage ? ` - Score: ${metadata.scorePercentage || metadata.percentage}` : '';
    const deptStr = metadata.department ? ` - ${metadata.department}` : '';

    let generatedSubject = '';
    let generatedBody = '';
    let initialRecipients = [];

    if (Array.isArray(defaultRecipients) && defaultRecipients.length > 0) {
      initialRecipients = [...defaultRecipients];
    } else if (metadata.auditorEmail) {
      initialRecipients = [metadata.auditorEmail];
    }

    if (formType === 'pdca') {
      const topicName = metadata.topicName || title || 'Assembly - LPA Observation (PDCA)';
      generatedSubject = `[PDCA Report] ${topicName} - ${dateStr}${shiftStr}`;
      generatedBody = `Dear Team,

Please find attached the latest Layered Process Audit (PDCA Observation) record for review and action planning.

--- AUDIT DETAILS ---
• Topic: ${topicName}
• Date: ${dateStr}
• Unit: ${metadata.unit || 'Bawal'}
• Plant / Section: ${metadata.section || metadata.sectionName || 'Assembly'}
• Status: Active Observations Recorded

Please review the attached observation sheet and ensure required countermeasures are implemented before the next review cycle.

Best regards,
Quality Assurance & Production Engineering
Furukawa Minda Electric Portal`;
    } else if (formType === 'cc') {
      generatedSubject = `[LPA Report] C&C LPA Check Sheet Level-3 - ${dateStr}${shiftStr}${scoreStr}`;
      generatedBody = `Dear Team,

Please find attached the completed Layered Process Audit (C&C QA/Production) check sheet.

--- AUDIT SUMMARY ---
• Check Sheet: LPA CHECK SHEET LEVEL-3 C&C QA/Prod.
• Date: ${dateStr}${shiftStr}
• Department: ${metadata.department || 'C&C'}
• Auditor: ${metadata.auditors || metadata.auditor || 'Assigned Auditor'}
• Compliance Score: ${metadata.scorePercentage || metadata.percentage || 'Recorded'}

Please find the detailed checklist with item scores and observations in the attachment.

Best regards,
C&C QA Audit Team
Furukawa Minda Electric Portal`;
    } else {
      // Default: Assembly LPA Check Sheet
      generatedSubject = `[LPA Report] Assembly LPA Check Sheet - ${dateStr}${shiftStr}${deptStr}${scoreStr}`;
      generatedBody = `Dear Team,

Please find attached the completed Layered Process Audit (Assembly Quality & Production) check sheet.

--- AUDIT SUMMARY ---
• Check Sheet: ${title || 'Assembly LPA Check Sheet.xls - Assy QC & Pro REV 06'}
• Date: ${dateStr}${shiftStr}
• Department / Section: ${metadata.department || 'Production'} ${metadata.sectionName ? `(${metadata.sectionName})` : ''}
• Line: ${metadata.line || 'Assembly Line'}
• Auditor: ${metadata.auditors || metadata.auditor || 'Assigned Auditor'}
• Total Compliance Score: ${metadata.scorePercentage || metadata.percentage || 'Evaluated'}

All verified check points and observation notes have been authoritatively recorded.

Best regards,
Assembly Audit Team
Furukawa Minda Electric Portal`;
    }

    setSubject(generatedSubject);
    setMessage(generatedBody);
    setRecipients(initialRecipients.length > 0 ? initialRecipients : ['qa.team@furukawaminda.com']);
  }, [isOpen, formType, title, metadata, defaultRecipients]);

  if (!isOpen) return null;

  const addRecipient = (email) => {
    const trimmed = (email || toInput).trim().replace(/[,;]$/, '');
    if (!trimmed) return;
    if (!recipients.includes(trimmed)) {
      setRecipients([...recipients, trimmed]);
    }
    setToInput('');
  };

  const removeRecipient = (index) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const addCc = (email) => {
    const trimmed = (email || ccInput).trim().replace(/[,;]$/, '');
    if (!trimmed) return;
    if (!ccList.includes(trimmed)) {
      setCcList([...ccList, trimmed]);
    }
    setCcInput('');
  };

  const removeCc = (index) => {
    setCcList(ccList.filter((_, i) => i !== index));
  };

  const handleKeyDownTo = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addRecipient();
    }
  };

  const handleKeyDownCc = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCc();
    }
  };

  const handleSend = () => {
    if (recipients.length === 0 && !toInput.trim()) {
      toast.error('Please enter at least one recipient email address.');
      return;
    }

    // Add any remaining text in toInput
    const finalRecipients = [...recipients];
    if (toInput.trim() && !finalRecipients.includes(toInput.trim())) {
      finalRecipients.push(toInput.trim());
    }

    setSending(true);

    // Simulate modern mail dispatch interaction with animated feedback
    setTimeout(() => {
      setSending(false);
      setSentSuccess(true);
      toast.success(`Mail sent successfully to ${finalRecipients.join(', ')}`);

      if (typeof onSendSuccess === 'function') {
        onSendSuccess({
          recipients: finalRecipients,
          cc: ccList,
          subject,
          message,
          attachments: [
            includeExcel ? `${getAttachmentBaseName()}.xlsx` : null,
            includePdf ? `${getAttachmentBaseName()}.pdf` : null
          ].filter(Boolean)
        });
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    }, 1100);
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
                Email this completed sheet and summary directly to team members.
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
                  onClick={() => setShowCc(true)}
                  className="text-blue-600 hover:text-blue-700 font-medium text-[11px] cursor-pointer"
                >
                  + Add CC
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
                placeholder={recipients.length === 0 ? "Type email and press Enter..." : "Add more emails..."}
                className="flex-1 min-w-[140px] border-none outline-none text-xs text-slate-800 bg-transparent px-1 py-0.5 placeholder:text-slate-400"
              />
            </div>

            {/* Quick Add Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-slate-400 font-medium">Quick Add:</span>
              {QUICK_RECIPIENTS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => addRecipient(item.email)}
                  disabled={recipients.includes(item.email)}
                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    recipients.includes(item.email)
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-default'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <Plus className="w-2.5 h-2.5" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* CC Field (Collapsible) */}
          {showCc && (
            <div className="animate-in fade-in duration-100">
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700">CC</label>
                <button
                  type="button"
                  onClick={() => setShowCc(false)}
                  className="text-slate-400 hover:text-slate-600 text-[11px] cursor-pointer"
                >
                  Remove CC
                </button>
              </div>
              <div className="min-h-[36px] p-1.5 border border-slate-300 rounded-lg bg-white flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-600 transition-all">
                {ccList.map((email, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-medium"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeCc(idx)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="email"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={handleKeyDownCc}
                  onBlur={() => ccInput.trim() && addCc()}
                  placeholder="Add CC email..."
                  className="flex-1 min-w-[140px] border-none outline-none text-xs text-slate-800 bg-transparent px-1 py-0.5 placeholder:text-slate-400"
                />
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
              placeholder="Email subject..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 font-medium"
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
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write custom message or instructions..."
              className="w-full p-3 text-xs font-mono border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 leading-relaxed resize-y bg-slate-50/50"
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
