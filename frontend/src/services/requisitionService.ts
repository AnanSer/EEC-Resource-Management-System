import api from '../lib/axios';
import { ResourceRequisition, UserRole, ResourceCategory } from '../types';

export interface ScopeContext {
  role?: UserRole;
  departmentId?: string;
  userId?: string;
  employeeId?: string;
  status?: string;
  category?: string;
  urgency?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const requisitionService = {
  async getAll(scope?: ScopeContext): Promise<ResourceRequisition[]> {
    try {
      const params: Record<string, any> = {};
      if (scope?.status && scope.status !== 'ALL') params.status = scope.status;
      if (scope?.departmentId && scope.departmentId !== 'ALL') params.departmentId = scope.departmentId;
      if (scope?.category && scope.category !== 'ALL') params.category = scope.category;
      if (scope?.urgency && scope.urgency !== 'ALL') params.urgency = scope.urgency;
      if (scope?.search && scope.search.trim()) params.search = scope.search.trim();
      if (scope?.page) params.page = scope.page;
      if (scope?.limit) params.limit = scope.limit;

      const res = await api.get('/requisitions', { params });
      return res.data.requisitions || [];
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch requisitions:', err);
      throw err;
    }
  },

  async getById(id: string): Promise<ResourceRequisition | null> {
    try {
      const res = await api.get(`/requisitions/${id}`);
      return res.data.requisition || null;
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      console.error(`[EEC-RMS] Failed to fetch requisition ${id}:`, err);
      throw err;
    }
  },

  async submit(payload: {
    category: ResourceCategory;
    itemDescription: string;
    justification: string;
    urgency?: 'ROUTINE' | 'URGENT' | 'EMERGENCY_PROJECT';
    requiredDate?: string;
    departmentId?: string;
    employeeId?: string;
    isDirectAllocation?: boolean;
    requesterId?: string;
    requesterName?: string;
    requesterRole?: any;
    departmentName?: string;
  }): Promise<ResourceRequisition> {
    try {
      const res = await api.post('/requisitions', {
        category: payload.category,
        itemDescription: payload.itemDescription,
        justification: payload.justification,
        urgency: payload.urgency,
        requiredDate: payload.requiredDate,
        departmentId: payload.departmentId,
        employeeId: payload.employeeId,
        isDirectAllocation: payload.isDirectAllocation,
      });
      return res.data.requisition;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit requisition';
      throw new Error(msg);
    }
  },

  async approve(id: string, comments?: string): Promise<ResourceRequisition> {
    try {
      const res = await api.post(`/requisitions/${id}/approve`, {
        approvalComments: comments,
      });
      return res.data.requisition;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to approve requisition';
      throw new Error(msg);
    }
  },

  async reject(id: string, reason: string): Promise<ResourceRequisition> {
    try {
      const res = await api.post(`/requisitions/${id}/reject`, {
        reason,
      });
      return res.data.requisition;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to reject requisition';
      throw new Error(msg);
    }
  },

  async cancel(id: string, _requesterId?: string): Promise<ResourceRequisition> {
    try {
      const res = await api.post(`/requisitions/${id}/cancel`, {});
      return res.data.requisition;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to cancel requisition';
      throw new Error(msg);
    }
  },

  async fulfill(payload: {
    requisitionId: string;
    resourceId: string;
    handoverNotes?: string;
    location?: string;
    storeKeeperName?: string;
  }): Promise<ResourceRequisition> {
    try {
      const res = await api.post(`/requisitions/${payload.requisitionId}/fulfill`, {
        resourceId: payload.resourceId,
        handoverNotes: payload.handoverNotes,
        location: payload.location,
      });
      return res.data.requisition;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to fulfill requisition';
      throw new Error(msg);
    }
  },
};
