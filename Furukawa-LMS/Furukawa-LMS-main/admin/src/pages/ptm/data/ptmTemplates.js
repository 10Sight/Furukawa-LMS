export const PTM_TEMPLATE_PHASES = [
  {
    key: 'Phase 1',
    pageName: 'Phase 1',
    phaseNo: '1',
    label: '1: Plan & Define',
  },
  {
    key: 'Phase 2',
    pageName: 'Phase 2',
    phaseNo: '2',
    label: '2: Product & Process Design',
  },
  {
    key: 'Phase 3',
    pageName: 'Phase 3',
    phaseNo: '3',
    label: '3: Process & Development',
  },
  {
    key: 'Phase 4',
    pageName: 'Phase 4',
    phaseNo: '4',
    label: '4: Product & Process Validation',
  },
  {
    key: 'Phase 5',
    pageName: 'Phase 5',
    phaseNo: '5',
    label: '5: Feedback & Corrective Action',
  },
];

export const TEMPLATE_DEPARTMENTS = [
  { key: 'FA', label: 'F&A' },
  { key: 'HR', label: 'HR' },
  { key: 'MKT', label: 'MKT' },
  { key: 'DD', label: 'D&D' },
  { key: 'PE', label: 'PE' },
  { key: 'PPC', label: 'PPC' },
  { key: 'PROD', label: 'PROD' },
  { key: 'SCM', label: 'SCM' },
  { key: 'Quality', label: 'Quality' },
];

export function findTemplatePhaseMeta(phaseInput) {
  const normalized = String(phaseInput || '').trim().toLowerCase();
  if (!normalized) return null;
  return (
    PTM_TEMPLATE_PHASES.find(
      (p) =>
        p.key.toLowerCase() === normalized ||
        p.label.toLowerCase() === normalized ||
        p.phaseNo === normalized
    ) || null
  );
}

export function createTemplateBlankRow(index = 0, phaseMeta = null) {
  return {
    id: `tpl-row-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    rowType: 'parent',
    parentSerialNo: index + 1,
    phaseNo: phaseMeta?.phaseNo || '',
    phaseName: phaseMeta?.label || '',
    reqNo: '',
    reqName: '',
    customerEvent: '',
    rankA: '',
    rankB: '',
    rankC: '',
    rankS: '',
    critical: false,
    activity: '',
    departments: {
      FA: '',
      HR: '',
      MKT: '',
      DD: '',
      PE: '',
      PPC: '',
      PROD: '',
      SCM: '',
      Quality: '',
    },
    deliverableRequired: 'Yes',
    deliverable: '',
  };
}

export function createDefaultTemplateRows(count = 10, phaseMeta = null) {
  return Array.from({ length: count }, (_, idx) => createTemplateBlankRow(idx, phaseMeta));
}
