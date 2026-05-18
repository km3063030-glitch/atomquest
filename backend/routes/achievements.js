// routes/achievements.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { computeProgressScore } = require('../utils/progressScore');
const { logAudit } = require('../utils/audit');

// GET /api/achievements — get achievements for a goal or sheet
router.get('/', authenticate, (req, res) => {
  const { sheet_id, goal_id, quarter } = req.query;
  const db = getDb();

  let query = `
    SELECT a.*, g.title as goal_title, g.uom_type, g.target_value, g.target_date, g.weightage
    FROM achievements a
    JOIN goals g ON a.goal_id = g.id
    JOIN goal_sheets gs ON g.sheet_id = gs.id
    WHERE 1=1
  `;
  const params = [];

  if (sheet_id) {
    query += ' AND g.sheet_id = ?';
    params.push(sheet_id);
  }
  if (goal_id) {
    query += ' AND a.goal_id = ?';
    params.push(goal_id);
  }
  if (quarter) {
    query += ' AND a.quarter = ?';
    params.push(quarter);
  }

  // Employees can only see their own
  if (req.user.role === 'employee') {
    query += ' AND gs.employee_id = ?';
    params.push(req.user.id);
  }

  const achievements = db.prepare(query).all(...params);
  res.json(achievements);
});

// POST /api/achievements — log/update achievement
router.post('/', authenticate, authorize('employee'), (req, res) => {
  const { goal_id, quarter, actual_value, actual_date, status, employee_notes } = req.body;
  if (!goal_id || !quarter) return res.status(400).json({ error: 'goal_id and quarter required' });

  const validQuarters = ['q1', 'q2', 'q3', 'q4_annual'];
  if (!validQuarters.includes(quarter)) return res.status(400).json({ error: 'Invalid quarter' });

  const db = getDb();

  // Verify goal belongs to employee
  const goal = db.prepare(`
    SELECT g.*, gs.employee_id, gs.cycle_id FROM goals g
    JOIN goal_sheets gs ON g.sheet_id = gs.id
    WHERE g.id = ?
  `).get(goal_id);

  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  if (goal.employee_id !== req.user.id) return res.status(403).json({ error: 'Not your goal' });

  // Check if goal sheet is approved/locked
  const sheet = db.prepare('SELECT * FROM goal_sheets WHERE id = ?').get(goal.sheet_id);
  if (!['approved', 'locked'].includes(sheet.status)) {
    return res.status(400).json({ error: 'Goal sheet must be approved before entering achievements' });
  }

  // Compute progress score
  const progressScore = computeProgressScore({
    uomType: goal.uom_type,
    targetValue: goal.target_value,
    actualValue: actual_value,
    targetDate: goal.target_date,
    actualDate: actual_date
  });

  // Upsert achievement
  const existing = db.prepare('SELECT id FROM achievements WHERE goal_id = ? AND cycle_id = ? AND quarter = ?').get(goal_id, goal.cycle_id, quarter);

  if (existing) {
    db.prepare(`
      UPDATE achievements SET actual_value=?, actual_date=?, status=?, progress_score=?, employee_notes=?, updated_at=datetime('now')
      WHERE id=?
    `).run(actual_value, actual_date || null, status || 'on_track', progressScore, employee_notes || null, existing.id);
  } else {
    db.prepare(`
      INSERT INTO achievements (goal_id, cycle_id, quarter, actual_value, actual_date, status, progress_score, employee_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(goal_id, goal.cycle_id, quarter, actual_value, actual_date || null, status || 'on_track', progressScore, employee_notes || null);
  }

  // Sync shared goals
  if (goal.shared_from_goal_id || goal.is_shared) {
    const linkedGoals = db.prepare('SELECT id FROM goals WHERE shared_from_goal_id = ? OR id = ?').all(goal_id, goal.shared_from_goal_id || 0);
    linkedGoals.forEach(linked => {
      if (linked.id !== goal_id) {
        const linkedGoalFull = db.prepare('SELECT *, (SELECT cycle_id FROM goal_sheets WHERE id=goals.sheet_id) as cycle_id FROM goals WHERE id=?').get(linked.id);
        db.prepare(`
          INSERT OR REPLACE INTO achievements (goal_id, cycle_id, quarter, actual_value, actual_date, status, progress_score, employee_notes, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(linked.id, linkedGoalFull.cycle_id, quarter, actual_value, actual_date || null, status || 'on_track', progressScore, employee_notes || null);
      }
    });
  }

  logAudit({ entityType: 'achievement', entityId: goal_id, action: 'updated', changedBy: req.user.id, changedByName: req.user.name, newValue: { actual_value, quarter, status } });

  const updated = db.prepare('SELECT * FROM achievements WHERE goal_id = ? AND cycle_id = ? AND quarter = ?').get(goal_id, goal.cycle_id, quarter);
  res.json(updated);
});

