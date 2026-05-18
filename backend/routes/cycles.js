// routes/cycles.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/cycles
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const cycles = db.prepare('SELECT * FROM goal_cycles ORDER BY year DESC, id DESC').all();
  res.json(cycles);
});

// GET /api/cycles/active
router.get('/active', authenticate, (req, res) => {
  const db = getDb();
  const cycle = db.prepare('SELECT * FROM goal_cycles WHERE is_active = 1 LIMIT 1').get();
  res.json(cycle || null);
});

// POST /api/cycles — admin only
router.post('/', authenticate, authorize('admin'), (req, res) => {
  const { name, year, phase, window_open, window_close, is_active } = req.body;
  if (!name || !year || !phase || !window_open || !window_close) {
    return res.status(400).json({ error: 'All fields required' });
  }
  const db = getDb();

  if (is_active) {
    db.prepare('UPDATE goal_cycles SET is_active = 0').run();
  }

  const result = db.prepare(`
    INSERT INTO goal_cycles (name, year, phase, window_open, window_close, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, year, phase, window_open, window_close, is_active ? 1 : 0);

  const cycle = db.prepare('SELECT * FROM goal_cycles WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(cycle);
});

// PUT /api/cycles/:id
router.put('/:id', authenticate, authorize('admin'), (req, res) => {
  const { name, window_open, window_close, is_active, phase } = req.body;
  const db = getDb();

  if (is_active) {
    db.prepare('UPDATE goal_cycles SET is_active = 0').run();
  }

  const validPhases = ['goal_setting', 'goal_review', 'check_in', 'appraisal', 'closed'];
  const safePhase = validPhases.includes(phase) ? phase : undefined;

  if (safePhase) {
    db.prepare(`
      UPDATE goal_cycles SET name=?, window_open=?, window_close=?, is_active=?, phase=? WHERE id=?
    `).run(name, window_open, window_close, is_active ? 1 : 0, safePhase, req.params.id);
  } else {
    db.prepare(`
      UPDATE goal_cycles SET name=?, window_open=?, window_close=?, is_active=? WHERE id=?
    `).run(name, window_open, window_close, is_active ? 1 : 0, req.params.id);
  }

  const cycle = db.prepare('SELECT * FROM goal_cycles WHERE id = ?').get(req.params.id);
  res.json(cycle);
});

// GET /api/cycles/thrust-areas
router.get('/thrust-areas', authenticate, (req, res) => {
  const db = getDb();
  const areas = db.prepare('SELECT * FROM thrust_areas WHERE is_active = 1 ORDER BY name').all();
  res.json(areas);
});

module.exports = router;
