import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserRole, Employee } from '../types';
import api from '../lib/axios';

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

function getRoleDesignation(role: string): string {
  switch (role) {
    case 'ADMIN': return 'System Administrator & Auditor';
    case 'STORE_KEEPER': return 'Chief Logistics & Store Officer';
    case 'IT_TECHNICIAN': return 'Hardware & Systems Specialist';
    case 'DEPARTMENT_MANAGER': return 'Engineering Directorate Manager';
    case 'EMPLOYEE':
    default:
      return 'Project Engineer / Field Officer';
  }
}

function mapUserToEmployee(user: any): Employee {
  const emp = user.employee;
  return {
    id: emp?.id || user.id,
    employeeId: emp?.employeeId || user.employeeId || `EEC-EMP-${user.id.slice(0, 4).toUpperCase()}`,
    name: emp?.name || user.fullName || user.name || 'EEC Personnel',
    email: emp?.email || user.email,
    phone: emp?.phone || '+251 91 123 4567',
    departmentId: emp?.departmentId || user.departmentId || 'dept-eng-01',
    departmentName: user.departmentName || user.department?.name || 'Engineering Directorate',
    designation: emp?.designation || getRoleDesignation(user.role),
    role: (emp?.role || user.role) as UserRole,
    isActive: emp ? emp.isActive : (user.status === 'APPROVED' || user.status === 'ACTIVE'),
    hireDate: '2023-01-15',
  };
}

const EMPTY_USER: Employee = {
  id: '',
  employeeId: '',
  name: 'EEC Guest',
  email: '',
  phone: '',
  departmentId: 'dept-eng-01',
  departmentName: 'Engineering Directorate',
  designation: 'Staff',
  role: 'EMPLOYEE',
  isActive: false,
  hireDate: '',
};

interface AuthContextType {
  currentUser: Employee;
  currentRole: UserRole;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; code?: string }>;
  register: (fullName: string, email: string, password: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  logout: () => Promise<void>;
  switchRole?: (role: UserRole) => void;
  allRoles: RoleMeta[];
}

const AuthContext = createContext<AuthContextType>({
  currentUser: EMPTY_USER,
  currentRole: 'EMPLOYEE',
  isAuthenticated: false,
  loading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  allRoles: AUTH_ROLES,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Employee>(EMPTY_USER);
  const [currentRole, setCurrentRole] = useState<UserRole>('EMPLOYEE');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Check existing session on application boot
  const restoreSession = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.authenticated && res.data.user) {
        const emp = mapUserToEmployee(res.data.user);
        setCurrentUser(emp);
        setCurrentRole(emp.role);
        setIsAuthenticated(true);
      } else {
        setCurrentUser(EMPTY_USER);
        setIsAuthenticated(false);
      }
    } catch {
      setCurrentUser(EMPTY_USER);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data?.success && res.data.user) {
        const emp = mapUserToEmployee(res.data.user);
        setCurrentUser(emp);
        setCurrentRole(emp.role);
        setIsAuthenticated(true);
        return { success: true };
      }
      return { success: false, error: 'Login response invalid' };
    } catch (err: any) {
      const errData = err.response?.data;
      return {
        success: false,
        error: errData?.message || 'Authentication failed. Please check your network and credentials.',
        code: errData?.code,
      };
    }
  };

  const register = async (fullName: string, email: string, password: string) => {
    try {
      const res = await api.post('/auth/register', { fullName, email, password });
      return {
        success: true,
        message: res.data?.message || 'Registration submitted for administrator approval.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.message || 'Registration failed.',
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      setCurrentUser(EMPTY_USER);
      setIsAuthenticated(false);
      setCurrentRole('EMPLOYEE');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        isAuthenticated,
        loading,
        login,
        register,
        logout,
        allRoles: AUTH_ROLES,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