// POST /api/achievements/sync — sync multiple achievements
router.post('/sync', authenticate, authorize('employee'), (req, res) => {
  const { achievements, cycle_id } = req.body;
  if (!achievements || !Array.isArray(achievements)) return res.status(400).json({ error: 'achievements array required' });

  const validQuarters = ['q1', 'q2', 'q3', 'q4_annual'];
  const db = getDb();

  for (const ach of achievements) {
    const { goal_id, quarter, actual_value, actual_date, status, employee_notes } = ach;
    if (!goal_id || !quarter || !validQuarters.includes(quarter)) continue;

    const goal = db.prepare(`
      SELECT g.*, gs.employee_id, gs.cycle_id FROM goals g
      JOIN goal_sheets gs ON g.sheet_id = gs.id
      WHERE g.id = ?
    `).get(goal_id);

    if (!goal || goal.employee_id !== req.user.id) continue;

    const sheet = db.prepare('SELECT * FROM goal_sheets WHERE id = ?').get(goal.sheet_id);
    if (!['approved', 'locked'].includes(sheet.status)) continue;

    const progressScore = computeProgressScore({
      uomType: goal.uom_type,
      targetValue: goal.target_value,
      actualValue: actual_value,
      targetDate: goal.target_date,
      actualDate: actual_date
    });

    const existing = db.prepare('SELECT id FROM achievements WHERE goal_id = ? AND cycle_id = ? AND quarter = ?').get(goal_id, goal.cycle_id, quarter);

    if (existing) {
      db.prepare(`
        UPDATE achievements SET actual_value=?, actual_date=?, status=?, progress_score=?, employee_notes=?, updated_at=datetime('now')
        WHERE id=?
      `).run(actual_value, actual_date || null, status || 'on_track', progressScore, employee_notes || null, existing.id);
    } else {
      db.prepare(`
        INSERT INTO achievements (goal_id, cycle_id, quarter, actual_value, actual_date, status, progress_score, employee_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(goal_id, goal.cycle_id, quarter, actual_value, actual_date || null, status || 'on_track', progressScore, employee_notes || null);
    }

    if (goal.shared_from_goal_id || goal.is_shared) {
      const linkedGoals = db.prepare('SELECT id FROM goals WHERE shared_from_goal_id = ? OR id = ?').all(goal_id, goal.shared_from_goal_id || 0);
      linkedGoals.forEach(linked => {
        if (linked.id !== goal_id) {
          const linkedGoalFull = db.prepare('SELECT *, (SELECT cycle_id FROM goal_sheets WHERE id=goals.sheet_id) as cycle_id FROM goals WHERE id=?').get(linked.id);
          db.prepare(`
            INSERT OR REPLACE INTO achievements (goal_id, cycle_id, quarter, actual_value, actual_date, status, progress_score, employee_notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).run(linked.id, linkedGoalFull.cycle_id, quarter, actual_value, actual_date || null, status || 'on_track', progressScore, employee_notes || null);
        }
      });
    }

    logAudit({ entityType: 'achievement', entityId: goal_id, action: 'updated', changedBy: req.user.id, changedByName: req.user.name, newValue: { actual_value, quarter, status } });
  }

  res.json({ message: 'Achievements synced successfully' });
});

// GET /api/achievements/summary/:sheet_id — full summary with scores
router.get('/summary/:sheet_id', authenticate, (req, res) => {
  const db = getDb();
  const sheet = db.prepare('SELECT * FROM goal_sheets WHERE id = ?').get(req.params.sheet_id);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });

  // Access check
  if (req.user.role === 'employee' && sheet.employee_id !== req.user.id) {
    return res.status(403).json({ error: 'Not your sheet' });
  }

  const goals = db.prepare(`
    SELECT g.*, ta.name as thrust_area_name FROM goals g
    LEFT JOIN thrust_areas ta ON g.thrust_area_id = ta.id
    WHERE g.sheet_id = ? ORDER BY g.display_order, g.id
  `).all(req.params.sheet_id);

  const allAchievements = db.prepare('SELECT * FROM achievements WHERE goal_id IN (SELECT id FROM goals WHERE sheet_id = ?)').all(req.params.sheet_id);

  // Group achievements by goal
  goals.forEach(goal => {
    goal.achievements = allAchievements.filter(a => a.goal_id === goal.id);
  });

  const employee = db.prepare('SELECT id, name, email, department FROM users WHERE id = ?').get(sheet.employee_id);
  res.json({ sheet, goals, employee });
});

module.exports = router;
