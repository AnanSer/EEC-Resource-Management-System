import api from '../lib/axios';
import { Employee, EmployeeProfileDossier, UserRole } from '../types';

export interface ScopeContext {
  role: UserRole;
  departmentId?: string;
}

export interface EmployeeFilterParams {
  search?: string;
  departmentId?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface EmployeeDirectoryResult {
  employees: Employee[];
  counts: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Service for Employee personnel management backed by live PostgreSQL API.
 * 
 * BACKEND PERMISSIONS ARCHITECTURE:
 * - ADMIN / STORE_KEEPER / IT_TECHNICIAN: Corporation-wide personnel visibility.
 * - DEPARTMENT_MANAGER / EMPLOYEE: Strictly server-side scoped to their assigned directorate.
 */
export const employeeService = {
  /**
   * Fetch full employee roster.
   * If called with just scope (legacy), retrieves list without artificial department filtering for Admin.
   * If called with filter params, passes search/filter/pagination to backend.
   */
  async getAll(filtersOrScope?: EmployeeFilterParams | ScopeContext): Promise<Employee[]> {
    try {
      const result = await this.getDirectory(filtersOrScope);
      return result.employees;
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch employee roster:', err);
      throw err;
    }
  },

  /**
   * Get employee directory with aggregation counts and pagination metadata.
   */
  async getDirectory(filtersOrScope?: EmployeeFilterParams | ScopeContext): Promise<EmployeeDirectoryResult> {
    try {
      const params: Record<string, any> = {};

      if (filtersOrScope) {
        // Check if it's filter params
        const f = filtersOrScope as EmployeeFilterParams;
        if (f.search) params.search = f.search;
        if (f.departmentId && f.departmentId !== 'ALL') params.departmentId = f.departmentId;
        if (f.role && f.role !== 'ALL') params.role = f.role;
        if (f.status && f.status !== 'ALL') params.status = f.status;
        if (f.page) params.page = f.page;
        if (f.limit) params.limit = f.limit;
      }

      const res = await api.get('/employees', { params });
      return {
        employees: res.data.employees || [],
        counts: res.data.counts || {
          total: (res.data.employees || []).length,
          active: (res.data.employees || []).filter((e: any) => e.isActive).length,
          pending: (res.data.employees || []).filter((e: any) => e.accountStatus === 'PENDING').length,
          suspended: (res.data.employees || []).filter((e: any) => e.accountStatus === 'SUSPENDED').length,
        },
        pagination: res.data.pagination || {
          total: (res.data.employees || []).length,
          page: 1,
          limit: 100,
          totalPages: 1,
        },
      };
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch employee directory:', err);
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

  /**
   * Retrieve full operational dossier for a specific employee.
   * Includes active custody, assignment history, transfers, requisitions, maintenance tickets, and audit log.
   */
  async getProfile(id: string): Promise<EmployeeProfileDossier> {
    const res = await api.get(`/employees/${id}`);
    const data = res.data;
    const dossier = data.dossier || data.profile || data;
    return {
      employee: data.employee,
      dossier: {
        assignedResources: dossier.assignedResources || [],
        assignments: dossier.assignments || [],
        transfers: dossier.transfers || [],
        requisitions: dossier.requisitions || [],
        maintenanceRequests: dossier.maintenanceRequests || [],
        auditEvents: dossier.auditEvents || [],
      },
    };
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

  /**
   * Admin-only: Approve pending employee registration.
   */
  async approveEmployee(
    id: string,
    payload: { role: string; departmentId?: string; designation?: string }
  ): Promise<{ success: boolean; message: string; employee: Employee }> {
    const res = await api.post(`/employees/${id}/approve`, payload);
    return res.data;
  },

  /**
   * Admin-only: Reject pending employee registration.
   */
  async rejectEmployee(id: string, reason?: string): Promise<{ success: boolean; message: string }> {
    const res = await api.post(`/employees/${id}/reject`, { reason });
    return res.data;
  },

  /**
   * Admin-only: Suspend active employee account.
   */
  async suspendEmployee(id: string, reason?: string): Promise<{ success: boolean; message: string }> {
    const res = await api.post(`/employees/${id}/suspend`, { reason });
    return res.data;
  },

  /**
   * Admin-only: Reactivate suspended employee account.
   */
  async reactivateEmployee(id: string): Promise<{ success: boolean; message: string }> {
    const res = await api.post(`/employees/${id}/reactivate`);
    return res.data;
  },

  async deleteEmployee(id: string): Promise<void> {
    await api.delete(`/employees/${id}`);
  }
};
