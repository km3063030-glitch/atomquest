// initDb.js — Creates all tables and seeds demo users
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'atomquest.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = `
-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('employee','manager','admin')),
  department TEXT,
  manager_id INTEGER REFERENCES users(id),
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Thrust Areas (configurable by admin)
CREATE TABLE IF NOT EXISTS thrust_areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Goal Cycles (configured by admin)
CREATE TABLE IF NOT EXISTS goal_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  phase TEXT NOT NULL CHECK(phase IN ('goal_setting','q1','q2','q3','q4_annual')),
  window_open TEXT NOT NULL,
  window_close TEXT NOT NULL,
  is_active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Goal Sheets (one per employee per cycle)
CREATE TABLE IF NOT EXISTS goal_sheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  employee_id INTEGER NOT NULL REFERENCES users(id),
  cycle_id INTEGER NOT NULL REFERENCES goal_cycles(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','returned','locked')),
  submitted_at TEXT,
  approved_at TEXT,
  approved_by INTEGER REFERENCES users(id),
  return_reason TEXT,
  total_weightage REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(employee_id, cycle_id)
);

-- Goals
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  sheet_id INTEGER NOT NULL REFERENCES goal_sheets(id) ON DELETE CASCADE,
  thrust_area_id INTEGER REFERENCES thrust_areas(id),
  title TEXT NOT NULL,
  description TEXT,
  uom_type TEXT NOT NULL CHECK(uom_type IN ('numeric_min','numeric_max','timeline','zero')),
  target_value REAL,
  target_date TEXT,
  weightage REAL NOT NULL,
  is_shared INTEGER DEFAULT 0,
  shared_from_goal_id INTEGER REFERENCES goals(id),
  owner_employee_id INTEGER REFERENCES users(id),
  is_readonly_title INTEGER DEFAULT 0,
  is_readonly_target INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Quarterly Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  cycle_id INTEGER NOT NULL REFERENCES goal_cycles(id),
  quarter TEXT NOT NULL CHECK(quarter IN ('q1','q2','q3','q4_annual')),
  actual_value REAL,
  actual_date TEXT,
  status TEXT DEFAULT 'not_started' CHECK(status IN ('not_started','on_track','completed')),
  progress_score REAL,
  employee_notes TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(goal_id, cycle_id, quarter)
);

-- Manager Check-ins
CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sheet_id INTEGER NOT NULL REFERENCES goal_sheets(id),
  manager_id INTEGER NOT NULL REFERENCES users(id),
  cycle_id INTEGER NOT NULL REFERENCES goal_cycles(id),
  quarter TEXT NOT NULL CHECK(quarter IN ('q1','q2','q3','q4_annual')),
  comment TEXT NOT NULL,
  checkin_date TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  changed_by INTEGER REFERENCES users(id),
  changed_by_name TEXT,
  old_value TEXT,
  new_value TEXT,
  field_name TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read INTEGER DEFAULT 0,
  link TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Escalation Rules
