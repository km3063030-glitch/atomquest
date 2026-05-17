// routes/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/users — list users (admin/manager)
router.get('/', authenticate, authorize('admin', 'manager'), (req, res) => {
  const db = getDb();
  const { role, department, manager_id } = req.query;

  let query = `
    SELECT u.id, u.uuid, u.name, u.email, u.role, u.department, u.manager_id, u.is_active,
           m.name as manager_name
    FROM users u
    LEFT JOIN users m ON u.manager_id = m.id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'manager') {
    query += ' AND u.manager_id = ?';
    params.push(req.user.id);
  }

  if (role) { query += ' AND u.role = ?'; params.push(role); }
  if (department) { query += ' AND u.department = ?'; params.push(department); }
  if (manager_id) { query += ' AND u.manager_id = ?'; params.push(manager_id); }

  query += ' ORDER BY u.name';

  const users = db.prepare(query).all(...params);
  res.json(users);
});

// GET /api/users/team — manager's direct reports
router.get('/team', authenticate, authorize('manager', 'admin'), (req, res) => {
  const db = getDb();
  const managerId = req.query.manager_id || req.user.id;
  const team = db.prepare(`
    SELECT u.id, u.uuid, u.name, u.email, u.role, u.department, u.manager_id
    FROM users u WHERE u.manager_id = ? AND u.is_active = 1 ORDER BY u.name
  `).all(managerId);
  res.json(team);
});

// GET /api/users/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.uuid, u.name, u.email, u.role, u.department, u.manager_id, u.is_active,
           m.name as manager_name
    FROM users u LEFT JOIN users m ON u.manager_id = m.id WHERE u.id = ?
  `).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /api/users — create user (admin only)
router.post('/', authenticate, authorize('admin'), (req, res) => {
  const { name, email, password, role, department, manager_id } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'name, email, password, role required' });

  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const uuid = uuidv4();
  const result = db.prepare(`
    INSERT INTO users (uuid, name, email, password_hash, role, department, manager_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuid, name, email.toLowerCase().trim(), hash, role, department || null, manager_id || null);

  const user = db.prepare('SELECT id, uuid, name, email, role, department, manager_id FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// PUT /api/users/:id — update user (admin only)
router.put('/:id', authenticate, authorize('admin'), (req, res) => {
  const { name, role, department, manager_id, is_active } = req.body;
  const db = getDb();

  db.prepare(`
    UPDATE users SET name=?, role=?, department=?, manager_id=?, is_active=?, updated_at=datetime('now')
    WHERE id=?
  `).run(name, role, department, manager_id || null, is_active !== undefined ? is_active : 1, req.params.id);

  const user = db.prepare('SELECT id, uuid, name, email, role, department, manager_id, is_active FROM users WHERE id = ?').get(req.params.id);
  res.json(user);
});

module.exports = router;
