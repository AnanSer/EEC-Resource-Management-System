import { ResourceRequisition } from '../types';
import { mockStore } from '../mock/store';

export const requisitionService = {
  async getAll(): Promise<ResourceRequisition[]> {
    return mockStore.getRequisitions();
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
