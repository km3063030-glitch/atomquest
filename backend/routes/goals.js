// routes/goals.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// ─── Helpers ────────────────────────────────────────────────────────────────

function getOrCreateSheet(db, employeeId, cycleId) {
  let sheet = db.prepare('SELECT * FROM goal_sheets WHERE employee_id = ? AND cycle_id = ?').get(employeeId, cycleId);
  if (!sheet) {
    const result = db.prepare(`
      INSERT INTO goal_sheets (uuid, employee_id, cycle_id, status, total_weightage)
      VALUES (?, ?, ?, 'draft', 0)
    `).run(uuidv4(), employeeId, cycleId);
    sheet = db.prepare('SELECT * FROM goal_sheets WHERE id = ?').get(result.lastInsertRowid);
  }
  return sheet;
}

function getSheetWithGoals(db, sheetId) {
  const sheet = db.prepare(`
    SELECT gs.*, u.name as employee_name, u.email as employee_email, u.department,
           c.name as cycle_name, c.phase as cycle_phase,
           m.name as manager_name, m.email as manager_email
    FROM goal_sheets gs
    JOIN users u ON gs.employee_id = u.id
    JOIN goal_cycles c ON gs.cycle_id = c.id
    LEFT JOIN users m ON u.manager_id = m.id
    WHERE gs.id = ?
  `).get(sheetId);

  if (!sheet) return null;

  sheet.goals = db.prepare(`
    SELECT g.*, ta.name as thrust_area_name
    FROM goals g
    LEFT JOIN thrust_areas ta ON g.thrust_area_id = ta.id
    WHERE g.sheet_id = ?
    ORDER BY g.display_order, g.id
  `).all(sheetId);

  return sheet;
}

function recalcWeightage(db, sheetId) {
  const result = db.prepare('SELECT SUM(weightage) as total FROM goals WHERE sheet_id = ?').get(sheetId);
  const total = result.total || 0;
  db.prepare(`UPDATE goal_sheets SET total_weightage = ?, updated_at = datetime('now') WHERE id = ?`).run(total, sheetId);
  return total;
}

