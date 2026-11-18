import React from 'react';

export const SCOPE_INSPECTION_DATA = [
  { sNo: 46, partName: 'Wire Stripper Jig', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 47, partName: 'Wire resistance meter', partType: '0-20Ω', source: 'In-house', standardName: 'STD Resistance Box "Sigma"', personCompetent: '240326', masterUsed: 'OST-WH-QA-099' },
  { sNo: 48, partName: 'Measuring Scale', partType: '0-300 mm', source: 'In-house', standardName: 'Gauge block set(Slip gauge set)', personCompetent: '1703012, 0808258', masterUsed: 'OST-WH-QA-086' },
  { sNo: 49, partName: 'Weight', partType: '----', source: 'In-house', standardName: 'Digital Weihing Blance', personCompetent: 'WM-0005', masterUsed: 'OST-WH-QA-100' },
  { sNo: 50, partName: 'Pressure gauge', partType: '0- 1.06KG/CM2', source: 'In-house', standardName: 'Digital Pressure gauge/Pressure gauge kit', personCompetent: 'D22F3002', masterUsed: 'WIN-WH-QA-145' },
  { sNo: 51, partName: 'Pressure gauge', partType: '0- 4.2KG/CM2', source: 'In-house', standardName: 'Digital Pressure gauge/Pressure gauge kit', personCompetent: 'D22F3002', masterUsed: 'WIN-WH-QA-145' },
  { sNo: 52, partName: 'Pressure gauge', partType: '0- 7KG/CM2', source: 'In-house', standardName: 'Digital Pressure gauge/Pressure gauge kit', personCompetent: 'D22F3002', masterUsed: 'WIN-WH-QA-145' },
  { sNo: 53, partName: 'Digital micro ohm meter', partType: '1999 µΩ - 19.99 KΩ', source: 'In-house', standardName: 'STD Resistance Box "Sigma"', personCompetent: '240326', masterUsed: 'OST-WH-QA-099' },
  { sNo: 54, partName: 'Digital micro ohm meter', partType: '1 µΩ - 29.99 KΩ', source: 'In-house', standardName: 'STD Resistance Box "Sigma"', personCompetent: '240326', masterUsed: 'OST-WH-QA-099' },
  { sNo: 55, partName: 'Bend Gauge', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 56, partName: 'Push Pull Gauge Fixture Plate', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 57, partName: 'NCot Gauge', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-048' },
  { sNo: 58, partName: 'Digital Weighing machine', partType: '0-620g', source: 'In-house', standardName: 'SS Laboratory Weights Set,#Class:"E2"', personCompetent: 'WT/AS-II/2025/3806', masterUsed: 'OST-WH-QA-102' },
  { sNo: 59, partName: 'Digital Weighing machine', partType: '0-420g', source: 'In-house', standardName: 'SS Laboratory Weights Set,#Class:"E2"', personCompetent: 'WT/AS-II/2025/3806', masterUsed: 'OST-WH-QA-102' },
  { sNo: 60, partName: 'Vinyl Tube Gauge', partType: '6-16', source: 'In-house', standardName: 'Digital Vernier caliper', personCompetent: 'A18010625', masterUsed: 'OST-WH-QA-098' },
  { sNo: 61, partName: 'Vinyl Tube Gauge', partType: '20-34', source: 'In-house', standardName: 'Digital Vernier caliper', personCompetent: 'A18010625', masterUsed: 'OST-WH-QA-098' },
  { sNo: 62, partName: 'Flat Micrometer', partType: '0-25mm', source: 'In-house', standardName: 'Gauge block set(Slip gauge set)', personCompetent: '1703012, 0808258', masterUsed: 'WIN-WH-QA-051' },
  { sNo: 63, partName: 'Thickness Tester', partType: '0-10mm', source: 'In-house', standardName: 'Gauge block set(Slip gauge set)', personCompetent: '1703012, 0808258', masterUsed: 'WIN-WH-QA-052' },
  { sNo: 64, partName: 'Thickness Tester', partType: '0-25 mm', source: 'In-house', standardName: 'Gauge block set(Slip gauge set)', personCompetent: '1703012, 0808258', masterUsed: 'WIN-WH-QA-052' },
  { sNo: 65, partName: 'Stripping Gauge', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 66, partName: 'NG Master Jig - Electronic Part Insertion M/C', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 67, partName: 'OK Master Jig - Electronic Part Insertion M/C', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 68, partName: 'NG Master Jig Receptacle Insertion M/C', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 69, partName: 'OK Master Jig Receptacle Insertion M/C', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 70, partName: 'Receptacle Insertion M/C Plate', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 71, partName: 'Busbar Arrangement Jig', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 72, partName: 'TSN-8M', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 73, partName: 'SSG/TSN4-20M', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 74, partName: 'SSG/DS4-20M-B', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 75, partName: 'SSG/TSN10-18M-GR', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 76, partName: 'SSG/TSN8-18M', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 77, partName: 'Ferrite Checker Jig (Nir)', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 78, partName: 'Pigital Measuring Template For Xba/Xbb', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 79, partName: 'Pigital Assy Jig', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 80, partName: 'Nir Dummy', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 81, partName: 'Szr Dummy', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 82, partName: 'Pvc Measuring Template Jig', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 83, partName: 'JB Position Jig', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 84, partName: 'Pvc Tube Mesuring Jig', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 85, partName: 'YSN-8M', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 86, partName: 'TSN-12 M', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 87, partName: 'SSE-SB-6M', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 88, partName: 'SSG-TP-9MA-GR', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 89, partName: 'Insertion Gauge', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' },
  { sNo: 90, partName: 'Right Angle', partType: '----', source: 'In-house', standardName: 'Vision Measuring Machine', personCompetent: '000010909', masterUsed: 'OST-WH-QA-097' }
];

export default function ScopeForInspectionChecksheet({
  document = {},
  onSave = () => {}
}) {
  return (
    <div className="w-[1140px] shrink-0 mx-auto bg-white border-2 border-black text-black font-sans shadow-lg text-xs print:w-full print:border-black select-text overflow-hidden">
      {/* ── Document Header Title ── */}
      <div className="w-full bg-white text-center py-2.5 px-3 border-b-2 border-black font-bold text-base tracking-wide text-black uppercase">
        Scope for Inspection &amp; testing
      </div>

      {/* ── Scope Table ── */}
      <table className="w-full text-left border-collapse table-fixed text-[11px]">
        <colgroup>
          <col style={{ width: '5.5%' }} />
          <col style={{ width: '24.5%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '12%' }} />
        </colgroup>
        <thead>
          <tr className="bg-white text-black font-bold border-b border-black divide-x divide-black text-center uppercase text-[11px]">
            <th className="p-2">Sr. No.</th>
            <th className="p-2">Part Name</th>
            <th className="p-2">Part type</th>
            <th className="p-2">Source</th>
            <th className="p-2">Standard name</th>
            <th className="p-2">Person Competent</th>
            <th className="p-2 border-r border-black">Master Instrument/Eqp. Used</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black divide-x divide-black bg-white">
          {SCOPE_INSPECTION_DATA.map((row) => (
            <tr key={row.sNo} className="hover:bg-slate-50/50">
              <td className="p-1.5 text-center font-bold">{row.sNo}</td>
              <td className="p-1.5 font-medium">{row.partName}</td>
              <td className="p-1.5 text-center font-medium font-mono">{row.partType}</td>
              <td className="p-1.5 text-center font-medium">{row.source}</td>
              <td className="p-1.5 font-medium">{row.standardName}</td>
              <td className="p-1.5 text-center font-medium font-mono">{row.personCompetent}</td>
              <td className="p-1.5 text-center font-medium font-mono border-r border-black">{row.masterUsed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
