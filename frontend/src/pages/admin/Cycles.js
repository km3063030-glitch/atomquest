// src/pages/admin/Cycles.js
import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, X, Zap, RefreshCw } from 'lucide-react';

const PHASES = [
  { value: 'goal_setting', label: 'Goal Setting', hint: 'Employees can create & submit goals', color: '#4F6EF7' },
  { value: 'goal_review', label: 'Goal Review', hint: 'Managers reviewing submitted goals', color: '#F59E0B' },
  { value: 'check_in', label: 'Check-in / Progress', hint: 'Employees log quarterly achievements', color: '#10B981' },
  { value: 'appraisal', label: 'Appraisal', hint: 'Final scoring and review', color: '#8B5CF6' },
  { value: 'closed', label: 'Closed', hint: 'Cycle complete, all locked', color: '#9AA0BC' },
];

const EMPTY_FORM = { name: '', year: new Date().getFullYear(), phase: 'goal_setting', window_open: '', window_close: '', is_active: false };

export default function AdminCycles() {
  const [cycles, setCycles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [phaseUpdating, setPhaseUpdating] = useState(null); // cycle id being updated

  useEffect(() => { fetchCycles(); }, []);

  const fetchCycles = () => {
    api.get('/cycles').then(res => setCycles(res.data)).catch(() => {});
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.year || !form.window_open || !form.window_close) {
      return toast.error('All fields are required');
    }
    setLoading(true);
    try {
      await api.post('/cycles', { ...form, year: Number(form.year), is_active: form.is_active ? 1 : 0 });
      toast.success('Cycle created successfully');
      setShowModal(false);
      setForm(EMPTY_FORM);
      fetchCycles();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create cycle');
    } finally {
      setLoading(false);
    }
  };

  const handlePhaseChange = async (cycle, newPhase) => {
    setPhaseUpdating(cycle.id);
    try {
      await api.put(`/cycles/${cycle.id}`, {
        name: cycle.name,
        window_open: cycle.window_open,
        window_close: cycle.window_close,
        is_active: cycle.is_active,
        phase: newPhase,
      });
      toast.success(`Phase updated to "${PHASES.find(p => p.value === newPhase)?.label}"`);
      fetchCycles();
    } catch (err) {
      toast.error('Failed to update phase');
    } finally {
      setPhaseUpdating(null);
    }
  };

  const handleToggleActive = async (cycle) => {
    if (cycle.is_active) return toast.error('Cannot deactivate an active cycle directly. Create a new active cycle instead.');
    setPhaseUpdating(cycle.id);
    try {
      await api.put(`/cycles/${cycle.id}`, {
        name: cycle.name,
        window_open: cycle.window_open,
        window_close: cycle.window_close,
        is_active: 1,
        phase: cycle.phase,
      });
      toast.success(`"${cycle.name}" is now the active cycle`);
      fetchCycles();
    } catch (err) {
      toast.error('Failed to activate cycle');
    } finally {
      setPhaseUpdating(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Performance Cycles</h1>
          <p>Manage goal setting and review periods. Changing the phase controls what employees and managers can do.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Cycle
        </button>
      </div>

      {/* Phase legend */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '0.75rem' }}>📌 Phase Guide</div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {PHASES.map(p => (
            <div key={p.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
              <strong>{p.label}</strong><span style={{ color: 'var(--text-muted)' }}>— {p.hint}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Cycle Name</th>
              <th>Year</th>
              <th>Window Open</th>
              <th>Window Close</th>
              <th>Status</th>
              <th>Current Phase</th>
              <th>Change Phase</th>
              <th style={{ width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cycles.map(c => {
              const phaseInfo = PHASES.find(p => p.value === c.phase);
              const isUpdating = phaseUpdating === c.id;
              return (
                <tr key={c.id} style={{ opacity: isUpdating ? 0.6 : 1 }}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.year}</td>
                  <td>{c.window_open ? new Date(c.window_open).toLocaleDateString() : '-'}</td>
                  <td>{c.window_close ? new Date(c.window_close).toLocaleDateString() : '-'}</td>
                  <td>
                    <span className={`badge badge-${c.is_active ? 'approved' : 'draft'}`}>
                      {c.is_active ? '● Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: phaseInfo?.color }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: phaseInfo?.color, display: 'inline-block' }} />
                      {phaseInfo?.label || c.phase}
                    </span>
                  </td>
                  <td>
                    <select
                      className="form-control"
                      style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem', width: 'auto', minWidth: 150 }}
                      value={c.phase}
                      disabled={isUpdating}
                      onChange={e => handlePhaseChange(c, e.target.value)}
                    >
                      {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </td>
                  <td>
                    {!c.is_active && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleToggleActive(c)}
                        disabled={isUpdating}
                        title="Set as active cycle"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Zap size={13} /> Set Active
                      </button>
                    )}
                    {isUpdating && <RefreshCw size={16} style={{ animation: 'spin 0.6s linear infinite', color: 'var(--brand-accent)' }} />}
                  </td>
                </tr>
              );
            })}
            {cycles.length === 0 && (
              <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No cycles found. Create one to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">Create New Cycle</div>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSave}>
                <div className="form-group">
                  <label className="form-label required">Cycle Name</label>
                  <input className="form-control" placeholder="e.g. FY 2025-26 Annual Appraisal" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-row cols-2">
                  <div className="form-group">
                    <label className="form-label required">Year</label>
                    <input className="form-control" type="number" value={form.year}
                      onChange={e => setForm({ ...form, year: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Starting Phase</label>
                    <select className="form-control" value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}>
                      {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row cols-2">
                  <div className="form-group">
                    <label className="form-label required">Window Open</label>
                    <input className="form-control" type="date" value={form.window_open}
                      onChange={e => setForm({ ...form, window_open: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Window Close</label>
                    <input className="form-control" type="date" value={form.window_close}
                      onChange={e => setForm({ ...form, window_close: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <input type="checkbox" id="is_active" checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })} style={{ width: 'auto' }} />
                  <label htmlFor="is_active" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                    Set as active cycle <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(deactivates current active cycle)</span>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Cycle'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
