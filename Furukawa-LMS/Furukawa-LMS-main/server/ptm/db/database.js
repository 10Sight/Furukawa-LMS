import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const LEGACY_DB_FILE = path.join(DATA_DIR, 'ptm_dashboard.db');
const DB_FILE = path.join(DATA_DIR, 'ptm_runtime.db');
if (!fs.existsSync(DB_FILE) && fs.existsSync(LEGACY_DB_FILE)) {
  try {
    fs.copyFileSync(LEGACY_DB_FILE, DB_FILE);
  } catch {
    // Fallback to fresh DB initialization if copy fails
  }
}
const db = new DatabaseSync(DB_FILE);

let isInitialized = false;

// Initialize Tables
export function initDatabase() {
  if (isInitialized) return;
  isInitialized = true;
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      department TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'employee',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ptm_items (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      description TEXT,
      plant TEXT NOT NULL,
      scope TEXT DEFAULT 'Company',
      department TEXT,
      date TEXT,
      time TEXT,
      owner_name TEXT,
      owner_code TEXT,
      avatar_bg TEXT,
      initials TEXT,
      is_blank_ptm INTEGER DEFAULT 0,
      is_self INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ptm_sheets (
      sheet_key TEXT PRIMARY KEY,
      header_info TEXT,
      rows_data TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS apqp_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      value TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ptm_default_mail_recipients (
      user_id TEXT PRIMARY KEY,
      email_addresses TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ptm_templates (
      id TEXT PRIMARY KEY,
      phase_key TEXT NOT NULL,
      phase_label TEXT NOT NULL,
      template_name TEXT NOT NULL,
      template_date TEXT NOT NULL,
      rows_data TEXT NOT NULL DEFAULT '[]',
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ptm_phases (
      key TEXT PRIMARY KEY,
      page_name TEXT NOT NULL,
      phase_no TEXT NOT NULL,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedInitialData();
}

function seedInitialData() {
  // 1. Seed Users (Admin, Employee, and Dummy Employees)
  const usersToSeed = [
    {
      username: 'ST080014',
      password: 'ST080014@FME',
      employee_id: 'EMP0080',
      department: 'Assembly',
      name: 'ST080014',
      role: 'admin',
    },
    {
      username: 'Shivampanday',
      password: 'ST080796',
      employee_id: 'EMP0089',
      department: 'C&C Quality',
      name: 'Shivam Panday',
      role: 'employee',
    },
    {
      username: 'AS081215',
      password: 'AS081215@FME',
      employee_id: 'EMP0091',
      department: 'SRC Quality',
      name: 'Yogesh Kumar',
      role: 'employee',
    },
    {
      username: 'BW041920',
      password: 'BW041920@FME',
      employee_id: 'EMP0092',
      department: 'Die Casting',
      name: 'Rahul Sharma',
      role: 'employee',
    },
    {
      username: 'GJ092311',
      password: 'GJ092311@FME',
      employee_id: 'EMP0093',
      department: 'EHS Safety',
      name: 'Amit Patel',
      role: 'employee',
    },
    {
      username: 'BW071562',
      password: 'BW071562@FME',
      employee_id: 'EMP0094',
      department: 'Plant Maintenance',
      name: 'Sandeep Verma',
      role: 'employee',
    },
    {
      username: 'GJ018442',
      password: 'GJ018442@FME',
      employee_id: 'EMP0095',
      department: 'Wiring Harness',
      name: 'Priya Nair',
      role: 'employee',
    },
    {
      username: 'BW092301',
      password: 'BW092301@FME',
      employee_id: 'EMP0096',
      department: 'Press & Stamping',
      name: 'Manish Joshi',
      role: 'employee',
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (username, password, employee_id, department, name, role)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      password = excluded.password,
      employee_id = excluded.employee_id,
      department = excluded.department,
      name = excluded.name,
      role = excluded.role
  `);

  for (const u of usersToSeed) {
    insertUser.run(u.username, u.password, u.employee_id, u.department, u.name, u.role);
  }

  // 2. Seed Default APQP Requirements
  const defaultApqp = [
    'Testing',
    'Design FMEA',
    'Design Verification Plan and Report (DVP&R)',
    'Process Flow Diagram',
    'Process FMEA',
    'Control Plan (Pre-launch / Production)',
    'Measurement System Analysis (MSA)',
    'Initial Process Capability Study (Ppk / Cpk)',
    'Production Part Approval Process (PPAP)',
    'Packaging Specifications',
    'Tooling Readiness & Maintenance Plan',
    'Operator Work Instructions (SOP)',
    'Sample Submission (T0 / T1 / Off-Tool)',
    'Run at Rate (1DR / 2DR / Safe Launch)',
    'Customer Specific Requirements (CSR)',
    'Engineering Change Management (ECN)',
    'Dimensional Inspection Report',
    'Material Test Results (IMDS / RoHS / REACH)',
  ];

  const insertApqp = db.prepare('INSERT OR IGNORE INTO apqp_suggestions (value) VALUES (?)');
  for (const item of defaultApqp) {
    insertApqp.run(item);
  }

  // 3. Seed Default PTM Phases (only when table is empty so user edits persist)
  const phaseCount = db.prepare('SELECT COUNT(*) AS count FROM ptm_phases').get()?.count || 0;
  if (phaseCount === 0) {
    const defaultPhases = [
      { key: 'Phase 1', pageName: 'Phase 1', phaseNo: '1', label: '1: Plan & Define', sortOrder: 1 },
      { key: 'Phase 2', pageName: 'Phase 2', phaseNo: '2', label: '2: Product & Process Design', sortOrder: 2 },
      { key: 'Phase 3', pageName: 'Phase 3', phaseNo: '3', label: '3: Process & Development', sortOrder: 3 },
      { key: 'Phase 4', pageName: 'Phase 4', phaseNo: '4', label: '4: Product & Process Validation', sortOrder: 4 },
      { key: 'Phase 5', pageName: 'Phase 5', phaseNo: '5', label: '5: Feedback & Corrective Action', sortOrder: 5 },
    ];
    const insertPhase = db.prepare(`
      INSERT OR IGNORE INTO ptm_phases (key, page_name, phase_no, label, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const p of defaultPhases) {
      insertPhase.run(p.key, p.pageName, p.phaseNo, p.label, p.sortOrder);
    }
  }
}

initDatabase();

export default db;
