import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { ResourceListPage } from '../pages/resources/ResourceListPage';
import { ResourceDetailPage } from '../pages/resources/ResourceDetailPage';

// Operations & Governance Pages
import { AssignmentsPage } from '../pages/assignments/AssignmentsPage';
import { RequisitionsPage } from '../pages/requisitions/RequisitionsPage';
import { ReturnsPage } from '../pages/returns/ReturnsPage';
import { MaintenancePage } from '../pages/maintenance/MaintenancePage';
import { DepartmentsPage } from '../pages/departments/DepartmentsPage';
import { EmployeesPage } from '../pages/employees/EmployeesPage';
import { EmployeeDetailPage } from '../pages/employees/EmployeeDetailPage';
import { ApprovalsPage } from '../pages/approvals/ApprovalsPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { ProfilePage } from '../pages/profile/ProfilePage';

// Authentication Pages
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { EECPreloader } from '../components/brand/EECPreloader';

export const AppRoutes: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <EECPreloader message="Verifying EEC Credentials" />;
  }

  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
      />
      <Route
        path="/forgot-password"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />}
      />
      <Route
        path="/reset-password"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />}
      />

      {/* Protected Corporate Application Routes */}
      <Route
        path="/"
        element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" replace />}
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="resources" element={<ResourceListPage />} />
        <Route path="resources/:id" element={<ResourceDetailPage />} />

        {/* Operations routes */}
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="requisitions" element={<RequisitionsPage />} />
        <Route path="returns" element={<ReturnsPage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="inspections" element={<Navigate to="/maintenance" replace />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
};
