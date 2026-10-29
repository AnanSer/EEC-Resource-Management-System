import api from '../lib/axios';
import { AssetReturnRecord, UserRole } from '../types';

export interface ScopeContext {
  role: UserRole;
  departmentId?: string;
}

function mapAssignmentToReturnRecord(a: any): AssetReturnRecord {
  return {
    id: a.id,
    returnNumber: `RET-${a.assignmentNumber ? a.assignmentNumber.replace(/^ASGN-/, '') : a.id.slice(0, 8).toUpperCase()}`,
    type: 'WALK_IN',
    resourceId: a.resourceId,
    resourceName: a.resourceName || a.resource?.name || 'Equipment',
    resourceCode: a.resourceCode || a.resource?.itemCode || '',
    assignmentId: a.id,
    employeeId: a.employeeId,
    employeeName: a.employeeName || a.employee?.name || 'Custodian',
    departmentName: a.departmentName || a.department?.name || '',
    status: 'RECEIVED',
    reason: a.returnNotes || a.notes || a.purpose || 'Surrendered to central warehouse',
    conditionOnReturn: a.conditionOnReturn || a.returnCondition || 'GOOD',
    returnLocation: a.returnLocation || 'Central Store - Kersa',
    receivedBy: a.returnReceivedByName || a.assignedBy || 'Chief Store Keeper',
    receivedAt: a.returnedAt || a.updatedAt,
    handoverNotes: a.returnNotes || undefined,
    createdAt: a.returnedAt || a.createdAt || new Date().toISOString(),
  };
}

/**
 * Service for Asset Returns (Scheduled & Walk-in).
 * Connects directly to backend /api/assignments/return.
 */
export const returnService = {
  async getAll(scope?: ScopeContext): Promise<AssetReturnRecord[]> {
    try {
      const params: Record<string, any> = { status: 'RETURNED' };
      if (scope?.role === 'DEPARTMENT_MANAGER' && scope.departmentId) {
        params.departmentId = scope.departmentId;
      }
      const res = await api.get('/assignments', { params });
      const assignments = res.data.assignments || [];
      return assignments.map(mapAssignmentToReturnRecord);
    } catch (err) {
      console.error('[returnService.getAll Error]', err);
      return [];
    }
  },

  async requestReturn(payload: {
    resourceId: string;
    reason: string;
    employeeId: string;
  }): Promise<AssetReturnRecord> {
    try {
      const res = await api.post('/assignments/return', {
        resourceId: payload.resourceId,
        notes: payload.reason,
        employeeId: payload.employeeId,
      });
      return mapAssignmentToReturnRecord(res.data.assignment);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit return notice';
      throw new Error(msg);
    }
  },

  async receive(payload: {
    returnId?: string;
    resourceId: string;
    conditionOnReturn: any;
    returnLocation: string;
    receivedBy?: string;
    handoverNotes?: string;
    isWalkIn?: boolean;
  }): Promise<AssetReturnRecord> {
    try {
      const res = await api.post('/assignments/return', {
        resourceId: payload.resourceId,
        assignmentId: payload.returnId,
        condition: payload.conditionOnReturn,
        returnLocation: payload.returnLocation,
        notes: payload.handoverNotes,
      });
      return mapAssignmentToReturnRecord(res.data.assignment);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Intake failed';
      throw new Error(msg);
    }
  },
};
