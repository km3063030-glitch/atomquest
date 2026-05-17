// src/pages/admin/Reports.js
import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Download } from 'lucide-react';

export default function AdminReports() {
  const [data, setData] = useState([]);

  useEffect(() => {
    api.get('/reports/achievement?format=json').then(res => setData(res.data)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Achievement Reports</h1>
          <p>Exportable organizational performance data.</p>
        </div>
        <button className="btn btn-primary" onClick={() => window.open('/api/reports/achievement?format=csv', '_blank')}>
          <Download size={15} /> Export CSV
        </button>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Employee</th><th>Goal</th><th>Target</th><th>Actual</th><th>Score</th></tr></thead>
          <tbody>
            {data.slice(0,50).map((r, i) => (
              <tr key={i}>
                <td>{r.employee_name}</td><td>{r.goal_title}</td>
                <td>{r.target_value ?? r.target_date}</td><td>{r.actual_value ?? r.actual_date}</td>
                <td>{r.progress_score !== null ? `${(r.progress_score*100).toFixed(1)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
