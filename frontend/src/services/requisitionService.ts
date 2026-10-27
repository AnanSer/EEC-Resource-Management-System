import { ResourceRequisition, UserRole } from '../types';
import { mockStore } from '../mock/store';

export interface ScopeContext {
  role: UserRole;
  departmentId?: string;
  userId?: string;
  employeeId?: string;
}

/**
 * Service for Resource Requisitions and Approval workflows.
 * 
 * SECURITY & PERMISSIONS ARCHITECTURE:
 * - ADMIN: Corporation-wide approval authority across all directorates.
 * - STORE_KEEPER: Corporation-wide physical fulfillment and asset dispatch.
 * - DEPARTMENT_MANAGER: Scoped to requisitions submitted by staff within their department.
 * - EMPLOYEE: Strictly personal requisitions.
 * 
 * IMPORTANT BACKEND REQUIREMENT:
 * Production backend must validate requester department on submission and restrict approval endpoints to ADMIN.
 */
export const requisitionService = {
  async getAll(scope?: ScopeContext): Promise<ResourceRequisition[]> {
    const reqs = await mockStore.getRequisitions();
    if (!scope) return reqs;

    if (scope.role === 'EMPLOYEE') {
      return reqs.filter(r => r.requesterId === scope.userId || r.requesterId === scope.employeeId);
    }
    if (scope.role === 'DEPARTMENT_MANAGER' && scope.departmentId) {
      return reqs.filter(r => r.departmentId === scope.departmentId);
    }
    return reqs;
  },

  async submit(payload: {
    requesterId: string;
    requesterName: string;
    requesterRole: any;
    departmentId: string;
    departmentName: string;
    category: any;
    itemDescription: string;
    justification: string;
    urgency: any;
    requiredDate: string;
  }): Promise<ResourceRequisition> {
    return mockStore.submitRequisition(payload);
  },

  async approve(id: string, adminName: string): Promise<ResourceRequisition> {
    return mockStore.approveRequisition(id, adminName);
  },

  async reject(id: string, reason: string): Promise<ResourceRequisition> {
    return mockStore.rejectRequisition(id, reason);
  },

  async cancel(id: string, requesterId: string): Promise<ResourceRequisition> {
    return mockStore.cancelRequisition(id, requesterId);
  },

  async fulfill(payload: {
    requisitionId: string;
    resourceId: string;
    storeKeeperName: string;
    handoverNotes?: string;
  }): Promise<ResourceRequisition> {
    return mockStore.fulfillRequisition(payload);
  }
};
