// src/pages/admin/Users.js
import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', department: '', manager_id: '' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    api.get('/users').then(res => setUsers(res.data)).catch(() => {});
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.role) {
      return toast.error('Name, email, password, and role are required');
    }
    setLoading(true);
    try {
      const payload = { ...form, manager_id: form.manager_id || null };
      await api.post('/users', payload);
      toast.success('User created successfully');
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setForm({ name: '', email: '', password: '', role: 'employee', department: '', manager_id: '' });
    setShowModal(true);
  };

  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="page-header-text">
          <h1>User Management</h1>
          <p>Organization hierarchy and roles.</p>
        </div>
        <button className="btn btn-primary" onClick={openModal}>
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Manager</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td>
                <td><span className={`badge badge-${u.role === 'admin' ? 'purple' : u.role === 'manager' ? 'blue' : 'gray'}`}>{u.role}</span></td>
                <td>{u.department || '-'}</td>
                <td>{u.manager_name || '-'}</td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan="5" className="text-center text-muted py-4">No users found</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>Add New User</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSave}>
                <div className="form-group">
                  <label className="form-label required">Full Name</label>
                  <input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label required">Email</label>
                  <input className="form-control" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label required">Password</label>
                  <input className="form-control" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label required">Role</label>
                  <select className="form-control" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input className="form-control" value={form.department} onChange={e => setForm({...form, department: e.target.value})} />
                </div>
                {form.role === 'employee' && (
                  <div className="form-group">
                    <label className="form-label">Assign Manager</label>
                    <select className="form-control" value={form.manager_id} onChange={e => setForm({...form, manager_id: e.target.value})}>
                      <option value="">-- No Manager --</option>
                      {managers.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.department || 'N/A'})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save User'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
