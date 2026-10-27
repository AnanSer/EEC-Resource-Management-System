import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { mockStore } from '../../mock/store';
import { NotificationItem } from '../../types';
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
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const data = await mockStore.getNotifications();
    setNotifications(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    await mockStore.markNotificationRead(id);
    loadData();
  };

  const handleMarkAllRead = async () => {
    if ((mockStore as any).markAllNotificationsRead) {
      await (mockStore as any).markAllNotificationsRead();
      loadData();
    }
  };

  const filtered = notifications.filter(n => {
    if (showUnreadOnly && n.isRead) return false;
    if (filterType === 'ALL') return true;
    return n.type === filterType;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'ALERT':
        return <AlertOctagon className="w-5 h-5 text-rose-600" />;
      case 'SUCCESS':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      default:
        return <Info className="w-5 h-5 text-sky-600" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch(type) {
      case 'WARNING':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ALERT':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'SUCCESS':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-sky-100 text-sky-800 border-sky-200';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader
        title="Notifications & System Alerts"
        subtitle="Live event notifications, roadworthiness expiry warnings, and workflow action items"
      >
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
          >
            <CheckCheck className="w-4 h-4 text-eec-primary" />
            Mark All as Read ({unreadCount})
          </button>
        )}
      </PageHeader>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Notifications</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{notifications.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <Bell className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Unread Action Items</p>
            <p className="text-xl font-bold text-amber-600 mt-1">{unreadCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Regulatory Warnings</p>
            <p className="text-xl font-bold text-rose-600 mt-1">
              {notifications.filter(n => n.type === 'WARNING' || n.type === 'ALERT').length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Maintenance & QA</p>
            <p className="text-xl font-bold text-sky-600 mt-1">
              {notifications.filter(n => n.title.includes('Maintenance') || n.title.includes('QA') || n.title.includes('Work Order')).length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <Wrench className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and View Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'WARNING', 'ALERT', 'SUCCESS', 'INFO'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filterType === type
                  ? 'bg-eec-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type === 'ALL' ? 'All Alerts' : type}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
              className="rounded border-slate-300 text-eec-primary focus:ring-eec-primary"
            />
            Show unread only
          </label>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
            <p className="text-xs text-slate-400">Loading notifications...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No notifications found</p>
            <p className="text-xs text-slate-400 mt-1">You are all caught up with system alerts and regulatory schedules</p>
          </div>
        ) : (
          filtered.map(item => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                item.isRead
                  ? 'bg-white border-slate-200/70 opacity-90'
                  : 'bg-white border-eec-primary/30 shadow-card ring-1 ring-eec-primary/10'
              }`}
            >
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 mt-0.5">
                  {getTypeIcon(item.type)}
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getTypeBadge(item.type)}`}>
                      {item.type}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-eec-terracotta" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.message}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                {item.link && (
                  <Link
                    to={item.link}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <span>View Target</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
                {!item.isRead && (
                  <button
                    onClick={() => handleMarkAsRead(item.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-eec-primary/10 hover:bg-eec-primary/20 text-eec-primary rounded-xl text-xs font-semibold transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Acknowledge</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
