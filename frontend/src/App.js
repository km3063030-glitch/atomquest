// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import EmployeeDashboard from './pages/employee/Dashboard';
import GoalSheet from './pages/employee/GoalSheet';
import Achievements from './pages/employee/Achievements';
import ManagerDashboard from './pages/manager/Dashboard';
import TeamGoals from './pages/manager/TeamGoals';
import ReviewSheet from './pages/manager/ReviewSheet';
import ManagerCheckins from './pages/manager/Checkins';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminCycles from './pages/admin/Cycles';
import AdminReports from './pages/admin/Reports';
import AdminAudit from './pages/admin/Audit';
import AdminConfig from './pages/admin/Config';
import ShareGoals from './pages/admin/ShareGoals';
import Escalations from './pages/admin/Escalations';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner"/></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'manager') return <Navigate to="/manager" replace />;
  return <Navigate to="/employee" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: { fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', borderRadius: '10px', border: '1px solid #E2E8F8' },
          success: { iconTheme: { primary: '#10B981', secondary: 'white' } },
          error: { iconTheme: { primary: '#EF4444', secondary: 'white' } }
        }} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Employee */}
          <Route path="/employee" element={<ProtectedRoute roles={['employee']}><Layout /></ProtectedRoute>}>
            <Route index element={<EmployeeDashboard />} />
            <Route path="goals" element={<GoalSheet />} />
            <Route path="achievements" element={<Achievements />} />
          </Route>

          {/* Manager */}
          <Route path="/manager" element={<ProtectedRoute roles={['manager']}><Layout /></ProtectedRoute>}>
            <Route index element={<ManagerDashboard />} />
            <Route path="team" element={<TeamGoals />} />
            <Route path="review/:sheetId" element={<ReviewSheet />} />
            <Route path="checkins" element={<ManagerCheckins />} />
          </Route>

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Layout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="cycles" element={<AdminCycles />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="config" element={<AdminConfig />} />
            <Route path="share-goals" element={<ShareGoals />} />
            <Route path="escalations" element={<Escalations />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
