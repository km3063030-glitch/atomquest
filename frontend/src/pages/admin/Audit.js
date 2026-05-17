// src/pages/admin/Audit.js
import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.get('/reports/audit').then(res => setLogs(res.data)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Audit Trail</h1>
          <p>System modifications and governance logs.</p>
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Time</th><th>User ID</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td>{new Date(l.created_at).toLocaleString()}</td>
                <td>{l.user_id}</td><td>{l.action}</td><td>{l.entity_type} ({l.entity_id})</td>
                <td style={{ fontSize: '0.75rem' }}>{l.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