function validateGoals(goals) {
  const errors = [];
  if (goals.length > 8) errors.push('Maximum 8 goals allowed');
  const totalWeight = goals.reduce((sum, g) => sum + (Number(g.weightage) || 0), 0);
  if (Math.abs(totalWeight - 100) > 0.01) errors.push(`Total weightage must be 100% (currently ${totalWeight}%)`);
  goals.forEach((g, i) => {
    if (Number(g.weightage) < 10) errors.push(`Goal "${g.title || `#${i + 1}`}": minimum weightage is 10%`);
  });
  return errors;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// GET /api/goals/sheet — employee's current sheet
router.get('/sheet', authenticate, (req, res) => {
  const { cycle_id } = req.query;
  const db = getDb();

  const activeCycle = cycle_id
    ? db.prepare('SELECT * FROM goal_cycles WHERE id = ?').get(cycle_id)
    : db.prepare('SELECT * FROM goal_cycles WHERE is_active = 1').get();

  if (!activeCycle) return res.status(404).json({ error: 'No active goal cycle found' });

  const sheet = db.prepare(`
    SELECT gs.*, u.name as employee_name, u.email as employee_email, u.department,
           c.name as cycle_name, c.phase as cycle_phase,
           m.name as manager_name
    FROM goal_sheets gs
    JOIN users u ON gs.employee_id = u.id
    JOIN goal_cycles c ON gs.cycle_id = c.id
    LEFT JOIN users m ON u.manager_id = m.id
    WHERE gs.employee_id = ? AND gs.cycle_id = ?
  `).get(req.user.id, activeCycle.id);

  if (!sheet) return res.json({ sheet: null, cycle: activeCycle });

  sheet.goals = db.prepare(`
    SELECT g.*, ta.name as thrust_area_name
    FROM goals g
    LEFT JOIN thrust_areas ta ON g.thrust_area_id = ta.id
    WHERE g.sheet_id = ?
    ORDER BY g.display_order, g.id
  `).all(sheet.id);

  res.json({ sheet, cycle: activeCycle });
});

// GET /api/goals/team — manager: get team's sheets
router.get('/team', authenticate, authorize('manager', 'admin'), (req, res) => {
  const { cycle_id } = req.query;
  const db = getDb();

  const activeCycle = cycle_id
    ? db.prepare('SELECT * FROM goal_cycles WHERE id = ?').get(cycle_id)
    : db.prepare('SELECT * FROM goal_cycles WHERE is_active = 1').get();

  if (!activeCycle) return res.status(404).json({ error: 'No active goal cycle found' });

  const teamMembers = req.user.role === 'admin'
    ? db.prepare('SELECT id, name, email, department, manager_id FROM users WHERE role = "employee" AND is_active = 1').all()
    : db.prepare('SELECT id, name, email, department FROM users WHERE manager_id = ? AND is_active = 1').all(req.user.id);

  const result = teamMembers.map(member => {
    const sheet = db.prepare(`
      SELECT gs.*, c.name as cycle_name
      FROM goal_sheets gs
      JOIN goal_cycles c ON gs.cycle_id = c.id
      WHERE gs.employee_id = ? AND gs.cycle_id = ?
    `).get(member.id, activeCycle.id);

    let goals = [];
    if (sheet) {
      goals = db.prepare(`
        SELECT g.*, ta.name as thrust_area_name
        FROM goals g LEFT JOIN thrust_areas ta ON g.thrust_area_id = ta.id
        WHERE g.sheet_id = ? ORDER BY g.display_order, g.id
      `).all(sheet.id);
    }

    return { employee: member, sheet: sheet || null, goals, cycle: activeCycle };
  });

  res.json(result);
});

// POST /api/goals/save — save draft goals
router.post('/save', authenticate, authorize('employee'), (req, res) => {
  const { cycle_id, goals: goalsData } = req.body;
  if (!goalsData || !Array.isArray(goalsData)) return res.status(400).json({ error: 'Goals array required' });

  const db = getDb();
  const cycle = cycle_id
    ? db.prepare('SELECT * FROM goal_cycles WHERE id = ?').get(cycle_id)
    : db.prepare('SELECT * FROM goal_cycles WHERE is_active = 1').get();

  if (!cycle) return res.status(404).json({ error: 'Goal cycle not found' });

  const sheet = getOrCreateSheet(db, req.user.id, cycle.id);
  if (['submitted', 'approved', 'locked'].includes(sheet.status)) {
    return res.status(400).json({ error: 'Goal sheet is locked and cannot be edited' });
  }

  // Delete existing goals and re-insert (for simplicity)
  db.prepare('DELETE FROM goals WHERE sheet_id = ?').run(sheet.id);

  const insertGoal = db.prepare(`
    INSERT INTO goals (uuid, sheet_id, thrust_area_id, title, description, uom_type, target_value, target_date, weightage, is_shared, display_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);

  goalsData.forEach((g, idx) => {
    insertGoal.run(
      uuidv4(), sheet.id,
      g.thrust_area_id || null, g.title, g.description || null,
      g.uom_type, g.target_value || null, g.target_date || null,
      Number(g.weightage), idx
    );
  });

  const total = recalcWeightage(db, sheet.id);
  const updatedSheet = getSheetWithGoals(db, sheet.id);
  res.json({ sheet: updatedSheet, totalWeightage: total });
});

// POST /api/goals/submit — submit for manager approval
router.post('/submit', authenticate, authorize('employee'), (req, res) => {
  const { cycle_id } = req.body;
  const db = getDb();

  const cycle = cycle_id
    ? db.prepare('SELECT * FROM goal_cycles WHERE id = ?').get(cycle_id)
    : db.prepare('SELECT * FROM goal_cycles WHERE is_active = 1').get();

  if (!cycle) return res.status(404).json({ error: 'Goal cycle not found' });
  if (cycle.phase !== 'goal_setting') return res.status(400).json({ error: 'Goal setting window is not open' });

  const sheet = db.prepare('SELECT * FROM goal_sheets WHERE employee_id = ? AND cycle_id = ?').get(req.user.id, cycle.id);
  if (!sheet) return res.status(404).json({ error: 'No goal sheet found. Please save goals first.' });
  if (sheet.status === 'submitted') return res.status(400).json({ error: 'Already submitted' });
  if (['approved', 'locked'].includes(sheet.status)) return res.status(400).json({ error: 'Cannot resubmit approved goals' });

  const goals = db.prepare('SELECT * FROM goals WHERE sheet_id = ?').all(sheet.id);
  if (goals.length === 0) return res.status(400).json({ error: 'No goals to submit' });

  const errors = validateGoals(goals);
  if (errors.length > 0) return res.status(400).json({ error: errors[0], errors });

  db.prepare(`UPDATE goal_sheets SET status='submitted', submitted_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(sheet.id);

  // Notify manager
  const employee = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (employee.manager_id) {
    db.prepare(`INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, 'goal_submission', ?)`).run(
      employee.manager_id,
      'Goal Sheet Submitted',
      `${employee.name} has submitted their goal sheet for review.`,
      `/manager/review/${sheet.id}`
    );
  }

  logAudit({ entityType: 'goal_sheet', entityId: sheet.id, action: 'submitted', changedBy: req.user.id, changedByName: req.user.name });

  const updatedSheet = getSheetWithGoals(db, sheet.id);
  res.json({ sheet: updatedSheet, message: 'Goals submitted successfully' });
});

// POST /api/goals/approve — manager approves/returns
router.post('/approve', authenticate, authorize('manager', 'admin'), (req, res) => {
  const { sheet_id, action, return_reason, edited_goals } = req.body;
  if (!sheet_id || !action) return res.status(400).json({ error: 'sheet_id and action required' });
  if (!['approve', 'return'].includes(action)) return res.status(400).json({ error: 'action must be approve or return' });

  const db = getDb();
  const sheet = db.prepare(`
    SELECT gs.*, u.manager_id FROM goal_sheets gs JOIN users u ON gs.employee_id = u.id WHERE gs.id = ?
  `).get(sheet_id);

  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
  if (req.user.role === 'manager' && sheet.manager_id !== req.user.id) {
    return res.status(403).json({ error: 'Not your team member' });
  }
  if (sheet.status !== 'submitted') return res.status(400).json({ error: 'Sheet is not in submitted state' });

  if (action === 'approve') {
    // Apply inline edits if any
    if (edited_goals && Array.isArray(edited_goals)) {
      const updateGoal = db.prepare(`UPDATE goals SET target_value=?, weightage=?, description=?, updated_at=datetime('now') WHERE id=? AND sheet_id=?`);
      edited_goals.forEach(g => {
        const old = db.prepare('SELECT * FROM goals WHERE id = ?').get(g.id);
        updateGoal.run(g.target_value, g.weightage, g.description, g.id, sheet_id);
        logAudit({ entityType: 'goal', entityId: g.id, action: 'manager_edit_on_approval', changedBy: req.user.id, changedByName: req.user.name, oldValue: old, newValue: g });
      });
      recalcWeightage(db, sheet_id);
    }

    // Validate before approving
    const goals = db.prepare('SELECT * FROM goals WHERE sheet_id = ?').all(sheet_id);
    const errors = validateGoals(goals);
    if (errors.length > 0) return res.status(400).json({ error: errors[0], errors });

    db.prepare(`UPDATE goal_sheets SET status='approved', approved_at=datetime('now'), approved_by=?, return_reason=NULL, updated_at=datetime('now') WHERE id=?`).run(req.user.id, sheet_id);
    logAudit({ entityType: 'goal_sheet', entityId: sheet_id, action: 'approved', changedBy: req.user.id, changedByName: req.user.name });

    // Notify employee
    db.prepare(`INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, 'goal_approved', ?)`).run(
      sheet.employee_id, 'Goals Approved', 'Your goal sheet has been approved by your manager.', '/employee/goals'
    );
  } else {
    if (!return_reason) return res.status(400).json({ error: 'return_reason required when returning' });
    db.prepare(`UPDATE goal_sheets SET status='returned', return_reason=?, updated_at=datetime('now') WHERE id=?`).run(return_reason, sheet_id);
    logAudit({ entityType: 'goal_sheet', entityId: sheet_id, action: 'returned', changedBy: req.user.id, changedByName: req.user.name, notes: return_reason });

    db.prepare(`INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, 'goal_returned', ?)`).run(
      sheet.employee_id, 'Goals Returned for Revision', `Your goals were returned: ${return_reason}`, '/employee/goals'
    );
  }

  const updatedSheet = getSheetWithGoals(db, sheet_id);
  res.json({ sheet: updatedSheet, message: action === 'approve' ? 'Goals approved successfully' : 'Goals returned for revision' });
});

// POST /api/goals/share — admin pushes shared goal to multiple employees
router.post('/share', authenticate, authorize('admin', 'manager'), (req, res) => {
  const { title, description, thrust_area_id, uom_type, target_value, target_date, cycle_id, employee_ids, default_weightage } = req.body;
  if (!title || !uom_type || !employee_ids || !Array.isArray(employee_ids)) {
    return res.status(400).json({ error: 'title, uom_type, employee_ids required' });
  }

  const db = getDb();
  const cycle = cycle_id
    ? db.prepare('SELECT * FROM goal_cycles WHERE id = ?').get(cycle_id)
    : db.prepare('SELECT * FROM goal_cycles WHERE is_active = 1').get();

  if (!cycle) return res.status(404).json({ error: 'No active cycle' });

  // Create parent goal (owned by first employee or use admin)
  const ownerId = employee_ids[0];
  const ownerSheet = getOrCreateSheet(db, ownerId, cycle.id);

  const parentGoalResult = db.prepare(`
    INSERT INTO goals (uuid, sheet_id, thrust_area_id, title, description, uom_type, target_value, target_date, weightage, is_shared, owner_employee_id, is_readonly_title, is_readonly_target)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, 1)
  `).run(uuidv4(), ownerSheet.id, thrust_area_id || null, title, description || null, uom_type, target_value || null, target_date || null, Number(default_weightage) || 10, ownerId);

  const parentGoalId = parentGoalResult.lastInsertRowid;
  recalcWeightage(db, ownerSheet.id);

  // Push to other employees
  const others = employee_ids.slice(1);
  others.forEach(empId => {
    const empSheet = getOrCreateSheet(db, empId, cycle.id);
    db.prepare(`
      INSERT INTO goals (uuid, sheet_id, thrust_area_id, title, description, uom_type, target_value, target_date, weightage, is_shared, shared_from_goal_id, owner_employee_id, is_readonly_title, is_readonly_target)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1, 1)
    `).run(uuidv4(), empSheet.id, thrust_area_id || null, title, description || null, uom_type, target_value || null, target_date || null, Number(default_weightage) || 10, parentGoalId, ownerId);
    recalcWeightage(db, empSheet.id);

    // Notify
    db.prepare(`INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'shared_goal')`).run(
      empId, 'Shared Goal Added', `A shared goal "${title}" has been added to your goal sheet.`
    );
  });

  logAudit({ entityType: 'goal', entityId: parentGoalId, action: 'shared', changedBy: req.user.id, changedByName: req.user.name, notes: `Shared to ${employee_ids.length} employees` });

  res.status(201).json({ message: `Goal shared to ${employee_ids.length} employees`, parentGoalId });
});

// PUT /api/goals/:id/unlock — admin unlock individual goal
router.put('/:id/unlock', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });

  const sheet = db.prepare('SELECT * FROM goal_sheets WHERE id = ?').get(goal.sheet_id);

  if (sheet.status === 'approved' || sheet.status === 'locked') {
    db.prepare(`UPDATE goal_sheets SET status='draft', updated_at=datetime('now') WHERE id=?`).run(sheet.id);
    logAudit({ entityType: 'goal_sheet', entityId: sheet.id, action: 'admin_unlock', changedBy: req.user.id, changedByName: req.user.name });
  }

  res.json({ message: 'Goal sheet unlocked for editing' });
});

// GET /api/goals/sheet/:id — get specific sheet (admin/manager)
router.get('/sheet/:id', authenticate, authorize('manager', 'admin'), (req, res) => {
  const db = getDb();
  const sheet = getSheetWithGoals(db, req.params.id);
  if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
  res.json(sheet);
});

// GET /api/goals/thrust-areas
router.get('/thrust-areas', authenticate, (req, res) => {
  const db = getDb();
  const areas = db.prepare('SELECT * FROM thrust_areas WHERE is_active = 1 ORDER BY name').all();
  res.json(areas);
});

module.exports = router;
