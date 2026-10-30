import api from '../lib/axios';
import { AppNotification } from '../types';

export interface NotificationFilters {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
  priority?: string;
}

export interface NotificationListResponse {
  success: boolean;
  data: AppNotification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
}

export const notificationService = {
  /**
   * Retrieves paginated notifications for the authenticated user.
   */
  async getNotifications(filters: NotificationFilters = {}): Promise<NotificationListResponse> {
    try {
      const params: Record<string, any> = {};
      if (filters.page) params.page = filters.page;
      if (filters.limit) params.limit = filters.limit;
      if (filters.unreadOnly !== undefined) params.unreadOnly = filters.unreadOnly;
      if (filters.type && filters.type !== 'ALL') params.type = filters.type;
      if (filters.priority && filters.priority !== 'ALL') params.priority = filters.priority;

      const res = await api.get<NotificationListResponse>('/notifications', { params });
      return res.data;
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch notifications:', err);
      throw err;
    }
  },

  /**
   * Retrieves the current unread notification count for the authenticated user.
   */
  async getUnreadCount(): Promise<number> {
    try {
      const res = await api.get<{ success: boolean; unreadCount: number }>('/notifications/unread-count');
      return res.data.unreadCount;
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to fetch unread notification count:', err);
      throw err;
    }
  },

  /**
   * Marks a single notification as read.
   */
  async markAsRead(id: string): Promise<AppNotification> {
    try {
      const res = await api.patch<{ success: boolean; data: AppNotification }>(`/notifications/${id}/read`);
      return res.data.data;
    } catch (err: any) {
      console.error(`[EEC-RMS] Failed to mark notification ${id} as read:`, err);
      throw err;
    }
  },

  /**
   * Marks all notifications for the authenticated user as read.
   */
  async markAllAsRead(): Promise<{ success: boolean; message: string; updatedCount: number }> {
    try {
      const res = await api.patch<{ success: boolean; message: string; updatedCount: number }>('/notifications/read-all');
      return res.data;
    } catch (err: any) {
      console.error('[EEC-RMS] Failed to mark all notifications as read:', err);
      throw err;
    }
  },

  /**
   * Deletes a single notification belonging to the authenticated user.
   */
  async deleteNotification(id: string): Promise<boolean> {
    try {
      const res = await api.delete<{ success: boolean; message?: string }>(`/notifications/${id}`);
      return res.data.success;
    } catch (err: any) {
      console.error(`[EEC-RMS] Failed to delete notification ${id}:`, err);
      throw err;
    }
  },
};

export default notificationService;

