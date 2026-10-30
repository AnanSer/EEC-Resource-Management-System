import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { AppNotification } from '../types';
import notificationService from '../services/notificationService';

interface NotificationContextType {
  unreadCount: number;
  recentNotifications: AppNotification[];
  loadingRecent: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [recentNotifications, setRecentNotifications] = useState<AppNotification[]>([]);
  const [loadingRecent, setLoadingRecent] = useState<boolean>(false);
  const lastFetchRef = useRef<number>(0);

  const refreshNotifications = useCallback(async () => {
    if (!currentUser || !currentUser.id) {
      setUnreadCount(0);
      setRecentNotifications([]);
      return;
    }

    try {
      setLoadingRecent(true);
      const [count, listRes] = await Promise.all([
        notificationService.getUnreadCount(),
        notificationService.getNotifications({ page: 1, limit: 6 }),
      ]);
      setUnreadCount(count);
      setRecentNotifications(listRes.data || []);
      lastFetchRef.current = Date.now();
    } catch (err) {
      console.warn('[NotificationContext] Failed to refresh notifications:', err);
    } finally {
      setLoadingRecent(false);
    }
  }, [currentUser]);

  // Initial load when user changes
  useEffect(() => {
    if (currentUser?.id) {
      refreshNotifications();
    } else {
      setUnreadCount(0);
      setRecentNotifications([]);
    }
  }, [currentUser?.id, refreshNotifications]);

  // Re-fetch on window focus or visibility change, throttled to at most once every 10 seconds
  useEffect(() => {
    const handleFocus = () => {
      if (!currentUser?.id) return;
      const now = Date.now();
      if (now - lastFetchRef.current > 10000) {
        refreshNotifications();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser?.id, refreshNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setRecentNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[NotificationContext] Failed to mark as read:', err);
      throw err;
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setRecentNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('[NotificationContext] Failed to mark all as read:', err);
      throw err;
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await notificationService.deleteNotification(id);
      const target = recentNotifications.find((n) => n.id === id);
      setRecentNotifications((prev) => prev.filter((n) => n.id !== id));
      if (target && !target.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('[NotificationContext] Failed to delete notification:', err);
      throw err;
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        recentNotifications,
        loadingRecent,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;

