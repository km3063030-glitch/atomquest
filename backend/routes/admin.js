// routes/admin.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// GET /api/admin/thrust-areas
router.get('/thrust-areas', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM thrust_areas ORDER BY name').all());
});

// POST /api/admin/thrust-areas
router.post('/thrust-areas', authenticate, authorize('admin'), (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const db = getDb();
  const result = db.prepare('INSERT INTO thrust_areas (name, description) VALUES (?, ?)').run(name, description || null);
  res.status(201).json(db.prepare('SELECT * FROM thrust_areas WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/admin/thrust-areas/:id
router.put('/thrust-areas/:id', authenticate, authorize('admin'), (req, res) => {
  const { name, description, is_active } = req.body;
  const db = getDb();
  db.prepare('UPDATE thrust_areas SET name=?, description=?, is_active=? WHERE id=?').run(name, description, is_active ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM thrust_areas WHERE id = ?').get(req.params.id));
});

// GET /api/admin/escalation-rules
router.get('/escalation-rules', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM escalation_rules').all());
});

// PUT /api/admin/escalation-rules/:id
router.put('/escalation-rules/:id', authenticate, authorize('admin'), (req, res) => {
  const { days_threshold, is_active } = req.body;
  const db = getDb();
  db.prepare('UPDATE escalation_rules SET days_threshold=?, is_active=? WHERE id=?').run(days_threshold, is_active ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM escalation_rules WHERE id = ?').get(req.params.id));
});

// GET /api/admin/escalations — check escalation status
router.get('/escalations', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const cycle = db.prepare('SELECT * FROM goal_cycles WHERE is_active = 1').get();
  if (!cycle) return res.json([]);

  const escalations = [];
  const now = new Date();

  // Employees who haven't submitted
  const rules = db.prepare('SELECT * FROM escalation_rules WHERE is_active = 1').all();
  const submissionRule = rules.find(r => r.trigger_event === 'goal_not_submitted');

  if (submissionRule && cycle.phase === 'goal_setting') {
    const windowOpen = new Date(cycle.window_open);
    const daysSinceOpen = Math.floor((now - windowOpen) / (1000 * 60 * 60 * 24));

    if (daysSinceOpen >= submissionRule.days_threshold) {
      const notSubmitted = db.prepare(`
        SELECT u.id, u.name, u.email, u.manager_id, m.name as manager_name
        FROM users u LEFT JOIN users m ON u.manager_id = m.id
        WHERE u.role = 'employee' AND u.is_active = 1
        AND u.id NOT IN (
          SELECT employee_id FROM goal_sheets WHERE cycle_id = ? AND status IN ('submitted','approved','locked')
        )
      `).all(cycle.id);

      notSubmitted.forEach(u => escalations.push({
        type: 'goal_not_submitted',
        severity: daysSinceOpen >= submissionRule.days_threshold * 2 ? 'high' : 'medium',
        employee: u,
        message: `Goals not submitted for ${daysSinceOpen} days`,
        days: daysSinceOpen
      }));
    }
  }

  // Managers who haven't approved
  const approvalRule = rules.find(r => r.trigger_event === 'goal_not_approved');
  if (approvalRule) {
    const pendingApprovals = db.prepare(`
      SELECT gs.id, gs.submitted_at, gs.employee_id,
             u.name as employee_name, m.id as manager_id, m.name as manager_name
      FROM goal_sheets gs
      JOIN users u ON gs.employee_id = u.id
      LEFT JOIN users m ON u.manager_id = m.id
      WHERE gs.status = 'submitted' AND gs.cycle_id = ?
    `).all(cycle.id);

    pendingApprovals.forEach(gs => {
      const submittedDate = new Date(gs.submitted_at);
      const daysPending = Math.floor((now - submittedDate) / (1000 * 60 * 60 * 24));
      if (daysPending >= approvalRule.days_threshold) {
        escalations.push({
          type: 'goal_not_approved',
          severity: daysPending >= approvalRule.days_threshold * 2 ? 'high' : 'medium',
          sheet_id: gs.id,
          employee: { name: gs.employee_name },
          manager: { id: gs.manager_id, name: gs.manager_name },
          message: `Goals submitted ${daysPending} days ago, not yet approved`,
          days: daysPending
        });
      }
    });
  }

  res.json(escalations);
});

module.exports = router;
