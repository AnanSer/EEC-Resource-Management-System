import api from '../lib/axios';
import { AssetAssignment, CustodyTransfer, Resource, ResourceCondition } from '../types';

export interface AssignmentFilters {
  search?: string;
  status?: 'ALL' | 'ACTIVE' | 'RETURNED' | 'TRANSFERRED';
  departmentId?: string;
  employeeId?: string;
  resourceId?: string;
  page?: number;
  limit?: number;
}

export interface ResourceCustodyHistory {
  resource: Partial<Resource>;
  currentAssignment: AssetAssignment | null;
  assignments: AssetAssignment[];
  transfers: CustodyTransfer[];
  timeline: Array<{
    type: 'INTAKE' | 'ASSIGNMENT' | 'TRANSFER' | 'RETURN';
    title: string;
    description: string;
    date: string;
    actor: string;
    assignmentNumber?: string;
    transferNumber?: string;
    department?: string;
    fromDept?: string;
    toDept?: string;
    status?: string;
  }>;
}

export const assignmentService = {
  async getAll(filters?: AssignmentFilters): Promise<AssetAssignment[]> {
    try {
      const params: Record<string, any> = {};
      if (filters?.search && filters.search.trim()) params.search = filters.search.trim();
      if (filters?.status && filters.status !== 'ALL') params.status = filters.status;
      if (filters?.departmentId && filters.departmentId !== 'ALL') params.departmentId = filters.departmentId;
      if (filters?.employeeId && filters.employeeId !== 'ALL') params.employeeId = filters.employeeId;
      if (filters?.resourceId && filters.resourceId !== 'ALL') params.resourceId = filters.resourceId;
      if (filters?.page) params.page = filters.page;
      if (filters?.limit) params.limit = filters.limit;

      const res = await api.get('/assignments', { params });
      return res.data.assignments || [];
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch assignments:', err);
      throw err;
    }
  },

  async getById(id: string): Promise<AssetAssignment | null> {
    try {
      const res = await api.get(`/assignments/${id}`);
      return res.data.assignment || null;
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      console.error(`[EEC-RMS] Failed to fetch assignment ${id}:`, err);
      throw err;
    }
  },

  async getHistory(resourceId: string): Promise<ResourceCustodyHistory> {
    try {
      const res = await api.get(`/assignments/history/${resourceId}`);
      return res.data;
    } catch (err: any) {
      console.error(`[EEC-RMS] Failed to fetch custody history for resource ${resourceId}:`, err);
      throw err;
    }
  },

  async createDirect(payload: {
    resourceId: string;
    employeeId: string;
    purpose: string;
    expectedReturnDate?: string;
    notes?: string;
    location?: string;
    assignedBy?: string;
  }): Promise<AssetAssignment> {
    try {
      const res = await api.post('/assignments', {
        resourceId: payload.resourceId,
        employeeId: payload.employeeId,
        purpose: payload.purpose,
        expectedReturnDate: payload.expectedReturnDate,
        notes: payload.notes,
        location: payload.location,
      });
      return res.data.assignment;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create assignment';
      throw new Error(msg);
    }
  },

  async transfer(payload: {
    resourceId: string;
    newEmployeeId?: string;
    toEmployeeId?: string;
    transferNotes?: string;
    notes?: string;
    reason?: string;
    newLocation?: string;
    transferredBy?: string;
  }): Promise<AssetAssignment> {
    try {
      const toEmployeeId = payload.toEmployeeId || payload.newEmployeeId;
      const notes = payload.notes || payload.transferNotes;
      const res = await api.post('/assignments/transfer', {
        resourceId: payload.resourceId,
        toEmployeeId,
        reason: payload.reason,
        notes,
        newLocation: payload.newLocation,
      });
      return res.data.assignment;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to transfer custody';
      throw new Error(msg);
    }
  },

  async returnResource(payload: {
    resourceId: string;
    condition?: ResourceCondition;
    returnLocation?: string;
    notes?: string;
  }): Promise<AssetAssignment> {
    try {
      const res = await api.post('/assignments/return', payload);
      return res.data.assignment;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to process return';
      throw new Error(msg);
    }
  },

  async getMyCustody(): Promise<{
    employee: any;
    activeHoldings: AssetAssignment[];
    historicalHoldings: AssetAssignment[];
    totalActive: number;
  }> {
    try {
      const res = await api.get('/assignments/my-custody');
      return res.data;
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch personal custody holdings:', err);
      throw err;
    }
  },
};
