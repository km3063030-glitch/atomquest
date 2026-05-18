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
  { uuid: uuidv4(), name: 'Admin User',    email: 'admin@atomquest.com',    role: 'admin',    department: 'HR',         manager_id: null },
  { uuid: uuidv4(), name: 'Sarah Mitchell',email: 'manager@atomquest.com',  role: 'manager',  department: 'Sales',      manager_id: null },
  { uuid: uuidv4(), name: 'Raj Patel',     email: 'raj@atomquest.com',      role: 'manager',  department: 'Operations', manager_id: null },
  { uuid: uuidv4(), name: 'John Doe',      email: 'employee@atomquest.com', role: 'employee', department: 'Sales',      manager_id: null },
  { uuid: uuidv4(), name: 'Priya Sharma',  email: 'priya@atomquest.com',    role: 'employee', department: 'Sales',      manager_id: null },
  { uuid: uuidv4(), name: 'Alex Chen',     email: 'alex@atomquest.com',     role: 'employee', department: 'Operations', manager_id: null },
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (uuid, name, email, password_hash, role, department, manager_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
users.forEach(u => insertUser.run(u.uuid, u.name, u.email, password, u.role, u.department, u.manager_id));

// Fix manager relationships
db.prepare(`UPDATE users SET manager_id = (SELECT id FROM users WHERE email='manager@atomquest.com') WHERE email IN ('employee@atomquest.com','priya@atomquest.com')`).run();
db.prepare(`UPDATE users SET manager_id = (SELECT id FROM users WHERE email='raj@atomquest.com') WHERE email='alex@atomquest.com'`).run();

console.log('✅ Demo users seeded');

// ── SAMPLE DATA ──────────────────────────────────────────────────────────────
// Runs idempotently — only inserts if not already present
const admin    = db.prepare(`SELECT id FROM users WHERE email='admin@atomquest.com'`).get();
const manager1 = db.prepare(`SELECT id FROM users WHERE email='manager@atomquest.com'`).get();
const manager2 = db.prepare(`SELECT id FROM users WHERE email='raj@atomquest.com'`).get();
const emp1     = db.prepare(`SELECT id FROM users WHERE email='employee@atomquest.com'`).get();
const emp2     = db.prepare(`SELECT id FROM users WHERE email='priya@atomquest.com'`).get();
const emp3     = db.prepare(`SELECT id FROM users WHERE email='alex@atomquest.com'`).get();

const cycle = db.prepare(`SELECT * FROM goal_cycles WHERE is_active=1`).get();

// Fetch thrust area IDs
const taId = (name) => db.prepare(`SELECT id FROM thrust_areas WHERE name=?`).get(name)?.id;

// Helper: get or create an approved goal sheet for an employee
function getOrCreateSheet(empId, managerId) {
  const existing = db.prepare(`SELECT id FROM goal_sheets WHERE employee_id=? AND cycle_id=?`).get(empId, cycle.id);
  if (existing) return existing.id;
  db.prepare(`
    INSERT OR IGNORE INTO goal_sheets (uuid, employee_id, cycle_id, status, submitted_at, approved_at, approved_by, total_weightage)
    VALUES (?, ?, ?, 'approved', '2025-05-10T08:00:00', '2025-05-15T10:00:00', ?, 100)
  `).run(uuidv4(), empId, cycle.id, managerId);
  return db.prepare(`SELECT id FROM goal_sheets WHERE employee_id=? AND cycle_id=?`).get(empId, cycle.id).id;
}

// Helper: insert goal if not exists
function insertGoal(sheetId, thrust, title, desc, uom, tv, td, weight, order) {
  const ex = db.prepare(`SELECT id FROM goals WHERE sheet_id=? AND title=?`).get(sheetId, title);
  if (ex) return ex.id;
  db.prepare(`
    INSERT INTO goals (uuid, sheet_id, thrust_area_id, title, description, uom_type, target_value, target_date, weightage, display_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), sheetId, taId(thrust), title, desc, uom, tv, td, weight, order);
  return db.prepare(`SELECT id FROM goals WHERE sheet_id=? AND title=?`).get(sheetId, title).id;
}

// Helper: upsert achievement
const upsertAch = db.prepare(`
  INSERT INTO achievements (goal_id, cycle_id, quarter, actual_value, actual_date, status, progress_score, employee_notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(goal_id, cycle_id, quarter) DO UPDATE SET
    actual_value=excluded.actual_value, actual_date=excluded.actual_date,
    status=excluded.status, progress_score=excluded.progress_score,
    employee_notes=excluded.employee_notes
`);

// Helper: insert check-in if not exists
const insertCheckin = db.prepare(`INSERT OR IGNORE INTO checkins (sheet_id, manager_id, cycle_id, quarter, comment) VALUES (?, ?, ?, ?, ?)`);

// Helper: insert notification
const insertNotif = db.prepare(`INSERT INTO notifications (user_id, title, message, type, is_read, link) VALUES (?, ?, ?, ?, ?, ?)`);

// ── Only seed sample data if no goal sheets exist yet ────────────────────────
const sheetCount = db.prepare(`SELECT COUNT(*) as c FROM goal_sheets`).get().c;
if (sheetCount === 0 && cycle) {
  console.log('📋 Seeding sample goal data...');

  // John Doe — Sales
  const s1 = getOrCreateSheet(emp1.id, manager1.id);
  const g1 = [
    insertGoal(s1,'Revenue Growth',        'Achieve ₹50L Sales Revenue',         'Monthly revenue target for FY 2025-26',       'numeric_min',5000000,null,30,1),
    insertGoal(s1,'Customer Experience',   'Maintain CSAT Score ≥ 4.2',           'Customer satisfaction across 200+ contacts',  'numeric_min',4.2,    null,20,2),
    insertGoal(s1,'Operational Excellence','Reduce TAT to < 24 Hours',            'Time-to-resolve for all service tickets',     'numeric_max',24,     null,20,3),
    insertGoal(s1,'Safety & Compliance',   'Zero Compliance Violations',          'Maintain zero regulatory incidents',          'zero',       null,   null,15,4),
    insertGoal(s1,'Strategic Initiatives', 'Complete CRM Migration Project',      'Migrate all sales data to new CRM by Q2',    'timeline',   null,'2025-09-30',15,5),
  ];
  upsertAch.run(g1[0],cycle.id,'q1',4200000,null,'on_track',0.84,'Good Q1 start. Pipeline is strong for Q2.');
  upsertAch.run(g1[1],cycle.id,'q1',4.1,    null,'on_track',0.83,'One complaint resolved within 48hr, targeting improvement.');
  upsertAch.run(g1[2],cycle.id,'q1',20,     null,'on_track',1.00,'TAT improved after process changes.');
  upsertAch.run(g1[3],cycle.id,'q1',0,      null,'completed',1.00,'Zero violations this quarter.');
  upsertAch.run(g1[4],cycle.id,'q1',null,   null,'on_track',0.75,'CRM data mapping 75% complete.');
  upsertAch.run(g1[0],cycle.id,'q2',4700000,null,'on_track',0.94,'Closed 3 enterprise deals in Q2.');
  upsertAch.run(g1[1],cycle.id,'q2',4.3,    null,'completed',1.00,'Exceeded CSAT target. Team follow-ups improved.');
  upsertAch.run(g1[2],cycle.id,'q2',18,     null,'completed',1.00,'TAT consistently under 20hrs this quarter.');
  upsertAch.run(g1[3],cycle.id,'q2',0,      null,'completed',1.00,'Audit passed cleanly.');
  upsertAch.run(g1[4],cycle.id,'q2',null,'2025-09-28','completed',1.00,'CRM migration completed 2 days ahead of schedule.');

  // Priya Sharma — Sales
  const s2 = getOrCreateSheet(emp2.id, manager1.id);
  const g2 = [
    insertGoal(s2,'Revenue Growth',    'Generate 30 New Qualified Leads/Month','Outbound + inbound lead generation',            'numeric_min',30,  null,25,1),
    insertGoal(s2,'Customer Experience','Upsell to 25% of Existing Clients',   'Cross-sell premium packages',                  'numeric_min',25,  null,25,2),
    insertGoal(s2,'People & Culture',  'Complete 3 Sales Training Certs',      'Salesforce, HubSpot, Negotiation mastery',     'numeric_min',3,   null,15,3),
    insertGoal(s2,'Innovation',        'Implement Sales Automation Playbook',  'Define and roll out follow-up sequences',       'timeline',   null,'2025-12-31',20,4),
    insertGoal(s2,'Cost Optimisation', 'Reduce Client Acquisition Cost 15%',   'Improve funnel efficiency to cut CAC',         'numeric_max',85,  null,15,5),
  ];
  upsertAch.run(g2[0],cycle.id,'q1',28,null,'on_track',0.93,'Narrowly missed target. LinkedIn outreach promising.');
  upsertAch.run(g2[1],cycle.id,'q1',22,null,'on_track',0.88,'22% upsell rate. Working on demo-to-close conversion.');
  upsertAch.run(g2[2],cycle.id,'q1',2, null,'on_track',0.67,'Completed Salesforce + HubSpot. Negotiation in progress.');
  upsertAch.run(g2[3],cycle.id,'q1',null,null,'on_track',0.50,'Playbook drafted. In review phase.');
  upsertAch.run(g2[4],cycle.id,'q1',92,null,'on_track',0.92,'CAC trending down thanks to better targeted ads.');

  // Alex Chen — Operations
  const s3 = getOrCreateSheet(emp3.id, manager2.id);
  const g3 = [
    insertGoal(s3,'Operational Excellence','Achieve 99.5% System Uptime',          'Infrastructure reliability KPI',              'numeric_min',99.5,null,30,1),
    insertGoal(s3,'Safety & Compliance',   'Zero Reportable Safety Incidents',      'Maintain safe work environment',              'zero',       null,null,20,2),
    insertGoal(s3,'Cost Optimisation',     'Cut Infrastructure Costs by 12%',       'Server consolidation & cloud optimisation',   'numeric_max',88,  null,20,3),
    insertGoal(s3,'Innovation',            'Automate 5 Manual Ops Workflows',        'Use RPA and scripts to cut manual effort',    'numeric_min',5,   null,15,4),
    insertGoal(s3,'People & Culture',      'Mentor 2 Junior Engineers to Mid-Level','Structured mentorship and quarterly reviews', 'numeric_min',2,   null,15,5),
  ];
  upsertAch.run(g3[0],cycle.id,'q1',99.7,null,'completed',1.00,'Uptime exceeded target — zero unplanned outages.');
  upsertAch.run(g3[1],cycle.id,'q1',0,   null,'completed',1.00,'Safety drills conducted. All staff certified.');
  upsertAch.run(g3[2],cycle.id,'q1',90,  null,'on_track',0.97,'Migrated 3 workloads to cloud. On track for Q2.');
  upsertAch.run(g3[3],cycle.id,'q1',4,   null,'on_track',0.80,'4 of 5 automations live. Final one in UAT.');
  upsertAch.run(g3[4],cycle.id,'q1',2,   null,'completed',1.00,'Both mentees promoted to mid-level in April.');

  // Check-ins
  insertCheckin.run(s1,manager1.id,cycle.id,'q1','Great start John. Revenue tracking well. Focus on closing CRM migration in Q2. Keep pushing on CSAT improvement.');
  insertCheckin.run(s2,manager1.id,cycle.id,'q1','Good effort Priya. Leads are close to target. Complete Negotiation cert by Q2. Push the upsell rate on enterprise segment.');
  insertCheckin.run(s3,manager2.id,cycle.id,'q1','Exceptional Q1 Alex. Uptime exceeded, zero incidents, mentees progressed. Get the 5th automation live and maintain cost trajectory.');

  // Notifications — clear any that are just from first-run
  insertNotif.run(emp1.id,'Goal Sheet Approved','Your FY 2025-26 goal sheet was approved by Sarah Mitchell. Goals are now locked.','success',0,'/employee/goals');
  insertNotif.run(emp1.id,'Check-in Comment Received','Sarah Mitchell left a Q1 check-in comment on your progress.','info',0,'/employee/achievements');
  insertNotif.run(emp2.id,'Goal Sheet Approved','Your FY 2025-26 goal sheet was approved by Sarah Mitchell.','success',0,'/employee/goals');
  insertNotif.run(emp2.id,'Check-in Comment Received','Sarah Mitchell left feedback on your Q1 progress. Plan for Q2.','info',0,'/employee/achievements');
  insertNotif.run(emp3.id,'Goal Sheet Approved','Your FY 2025-26 goal sheet has been approved.','success',1,'/employee/goals');
  insertNotif.run(emp3.id,'Check-in Comment Received','Raj Patel left excellent Q1 feedback. Keep up the strong performance.','success',0,'/employee/achievements');
  insertNotif.run(manager1.id,'Team Goals Approved','2 of 2 team members have approved goals. Q1 avg score: 91%.','success',0,'/manager');
  insertNotif.run(manager1.id,'Q1 Check-in Reminder','Add your Q1 check-in comments for your team.','warning',1,'/manager/checkins');
  insertNotif.run(manager2.id,'Team Goals Approved','Alex Chen Q1: 99.7% uptime, zero incidents, 2 mentees promoted.','success',0,'/manager');
  insertNotif.run(admin.id,'System Ready','3 approved goal sheets, 15 goals, 14 achievements loaded. System ready for demo.','success',0,'/admin/reports');

  console.log('✅ Sample data seeded (15 goals, 14 achievements, 3 check-ins, 10 notifications)');
} else if (sheetCount > 0) {
  console.log(`✅ Sample data already present (${sheetCount} sheets found) — skipping`);
}

console.log('\n🔐 Demo Credentials:');
console.log('  Admin:     admin@atomquest.com    / Password@123');
console.log('  Manager 1: manager@atomquest.com  / Password@123  → Sarah Mitchell');
console.log('  Manager 2: raj@atomquest.com      / Password@123  → Raj Patel');
console.log('  Employee 1: employee@atomquest.com / Password@123 → John Doe');
console.log('  Employee 2: priya@atomquest.com    / Password@123 → Priya Sharma');
console.log('  Employee 3: alex@atomquest.com     / Password@123 → Alex Chen');
console.log('\n✅ Database initialized successfully!');

db.close();

