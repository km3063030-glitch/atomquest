// src/pages/admin/Audit.js
import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Shield, Filter, RefreshCw } from 'lucide-react';

const ACTION_BADGE = {
  CREATE:  'approved',
  UPDATE:  'submitted',
  DELETE:  'returned',
  APPROVE: 'approved',
  SUBMIT:  'submitted',
  RETURN:  'returned',
  LOGIN:   'draft',
};

const ENTITY_OPTIONS = ['', 'goal_sheet', 'goal', 'user', 'cycle', 'achievement', 'checkin'];

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [limit, setLimit] = useState(100);

  const fetchLogs = () => {
    setLoading(true);
    const params = { limit };
    if (entityFilter) params.entity_type = entityFilter;
    api.get('/reports/audit-log', { params })
      .then(res => setLogs(Array.isArray(res.data) ? res.data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(); }, [entityFilter, limit]);

  const actionLabel = (action) => action?.toUpperCase() || 'EVENT';

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Audit Trail</h1>
          <p>System modifications and governance logs — {logs.length} records shown.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchLogs}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.85rem 1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Filter size={15} style={{ color: 'var(--text-muted)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Entity Type</label>
            <select className="form-control" style={{ width: 'auto', minWidth: 160 }} value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
              {ENTITY_OPTIONS.map(o => <option key={o} value={o}>{o || 'All Types'}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Show</label>
            <select className="form-control" style={{ width: 'auto' }} value={limit} onChange={e => setLimit(Number(e.target.value))}>
              {[50, 100, 250, 500].map(n => <option key={n} value={n}>{n} rows</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : logs.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <Shield size={36} />
            <h3>No Audit Logs</h3>
            <p>Logs are created when users perform actions like submitting goals, approving sheets, or changing settings.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Performed By</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Field / Notes</th>
                  <th>Old Value</th>
                  <th>New Value</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {l.created_at ? new Date(l.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{l.changed_by_name || `User #${l.changed_by}`}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${ACTION_BADGE[actionLabel(l.action)] || 'draft'}`}>
                        {actionLabel(l.action)}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 600 }}>{l.entity_type}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}> #{l.entity_id}</span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: 200 }}>
                      {l.field_name && <span style={{ fontWeight: 600 }}>{l.field_name}: </span>}
                      {l.notes || '—'}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 120, wordBreak: 'break-all' }}>
                      {l.old_value || '—'}
                    </td>
                    <td style={{ fontSize: '0.75rem', maxWidth: 120, wordBreak: 'break-all' }}>
                      {l.new_value || '—'}
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
