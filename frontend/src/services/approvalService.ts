import { UserApproval } from '../types';
import { mockStore } from '../mock/store';

export const approvalService = {
  async getAll(): Promise<UserApproval[]> {
    return mockStore.getUserApprovals();
  },

  async approve(id: string, reviewedBy: string): Promise<UserApproval> {
    return mockStore.approveUser(id, reviewedBy);
  },

  async reject(id: string, reason: string): Promise<UserApproval> {
    return mockStore.rejectUser(id, reason);
  }
};
