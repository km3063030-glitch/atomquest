// src/pages/admin/Cycles.js
import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function AdminCycles() {
  const [cycles, setCycles] = useState([]);

  useEffect(() => {
    api.get('/cycles').then(res => setCycles(res.data)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Performance Cycles</h1>
          <p>Manage goal setting and review periods.</p>
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Name</th><th>Phase</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
          <tbody>
            {cycles.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td><td>{c.phase.replace('_', ' ')}</td>
                <td>{c.window_open}</td><td>{c.window_close}</td>
                <td><span className={`badge badge-${c.is_active ? 'approved' : 'draft'}`}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
