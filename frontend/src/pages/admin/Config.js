// src/pages/admin/Config.js
import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function AdminConfig() {
  const [areas, setAreas] = useState([]);

  useEffect(() => {
    api.get('/admin/thrust-areas').then(res => setAreas(res.data)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>System Configuration</h1>
          <p>Manage Thrust Areas and escalation rules.</p>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Thrust Areas</div>
        <table className="table" style={{ marginTop: '1rem' }}>
          <thead><tr><th>ID</th><th>Name</th><th>Description</th></tr></thead>
          <tbody>
            {areas.map(a => (
              <tr key={a.id}><td>{a.id}</td><td>{a.name}</td><td>{a.description || '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