CREATE TABLE IF NOT EXISTS escalation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  days_threshold INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
`;

// Run schema
db.exec(schema);
console.log('✅ Schema created');

// Seed thrust areas
const thrustAreas = [
  { name: 'Revenue Growth', description: 'Sales, new clients, revenue targets' },
  { name: 'Operational Excellence', description: 'Process improvement, efficiency' },
  { name: 'Customer Experience', description: 'CSAT, NPS, service quality' },
  { name: 'People & Culture', description: 'Team building, learning, engagement' },
  { name: 'Innovation', description: 'New products, R&D, digital transformation' },
  { name: 'Safety & Compliance', description: 'Zero incidents, regulatory compliance' },
  { name: 'Cost Optimisation', description: 'Cost reduction, budget adherence' },
  { name: 'Strategic Initiatives', description: 'Cross-functional projects' }
];

const insertThrust = db.prepare(`INSERT OR IGNORE INTO thrust_areas (name, description) VALUES (?, ?)`);
thrustAreas.forEach(t => insertThrust.run(t.name, t.description));
console.log('✅ Thrust areas seeded');

// Seed goal cycles
const cycles = [
  { name: 'FY 2025-26 Goal Setting', year: 2025, phase: 'goal_setting', window_open: '2025-05-01', window_close: '2025-06-30', is_active: 1 },
  { name: 'FY 2025-26 Q1 Check-in', year: 2025, phase: 'q1', window_open: '2025-07-01', window_close: '2025-07-31', is_active: 0 },
  { name: 'FY 2025-26 Q2 Check-in', year: 2025, phase: 'q2', window_open: '2025-10-01', window_close: '2025-10-31', is_active: 0 },
  { name: 'FY 2025-26 Q3 Check-in', year: 2025, phase: 'q3', window_open: '2026-01-01', window_close: '2026-01-31', is_active: 0 },
  { name: 'FY 2025-26 Annual Review', year: 2025, phase: 'q4_annual', window_open: '2026-03-01', window_close: '2026-04-30', is_active: 0 }
];

const insertCycle = db.prepare(`INSERT OR IGNORE INTO goal_cycles (name, year, phase, window_open, window_close, is_active) VALUES (?, ?, ?, ?, ?, ?)`);
cycles.forEach(c => insertCycle.run(c.name, c.year, c.phase, c.window_open, c.window_close, c.is_active));
console.log('✅ Goal cycles seeded');

// Seed escalation rules
const rules = [
  { name: 'Goal Not Submitted', trigger_event: 'goal_not_submitted', days_threshold: 7 },
  { name: 'Goal Not Approved', trigger_event: 'goal_not_approved', days_threshold: 5 },
  { name: 'Check-in Not Completed', trigger_event: 'checkin_not_completed', days_threshold: 10 }
];
const insertRule = db.prepare(`INSERT OR IGNORE INTO escalation_rules (name, trigger_event, days_threshold) VALUES (?, ?, ?)`);
rules.forEach(r => insertRule.run(r.name, r.trigger_event, r.days_threshold));

// Seed demo users
const { v4: uuidv4 } = require('uuid');

const password = bcrypt.hashSync('Password@123', 10);

const users = [
  { uuid: uuidv4(), name: 'Admin User', email: 'admin@atomquest.com', role: 'admin', department: 'HR', manager_id: null },
  { uuid: uuidv4(), name: 'Sarah Mitchell', email: 'manager@atomquest.com', role: 'manager', department: 'Sales', manager_id: null },
  { uuid: uuidv4(), name: 'John Doe', email: 'employee@atomquest.com', role: 'employee', department: 'Sales', manager_id: null },
  { uuid: uuidv4(), name: 'Priya Sharma', email: 'priya@atomquest.com', role: 'employee', department: 'Sales', manager_id: null },
  { uuid: uuidv4(), name: 'Alex Chen', email: 'alex@atomquest.com', role: 'employee', department: 'Operations', manager_id: null },
  { uuid: uuidv4(), name: 'Raj Patel', email: 'raj@atomquest.com', role: 'manager', department: 'Operations', manager_id: null }
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (uuid, name, email, password_hash, role, department, manager_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

users.forEach(u => insertUser.run(u.uuid, u.name, u.email, password, u.role, u.department, u.manager_id));

// Set manager_id for employees
db.prepare(`UPDATE users SET manager_id = (SELECT id FROM users WHERE email='manager@atomquest.com') WHERE email IN ('employee@atomquest.com','priya@atomquest.com')`).run();
db.prepare(`UPDATE users SET manager_id = (SELECT id FROM users WHERE email='raj@atomquest.com') WHERE email='alex@atomquest.com'`).run();

console.log('✅ Demo users seeded');
console.log('\n🔐 Demo Credentials:');
console.log('  Admin:    admin@atomquest.com    / Password@123');
console.log('  Manager:  manager@atomquest.com  / Password@123');
console.log('  Employee: employee@atomquest.com / Password@123');
console.log('\n✅ Database initialized successfully!');

db.close();
