import api from '../lib/axios';
import { MaintenanceTicket, MaintenanceStatus, InspectionTest } from '../types';

export interface MaintenanceFilters {
  status?: string;
  priority?: string;
  departmentId?: string;
  resourceId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface MaintenanceMetrics {
  scope: string;
  departmentId?: string;
  totalRequests: number;
  activeWorkOrders: number;
  submittedCount: number;
  approvedCount: number;
  inProgressCount: number;
  onHoldCount: number;
  completedCount: number;
  rejectedCount: number;
  highOrCriticalCount: number;
  totalActualCostETB: number;
}

export const maintenanceService = {
  async getTickets(filters?: MaintenanceFilters): Promise<MaintenanceTicket[]> {
    try {
      const params: Record<string, any> = {};
      if (filters?.status && filters.status !== 'ALL') params.status = filters.status;
      if (filters?.priority && filters.priority !== 'ALL') params.priority = filters.priority;
      if (filters?.departmentId && filters.departmentId !== 'ALL') params.departmentId = filters.departmentId;
      if (filters?.resourceId && filters.resourceId !== 'ALL') params.resourceId = filters.resourceId;
      if (filters?.search && filters.search.trim()) params.search = filters.search.trim();
      if (filters?.page) params.page = filters.page;
      if (filters?.limit) params.limit = filters.limit;

      const res = await api.get('/maintenance', { params });
      return res.data.requests || [];
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch maintenance tickets:', err);
      throw err;
    }
  },

  async getMetrics(): Promise<MaintenanceMetrics | null> {
    try {
      const res = await api.get('/maintenance/metrics');
      return res.data.metrics || null;
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch maintenance metrics:', err);
      return null;
    }
  },

  async getById(id: string): Promise<MaintenanceTicket | null> {
    try {
      const res = await api.get(`/maintenance/${id}`);
      return res.data.request || null;
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      console.error(`[EEC-RMS] Failed to fetch maintenance ticket ${id}:`, err);
      throw err;
    }
  },

  async getInspections(): Promise<InspectionTest[]> {
    try {
      const res = await api.get('/maintenance/inspections');
      return res.data.inspections || [];
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch inspections:', err);
      return [];
    }
  },

  async createTicket(payload: {
    resourceId: string;
    title: string;
    description: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reportedDate?: string;
    estimatedCostETB?: number;
    assignedTechnicianId?: string;
    assignedTechnicianName?: string;
    reportedBy?: string; // accepted for backwards compatibility
  }): Promise<MaintenanceTicket> {
    try {
      const res = await api.post('/maintenance', payload);
      return res.data.request;
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to create maintenance ticket:', err);
      throw err;
    }
  },

  async reviewTicket(
    id: string,
    payload: {
      action: 'APPROVE' | 'REJECT';
      comments?: string;
      rejectionReason?: string;
      assignedTechnicianId?: string;
      assignedTechnicianName?: string;
    }
  ): Promise<MaintenanceTicket> {
    try {
      const res = await api.post(`/maintenance/${id}/review`, payload);
      return res.data.request;
    } catch (err: any) {
      console.error(`[EEC-RMS] Failed to review maintenance ticket ${id}:`, err);
      throw err;
    }
  },

  async updateStatus(
    id: string,
    newStatus: MaintenanceStatus,
    updates?: {
      assignedTechnicianId?: string;
      assignedTechnicianName?: string;
      diagnosis?: string;
      repairActions?: string;
      partsReplaced?: string;
      actualCostETB?: number;
      resolutionNotes?: string;
      outcome?: 'REPAIRED_FIT_FOR_USE' | 'REQUIRES_FURTHER_REPAIR' | 'BEYOND_ECONOMIC_REPAIR' | 'DISPOSED';
      conditionOnCompletion?: string;
      findings?: string; // backwards compat
      notes?: string;
    }
  ): Promise<MaintenanceTicket> {
    try {
      const payload = {
        status: newStatus,
        diagnosis: updates?.diagnosis || updates?.findings,
        repairActions: updates?.repairActions || updates?.findings,
        partsReplaced: updates?.partsReplaced,
        actualCostETB: updates?.actualCostETB,
        resolutionNotes: updates?.resolutionNotes || updates?.findings,
        outcome: updates?.outcome || 'REPAIRED_FIT_FOR_USE',
        conditionOnCompletion: updates?.conditionOnCompletion || 'GOOD',
        assignedTechnicianId: updates?.assignedTechnicianId,
        assignedTechnicianName: updates?.assignedTechnicianName,
        notes: updates?.notes || updates?.findings,
      };
      const res = await api.put(`/maintenance/${id}/progress`, payload);
      return res.data.request;
    } catch (err: any) {
      console.error(`[EEC-RMS] Failed to update maintenance status for ${id}:`, err);
      throw err;
    }
  },

  async recordInspection(payload: {
    ticketId?: string;
    resourceId?: string;
    inspectionType?: string;
    passed: boolean;
    findings: string;
    conductedBy?: string;
    certificationNumber?: string;
    expiryDate?: string;
    remarks?: string;
  }): Promise<InspectionTest> {
    try {
      const targetId = payload.ticketId || payload.resourceId;
      if (!targetId) throw new Error('Ticket ID or Resource ID required for inspection');
      const res = await api.post(`/maintenance/${targetId}/inspections`, {
        inspectionType: payload.inspectionType || 'MAINTENANCE_QA',
        passed: payload.passed,
        findings: payload.findings,
        certificationNumber: payload.certificationNumber,
        remarks: payload.remarks,
      });
      return res.data.inspection;
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to record inspection test:', err);
      throw err;
    }
  },
};
