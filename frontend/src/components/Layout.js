// src/components/Layout.js
import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Target, BarChart3, Users, Settings, LogOut, Bell,
  CheckSquare, ClipboardList, FileText, AlertTriangle, Share2, Shield,
  RefreshCw, BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

function NavItem({ to, icon: Icon, label, onClick }) {
  if (onClick) {
    return (
      <button className="nav-item" onClick={onClick}>
        <Icon size={16} />{label}
      </button>
    );
  }
  return (
    <NavLink to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
      <Icon size={16} />{label}
    </NavLink>
  );
}

function NotifDropdown({ onClose }) {
  const [data, setData] = useState({ notifications: [], unreadCount: 0 });

  useEffect(() => {
    api.get('/notifications').then(r => setData(r.data)).catch(() => {});
  }, []);

  const markAll = async () => {
    await api.put('/notifications/read-all');
    setData(d => ({ ...d, notifications: d.notifications.map(n => ({ ...n, is_read: 1 })), unreadCount: 0 }));
  };

  return (
    <div className="notif-dropdown">
      <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Notifications</span>
        {data.unreadCount > 0 && <button className="btn btn-sm btn-secondary" onClick={markAll}>Mark all read</button>}
      </div>
      {data.notifications.length === 0
        ? <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No notifications</div>
        : data.notifications.slice(0, 10).map(n => (
          <div key={n.id} className={`notif-item${n.is_read ? '' : ' unread'}`}>
            <div className="notif-title">{n.title}</div>
            <div className="notif-msg">{n.message}</div>
            <div className="notif-time">{n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : ''}</div>
          </div>
        ))
      }
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);

  useEffect(() => {
    api.get('/notifications').then(r => setUnreadCount(r.data.unreadCount)).catch(() => {});
    const interval = setInterval(() => {
      api.get('/notifications').then(r => setUnreadCount(r.data.unreadCount)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = e => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const getNavItems = () => {
    if (user?.role === 'employee') return [
      { to: '/employee', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/employee/goals', icon: Target, label: 'My Goals' },
      { to: '/employee/achievements', icon: BarChart3, label: 'Achievements' }
    ];
    if (user?.role === 'manager') return [
      { to: '/manager', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/manager/team', icon: Users, label: 'Team Goals' },
      { to: '/manager/checkins', icon: CheckSquare, label: 'Check-ins' }
    ];
    if (user?.role === 'admin') return [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/admin/users', icon: Users, label: 'Users' },
      { to: '/admin/cycles', icon: RefreshCw, label: 'Goal Cycles' },
      { to: '/admin/share-goals', icon: Share2, label: 'Share Goals' },
      { to: '/admin/reports', icon: FileText, label: 'Reports' },
      { to: '/admin/audit', icon: Shield, label: 'Audit Log' },
      { to: '/admin/escalations', icon: AlertTriangle, label: 'Escalations' },
      { to: '/admin/config', icon: Settings, label: 'Configuration' }
    ];
    return [];
  };

  const [pageTitle, setPageTitle] = useState('');

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-text">AtomQuest</div>
          <div className="sidebar-logo-sub">Goal Tracking Portal</div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {getNavItems().map(item => (
            <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} />
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button className="nav-item" style={{ marginTop: '0.5rem', width: '100%' }} onClick={handleLogout}>
            <LogOut size={16} />Sign Out
          </button>
        </div>
      </aside>

      <header className="top-header">
        <div className="header-title">
          {user?.department && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{user.department} · </span>}
          <span style={{ textTransform: 'capitalize' }}>{user?.role} Portal</span>
        </div>
        <div className="header-actions">
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button className="btn-icon" onClick={() => setShowNotif(s => !s)}>
              <Bell size={18} />
              {unreadCount > 0 && <span className="notif-badge" style={{ position: 'absolute', top: -4, right: -4 }}>{unreadCount}</span>}
            </button>
            {showNotif && <NotifDropdown onClose={() => setShowNotif(false)} />}
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="page-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
