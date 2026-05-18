// src/pages/admin/Users.js
import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, X, Edit2 } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ id: null, name: '', email: '', password: '', role: 'employee', department: '', manager_id: '', is_active: 1 });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    api.get('/users').then(res => setUsers(res.data)).catch(() => {});
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || (!isEdit && !form.email) || (!isEdit && !form.password) || !form.role) {
      return toast.error('Please fill all required fields');
    }
    setLoading(true);
    try {
      const payload = { ...form, manager_id: form.manager_id || null, is_active: Number(form.is_active) };
      
      if (isEdit) {
        await api.put(`/users/${form.id}`, payload);
        toast.success('User updated successfully');
      } else {
        await api.post('/users', payload);
        toast.success('User created successfully');
      }
      
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || (isEdit ? 'Failed to update user' : 'Failed to create user'));
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setForm({ id: null, name: '', email: '', password: '', role: 'employee', department: '', manager_id: '', is_active: 1 });
    setIsEdit(false);
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setForm({
      id: user.id,
      name: user.name,
      email: user.email,
      password: '', // blank password when editing
      role: user.role,
      department: user.department || '',
      manager_id: user.manager_id || '',
      is_active: user.is_active
    });
    setIsEdit(true);
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
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Department</th><th>Manager</th><th style={{ width: 80 }}>Actions</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.6 }}>
                <td>{u.name}</td><td>{u.email}</td>
                <td><span className={`badge badge-${u.role === 'admin' ? 'purple' : u.role === 'manager' ? 'blue' : 'gray'}`}>{u.role}</span></td>
                <td><span className={`badge badge-${u.is_active ? 'on_track' : 'draft'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>{u.department || '-'}</td>
                <td>{u.manager_name || '-'}</td>
                <td>
                  <button className="btn-icon" onClick={() => openEditModal(u)} title="Edit User">
                    <Edit2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan="7" className="text-center text-muted py-4">No users found</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div className="modal-title">{isEdit ? 'Edit User' : 'Add New User'}</div>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSave}>
                <div className="form-group">
                  <label className="form-label required">Full Name</label>
                  <input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                
                {!isEdit && (
                  <>
                    <div className="form-group">
                      <label className="form-label required">Email</label>
                      <input className="form-control" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label required">Password</label>
                      <input className="form-control" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
                    </div>
                  </>
                )}

                <div className="form-row cols-2">
                  <div className="form-group">
                    <label className="form-label required">Role</label>
                    <select className="form-control" value={form.role} onChange={e => setForm({...form, role: e.target.value})} disabled={isEdit && form.role === 'admin'}>
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      {/* Do not allow creating new admins */}
                      {isEdit && form.role === 'admin' && <option value="admin">Admin</option>}
                    </select>
                  </div>
                  {isEdit && (
                    <div className="form-group">
                      <label className="form-label required">Status</label>
                      <select className="form-control" value={form.is_active} onChange={e => setForm({...form, is_active: e.target.value})} disabled={form.role === 'admin'}>
                        <option value={1}>Active</option>
                        <option value={0}>Inactive</option>
                      </select>
                    </div>
                  )}
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
                      {managers.filter(m => m.id !== form.id).map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.department || 'N/A'})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : (isEdit ? 'Update User' : 'Save User')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
