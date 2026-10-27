import { MaintenanceTicket, InspectionTest } from '../types';
import { mockStore } from '../mock/store';

export const maintenanceService = {
  async getTickets(): Promise<MaintenanceTicket[]> {
    return mockStore.getMaintenanceTickets();
  },

  async createTicket(payload: {
    resourceId: string;
    title: string;
    description: string;
    priority: any;
    reportedBy: string;
    assignedTechnician?: string;
    estimatedCostETB?: number;
  }): Promise<MaintenanceTicket> {
    return mockStore.createMaintenanceTicket(payload);
  },

  async updateStatus(id: string, newStatus: any, updates?: Partial<MaintenanceTicket>): Promise<MaintenanceTicket> {
    return mockStore.updateMaintenanceStatus(id, newStatus, updates);
  },

  async getInspections(): Promise<InspectionTest[]> {
    return mockStore.getInspections();
  },

  async recordInspection(payload: {
    ticketId?: string;
    resourceId: string;
    inspectionType: any;
    passed: boolean;
    findings: string;
    conductedBy: string;
    certificationNumber?: string;
    expiryDate?: string;
    remarks: string;
  }): Promise<InspectionTest> {
    return mockStore.recordInspection(payload);
  }
};
