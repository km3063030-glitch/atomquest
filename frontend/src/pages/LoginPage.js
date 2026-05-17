// src/pages/LoginPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Target } from 'lucide-react';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // If already logged in
  if (user) {
    const path = user.role === 'admin' ? '/admin' : user.role === 'manager' ? '/manager' : '/employee';
    navigate(path, { replace: true });
    return null;
  }

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Enter email and password');
    setLoading(true);
    try {
      const u = await login(form.email, form.password);
      toast.success(`Welcome back, ${u.name}!`);
      const path = u.role === 'admin' ? '/admin' : u.role === 'manager' ? '/manager' : '/employee';
      navigate(path, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (email) => {
    setForm({ email, password: 'Password@123' });
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'linear-gradient(135deg, #1A1F3C, #4F6EF7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={22} color="white" />
          </div>
          <div className="login-logo">AtomQuest</div>
        </div>
        <div className="login-tagline">Goal Setting & Tracking Portal</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label required">Email Address</label>
            <input
              className="form-control"
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label required">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-control"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="current-password"
                style={{ paddingRight: '2.5rem' }}
              />
              <button type="button" className="btn-icon" onClick={() => setShowPass(s => !s)}
                style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="divider" />

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Quick Login (Demo)
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Admin', email: 'admin@atomquest.com' },
            { label: 'Manager', email: 'manager@atomquest.com' },
            { label: 'Employee', email: 'employee@atomquest.com' }
          ].map(r => (
            <button key={r.email} className="btn btn-secondary btn-sm" onClick={() => quickLogin(r.email)}>
              {r.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          All demo accounts use: <code style={{ background: '#f1f4fb', padding: '1px 5px', borderRadius: 4 }}>Password@123</code>
        </div>
      </div>
    </div>
  );
}
