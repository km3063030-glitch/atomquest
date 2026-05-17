// src/pages/employee/Achievements.js
import React, { useState, useEffect, useCallback } from 'react';
import { Save, AlertCircle, Clock, Calendar, MessageSquare, TrendingUp } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started', color: 'var(--text-secondary)' },
  { value: 'on_track', label: 'On Track', color: '#047857' },
  { value: 'completed', label: 'Completed', color: 'var(--brand-accent)' }
];

export default function Achievements() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [achievements, setAchievements] = useState({});
  const [selectedQuarter, setSelectedQuarter] = useState('q1');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sheetRes, achRes] = await Promise.all([
        api.get('/goals/sheet'),
        api.get('/achievements', { params: { quarter: selectedQuarter } })
      ]);
      const { sheet, cycle } = sheetRes.data;
      
      setData({ sheet, cycle });

      // Initialize state for achievements
      const initialAch = {};
      if (sheet && sheet.goals) {
        sheet.goals.forEach(g => {
          const existing = achRes.data.find(a => a.goal_id === g.id);
          initialAch[g.id] = existing ? {
            status: existing.status || 'not_started',
            actual_value: existing.actual_value ?? '',
            actual_date: existing.actual_date ?? '',
            employee_notes: existing.employee_notes || '',
            progress_score: existing.progress_score
          } : {
            status: 'not_started',
            actual_value: '',
            actual_date: '',
            employee_notes: '',
            progress_score: null
          };
        });
      }
      setAchievements(initialAch);

    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedQuarter]);

  useEffect(() => { load(); }, [load]);

  const updateAch = (goalId, field, value) => {
    setAchievements(prev => ({
      ...prev,
      [goalId]: { ...prev[goalId], [field]: value }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Filter out empty achievements, only send updates
      const payload = Object.entries(achievements).map(([goal_id, ach]) => ({
        goal_id: Number(goal_id),
        quarter: selectedQuarter,
        status: ach.status,
        actual_value: ach.actual_value !== '' ? Number(ach.actual_value) : null,
        actual_date: ach.actual_date || null,
        employee_notes: ach.employee_notes
      }));

      await api.post('/achievements/sync', { achievements: payload, cycle_id: data.cycle?.id });
      toast.success('Achievements saved successfully');
      load(); // Reload to get computed scores
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save achievements');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const { sheet, cycle } = data;

  if (!sheet || !['approved', 'locked'].includes(sheet.status)) {
    return (
      <div className="empty-state" style={{ padding: '4rem 2rem' }}>
        <AlertCircle size={40} style={{ color: 'var(--brand-warning)' }} />
        <h3>Goal Sheet Not Approved</h3>
        <p>You can only log achievements once your manager has approved your goals.</p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Status: {sheet ? sheet.status.toUpperCase() : 'NO SHEET'}</p>
      </div>
    );
  }

  const isWindowOpen = cycle?.window_open && new Date() >= new Date(cycle.window_open);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Log Achievements</h1>
          <p>Update your progress against planned targets.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select 
            className="form-control" 
            value={selectedQuarter} 
            onChange={e => setSelectedQuarter(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="q1">Q1 Check-in</option>
            <option value="q2">Q2 Check-in</option>
            <option value="q3">Q3 Check-in</option>
            <option value="q4_annual">Annual / Q4</option>
          </select>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !isWindowOpen}>
            <Save size={15} /> {saving ? 'Saving...' : 'Save Updates'}
          </button>
        </div>
      </div>

      {!isWindowOpen && (
        <div className="alert alert-warning">
          <Clock size={16} />
          <div><strong>Window Closed:</strong> The check-in window for the current cycle is currently closed. You can view your past data but cannot make edits.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {sheet.goals.map((goal, idx) => {
          const ach = achievements[goal.id] || {};
          const isNumeric = goal.uom_type.startsWith('numeric');
          const isTimeline = goal.uom_type === 'timeline';
          
          return (
            <div key={goal.id} className="card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span className="goal-number" style={{ width: 22, height: 22, fontSize: '0.7rem' }}>{idx + 1}</span>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{goal.title}</h3>
                    {ach.progress_score !== null && ach.progress_score !== undefined && (
                      <span className={`badge badge-${ach.progress_score >= 1 ? 'approved' : ach.progress_score >= 0.7 ? 'submitted' : 'returned'}`}>
                        Score: {(ach.progress_score * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <strong>Target:</strong> {goal.target_value ?? goal.target_date ?? 'Zero'} 
                    <span style={{ margin: '0 0.5rem', color: 'var(--border-color)' }}>|</span> 
                    <strong>UoM:</strong> {goal.uom_type.replace('_', ' ')}
                    <span style={{ margin: '0 0.5rem', color: 'var(--border-color)' }}>|</span> 
                    <strong>Weightage:</strong> {goal.weightage}%
                  </div>
                </div>
                
                <div style={{ width: '200px' }}>
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>Progress Status</label>
                  <select 
                    className="form-control" 
                    value={ach.status || 'not_started'} 
                    onChange={e => updateAch(goal.id, 'status', e.target.value)}
                    disabled={!isWindowOpen}
                    style={{ fontWeight: 600, color: STATUS_OPTIONS.find(o => o.value === ach.status)?.color }}
                  >
                    {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-row cols-2">
                <div className="form-group">
                  <label className="form-label">
                    <TrendingUp size={14} style={{ display: 'inline', marginRight: '0.25rem' }}/> 
                    Actual Achievement
                  </label>
                  {isNumeric && (
                    <input 
                      type="number" 
                      className="form-control" 
                      placeholder="Enter actual value achieved..."
                      value={ach.actual_value}
                      onChange={e => updateAch(goal.id, 'actual_value', e.target.value)}
                      disabled={!isWindowOpen}
                    />
                  )}
                  {isTimeline && (
                    <input 
                      type="date" 
                      className="form-control" 
                      value={ach.actual_date}
                      onChange={e => updateAch(goal.id, 'actual_date', e.target.value)}
                      disabled={!isWindowOpen}
                    />
                  )}
                  {goal.uom_type === 'zero' && (
                    <input 
                      type="number" 
                      className="form-control" 
                      placeholder="Number of incidents/errors (Target is 0)"
                      value={ach.actual_value}
                      onChange={e => updateAch(goal.id, 'actual_value', e.target.value)}
                      disabled={!isWindowOpen}
                    />
                  )}
                  <div className="form-hint">Provide the raw value for the system to compute your score.</div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <MessageSquare size={14} style={{ display: 'inline', marginRight: '0.25rem' }}/> 
                    Self-Evaluation Notes
                  </label>
                  <textarea 
                    className="form-control" 
                    rows="3" 
                    placeholder="Briefly describe your progress, challenges, or support needed..."
                    value={ach.employee_notes}
                    onChange={e => updateAch(goal.id, 'employee_notes', e.target.value)}
                    disabled={!isWindowOpen}
                  />
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
