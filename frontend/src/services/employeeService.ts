import api from '../lib/axios';
import { Employee, UserRole } from '../types';

export interface ScopeContext {
  role: UserRole;
  departmentId?: string;
}

/**
 * Service for Employee personnel management backed by live PostgreSQL API.
 * 
 * BACKEND PERMISSIONS ARCHITECTURE:
 * - ADMIN / STORE_KEEPER / IT_TECHNICIAN: Corporation-wide personnel visibility.
 * - DEPARTMENT_MANAGER / EMPLOYEE: Strictly server-side scoped to their assigned directorate.
 */
export const employeeService = {
  async getAll(scope?: ScopeContext): Promise<Employee[]> {
    try {
      const params = scope?.departmentId && scope.role === 'ADMIN' ? { departmentId: scope.departmentId } : undefined;
      const res = await api.get('/employees', { params });
      return res.data.employees || [];
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch employee roster:', err);
      throw err;
    }
  },

  async getById(id: string, _scope?: ScopeContext): Promise<Employee | undefined> {
    try {
      const res = await api.get(`/employees/${id}`);
      return res.data.employee;
    } catch (err: any) {
      console.error(`[EEC-RMS] Failed to fetch employee ${id}:`, err);
      return undefined;
    }
  },

  async getByDepartment(departmentId: string): Promise<Employee[]> {
    try {
      const res = await api.get('/employees', { params: { departmentId } });
      return res.data.employees || [];
    } catch (err: any) {
      console.error(`[EEC-RMS] Failed to fetch employees for department ${departmentId}:`, err);
      return [];
    }
  },

  async addEmployee(payload: Omit<Employee, 'id'>): Promise<Employee> {
    const res = await api.post('/employees', payload);
    return res.data.employee;
  },

  async updateEmployee(id: string, payload: Partial<Employee>): Promise<Employee> {
    const res = await api.put(`/employees/${id}`, payload);
    return res.data.employee;
  },

  async deleteEmployee(id: string): Promise<void> {
    await api.delete(`/employees/${id}`);
  }
};
