import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Search, 
  ChevronDown, 
  Menu, 
  LogOut, 
  User, 
  ShieldCheck, 
  Building2,
  CheckCheck,
  ArrowRight
} from 'lucide-react';

interface NavbarProps {
  onToggleMobileSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileSidebar }) => {
  const { currentUser, currentRole, logout } = useAuth();
  const { 
    unreadCount, 
    recentNotifications, 
    loadingRecent, 
    markAsRead, 
    markAllAsRead, 
    refreshNotifications 
  } = useNotifications();
  const navigate = useNavigate();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const roleBadgeColors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
    STORE_KEEPER: 'bg-amber-100 text-amber-800 border-amber-200',
    IT_TECHNICIAN: 'bg-blue-100 text-blue-800 border-blue-200',
    DEPARTMENT_MANAGER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    EMPLOYEE: 'bg-slate-100 text-slate-800 border-slate-200',
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shadow-sm">
      {/* Left: Mobile hamburger & search */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <button
          onClick={onToggleMobileSidebar}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full max-w-sm hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search resources, serial numbers, plate numbers..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-accent/30 focus:border-eec-accent transition-all text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Right: Real Authenticated Session Badge, Notifications, User Menu */}
      <div className="flex items-center gap-3">
        {/* Active Role Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl border bg-slate-50 text-xs font-semibold text-slate-700">
          <ShieldCheck className="w-3.5 h-3.5 text-eec-primary" />
          <span className="text-slate-400 font-normal">Role:</span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${roleBadgeColors[currentRole] || 'bg-slate-100 text-slate-700'}`}>
            {currentRole}
          </span>
        </div>

        {/* Notifications Bell & Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              const nextState = !notifDropdownOpen;
              setNotifDropdownOpen(nextState);
              if (nextState) {
                refreshNotifications();
              }
            }}
            className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors focus:outline-none"
            title="Notifications"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-extrabold bg-rose-600 text-white rounded-full flex items-center justify-center shadow-sm animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setNotifDropdownOpen(false)} 
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-dropdown border border-slate-200/90 py-2 z-50 animate-fadeIn">
                {/* Dropdown Header */}
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={async () => {
                        await markAllAsRead();
                      }}
                      className="text-[11px] font-semibold text-eec-primary hover:text-eec-primary/80 flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Dropdown Body */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {loadingRecent && recentNotifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Loading notifications...
                    </div>
                  ) : recentNotifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <Bell className="w-8 h-8 text-slate-300 mx-auto mb-1.5 opacity-60" />
                      <p className="text-xs font-bold text-slate-700">No notifications yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">You're all caught up with operations</p>
                    </div>
                  ) : (
                    recentNotifications.map((item) => {
                      const dest = item.actionUrl || item.link;
                      return (
                        <div
                          key={item.id}
                          onClick={async () => {
                            if (!item.isRead) {
                              try {
                                await markAsRead(item.id);
                              } catch {}
                            }
                            setNotifDropdownOpen(false);
                            if (dest && dest.startsWith('/')) {
                              navigate(dest);
                            } else {
                              navigate('/notifications');
                            }
                          }}
                          className={`p-3 text-left cursor-pointer transition-colors hover:bg-slate-50 flex items-start gap-2.5 ${
                            !item.isRead ? 'bg-amber-50/40' : 'bg-white'
                          }`}
                        >
                          <div className="mt-0.5 flex-shrink-0">
                            {!item.isRead ? (
                              <span className="w-2 h-2 rounded-full bg-rose-500 block mt-1" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-slate-200 block mt-1" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <p className={`text-xs truncate ${!item.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                {item.title}
                              </p>
                              <span className="text-[10px] text-slate-400 flex-shrink-0">
                                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                              {item.message}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Dropdown Footer */}
                <div className="px-4 py-2 border-t border-slate-100 text-center">
                  <Link
                    to="/notifications"
                    onClick={() => setNotifDropdownOpen(false)}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-eec-primary hover:text-eec-primary/80 transition-colors w-full py-1"
                  >
                    <span>View all notifications</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Authenticated User Menu Dropdown */}
        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 pl-2 border-l border-slate-200 hover:opacity-90 transition-opacity focus:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-eec-primary text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-none">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{currentUser.designation}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {profileDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setProfileDropdownOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-dropdown border border-slate-200/90 py-2 z-50 animate-fadeIn">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>{currentUser.departmentName || 'Engineering Directorate'}</span>
                    </div>
                  </div>

                  <div className="p-1 space-y-0.5">
                    <Link
                      to="/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors font-medium"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Personnel Profile & Custody</span>
                    </Link>

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors font-semibold"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Sign Out (End Session)</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
