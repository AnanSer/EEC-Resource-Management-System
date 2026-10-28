import api from '../lib/axios';
import { Resource, ResourceCategory, ResourceStatus, DashboardMetrics } from '../types';

export interface ResourceFilters {
  search?: string;
  category?: ResourceCategory | 'ALL';
  status?: ResourceStatus | 'ALL';
  departmentId?: string;
  page?: number;
  limit?: number;
}

/**
 * Service for Physical Resource Management backed by real PostgreSQL API endpoints.
 * 
 * BACKEND PERMISSIONS ARCHITECTURE:
 * - ADMIN: Corporation-wide full lifecycle management, create, edit, decommission, and delete.
 * - STORE_KEEPER: Corporation-wide resource intake, registration, and inventory updates. Cannot delete.
 * - IT_TECHNICIAN: Technical condition updates and specs maintenance. Cannot register new or delete.
 * - DEPARTMENT_MANAGER: Strictly scoped to assets assigned to their specific department.
 * - EMPLOYEE: View-only permissions within their assigned department.
 */
export const resourceService = {
  async getAll(filters?: ResourceFilters): Promise<Resource[]> {
    try {
      const params: Record<string, any> = {};
      if (filters?.category && filters.category !== 'ALL') {
        params.category = filters.category;
      }
      if (filters?.status && filters.status !== 'ALL') {
        params.status = filters.status;
      }
      if (filters?.departmentId && filters.departmentId !== 'ALL') {
        params.departmentId = filters.departmentId;
      }
      if (filters?.search && filters.search.trim()) {
        params.search = filters.search.trim();
      }
      if (filters?.page) {
        params.page = filters.page;
      }
      if (filters?.limit) {
        params.limit = filters.limit;
      }

      const res = await api.get('/resources', { params });
      return res.data.resources || [];
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch resources:', err);
      throw err;
    }
  },

  async getById(id: string): Promise<Resource | null> {
    try {
      const res = await api.get(`/resources/${id}`);
      return res.data.resource || null;
    } catch (err: any) {
      if (err.response?.status === 404) {
        return null;
      }
      console.error(`[EEC-RMS] Failed to fetch resource ${id}:`, err);
      throw err;
    }
  },

  async create(resource: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>): Promise<Resource> {
    try {
      const payload: Record<string, any> = {
        itemCode: resource.itemCode,
        name: resource.name,
        category: resource.category,
        subcategory: resource.subcategory,
        departmentId: resource.currentDepartmentId,
        condition: resource.condition,
        location: resource.location,
        purchaseDate: resource.purchaseDate,
        purchaseCost: resource.purchaseCostETB,
        currency: 'ETB',
        supplier: resource.supplier,
        notes: resource.notes,
      };

      if (resource.vehicleSpecs) {
        payload.manufacturer = resource.vehicleSpecs.make;
        payload.model = resource.vehicleSpecs.model;
        payload.serialNumber = resource.vehicleSpecs.chassisNumber;
        payload.specs = resource.vehicleSpecs;
      } else if (resource.itSpecs) {
        payload.manufacturer = resource.itSpecs.brand;
        payload.model = resource.itSpecs.model;
        payload.serialNumber = resource.itSpecs.serialNumber;
        payload.specs = resource.itSpecs;
      } else if (resource.machinerySpecs) {
        payload.manufacturer = resource.machinerySpecs.make;
        payload.model = resource.machinerySpecs.model;
        payload.serialNumber = resource.machinerySpecs.serialNumber;
        payload.specs = resource.machinerySpecs;
      } else if (resource.surveyingSpecs) {
        payload.manufacturer = resource.surveyingSpecs.make;
        payload.model = resource.surveyingSpecs.model;
        payload.serialNumber = resource.surveyingSpecs.serialNumber;
        payload.specs = resource.surveyingSpecs;
      }

      const res = await api.post('/resources', payload);
      return res.data.resource;
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to create resource:', err);
      throw err;
    }
  },

  async update(id: string, updates: Partial<Resource>): Promise<Resource | null> {
    try {
      const payload: Record<string, any> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.subcategory !== undefined) payload.subcategory = updates.subcategory;
      if (updates.currentDepartmentId !== undefined) payload.departmentId = updates.currentDepartmentId;
      if (updates.condition !== undefined) payload.condition = updates.condition;
      if (updates.location !== undefined) payload.location = updates.location;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.purchaseCostETB !== undefined) payload.purchaseCost = updates.purchaseCostETB;
      if (updates.purchaseDate !== undefined) payload.purchaseDate = updates.purchaseDate;
      if (updates.supplier !== undefined) payload.supplier = updates.supplier;

      if (updates.vehicleSpecs) payload.specs = updates.vehicleSpecs;
      else if (updates.itSpecs) payload.specs = updates.itSpecs;
      else if (updates.machinerySpecs) payload.specs = updates.machinerySpecs;
      else if (updates.surveyingSpecs) payload.specs = updates.surveyingSpecs;

      const res = await api.put(`/resources/${id}`, payload);
      return res.data.resource || null;
    } catch (err: any) {
      console.error(`[EEC-RMS] Failed to update resource ${id}:`, err);
      throw err;
    }
  },

  async updateStatus(id: string, status: ResourceStatus): Promise<Resource | null> {
    return this.update(id, { status });
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/resources/${id}`);
    } catch (err: any) {
      console.error(`[EEC-RMS] Failed to delete resource ${id}:`, err);
      throw err;
    }
  },

  async getMetrics(): Promise<DashboardMetrics> {
    try {
      const res = await api.get('/resources/metrics');
      const data = res.data.metrics || {};
      return {
        scope: data.scope || 'CORPORATION',
        departmentId: data.departmentId || null,
        departmentName: data.departmentName || null,
        departmentCode: data.departmentCode || null,
        totalAssets: data.totalAssets ?? 0,
        availableAssets: data.availableAssets ?? 0,
        assignedAssets: data.assignedAssets ?? 0,
        maintenanceAssets: data.maintenanceAssets ?? 0,
        testingAssets: data.testingAssets ?? 0,
        retiredAssets: data.retiredAssets ?? 0,
        totalValueETB: data.totalValueETB ?? 0,
        utilizationRate: data.utilizationRate ?? 0,
        categoryCounts: data.categoryCounts ?? {},
        categoryValues: data.categoryValues ?? {},
        categoryPercentages: data.categoryPercentages ?? {},
        statusCounts: data.statusCounts ?? {},
        recentAlerts: [],
      };
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch resource metrics:', err);
      throw err;
    }
  }
};
