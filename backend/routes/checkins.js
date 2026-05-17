// routes/checkins.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/checkins — list check-ins
router.get('/', authenticate, (req, res) => {
  const { sheet_id, quarter } = req.query;
  const db = getDb();

  let query = `
    SELECT c.*, u.name as manager_name, u.email as manager_email,
           gs.employee_id, emp.name as employee_name
    FROM checkins c
    JOIN users u ON c.manager_id = u.id
    JOIN goal_sheets gs ON c.sheet_id = gs.id
    JOIN users emp ON gs.employee_id = emp.id
    WHERE 1=1
  `;
  const params = [];

  if (sheet_id) { query += ' AND c.sheet_id = ?'; params.push(sheet_id); }
  if (quarter) { query += ' AND c.quarter = ?'; params.push(quarter); }
  if (req.user.role === 'employee') {
    query += ' AND gs.employee_id = ?';
    params.push(req.user.id);
  } else if (req.user.role === 'manager') {
    query += ' AND c.manager_id = ?';
    params.push(req.user.id);
  }

  query += ' ORDER BY c.created_at DESC';
  const checkins = db.prepare(query).all(...params);
  res.json(checkins);
});

// POST /api/checkins — manager logs a check-in
router.post('/', authenticate, authorize('manager', 'admin'), (req, res) => {
  const { sheet_id, quarter, comment } = req.body;
  if (!sheet_id || !quarter || !comment) {
    return res.status(400).json({ error: 'sheet_id, quarter, and comment are required' });
  }

  const validQuarters = ['q1', 'q2', 'q3', 'q4_annual'];
  if (!validQuarters.includes(quarter)) return res.status(400).json({ error: 'Invalid quarter' });

  const db = getDb();
  const sheet = db.prepare(`
    SELECT gs.*, u.manager_id, u.name as employee_name
    FROM goal_sheets gs JOIN users u ON gs.employee_id = u.id WHERE gs.id = ?
  `).get(sheet_id);

  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
  if (req.user.role === 'manager' && sheet.manager_id !== req.user.id) {
    return res.status(403).json({ error: 'Not your team member' });
  }

  const result = db.prepare(`
    INSERT INTO checkins (sheet_id, manager_id, cycle_id, quarter, comment)
    VALUES (?, ?, ?, ?, ?)
  `).run(sheet_id, req.user.id, sheet.cycle_id, quarter, comment.trim());

  // Notify employee
  db.prepare(`INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, 'checkin', ?)`).run(
    sheet.employee_id,
    'Manager Check-in Added',
    `Your manager has completed a check-in for ${quarter.toUpperCase()}.`,
    '/employee/achievements'
  );

  const checkin = db.prepare(`
    SELECT c.*, u.name as manager_name FROM checkins c JOIN users u ON c.manager_id = u.id WHERE c.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(checkin);
});

// GET /api/checkins/completion-status — dashboard for admin
router.get('/completion-status', authenticate, authorize('admin', 'manager'), (req, res) => {
  const { quarter, cycle_id } = req.query;
  const db = getDb();

  const activeCycle = cycle_id
    ? db.prepare('SELECT * FROM goal_cycles WHERE id = ?').get(cycle_id)
    : db.prepare('SELECT * FROM goal_cycles WHERE is_active = 1').get();

  if (!activeCycle) return res.json([]);

  let membersQuery = `SELECT u.id, u.name, u.email, u.department, u.manager_id, m.name as manager_name
    FROM users u LEFT JOIN users m ON u.manager_id = m.id WHERE u.role = 'employee' AND u.is_active = 1`;
  const params = [];

  if (req.user.role === 'manager') {
    membersQuery += ' AND u.manager_id = ?';
    params.push(req.user.id);
  }

  const members = db.prepare(membersQuery).all(...params);

  const result = members.map(m => {
    const sheet = db.prepare('SELECT id, status FROM goal_sheets WHERE employee_id = ? AND cycle_id = ?').get(m.id, activeCycle.id);
    const checkin = quarter && sheet
      ? db.prepare('SELECT id, comment, checkin_date FROM checkins WHERE sheet_id = ? AND quarter = ? ORDER BY created_at DESC LIMIT 1').get(sheet.id, quarter)
      : null;

    return {
      employee: m,
      sheet: sheet || null,
      checkin_completed: !!checkin,
      checkin: checkin || null
    };
  });

  res.json(result);
});

module.exports = router;
