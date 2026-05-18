// seed-sample-data.js
// Populates rich sample data for existing demo accounts.
// Run with: node seed-sample-data.js
// Safe to re-run — uses INSERT OR IGNORE / INSERT OR REPLACE throughout.

const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'atomquest.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// ── 1. Ensure cycle phase enum is compatible ──────────────────────────────────
// The DB schema uses: goal_setting | q1 | q2 | q3 | q4_annual
// We'll update the active cycle to "check_in" via phase column if the DB allows,
// but since the constraint only allows q1..q4_annual / goal_setting we leave
// existing cycles as-is and use an approved sheet so achievements can be logged.

// ── 2. Fetch user IDs ──────────────────────────────────────────────────────────
const admin    = db.prepare(`SELECT id FROM users WHERE email = 'admin@atomquest.com'`).get();
const manager1 = db.prepare(`SELECT id FROM users WHERE email = 'manager@atomquest.com'`).get();
const manager2 = db.prepare(`SELECT id FROM users WHERE email = 'raj@atomquest.com'`).get();
const emp1     = db.prepare(`SELECT id FROM users WHERE email = 'employee@atomquest.com'`).get();
const emp2     = db.prepare(`SELECT id FROM users WHERE email = 'priya@atomquest.com'`).get();
const emp3     = db.prepare(`SELECT id FROM users WHERE email = 'alex@atomquest.com'`).get();

if (!emp1 || !emp2 || !emp3 || !manager1) {
  console.error('❌ Demo users not found. Run initDb.js first.');
  process.exit(1);
}

// ── 3. Fix manager references ──────────────────────────────────────────────────
db.prepare(`UPDATE users SET manager_id = ? WHERE id = ?`).run(manager1.id, emp1.id);
db.prepare(`UPDATE users SET manager_id = ? WHERE id = ?`).run(manager1.id, emp2.id);
if (emp3 && manager2) db.prepare(`UPDATE users SET manager_id = ? WHERE id = ?`).run(manager2.id, emp3.id);
console.log('✅ Manager references fixed');

