// src/pages/manager/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileSignature, CheckSquare, Target } from 'lucide-react';
import api from '../../utils/api';

export default function ManagerDashboard() {
  const [teamStats, setTeamStats] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/users'), // employees under this manager
      api.get('/goals/team-sheets')
    ]).then(([usersRes, sheetsRes]) => {
      const employees = usersRes.data || [];
      const sheets = sheetsRes.data || [];
      
      setTeamStats({
        total: employees.length,
        submitted: sheets.filter(s => s.status === 'submitted').length,
        approved: sheets.filter(s => ['approved', 'locked'].includes(s.status)).length
      });

      setPendingApprovals(sheets.filter(s => s.status === 'submitted'));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Manager Dashboard</h1>
          <p>Overview of your team's goal sheets and check-ins.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Users size={20} /></div>
          <div>
            <div className="stat-label">Team Members</div>
            <div className="stat-value">{teamStats?.total || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><FileSignature size={20} /></div>
          <div>
            <div className="stat-label">Pending Approvals</div>
            <div className="stat-value">{teamStats?.submitted || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Target size={20} /></div>
          <div>
            <div className="stat-label">Approved Goals</div>
            <div className="stat-value">{teamStats?.approved || 0}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Action Required: Pending Approvals</span>
        </div>
        {pendingApprovals.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <CheckSquare size={40} style={{ color: 'var(--brand-success)', opacity: 0.8 }} />
            <h3 style={{ marginTop: '1rem' }}>All caught up!</h3>
            <p>No goal sheets are currently pending your approval.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Submitted On</th>
                  <th>Total Weightage</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingApprovals.map(sheet => (
                  <tr key={sheet.id}>
                    <td>{sheet.employee_name}</td>
                    <td>{sheet.submitted_at ? new Date(sheet.submitted_at).toLocaleDateString() : 'N/A'}</td>
                    <td>{sheet.total_weightage}%</td>
                    <td>
                      <Link to={`/manager/review/${sheet.id}`} className="btn btn-primary btn-sm">
                        Review Sheet
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.75rem' }}>Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link to="/manager/team" className="btn btn-secondary"><Users size={15} /> View Team Goals</Link>
            <Link to="/manager/checkins" className="btn btn-secondary"><CheckSquare size={15} /> Conduct Check-ins</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
