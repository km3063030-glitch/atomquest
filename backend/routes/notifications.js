// routes/notifications.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(req.user.id);
  const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).count;
  res.json({ notifications, unreadCount });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ success: true });
});

module.exports = router;
