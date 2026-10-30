import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { useNotifications } from '../../context/NotificationContext';
import notificationService from '../../services/notificationService';
import { AppNotification } from '../../types';
import { 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  CheckCheck, 
  Calendar,
  ExternalLink,
  ShieldCheck,
  Wrench,
  Clock,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ArrowLeftRight,
  UserCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type TabType = 'ALL' | 'UNREAD' | 'ACTION_REQUIRED' | 'CRITICAL';

export const NotificationsPage: React.FC = () => {
  const { unreadCount: globalUnreadCount, refreshNotifications: refreshGlobalNotifications } = useNotifications();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(15);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pageUnreadCount, setPageUnreadCount] = useState<number>(0);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        page,
        limit: pageSize,
      };

      if (activeTab === 'UNREAD') {
        params.unreadOnly = true;
      } else if (activeTab === 'CRITICAL') {
        params.priority = 'CRITICAL';
      }

      const res = await notificationService.getNotifications(params);
      setNotifications(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
      setPageUnreadCount(res.unreadCount || 0);
    } catch (err: any) {
      console.error('[NotificationsPage] Error loading notifications:', err);
      setError(err?.response?.data?.error || 'Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, pageSize]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setProcessingId(id);
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setPageUnreadCount((prev) => Math.max(0, prev - 1));
      refreshGlobalNotifications();
    } catch (err: any) {
      console.error('[NotificationsPage] Mark as read error:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setPageUnreadCount(0);
      refreshGlobalNotifications();
    } catch (err: any) {
      console.error('[NotificationsPage] Mark all as read error:', err);
      setError('Failed to mark all as read. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setProcessingId(id);
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      refreshGlobalNotifications();
    } catch (err: any) {
      console.error('[NotificationsPage] Delete notification error:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleNotificationClick = async (item: AppNotification) => {
    if (!item.isRead) {
      try {
        await handleMarkAsRead(item.id);
      } catch {}
    }
    const dest = item.actionUrl || item.link;
    if (dest && dest.startsWith('/')) {
      navigate(dest);
    }
  };

  // Client-side filter for ACTION_REQUIRED
  const displayedNotifications = notifications.filter((n) => {
    if (activeTab === 'ACTION_REQUIRED') {
      return !n.isRead && (n.priority === 'HIGH' || n.priority === 'CRITICAL' || ['REQUISITION', 'MAINTENANCE'].includes(n.type));
    }
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'MAINTENANCE':
        return <Wrench className="w-5 h-5 text-amber-600" />;
      case 'REQUISITION':
        return <ClipboardList className="w-5 h-5 text-indigo-600" />;
      case 'ASSIGNMENT':
        return <ArrowLeftRight className="w-5 h-5 text-emerald-600" />;
      case 'USER':
        return <UserCheck className="w-5 h-5 text-purple-600" />;
      case 'CRITICAL':
      case 'ALERT':
        return <AlertOctagon className="w-5 h-5 text-rose-600" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'SUCCESS':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      default:
        return <Info className="w-5 h-5 text-sky-600" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'HIGH':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'LOW':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'NORMAL':
      default:
        return 'bg-sky-100 text-sky-800 border-sky-200';
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'MAINTENANCE':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'REQUISITION':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'ASSIGNMENT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'USER':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const effectiveUnread = Math.max(globalUnreadCount, pageUnreadCount);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader
        title="Notifications & Operational Alerts"
        subtitle="Real-time operational alerts, workflow handovers, maintenance updates, and asset notices"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchNotifications()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {effectiveUnread > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
            >
              <CheckCheck className="w-4 h-4 text-eec-primary" />
              Mark All as Read ({effectiveUnread})
            </button>
          )}
        </div>
      </PageHeader>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Notifications</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <Bell className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Unread Items</p>
            <p className="text-xl font-bold text-amber-600 mt-1">{effectiveUnread}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Critical & High Priority</p>
            <p className="text-xl font-bold text-rose-600 mt-1">
              {notifications.filter((n) => n.priority === 'CRITICAL' || n.priority === 'HIGH').length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Maintenance & Equipment</p>
            <p className="text-xl font-bold text-sky-600 mt-1">
              {notifications.filter((n) => n.type === 'MAINTENANCE' || n.title.includes('Maintenance') || n.title.includes('Repair')).length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <Wrench className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Tab Navigation */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'ALL', label: 'All Alerts' },
              { id: 'UNREAD', label: `Unread (${effectiveUnread})` },
              { id: 'ACTION_REQUIRED', label: 'Action Required' },
              { id: 'CRITICAL', label: 'Critical' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-eec-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500">
          Showing {displayedNotifications.length} of {totalCount} records
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between">
          <p className="text-xs text-rose-700 font-medium">{error}</p>
          <button
            onClick={() => fetchNotifications()}
            className="px-3 py-1 bg-white border border-rose-300 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/80">
            <RefreshCw className="w-7 h-7 text-eec-primary animate-spin mx-auto mb-2 opacity-60" />
            <p className="text-xs text-slate-400 font-medium">Loading notifications from enterprise server...</p>
          </div>
        ) : displayedNotifications.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/80">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-slate-700">No notifications found</p>
            <p className="text-xs text-slate-400 mt-1">
              {activeTab === 'UNREAD'
                ? "You've read all your notifications."
                : 'There are no notifications matching your current filter.'}
            </p>
          </div>
        ) : (
          displayedNotifications.map((item) => {
            const dest = item.actionUrl || item.link;
            const isClickable = Boolean(dest && dest.startsWith('/'));

            return (
              <div
                key={item.id}
                onClick={() => isClickable && handleNotificationClick(item)}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isClickable ? 'cursor-pointer hover:shadow-md' : ''
                } ${
                  item.isRead
                    ? 'bg-white border-slate-200/70 opacity-90'
                    : 'bg-white border-eec-primary/40 shadow-sm ring-1 ring-eec-primary/10'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 mt-0.5 flex-shrink-0">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getTypeBadge(item.type)}`}>
                        {item.type}
                      </span>
                      {item.priority && item.priority !== 'NORMAL' && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(item.priority)}`}>
                          {item.priority}
                        </span>
                      )}
                      <h3 className={`text-sm ${!item.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {item.title}
                      </h3>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Unread" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed break-words">{item.message}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {new Date(item.createdAt).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {item.readAt && (
                        <span className="text-[10px] text-slate-400">
                          (Read: {new Date(item.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex-shrink-0">
                  {dest && dest.startsWith('/') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNotificationClick(item);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!item.isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(item.id, e)}
                      disabled={processingId === item.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-eec-primary/10 hover:bg-eec-primary/20 text-eec-primary rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                      title="Mark as Read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Acknowledge</span>
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    disabled={processingId === item.id}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete Notification"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <span className="text-xs text-slate-600 font-medium">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
