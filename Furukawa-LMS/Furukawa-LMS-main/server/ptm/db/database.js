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

const DB_FILE = path.join(DATA_DIR, 'ptm_dashboard.db');
const db = new DatabaseSync(DB_FILE);

// Initialize Tables
export function initDatabase() {
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

  // 3. Seed initial PTM items if empty
  const itemCount = db.prepare('SELECT COUNT(*) as count FROM ptm_items').get().count;
  if (itemCount === 0) {
    const initialItems = [
      {
        id: "PTM-GJ-101",
        topic: "Reduction of Solder Bridge Defects in ECU Assembly",
        description: "Implement automated optical inspection (AOI) pre-wave soldering verification to reduce rework cycle time.",
        plant: "Gujrat",
        scope: "Company",
        department: "SRC Quality",
        date: "23 Sep 2026",
        time: "09:45 AM",
        owner_name: "YOGESH KUMAR",
        owner_code: "AS081215",
        avatar_bg: "bg-blue-100 text-blue-700",
        initials: "YK",
        is_self: 0,
      },
      {
        id: "PTM-BW-102",
        topic: "Die-Casting Cycle Time Optimization on Cell #4",
        description: "Hydraulic pressure recalibration and chilled water cooling channel upgrade for lower cycle duration.",
        plant: "Bawal",
        scope: "Company",
        department: "Die Casting",
        date: "22 Sep 2026",
        time: "11:15 AM",
        owner_name: "RAHUL SHARMA",
        owner_code: "BW041920",
        avatar_bg: "bg-emerald-100 text-emerald-700",
        initials: "RS",
        is_self: 1,
      },
      {
        id: "PTM-GJ-103",
        topic: "Forklift Traffic Collision Prevention IoT Radar",
        description: "Install 360-degree proximity sensors and warning buzzers at blind intersections in main warehouse.",
        plant: "Gujrat",
        scope: "Company",
        department: "EHS Safety",
        date: "20 Sep 2026",
        time: "02:30 PM",
        owner_name: "AMIT PATEL",
        owner_code: "GJ092311",
        avatar_bg: "bg-amber-100 text-amber-700",
        initials: "AP",
        is_self: 0,
      },
      {
        id: "PTM-BW-104",
        topic: "Air Compressor Energy Leakage Elimination",
        description: "Ultrasonic air leak survey across pneumatic piping network in press shop to reduce kWh consumption.",
        plant: "Bawal",
        scope: "Department",
        department: "Plant Maintenance",
        date: "18 Sep 2026",
        time: "04:00 PM",
        owner_name: "SANDEEP VERMA",
        owner_code: "BW071562",
        avatar_bg: "bg-purple-100 text-purple-700",
        initials: "SV",
        is_self: 0,
      },
      {
        id: "PTM-GJ-105",
        topic: "Harness Connector Pin Insertion Torque Auditing",
        description: "Introduce smart screwdrivers with digital torque feedback and barcode interlock on Line 3.",
        plant: "Gujrat",
        scope: "Department",
        department: "Wiring Harness",
        date: "15 Sep 2026",
        time: "08:20 AM",
        owner_name: "PRIYA NAIR",
        owner_code: "GJ018442",
        avatar_bg: "bg-rose-100 text-rose-700",
        initials: "PN",
        is_self: 1,
      },
      {
        id: "PTM-BW-106",
        topic: "Stamping Tool Changeover SMED Time Reduction",
        description: "Standardize pneumatic quick-clamp fixtures to reduce changeover from 45 min down to 15 min.",
        plant: "Bawal",
        scope: "Company",
        department: "Press & Stamping",
        date: "12 Sep 2026",
        time: "01:10 PM",
        owner_name: "MANISH JOSHI",
        owner_code: "BW092301",
        avatar_bg: "bg-indigo-100 text-indigo-700",
        initials: "MJ",
        is_self: 0,
      }
    ];

    const insertItem = db.prepare(`
      INSERT INTO ptm_items (id, topic, description, plant, scope, department, date, time, owner_name, owner_code, avatar_bg, initials, is_blank_ptm, is_self)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);

    for (const item of initialItems) {
      insertItem.run(
        item.id,
        item.topic,
        item.description,
        item.plant,
        item.scope,
        item.department,
        item.date,
        item.time,
        item.owner_name,
        item.owner_code,
        item.avatar_bg,
        item.initials,
        item.is_self
      );
    }
  }
}

export default db;
