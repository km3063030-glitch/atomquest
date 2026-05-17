// src/pages/manager/ReviewSheet.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function ReviewSheet() {
  const { sheetId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null); // 'approve' | 'return'
  const [returnReason, setReturnReason] = useState('');
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    api.get(`/goals/sheet/${sheetId}`)
      .then(res => {
        setData(res.data);
        setGoals(res.data.goals || []);
      })
      .catch(() => toast.error('Failed to load sheet'))
      .finally(() => setLoading(false));
  }, [sheetId]);

  const updateGoal = (idx, field, value) => {
    setGoals(g => g.map((goal, i) => i === idx ? { ...goal, [field]: value } : goal));
  };

  const handleAction = async () => {
    if (action === 'return' && !returnReason.trim()) {
      return toast.error('Please provide a reason for return');
    }

    try {
      if (action === 'approve') {
        const payload = goals.map(g => ({
          ...g,
          target_value: g.target_value !== '' ? Number(g.target_value) : null,
          weightage: Number(g.weightage) || 0
        }));
        await api.post('/goals/approve', { 
          sheet_id: sheetId, 
          action: 'approve', 
          edited_goals: payload 
        });
        toast.success('Goal sheet approved and locked!');
      } else {
        await api.post('/goals/approve', { 
          sheet_id: sheetId, 
          action: 'return', 
          return_reason: returnReason 
        });
        toast.success('Goal sheet returned for rework.');
      }
      navigate('/manager');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!data) return <div>Sheet not found</div>;

  const totalWeight = goals.reduce((s, g) => s + (Number(g.weightage) || 0), 0);
  const weightValid = Math.abs(totalWeight - 100) < 0.01;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <button className="btn-icon" onClick={() => navigate('/manager')} style={{ marginBottom: '0.5rem' }}>
            <ArrowLeft size={16} /> Back
          </button>
          <h1>Review Goals: {data.employee_name}</h1>
          <p>Submitted on: {new Date(data.submitted_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className={`weightage-meter ${weightValid ? 'valid' : 'invalid'}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total Weightage</span>
          <span style={{ fontSize: '1rem', fontWeight: 700 }}>{totalWeight}%</span>
        </div>
        <div className="progress-bar" style={{ height: 8 }}>
          <div className={`progress-fill ${totalWeight > 100 ? 'danger' : weightValid ? 'success' : 'warning'}`}
            style={{ width: `${Math.min(totalWeight, 100)}%` }} />
        </div>
      </div>

      {goals.map((goal, idx) => (
        <div key={goal.id} className="goal-card">
          <div className="goal-card-header">
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div className="goal-number">{idx + 1}</div>
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{goal.title}</span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{goal.description}</div>
              </div>
            </div>
          </div>
          
          <div className="form-row cols-3">
            <div className="form-group">
              <label className="form-label">UoM Type</label>
              <input className="form-control" value={goal.uom_type.replace('_', ' ')} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Target</label>
              {goal.uom_type === 'timeline' ? (
                <input className="form-control" type="date" value={goal.target_date || ''} onChange={e => updateGoal(idx, 'target_date', e.target.value)} disabled={data.status !== 'submitted'} />
              ) : goal.uom_type === 'zero' ? (
                <input className="form-control" value="0" disabled />
              ) : (
                <input className="form-control" type="number" value={goal.target_value || ''} onChange={e => updateGoal(idx, 'target_value', e.target.value)} disabled={data.status !== 'submitted'} />
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Weightage (%)</label>
              <input className="form-control" type="number" value={goal.weightage} onChange={e => updateGoal(idx, 'weightage', e.target.value)} disabled={data.status !== 'submitted'} />
            </div>
          </div>
        </div>
      ))}

      {data.status === 'submitted' && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-title">Manager Decision</div>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className={`btn btn-lg ${action === 'approve' ? 'btn-success' : 'btn-secondary'}`} onClick={() => setAction('approve')}>
              <CheckCircle size={18} /> Approve & Lock Goals
            </button>
            <button className={`btn btn-lg ${action === 'return' ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setAction('return')}>
              <XCircle size={18} /> Return for Rework
            </button>
          </div>

          {action === 'return' && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label required">Feedback / Reason for Return</label>
              <textarea className="form-control" rows="3" value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="Please explain what needs to be changed..." />
            </div>
          )}

          {action && (
            <div style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-primary btn-lg" onClick={handleAction} disabled={action === 'approve' && !weightValid}>
                Confirm Action
              </button>
              {action === 'approve' && !weightValid && (
                <span style={{ fontSize: '0.8rem', color: 'var(--brand-warning)', marginLeft: '1rem' }}>
                  Total weightage must be 100% to approve.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
