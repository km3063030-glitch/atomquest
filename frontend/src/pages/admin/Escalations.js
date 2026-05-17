// src/pages/admin/Escalations.js
import React, { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminEscalations() {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real scenario this would fetch from /admin/escalations
    // Mocking an empty state for the demo to show the system is healthy
    setTimeout(() => setLoading(false), 500);
  }, []);

  const resolve = (id) => {
    setEscalations(e => e.filter(item => item.id !== id));
    toast.success('Escalation marked as resolved');
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Escalation Management</h1>
          <p>Rule-based alerts for overdue actions.</p>
        </div>
      </div>

      <div className="card">
        {escalations.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <CheckCircle size={40} style={{ color: 'var(--brand-success)' }} />
            <h3 style={{ marginTop: '1rem' }}>All Good!</h3>
            <p>There are no active escalations right now. Your team is on track.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Employee / Manager</th>
                  <th>Issue</th>
                  <th>Days Overdue</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {escalations.map(esc => (
                  <tr key={esc.id}>
                    <td><span className="badge badge-returned">{esc.level}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{esc.employee}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Manager: {esc.manager}</div>
                    </td>
                    <td>{esc.issue}</td>
                    <td>{esc.days} days</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => resolve(esc.id)}>Resolve</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
