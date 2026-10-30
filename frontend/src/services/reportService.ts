import api from '../lib/axios';
import { ReportOverviewData, ReportFilterParams } from '../types';

export const reportService = {
  async getOverview(filters?: ReportFilterParams): Promise<ReportOverviewData> {
    try {
      const params: Record<string, any> = {};
      if (filters?.startDate) params.startDate = filters.startDate;
      if (filters?.endDate) params.endDate = filters.endDate;
      if (filters?.departmentId && filters.departmentId !== 'ALL') params.departmentId = filters.departmentId;
      if (filters?.category && filters.category !== 'ALL') params.category = filters.category;
      if (filters?.status && filters.status !== 'ALL') params.status = filters.status;
      if (filters?.maintenanceStatus && filters.maintenanceStatus !== 'ALL') params.maintenanceStatus = filters.maintenanceStatus;

      const res = await api.get('/reports/overview', { params });
      return res.data;
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch report overview:', err);
      throw err;
    }
  },
};

