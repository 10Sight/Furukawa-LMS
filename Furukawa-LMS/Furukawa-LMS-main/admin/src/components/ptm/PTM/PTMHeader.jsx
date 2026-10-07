import React from 'react';
import CalendarDateInput from './CalendarDateInput';
import SearchableLeaderInput from './SearchableLeaderInput';

export default function PTMHeader({ headerInfo, setHeaderInfo, projectLeaderOptions = [], isMerged = false, formActions }) {
  const handleChange = (field, val) => {
    setHeaderInfo((prev) => ({
      ...prev,
      [field]: val,
    }));
  };

  return (
    <div className={`ptm-header relative bg-white select-none ${isMerged ? 'border-b border-[#64748B]' : 'rounded-xl border border-[#64748B] shadow-sm overflow-hidden mb-4'}`}>
      {formActions}

      {/* Grid containing the exact header sections from the spreadsheet image */}
      <div className="w-full grid grid-cols-12 divide-x divide-[#64748B]">
        
        {/* Section 1: Left Form Info — inline label+input with soft blue & rank amber accents */}
        <div className="[&_*]:!text-black col-span-4 bg-white text-xs border-r border-[#64748B]">
          <table className="w-full h-full border-collapse text-[11px]" style={{tableLayout:'fixed'}}>
            <colgroup>
              {/* Left half: Model + APQP (65%) | Right half: Rank label (20%) + Rank value (15%) */}
              <col style={{width:'40%'}} />
              <col style={{width:'25%'}} />
              <col style={{width:'20%'}} />
              <col style={{width:'15%'}} />
            </colgroup>
            <tbody>
              {/* Colored top header row aligned with Program Identification below */}
              <tr className="border-b border-[#64748B]" style={{height:'26px'}}>
                <td colSpan={4} className="bg-white px-2.5 align-middle">
                  <span className="font-extrabold text-slate-800 tracking-wide font-mono text-[13px]">
                    {headerInfo.formTitle || 'FRM-WH-DD-006 Project Tracking Matrix Rev. 17 (YHB MC25)'}
                  </span>
                </td>
              </tr>

              {/* Row: Model (inline) | Rank label + value */}
              <tr className="border-b border-[#64748B]">
                <td className="px-2.5 py-1.5 align-middle bg-white" colSpan={2}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-[#2C5282] text-[10.5px] whitespace-nowrap">Model:</span>
                    <input
                      type="text"
                      value={headerInfo.model || ''}
                      onChange={(e) => handleChange('model', e.target.value)}
                      className="font-bold text-slate-900 outline-none bg-transparent text-[11px] min-w-0 flex-1 px-1 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-400"
                      placeholder="YHB_MC25"
                    />
                  </div>
                </td>
                <td className="border-l border-[#64748B] px-2 py-1.5 align-middle text-right bg-white">
                  <span className="font-bold text-[#975A16] text-[10.5px] whitespace-nowrap">Rank:</span>
                </td>
                <td className="px-2 py-1.5 align-middle bg-white">
                  <input
                    type="text"
                    value={headerInfo.rank ?? ''}
                    onChange={(e) => handleChange('rank', e.target.value)}
                    className="w-full select-text cursor-text font-bold text-[#975A16] outline-none bg-transparent text-[11px] px-1 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-amber-400"
                    placeholder="C1"
                  />
                </td>
              </tr>

              {/* Row: APQP Leader (inline) | Phase label + value */}
              <tr className="border-b border-[#64748B]">
                <td className="px-2.5 py-1.5 align-middle bg-white" colSpan={2}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-[#2C5282] text-[10.5px] whitespace-nowrap">APQP Leader:</span>
                    <SearchableLeaderInput
                      value={headerInfo.apqpLeader || ''}
                      onChange={(e) => handleChange('apqpLeader', e.target.value)}
                      options={projectLeaderOptions}
                      id="apqp-leader"
                      className="w-full select-text cursor-text font-bold text-slate-900 outline-none bg-transparent text-[11px] min-w-0 px-1 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-400"
                      placeholder="Mr. Deepak Chauhan"
                    />
                  </div>
                </td>
                <td className="border-l border-[#64748B] px-2 py-1.5 align-middle text-right bg-white">
                  <span className="font-bold text-[#2C5282] text-[10.5px] whitespace-nowrap">Phase:</span>
                </td>
                <td className="px-2 py-1.5 align-middle bg-white">
                  <input
                    type="text"
                    value={headerInfo.phase ?? ''}
                    onChange={(e) => handleChange('phase', e.target.value)}
                    className="w-full select-text cursor-text font-bold text-slate-900 outline-none bg-transparent text-[11px] px-1 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-400"
                    placeholder="1"
                  />
                </td>
              </tr>

              {/* Row: Project Leader (inline, full width) */}
              <tr className="border-b border-[#64748B]">
                <td className="px-2.5 py-1.5 align-middle bg-white" colSpan={4}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-[#2C5282] text-[10.5px] whitespace-nowrap">Project Leader:</span>
                    <SearchableLeaderInput
                      value={headerInfo.projectLeader || ''}
                      onChange={(e) => handleChange('projectLeader', e.target.value)}
                      options={projectLeaderOptions}
                      id="project-leader"
                      className="w-full select-text cursor-text font-bold text-slate-900 outline-none bg-transparent text-[11px] min-w-0 px-1 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-400"
                      placeholder="Shiva Chaudhary"
                    />
                  </div>
                </td>
              </tr>

              {/* Row: Review Date (inline, full width) */}
              <tr>
                <td className="px-2.5 py-1.5 align-middle bg-white" colSpan={4}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-[#2C5282] text-[10.5px] whitespace-nowrap">Review Date:</span>
                    <CalendarDateInput
                      value={headerInfo.reviewDate || ''}
                      onChange={(e) => handleChange('reviewDate', e.target.value)}
                      containerClassName="w-fit flex-none"
                      className="w-[15ch] font-semibold text-slate-800 outline-none bg-transparent text-[11px] px-1 py-0.5 rounded focus:bg-white focus:ring-1 focus:ring-blue-400"
                      placeholder="27-09-2013"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Legend / Symbol Guidance — matching section colors and enlarged bold symbols */}
        <div className="[&_*]:!text-black col-span-3 bg-white">
          <table className="w-full h-full border-collapse text-[11px]" style={{tableLayout:'fixed'}}>
            <colgroup>
              <col style={{width:'22%'}} />  {/* "Legend" label cell */}
              <col style={{width:'22%'}} />  {/* Activity / Rank / Deptt labels */}
              <col style={{width:'14%'}} />  {/* Symbol */}
              <col style={{width:'42%'}} />  {/* Description */}
            </colgroup>
            <tbody>
              {/* Top empty row with header tint */}
              <tr className="border-b border-[#64748B]" style={{height:'26px'}}>
                <td colSpan={4}></td>
              </tr>

              {/* Row 1: Legend (rowSpan 5) | Activity | ◆ | Critical Activity */}
              <tr className="border-b border-[#64748B]">
                <td
                  className="border-r border-[#64748B] text-center font-extrabold text-[#2C5282] uppercase tracking-wider align-middle text-[11px] px-1"
                  rowSpan={5}
                  style={{verticalAlign:'middle'}}
                >
                  Legend
                </td>
                <td className="border-r border-[#64748B] px-2 py-1 font-bold text-[#4A5568] align-middle">Activity</td>
                <td className="border-r border-[#64748B] px-1 py-1 text-center align-middle"><svg aria-hidden="true" viewBox="0 0 16 16" className="mx-auto h-4 w-4 fill-black"><path d="M8 1 15 8 8 15 1 8z" /></svg></td>
                <td className="px-2 py-1 text-slate-700 font-medium align-middle bg-white">Critical Activity</td>
              </tr>

              {/* Row 2: Rank | ■ | Applicable */}
              <tr className="border-b border-[#64748B]">
                <td className="border-r border-[#64748B] px-2 py-1 font-bold text-[#975A16] align-middle" rowSpan={2}>Rank</td>
                <td className="border-r border-[#64748B] px-1 py-1 text-center align-middle"><svg aria-hidden="true" viewBox="0 0 16 16" className="mx-auto h-4 w-4 fill-black"><rect x="1" y="1" width="14" height="14" /></svg></td>
                <td className="px-2 py-1 text-slate-700 font-medium align-middle">Applicable</td>
              </tr>

              {/* Row 3: (Rank cont.) | □ | If Required */}
              <tr className="border-b border-[#64748B]">
                <td className="border-r border-[#64748B] px-1 py-1 text-center align-middle"><svg aria-hidden="true" viewBox="0 0 16 16" className="mx-auto h-4 w-4 fill-none stroke-black" strokeWidth="1.5"><rect x="1.75" y="1.75" width="12.5" height="12.5" /></svg></td>
                <td className="px-2 py-1 text-slate-700 font-medium align-middle">If Required</td>
              </tr>

              {/* Row 4: Deptt | ● | Owner */}
              <tr className="border-b border-[#64748B]">
                <td className="border-r border-[#64748B] px-2 py-1 font-bold text-[#276749] align-middle" rowSpan={2}>Deptt</td>
                <td className="border-r border-[#64748B] px-1 py-1 text-center align-middle"><svg aria-hidden="true" viewBox="0 0 16 16" className="mx-auto h-4 w-4 fill-black"><circle cx="8" cy="8" r="7" /></svg></td>
                <td className="px-2 py-1 text-slate-700 font-medium align-middle">Owner</td>
              </tr>

              {/* Row 5: (Deptt cont.) | ○ | Support/Co-owner */}
              <tr>
                <td className="border-r border-[#64748B] px-1 py-1 text-center align-middle"><svg aria-hidden="true" viewBox="0 0 16 16" className="mx-auto h-4 w-4 fill-none stroke-black" strokeWidth="1.5"><circle cx="8" cy="8" r="6.25" /></svg></td>
                <td className="px-2 py-1 text-slate-700 font-medium align-middle">Support/Co-owner</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 3: Notes — bordered table rows with professional header & styling */}
        <div className="col-span-2 bg-white text-[10px]">
          <table className="w-full h-full border-collapse text-[10px]">
            <tbody>
              <tr className="border-b border-[#64748B]" style={{height:'26px'}}>
                <td className="px-2.5 font-extrabold text-[#1E40AF] uppercase tracking-wider text-[10.5px] align-middle bg-[#EEF4FA]">
                  Notes:
                </td>
              </tr>
              <tr className="border-b border-[#64748B] hover:bg-[#F8FAFC] transition-colors">
                <td className="px-2.5 py-1 text-slate-700 leading-tight align-top">
                  1. Revision history: need to be updated if customer milestone change.
                </td>
              </tr>
              <tr className="border-b border-[#64748B] hover:bg-[#F8FAFC] transition-colors">
                <td className="px-2.5 py-1 text-slate-700 leading-tight align-top">
                  2. New PTM to be prepared if new model is introduced (Split) by customer.
                </td>
              </tr>
              <tr className="border-b border-[#64748B] hover:bg-[#F8FAFC] transition-colors">
                <td className="px-2.5 py-1 text-slate-700 leading-tight align-top">
                  3. CFT members to be as per AIAG Manual &amp; FAS standard if change.
                </td>
              </tr>
              <tr className="hover:bg-[#F8FAFC] transition-colors">
                <td className="px-2.5 py-1 text-slate-700 leading-tight align-top">
                  4. PTM to be reviewed once per annum with APQP procedure.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 4: DELIVERABLE & DURATION / SCHEDULE TIMING — themed to match columns below */}
        <div className="col-span-2 bg-white text-[9px]">
          <table className="w-full h-full border-collapse text-[9px]" style={{tableLayout:'fixed'}}>
            <colgroup>
              <col style={{width:'28%'}} />
              <col style={{width:'20%'}} />
              <col style={{width:'17%'}} />
              <col style={{width:'17%'}} />
              <col style={{width:'18%'}} />
            </colgroup>
            <tbody>
              {/* Top row — aligns height with other sections */}
              <tr className="border-b border-[#64748B]" style={{height:'26px'}}>
                <td colSpan={5} className="bg-[#EEF4FA]"></td>
              </tr>
              {/* Group header */}
              <tr className="border-b border-[#64748B]">
                <td colSpan={2} className="border-r border-[#64748B] text-center font-extrabold text-[#2D3748] py-1 px-1 bg-[#EDF2F7] tracking-tight uppercase text-[9.5px]">
                  DELIVERABLE &amp; DURATION
                </td>
                <td colSpan={3} className="text-center font-extrabold text-[#2B6CB0] py-1 px-1 bg-[#EFF3FA] tracking-tight uppercase text-[9.5px]">
                  SCHEDULE TIMING
                </td>
              </tr>
              {/* Sub-column headers */}
              <tr className="border-b border-[#64748B]">
                <td className="border-r border-[#64748B] px-1 py-1 text-[#2D3748] bg-[#F1F5F9] align-top leading-tight font-bold">Deliverable Required Nos.<br/>(as per doc. list)</td>
                <td className="border-r border-[#64748B] px-1 py-1 text-[#2D3748] bg-[#F1F5F9] align-top leading-tight font-bold">No. of Iterations in Plan<br/>(if diff.)</td>
                <td className="border-r border-[#64748B] px-1 py-1 text-[#2B6CB0] bg-[#EFF3FA] align-top leading-tight font-bold">Final Date</td>
                <td className="border-r border-[#64748B] px-1 py-1 text-[#2B6CB0] bg-[#EFF3FA] align-top leading-tight font-bold">Final Date<br/>(Diff.)</td>
                <td className="px-1 py-1 text-[#2B6CB0] bg-[#EFF3FA] align-top leading-tight font-bold">Remarks</td>
              </tr>
              {/* Editable data row */}
              <tr className="border-b border-[#64748B]">
                <td className="border-r border-[#64748B] px-1 py-1 align-top bg-white">
                  <input type="text" value={headerInfo.deliverableNos || ''} onChange={(e) => handleChange('deliverableNos', e.target.value)} className="w-full bg-transparent outline-none text-slate-800 focus:bg-blue-50/50 rounded px-0.5" />
                </td>
                <td className="border-r border-[#64748B] px-1 py-1 align-top bg-white">
                  <input type="text" value={headerInfo.iterationsInPlan || ''} onChange={(e) => handleChange('iterationsInPlan', e.target.value)} className="w-full bg-transparent outline-none text-slate-800 focus:bg-blue-50/50 rounded px-0.5" />
                </td>
                <td className="border-r border-[#64748B] px-1 py-1 align-top bg-white">
                  <CalendarDateInput value={headerInfo.finalDate || ''} onChange={(e) => handleChange('finalDate', e.target.value)} className="w-full bg-transparent outline-none text-slate-800 focus:bg-blue-50/50 rounded px-0.5" />
                </td>
                <td className="border-r border-[#64748B] px-1 py-1 align-top bg-white">
                  <CalendarDateInput value={headerInfo.finalDateDiff || ''} onChange={(e) => handleChange('finalDateDiff', e.target.value)} className="w-full bg-transparent outline-none text-slate-800 focus:bg-blue-50/50 rounded px-0.5" />
                </td>
                <td className="px-1 py-1 align-top bg-white">
                  <input type="text" value={headerInfo.scheduleRemarks || ''} onChange={(e) => handleChange('scheduleRemarks', e.target.value)} className="w-full bg-transparent outline-none text-slate-800 focus:bg-blue-50/50 rounded px-0.5" />
                </td>
              </tr>
              {/* Filler row */}
              <tr><td colSpan={5} className="px-1 py-1 bg-white"></td></tr>
            </tbody>
          </table>
        </div>

        {/* Section 5: Document Metadata — compact col-span-1 with polished header styling */}
        <div className="col-span-1 bg-[#F4F7FA] flex flex-col justify-center px-1.5 py-1">
          <table className="w-full border border-[#64748B] text-[9px] bg-white rounded-xs overflow-hidden shadow-2xs">
            <tbody>
              <tr className="border-b border-[#64748B]">
                <td className="px-1 py-0.5 font-bold text-[#2C5282] bg-[#EEF4FA] whitespace-nowrap">Doc No.:</td>
                <td className="px-1.5 py-0.5 font-mono text-slate-800 bg-white">
                  <input
                    type="text"
                    value={headerInfo.docNo || 'FRM-DD-WH-006'}
                    onChange={(e) => handleChange('docNo', e.target.value)}
                    className="w-full bg-transparent outline-none font-mono font-bold text-[9px]"
                  />
                </td>
              </tr>
              <tr className="border-b border-[#64748B]">
                <td className="px-1 py-0.5 font-bold text-[#2C5282] bg-[#EEF4FA] whitespace-nowrap">Rev No.:</td>
                <td className="px-1.5 py-0.5 font-bold text-slate-800 bg-white">
                  <input
                    type="text"
                    value={headerInfo.revNo || '17'}
                    onChange={(e) => handleChange('revNo', e.target.value)}
                    className="w-full bg-transparent outline-none font-bold text-[9px]"
                  />
                </td>
              </tr>
              <tr className="border-b border-[#64748B]">
                <td className="px-1 py-0.5 font-bold text-[#2C5282] bg-[#EEF4FA] whitespace-nowrap">Issue Date:</td>
                <td className="px-1.5 py-0.5 text-slate-700 bg-white">
                  <CalendarDateInput
                    value={headerInfo.issueDate || '07.11.2013'}
                    onChange={(e) => handleChange('issueDate', e.target.value)}
                    className="w-full bg-transparent outline-none font-bold text-[9px]"
                  />
                </td>
              </tr>
              <tr className="bg-[#FEF08A] font-bold text-amber-950">
                <td className="px-1 py-1 font-extrabold border-r border-amber-300 whitespace-nowrap text-[9px]">Rev. Date:</td>
                <td className="px-1 py-1">
                  <CalendarDateInput
                    value={headerInfo.revDate || '17.10.23'}
                    onChange={(e) => handleChange('revDate', e.target.value)}
                    className="w-full bg-transparent outline-none font-extrabold text-[9px] text-amber-950"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
