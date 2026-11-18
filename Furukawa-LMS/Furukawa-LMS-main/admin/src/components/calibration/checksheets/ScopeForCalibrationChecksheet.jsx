import React from 'react';

export const SCOPE_CALIBRATION_DATA = [
  { sNo: 1, name: 'Digital Point Micrometer', range: '0-20 mm', source: 'In-house', masterEquipment: 'Gauge block set(Slip gauge set)', masterNo: '1703012, 0808258', method: 'WIN-WH-QA-051' },
  { sNo: 2, name: 'Measuring Scale', range: '0-1000 mm', source: 'In-house', masterEquipment: 'Gauge block set(Slip gauge set)', masterNo: '1703012, 0808258', method: 'OST-WH-QA-086' },
  { sNo: 3, name: 'Digital Blade Micrometer', range: '0-25 mm', source: 'In-house', masterEquipment: 'Gauge block set(Slip gauge set)', masterNo: '1703012, 0808258', method: 'WIN-WH-QA-051' },
  { sNo: 4, name: 'Pressure gauge', range: '0-1 mpa', source: 'In-house', masterEquipment: 'Digital Pressure gauge/Pressure gauge kit', masterNo: 'D22F3002', method: 'WIN-WH-QA-145' },
  { sNo: 5, name: 'Pressure gauge', range: '0- 10.6KG/CM2', source: 'In-house', masterEquipment: 'Digital Pressure gauge/Pressure gauge kit', masterNo: 'D22F3002', method: 'WIN-WH-QA-145' },
  { sNo: 6, name: 'Pressure gauge', range: '0-1.6 mpa', source: 'In-house', masterEquipment: 'Digital Pressure gauge/Pressure gauge kit', masterNo: 'D22F3002', method: 'WIN-WH-QA-145' },
  { sNo: 7, name: 'Measuring Scale', range: '0-6400 mm', source: 'In-house', masterEquipment: 'Gauge block set(Slip gauge set)', masterNo: '1703012, 0808258', method: 'OST-WH-QA-086' },
  { sNo: 8, name: 'YY8 Protector Torque Jig', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 9, name: 'Insertion Gauge', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 10, name: 'Right Angle', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 11, name: 'Measuring Tape', range: '0-3000 mm', source: 'In-house', masterEquipment: 'Gauge block set(Slip gauge set)', masterNo: '1703012, 0808258', method: 'OST-WH-QA-086' },
  { sNo: 12, name: 'Pressure gauge', range: '0-0.4 mpa', source: 'In-house', masterEquipment: 'Digital Pressure gauge/Pressure gauge kit', masterNo: 'D22F3002', method: 'WIN-WH-QA-145' },
  { sNo: 13, name: 'Digital Dial Gauge', range: '0-12.7mm', source: 'In-house', masterEquipment: 'Gauge block set(Slip gauge set)', masterNo: '1703012, 0808258', method: 'WIN-WH-QA-052' },
  { sNo: 14, name: 'Digital Dial Gauge', range: '0-13.60mm', source: 'In-house', masterEquipment: 'Gauge block set(Slip gauge set)', masterNo: '1703012, 0808258', method: 'WIN-WH-QA-052' },
  { sNo: 15, name: 'Digital Dial Gauge', range: '0-5mm', source: 'In-house', masterEquipment: 'Gauge block set(Slip gauge set)', masterNo: '1703012, 0808258', method: 'WIN-WH-QA-052' },
  { sNo: 16, name: 'Pressure gauge', range: '0- 10KG/CM2', source: 'In-house', masterEquipment: 'Digital Pressure gauge/Pressure gauge kit', masterNo: 'D22F3002', method: 'WIN-WH-QA-145' },
  { sNo: 17, name: 'Pressure gauge', range: '0- 21KG/CM2', source: 'In-house', masterEquipment: 'Digital Pressure gauge/Pressure gauge kit', masterNo: 'D22F3002', method: 'WIN-WH-QA-145' },
  { sNo: 18, name: 'Grommet Ins./Ret. Plate', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 19, name: 'Pressure gauge', range: '0- 28KG/CM2', source: 'In-house', masterEquipment: 'Digital Pressure gauge/Pressure gauge kit', masterNo: 'D22F3002', method: 'WIN-WH-QA-145' },
  { sNo: 20, name: 'Nir-007 Pigital Checking Jig S Ab', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 21, name: 'Nir-007 Pigital Checking Jig S N-Ab', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 22, name: 'Double Point Micrometer', range: '0-25 mm', source: 'In-house', masterEquipment: 'Gauge block set(Slip gauge set)', masterNo: '1703012, 0808258', method: 'WIN-WH-QA-051' },
  { sNo: 23, name: 'Pressure gauge', range: '0-10 bar', source: 'In-house', masterEquipment: 'Digital Pressure gauge/Pressure gauge kit', masterNo: 'D22F3002', method: 'WIN-WH-QA-145' },
  { sNo: 24, name: 'Measuring Tape', range: '0-3600 mm', source: 'In-house', masterEquipment: 'Gauge block set(Slip gauge set)', masterNo: '1703012, 0808258', method: 'OST-WH-QA-086' },
  { sNo: 25, name: 'SZR017 [FFC-2] BENDING JIG', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 26, name: 'SZR017 [FFC-1st] BENDING JIG', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 27, name: 'Measuring Tape', range: '0-5000 mm', source: 'In-house', masterEquipment: 'Gauge block set(Slip gauge set)', masterNo: '1703012, 0808258', method: 'OST-WH-QA-086' },
  { sNo: 28, name: 'Bending Jig SZR -014', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 29, name: 'Bending Jig SZR -013', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 30, name: 'Bending Jig NIR -007', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 31, name: 'Szr-013/014 Pigital Assy. Jig', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 32, name: 'Szr-013/014 Alignment Assy. Jig(Sc Side)', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 33, name: 'Szr-017 Alignment Jig(Sc Side)', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 34, name: 'Szr-013/014 Alignment Assy. Jig(C Ab Side)', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 35, name: 'Szr-013/014 Alignment Assy. Jig(Sc Side)', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 36, name: 'Szr-020 Alignment Gauge.(C N/Ab) Pass Throw', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 37, name: 'Szr-020 Alignment Gauge.(C Ab Side) Pass Throw', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 38, name: 'Szr-014 Alignment Jig', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 39, name: 'Szr-017 Alignment Jig', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 40, name: 'Rbc/Bbg-Pvc Template', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 41, name: 'Xbb-Pvc Template', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 42, name: 'Pigital Measuring Template For Xba/Xbb', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 43, name: 'Xbb/Bbg Pvc Measuring Jig', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 44, name: 'Mandrel', range: '----', source: 'In-house', masterEquipment: 'Vision Measuring Machine', masterNo: '000010909', method: 'OST-WH-QA-097' },
  { sNo: 45, name: 'Measuring Scale', range: '0-3000 mm', source: 'In-house', masterEquipment: 'Gauge block set(Slip gauge set)', masterNo: '1703012, 0808258', method: 'OST-WH-QA-086' }
];

