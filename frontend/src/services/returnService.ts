import { AssetReturnRecord, UserRole } from '../types';
import { mockStore } from '../mock/store';

export interface ScopeContext {
  role: UserRole;
  departmentId?: string;
}

/**
 * Service for Asset Returns (Scheduled & Walk-in).
 * 
 * SECURITY & PERMISSIONS ARCHITECTURE:
 * - STORE_KEEPER / ADMIN: Full receiving authority and condition inspection.
 * - DEPARTMENT_MANAGER: Visibility over returns concerning assets allocated to their department.
 * 
 * IMPORTANT BACKEND REQUIREMENT:
 * Production backend must enforce inventory return procedures independently.
 */
export const returnService = {
  async getAll(scope?: ScopeContext): Promise<AssetReturnRecord[]> {
    const rets = await mockStore.getReturns();
    if (scope && scope.role === 'DEPARTMENT_MANAGER' && scope.departmentId) {
      const deptAssignments = (await mockStore.getAssignments())
        .filter(a => a.departmentId === scope.departmentId)
        .map(a => a.resourceId);
      return rets.filter(r => deptAssignments.includes(r.resourceId));
    }
    return rets;
  },

  async requestReturn(payload: {
    resourceId: string;
    reason: string;
    employeeId: string;
  }): Promise<AssetReturnRecord> {
    return mockStore.requestReturn(payload);
  },

  async receive(payload: {
    returnId?: string;
    resourceId: string;
    conditionOnReturn: any;
    returnLocation: string;
    receivedBy: string;
    handoverNotes?: string;
    isWalkIn?: boolean;
  }): Promise<AssetReturnRecord> {
    return mockStore.receiveReturn(payload);
  }
};
