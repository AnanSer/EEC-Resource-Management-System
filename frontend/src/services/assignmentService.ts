import { AssetAssignment, UserRole } from '../types';
import { mockStore } from '../mock/store';

export interface ScopeContext {
  role: UserRole;
  departmentId?: string;
}

/**
 * Service for Asset Assignments and Custody Transfers.
 * 
 * SECURITY & PERMISSIONS ARCHITECTURE:
 * - ADMIN / STORE_KEEPER: Full enterprise visibility over corporate asset assignments.
 * - DEPARTMENT_MANAGER: Scoped to tracking assignments within their own department.
 * 
 * IMPORTANT BACKEND REQUIREMENT:
 * Production backend must enforce assignment ownership and department constraints independently.
 */
export const assignmentService = {
  async getAll(scope?: ScopeContext): Promise<AssetAssignment[]> {
    const asgns = await mockStore.getAssignments();
    if (scope && scope.role === 'DEPARTMENT_MANAGER' && scope.departmentId) {
      return asgns.filter(a => a.departmentId === scope.departmentId);
    }
    return asgns;
  },

  async createDirect(payload: {
    resourceId: string;
    employeeId: string;
    purpose: string;
    expectedReturnDate?: string;
    assignedBy: string;
  }): Promise<AssetAssignment> {
    return mockStore.createDirectAssignment(payload);
  },

  async transfer(payload: {
    resourceId: string;
    newEmployeeId: string;
    transferNotes: string;
    transferredBy: string;
  }): Promise<AssetAssignment> {
    return mockStore.transferCustody(payload);
  }
};
