// src/pages/admin/Escalations.js
import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { CheckCircle, AlertTriangle, Clock, Settings, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const SEVERITY_COLORS = { high: 'returned', medium: 'submitted', low: 'draft' };
const TYPE_LABELS = {
  goal_not_submitted: 'Goals Not Submitted',
  goal_not_approved: 'Goals Not Approved by Manager',
  checkin_not_done: 'Check-in Not Completed',
};

export default function AdminEscalations() {
  const [escalations, setEscalations] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/admin/escalations'),
      api.get('/admin/escalation-rules'),
    ]).then(([escRes, rulesRes]) => {
      setEscalations(escRes.data || []);
      setRules(rulesRes.data || []);
    }).catch(() => {
      setEscalations([]);
    }).finally(() => setLoading(false));
  }, []);

  const updateRule = (id, field, value) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const saveRule = async (rule) => {
    setSavingRules(true);
    try {
      await api.put(`/admin/escalation-rules/${rule.id}`, {
        days_threshold: Number(rule.days_threshold),
        is_active: rule.is_active ? 1 : 0,
      });
      toast.success('Rule updated successfully');
    } catch {
      toast.error('Failed to update rule');
    } finally {
      setSavingRules(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const highCount = escalations.filter(e => e.severity === 'high').length;
  const mediumCount = escalations.filter(e => e.severity === 'medium').length;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Escalation Management</h1>
          <p>Rule-based alerts for overdue goal submissions, approvals, and check-ins.</p>
        </div>
      </div>

      {/* Summary badges */}
      {escalations.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {highCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '0.5rem 1rem' }}>
              <AlertTriangle size={16} color="var(--brand-danger)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--brand-danger)' }}>{highCount} High Priority</span>
            </div>
          )}
          {mediumCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', padding: '0.5rem 1rem' }}>
              <Clock size={16} color="var(--brand-warning)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--brand-warning)' }}>{mediumCount} Medium Priority</span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab${tab === 'active' ? ' active' : ''}`} onClick={() => setTab('active')}>
          <AlertTriangle size={14} /> Active Escalations {escalations.length > 0 && `(${escalations.length})`}
        </button>
        <button className={`tab${tab === 'rules' ? ' active' : ''}`} onClick={() => setTab('rules')}>
          <Settings size={14} /> Escalation Rules
        </button>
      </div>

      {/* ── Active Escalations ── */}
      {tab === 'active' && (
        <div className="card">
          {escalations.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <CheckCircle size={44} style={{ color: 'var(--brand-success)', opacity: 1 }} />
              <h3 style={{ marginTop: '1rem' }}>All Clear!</h3>
              <p>No active escalations right now. Your team is on track.</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Type</th>
                  <th>Employee</th>
                  <th>Manager</th>
                  <th>Issue Detail</th>
                  <th>Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {escalations.map((esc, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`badge badge-${SEVERITY_COLORS[esc.severity] || 'draft'}`} style={{ textTransform: 'capitalize' }}>
                        {esc.severity}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>{TYPE_LABELS[esc.type] || esc.type}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{esc.employee?.name || '—'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{esc.employee?.email}</div>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{esc.manager?.name || '—'}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{esc.message}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: esc.severity === 'high' ? 'var(--brand-danger)' : 'var(--brand-warning)' }}>
                        {esc.days} days
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Escalation Rules ── */}
      {tab === 'rules' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.5rem' }}>Configure Escalation Thresholds</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Define how many days must pass before an alert is triggered. Toggle rules on or off as needed.
          </p>
          {rules.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No escalation rules configured.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Trigger Event</th><th>Days Threshold</th><th>Active</th><th style={{ width: 100 }}>Save</th></tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id}>
                    <td style={{ fontWeight: 600 }}>{TYPE_LABELS[rule.trigger_event] || rule.trigger_event}</td>
                    <td>
                      <input
                        className="form-control"
                        type="number"
                        min="1"
                        value={rule.days_threshold}
                        onChange={e => updateRule(rule.id, 'days_threshold', e.target.value)}
                        style={{ width: 80 }}
                      />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>days</span>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!rule.is_active}
                        onChange={e => updateRule(rule.id, 'is_active', e.target.checked)}
                        style={{ width: 'auto', cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => saveRule(rule)} disabled={savingRules}>
                        <Save size={13} /> Save
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
