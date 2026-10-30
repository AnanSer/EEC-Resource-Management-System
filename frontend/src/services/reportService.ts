import api from '../lib/axios';
import {
  ReportOverviewData,
  ReportFilterParams,
  AuditTrailResponse,
  AuditFilterParams,
  ResourceLifecycleResponse,
} from '../types';

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

  async getAuditTrail(filters?: AuditFilterParams): Promise<AuditTrailResponse> {
    try {
      const params: Record<string, any> = {};
      if (filters?.search) params.search = filters.search;
      if (filters?.startDate) params.startDate = filters.startDate;
      if (filters?.endDate) params.endDate = filters.endDate;
      if (filters?.departmentId && filters.departmentId !== 'ALL') params.departmentId = filters.departmentId;
      if (filters?.actionType && filters.actionType !== 'ALL') params.actionType = filters.actionType;
      if (filters?.category && filters.category !== 'ALL') params.category = filters.category;
      if (filters?.userId && filters.userId !== 'ALL') params.userId = filters.userId;
      if (filters?.page) params.page = filters.page;
      if (filters?.limit) params.limit = filters.limit;

      const res = await api.get('/reports/audit', { params });
      return res.data;
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch audit trail:', err);
      throw err;
    }
  },

  async exportAuditCSV(filters?: AuditFilterParams): Promise<Blob> {
    const params: Record<string, any> = {};
    if (filters?.search) params.search = filters.search;
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    if (filters?.departmentId && filters.departmentId !== 'ALL') params.departmentId = filters.departmentId;
    if (filters?.actionType && filters.actionType !== 'ALL') params.actionType = filters.actionType;
    if (filters?.category && filters.category !== 'ALL') params.category = filters.category;
    if (filters?.userId && filters.userId !== 'ALL') params.userId = filters.userId;

    const res = await api.get('/reports/audit/export/csv', {
      params,
      responseType: 'blob',
    });
    return res.data;
  },

  async exportAuditXLSX(filters?: AuditFilterParams): Promise<Blob> {
    const params: Record<string, any> = {};
    if (filters?.search) params.search = filters.search;
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    if (filters?.departmentId && filters.departmentId !== 'ALL') params.departmentId = filters.departmentId;
    if (filters?.actionType && filters.actionType !== 'ALL') params.actionType = filters.actionType;
    if (filters?.category && filters.category !== 'ALL') params.category = filters.category;
    if (filters?.userId && filters.userId !== 'ALL') params.userId = filters.userId;

    const res = await api.get('/reports/audit/export/xlsx', {
      params,
      responseType: 'blob',
    });
    return res.data;
  },

  async exportAuditPDF(filters?: AuditFilterParams): Promise<Blob> {
    const params: Record<string, any> = {};
    if (filters?.search) params.search = filters.search;
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    if (filters?.departmentId && filters.departmentId !== 'ALL') params.departmentId = filters.departmentId;
    if (filters?.actionType && filters.actionType !== 'ALL') params.actionType = filters.actionType;
    if (filters?.category && filters.category !== 'ALL') params.category = filters.category;
    if (filters?.userId && filters.userId !== 'ALL') params.userId = filters.userId;

    const res = await api.get('/reports/audit/export/pdf', {
      params,
      responseType: 'blob',
    });
    return res.data;
  },

  async getResourceLifecycle(resourceId: string): Promise<ResourceLifecycleResponse> {
    try {
      const res = await api.get(`/reports/lifecycle/${resourceId}`);
      return res.data;
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch resource lifecycle:', err);
      throw err;
    }
  },

  async exportLifecyclePDF(resourceId: string): Promise<Blob> {
    const res = await api.get(`/reports/lifecycle/${resourceId}/export/pdf`, {
      responseType: 'blob',
    });
    return res.data;
  },
};

export function triggerFileDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}


