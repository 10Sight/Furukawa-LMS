import React from 'react';
import SignatureApprovalControl from './SignatureApprovalControl';
import fmeProcedureLogo from '@/assets/logos/fme-procedure-logo.png';

export default function Annexure3Checksheet({
  document = {},
  onSave = () => {}
}) {
  return (
    <div className="w-[1140px] shrink-0 mx-auto bg-white border-2 border-black text-black font-sans shadow-lg text-xs print:w-full print:border-black select-text overflow-hidden">
      {/* ── Top Bar: Company Name ── */}
      <div className="flex justify-end px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-black bg-white">
        FURUKAWA MINDA ELECTRIC PVT. LTD.
      </div>

      {/* ── Header: Logo, Title, Metadata ── */}
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
            ANNEXURE - 3
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

      {/* ── Subtitle ── */}
      <div className="px-3 py-2 border-b border-black font-bold text-[13px] tracking-wide bg-white text-black">
        Rule for declaration of instruments usable condition
      </div>

      {/* ── Process Flow Table ── */}
      <table className="w-full text-left border-collapse table-fixed text-xs">
        <colgroup>
          <col style={{ width: '6%' }} />
          <col style={{ width: '32%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '14%' }} />
        </colgroup>
        <thead>
          <tr className="bg-white text-black font-bold text-center">
            <th className="border border-black p-2">S.L No.</th>
            <th className="border border-black p-2">Process</th>
            <th className="border border-black p-2">How</th>
            <th className="border border-black p-2">When</th>
            <th className="border border-black p-2">Who</th>
            <th className="border border-black p-2">Remark</th>
          </tr>
        </thead>
        <tbody className="bg-white text-xs">
          {/* ── Step 1: Start Hexagon & Area wise inst. calibration list ── */}
          <tr className="align-middle">
            <td className="border border-black p-2 text-center font-bold text-sm">1</td>
            <td className="border border-black p-0 align-middle relative bg-white">
              <div className="relative w-full flex flex-col items-center justify-between py-2 select-none min-h-[140px]">
                {/* Hexagon Start */}
                <svg width="120" height="30" viewBox="0 0 120 30" className="z-10 bg-transparent block shrink-0">
                  <polygon
                    points="15,1 105,1 119,15 105,29 15,29 1,15"
                    fill="white"
                    stroke="black"
                    strokeWidth="1.2"
                  />
                  <text
                    x="60"
                    y="19"
                    textAnchor="middle"
                    fontSize="11"
                    fontFamily="sans-serif"
                    fill="black"
                  >
                    Start
                  </text>
                </svg>

                {/* Arrow down to Box 1 */}
                <div className="flex-1 min-h-[14px] flex flex-col items-center justify-center w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[10px]" />
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
                </div>

                {/* Box 1 */}
                <div className="w-[230px] border border-black bg-white px-2 py-2 text-center font-normal text-xs leading-snug text-black z-10 shrink-0">
                  Area wise inst. calibration list circulate to concern person
                </div>

                {/* Bottom line */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-start w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[10px]" />
                </div>
              </div>
            </td>
            <td className="border border-black p-2 text-center font-medium">
              <div>Inst. Declaration format</div>
              <div className="font-mono mt-0.5">FRM-WH-QA-208</div>
            </td>
            <td className="border border-black p-2 text-center font-medium">Monthly</td>
            <td className="border border-black p-2 text-center font-medium">QA Lab Assistant</td>
            <td className="border border-black p-2 text-center">-</td>
          </tr>

          {/* ── Step 2: Take the confirm on declaration sheet (Receives Loop from Steps 3 & 5) ── */}
          <tr className="align-middle">
            <td className="border border-black p-2 text-center font-bold text-sm">2</td>
            <td className="border border-black p-0 align-middle relative bg-white">
              <div className="relative w-full flex flex-col items-center justify-between py-1 select-none min-h-[90px]">
                {/* Left "No" loop entering line (coming up from below and pointing right into Box 2) */}
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
                  Take the confirm on declaration sheet
                </div>

                {/* Bottom line */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-start w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[10px]" />
                </div>
              </div>
            </td>
            <td className="border border-black p-2 text-center font-medium">
              <div>Inst. Declaration format</div>
              <div className="font-mono mt-0.5">FRM-WH-QA-208</div>
            </td>
            <td className="border border-black p-2 text-center font-medium">Monthly</td>
            <td className="border border-black p-2 text-center font-medium">QA Lab Assistant</td>
            <td className="border border-black p-2 text-center">-</td>
          </tr>

          {/* ── Step 3: Decision Diamond 1 (Is declaration report received ?) ── */}
          <tr className="align-middle">
            <td className="border border-black p-2 text-center font-bold text-sm">3</td>
            <td className="border border-black p-0 align-middle relative bg-white">
              <div className="relative w-full flex flex-col items-center justify-between py-0 select-none min-h-[110px]">
                {/* Continuous Left Loop Line (passes from bottom up to Step 2) */}
                <div className="absolute left-[20px] top-0 bottom-0 w-[1.5px] bg-black z-0 pointer-events-none" />
                {/* Horizontal branch from Diamond left vertex to Left Loop Line */}
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

                {/* Diamond SVG 1 */}
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
                    Is declaration
                  </text>
                  <text
                    x="100"
                    y="48"
                    textAnchor="middle"
                    fontSize="11"
                    fontFamily="sans-serif"
                    fill="black"
                  >
                    report received ?
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
            <td className="border border-black p-2 text-center font-medium">-</td>
            <td className="border border-black p-2 text-center font-medium">Monthly</td>
            <td className="border border-black p-2 text-center font-medium">QA Lab Assistant</td>
            <td className="border border-black p-2 text-center">-</td>
          </tr>

          {/* ── Step 4: Match declaration report details from calibration plan ── */}
          <tr className="align-middle">
            <td className="border border-black p-2 text-center font-bold text-sm">4</td>
            <td className="border border-black p-0 align-middle relative bg-white">
              <div className="relative w-full flex flex-col items-center justify-between py-1 select-none min-h-[85px]">
                {/* Continuous Left Loop Line passing through row 4 */}
                <div className="absolute left-[20px] top-0 bottom-0 w-[1.5px] bg-black z-0 pointer-events-none" />

                {/* Top Arrow */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-end w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
                </div>

                {/* Box 4 */}
                <div className="w-[230px] border border-black bg-white px-2 py-2 text-center font-normal text-xs leading-snug text-black z-10 shrink-0">
                  Match declaration report details from calibration plan
                </div>

                {/* Bottom line */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-start w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[10px]" />
                </div>
              </div>
            </td>
            <td className="border border-black p-2 text-center font-medium">Calibration plan</td>
            <td className="border border-black p-2 text-center font-medium">Monthly</td>
            <td className="border border-black p-2 text-center font-medium">QA Lab Assistant</td>
            <td className="border border-black p-2 text-center">-</td>
          </tr>

          {/* ── Step 5: Decision Diamond 2 (Is declaration report match calibration plan?) ── */}
          <tr className="align-middle">
            <td className="border border-black p-2 text-center font-bold text-sm">5</td>
            <td className="border border-black p-0 align-middle relative bg-white">
              <div className="relative w-full flex flex-col items-center justify-between py-0 select-none min-h-[110px]">
                {/* Left "No" branch heading up into the loop */}
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

                {/* Diamond SVG 2 */}
                <svg width="200" height="72" viewBox="0 0 200 72" className="z-10 bg-transparent block shrink-0">
                  <polygon
                    points="100,1 199,36 100,71 1,36"
                    fill="white"
                    stroke="black"
                    strokeWidth="1.2"
                  />
                  <text
                    x="100"
                    y="30"
                    textAnchor="middle"
                    fontSize="11"
                    fontFamily="sans-serif"
                    fill="black"
                  >
                    Is declaration
                  </text>
                  <text
                    x="100"
                    y="44"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="sans-serif"
                    fill="black"
                  >
                    report match
                  </text>
                  <text
                    x="100"
                    y="58"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="sans-serif"
                    fill="black"
                  >
                    calibration plan?
                  </text>
                </svg>

                {/* Bottom Line */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-start w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[10px]" />
                </div>
              </div>
            </td>
            <td className="border border-black p-2 text-center font-medium">-</td>
            <td className="border border-black p-2 text-center font-medium">-</td>
            <td className="border border-black p-2 text-center font-medium">-</td>
            <td className="border border-black p-2 text-center">-</td>
          </tr>

          {/* ── Step 6: Yes branch continuing to Step 7 ── */}
          <tr className="align-middle">
            <td className="border border-black p-2 text-center font-bold text-sm">6</td>
            <td className="border border-black p-0 align-middle relative bg-white">
              <div className="relative w-full flex flex-col items-center justify-center py-2 select-none min-h-[60px]">
                <div className="w-[1.5px] bg-black h-[50px] relative">
                  <div className="absolute left-[16px] top-1/2 -translate-y-1/2 z-10">
                    <span className="border border-black bg-white px-1.5 py-0.5 text-[10px] font-bold text-black shadow-xs">
                      Yes
                    </span>
                  </div>
                </div>
              </div>
            </td>
            <td className="border border-black p-2 text-center font-medium">-</td>
            <td className="border border-black p-2 text-center font-medium">-</td>
            <td className="border border-black p-2 text-center font-medium">QA Lab Assistant</td>
            <td className="border border-black p-2 text-center">-</td>
          </tr>

          {/* ── Step 7: Follow the inst. calibration procedure & END ── */}
          <tr className="align-middle">
            <td className="border border-black p-2 text-center font-bold text-sm">7</td>
            <td className="border border-black p-0 align-middle relative bg-white">
              <div className="relative w-full flex flex-col items-center justify-between py-2 select-none min-h-[120px]">
                {/* Top Arrow */}
                <div className="flex-1 min-h-[10px] flex flex-col items-center justify-end w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[8px]" />
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
                </div>

                {/* Box 7 */}
                <div className="w-[230px] border border-black bg-white px-2 py-2 text-center font-normal text-xs leading-snug text-black z-10 shrink-0">
                  Follow the inst. calibration procedure.
                </div>

                {/* Arrow down to END */}
                <div className="flex-1 min-h-[14px] flex flex-col items-center justify-center w-full shrink-0">
                  <div className="w-[1.5px] bg-black flex-1 min-h-[10px]" />
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black shrink-0" />
                </div>

                {/* Hexagon END */}
                <svg width="120" height="30" viewBox="0 0 120 30" className="z-10 bg-transparent block shrink-0">
                  <polygon
                    points="15,1 105,1 119,15 105,29 15,29 1,15"
                    fill="white"
                    stroke="black"
                    strokeWidth="1.2"
                  />
                  <text
                    x="60"
                    y="19"
                    textAnchor="middle"
                    fontSize="11"
                    fontFamily="sans-serif"
                    fill="black"
                  >
                    END
                  </text>
                </svg>
              </div>
            </td>
            <td className="border border-black p-2 text-center font-medium">-</td>
            <td className="border border-black p-2 text-center font-medium">-</td>
            <td className="border border-black p-2 text-center font-medium">-</td>
            <td className="border border-black p-2 text-center">-</td>
          </tr>
        </tbody>
      </table>

      {/* ── Revision Table: Details of Change ── */}
      <table className="w-full text-left border-collapse table-fixed text-xs -mt-[1px]">
        <thead>
          <tr className="font-bold text-center bg-white">
            <th rowSpan={2} className="border border-black w-[15%] p-2 align-middle">
              Revision No.
            </th>
            <th rowSpan={2} className="border border-black w-[20%] p-2 align-middle">
              Revision Date
            </th>
            <th colSpan={2} className="border border-black w-[65%] p-1.5 text-center">
              Details of Change
            </th>
          </tr>
          <tr className="font-bold text-center bg-white">
            <th className="border border-black w-[20%] p-1.5 text-center">Affected Sr. No. / page</th>
            <th className="border border-black w-[45%] p-1.5 text-center">Change details</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {/* Rev 00 */}
          <tr>
            <td className="border border-black p-2.5 text-center font-mono font-bold">00</td>
            <td className="border border-black p-2.5 text-center font-medium">04.07.19</td>
            <td className="border border-black p-2.5 text-center font-medium">All</td>
            <td className="border border-black p-2.5 text-left font-medium">Original issue</td>
          </tr>
        </tbody>
      </table>

      {/* ── Signatures Row: Prepared, Checked, Reviewed, Approved ── */}
      <div className="grid grid-cols-4 border-b border-black bg-white">
        {/* Prepared By */}
        <div className="p-2 flex flex-col justify-between min-h-[75px]">
          <span className="font-bold text-[11px] text-black">Prepared By:</span>
          <div className="mt-1">
            <SignatureApprovalControl
              role="prepared"
              initialApproved={true}
              initialName="Khushboo"
              initialDate="04.07.19"
              onApprove={() => {}}
              onReject={() => {}}
            />
          </div>
        </div>

        {/* Checked By */}
        <div className="p-2 flex flex-col justify-between min-h-[75px]">
          <span className="font-bold text-[11px] text-black">Checked By:</span>
          <div className="mt-1">
            <SignatureApprovalControl
              role="checked"
              initialApproved={true}
              initialName="Arvind"
              initialDate="04.07.19"
              onApprove={() => {}}
              onReject={() => {}}
            />
          </div>
        </div>

        {/* Reviewed By */}
        <div className="p-2 flex flex-col justify-between min-h-[75px]">
          <span className="font-bold text-[11px] text-black">Reviewed By:</span>
          <div className="mt-1">
            <SignatureApprovalControl
              role="reviewed"
              initialApproved={true}
              initialName="Arvind"
              initialDate="04.07.19"
              onApprove={() => {}}
              onReject={() => {}}
            />
          </div>
        </div>

        {/* Approved By */}
        <div className="p-2 flex flex-col justify-between min-h-[75px]">
          <span className="font-bold text-[11px] text-black">Approved by:</span>
          <div className="mt-1">
            <SignatureApprovalControl
              role="approved"
              initialApproved={true}
              initialName="Yadvender"
              initialDate="04.07.19"
              onApprove={() => {}}
              onReject={() => {}}
            />
          </div>
        </div>
      </div>

      {/* ── Document Footer Metadata Bar ── */}
      <div className="flex items-center justify-between px-3 py-1 text-[11px] font-semibold bg-white text-black">
        <div>FRM-WH-QA-214</div>
        <div>Rev:00</div>
        <div>Issue Date: 25.02.2019</div>
        <div>Page: 1 of 1</div>
      </div>
    </div>
  );
}
