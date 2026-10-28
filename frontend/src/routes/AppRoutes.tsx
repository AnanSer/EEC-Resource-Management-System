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
import { InspectionsPage } from '../pages/inspections/InspectionsPage';
import { DepartmentsPage } from '../pages/departments/DepartmentsPage';
import { EmployeesPage } from '../pages/employees/EmployeesPage';
import { ApprovalsPage } from '../pages/approvals/ApprovalsPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { ProfilePage } from '../pages/profile/ProfilePage';

// Authentication Pages
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';

export const AppRoutes: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-eec-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-slate-700 tracking-wider uppercase">
          Verifying EEC Security Credentials...
        </p>
      </div>
    );
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
        <Route path="inspections" element={<InspectionsPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="employees" element={<EmployeesPage />} />
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
