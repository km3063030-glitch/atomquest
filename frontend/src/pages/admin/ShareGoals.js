// src/pages/admin/ShareGoals.js
import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Share2 } from 'lucide-react';

export default function ShareGoals() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [form, setForm] = useState({ title: '', description: '', uom_type: 'numeric_min', target_value: '' });

  useEffect(() => {
    api.get('/users', { params: { role: 'employee' } }).then(res => setUsers(res.data)).catch(() => {});
  }, []);

  const handleShare = async () => {
    if(!selectedUser || !form.title) return toast.error('Required fields missing');
    try {
      await api.post('/goals/share', { target_user_id: selectedUser, goal: form });
      toast.success('Goal shared successfully!');
      setForm({ ...form, title: '' });
    } catch (err) {
      toast.error('Failed to share goal');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Share Goals</h1>
          <p>Push departmental KPIs to employee goal sheets.</p>
        </div>
      </div>
      <div className="card">
        <div className="form-row cols-2">
          <div className="form-group">
            <label className="form-label">Target Employee</label>
            <select className="form-control" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
              <option value="">Select...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Goal Title</label>
            <input className="form-control" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">UoM Type</label>
            <select className="form-control" value={form.uom_type} onChange={e => setForm({...form, uom_type: e.target.value})}>
              <option value="numeric_min">Numeric (Higher)</option>
              <option value="numeric_max">Numeric (Lower)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Target Value</label>
            <input className="form-control" type="number" value={form.target_value} onChange={e => setForm({...form, target_value: e.target.value})} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleShare} style={{ marginTop: '1rem' }}><Share2 size={16}/> Push Shared Goal</button>
      </div>
    </div>
  );
}
