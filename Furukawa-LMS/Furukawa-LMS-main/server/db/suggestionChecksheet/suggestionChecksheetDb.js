import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../../logger/winston.logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SUGGESTION_STORE_PATH = path.join(__dirname, "suggestion_checksheet_store.json");

const SEED_SUGGESTION_CHECKSHETS = [
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
    rejectedAccepted: 'ACCEPTED',
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
    id: 'SC-GJR-2015',
    date: '2026-11-02',
    unit: 'Gujrat',
    department: 'Quality Assurance',
    section: 'Testing Bay',
    lineArea: 'Testing Bay #2',
    title: 'Laser optical pin-pitch verification for connector wiring harness',
    description: 'Replace manual caliper sampling with continuous laser inspection scanner.',
    problemText: 'Harness pin pitch deviation is checked manually on every 50th harness, allowing potential subtle pin displacement defects to pass undetected between sampling intervals.',
    suggestionText: 'Deploy inline high-speed laser optical profilometer at harness clipping station. Scan 100% harnesses and automatically hold indexing carriage if pin displacement > 0.05 mm is detected.',
    category: 'Quality',
    submittedBy: 'Deepak Mehta (GJR-7712)',
    employeeCode: 'Testing Bay #2',
    status: 'Approved',
    priority: 'High',
    rejectedAccepted: 'ACCEPTED',
    targetDate: '2026-11-20',
    dateOfImplementation: '2026-11-18',
    lineLeaderSign1: 'Bhavin Patel',
    lineLeaderSign2: 'Bhavin Patel',
    approvalDate: '2026-11-03',
    costSaving: '₹ 2,40,000 / Year (Zero Scrap)',
    benefitStatusDetails: '100% harness verification with automated alert',
    reasonIfRejected: '',
  }
];

export function readSuggestionStore() {
  try {
    if (fs.existsSync(SUGGESTION_STORE_PATH)) {
      const raw = fs.readFileSync(SUGGESTION_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    logger.warn("Failed reading Suggestion Checksheet persistence store:", e.message);
  }
  // Initialize seed data
  try {
    writeSuggestionStore(SEED_SUGGESTION_CHECKSHETS);
  } catch {}
  return SEED_SUGGESTION_CHECKSHETS;
}

export function writeSuggestionStore(records) {
  try {
    const dir = path.dirname(SUGGESTION_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SUGGESTION_STORE_PATH, JSON.stringify(records, null, 2), "utf-8");
  } catch (e) {
    logger.error("Failed writing Suggestion Checksheet persistence store:", e.message);
  }
}
