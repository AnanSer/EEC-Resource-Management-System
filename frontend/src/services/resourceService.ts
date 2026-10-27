import { Resource, ResourceCategory, ResourceStatus } from '../types';
import { mockStore } from '../mock/store';

export interface ResourceFilters {
  search?: string;
  category?: ResourceCategory | 'ALL';
  status?: ResourceStatus | 'ALL';
  departmentId?: string;
}

export const resourceService = {
  async getAll(filters?: ResourceFilters): Promise<Resource[]> {
    let list = await mockStore.getResources();

    if (!filters) return list;

    if (filters.category && filters.category !== 'ALL') {
      list = list.filter(r => r.category === filters.category);
    }

    if (filters.status && filters.status !== 'ALL') {
      list = list.filter(r => r.status === filters.status);
    }

    if (filters.departmentId && filters.departmentId !== 'ALL') {
      list = list.filter(r => r.currentDepartmentId === filters.departmentId);
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.itemCode.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        (r.currentAssigneeName && r.currentAssigneeName.toLowerCase().includes(q)) ||
        (r.vehicleSpecs && r.vehicleSpecs.plateNumber.toLowerCase().includes(q))
      );
    }

    return list;
  },

  async getById(id: string): Promise<Resource | null> {
    return mockStore.getResourceById(id);
  },

  async create(resource: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>): Promise<Resource> {
    return mockStore.addResource(resource);
  },

  async update(id: string, updates: Partial<Resource>): Promise<Resource | null> {
    return mockStore.updateResource(id, updates);
  },

  async updateStatus(id: string, status: ResourceStatus): Promise<Resource | null> {
    return mockStore.updateResource(id, { status });
  },

  async getMetrics() {
    const all = await mockStore.getResources();
    const alerts = await mockStore.getNotifications();

    const totalAssets = all.length;
    const availableAssets = all.filter(r => r.status === 'AVAILABLE').length;
    const assignedAssets = all.filter(r => r.status === 'ASSIGNED').length;
    const maintenanceAssets = all.filter(r => r.status === 'MAINTENANCE').length;
    const testingAssets = all.filter(r => r.status === 'TESTING').length;

    const totalValueETB = all.reduce((sum, r) => sum + (r.currentValueETB || 0), 0);

    const categoryCounts = all.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {} as Record<ResourceCategory, number>);

    const statusCounts = all.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<ResourceStatus, number>);

    return {
      totalAssets,
      availableAssets,
      assignedAssets,
      maintenanceAssets,
      testingAssets,
      totalValueETB,
      categoryCounts,
      statusCounts,
      recentAlerts: alerts,
    };
  }
};
