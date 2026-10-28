import api from '../lib/axios';
import { UserApproval, UserRole } from '../types';

export const approvalService = {
  async getAll(): Promise<UserApproval[]> {
    try {
      const res = await api.get('/auth/users');
      const users = res.data.users || [];
      return users.map((u: any): UserApproval => ({
        id: u.id,
        name: u.fullName,
        email: u.email,
        departmentId: 'dept-eng-01',
        departmentName: 'Engineering Directorate',
        designation: u.role.replace(/_/g, ' '),
        requestedRole: u.role as UserRole,
        status: u.status,
        createdAt: u.createdAt,
        reviewedAt: u.updatedAt,
      }));
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch users for approval:', err);
      throw err;
    }
  },

  async approve(id: string, role?: string): Promise<any> {
    const res = await api.post(`/auth/users/${id}/approve`, { role });
    return res.data;
  },

  async reject(id: string, reason: string): Promise<any> {
    const res = await api.post(`/auth/users/${id}/reject`, { reason });
    return res.data;
  }
};
