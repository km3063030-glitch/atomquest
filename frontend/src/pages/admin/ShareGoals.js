// src/pages/admin/ShareGoals.js
import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Share2, Users, Lock, CheckCircle } from 'lucide-react';

const UOM_OPTIONS = [
  { value: 'numeric_min', label: 'Numeric (Higher = Better)', hint: 'e.g. Revenue, Units Sold' },
  { value: 'numeric_max', label: 'Numeric (Lower = Better)', hint: 'e.g. Costs, TAT, Defects' },
  { value: 'timeline', label: 'Timeline (Date-based)', hint: 'Project delivery deadlines' },
  { value: 'zero', label: 'Zero-based', hint: 'e.g. Safety incidents (0 = 100%)' },
];

export default function ShareGoals() {
  const [employees, setEmployees] = useState([]);
  const [thrustAreas, setThrustAreas] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    uom_type: 'numeric_min',
    target_value: '',
    target_date: '',
    thrust_area_id: '',
    default_weightage: 10,
  });

  useEffect(() => {
    api.get('/users', { params: { role: 'employee' } }).then(res => setEmployees(res.data)).catch(() => {});
    api.get('/goals/thrust-areas').then(res => setThrustAreas(res.data)).catch(() => {});
  }, []);

  const toggleEmployee = (id) => {
    setSelectedEmployees(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedEmployees(employees.map(e => e.id));
  const clearAll = () => setSelectedEmployees([]);

  const handleShare = async () => {
    if (!form.title.trim()) return toast.error('Goal title is required');
    if (selectedEmployees.length === 0) return toast.error('Select at least one employee');
    if ((form.uom_type === 'numeric_min' || form.uom_type === 'numeric_max') && !form.target_value) {
      return toast.error('Target value is required for this UoM type');
    }
    if (form.uom_type === 'timeline' && !form.target_date) {
      return toast.error('Target date is required for Timeline UoM');
    }
    if (Number(form.default_weightage) < 10) return toast.error('Minimum weightage is 10%');

    setLoading(true);
    try {
      await api.post('/goals/share', {
        title: form.title,
        description: form.description || null,
        thrust_area_id: form.thrust_area_id || null,
        uom_type: form.uom_type,
        target_value: form.target_value ? Number(form.target_value) : null,
        target_date: form.target_date || null,
        default_weightage: Number(form.default_weightage),
        employee_ids: selectedEmployees,
      });
      toast.success(`Goal shared to ${selectedEmployees.length} employee(s)!`);
      setForm({ title: '', description: '', uom_type: 'numeric_min', target_value: '', target_date: '', thrust_area_id: '', default_weightage: 10 });
      setSelectedEmployees([]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to share goal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Share Goals</h1>
          <p>Push KPIs and departmental goals to multiple employee goal sheets at once. The title and target will be locked for the recipients.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: Goal Form */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1.25rem' }}>
            <Share2 size={16} style={{ display: 'inline', marginRight: '0.4rem' }} />
            Goal Details
          </div>

          <div className="form-group">
            <label className="form-label required">Goal Title</label>
            <input className="form-control" placeholder="e.g. Achieve Zero Safety Incidents"
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <div className="form-hint">
              <Lock size={11} style={{ display: 'inline', marginRight: '0.25rem' }} />
              This title will be locked for recipients and cannot be changed.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows={2} placeholder="Optional details or measurement criteria..."
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="form-row cols-2">
            <div className="form-group">
              <label className="form-label">Thrust Area</label>
              <select className="form-control" value={form.thrust_area_id} onChange={e => setForm({ ...form, thrust_area_id: e.target.value })}>
                <option value="">-- None --</option>
                {thrustAreas.map(ta => <option key={ta.id} value={ta.id}>{ta.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Default Weightage (%)</label>
              <input className="form-control" type="number" min="10" max="100" value={form.default_weightage}
                onChange={e => setForm({ ...form, default_weightage: e.target.value })} />
              <div className="form-hint">Minimum 10%. Employee can adjust later.</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required">Unit of Measurement (UoM)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
              {UOM_OPTIONS.map(opt => (
                <div key={opt.value}
                  className={`uom-option${form.uom_type === opt.value ? ' selected' : ''}`}
                  style={{ textAlign: 'left' }}
                  onClick={() => setForm({ ...form, uom_type: opt.value, target_value: '', target_date: '' })}>
                  <span className="uom-option-label">{opt.label}</span>
                  <span className="uom-option-hint">{opt.hint}</span>
                </div>
              ))}
            </div>
          </div>

          {(form.uom_type === 'numeric_min' || form.uom_type === 'numeric_max') && (
            <div className="form-group">
              <label className="form-label required">Target Value</label>
              <input className="form-control" type="number" placeholder="e.g. 5000000"
                value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })} />
              <div className="form-hint"><Lock size={11} style={{ display: 'inline', marginRight: '0.25rem' }} />Target will be locked for recipients.</div>
            </div>
          )}
          {form.uom_type === 'timeline' && (
            <div className="form-group">
              <label className="form-label required">Target Date</label>
              <input className="form-control" type="date"
                value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} />
            </div>
          )}
          {form.uom_type === 'zero' && (
            <div className="alert alert-info" style={{ marginTop: '0.5rem' }}>
              Zero-based goals expect the actual value to be 0 (e.g., zero incidents). Target is automatically set to 0.
            </div>
          )}

          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn btn-primary btn-lg" onClick={handleShare} disabled={loading || selectedEmployees.length === 0}>
              <Share2 size={16} /> {loading ? 'Pushing Goal...' : `Push to ${selectedEmployees.length} Employee${selectedEmployees.length !== 1 ? 's' : ''}`}
            </button>
            {selectedEmployees.length === 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>← Select employees on the right</span>
            )}
          </div>
        </div>

        {/* Right: Employee Picker */}
        <div className="card" style={{ position: 'sticky', top: '4.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="card-title">
              <Users size={15} style={{ display: 'inline', marginRight: '0.4rem' }} />
              Recipients ({selectedEmployees.length}/{employees.length})
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={selectAll}>All</button>
              <button className="btn btn-secondary btn-sm" onClick={clearAll}>None</button>
            </div>
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {employees.map(emp => {
              const selected = selectedEmployees.includes(emp.id);
              return (
                <div key={emp.id}
                  onClick={() => toggleEmployee(emp.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.65rem',
                    padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${selected ? 'var(--brand-accent)' : 'var(--border-color)'}`,
                    background: selected ? 'rgba(79,110,247,0.06)' : 'var(--surface-1)',
                    cursor: 'pointer', transition: 'all var(--transition)',
                  }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: selected ? 'var(--brand-accent)' : 'var(--surface-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    color: selected ? 'white' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700,
                  }}>
                    {selected ? <CheckCircle size={14} /> : emp.name[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: selected ? 'var(--brand-accent)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{emp.department || 'No Dept'}</div>
                  </div>
                </div>
              );
            })}
            {employees.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.85rem' }}>No employees found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
