import { Employee, UserRole } from '../types';
import { mockStore } from '../mock/store';

export interface ScopeContext {
  role: UserRole;
  departmentId?: string;
}

/**
 * Service for Employee personnel management.
 * 
 * SECURITY & PERMISSIONS ARCHITECTURE:
 * - ADMIN: Unrestricted enterprise-wide access across all corporation departments.
 * - DEPARTMENT_MANAGER: Strictly scoped to viewing and selecting employees belonging to their own department.
 * - STORE_KEEPER / IT_TECHNICIAN: Enterprise inventory and technical operational visibility.
 * - EMPLOYEE: Personal custody visibility.
 * 
 * IMPORTANT BACKEND REQUIREMENT:
 * The production backend Express/Prisma API must enforce these authorization boundaries independently
 * on all /api/employees and related endpoints via server-side middleware (e.g., requireDepartmentAccess).
 * Client-side scoping serves exclusively for prototype workflow fidelity and UI ergonomics.
 */
export const employeeService = {
  async getAll(scope?: ScopeContext): Promise<Employee[]> {
    const emps = await mockStore.getEmployees();
    if (scope && scope.role === 'DEPARTMENT_MANAGER' && scope.departmentId) {
      return emps.filter(e => e.departmentId === scope.departmentId);
    }
    return emps;
  },

  async getById(id: string, scope?: ScopeContext): Promise<Employee | undefined> {
    const emps = await this.getAll(scope);
    return emps.find(e => e.id === id);
  },

  async getByDepartment(departmentId: string): Promise<Employee[]> {
    const emps = await mockStore.getEmployees();
    return emps.filter(e => e.departmentId === departmentId);
  },

  async addEmployee(payload: Omit<Employee, 'id'>): Promise<Employee> {
    return mockStore.addEmployee(payload);
  }
};
