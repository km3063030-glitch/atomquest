// src/pages/admin/Reports.js
import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Download, Users, CheckCircle, Clock, BarChart2, Target, TrendingUp, Award } from 'lucide-react';

const QUARTER_LABELS = { q1: 'Q1', q2: 'Q2', q3: 'Q3', q4_annual: 'Q4 / Annual' };
const UOM_LABELS = { numeric_min: 'Numeric (Higher)', numeric_max: 'Numeric (Lower)', timeline: 'Timeline', zero: 'Zero-based' };

function StatCard({ icon, label, value, sub, color = 'blue' }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value ?? '—'}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function ScoreBar({ label, score, count }) {
  const pct = score != null ? Math.round(score * 100) : 0;
  const color = pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'danger';
  return (
    <div style={{ marginBottom: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>{pct}% avg{count != null ? ` · ${count} employees` : ''}</span>
      </div>
      <div className="progress-bar" style={{ height: 8 }}>
        <div className={`progress-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AdminReports() {
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [achievementData, setAchievementData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    Promise.all([
      api.get('/reports/completion-dashboard'),
      api.get('/reports/analytics'),
      api.get('/reports/achievement', { params: { format: 'json' } }),
    ]).then(([dashRes, analyticsRes, achRes]) => {
      setDashboard(dashRes.data);
      setAnalytics(analyticsRes.data);
      setAchievementData(achRes.data?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem('atomquest_token');
      const base = process.env.REACT_APP_API_URL || '/api';
      const res = await fetch(`${base}/reports/achievement?format=csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'achievement_report.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const { stats, managers = [], thrustBreakdown = [], uomBreakdown = [], cycle } = dashboard || {};

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1>Reports & Analytics</h1>
          <p>{cycle ? `Cycle: ${cycle.name} · Phase: ${cycle.phase?.replace('_', ' ')}` : 'No active cycle'}</p>
        </div>
        <button className="btn btn-primary" onClick={handleExportCSV}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {[
          { id: 'overview', label: 'Overview', icon: <BarChart2 size={14} /> },
          { id: 'managers', label: 'Manager Breakdown', icon: <Users size={14} /> },
          { id: 'details', label: 'Achievement Details', icon: <Award size={14} /> },
        ].map(t => (
          <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <>
          {/* Stat cards */}
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '1.5rem' }}>
            <StatCard icon={<Users size={20} />} label="Total Employees" value={stats?.totalEmployees} color="blue" />
            <StatCard icon={<CheckCircle size={20} />} label="Goals Submitted" value={stats?.submitted} sub={`of ${stats?.totalEmployees}`} color="green" />
            <StatCard icon={<Award size={20} />} label="Goals Approved" value={stats?.approved} color="purple" />
            <StatCard icon={<Clock size={20} />} label="Not Started" value={stats?.notStarted} color="yellow" />
          </div>

          {/* Check-in Progress */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="card">
              <div className="card-title" style={{ marginBottom: '1rem' }}>
                <TrendingUp size={15} style={{ display: 'inline', marginRight: '0.4rem' }} />
                Quarterly Check-in Progress
              </div>
              {stats?.checkinStats && Object.entries(stats.checkinStats).map(([q, count]) => (
                <div key={q} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{QUARTER_LABELS[q] || q}</span>
                  <span className={`badge badge-${count > 0 ? 'approved' : 'draft'}`}>{count} check-in{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
              {!stats?.checkinStats && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No check-in data yet.</p>}
            </div>

            {/* UoM Breakdown */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '1rem' }}>
                <Target size={15} style={{ display: 'inline', marginRight: '0.4rem' }} />
                Goals by UoM Type
              </div>
              {uomBreakdown.length > 0 ? uomBreakdown.map(u => {
                const total = uomBreakdown.reduce((s, x) => s + x.count, 0);
                const pct = total > 0 ? Math.round((u.count / total) * 100) : 0;
                return (
                  <div key={u.uom_type} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600 }}>{UOM_LABELS[u.uom_type] || u.uom_type}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{u.count} goals ({pct}%)</span>
                    </div>
                    <div className="progress-bar" style={{ height: 6 }}>
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              }) : <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No goals data yet.</p>}
            </div>
          </div>

          {/* Thrust Area & Department Performance */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="card">
              <div className="card-title" style={{ marginBottom: '1rem' }}>Goals by Thrust Area</div>
              {thrustBreakdown.length > 0 ? thrustBreakdown.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
                  <span style={{ fontWeight: 600 }}>{t.name}</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span className="badge badge-draft">{t.goal_count} goals</span>
                    <span className="badge badge-submitted">{t.employee_count} employees</span>
                  </div>
                </div>
              )) : <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No thrust area data yet.</p>}
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: '1rem' }}>Performance by Department</div>
              {analytics?.departmentPerformance?.length > 0 ? analytics.departmentPerformance.map((d, i) => (
                <ScoreBar key={i} label={d.department || 'Unassigned'} score={d.avg_score} count={d.employees} />
              )) : <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No achievement data yet — scores appear after employees log progress.</p>}
            </div>
          </div>
        </>
      )}

      {/* ── Manager Breakdown Tab ── */}
      {tab === 'managers' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Manager-wise Submission & Approval Status</div>
          {managers.length === 0 ? (
            <div className="empty-state">
              <Users size={32} />
              <h3>No manager data</h3>
              <p>No managers found for the active cycle.</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Department</th>
                  <th>Team Size</th>
                  <th>Submitted</th>
                  <th>Approved</th>
                  <th>Submission Rate</th>
                  <th>Approval Rate</th>
                </tr>
              </thead>
              <tbody>
                {managers.map(m => {
                  const submitRate = m.team_size > 0 ? Math.round((m.submitted_count / m.team_size) * 100) : 0;
                  const approvalRate = m.team_size > 0 ? Math.round((m.approved_count / m.team_size) * 100) : 0;
                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td>{m.department || '-'}</td>
                      <td>{m.team_size}</td>
                      <td>{m.submitted_count}</td>
                      <td>{m.approved_count}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="progress-bar" style={{ flex: 1, height: 6 }}>
                            <div className={`progress-fill ${submitRate === 100 ? 'success' : submitRate > 50 ? 'warning' : 'danger'}`} style={{ width: `${submitRate}%` }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, minWidth: 35 }}>{submitRate}%</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="progress-bar" style={{ flex: 1, height: 6 }}>
                            <div className={`progress-fill ${approvalRate === 100 ? 'success' : approvalRate > 50 ? 'warning' : 'danger'}`} style={{ width: `${approvalRate}%` }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, minWidth: 35 }}>{approvalRate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Achievement Details Tab ── */}
      {tab === 'details' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="card-title">Achievement Details ({achievementData.length} records)</div>
            <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}><Download size={13} /> Export CSV</button>
          </div>
          {achievementData.length === 0 ? (
            <div className="empty-state">
              <Award size={32} />
              <h3>No achievement data</h3>
              <p>Employees need to log their progress on the Achievements page first.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Goal</th>
                    <th>Thrust Area</th>
                    <th>UoM</th>
                    <th>Target</th>
                    <th>Quarter</th>
                    <th>Actual</th>
                    <th>Status</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {achievementData.slice(0, 100).map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{r.employee_name}</td>
                      <td>{r.department || '-'}</td>
                      <td>{r.goal_title}</td>
                      <td>{r.thrust_area || '-'}</td>
                      <td style={{ fontSize: '0.75rem' }}>{UOM_LABELS[r.uom_type] || r.uom_type}</td>
                      <td>{r.target_value ?? r.target_date ?? '-'}</td>
                      <td>{QUARTER_LABELS[r.quarter] || r.quarter || '-'}</td>
                      <td>{r.actual_value ?? r.actual_date ?? '—'}</td>
                      <td>
                        {r.status
                          ? <span className={`badge badge-${r.status}`}>{r.status.replace('_', ' ')}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ fontWeight: 700, color: r.progress_score != null ? (r.progress_score >= 0.8 ? 'var(--brand-success)' : r.progress_score >= 0.5 ? 'var(--brand-warning)' : 'var(--brand-danger)') : 'var(--text-muted)' }}>
                        {r.progress_score != null ? `${(r.progress_score * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {achievementData.length > 100 && (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Showing first 100 records. Use "Export CSV" to get the full dataset.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
