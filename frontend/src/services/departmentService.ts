import { Department, UserRole } from '../types';
import { mockStore } from '../mock/store';

export interface ScopeContext {
  role: UserRole;
  departmentId?: string;
}

/**
 * Service for Department directorate management.
 * 
 * SECURITY & PERMISSIONS ARCHITECTURE:
 * - ADMIN: Can view, create, and manage all corporate directorates and field offices.
 * - DEPARTMENT_MANAGER: Strictly scoped to viewing their own department's profile and allocated assets.
 * 
 * IMPORTANT BACKEND REQUIREMENT:
 * The production backend must enforce department boundary checks independently on /api/departments
 * and ensure non-admin users cannot alter corporate organizational structure.
 */
export const departmentService = {
  async getAll(scope?: ScopeContext): Promise<Department[]> {
    const depts = await mockStore.getDepartments();
    if (scope && scope.role === 'DEPARTMENT_MANAGER' && scope.departmentId) {
      return depts.filter(d => d.id === scope.departmentId);
    }
    return depts;
  },

  async getById(id: string): Promise<Department | undefined> {
    const depts = await mockStore.getDepartments();
    return depts.find(d => d.id === id);
  }
};