// ── 4. Ensure active cycle exists and is in check_in-compatible phase ─────────
let cycle = db.prepare(`SELECT * FROM goal_cycles WHERE is_active = 1`).get();
if (!cycle) {
  const res = db.prepare(`
    INSERT OR IGNORE INTO goal_cycles (name, year, phase, window_open, window_close, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run('FY 2025-26 Annual Appraisal', 2025, 'goal_setting', '2025-04-01', '2026-03-31');
  cycle = db.prepare(`SELECT * FROM goal_cycles WHERE id = ?`).get(res.lastInsertRowid);
}
console.log(`✅ Active cycle: ${cycle.name} (id=${cycle.id})`);

// ── 5. Thrust areas (fetch IDs) ───────────────────────────────────────────────
const ta = {};
['Revenue Growth','Operational Excellence','Customer Experience','People & Culture',
 'Innovation','Safety & Compliance','Cost Optimisation','Strategic Initiatives'].forEach(name => {
  db.prepare(`INSERT OR IGNORE INTO thrust_areas (name) VALUES (?)`).run(name);
  ta[name] = db.prepare(`SELECT id FROM thrust_areas WHERE name = ?`).get(name).id;
});
console.log('✅ Thrust areas ready');

// ── 6. Helper fns ─────────────────────────────────────────────────────────────
const insertSheet = db.prepare(`
  INSERT OR IGNORE INTO goal_sheets (uuid, employee_id, cycle_id, status, submitted_at, approved_at, approved_by, total_weightage)
  VALUES (?, ?, ?, ?, ?, ?, ?, 100)
`);
const updateSheetStatus = db.prepare(`UPDATE goal_sheets SET status=?, submitted_at=?, approved_at=?, approved_by=? WHERE employee_id=? AND cycle_id=?`);

const insertGoal = db.prepare(`
  INSERT OR IGNORE INTO goals (uuid, sheet_id, thrust_area_id, title, description, uom_type, target_value, target_date, weightage, display_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const upsertAchievement = db.prepare(`
  INSERT INTO achievements (goal_id, cycle_id, quarter, actual_value, actual_date, status, progress_score, employee_notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(goal_id, cycle_id, quarter) DO UPDATE SET
    actual_value=excluded.actual_value, actual_date=excluded.actual_date,
    status=excluded.status, progress_score=excluded.progress_score,
    employee_notes=excluded.employee_notes
`);

const insertCheckin = db.prepare(`
  INSERT OR IGNORE INTO checkins (sheet_id, manager_id, cycle_id, quarter, comment)
  VALUES (?, ?, ?, ?, ?)
`);

const insertNotif = db.prepare(`
  INSERT INTO notifications (user_id, title, message, type, is_read, link) VALUES (?, ?, ?, ?, ?, ?)
`);

function getOrCreateSheet(employeeId, status, managerId) {
  const existing = db.prepare(`SELECT id FROM goal_sheets WHERE employee_id=? AND cycle_id=?`).get(employeeId, cycle.id);
  if (existing) {
    updateSheetStatus.run(status, '2025-05-10T08:00:00', status === 'approved' ? '2025-05-15T10:00:00' : null, status === 'approved' ? managerId : null, employeeId, cycle.id);
    return existing.id;
  }
  insertSheet.run(uuidv4(), employeeId, cycle.id, status,
    '2025-05-10T08:00:00',
    status === 'approved' ? '2025-05-15T10:00:00' : null,
    status === 'approved' ? managerId : null);
  return db.prepare(`SELECT id FROM goal_sheets WHERE employee_id=? AND cycle_id=?`).get(employeeId, cycle.id).id;
}

function insertGoalAndGet(sheetId, taId, title, desc, uomType, targetVal, targetDate, weight, order) {
  const existing = db.prepare(`SELECT id FROM goals WHERE sheet_id=? AND title=?`).get(sheetId, title);
  if (existing) return existing.id;
  insertGoal.run(uuidv4(), sheetId, taId, title, desc, uomType, targetVal, targetDate, weight, order);
  return db.prepare(`SELECT id FROM goals WHERE sheet_id=? AND title=?`).get(sheetId, title).id;
}

// ── 7. EMPLOYEE 1 — John Doe (Sales, manager: Sarah) ─────────────────────────
console.log('\n📋 Seeding John Doe (employee@atomquest.com)...');
const sheet1 = getOrCreateSheet(emp1.id, 'approved', manager1.id);
const e1goals = [
  { ta: 'Revenue Growth',        title: 'Achieve ₹50L Sales Revenue',       desc: 'Monthly revenue target for FY 2025-26', uom: 'numeric_min', tv: 5000000, td: null, w: 30, o: 1 },
  { ta: 'Customer Experience',   title: 'Maintain CSAT Score ≥ 4.2',         desc: 'Customer satisfaction across 200+ interactions', uom: 'numeric_min', tv: 4.2, td: null, w: 20, o: 2 },
  { ta: 'Operational Excellence',title: 'Reduce TAT to < 24 hours',          desc: 'Time-to-resolve for all service tickets', uom: 'numeric_max', tv: 24, td: null, w: 20, o: 3 },
  { ta: 'Safety & Compliance',   title: 'Zero Compliance Violations',        desc: 'Maintain zero regulatory incidents', uom: 'zero', tv: null, td: null, w: 15, o: 4 },
  { ta: 'Strategic Initiatives', title: 'Complete CRM Migration Project',    desc: 'Migrate all sales data to new CRM by Q2', uom: 'timeline', tv: null, td: '2025-09-30', w: 15, o: 5 },
];
const e1gids = e1goals.map(g => insertGoalAndGet(sheet1, ta[g.ta], g.title, g.desc, g.uom, g.tv, g.td, g.w, g.o));

// Q1 achievements
const e1ach = [
  { qi: 0, av: 4200000, ad: null, s: 'on_track', ps: 0.84, note: 'Good Q1 start. Pipeline is strong for Q2.' },
  { qi: 1, av: 4.1,     ad: null, s: 'on_track', ps: 0.83, note: 'One complaint resolved within 48hr, targeting improvement.' },
  { qi: 2, av: 20,      ad: null, s: 'on_track', ps: 1.00, note: 'TAT improved significantly after process changes.' },
  { qi: 3, av: 0,       ad: null, s: 'completed', ps: 1.00, note: 'Zero violations this quarter.' },
  { qi: 4, av: null,    ad: null, s: 'on_track', ps: 0.75, note: 'CRM data mapping 75% complete.' },
];
e1ach.forEach(a => upsertAchievement.run(e1gids[a.qi], cycle.id, 'q1', a.av, a.ad, a.s, a.ps, a.note));

// Q2 achievements
const e1ach2 = [
  { qi: 0, av: 4700000, ad: null, s: 'on_track', ps: 0.94, note: 'Closed 3 enterprise deals in Q2.' },
  { qi: 1, av: 4.3,     ad: null, s: 'completed', ps: 1.00, note: 'Exceeded CSAT target. Team follow-ups improved.' },
  { qi: 2, av: 18,      ad: null, s: 'completed', ps: 1.00, note: 'TAT consistently under 20hrs this quarter.' },
  { qi: 3, av: 0,       ad: null, s: 'completed', ps: 1.00, note: 'Audit passed cleanly.' },
  { qi: 4, av: null,    ad: '2025-09-28', s: 'completed', ps: 1.00, note: 'CRM migration completed 2 days ahead of schedule.' },
];
e1ach2.forEach(a => upsertAchievement.run(e1gids[a.qi], cycle.id, 'q2', a.av, a.ad, a.s, a.ps, a.note));
console.log('  ✅ John Doe: sheet + 5 goals + Q1/Q2 achievements');

// ── 8. EMPLOYEE 2 — Priya Sharma (Sales, manager: Sarah) ─────────────────────
console.log('📋 Seeding Priya Sharma (priya@atomquest.com)...');
const sheet2 = getOrCreateSheet(emp2.id, 'approved', manager1.id);
const e2goals = [
  { ta: 'Revenue Growth',      title: 'Generate 30 New Qualified Leads/Month', desc: 'Outbound + inbound lead generation', uom: 'numeric_min', tv: 30, td: null, w: 25, o: 1 },
  { ta: 'Customer Experience', title: 'Upsell to 25% of Existing Clients',      desc: 'Cross-sell premium packages to current portfolio', uom: 'numeric_min', tv: 25, td: null, w: 25, o: 2 },
  { ta: 'People & Culture',    title: 'Complete 3 Sales Training Certifications', desc: 'Salesforce, HubSpot, Negotiation mastery', uom: 'numeric_min', tv: 3, td: null, w: 15, o: 3 },
  { ta: 'Innovation',          title: 'Implement New Sales Automation Playbook', desc: 'Define and roll out automated follow-up sequences', uom: 'timeline', tv: null, td: '2025-12-31', w: 20, o: 4 },
  { ta: 'Cost Optimisation',   title: 'Reduce Client Acquisition Cost by 15%',  desc: 'Improve funnel efficiency to cut CAC', uom: 'numeric_max', tv: 85, td: null, w: 15, o: 5 },
];
const e2gids = e2goals.map(g => insertGoalAndGet(sheet2, ta[g.ta], g.title, g.desc, g.uom, g.tv, g.td, g.w, g.o));

const e2ach = [
  { qi: 0, av: 28, ad: null, s: 'on_track', ps: 0.93, note: 'Narrowly missed target. Increasing outreach via LinkedIn.' },
  { qi: 1, av: 22, ad: null, s: 'on_track', ps: 0.88, note: '22% upsell rate. Working on demo-to-close conversion.' },
  { qi: 2, av: 2,  ad: null, s: 'on_track', ps: 0.67, note: 'Completed Salesforce + HubSpot. Negotiation in progress.' },
  { qi: 3, av: null, ad: null, s: 'on_track', ps: 0.50, note: 'Playbook drafted. In review phase.' },
  { qi: 4, av: 92, ad: null, s: 'on_track', ps: 0.92, note: 'CAC trending down thanks to better targeted ads.' },
];
e2ach.forEach(a => upsertAchievement.run(e2gids[a.qi], cycle.id, 'q1', a.av, a.ad, a.s, a.ps, a.note));
console.log('  ✅ Priya Sharma: sheet + 5 goals + Q1 achievements');

// ── 9. EMPLOYEE 3 — Alex Chen (Operations, manager: Raj) ─────────────────────
console.log('📋 Seeding Alex Chen (alex@atomquest.com)...');
const sheet3 = getOrCreateSheet(emp3.id, 'approved', manager2 ? manager2.id : manager1.id);
const e3goals = [
  { ta: 'Operational Excellence', title: 'Achieve 99.5% System Uptime',        desc: 'Infrastructure reliability KPI', uom: 'numeric_min', tv: 99.5, td: null, w: 30, o: 1 },
  { ta: 'Safety & Compliance',    title: 'Zero Reportable Safety Incidents',    desc: 'Maintain safe work environment', uom: 'zero', tv: null, td: null, w: 20, o: 2 },
  { ta: 'Cost Optimisation',      title: 'Cut Infrastructure Costs by 12%',     desc: 'Server consolidation and cloud optimisation', uom: 'numeric_max', tv: 88, td: null, w: 20, o: 3 },
  { ta: 'Innovation',             title: 'Automate 5 Manual Operations Workflows', desc: 'Use RPA and scripts to cut manual effort', uom: 'numeric_min', tv: 5, td: null, w: 15, o: 4 },
  { ta: 'People & Culture',       title: 'Mentor 2 Junior Engineers to Mid-Level', desc: 'Structured mentorship and quarterly reviews', uom: 'numeric_min', tv: 2, td: null, w: 15, o: 5 },
];
const e3gids = e3goals.map(g => insertGoalAndGet(sheet3, ta[g.ta], g.title, g.desc, g.uom, g.tv, g.td, g.w, g.o));

const e3ach = [
  { qi: 0, av: 99.7, ad: null, s: 'completed', ps: 1.00, note: 'Uptime exceeded target — zero unplanned outages.' },
  { qi: 1, av: 0,    ad: null, s: 'completed', ps: 1.00, note: 'Safety drills conducted. All staff certified.' },
  { qi: 2, av: 90,   ad: null, s: 'on_track',  ps: 0.97, note: 'Migrated 3 workloads to cloud. On track for Q2 target.' },
  { qi: 3, av: 4,    ad: null, s: 'on_track',  ps: 0.80, note: '4 of 5 automations live. Final one in UAT.' },
  { qi: 4, av: 2,    ad: null, s: 'completed', ps: 1.00, note: 'Both mentees promoted to mid-level in April.' },
];
e3ach.forEach(a => upsertAchievement.run(e3gids[a.qi], cycle.id, 'q1', a.av, a.ad, a.s, a.ps, a.note));
console.log('  ✅ Alex Chen: sheet + 5 goals + Q1 achievements');

// ── 10. Manager Check-ins ─────────────────────────────────────────────────────
console.log('📋 Seeding manager check-ins...');
// Sarah Mitchell Q1 check-ins for John and Priya
insertCheckin.run(sheet1, manager1.id, cycle.id, 'q1',
  'Great start to the quarter John. Revenue is tracking well and zero compliance issues is excellent. Focus on closing the CRM migration in Q2. Keep up the momentum on CSAT improvement.');
insertCheckin.run(sheet2, manager1.id, cycle.id, 'q1',
  'Good effort Priya. Leads are close to target — the LinkedIn outreach strategy seems promising. Complete the Negotiation cert by end of Q2. Upsell rate needs more push on the enterprise segment.');

// Raj Q1 check-in for Alex
if (manager2) {
  insertCheckin.run(sheet3, manager2.id, cycle.id, 'q1',
    'Exceptional Q1 performance Alex. Uptime target exceeded, zero incidents, and both mentees progressed. Focus on getting the 5th automation live and maintaining cost reduction trajectory into Q2.');
}
console.log('  ✅ Check-ins seeded');

// ── 11. Notifications ─────────────────────────────────────────────────────────
console.log('📋 Seeding notifications...');

// Clear old sample notifs to avoid duplicates on re-run
db.prepare(`DELETE FROM notifications WHERE title LIKE '%Sample%' OR title LIKE 'Goal Sheet%' OR title LIKE 'Manager%' OR title LIKE 'Check-in%' OR title LIKE 'Goal Approved%' OR title LIKE 'Shared Goal%'`).run();

// Employee 1 — John
insertNotif.run(emp1.id, 'Goal Sheet Approved', 'Your goal sheet for FY 2025-26 has been approved by Sarah Mitchell. Goals are now locked.', 'success', 0, '/employee/goals');
insertNotif.run(emp1.id, 'Check-in Comment Received', 'Sarah Mitchell left a Q1 check-in comment on your progress. Tap to view.', 'info', 0, '/employee/achievements');
insertNotif.run(emp1.id, 'Q2 Achievement Window Open', 'Q2 check-in window is now open. Log your progress before the deadline.', 'info', 1, '/employee/achievements');

// Employee 2 — Priya
insertNotif.run(emp2.id, 'Goal Sheet Approved', 'Your goal sheet for FY 2025-26 has been approved by Sarah Mitchell.', 'success', 0, '/employee/goals');
insertNotif.run(emp2.id, 'Check-in Comment Received', 'Sarah Mitchell left feedback on your Q1 progress. Review and plan for Q2.', 'info', 0, '/employee/achievements');
insertNotif.run(emp2.id, 'Reminder: Complete Negotiation Cert', 'You have 1 remaining certification to complete. Target: end of Q2.', 'warning', 1, '/employee/goals');

// Employee 3 — Alex
insertNotif.run(emp3.id, 'Goal Sheet Approved', 'Your goal sheet for FY 2025-26 has been approved.', 'success', 1, '/employee/goals');
insertNotif.run(emp3.id, 'Check-in Comment Received', 'Your manager left excellent Q1 feedback. Keep up the strong performance.', 'success', 0, '/employee/achievements');
insertNotif.run(emp3.id, '5th Automation In UAT', 'Action required: Complete UAT sign-off for Workflow #5.', 'warning', 0, '/employee/achievements');

// Manager 1 — Sarah
insertNotif.run(manager1.id, 'Goal Sheet Submitted', 'John Doe has submitted their FY 2025-26 goal sheet for your review.', 'info', 1, '/manager');
insertNotif.run(manager1.id, 'Goal Sheet Submitted', 'Priya Sharma has submitted their FY 2025-26 goal sheet for your review.', 'info', 1, '/manager');
insertNotif.run(manager1.id, 'Q1 Check-in Reminder', 'Quarterly check-in window is open. Add comments for your team members.', 'warning', 1, '/manager/checkins');
insertNotif.run(manager1.id, 'Team Performing Well', '2 of 2 team members have approved goals. Q1 average score: 91%.', 'success', 0, '/manager');

// Manager 2 — Raj (if exists)
if (manager2) {
  insertNotif.run(manager2.id, 'Goal Sheet Submitted', 'Alex Chen has submitted their goal sheet for review.', 'info', 1, '/manager');
  insertNotif.run(manager2.id, 'Q1 Outstanding Performance', 'Alex Chen achieved 99.7% uptime and zero incidents this quarter.', 'success', 0, '/manager');
}

// Admin
insertNotif.run(admin.id, 'New Cycle Active', 'FY 2025-26 Annual Appraisal cycle is active and in goal_setting phase.', 'info', 1, '/admin/cycles');
insertNotif.run(admin.id, 'All Goal Sheets Approved', '3 of 3 active employees have approved goal sheets. System ready for Q1 check-in.', 'success', 0, '/admin');
insertNotif.run(admin.id, 'Sample Data Loaded', 'Demo data seeded: 3 employees, 15 goals, 14 achievements, 3 check-ins.', 'info', 0, '/admin/reports');

console.log('  ✅ Notifications seeded');

// ── 12. Summary ───────────────────────────────────────────────────────────────
console.log('\n🎉 Sample data seeded successfully!');
console.log('─────────────────────────────────────────────────');
console.log('  👤 Admin:      admin@atomquest.com    / Password@123');
console.log('  👔 Manager 1:  manager@atomquest.com  / Password@123  → Sarah Mitchell (Sales)');
console.log('  👔 Manager 2:  raj@atomquest.com      / Password@123  → Raj Patel (Operations)');
console.log('  🧑 Employee 1: employee@atomquest.com / Password@123  → John Doe   (Sales)');
console.log('  🧑 Employee 2: priya@atomquest.com    / Password@123  → Priya Sharma (Sales)');
console.log('  🧑 Employee 3: alex@atomquest.com     / Password@123  → Alex Chen  (Operations)');
console.log('─────────────────────────────────────────────────');
console.log('  ✅ 3 approved goal sheets');
console.log('  ✅ 15 goals (5 per employee) across all thrust areas');
console.log('  ✅ 14 achievement records (Q1 + Q2 for John, Q1 for Priya & Alex)');
console.log('  ✅ 3 manager check-in comments');
console.log('  ✅ 16 notifications across all users');

db.close();