export default function ScopeForCalibrationChecksheet({
  document = {},
  onSave = () => {}
}) {
  return (
    <div className="w-[1140px] shrink-0 mx-auto bg-white border-2 border-black text-black font-sans shadow-lg text-xs print:w-full print:border-black select-text overflow-hidden">
      {/* ── Document Header Title ── */}
      <div className="w-full bg-white text-center py-2.5 px-3 border-b-2 border-black font-bold text-base tracking-wide text-black uppercase">
        Scope for calibration instruments in-house
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
            <th className="p-2">Instrument Name</th>
            <th className="p-2">Calibration Range</th>
            <th className="p-2">Source</th>
            <th className="p-2">Master equipment</th>
            <th className="p-2">Master equipment No.</th>
            <th className="p-2 border-r border-black">Calibration Method</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black divide-x divide-black bg-white">
          {SCOPE_CALIBRATION_DATA.map((row) => (
            <tr key={row.sNo} className="hover:bg-slate-50/50">
              <td className="p-1.5 text-center font-bold">{row.sNo}</td>
              <td className="p-1.5 font-medium">{row.name}</td>
              <td className="p-1.5 text-center font-medium font-mono">{row.range}</td>
              <td className="p-1.5 text-center font-medium">{row.source}</td>
              <td className="p-1.5 font-medium">{row.masterEquipment}</td>
              <td className="p-1.5 text-center font-medium font-mono">{row.masterNo}</td>
              <td className="p-1.5 text-center font-medium font-mono border-r border-black">{row.method}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
