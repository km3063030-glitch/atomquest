// src/components/Layout.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Target, BarChart3, Users, Settings, LogOut, Bell,
  CheckSquare, FileText, AlertTriangle, Share2, Shield,
  RefreshCw, Menu, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

function NavItem({ to, icon: Icon, label, onClick, onNav }) {
  if (onClick) {
    return (
      <button className="nav-item" onClick={onClick}>
        <Icon size={16} />{label}
      </button>
    );
  }
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      onClick={onNav}
    >
      <Icon size={16} />{label}
    </NavLink>
  );
}

function NotifDropdown({ onClose }) {
  const [data, setData] = useState({ notifications: [], unreadCount: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/notifications').then(r => setData(r.data)).catch(() => {});
  }, []);

  const markAll = async () => {
    await api.put('/notifications/read-all');
    setData(d => ({ ...d, notifications: d.notifications.map(n => ({ ...n, is_read: 1 })), unreadCount: 0 }));
  };

  const handleNotifClick = (n) => {
    if (n.link) navigate(n.link);
    onClose();
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
          <div key={n.id} className={`notif-item${n.is_read ? '' : ' unread'}`} onClick={() => handleNotifClick(n)} style={{ cursor: n.link ? 'pointer' : 'default' }}>
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
  const location = useLocation();
  const [showNotif, setShowNotif] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

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

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="sidebar-logo-text">AtomQuest</div>
            <div className="sidebar-logo-sub">Goal Tracking Portal</div>
          </div>
          {/* Close button visible only on mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'none', padding: '0.25rem' }}
            className="sidebar-close-btn"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {getNavItems().map(item => (
            <NavItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              onNav={() => setSidebarOpen(false)}
            />
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
        {/* Hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(s => !s)}>
            <Menu size={22} />
          </button>
          <div className="header-title">
            {user?.department && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{user.department} · </span>}
            <span style={{ textTransform: 'capitalize' }}>{user?.role} Portal</span>
          </div>
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
