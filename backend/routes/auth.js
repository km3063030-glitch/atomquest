// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });

  logAudit({ entityType: 'user', entityId: user.id, action: 'login', changedBy: user.id, changedByName: user.name });

  res.json({
    token,
    user: {
      id: user.id, uuid: user.uuid, name: user.name,
      email: user.email, role: user.role,
      department: user.department, managerId: user.manager_id
    }
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.uuid, u.name, u.email, u.role, u.department, u.manager_id,
           m.name as manager_name
    FROM users u
    LEFT JOIN users m ON u.manager_id = m.id
    WHERE u.id = ?
  `).get(req.user.id);
  res.json(user);
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Password changed successfully' });
});

module.exports = router;
