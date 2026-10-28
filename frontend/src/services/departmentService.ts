import api from '../lib/axios';
import { Department, UserRole } from '../types';

export interface ScopeContext {
  role: UserRole;
  departmentId?: string;
}

export interface CreateDepartmentPayload {
  name: string;
  code: string;
  description?: string;
  managerName?: string;
  location?: string;
  budgetCode?: string;
}

/**
 * Service for Department directorate management backed by live PostgreSQL API.
 * 
 * BACKEND PERMISSIONS ARCHITECTURE:
 * - ADMIN: Corporation-wide visibility and administrative authority (create, edit, delete).
 * - DEPARTMENT_MANAGER / EMPLOYEE: Server-side strictly scoped to their assigned directorate.
 */
export const departmentService = {
  async getAll(_scope?: ScopeContext): Promise<Department[]> {
    try {
      const res = await api.get('/departments');
      return res.data.departments || [];
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch departments:', err);
      throw err;
    }
  },

  async getById(id: string): Promise<Department | undefined> {
    try {
      const res = await api.get(`/departments/${id}`);
      return res.data.department;
    } catch (err: any) {
      console.error(`[EEC-RMS] Failed to fetch department ${id}:`, err);
      return undefined;
    }
  },

  async create(payload: CreateDepartmentPayload): Promise<Department> {
    const res = await api.post('/departments', payload);
    return res.data.department;
  },

  async update(id: string, payload: Partial<CreateDepartmentPayload>): Promise<Department> {
    const res = await api.put(`/departments/${id}`, payload);
    return res.data.department;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/departments/${id}`);
  }
};
