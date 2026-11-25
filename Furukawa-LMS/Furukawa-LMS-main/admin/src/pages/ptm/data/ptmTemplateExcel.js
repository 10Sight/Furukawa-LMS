import * as XLSX from 'xlsx';
import { createTemplateBlankRow, TEMPLATE_DEPARTMENTS } from './ptmTemplates';

export const TEMPLATE_EXCEL_HEADERS = [
  'Phase No. / Name',
  'AIAG APQP Requirements',
  'Custom Event',
  'Rank A',
  'Rank B',
  'Rank C1 & C2',
  'Rank S',
  'Critical Activity',
  'Activity (New)',
  'F & A',
  'HR',
  'MKT',
  'D&D',
  'PE',
  'PPC',
  'PROD',
  'SCM',
  'Quality',
  'Deliverable Required Yes / No (if yes than put Format no.)',
];

const normalizeHeader = (val) =>
  String(val || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const formatRankForExport = (val) => {
  if (val === 'applicable') return 'Applicable';
  if (val === 'if_required') return 'If Required';
  return '';
};

const parseRankFromImport = (val) => {
  const s = String(val || '').trim().toLowerCase();
  if (!s || s === '-' || s === '—' || s === 'no' || s === 'na' || s === 'n/a') return '';
  if (s.includes('if') || s.includes('req') || s === '□' || s === 'o') return 'if_required';
  if (s === 'applicable' || s === 'yes' || s === '■' || s === 'x' || s === '1' || s === 'true') {
    return 'applicable';
  }
  return '';
};

const formatDeptForExport = (val) => {
  if (val === 'owner') return 'Owner';
  if (val === 'support') return 'Support';
  return '';
};

const parseDeptFromImport = (val) => {
  const s = String(val || '').trim().toLowerCase();
  if (!s || s === '-' || s === '·' || s === 'na' || s === 'n/a') return '';
  if (s.startsWith('o') || s === '●' || s === '1' || s === 'r') return 'owner';
  if (s.startsWith('s') || s === '○' || s === '2' || s === 'c') return 'support';
  return '';
};

const parseCriticalFromImport = (val) => {
  const s = String(val || '').trim().toLowerCase();
  return s === 'yes' || s === 'true' || s === '1' || s === '◆' || s === 'y';
};

const formatDeliverableForExport = (row) => {
  const req = row?.deliverableRequired || 'Yes';
  if (req === 'No') return 'No';
  const fmt = String(row?.deliverable || '').trim();
  return fmt ? `Yes - ${fmt}` : 'Yes';
};

const parseDeliverableFromImport = (val) => {
  const raw = String(val || '').trim();
  if (!raw) return { deliverableRequired: 'Yes', deliverable: '' };
  const lower = raw.toLowerCase();
  if (lower === 'no' || lower.startsWith('no ') || lower.startsWith('no-') || lower.startsWith('no:')) {
    return { deliverableRequired: 'No', deliverable: '' };
  }
  if (lower === 'yes') {
    return { deliverableRequired: 'Yes', deliverable: '' };
  }
  const match = raw.match(new RegExp('^yes\\s*(?:-|:\\s*|\\/)?\\s*(.+)$', 'i'));
  if (match && match[1]) {
    return { deliverableRequired: 'Yes', deliverable: match[1].trim() };
  }
  return { deliverableRequired: 'Yes', deliverable: raw };
};

export function exportTemplateToExcel({ templateName = 'PTM_Template', phaseLabel = '', rows = [] }) {
  const sheetRows = (Array.isArray(rows) ? rows : []).map((row) => ({
    'Phase No. / Name': row.phaseName || phaseLabel || '',
    'AIAG APQP Requirements': row.reqName || '',
    'Custom Event': row.customerEvent || '',
    'Rank A': formatRankForExport(row.rankA),
    'Rank B': formatRankForExport(row.rankB),
    'Rank C1 & C2': formatRankForExport(row.rankC),
    'Rank S': formatRankForExport(row.rankS),
    'Critical Activity': row.critical ? 'Yes' : 'No',
    'Activity (New)': row.activity || '',
    'F & A': formatDeptForExport(row.departments?.FA),
    HR: formatDeptForExport(row.departments?.HR),
    MKT: formatDeptForExport(row.departments?.MKT),
    'D&D': formatDeptForExport(row.departments?.DD),
    PE: formatDeptForExport(row.departments?.PE),
    PPC: formatDeptForExport(row.departments?.PPC),
    PROD: formatDeptForExport(row.departments?.PROD),
    SCM: formatDeptForExport(row.departments?.SCM),
    Quality: formatDeptForExport(row.departments?.Quality),
    'Deliverable Required Yes / No (if yes than put Format no.)': formatDeliverableForExport(row),
  }));

  const worksheet = XLSX.utils.json_to_sheet(
    sheetRows.length > 0
      ? sheetRows
      : [Object.fromEntries(TEMPLATE_EXCEL_HEADERS.map((h) => [h, '']))],
    { header: TEMPLATE_EXCEL_HEADERS }
  );

  worksheet['!cols'] = [
    { wch: 26 }, // Phase No. / Name
    { wch: 30 }, // AIAG APQP Requirements
    { wch: 22 }, // Custom Event
    { wch: 12 }, // Rank A
    { wch: 12 }, // Rank B
    { wch: 14 }, // Rank C1 & C2
    { wch: 12 }, // Rank S
    { wch: 16 }, // Critical Activity
    { wch: 34 }, // Activity (New)
    { wch: 10 }, // F & A
    { wch: 10 }, // HR
    { wch: 10 }, // MKT
    { wch: 10 }, // D&D
    { wch: 10 }, // PE
    { wch: 10 }, // PPC
    { wch: 10 }, // PROD
    { wch: 10 }, // SCM
    { wch: 10 }, // Quality
    { wch: 44 }, // Deliverable
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

  const safeName = String(templateName || 'PTM_Template')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_');
  XLSX.writeFile(workbook, `${safeName}.xlsx`);
}

export async function parseTemplateExcelFile(file, phaseMeta = null) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded Excel file has no sheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawObjects = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  if (!Array.isArray(rawObjects) || rawObjects.length === 0) {
    throw new Error('The uploaded Excel sheet has no data rows.');
  }

  const parsedRows = rawObjects
    .map((raw, idx) => {
      const byNormKey = {};
      Object.entries(raw).forEach(([k, v]) => {
        byNormKey[normalizeHeader(k)] = v;
      });

      const getVal = (...aliases) => {
        for (const alias of aliases) {
          const norm = normalizeHeader(alias);
          if (norm in byNormKey) return byNormKey[norm];
        }
        return '';
      };

      const base = createTemplateBlankRow(idx, phaseMeta);
      const rawPhaseName = String(getVal('Phase No. / Name', 'Phase Name', 'Phase') || '').trim();
      const phaseName = rawPhaseName || phaseMeta?.label || '';
      const phaseNumMatch = phaseName.match(/^(\d+)\s*:/);
      const phaseNo = phaseNumMatch ? phaseNumMatch[1] : phaseMeta?.phaseNo || '';

      const deliverableParsed = parseDeliverableFromImport(
        getVal(
          'Deliverable Required Yes / No (if yes than put Format no.)',
          'Deliverable Required Yes / No',
          'Deliverable Required',
          'Deliverable'
        )
      );

      const departments = { ...base.departments };
      TEMPLATE_DEPARTMENTS.forEach((dept) => {
        const rawDept =
          dept.key === 'FA'
            ? getVal('F & A', 'F&A', 'FA')
            : dept.key === 'DD'
              ? getVal('D&D', 'DD')
              : getVal(dept.label, dept.key);
        departments[dept.key] = parseDeptFromImport(rawDept);
      });

      return {
        ...base,
        phaseNo,
        phaseName,
        reqName: String(getVal('AIAG APQP Requirements', 'AIAG Requirements', 'Requirements') || '').trim(),
        customerEvent: String(getVal('Custom Event', 'Custom Event Name', 'Customer Event Name') || '').trim(),
        rankA: parseRankFromImport(getVal('Rank A')),
        rankB: parseRankFromImport(getVal('Rank B')),
        rankC: parseRankFromImport(getVal('Rank C1 & C2', 'Rank C')),
        rankS: parseRankFromImport(getVal('Rank S')),
        critical: parseCriticalFromImport(getVal('Critical Activity', 'Critical')),
        activity: String(getVal('Activity (New)', 'Activity') || '').trim(),
        departments,
        deliverableRequired: deliverableParsed.deliverableRequired,
        deliverable: deliverableParsed.deliverable,
      };
    })
    .filter((row) =>
      Boolean(
        row.reqName ||
          row.customerEvent ||
          row.activity ||
          row.deliverable ||
          row.rankA ||
          row.rankB ||
          row.rankC ||
          row.rankS ||
          Object.values(row.departments).some(Boolean)
      )
    );

  if (parsedRows.length === 0) {
    throw new Error('No valid template rows were found. Please check the column headers.');
  }

  return parsedRows;
}
