// utils/audit.js
const { getDb } = require('../db');

function logAudit({ entityType, entityId, action, changedBy, changedByName, oldValue, newValue, fieldName, notes }) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO audit_log (entity_type, entity_id, action, changed_by, changed_by_name, old_value, new_value, field_name, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entityType, entityId, action, changedBy, changedByName,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      fieldName || null, notes || null
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

module.exports = { logAudit };
