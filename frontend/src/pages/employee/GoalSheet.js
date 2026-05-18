// src/pages/employee/GoalSheet.js
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, Send, Lock, Info, Share2, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const UOM_OPTIONS = [
  { value: 'numeric_min', label: 'Numeric (Higher)', hint: 'Higher = better (e.g. Revenue)' },
  { value: 'numeric_max', label: 'Numeric (Lower)', hint: 'Lower = better (e.g. Cost, TAT)' },
  { value: 'timeline', label: 'Timeline', hint: 'Date-based completion' },
  { value: 'zero', label: 'Zero-based', hint: 'Zero = success (e.g. Incidents)' }
];

const STATUS_COLORS = { draft: '#5A6080', submitted: '#B45309', approved: '#047857', returned: '#B91C1C', locked: '#4F6EF7' };
const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted — Pending Approval', approved: '✓ Approved', returned: 'Returned for Revision', locked: 'Locked' };

const EMPTY_GOAL = () => ({
  _id: Math.random().toString(36).slice(2),
  thrust_area_id: '',
  title: '',
  description: '',
  uom_type: 'numeric_min',
  target_value: '',
  target_date: '',
  weightage: ''
});

export default function GoalSheet() {
  const [sheetData, setSheetData] = useState(null);
  const [cycle, setCycle] = useState(null);
  const [goals, setGoals] = useState([EMPTY_GOAL()]);
  const [thrustAreas, setThrustAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  const locked = sheetData && ['submitted', 'approved', 'locked'].includes(sheetData.status);
  const canEdit = !locked || sheetData?.status === 'returned';

  const totalWeight = goals.reduce((s, g) => s + (Number(g.weightage) || 0), 0);
  const weightValid = Math.abs(totalWeight - 100) < 0.01;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sheetRes, areasRes] = await Promise.all([
        api.get('/goals/sheet'),
        api.get('/goals/thrust-areas')
      ]);
      const { sheet, cycle } = sheetRes.data;
      setCycle(cycle);
      setThrustAreas(areasRes.data);
      if (sheet) {
        setSheetData(sheet);
        if (sheet.goals?.length > 0) {
          setGoals(sheet.goals.map(g => ({
            ...g,
            _id: g.id || Math.random().toString(36).slice(2),
            thrust_area_id: g.thrust_area_id || '',
            target_value: g.target_value ?? '',
            target_date: g.target_date ?? ''
          })));
        }
      }
    } catch (err) {
      toast.error('Failed to load goal sheet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addGoal = () => {
    if (goals.length >= 8) return toast.error('Maximum 8 goals allowed');
    setGoals(g => [...g, EMPTY_GOAL()]);
  };

  const removeGoal = (idx) => {
    if (goals.length === 1) return toast.error('At least one goal required');
    setGoals(g => g.filter((_, i) => i !== idx));
  };

  const updateGoal = (idx, field, value) => {
    setGoals(g => g.map((goal, i) => i === idx ? { ...goal, [field]: value } : goal));
  };

  const validate = () => {
    const errs = [];
    if (goals.length > 8) errs.push('Maximum 8 goals allowed');
    if (!weightValid) errs.push(`Total weightage must be 100% (currently ${totalWeight}%)`);
    goals.forEach((g, i) => {
      if (!g.title?.trim()) errs.push(`Goal ${i + 1}: Title is required`);
      if (!g.uom_type) errs.push(`Goal ${i + 1}: Unit of Measurement required`);
      if (Number(g.weightage) < 10) errs.push(`Goal ${i + 1}: Minimum weightage is 10%`);
      if ((g.uom_type === 'numeric_min' || g.uom_type === 'numeric_max') && !g.target_value) {
        errs.push(`Goal ${i + 1}: Target value required`);
      }
      if (g.uom_type === 'timeline' && !g.target_date) {
        errs.push(`Goal ${i + 1}: Target date required for Timeline goals`);
      }
    });
    return errs;
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const payload = goals.map(g => ({
        ...g,
        thrust_area_id: g.thrust_area_id || null,
        target_value: g.target_value !== '' ? Number(g.target_value) : null,
        target_date: g.target_date || null,
        weightage: Number(g.weightage) || 0
      }));
      const res = await api.post('/goals/save', { goals: payload, cycle_id: cycle?.id });
      setSheetData(res.data.sheet);
      if (res.data.sheet?.goals?.length > 0) {
        setGoals(res.data.sheet.goals.map(g => ({
          ...g,
          _id: g.id || Math.random().toString(36).slice(2),
          thrust_area_id: g.thrust_area_id || '',
          target_value: g.target_value ?? '',
          target_date: g.target_date ?? ''
        })));
      }
      toast.success('Goals saved as draft');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save goals');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      // Save first, then submit
      const payload = goals.map(g => ({
        ...g,
        thrust_area_id: g.thrust_area_id || null,
        target_value: g.target_value !== '' ? Number(g.target_value) : null,
        target_date: g.target_date || null,
        weightage: Number(g.weightage) || 0
      }));
      await api.post('/goals/save', { goals: payload, cycle_id: cycle?.id });
      const res = await api.post('/goals/submit', { cycle_id: cycle?.id });
      setSheetData(res.data.sheet);
      if (res.data.sheet?.goals?.length > 0) {
        setGoals(res.data.sheet.goals.map(g => ({
          ...g,
          _id: g.id || Math.random().toString(36).slice(2),
          thrust_area_id: g.thrust_area_id || '',
          target_value: g.target_value ?? '',
          target_date: g.target_date ?? ''
        })));
      }
      toast.success('Goals submitted for manager approval!');
      setErrors([]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit goals');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>My Goal Sheet</h1>
          <p>{cycle?.name || 'Current Cycle'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {sheetData && (
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: STATUS_COLORS[sheetData.status], background: 'var(--surface-2)', padding: '0.3rem 0.75rem', borderRadius: '999px' }}>
              {STATUS_LABELS[sheetData.status]}
            </span>
          )}
          {canEdit && (
            <>
              <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>
                <Save size={15} />{saving ? 'Saving...' : 'Save Draft'}
              </button>
              {sheetData?.status !== 'submitted' && (
                <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                  <Send size={15} />{submitting ? 'Submitting...' : 'Submit for Approval'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Return reason */}
      {sheetData?.status === 'returned' && sheetData.return_reason && (
        <div className="alert alert-warning">
          <AlertCircle size={16} />
          <div><strong>Manager feedback:</strong> {sheetData.return_reason}<br/>
          <span style={{ fontSize: '0.78rem' }}>Please revise and resubmit.</span></div>
        </div>
      )}

      {/* Locked notice */}
      {locked && sheetData?.status !== 'returned' && (
        <div className="alert alert-info">
          <Lock size={16} />
          <div>
            {sheetData.status === 'submitted'
              ? 'Your goals are under review. Editing is disabled until your manager responds.'
              : 'Your goals are approved and locked. Contact Admin to make changes.'}
          </div>
        </div>
      )}

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="alert alert-danger" style={{ flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 600 }}>
            <AlertCircle size={16} /> Please fix the following errors:
          </div>
          <ul style={{ paddingLeft: '1.5rem', fontSize: '0.82rem' }}>
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Weightage meter */}
      <div className={`weightage-meter ${weightValid ? 'valid' : totalWeight > 0 ? 'invalid' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {weightValid ? <CheckCircle size={15} color="var(--brand-success)" /> : <Info size={15} color="var(--brand-warning)" />}
            Total Weightage
          </span>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: weightValid ? 'var(--brand-success)' : totalWeight > 100 ? 'var(--brand-danger)' : 'var(--brand-warning)' }}>
            {totalWeight.toFixed(1)}% / 100%
          </span>
        </div>
        <div className="progress-bar" style={{ height: 8 }}>
          <div className={`progress-fill ${totalWeight > 100 ? 'danger' : weightValid ? 'success' : 'warning'}`}
            style={{ width: `${Math.min(totalWeight, 100)}%` }} />
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
          {goals.length}/8 goals · Min 10% per goal · Total must equal 100%
        </div>
      </div>

      {/* Goals */}
      {goals.map((goal, idx) => (
        <div key={goal._id || idx} className={`goal-card${goal.is_shared ? ' shared' : ''}`}>
          <div className="goal-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="goal-number">{idx + 1}</div>
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{goal.title || `Goal ${idx + 1}`}</span>
                {goal.is_shared === 1 && (
                  <span className="chip" style={{ marginLeft: '0.5rem' }}>
                    <Share2 size={10} /> Shared — Title & Target locked
                  </span>
                )}
              </div>
            </div>
            {canEdit && !goal.is_readonly_title && goals.length > 1 && (
              <button className="btn-icon" onClick={() => removeGoal(idx)} title="Remove goal">
                <Trash2 size={16} style={{ color: 'var(--brand-danger)' }} />
              </button>
            )}
          </div>

          <div className="form-row cols-2">
            <div className="form-group">
              <label className="form-label required">Thrust Area</label>
              <select className="form-control" value={goal.thrust_area_id || ''} disabled={!canEdit}
                onChange={e => updateGoal(idx, 'thrust_area_id', e.target.value)}>
                <option value="">Select thrust area…</option>
                {thrustAreas.map(ta => <option key={ta.id} value={ta.id}>{ta.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Goal Title</label>
              <input className="form-control" placeholder="e.g. Achieve ₹50L Sales Revenue"
                value={goal.title} disabled={!canEdit || goal.is_readonly_title === 1}
                onChange={e => updateGoal(idx, 'title', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" placeholder="Describe how this goal will be measured and achieved…"
              value={goal.description || ''} disabled={!canEdit}
              onChange={e => updateGoal(idx, 'description', e.target.value)} rows={2} />
          </div>

          <div className="form-row cols-4">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label required">Unit of Measurement (UoM)</label>
              <div className="uom-grid">
                {UOM_OPTIONS.map(opt => (
                  <div key={opt.value}
                    className={`uom-option${goal.uom_type === opt.value ? ' selected' : ''}${(!canEdit || goal.is_readonly_target === 1) ? '' : ''}`}
                    onClick={() => canEdit && goal.is_readonly_target !== 1 && updateGoal(idx, 'uom_type', opt.value)}
                    style={{ cursor: canEdit && goal.is_readonly_target !== 1 ? 'pointer' : 'default' }}>
                    <span className="uom-option-label">{opt.label}</span>
                    <span className="uom-option-hint">{opt.hint}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              {goal.uom_type === 'timeline' ? (
                <>
                  <label className="form-label required">Target Date</label>
                  <input className="form-control" type="date" value={goal.target_date || ''}
                    disabled={!canEdit || goal.is_readonly_target === 1}
                    onChange={e => updateGoal(idx, 'target_date', e.target.value)} />
                </>
              ) : goal.uom_type === 'zero' ? (
                <>
                  <label className="form-label">Target</label>
                  <input className="form-control" value="0 (Zero)" disabled />
                </>
              ) : (
                <>
                  <label className="form-label required">Target Value</label>
                  <input className="form-control" type="number" placeholder="e.g. 5000000"
                    value={goal.target_value || ''}
                    disabled={!canEdit || goal.is_readonly_target === 1}
                    onChange={e => updateGoal(idx, 'target_value', e.target.value)} />
                </>
              )}
            </div>

            <div className="form-group">
              <label className="form-label required">Weightage (%)</label>
              <input className="form-control" type="number" min="10" max="100" placeholder="10–100"
                value={goal.weightage}
                disabled={!canEdit}
                onChange={e => updateGoal(idx, 'weightage', e.target.value)} />
              <div className="form-hint">Min 10%</div>
            </div>
          </div>
        </div>
      ))}

      {/* Add goal button */}
      {canEdit && goals.length < 8 && (
        <button className="btn btn-secondary" onClick={addGoal} style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed' }}>
          <Plus size={16} /> Add Goal ({goals.length}/8)
        </button>
      )}

      {/* Bottom actions */}
      {canEdit && (
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <button className="btn btn-secondary btn-lg" onClick={handleSave} disabled={saving}>
            <Save size={16} />{saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={submitting || !weightValid}>
            <Send size={16} />{submitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
          {!weightValid && (
            <span style={{ fontSize: '0.8rem', color: 'var(--brand-warning)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Info size={14} /> Weightage must total 100% to submit
            </span>
          )}
        </div>
      )}

      {/* Scoring Guide */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>📊 Progress Score Formula Guide</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>UoM Type</th><th>Best For</th><th>Formula</th></tr>
            </thead>
            <tbody>
              <tr><td>Numeric (Higher)</td><td>Sales Revenue, Units Sold</td><td>Achievement ÷ Target</td></tr>
              <tr><td>Numeric (Lower)</td><td>TAT, Cost, Defects</td><td>Target ÷ Achievement</td></tr>
              <tr><td>Timeline</td><td>Project delivery dates</td><td>On time = 100%, penalized by days late</td></tr>
              <tr><td>Zero-based</td><td>Safety incidents, Errors</td><td>If 0 → 100%, else 0%</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
