import React from 'react';
import SignatureApprovalControl from './SignatureApprovalControl';
import fmeProcedureLogo from '@/assets/logos/fme-procedure-logo.png';

// ── Flowchart Visual Elements ───────────────────────────────────────
const FlowBox = ({
  text,
  hasTopArrow = true,
  hasBottomLine = true,
  leftLine = null, // 'through' | 'enter'
  rightLine = null, // 'through' | 'enter-from-bottom' | 'enter-from-top'
  width = 250
}) => (
  <>
    {/* Normal flow spacer to give the parent td minimum height */}
    <div className="invisible py-4 px-2 select-none flex flex-col items-center min-h-[96px] pointer-events-none" aria-hidden="true">
      <div style={{ width: `${width}px` }} className="px-2.5 py-2 text-[11px] leading-snug">
        {text}
      </div>
    </div>

    {/* Absolute Side Rails Overlay (relative to parent td) */}
    <div className="absolute inset-0 pointer-events-none z-0">
      {/* Left branch line */}
      {leftLine === 'through' && (
        <div className="absolute left-[16px] top-[-1px] bottom-[-1px] w-[1.5px] bg-black" />
      )}
      {leftLine === 'enter' && (
        <>
          <div
            className="absolute left-[16px] top-[-1px] w-[1.5px] bg-black"
            style={{ height: 'calc(50% + 1px)' }}
          />
          <div
            className="absolute left-[16px] top-1/2 -translate-y-1/2 h-[1.5px] bg-black"
            style={{ right: 'calc(50% + 125px)' }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-black z-10"
            style={{ left: 'calc(50% - 125px - 6px)' }}
          />
        </>
      )}

      {/* Right branch line */}
      {rightLine === 'through' && (
        <div className="absolute right-[16px] top-[-1px] bottom-[-1px] w-[1.5px] bg-black" />
      )}
      {rightLine === 'enter-from-bottom' && (
        <>
          <div
            className="absolute right-[16px] bottom-[-1px] w-[1.5px] bg-black"
            style={{ height: 'calc(50% + 1px)' }}
          />
          <div
            className="absolute right-[16px] top-1/2 -translate-y-1/2 h-[1.5px] bg-black"
            style={{ left: 'calc(50% + 125px)' }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-r-[6px] border-r-black z-10"
            style={{ left: 'calc(50% + 125px)' }}
          />
        </>
      )}
      {rightLine === 'enter-from-top' && (
        <>
          <div
            className="absolute right-[16px] top-[-1px] w-[1.5px] bg-black"
            style={{ height: 'calc(50% + 1px)' }}
          />
          <div
            className="absolute right-[16px] top-1/2 -translate-y-1/2 h-[1.5px] bg-black"
            style={{ left: 'calc(50% + 125px)' }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-r-[6px] border-r-black z-10"
            style={{ left: 'calc(50% + 125px)' }}
          />
        </>
      )}
    </div>

    {/* Center Flow Content (Stretching from top-[-1px] to bottom-[-1px] of td) */}
    <div className="absolute inset-0 flex flex-col items-center justify-between select-none bg-transparent z-10 pointer-events-none">
      {/* Top vertical connector */}
      <div className={hasTopArrow ? "flex-1 flex flex-col items-center justify-end w-full min-h-[10px] -mt-[1px]" : leftLine === 'enter' ? "flex-1" : "h-4 shrink-0"}>
        {hasTopArrow && (
          <>
            <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
          </>
        )}
      </div>

      {/* Center Box */}
      <div
        style={{ width: `${width}px` }}
        className="border border-black bg-white px-2.5 py-2 text-center font-normal text-[11px] leading-snug text-black z-10 shadow-none shrink-0 pointer-events-auto"
      >
        {text}
      </div>

      {/* Bottom vertical connector */}
      <div className={hasBottomLine ? "flex-1 flex flex-col items-center justify-start w-full min-h-[10px] -mb-[1px]" : "h-4 shrink-0"}>
        {hasBottomLine && (
          <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
        )}
      </div>
    </div>
  </>
);

const Diamond5_3 = () => (
  <>
    {/* Normal flow spacer */}
    <div className="invisible py-4 px-2 select-none flex flex-col items-center min-h-[120px] pointer-events-none" aria-hidden="true">
      <div className="w-[220px] h-[84px]" />
    </div>

    {/* Absolute Side Rails Overlay (relative to parent td) */}
    <div className="absolute inset-0 pointer-events-none z-0">
      {/* Left YES branch lines */}
      <div
        className="absolute left-[16px] top-1/2 -translate-y-1/2 h-[1.5px] bg-black"
        style={{ right: 'calc(50% + 110px)' }}
      />
      <span
        className="absolute top-[calc(50%-18px)] text-[10px] font-bold text-black select-none pointer-events-none"
        style={{ left: 'calc(50% - 145px)' }}
      >
        YES
      </span>
      <div
        className="absolute left-[16px] bottom-[-1px] w-[1.5px] bg-black"
        style={{ height: 'calc(50% + 1px)' }}
      />
    </div>

    {/* Center Diamond Content - Absolute Inset-0 spanning 100% of the td */}
    <div className="absolute inset-0 flex flex-col items-center justify-between select-none bg-transparent z-10 pointer-events-none">
      {/* Top Arrow */}
      <div className="flex-1 flex flex-col items-center justify-end w-full min-h-[10px] -mt-[1px]">
        <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
      </div>

      {/* SVG Diamond */}
      <svg width="220" height="84" viewBox="0 0 220 84" className="z-10 bg-transparent block shrink-0 pointer-events-auto">
        <polygon points="110,1 219,42 110,83 1,42" fill="white" stroke="black" strokeWidth="1.2" />
        <text x="110" y="24" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          Calibration of
        </text>
        <text x="110" y="38" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          instrument/Gauge
        </text>
        <text x="110" y="52" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          can be performed in
        </text>
        <text x="110" y="66" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          house or not .
        </text>
      </svg>

      {/* Bottom Line with NO label */}
      <div className="flex-1 flex flex-col items-center justify-start w-full min-h-[14px] -mb-[1px] relative">
        <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
        <span className="absolute left-[calc(50%+8px)] top-0.5 text-[10px] font-bold text-black select-none">
          NO
        </span>
      </div>
    </div>
  </>
);

const Diamond5_7 = () => (
  <>
    {/* Normal flow spacer */}
    <div className="invisible py-4 px-2 select-none flex flex-col items-center min-h-[110px] pointer-events-none" aria-hidden="true">
      <div className="w-[200px] h-[72px]" />
    </div>

    {/* Absolute Side Rails Overlay (relative to parent td) */}
    <div className="absolute inset-0 pointer-events-none z-0">
      {/* Right Not OK branch lines */}
      <div
        className="absolute right-[16px] top-1/2 -translate-y-1/2 h-[1.5px] bg-black"
        style={{ left: 'calc(50% + 100px)' }}
      />
      <div
        className="absolute top-[calc(50%-28px)] text-[9.5px] font-bold text-black leading-tight text-center select-none pointer-events-none"
        style={{ right: 'calc(50% - 140px)' }}
      >
        <div>Not</div>
        <div>OK</div>
      </div>
      <div
        className="absolute right-[16px] top-[-1px] w-[1.5px] bg-black"
        style={{ height: 'calc(50% + 1px)' }}
      />
    </div>

    {/* Center Diamond Content - Absolute Inset-0 spanning 100% of the td */}
    <div className="absolute inset-0 flex flex-col items-center justify-between select-none bg-transparent z-10 pointer-events-none">
      {/* Top Arrow */}
      <div className="flex-1 flex flex-col items-center justify-end w-full min-h-[10px] -mt-[1px]">
        <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
      </div>

      {/* SVG Diamond */}
      <svg width="200" height="72" viewBox="0 0 200 72" className="z-10 bg-transparent block shrink-0 pointer-events-auto">
        <polygon points="100,1 199,36 100,71 1,36" fill="white" stroke="black" strokeWidth="1.2" />
        <text x="100" y="26" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          Verification of
        </text>
        <text x="100" y="40" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          calibration
        </text>
        <text x="100" y="54" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          report?
        </text>
      </svg>

      {/* Bottom Line with OK label */}
      <div className="flex-1 flex flex-col items-center justify-start w-full min-h-[14px] -mb-[1px] relative">
        <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
        <span className="absolute left-[calc(50%+8px)] top-0.5 text-[10px] font-bold text-black select-none">
          OK
        </span>
      </div>
    </div>
  </>
);

const Diamond5_14 = () => (
  <>
    {/* Normal flow spacer */}
    <div className="invisible py-4 px-2 select-none flex flex-col items-center min-h-[105px] pointer-events-none" aria-hidden="true">
      <div className="w-[200px] h-[72px]" />
    </div>

    {/* Center Diamond Content - Absolute Inset-0 spanning 100% of the td */}
    <div className="absolute inset-0 flex flex-col items-center justify-between select-none bg-transparent z-10 pointer-events-none">
      {/* Top Arrow */}
      <div className="flex-1 flex flex-col items-center justify-end w-full min-h-[10px] -mt-[1px]">
        <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
      </div>

      {/* SVG Diamond */}
      <svg width="200" height="72" viewBox="0 0 200 72" className="z-10 bg-transparent block shrink-0 pointer-events-auto">
        <polygon points="100,1 199,36 100,71 1,36" fill="white" stroke="black" strokeWidth="1.2" />
        <text x="100" y="26" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          if any suspect
        </text>
        <text x="100" y="40" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          material shipped
        </text>
        <text x="100" y="54" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          to customer?
        </text>
      </svg>

      {/* Bottom Line */}
      <div className="flex-1 flex flex-col items-center justify-start w-full min-h-[14px] -mb-[1px]">
        <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
      </div>
    </div>
  </>
);

const Diamond5_22 = () => (
  <>
    {/* Normal flow spacer */}
    <div className="invisible py-4 px-2 select-none flex flex-col items-center min-h-[100px] pointer-events-none" aria-hidden="true">
      <div className="w-[180px] h-[60px]" />
    </div>

    {/* Absolute Side Rails Overlay (relative to parent td) */}
    <div className="absolute inset-0 pointer-events-none z-0">
      {/* Right YES branch lines */}
      <div
        className="absolute right-[16px] top-1/2 -translate-y-1/2 h-[1.5px] bg-black"
        style={{ left: 'calc(50% + 90px)' }}
      />
      <span
        className="absolute top-[calc(50%-18px)] text-[10px] font-bold text-black select-none pointer-events-none"
        style={{ right: 'calc(50% - 135px)' }}
      >
        YES
      </span>
      <div
        className="absolute right-[16px] bottom-[-1px] w-[1.5px] bg-black"
        style={{ height: 'calc(50% + 1px)' }}
      />
    </div>

    {/* Center Diamond Content - Absolute Inset-0 spanning 100% of the td */}
    <div className="absolute inset-0 flex flex-col items-center justify-between select-none bg-transparent z-10 pointer-events-none">
      {/* Top Arrow */}
      <div className="flex-1 flex flex-col items-center justify-end w-full min-h-[10px] -mt-[1px]">
        <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
      </div>

      {/* SVG Diamond */}
      <svg width="180" height="60" viewBox="0 0 180 60" className="z-10 bg-transparent block shrink-0 pointer-events-auto">
        <polygon points="90,1 179,30 90,59 1,30" fill="white" stroke="black" strokeWidth="1.2" />
        <text x="90" y="27" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          MSA results
        </text>
        <text x="90" y="41" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          accepted
        </text>
      </svg>

      {/* Bottom Line with NO label */}
      <div className="flex-1 flex flex-col items-center justify-start w-full min-h-[14px] -mb-[1px] relative">
        <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
        <span className="absolute left-[calc(50%+8px)] top-0.5 text-[10px] font-bold text-black select-none">
          NO
        </span>
      </div>
    </div>
  </>
);

const Diamond5_24 = () => (
  <>
    {/* Normal flow spacer */}
    <div className="invisible py-4 px-2 select-none flex flex-col items-center min-h-[120px] pointer-events-none" aria-hidden="true">
      <div className="w-[220px] h-[84px]" />
    </div>

    {/* Absolute Side Rails Overlay (relative to parent td) */}
    <div className="absolute inset-0 pointer-events-none z-0">
      {/* Right line through from 5.22/5.23 */}
      <div className="absolute right-[16px] top-[-1px] bottom-[-1px] w-[1.5px] bg-black" />

      {/* Left NO branch lines */}
      <div
        className="absolute left-[16px] top-1/2 -translate-y-1/2 h-[1.5px] bg-black"
        style={{ right: 'calc(50% + 110px)' }}
      />
      <span
        className="absolute top-[calc(50%-18px)] text-[10px] font-bold text-black select-none pointer-events-none"
        style={{ left: 'calc(50% - 145px)' }}
      >
        NO
      </span>
      <div
        className="absolute left-[16px] bottom-[-1px] w-[1.5px] bg-black"
        style={{ height: 'calc(50% + 1px)' }}
      />
    </div>

    {/* Center Diamond Content - Absolute Inset-0 spanning 100% of the td */}
    <div className="absolute inset-0 flex flex-col items-center justify-between select-none bg-transparent z-10 pointer-events-none">
      {/* Top Arrow */}
      <div className="flex-1 flex flex-col items-center justify-end w-full min-h-[10px] -mt-[1px]">
        <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
      </div>

      {/* SVG Diamond */}
      <svg width="220" height="84" viewBox="0 0 220 84" className="z-10 bg-transparent block shrink-0 pointer-events-auto">
        <polygon points="110,1 219,42 110,83 1,42" fill="white" stroke="black" strokeWidth="1.2" />
        <text x="110" y="24" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          Feasibility of
        </text>
        <text x="110" y="38" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          adjustment /
        </text>
        <text x="110" y="52" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          repairing of the
        </text>
        <text x="110" y="66" textAnchor="middle" fontSize="10.5" fontFamily="sans-serif" fill="black">
          instrument .
        </text>
      </svg>

      {/* Bottom Line with YES label */}
      <div className="flex-1 flex flex-col items-center justify-start w-full min-h-[14px] -mb-[1px] relative">
        <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
        <span className="absolute left-[calc(50%+8px)] top-0.5 text-[10px] font-bold text-black select-none">
          YES
        </span>
      </div>
    </div>
  </>
);

export default function StandardOperatingProcedureChecksheet({
  document = {},
  onSave = () => {}
}) {
  return (
    <div className="w-[1440px] shrink-0 mx-auto bg-white border-2 border-black text-black font-sans shadow-lg text-xs print:w-full print:border-black select-text overflow-hidden">
      {/* ── Top Bar: Confidential & Company Name ── */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-black text-[11px] font-bold tracking-wider bg-white">
        <span className="uppercase text-black font-extrabold">CONFIDENTIAL</span>
        <span className="uppercase text-black font-extrabold tracking-widest">
          FURUKAWA MINDA ELECTRIC PVT. LTD.
        </span>
      </div>

      {/* ── Main Header Block: Logo, Titles, Meta Table ── */}
      <div className="grid grid-cols-12 border-b border-black">
        {/* Logo (Col 1-2) */}
        <div className="col-span-2 border-r border-black p-2 flex items-center justify-center bg-white">
          <img
            src={fmeProcedureLogo}
            alt="Furukawa Minda Fme"
            className="h-16 w-auto max-w-[140px] object-contain select-none"
          />
        </div>

        {/* Title Center (Col 3-8) */}
        <div className="col-span-6 border-r border-black flex flex-col items-center justify-center p-3 text-center bg-white">
          <h1 className="text-lg font-bold uppercase tracking-wide text-black font-serif">
            STANDARD OPERATING PROCEDURE
          </h1>
          <h2 className="text-2xl font-black uppercase tracking-wider text-[#002060] mt-1 font-sans">
            MEASURING & TEST DEVICE
          </h2>
        </div>

        {/* Metadata Table (Col 9-12) */}
        <div className="col-span-4 flex flex-col justify-between divide-y divide-black text-[11px] font-semibold bg-white">
          <div className="px-3 py-1 flex items-center justify-between">
            <span className="text-black font-bold">DOCUMENT NO.:</span>
            <span className="font-mono font-bold text-black">{document.code || 'PRC-WH-QA-007'}</span>
          </div>
          <div className="px-3 py-1 flex items-center justify-between">
            <span className="text-black font-bold">REVISION NO.:</span>
            <span className="font-mono font-bold italic text-[#0052cc]">08</span>
          </div>
          <div className="px-3 py-1 flex items-center justify-between">
            <span className="text-black font-bold">REVISION DATE:</span>
            <span className="font-bold italic text-[#0052cc]">05.08.2024</span>
          </div>
          <div className="px-3 py-1 flex items-center justify-between">
            <span className="text-black font-bold">ISSUE DATE:</span>
            <span className="font-medium text-black">30.08.08</span>
          </div>
          <div className="px-3 py-1 flex items-center justify-between">
            <span className="text-black font-bold">PAGE NO.:</span>
            <span className="font-bold text-black">1 of 3</span>
          </div>
        </div>
      </div>

      {/* ── Signatures Row: Prepared, Checked, Verified, Approved ── */}
      <div className="grid grid-cols-4 border-b border-black divide-x divide-black bg-white">
        {/* 1. Prepared By */}
        <div className="p-2 flex flex-col justify-between min-h-[75px]">
          <span className="font-bold text-[11px] text-black">Prepared By:- Khushboo</span>
          <div className="h-8 flex items-end text-[10px] text-slate-500 font-medium">
            (Sign)
          </div>
        </div>

        {/* 2. Checked By */}
        <div className="p-2 flex flex-col justify-between min-h-[75px]">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className="font-bold text-[11px] text-black">Checked By: Arvind</span>
            <SignatureApprovalControl
              storageKey="sop_prc_checked_arvind"
              approverName="Arvind"
              defaultApproved={true}
            />
          </div>
          <div className="h-8 flex items-end text-[10px] text-slate-500 font-medium">
            (Sign &amp; Stamp)
          </div>
        </div>

        {/* 3. Verified By */}
        <div className="p-2 flex flex-col justify-between min-h-[75px]">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className="font-bold text-[11px] text-black">Verified By:- Arvind</span>
            <SignatureApprovalControl
              storageKey="sop_prc_verified_arvind"
              approverName="Arvind"
              defaultApproved={true}
            />
          </div>
          <div className="h-8 flex items-end text-[10px] text-slate-500 font-medium">
            (Sign &amp; Stamp)
          </div>
        </div>

        {/* 4. Approved By */}
        <div className="p-2 flex flex-col justify-between min-h-[75px]">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className="font-bold text-[11px] text-black">Approved By:- Yadvender</span>
            <SignatureApprovalControl
              storageKey="sop_prc_approved_yadvender"
              approverName="Yadvender"
              defaultApproved={true}
            />
          </div>
          <div className="h-8 flex items-end text-[10px] text-slate-500 font-medium">
            (Sign &amp; Stamp)
          </div>
        </div>
      </div>

      {/* ── Sections 1 to 4: Title, Purpose, Scope, Reference Docs ── */}
      <div className="p-3 border-b border-black space-y-2 leading-relaxed bg-white text-xs">
        <div>
          <span className="font-bold text-black mr-2">1 TITLE:</span>
          <span>Procedure for control &amp; monitoring of measuring &amp; test devices.</span>
        </div>
        <div>
          <span className="font-bold text-black mr-2">2 PURPOSE:</span>
          <span>
            To ensure that instruments are used with known error within the measuring capability requirement of that particular process.
          </span>
        </div>
        <div>
          <span className="font-bold text-black mr-2">3 SCOPE:</span>
          <span>
            This procedure is applicable to calibration and verification of monitoring, measuring &amp; test devices and for controlling process parameters in all the processes and covered under Quality Management system.
          </span>
        </div>
        <div className="pt-1">
          <span className="font-bold text-black block mb-1">4 Reference Documents / Standards:</span>
          <div className="pl-4 space-y-0.5 text-[11px]">
            <div>a) IATF 16949 Requirement element / sub element No. 7.1.5.2, 7.1.5.1.2,</div>
            <div>b) IATF 16949 Guidance element / sub element No. Nil</div>
            <div>c) ISO 14001 Requirement element / sub element No. 9.1.1</div>
            <div>d) ISO 45001 Requirement element / sub element No. 9.1.1</div>
            <div>e) Quality Management Manual</div>
          </div>
        </div>
      </div>

      {/* ── Section 5: Activity detail of Process ── */}
      <div className="border-b border-black bg-white">
        <div className="px-3 py-1.5 font-bold text-black bg-[#f1f5f9] border-b border-black">
          5 Activity detail of Process:
        </div>

        {/* ── Activity Table ── */}
        <table className="w-full text-left border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '3.8%' }} />
            <col style={{ width: '17.5%' }} />
            <col style={{ width: '25.2%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '18.5%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr className="bg-white text-black font-bold text-[11px] border-b border-black text-center">
              <th className="p-2 border-r border-dotted border-black">Sr. No.</th>
              <th className="p-2 border-r border-dotted border-black">Inputs -from other process &amp; sub process</th>
              <th className="p-2 border-r border-dotted border-black">Activity Flow</th>
              <th className="p-2 border-r border-dotted border-black">Outputs -To other process &amp; sub process</th>
              <th className="p-2 border-r border-dotted border-black">Check Items</th>
              <th className="p-2 border-r border-dotted border-black">Resp. &amp; Function</th>
              <th className="p-2 border-r border-black">Reference Doc. No.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black text-[11px]">
            {/* ═══ SECTION A: CALIBRATION ═══ */}
            <tr className="bg-[#f8fafc] font-extrabold text-black">
              <td className="p-2 text-center border-r border-dotted border-black">A</td>
              <td colSpan={6} className="p-2 text-left uppercase tracking-wide">
                Calibration
              </td>
            </tr>

            {/* 5.1 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.1</td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Ready made instruments/ Gauges from market (New Gauges)</div>
                <div>* In-house designed gauges along with drawing from Engg.</div>
                <div>* Accreditation list of calibration sources.</div>
                <div>* Calibration request from user</div>
                <div>* Master list of instrument with frequency of calibration</div>
                <div>* Instrument history card.</div>
                <div>* Statuatory &amp; Legal requirements.</div>
                <div>* Software version (if applicable)</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={false}
                  hasBottomLine={true}
                  text="Receiving of new or existing instruments/ Gauges/software version for calibration/Verification."
                />
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>* Monthly plan of calibartion</div>
              </td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Availability of details like accuracy , sensitivity , handling procedure of instrument from manufacture for readymade instrument ?</div>
                <div>* Visual condition of instrument .</div>
                <div>* Calibration records &amp; history cards.</div>
                <div>* latest version software</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Member Lab</td>
              <td className="p-2 space-y-0.5 font-mono text-[10px]">
                <div>FRM-WH-QA-039</div>
                <div>Annexure A</div>
                <div>FRM-WH-QA-216</div>
                <div>FRM-WH-QA-250</div>
              </td>
            </tr>

            {/* 5.2 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.2</td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Operating range</div>
                <div>* Tolerance on parameter to be measured .</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  text="Determination of suitability of instruments &  calibration requirement for new instruments"
                />
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>* Calibration range , accuracy and frequency of calibration for new type of instrument .</div>
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>* Similar type of instrument / Gauge/Software version being calibrated previously.</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Member Lab</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.3 Decision Diamond */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.3</td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Parameter , range and accuracy required for calibration</div>
                <div>* Scope of calibration</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <Diamond5_3 />
              </td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Member Lab</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.4 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.4</td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Parameter , range and accuracy required for calibration</div>
                <div>* List of NABL accredited lab .</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  leftLine="through"
                  text="Identify source for calibration"
                />
              </td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Scope of external lab</div>
                <div>* Validity of NABL certification of external lab.</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Member Lab</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.5 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.5</td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Assessment of external lab.</div>
                <div>* Past experience with lab , if any</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  leftLine="through"
                  text="Select calibration agency ."
                />
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>* Approved external lab</div>
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>* Meeting of urgency requirement.</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Lab Incharge</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.6 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.6</td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Drawing from ped</div>
                <div>* WIN for calibration</div>
                <div>* Laboratory manual</div>
                <div>* Approved accredited lab.</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  leftLine="enter"
                  rightLine="enter-from-bottom"
                  text="Calibration of instruments/ Gauges as per plan"
                />
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>* Calibration report</div>
              </td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Check the parameters to be calibrated</div>
                <div>* Scope and validity of certification of external lab</div>
                <div>* Calibration status of master used in case of in-house calibration</div>
                <div>* Calibration before due date</div>
                <div>* Lab environment condition for calibration i.e. Temp &amp; RH.</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Member Lab</td>
              <td className="p-2 font-mono text-[10px] text-center">FRM-WH-QA-124</td>
            </tr>

            {/* 5.7 Decision Diamond */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.7</td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Calibration results</div>
                <div>* Accuracy requirement</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <Diamond5_7 />
              </td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>Check of the certificate for adequacy &amp; validity on it, sign and file.</div>
                <div>* If the error is equal or approaches to acceptable limit then frequency of calibration of that particular instrument will be increased</div>
              </td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Is the instrument physically OK as per report ?</div>
                <div>* Is master duly calibrated</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">QA in - charge</td>
              <td className="p-2 font-mono text-[10px] text-center">ANNEXURE-2</td>
            </tr>

            {/* 5.8 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.8</td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Accepted calibration report</div>
                <div>* WIN for providing control number to instrument/Gauge</div>
                <div>* Calibration stickers</div>
                <div>* History cards</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  text="Putting 'OK status ' sticker indicating instrument control number, calibration date and next due date"
                />
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Updated Calibration plan/ register.</div>
              </td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Unique instrument no.</div>
                <div>* Calibration stickers</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Member Lab</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.10 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.10</td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Calibration status</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={false}
                  text="Prepare & maintain the history card , updation of master list and handing over of the instrument to user with information of error."
                />
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>* Calibrated instrument / Gauges to user</div>
              </td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Review of History card yearly.</div>
                <div>* Calibration stickers with validity Sticker</div>
                <div>* Updated Master list</div>
                <div>* Collect declaration of inst. Usage condition on monthly basis</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Member Lab</td>
              <td className="p-2 space-y-0.5 font-mono text-[10px]">
                <div>FRM-WH-QA-038</div>
                <div>Annexure -3</div>
              </td>
            </tr>

            {/* ═══ SECTION B: DECOMMISSIONING REPORT ═══ */}
            <tr className="bg-[#f8fafc] font-extrabold text-black">
              <td className="p-2 text-center border-r border-dotted border-black">B</td>
              <td colSpan={6} className="p-2 text-left uppercase tracking-wide">
                Decommissioning Report
              </td>
            </tr>

            {/* 5.11 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.11</td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Instrument decommissioning report.</div>
                <div className="font-semibold text-slate-800">Instrument lost/ Damage/Scrap</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={false}
                  hasBottomLine={true}
                  text="Receive decommission report & instrument damage report and Mark NC with Red-paint / Sticker on instruments. and old version software use."
                />
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Marking on NC instrument</div>
              </td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Calibration Card</div>
                <div>* De-commissioning Report</div>
                <div>* Instrument history card</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Member Lab</td>
              <td className="p-2 space-y-0.5 font-mono text-[10px]">
                <div>FRM-WH-QA-098</div>
                <div>FRM-WH-QA-124</div>
              </td>
            </tr>

            {/* 5.12 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.12</td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Decommissioning report of NC instruement</div>
                <div>* Instrument calibration card</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  text="Authorize De-commissioning Of NC instrument on the Instrument decommissioning report & the Calibration Card"
                />
              </td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* De-commissioning Report</div>
                <div>* Calibration Card</div>
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Master list of instruments</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Lab Incharge</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.13 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.13</td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Inspection reports of suspected materials</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  text="Verify, from user department, validity of previous inspection results from the NC instrument"
                />
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Inspection records from shop floor</div>
              </td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Lab Incharge</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.14 Decision Diamond */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.14</td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Inspection reports of suspected materials</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <Diamond5_14 />
              </td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Lab Incharge</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.15 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.15</td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  text="Inform customer through Mktg or QA. Collect data of the suspected lots from customer end."
                />
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Information given to customer via mail or telephonic or oter media</div>
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Segregated suspected parts &amp; reports</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Mktg. &amp; QA Incharge</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.16 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.16</td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Segregated suspected parts &amp; reports</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  text="Decide upon the ICA action like Rework / Segregate / Scrap etc. Handle defective parts as per NC part handling standard & Close instrument decommissioning report."
                />
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Re Inspected / Segregated lot</div>
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>In case of any suspected lot is identified on shop floor, hold the lot &amp; get the same to be re inspected segregated with new instrument</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Lab Incharge</td>
              <td className="p-2 space-y-0.5 font-mono text-[10px]">
                <div>OST-WH-QA-001</div>
                <div>OST-WH-QA-002</div>
              </td>
            </tr>

            {/* 5.17 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.17</td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Approved External lab</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  text="Decommission NC Instrument on the Master List & get the NC Instrument repaired if possible. Re-calibrate, paste validity sticker & release after re-commissioning on the Master List"
                />
              </td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Calibration result</div>
                <div>* Updated master list</div>
                <div>* Calibration sticker</div>
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Updated Master list of Instruments</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Lab Incharge</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.18 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.18</td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Irrepairable NC instruments</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  text="Deposit irrepairable NC- Instrument in the stores for disposal as per or scrap it & update master list."
                />
              </td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Scrap Record</div>
                <div>* Master List of instrument</div>
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Cost analysis of scarap instruments</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Lab Incharge</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.19 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.19</td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Master list of instruments</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  text="Circulate the updated revised calibration schedule to all concerned."
                />
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Revised Calibration Plan</div>
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Calibration schedule should have calibration interval dependent on the wear &amp; tear &amp; frequency of use, Review of history card.</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Member Lab</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.20 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.20</td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Calibration Plan</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={false}
                  text="Review the calibration results & revise the calibration plan & its frequency based on the instrument data & records."
                />
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Calibration Results &amp; updated Calibration history card</div>
              </td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Member Lab</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* ═══ SECTION C: MEASUREMENT SYSTEM & ANALYSIS ═══ */}
            <tr className="bg-[#f8fafc] font-extrabold text-black">
              <td className="p-2 text-center border-r border-dotted border-black">C</td>
              <td colSpan={6} className="p-2 text-left uppercase tracking-wide">
                Measurement System &amp; Analysis
              </td>
            </tr>

            {/* 5.21 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.21</td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Calibrated instrument / Gauge from calibration lab</div>
                <div>* OST for measurement system evaluation</div>
                <div>* MSA annual plan</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={false}
                  hasBottomLine={true}
                  text="MSA study for measuring instrument/ gauges"
                />
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>MSA plan</div>
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div className="font-extrabold">* Sampling shall cover complete operating range</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Member Lab</td>
              <td className="p-2 font-mono text-[10px]">OST-WH-QA-005</td>
            </tr>

            {/* 5.22 Decision Diamond */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.22</td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <Diamond5_22 />
              </td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Every results cross checked by QA Member</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">QA Incharge</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.23 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.23</td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Analysis of MSA result</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  rightLine="through"
                  text="Analysis of root cause and taking corrective action"
                />
              </td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 space-y-0.5 border-r border-dotted border-black">
                <div>* Check as</div>
                <div>(a) Inadequate training</div>
                <div>(b) Need review of method or</div>
                <div>(c) Selection of wrong instrument</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Lab Incharge</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.24 Decision Diamond */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.24</td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <Diamond5_24 />
              </td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Is it possible to adjustment / repairing the instrument ?</div>
                <div>* Is it cost beneficial ?</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Lab Incharge</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.25 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.25</td>
              <td className="p-2 border-r border-dotted border-black">
                <div>* Not OK instrument for adjustment / repairing</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  leftLine="through"
                  rightLine="through"
                  text="Adjustment & repairing of instrument / gauge"
                />
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Adjustment data &amp; repairing reports</div>
              </td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Lab Incharge</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.26 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.26</td>
              <td className="p-2 border-r border-dotted border-black">
                <div>Adjustment &amp; repaired instruments</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={true}
                  leftLine="through"
                  rightLine="enter-from-top"
                  text="Instrument /Gauge to be used"
                />
              </td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">User Dept.</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.27 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.27</td>
              <td className="p-2 border-r border-dotted border-black">
                <div>* Special instruction mentioned in catalogue</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={true}
                  hasBottomLine={false}
                  leftLine="through"
                  text="Handling & storage of new measuring instrument"
                />
              </td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 text-center border-r border-dotted border-black">-</td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">User Dept.</td>
              <td className="p-2 text-center">-</td>
            </tr>

            {/* 5.28 */}
            <tr className="align-top">
              <td className="p-2 text-center font-bold border-r border-dotted border-black">5.28</td>
              <td className="p-2 border-r border-dotted border-black">
                <div>* Instrument / gauge cannot be repaired</div>
              </td>
              <td className="p-0 border-r border-dotted border-black relative bg-white h-full" style={{ height: '100%' }}>
                <FlowBox
                  hasTopArrow={false}
                  hasBottomLine={false}
                  leftLine="enter"
                  text="Preparation & approval of scrap report from QA incharge, updation of history card and removal of instruments/ gauge"
                />
              </td>
              <td className="p-2 space-y-1 border-r border-dotted border-black">
                <div>* Red tag or sticker on scrap instruments</div>
                <div>* Scrap report &amp; scrap instrument to store incharge for scrap</div>
              </td>
              <td className="p-2 border-r border-dotted border-black">
                <div>* Is red tape (Not OK status) paste on instrument / gauge ?</div>
              </td>
              <td className="p-2 text-center font-semibold border-r border-dotted border-black">Lab Incharge</td>
              <td className="p-2 font-mono text-[10px]">FRM-WH-QA-098</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Note Below Table ── */}
      <div className="p-2.5 border-b border-black font-bold text-xs bg-white text-black">
        Note: Only standard or imported measuring tape / scale will be used and will be verified for readability by QC leader / engineer through their check sheet.
      </div>

      {/* ── Section 6: Definitions and abbreviations ── */}
      <div className="p-3 border-b border-black space-y-1 bg-white text-[11px]">
        <div className="font-bold text-xs text-black mb-1">6 Definitions and abbreviations:</div>
        <div>* <strong>MSA</strong> - Measurement system analysis</div>
        <div>* <strong>Process Owner</strong> - Person who is overall responsible for preparation, review and revision of documents for a specific process</div>
        <div>* <strong>External Calibration Valid Date</strong> - Valid date depend on instruments and Certificate, Max 1 year Valid after calibration</div>
        <div>* <strong>Internal Calibration Valid Date</strong> - Internal calibration valid date depend on instruments , Max 6 Month Valid after Calibration</div>
        <div>
          * <strong>Internal &amp; External Calibration Valid Date for Safety &amp; Regulatory Maru-AR (Suzuki)</strong> -
          <div className="pl-4 mt-0.5 space-y-0.5">
            <div>External Calibration valid date depend on instruments for Maru-AR calibration. Max 3 Month Valid after Calibration</div>
            <div>And Internal calibration valid date depend on instruments for Maru-AR calibration. Max 4 Month Valid after Calibration</div>
          </div>
        </div>
      </div>

      {/* ── Section 7: Performance Indicators ── */}
      <div className="border-b border-black bg-white">
        <div className="px-3 py-1.5 font-bold text-xs text-black bg-[#f1f5f9] border-b border-black">
          7 Performance Indicators:
        </div>
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-white font-bold border-b border-black divide-x divide-black text-center">
              <th className="p-2 w-1/2">KPI&apos;s</th>
              <th className="p-2 w-1/4">Frequency</th>
              <th className="p-2 w-1/4">Responsibility</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            <tr className="divide-x divide-black">
              <td className="p-2 font-medium">Batting average of calibration</td>
              <td className="p-2 text-center">Monthly</td>
              <td className="p-2 text-center font-semibold">Lab Incharge</td>
            </tr>
            <tr className="divide-x divide-black">
              <td className="p-2 font-medium">No of request for calibration after due date</td>
              <td className="p-2 text-center">Monthly</td>
              <td className="p-2 text-center font-semibold">Lab Incharge</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Section 8: Record Generation ── */}
      <div className="border-b border-black bg-white">
        <div className="px-3 py-1.5 font-bold text-xs text-black bg-[#f1f5f9] border-b border-black">
          8 Record Generation:
        </div>
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-white font-bold border-b border-black divide-x divide-black text-center">
              <th className="p-2 w-1/2">Document Name</th>
              <th className="p-2 w-1/4">Document Ref No.</th>
              <th className="p-2 w-1/4">Department</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black font-mono text-[11px]">
            <tr className="divide-x divide-black font-sans">
              <td className="p-2">MASTER LIST OF MEASURING INST. &amp; TEST EQUIPMENT</td>
              <td className="p-2 font-mono text-center">FRM-WH-QA-035</td>
              <td className="p-2 text-center">QA</td>
            </tr>
            <tr className="divide-x divide-black font-sans">
              <td className="p-2">INSTRUMENT LOSS REPAIR REQUISITION</td>
              <td className="p-2 font-mono text-center">FRM-WH-QA-037</td>
              <td className="p-2 text-center">QA</td>
            </tr>
            <tr className="divide-x divide-black font-sans">
              <td className="p-2">CALIBRATION HISTORY</td>
              <td className="p-2 font-mono text-center">FRM-WH-QA-038</td>
              <td className="p-2 text-center">QA</td>
            </tr>
            <tr className="divide-x divide-black font-sans">
              <td className="p-2">CALIBRATION PLAN</td>
              <td className="p-2 font-mono text-center">FRM-WH-QA-039</td>
              <td className="p-2 text-center">QA</td>
            </tr>
            <tr className="divide-x divide-black font-sans">
              <td className="p-2">NC PRODUCT HANDLING C&amp;C</td>
              <td className="p-2 font-mono text-center">OST-WH-QA-001</td>
              <td className="p-2 text-center">QA</td>
            </tr>
            <tr className="divide-x divide-black font-sans">
              <td className="p-2">NC PRODUCT HANDLING ASSY.</td>
              <td className="p-2 font-mono text-center">OST-WH-QA-002</td>
              <td className="p-2 text-center">QA</td>
            </tr>
            <tr className="divide-x divide-black font-sans">
              <td className="p-2">RULE FOR ESCALATION</td>
              <td className="p-2 font-mono text-center">ANNEXURE-1</td>
              <td className="p-2 text-center">QA</td>
            </tr>
            <tr className="divide-x divide-black font-sans">
              <td className="p-2">ACCEPTANCE CRITERIA</td>
              <td className="p-2 font-mono text-center">ANNEXURE-2</td>
              <td className="p-2 text-center">QA</td>
            </tr>
            <tr className="divide-x divide-black font-sans">
              <td className="p-2">Declaration of instrument usable condition</td>
              <td className="p-2 font-mono text-center">ANNEXURE-3</td>
              <td className="p-2 text-center">QA</td>
            </tr>
          </tbody>
        </table>

        {/* Footer Numbered List of Record Types */}
        <div className="p-2.5 bg-[#fafafa] border-t border-black text-[10px] space-y-1">
          <div className="grid grid-cols-4 gap-2">
            <div>1. Instrument scrap report</div>
            <div>2. Inspection, Measuring and test equipment master list</div>
            <div>3. Calibration history card</div>
            <div>4. Calibration request from</div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>5. Calibration stickers</div>
            <div>6. Decommissioning Report</div>
            <div>7. Calibration plan &amp; MSA plan</div>
            <div>8. Instrument error report</div>
          </div>
        </div>
      </div>

      {/* ── Section 9: Revision Records ── */}
      <div className="bg-white">
        <div className="px-3 py-1.5 font-bold text-xs text-black bg-[#f1f5f9] border-b border-black">
          9 Revision Records:
        </div>
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-white font-bold border-b border-black divide-x divide-black text-center">
              <th className="p-2 w-[90px]">Revision No.</th>
              <th className="p-2 w-[110px]">Revision Date</th>
              <th className="p-2 w-[140px]">Affected Sr. No. / page</th>
              <th className="p-2">Details of Change (Change details)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            <tr className="divide-x divide-black">
              <td className="p-2 text-center font-bold">00</td>
              <td className="p-2 text-center">30.08.08</td>
              <td className="p-2 text-center font-medium">All</td>
              <td className="p-2">Original issue</td>
            </tr>
            <tr className="divide-x divide-black">
              <td className="p-2 text-center font-bold">01</td>
              <td className="p-2 text-center">10.02.10</td>
              <td className="p-2 text-center font-medium">11, 12</td>
              <td className="p-2 space-y-0.5">
                <div>* Responsibility is change .</div>
                <div>* Check item is defined for cross checking of MSA results</div>
              </td>
            </tr>
            <tr className="divide-x divide-black">
              <td className="p-2 text-center font-bold">02</td>
              <td className="p-2 text-center">10.02.12</td>
              <td className="p-2 text-center font-medium">1,6,12</td>
              <td className="p-2 space-y-0.5">
                <div>* Inputs added in process</div>
                <div>* Check items added.</div>
                <div>* Format no changed.</div>
              </td>
            </tr>
            <tr className="divide-x divide-black">
              <td className="p-2 text-center font-bold">03</td>
              <td className="p-2 text-center">05.02.14</td>
              <td className="p-2 text-center font-medium">All</td>
              <td className="p-2">
                Process revised &amp; De-commissioning process added. Changes are highlighted with Blue Italic Font
              </td>
            </tr>
            <tr className="divide-x divide-black">
              <td className="p-2 text-center font-bold">04</td>
              <td className="p-2 text-center">04.02.17</td>
              <td className="p-2 text-center font-medium">All</td>
              <td className="p-2">
                Changes done based on IATF, ISO 14001 &amp; OHSAS standards requirements and Changes are highlighted with Blue Italic Font.
              </td>
            </tr>
            <tr className="divide-x divide-black">
              <td className="p-2 text-center font-bold">05</td>
              <td className="p-2 text-center">10.12.17</td>
              <td className="p-2 text-center font-medium">Annexure</td>
              <td className="p-2">
                Rule for escalation for withdrawn the instruments annexure added
              </td>
            </tr>
            <tr className="divide-x divide-black">
              <td className="p-2 text-center font-bold">06</td>
              <td className="p-2 text-center">15.03.19</td>
              <td className="p-2 text-center font-medium">All</td>
              <td className="p-2 space-y-1">
                <div>1. Company Name changed from Minda Furukawa Electric to Furukawa Minda Electric Pvt. Ltd. and logo changed from MFE to FME</div>
                <div>2. Verified by replace with Reviewed By</div>
                <div>3. Document Numbering changed from PRC/QA/007 to PRC-WH-QA-007</div>
                <div>4. Document Numbering changed from FRM/QA/035, FRM/QA/037, FRM/QA/038, FRM/QA/039 OST/QA/002 &amp; OST/QA/001 to FRM-WH-QA-035, FRM-WH-QA-037, FRM-WH-QA-038, FRM-WH-QA-039 OST-WH-QA-002 &amp; OST-WH-QA-001</div>
                <div>5. Reference of OHSAS 18001 replace with ISO 45001</div>
              </td>
            </tr>
            <tr className="divide-x divide-black">
              <td className="p-2 text-center font-bold">07</td>
              <td className="p-2 text-center">04.07.19</td>
              <td className="p-2 text-center font-medium">5.10</td>
              <td className="p-2">
                Declaration of instrument usable condition process added in form of Annexure-3
              </td>
            </tr>
            {/* 08 - Active current revision in blue italic as on physical sheet */}
            <tr className="divide-x divide-black text-[#0052cc] italic font-bold bg-blue-50/30">
              <td className="p-2 text-center font-black">08</td>
              <td className="p-2 text-center">05.08.2024</td>
              <td className="p-2 text-center">All</td>
              <td className="p-2 font-black">
                MARU,AR add in procedure
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
