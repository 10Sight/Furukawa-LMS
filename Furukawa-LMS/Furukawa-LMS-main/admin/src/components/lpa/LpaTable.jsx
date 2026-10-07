import React, { useMemo } from 'react';

export default function LpaTable({ sheet, onChange, zoom = 100 }) {
  const merged = useMemo(() => {
    const starts = new Map(), covered = new Set();
    for (const merge of sheet.merges) {
      starts.set(`${merge.s.r}:${merge.s.c}`, merge);
      for (let r = merge.s.r; r <= merge.e.r; r++) for (let c = merge.s.c; c <= merge.e.c; c++) if (r !== merge.s.r || c !== merge.s.c) covered.add(`${r}:${c}`);
    }
    return { starts, covered };
  }, [sheet.merges]);
  return <table className="lpa-table" style={{ zoom: zoom / 100 }} aria-label={`${sheet.name} LPA worksheet`}>
    <colgroup><col style={{ width: 48 }} />{sheet.columns.map((col, c) => <col key={c} style={{ width: col.width }} />)}</colgroup>
    <thead><tr><th aria-label="Excel row number" />{sheet.columns.map(col => <th key={col.label} scope="col">{col.label}</th>)}</tr></thead>
    <tbody>{sheet.rows.map((row, r) => <tr key={r}><th scope="row">{sheet.startRow + r + 1}</th>{row.map((cell, c) => {
      const key = `${r}:${c}`;
      if (merged.covered.has(key)) return null;
      const merge = merged.starts.get(key);
      return <td key={c} rowSpan={merge ? merge.e.r - r + 1 : 1} colSpan={merge ? merge.e.c - c + 1 : 1}>
        {onChange ? <textarea aria-label={`${sheet.columns[c].label}${sheet.startRow + r + 1}`} value={cell.text} rows={Math.min(10, Math.max(2, cell.text.split('\n').length, Math.ceil(cell.text.length / 45)))} onChange={event => onChange(r, c, event.target.value)} spellCheck={false} /> : <span>{cell.text}</span>}
      </td>;
    })}</tr>)}</tbody>
  </table>;
}
