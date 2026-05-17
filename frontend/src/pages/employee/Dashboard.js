// src/pages/employee/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Target, BarChart3, CheckCircle, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

const STATUS_LABELS = { draft: 'Draft', submitted: 'Pending Approval', approved: 'Approved', returned: 'Returned', locked: 'Locked' };

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/goals/sheet'),
      api.get('/achievements')
    ]).then(([sheetRes, achRes]) => {
      setData({ sheetData: sheetRes.data, achievements: achRes.data });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const { sheetData, achievements } = data || {};
  const { sheet, cycle } = sheetData || {};
  const goals = sheet?.goals || [];

  const totalGoals = goals.length;
  const completedGoals = achievements.filter(a => a.status === 'completed').length;
  const onTrackGoals = achievements.filter(a => a.status === 'on_track').length;

  const avgScore = achievements.length > 0
    ? (achievements.filter(a => a.progress_score !== null).reduce((s, a) => s + (a.progress_score || 0), 0) / Math.max(achievements.filter(a => a.progress_score !== null).length, 1) * 100).toFixed(0)
    : null;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Welcome back, {user?.name?.split(' ')[0]}!</h1>
          <p>Here's your goal progress for {cycle?.name || 'current cycle'}</p>
        </div>
        <Link to="/employee/goals" className="btn btn-primary">
          <Target size={16} /> Manage Goals <ArrowRight size={14} />
        </Link>
      </div>

      {/* Cycle Status */}
      {cycle && (
        <div className={`alert alert-${cycle.phase === 'goal_setting' ? 'info' : 'success'}`} style={{ marginBottom: '1.5rem' }}>
          <Clock size={16} />
          <div>
            <strong>Active Cycle:</strong> {cycle.name} · Window: {cycle.window_open} – {cycle.window_close}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Target size={20} /></div>
          <div>
            <div className="stat-label">Total Goals</div>
            <div className="stat-value">{totalGoals}</div>
            <div className="stat-sub">of 8 max allowed</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle size={20} /></div>
          <div>
            <div className="stat-label">Completed</div>
            <div className="stat-value">{completedGoals}</div>
            <div className="stat-sub">goals achieved</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><BarChart3 size={20} /></div>
          <div>
            <div className="stat-label">On Track</div>
            <div className="stat-value">{onTrackGoals}</div>
            <div className="stat-sub">in progress</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple" style={{ '--icon-color': '#8B5CF6' }}>
            <BarChart3 size={20} style={{ color: '#8B5CF6' }} />
          </div>
          <div>
            <div className="stat-label">Avg. Score</div>
            <div className="stat-value">{avgScore !== null ? `${avgScore}%` : '—'}</div>
            <div className="stat-sub">overall performance</div>
          </div>
        </div>
      </div>

      {/* Goal Sheet Status */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Goal Sheet Status</span>
          {sheet && <span className={`badge badge-${sheet.status}`}>{STATUS_LABELS[sheet.status] || sheet.status}</span>}
        </div>

        {!sheet ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <Target size={40} />
            <h3>No goals created yet</h3>
            <p>Start by creating your goals for this cycle.</p>
            <Link to="/employee/goals" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Create Goals
            </Link>
          </div>
        ) : (
          <>
            {sheet.status === 'returned' && sheet.return_reason && (
              <div className="alert alert-warning">
                <AlertCircle size={16} />
                <div><strong>Returned by Manager:</strong> {sheet.return_reason}</div>
              </div>
            )}

            {/* Weightage overview */}
            <div className="weightage-meter valid" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Total Weightage</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: sheet.total_weightage === 100 ? 'var(--brand-success)' : 'var(--brand-danger)' }}>
                  {sheet.total_weightage}%
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(sheet.total_weightage, 100)}%`, background: sheet.total_weightage === 100 ? '' : 'var(--brand-warning)' }} />
              </div>
            </div>

            {/* Goals list */}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Goal</th>
                    <th>Thrust Area</th>
                    <th>Target</th>
                    <th>Weightage</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {goals.map((goal, i) => {
                    const ach = achievements.find(a => a.goal_id === goal.id);
                    return (
                      <tr key={goal.id}>
                        <td>{i + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{goal.title}</div>
                          {goal.is_shared === 1 && <span className="chip" style={{ marginTop: '0.2rem' }}>Shared</span>}
                        </td>
                        <td>{goal.thrust_area_name || '—'}</td>
                        <td>{goal.target_value ?? goal.target_date ?? '—'}</td>
                        <td>{goal.weightage}%</td>
                        <td>
                          {ach ? <span className={`badge badge-${ach.status}`}>{ach.status?.replace('_', ' ')}</span>
                            : <span className="badge badge-not_started">Not Started</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.75rem' }}>Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link to="/employee/goals" className="btn btn-secondary"><Target size={15} /> Manage Goal Sheet</Link>
            {sheet && ['approved', 'locked'].includes(sheet.status) && (
              <Link to="/employee/achievements" className="btn btn-secondary"><BarChart3 size={15} /> Log Achievement</Link>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.75rem' }}>Your Manager</div>
          {sheet?.manager_name
            ? <div>
                <div style={{ fontWeight: 600 }}>{sheet.manager_name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>L1 Manager</div>
              </div>
            : <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No manager assigned</div>
          }
        </div>
      </div>
    </div>
  );
}
