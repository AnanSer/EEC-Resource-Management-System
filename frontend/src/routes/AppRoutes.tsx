import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { ResourceListPage } from '../pages/resources/ResourceListPage';
import { ResourceDetailPage } from '../pages/resources/ResourceDetailPage';

// Operations & Governance Placeholder Pages
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

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
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

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
};
