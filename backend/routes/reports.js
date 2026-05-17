// routes/reports.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { computeProgressScore } = require('../utils/progressScore');

// GET /api/reports/achievement — achievement report
router.get('/achievement', authenticate, authorize('admin', 'manager'), (req, res) => {
  const { cycle_id, quarter, format } = req.query;
  const db = getDb();

  const cycle = cycle_id
    ? db.prepare('SELECT * FROM goal_cycles WHERE id = ?').get(cycle_id)
    : db.prepare('SELECT * FROM goal_cycles WHERE is_active = 1').get();

  let employeeFilter = '';
  const params = [cycle?.id];

  if (req.user.role === 'manager') {
    employeeFilter = `AND u.manager_id = ${req.user.id}`;
  }

  const data = db.prepare(`
    SELECT
      u.name as employee_name, u.email as employee_email, u.department,
      m.name as manager_name,
      ta.name as thrust_area,
      g.title as goal_title, g.uom_type, g.target_value, g.target_date, g.weightage,
      a.quarter, a.actual_value, a.actual_date, a.status, a.progress_score, a.employee_notes,
      gs.status as sheet_status
    FROM goals g
    JOIN goal_sheets gs ON g.sheet_id = gs.id
    JOIN users u ON gs.employee_id = u.id
    LEFT JOIN users m ON u.manager_id = m.id
    LEFT JOIN thrust_areas ta ON g.thrust_area_id = ta.id
    LEFT JOIN achievements a ON a.goal_id = g.id AND (? IS NULL OR a.cycle_id = ?)
    WHERE gs.cycle_id = ? ${employeeFilter}
    ORDER BY u.name, g.display_order, a.quarter
  `).all(cycle?.id, cycle?.id, cycle?.id);

  if (format === 'csv') {
    const headers = ['Employee', 'Email', 'Department', 'Manager', 'Thrust Area', 'Goal Title', 'UoM Type', 'Target', 'Weightage', 'Quarter', 'Actual', 'Status', 'Progress Score', 'Notes'];
    const rows = data.map(d => [
      d.employee_name, d.employee_email, d.department, d.manager_name,
      d.thrust_area, d.goal_title, d.uom_type, d.target_value, d.weightage,
      d.quarter || '-', d.actual_value || '-', d.status || '-',
      d.progress_score ? (d.progress_score * 100).toFixed(1) + '%' : '-',
      d.employee_notes || '-'
    ]);

    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="achievement_report.csv"');
    return res.send(csv);
  }

  res.json({ data, cycle });
});

// GET /api/reports/completion-dashboard
router.get('/completion-dashboard', authenticate, authorize('admin', 'manager'), (req, res) => {
  const { cycle_id } = req.query;
  const db = getDb();

  const cycle = cycle_id
    ? db.prepare('SELECT * FROM goal_cycles WHERE id = ?').get(cycle_id)
    : db.prepare('SELECT * FROM goal_cycles WHERE is_active = 1').get();

  if (!cycle) return res.json({ cycle: null, stats: {}, managers: [] });

  const totalEmployees = db.prepare("SELECT COUNT(*) as count FROM users WHERE role='employee' AND is_active=1").get().count;
  const submitted = db.prepare("SELECT COUNT(*) as count FROM goal_sheets WHERE cycle_id=? AND status IN ('submitted','approved','locked')").get(cycle.id).count;
  const approved = db.prepare("SELECT COUNT(*) as count FROM goal_sheets WHERE cycle_id=? AND status IN ('approved','locked')").get(cycle.id).count;

  const quarters = ['q1', 'q2', 'q3', 'q4_annual'];
  const checkinStats = {};
  quarters.forEach(q => {
    checkinStats[q] = db.prepare("SELECT COUNT(DISTINCT sheet_id) as count FROM checkins WHERE cycle_id=? AND quarter=?").get(cycle.id, q).count;
  });

  // Manager breakdown
  const managers = db.prepare(`
    SELECT u.id, u.name, u.email, u.department,
      COUNT(DISTINCT emp.id) as team_size,
      COUNT(DISTINCT CASE WHEN gs.status IN ('submitted','approved','locked') THEN gs.id END) as submitted_count,
      COUNT(DISTINCT CASE WHEN gs.status IN ('approved','locked') THEN gs.id END) as approved_count
    FROM users u
    JOIN users emp ON emp.manager_id = u.id
    LEFT JOIN goal_sheets gs ON gs.employee_id = emp.id AND gs.cycle_id = ?
    WHERE u.role = 'manager' AND u.is_active = 1
    GROUP BY u.id
  `).all(cycle.id);

  // Thrust area breakdown
  const thrustBreakdown = db.prepare(`
    SELECT ta.name, COUNT(g.id) as goal_count, COUNT(DISTINCT gs.employee_id) as employee_count
    FROM goals g
    JOIN thrust_areas ta ON g.thrust_area_id = ta.id
    JOIN goal_sheets gs ON g.sheet_id = gs.id
    WHERE gs.cycle_id = ?
    GROUP BY ta.id ORDER BY goal_count DESC
  `).all(cycle.id);

  // UoM breakdown
  const uomBreakdown = db.prepare(`
    SELECT g.uom_type, COUNT(*) as count FROM goals g
    JOIN goal_sheets gs ON g.sheet_id = gs.id WHERE gs.cycle_id = ? GROUP BY g.uom_type
  `).all(cycle.id);

  res.json({
    cycle,
    stats: { totalEmployees, submitted, approved, notStarted: totalEmployees - submitted, checkinStats },
    managers,
    thrustBreakdown,
    uomBreakdown
  });
});

// GET /api/reports/audit-log
router.get('/audit-log', authenticate, authorize('admin'), (req, res) => {
  const { entity_type, limit = 100 } = req.query;
  const db = getDb();

  let query = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];
  if (entity_type) { query += ' AND entity_type = ?'; params.push(entity_type); }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit));

  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

// GET /api/reports/analytics — QoQ trends
router.get('/analytics', authenticate, authorize('admin', 'manager'), (req, res) => {
  const db = getDb();

  const qoqTrends = db.prepare(`
    SELECT c.phase, c.name as cycle_name, AVG(a.progress_score) as avg_score,
           COUNT(DISTINCT gs.employee_id) as employee_count
    FROM achievements a
    JOIN goals g ON a.goal_id = g.id
    JOIN goal_sheets gs ON g.sheet_id = gs.id
    JOIN goal_cycles c ON a.cycle_id = c.id
    GROUP BY c.id ORDER BY c.id
  `).all();

  const departmentPerformance = db.prepare(`
    SELECT u.department, AVG(a.progress_score) as avg_score, COUNT(DISTINCT u.id) as employees
    FROM achievements a
    JOIN goals g ON a.goal_id = g.id
    JOIN goal_sheets gs ON g.sheet_id = gs.id
    JOIN users u ON gs.employee_id = u.id
    WHERE a.progress_score IS NOT NULL
    GROUP BY u.department ORDER BY avg_score DESC
  `).all();

  const statusDistribution = db.prepare(`
    SELECT a.status, COUNT(*) as count FROM achievements a GROUP BY a.status
  `).all();

  res.json({ qoqTrends, departmentPerformance, statusDistribution });
});

module.exports = router;
