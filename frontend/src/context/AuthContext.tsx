import React, { createContext, useContext, useState } from 'react';
import { UserRole, Employee } from '../types';
import { MOCK_EMPLOYEES } from '../mock/employees.mock';

export interface RoleMeta {
  role: UserRole;
  label: string;
  description: string;
  badgeColor: string;
}

export const AUTH_ROLES: RoleMeta[] = [
  { role: 'ADMIN', label: 'System Administrator', description: 'Full system control, audits, user and resource management', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' },
  { role: 'STORE_KEEPER', label: 'Chief Store Keeper', description: 'Central warehouse inventory, custody assignment, returns, inspections', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
  { role: 'IT_TECHNICIAN', label: 'IT Support & Technician', description: 'IT hardware diagnostics, maintenance tickets, and calibration', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  { role: 'DEPARTMENT_MANAGER', label: 'Department Manager', description: 'Department approvals, custody tracking, and budget allocation', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { role: 'EMPLOYEE', label: 'Engineer / Field Officer', description: 'View assigned items, request new resources, and report issues', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200' },
];

interface AuthContextType {
  currentUser: Employee;
  currentRole: UserRole;
  switchRole: (role: UserRole) => void;
  allRoles: RoleMeta[];
}

const AuthContext = createContext<AuthContextType>({
  currentUser: MOCK_EMPLOYEES[0],
  currentRole: 'ADMIN',
  switchRole: () => {},
  allRoles: AUTH_ROLES,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>('ADMIN');

  const currentUser = MOCK_EMPLOYEES.find(e => e.role === currentRole) || MOCK_EMPLOYEES[0];

  const switchRole = (role: UserRole) => {
    setCurrentRole(role);
  };

  return (
    <AuthContext.Provider value={{ currentUser, currentRole, switchRole, allRoles: AUTH_ROLES }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
