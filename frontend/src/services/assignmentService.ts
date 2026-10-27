import { AssetAssignment } from '../types';
import { mockStore } from '../mock/store';

export const assignmentService = {
  async getAll(): Promise<AssetAssignment[]> {
    return mockStore.getAssignments();
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
