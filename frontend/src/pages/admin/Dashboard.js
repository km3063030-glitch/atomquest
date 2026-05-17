// src/pages/admin/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Users, FileText, BarChart3, AlertTriangle } from 'lucide-react';
import api from '../../utils/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, activeCycle: null, escalations: 0 });

  useEffect(() => {
    Promise.all([
      api.get('/users'),
      api.get('/cycles/active')
    ]).then(([usersRes, cyclesRes]) => {
      setStats({
        users: usersRes.data.length,
        activeCycle: cyclesRes.data,
        escalations: 0 // Mocked for dashboard
      });
    }).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Admin Dashboard</h1>
          <p>System overview and governance.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Users size={20} /></div>
          <div><div className="stat-label">Total Users</div><div className="stat-value">{stats.users}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><FileText size={20} /></div>
          <div><div className="stat-label">Active Cycle</div><div className="stat-value">{stats.activeCycle ? stats.activeCycle.name : 'None'}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={20} /></div>
          <div><div className="stat-label">Escalations</div><div className="stat-value">{stats.escalations}</div></div>
        </div>
      </div>
    </div>
  );
}
