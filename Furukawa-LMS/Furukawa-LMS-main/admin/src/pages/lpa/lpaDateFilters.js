export function normalizeLpaDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  const dmy = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (dmy) return `${dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function matchesLpaDateRange(value, fromDate = '', toDate = '') {
  if (!fromDate && !toDate) return true;
  const date = normalizeLpaDate(value);
  return Boolean(date) && (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
}
