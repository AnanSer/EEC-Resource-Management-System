import { AssetReturnRecord } from '../types';
import { mockStore } from '../mock/store';

export const returnService = {
  async getAll(): Promise<AssetReturnRecord[]> {
    return mockStore.getReturns();
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
