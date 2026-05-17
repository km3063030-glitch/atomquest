// src/pages/manager/Checkins.js
import React, { useState, useEffect } from 'react';
import { CheckSquare, Save } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function ManagerCheckins() {
  const [sheets, setSheets] = useState([]);
  const [selectedSheetId, setSelectedSheetId] = useState('');
  const [quarter, setQuarter] = useState('q1');
  const [achievements, setAchievements] = useState([]);
  const [checkinComment, setCheckinComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/goals/team-sheets')
      .then(res => {
        const approvedSheets = res.data.filter(s => ['approved', 'locked'].includes(s.status));
        setSheets(approvedSheets);
        if (approvedSheets.length > 0) setSelectedSheetId(approvedSheets[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSheetId) return;
    setLoading(true);
    Promise.all([
      api.get('/achievements', { params: { sheet_id: selectedSheetId, quarter } }),
      api.get('/checkins', { params: { sheet_id: selectedSheetId, quarter } })
    ]).then(([achRes, checkinRes]) => {
      setAchievements(achRes.data);
      const checkin = checkinRes.data.find(c => c.sheet_id == selectedSheetId && c.quarter === quarter);
      setCheckinComment(checkin ? checkin.manager_comment : '');
    }).finally(() => setLoading(false));
  }, [selectedSheetId, quarter]);

  const handleSaveCheckin = async () => {
    if (!checkinComment.trim()) return toast.error('Check-in comment is required');
    try {
      await api.post('/checkins', { sheet_id: selectedSheetId, quarter, comment: checkinComment });
      toast.success('Check-in saved successfully');
    } catch (err) {
      toast.error('Failed to save check-in');
    }
  };

  if (loading && sheets.length === 0) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Quarterly Check-ins</h1>
          <p>Review progress and log feedback for your team.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">Select Employee</label>
            <select className="form-control" value={selectedSheetId} onChange={e => setSelectedSheetId(e.target.value)}>
              {sheets.map(s => <option key={s.id} value={s.id}>{s.employee_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Select Quarter</label>
            <select className="form-control" value={quarter} onChange={e => setQuarter(e.target.value)}>
              <option value="q1">Q1</option>
              <option value="q2">Q2</option>
              <option value="q3">Q3</option>
              <option value="q4_annual">Q4 / Annual</option>
            </select>
          </div>
        </div>
      </div>

      {selectedSheetId && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Employee Progress</div>
          {achievements.length === 0 ? (
            <div className="empty-state">
              <CheckSquare size={30} />
              <p>No achievements logged for this quarter yet.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Goal</th>
                    <th>Target</th>
                    <th>Actual</th>
                    <th>Status</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {achievements.map(a => (
                    <tr key={a.id}>
                      <td>{a.goal_title}</td>
                      <td>{a.target_value ?? a.target_date ?? '0'}</td>
                      <td>{a.actual_value ?? a.actual_date ?? '—'}</td>
                      <td><span className={`badge badge-${a.status}`}>{a.status.replace('_', ' ')}</span></td>
                      <td>{a.progress_score !== null ? `${(a.progress_score * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="divider" />
          
          <div className="form-group">
            <label className="form-label required">Manager Check-in Comment</label>
            <textarea 
              className="form-control" 
              rows="4" 
              value={checkinComment} 
              onChange={e => setCheckinComment(e.target.value)}
              placeholder="Document the discussion, feedback, and next steps..."
            />
          </div>
          <button className="btn btn-primary" onClick={handleSaveCheckin}>
            <Save size={15} /> Save Check-in
          </button>
        </div>
      )}
    </div>
  );
}
