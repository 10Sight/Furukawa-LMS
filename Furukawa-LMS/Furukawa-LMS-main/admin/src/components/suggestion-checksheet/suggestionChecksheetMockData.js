export const INITIAL_SUGGESTION_CHECKSHETS = [
  {
    id: 'SC-BWL-1021',
    date: '2026-11-01',
    unit: 'Bawal',
    department: 'Production',
    section: 'Main Assembly',
    lineArea: 'Assembly Line 1',
    title: 'Pneumatic tool torque verification checklist integration',
    description: 'Implement automated wireless torque verification checkpoints before chassis transfer.',
    problemText: 'Current manual torque tightening on chassis bolts has occasional variation. Operators verify torque using mechanical click-type wrench, leading to human fatigue and lack of real-time digital record logging.',
    suggestionText: 'Implement automated wireless pneumatic torque verification checklist integration. Set auto-cutoff when target torque (45 Nm ± 2 Nm) is reached and push confirmation signal to PLC line interlock before conveyor indexing.',
    category: 'Quality',
    submittedBy: 'Vikas Sharma (BWL-4821)',
    employeeCode: 'Assembly Line 1',
    status: 'Approved',
    priority: 'High',
    targetDate: '2026-11-15',
    dateOfImplementation: '2026-11-10',
    lineLeaderSign1: 'R. K. Verma',
    lineLeaderSign2: 'R. K. Verma',
    approvalDate: '2026-11-02',
    costSaving: '₹ 1,20,000 / Year',
    benefitStatusDetails: 'Quality audit verified zero warranty slips',
    reasonIfRejected: '',
  },
  {
    id: 'SC-BWL-1024',
    date: '2026-11-02',
    unit: 'Bawal',
    department: 'Press & Stamping',
    section: 'Heavy Press Bed',
    lineArea: 'Press Line #4',
    title: 'Dual-sensor safety curtain installation for hydraulic press #4',
    description: 'Add redundant optical safety sensor to prevent press cycle when operator hands are near die bed.',
    problemText: 'Operators in press line #4 occasionally reach into the die area during sheet positioning before the machine cycle is completely stopped, posing severe crush risk.',
    suggestionText: 'Install dual infrared safety light curtains with Category 4 fail-safe safety relays. The hydraulic power pack shuts down within 15ms if the beam is interrupted.',
    category: 'Safety',
    submittedBy: 'Sunil Kumar (BWL-3109)',
    employeeCode: 'Press Line #4',
    status: 'Implemented',
    priority: 'Urgent',
    targetDate: '2026-11-05',
    dateOfImplementation: '2026-11-04',
    lineLeaderSign1: 'Anil Gupta',
    lineLeaderSign2: 'Anil Gupta',
    approvalDate: '2026-11-02',
    costSaving: 'Zero accidents / 100% Safety Compliance',
    benefitStatusDetails: 'EHS Level 1 certification achieved',
    reasonIfRejected: '',
  },
  {
    id: 'SC-BWL-1029',
    date: '2026-11-03',
    unit: 'Bawal',
    department: 'Warehouse & Logistics',
    section: 'Raw Material Bay',
    lineArea: 'Coil Dispatch Area',
    title: 'Barcode scan validation for raw sheet coil bins',
    description: 'Reduce picking error by requiring barcode scan confirmation before automated AGV dispatch.',
    problemText: 'Material handlers sometimes dispatch the wrong steel coil grade (CR4 instead of CR2) due to visual similarity of pallet markings.',
    suggestionText: 'Affix 2D QR codes on each coil pallet and require barcode scanner confirmation before opening the automatic high-bay roll-up gate.',
    category: 'Productivity',
    submittedBy: 'Pooja Verma (BWL-5512)',
    employeeCode: 'Coil Dispatch Area',
    status: 'Under Review',
    priority: 'Medium',
    targetDate: '2026-11-25',
    dateOfImplementation: 'Pending',
    lineLeaderSign1: 'S. N. Rao',
    lineLeaderSign2: 'Pending',
    approvalDate: '2026-11-03',
    costSaving: '₹ 45,000 / Month',
    benefitStatusDetails: 'Warehouse audit pending',
    reasonIfRejected: '',
  },
  {
    id: 'SC-GJT-2015',
    date: '2026-11-01',
    unit: 'Gujrat',
    department: 'Paint Shop',
    section: 'Pre-Treatment',
    lineArea: 'Paint Booth A',
    title: 'Recirculating water curtain filter overhaul',
    description: 'Replace standard cartridge filters with washable stainless mesh filters to reduce sludge buildup.',
    problemText: 'Paint sludge accumulates in the water curtain sump every 4 days, requiring manual drain and stoppage of the paint line for 2 hours.',
    suggestionText: 'Introduce automated oil/water skimmer and stainless steel reusable mesh multi-cyclone separator to clean circulating water continuously.',
    category: 'Cost Reduction',
    submittedBy: 'Rahul Patel (GJT-1102)',
    employeeCode: 'Paint Booth A',
    status: 'Approved',
    priority: 'High',
    targetDate: '2026-11-20',
    dateOfImplementation: '2026-11-18',
    lineLeaderSign1: 'Deepak Shah',
    lineLeaderSign2: 'Deepak Shah',
    approvalDate: '2026-11-02',
    costSaving: '₹ 80,000 / Year',
    benefitStatusDetails: 'Water recycling reduced fresh intake 35%',
    reasonIfRejected: '',
  },
  {
    id: 'SC-GJT-2018',
    date: '2026-11-03',
    unit: 'Gujrat',
    department: 'Quality Assurance',
    section: 'Metrology Lab',
    lineArea: 'QA Station 3',
    title: 'Digital surface finish inspection template on tablets',
    description: 'Replace paper-based roughness logsheets with direct tablet input connected to central QA server.',
    problemText: 'Paper inspection logsheets take 2 days to compile into monthly CPK reports and are vulnerable to smudging and lost records.',
    suggestionText: 'Deploy ruggedized tablets with direct wireless gauge input for real-time statistical process control charting.',
    category: '5S',
    submittedBy: 'Mehul Desai (GJT-2244)',
    employeeCode: 'QA Station 3',
    status: 'Under Review',
    priority: 'Medium',
    targetDate: '2026-11-30',
    dateOfImplementation: 'Pending',
    lineLeaderSign1: 'Deepak Shah',
    lineLeaderSign2: 'Pending',
    approvalDate: '2026-11-03',
    costSaving: 'Paperless QA / 4 hrs daily saved',
    benefitStatusDetails: 'Digitized QA pilot running in Section B',
    reasonIfRejected: '',
  },
];

const STORAGE_KEY = 'fme_suggestion_checksheets';

export function getStoredSuggestionChecksheets() {
  if (typeof window === 'undefined') return INITIAL_SUGGESTION_CHECKSHETS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse stored suggestion checksheets:', err);
  }
  return INITIAL_SUGGESTION_CHECKSHETS;
}

export function saveStoredSuggestionChecksheets(records) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('Failed to save suggestion checksheets to storage:', err);
  }
}
