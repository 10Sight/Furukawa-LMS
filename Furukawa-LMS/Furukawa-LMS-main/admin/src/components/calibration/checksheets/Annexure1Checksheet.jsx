import React from 'react';
import SignatureApprovalControl from './SignatureApprovalControl';
import fmeProcedureLogo from '@/assets/logos/fme-procedure-logo.png';

export default function Annexure1Checksheet({
  document = {},
  onSave = () => {}
}) {
  return (
    <div className="w-[1140px] shrink-0 mx-auto bg-white border-2 border-black text-black font-sans shadow-lg text-xs print:w-full print:border-black select-text overflow-hidden">
      {/* ── Top Bar: Company Name ── */}
      <div className="flex justify-end px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-black bg-white">
        FURUKAWA MINDA ELECTRIC PVT. LTD.
      </div>

      {/* ── Header: Logo, Annexure Title, Meta Block ── */}
      <div className="grid grid-cols-12 border-t-2 border-b-2 border-black">
        {/* Logo (Col 1-2) */}
        <div className="col-span-2 p-2 flex items-center justify-center border-r border-black bg-white">
          <img
            src={fmeProcedureLogo}
            alt="Furukawa Minda Fme Logo"
            className="h-14 w-auto max-w-[130px] object-contain select-none"
          />
        </div>

        {/* Title Center (Col 3-8) */}
        <div className="col-span-6 flex items-center justify-center border-r border-black p-3 bg-white text-center">
          <h1 className="text-3xl font-black uppercase tracking-wider text-black font-sans">
            ANNEXURE - 1
          </h1>
        </div>

        {/* Metadata Table (Col 9-12) */}
        <div className="col-span-4 flex flex-col justify-between divide-y divide-black text-[11px] font-semibold bg-white">
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-black font-bold">Ref No:</span>
            <span className="font-mono font-bold text-black">PRC-WH-QA-007</span>
          </div>
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-black font-bold">Rev:</span>
            <span className="font-mono font-bold text-black">01</span>
          </div>
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-black font-bold">Rev Date:</span>
            <span className="font-bold text-black">15.03.19</span>
          </div>
        </div>
      </div>

      {/* ── Subtitle / Rule Statement ── */}
      <div className="px-3 py-2 border-b border-black font-bold text-[13px] bg-white text-black">
        Rule for esclaration for withdrawn the instruments
      </div>

      {/* ── Main Process Flow Table ── */}
      <table className="w-full text-left border-collapse table-fixed">
        <colgroup>
          <col style={{ width: '6%' }} />
          <col style={{ width: '32%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '14%' }} />
        </colgroup>
        <thead>
          <tr className="bg-white text-black font-bold text-xs text-center">
            <th className="border border-black p-2">S.L No.</th>
            <th className="border border-black p-2">Process</th>
            <th className="border border-black p-2">How</th>
            <th className="border border-black p-2">When</th>
            <th className="border border-black p-2">Who</th>
            <th className="border border-black p-2">Remark</th>
          </tr>
        </thead>
        <tbody className="text-xs">
          {/* ── Step 1: Monthly Plan of Calibration with START Hexagon ── */}
          <tr className="align-middle">
            <td className="border border-black p-2 text-center font-bold text-sm">1</td>
            <td className="border border-black p-0 align-middle relative bg-white">
              <div className="relative w-full flex flex-col items-center justify-between py-1 select-none">
                {/* START Hexagon shape */}
                <div className="flex flex-col items-center w-full pt-1">
                  <svg width="100" height="28" viewBox="0 0 100 28" className="block shrink-0">
                    <polygon
                      points="12,1 88,1 99,14 88,27 12,27 1,14"
                      fill="white"
                      stroke="black"
                      strokeWidth="1.2"
                    />
                    <text
                      x="50"
                      y="18"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="sans-serif"
                      fill="black"
                    >
                      Start
                    </text>
                  </svg>
                  <div className="w-[1.5px] bg-black h-3" />
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
                </div>

                {/* Box 1 */}
                <div className="w-[230px] border border-black bg-white px-2 py-2 text-center font-normal text-xs leading-snug text-black z-10 my-0.5">
                  Monthly Plan of Calibration
                </div>

                {/* Bottom line */}
                <div className="w-[1.5px] bg-black h-3" />
              </div>
            </td>
            <td className="border border-black p-2 text-center font-medium">Monthly schedule</td>
            <td className="border border-black p-2 text-center font-medium">Daily</td>
            <td className="border border-black p-2 text-center font-medium">QA Lab Assistant</td>
            <td className="border border-black p-2 text-center">-</td>
          </tr>

          {/* ── Step 2: Check Monthly Plan of Calibration (Receives Loop from Step 3) ── */}
          <tr className="align-middle">
            <td className="border border-black p-2 text-center font-bold text-sm">2</td>
            <td className="border border-black p-0 align-middle relative bg-white">
              <div className="relative w-full flex flex-col items-center justify-between py-1 select-none min-h-[90px]">
                {/* Left "No" loop entering line */}
                <div className="absolute left-[20px] bottom-0 h-1/2 w-[1.5px] bg-black z-0 pointer-events-none" />
                <div className="absolute left-[20px] top-1/2 -translate-y-1/2 w-[35px] h-[1.5px] bg-black z-0 pointer-events-none" />
                <div className="absolute left-[49px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-black z-10 pointer-events-none" />

                {/* Top Arrow */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-end w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
                </div>

                {/* Box 2 */}
                <div className="w-[230px] border border-black bg-white px-2 py-2 text-center font-normal text-xs leading-snug text-black z-10 shrink-0">
                  Check Monthly Plan of Calibration
                </div>

                {/* Bottom line */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-start w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[10px]" />
                </div>
              </div>
            </td>
            <td className="border border-black p-2 text-center font-medium">Monthly schedule</td>
            <td className="border border-black p-2 text-center font-medium">Daily</td>
            <td className="border border-black p-2 text-center font-medium">QA Lab Assistant</td>
            <td className="border border-black p-2 text-center">-</td>
          </tr>

          {/* ── Step 3: Decision Diamond (Is inst. under due date?) ── */}
          <tr className="align-middle">
            <td className="border border-black p-2 text-center font-bold text-sm">3</td>
            <td className="border border-black p-0 align-middle relative bg-white">
              <div className="relative w-full flex flex-col items-center justify-between py-0 select-none min-h-[110px]">
                {/* Left "No" branch */}
                <div className="absolute left-[20px] top-0 h-1/2 w-[1.5px] bg-black z-0 pointer-events-none" />
                <div className="absolute left-[20px] w-[50px] top-1/2 -translate-y-1/2 h-[1.5px] bg-black z-0 pointer-events-none" />
                <div className="absolute left-[32px] top-[calc(50%-22px)] z-10">
                  <span className="border border-black bg-white px-1.5 py-0.5 text-[10px] font-bold text-black shadow-xs">
                    No
                  </span>
                </div>

                {/* Top Arrow */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-end w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
                </div>

                {/* Diamond SVG */}
                <svg width="200" height="72" viewBox="0 0 200 72" className="z-10 bg-transparent block shrink-0">
                  <polygon
                    points="100,1 199,36 100,71 1,36"
                    fill="white"
                    stroke="black"
                    strokeWidth="1.2"
                  />
                  <text
                    x="100"
                    y="32"
                    textAnchor="middle"
                    fontSize="11"
                    fontFamily="sans-serif"
                    fill="black"
                  >
                    Is inst. under
                  </text>
                  <text
                    x="100"
                    y="48"
                    textAnchor="middle"
                    fontSize="11"
                    fontFamily="sans-serif"
                    fill="black"
                  >
                    due date?
                  </text>
                </svg>

                {/* Bottom Line with "Yes" box on the right */}
                <div className="flex-1 min-h-[16px] flex flex-col items-center justify-start w-full shrink-0 relative">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[16px]" />
                  <div className="absolute left-[calc(50%+16px)] top-0 z-10">
                    <span className="border border-black bg-white px-1.5 py-0.5 text-[10px] font-bold text-black shadow-xs">
                      Yes
                    </span>
                  </div>
                </div>
              </div>
            </td>
            <td className="border border-black p-2 text-center">-</td>
            <td className="border border-black p-2 text-center font-medium">Daily</td>
            <td className="border border-black p-2 text-center font-medium">QA Lab Assistant</td>
            <td className="border border-black p-2 text-center">-</td>
          </tr>

          {/* ── Step 4: Inform to concern person ── */}
          <tr className="align-middle">
            <td className="border border-black p-2 text-center font-bold text-sm">4</td>
            <td className="border border-black p-0 align-middle relative bg-white">
              <div className="relative w-full flex flex-col items-center justify-between py-1 select-none min-h-[85px]">
                {/* Top Arrow */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-end w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
                </div>

                {/* Box 4 */}
                <div className="w-[230px] border border-black bg-white px-2 py-2 text-center font-normal text-xs leading-snug text-black z-10 shrink-0">
                  Inform to concern person
                </div>

                {/* Bottom line */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-start w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[10px]" />
                </div>
              </div>
            </td>
            <td className="border border-black p-2 text-center font-medium">Verbally</td>
            <td className="border border-black p-2 text-center font-medium">Two days before</td>
            <td className="border border-black p-2 text-center font-medium">QA Lab Assistant</td>
            <td className="border border-black p-2 text-center">-</td>
          </tr>

          {/* ── Step 5: Collect the inst. for calibration ── */}
          <tr className="align-middle">
            <td className="border border-black p-2 text-center font-bold text-sm">5</td>
            <td className="border border-black p-0 align-middle relative bg-white">
              <div className="relative w-full flex flex-col items-center justify-between py-1 select-none min-h-[85px]">
                {/* Top Arrow */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-end w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
                </div>

                {/* Box 5 */}
                <div className="w-[230px] border border-black bg-white px-2 py-2 text-center font-normal text-xs leading-snug text-black z-10 shrink-0">
                  Collect the inst. for calibration
                </div>

                {/* Bottom line */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-start w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[10px]" />
                </div>
              </div>
            </td>
            <td className="border border-black p-2 text-center font-medium">Verbally</td>
            <td className="border border-black p-2 text-center font-medium leading-snug">
              One day advance
              <br />
              /Same day
            </td>
            <td className="border border-black p-2 text-center font-medium">QA Lab Assistant</td>
            <td className="border border-black p-2 text-center">-</td>
          </tr>

          {/* ── Step 6: Exchange the inst. with calibrated inst.(if applicable) ── */}
          <tr className="align-middle">
            <td className="border border-black p-2 text-center font-bold text-sm">6</td>
            <td className="border border-black p-0 align-middle relative bg-white">
              <div className="relative w-full flex flex-col items-center justify-between py-1 select-none min-h-[85px]">
                {/* Top Arrow */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-end w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
                </div>

                {/* Box 6 */}
                <div className="w-[230px] border border-black bg-white px-2 py-2 text-center font-normal text-xs leading-snug text-black z-10 shrink-0">
                  Exchange the inst. with calibrated inst.(if applicable)
                </div>

                {/* Bottom line */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-start w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[10px]" />
                </div>
              </div>
            </td>
            <td className="border border-black p-2 text-center font-medium">Verbally</td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2 text-center font-medium">QA Lab Assistant</td>
            <td className="border border-black p-2 text-center"></td>
          </tr>

          {/* ── Step 7: Follow the inst. calibration procedure with END Hexagon ── */}
          <tr className="align-middle">
            <td className="border border-black p-2 text-center font-bold text-sm">7</td>
            <td className="border border-black p-0 align-middle relative bg-white">
              <div className="relative w-full flex flex-col items-center justify-between py-1 select-none">
                {/* Top Arrow */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-end w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
                </div>

                {/* Box 7 */}
                <div className="w-[230px] border border-black bg-white px-2 py-2 text-center font-normal text-xs leading-snug text-black z-10 shrink-0 my-0.5">
                  Follow the inst. calibration procedure.
                </div>

                {/* Arrow down to END */}
                <div className="w-[1.5px] bg-black h-3" />
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />

                {/* END Hexagon shape */}
                <svg width="100" height="28" viewBox="0 0 100 28" className="block shrink-0 mt-1 mb-1">
                  <polygon
                    points="12,1 88,1 99,14 88,27 12,27 1,14"
                    fill="white"
                    stroke="black"
                    strokeWidth="1.2"
                  />
                  <text
                    x="50"
                    y="18"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                    fill="black"
                  >
                    END
                  </text>
                </svg>
              </div>
            </td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2 text-center"></td>
          </tr>
        </tbody>
      </table>

      {/* ── Revision Table: Details of Change ── */}
      <table className="w-full text-left border-collapse table-fixed text-xs -mt-[1px]">
        <colgroup>
          <col style={{ width: '14%' }} />
          <col style={{ width: '34%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '34%' }} />
        </colgroup>
        <thead>
          <tr className="font-bold text-center bg-white">
            <th rowSpan={2} className="border border-black p-2 align-middle">
              Revision No.
            </th>
            <th rowSpan={2} className="border border-black p-2 align-middle">
              Revision Date
            </th>
            <th colSpan={2} className="border border-black p-1.5 text-center">
              Details of Change
            </th>
          </tr>
          <tr className="font-bold text-center bg-white">
            <th className="border border-black p-1.5 text-center">Affected Sr. No. / page</th>
            <th className="border border-black p-1.5 text-center">Change details</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {/* Rev 00 */}
          <tr>
            <td className="border border-black p-2.5 text-center font-mono font-bold">00</td>
            <td className="border border-black p-2.5 text-center font-medium">30.08.08</td>
            <td className="border border-black p-2.5 text-center font-medium">All</td>
            <td className="border border-black p-2.5 text-left font-medium">Original issue</td>
          </tr>

          {/* Rev 01 */}
          <tr>
            <td className="border border-black p-2.5 text-center font-mono font-bold">01</td>
            <td className="border border-black p-2.5 text-center font-medium">15.03.19</td>
            <td className="border border-black p-2.5 text-center font-medium">All</td>
            <td className="border border-black p-2.5 text-left font-medium space-y-1">
              <div>
                1. Company Name changed from Minda Furukawa Electric to Furukawa Minda Electric Pvt. Ltd. and logo changed from MFE to FME
              </div>
              <div>2. Verified by replace with Reviewed By</div>
              <div>3. Document Numbering changed from PRC/QA/007 Annexure-1 to Annexure-1</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Signatures Row: Prepared, Checked, Reviewed, Approved (No vertical dividers as per screenshot) ── */}
      <div className="grid grid-cols-[14%_34%_18%_34%] border-b border-black bg-white px-3 py-2">
        {/* Prepared By */}
        <div className="flex flex-col justify-between min-h-[60px] pr-2">
          <span className="font-bold text-[11px] text-black">Prepared By:</span>
          <div className="mt-1">
            <SignatureApprovalControl
              role="prepared"
              initialApproved={true}
              initialName="Khushboo"
              initialDate="15.03.19"
              onApprove={() => {}}
              onReject={() => {}}
            />
          </div>
        </div>

        {/* Checked By */}
        <div className="flex flex-col justify-between min-h-[60px] pr-2">
          <span className="font-bold text-[11px] text-black">Checked By:</span>
          <div className="mt-1">
            <SignatureApprovalControl
              role="checked"
              initialApproved={true}
              initialName="Arvind"
              initialDate="15.03.19"
              onApprove={() => {}}
              onReject={() => {}}
            />
          </div>
        </div>

        {/* Reviewed By */}
        <div className="flex flex-col justify-between min-h-[60px] pr-2">
          <span className="font-bold text-[11px] text-black">Reviewed By:</span>
          <div className="mt-1">
            <SignatureApprovalControl
              role="reviewed"
              initialApproved={true}
              initialName="Arvind"
              initialDate="15.03.19"
              onApprove={() => {}}
              onReject={() => {}}
            />
          </div>
        </div>

        {/* Approved by */}
        <div className="flex flex-col justify-between min-h-[60px]">
          <span className="font-bold text-[11px] text-black">Approved by:</span>
          <div className="mt-1">
            <SignatureApprovalControl
              role="approved"
              initialApproved={true}
              initialName="Yadvender"
              initialDate="15.03.19"
              onApprove={() => {}}
              onReject={() => {}}
            />
          </div>
        </div>
      </div>

      {/* ── Footer Metadata Row ── */}
      <div className="grid grid-cols-[14%_34%_18%_34%] px-3 py-1.5 text-[11px] text-black bg-white font-sans select-none items-center">
        <span>FRM-WH-QA-214</span>
        <span>Rev:00</span>
        <span>Issue Date: 25.02.2019</span>
        <span>Page: 1 of 1</span>
      </div>
    </div>
  );
}
